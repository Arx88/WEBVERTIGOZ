import { Client } from "@upstash/qstash";
import { notifyReadyWindow } from "./notify-captains";

/**
 * Agenda un disparo ÚNICO en QStash para que el aviso de apertura de la ventana
 * ESTOY LISTO llegue al SEGUNDO exacto en que la ventana se abre
 * (scheduled_at_start - READY_WINDOW_MIN). Sin polling.
 *
 * Se llama desde `scheduleMatchAction` (cuando el admin agenda la llave) porque
 * ahí es donde se conoce el scheduled_at_start exacto.
 *
 * Si no hay QSTASH_TOKEN (dev), no hace nada — el aviso lo cubre el scan
 * de respaldo (/api/cron/notify-lifecycle) o se configura después.
 */

const READY_WINDOW_MIN = 15;

export async function scheduleReadyWindowNotification(
  matchId: string,
  scheduledAtStart: string
): Promise<{ scheduled: boolean; delaySec?: number; immediateSent?: number; messageId?: string; error?: string }> {
  const start = new Date(scheduledAtStart).getTime();
  if (Number.isNaN(start)) return { scheduled: false };

  const openAt = start - READY_WINDOW_MIN * 60_000;
  const delaySec = Math.round((openAt - Date.now()) / 1000);

  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    // Dev / sin QStash configurado: no-op (el scan de respaldo cubre).
    console.warn(`[notify-ready] sin QSTASH_TOKEN, se omite el agendado (match=${matchId})`);
    return { scheduled: false, delaySec };
  }

  // La ventana ya está abierta: entrega inmediata.
  if (delaySec <= 0) {
    const res = await notifyReadyWindow(matchId, scheduledAtStart);
    return { scheduled: false, delaySec, immediateSent: res.sent };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = `${appUrl}/api/qstash/notify-ready`;
  if (!appUrl) {
    console.warn(`[notify-ready] sin NEXT_PUBLIC_APP_URL, no se puede armar el webhook (match=${matchId})`);
    return { scheduled: false, delaySec };
  }

  const client = new Client({ token });
  try {
    const response = await client.publishJSON({
      url: webhookUrl,
      body: { matchId, scheduledAtStart },
      delay: delaySec, // segundos: QStash entrega al momento exacto
    });
    return { scheduled: true, delaySec, messageId: String(response.messageId ?? "") };
  } catch (e) {
    // En dev el webhook es loopback y QStash lo rechaza; en prod funciona.
    console.warn(`[notify-ready] QStash rechazó el agendado (match=${matchId}):`, e instanceof Error ? e.message : e);
    return { scheduled: false, delaySec, error: e instanceof Error ? e.message : String(e) };
  }
}
