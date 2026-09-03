import { NextRequest, NextResponse } from "next/server";
import { drainScheduledBroadcasts } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/scheduled-broadcasts
 *
 * Barrido DIARIO de respaldo de los avisos programados: entrega los
 * scheduled_broadcast.pending cuya hora llegó. En el día a día el drenaje
 * lo hace el GET /api/notifications (lazy, con throttle) para que cada
 * aviso salga a la hora exacta; este cron atrapa lo que quede colgado
 * si nadie abre el sitio (mismo patrón que enforce-ready).
 *
 * Contrato igual al resto de los crons:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/scheduled-broadcasts
 * Sin CRON_SECRET configurado, solo se permite en desarrollo.
 *
 * Frecuencia diaria en vercel.json — el plan Hobby de Vercel rechaza
 * crons más frecuentes que 1/día y eso BLOQUEA la creación del deployment
 * (le pasó al cron de enforce-ready en agosto: commit 37eae4e).
 */
export async function GET(req: NextRequest) {
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
    // Sin límite artificial: el barrido diario drena todo lo vencido.
    const { delivered, failed } = await drainScheduledBroadcasts(200);
    return NextResponse.json({ ok: true, delivered, failed });
  } catch (e) {
    console.error("[cron/scheduled-broadcasts] error:", e);
    return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 });
  }
}
