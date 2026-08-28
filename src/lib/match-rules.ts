/**
 * Reglas temporales de la ventana de READY.
 * Módulo neutro (sin imports server-only) para compartir entre
 * server actions, enforcement, páginas server y componentes client.
 *
 * - READY_WINDOW_MIN: cuántos minutos ANTES del horario se abre el "ESTOY LISTO".
 * - GRACE_MIN: tolerancia después del horario; vencida, W.O. automático.
 */
export const READY_WINDOW_MIN = 15;
export const GRACE_MIN = 15;

/**
 * Fases para un match "scheduled" con horario T:
 * - "no-date": sin horario confirmado.
 * - "early": falta para que se abra la ventana (now < T - READY_WINDOW_MIN).
 * - "open": ventana abierta antes del horario (se puede confirmar READY).
 * - "grace": tolerancia posterior al horario (W.O. automático al agotarse).
 * - "expired": tolerancia agotada (el enforcement lo convierte en forfeit).
 * - "inactive": el match ya no está en estado scheduled (nada que mostrar).
 */
export type ReadyPhase = "no-date" | "early" | "open" | "grace" | "expired" | "inactive";

export interface ReadyWindowState {
  phase: ReadyPhase;
  msToOpen: number | null;
  msToDeadline: number | null;
}

export function computeReadyPhase(
  scheduledAtStart: string | null,
  status: string,
  nowMs: number
): ReadyWindowState {
  if (status !== "scheduled") {
    return { phase: "inactive", msToOpen: null, msToDeadline: null };
  }
  if (!scheduledAtStart) {
    return { phase: "no-date", msToOpen: null, msToDeadline: null };
  }
  const start = new Date(scheduledAtStart).getTime();
  const openAt = start - READY_WINDOW_MIN * 60_000;
  const deadline = start + GRACE_MIN * 60_000;
  if (nowMs < openAt) {
    return { phase: "early", msToOpen: openAt - nowMs, msToDeadline: deadline - nowMs };
  }
  if (nowMs < start) {
    return { phase: "open", msToOpen: null, msToDeadline: deadline - nowMs };
  }
  if (nowMs < deadline) {
    return { phase: "grace", msToOpen: null, msToDeadline: deadline - nowMs };
  }
  return { phase: "expired", msToOpen: null, msToDeadline: null };
}
