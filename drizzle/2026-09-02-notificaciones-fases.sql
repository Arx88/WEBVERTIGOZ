-- ============================================================
-- VÉRTIGO Cup — Notificaciones de FASE (2026-09-02)
--
-- 1. on_match_phase: cuando una llave entra a la ventana de READY
--    (status='open') o a lineup (status='lineup'), avisa a los
--    dueños de AMBOS equipos (fases que requieren acción).
-- 2. Realtime: habilita la tabla `notification` en la publicación
--    supabase_realtime para que la campana reciba inserts al instante.
-- ============================================================

CREATE OR REPLACE FUNCTION notify_match_phase()
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
  v_title text;
  v_body text;
BEGIN
  IF NEW.status = 'open' AND OLD.status IS DISTINCT FROM 'open' THEN
    v_title := '¡Ventana de READY abierta!';
    v_body := 'La llave dio start: confirmá READY con tu rival antes del cierre de la ventana.';
  ELSIF NEW.status = 'lineup' AND OLD.status IS DISTINCT FROM 'lineup' THEN
    v_title := 'Declará el lineup';
    v_body := 'La ventana de lineup está abierta: asigná jugadores y civs de tu equipo.';
  ELSE
    RETURN NEW;
  END IF;

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

  INSERT INTO notification (account_id, type, title, body, link, match_id)
  VALUES
    (v_owner_a, 'match_phase', v_title, v_body || ' Rival: ' || v_team_b || '.', '/partido/' || NEW.id, NEW.id),
    (v_owner_b, 'match_phase', v_title, v_body || ' Rival: ' || v_team_a || '.', '/partido/' || NEW.id, NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_phase ON match;
CREATE TRIGGER on_match_phase
  AFTER UPDATE ON match
  FOR EACH ROW
  WHEN (NEW.team_a_id IS NOT NULL AND NEW.team_b_id IS NOT NULL AND NEW.winner_team_id IS NULL)
  EXECUTE FUNCTION notify_match_phase();

-- Realtime: la campana escucha INSERTs en notification sin polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notification'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notification;
  END IF;
END $$;
