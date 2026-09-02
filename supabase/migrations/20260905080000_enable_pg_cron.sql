-- Habilita pg_cron (agendado) y pg_net (net.http_post) para la Edge Function
-- notify-lifecycle. Se commitea en su propia transacción para que el
-- background worker de pg_cron quede activo antes de agendar la función.
create extension if not exists pg_cron;
create extension if not exists pg_net;
