import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * GET /api/draw/live?match_id=...
 * Devuelve el resultado del sorteo publicado (roulette_draw.result) + preset config
 * para que la ruleta animada lo REPRODUZCA (server decide / client anima).
 *
 * Público: solo devuelve resultados de draws ya revelados/publicados (RLS lo permite).
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const matchId = req.nextUrl.searchParams.get("match_id");
    if (!matchId) return NextResponse.json({ error: "Falta match_id" }, { status: 400 });

    const supabase = await getSupabaseServer();

    // Match en curso + su game actual
    const { data: match } = (await supabase
      .from("match")
      .select("id, status")
      .eq("id", matchId)
      .maybeSingle()) as { data: any };
    if (!match) return NextResponse.json({ error: "Match no encontrado" }, { status: 404 });

    // Game activo (el de mayor game_number con draw)
    const { data: game } = (await supabase
      .from("match_game")
      .select("id, game_number, status, draw_id")
      .eq("match_id", matchId)
      .order("game_number", { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: any };

    if (!game?.draw_id) {
      return NextResponse.json({ found: false, reason: "Sin sorteo todavía" }, { status: 200 });
    }

    // Draw (solo si está revealed/published — RLS ya lo filtra)
    const { data: draw } = (await supabase
      .from("roulette_draw")
      .select("result, status, preset_version_id")
      .eq("id", game.draw_id)
      .single()) as { data: any };

    if (!draw || !["revealed", "published"].includes(draw.status)) {
      return NextResponse.json({ found: false, reason: "Sorteo aún no revelado" }, { status: 200 });
    }

    // Preset
    const { data: preset } = (await supabase
      .from("preset_version")
      .select("config")
      .eq("id", draw.preset_version_id)
      .maybeSingle()) as { data: any };

    return NextResponse.json({
      found: true,
      matchStatus: match.status,
      gameStatus: game.status,
      drawStatus: draw.status,
      result: draw.result,
      preset: preset?.config ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error" },
      { status: 500 }
    );
  }
}
