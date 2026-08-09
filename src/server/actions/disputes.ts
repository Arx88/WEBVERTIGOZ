"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Crea una disputa sobre un partido finalizado.
 *
 * Validaciones:
 * - Usuario autenticado y rol "owner"
 * - El equipo que abre la disputa es uno de los dos del match
 * - El partido está finalizado y dentro de la ventana de 30 minutos
 */
export async function createDisputeAction(formData: FormData) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account) throw new Error("Cuenta no encontrada");
  if (!["owner"].includes(account.role)) {
    throw new Error("Solo los capitanes pueden abrir disputas");
  }

  const matchId = String(formData.get("matchId") ?? "").trim();
  const teamRegistrationId = String(formData.get("teamRegistrationId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const evidenceRaw = String(formData.get("evidenceUrls") ?? "").trim();

  if (!matchId) throw new Error("Falta ID del partido");
  if (!teamRegistrationId) throw new Error("Falta ID del equipo");
  if (!reason || reason.length < 10) {
    throw new Error("El motivo debe tener al menos 10 caracteres");
  }

  // Validar que el match exista, esté finalizado y el equipo sea uno de los dos
  const { data: match } = (await supabase
    .from("match")
    .select("id, status, finished_at, team_a_id, team_b_id")
    .eq("id", matchId)
    .maybeSingle()) as { data: any };

  if (!match) throw new Error("Partido no encontrado");
  if (match.status !== "finished") throw new Error("El partido no está finalizado");
  if (match.team_a_id !== teamRegistrationId && match.team_b_id !== teamRegistrationId) {
    throw new Error("Tu equipo no participó de este partido");
  }

  // Validar ventana de 30 minutos
  const DISPUTE_WINDOW_MINUTES = 30;
  if (match.finished_at) {
    const elapsed = Date.now() - new Date(match.finished_at).getTime();
    if (elapsed > DISPUTE_WINDOW_MINUTES * 60 * 1000) {
      throw new Error(`La ventana de ${DISPUTE_WINDOW_MINUTES} minutos para disputar ya cerró`);
    }
  }

  // Validar que el equipo no tenga ya una disputa abierta para este match
  const { data: existing } = (await supabase
    .from("dispute")
    .select("id, status")
    .eq("match_id", matchId)
    .eq("raised_by_team_id", teamRegistrationId)
    .in("status", ["open", "reviewing"])
    .maybeSingle()) as { data: any };

  if (existing) {
    throw new Error("Ya tenés una disputa abierta para este partido");
  }

  // Parsear URLs de evidencia
  const evidenceUrls = evidenceRaw
    ? evidenceRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from("dispute").insert({
    match_id: matchId,
    raised_by_team_id: teamRegistrationId,
    reason,
    evidence_urls: evidenceUrls,
    status: "open",
  });

  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/disputas");
}
