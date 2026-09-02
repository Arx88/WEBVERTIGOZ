import { NextResponse } from "next/server";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";

/**
 * Baja de una suscripción push.
 *
 * POST body: { endpoint } — borra esa suscripción (solo la de esta
 * cuenta; el endpoint es único por navegador/dispositivo).
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
    if (!endpoint) {
      return NextResponse.json({ ok: false, error: "faltan endpoint" }, { status: 400 });
    }

    const service = getSupabaseServiceRole();
    const { error } = await service
      .from("push_subscription")
      .delete()
      .eq("account_id", account.id)
      .eq("endpoint", endpoint);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }
}
