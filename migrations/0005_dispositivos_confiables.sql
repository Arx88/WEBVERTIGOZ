-- ============================================================
-- 0005 · Dispositivos confiables (acceso rápido de un clic)
-- El token aleatorio vive SOLO en una cookie httpOnly del navegador;
-- acá se guarda únicamente su SHA-256. Permite a /login restaurar
-- la sesión sin contraseña cuando el usuario toca su cuenta.
-- Expira a los 30 días y se puede olvidar desde el propio chip.
-- ============================================================

CREATE TABLE IF NOT EXISTS trusted_device (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_used_at timestamptz DEFAULT now() NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS trusted_device_account_idx ON trusted_device(account_id);

-- RLS activada SIN políticas: anon/authenticated no pueden leer ni escribir;
-- solo el service role (backend) accede.
ALTER TABLE trusted_device ENABLE ROW LEVEL SECURITY;

SELECT '0005 dispositivos_confiables OK' AS status;
