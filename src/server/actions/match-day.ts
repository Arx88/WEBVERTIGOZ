"use server";

/**
 * VÉRTIGO Cup — Acciones del día de partido (match-day).
 *
 * Flujo completo de una llave:
 *   scheduled → (READY #1: ya existe) → open → startDraw (drawing)
 *   → lineup (declararLineup) → READY #2 (confirmarLineupReady)
 *   → comodin_window (5 min) → usarComodin / ejecutarComodin
 *   → in_progress → reportGameResult (por game, BO3) → finalizeMatch
 *   → finished → (trigger propaga ganador) | disputed → disputed
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { startDrawAction, rerollDrawPhaseAction, rerollDrawPhaseInternal } from "./tournament";

async function requireAdminAccount() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) throw new Error("Sin permisos de admin.");
  return { supabase, account };
}

// ─────────────────────────────────────────────────────────────
// Wrappers form-compatible para el admin (retornan void)
// ─────────────────────────────────────────────────────────────

export async function startDrawFormAction(formData: FormData): Promise<void> {
  const r = await startDrawAction(formData);
  if (!r.ok) throw new Error(r.error ?? "No se pudo iniciar el sorteo.");
}

export async function rerollDrawPhaseFormAction(formData: FormData): Promise<void> {
  const r = await rerollDrawPhaseAction(formData);
  if (!r.ok) throw new Error(r.error ?? "No se pudo re-girar.");
}

// ─────────────────────────────────────────────────────────────
// Lineup (declaración de quién juega) — por el CAPITÁN
// ─────────────────────────────────────────────────────────────

/**
 * El capitán declara el lineup de su equipo para una partida.
 * - Solo si el match está en status "lineup" y la partida corresponde.
 * - Valida que la cantidad de jugadores matchee el formato sorteado.
 * - Valida que los jugadores pertenezcan al equipo y no estén anulados.
 */
export async function declareLineupAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const matchGameId = String(formData.get("match_game_id") ?? "").trim();
  if (!matchGameId) return { ok: false, error: "Falta match_game_id." };
  const playerIdsJson = String(formData.get("player_ids") ?? "[]");
  let playerIds: string[];
  try { playerIds = JSON.parse(playerIdsJson); } catch { return { ok: false, error: "player_ids inválido." } }

  // Resolve account → team_registration del capitán
  const { data: account } = (await supabase.from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account) return { ok: false, error: "Cuenta no encontrada." };

  const { data: teamAccount } = (await supabase.from("team_account").select("id").eq("owner_id", account.id).order("created_at", { ascending: false }).limit(1).maybeSingle()) as { data: any };
  if (!teamAccount) return { ok: false, error: "No tenés equipo." };

  // match_game + match
  const { data: game } = (await supabase
    .from("match_game")
    .select("id, match_id, status, player_mode, match:match_id(team_a_id, team_b_id, status, anular_used_by_team_id)")
    .eq("id", matchGameId).single()) as { data: any };
  if (!game) return { ok: false, error: "Partida no encontrada." };
  if (game.match?.status !== "lineup") return { ok: false, error: `El match no está en fase de lineup (estado: ${game.match?.status}).` };

  // Mi team_registration en este match
  const { data: myReg } = (await supabase
    .from("team_registration")
    .select("id")
    .eq("team_account_id", teamAccount.id)
    .in("id", [game.match.team_a_id, game.match.team_b_id])
    .maybeSingle()) as { data: any };
  if (!myReg) return { ok: false, error: "Tu equipo no participa de este partido." };

  const isTeamA = game.match.team_a_id === myReg.id;

  // Cuántos jugadores se esperan según formato
  const expected = playersNeededForMode(game.player_mode);
  if (expected > 0 && playerIds.length !== expected) {
    return { ok: false, error: `Este formato requiere exactamente ${expected} jugador(es).` };
  }

  // Validar que los jugadores pertenecen a mi equipo
  const { data: validPlayers } = (await supabase
    .from("player_registration")
    .select("id")
    .eq("team_registration_id", myReg.id)
    .in("id", playerIds)) as { data: any };
  if ((validPlayers?.length ?? 0) !== playerIds.length) {
    return { ok: false, error: "Alguno de los jugadores elegidos no pertenece a tu equipo." };
  }

  // Escribir lineup en el lado correcto
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  update[isTeamA ? "lineup_a" : "lineup_b"] = playerIds;
  const { error } = await supabase.from("match_game").update(update).eq("id", matchGameId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/partido/${game.match_id}`);
  revalidatePath(`/mis-partidos`);
  return { ok: true };
}

/**
 * READY #2: ambos equipos confirman lineup completo.
 * Cuando ambos confirmaron, el match pasa a comodin_window (5 min).
 */
export async function confirmLineupReadyAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!matchId) return { ok: false, error: "Falta match_id." };

  const { data: account } = (await supabase.from("account").select("id").eq("supabase_auth_id", user.id).single()) as { data: any };
  const { data: teamAccount } = (await supabase.from("team_account").select("id").eq("owner_id", account.id).maybeSingle()) as { data: any };
  if (!teamAccount) return { ok: false, error: "Sin equipo." };

  const { data: match } = (await supabase
    .from("match")
    .select("id, status, team_a_id, team_b_id, ready_lineup_a_at, ready_lineup_b_at")
    .eq("id", matchId).single()) as { data: any };
  if (!match) return { ok: false, error: "Match no encontrado." };
  if (match.status !== "lineup") return { ok: false, error: `El match no está en lineup (estado: ${match.status}).` };

  const { data: myReg } = (await supabase.from("team_registration").select("id").eq("team_account_id", teamAccount.id).in("id", [match.team_a_id, match.team_b_id]).maybeSingle()) as { data: any };
  if (!myReg) return { ok: false, error: "Tu equipo no participa de este match." };

  const isTeamA = match.team_a_id === myReg.id;
  const now = new Date().toISOString();
  const field = isTeamA ? "ready_lineup_a_at" : "ready_lineup_b_at";
  await supabase.from("match").update({ [field]: now, updated_at: now }).eq("id", matchId);

  // Si ambos confirmaron → comodin_window + comodin_window_expires_at = now + 5 min
  const { data: fresh } = (await supabase.from("match").select("ready_lineup_a_at, ready_lineup_b_at").eq("id", matchId).single()) as { data: any };
  if (fresh?.ready_lineup_a_at && fresh?.ready_lineup_b_at) {
    const windowMinutes = 5;
    const expiresAt = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
    await supabase.from("match").update({
      status: "comodin_window",
      comodin_window_expires_at: expiresAt,
      updated_at: now,
    }).eq("id", matchId);
  }

  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/mis-partidos`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Comodines (solicitar + ejecutar)
// ─────────────────────────────────────────────────────────────

/**
 * El capitán SOLICITA usar un comodín. Queda en status "pending" para que
 * el admin lo ejecute (control de stream). No descuenta el inventario todavía.
 */
export async function requestComodinAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const matchId = String(formData.get("match_id") ?? "").trim();
  const comodinType = String(formData.get("comodin_type") ?? "").trim();
  const targetPhase = String(formData.get("target_phase") ?? "").trim() || null;
  const targetPlayerId = String(formData.get("target_player_id") ?? "").trim() || null;
  const matchGameId = String(formData.get("match_game_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!matchId || !comodinType) return { ok: false, error: "Faltan campos." };

  const { data: account } = (await supabase.from("account").select("id").eq("supabase_auth_id", user.id).single()) as { data: any };
  const { data: teamAccount } = (await supabase.from("team_account").select("id").eq("owner_id", account.id).maybeSingle()) as { data: any };
  if (!teamAccount) return { ok: false, error: "Sin equipo." };

  const { data: match } = (await supabase.from("match").select("id, status, team_a_id, team_b_id").eq("id", matchId).single()) as { data: any };
  if (!match) return { ok: false, error: "Match no encontrado." };
  if (match.status !== "comodin_window") return { ok: false, error: "La ventana de comodines está cerrada." };

  const { data: myReg } = (await supabase.from("team_registration").select("id").eq("team_account_id", teamAccount.id).in("id", [match.team_a_id, match.team_b_id]).maybeSingle()) as { data: any };
  if (!myReg) return { ok: false, error: "Tu equipo no participa." };

  // Inventario
  const service = getSupabaseServiceRole() as any;
  const { data: inv } = (await service.from("comodin_inventory").select("id, reroll_available, anular_available, elegir_rival_available, invocar_pro_available").eq("team_registration_id", myReg.id).single()) as { data: any };
  if (!inv) return { ok: false, error: "Sin inventario de comodines." };

  const availableField: Record<string, string> = {
    reroll: "reroll_available",
    anular: "anular_available",
    elegir_rival: "elegir_rival_available",
    invocar_pro: "invocar_pro_available",
  };
  const field = availableField[comodinType];
  if (!field) return { ok: false, error: "Comodín inválido." };
  if ((inv[field] ?? 0) <= 0) return { ok: false, error: "No te quedan usos de este comodín." };

  // Mutua exclusión anular/elegir_rival por llave
  if (comodinType === "anular" || comodinType === "elegir_rival") {
    const otherType = comodinType === "anular" ? "elegir_rival" : "anular";
    const { data: otherUsed } = (await service
      .from("comodin_usage")
      .select("id")
      .eq("match_id", matchId)
      .eq("comodin_inventory_id", inv.id)
      .eq("comodin_type", otherType)
      .not("status", "in", ["cancelled", "revoked"])
      .maybeSingle()) as { data: any };
    if (otherUsed) return { ok: false, error: "Anular y Elegir rival son mutuamente excluyentes en la misma llave." };
  }

  // Crear usage en pending (el admin lo ejecuta)
  const { error } = await service.from("comodin_usage").insert({
    comodin_inventory_id: inv.id,
    match_id: matchId,
    match_game_id: matchGameId,
    comodin_type: comodinType,
    target_phase: targetPhase,
    target_player_id: targetPlayerId,
    status: "pending",
    notes,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/mis-partidos`);
  return { ok: true };
}

/**
 * Admin ejecuta un comodín solicitado: aplica su efecto (ej: re-girar fase,
 * anular jugador) y descuenta el inventario.
 */
export async function executeComodinAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { account } = await requireAdminAccount();
  const usageId = String(formData.get("comodin_usage_id") ?? "").trim();
  if (!usageId) return { ok: false, error: "Falta comodin_usage_id." };

  const service = getSupabaseServiceRole() as any;
  const { data: usage } = (await service
    .from("comodin_usage")
    .select("id, match_id, match_game_id, comodin_type, target_phase, target_player_id, status, comodin_inventory_id")
    .eq("id", usageId).single()) as { data: any };
  if (!usage) return { ok: false, error: "Uso no encontrado." };
  if (usage.status !== "pending") return { ok: false, error: `Este comodín ya está en estado "${usage.status}".` };

  // Aplicar efecto según tipo
  let appliedPayload: any = null;
  if (usage.comodin_type === "reroll" && usage.target_phase && usage.match_game_id) {
    const { data: game } = (await service.from("match_game").select("match_id, game_number").eq("id", usage.match_game_id).single()) as { data: any };
    const r = await rerollDrawPhaseInternal(service, game.match_id, game.game_number, usage.target_phase, account.id);
    if (!r.ok) return { ok: false, error: r.error };
    appliedPayload = r.applied ?? null;
  }

  // Descontar inventario de forma atómica (el CHECK >= 0 de la migración evita negativos)
  const fieldMap: Record<string, string> = { reroll: "reroll_available", anular: "anular_available", elegir_rival: "elegir_rival_available", invocar_pro: "invocar_pro_available" };
  const field = fieldMap[usage.comodin_type];
  const { error: invErr } = await service.rpc("exec_sql", {
    query: `UPDATE comodin_inventory SET ${field} = ${field} - 1, updated_at = now() WHERE id = '${usage.comodin_inventory_id}' AND ${field} > 0;`,
  });
  if (invErr) return { ok: false, error: `No se pudo descontar el inventario: ${invErr.message}` };

  // Marcar ejecutado
  const { error } = await service.from("comodin_usage").update({
    status: "executed",
    executed_at: new Date().toISOString(),
    executed_by_account_id: account.id,
    result_payload: appliedPayload,
  }).eq("id", usageId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/partido/${usage.match_id}`);
  revalidatePath(`/partido/${usage.match_id}`);
  return { ok: true };
}

/** Admin revoca un comodín solicitado (no se ejecuta, no se descuenta). */
export async function revokeComodinAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { account } = await requireAdminAccount();
  const usageId = String(formData.get("comodin_usage_id") ?? "").trim();
  if (!usageId) return { ok: false, error: "Falta comodin_usage_id." };
  const service = getSupabaseServiceRole() as any;
  const { data: usage } = (await service.from("comodin_usage").select("match_id, status").eq("id", usageId).single()) as { data: any };
  if (!usage) return { ok: false, error: "Uso no encontrado." };
  if (!["pending", "executing"].includes(usage.status)) return { ok: false, error: "Ya no se puede revocar." };
  const { error } = await service.from("comodin_usage").update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_account_id: account.id }).eq("id", usageId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/partido/${usage.match_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Fase transitions + resultado + finalización
// ─────────────────────────────────────────────────────────────

/** Admin: pasa el sorteo a fase lineup (los equipos ven el resultado y declaran). */
export async function advanceToLineupAction(matchId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminAccount();
  const service = getSupabaseServiceRole() as any;
  const { error } = await service.from("match").update({ status: "lineup", updated_at: new Date().toISOString() }).eq("id", matchId);
  await service.from("match_game").update({ status: "lineup", updated_at: new Date().toISOString() }).eq("match_id", matchId).eq("status", "drawing");
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
  return { ok: true };
}

/** Admin: cierra la ventana de comodines y comienza la partida. */
export async function closeComodinWindowAction(matchId: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdminAccount();
  const service = getSupabaseServiceRole() as any;
  const { error } = await service.from("match").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", matchId);
  await service.from("match_game").update({ status: "in_progress", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("match_id", matchId).in("status", ["lineup", "comodin_window", "drawing", "pending"]);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
  return { ok: true };
}

/**
 * Admin reporta el ganador de UNA partida (game).
 * Lógica BO3 automática:
 *  - BO1: terminar el match directamente.
 *  - BO3 2-0: terminar el match.
 *  - BO3 1-1: no terminar; queda pendiente la partida decisiva (P3), que el admin
 *    sorteará de nuevo (sin fase LLAVE).
 */
export async function reportGameResultAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { account } = await requireAdminAccount();
  const matchGameId = String(formData.get("match_game_id") ?? "").trim();
  const winnerTeamId = String(formData.get("winner_team_id") ?? "").trim();
  const replayUrl = String(formData.get("replay_url") ?? "").trim() || null;
  if (!matchGameId || !winnerTeamId) return { ok: false, error: "Faltan campos." };

  const service = getSupabaseServiceRole() as any;

  const { data: game } = (await service
    .from("match_game")
    .select("id, match_id, game_number, status, match:match_id(team_a_id, team_b_id, format, score_a, score_b, status)")
    .eq("id", matchGameId).single()) as { data: any };
  if (!game) return { ok: false, error: "Partida no encontrada." };
  const match = game.match;
  if (!match) return { ok: false, error: "Match padre no encontrado." };
  if (winnerTeamId !== match.team_a_id && winnerTeamId !== match.team_b_id) {
    return { ok: false, error: "El ganador debe ser uno de los dos equipos del match." };
  }

  // Marcar la partida como finalizada
  const { error: gErr } = await service
    .from("match_game")
    .update({ status: "finished", winner_team_id: winnerTeamId, finished_at: new Date().toISOString(), replay_url: replayUrl, updated_at: new Date().toISOString() })
    .eq("id", matchGameId);
  if (gErr) return { ok: false, error: gErr.message };

  // Recalcular score del match
  const isA = winnerTeamId === match.team_a_id;
  const newScoreA = match.score_a + (isA ? 1 : 0);
  const newScoreB = match.score_b + (isA ? 0 : 1);
  await service.from("match").update({ score_a: newScoreA, score_b: newScoreB, updated_at: new Date().toISOString() }).eq("id", match.id);

  // Decidir si el match terminó
  const format = match.format ?? "BO1";
  const winsNeeded = format === "BO3" ? 2 : 1;
  const matchFinished = newScoreA >= winsNeeded || newScoreB >= winsNeeded;

  if (matchFinished) {
    const winnerTeam = newScoreA > newScoreB ? match.team_a_id : match.team_b_id;
    await service.from("match").update({
      status: "finished",
      winner_team_id: winnerTeam,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", match.id);
    // El trigger propagate_match_winner (DB) se encarga de avanzar el ganador.
  } else {
    // 1-1 en BO3: crear la partida decisiva (P3) en pending, lista para sortear
    const { data: existing } = (await service.from("match_game").select("id").eq("match_id", match.id).eq("game_number", game.game_number + 1).maybeSingle()) as { data: any };
    if (!existing) {
      await service.from("match_game").insert({ match_id: match.id, game_number: game.game_number + 1, status: "pending" });
    }
    // El match se queda en "in_progress" esperando el próximo sorteo
    await service.from("match").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", match.id);
  }

  revalidatePath(`/partido/${match.id}`);
  revalidatePath(`/admin/partido/${match.id}`);
  revalidatePath("/admin/bracket");
  revalidatePath("/bracket");
  return { ok: true };
}

/** Admin: marcar forfeit por ausencia (ambos no confirmaron, o un equipo no se presentó). */
export async function markForfeitAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { account } = await requireAdminAccount();
  const matchId = String(formData.get("match_id") ?? "").trim();
  const absentTeamId = String(formData.get("absent_team_id") ?? "").trim();
  if (!matchId) return { ok: false, error: "Falta match_id." };
  const service = getSupabaseServiceRole() as any;
  const { data: match } = (await service.from("match").select("team_a_id, team_b_id").eq("id", matchId).single()) as { data: any };
  if (!match) return { ok: false, error: "Match no encontrado." };
  // El ganador es el OTRO equipo (si se especificó ausente) o se deja null
  const winner = absentTeamId
    ? (absentTeamId === match.team_a_id ? match.team_b_id : match.team_a_id)
    : null;
  const { error } = await service.from("match").update({
    status: "forfeit", winner_team_id: winner, finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", matchId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath("/bracket");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Cuántos jugadores se esperan por formato. 0 = libre. */
function playersNeededForMode(mode: string | null): number {
  switch (mode) {
    case "1v1": return 1;
    case "2v2": return 2;
    case "3v3": return 3;
    case "fusion": return 3; // los 3 manejan una civ — el lineup es el equipo completo
    default: return 0;
  }
}

// Wrappers <form>
export async function declareLineupFormAction(formData: FormData): Promise<void> {
  const r = await declareLineupAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
}
export async function confirmLineupReadyFormAction(formData: FormData): Promise<void> {
  const r = await confirmLineupReadyAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
}
export async function requestComodinFormAction(formData: FormData): Promise<void> {
  const r = await requestComodinAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
}
export async function executeComodinFormAction(formData: FormData): Promise<void> {
  const r = await executeComodinAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
}
export async function revokeComodinFormAction(formData: FormData): Promise<void> {
  const r = await revokeComodinAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
}
export async function reportGameResultFormAction(formData: FormData): Promise<void> {
  const r = await reportGameResultAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
}
export async function markForfeitFormAction(formData: FormData): Promise<void> {
  const r = await markForfeitAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
}
