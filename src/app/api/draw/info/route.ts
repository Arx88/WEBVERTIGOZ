import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/draw/info?id=<draw_id>
 * Devuelve info pública de un sorteo (sin requerir auth).
 * Usado por el wrapper realtime del perfil de equipo.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });
  }

  try {
    const supabase = await getSupabaseServer();

    // Intentar roulette_draw primero
    const { data: rDraw } = (await supabase
      .from("roulette_draw")
      .select("id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, published_at")
      .eq("id", id)
      .single()) as { data: any };

    if (rDraw) {
      return NextResponse.json({ ok: true, draw: rDraw, type: "match" });
    }

    // Intentar seeding_draw
    const { data: sDraw } = (await supabase
      .from("seeding_draw")
      .select("id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, published_at")
      .eq("id", id)
      .single()) as { data: any };

    if (sDraw) {
      return NextResponse.json({ ok: true, draw: sDraw, type: "seeding" });
    }

    return NextResponse.json({ ok: false, error: "Sorteo no encontrado" }, { status: 404 });
  } catch (err) {
    console.error("[/api/draw/info] error:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno" },
      { status: 500 }
    );
  }
}
