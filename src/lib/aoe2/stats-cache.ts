/**
 * Cache de stats AoE2 Companion en la tabla player_stats_cache.
 *
 * Trae el leaderboard rm_team (partidas de EQUIPOS, el formato del torneo)
 * con winrate por civ y por mapa, y lo persiste para que las páginas nunca
 * dependan de que Companion responda en vivo. Refresh: al aprobar la
 * inscripción, por cron (/api/cron/refresh-stats) o bajo demanda.
 *
 * Solo server. Lectura/escritura con service-role (la tabla es pública
 * de lectura pero sin políticas de escritura).
 */

import { getSupabaseServiceRole } from "@/lib/supabase/server";

const API_URL = process.env.AOE2_COMPANION_API_URL ?? "https://data.aoe2companion.com/api";
const USER_AGENT = process.env.AOE2_COMPANION_USER_AGENT ?? "VERTIGO-Cup/1.0";

export interface TeamCivStat {
  civ: string;
  civName: string;
  games: number;
  wins: number;
}

export interface TeamMapStat {
  map: string;
  mapName: string;
  games: number;
  wins: number;
}

export interface PlayerStatsPayload {
  civs: TeamCivStat[];
  maps: TeamMapStat[];
  totalGames: number | null;
}

// ============================================================
// Fetch a Companion
// ============================================================

// Throttle propio: Companion rechaza ráfagas (~16 req / 10s por IP).
const MAX_REQUESTS = 14;
const WINDOW_MS = 10_000;
let reqCount = 0;
let windowStart = Date.now();

async function throttleCompanion() {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    reqCount = 0;
    windowStart = now;
  }
  if (reqCount >= MAX_REQUESTS) {
    await new Promise((r) => setTimeout(r, WINDOW_MS - (now - windowStart) + 150));
    reqCount = 0;
    windowStart = Date.now();
  }
  reqCount++;
}

export type CompanionFetchResult =
  | { status: "ok"; payload: PlayerStatsPayload }
  /** El perfil no existe en Companion (404): dato permanente, se cachea vacío. */
  | { status: "not_found" }
  /** Error transitorio (red, 5xx, rate limit): se reintenta después. */
  | { status: "error" };

/** Un request a Companion; devuelve solo lo que guardamos (rm_team). */
export async function fetchCompanionTeamStats(profileId: number): Promise<CompanionFetchResult> {
  try {
    await throttleCompanion();
    const res = await fetch(`${API_URL}/profiles/${profileId}?extend=stats`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return { status: "not_found" };
    if (!res.ok) return { status: "error" };
    const profile = await res.json();
    const rmTeam = (profile.stats ?? []).find((s: any) => s.leaderboardId === "rm_team");
    if (!rmTeam) {
      // Perfil sin partidas de equipos registradas: cacheamos el vacío
      // para no re-golpear la API en cada render.
      return { status: "ok", payload: { civs: [], maps: [], totalGames: profile.games ?? null } };
    }
    return {
      status: "ok",
      payload: {
        civs: (rmTeam.civ ?? []).map((c: any) => ({
          civ: c.civ,
          civName: c.civName ?? c.civ,
          games: c.games ?? 0,
          wins: c.wins ?? 0,
        })),
        maps: (rmTeam.map ?? []).map((m: any) => ({
          map: m.map,
          mapName: m.mapName ?? m.map,
          games: m.games ?? 0,
          wins: m.wins ?? 0,
        })),
        totalGames: profile.games ?? null,
      },
    };
  } catch {
    return { status: "error" };
  }
}

const EMPTY_PAYLOAD: PlayerStatsPayload = { civs: [], maps: [], totalGames: null };

/** Fetch + upsert del cache para un perfil. Los 404 se cachean como vacío. */
export async function refreshPlayerStatsCache(
  profileId: number,
  playerRegistrationId: string | null
): Promise<boolean> {
  const result = await fetchCompanionTeamStats(profileId);
  if (result.status === "error") return false;
  const payload = result.status === "ok" ? result.payload : EMPTY_PAYLOAD;
  const admin = getSupabaseServiceRole() as any;
  const now = new Date().toISOString();
  const { error } = await admin.from("player_stats_cache").upsert(
    {
      aoe2_profile_id: profileId,
      player_registration_id: playerRegistrationId,
      payload,
      fetched_at: now,
      updated_at: now,
    },
    { onConflict: "aoe2_profile_id" }
  );
  if (error) {
    console.error("[stats-cache] upsert falló:", error.message);
    return false;
  }
  return true;
}

// ============================================================
// Lectura + frescura
// ============================================================

export interface PlayerRef {
  playerRegistrationId: string;
  aoe2ProfileId: number;
}

const DEFAULT_MAX_AGE_DAYS = 7;

function isFresh(fetchedAt: string | null | undefined, maxAgeDays: number): boolean {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() < maxAgeDays * 86_400_000;
}

/**
 * Devuelve el payload cacheado por profileId. Con `ensureFresh`, los
 * perfiles inexistentes o vencidos se refrescan antes de responder
 * (backfill perezoso; también corre por cron y al aprobar).
 */
export async function getCachedTeamStats(
  players: PlayerRef[],
  opts: { ensureFresh?: boolean; maxAgeDays?: number } = {}
): Promise<Map<number, { payload: PlayerStatsPayload; fetchedAt: string }>> {
  const result = new Map<number, { payload: PlayerStatsPayload; fetchedAt: string }>();
  if (players.length === 0) return result;

  const admin = getSupabaseServiceRole() as any;
  const ids = players.map((p) => p.aoe2ProfileId);
  const { data } = await admin
    .from("player_stats_cache")
    .select("aoe2_profile_id, payload, fetched_at")
    .in("aoe2_profile_id", ids);

  const byId = new Map<number, any>();
  for (const row of data ?? []) byId.set(row.aoe2_profile_id, row);

  const needsRefresh: PlayerRef[] = [];
  for (const p of players) {
    const row = byId.get(p.aoe2ProfileId);
    if (row?.payload && isFresh(row.fetched_at, opts.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS)) {
      result.set(p.aoe2ProfileId, { payload: row.payload as PlayerStatsPayload, fetchedAt: row.fetched_at });
    } else if (opts.ensureFresh) {
      needsRefresh.push(p);
    }
  }

  if (needsRefresh.length > 0) {
    const settled = await Promise.all(
      needsRefresh.map(async (p) => ({
        ...p,
        ok: await refreshPlayerStatsCache(p.aoe2ProfileId, p.playerRegistrationId),
      }))
    );
    for (const s of settled) {
      if (!s.ok) continue;
      const { data: fresh } = await admin
        .from("player_stats_cache")
        .select("payload, fetched_at")
        .eq("aoe2_profile_id", s.aoe2ProfileId)
        .maybeSingle();
      if (fresh?.payload) {
        result.set(s.aoe2ProfileId, { payload: fresh.payload as PlayerStatsPayload, fetchedAt: fresh.fetched_at });
      }
    }
  }

  return result;
}

// ============================================================
// Vista INTEL: mapas del torneo × pool de civs × compañeros
// ============================================================

/**
 * Los slugs del preset ("map-arabia") y los de Companion no coinciden:
 * en rm_team vienen con prefijo de leaderboard ("rm_arabia") y a veces
 * con nombre inglés ("four_lakes"). Tabla de alias conocidos, comparada
 * por igualdad tras normalizar ambos lados.
 */
const MAP_ALIASES: Record<string, string[]> = {
  arabia: ["arabia"],
  arena: ["arena"],
  atacama: ["atacama"],
  crater: ["crater"],
  cresta_montanosa: ["cresta_montanosa", "crested_mountains", "mountain_range", "mountain_ridge"],
  cuatro_lagos: ["cuatro_lagos", "four_lakes"],
  cuenca_del_oro: ["cuenca_del_oro", "gold_basin", "gold_rush", "golden_pit"],
  migracion: ["migracion", "migration"],
  tormenta_de_polvo: ["tormenta_de_polvo", "sand_storm", "dust_storm", "haboob"],
};

function normalizeMapSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(rm_|cm_|dm_|qp_)/, "")
    .replace(/^map-/, "")
    .replace(/[-\s]+/g, "_");
}

function wrOf(games: number, wins: number): number | null {
  if (games <= 0) return null;
  return Math.round((wins / games) * 100);
}

export interface IntelCell {
  id: string;
  label: string;
  img?: string;
  wr: number | null;
  games: number;
}

export interface PlayerIntel {
  playerRegistrationId: string;
  displayName: string;
  isCaptain: boolean;
  eloMax: number | null;
  hasData: boolean;
  maps: IntelCell[];
  civs: IntelCell[];
  topCivLabel: string | null;
}

export interface PresetMapDef {
  id: string;
  title: string;
}

/**
 * Cruza los stats cacheados con los mapas del preset y el pool de civs
 * del equipo. Siempre devuelve una celda por mapa/civ del torneo (wr null
 * = sin datos en ladder).
 */
export function buildPlayersIntel(params: {
  players: {
    id: string;
    displayName: string;
    isCaptain: boolean;
    maxRatingRm1v1: number | null;
    aoe2ProfileId: number;
  }[];
  cached: Map<number, { payload: PlayerStatsPayload; fetchedAt: string }>;
  poolCivIds: string[];
  presetMaps: PresetMapDef[];
}): PlayerIntel[] {
  const { players, cached, poolCivIds, presetMaps } = params;

  return players.map((p) => {
    const entry = cached.get(p.aoe2ProfileId);
    const payload = entry?.payload;

    const civIndex = new Map<string, TeamCivStat>();
    for (const c of payload?.civs ?? []) civIndex.set(c.civ, c);
    const mapIndex = new Map<string, TeamMapStat>();
    for (const m of payload?.maps ?? []) mapIndex.set(m.map, m);

    const maps: IntelCell[] = presetMaps.map((pm) => {
      const slug = normalizeMapSlug(pm.id);
      const aliases = MAP_ALIASES[slug] ?? [slug];
      let stat: TeamMapStat | undefined;
      for (const a of aliases) {
        stat = stat ?? mapIndex.get(a);
      }
      return {
        id: pm.id,
        label: pm.title,
        wr: stat ? wrOf(stat.games, stat.wins) : null,
        games: stat?.games ?? 0,
      };
    });

    const civs: IntelCell[] = poolCivIds.map((cid) => {
      const stat = civIndex.get(cid);
      return {
        id: cid,
        label: stat?.civName ?? cid,
        img: `/civs/${cid}.webp`,
        wr: stat ? wrOf(stat.games, stat.wins) : null,
        games: stat?.games ?? 0,
      };
    });

    const withGames = [...civs].filter((c) => c.wr !== null).sort((a, b) => b.games - a.games);
    const top = withGames[0];

    return {
      playerRegistrationId: p.id,
      displayName: p.displayName,
      isCaptain: p.isCaptain,
      eloMax: p.maxRatingRm1v1,
      hasData: !!payload && (payload.civs.length > 0 || payload.maps.length > 0),
      maps,
      civs,
      topCivLabel: top ? `${top.label} ${top.wr}% (${top.games}p)` : null,
    };
  });
}
