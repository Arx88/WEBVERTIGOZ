/** Tipos y mapas de estado compartidos entre la página del fixture (server)
 *  y la tarjeta de llave (client). */

export interface FixtureMatch {
  id: string;
  status: string;
  scheduledAtStart: string | null;
  scheduledAtEnd: string | null;
  jornadaLabel: string | null;
  roundName: string | null;
  format: string | null;
  teamA: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  teamB: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
}

export const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Programado", cls: "vertigo-badge-purple" },
  open: { label: "Abierto", cls: "vertigo-badge-success" },
  drawing: { label: "Sorteando", cls: "vertigo-badge-warning" },
  lineup: { label: "Lineup", cls: "vertigo-badge-warning" },
  comodin_window: { label: "Comodines", cls: "vertigo-badge-warning" },
  in_progress: { label: "En juego", cls: "vertigo-badge-success" },
  finished: { label: "Finalizado", cls: "vertigo-badge-purple" },
  disputed: { label: "Disputa", cls: "vertigo-badge-danger" },
  forfeit: { label: "W.O.", cls: "vertigo-badge-danger" },
  cancelled: { label: "Cancelado", cls: "vertigo-badge-danger" },
};

/** Riel de color por estado (mismo lenguaje que las boletas de /apuestas) */
export const STATUS_RAIL: Record<string, string> = {
  scheduled: "rgba(124,58,237,0.55)",
  open: "var(--vertigo-success)",
  drawing: "var(--vertigo-warning)",
  lineup: "var(--vertigo-warning)",
  comodin_window: "var(--vertigo-warning)",
  in_progress: "var(--vertigo-success)",
  finished: "rgba(124,58,237,0.9)",
  disputed: "var(--vertigo-danger)",
  forfeit: "var(--vertigo-danger)",
  cancelled: "var(--vertigo-danger)",
};

export const LIVE_STATUSES = ["open", "drawing", "lineup", "comodin_window", "in_progress", "disputed"];

export function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "HOY" / "MAÑANA" — cualquier otro día no necesita chip: la fecha ya lo dice. */
export function diaRelativo(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (mismoDia(d, new Date())) return "HOY";
  if (mismoDia(d, new Date(Date.now() + 86_400_000))) return "MAÑANA";
  return null;
}
