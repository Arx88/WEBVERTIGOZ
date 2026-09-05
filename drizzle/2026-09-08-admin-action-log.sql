-- ============================================================
-- VÉRTIGO Cup — Log de acciones del staff (2026-09-02)
--
-- Cada write que hace un admin desde el panel queda acá:
-- qué acción ejecutó, sobre qué entidad (con nombre humano),
-- con qué datos (payload) y QUIÉN la ejecutó. Complementa al
-- draw_audit_log (criptográfico, solo sorteos) cubriendo el
-- resto del panel: inscripciones, brackets, presets, casters,
-- emblemas, ediciones, jornadas, notificaciones.
-- Escritura y lectura solo service role (server); sin policies.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action varchar(60) NOT NULL,
  entity_type varchar(40) NOT NULL,
  entity_id varchar(64),
  entity_label text,
  actor_account_id uuid NOT NULL REFERENCES account(id),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_action_log_created_idx ON admin_action_log(created_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS admin_action_log_actor_idx ON admin_action_log(actor_account_id);
CREATE INDEX IF NOT EXISTS admin_action_log_entity_idx ON admin_action_log(entity_type, entity_id);

ALTER TABLE admin_action_log ENABLE ROW LEVEL SECURITY;

-- Escritura: solo service role (logAdminAction desde server actions).
-- Lectura: el staff ve el registro desde el panel con su propia sesión.
CREATE POLICY admin_action_log_admin_read
  ON admin_action_log
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM account
    WHERE supabase_auth_id = auth.uid()
      AND role IN ('admin', 'super_admin')
  ));
