import Link from "next/link";
import { Mic, ChevronRight, Eye } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ART_PREDICADOR } from "@/lib/art";
import SiteNav from "@/components/nav/site-nav";
import HeroStat from "@/components/shared/hero-stat";
import CastersGrid, {
  type RailCaster,
  type RailGroup,
} from "@/components/casters/casters-grid";
import { getChannelStatuses, channelSlug, type ChannelRef, type ChannelStatus } from "@/lib/streams";

export const dynamic = "force-dynamic";

const TIER_META: Record<string, { label: string; badge: string; color: string; group: string }> = {
  official: { label: "Oficial", badge: "vertigo-badge-warning", color: "rgba(212,175,55,0.8)", group: "Transmisión principal" },
  secondary: { label: "Secundario", badge: "vertigo-badge-purple", color: "rgba(124,58,237,0.75)", group: "Co-streams" },
  community: { label: "Community", badge: "vertigo-badge-success", color: "rgba(34,197,94,0.6)", group: "Comunidad" },
};

interface CasterRaw {
  id: string;
  display_name: string;
  tier: string;
  twitch_channel: string | null;
  youtube_channel: string | null;
  kick_channel: string | null;
  approved_at: string | null;
  featured: boolean | null;
}

async function loadCasters(): Promise<RailCaster[]> {
  try {
    const supabase = await getSupabaseServer();

    const { data: castersRaw } = (await supabase
      .from("caster")
      .select("id, display_name, tier, twitch_channel, youtube_channel, kick_channel, approved_at, featured")
      .not("approved_at", "is", null)
      .order("tier", { ascending: true })
      .order("display_name", { ascending: true })) as { data: CasterRaw[] | null };

    if (!castersRaw || castersRaw.length === 0) return [];

    // Cantidad de llaves transmitidas por caster
    const casterIds = castersRaw.map((c) => c.id);
    const { data: matches } = (await supabase
      .from("match")
      .select("stream_caster_id")
      .in("stream_caster_id", casterIds)) as { data: { stream_caster_id: string | null }[] | null };

    const countByCaster: Record<string, number> = {};
    for (const m of matches ?? []) {
      if (m.stream_caster_id) countByCaster[m.stream_caster_id] = (countByCaster[m.stream_caster_id] ?? 0) + 1;
    }

    return castersRaw.map((c) => {
      const meta = TIER_META[c.tier] ?? TIER_META.community;
      return {
        id: c.id,
        displayName: c.display_name ?? "—",
        tier: c.tier ?? "community",
        tierLabel: meta.label,
        tierColor: meta.color,
        tierBadge: meta.badge,
        twitch: channelSlug(c.twitch_channel) || null,
        youtube: channelSlug(c.youtube_channel) || null,
        kick: channelSlug(c.kick_channel) || null,
        matchCount: countByCaster[c.id] ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/** El caster destacado desde el panel (uno solo). */
async function loadFeaturedId(): Promise<string | null> {
  try {
    const supabase = await getSupabaseServer();
    const { data } = (await supabase
      .from("caster")
      .select("id")
      .eq("featured", true)
      .not("approved_at", "is", null)
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null };
    return data?.id ?? null;
  } catch {
    return null;
  }
}

export default async function CastersPage() {
  const casters = await loadCasters();
  const featuredId = await loadFeaturedId();

  // Estado en vivo inicial (server): Twitch via GQL/Helix, Kick via API pública.
  const refs: ChannelRef[] = casters.flatMap((c) => {
    const out: ChannelRef[] = [];
    if (c.twitch) out.push({ key: `twitch:${c.twitch.toLowerCase()}`, platform: "twitch", channel: c.twitch.toLowerCase() });
    if (c.kick) out.push({ key: `kick:${c.kick.toLowerCase()}`, platform: "kick", channel: c.kick.toLowerCase() });
    return out;
  });
  const statuses = await getChannelStatuses(refs);

  const liveCount = casters.filter((c) => {
    const t = c.twitch ? statuses[`twitch:${c.twitch.toLowerCase()}`] : null;
    const k = c.kick ? statuses[`kick:${c.kick.toLowerCase()}`] : null;
    return t?.live || k?.live;
  }).length;

  // Featured: el caster al aire con más espectadores (para el hero).
  const featured = casters
    .map((c) => {
      const st: ChannelStatus[] = [];
      if (c.twitch) { const s = statuses[`twitch:${c.twitch.toLowerCase()}`]; if (s?.live) st.push(s); }
      if (c.kick) { const s = statuses[`kick:${c.kick.toLowerCase()}`]; if (s?.live) st.push(s); }
      if (st.length === 0) return null;
      const top = st.sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0))[0];
      const twitchLive = c.twitch ? statuses[`twitch:${c.twitch.toLowerCase()}`]?.live : false;
      const url = twitchLive ? `https://twitch.tv/${c.twitch}` : `https://kick.com/${c.kick}`;
      const avatar = top.avatarUrl ?? st.find((s) => s.avatarUrl)?.avatarUrl ?? null;
      const banner = top.thumbnail ?? top.bannerUrl ?? st.find((s) => s.bannerUrl)?.bannerUrl ?? null;
      const followers = [top.followers, ...st.map((s) => s.followers)].filter(
        (n): n is number => typeof n === "number"
      );
      return { c, top, url, avatar, banner, followers: followers.length ? Math.max(...followers) : null };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b.top.viewers ?? 0) - (a.top.viewers ?? 0))[0] ?? null;

  const officials = casters.filter((c) => c.tier === "official").length;

  // Rails por tier — solo los que tienen gente
  const groups: RailGroup[] = (["official", "secondary", "community"] as const)
    .map((tier) => ({
      tier,
      label: TIER_META[tier].group,
      color: TIER_META[tier].color,
      items: casters.filter((c) => c.tier === tier),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <SiteNav />

      <main className="vertigo-content" style={{ maxWidth: "none", padding: "40px 32px" }}>
        {/* ═══ HERO — el predicador ante el pueblo ═══ */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 18,
            border: "1px solid var(--vertigo-line-soft)",
            marginBottom: 30,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ART_PREDICADOR}
            alt=""
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              objectFit: "cover", objectPosition: "center 30%", opacity: 0.62,
            }}
          />
          <div
            style={{
              position: "absolute", inset: 0,
              background:
                "linear-gradient(180deg, rgba(10,0,17,0.22) 0%, rgba(10,0,17,0.42) 48%, rgba(10,0,17,0.9) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)",
            }}
          />
          <div
            style={{
              position: "relative", zIndex: 2, padding: "48px 40px 36px",
              display: "flex", flexDirection: "column", justifyContent: "flex-end",
              minHeight: "clamp(460px, 60vh, 580px)",
            }}
          >
            <span className="vertigo-kicker">LA VOZ DEL TORNEO · TWITCH · YOUTUBE · KICK</span>
            <h1
              className="vertigo-title"
              style={{
                fontSize: "clamp(30px, 4.6vw, 54px)",
                lineHeight: 0.95,
                margin: "6px 0 12px",
                textShadow: "0 4px 32px rgba(0,0,0,0.6)",
              }}
            >
              Los que narran la guerra
            </h1>
            <p className="vertigo-desc" style={{ maxWidth: 660, margin: 0, fontSize: 15 }}>
              Cada llave necesita su voz. Los casters de VÉRTIGO transmiten cada sorteo, cada
              comodín y cada asedio en vivo — el pueblo sentado en la ladera, mirando el fuego.
            </p>

            {/* Featured EN VIVO — vidrio sobre el hero, con foto real del canal */}
            {featured && (
              <div
                className="flex flex-wrap items-center gap-x-5 gap-y-3"
                style={{
                  marginTop: 26,
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: "1px solid rgba(239,68,68,0.45)",
                  background: "rgba(10,0,17,0.55)",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 0 30px rgba(239,68,68,0.15)",
                  maxWidth: 760,
                }}
              >
                {featured.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featured.avatar}
                    alt={featured.c.displayName}
                    className="flex-none rounded-full object-cover"
                    style={{
                      width: 52, height: 52,
                      border: "2px solid #ef4444",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                    }}
                  />
                ) : null}
                <span
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#ef4444] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1px] text-white"
                  style={{ boxShadow: "0 2px 12px rgba(239,68,68,0.5)" }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  EN VIVO
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-cinzel text-[17px] font-bold text-[var(--vertigo-text)]">
                    {featured.c.displayName}
                  </div>
                  {featured.top.title && (
                    <div className="truncate text-[12px] text-[var(--vertigo-muted)]">{featured.top.title}</div>
                  )}
                </div>
                {featured.top.viewers != null && featured.top.viewers > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--vertigo-text)]">
                    <Eye style={{ width: 13, height: 13, color: "#ef4444" }} />
                    {featured.top.viewers.toLocaleString("es")}
                  </span>
                )}
                <a
                  href={featured.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vertigo-btn vertigo-btn-primary"
                  style={{ padding: "9px 18px", fontSize: 11 }}
                >
                  Mirar ahora
                  <ChevronRight style={{ width: 12, height: 12 }} />
                </a>
              </div>
            )}

            {/* Roster integrado al hero */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 26, alignItems: "center" }}>
              <HeroStat value={liveCount} label={liveCount === 1 ? "Al aire" : "Al aire ahora"} color={liveCount > 0 ? "#ef4444" : "var(--vertigo-faint)"} />
              <HeroStat value={casters.length} label="Casters" color="var(--vertigo-purple-pale)" />
              <HeroStat value={officials} label="Oficiales" color="var(--vertigo-gold)" />
              <Link
                href="/registro-caster"
                className="vertigo-btn vertigo-btn-primary"
                style={{ padding: "10px 18px", fontSize: 11, marginLeft: "auto" }}
              >
                <Mic style={{ width: 12, height: 12 }} />
                Quiero castear
                <ChevronRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
          </div>
        </div>

        {casters.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Mic
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Sin casters aprobados</div>
              <p className="vertigo-empty-desc">
                Cuando el staff apruebe el primer caster, va a aparecer acá con su canal de
                Twitch/YouTube/Kick — y un cartel EN VIVO cuando esté transmitiendo.
              </p>
            </div>
          </div>
        ) : (
          <CastersGrid groups={groups} initialStatuses={statuses} featuredId={featuredId} />
        )}
      </main>
    </div>
  );
}
