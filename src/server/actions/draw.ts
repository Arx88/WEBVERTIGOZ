"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import {
  generateServerSeed,
  hashSeed,
  deterministicIndex,
  verifyCommit,
  generateClientSeed,
  computeHashChain,
} from "@/lib/crypto";
import { getDb } from "@/lib/db";
import {
  rouletteDraw,
  drawAuditLog,
  seedingDraw,
  matchGame,
  match,
  account,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// ============================================================
// STORE EN MEMORIA PARA serverSeeds PENDIENTES DE REVEAL
// ============================================================
//
// El serverSeed NO se persiste en DB (solo su hash). Se guarda en memoria
// hasta el reveal. En producción esto debería ser Redis o Vercel KV para
// sobrevivir cold starts y funcionar en serverless.
//
// Para MVP: Map global. Funciona mientras el proceso viva.
// Cuando se haga reveal, se borra del Map y se persiste en DB.

declare global {
  // eslint-disable-next-line no-var
  var __vertigoPendingSeeds: Map<string, string> | undefined;
}

function getPendingSeeds(): Map<string, string> {
  if (!globalThis.__vertigoPendingSeeds) {
    globalThis.__vertigoPendingSeeds = new Map();
  }
  return globalThis.__vertigoPendingSeeds;
}

// ============================================================
// TIPOS
// ============================================================

export type SpinType = "match" | "seeding" | "regirar";

export interface DrawResult {
  gameMode?: string;
  antimetaMode?: string;
  playerMode?: string;
  map?: string;
  llaveFormat?: string;
  civsA?: string[];
  civsB?: string[];
}

export interface CommitResult {
  drawId: string;
  serverSeedHash: string;
  clientSeed: string;
}

export interface SpinResult {
  targetIndex: number;
  stepLabel: string;
}

// ============================================================
// 1. COMMIT — Inicia el sorteo
// ============================================================

/**
 * Inicia un sorteo generando el serverSeed y el commit hash.
 *
 * @param spinType - Tipo de sorteo: "match" (partida), "seeding" (bracket), "regirar" (comodín)
 * @param matchId - ID del match (requerido para spinType="match")
 * @param bracketId - ID del bracket (requerido para spinType="seeding")
 * @returns { drawId, serverSeedHash, clientSeed }
 */
export async function commitDraw(
  spinType: SpinType,
  options: { matchId?: string; bracketId?: string } = {}
): Promise<{ ok: true; data: CommitResult } | { ok: false; error: string }> {
  try {
    const adminAccount = await requireAdmin();
    if (!adminAccount) {
      return { ok: false, error: "No autorizado. Se requiere rol admin." };
    }

    const { matchId, bracketId } = options;

    // Validar según tipo
    if (spinType === "match" && !matchId) {
      return { ok: false, error: "matchId requerido para spinType='match'." };
    }
    if (spinType === "seeding" && !bracketId) {
      return { ok: false, error: "bracketId requerido para spinType='seeding'." };
    }

    // Generar serverSeed y commit hash
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashSeed(serverSeed);
    const clientSeed = generateClientSeed(matchId, bracketId);

    // Construir publicInputs (visibles desde el commit)
    const publicInputs = {
      spinType,
      matchId: matchId ?? null,
      bracketId: bracketId ?? null,
      clientSeed,
      timestamp: Date.now(),
      adminId: adminAccount.id,
    };

    if (spinType === "seeding") {
      // Sorteo de bracket → seeding_draw
      const [draw] = await getDb()
        .insert(seedingDraw)
        .values({
          bracketId: bracketId!,
          tournamentEditionId: (await getEditionIdForBracket(bracketId!)),
          commitHash: serverSeedHash,
          publicInputs,
          status: "committed",
          adminId: adminAccount.id,
        })
        .returning({ id: seedingDraw.id });

      // Guardar serverSeed en memoria
      getPendingSeeds().set(draw.id, serverSeed);

      // Log de auditoría
      await insertAuditLog({
        drawType: "seeding",
        drawId: draw.id,
        eventType: "commit",
        actorAccountId: adminAccount.id,
        payload: { spinType, bracketId, serverSeedHash },
      });

      return {
        ok: true,
        data: { drawId: draw.id, serverSeedHash, clientSeed },
      };
    } else {
      // Sorteo de partida → roulette_draw
      // Buscar el match_game activo (gameNumber=1 o el siguiente pendiente)
      const supabase = (await getSupabaseServer()) as any;
      const { data: matchGames } = await supabase
        .from("match_game")
        .select("id, game_number, status")
        .eq("match_id", matchId)
        .order("game_number", { ascending: true });

      if (!matchGames || matchGames.length === 0) {
        return { ok: false, error: "El match no tiene match_games. Generá el bracket primero." };
      }

      // Tomar el primer match_game pendiente
      const pendingGame = matchGames.find((g: any) => g.status === "pending");
      if (!pendingGame) {
        return { ok: false, error: "No hay match_game pendiente. Todos están en juego o finalizados." };
      }

      const [draw] = await getDb()
        .insert(rouletteDraw)
        .values({
          matchGameId: pendingGame.id,
          adminId: adminAccount.id,
          status: "committed",
          commitHash: serverSeedHash,
          publicInputs,
        })
        .returning({ id: rouletteDraw.id });

      // Guardar serverSeed en memoria
      getPendingSeeds().set(draw.id, serverSeed);

      // Log de auditoría
      await insertAuditLog({
        drawType: "match",
        drawId: draw.id,
        eventType: "commit",
        actorAccountId: adminAccount.id,
        payload: { spinType, matchId, matchGameId: pendingGame.id, serverSeedHash },
      });

      // Actualizar status del match a "drawing"
      await supabase
        .from("match")
        .update({ status: "drawing" })
        .eq("id", matchId);

      return {
        ok: true,
        data: { drawId: draw.id, serverSeedHash, clientSeed },
      };
    }
  } catch (err) {
    console.error("[commitDraw] error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ============================================================
// 2. SPIN STEP — Devuelve el índice determinista para una etapa
// ============================================================

/**
 * Devuelve el índice ganador determinista para una etapa del sorteo.
 * La ruleta cliente llama a esto para saber hasta dónde animar.
 *
 * @param drawId - ID del sorteo (de commitDraw)
 * @param stepIndex - Índice de la etapa (0=modo, 1=antimeta, 2=formato, 3=mapa, 4=civs, 5=llave)
 * @param N - Cantidad de items en la etapa
 * @param stepLabel - Label descriptivo (para auditoría)
 */
export async function spinStep(
  drawId: string,
  stepIndex: number,
  N: number,
  stepLabel: string
): Promise<{ ok: true; data: SpinResult } | { ok: false; error: string }> {
  try {
    const adminAccount = await requireAdmin();
    if (!adminAccount) {
      return { ok: false, error: "No autorizado." };
    }

    if (N < 1) {
      return { ok: false, error: "N debe ser >= 1." };
    }

    // Buscar el draw en DB (puede ser roulette_draw o seeding_draw)
    const supabase = (await getSupabaseServer()) as any;

    // Intentar roulette_draw primero
    let draw: any = null;
    let drawType: "match" | "seeding" = "match";

    const { data: rDraw } = await supabase
      .from("roulette_draw")
      .select("id, status, commit_hash, public_inputs")
      .eq("id", drawId)
      .single();

    if (rDraw) {
      draw = rDraw;
      drawType = "match";
    } else {
      const { data: sDraw } = await supabase
        .from("seeding_draw")
        .select("id, status, commit_hash, public_inputs")
        .eq("id", drawId)
        .single();
      if (sDraw) {
        draw = sDraw;
        drawType = "seeding";
      }
    }

    if (!draw) {
      return { ok: false, error: "Sorteo no encontrado." };
    }

    if (draw.status === "cancelled") {
      return { ok: false, error: "El sorteo fue cancelado." };
    }

    if (draw.status === "revealed") {
      return { ok: false, error: "El sorteo ya fue revelado. No se puede volver a girar." };
    }

    // Obtener serverSeed de memoria
    const serverSeed = getPendingSeeds().get(drawId);
    if (!serverSeed) {
      // Fallback: si el server reinició y perdimos el serverSeed, no podemos seguir
      return {
        ok: false,
        error: "serverSeed no disponible en memoria. El sorteo debe reiniciarse (cancelá y volvé a commitear).",
      };
    }

    const clientSeed = draw.public_inputs?.clientSeed ?? drawId;
    const targetIndex = deterministicIndex(N, serverSeed, clientSeed, stepIndex);

    // Log de auditoría (sin revelar el serverSeed)
    await insertAuditLog({
      drawType,
      drawId,
      eventType: "spin_step",
      actorAccountId: adminAccount.id,
      payload: { stepIndex, stepLabel, N, targetIndex },
    });

    return {
      ok: true,
      data: { targetIndex, stepLabel },
    };
  } catch (err) {
    console.error("[spinStep] error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ============================================================
// 3. REVEAL — Publica el serverSeed para auditoría
// ============================================================

/**
 * Revela el serverSeed del sorteo. Esto permite a cualquiera verificar
 * que el resultado fue determinista y no manipulado.
 *
 * Puede llamarse manualmente (botón "Revelar" del admin) o automáticamente
 * N días después del sorteo (cron job).
 */
export async function revealDraw(
  drawId: string
): Promise<{ ok: true; revealedSeed: string } | { ok: false; error: string }> {
  try {
    const adminAccount = await requireAdmin();
    if (!adminAccount) {
      return { ok: false, error: "No autorizado." };
    }

    const serverSeed = getPendingSeeds().get(drawId);
    if (!serverSeed) {
      return { ok: false, error: "serverSeed no disponible (ya revelado o perdido por reinicio)." };
    }

    const supabase = (await getSupabaseServer()) as any;

    // Intentar roulette_draw
    const { data: rDraw } = await supabase
      .from("roulette_draw")
      .select("id, status, commit_hash")
      .eq("id", drawId)
      .single();

    let drawType: "match" | "seeding" = "match";
    let commitHash: string;

    if (rDraw) {
      drawType = "match";
      commitHash = rDraw.commit_hash;
      if (rDraw.status === "revealed") {
        return { ok: false, error: "El sorteo ya fue revelado." };
      }
      // Verificar que el serverSeed coincide con el commit
      if (!verifyCommit(serverSeed, commitHash)) {
        return { ok: false, error: "serverSeed no coincide con commit_hash. Inconsistencia." };
      }
      await supabase
        .from("roulette_draw")
        .update({
          revealed_seed: serverSeed,
          revealed_at: new Date().toISOString(),
          status: "revealed",
        })
        .eq("id", drawId);
    } else {
      const { data: sDraw } = await supabase
        .from("seeding_draw")
        .select("id, status, commit_hash")
        .eq("id", drawId)
        .single();
      if (!sDraw) {
        return { ok: false, error: "Sorteo no encontrado." };
      }
      drawType = "seeding";
      commitHash = sDraw.commit_hash;
      if (sDraw.status === "revealed") {
        return { ok: false, error: "El sorteo ya fue revelado." };
      }
      if (!verifyCommit(serverSeed, commitHash)) {
        return { ok: false, error: "serverSeed no coincide con commit_hash. Inconsistencia." };
      }
      await supabase
        .from("seeding_draw")
        .update({
          revealed_seed: serverSeed,
          revealed_at: new Date().toISOString(),
          status: "revealed",
        })
        .eq("id", drawId);
    }

    // Borrar serverSeed de memoria (ya está en DB)
    getPendingSeeds().delete(drawId);

    // Log de auditoría
    await insertAuditLog({
      drawType,
      drawId,
      eventType: "reveal",
      actorAccountId: adminAccount.id,
      payload: { revealedSeed: serverSeed },
    });

    revalidatePath(`/sorteos/${drawId}/verificar`);

    return { ok: true, revealedSeed: serverSeed };
  } catch (err) {
    console.error("[revealDraw] error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ============================================================
// 4. PUBLISH — Persiste el resultado del sorteo en match_game
// ============================================================

/**
 * Persiste el resultado del sorteo en match_game (o seeding_draw.result).
 * Cambia el status del match a "lineup" y emite el evento realtime.
 *
 * @param drawId - ID del sorteo
 * @param results - Resultados de las 6 etapas
 */
export async function publishDraw(
  drawId: string,
  results: DrawResult
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminAccount = await requireAdmin();
    if (!adminAccount) {
      return { ok: false, error: "No autorizado." };
    }

    const supabase = (await getSupabaseServer()) as any;

    // Intentar roulette_draw
    const { data: rDraw } = await supabase
      .from("roulette_draw")
      .select("id, status, match_game_id, public_inputs")
      .eq("id", drawId)
      .single();

    if (rDraw) {
      // Sorteo de partida
      if (rDraw.status !== "committed" && rDraw.status !== "spinning") {
        return { ok: false, error: `No se puede publicar: status='${rDraw.status}'.` };
      }

      // Update roulette_draw con el resultado
      await supabase
        .from("roulette_draw")
        .update({
          result: results,
          published_at: new Date().toISOString(),
          status: "published",
        })
        .eq("id", drawId);

      // Update match_game con el snapshot del resultado
      await supabase
        .from("match_game")
        .update({
          game_mode: results.gameMode ?? null,
          antimeta_mode: results.antimetaMode ?? null,
          player_mode: results.playerMode ?? null,
          map: results.map ?? null,
          civs_a: results.civsA ?? [],
          civs_b: results.civsB ?? [],
          draw_id: drawId,
          status: "lineup",
        })
        .eq("id", rDraw.match_game_id);

      // Update match status a "lineup" (esperando declaración de lineup)
      const { data: mg } = await supabase
        .from("match_game")
        .select("match_id")
        .eq("id", rDraw.match_game_id)
        .single();

      if (mg) {
        await supabase
          .from("match")
          .update({ status: "lineup" })
          .eq("id", mg.match_id);

        // Log de auditoría
        await insertAuditLog({
          drawType: "match",
          drawId,
          eventType: "publish",
          actorAccountId: adminAccount.id,
          payload: { matchId: mg.match_id, matchGameId: rDraw.match_game_id, results },
        });

        revalidatePath(`/admin/partido/${mg.match_id}`);
        revalidatePath(`/partido/${mg.match_id}`);
      }

      return { ok: true };
    } else {
      // Intentar seeding_draw
      const { data: sDraw } = await supabase
        .from("seeding_draw")
        .select("id, status, bracket_id, public_inputs")
        .eq("id", drawId)
        .single();

      if (!sDraw) {
        return { ok: false, error: "Sorteo no encontrado." };
      }

      if (sDraw.status !== "committed" && sDraw.status !== "spinning") {
        return { ok: false, error: `No se puede publicar: status='${sDraw.status}'.` };
      }

      // Guardar resultado en seeding_draw
      await supabase
        .from("seeding_draw")
        .update({
          result: results,
          published_at: new Date().toISOString(),
          status: "published",
        })
        .eq("id", drawId);

      // Si results tiene seeds asignados, actualizar team_registration.seed
      const seeds = (results as any).seeds as Array<{ seed: number; teamRegistrationId: string }> | undefined;
      if (seeds && Array.isArray(seeds)) {
        for (const { seed, teamRegistrationId } of seeds) {
          await supabase
            .from("team_registration")
            .update({ seed })
            .eq("id", teamRegistrationId);
        }
      }

      // Log de auditoría
      await insertAuditLog({
        drawType: "seeding",
        drawId,
        eventType: "publish",
        actorAccountId: adminAccount.id,
        payload: { bracketId: sDraw.bracket_id, seedsCount: seeds?.length ?? 0 },
      });

      revalidatePath("/admin/bracket");
      revalidatePath("/bracket");

      return { ok: true };
    }
  } catch (err) {
    console.error("[publishDraw] error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

// ============================================================
// HELPER: Insertar log de auditoría con hashChain
// ============================================================

async function insertAuditLog(params: {
  drawType: "match" | "seeding";
  drawId: string;
  eventType: string;
  actorAccountId: string;
  payload: any;
}): Promise<void> {
  const supabase = (await getSupabaseServer()) as any;

  // Buscar el último log para encadenar
  const { data: lastLog } = await supabase
    .from("draw_audit_log")
    .select("hash_chain")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const previousHash = lastLog?.hash_chain ?? null;
  const eventData = JSON.stringify({
    drawType: params.drawType,
    drawId: params.drawId,
    eventType: params.eventType,
    payload: params.payload,
    timestamp: Date.now(),
  });
  const hashChain = computeHashChain(previousHash, eventData);

  await supabase.from("draw_audit_log").insert({
    draw_id: params.drawType === "match" ? params.drawId : null,
    event_type: params.eventType,
    hash_chain: hashChain,
    previous_hash: previousHash,
    actor_account_id: params.actorAccountId,
    payload: params.payload,
  });
}

// ============================================================
// HELPER: Obtener edition_id de un bracket
// ============================================================

async function getEditionIdForBracket(bracketId: string): Promise<string> {
  const supabase = (await getSupabaseServer()) as any;
  const { data: bracket } = await supabase
    .from("bracket")
    .select("tournament_edition_id")
    .eq("id", bracketId)
    .single();
  if (!bracket) {
    throw new Error(`Bracket ${bracketId} no encontrado.`);
  }
  return bracket.tournament_edition_id;
}

// ============================================================
// CANCEL — Cancela un sorteo (si algo salió mal)
// ============================================================

/**
 * Cancela un sorteo en curso. Borra el serverSeed de memoria
 * y marca el draw como cancelled.
 */
export async function cancelDraw(
  drawId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminAccount = await requireAdmin();
    if (!adminAccount) {
      return { ok: false, error: "No autorizado." };
    }

    const supabase = (await getSupabaseServer()) as any;

    // Borrar serverSeed de memoria
    getPendingSeeds().delete(drawId);

    // Intentar cancelar en ambas tablas
    const now = new Date().toISOString();

    await supabase
      .from("roulette_draw")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", drawId);

    await supabase
      .from("seeding_draw")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", drawId);

    // Log de auditoría
    await insertAuditLog({
      drawType: "match", // se loguea en ambas tablas via draw_id nullable
      drawId,
      eventType: "cancel",
      actorAccountId: adminAccount.id,
      payload: { reason: "manual_cancel" },
    });

    return { ok: true };
  } catch (err) {
    console.error("[cancelDraw] error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}
