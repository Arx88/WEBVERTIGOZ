import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";

/**
 * Suscripción push del usuario autenticado.
 *
 * POST body: { endpoint, p256dh, auth }  — el subscription.toJSON() de la
 * PushSubscription del navegador. Upsert por endpoint (un dispositivo no
 * se duplica si el usuario vuelve a activar).
 *
 * Respuestas:
 *   { ok: true }                       → suscripto (o ya estaba)
 *   { ok: false, error }               → sin sesión / body inválido
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "no_session" }, { status: 401 });
    }

    const { data: account } = (await supabase
      .from("account")
      .select("id")
      .eq("supabase_auth_id", user.id)
      .maybeSingle()) as { data: { id: string } | null };

    if (!account) {
      return NextResponse.json({ ok: false, error: "no_account" }, { status: 404 });
    }

    const body = await req.json();
    const endpoint: string | undefined = body?.endpoint;
    const p256dh: string | undefined = body?.p256dh;
    const auth: string | undefined = body?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "faltan endpoint/p256dh/auth" },
        { status: 400 },
      );
    }

    // La escritura va con service role: las policies RLS del proyecto no
    // permiten INSERT a `push_subscription` desde el cliente.
    const service = getSupabaseServiceRole();
    const { error } = await service.from("push_subscription").upsert(
      {
        account_id: account.id,
        endpoint,
        p256dh,
        auth,
        user_agent: req.headers.get("user-agent") ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
