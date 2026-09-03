-- VÉRTIGO Cup — Avisos programados (2026-09-06)
-- El staff puede agendar un broadcast para más adelante ("mandalo el viernes
-- a las 20hs"). La fila queda en pending y el cron /api/cron/scheduled-broadcasts
-- la entrega cuando llega la hora (status → sent | failed | cancelled).

CREATE TABLE IF NOT EXISTS scheduled_broadcast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_account_id uuid REFERENCES account(id) ON DELETE SET NULL,
  audience text NOT NULL CHECK (audience IN ('all','captains','bettors','players','casters','team')),
  team_account_id uuid REFERENCES team_account(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'broadcast',
  title text NOT NULL,
  body text,
  link text,
  email boolean NOT NULL DEFAULT false,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_broadcast_due_idx
  ON scheduled_broadcast(scheduled_for)
  WHERE status = 'pending';

ALTER TABLE scheduled_broadcast ENABLE ROW LEVEL SECURITY;

-- El staff lee el historial de programados desde el panel (service role
-- escribe; lectura con la sesión del usuario via RLS por rol admin).
CREATE POLICY scheduled_broadcast_admin_read
  ON scheduled_broadcast
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM account a
    WHERE a.id = auth.uid()::text::uuid
      AND a.role IN ('admin','super_admin')
  ));

-- Nota: account.id es uuid y auth.uid() es uuid; si el tipo no coincide en tu
-- esquema, ajustá el cast. Con service role (cron + API) las policies no aplican.
