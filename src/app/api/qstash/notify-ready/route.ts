import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { notifyReadyWindow } from "@/server/notify/notify-captains";

export const dynamic = "force-dynamic";

/**
 * POST /api/qstash/notify-ready
 *
 * Webhook que recibe el mensaje de QStash agendado con `scheduleReadyWindowNotification`
 * justo en el instante en que se abre la ventana ESTOY LISTO. Se encarga de:
 *  - verificar la firma de QStash (ed25519, con las signing keys),
 *  - validar que el match siga programado para ese horario (anti-stale),
 *  - y avisar a los dos capitanes.
 */
export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";

  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!current) {
    return NextResponse.json(
      { error: "QSTASH_CURRENT_SIGNING_KEY no configurado" },
      { status: 500 }
    );
  }

  try {
    const receiver = new Receiver({
      currentSigningKey: current,
      nextSigningKey: next,
    });
    const valid = await receiver.verify({
      signature,
      body: bodyText,
    });
    if (!valid) return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  } catch {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  const payload = (() => {
    try {
      return JSON.parse(bodyText || "{}") as { matchId?: string; scheduledAtStart?: string };
    } catch {
      return {};
    }
  })();

  if (!payload.matchId) return NextResponse.json({ error: "sin matchId" }, { status: 400 });

  try {
    const result = await notifyReadyWindow(payload.matchId, payload.scheduledAtStart ?? null);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
