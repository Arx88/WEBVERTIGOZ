import { NextRequest, NextResponse } from "next/server";
import { searchProfiles } from "@/lib/aoe2";

/**
 * GET /api/aoe2/search?q=<nombre>
 * Busca jugadores en AoE2 Companion.
 * Devuelve hasta 20 resultados.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 3) {
    return NextResponse.json(
      { error: "Query mínimo 3 caracteres" },
      { status: 400 }
    );
  }

  try {
    const profiles = await searchProfiles(q);
    // Los resultados de búsqueda son estables en minutos: cache en browser +
    // edge para no golpear el rate limit (16 req/10s) de Companion con cada
    // tecla tipeada de N usuarios simultáneos.
    return NextResponse.json({ profiles }, {
      headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("[aoe2/search] error:", err);
    return NextResponse.json(
      { error: "Error al buscar en AoE2 Companion" },
      { status: 502 }
    );
  }
}
