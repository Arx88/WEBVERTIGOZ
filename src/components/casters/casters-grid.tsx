"use client";

/**
 * Página de casters estilo plataforma de streaming (Kick/Netflix):
 *
 *  1. TEATRO: reproductor en vivo EMBEBIDO (Twitch/Kick) + chat de Twitch
 *     al costado. Si nadie está en vivo, el mismo espacio muestra el canal
 *     destacado (banner real, avatar, bio, seguidores) con el aviso de que
 *     la transmisión aparece acá automáticamente — la página nunca queda
 *     vacía y se enciende sola cuando empieza el stream (re-poll 90s).
 *  2. Grilla de tarjetas grandes por tier con banner, avatar, seguidores,
 *     bio y estado. El botón "Mirar ahora" de una tarjeta carga ese canal
 *     en el teatro.
 */

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BellRing,
  Crown,
  Eye,
  Play,
  Radio,
  Star,
  Swords,
  Twitch,
  Users,
  Youtube,
} from "lucide-react";

export interface RailCaster {
  id: string;
  displayName: string;
  tier: string;
  tierLabel: string;
  tierColor: string;
  tierBadge: string;
  twitch: string | null;
  youtube: string | null;
  kick: string | null;
  matchCount: number;
}

export interface RailGroup {
  tier: string;
  label: string;
  color: string;
  items: RailCaster[];
}

export interface ChannelStatusLite {
  platform: "twitch" | "kick";
  channel: string;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followers: number | null;
  bio: string | null;
  verified: boolean;
  live: boolean;
  viewers: number | null;
  title: string | null;
  game: string | null;
  thumbnail: string | null;
  lastLiveAt: string | null;
  lastTitle: string | null;
}

type StatusMap = Record<string, ChannelStatusLite>;

const RAIL_TIERS = ["official", "secondary", "community"] as const;

function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  if (mins < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
}

export default function CastersGrid({
  groups,
  initialStatuses,
  featuredId,
}: {
  groups: RailGroup[];
  initialStatuses: StatusMap;
  featuredId?: string | null;
}) {
  const [statuses, setStatuses] = useState<StatusMap>(initialStatuses);
  const [theaterId, setTheaterId] = useState<string | null>(null);
  const [host, setHost] = useState("");

  useEffect(() => setHost(window.location.hostname), []);

  // Re-poll del estado en vivo sin recargar la página.
  useEffect(() => {
    const twitchKeys = new Set<string>();
    const kickKeys = new Set<string>();
    for (const g of groups)
      for (const c of g.items) {
        if (c.twitch) twitchKeys.add(c.twitch.toLowerCase());
        if (c.kick) kickKeys.add(c.kick.toLowerCase());
      }
    if (twitchKeys.size === 0 && kickKeys.size === 0) return;

    let cancelled = false;
    const qs = new URLSearchParams();
    if (twitchKeys.size) qs.set("twitch", [...twitchKeys].join(","));
    if (kickKeys.size) qs.set("kick", [...kickKeys].join(","));

    const poll = async () => {
      try {
        const res = await fetch(`/api/streams/live?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as StatusMap;
        if (!cancelled) setStatuses(data);
      } catch {
        /* offline: se mantiene el último estado */
      }
    };
    const t = setInterval(poll, 90_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [groups]);

  const channelStatuses = (c: RailCaster): ChannelStatusLite[] => {
    const out: ChannelStatusLite[] = [];
    if (c.twitch) {
      const s = statuses[`twitch:${c.twitch.toLowerCase()}`];
      if (s) out.push(s);
    }
    if (c.kick) {
      const s = statuses[`kick:${c.kick.toLowerCase()}`];
      if (s) out.push(s);
    }
    return out;
  };

  const liveStatuses = (c: RailCaster) => channelStatuses(c).filter((s) => s.live);
  const isLive = (c: RailCaster) => liveStatuses(c).length > 0;

  const liveNow = useMemo(() => {
    return groups
      .flatMap((g) => g.items)
      .filter(isLive)
      .sort((a, b) => {
        const va = Math.max(0, ...liveStatuses(a).map((s) => s.viewers ?? 0));
        const vb = Math.max(0, ...liveStatuses(b).map((s) => s.viewers ?? 0));
        return vb - va;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, statuses]);

  const allCasters = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const featured = featuredId ? allCasters.find((c) => c.id === featuredId) ?? null : null;

  // Prioridad del teatro: click manual > destacado EN VIVO > el más visto >
  // destacado off-air (vitrina) > el primero con canal.
  const theaterCaster =
    allCasters.find((c) => c.id === theaterId) ??
    (featured && isLive(featured) ? featured : null) ??
    liveNow[0] ??
    featured ??
    allCasters.find((c) => c.twitch || c.kick) ??
    null;

  function watch(casterId: string) {
    setTheaterId(casterId);
    document.getElementById("theater")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col" style={{ gap: 56 }}>
      {theaterCaster && (
        <div id="theater" className="scroll-mt-24">
          <Theater
            caster={theaterCaster}
            all={channelStatuses(theaterCaster)}
            live={liveStatuses(theaterCaster)}
            host={host}
          />
        </div>
      )}

      {liveNow.length > 0 && (
        <section>
          <SectionHeader
            icon={
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ef4444] opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ef4444]" />
              </span>
            }
            title="En vivo ahora"
            accent="#ef4444"
            count={liveNow.length}
          />
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))" }}>
            {liveNow.map((c) => (
              <CasterCard key={c.id} c={c} all={channelStatuses(c)} lives={liveStatuses(c)} onWatch={watch} featured={c.id === featuredId} />
            ))}
          </div>
        </section>
      )}

      {RAIL_TIERS.map((tier) => {
        const g = groups.find((x) => x.tier === tier);
        if (!g || g.items.length === 0) return null;
        return (
          <section key={tier}>
            <SectionHeader
              icon={tier === "official" ? <Crown style={{ width: 15, height: 15 }} /> : <Radio style={{ width: 15, height: 15 }} />}
              title={g.label}
              accent={g.color}
              count={g.items.length}
            />
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(400px, 1fr))" }}>
              {g.items.map((c) => (
                <CasterCard key={c.id} c={c} all={channelStatuses(c)} lives={liveStatuses(c)} onWatch={watch} featured={c.id === featuredId} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SectionHeader({ icon, title, accent, count }: { icon: React.ReactNode; title: string; accent: string; count?: number }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="inline-flex flex-none" style={{ color: accent }}>{icon}</span>
      <h2 className="font-cinzel text-[19px] font-bold uppercase tracking-[1.5px] text-[var(--vertigo-text)]">{title}</h2>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }} />
      {count != null && <span className="text-[10px] tracking-[1px] text-[var(--vertigo-faint)]">{count}</span>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TEATRO — player embebido + chat (live) / vitrina del canal (offline)
// ════════════════════════════════════════════════════════════

function Theater({
  caster,
  all,
  live,
  host,
}: {
  caster: RailCaster;
  all: ChannelStatusLite[];
  live: ChannelStatusLite[];
  host: string;
}) {
  // Canal reproducido: twitch en vivo > kick en vivo > twitch > kick.
  const st =
    live.find((s) => s.platform === "twitch") ??
    live[0] ??
    all.find((s) => s.platform === "twitch") ??
    all[0] ??
    null;
  const other = all.find((s) => s !== st) ?? null;
  const isLive = !!st?.live;

  const avatar = st?.avatarUrl ?? other?.avatarUrl ?? null;
  const banner = (isLive ? st?.thumbnail : null) ?? st?.bannerUrl ?? other?.bannerUrl ?? null;
  const followers = [st?.followers, other?.followers].filter((n): n is number => typeof n === "number");
  const maxFollowers = followers.length ? Math.max(...followers) : null;
  const bio = st?.bio ?? other?.bio ?? null;
  const verified = (st?.verified ?? false) || (other?.verified ?? false);
  const lastLive = st?.lastLiveAt ?? other?.lastLiveAt ?? null;

  const chan = st?.platform === "twitch" ? caster.twitch : caster.kick;

  return (
    <section>
      <SectionHeader
        icon={
          isLive ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ef4444] opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ef4444]" />
            </span>
          ) : (
            <Radio style={{ width: 15, height: 15 }} />
          )
        }
        title={isLive ? `${caster.displayName} · en vivo` : `${caster.displayName} · canal oficial`}
        accent={isLive ? "#ef4444" : caster.tierColor}
        count={live.length > 0 ? live.length : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_310px]">
        {/* Player / vitrina */}
        <div className="flex flex-col gap-4">
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{
              aspectRatio: "16/9",
              borderColor: isLive ? "rgba(239,68,68,0.45)" : "var(--vertigo-line-soft)",
              boxShadow: isLive ? "0 0 40px rgba(239,68,68,0.14)" : "var(--shadow-lg)",
              background: "#0a0011",
            }}
          >
            {isLive && host && chan && st?.platform === "twitch" && (
              <iframe
                key={`tw-${chan}`}
                src={`https://player.twitch.tv/?channel=${chan}&parent=${host}&autoplay=true&muted=true`}
                title={`${caster.displayName} en Twitch`}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            )}
            {isLive && host && chan && st?.platform === "kick" && (
              <iframe
                key={`kk-${chan}`}
                src={`https://player.kick.com/${chan}`}
                title={`${caster.displayName} en Kick`}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            )}
            {!isLive && <OffAirStage caster={caster} banner={banner} avatar={avatar} bio={bio} followers={maxFollowers} verified={verified} lastLive={lastLive} />}
          </div>

          {/* Barra de datos bajo el player */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1px] text-white ${
                isLive ? "bg-[#ef4444]" : "border border-[var(--vertigo-line-soft)] text-[var(--vertigo-faint)]"
              }`}
              style={isLive ? { boxShadow: "0 2px 12px rgba(239,68,68,0.5)" } : undefined}
            >
              {isLive ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  EN VIVO
                  {(st?.viewers ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5">
                      <Eye style={{ width: 11, height: 11 }} />
                      {fmtNum(st!.viewers!)}
                    </span>
                  )}
                </>
              ) : (
                "OFFLINE"
              )}
            </span>
            {isLive && st?.title && (
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--vertigo-text)]">{st.title}</span>
            )}
            {isLive && st?.game && (
              <span className="rounded-md bg-[rgba(124,58,237,0.15)] px-2 py-1 text-[11px] font-semibold text-[#d9c6ff]">{st.game}</span>
            )}
            {maxFollowers != null && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--vertigo-muted)]">
                <Users style={{ width: 12, height: 12 }} />
                {fmtNum(maxFollowers)} seguidores
              </span>
            )}
          </div>
        </div>

        {/* Chat de Twitch (solo live) / panel lateral */}
        {isLive && st?.platform === "twitch" && host && caster.twitch ? (
          <div
            className="hidden overflow-hidden rounded-2xl border border-[var(--vertigo-line-soft)] lg:block"
            style={{ minHeight: 320 }}
          >
            <iframe
              key={`chat-${caster.twitch}`}
              src={`https://www.twitch.tv/embed/${caster.twitch}/chat?parent=${host}&darkpopout`}
              title="Chat"
              className="h-full w-full"
              style={{ minHeight: 320 }}
            />
          </div>
        ) : (
          <aside
            className="hidden flex-col justify-between gap-4 rounded-2xl border border-[var(--vertigo-line-soft)] bg-[rgba(255,255,255,0.02)] p-5 lg:flex"
          >
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[2px] text-[var(--vertigo-faint)]">
                <BellRing style={{ width: 12, height: 12, color: "#D4AF37" }} />
                Próxima transmisión
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--vertigo-muted)]">
                Cuando {caster.displayName} empiece a transmitir, el stream se reproduce
                acá automáticamente — sin recargar la página.
              </p>
              {lastLive && (
                <p className="mt-3 text-[11.5px] text-[var(--vertigo-faint)]">
                  Último stream {fmtRelative(lastLive)}
                  {st?.lastTitle ?? null ? <> — &ldquo;{st?.lastTitle}&rdquo;</> : null}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <ChannelBtns caster={caster} size="big" />
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}

/** Vitrina off-air dentro del marco 16:9: banner real + identidad + canales. */
function OffAirStage({
  caster,
  banner,
  avatar,
  bio,
  followers,
  verified,
  lastLive,
}: {
  caster: RailCaster;
  banner: string | null;
  avatar: string | null;
  bio: string | null;
  followers: number | null;
  verified: boolean;
  lastLive: string | null;
}) {
  return (
    <div className="absolute inset-0">
      {banner && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.5 }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,0,17,0.35), rgba(10,0,17,0.92))" }} />
        </>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt={caster.displayName}
            className="rounded-full object-cover"
            style={{ width: 76, height: 76, border: `2px solid ${caster.tierColor}`, boxShadow: "0 8px 28px rgba(0,0,0,0.6)" }}
          />
        ) : null}
        <div className="flex items-center gap-2">
          <span className="font-cinzel text-[24px] font-bold text-white" style={{ textShadow: "0 2px 16px rgba(0,0,0,0.8)" }}>
            {caster.displayName}
          </span>
          {verified && <BadgeCheck style={{ width: 18, height: 18, color: "#a78bfa" }} />}
        </div>
        {bio && <p className="line-clamp-2 max-w-[560px] text-[13px] italic text-[var(--vertigo-muted)]">&ldquo;{bio}&rdquo;</p>}
        <div className="flex items-center gap-4 text-[12px] text-[var(--vertigo-faint)]">
          {followers != null && (
            <span className="inline-flex items-center gap-1.5">
              <Users style={{ width: 12, height: 12 }} />
              {fmtNum(followers)} seguidores
            </span>
          )}
          {lastLive && <span>Último stream {fmtRelative(lastLive)}</span>}
        </div>
        <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-[rgba(212,175,55,0.35)] bg-[rgba(212,175,55,0.08)] px-4 py-1.5 text-[11px] font-semibold text-[#e8cd6f]">
          <BellRing style={{ width: 12, height: 12 }} />
          La transmisión aparece acá cuando empiece
        </span>
      </div>
    </div>
  );
}

function ChannelBtns({ caster, size = "small" }: { caster: RailCaster; size?: "small" | "big" }) {
  const pad = size === "big" ? { padding: "9px 16px", fontSize: 12 } : { padding: "7px 14px", fontSize: 11 };
  return (
    <>
      {caster.twitch && (
        <a href={`https://twitch.tv/${caster.twitch}`} target="_blank" rel="noopener noreferrer" className="vertigo-btn vertigo-btn-ghost" style={pad}>
          <Twitch style={{ width: 13, height: 13 }} /> Twitch
        </a>
      )}
      {caster.kick && (
        <a href={`https://kick.com/${caster.kick}`} target="_blank" rel="noopener noreferrer" className="vertigo-btn vertigo-btn-ghost" style={pad}>
          Kick
        </a>
      )}
      {caster.youtube && (
        <a href={`https://youtube.com/@${caster.youtube}`} target="_blank" rel="noopener noreferrer" className="vertigo-btn vertigo-btn-ghost" style={pad}>
          <Youtube style={{ width: 13, height: 13 }} /> YouTube
        </a>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
// Tarjetas de la grilla
// ════════════════════════════════════════════════════════════

function CasterCard({
  c,
  all,
  lives,
  onWatch,
  featured = false,
}: {
  c: RailCaster;
  all: ChannelStatusLite[];
  lives: ChannelStatusLite[];
  onWatch: (id: string) => void;
  featured?: boolean;
}) {
  const live = lives.length > 0;
  const primary =
    lives.find((s) => s.platform === "twitch") ??
    lives[0] ??
    all.find((s) => s.platform === "twitch") ??
    all[0] ??
    null;
  const other = all.find((s) => s !== primary) ?? null;

  const avatar = primary?.avatarUrl ?? other?.avatarUrl ?? null;
  const banner = (live ? primary?.thumbnail : null) ?? primary?.bannerUrl ?? other?.bannerUrl ?? null;
  const followers = [primary?.followers, other?.followers].filter((n): n is number => typeof n === "number");
  const maxFollowers = followers.length ? Math.max(...followers) : null;
  const bio = primary?.bio ?? other?.bio ?? null;
  const verified = (primary?.verified ?? false) || (other?.verified ?? false);
  const lastLive = primary?.lastLiveAt ?? other?.lastLiveAt ?? null;
  const lastTitle = primary?.lastTitle ?? other?.lastTitle ?? null;

  return (
    <article
      className="vertigo-card group relative overflow-hidden transition-all duration-300"
      style={{
        padding: 0,
        borderColor: live ? "rgba(239,68,68,0.45)" : "var(--vertigo-line-soft)",
        boxShadow: live ? "0 0 34px rgba(239,68,68,0.12)" : "none",
        cursor: "pointer",
      }}
      onClick={() => onWatch(c.id)}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = live
          ? "0 18px 44px rgba(0,0,0,0.55), 0 0 30px rgba(239,68,68,0.2)"
          : "0 18px 44px rgba(0,0,0,0.5), 0 0 26px rgba(212,175,55,0.13)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = live ? "0 0 34px rgba(239,68,68,0.12)" : "none";
      }}
    >
      {/* Banner 16:9 — imagen real del canal */}
      <div className="relative" style={{ aspectRatio: "16/9", background: "linear-gradient(160deg, rgba(124,58,237,0.2), rgba(10,0,17,0.95))" }}>
        {banner && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              style={{ opacity: live ? 0.72 : 0.85 }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
            <div
              className="absolute inset-0"
              style={{
                background: live
                  ? "linear-gradient(180deg, rgba(10,0,17,0.05) 30%, rgba(10,0,17,0.88) 100%)"
                  : "linear-gradient(180deg, rgba(10,0,17,0.25) 0%, rgba(10,0,17,0.94) 100%)",
              }}
            />
          </>
        )}
        {!banner && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-cinzel font-bold"
            style={{ fontSize: 110, color: "rgba(212,175,55,0.13)" }}
          >
            {c.displayName.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="absolute top-3.5 left-3.5">
          {live ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-md bg-[#ef4444] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[1px] text-white"
              style={{ boxShadow: "0 2px 14px rgba(239,68,68,0.55)" }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              EN VIVO
              {(primary?.viewers ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Eye style={{ width: 11, height: 11 }} />
                  {fmtNum(primary!.viewers!)}
                </span>
              )}
            </span>
          ) : (
            <span className="rounded-md border border-[var(--vertigo-line-soft)] bg-[rgba(10,0,17,0.72)] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[1.2px] text-[var(--vertigo-faint)] backdrop-blur-sm">
              Offline
            </span>
          )}
        </div>
        <div className="absolute top-3.5 right-3.5 flex flex-none items-center gap-1.5">
          {featured && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-[rgba(212,175,55,0.5)] bg-[rgba(212,175,55,0.12)] px-2 py-[3px] text-[9px] font-bold uppercase tracking-[1px] text-[#e8cd6f] backdrop-blur-sm"
            >
              <Star style={{ width: 10, height: 10, fill: "currentColor" }} />
              Destacado
            </span>
          )}
          <span className={`vertigo-badge ${c.tierBadge}`} style={{ fontSize: 9.5 }}>
            {c.tierLabel}
          </span>
        </div>

        {live && primary?.title && (
          <div className="absolute right-3.5 bottom-3.5 left-3.5">
            <div className="truncate text-[13px] font-semibold text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
              {primary.title}
            </div>
            {primary.game && (
              <div className="mt-0.5 text-[11px] font-medium text-[#ffb4dc]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)" }}>
                {primary.game}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Identidad + datos */}
      <div style={{ padding: "0 20px 20px" }}>
        <div className="-mt-8 flex items-end gap-3.5">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={c.displayName}
              className="relative flex-none rounded-full object-cover"
              style={{
                width: 64,
                height: 64,
                border: `2px solid ${live ? "#ef4444" : c.tierColor}`,
                boxShadow: "0 6px 20px rgba(0,0,0,0.55), 0 0 0 4px rgba(10,0,17,0.85)",
                background: "#150a20",
              }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
          ) : (
            <span
              className="font-cinzel relative flex flex-none items-center justify-center rounded-full font-bold"
              style={{
                width: 64, height: 64, fontSize: 24,
                color: c.tierColor, border: `2px solid ${c.tierColor}`,
                background: "#150a20", boxShadow: "0 6px 20px rgba(0,0,0,0.55)",
              }}
            >
              {c.displayName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1" style={{ paddingBottom: 2 }}>
            <div className="flex items-center gap-1.5">
              <span className="truncate font-cinzel text-[20px] font-bold leading-tight text-[var(--vertigo-text)]">{c.displayName}</span>
              {verified && <BadgeCheck style={{ width: 16, height: 16, color: "#7c3aed", flex: "none" }} />}
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[var(--vertigo-faint)]">
              {maxFollowers != null && (
                <span className="inline-flex items-center gap-1">
                  <Users style={{ width: 11, height: 11 }} />
                  {fmtNum(maxFollowers)} seguidores
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Swords style={{ width: 11, height: 11 }} />
                {c.matchCount === 0 ? "Estrena llave" : `${c.matchCount} llave${c.matchCount !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>
        </div>

        {live ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWatch(c.id);
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[12px] font-bold uppercase tracking-[1.5px] text-white transition-transform hover:scale-[1.015]"
            style={{
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              boxShadow: "0 4px 18px rgba(239,68,68,0.35)",
            }}
          >
            <Play style={{ width: 13, height: 13, fill: "white" }} />
            Mirar ahora
          </button>
        ) : (
          (bio || lastLive) && (
            <div className="mt-3.5 border-l-2 pl-3" style={{ borderColor: "rgba(212,175,55,0.35)" }}>
              {bio ? (
                <p className="line-clamp-2 text-[12px] italic leading-relaxed text-[var(--vertigo-muted)]">&ldquo;{bio}&rdquo;</p>
              ) : (
                lastLive && (
                  <p className="text-[11.5px] text-[var(--vertigo-muted)]">
                    Último stream {fmtRelative(lastLive)}
                    {lastTitle && <> — &ldquo;{lastTitle}&rdquo;</>}
                  </p>
                )
              )}
            </div>
          )
        )}

        <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          <ChannelBtns caster={c} />
        </div>
      </div>
    </article>
  );
}
