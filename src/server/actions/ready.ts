"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { READY_WINDOW_MIN, GRACE_MIN } from "@/lib/match-rules";

export interface ReadyActionState {
  error?: string;
}

/**
 * Confirma "ESTOY LISTO" para un match.
 * El capitán hace click y se marca ready_a_at o ready_b_at.
 * Cuando AMBOS equipos están ready, el match pasa a status="open" (HABILITADA).
 *
 * Ventana: solo se puede confirmar desde READY_WINDOW_MIN antes del horario
 * programado hasta GRACE_MIN después (tolerancia). Sin fecha no se puede.
 *
 * Compatible con useActionState: recibe (matchId, prevState, formData) vía
 * bind y devuelve { error } en fallo o null en éxito, para que la UI muestre
 * el motivo en vez de fallar en silencio.
 *
 * RLS: la tabla match solo permite escritura de admin, así que la validación
 * se hace acá (auth → account → equipo → inscripción → participación →
 * ventana) y la escritura usa service role.
 */
export async function confirmReadyAction(
  matchId: string,
  _prev: ReadyActionState | null,
  _fd: FormData
): Promise<ReadyActionState | null> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // Buscar account
  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account) return { error: "Account no encontrado." };

  // Buscar team_account del usuario
  const { data: teamAccount } = (await supabase
    .from("team_account")
    .select("id")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };
  if (!teamAccount) return { error: "No tenés equipo." };

  // Buscar team_registration activa
  const { data: reg } = (await supabase
    .from("team_registration")
    .select("id, status")
    .eq("team_account_id", teamAccount.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };
  if (!reg) return { error: "No tenés inscripción activa." };

  // Buscar el match
  const { data: match } = (await supabase
    .from("match")
    .select("id, status, scheduled_at_start, team_a_id, team_b_id, ready_a_at, ready_b_at")
    .eq("id", matchId)
    .single()) as { data: any };
  if (!match) return { error: "Match no encontrado." };

  // Validar que el team del capitán participa en este match
  if (match.team_a_id !== reg.id && match.team_b_id !== reg.id) {
    return { error: "Tu equipo no participa en este match." };
  }

  // Validar que el match esté en estado scheduled
  if (match.status !== "scheduled") {
    return { error: `El match ya no está en estado programado (actual: ${match.status}).` };
  }

  // Ventana de READY: requiere fecha confirmada y estar dentro de
  // [inicio - READY_WINDOW_MIN, inicio + GRACE_MIN].
  if (!match.scheduled_at_start) {
    return { error: "La llave todavía no tiene fecha y horario confirmados." };
  }
  const startMs = new Date(match.scheduled_at_start).getTime();
  const nowMs = Date.now();
  if (nowMs < startMs - READY_WINDOW_MIN * 60_000) {
    return {
      error: `Podés confirmar READY desde ${READY_WINDOW_MIN} minutos antes del horario de la llave.`,
    };
  }
  if (nowMs > startMs + GRACE_MIN * 60_000) {
    return { error: "El tiempo para confirmar READY ya terminó." };
  }

  const now = new Date().toISOString();
  const isTeamA = match.team_a_id === reg.id;
  const readyField = isTeamA ? "ready_a_at" : "ready_b_at";

  // Marcar este team como ready (service role: RLS de match es solo admin).
  const service = getSupabaseServiceRole() as any;
  const { error } = await service
    .from("match")
    .update({ [readyField]: now, updated_at: now })
    .eq("id", matchId);

  if (error) return { error: `DB error: ${error.message}` };

  // Verificar si AMBOS teams están ready
  const { data: updated } = (await service
    .from("match")
    .select("ready_a_at, ready_b_at, status")
    .eq("id", matchId)
    .single()) as { data: any };

  if (updated?.ready_a_at && updated?.ready_b_at) {
    // Ambos ready → HABILITADA (status = open)
    await service
      .from("match")
      .update({ status: "open", updated_at: now })
      .eq("id", matchId);
  }

  revalidatePath("/mis-partidos");
  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
  return null;
}

/**
 * Admin: agrega minutos a la ventana READY de una llave vigente.
 *
 * Mueve scheduled_at_start hacia adelante; como toda la lógica de la ventana
 * (fase open/grace, countdowns, W.O. automático) se deriva de ese timestamp,
 * el horario mostrado y el límite de W.O. se corren juntos. Los READY ya
 * confirmados se conservan: solo se le da tiempo al equipo que falta.
 */
export async function extendReadyWindowAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) {
    return { ok: false, error: "No autorizado." };
  }

  const matchId = String(formData.get("match_id") ?? "").trim();
  const minutes = Number(formData.get("minutes") ?? 0);
  if (!matchId) return { ok: false, error: "Falta match_id." };
  if (![5, 10, 15].includes(minutes)) return { ok: false, error: "Duración inválida." };

  const service = getSupabaseServiceRole() as any;
  const { data: match } = (await service
    .from("match")
    .select("id, status, scheduled_at_start")
    .eq("id", matchId)
    .single()) as { data: any };
  if (!match) return { ok: false, error: "Match no encontrado." };
  if (match.status !== "scheduled" || !match.scheduled_at_start) {
    return { ok: false, error: "Solo se puede extender una llave programada con horario." };
  }

  const newStart = new Date(new Date(match.scheduled_at_start).getTime() + minutes * 60_000);
  const { error } = await service
    .from("match")
    .update({ scheduled_at_start: newStart.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", matchId);
  if (error) return { ok: false, error: `DB error: ${error.message}` };

  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath(`/partido/${matchId}`);
  revalidatePath("/mis-partidos");
  revalidatePath("/fixture");
  revalidatePath("/admin/jornadas");
  return { ok: true };
}

export async function extendReadyWindowFormAction(formData: FormData): Promise<void> {
  "use server";
  const r = await extendReadyWindowAction(formData);
  if (!r.ok) throw new Error(r.error ?? "Error al extender la ventana.");
}

/**
 * Inicia la ventana de comodines después del sorteo.
 * Cambia status de "lineup" a "comodin_window" y registra el timestamp.
 */
export async function startComodinWindowAction(matchId: string, fd: FormData): Promise<void> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("No autorizado.");
  }

  const { error } = await supabase
    .from("match")
    .update({
      status: "comodin_window",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) throw new Error(`DB error: ${error.message}`);

  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath(`/partido/${matchId}`);
  revalidatePath("/mis-partidos");
}

/**
 * Cierra la ventana de comodines y comienza la partida.
 */
export async function startMatchAction(matchId: string, fd: FormData): Promise<void> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("No autorizado.");
  }

  // Marcar el primer match_game como in_progress
  const { data: games } = (await supabase
    .from("match_game")
    .select("id, status")
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })) as { data: any[] };

  const pendingGame = games?.find((g: any) => g.status === "lineup" || g.status === "pending");
  if (pendingGame) {
    await supabase
      .from("match_game")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingGame.id);
  }

  const { error } = await supabase
    .from("match")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);

  if (error) throw new Error(`DB error: ${error.message}`);

  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath(`/partido/${matchId}`);
  revalidatePath("/mis-partidos");
}
