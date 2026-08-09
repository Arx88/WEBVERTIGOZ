import { NextRequest, NextResponse } from "next/server";
import { revealDraw } from "@/server/actions/draw";

/**
 * POST /api/draw/reveal
 * Revela el serverSeed del sorteo para auditoría pública.
 *
 * Body: { drawId: string }
 * Returns: { ok: true, revealedSeed } | { ok: false, error }
 *
 * Requiere sesión admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { drawId } = body as { drawId: string };

    if (!drawId) {
      return NextResponse.json({ ok: false, error: "drawId requerido" }, { status: 400 });
    }

    const result = await revealDraw(drawId);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/draw/reveal] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
