import { NextRequest, NextResponse } from "next/server";
import { spinStep } from "@/server/actions/draw";

/**
 * POST /api/draw/spin
 * Devuelve el índice determinista para una etapa del sorteo.
 *
 * Body: { drawId: string, stepIndex: number, N: number, stepLabel: string }
 * Returns: { ok: true, data: { targetIndex, stepLabel } } | { ok: false, error }
 *
 * Requiere sesión admin.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { drawId, stepIndex, N, stepLabel } = body as {
      drawId: string;
      stepIndex: number;
      N: number;
      stepLabel: string;
    };

    if (!drawId) {
      return NextResponse.json({ ok: false, error: "drawId requerido" }, { status: 400 });
    }
    if (typeof stepIndex !== "number" || stepIndex < 0) {
      return NextResponse.json({ ok: false, error: "stepIndex debe ser >= 0" }, { status: 400 });
    }
    if (typeof N !== "number" || N < 1) {
      return NextResponse.json({ ok: false, error: "N debe ser >= 1" }, { status: 400 });
    }

    const result = await spinStep(drawId, stepIndex, N, stepLabel || `step_${stepIndex}`);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/draw/spin] error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
