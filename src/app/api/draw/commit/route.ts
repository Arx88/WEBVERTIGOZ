import { NextRequest, NextResponse } from "next/server";
import { commitDraw, type SpinType } from "@/server/actions/draw";

/**
 * POST /api/draw/commit
 * Inicia un sorteo generando el serverSeed y el commit hash.
 *
 * Body: { spinType: "match" | "seeding" | "regirar", matchId?, bracketId? }
 * Returns: { ok: true, data: { drawId, serverSeedHash, clientSeed } } | { ok: false, error }
 *
 * Requiere sesión admin (lo valida commitDraw internamente).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spinType, matchId, bracketId } = body as {
      spinType: SpinType;
      matchId?: string;
      bracketId?: string;
    };

    if (!spinType || !["match", "seeding", "regirar"].includes(spinType)) {
      return NextResponse.json(
        { ok: false, error: "spinType requerido (match | seeding | regirar)" },
        { status: 400 }
      );
    }

    const result = await commitDraw(spinType, { matchId, bracketId });
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/draw/commit] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
