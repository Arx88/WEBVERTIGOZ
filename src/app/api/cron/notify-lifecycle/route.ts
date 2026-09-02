import { NextRequest, NextResponse } from "next/server";
import { notifyReadyWindowOpen } from "@/server/notify/notify-captains";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/notify-lifecycle
 *
 * Avisa a los capitanes cuando se ABRE la ventana ESTOY LISTO de una llave
 * programada (evento por reloj). Mismo criterio que la Edge Function
 * notify-lifecycle, pero en el runtime de la app.
 *
 * Guard de Vercel Cron (igual que /api/cron/enforce-ready):
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notify-lifecycle
 *
 * Nota: vercel.json en plan Hobby solo permite cron DIARIO, así que la
 * frecuencia fina (cada pocos minutos) se programa con un cron externo
 * (GitHub Actions / Upstash) que pega acá o a la Edge Function.
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
    const result = await notifyReadyWindowOpen();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
