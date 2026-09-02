/**
 * notify-email — drena la cola email_queue (envios fuera del sitio).
 *
 * Emails pendientes (waitlist liberada, broadcast con casilla marcada)
 * se envian via Resend y se marcan sent_at. GET = health; POST = drenar.
 *
 * Deploy:
 *   supabase link --project-ref <ref>
 *   supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="VERTIGO Cup <no-reply@tu-dominio.com>"
 *   supabase functions deploy notify-email
 *
 * Programacion (cada 2 min) con pg_cron en el SQL editor de Supabase:
 *   select cron.schedule(
 *     'notify-email-every-2min', '0-59/2 * * * *',
 *     $$
 *     select net.http_post(
 *       url := 'https://<ref>.functions.supabase.co/notify-email',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer ' || current_setting('request.jwt.claim.sub', true) -- ver nota
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 *
 * Nota de seguridad: con JWT verification ON (default), la funcion solo
 * responde a llamadas con un JWT valido del proyecto. Para el cron se
 * recomienda un webhook con Authorization = service_role (documentado
 * en la doc oficial de Supabase) o un scheduler externo (cron-job.org)
 * llamando a la URL con el header Authorization.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
const fromEmail =
  Deno.env.get("EMAIL_FROM") ?? "VERTIGO Cup <no-reply@vertigocup.com>";
const BATCH = 25;

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return Response.json({ ok: true, resendConfigured: !!resendKey });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "POST (o GET de health) únicamente" }, { status: 405 });
  }
  if (!resendKey || !supabaseUrl || !serviceRole) {
    return Response.json(
      { ok: false, error: "Faltan secrets (RESEND_API_KEY / SUPABASE_*)" },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const { data: pending, error } = await supabase
    .from("email_queue")
    .select("id, to_email, subject, body, context")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const resend = new Resend(resendKey);
  let sent = 0;
  let failed = 0;

  for (const m of pending ?? []) {
    try {
      const r = await resend.emails.send({
        from: fromEmail,
        to: [m.to_email],
        subject: m.subject,
        text: m.body,
      });
      if (r.error) throw new Error(r.error.message);
      await supabase
        .from("email_queue")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", m.id);
      sent++;
    } catch (err) {
      failed++;
      await supabase
        .from("email_queue")
        .update({ error: String(err).slice(0, 300) })
        .eq("id", m.id);
    }
  }

  return Response.json({
    ok: true,
    sent,
    failed,
    processed: pending?.length ?? 0,
  });
});
