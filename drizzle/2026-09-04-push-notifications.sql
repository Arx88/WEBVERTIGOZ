-- ============================================================
-- VÉRTIGO Cup — Notificaciones Push (2026-09-02)
--
-- push_subscription: endpoints de push de cada navegador/dispositivo
--   (escritorio + móvil). Una cuenta puede tener varias (Chrome, Edge,
--   Android...). Escritura service-role; lectura solo de la propia cuenta.
--
-- push_queue: pushes pendientes de enviar (los produce el sistema junto
--   con la fila `notification`). La drena la Edge Function notify-push.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscription_account_idx
  ON push_subscription(account_id);

ALTER TABLE push_subscription ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_subscription_select_own ON push_subscription;
CREATE POLICY push_subscription_select_own ON push_subscription
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account a
      WHERE a.id = push_subscription.account_id
        AND a.supabase_auth_id = auth.uid()
    )
  );
-- Sin policies de INSERT/UPDATE/DELETE: solo service-role.

-- ============================================================
-- Cola de pushes pendientes (mismo patrón que email_queue)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  body varchar(400),
  link varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text
);
CREATE INDEX IF NOT EXISTS push_queue_pending_idx ON push_queue(sent_at) WHERE sent_at IS NULL;
ALTER TABLE push_queue ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: encolar push si la cuenta tiene suscripciones activas.
-- Lo llaman los triggers de notificación para no duplicar lógica.
-- ============================================================
CREATE OR REPLACE FUNCTION enqueue_push_for_account(p_account_id uuid, p_title text, p_body text, p_link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subs int;
BEGIN
  SELECT count(*) INTO v_subs FROM push_subscription WHERE account_id = p_account_id;
  IF v_subs > 0 THEN
    INSERT INTO push_queue (account_id, title, body, link)
    VALUES (p_account_id, p_title, p_body, p_link);
  END IF;
END;
$$;

-- ============================================================
-- Trigger general: toda fila nueva en `notification` encola su push
-- (solo si la cuenta tiene suscripciones). Así TODAS las notificaciones
-- in-app (apuestas, llaves, fases, broadcast, ciclo de equipo) llegan
-- también por push sin tocar cada trigger por separado.
-- ============================================================
CREATE OR REPLACE FUNCTION notify_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM enqueue_push_for_account(NEW.account_id, NEW.title, NEW.body, NEW.link);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_push ON notification;
CREATE TRIGGER on_notification_push
  AFTER INSERT ON notification
  FOR EACH ROW
  EXECUTE FUNCTION notify_push_on_notification();
