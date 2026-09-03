-- VÉRTIGO Cup — Guard atómico de cupo (2026-09-06)
-- Problema: el guard del admin (approveTeamAction) es check-then-act: dos
-- aprobaciones simultáneas pueden superar max_teams. El wizard frena, pero la
-- aprobación manual puede pasarse (caso real: edición 1 llegó a 33/32).
-- Solución: trigger BEFORE INSERT OR UPDATE en team_registration que lanza
-- excepción si el total (approved + pending) de la edición superaría max_teams.
-- Las bajas (approved→rejected) NO se bloquean: solo bajan el total. La fila
-- que se está movendo a rejected no cuenta en el total.

-- ============================================================
-- Función del guard
-- ============================================================
CREATE OR REPLACE FUNCTION vertigo_guard_cupo()
RETURNS trigger AS $$
DECLARE
  v_max_teams integer;
  v_current integer;
  -- OJO: NO usar coalesce(NEW.status, '') — mezclar enum con text hace que
  -- Postgres planifique ''::registration_status y reviente aunque status
  -- no sea NULL. Cast explícito a text.
  v_status text := lower(NEW.status::text);
BEGIN
  -- Solo importa si la fila resultante ocupa slot
  IF v_status NOT IN ('approved', 'pending') THEN
    RETURN NEW;
  END IF;

  SELECT max_teams INTO v_max_teams
  FROM tournament_edition
  WHERE id = NEW.tournament_edition_id;
  IF v_max_teams IS NULL THEN
    RETURN NEW; -- edición sin tope configurado: no bloquea
  END IF;

  -- Total de filas que ocupan slot EXCLUYENDO la fila en edición
  -- (para no contarse a sí misma en el UPDATE de aprobación).
  SELECT count(*) INTO v_current
  FROM team_registration
  WHERE tournament_edition_id = NEW.tournament_edition_id
    AND id <> NEW.id
    AND lower(status::text) IN ('approved', 'pending');

  IF v_current + 1 > v_max_teams THEN
    RAISE EXCEPTION 'CUPO_LLENO: la edición ya tiene %/% equipos ocupando cupo (aprobados + pendientes). No se puede aprobar/insertar otro.', v_current, v_max_teams
      USING HINT = 'Rechazá o quitá un equipo antes de aprobar otro.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Trigger: BEFORE INSERT OR UPDATE (siempre; la función decide si bloquea)
-- ============================================================
DROP TRIGGER IF EXISTS trg_guard_cupo ON team_registration;
CREATE TRIGGER trg_guard_cupo
  BEFORE INSERT OR UPDATE OF status ON team_registration
  FOR EACH ROW
  EXECUTE FUNCTION vertigo_guard_cupo();

-- ============================================================
-- Verificación rápida (comentarios): descomentar para probar en psql
-- ============================================================
-- SELECT count(*) FROM team_registration
--   WHERE tournament_edition_id = '<edition-id>'
--     AND status IN ('approved','pending');
-- Debe ser <= (SELECT max_teams FROM tournament_edition WHERE id = '<edition-id>');
