/**
 * VÉRTIGO Cup — Watcher stateless de partidas en AoE2 Companion.
 *
 * Cada partida del torneo tiene un nombre de sala determinístico
 * (lobby-name.ts). El watcher busca ese nombre en el historial de
 * Companion de los jugadores del lineup:
 *
 *   candidato válido = nombre exacto
 *                    + started >= started_at de la partida (−5 min)
 *                    + mapa y modo coinciden con el sorteo (duro)
 *                    + ganador asignado (won no-null)
 *
 * Si hay varios candidatos vale el ÚLTIMO (las partidas reiniciadas
 * reutilizan el mismo nombre y solo la última cuenta). Con un
 * candidato válido: archiva el .aoe2record (la API oficial los borra
 * a los ~30 días), persiste el análisis curado + SVG del mapa final,
 * y auto-reporta el resultado por la MISMA lógica del reporte manual
 * (reportGameResultInternal → mismo BO3, mismo trigger de bracket).
 *
 * Sin estado acumulado: cada corrida re-consulta la API y re-aplica
 * las reglas. No hay botón de reinicio porque no hay nada que
 * reiniciar. Ejecución:
 *   - Lazy: syncAoe2IfDue al cargar /partido/[id] y /admin/partido/[id]
 *   - Cron: /api/cron/sync-aoe2 (barrido de matches in_progress)
 */

import { getSupabaseServiceRole } from "@/lib/supabase/server";
import {
  getMatchesForProfiles,
  fetchLiveMatch,
  getMatchAnalysis,
  getMatchAnalysisSvg,
  downloadReplayFile,
  type Aoe2MatchSummary,
} from "./index";
import { lobbyNameForGame, lobbyNameMatches } from "./lobby-name";
import { checkMatchConfig } from "./game-config";
import { analyzeStrategy, productionCounts } from "./strategy";
import { reportGameResultInternal } from "@/server/actions/match-day";

/** Mínimo entre consultas a Companion por partida. */
const CHECK_THROTTLE_MS = 45_000;
/** Tolerancia: la sala puede crearse unos minutos antes del "¡Se juega!". */
const START_TOLERANCE_MS = 5 * 60_000;
/** Páginas del historial a revisar por consulta. */
const MAX_PAGES = 2;

const GAME_FIELDS =
  "id, match_id, game_number, status, game_mode, player_mode, map, lineup_a, lineup_b, started_at, aoe2_match_id, aoe2_sync_status, aoe2_checked_at, aoe2_flag, rec_storage_path";

export interface SyncGameRow {
  id: string;
  match_id: string;
  game_number: number;
  status: string;
  game_mode: string | null;
  player_mode: string | null;
  map: string | null;
  lineup_a: string[] | null;
  lineup_b: string[] | null;
  started_at: string | null;
  aoe2_match_id: number | null;
  aoe2_sync_status: string;
  aoe2_checked_at: string | null;
  aoe2_flag: string | null;
  rec_storage_path: string | null;
}

export interface SyncMatchRow {
  id: string;
  status: string;
  jornada_label: string | null;
  slot_index: number;
  team_a_id: string | null;
  team_b_id: string | null;
}

export interface SyncResult {
  matchGameId: string;
  status: string;
  flag: string | null;
  reported: boolean;
  aoe2MatchId: number | null;
  skipped?: boolean;
}

// ============================================================
// Entrada lazy (páginas del partido)
// ============================================================

/**
 * Sincroniza los games in_progress de un match. Best-effort: nunca
 * tira (el cron y el reporte manual cubren cualquier fallo).
 */
export async function syncAoe2IfDue(
  matchId: string
): Promise<{ checked: number; synced: number }> {
  const out = { checked: 0, synced: 0 };
  try {
    const service = getSupabaseServiceRole() as any;
    const { data: match } = await service
      .from("match")
      .select("id, status, jornada_label, slot_index, team_a_id, team_b_id")
      .eq("id", matchId)
      .maybeSingle();
    if (!match || match.status !== "in_progress") return out;

    const { data: games } = await service
      .from("match_game")
      .select(GAME_FIELDS)
      .eq("match_id", matchId)
      .order("game_number", { ascending: false });

    for (const game of (games ?? []) as SyncGameRow[]) {
      if (game.status !== "in_progress") continue;
      if (game.aoe2_sync_status === "synced") continue; // ya reportada → lock
      try {
        const r = await syncGameWithCompanion(service, match, game);
        if (!r.skipped) out.checked++;
        if (r.reported) out.synced++;
      } catch {
        // best-effort por game
      }
    }
  } catch {
    // best-effort
  }
  return out;
}

// ============================================================
// Sync de una partida
// ============================================================

/**
 * Busca y valida la partida de Companion para un match_game.
 * Con `forceAoe2MatchId` (vínculo forzado del admin) saltea el
 * descubrimiento por nombre y usa ese match directamente, manteniendo
 * la validación de mapa/modo/ganador.
 */
export async function syncGameWithCompanion(
  service: any,
  match: SyncMatchRow,
  game: SyncGameRow,
  opts: { forceAoe2MatchId?: number } = {}
): Promise<SyncResult> {
  const base: SyncResult = {
    matchGameId: game.id,
    status: game.aoe2_sync_status,
    flag: game.aoe2_flag,
    reported: false,
    aoe2MatchId: game.aoe2_match_id,
  };

  // Throttle (solo para el descubrimiento automático)
  if (!opts.forceAoe2MatchId && game.aoe2_checked_at) {
    const elapsed = Date.now() - new Date(game.aoe2_checked_at).getTime();
    if (elapsed < CHECK_THROTTLE_MS) return { ...base, skipped: true };
  }

  const expectedName = lobbyNameForGame({
    jornadaLabel: match.jornada_label,
    slotIndex: match.slot_index,
    gameNumber: game.game_number,
    matchId: match.id,
  });

  // Perfiles del lineup (fallback: roster completo de ambos equipos)
  const lineupA = (game.lineup_a ?? []) as string[];
  const lineupB = (game.lineup_b ?? []) as string[];
  const { profilesA, profilesB } = await resolveLineupProfiles(
    service,
    lineupA,
    lineupB,
    match
  );
  const allProfiles = [...profilesA.keys(), ...profilesB.keys()];

  let candidates: Aoe2MatchSummary[] = [];
  if (opts.forceAoe2MatchId) {
    const forced = await fetchSingleMatch(opts.forceAoe2MatchId);
    if (!forced) {
      return markAttempt(service, game, {
        ...base,
        status: "config_mismatch",
        flag: `No encontré el match ${opts.forceAoe2MatchId} en AoE2 Companion.`,
      });
    }
    candidates = [forced];
  } else if (allProfiles.length > 0) {
    candidates = await findCandidatesByLobbyName(
      allProfiles,
      expectedName,
      game.started_at
    );
  }

  // Recorrer de más reciente a más antigua: la última válida gana.
  let liveCandidate: Aoe2MatchSummary | null = null;
  let mismatch: { candidate: Aoe2MatchSummary; reason: string } | null = null;
  let noWinner: Aoe2MatchSummary | null = null;

  for (const cand of candidates) {
    if (cand.finished == null) {
      liveCandidate = liveCandidate ?? cand;
      continue;
    }

    const check = checkMatchConfig(game.map, game.game_mode, cand);
    if (!check.ok) {
      mismatch =
        mismatch ??
        {
          candidate: cand,
          reason:
            check.kind === "map"
              ? `Mapa no coincide: la sala dice "${check.actual}", el sorteo fue "${check.expected}".`
              : `Modo no coincide: la sala está en ${check.actual}, el sorteo fue "${check.expected}".`,
        };
      continue;
    }

    const players = (cand.teams ?? []).flatMap((t) => t.players ?? []);
    const winners = players.filter((p) => p.won === true);
    if (winners.length === 0) {
      noWinner = noWinner ?? cand;
      continue;
    }

    // Mapear ganador(es) a los equipos del torneo vía lineups
    const winnerInA = winners.some((w) => profilesA.has(w.profileId));
    const winnerInB = winners.some((w) => profilesB.has(w.profileId));
    if (winnerInA && winnerInB) {
      mismatch =
        mismatch ??
        {
          candidate: cand,
          reason: "Hay ganadores en ambos equipos según Companion (¿empate técnico?).",
        };
      continue;
    }
    if (!winnerInA && !winnerInB) {
      mismatch =
        mismatch ??
        {
          candidate: cand,
          reason:
            "El ganador de Companion no coincide con los perfiles de los lineups declarados.",
        };
      continue;
    }
    const winnerTeamId = winnerInA ? match.team_a_id : match.team_b_id;
    if (!winnerTeamId) {
      mismatch =
        mismatch ?? { candidate: cand, reason: "El match no tiene equipos definidos." };
      continue;
    }

    return processValidCandidate(service, match, game, cand, winnerTeamId, expectedName);
  }

  // Ninguna válida: reportar el mejor motivo (prioridad: mismatch > sin ganador > en vivo)
  if (mismatch) {
    return markAttempt(service, game, {
      ...base,
      status: "config_mismatch",
      flag: `${mismatch.reason} (match ${mismatch.candidate.matchId} — no se auto-reporta)`,
      aoe2MatchId: mismatch.candidate.matchId,
    });
  }
  if (noWinner) {
    return markAttempt(service, game, {
      ...base,
      status: "no_winner",
      flag: `La partida "${noWinner.name ?? expectedName}" terminó sin ganador asignado en Companion (¿se reinició?). Espero la próxima con el mismo nombre.`,
      aoe2MatchId: noWinner.matchId,
    });
  }
  if (liveCandidate) {
    return markAttempt(service, game, {
      ...base,
      status: "live",
      flag: null,
      aoe2MatchId: liveCandidate.matchId,
    });
  }

  // Nada encontrado
  const flag =
    allProfiles.length === 0
      ? "Ningún jugador del lineup tiene perfil de AoE2 vinculado — el sync automático no puede buscar."
      : null;
  return markAttempt(service, game, {
    ...base,
    status: opts.forceAoe2MatchId ? "config_mismatch" : game.aoe2_sync_status === "live" ? "pending" : game.aoe2_sync_status,
    flag: flag ?? (opts.forceAoe2MatchId ? "Ese match no cumple las condiciones para vincularse." : base.flag),
  });
}

// ============================================================
// Procesamiento del candidato válido
// ============================================================

async function processValidCandidate(
  service: any,
  match: SyncMatchRow,
  game: SyncGameRow,
  cand: Aoe2MatchSummary,
  winnerTeamId: string,
  expectedName: string
): Promise<SyncResult> {
  const now = new Date().toISOString();

  // 1) Archivar el .aoe2record ANTES que nada (retención ~30 días en la API oficial)
  let recPath: string | null = null;
  try {
    const anyPlayer = (cand.teams ?? []).flatMap((t) => t.players ?? [])[0];
    if (anyPlayer) {
      const buf = await downloadReplayFile(cand.matchId, anyPlayer.profileId);
      if (buf) {
        const path = `recs/${game.id}.aoe2record`;
        const { error: upErr } = await service.storage
          .from("replays")
          .upload(path, buf, {
            upsert: true,
            contentType: "application/octet-stream",
            cacheControl: "3600",
          });
        if (!upErr) recPath = path;
      }
    }
  } catch {
    // el rec es un plus: si falla, el resultado se reporta igual
  }

  // 2) Análisis curado + SVG del mapa final
  try {
    await archiveAnalysis(service, game.id, cand);
  } catch {
    // idem: no bloquea el reporte
  }

  // 3) Marcar la partida como sincronizada (lock antes del reporte)
  const { error: syncErr } = await service
    .from("match_game")
    .update({
      aoe2_match_id: cand.matchId,
      aoe2_sync_status: "synced",
      aoe2_checked_at: now,
      aoe2_flag: null,
      rec_storage_path: recPath,
      updated_at: now,
    })
    .eq("id", game.id);
  if (syncErr) {
    return {
      matchGameId: game.id,
      status: "config_mismatch",
      flag: `Error de DB al marcar sincronizada: ${syncErr.message}`,
      reported: false,
      aoe2MatchId: cand.matchId,
    };
  }

  // 4) Auto-reportar el resultado (misma lógica que el formulario del admin)
  let report: { ok: boolean; error?: string };
  try {
    report = await reportGameResultInternal(service, {
      matchGameId: game.id,
      winnerTeamId,
      replayUrl: null,
    });
  } catch (e: any) {
    // Fuera de un request de Next (p.ej. un script) revalidatePath tira;
    // adentro puede fallar algo transitorio. El estado de DB ya quedó
    // escrito por el internal: no reintentar, dejar constancia.
    report = { ok: false, error: e?.message ?? "Error inesperado al reportar" };
  }

  if (!report.ok) {
    // Caso típico: el admin cargó el resultado a mano entre el check y el
    // reporte. El análisis/rec ya están archivados; no reintentar.
    await service
      .from("match_game")
      .update({
        aoe2_flag: `Análisis y rec archivados (match ${cand.matchId}), pero el resultado ya estaba cargado: ${report.error}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", game.id);
    return {
      matchGameId: game.id,
      status: "synced",
      flag: report.error ?? null,
      reported: false,
      aoe2MatchId: cand.matchId,
    };
  }

  return {
    matchGameId: game.id,
    status: "synced",
    flag: null,
    reported: true,
    aoe2MatchId: cand.matchId,
  };
}

// ============================================================
// Descubrimiento
// ============================================================

async function fetchSingleMatch(aoe2MatchId: number): Promise<Aoe2MatchSummary | null> {
  return fetchLiveMatch(aoe2MatchId);
}

async function findCandidatesByLobbyName(
  profileIds: number[],
  expectedName: string,
  startedAt: string | null
): Promise<Aoe2MatchSummary[]> {
  const minStarted = startedAt
    ? new Date(startedAt).getTime() - START_TOLERANCE_MS
    : null;

  const found = new Map<number, Aoe2MatchSummary>();
  const ids = profileIds.slice(0, 6);
  for (let page = 1; page <= MAX_PAGES; page++) {
    let matches: Aoe2MatchSummary[] = [];
    try {
      matches = await getMatchesForProfiles(ids, page);
    } catch {
      break;
    }
    for (const m of matches) {
      if (!lobbyNameMatches(expectedName, m.name)) continue;
      if (minStarted != null) {
        const startedMs = m.started ? new Date(m.started).getTime() : NaN;
        if (Number.isNaN(startedMs) || startedMs < minStarted) continue;
      }
      found.set(m.matchId, m);
    }
    if (matches.length === 0) break;
  }

  return [...found.values()].sort((a, b) => {
    const ta = a.started ? new Date(a.started).getTime() : 0;
    const tb = b.started ? new Date(b.started).getTime() : 0;
    return tb - ta; // más reciente primero
  });
}

/** profileId por jugador del lineup; fallback al roster si no hay lineup. */
async function resolveLineupProfiles(
  service: any,
  lineupA: string[],
  lineupB: string[],
  match: SyncMatchRow
): Promise<{ profilesA: Map<number, string>; profilesB: Map<number, string> }> {
  const profilesA = new Map<number, string>();
  const profilesB = new Map<number, string>();

  const fetchProfiles = async (playerRegIds: string[], teamRegId: string | null) => {
    const map = new Map<number, string>();
    if (playerRegIds.length > 0) {
      const { data } = await service
        .from("player_registration")
        .select("id, aoe2_profile_id")
        .in("id", playerRegIds);
      for (const p of data ?? []) {
        if (p.aoe2_profile_id) map.set(Number(p.aoe2_profile_id), p.id);
      }
    } else if (teamRegId) {
      const { data } = await service
        .from("player_registration")
        .select("id, aoe2_profile_id")
        .eq("team_registration_id", teamRegId);
      for (const p of data ?? []) {
        if (p.aoe2_profile_id) map.set(Number(p.aoe2_profile_id), p.id);
      }
    }
    return map;
  };

  const [a, b] = await Promise.all([
    fetchProfiles(lineupA, match.team_a_id),
    fetchProfiles(lineupB, match.team_b_id),
  ]);
  for (const [k, v] of a) profilesA.set(k, v);
  for (const [k, v] of b) profilesB.set(k, v);
  return { profilesA, profilesB };
}

// ============================================================
// Persistencia del análisis
// ============================================================

// ============================================================
// Backfill: análisis que no se archivó a tiempo
// ============================================================

/**
 * Companion genera el análisis de forma async: si el sync corrió apenas
 * terminó la partida, el fetch de /analysis puede llegar antes de que
 * exista y el game queda `synced` SIN análisis. El backfill lo re-archivo
 * (y aprovecha para completar el .aoe2record si también faltó). Tiene
 * cooldown in-memory para que N viewers no dispare N re-fetches de ~2 MB.
 */
const backfillCooldown = new Map<string, number>();
const BACKFILL_COOLDOWN_MS = 5 * 60_000;

export async function backfillAnalysis(
  service: any,
  game: { id: string; aoe2_match_id: number | null; rec_storage_path?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  if (!game.aoe2_match_id) return { ok: false, error: "El game no tiene match de Companion vinculado" };

  const last = backfillCooldown.get(game.id);
  if (last && Date.now() - last < BACKFILL_COOLDOWN_MS) {
    return { ok: false, error: "backfill en cooldown" };
  }
  backfillCooldown.set(game.id, Date.now());

  try {
    const cand = await fetchLiveMatch(game.aoe2_match_id);
    if (!cand) return { ok: false, error: `El match ${game.aoe2_match_id} ya no está disponible en Companion` };

    await archiveAnalysis(service, game.id, cand);

    // Aprovechar para completar el rec si tampoco se archivó
    if (!game.rec_storage_path) {
      try {
        const anyPlayer = (cand.teams ?? []).flatMap((t) => t.players ?? [])[0];
        if (anyPlayer) {
          const buf = await downloadReplayFile(cand.matchId, anyPlayer.profileId);
          if (buf) {
            const path = `recs/${game.id}.aoe2record`;
            const { error } = await service.storage.from("replays").upload(path, buf, {
              upsert: true,
              contentType: "application/octet-stream",
              cacheControl: "3600",
            });
            if (!error) {
              await service
                .from("match_game")
                .update({ rec_storage_path: path, updated_at: new Date().toISOString() })
                .eq("id", game.id);
            }
          }
        }
      } catch {
        // el rec es un plus
      }
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error inesperado en el backfill" };
  }
}

async function archiveAnalysis(service: any, matchGameId: string, cand: Aoe2MatchSummary) {
  const analysis = await getMatchAnalysis(cand.matchId);
  const payload = curateAnalysis(analysis, cand);

  let svgPath: string | null = null;
  try {
    const svg = await getMatchAnalysisSvg(cand.matchId);
    if (svg && svg.length > 0) {
      const path = `analysis/${matchGameId}.svg`;
      const { error } = await service.storage
        .from("replays")
        .upload(path, svg, {
          upsert: true,
          contentType: "image/svg+xml",
          cacheControl: "3600",
        });
      if (!error) svgPath = path;
    }
  } catch {
    // SVG opcional
  }

  const { error } = await service.from("match_game_analysis").upsert(
    {
      match_game_id: matchGameId,
      aoe2_match_id: cand.matchId,
      payload,
      svg_storage_path: svgPath,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "match_game_id" }
  );
  if (error) throw new Error(`match_game_analysis: ${error.message}`);
}

/** "0:44:40.850000" → 2680 (segundos). Tolerante a formatos. */
export function parseHmsToSeconds(hms: string | null | undefined): number | null {
  if (!hms) return null;
  const m = String(hms).match(/^(\d+):(\d{1,2}):(\d{1,2})/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Versión del formato del payload. Cuando cambia la curación (nuevos
 * campos/correcciones), subir la versión hace que los payloads viejos
 * se re-archiven solos vía backfill.
 *
 * v3: contadores de producción por jugador (villagersTrained,
 * militaryTrained, fishingShips) para los superlativos de la partida.
 */
export const ANALYSIS_PAYLOAD_VERSION = 3;

/**
 * Reduce el análisis crudo (~2 MB con gaia/tiles/objects) al resumen
 * que se persiste en match_game_analysis.payload.
 */
export function curateAnalysis(analysis: any, cand: Aoe2MatchSummary): Record<string, unknown> {
  const players = Array.isArray(analysis?.players) ? analysis.players : [];
  // Índice profileId → team (0/1 según el orden de teams en el match)
  const teamOf = new Map<number, number>();
  (cand.teams ?? []).forEach((t, i) => {
    for (const p of t.players ?? []) teamOf.set(p.profileId, i);
  });
  return {
    v: ANALYSIS_PAYLOAD_VERSION,
    source: "aoe2companion",
    aoe2MatchId: cand.matchId,
    lobbyName: cand.name ?? null,
    mapName: cand.mapName ?? null,
    patch: cand.patch ?? null,
    server: cand.server ?? null,
    duration: analysis?.duration ?? null,
    durationSeconds: parseHmsToSeconds(analysis?.duration),
    players: players.map((p: any) => {
      const buildOrder = mergeBuildOrder(p);
      const uptimes = (p.uptimes ?? []).map((u: any) => ({
        age: u.age ?? null,
        at: u.timestamp ?? null,
        seconds: parseHmsToSeconds(u.timestamp),
      }));
      // eapmPerMinute viene como { "0": 44, "1": 67, ... } — el pico cuenta
      // la historia de la partida mejor que el promedio.
      const eapmSeries = p.eapmPerMinute;
      const eapmValues =
        eapmSeries && typeof eapmSeries === "object" && !Array.isArray(eapmSeries)
          ? Object.values(eapmSeries).map((v) => Number(v)).filter((v) => Number.isFinite(v))
          : [];
      const eapmPeak = eapmValues.length > 0 ? Math.max(...eapmValues) : null;
      const production = productionCounts(buildOrder);
      return {
        profileId: p.profileId ?? null,
        name: p.name ?? null,
        team: p.profileId != null ? teamOf.get(p.profileId) ?? null : null,
        civ: p.civilization ?? null,
        civId: p.civilizationId ?? null,
        color: p.color ?? null,
        colorHex: p.colorHex ?? null,
        eapm: p.eapm ?? null,
        eapmPeak,
        villagersTrained: production.villagers,
        militaryTrained: production.military,
        fishingShips: production.fishingShips,
        winner: p.winner ?? false,
        resignedAt: p.resignation?.timestamp ?? null,
        resignedSeconds: parseHmsToSeconds(p.resignation?.timestamp),
        uptimes,
        strategy: analyzeStrategy(buildOrder, uptimes),
        timeseries: downsampleTimeseries(p.timeseries),
      };
    }),
    chat: (Array.isArray(analysis?.allChat) ? analysis.allChat : [])
      .slice(0, 200)
      .map((c: any) => ({
        at: c.timestamp ?? null,
        seconds: parseHmsToSeconds(c.timestamp),
        player: c.player ?? null,
        audience: c.audience ?? null,
        message: c.message ?? null,
      })),
  };
}

/** Build order unificado (unidades + techs + edificios) ordenado por tiempo. */
export function mergeBuildOrder(p: any): { at: string; seconds: number; kind: string; name: string }[] {
  const items: { at: string; seconds: number; kind: string; name: string }[] = [];
  const push = (arr: any, kind: string) => {
    for (const it of arr ?? []) {
      const name = it.unit ?? it.name ?? null;
      if (!name || !it.timestamp) continue;
      items.push({ at: it.timestamp, seconds: parseHmsToSeconds(it.timestamp) ?? 0, kind, name });
    }
  };
  push(p.queuedUnits, "unit");
  push(p.queuedTechs, "tech");
  push(p.queuedBuildings, "building");
  items.sort((a, b) => a.seconds - b.seconds);
  return items;
}

/** Timeseries a ≤60 puntos con timestamps en segundos. */
function downsampleTimeseries(ts: any): { t: number; o: number; r: number }[] {
  if (!Array.isArray(ts) || ts.length === 0) return [];
  const step = Math.max(1, Math.ceil(ts.length / 60));
  const out: { t: number; o: number; r: number }[] = [];
  for (let i = 0; i < ts.length; i += step) {
    const point = ts[i];
    const t = parseHmsToSeconds(point?.timestamp);
    if (t == null) continue;
    out.push({ t, o: point.totalObjects ?? 0, r: point.totalResources ?? 0 });
  }
  return out;
}

// ============================================================
// Helpers de estado
// ============================================================

async function markAttempt(
  service: any,
  game: SyncGameRow,
  result: SyncResult
): Promise<SyncResult> {
  try {
    await service
      .from("match_game")
      .update({
        aoe2_sync_status: result.status,
        aoe2_checked_at: new Date().toISOString(),
        aoe2_flag: result.flag,
        aoe2_match_id: result.aoe2MatchId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", game.id);
  } catch {
    // el estado de sync es decorativo frente al resultado real
  }
  return result;
}
