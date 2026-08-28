import { revalidatePath } from "next/cache";
import { getSupabaseServiceRole } from "@/lib/supabase/server";
import { GRACE_MIN } from "@/lib/match-rules";

/**
 * W.O. automático por ausencia en la ventana de READY.
 *
 * Reglas:
 * - El "ESTOY LISTO" se puede presionar desde READY_WINDOW_MIN antes del
 *   horario programado hasta GRACE_MIN después (tolerancia).
 * - Pasados GRACE_MIN del horario, el equipo que no confirmó pierde la llave
 *   (status="forfeit", winner = el rival). Si NINGUNO confirmó, W.O. doble:
 *   forfeit sin ganador y el admin decide después.
 *
 * Se ejecuta de dos formas:
 * - Lazy: al abrir/refresh la página del partido (enforceMatchIfDue).
 * - Cron: /api/cron/enforce-ready cada 5 min (enforceAllDue).
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

  const readyA = !!match.ready_a_at;
  const readyB = !!match.ready_b_at;
  const winnerTeamId = readyA && !readyB ? match.team_a_id : readyB && !readyA ? match.team_b_id : null;
  const doubleAbsence = !readyA && !readyB;

  const now = new Date().toISOString();
  const { error } = await admin
    .from("match")
    .update({
      status: "forfeit",
      winner_team_id: winnerTeamId,
      finished_at: now,
      updated_at: now,
    })
    .eq("id", match.id)
    .eq("status", "scheduled");
  if (error) throw new Error(`DB error: ${error.message}`);

  revalidateMatchPages(match.id);
  return { matchId: match.id, winnerTeamId, doubleAbsence };
}
