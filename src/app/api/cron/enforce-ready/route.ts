import { NextRequest, NextResponse } from "next/server";
import { enforceAllDue } from "@/server/match-enforcement";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/enforce-ready
 *
 * Barrido de matches scheduled con tolerancia vencida. Desde el modelo
 * "Admin Win" NO auto-resuelve nada (la resolución es del primer READY o del
 * admin); queda como punto de extensión y para chequeo lazy de páginas.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/enforce-ready
 * Sin CRON_SECRET configurado, solo se permite en desarrollo.
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
