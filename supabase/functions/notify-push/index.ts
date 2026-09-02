/**
 * notify-push — drena la cola push_queue (notificaciones push nativas).
 *
 * Cada fila de `notification` encola su push vía trigger (solo si la
 * cuenta tiene suscripciones). Acá se envían con el protocolo Web Push
 * (VAPID, JSR Package @negrel/webpush — Web APIs puras, corre en Deno).
 *
 * Deploy:
 *   supabase link --project-ref <ref>
 *   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
 *     VAPID_SUBJECT=mailto:tu@dominio.com
 *   supabase functions deploy notify-push
 *
 * Programación (igual que notify-email, p.ej. cada minuto):
 *   select cron.schedule(
 *     'notify-push-every-1min', '* * * * *',
 *     $$
 *     select net.http_post(
 *       url := 'https://<ref>.functions.supabase.co/notify-push',
 *       headers := jsonb_build_object(
 *         'Content-Type', 'application/json',
 *         'Authorization', 'Bearer ' || <service_role>
 *       ),
 *       body := '{}'::jsonb
 *     );
 *     $$
 *   );
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const contact = Deno.env.get("VAPID_SUBJECT") ?? "mailto:vertigocup@vertigo.com";
const BATCH = 25;

function isConfigured() {
  return !!(supabaseUrl && serviceRole && privateKey && publicKey);
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return Response.json({ ok: true, configured: isConfigured() });
  }
  if (req.method !== "POST") {
    return Response.json({ error: "POST (o GET de health) únicamente" }, { status: 405 });
  }
  if (!isConfigured()) {
    return Response.json(
      { ok: false, error: "Faltan secrets (VAPID_* / SUPABASE_*)" },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  const { data: pending, error } = await supabase
    .from("push_queue")
    .select("id, account_id, title, body, link")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return Response.json({ ok: true, sent: 0, remaining: 0 });
  }

  const accountIds = [...new Set(pending.map((p) => p.account_id))];

  // Todas las suscripciones de las cuentas con pendientes, en un query.
  const { data: subs, error: subsErr } = await supabase
    .from("push_subscription")
    .select("id, endpoint, p256dh, auth, account_id")
    .in("account_id", accountIds);

  if (subsErr) {
    return Response.json({ ok: false, error: subsErr.message }, { status: 500 });
  }

  webpush.importVapidKeys({ publicKey, privateKey });
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: contact,
    vapidKeys: { publicKey, privateKey },
  });

  let sent = 0;
  const perAccount: Record<string, NonNullable<typeof subs>> = {};
  for (const s of subs ?? []) {
    (perAccount[s.account_id] ??= []).push(s);
  }

  for (const item of pending) {
    const itemSubs = perAccount[item.account_id] ?? [];
    let deliveries = 0;
    let errors: string[] = [];

    for (const s of itemSubs) {
      try {
        const sub = appServer.subscribe({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
        await sub.pushTextMessage(
          JSON.stringify({
            title: item.title ?? "VÉRTIGO Cup",
            body: item.body ?? "",
            link: item.link ?? null,
          }),
          { ttl: 60 * 60 * 24 },
        );
        deliveries++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // 404/410 = suscripción muerta → borrarla para no insistir.
        if (/404|410/.test(msg)) {
          await supabase.from("push_subscription").delete().eq("id", s.id);
        }
        errors.push(msg.slice(0, 120));
      }
    }

    if (deliveries > 0) {
      sent += deliveries;
      await supabase
        .from("push_queue")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", item.id);
    } else if (errors.length > 0) {
      // Sin entregas: marcar con error para diagnóstico (y no reintentar
      // a ciegas cada minuto).
      await supabase
        .from("push_queue")
        .update({ error: errors[0] })
        .eq("id", item.id);
    } else {
      // Cuenta sin suscripciones activas: ya no hace falta reintentar.
      await supabase
        .from("push_queue")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", item.id);
    }
  }

  const { count } = await supabase
    .from("push_queue")
    .select("id", { count: "exact", head: true })
    .is("sent_at", null);

  return Response.json({ ok: true, sent, remaining: count ?? 0 });
});
