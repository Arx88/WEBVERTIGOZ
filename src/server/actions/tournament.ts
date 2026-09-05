"use server";

/**
 * VÉRTIGO Cup — Acciones del ciclo de vida del torneo.
 *
 * Contiene la generación REAL del bracket (persistir bracket + rounds +
 * matches + match_games en una transacción), el avance del ganador (vía
 * trigger DB), y la publicación admin tools.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { generateBracket, BRACKET_SIZE, BRACKET_ROUNDS } from "@/lib/bracket/engine";
import { parseWallClockWithOffset } from "@/lib/tz";
import { notifyMatchCaptains } from "@/server/notify/notify-captains";
import { logAdminAction } from "@/lib/admin-audit";

// ============================================================
// Helpers de autorización
// ============================================================

async function requireAdminAccount() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("Sin permisos de administrador.");
  }
  return { supabase, account };
}

// ============================================================
// 1. Generar bracket REAL: persiste bracket + rounds + matches
//    + match_games (P1 por defecto) en una transacción.
// ============================================================

/**
 * Genera el bracket SE de 32 completo a partir de los 32 equipos aprobados.
 *
 * Precondiciones:
 * - Exactamente 32 team_registration con status="approved" y seed asignado (1..32).
 *
 * Estructura:
 * - 1 bracket (type=winner)
 * - 5 rounds (Ronda 1, Octavos, Cuartos, Semis, Final)
 * - 31 matches con parent_match_a_id/b_id correctamente vinculados
 * - R1: matches poblan team_a_id/team_b_id según seed snake
 * - Cada match trae 1 match_game P1 en status "pending"
 *
 * Idempotencia: si ya existe un bracket winner para la edición, error claro.
 * Usamos el service role para hacer la transacción (bypass RLS pero solo
 * dentro de una operación validada por requireAdminAccount).
 */
export async function generateRealBracketAction(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  created?: { brackets: number; rounds: number; matches: number; games: number };
}> {
  const { account } = await requireAdminAccount();
  const editionId = String(formData.get("edition_id") ?? "").trim();
  if (!editionId) return { ok: false, error: "Falta edition_id." };

  const service = getSupabaseServiceRole() as any;

  // Verificar que la edición existe
  const { data: edition, error: edErr } = await service
    .from("tournament_edition")
    .select("id, name, slug, status, max_teams")
    .eq("id", editionId)
    .single();
  if (edErr || !edition) return { ok: false, error: "Edición no encontrada." };

  // No regenerar si ya hay bracket
  const { data: existingBracket } = await service
    .from("bracket")
    .select("id")
    .eq("tournament_edition_id", editionId)
    .eq("type", "winner")
    .maybeSingle();
  if (existingBracket) {
    return { ok: false, error: "Ya existe un bracket para esta edición. Si querés regenerarlo, borralo primero." };
  }

  // Traer los 32 equipos aprobados con seed
  const { data: approved, error: apprErr } = await service
    .from("team_registration")
    .select("id, seed")
    .eq("tournament_edition_id", editionId)
    .eq("status", "approved")
    .not("seed", "is", null);
  if (apprErr) return { ok: false, error: `Error leyendo aprobados: ${apprErr.message}` };
  if (!approved || approved.length !== BRACKET_SIZE) {
    return {
      ok: false,
      error: `Se necesitan exactamente ${BRACKET_SIZE} equipos aprobados CON seed asignado. Encontrados: ${approved?.length ?? 0}.`,
    };
  }

  // Mapa seed → team_registration_id
  const seedToRegId = new Map<number, string>();
  for (const r of approved) {
    if (r.seed != null) seedToRegId.set(r.seed, r.id);
  }
  // Validar que tengamos seeds 1..32 completos
  for (let s = 1; s <= BRACKET_SIZE; s++) {
    if (!seedToRegId.has(s)) {
      return { ok: false, error: `Falta el equipo con seed ${s}. Asigná todos los seeds primero.` };
    }
  }

  // Generar la estructura del bracket (lógica pura, sin DB)
  const structure = generateBracket(BRACKET_SIZE);

  // ────────────────────────────────────────────────────────────
  // Transacción: crear bracket + rounds + matches + match_games
  // ────────────────────────────────────────────────────────────
  // Supabase JS no soporta transacciones multi-statement directamente,
  // así que lo hacemos en orden con rollback manual en caso de error.
  // Cada paso solo se ejecuta si el anterior fue exitoso.

  let bracketId: string | null = null;
  const createdRoundIds: string[] = [];
  const createdMatchIds: string[] = [];
  const createdGameIds: string[] = [];

  const cleanup = async () => {
    if (createdGameIds.length) await service.from("match_game").delete().in("id", createdGameIds);
    if (createdMatchIds.length) await service.from("match").delete().in("id", createdMatchIds);
    if (createdRoundIds.length) await service.from("round").delete().in("id", createdRoundIds);
    if (bracketId) await service.from("bracket").delete().eq("id", bracketId);
  };

  try {
    // 1) Crear bracket
    const { data: bracketRow, error: bErr } = await service
      .from("bracket")
      .insert({
        tournament_edition_id: editionId,
        type: "winner",
        rounds_count: BRACKET_ROUNDS,
      })
      .select("id")
      .single();
    if (bErr || !bracketRow) throw new Error(`bracket insert: ${bErr?.message ?? "sin id"}`);
    bracketId = bracketRow.id;

    // 2) Crear las 5 rounds
    const roundRows = structure.rounds.map((r) => ({
      bracket_id: bracketId,
      index: r.index,
      name: r.name,
    }));
    const { data: roundsCreated, error: rErr } = await service
      .from("round")
      .insert(roundRows)
      .select("id, index");
    if (rErr || !roundsCreated || roundsCreated.length !== structure.rounds.length) {
      throw new Error(`round insert: ${rErr?.message ?? "incompleto"}`);
    }
    for (const r of roundsCreated) createdRoundIds.push(r.id);
    const roundIdByIndex = new Map<number, string>(roundsCreated.map((r: any) => [r.index, r.id]));

    // 3) Crear los 31 matches
    //    Primera pasada: crear todos los matches para obtener sus IDs
    const matchInserts: Array<Record<string, unknown>> = [];
    for (const round of structure.rounds) {
      for (const m of round.matches) {
        matchInserts.push({
          round_id: roundIdByIndex.get(round.index),
          slot_index: m.slotIndex,
          status: "scheduled",
          // parent links los resolvemos en una segunda pasada (necesitan los IDs)
        });
      }
    }
    const { data: matchesCreated, error: mErr } = await service
      .from("match")
      .insert(matchInserts)
      .select("id, round_id, slot_index");
    if (mErr || !matchesCreated) throw new Error(`match insert: ${mErr?.message ?? "sin filas"}`);
    for (const m of matchesCreated) createdMatchIds.push(m.id);

    // Mapear (round_index, slot_index) → match id real
    // round_id no es round_index; hay que resolverlo vía roundIdByIndex inverso
    const roundIndexById = new Map<string, number>(roundsCreated.map((r: any) => [r.id, r.index]));
    const matchIdByKey = new Map<string, string>(); // key: `${roundIndex}-${slotIndex}`
    for (const m of matchesCreated) {
      const roundIndex = roundIndexById.get(m.round_id);
      if (roundIndex !== undefined) matchIdByKey.set(`${roundIndex}-${m.slot_index}`, m.id);
    }

    // 4) Segunda pasada: llenar parent_match_a_id/b_id y teams de R1
    for (const round of structure.rounds) {
      for (const m of round.matches) {
        const matchKey = `${round.index}-${m.slotIndex}`;
        const matchId = matchIdByKey.get(matchKey);
        if (!matchId) continue;

        const update: Record<string, unknown> = {};

        // Parent links: solo rondas > 0
        if (round.index > 0) {
          // Los padres son matches de la ronda anterior slot 2*slot y 2*slot+1
          const parentAKey = `${round.index - 1}-${m.slotIndex * 2}`;
          const parentBKey = `${round.index - 1}-${m.slotIndex * 2 + 1}`;
          update.parent_match_a_id = matchIdByKey.get(parentAKey) ?? null;
          update.parent_match_b_id = matchIdByKey.get(parentBKey) ?? null;
        }

        // R1: poblar teams por seed
        if (round.index === 0 && m.seedA != null && m.seedB != null) {
          update.team_a_id = seedToRegId.get(m.seedA) ?? null;
          update.team_b_id = seedToRegId.get(m.seedB) ?? null;
        }

        if (Object.keys(update).length > 0) {
          const { error: uErr } = await service.from("match").update(update).eq("id", matchId);
          if (uErr) throw new Error(`match update ${matchId}: ${uErr.message}`);
        }

        // 5) Crear match_game P1 para cada match
        const { data: gameRow, error: gErr } = await service
          .from("match_game")
          .insert({
            match_id: matchId,
            game_number: 1,
            status: "pending",
          })
          .select("id")
          .single();
        if (gErr || !gameRow) throw new Error(`match_game insert ${matchId}: ${gErr?.message ?? "sin id"}`);
        createdGameIds.push(gameRow.id);
      }
    }

    // Marcar edición como "active" si estaba en "registration"
    if (edition.status === "registration") {
      await service.from("tournament_edition").update({ status: "active" }).eq("id", editionId);
    }

    revalidatePath("/admin/bracket");
    revalidatePath("/bracket");

    await logAdminAction({
      supabase: service,
      accountId: account.id,
      action: "generate_real_bracket",
      entityType: "tournament_edition",
      entityId: editionId,
      entityLabel: edition.name,
      payload: { created: { rounds: createdRoundIds.length, matches: createdMatchIds.length, games: createdGameIds.length }, edition_status_before: edition.status },
    });

    return {
      ok: true,
      created: {
        brackets: 1,
        rounds: createdRoundIds.length,
        matches: createdMatchIds.length,
        games: createdGameIds.length,
      },
    };
  } catch (e) {
    await cleanup().catch(() => {});
    const msg = e instanceof Error ? e.message : "Error desconocido";
    console.error("[generateRealBracketAction] cleanup ejecutado. Error:", msg);
    return { ok: false, error: `Falló la generación (rollback hecho): ${msg}` };
  }
}

/**
 * Borra el bracket completo de una edición (para re-generar).
 * Solo super_admin.
 */
export async function deleteBracketAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { account } = await requireAdminAccount();
  if (account.role !== "super_admin" && account.role !== "admin") {
    return { ok: false, error: "Solo admin/super_admin." };
  }
  const editionId = String(formData.get("edition_id") ?? "").trim();
  if (!editionId) return { ok: false, error: "Falta edition_id." };

  const service = getSupabaseServiceRole() as any;
  const { data: brackets } = await service
    .from("bracket")
    .select("id")
    .eq("tournament_edition_id", editionId)
    .eq("type", "winner");
  if (!brackets || brackets.length === 0) {
    return { ok: false, error: "No hay bracket para borrar." };
  }

  for (const b of brackets) {
    // Borrar en orden: games → matches → rounds → bracket (cascada por FK)
    await service.from("match_game").delete().in(
      "match_id",
      (await service.from("match").select("id").in("round_id",
        (await service.from("round").select("id").eq("bracket_id", b.id)).data?.map((r: any) => r.id) ?? []
      )).data?.map((m: any) => m.id) ?? []
    );
    await service.from("match").delete().in(
      "round_id",
      (await service.from("round").select("id").eq("bracket_id", b.id)).data?.map((r: any) => r.id) ?? []
    );
    await service.from("round").delete().eq("bracket_id", b.id);
    await service.from("bracket").delete().eq("id", b.id);
  }

  await logAdminAction({
    supabase: service,
    accountId: account.id,
    action: "delete_bracket",
    entityType: "tournament_edition",
    entityId: editionId,
    payload: { brackets_deleted: brackets.length },
  });

  revalidatePath("/admin/bracket");
  revalidatePath("/bracket");
  return { ok: true };
}

/**
 * Asigna scheduled_at_start y jornada_label a un match.
 * Solo se programa el INICIO: la duración depende del formato que decida el
 * sorteo (BO3, deathmatch…), así que no se guarda hora de fin.
 * El horario llega en la zona del browser del admin y se guarda como UTC.
 */
export async function scheduleMatchAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { account } = await requireAdminAccount();
  const matchId = String(formData.get("match_id") ?? "").trim();
  const startStr = String(formData.get("scheduled_at_start") ?? "").trim();
  const tzOffsetRaw = formData.get("scheduled_at_start_tz_offset");
  const jornada = String(formData.get("jornada_label") ?? "").trim() || null;
  if (!matchId || !startStr) return { ok: false, error: "Faltan campos." };

  // startStr es la hora de pared del admin ("YYYY-MM-DDTHH:mm"); el offset
  // es el de su browser para esa fecha. Sin offset, fallback a hora argentina.
  const start = parseWallClockWithOffset(
    startStr,
    tzOffsetRaw == null ? null : String(tzOffsetRaw)
  );
  if (!start) {
    return { ok: false, error: "Fecha inválida." };
  }

  const service = getSupabaseServiceRole() as any;

  // Leer match a programar
  const { data: match } = await service
    .from("match")
    .select("id, round_id, scheduled_at_start, ready_a_at, ready_b_at, status, winner_team_id, team_a_id, team_b_id")
    .eq("id", matchId)
    .single();
  if (!match) return { ok: false, error: "Match no encontrado." };

  // Un match terminado, o un W.O. ya resuelto con ganador, no se reprograman.
  if (match.status === "finished") {
    return { ok: false, error: "El match está terminado y no se puede reprogramar." };
  }
  if (match.status === "forfeit" && match.winner_team_id) {
    return { ok: false, error: "El W.O. ya tiene ganador asignado y no se puede reprogramar." };
  }

  // W.O. doble sin ganador: reprogramar revive la llave — vuelve a scheduled
  // y se limpian los READY y el finished_at del forfeit.
  const doubleForfeitReset = match.status === "forfeit" && !match.winner_team_id;

  // Si cambia el horario, los READY viejos ya no valen: la ventana de
  // confirmación es relativa al horario, así que los equipos deben re-confirmar.
  const changedStart =
    !match.scheduled_at_start ||
    new Date(match.scheduled_at_start).getTime() !== start.getTime();
  const clearReady = changedStart && !!(match.ready_a_at || match.ready_b_at);

  const { error } = await service
    .from("match")
    .update({
      scheduled_at_start: start.toISOString(),
      scheduled_at_end: null,
      jornada_label: jornada,
      ...(clearReady ? { ready_a_at: null, ready_b_at: null, status: "scheduled" } : {}),
      ...(doubleForfeitReset
        ? { status: "scheduled", ready_a_at: null, ready_b_at: null, finished_at: null }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) return { ok: false, error: error.message };

  // La ventana ESTOY LISTO se abre al momento exacto calculado: agendamos un
  // disparo único (QStash) para ese instante, solo si la llave tiene equipos.
  if (match.team_a_id && match.team_b_id) {
    try {
      const { scheduleReadyWindowNotification } = await import("@/server/notify/ready-window-schedule");
      await scheduleReadyWindowNotification(matchId, start.toISOString());
    } catch (e) {
      console.error("[notify-ready] al agendar QStash:", e);
      // El agendado no debe romper la acción de programar el partido.
    }
  }

  revalidatePath("/admin/jornadas");
  revalidatePath("/admin/bracket");
  revalidatePath(`/admin/partido/${matchId}`);
  revalidatePath(`/partido/${matchId}`);
  revalidatePath("/mis-partidos");

  await logAdminAction({
    supabase: service,
    accountId: account.id,
    action: "schedule_match",
    entityType: "match",
    entityId: matchId,
    payload: {
      scheduled_at_start: start.toISOString(),
      jornada_label: jornada,
      previous_scheduled_at_start: match.scheduled_at_start ?? null,
      reset_ready: clearReady || doubleForfeitReset,
    },
  });

  return { ok: true };
}

// ============================================================
// Wrappers compatibles con <form action={...}> (retornan void,
// lanzan error en fallo para que Next muestre el error boundary).
// ============================================================

export async function scheduleMatchFormAction(formData: FormData): Promise<void> {
  "use server";
  const r = await scheduleMatchAction(formData);
  if (!r.ok) throw new Error(r.error ?? "Error al programar el partido.");
}

export async function generateRealBracketFormAction(formData: FormData): Promise<void> {
  "use server";
  const r = await generateRealBracketAction(formData);
  if (!r.ok) throw new Error(r.error ?? "Error al generar el bracket.");
}

export async function deleteBracketFormAction(formData: FormData): Promise<void> {
  "use server";
  const r = await deleteBracketAction(formData);
  if (!r.ok) throw new Error(r.error ?? "Error al borrar el bracket.");
}

// ============================================================
// 2. SORTEO (draw) de una partida — "server decide / client anima"
// ============================================================
// El servidor decide el resultado con crypto y lo persiste ANTES de que
// nadie lo vea. Todos los viewers reproducen la animación con ese resultado.

import {
  performDraw,
  rerollPhase,
  generateSeed,
  sha256,
  type PresetConfig,
  type DrawResult,
} from "@/lib/ruleta/draw-engine";

/** Carga el preset de la edición (desde DB, congelado al iniciar). */
async function loadPresetForEdition(service: any, editionId: string): Promise<{ presetId: string; config: PresetConfig }> {
  const { data: edition } = await service
    .from("tournament_edition")
    .select("preset_version_id")
    .eq("id", editionId)
    .single();
  if (!edition?.preset_version_id) {
    // Ediciones creadas sin preset (createEdition no lo asigna): re-enganchá la
    // última versión existente. Así el primer sorteo la engancha como promete
    // /admin/ruletas y no rompe con "no tiene preset".
    const { data: latest } = await service
      .from("preset_version")
      .select("id, config")
      .eq("is_frozen", false)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest?.config) {
      throw new Error("Esta edición no tiene preset de ruleta asignado. Configuralo en /admin/ruletas.");
    }
    await service
      .from("tournament_edition")
      .update({ preset_version_id: latest.id })
      .eq("id", editionId);
    return { presetId: latest.id, config: latest.config as PresetConfig };
  }
  const { data: preset } = await service
    .from("preset_version")
    .select("id, config")
    .eq("id", edition.preset_version_id)
    .single();
  if (!preset?.config) throw new Error("Preset de ruleta vacío o no encontrado.");
  return { presetId: preset.id, config: preset.config as PresetConfig };
}

/**
 * Inicia (o re-inicia) el sorteo de una partida.
 *
 * - Solo admin. Requiere que el match esté en status "open" (ambos ready).
 * - Si es la partida 1, también sortea la LLAVE (BO3/Deathmatch) y setea match.format.
 * - Si hay un draw previo en status committed/spinning para el mismo game, lo reemplaza.
 * - Persiste: roulette_draw (result), match_game (game_mode, antimeta_mode, player_mode, map, civs), draw_audit_log, match.draw_seed.
 * - Cambia match.status → "drawing" (los viewers ven la animación por Realtime).
 */
export async function startDrawAction(formData: FormData): Promise<{ ok: boolean; error?: string; drawId?: string }> {
  const { account } = await requireAdminAccount();
  const matchId = String(formData.get("match_id") ?? "").trim();
  const gameNumber = parseInt(String(formData.get("game_number") ?? "1"), 10) || 1;
  if (!matchId) return { ok: false, error: "Falta match_id." };

  const service = getSupabaseServiceRole() as any;

  // Match + equipos + ronda
  const { data: match } = await service
    .from("match")
    .select("id, status, round_id, team_a_id, team_b_id, scheduled_at_start, round:round_id(bracket_id, index, bracket:bracket_id(tournament_edition_id))")
    .eq("id", matchId)
    .single();
  if (!match) return { ok: false, error: "Match no encontrado." };
  // "open" = ambos equipos LISTOS (READY #1). "drawing"/"in_progress" se
  // permiten para re-lanzar el mismo sorteo o sortear las partidas 2/3 de un
  // BO3 que quedó en 1-1 (el match queda in_progress esperando el próximo giro).
  if (!["open", "drawing", "in_progress"].includes(match.status)) {
    return { ok: false, error: `El match debe estar "open" (ambos equipos listos) para sortear. Estado actual: ${match.status}.` };
  }
  if (!match.team_a_id || !match.team_b_id) {
    return { ok: false, error: "El match no tiene ambos equipos definidos todavía." };
  }
  // El primer sorteo requiere fecha confirmada: sin fecha no existe ventana READY.
  if (gameNumber === 1 && !match.scheduled_at_start) {
    return { ok: false, error: "El match no tiene fecha y horario programados. Programalo antes de iniciar el sorteo." };
  }

  const editionId = match.round?.bracket?.tournament_edition_id;
  if (!editionId) return { ok: false, error: "No se pudo resolver la edición del match." };

  // Pools de civs de cada equipo
  const { data: regA } = await service.from("team_registration").select("base_civ_ids, extra_civ_ids").eq("id", match.team_a_id).single();
  const { data: regB } = await service.from("team_registration").select("base_civ_ids, extra_civ_ids").eq("id", match.team_b_id).single();
  if (!regA || !regB) return { ok: false, error: "No se encontraron las inscripciones de los equipos." };

  // La final (último round) habilita las extra civs
  const { data: rounds } = await service.from("round").select("index").eq("bracket_id", match.round.bracket_id).order("index", { ascending: false }).limit(1);
  const isFinal = match.round.index === (rounds?.[0]?.index ?? -1);
  const poolA = [...(regA.base_civ_ids ?? []), ...(isFinal ? (regA.extra_civ_ids ?? []) : [])];
  const poolB = [...(regB.base_civ_ids ?? []), ...(isFinal ? (regB.extra_civ_ids ?? []) : [])];

  // Preset
  const { presetId, config } = await loadPresetForEdition(service, editionId);

  // match_game existente o a crear
  let { data: game } = await service
    .from("match_game")
    .select("id, draw_id, status")
    .eq("match_id", matchId)
    .eq("game_number", gameNumber)
    .maybeSingle();
  if (!game) {
    const { data: newGame, error: gErr } = await service
      .from("match_game")
      .insert({ match_id: matchId, game_number: gameNumber, status: "drawing" })
      .select("id").single();
    if (gErr || !newGame) return { ok: false, error: `No se pudo crear la partida ${gameNumber}: ${gErr?.message}` };
    game = newGame;
  }

  // Decidir el resultado (server-side, crypto)
  const result: DrawResult = performDraw(config, {
    poolA, poolB,
    isFirstGame: gameNumber === 1,
    isFinal,
    adminAccountId: account.id,
  });

  const seed = result.seed;
  const commitHash = sha256(`${seed}|${matchId}|${gameNumber}|${result.drawnAt}`);

  // Cancelar draw previo si quedó colgado
  if (game.draw_id) {
    await service.from("roulette_draw").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", game.draw_id).in("status", ["committed", "spinning"]);
  }

  // Persistir roulette_draw (result ya incluye todo; el status queda en "revealed"
  // porque el resultado ya está decidido y es visible — el reveal lo hace el streaming
  // de la animación, no un paso criptográfico aparte).
  const { data: drawRow, error: dErr } = await service
    .from("roulette_draw")
    .insert({
      match_game_id: game.id,
      admin_id: account.id,
      status: "revealed",
      commit_hash: commitHash,
      revealed_seed: seed,
      public_inputs: { match_id: matchId, game_number: gameNumber, preset_version_id: presetId, timestamp: result.drawnAt },
      preset_version_id: presetId,
      committed_at: result.drawnAt,
      spinning_at: result.drawnAt,
      revealed_at: result.drawnAt,
      result: {
        gameMode: result.gameMode,
        antimetaMode: result.antimetaMode,
        playerMode: result.playerMode,
        map: result.map,
        llaveFormat: result.llave?.llaveFormat ?? null,
        llave: result.llave,
        civsA: result.civsA,
        civsB: result.civsB,
        seed,
        drawnAt: result.drawnAt,
      },
    })
    .select("id")
    .single();
  if (dErr || !drawRow) return { ok: false, error: `No se pudo guardar el sorteo: ${dErr?.message}` };

  // Actualizar match_game con el resultado
  const { error: mgErr } = await service
    .from("match_game")
    .update({
      draw_id: drawRow.id,
      status: "drawing",
      game_mode: result.gameMode.title,
      antimeta_mode: result.antimetaMode?.title ?? null,
      player_mode: normalizePlayerMode(result.playerMode.title),
      map: result.map.title,
      llave_format: result.llave?.llaveFormat ?? null,
      civs_a: result.civsA,
      civs_b: result.civsB,
      updated_at: new Date().toISOString(),
    })
    .eq("id", game.id);
  if (mgErr) return { ok: false, error: `No se pudo actualizar la partida: ${mgErr.message}` };

  // Actualizar match: status drawing + draw_seed + (si P1) formato de llave
  const matchUpdate: Record<string, unknown> = {
    status: "drawing",
    draw_seed: seed,
    updated_at: new Date().toISOString(),
  };
  if (gameNumber === 1 && result.llave?.llaveFormat) {
    matchUpdate.format = result.llave.llaveFormat; // "BO3" | "BO1"
  }
  if (gameNumber > 1) {
    // BO3: al sortear la partida 2/3 se resetea el ciclo de lineup:
    // los READY #2 y la ventana de comodines de la partida anterior ya no aplican.
    matchUpdate.ready_lineup_a_at = null;
    matchUpdate.ready_lineup_b_at = null;
    matchUpdate.comodin_window_expires_at = null;
  }
  await service.from("match").update(matchUpdate).eq("id", matchId);

  // Audit log interno (append-only)
  await logDrawEvent(service, drawRow.id, account.id, "commit", commitHash, null, { match_id: matchId, game_number: gameNumber });
  await logDrawEvent(service, drawRow.id, account.id, "reveal", sha256(commitHash + "reveal"), commitHash, { result_summary: { modo: result.gameMode.title, formato: result.playerMode.title, mapa: result.map.title } });

  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
  return { ok: true, drawId: drawRow.id };
}

/** Normaliza el título del formato al enum player_mode de la DB. */
function normalizePlayerMode(title: string): "1v1" | "2v2" | "3v3" | "fusion" | null {
  const t = title.toLowerCase().replace(/\s/g, "");
  if (t.includes("1vs1") || t === "1v1") return "1v1";
  if (t.includes("2vs2") || t === "2v2") return "2v2";
  if (t.includes("3vs3") || t === "3v3") return "3v3";
  if (t.includes("team") || t.includes("fusion") || t.includes("fus")) return "fusion";
  return null;
}

/** Log append-only con hash encadenado. */
async function logDrawEvent(service: any, drawId: string, actorId: string, eventType: string, hashChain: string, previousHash: string | null, payload: any) {
  await service.from("draw_audit_log").insert({
    draw_id: drawId,
    event_type: eventType,
    hash_chain: hashChain,
    previous_hash: previousHash,
    actor_account_id: actorId,
    payload,
  });
}

/**
 * Re-gira UNA fase del sorteo (comodín REROLL ejecutado por admin).
 * Devuelve el nuevo resultado y lo persiste.
 */
export async function rerollDrawPhaseAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { account } = await requireAdminAccount();
  const matchId = String(formData.get("match_id") ?? "").trim();
  const gameNumber = parseInt(String(formData.get("game_number") ?? "1"), 10) || 1;
  const phase = String(formData.get("phase") ?? "").trim().toUpperCase();
  if (!matchId) return { ok: false, error: "Falta match_id." };
  if (!["MODO", "ANTIMETA", "FORMATO", "MAPA", "LLAVE", "CIVS"].includes(phase)) {
    return { ok: false, error: "Fase inválida." };
  }

  const service = getSupabaseServiceRole() as any;

  const { data: game } = await service
    .from("match_game")
    .select("id, draw_id")
    .eq("match_id", matchId)
    .eq("game_number", gameNumber)
    .single();
  if (!game?.draw_id) return { ok: false, error: "Esta partida todavía no tiene sorteo." };

  const { data: draw } = await service.from("roulette_draw").select("id, result, preset_version_id, match_game_id").eq("id", game.draw_id).single();
  if (!draw?.result) return { ok: false, error: "Sorteo sin resultado." };

  // Preset
  const { data: preset } = await service.from("preset_version").select("config").eq("id", draw.preset_version_id).single();
  if (!preset?.config) return { ok: false, error: "Preset no encontrado." };

  // Pools de civs (para re-girar CIVS o FORMATO que cambia cantidad)
  const { data: match } = await service.from("match").select("team_a_id, team_b_id, round:round_id(bracket_id, index, bracket:bracket_id(tournament_edition_id))").eq("id", matchId).single();
  const { data: rounds } = await service.from("round").select("index").eq("bracket_id", match.round.bracket_id).order("index", { ascending: false }).limit(1);
  const isFinal = match.round.index === (rounds?.[0]?.index ?? -1);
  const { data: regA } = await service.from("team_registration").select("base_civ_ids, extra_civ_ids").eq("id", match.team_a_id).single();
  const { data: regB } = await service.from("team_registration").select("base_civ_ids, extra_civ_ids").eq("id", match.team_b_id).single();
  const poolA = [...(regA?.base_civ_ids ?? []), ...(isFinal ? (regA?.extra_civ_ids ?? []) : [])];
  const poolB = [...(regB?.base_civ_ids ?? []), ...(isFinal ? (regB?.extra_civ_ids ?? []) : [])];

  const current = draw.result as DrawResult;
  let next: DrawResult;
  try {
    next = rerollPhase(current, phase as any, preset.config as PresetConfig, {
      poolA, poolB, isFirstGame: gameNumber === 1, isFinal, adminAccountId: account.id,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo re-girar." };
  }

  // Persistir nuevo resultado
  await service
    .from("roulette_draw")
    .update({
      revealed_seed: next.seed,
      revealed_at: next.drawnAt,
      result: {
        gameMode: next.gameMode,
        antimetaMode: next.antimetaMode,
        playerMode: next.playerMode,
        map: next.map,
        llaveFormat: next.llave?.llaveFormat ?? null,
        llave: next.llave,
        civsA: next.civsA,
        civsB: next.civsB,
        seed: next.seed,
        drawnAt: next.drawnAt,
      },
    })
    .eq("id", draw.id);

  await service
    .from("match_game")
    .update({
      game_mode: next.gameMode.title,
      antimeta_mode: next.antimetaMode?.title ?? null,
      player_mode: normalizePlayerMode(next.playerMode.title),
      map: next.map.title,
      llave_format: next.llave?.llaveFormat ?? null,
      civs_a: next.civsA,
      civs_b: next.civsB,
      updated_at: new Date().toISOString(),
    })
    .eq("id", game.id);

  // Si re-giramos LLAVE en P1, actualizar match.format
  if (phase === "LLAVE" && gameNumber === 1 && next.llave?.llaveFormat) {
    await service.from("match").update({ format: next.llave.llaveFormat, updated_at: new Date().toISOString() }).eq("id", matchId);
  }

  // REROLL durante lineup/comodin_window: si la fase re-girada afecta lo que
  // los equipos declararon (FORMATO cambia cuántos juegan; CIVS cambia el pool
  // sorteado), los lineups ya declarados quedan inválidos → reabrir la
  // declaración (status lineup + READY #2 de ambos en null). El admin reabre
  // la ventana de comodines al confirmar ambos READY de nuevo.
  if (phase === "FORMATO" || phase === "CIVS") {
    const { data: m } = await service.from("match").select("status").eq("id", matchId).single();
    if (m && ["lineup", "comodin_window"].includes(m.status)) {
      await service.from("match").update({
        status: "lineup",
        ready_lineup_a_at: null,
        ready_lineup_b_at: null,
        comodin_window_expires_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", matchId);
      await notifyMatchCaptains(matchId, "lineup");
    }
  }

  await logDrawEvent(service, draw.id, account.id, "reroll", sha256(next.seed + phase), null, { phase });

  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
  return { ok: true };
}

/**
 * Re-gira una fase del sorteo desde servidor, sin re-lectura de auth.
 * Usado por executeComodinAction (el comodín REROLL ejecutado por admin).
 *
 * @returns { ok, applied? } — `applied` describe qué cambió (para el log del comodín).
 */
export async function rerollDrawPhaseInternal(
  service: any,
  matchId: string,
  gameNumber: number,
  phase: string,
  adminAccountId: string
): Promise<{ ok: boolean; error?: string; applied?: any }> {
  // Reutilizo la lógica del action público pero con service account ya validado.
  // Implemento inline para no duplicar el "requireAdmin".
  const { rerollPhase } = await import("@/lib/ruleta/draw-engine");

  const { data: game } = await service
    .from("match_game")
    .select("id, draw_id")
    .eq("match_id", matchId)
    .eq("game_number", gameNumber)
    .single();
  if (!game?.draw_id) return { ok: false, error: "Esta partida no tiene sorteo para re-girar." };

  const { data: draw } = await service.from("roulette_draw").select("id, result, preset_version_id").eq("id", game.draw_id).single();
  if (!draw?.result) return { ok: false, error: "Sorteo sin resultado previo." };

  const { data: preset } = await service.from("preset_version").select("config").eq("id", draw.preset_version_id).single();
  if (!preset?.config) return { ok: false, error: "Preset no encontrado." };

  const { data: match } = await service.from("match").select("team_a_id, team_b_id, round:round_id(bracket_id, index, bracket:bracket_id(tournament_edition_id))").eq("id", matchId).single();
  const { data: rounds } = await service.from("round").select("index").eq("bracket_id", match.round.bracket_id).order("index", { ascending: false }).limit(1);
  const isFinal = match.round.index === (rounds?.[0]?.index ?? -1);
  const { data: regA } = await service.from("team_registration").select("base_civ_ids, extra_civ_ids").eq("id", match.team_a_id).single();
  const { data: regB } = await service.from("team_registration").select("base_civ_ids, extra_civ_ids").eq("id", match.team_b_id).single();
  const poolA = [...(regA?.base_civ_ids ?? []), ...(isFinal ? (regA?.extra_civ_ids ?? []) : [])];
  const poolB = [...(regB?.base_civ_ids ?? []), ...(isFinal ? (regB?.extra_civ_ids ?? []) : [])];

  const current = draw.result as DrawResult;
  let next: DrawResult;
  try {
    next = rerollPhase(current, phase as any, preset.config as PresetConfig, { poolA, poolB, isFirstGame: gameNumber === 1, isFinal, adminAccountId });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo re-girar." };
  }

  await service.from("roulette_draw").update({
    revealed_seed: next.seed,
    revealed_at: next.drawnAt,
    result: {
      gameMode: next.gameMode, antimetaMode: next.antimetaMode, playerMode: next.playerMode,
      map: next.map, llaveFormat: next.llave?.llaveFormat ?? null, llave: next.llave,
      civsA: next.civsA, civsB: next.civsB, seed: next.seed, drawnAt: next.drawnAt,
    },
  }).eq("id", draw.id);

  await service.from("match_game").update({
    game_mode: next.gameMode.title,
    antimeta_mode: next.antimetaMode?.title ?? null,
    player_mode: normalizePlayerMode(next.playerMode.title),
    map: next.map.title,
    llave_format: next.llave?.llaveFormat ?? null,
    civs_a: next.civsA, civs_b: next.civsB,
    updated_at: new Date().toISOString(),
  }).eq("id", game.id);

  if (phase === "LLAVE" && gameNumber === 1 && next.llave?.llaveFormat) {
    await service.from("match").update({ format: next.llave.llaveFormat, updated_at: new Date().toISOString() }).eq("id", matchId);
  }

  // REROLL durante lineup/comodin_window: si la fase re-girada afecta lo que
  // los equipos declararon (FORMATO cambia cuántos juegan; CIVS cambia el pool
  // sorteado), los lineups ya declarados quedan inválidos → reabrir la
  // declaración (status lineup + READY #2 de ambos en null). Igual que en
  // rerollDrawPhaseAction (el espejo con auth para el admin).
  if (phase === "FORMATO" || phase === "CIVS") {
    const { data: m } = await service.from("match").select("status").eq("id", matchId).single();
    if (m && ["lineup", "comodin_window"].includes(m.status)) {
      await service.from("match").update({
        status: "lineup",
        ready_lineup_a_at: null,
        ready_lineup_b_at: null,
        comodin_window_expires_at: null,
        updated_at: new Date().toISOString(),
      }).eq("id", matchId);
      await notifyMatchCaptains(matchId, "lineup");
    }
  }

  await logDrawEvent(service, draw.id, adminAccountId, "reroll", sha256(next.seed + phase), null, { phase });

  revalidatePath(`/partido/${matchId}`);
  revalidatePath(`/admin/partido/${matchId}`);
  return {
    ok: true,
    applied: {
      phase,
      gameMode: next.gameMode.title,
      antimetaMode: next.antimetaMode?.title ?? null,
      playerMode: next.playerMode.title,
      map: next.map.title,
      llaveFormat: next.llave?.llaveFormat ?? null,
    },
  };
}
