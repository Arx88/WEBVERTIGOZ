"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

// ============================================================
// TIPOS
// ============================================================

export interface MatchStatusUpdate {
  matchId: string;
  status: string;
}

// ============================================================
// HELPER: Obtener match con sus games
// ============================================================

async function getMatchData(matchId: string) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: match } = (await supabase
    .from("match")
    .select(
      "id, status, round_id, slot_index, parent_match_a_id, parent_match_b_id, team_a_id, team_b_id, winner_team_id, format"
    )
    .eq("id", matchId)
    .single()) as { data: any };

  if (!match) return null;

  const { data: games } = (await supabase
    .from("match_game")
    .select("id, game_number, status, draw_id, lineup_a, lineup_b")
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })) as { data: any[] };

  return { match, games: games ?? [], supabase };
}

// ============================================================
// HELPER: Verificar que el match puede cambiar de estado
// ============================================================

function assertStatus(current: string, expected: string | string[], action: string): void {
  const expectedArr = Array.isArray(expected) ? expected : [expected];
  if (!expectedArr.includes(current)) {
    throw new Error(
      `No se puede ${action}: el match está en status='${current}', esperaba '${expectedArr.join("' o '")}'`
    );
  }
}

// ============================================================
// 1. OPEN MATCH — scheduled → open
// ============================================================

/**
 * Abre un match para sorteo (scheduled → open).
 * Solo se puede abrir si tiene ambos teams asignados.
 */
export async function openMatch(
  matchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin();
    if (!admin) return { ok: false, error: "No autorizado." };

    const data = await getMatchData(matchId);
    if (!data) return { ok: false, error: "Match no encontrado." };
    const { match, games, supabase } = data;

    assertStatus(match.status, "scheduled", "abrir");

    if (!match.team_a_id || !match.team_b_id) {
      return { ok: false, error: "El match no tiene ambos equipos asignados." };
    }

    // Asegurar que existan los match_games (crear el game_number=1 si no existe)
    if (games.length === 0) {
      await supabase.from("match_game").insert({
        match_id: matchId,
        game_number: 1,
        status: "pending",
      });
    }

    const { error } = await supabase
      .from("match")
      .update({
        status: "open",
        ready_a_at: new Date().toISOString(),
        ready_b_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (error) return { ok: false, error: `DB error: ${error.message}` };

    revalidatePath(`/admin/partido/${matchId}`);
    revalidatePath(`/partido/${matchId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ============================================================
// 2. SET LINEUP — guarda el lineup de un equipo
// ============================================================

/**
 * Guarda el lineup declarado por un equipo (post-sorteo).
 * Va en match_game.lineup_a o lineup_b según teamId.
 *
 * @param matchId ID del match
 * @param teamId ID del team_registration
 * @param playerIds Array de player_registration_id (1, 2, o 3 según playerMode)
 */
export async function setLineup(
  matchId: string,
  teamId: string,
  playerIds: string[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin();
    if (!admin) return { ok: false, error: "No autorizado." };

    const data = await getMatchData(matchId);
    if (!data) return { ok: false, error: "Match no encontrado." };
    const { match, games, supabase } = data;

    // El match debe estar en estado lineup o comodin_window
    assertStatus(match.status, ["lineup", "comodin_window", "open", "drawing"], "declarar lineup");

    // Validar que el teamId sea uno de los dos del match
    if (teamId !== match.team_a_id && teamId !== match.team_b_id) {
      return { ok: false, error: "El teamId no corresponde a este match." };
    }

    // Validar que los playerIds pertenezcan al team
    const { data: players } = (await supabase
      .from("player_registration")
      .select("id, team_registration_id")
      .in("id", playerIds)) as { data: any[] };

    if (!players || players.length !== playerIds.length) {
      return { ok: false, error: "Algunos playerIds no existen." };
    }

    const invalidPlayers = players.filter((p) => p.team_registration_id !== teamId);
    if (invalidPlayers.length > 0) {
      return { ok: false, error: "Algunos jugadores no pertenecen a este equipo." };
    }

    // Tomar el primer match_game pendiente
    const pendingGame = games.find((g: any) => g.status === "pending" || g.status === "lineup");
    if (!pendingGame) {
      return { ok: false, error: "No hay match_game pendiente para declarar lineup." };
    }

    // Actualizar lineup_a o lineup_b
    const field = teamId === match.team_a_id ? "lineup_a" : "lineup_b";
    const { error } = await supabase
      .from("match_game")
      .update({
        [field]: playerIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pendingGame.id);

    if (error) return { ok: false, error: `DB error: ${error.message}` };

    // Marcar ready_lineup del team
    const readyField = teamId === match.team_a_id ? "ready_lineup_a_at" : "ready_lineup_b_at";
    await supabase
      .from("match")
      .update({
        [readyField]: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    revalidatePath(`/admin/partido/${matchId}`);
    revalidatePath(`/partido/${matchId}`);
    revalidatePath(`/mi-equipo`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ============================================================
// 3. START MATCH — lineup → in_progress
// ============================================================

/**
 * Inicia la partida (lineup → in_progress).
 * Requiere que ambos teams hayan declarado lineup.
 */
export async function startMatch(
  matchId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin();
    if (!admin) return { ok: false, error: "No autorizado." };

    const data = await getMatchData(matchId);
    if (!data) return { ok: false, error: "Match no encontrado." };
    const { match, games, supabase } = data;

    assertStatus(match.status, ["lineup", "comodin_window"], "iniciar");

    // Validar que ambos teams tengan lineup declarado
    if (!match.ready_lineup_a_at || !match.ready_lineup_b_at) {
      return { ok: false, error: "Faltan equipos por declarar lineup." };
    }

    // Marcar el primer match_game como in_progress
    const pendingGame = games.find((g: any) => g.status === "lineup" || g.status === "pending");
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

    if (error) return { ok: false, error: `DB error: ${error.message}` };

    revalidatePath(`/admin/partido/${matchId}`);
    revalidatePath(`/partido/${matchId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ============================================================
// 4. FINISH MATCH — in_progress → finished + advanceWinner automático
// ============================================================

/**
 * Finaliza el match (in_progress → finished) y avanza al ganador
 * automáticamente al próximo match del bracket.
 *
 * @param matchId ID del match
 * @param winnerTeamId ID del equipo ganador
 * @param scoreA Score final del team A
 * @param scoreB Score final del team B
 */
export async function finishMatch(
  matchId: string,
  winnerTeamId: string,
  scoreA: number,
  scoreB: number
): Promise<{ ok: true; nextMatchId?: string } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin();
    if (!admin) return { ok: false, error: "No autorizado." };

    const data = await getMatchData(matchId);
    if (!data) return { ok: false, error: "Match no encontrado." };
    const { match, supabase } = data;

    assertStatus(match.status, ["in_progress", "lineup", "comodin_window", "disputed"], "finalizar");

    // Validar que el ganador sea uno de los dos teams
    if (winnerTeamId !== match.team_a_id && winnerTeamId !== match.team_b_id) {
      return { ok: false, error: "El ganador no corresponde a este match." };
    }

    // Finalizar todos los match_games en progreso
    const now = new Date().toISOString();
    await supabase
      .from("match_game")
      .update({
        status: "finished",
        finished_at: now,
        updated_at: now,
        winner_team_id: winnerTeamId,
      })
      .eq("match_id", matchId)
      .in("status", ["in_progress", "lineup", "pending"]);

    // Finalizar el match
    const { error } = await supabase
      .from("match")
      .update({
        status: "finished",
        winner_team_id: winnerTeamId,
        score_a: scoreA,
        score_b: scoreB,
        finished_at: now,
        updated_at: now,
      })
      .eq("id", matchId);

    if (error) return { ok: false, error: `DB error: ${error.message}` };

    // Avanzar ganador al próximo match (si no es la final)
    const nextMatchId = await advanceWinnerToNextMatch(supabase, matchId, winnerTeamId);

    revalidatePath(`/admin/partido/${matchId}`);
    revalidatePath(`/partido/${matchId}`);
    revalidatePath(`/admin/bracket`);
    revalidatePath(`/bracket`);
    revalidatePath(`/equipos/${match.team_a_id}`);
    revalidatePath(`/equipos/${match.team_b_id}`);

    return { ok: true, nextMatchId: nextMatchId ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ============================================================
// HELPER: Avanzar ganador al próximo match
// ============================================================

/**
 * Lógica de avance del ganador al próximo match del bracket.
 * Busca el match cuyo parent_match_a_id o parent_match_b_id es el match actual,
 * y le asigna el winnerTeamId al slot correspondiente.
 */
async function advanceWinnerToNextMatch(
  supabase: any,
  finishedMatchId: string,
  winnerTeamId: string
): Promise<string | null> {
  // Buscar el match finalizado para obtener su slot_index
  const { data: finished } = (await supabase
    .from("match")
    .select("id, round_id, slot_index")
    .eq("id", finishedMatchId)
    .single()) as { data: any };

  if (!finished) return null;

  // Buscar el próximo match: el que tenga parent_match_a_id o parent_match_b_id = finishedMatchId
  const { data: nextMatch } = (await supabase
    .from("match")
    .select("id, parent_match_a_id, parent_match_b_id, team_a_id, team_b_id, status")
    .or(`parent_match_a_id.eq.${finishedMatchId},parent_match_b_id.eq.${finishedMatchId}`)
    .single()) as { data: any };

  if (!nextMatch) return null; // Era la final

  // Determinar slot
  const goesToSlotA = nextMatch.parent_match_a_id === finishedMatchId;
  const field = goesToSlotA ? "team_a_id" : "team_b_id";

  const { error } = await supabase
    .from("match")
    .update({
      [field]: winnerTeamId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nextMatch.id);

  if (error) {
    console.error("[advanceWinnerToNextMatch] error:", error);
    return null;
  }

  return nextMatch.id;
}

// ============================================================
// 5. CANCEL MATCH — * → cancelled
// ============================================================

/**
 * Cancela un match (cualquier estado → cancelled).
 * No avanza al rival (usar forfeitMatch si querés que el rival avance).
 */
export async function cancelMatch(
  matchId: string,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin();
    if (!admin) return { ok: false, error: "No autorizado." };

    const supabase = (await getSupabaseServer()) as any;
    const { error } = await supabase
      .from("match")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchId);

    if (error) return { ok: false, error: `DB error: ${error.message}` };

    // Log de auditoría (en draw_audit_log aunque no sea un sorteo, para tener trail)
    // TODO: en Fase 4 agregar tabla match_audit_log separada

    revalidatePath(`/admin/partido/${matchId}`);
    revalidatePath(`/partido/${matchId}`);
    revalidatePath(`/admin/bracket`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ============================================================
// 6. FORFEIT MATCH — * → forfeit + rival avanza
// ============================================================

/**
 * Marca un match como forfeit (W.O.) para un equipo.
 * El rival avanza automáticamente al próximo match.
 *
 * @param matchId ID del match
 * @param losingTeamId ID del equipo que pierde por W.O.
 */
export async function forfeitMatch(
  matchId: string,
  losingTeamId: string
): Promise<{ ok: true; nextMatchId?: string } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin();
    if (!admin) return { ok: false, error: "No autorizado." };

    const data = await getMatchData(matchId);
    if (!data) return { ok: false, error: "Match no encontrado." };
    const { match, supabase } = data;

    // Determinar ganador (el otro team)
    const winnerTeamId =
      losingTeamId === match.team_a_id ? match.team_b_id : match.team_a_id;

    if (!winnerTeamId) {
      return { ok: false, error: "No se puede determinar el ganador (falta un team)." };
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("match")
      .update({
        status: "forfeit",
        winner_team_id: winnerTeamId,
        score_a: losingTeamId === match.team_a_id ? 0 : 1,
        score_b: losingTeamId === match.team_b_id ? 0 : 1,
        finished_at: now,
        updated_at: now,
      })
      .eq("id", matchId);

    if (error) return { ok: false, error: `DB error: ${error.message}` };

    // Avanzar ganador al próximo match
    const nextMatchId = await advanceWinnerToNextMatch(supabase, matchId, winnerTeamId);

    revalidatePath(`/admin/partido/${matchId}`);
    revalidatePath(`/partido/${matchId}`);
    revalidatePath(`/admin/bracket`);
    revalidatePath(`/bracket`);

    return { ok: true, nextMatchId: nextMatchId ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

// ============================================================
// 7. MARK INVOCAR PRO USED — decrementa inventario del comodín
// ============================================================

/**
 * Marca el comodín INVOCAR PRO como usado para un equipo en un match.
 * Decrementa el inventario y registra el uso.
 *
 * La web no hace nada más al respecto — el admin lo marca manualmente.
 */
export async function markInvocarProUsed(
  matchId: string,
  teamId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = await requireAdmin();
    if (!admin) return { ok: false, error: "No autorizado." };

    const supabase = (await getSupabaseServer()) as any;

    // Buscar el comodin_inventory del team
    const { data: inventory } = (await supabase
      .from("comodin_inventory")
      .select("id, invocar_pro_available")
      .eq("team_registration_id", teamId)
      .single()) as { data: any };

    if (!inventory) {
      return { ok: false, error: "Inventario no encontrado para este equipo." };
    }

    if (inventory.invocar_pro_available <= 0) {
      return { ok: false, error: "El equipo no tiene INVOCAR PRO disponible." };
    }

    // Decrementar inventario
    const { error: invErr } = await supabase
      .from("comodin_inventory")
      .update({
        invocar_pro_available: inventory.invocar_pro_available - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", inventory.id);

    if (invErr) return { ok: false, error: `DB error: ${invErr.message}` };

    // Registrar el uso
    const { error: usageErr } = await supabase.from("comodin_usage").insert({
      comodin_inventory_id: inventory.id,
      match_id: matchId,
      comodin_type: "invocar_pro",
      executed_at: new Date().toISOString(),
    });

    if (usageErr) return { ok: false, error: `DB error: ${usageErr.message}` };

    revalidatePath(`/admin/partido/${matchId}`);
    revalidatePath(`/mi-equipo`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}
