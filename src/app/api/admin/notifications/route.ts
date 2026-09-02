import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { getSupabaseServiceRole } from "@/lib/supabase/server";

/**
 * POST /api/admin/notifications — broadcast del staff.
 * Crea una notificacion in-app para una audiencia completa:
 *   all | captains | bettors | players | team:{teamAccountId}
 * Opcional `email: true` → ademas encola un email por destino
 * (tabla email_queue, que drena la Edge Function notify-email).
 *
 * Solo admin/super_admin (requireAdmin). Escritura con service role.
 */
export const dynamic = "force-dynamic";

const AUDIENCES = ["all", "captains", "bettors", "players", "team"] as const;
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
  };

  const audience = body.audience as Audience;
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();

  if (!AUDIENCES.includes(audience) || !title) {
    return NextResponse.json({ error: "audience y title son obligatorios" }, { status: 400 });
  }
  if (audience === "team" && !body.teamAccountId) {
    return NextResponse.json({ error: "Elegí el equipo para la audiencia team" }, { status: 400 });
  }

  try {
    const service = getSupabaseServiceRole() as any;

    // ── 1. Resolver la audiencia → account ids ────────────────────────
    let query = service.from("account").select("id, email");
    if (audience === "all") {
      /* todos los accounts */
    } else if (audience === "captains") {
      // dueños de team_account (el captain)
      const { data: owners } = await service
        .from("team_account")
        .select("owner_id")
        .neq("owner_id", null);
      const ids = [...new Set((owners ?? []).map((o: any) => o.owner_id))];
      if (ids.length === 0) return NextResponse.json({ ok: true, sent: 0 });
      query = query.in("id", ids);
    } else if (audience === "bettors") {
      query = query.eq("role", "spectator");
    } else if (audience === "players") {
      query = query.eq("role", "player");
    } else if (audience === "team") {
      const { data: team } = await service
        .from("team_account")
        .select("owner_id")
        .eq("id", body.teamAccountId)
        .maybeSingle();
      if (!team?.owner_id) {
        return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
      }
      query = query.eq("id", team.owner_id);
    }

    const { data: targets } = await query;
    const accounts = (targets ?? []) as Array<{ id: string; email: string }>;
    if (accounts.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    // ── 2. Insertar notificaciones in-app ─────────────────────────────
    const now = new Date().toISOString();
    const type = (body.type ?? "broadcast") || "broadcast";
    const rows = accounts.map((a) => ({
      account_id: a.id,
      type,
      title,
      body: text || null,
      link: body.link?.trim() || null,
      created_at: now,
    }));
    const { error: notifErr } = await service.from("notification").insert(rows);
    if (notifErr) throw new Error(notifErr.message);

    // ── 3. Email opcional: encolar en email_queue ─────────────────────
    let emails = 0;
    if (body.email) {
      try {
        const { error: mailErr } = await service.from("email_queue").insert(
          accounts.map((a) => ({
            to_email: a.email,
            subject: title,
            body: text || title,
            context: "broadcast",
            created_at: now,
          })),
        );
        if (mailErr) throw new Error(mailErr.message);
        emails = accounts.length;
      } catch (err) {
        console.error("[broadcast] email_queue:", (err as Error).message);
        // la notificacion in-app ya quedo; el email falla sin romper
      }
    }

    return NextResponse.json({ ok: true, sent: accounts.length, emails });
  } catch (err) {
    console.error("[broadcast] error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
