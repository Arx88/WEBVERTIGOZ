import { NextRequest, NextResponse } from "next/server";
import { getMaxRatingRm1v1 } from "@/lib/aoe2";

/**
 * GET /api/aoe2/profile?id=<profile_id>
 * Devuelve el maxRating RM 1v1 histórico de un jugador.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  try {
    const result = await getMaxRatingRm1v1(parseInt(id, 10));
    return NextResponse.json({
      profileId: parseInt(id, 10),
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
