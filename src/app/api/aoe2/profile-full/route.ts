import { NextRequest, NextResponse } from "next/server";
import { getMaxRatingRm1v1 } from "@/lib/aoe2";

const API_URL = process.env.AOE2_COMPANION_API_URL ?? "https://data.aoe2companion.com/api";
const USER_AGENT = process.env.AOE2_COMPANION_USER_AGENT ?? "VERTIGO-Cup/1.0";

/**
 * GET /api/aoe2/profile-full?id=<profile_id>
 *
 * Devuelve datos completos del perfil:
 * - ELO máximo RM 1v1
 * - Rating actual
 * - País, clan, nombre
 * - Stats por civ (winrate) de rm_1v1
 * - Stats por mapa de rm_1v1
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    const profileId = parseInt(id, 10);

    // Fetch ELO data (función existente)
    const eloResult = await getMaxRatingRm1v1(profileId);

    // Fetch full profile con stats extendidos
    let civStats: any[] = [];
    let mapStats: any[] = [];
    let playerName = "";
    let country = "";
    let clan = "";

    try {
      const url = `${API_URL}/profiles/${profileId}?extend=stats`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 1800 }, // 30 min cache
      });

      if (res.ok) {
        const profile = await res.json();
        playerName = profile.name ?? "";
        country = profile.country ?? "";
        clan = profile.clan ?? "";

        // Extraer stats de rm_1v1 solamente
        const rm1v1Stats = profile.stats?.find((s: any) => s.leaderboardId === "rm_1v1");
        if (rm1v1Stats) {
          civStats = (rm1v1Stats.civ ?? [])
            .filter((c: any) => c.games >= 2) // mínimo 2 partidas para ser relevante
            .slice(0, 8) // top 8 civs
            .map((c: any) => ({
              civ: c.civ,
              civName: c.civName,
              games: c.games,
              wins: c.wins,
              losses: c.losses,
              winrate: c.games > 0 ? Math.round((c.wins / c.games) * 100) : 0,
              imageUrl: c.civImageUrl,
            }));

          mapStats = (rm1v1Stats.map ?? [])
            .filter((m: any) => m.games >= 1)
            .slice(0, 6)
            .map((m: any) => ({
              map: m.map,
              mapName: m.mapName,
              games: m.games,
              wins: m.wins,
              losses: m.losses,
              winrate: m.games > 0 ? Math.round((m.wins / m.games) * 100) : 0,
              imageUrl: m.mapImageUrl,
            }));
        }
      }
    } catch {
      // Si falla el fetch extendido, devolvemos solo ELO
    }

    // Perfil + stats cambian lento: cache corta en browser y stale-while-
    // revalidate en edge para que re-abrir un perfil sea instantáneo.
    return NextResponse.json(
      {
        profileId,
        name: playerName,
        country,
        clan,
        maxRating: eloResult.maxRating,
        currentRating: eloResult.currentRating,
        rank: eloResult.rank,
        steamId: undefined,
        verificationStatus: eloResult.verificationStatus,
        civStats,
        mapStats,
      },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("[aoe2/profile-full] error:", err);
    return NextResponse.json(
      { error: "Error al obtener perfil de AoE2 Companion" },
      { status: 502 }
    );
  }
}
