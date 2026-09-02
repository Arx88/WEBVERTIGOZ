-- ============================================================
-- VÉRTIGO Cup — Sistema de notificaciones in-app (2026-09-01)
--
-- Tabla `notification` + triggers que la llenan solos:
--   1. on_bet_settled      → apuesta del espectador queda won/lost/voided
--   2. on_match_scheduled  → se programa la llave: avisa a los 2 capitanes
--                            y a TODOS los espectadores (oportunidad de apuesta)
--   3. on_match_finished   → resultado de la llave: avisa a los 2 capitanes
--
-- Escritura SOLO vía triggers SECURITY DEFINER o service role.
-- Lectura: cada cuenta ve únicamente sus filas (vía espejo account).
-- ============================================================

CREATE TABLE IF NOT EXISTS notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  -- bet_won | bet_lost | bet_voided | bet_open | match_scheduled | match_result | generic
  type varchar(40) NOT NULL DEFAULT 'generic',
  title varchar(160) NOT NULL,
  body varchar(400),
  link varchar(300),
  match_id uuid, -- referencia opcional a la llave (sin FK: no cascading raro)
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_account_created_idx
  ON notification(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_account_unread_idx
  ON notification(account_id) WHERE read_at IS NULL;

ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_select_own ON notification;
CREATE POLICY notification_select_own ON notification
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account a
      WHERE a.id = notification.account_id
        AND a.supabase_auth_id = auth.uid()
    )
  );
-- Sin policies de INSERT/UPDATE/DELETE: la escritura es solo
-- service-role / triggers. Nadie puede marcar leídas ajenas ni fabricar avisos.

-- ============================================================
-- 1) Apuesta resuelta: ganaste / perdiste / anulada
-- ============================================================
CREATE OR REPLACE FUNCTION notify_bet_settled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_a text;
  v_team_b text;
  v_picked text;
BEGIN
  SELECT ta_a.name, ta_b.name
    INTO v_team_a, v_team_b
  FROM match m
  JOIN team_registration tr_a ON tr_a.id = m.team_a_id
  JOIN team_account ta_a      ON ta_a.id = tr_a.team_account_id
  JOIN team_registration tr_b ON tr_b.id = m.team_b_id
  JOIN team_account ta_b      ON ta_b.id = tr_b.team_account_id
  WHERE m.id = NEW.match_id;

  SELECT ta.name INTO v_picked
  FROM team_registration tr
  JOIN team_account ta ON ta.id = tr.team_account_id
  WHERE tr.id = NEW.picked_team_id;

  IF NEW.status = 'won' THEN
    INSERT INTO notification (account_id, type, title, body, link, match_id)
    VALUES (
      NEW.spectator_account_id,
      'bet_won',
      '¡Ganaste la apuesta! +' || NEW.payout || ' pts',
      COALESCE(v_team_a, 'Equipo A') || ' vs ' || COALESCE(v_team_b, 'Equipo B')
        || ' — acertaste con ' || COALESCE(v_picked, 'tu equipo') || '.',
      '/apuestas',
      NEW.match_id
    );
  ELSIF NEW.status = 'lost' THEN
    INSERT INTO notification (account_id, type, title, body, link, match_id)
    VALUES (
      NEW.spectator_account_id,
      'bet_lost',
      'Apuesta perdida: -' || NEW.stake || ' pts',
      COALESCE(v_team_a, 'Equipo A') || ' vs ' || COALESCE(v_team_b, 'Equipo B')
        || ' — no acertó ' || COALESCE(v_picked, 'tu equipo') || '.',
      '/apuestas',
      NEW.match_id
    );
  ELSE -- voided: llave cancelada, stake reintegrado
    INSERT INTO notification (account_id, type, title, body, link, match_id)
    VALUES (
      NEW.spectator_account_id,
      'bet_voided',
      'Apuesta anulada: +' || NEW.stake || ' pts devueltos',
      'La llave fue cancelada y recuperaste tu stake.',
      '/apuestas',
      NEW.match_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bet_settled ON bet;
CREATE TRIGGER on_bet_settled
  AFTER UPDATE ON bet
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status IN ('won', 'lost', 'voided'))
  EXECUTE FUNCTION notify_bet_settled();

-- ============================================================
-- 2) Llave programada: oportunidad de apuesta + aviso a capitanes
-- ============================================================
CREATE OR REPLACE FUNCTION notify_match_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_a text;
  v_team_b text;
  v_owner_a uuid;
  v_owner_b uuid;
  v_when text;
BEGIN
  SELECT ta_a.name, ta_b.name, ta_a.owner_id, ta_b.owner_id
    INTO v_team_a, v_team_b, v_owner_a, v_owner_b
  FROM team_registration tr_a
  JOIN team_account ta_a ON ta_a.id = tr_a.team_account_id
  JOIN team_registration tr_b ON tr_b.id = NEW.team_b_id
  JOIN team_account ta_b ON ta_b.id = tr_b.team_account_id
  WHERE tr_a.id = NEW.team_a_id;

  IF v_team_a IS NULL OR v_team_b IS NULL THEN
    RETURN NEW;
  END IF;

  v_when := COALESCE(
    TO_CHAR(NEW.scheduled_at_start AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') || ' hs',
    'fecha a confirmar'
  );

  -- Capitanes: su llave tiene día y hora
  INSERT INTO notification (account_id, type, title, body, link, match_id)
  VALUES
    (v_owner_a, 'match_scheduled',
     'Partido programado vs ' || v_team_b,
     'Se juega el ' || v_when || '. Las apuestas ya están abiertas.',
     '/mis-partidos', NEW.id),
    (v_owner_b, 'match_scheduled',
     'Partido programado vs ' || v_team_a,
     'Se juega el ' || v_when || '. Las apuestas ya están abiertas.',
     '/mis-partidos', NEW.id);

  -- Espectadores: oportunidad de apuesta abierta
  INSERT INTO notification (account_id, type, title, body, link, match_id)
  SELECT a.id, 'bet_open',
         'Se abren las apuestas: ' || v_team_a || ' vs ' || v_team_b,
         'El ' || v_when || '. Elegí a tu ganador antes del start.',
         '/partido/' || NEW.id, NEW.id
  FROM account a
  WHERE a.role = 'spectator';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_scheduled ON match;
CREATE TRIGGER on_match_scheduled
  AFTER UPDATE ON match
  FOR EACH ROW
  WHEN (
    OLD.scheduled_at_start IS NULL
    AND NEW.scheduled_at_start IS NOT NULL
    AND NEW.team_a_id IS NOT NULL
    AND NEW.team_b_id IS NOT NULL
    AND NEW.winner_team_id IS NULL
  )
  EXECUTE FUNCTION notify_match_scheduled();

-- ============================================================
-- 3) Resultado de la llave: aviso a los 2 capitanes
--    (los apostadores ya reciben lo suyo por on_bet_settled)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_match_finished()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_a text;
  v_team_b text;
  v_winner text;
  v_owner_a uuid;
  v_owner_b uuid;
  v_owner_winner uuid;
  v_owner_loser uuid;
BEGIN
  SELECT ta_a.name, ta_b.name, ta_a.owner_id, ta_b.owner_id
    INTO v_team_a, v_team_b, v_owner_a, v_owner_b
  FROM team_registration tr_a
  JOIN team_account ta_a ON ta_a.id = tr_a.team_account_id
  JOIN team_registration tr_b ON tr_b.id = NEW.team_b_id
  JOIN team_account ta_b ON ta_b.id = tr_b.team_account_id
  WHERE tr_a.id = NEW.team_a_id;

  SELECT ta.name INTO v_winner
  FROM team_registration tr
  JOIN team_account ta ON ta.id = tr.team_account_id
  WHERE tr.id = NEW.winner_team_id;

  IF v_team_a IS NULL OR v_winner IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.winner_team_id = NEW.team_a_id THEN
    v_owner_winner := v_owner_a;
    v_owner_loser  := v_owner_b;
  ELSE
    v_owner_winner := v_owner_b;
    v_owner_loser  := v_owner_a;
  END IF;

  INSERT INTO notification (account_id, type, title, body, link, match_id)
  VALUES
    (v_owner_winner, 'match_result',
     '¡Victoria de tu reino! ' || NEW.score_a || ' - ' || NEW.score_b,
     v_team_a || ' vs ' || v_team_b || ' — ganó ' || v_winner || '.',
     '/partido/' || NEW.id, NEW.id),
    (v_owner_loser, 'match_result',
     'Tu reino cayó: ' || NEW.score_a || ' - ' || NEW.score_b,
     v_team_a || ' vs ' || v_team_b || ' — ganó ' || v_winner || '.',
     '/partido/' || NEW.id, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_finished ON match;
CREATE TRIGGER on_match_finished
  AFTER UPDATE ON match
  FOR EACH ROW
  WHEN (OLD.winner_team_id IS NULL AND NEW.winner_team_id IS NOT NULL)
  EXECUTE FUNCTION notify_match_finished();
