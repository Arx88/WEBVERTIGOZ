import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

/**
 * POST /api/admin/emblemas/create
 * Crea un registro de emblema en la tabla emblem.
 * Requiere sesión admin.
 *
 * Body: { name, key, image_url }
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { name, key, image_url } = body as {
      name: string;
      key: string;
      image_url: string;
    };

    if (!name || !key || !image_url) {
      return NextResponse.json(
        { error: "name, key e image_url son requeridos" },
        { status: 400 }
      );
    }

    const supabase = (await getSupabaseServer()) as any;
    const { data, error } = await supabase
      .from("emblem")
      .insert({
        name,
        key,
        image_url,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: `DB error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    console.error("[/api/admin/emblemas/create] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
