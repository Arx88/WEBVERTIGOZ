import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { getEditionForRegistration } from "@/lib/edition";
import { expireUnpaidRegistrations, notifyWaitlistIfSlotsAvailable } from "@/lib/cupo";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/payment-deadline
 *
 * Ciclo de vida del cupo (migración 0014):
 *  1. Expira las inscripciones aprobadas sin pago confirmado cuyo
 *     payment_deadline_at venció (72hs default desde la aprobación).
 *  2. Por cada edición que quedó con lugar libre, avisa a la waitlist
 *     del wizard (cupo_waitlist) y por mail a cada equipo expirado.
 *
 * ?notify=1 — fuerza además un pase de notificación de waitlist para la
 * edición abierta (útil tras liberar lugares a mano desde la DB o para
 * probar el circuito). Sin efecto si el cupo sigue lleno.
 *
 * Pensado para un cron externo (Vercel Cron, GitHub Action, etc.), mismo
 * contrato que los demás crons:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/payment-deadline
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
    const result = await expireUnpaidRegistrations();

    let forced: { attempted: number; sent: number } | null = null;
    if (req.nextUrl.searchParams.get("notify") === "1") {
      const service = getSupabaseServiceRole() as any;
      const edition = await getEditionForRegistration(service);
      if (edition) {
        forced = await notifyWaitlistIfSlotsAvailable(edition.id);
      }
    }

    return NextResponse.json({
      ok: true,
      expired: result.expired,
      editions: result.editions,
      teamsEmailed: result.teamsEmailed,
      waitlist: result.waitlist,
      forced,
    });
  } catch (e) {
    console.error("[cron/payment-deadline] error:", e);
    return NextResponse.json({ ok: false, error: "error interno" }, { status: 500 });
  }
}
