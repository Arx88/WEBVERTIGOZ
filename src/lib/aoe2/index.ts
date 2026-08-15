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
 * Calcula el maxRating RM 1v1 a partir de un perfil ya descargado.
 * Fuente principal: ratings history (extend=stats,ratings).
 * Fallback: leaderboards.
 */
export function getMaxRatingFromProfile(profile: Aoe2Profile): {
  maxRating: number | null;
  currentRating: number | null;
  rank: number | null;
  verificationStatus: "verified" | "hidden" | "failed";
} {
  const ratingsHistory = profile.ratings as
    | Array<{ leaderboardId: string; ratings: Array<{ rating: number; date: string }> }>
    | undefined;

  const rm1v1Ratings = ratingsHistory?.find((r) => r.leaderboardId === "rm_1v1");

  if (rm1v1Ratings && rm1v1Ratings.ratings && rm1v1Ratings.ratings.length > 0) {
    const allRatings = rm1v1Ratings.ratings.map((r) => r.rating);
    return {
      maxRating: Math.max(...allRatings),
      currentRating: allRatings[allRatings.length - 1],
      rank: null,
      verificationStatus: profile.verified ? "verified" : "hidden",
    };
  }

  const rm1v1Leaderboard = profile.leaderboards?.find(
    (l) => l.leaderboardId === "rm_1v1"
  );

  if (rm1v1Leaderboard && rm1v1Leaderboard.maxRating != null) {
    return {
      maxRating: rm1v1Leaderboard.maxRating,
      currentRating: rm1v1Leaderboard.rating ?? null,
      rank: rm1v1Leaderboard.rank ?? null,
      verificationStatus: profile.verified ? "verified" : "hidden",
    };
  }

  return {
    maxRating: null,
    currentRating: null,
    rank: null,
    verificationStatus: profile.verified ? "verified" : "hidden",
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
