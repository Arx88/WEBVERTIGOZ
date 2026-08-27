"use client";

/**
 * Rails estilo Netflix para la página de casters:
 *  - Fila "EN VIVO AHORA" con los canales al aire (thumbnail real si la
 *    plataforma la devuelve), ordenados por espectadores.
 *  - Filas por tier (principal / co-streams / comunidad) con posters 16:9.
 *  - Badges EN VIVO con re-poll cada 90s a /api/streams/live.
 */

import { useEffect, useMemo, useState } from "react";
import { Crown, Eye, Radio, Swords, Twitch, Users, Youtube } from "lucide-react";

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

export interface LiveStatusLite {
  live: boolean;
  viewers: number | null;
  title: string | null;
  game: string | null;
  thumbnail: string | null;
}

type LiveMap = Record<string, LiveStatusLite>;

const RAIL_TIERS = ["official", "secondary", "community"] as const;

function fmtViewers(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function LiveRails({
  groups,
  initialStatuses,
}: {
  groups: RailGroup[];
  initialStatuses: LiveMap;
}) {
  const [statuses, setStatuses] = useState<LiveMap>(initialStatuses);

  // Re-poll del estado en vivo: badges siempre frescos sin recargar la página.
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
        const data = (await res.json()) as LiveMap;
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

  /** Estado por canal de un caster; el primero es el "principal" (más viewers). */
  const liveChannels = (c: RailCaster) => {
    const out: { platform: "twitch" | "kick"; status: LiveStatusLite; url: string }[] = [];
    if (c.twitch) {
      const s = statuses[`twitch:${c.twitch.toLowerCase()}`];
      if (s?.live) out.push({ platform: "twitch", status: s, url: `https://twitch.tv/${c.twitch}` });
    }
    if (c.kick) {
      const s = statuses[`kick:${c.kick.toLowerCase()}`];
      if (s?.live) out.push({ platform: "kick", status: s, url: `https://kick.com/${c.kick}` });
    }
    return out.sort((a, b) => (b.status.viewers ?? 0) - (a.status.viewers ?? 0));
  };

  const isLive = (c: RailCaster) => liveChannels(c).length > 0;

  // Fila "EN VIVO AHORA": casters con al menos un canal al aire, por viewers.
  const liveNow = useMemo(() => {
    return groups
      .flatMap((g) => g.items)
      .filter(isLive)
      .sort((a, b) => {
        const va = Math.max(0, ...liveChannels(a).map((x) => x.status.viewers ?? 0));
        const vb = Math.max(0, ...liveChannels(b).map((x) => x.status.viewers ?? 0));
        return vb - va;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, statuses]);

  return (
    <div className="flex flex-col gap-10">
      {liveNow.length > 0 && (
        <section>
          <RailHeader
            icon={
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ef4444] opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
              </span>
            }
            title="En vivo ahora"
            accent="#ef4444"
            count={liveNow.length}
          />
          <div className="vertigo-rail">
            {liveNow.map((c) => (
              <CasterCard key={c.id} c={c} channels={liveChannels(c)} liveRow />
            ))}
          </div>
        </section>
      )}

      {RAIL_TIERS.map((tier) => {
        const g = groups.find((x) => x.tier === tier);
        if (!g || g.items.length === 0) return null;
        return (
          <section key={tier}>
            <RailHeader
              icon={tier === "official" ? <Crown style={{ width: 14, height: 14 }} /> : <Radio style={{ width: 14, height: 14 }} />}
              title={g.label}
              accent={g.color}
              count={g.items.length}
            />
            <div className="vertigo-rail">
              {g.items.map((c) => (
                <CasterCard key={c.id} c={c} channels={liveChannels(c)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function RailHeader({ icon, title, accent, count }: { icon: React.ReactNode; title: string; accent: string; count: number }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="inline-flex flex-none" style={{ color: accent }}>{icon}</span>
      <h2 className="font-cinzel text-[16px] font-bold uppercase tracking-[1.5px] text-[var(--vertigo-text)]">{title}</h2>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${accent}66, transparent)` }} />
      <span className="text-[10px] tracking-[1px] text-[var(--vertigo-faint)]">{count}</span>
    </div>
  );
}

function LiveBadge({ viewers, compact = false }: { viewers: number | null; compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-[#ef4444] font-bold uppercase tracking-[1px] text-white shadow-[0_2px_12px_rgba(239,68,68,0.5)]"
      style={{ padding: compact ? "2px 7px" : "3px 9px", fontSize: compact ? 9 : 10 }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      EN VIVO
      {viewers != null && viewers > 0 && (
        <span className="inline-flex items-center gap-0.5 opacity-90">
          <Eye style={{ width: 10, height: 10 }} />
          {fmtViewers(viewers)}
        </span>
      )}
    </span>
  );
}

function CasterCard({
  c,
  channels,
  liveRow = false,
}: {
  c: RailCaster;
  channels: { platform: "twitch" | "kick"; status: LiveStatusLite; url: string }[];
  liveRow?: boolean;
}) {
  const live = channels.length > 0;
  const primary = channels[0]?.status ?? null;

  return (
    <article
      className={`vertigo-card fx-card group relative flex-none transition-all duration-300 ${liveRow ? "w-[420px]" : "w-[300px]"}`}
      style={{
        padding: 0,
        overflow: "hidden",
        scrollSnapAlign: "start",
        borderColor: live ? "rgba(239,68,68,0.4)" : "var(--vertigo-line-soft)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = live
          ? "0 14px 34px rgba(0,0,0,0.55), 0 0 22px rgba(239,68,68,0.18)"
          : "0 14px 34px rgba(0,0,0,0.5), 0 0 22px rgba(212,175,55,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
      }}
    >
      {/* Poster 16:9 */}
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "16/9",
          background: `radial-gradient(120% 120% at 20% 0%, ${c.tierColor}22 0%, transparent 55%), linear-gradient(160deg, rgba(124,58,237,0.16), rgba(10,0,17,0.9))`,
        }}
      >
        {/* Thumbnail real si está en vivo */}
        {live && primary?.thumbnail && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primary.thumbnail}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ opacity: 0.55, filter: "saturate(1.1)" }}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,0,17,0.1), rgba(10,0,17,0.72))" }} />
          </>
        )}
        {/* Inicial gigante de fondo */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 bottom-1 select-none font-cinzel font-bold"
          style={{ fontSize: 88, lineHeight: 1, color: "rgba(212,175,55,0.10)" }}
        >
          {c.displayName.charAt(0).toUpperCase()}
        </span>

        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {live ? (
            <LiveBadge viewers={primary?.viewers ?? null} />
          ) : (
            <span className="rounded-md border border-[var(--vertigo-line-soft)] bg-[rgba(10,0,17,0.7)] px-2 py-[3px] text-[9px] font-bold uppercase tracking-[1px] text-[var(--vertigo-faint)] backdrop-blur-sm">
              Offline
            </span>
          )}
        </div>
        <span className={`vertigo-badge ${c.tierBadge} absolute top-3 right-3`} style={{ fontSize: 9 }}>
          {c.tierLabel}
        </span>

        {/* Juego actual */}
        {live && primary?.game && (
          <span className="absolute bottom-3 left-3 max-w-[75%] truncate rounded-md bg-[rgba(10,0,17,0.75)] px-2 py-1 text-[10px] font-semibold text-[#ffb4dc] backdrop-blur-sm">
            {primary.game}
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div className="flex items-center gap-2.5">
          <span
            className="flex flex-none items-center justify-center rounded-full font-cinzel font-bold"
            style={{
              width: 38, height: 38, fontSize: 16,
              color: c.tierColor, border: `1.5px solid ${c.tierColor}88`,
              background: "rgba(124,58,237,0.08)",
            }}
          >
            {c.displayName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate font-cinzel text-[16px] font-semibold text-[var(--vertigo-text)]">{c.displayName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[var(--vertigo-faint)]">
              <Swords style={{ width: 10, height: 10, flex: "none" }} />
              {c.matchCount === 0 ? "Estrena llave pronto" : `${c.matchCount} llave${c.matchCount !== 1 ? "s" : ""}`}
              <Users style={{ width: 10, height: 10, flex: "none", marginLeft: 6 }} />
              {[c.twitch, c.kick, c.youtube].filter(Boolean).length} plataformas
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.twitch && (
            <a href={`https://twitch.tv/${c.twitch}`} target="_blank" rel="noopener noreferrer" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "5px 10px", fontSize: 10 }}>
              <Twitch style={{ width: 12, height: 12 }} /> Twitch
            </a>
          )}
          {c.kick && (
            <a href={`https://kick.com/${c.kick}`} target="_blank" rel="noopener noreferrer" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "5px 10px", fontSize: 10 }}>
              Kick
            </a>
          )}
          {c.youtube && (
            <a href={`https://youtube.com/@${c.youtube}`} target="_blank" rel="noopener noreferrer" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "5px 10px", fontSize: 10 }}>
              <Youtube style={{ width: 12, height: 12 }} /> YouTube
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
