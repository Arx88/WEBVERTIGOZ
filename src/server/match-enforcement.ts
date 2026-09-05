import { revalidatePath } from "next/cache";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { GRACE_MIN } from "@/lib/match-rules";

/**
 * Ventana de decisión de W.O. ("ADMIN WIN").
 *
 * Reglas (modelo 2026-09 — ya NO hay W.O. automático):
 * - El "ESTOY LISTO" se puede presionar desde READY_WINDOW_MIN antes del
 *   horario programado hasta GRACE_MIN después (tolerancia).
 * - Pasados GRACE_MIN, la llave NO cierra sola: entra en la ventana de
 *   decisión de W.O. (match sigue "scheduled", fase "wo" de computeReadyPhase).
 *   El reloj sigue corriendo y hay dos salidas:
 *     1) Un capitán confirma READY → avanza solo (confirmReadyAction aplica
 *        forfeit con ganador y avisa a ambos capitanes).
 *     2) El admin decide: asigna ganador (markForfeitAction) o reprograma
 *        (scheduleMatchFormAction). El banner en /admin/partido/[id] lo
 *        ofrece apenas entra en esta fase.
 * - Si ambos confirman durante la ventana, la llave se habilita normal.
 *
 * Este módulo queda como chequeo lazy/cron que NO auto-resuelve; la
 * resolución viva en confirmReadyAction y las acciones del admin.
 */

export { READY_WINDOW_MIN, GRACE_MIN } from "@/lib/match-rules";

type EnforcementResult = {
  matchId: string;
  winnerTeamId: string | null;
  doubleAbsence: boolean;
};

function revalidateMatchPages(matchId: string) {
  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath("/mis-partidos");
  revalidatePath("/bracket");
  revalidatePath("/admin/jornadas");
}

/**
 * Aplica W.O. a un match vencido si corresponde.
 * Devuelve el resultado si aplicó, o null si no estaba vencido.
 */
export async function enforceMatchIfDue(matchId: string): Promise<EnforcementResult | null> {
  const admin = getSupabaseServiceRole() as any;

  const { data: match, error } = await admin
    .from("match")
    .select("id, status, scheduled_at_start, ready_a_at, ready_b_at, team_a_id, team_b_id")
    .eq("id", matchId)
    .maybeSingle();
  if (error || !match) return null;

  return applyIfDue(admin, match);
}

/**
 * Barre todos los matches scheduled vencidos (para el cron).
 */
export async function enforceAllDue(): Promise<EnforcementResult[]> {
  const admin = getSupabaseServiceRole() as any;
  const cutoff = new Date(Date.now() - GRACE_MIN * 60_000).toISOString();

  const { data: due, error } = await admin
    .from("match")
    .select("id, status, scheduled_at_start, ready_a_at, ready_b_at, team_a_id, team_b_id")
    .eq("status", "scheduled")
    .not("scheduled_at_start", "is", null)
    .lt("scheduled_at_start", cutoff);
  if (error) throw new Error(`DB error: ${error.message}`);

  const results: EnforcementResult[] = [];
  for (const match of due ?? []) {
    const r = await applyIfDue(admin, match);
    if (r) results.push(r);
  }
  return results;
}

async function applyIfDue(
  admin: any,
  match: {
    id: string;
    status: string;
    scheduled_at_start: string | null;
    ready_a_at: string | null;
    ready_b_at: string | null;
    team_a_id: string | null;
    team_b_id: string | null;
  }
): Promise<EnforcementResult | null> {
  if (match.status !== "scheduled" || !match.scheduled_at_start) return null;

  const deadline = new Date(match.scheduled_at_start).getTime() + GRACE_MIN * 60_000;
  if (Date.now() <= deadline) return null;

  // Ya NO se auto-asigna ganador. La llave entra en la ventana de decisión de
  // W.O. (fase "wo"): el reloj sigue corriendo, el primero en confirmar READY
  // avanza, y el admin puede decidir en cualquier momento (detiene el reloj).
  // La resolución la hacen confirmReadyAction (primero en confirmar) o
  // markForfeitAction (decisión del admin). Nada que aplicar acá.
  return null;
}
