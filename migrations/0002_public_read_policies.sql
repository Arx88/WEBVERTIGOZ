-- ============================================================
-- VÉRTIGO Cup — Migración Fase 1b: Policies públicas de lectura
-- ============================================================
-- PROBLEMA: el bracket público (/bracket), perfiles de equipo, fixture,
-- standings y resultados muestran "Por definir" / vacíos porque la policy
-- de team_registration solo permite lectura a dueño o admin.
--
-- DECISIÓN DE PRODUCTO: los datos del torneo que conforman la "cara pública"
-- (nombre de equipo, emblema, seed, ELO total, estado de inscripción) son
-- públicos — como en cualquier torneo. Lo sensible (payload de verificación
-- crudo, notas internas) no está en team_registration, así que abrir SELECT
-- a lectura pública es seguro.
--
-- IDEMPOTENTE. Ejecutar en Supabase SQL Editor.
-- ============================================================

-- team_registration: lectura pública (para bracket, equipos, perfiles)
DROP POLICY IF EXISTS "TeamReg: lectura dueño o admin" ON team_registration;
DROP POLICY IF EXISTS "TeamReg: lectura pública" ON team_registration;
CREATE POLICY "TeamReg: lectura pública"
  ON team_registration FOR SELECT TO anon, authenticated
  USING (true);

-- player_registration: lectura pública (para perfiles de jugador — nombre, país, ELO).
-- OJO: no exponemos verification_payload (datos crudos de AoE2). Si se vuelve
--   sensible, conviene una VIEW pública con solo las columnas públicas.
DROP POLICY IF EXISTS "PlayerReg: lectura dueño o admin" ON player_registration;
DROP POLICY IF EXISTS "PlayerReg: lectura pública" ON player_registration;
CREATE POLICY "PlayerReg: lectura pública"
  ON player_registration FOR SELECT TO anon, authenticated
  USING (true);

-- comodin_inventory: solo lectura para dueño/admin (inventario es interno).
--   Lo dejamos como estaba — el público no necesita ver stock de comodines.
--   (El resumen de comodines EN USO durante un match sí es público y vive en comodin_usage,
--   al que abrimos lectura pública para que el realtime del partido muestre los usos.)

-- comodin_usage: lectura pública (los comodines usados son parte del show del partido)
DROP POLICY IF EXISTS "ComodinUse: lectura dueño o admin" ON comodin_usage;
DROP POLICY IF EXISTS "ComodinUse: lectura pública" ON comodin_usage;
CREATE POLICY "ComodinUse: lectura pública"
  ON comodin_usage FOR SELECT TO anon, authenticated
  USING (true);

-- roulette_draw: ya tenía lectura pública solo en revealed/published (correcto — no exponer
--   el seed durante committed/spinning). Se mantiene.

-- caster: lectura pública (listado de casters)
DROP POLICY IF EXISTS "Caster: lectura pública" ON caster;
CREATE POLICY "Caster: lectura pública"
  ON caster FOR SELECT TO anon, authenticated
  USING (true);

-- dispute: lectura solo para el equipo que la creó + admins (NO pública completa)
--   Mantiene privacidad de las disputas. Ajustamos a que también el equipo RIVAL del match la vea.
DROP POLICY IF EXISTS "Dispute: lectura involucrados o admin" ON dispute;
CREATE POLICY "Dispute: lectura involucrados o admin"
  ON dispute FOR SELECT TO authenticated
  USING (
    is_admin()
    OR raised_by_team_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
    OR match_id IN (
      SELECT m.id FROM "match" m
      JOIN team_registration trA ON trA.id = m.team_a_id
      JOIN team_account taA ON taA.id = trA.team_account_id
      JOIN team_registration trB ON trB.id = m.team_b_id
      JOIN team_account taB ON taB.id = trB.team_account_id
      WHERE taA.owner_id = current_account_id() OR taB.owner_id = current_account_id()
    )
  );

-- ============================================================
-- VERIFICACIÓN (después de ejecutar):
--   SELECT count(*) FROM team_registration;  -- debe devolver filas como anon
-- Prueba real: abrir /bracket deslogueado → los equipos deben tener nombre.
-- ============================================================
