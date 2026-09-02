-- ============================================================
-- VÉRTIGO Cup — Historial de broadcasts del staff (2026-09-02)
--
-- Cada envío masivo del panel /admin/notificaciones queda acá:
-- qué se mandó, a qué audiencia, a cuántos destinatarios, si
-- también salió por email, cuándo y QUIÉN lo envió.
-- Escritura y lectura solo service role (server); sin policies.
-- ============================================================

CREATE TABLE IF NOT EXISTS broadcast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by_account_id uuid REFERENCES account(id) ON DELETE SET NULL,
  audience varchar(20) NOT NULL,
  type varchar(40) NOT NULL DEFAULT 'broadcast',
  title varchar(160) NOT NULL,
  body varchar(400),
  link varchar(300),
  email_sent boolean NOT NULL DEFAULT false,
  targets integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broadcast_log_sent_idx ON broadcast_log(sent_at DESC NULLS LAST);

ALTER TABLE broadcast_log ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo el service role (los admins leen vía server).