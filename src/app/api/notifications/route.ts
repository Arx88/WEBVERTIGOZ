import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { drainScheduledBroadcasts } from "@/lib/broadcast";
import { drainPushQueue } from "@/lib/push";

/**
 * Notificaciones in-app del usuario autenticado.
 *
 * GET  → { authenticated, accountId?, role?, displayName?, unread, notifications[] }
 *        (últimas 30, más recientes primero). accountId se expone para filtrar
 *        el canal realtime (postgres_changes) desde el cliente.
 *        Además drena (throttled) los avisos programados vencidos: como este
 *        poll lo hace todo el mundo cada pocos segundos, los scheduled_broadcast
 *        se entregan a la hora exacta sin depender del cron (barrido diario).
 * POST → { id } marca una como leída, o { all: true } las marca todas.
 *
 * Sin sesión → { authenticated: false } (el cliente muestra el banner de cupos).
 * Las filas se generan solas vía triggers en la DB
 * (drizzle/2026-09-01-notifications.sql y 2026-09-02-notificaciones-fases.sql).
 */

export const dynamic = "force-dynamic";

// Throttle del drenaje lazy: a lo sumo una pasada cada 30s por instancia,
// aunque el poll sea más frecuente. El claim en DB es atómico, así que
// correrlo desde varias instancias a la vez es seguro (no duplica envíos).
let lastDrainAt = 0;

export async function GET(req: NextRequest) {
  try {
    // Drenaje lazy de avisos programados vencidos y de la cola push —
    // antes del fetch, así el propio poll que lo disparó ya los ve
    // (notificaciones in-app nuevas + push nativo al instante). Un fallo
    // acá NO rompe el poll: se reintenta en la siguiente ventana.
    if (Date.now() - lastDrainAt > 30_000) {
      lastDrainAt = Date.now();
      try {
        await drainScheduledBroadcasts(10);
      } catch (drainErr) {
        console.error("[notifications] drain scheduled:", (drainErr as Error).message);
      }
      try {
        await drainPushQueue(25);
      } catch (drainErr) {
        console.error("[notifications] drain push:", (drainErr as Error).message);
      }
    }

    // Paginación: ?limit (default 30, max 100) + ?offset (default 0).
    const params = req.nextUrl.searchParams;
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 30));
    const offset = Math.max(0, Number(params.get("offset")) || 0);

    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    const { data: account } = (await supabase
      .from("account")
      .select("id, role, display_name")
      .eq("supabase_auth_id", user.id)
      .maybeSingle()) as { data: { id: string; role: string; display_name: string | null } | null };

    if (!account) {
      return NextResponse.json({ authenticated: false });
    }

    // RLS: solo ve sus filas (política notification_select_own).
    const { data: notifications, count } = await supabase
      .from("notification")
      .select("id, type, title, body, link, match_id, read_at, created_at", { count: "exact" })
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { count: unreadCount } = await supabase
      .from("notification")
      .select("id", { count: "exact", head: true })
      .eq("account_id", account.id)
      .is("read_at", null);

    const rows = (notifications ?? []) as Array<{
      id: string;
      type: string;
      title: string;
      body: string | null;
      link: string | null;
      match_id: string | null;
      read_at: string | null;
      created_at: string;
    }>;

    return NextResponse.json({
      authenticated: true,
      accountId: account.id,
      role: account.role,
      displayName: account.display_name,
      notifications: rows,
      total: count ?? rows.length,
      unread: unreadCount ?? rows.filter((n) => !n.read_at).length,
    });
  } catch (err) {
    console.error("[notifications] GET error:", err);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { data: account } = (await supabase
      .from("account")
      .select("id")
      .eq("supabase_auth_id", user.id)
      .maybeSingle()) as { data: { id: string } | null };
    if (!account) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };

    // RLS no tiene UPDATE a propósito: se hace con service role pero SIEMPRE
    // filtrando por el account_id resuelto de la sesión (nunca un id del body).
    const service = getSupabaseServiceRole() as any;

    if (body.all) {
      const { error } = await service
        .from("notification")
        .update({ read_at: new Date().toISOString() })
        .eq("account_id", account.id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (body.id) {
      const { error } = await service
        .from("notification")
        .update({ read_at: new Date().toISOString() })
        .eq("account_id", account.id)
        .eq("id", body.id)
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Nada que marcar" }, { status: 400 });
  } catch (err) {
    console.error("[notifications] POST error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
