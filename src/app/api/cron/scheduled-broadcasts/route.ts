import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { deliverBroadcast, type BroadcastPayload } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/scheduled-broadcasts
 *
 * Drena la tabla scheduled_broadcast: entrega los avisos pendientes cuya
 * hora llegó (scheduled_for <= ahora), marca sent/failed, y registra en
 * broadcast_log como cualquier envío del panel (via deliverBroadcast).
 *
 * Contrato igual al resto de los crons:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/scheduled-broadcasts
 * Sin CRON_SECRET configurado, solo se permite en desarrollo.
 *
 * Programar en vercel.json cada 5 minutos: *\/5 * * * *.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "no autorizado" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 401 });
  }

  const service = getSupabaseServiceRole() as any;
  const now = new Date().toISOString();

  try {
    // Reclamo atómico ANTES de entregar: pending → sending con re-check de
    // status, así dos corridas en paralelo no duplican el envío.
    const { data: due, error: dueErr } = await service
      .from("scheduled_broadcast")
      .select("id, created_by_account_id, audience, team_account_id, type, title, body, link, email")
      .eq("status", "pending")
      .lte("scheduled_for", now)
      .order("scheduled_for", { ascending: true })
      .limit(10);

    if (dueErr) throw new Error(dueErr.message);
    if (!due?.length) {
      return NextResponse.json({ ok: true, delivered: 0, results: [] });
    }

    const { data: claimed, error: claimErr } = await service
      .from("scheduled_broadcast")
      .update({ status: "sending" })
      .in("id", (due as any[]).map((r) => r.id))
      .eq("status", "pending")
      .select("id, created_by_account_id, audience, team_account_id, type, title, body, link, email");

    if (claimErr) throw new Error(claimErr.message);

    const results: Array<{ id: string; ok: boolean; sent?: number; error?: string }> = [];
    for (const row of claimed ?? []) {
      try {
        const payload: BroadcastPayload = {
          audience: row.audience,
          teamAccountId: row.team_account_id ?? undefined,
          type: row.type,
          title: row.title,
          body: row.body,
          link: row.link,
          email: !!row.email,
        };
        const result = await deliverBroadcast(payload, {
          sentByAccountId: row.created_by_account_id,
          log: true,
        });
        await service
          .from("scheduled_broadcast")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", row.id);
        results.push({ id: row.id, ok: true, sent: result.sent });
      } catch (err) {
        await service
          .from("scheduled_broadcast")
          .update({ status: "failed", error: (err as Error).message.slice(0, 500) })
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: (err as Error).message });
      }
    }

    return NextResponse.json({
      ok: true,
      delivered: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (e) {
    console.error("[cron/scheduled-broadcasts] error:", e);
    return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 });
  }
}
