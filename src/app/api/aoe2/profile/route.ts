import { NextRequest, NextResponse } from "next/server";
import { getMaxRatingFromProfile, getProfile } from "@/lib/aoe2";

/**
 * GET /api/aoe2/profile?id=<profile_id>
 * Devuelve el perfil completo: nombre, país, clan, steamId,
 * verificación y maxRating RM 1v1 histórico.
 * Un solo fetch a AoE2 Companion (extend=stats,ratings).
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    const profileId = parseInt(id, 10);
    const profile = await getProfile(profileId, "stats,ratings");
    const result = getMaxRatingFromProfile(profile);

    return NextResponse.json({
      profileId: profile.profileId ?? profileId,
      name: profile.name ?? null,
      steamId: profile.steamId ?? null,
      country: profile.country ?? null,
      clan: profile.clan ?? null,
      platform: profile.platform ?? null,
      verified: profile.verified ?? false,
      maxRating: result.maxRating,
      currentRating: result.currentRating,
      rank: result.rank,
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
