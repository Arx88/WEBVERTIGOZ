import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { deliverBroadcast } from "@/lib/broadcast";

/**
 * POST /api/admin/notifications — broadcast del staff.
 * Crea una notificacion in-app para una audiencia completa:
 *   all | captains | bettors | players | casters | team:{teamAccountId}
 * Opcional `email: true` → ademas encola un email por destino
 * (tabla email_queue, que drena la Edge Function notify-email).
 *
 * Solo admin/super_admin (requireAdmin). Escritura con service role.
 * Entrega por tandas de 500 (src/lib/broadcast.ts).
 */
export const dynamic = "force-dynamic";

const AUDIENCES = ["all", "captains", "bettors", "players", "casters", "team"] as const;
type Audience = (typeof AUDIENCES)[number];

export async function POST(req: NextRequest) {
  const account = await requireAdmin();
  if (!account) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    audience?: string;
    teamAccountId?: string;
    type?: string;
    title?: string;
    body?: string;
    link?: string;
    email?: boolean;
    scheduledFor?: string | null;
  };

  const audience = body.audience as Audience;
  const title = (body.title ?? "").trim();

  if (!AUDIENCES.includes(audience) || !title) {
    return NextResponse.json({ error: "audience y title son obligatorios" }, { status: 400 });
  }
  if (audience === "team" && !body.teamAccountId) {
    return NextResponse.json({ error: "Elegí el equipo para la audiencia team" }, { status: 400 });
  }

  // ── Envío programado: se guarda en scheduled_broadcast y el cron lo entrega ──
  if (body.scheduledFor) {
    const when = new Date(body.scheduledFor);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() + 60_000) {
      return NextResponse.json(
        { error: "La fecha programada debe ser al menos 1 minuto en el futuro" },
        { status: 400 }
      );
    }
    try {
      const service = (await import("@/lib/supabase/server")).getSupabaseServiceRole() as any;
      const { error } = await service.from("scheduled_broadcast").insert({
        created_by_account_id: account.id,
        audience,
        team_account_id: audience === "team" ? body.teamAccountId : null,
        type: body.type || "broadcast",
        title,
        body: (body.body ?? "").trim() || null,
        link: body.link?.trim() || null,
        email: !!body.email,
        scheduled_for: when.toISOString(),
        status: "pending",
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, scheduled: true, scheduledFor: when.toISOString() });
    } catch (err) {
      console.error("[broadcast] schedule:", err);
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // ── Envío inmediato ────────────────────────────────────────────────
  try {
    const result = await deliverBroadcast({
      audience,
      teamAccountId: audience === "team" ? body.teamAccountId : undefined,
      type: body.type || "broadcast",
      title,
      body: body.body ?? null,
      link: body.link ?? null,
      email: !!body.email,
    }, { sentByAccountId: account.id, log: true });

    return NextResponse.json({ ok: true, sent: result.sent, emails: result.emails });
  } catch (err) {
    console.error("[broadcast] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
