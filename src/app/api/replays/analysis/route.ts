import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { backfillAnalysis, ANALYSIS_PAYLOAD_VERSION } from "@/lib/aoe2/match-sync";

export const dynamic = "force-dynamic";

const SIGN_TTL_SECONDS = 60 * 60; // 1 hora

/**
 * GET /api/replays/analysis?game_id=<match_game.id>
 *
 * Entrega el análisis curado de una partida archivada desde AoE2 Companion:
 *  - payload: resumen curado (duración, uptimes, eapm, estrategia, build
 *    order curado, timeseries, chat) persistido en match_game_analysis.
 *  - svgUrl: signed URL corta del SVG del mapa final (bucket privado replays).
 *  - recUrl: signed URL corta del .aoe2record archivado (si existe).
 *
 * BACKFILL: Companion genera el análisis async — si el watcher sincronizó
 * apenas terminó la partida puede no haber estado listo. Si el game está
 * sincronizado y no hay fila, se intenta re-archivar en el momento (con
 * cooldown) en vez de responder 404 para siempre.
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

    const selectAnalysis = () =>
      service
        .from("match_game_analysis")
        .select("payload, svg_storage_path, aoe2_match_id, fetched_at")
        .eq("match_game_id", gameId)
        .maybeSingle();

    let { data: analysis } = await selectAnalysis();

    // Sin fila O payload viejo (formato anterior a la curación actual) →
    // intentar (re-)archivar una vez. El cooldown in-memory evita que N
    // viewers disparen N re-fetches de ~7 MB.
    //  - Sin fila: exige game sincronizado con match de Companion.
    //  - Payload viejo: alcanza con que la propia fila de análisis sepa de
    //    qué match viene (el game puede haber perdido el vínculo).
    const isStale = analysis && analysis.payload?.v !== ANALYSIS_PAYLOAD_VERSION;
    if (!analysis || isStale) {
      const { data: game } = await service
        .from("match_game")
        .select("id, aoe2_match_id, aoe2_sync_status, rec_storage_path")
        .eq("id", gameId)
        .maybeSingle();

      const companionId = analysis?.aoe2_match_id ?? game?.aoe2_match_id ?? null;
      const canBackfill =
        companionId != null &&
        (analysis
          ? true
          : game?.aoe2_sync_status === "synced" && game.aoe2_match_id != null);

      if (canBackfill) {
        const result = await backfillAnalysis(
          service,
          { id: gameId, aoe2_match_id: Number(companionId), rec_storage_path: game?.rec_storage_path ?? null }
        );
        if (result.ok) {
          const retry = await selectAnalysis();
          analysis = retry.data;
        } else {
          console.error("[replays/analysis] backfill falló:", gameId, result.error);
        }
      }
    }

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

    return NextResponse.json(
      {
        payload: analysis.payload ?? {},
        svgUrl,
        recUrl,
        aoe2MatchId: analysis.aoe2_match_id ?? null,
        teamProfiles,
      },
      // El payload curado es inmutable por versión; las signed URLs viven 1h.
      // Cache corta en browser + stale-while-revalidate en edge: reabrir una
      // partida no debe re-firmar URLs ni re-golpear Supabase cada vez.
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el análisis" }, { status: 500 });
  }
}
