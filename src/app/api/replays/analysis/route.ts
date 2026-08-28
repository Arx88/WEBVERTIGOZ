import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SIGN_TTL_SECONDS = 60 * 60; // 1 hora

/**
 * GET /api/replays/analysis?game_id=<match_game.id>
 *
 * Entrega el análisis curado de una partida archivada desde AoE2 Companion:
 *  - payload: resumen curado (duración, uptimes, eapm, resignations, build
 *    order, timeseries, chat) persistido en match_game_analysis.
 *  - svgUrl: signed URL corta del SVG del mapa final (bucket privado replays).
 *  - recUrl: signed URL corta del .aoe2record archivado (si existe).
 *
 * Público a propósito: la página de partido es pública y la tabla
 * match_game_analysis ya tiene política de lectura pública. El service role
 * solo se usa para firmar las URLs de Storage.
 */
export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("game_id");
  if (!gameId) {
    return NextResponse.json({ error: "game_id requerido" }, { status: 400 });
  }

  try {
    const service = getSupabaseServiceRole() as any;

    const { data: analysis } = await service
      .from("match_game_analysis")
      .select("payload, svg_storage_path, aoe2_match_id, fetched_at")
      .eq("match_game_id", gameId)
      .maybeSingle();

    if (!analysis) {
      return NextResponse.json(
        { error: "Esta partida todavía no tiene análisis archivado" },
        { status: 404 }
      );
    }

    const { data: game } = await service
      .from("match_game")
      .select("rec_storage_path, lineup_a, lineup_b")
      .eq("id", gameId)
      .maybeSingle();

    // Perfiles de AoE2 por lineup: el orden de equipos en Companion no tiene
    // por qué coincidir con el A/B del torneo, así que la UI re-mapea los
    // jugadores del análisis a los equipos reales vía profileId.
    let teamProfiles: [number[], number[]] = [[], []];
    const lineupA: string[] = Array.isArray(game?.lineup_a) ? game.lineup_a : [];
    const lineupB: string[] = Array.isArray(game?.lineup_b) ? game.lineup_b : [];
    const regIds = [...new Set([...lineupA, ...lineupB])];
    if (regIds.length > 0) {
      const { data: regs } = await service
        .from("player_registration")
        .select("id, aoe2_profile_id")
        .in("id", regIds);
      const profileOf = new Map<string, number>();
      for (const r of regs ?? []) {
        if (r.aoe2_profile_id != null) profileOf.set(r.id, Number(r.aoe2_profile_id));
      }
      teamProfiles = [
        lineupA.map((id) => profileOf.get(id)).filter((x): x is number => x != null),
        lineupB.map((id) => profileOf.get(id)).filter((x): x is number => x != null),
      ];
    }

    let svgUrl: string | null = null;
    if (analysis.svg_storage_path) {
      const { data } = await service.storage
        .from("replays")
        .createSignedUrl(analysis.svg_storage_path, SIGN_TTL_SECONDS);
      svgUrl = data?.signedUrl ?? null;
    }

    let recUrl: string | null = null;
    if (game?.rec_storage_path) {
      const { data } = await service.storage
        .from("replays")
        .createSignedUrl(game.rec_storage_path, SIGN_TTL_SECONDS);
      recUrl = data?.signedUrl ?? null;
    }

    return NextResponse.json({
      payload: analysis.payload ?? {},
      svgUrl,
      recUrl,
      aoe2MatchId: analysis.aoe2_match_id ?? null,
      teamProfiles,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el análisis" }, { status: 500 });
  }
}
