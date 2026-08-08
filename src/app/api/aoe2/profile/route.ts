import { NextRequest, NextResponse } from "next/server";
import { getMaxRatingRm1v1, getProfile } from "@/lib/aoe2";

/**
 * GET /api/aoe2/profile?id=<profile_id>
 * Devuelve el maxRating RM 1v1 histórico + steamId + datos básicos del jugador.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    const profileId = parseInt(id, 10);
    const result = await getMaxRatingRm1v1(profileId);

    // Obtener el full profile para tener steamId (no viene en getMaxRatingRm1v1)
    let steamId: string | undefined;
    try {
      const fullProfile = await getProfile(profileId, "stats,ratings");
      steamId = fullProfile.steamId;
    } catch {
      // Si falla, continuamos sin steamId (no es crítico para el ELO cap)
    }

    return NextResponse.json({
      profileId,
      maxRating: result.maxRating,
      currentRating: result.currentRating,
      rank: result.rank,
      steamId, // ← fix bug #14: antes no se devolvía
      verificationStatus: result.verificationStatus,
    });
  } catch (err) {
    console.error("[aoe2/profile] error:", err);
    return NextResponse.json(
      { error: "Error al obtener perfil de AoE2 Companion" },
      { status: 502 }
    );
  }
}
