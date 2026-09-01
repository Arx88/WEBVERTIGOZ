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

export async function requireAdminAccount() {
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
  // Asignación de civ por jugador (flujo real = tutorial):
  // { player_registration_id: civ_id }
  const civAssignJson = String(formData.get("civ_assignment") ?? "{}");
  let civAssignment: Record<string, string>;
  try { civAssignment = JSON.parse(civAssignJson); } catch { return { ok: false, error: "civ_assignment inválido." } }

  // Resolve account → team_registration del capitán
  const { data: account } = (await supabase.from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account) return { ok: false, error: "Cuenta no encontrada." };

  const { data: teamAccount } = (await supabase.from("team_account").select("id").eq("owner_id", account.id).order("created_at", { ascending: false }).limit(1).maybeSingle()) as { data: any };
  if (!teamAccount) return { ok: false, error: "No tenés equipo." };

  // match_game + match
  const { data: game } = (await supabase
    .from("match_game")
    .select("id, match_id, status, player_mode, civs_a, civs_b, match:match_id(team_a_id, team_b_id, status, anular_used_by_team_id)")
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

  // Comodines que afectan el lineup (validación server-side):
  // - ANULAR ejecutado → los jugadores objetivo NO pueden ser declarados.
  // - ELEGIR RIVAL ejecutado por el rival → el jugador objetivo DEBE jugar.
  const serviceCtx = getSupabaseServiceRole() as any;
  const { data: comodinEffects } = (await serviceCtx
    .from("comodin_usage")
    .select("comodin_type, target_player_id, match_id, comodin_inventory_id, status")
    .eq("match_id", game.match_id)
    .eq("status", "executed")
    .in("comodin_type", ["anular", "elegir_rival"])) as { data: any };

  let myPlayerIds: string[] = [];
  {
    const { data: myPlayersList } = (await supabase
      .from("player_registration")
      .select("id")
      .eq("team_registration_id", myReg.id)) as { data: any };
    myPlayerIds = (myPlayersList ?? []).map((p: any) => p.id);
  }
  const myPlayerSet = new Set(myPlayerIds);

  // Resolver a qué team pertenece cada usage (vía inventario → team_registration)
  const invIds = [...new Set((comodinEffects ?? []).map((u: any) => u.comodin_inventory_id).filter(Boolean))];
  let invToReg: Record<string, string> = {};
  if (invIds.length > 0) {
    const { data: invs } = (await serviceCtx.from("comodin_inventory").select("id, team_registration_id").in("id", invIds)) as { data: any };
    for (const inv of invs ?? []) invToReg[inv.id] = inv.team_registration_id;
  }

  for (const u of comodinEffects ?? []) {
    const usedByTeam = invToReg[u.comodin_inventory_id] ?? null;
    const target = u.target_player_id;
    if (!target) continue;
    if (u.comodin_type === "anular" && target && myPlayerSet.has(target) && playerIds.includes(target)) {
      return { ok: false, error: "Uno de los jugadores elegidos fue ANULADO por el rival y no puede jugar esta llave." };
    }
    if (u.comodin_type === "elegir_rival" && myPlayerSet.has(target) && usedByTeam && usedByTeam !== myReg.id) {
      // El rival forzó a uno de mis jugadores: tiene que estar en el lineup
      if (!playerIds.includes(target)) {
        return { ok: false, error: "El rival usó ELEGIR RIVAL: uno de tus jugadores tiene que jugar esta llave obligatoriamente." };
      }
    }
  }

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

  // Validar la asignación de civs (flujo real = tutorial): exactamente una civ
  // por jugador declarado, del pool sorteado para mi equipo, sin repetir.
  const myCivs: string[] = (isTeamA ? game.civs_a : game.civs_b) ?? [];
  const assignEntries = Object.entries(civAssignment);
  if (playerIds.length > 0) {
    if (assignEntries.length !== playerIds.length) {
      return { ok: false, error: "Cada jugador declarado necesita su civ asignada." };
    }
    const usedCivs = new Set<string>();
    for (const [pid, civ] of assignEntries) {
      if (!playerIds.includes(pid)) return { ok: false, error: "Hay una civ asignada a un jugador fuera del lineup." };
      if (!myCivs.includes(String(civ))) return { ok: false, error: `La civ elegida no está en el pool sorteado para tu equipo.` };
      if (usedCivs.has(String(civ))) return { ok: false, error: "No se puede asignar la misma civ dos veces." };
      usedCivs.add(String(civ));
    }
  }

  // Escribir lineup + asignación de civs en el lado correcto.
  // Service role: RLS de match_game solo permite escritura admin; la
  // validación de participación ya se hizo arriba con la sesión del capitán.
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  update[isTeamA ? "lineup_a" : "lineup_b"] = playerIds;
  update[isTeamA ? "civ_assignment_a" : "civ_assignment_b"] = civAssignment;
  const { error } = await serviceCtx.from("match_game").update(update).eq("id", matchGameId);
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
  // Service role: RLS de match solo permite escritura admin; la validación
  // de participación ya se hizo arriba con la sesión del capitán.
  const service = getSupabaseServiceRole() as any;
  await service.from("match").update({ [field]: now, updated_at: now }).eq("id", matchId);

  // Si ambos confirmaron → comodin_window + comodin_window_expires_at = now + 5 min
  const { data: fresh } = (await service.from("match").select("ready_lineup_a_at, ready_lineup_b_at").eq("id", matchId).single()) as { data: any };
  if (fresh?.ready_lineup_a_at && fresh?.ready_lineup_b_at) {
    const windowMinutes = 5;
    const expiresAt = new Date(Date.now() + windowMinutes * 60 * 1000).toISOString();
    await service.from("match").update({
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

  const { data: match } = (await supabase.from("match").select("id, status, team_a_id, team_b_id, comodin_window_expires_at").eq("id", matchId).single()) as { data: any };
  if (!match) return { ok: false, error: "Match no encontrado." };
  if (match.status !== "comodin_window") return { ok: false, error: "La ventana de comodines está cerrada." };
  if (match.comodin_window_expires_at && new Date(match.comodin_window_expires_at).getTime() < Date.now()) {
    return { ok: false, error: "La ventana de comodines ya expiró." };
  }

  const { data: myReg } = (await supabase.from("team_registration").select("id").eq("team_account_id", teamAccount.id).in("id", [match.team_a_id, match.team_b_id]).maybeSingle()) as { data: any };
  if (!myReg) return { ok: false, error: "Tu equipo no participa." };

  // Inventario (service role: bypass RLS para lecturas cruzadas de comodines)
  const service = getSupabaseServiceRole() as any;

  // ANULAR / ELEGIR RIVAL requieren un jugador objetivo del RIVAL
  if (comodinType === "anular" || comodinType === "elegir_rival") {
    if (!targetPlayerId) return { ok: false, error: "Elegí el jugador rival objetivo." };
    const rivalRegId = myReg.id === match.team_a_id ? match.team_b_id : match.team_a_id;
    if (!rivalRegId) return { ok: false, error: "El match no tiene rival definido." };
    const { data: targetPlayer } = (await service
      .from("player_registration")
      .select("id, team_registration_id")
      .eq("id", targetPlayerId).maybeSingle()) as { data: any };
    if (!targetPlayer || targetPlayer.team_registration_id !== rivalRegId) {
      return { ok: false, error: "El jugador objetivo debe pertenecer al equipo rival." };
    }
    // ANULAR ya ejecutado sobre ese jugador → no se puede anular dos veces
    if (comodinType === "anular") {
      const { data: already } = (await service
        .from("comodin_usage")
        .select("id")
        .eq("match_id", matchId)
        .eq("comodin_type", "anular")
        .eq("target_player_id", targetPlayerId)
        .eq("status", "executed")
        .maybeSingle()) as { data: any };
      if (already) return { ok: false, error: "Ese jugador ya fue anulado en esta llave." };
    }
  }

  // Inventario disponible
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
 * El CAPITÁN usa un comodín y el efecto se aplica AL INSTANTE — sin paso por
 * el admin. El admin solo inicia sorteos y streamea; el overlay refleja el
 * comodín en vivo (carta épica) leyendo el usage ya "executed".
 *
 * Validaciones (espejo de requestComodinAction + executeComodinAction):
 *  - match en comodin_window y ventana no expirada
 *  - comodín de inventario propio con usos disponibles
 *  - exclusión mutua anular↔elegir_rival en la llave
 *  - ANULAR: objetivo del rival, no anulado antes
 *  - REROLL: fase objetivo + sorteo de la partida activa
 */
export async function useComodinAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
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

  const { data: match } = (await supabase.from("match").select("id, status, team_a_id, team_b_id, comodin_window_expires_at").eq("id", matchId).single()) as { data: any };
  if (!match) return { ok: false, error: "Match no encontrado." };
  if (match.status !== "comodin_window") return { ok: false, error: "La ventana de comodines está cerrada." };
  if (match.comodin_window_expires_at && new Date(match.comodin_window_expires_at).getTime() < Date.now()) {
    return { ok: false, error: "La ventana de comodines ya expiró." };
  }

  const { data: myReg } = (await supabase.from("team_registration").select("id").eq("team_account_id", teamAccount.id).in("id", [match.team_a_id, match.team_b_id]).maybeSingle()) as { data: any };
  if (!myReg) return { ok: false, error: "Tu equipo no participa." };

  const service = getSupabaseServiceRole() as any;

  // ANULAR / ELEGIR RIVAL: el objetivo debe ser del rival
  if (comodinType === "anular" || comodinType === "elegir_rival") {
    if (!targetPlayerId) return { ok: false, error: "Elegí el jugador rival objetivo." };
    const rivalRegId = myReg.id === match.team_a_id ? match.team_b_id : match.team_a_id;
    if (!rivalRegId) return { ok: false, error: "El match no tiene rival definido." };
    const { data: targetPlayer } = (await service
      .from("player_registration")
      .select("id, team_registration_id")
      .eq("id", targetPlayerId).maybeSingle()) as { data: any };
    if (!targetPlayer || targetPlayer.team_registration_id !== rivalRegId) {
      return { ok: false, error: "El jugador objetivo debe pertenecer al equipo rival." };
    }
    if (comodinType === "anular") {
      const { data: already } = (await service
        .from("comodin_usage")
        .select("id")
        .eq("match_id", matchId)
        .eq("comodin_type", "anular")
        .eq("target_player_id", targetPlayerId)
        .eq("status", "executed")
        .maybeSingle()) as { data: any };
      if (already) return { ok: false, error: "Ese jugador ya fue anulado en esta llave." };
    }
  }

  // Inventario disponible
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

  // REROLL: fase objetivo obligatoria + partida con sorteo
  let gameForReroll: any = null;
  if (comodinType === "reroll") {
    if (!targetPhase) return { ok: false, error: "Elegí qué fase re-girar." };
    const { data: game } = (await service
      .from("match_game")
      .select("id, game_number, draw_id")
      .eq("id", matchGameId ?? "").maybeSingle()) as { data: any };
    if (!game?.draw_id) return { ok: false, error: "Esta partida no tiene sorteo para re-girar." };
    gameForReroll = game;
  }

  // ── Aplicar el EFECTO primero: si falla, no se registra ni descuenta nada.
  let appliedPayload: any = null;
  if (comodinType === "reroll") {
    const r = await rerollDrawPhaseInternal(service, matchId, gameForReroll.game_number, targetPhase!, account.id);
    if (!r.ok) return { ok: false, error: r.error };
    appliedPayload = r.applied ?? null;
  }
  if (comodinType === "anular" || comodinType === "elegir_rival") {
    appliedPayload = await applyAnularElegirEffect(service, matchId, myReg.id, comodinType, targetPlayerId!);
    if (!appliedPayload) return { ok: false, error: "No se pudo aplicar el comodín." };
  }

  // Insertar el usage YA EJECUTADO (el capitán lo ejecutó al instante).
  const { data: usage, error: insertErr } = (await service
    .from("comodin_usage")
    .insert({
      comodin_inventory_id: inv.id,
      match_id: matchId,
      match_game_id: matchGameId,
      comodin_type: comodinType,
      target_phase: targetPhase,
      target_player_id: targetPlayerId,
      status: "executed",
      executed_at: new Date().toISOString(),
      executed_by_account_id: account.id,
      result_payload: appliedPayload,
      notes,
    })
    .select("id")
    .single()) as { data: any; error: any };
  if (insertErr || !usage) return { ok: false, error: insertErr?.message ?? "No se pudo registrar el comodín." };

  // Descontar inventario (CHECK >= 0 de la migración evita negativos)
  const { error: invErr } = await service.rpc("exec_sql", {
    query: `UPDATE comodin_inventory SET ${field} = ${field} - 1, updated_at = now() WHERE id = '${inv.id}' AND ${field} > 0;`,
  });
  if (invErr) return { ok: false, error: `No se pudo descontar el inventario: ${invErr.message}` };

  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/mis-partidos`);
  revalidatePath(`/admin/partido/${matchId}`);
  return { ok: true };
}

/**
 * Efecto de ANULAR / ELEGIR RIVAL sobre el match + lineups ya declarados.
 * Compartido por executeComodinAction (admin) y useComodinAction (capitán).
 * Marca el flag de la llave, toca el lineup de la partida activa y, si el
 * lineup queda inválido, re-abre la declaración (status lineup + READY a null).
 * Devuelve el payload para el log del usage (o null si no pudo aplicarse).
 */
async function applyAnularElegirEffect(
  service: any,
  matchId: string,
  requesterRegId: string,
  comodinType: string,
  targetPlayerId: string
): Promise<any | null> {
  const { data: match } = (await service.from("match").select("id, team_a_id, team_b_id").eq("id", matchId).single()) as { data: any };
  if (!match) return null;
  const targetRegId = requesterRegId === match.team_a_id ? match.team_b_id : match.team_a_id;

  const { data: targetPlayer } = (await service
    .from("player_registration")
    .select("id, team_registration_id, display_name")
    .eq("id", targetPlayerId).maybeSingle()) as { data: any };
  if (!targetPlayer || targetPlayer.team_registration_id !== targetRegId) return null;

  // Marcar en el match (mutuamente excluyentes a nivel llave)
  const matchFlag = comodinType === "anular" ? "anular_used_by_team_id" : "elegir_rival_used_by_team_id";
  await service.from("match").update({ [matchFlag]: requesterRegId, updated_at: new Date().toISOString() }).eq("id", matchId);

  // Si el equipo objetivo YA declaró lineup para la partida activa, aplicar
  // el efecto: ANULAR saca al jugador del lineup; ELEGIR RIVAL obliga a que
  // el forzado juegue. Si el lineup queda incompleto/inválido, el match
  // vuelve a "lineup" y el rival debe re-declarar (se re-cierra con READY #2).
  const { data: games } = (await service
    .from("match_game")
    .select("id, lineup_a, lineup_b, player_mode")
    .eq("match_id", matchId)
    .order("game_number", { ascending: false })) as { data: any };
  const activeGame = (games ?? [])[0];
  let needsRedeclare = false;
  if (activeGame) {
    const targetIsA = match.team_a_id === targetRegId;
    const lineupCol = targetIsA ? "lineup_a" : "lineup_b";
    const lineup = ((activeGame[lineupCol] ?? []) as string[]);

    if (comodinType === "anular" && lineup.includes(targetPlayerId)) {
      await service.from("match_game").update({ [lineupCol]: lineup.filter((id) => id !== targetPlayerId), updated_at: new Date().toISOString() }).eq("id", activeGame.id);
      const remaining = lineup.filter((id) => id !== targetPlayerId);
      const needed = playersNeededForMode(activeGame.player_mode);
      if (needed > 0 && remaining.length < needed) needsRedeclare = true;
    }
    if (comodinType === "elegir_rival" && lineup.length > 0 && !lineup.includes(targetPlayerId)) {
      // El lineup declarado no incluye al jugador forzado → hay que re-declarar
      needsRedeclare = true;
    }

    if (needsRedeclare) {
      // OJO: el READY que se resetea es el del equipo AFECTADO (target).
      await service.from("match").update({ status: "lineup", [targetIsA ? "ready_lineup_a_at" : "ready_lineup_b_at"]: null, updated_at: new Date().toISOString() }).eq("id", matchId);
    }
  }

  return comodinType === "anular"
    ? { type: "anular", anulado: targetPlayer.display_name, team: targetRegId, needsRedeclare }
    : { type: "elegir_rival", forzado: targetPlayer.display_name, team: targetRegId, needsRedeclare };
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

  // ANULAR / ELEGIR RIVAL: efecto sobre el match + lineups ya declarados
  if (usage.comodin_type === "anular" || usage.comodin_type === "elegir_rival") {
    if (!usage.target_player_id) return { ok: false, error: "Falta el jugador objetivo." };

    // Qué equipo lo pidió (vía inventario)
    const { data: inv } = (await service.from("comodin_inventory").select("team_registration_id").eq("id", usage.comodin_inventory_id).single()) as { data: any };
    const requesterRegId = inv?.team_registration_id ?? null;
    if (!requesterRegId) return { ok: false, error: "No se pudo resolver el equipo que pidió el comodín." };

    const applied = await applyAnularElegirEffect(service, usage.match_id, requesterRegId, usage.comodin_type, usage.target_player_id);
    if (!applied) return { ok: false, error: "El jugador objetivo no pertenece al equipo rival." };
    appliedPayload = applied;
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
 * Núcleo del reporte de resultado de UNA partida (game), compartido por
 * el formulario del admin (reportGameResultAction) y el watcher de AoE2
 * Companion (match-sync). Lógica BO3 automática:
 *  - BO1: terminar el match directamente.
 *  - BO3 2-0: terminar el match.
 *  - BO3 1-1: no terminar; queda pendiente la partida decisiva (P3), que el admin
 *    sorteará de nuevo (sin fase LLAVE).
 */
export async function reportGameResultInternal(
  service: any,
  params: { matchGameId: string; winnerTeamId: string; replayUrl?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const { matchGameId, winnerTeamId, replayUrl = null } = params;

  const { data: game } = (await service
    .from("match_game")
    .select("id, match_id, game_number, status, match:match_id(id, team_a_id, team_b_id, format, score_a, score_b, status)")
    .eq("id", matchGameId).single()) as { data: any };
  if (!game) return { ok: false, error: "Partida no encontrada." };
  const match = game.match;
  if (!match) return { ok: false, error: "Match padre no encontrado." };
  if (game.status === "finished") return { ok: false, error: "Esta partida ya tiene resultado cargado." };
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
  const { error: scoreErr } = await service.from("match").update({ score_a: newScoreA, score_b: newScoreB, updated_at: new Date().toISOString() }).eq("id", match.id);
  if (scoreErr) return { ok: false, error: `No se pudo actualizar el score: ${scoreErr.message}` };

  // Decidir si el match terminó
  const format = match.format ?? "BO1";
  const winsNeeded = format === "BO3" ? 2 : 1;
  const matchFinished = newScoreA >= winsNeeded || newScoreB >= winsNeeded;

  if (matchFinished) {
    const winnerTeam = newScoreA > newScoreB ? match.team_a_id : match.team_b_id;
    const { error: finErr } = await service.from("match").update({
      status: "finished",
      winner_team_id: winnerTeam,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", match.id);
    if (finErr) return { ok: false, error: `No se pudo finalizar el match: ${finErr.message}` };
    // El trigger propagate_match_winner (DB) se encarga de avanzar el ganador.
  } else {
    // 1-1 en BO3: crear la partida decisiva (P3) en pending, lista para sortear
    const { data: existing } = (await service.from("match_game").select("id").eq("match_id", match.id).eq("game_number", game.game_number + 1).maybeSingle()) as { data: any };
    if (!existing) {
      const { error: insErr } = await service.from("match_game").insert({ match_id: match.id, game_number: game.game_number + 1, status: "pending" });
      if (insErr) return { ok: false, error: `No se pudo crear la próxima partida: ${insErr.message}` };
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

/**
 * Admin reporta el ganador de UNA partida (game) vía formulario.
 * Wrapper de auth + formData sobre reportGameResultInternal.
 */
export async function reportGameResultAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireAdminAccount();
  const matchGameId = String(formData.get("match_game_id") ?? "").trim();
  const winnerTeamId = String(formData.get("winner_team_id") ?? "").trim();
  const replayUrl = String(formData.get("replay_url") ?? "").trim() || null;
  if (!matchGameId || !winnerTeamId) return { ok: false, error: "Faltan campos." };

  const service = getSupabaseServiceRole() as any;
  return reportGameResultInternal(service, { matchGameId, winnerTeamId, replayUrl });
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
  revalidatePath(`/partido/${matchId}`);
  revalidatePath("/mis-partidos");
  revalidatePath("/admin/bracket");
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

/** El capitán USA un comodín (se ejecuta al instante, sin paso por admin). */
export async function useComodinFormAction(formData: FormData): Promise<void> {
  const r = await useComodinAction(formData); if (!r.ok) throw new Error(r.error ?? "Error");
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
