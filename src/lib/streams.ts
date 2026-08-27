/**
 * Detección de "en vivo" para los canales de los casters — server only.
 *
 * Twitch:
 *  1. Si hay TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET en el entorno, usa la
 *     API oficial de Helix (lo más confiable).
 *  2. Si no, usa la GQL pública que usa el propio player web de Twitch
 *     (client-ID público) — devuelve title, viewers, juego y thumbnail.
 *
 * Kick: endpoint público api/v2/channels/{slug}. A veces Cloudflare corta
 * requests de servidores: si falla, devolvemos null y la UI simplemente no
 * muestra badge para ese canal (nunca rompe la página).
 *
 * Cache en memoria 60s por canal: las pages re-renderizan seguido y los
 * clientes re-polluean cada 90s; no queremos golpear las APIs por eso.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// El client-ID público del player web de Twitch (no requiere credenciales).
const TWITCH_GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

const TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 7_000;

export interface LiveStatus {
  live: boolean;
  viewers: number | null;
  title: string | null;
  game: string | null;
  thumbnail: string | null;
}

type CacheEntry = { at: number; data: LiveStatus | null };
const cache = new Map<string, CacheEntry>();

async function cached(key: string, fn: () => Promise<LiveStatus | null>): Promise<LiveStatus | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

function withTimeout(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

// ============================================================
// Twitch
// ============================================================

async function twitchHelixToken(): Promise<string | null> {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
      { method: "POST", signal: withTimeout(), cache: "no-store" }
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

async function twitchViaHelix(login: string): Promise<LiveStatus | null> {
  const token = await twitchHelixToken();
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!token || !clientId) return null;
  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
    { headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` }, signal: withTimeout(), cache: "no-store" }
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: any[] };
  const s = j.data?.[0];
  if (!s || s.type !== "live") return { live: false, viewers: null, title: null, game: null, thumbnail: null };
  return {
    live: true,
    viewers: s.viewer_count ?? null,
    title: s.title ?? null,
    game: s.game_name ?? null,
    thumbnail: (s.thumbnail_url ?? "").replace("{width}", "640").replace("{height}", "360") || null,
  };
}

async function twitchViaGql(login: string): Promise<LiveStatus | null> {
  const res = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-ID": TWITCH_GQL_CLIENT_ID, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($login: String!) { user(login: $login) { stream { id title viewersCount type game { displayName } previewImageURL(width: 640, height: 360) } } }`,
      variables: { login },
    }),
    signal: withTimeout(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { data?: { user?: { stream?: any } } };
  const s = j.data?.user?.stream;
  if (!s || s.type !== "live") return { live: false, viewers: null, title: null, game: null, thumbnail: null };
  return {
    live: true,
    viewers: s.viewersCount ?? null,
    title: s.title ?? null,
    game: s.game?.displayName ?? null,
    thumbnail: s.previewImageURL ?? null,
  };
}

export function fetchTwitchLive(login: string): Promise<LiveStatus | null> {
  const clean = login.trim().toLowerCase();
  if (!clean) return Promise.resolve(null);
  return cached(`twitch:${clean}`, async () => {
    try {
      const helix = await twitchViaHelix(clean);
      if (helix) return helix;
      return await twitchViaGql(clean);
    } catch {
      return null;
    }
  });
}

// ============================================================
// Kick
// ============================================================

export async function fetchKickLive(slug: string): Promise<LiveStatus | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  return cached(`kick:${clean}`, async () => {
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(clean)}`, {
        headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
        signal: withTimeout(),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const j = (await res.json()) as any;
      const s = j?.livestream;
      if (!s) return { live: false, viewers: null, title: null, game: null, thumbnail: null };
      return {
        live: true,
        viewers: s.viewer_count ?? null,
        title: s.session_title ?? null,
        game: s.categories?.[0]?.name ?? j?.recent_categories?.[0]?.name ?? null,
        thumbnail: s.thumbnail?.url ?? null,
      };
    } catch {
      return null;
    }
  });
}

// ============================================================
// Lote para la página de casters
// ============================================================

export interface ChannelRef {
  key: string; // "twitch:login" | "kick:slug"
  platform: "twitch" | "kick";
  channel: string;
}

/** Acepta "user", "@user" o "https://twitch.tv/user" y devuelve el slug. */
export function channelSlug(raw: string | null | undefined): string {
  if (!raw) return "";
  let v = raw.trim();
  const m = v.match(/(?:twitch\.tv|kick\.com)\/([A-Za-z0-9_]+)/i);
  if (m) v = m[1];
  return v.replace(/^@/, "").trim();
}

/** Consulta el estado de varios canales en paralelo. Clave = ChannelRef.key. */
export async function getLiveStatuses(refs: ChannelRef[]): Promise<Record<string, LiveStatus>> {
  const out: Record<string, LiveStatus> = {};
  if (refs.length === 0) return out;
  const settled = await Promise.allSettled(
    refs.map(async (r) => ({
      key: r.key,
      status:
        r.platform === "twitch"
          ? await fetchTwitchLive(r.channel)
          : await fetchKickLive(r.channel),
    }))
  );
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value.status) out[s.value.key] = s.value.status;
  }
  return out;
}
