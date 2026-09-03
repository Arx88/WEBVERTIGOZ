/**
 * VÉRTIGO Cup — Entrega de broadcasts del staff.
 *
 * Lógica compartida entre:
 *  - POST /api/admin/notifications (envío inmediato desde el panel)
 *  - /api/cron/scheduled-broadcasts (drena scheduled_broadcast y entrega)
 *
 * Inserta por tandas de 500 para no timeoutear con audiencias grandes.
 */
import { getSupabaseServiceRole } from "@/lib/supabase/server";

export const BROADCAST_BATCH = 500;

export interface BroadcastPayload {
  audience: "all" | "captains" | "bettors" | "players" | "casters" | "team";
  teamAccountId?: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  email?: boolean;
}

export interface DeliveryResult {
  sent: number;
  emails: number;
  /** true si la audiencia no tenía destinatarios (no es error) */
  emptyAudience: boolean;
}

/**
 * Resuelve la audiencia a accounts (id + email). Mismo criterio que
 * usaba la API inline: los casters se resuelven por la tabla caster.
 */
export async function resolveAudience(
  payload: BroadcastPayload
): Promise<Array<{ id: string; email: string }>> {
  const service = getSupabaseServiceRole() as any;
  let query = service.from("account").select("id, email");

  if (payload.audience === "all") {
    /* todos */
  } else if (payload.audience === "captains") {
    const { data: owners } = await service
      .from("team_account")
      .select("owner_id")
      .neq("owner_id", null);
    const ids = [...new Set((owners ?? []).map((o: any) => o.owner_id))];
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  } else if (payload.audience === "bettors") {
    query = query.eq("role", "spectator");
  } else if (payload.audience === "players") {
    query = query.eq("role", "player");
  } else if (payload.audience === "casters") {
    const { data: casters } = await service.from("caster").select("account_id");
    const ids = [...new Set((casters ?? []).map((c: any) => c.account_id))];
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  } else if (payload.audience === "team") {
    if (!payload.teamAccountId) return [];
    const { data: team } = await service
      .from("team_account")
      .select("owner_id")
      .eq("id", payload.teamAccountId)
      .maybeSingle();
    if (!team?.owner_id) return [];
    query = query.eq("id", team.owner_id);
  }

  const { data: targets } = await query;
  return (targets ?? []) as Array<{ id: string; email: string }>;
}

/**
 * Entrega un broadcast: notificaciones in-app por tandas + email opcional
 * encolado por tandas + registro en broadcast_log.
 */
export async function deliverBroadcast(
  payload: BroadcastPayload,
  opts: { sentByAccountId?: string; log?: boolean } = {}
): Promise<DeliveryResult> {
  const service = getSupabaseServiceRole() as any;
  const accounts = await resolveAudience(payload);
  if (accounts.length === 0) {
    return { sent: 0, emails: 0, emptyAudience: true };
  }

  const now = new Date().toISOString();
  const title = payload.title;
  const text = payload.body?.trim() || "";

  // ── 1. Notificaciones in-app (por tandas) ─────────────────────────
  const rows = accounts.map((a) => ({
    account_id: a.id,
    type: payload.type || "broadcast",
    title,
    body: text || null,
    link: payload.link?.trim() || null,
    created_at: now,
  }));
  for (let i = 0; i < rows.length; i += BROADCAST_BATCH) {
    const { error } = await service.from("notification").insert(rows.slice(i, i + BROADCAST_BATCH));
    if (error) throw new Error(error.message);
  }

  // ── 2. Historial del staff ────────────────────────────────────────
  if (opts.log !== false) {
    try {
      await service.from("broadcast_log").insert({
        sent_by_account_id: opts.sentByAccountId ?? null,
        audience: payload.audience,
        type: payload.type || "broadcast",
        title,
        body: text || null,
        link: payload.link?.trim() || null,
        email_sent: !!payload.email,
        targets: accounts.length,
        sent_at: now,
      });
    } catch (logErr) {
      console.error("[broadcast] broadcast_log:", (logErr as Error).message);
    }
  }

  // ── 3. Email opcional (por tandas) ────────────────────────────────
  let emails = 0;
  if (payload.email) {
    try {
      const mailRows = accounts.map((a) => ({
        to_email: a.email,
        subject: title,
        body: text || title,
        context: "broadcast",
        created_at: now,
      }));
      for (let i = 0; i < mailRows.length; i += BROADCAST_BATCH) {
        const { error } = await service
          .from("email_queue")
          .insert(mailRows.slice(i, i + BROADCAST_BATCH));
        if (error) throw new Error(error.message);
        emails += mailRows.slice(i, i + BROADCAST_BATCH).length;
      }
    } catch (err) {
      console.error("[broadcast] email_queue:", (err as Error).message);
      // la notificación in-app ya quedó; el email falla sin romper
    }
  }

  return { sent: accounts.length, emails, emptyAudience: false };
}
