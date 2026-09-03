/**
 * VÉRTIGO Cup — Envío de notificaciones push nativas (Web Push + VAPID).
 *
 * El trigger on_notification_push de la DB encola cada notificación in-app
 * en push_queue (solo si la cuenta tiene suscripciones). Acá se drena esa
 * cola y se entrega al navegador vía web-push.
 *
 * Lo llaman:
 *  - GET /api/notifications (drenaje lazy con throttle: el poll que todas
 *    las páginas hacen cada pocos segundos — el push llega al instante)
 *  - POST /api/push/drain (respaldo con CRON_SECRET para el cron de Vercel)
 *
 * Historia: originalmente el drenador era la Edge Function notify-push de
 * Supabase (supabase/functions/notify-push), pero nunca llegó a deployarse
 * ni programarse, así que la cola crecía sin que llegara nada. Este módulo
 * corre en el app server con la lib npm web-push (mismo protocolo VAPID).
 */
import webpush from "web-push";
import { getSupabaseServiceRole } from "@/lib/supabase/server";

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:vertigocupaoe2@gmail.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

const PUSH_BATCH = 25;

export interface PushDrainResult {
  processed: number;
  sent: number;
  failed: number;
  deadSubscriptions: number;
}

/**
 * Drena push_queue: toma hasta `maxRows` filas sin sent_at, resuelve las
 * suscripciones de esas cuentas y envía el push a cada dispositivo.
 * Marca sent_at cuando hubo al menos una entrega (o si la cuenta ya no
 * tiene suscripciones); si todas fallan, deja error para diagnóstico sin
 * marcar sent (el próximo barrido reintenta las recuperables).
 */
export async function drainPushQueue(maxRows = PUSH_BATCH): Promise<PushDrainResult> {
  const out: PushDrainResult = { processed: 0, sent: 0, failed: 0, deadSubscriptions: 0 };
  if (!ensureVapid()) return out; // sin claves: la cola espera, no se pierde nada

  const service = getSupabaseServiceRole() as any;
  const { data: pending, error } = await service
    .from("push_queue")
    .select("id, account_id, title, body, link")
    .is("sent_at", null)
    .order("created_at", { ascending: true })
    .limit(maxRows);
  if (error || !pending?.length) return out;

  out.processed = pending.length;
  const accountIds = [...new Set(pending.map((p: any) => p.account_id))];

  const { data: subs } = await service
    .from("push_subscription")
    .select("id, endpoint, p256dh, auth, account_id")
    .in("account_id", accountIds);

  const perAccount = new Map<string, any[]>();
  for (const s of subs ?? []) {
    const list = perAccount.get(s.account_id) ?? [];
    list.push(s);
    perAccount.set(s.account_id, list);
  }

  const sentAt = new Date().toISOString();
  for (const item of pending) {
    const itemSubs = perAccount.get(item.account_id) ?? [];
    let deliveries = 0;
    let firstError: string | null = null;

    for (const s of itemSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({
            title: item.title ?? "VÉRTIGO Cup",
            body: item.body ?? "",
            link: item.link ?? null,
          }),
          { TTL: 60 * 60 * 24 }
        );
        deliveries++;
      } catch (e: any) {
        const msg = String(e?.statusCode ?? e?.message ?? e);
        const status = Number(e?.statusCode ?? 0);
        // 404/410 = suscripción muerta (permiso revocado, uninstall...) →
        // borrarla para no insistir en cada barrido.
        if (status === 404 || status === 410) {
          await service.from("push_subscription").delete().eq("id", s.id);
          out.deadSubscriptions++;
        }
        firstError ??= msg.slice(0, 200);
      }
    }

    if (deliveries > 0) {
      await service.from("push_queue").update({ sent_at: sentAt, error: null }).eq("id", item.id);
      out.sent++;
    } else if (itemSubs.length === 0) {
      // La cuenta ya no tiene suscripciones (se dio de baja): no reintentar.
      await service.from("push_queue").update({ sent_at: sentAt }).eq("id", item.id);
    } else if (firstError) {
      await service.from("push_queue").update({ error: firstError }).eq("id", item.id);
      out.failed++;
    }
  }
  return out;
}
