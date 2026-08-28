/**
 * Datos de canales de streamers para la página de casters — server only.
 *
 * Trae el PERFIL COMPLETO de cada canal, no solo el estado en vivo:
 *   Twitch → GQL pública del player web (client-ID público): avatar, banner,
 *            seguidores, bio, último stream y el stream en vivo (viewers,
 *            juego, thumbnail).
 *   Kick   → API pública api/v2/channels/{slug}: avatar, banner, seguidores,
 *            verificado, bio, redes y el livestream.
 *
 * Si Kick rechaza (Cloudflare a veces corta requests de servidores) o Twitch
 * no responde, ese canal devuelve null y la tarjeta muestra el fallback
 * elegante — la página nunca se rompe.
 *
 * Cache en memoria 60s por canal: re-renders y re-polls del cliente no
 * vuelven a golpear las APIs.
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// Client-ID público del player web de Twitch — no requiere credenciales.
const TWITCH_GQL_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

const TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 7_000;

export interface ChannelStatus {
  platform: "twitch" | "kick";
  channel: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followers: number | null;
  bio: string | null;
  verified: boolean;
  // En vivo
  live: boolean;
  viewers: number | null;
  title: string | null;
  game: string | null;
  thumbnail: string | null;
  // Último broadcast (cuando no está en vivo)
  lastLiveAt: string | null;
  lastTitle: string | null;
  // Redes (Kick las expone; Twitch via panic/pylon no es público)
  socials: { youtube?: string | null; twitter?: string | null; instagram?: string | null; discord?: string | null };
}

type CacheEntry = { at: number; data: ChannelStatus | null };
const cache = new Map<string, CacheEntry>();

async function cached(key: string, fn: () => Promise<ChannelStatus | null>): Promise<ChannelStatus | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

function withTimeout(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

const EMPTY = (platform: "twitch" | "kick", channel: string): ChannelStatus => ({
  platform,
  channel,
  displayName: null,
  avatarUrl: null,
  bannerUrl: null,
  followers: null,
  bio: null,
  verified: false,
  live: false,
  viewers: null,
  title: null,
  game: null,
  thumbnail: null,
  lastLiveAt: null,
  lastTitle: null,
  socials: {},
});

// ============================================================
// Twitch
// ============================================================

const TWITCH_QUERY = `
query($login: String!) {
  user(login: $login) {
    displayName
    profileImageURL(width: 300)
    bannerImageURL
    followers { totalCount }
    description
    lastBroadcast { title startedAt }
    stream {
      viewersCount
      game { displayName }
      previewImageURL(width: 640, height: 360)
    }
  }
}`;

async function fetchTwitchChannel(login: string): Promise<ChannelStatus | null> {
  const clean = login.trim().toLowerCase();
  if (!clean) return null;
  return cached(`twitch:${clean}`, async () => {
    try {
      const res = await fetch("https://gql.twitch.tv/gql", {
        method: "POST",
        headers: { "Client-ID": TWITCH_GQL_CLIENT_ID, "Content-Type": "application/json" },
        body: JSON.stringify({ query: TWITCH_QUERY, variables: { login: clean } }),
        signal: withTimeout(),
        cache: "no-store",
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { data?: { user?: any } };
      const u = j.data?.user;
      if (!u) return null;
      const s = u.stream;
      return {
        ...EMPTY("twitch", clean),
        displayName: u.displayName ?? null,
        avatarUrl: u.profileImageURL ?? null,
        bannerUrl: u.bannerImageURL ?? null,
        followers: u.followers?.totalCount ?? null,
        bio: u.description ?? null,
        live: !!s,
        viewers: s?.viewersCount ?? null,
        title: s ? null : u.lastBroadcast?.title ?? null,
        game: s?.game?.displayName ?? null,
        thumbnail: s?.previewImageURL ?? null,
        lastLiveAt: u.lastBroadcast?.startedAt ?? null,
        lastTitle: u.lastBroadcast?.title ?? null,
      };
    } catch {
      return null;
    }
  });
}

// ============================================================
// Kick
// ============================================================

async function fetchKickChannel(slug: string): Promise<ChannelStatus | null> {
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
      if (!j?.slug && !j?.id) return null;
      const s = j.livestream;
      return {
        ...EMPTY("kick", clean),
        displayName: j.slug ?? clean,
        avatarUrl: j.avatar?.url ?? null,
        bannerUrl: j.banner_image?.url ?? null,
        followers: j.followers_count ?? null,
        bio: j.bio ?? null,
        verified: !!j.verified,
        live: !!s,
        viewers: s?.viewer_count ?? null,
        title: s?.session_title ?? null,
        game: s?.categories?.[0]?.name ?? null,
        thumbnail: s?.thumbnail?.url ?? null,
        socials: {
          youtube: j.youtube ?? null,
          twitter: j.twitter ?? null,
          instagram: j.instagram ?? null,
          discord: j.discord ?? null,
        },
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

/** Perfil completo de varios canales en paralelo. Clave = ChannelRef.key. */
export async function getChannelStatuses(refs: ChannelRef[]): Promise<Record<string, ChannelStatus>> {
  const out: Record<string, ChannelStatus> = {};
  if (refs.length === 0) return out;
  const settled = await Promise.allSettled(
    refs.map(async (r) => ({
      key: r.key,
      status:
        r.platform === "twitch"
          ? await fetchTwitchChannel(r.channel)
          : await fetchKickChannel(r.channel),
    }))
  );
  for (const s of settled) {
    if (s.status === "fulfilled" && s.value.status) out[s.value.key] = s.value.status;
  }
  return out;
}
