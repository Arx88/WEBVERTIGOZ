import { NextRequest, NextResponse } from "next/server";
import { drainPushQueue } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/drain — barrido de respaldo de la cola push_queue.
 *
 * En el día a día el drenaje lo hace el GET /api/notifications (lazy, con
 * throttle) para que cada push llegue al instante; este endpoint queda
 * para el cron de Vercel (diario, plan Hobby) y para debugging manual:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/push/drain
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "no autorizado" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 401 });
  }

  try {
    const r = await drainPushQueue(100);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[push/drain] error:", e);
    return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
