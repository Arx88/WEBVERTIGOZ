-- ============================================================
-- VÉRTIGO Cup — Notificaciones del CICLO (2026-09-03)
--
-- Triggers que completan el sistema:
--   1. on_registration_status → aviso al capitan (aprobado/rechazado)
--   2. on_match_team_action   → rival confirmó READY / declaró lineup
--   3. on_comodin_used        → usaron un comodín contra tu llave
--   4. on_waitlist_slot_freed → se liberó un lugar: encola EMAIL a la
--      lista de espera (email_queue; la drena la Edge Function notify-email)
--
-- Tabla email_queue: emails fuera del sitio (waitlist y broadcast con
-- casilla de email marcada). RLS sin policies: escritura service-role.
-- ============================================================

CREATE TABLE IF NOT EXISTS email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email varchar(255) NOT NULL,
  subject varchar(200) NOT NULL,
  body text NOT NULL,
  context varchar(40) DEFAULT 'generic',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text
);
CREATE INDEX IF NOT EXISTS email_queue_pending_idx ON email_queue(sent_at) WHERE sent_at IS NULL;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 1) Inscripción aprobada / rechazada → el capitan se entera
-- ============================================================
CREATE OR REPLACE FUNCTION notify_registration_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team text;
  v_edition text;
  v_owner uuid;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT ta.name, ta.owner_id, te.name
    INTO v_team, v_owner, v_edition
  FROM team_account ta
  JOIN tournament_edition te ON te.id = NEW.tournament_edition_id
  WHERE ta.id = NEW.team_account_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' THEN
    INSERT INTO notification (account_id, type, title, body, link)
    VALUES (
      v_owner, 'team_approved',
      '¡Tu reino fue aprobado!',
      COALESCE(v_team, 'Tu equipo') || ' quedó inscripto en ' || COALESCE(v_edition, 'la edición') || '.',
      '/mi-equipo'
    );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notification (account_id, type, title, body, link)
    VALUES (
      v_owner, 'team_rejected',
      'Inscripción rechazada',
      COALESCE(v_team, 'Tu equipo') || ' no fue aceptado en ' || COALESCE(v_edition, 'la edición') || '. Revisá los requisitos y volvé a intentar.',
      '/registro'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_registration_status ON team_registration;
CREATE TRIGGER on_registration_status
  AFTER UPDATE ON team_registration
  FOR EACH ROW
  WHEN (OLD.status IN ('pending','approved') AND NEW.status IN ('approved','rejected') AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION notify_registration_status();

-- ============================================================
-- 2) Rival confirmó READY  /  3) Rival declaró lineup
-- ============================================================
CREATE OR REPLACE FUNCTION notify_match_team_action()
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

  IF NEW.ready_a_at IS NOT NULL AND OLD.ready_a_at IS NULL THEN
    INSERT INTO notification (account_id, type, title, body, link, match_id)
    VALUES (v_owner_b, 'match_ready',
      'Tu rival confirmó READY',
      v_team_a || ' está listo. Confirmá el tuyo antes del cierre.',
      '/mis-partidos', NEW.id);
  END IF;
  IF NEW.ready_b_at IS NOT NULL AND OLD.ready_b_at IS NULL THEN
    INSERT INTO notification (account_id, type, title, body, link, match_id)
    VALUES (v_owner_a, 'match_ready',
      'Tu rival confirmó READY',
      v_team_b || ' está listo. Confirmá el tuyo antes del cierre.',
      '/mis-partidos', NEW.id);
  END IF;

  IF NEW.ready_lineup_a_at IS NOT NULL AND OLD.ready_lineup_a_at IS NULL THEN
    INSERT INTO notification (account_id, type, title, body, link, match_id)
    VALUES (v_owner_b, 'lineup_declared',
      'Tu rival declaró el lineup',
      v_team_a || ' ya confirmó jugadores y civs.',
      '/partido/' || NEW.id, NEW.id);
  END IF;
  IF NEW.ready_lineup_b_at IS NOT NULL AND OLD.ready_lineup_b_at IS NULL THEN
    INSERT INTO notification (account_id, type, title, body, link, match_id)
    VALUES (v_owner_a, 'lineup_declared',
      'Tu rival declaró el lineup',
      v_team_b || ' ya confirmó jugadores y civs.',
      '/partido/' || NEW.id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_team_action ON match;
CREATE TRIGGER on_match_team_action
  AFTER UPDATE ON match
  FOR EACH ROW
  WHEN (NEW.team_a_id IS NOT NULL AND NEW.team_b_id IS NOT NULL AND NEW.winner_team_id IS NULL)
  EXECUTE FUNCTION notify_match_team_action();

-- ============================================================
-- 3) Usaron un comodín contra tu llave
-- ============================================================
CREATE OR REPLACE FUNCTION notify_comodin_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_team uuid;
  v_team_a uuid;
  v_team_b uuid;
  v_opponent_reg uuid;
  v_opponent_owner uuid;
  v_match_teams text;
BEGIN
  -- El equipo que USÓ el comodín
  SELECT ci.team_registration_id INTO v_user_team
  FROM comodin_inventory ci
  WHERE ci.id = NEW.comodin_inventory_id;

  IF v_user_team IS NULL THEN
    RETURN NEW;
  END IF;

  -- Las dos llaves del match
  SELECT m.team_a_id, m.team_b_id INTO v_team_a, v_team_b
  FROM match m WHERE m.id = NEW.match_id;

  IF v_user_team = v_team_a THEN
    v_opponent_reg := v_team_b;
  ELSE
    v_opponent_reg := v_team_a;
  END IF;

  SELECT ta.owner_id INTO v_opponent_owner
  FROM team_registration tr
  JOIN team_account ta ON ta.id = tr.team_account_id
  WHERE tr.id = v_opponent_reg;

  IF v_opponent_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(string_agg(ta.name, ' vs ' ORDER BY ta.name), 'tu llave')
    INTO v_match_teams
  FROM team_registration tr
  JOIN team_account ta ON ta.id = tr.team_account_id
  WHERE tr.id IN (v_team_a, v_team_b);

  INSERT INTO notification (account_id, type, title, body, link, match_id)
  VALUES (
    v_opponent_owner, 'comodin_used',
    '¡Usaron un comodín contra vos!',
    NEW.comodin_type || ' en ' || v_match_teams || '. Revisá el estado de la llave.',
    '/partido/' || NEW.match_id, NEW.match_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comodin_used ON comodin_usage;
CREATE TRIGGER on_comodin_used
  AFTER UPDATE ON comodin_usage
  FOR EACH ROW
  WHEN (OLD.status IN ('pending','executing') AND NEW.status = 'executed')
  EXECUTE FUNCTION notify_comodin_used();

-- ============================================================
-- 4) Se liberó un lugar → email a la lista de espera
--    (un approved se borra o pasa a rejected: ese cupo se libera)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_waitlist_slot_freed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_edition uuid;
  v_edition_name text;
BEGIN
  IF TG_OP = 'DELETE' AND OLD.status = 'approved' THEN
    v_edition := OLD.tournament_edition_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status = 'rejected' THEN
    v_edition := OLD.tournament_edition_id;
  ELSE
    RETURN OLD;
  END IF;

  SELECT te.name INTO v_edition_name FROM tournament_edition te WHERE te.id = v_edition;

  -- Encolar un email a cada espera aún no notificada (una sola vez)
  INSERT INTO email_queue (to_email, subject, body, context)
  SELECT
    w.email,
    '¡Se liberó un lugar en ' || COALESCE(v_edition_name, 'la edición') || '!',
    'Las inscripciones se reabrieron para ' || COALESCE(v_edition_name, 'la edición')
      || '. Si seguís interesado, entrá al sitio y completá tu inscripción antes de que se agote.',
    'waitlist'
  FROM cupo_waitlist w
  WHERE w.tournament_edition_id = v_edition
    AND w.notified_at IS NULL;

  UPDATE cupo_waitlist
  SET notified_at = now()
  WHERE tournament_edition_id = v_edition
    AND notified_at IS NULL;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_waitlist_slot_freed ON team_registration;
CREATE TRIGGER on_waitlist_slot_freed
  AFTER DELETE OR UPDATE ON team_registration
  FOR EACH ROW
  EXECUTE FUNCTION notify_waitlist_slot_freed();
