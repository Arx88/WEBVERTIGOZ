import { NextRequest, NextResponse } from "next/server";
import { enforceAllDue } from "@/server/match-enforcement";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/enforce-ready
 *
 * Aplica W.O. automático a los matches scheduled cuya tolerancia
 * (15 min después del horario) ya venció. Pensado para Vercel Cron
 * (ver vercel.json, diario a las 03:00 UTC — el plan Hobby no permite
 * frecuencias mayores; el check lazy al abrir las páginas cubre el resto):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/enforce-ready
 * Sin CRON_SECRET configurado, solo se permite en desarrollo.
 * Además las páginas del partido aplican el mismo check de forma lazy.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "no autorizado" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 401 }
    );
  }

  try {
    const results = await enforceAllDue();
    return NextResponse.json({
      ok: true,
      enforced: results.length,
      matches: results.map((r) => ({
        matchId: r.matchId,
        winnerTeamId: r.winnerTeamId,
        doubleAbsence: r.doubleAbsence,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
