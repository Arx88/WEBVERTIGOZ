/**
 * Backend proxy para la API de AoE2 Companion.
 * Cache + throttle para no exceder el rate limit (16 req/10s por IP).
 */

import type {
  Aoe2Profile,
  Aoe2ProfileSummary,
} from "@/types/domain";

const API_URL = process.env.AOE2_COMPANION_API_URL ?? "https://data.aoe2companion.com/api";
const USER_AGENT = process.env.AOE2_COMPANION_USER_AGENT ?? "VERTIGO-Cup/1.0";

// Throttle: 16 req / 10s
const MAX_REQUESTS = 16;
const WINDOW_MS = 10_000;
let requestCount = 0;
let windowStart = Date.now();

async function throttle() {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    requestCount = 0;
    windowStart = now;
  }
  if (requestCount >= MAX_REQUESTS) {
    const waitMs = WINDOW_MS - (now - windowStart) + 100;
    await new Promise((r) => setTimeout(r, waitMs));
    requestCount = 0;
    windowStart = Date.now();
  }
  requestCount++;
}

async function fetchApi<T>(path: string): Promise<T> {
  await throttle();
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    },
    next: { revalidate: 1800 }, // 30 min cache
  });
  if (!res.ok) {
    throw new Error(`AoE2 Companion API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch SIN cache de datos de Next (para el sync en vivo de partidas).
 * El watcher necesita datos frescos, no el cache de 30 min.
 */
async function fetchLive<T>(path: string): Promise<T> {
  await throttle();
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`AoE2 Companion API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ============================================================
// Endpoints
// ============================================================

export async function searchProfiles(name: string): Promise<Aoe2ProfileSummary[]> {
  const data = await fetchApi<{ profiles: Aoe2ProfileSummary[] }>(
    `/profiles?search=${encodeURIComponent(name)}&page=1`
  );
  return data.profiles ?? [];
}

export async function getProfile(profileId: number, extend: string = "stats"): Promise<Aoe2Profile> {
  const profile = await fetchApi<Aoe2Profile>(
    `/profiles/${profileId}?extend=${extend}`
  );
  return profile;
}

export async function getProfiles(profileIds: number[]): Promise<Aoe2ProfileSummary[]> {
  if (profileIds.length === 0) return [];
  const ids = profileIds.join(",");
  const data = await fetchApi<{ profiles: Aoe2ProfileSummary[] }>(
    `/profiles?profile_ids=${ids}`
  );
  return data.profiles ?? [];
}

/**
 * Calcula maxRating y rating actual RM 1v1 a partir de un perfil ya descargado.
 * Combina las dos fuentes disponibles:
 *  - ratings history (extend=stats,ratings): historial de partidas ranked.
 *    OJO: Companion lo devuelve en orden DESCENDENTE (más reciente primero),
 *    así que se ordena explícitamente por fecha antes de leer el actual.
 *  - leaderboards: rating live del ladder + maxRating histórico de toda la
 *    cuenta (puede estar vacío si el perfil no figura en el ladder).
 */
export function getMaxRatingFromProfile(profile: Aoe2Profile): {
  maxRating: number | null;
  currentRating: number | null;
  rank: number | null;
  verificationStatus: "verified" | "hidden" | "failed";
} {
  const verificationStatus = profile.verified ? "verified" : "hidden";

  const ratingsHistory = profile.ratings as
    | Array<{ leaderboardId: string; ratings: Array<{ rating: number; date: string }> }>
    | undefined;
  const rm1v1History = ratingsHistory?.find((r) => r.leaderboardId === "rm_1v1");
  const rm1v1Leaderboard = profile.leaderboards?.find(
    (l) => l.leaderboardId === "rm_1v1"
  );

  // Ordenar por fecha ascendente: el "actual" es el último, sin depender
  // del orden en que la API devuelva el array.
  const sorted = [...(rm1v1History?.ratings ?? [])].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const histMax = sorted.length > 0 ? Math.max(...sorted.map((r) => r.rating)) : null;
  const histCurrent = sorted.length > 0 ? sorted[sorted.length - 1].rating : null;

  const lbMax = rm1v1Leaderboard?.maxRating ?? null;
  const lbCurrent = rm1v1Leaderboard?.rating ?? null;

  const maxCandidates = [histMax, lbMax].filter((v): v is number => v != null);
  // Rating actual: el del ladder es live; el del historial llega hasta la
  // última partida registrada.
  const current = lbCurrent ?? histCurrent;

  return {
    maxRating: maxCandidates.length > 0 ? Math.max(...maxCandidates) : null,
    currentRating: current,
    rank: rm1v1Leaderboard?.rank ?? null,
    verificationStatus,
  };
}

/**
 * Obtiene el maxRating RM 1v1 histórico de un jugador.
 * Usado para el ELO cap.
 *
 * USA SIEMPRE ratings history (extend=stats,ratings) como fuente principal.
 * leaderboards puede estar vacío para algunos perfiles, pero ratings
 * siempre tiene el historial completo de partidas ranked.
 */
export async function getMaxRatingRm1v1(profileId: number): Promise<{
  maxRating: number | null;
  currentRating: number | null;
  rank: number | null;
  verificationStatus: "verified" | "hidden" | "failed";
}> {
  try {
    const profile = await getProfile(profileId, "stats,ratings");
    return getMaxRatingFromProfile(profile);
  } catch {
    return {
      maxRating: null,
      currentRating: null,
      rank: null,
      verificationStatus: "failed",
    };
  }
}

/**
 * Validación de ELO cap para un equipo (3 jugadores).
 */
export async function validateTeamEloCap(
  profileIds: number[],
  cap: number = 3500,
  tolerance: number = 20
): Promise<{
  totalElo: number;
  maxAllowed: number;
  isWithinCap: boolean;
  perPlayer: { profileId: number; maxRating: number | null; status: string }[];
}> {
  const perPlayer = await Promise.all(
    profileIds.map(async (id) => {
      const r = await getMaxRatingRm1v1(id);
      return {
        profileId: id,
        maxRating: r.maxRating,
        status: r.verificationStatus,
      };
    })
  );

  const totalElo = perPlayer.reduce(
    (sum, p) => sum + (p.maxRating ?? 0),
    0
  );
  const maxAllowed = cap + tolerance;

  return {
    totalElo,
    maxAllowed,
    isWithinCap: totalElo <= maxAllowed,
    perPlayer,
  };
}

// ============================================================
// Matches (sync del watcher — datos en vivo, sin cache)
// ============================================================

export interface Aoe2MatchPlayer {
  profileId: number;
  name: string;
  rating: number | null;
  ratingDiff: number | null;
  civ: string | null;
  civName: string | null;
  color: number | null;
  colorHex: string | null;
  slot: number | null;
  team: number | null;
  won: boolean | null;
  verified?: boolean;
}

export interface Aoe2MatchTeam {
  teamId: number;
  players: Aoe2MatchPlayer[];
}

/** Item del listado /matches (ya incluye la configuración completa). */
export interface Aoe2MatchSummary {
  matchId: number;
  started: string | null; // ISO string
  finished: string | null; // ISO string; null = en curso
  updated: string | null;
  abandoned: number | null;
  leaderboardId: string | null;
  name: string | null; // nombre del lobby
  server: string | null;
  patch: number | null;
  mapName: string | null;
  gameModeName: string | null;
  mapSizeName: string | null;
  population: number | null;
  speed: number | null;
  startingAge: number | null;
  victory: number | null;
  regicideMode: boolean | null;
  suddenDeathMode: boolean | null;
  empireWarsMode: boolean | null;
  teams: Aoe2MatchTeam[];
}

/**
 * Historial reciente de partidas para un conjunto de perfiles.
 * `profile_ids` es obligatorio en la API (semántica de unión: devuelve
 * partidas donde jugó CUALQUIERA de los perfiles). leaderboard_ids=unranked
 * acota a salas custom, que es donde se juegan las partidas del torneo.
 */
export async function getMatchesForProfiles(
  profileIds: number[],
  page: number = 1
): Promise<Aoe2MatchSummary[]> {
  if (profileIds.length === 0) return [];
  const data = await fetchLive<{ matches?: Aoe2MatchSummary[] }>(
    `/matches?profile_ids=${profileIds.join(",")}&leaderboard_ids=unranked&page=${page}`
  );
  return data.matches ?? [];
}

/** Un match por id (vínculo forzado del admin). Mismo shape que el listado. */
export async function fetchLiveMatch(matchId: number | string): Promise<Aoe2MatchSummary | null> {
  try {
    return await fetchLive<Aoe2MatchSummary>(`/matches/${matchId}`);
  } catch {
    return null;
  }
}

/**
 * Análisis completo de una partida (~2 MB): build order, uptimes, eAPM,
 * timeseries, chat, resignaciones, objetos finales del mapa.
 */
export async function getMatchAnalysis(matchId: number | string): Promise<any> {
  return fetchLive<any>(`/matches/${matchId}/analysis`);
}

/** SVG renderizado del mapa final de la partida. */
export async function getMatchAnalysisSvg(matchId: number | string): Promise<Buffer | null> {
  await throttle();
  const res = await fetch(`${API_URL}/matches/${matchId}/analysis/svg`, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/svg+xml" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Descarga el .aoe2record de una partida desde la API oficial.
 * Server-side únicamente: api.ageofempires.com rechaza requests con
 * header Origin (CORS), por eso el browser no puede pedirla directo.
 * La retención en la API oficial es de ~30 días → archivar apenas
 * termina la partida. Devuelve null si no está disponible.
 */
export async function downloadReplayFile(
  matchId: number | string,
  profileId: number
): Promise<Buffer | null> {
  const url = `https://aoe.ms/replay/?gameId=${matchId}&profileId=${profileId}&matchId=${matchId}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  // Respuestas cortas suelen ser páginas de error, no un .aoe2record
  if (buf.length < 10_000) return null;
  return buf;
}
