import Link from "next/link";
import { Mic, Twitch, Youtube, Crown, Users, Swords, Radio, ChevronRight } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { ART_PREDICADOR } from "@/lib/art";
import VertigoFooter from "@/components/shared/vertigo-footer";
import SiteNav from "@/components/nav/site-nav";
import HeroStat from "@/components/shared/hero-stat";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CasterRow {
  id: string;
  displayName: string;
  tier: string;
  twitchChannel: string | null;
  youtubeChannel: string | null;
  kickChannel: string | null;
  approvedAt: string | null;
  matchCount: number;
}

interface TierMeta {
  label: string;
  badge: string;
  rail: string;
  ring: string;
  group: string;
}

/** Identidad visual por tier: riel, aro del sello y nombre del grupo editorial. */
const TIER_META: Record<string, TierMeta> = {
  official: {
    label: "Oficial",
    badge: "vertigo-badge-warning",
    rail: "rgba(212,175,55,0.8)",
    ring: "rgba(212,175,55,0.65)",
    group: "Transmisión principal",
  },
  secondary: {
    label: "Secundario",
    badge: "vertigo-badge-purple",
    rail: "rgba(124,58,237,0.75)",
    ring: "rgba(124,58,237,0.55)",
    group: "Co-streams",
  },
  community: {
    label: "Community",
    badge: "vertigo-badge-success",
    rail: "rgba(34,197,94,0.6)",
    ring: "rgba(34,197,94,0.45)",
    group: "Comunidad",
  },
};

async function loadCasters(): Promise<CasterRow[]> {
  try {
    const supabase = await getSupabaseServer();

    const { data: castersRaw } = (await supabase
      .from("caster")
      .select("id, display_name, tier, twitch_channel, youtube_channel, kick_channel, approved_at")
      .not("approved_at", "is", null)
      .order("tier", { ascending: true })
      .order("display_name", { ascending: true })) as { data: any };

    if (!castersRaw || castersRaw.length === 0) return [];

    // Match count per caster
    const casterIds = castersRaw.map((c: any) => c.id);
    const { data: matches } = (await supabase
      .from("match")
      .select("stream_caster_id")
      .in("stream_caster_id", casterIds)) as { data: any };

    const countByCaster: Record<string, number> = {};
    for (const m of matches ?? []) {
      if (m.stream_caster_id) {
        countByCaster[m.stream_caster_id] = (countByCaster[m.stream_caster_id] ?? 0) + 1;
      }
    }

    return castersRaw.map((c: any) => ({
      id: c.id,
      displayName: c.display_name ?? "—",
      tier: c.tier ?? "community",
      twitchChannel: c.twitch_channel ?? null,
      youtubeChannel: c.youtube_channel ?? null,
      kickChannel: c.kick_channel ?? null,
      approvedAt: c.approved_at ?? null,
      matchCount: countByCaster[c.id] ?? 0,
    }));
  } catch {
    return [];
  }
}

export default async function CastersPage() {
  const casters = await loadCasters();
  const officials = casters.filter((c) => c.tier === "official").length;
  const secondaries = casters.filter((c) => c.tier === "secondary").length;
  const communities = casters.filter((c) => c.tier === "community").length;

  // Grupos editoriales por tier — solo los que tienen gente
  const groups = (["official", "secondary", "community"] as const)
    .map((tier) => ({ tier, meta: TIER_META[tier], items: casters.filter((c) => c.tier === tier) }))
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

            {/* Roster integrado al hero — vidrio sobre la imagen */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28, alignItems: "center" }}>
              <HeroStat value={casters.length} label="En el aire" color="var(--vertigo-purple-pale)" />
              <HeroStat value={officials} label="Oficiales" color="var(--vertigo-gold)" />
              <HeroStat value={secondaries} label="Secundarios" color="var(--vertigo-purple-soft)" />
              <HeroStat value={communities} label="Comunidad" color="var(--vertigo-success)" />
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
                Twitch/YouTube/Kick.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-10 flex flex-col gap-10">
            {groups.map(({ tier, meta, items }) => (
              <section key={tier}>
                {/* Header editorial del grupo */}
                <div className="flex items-center gap-3 mb-4">
                  <span style={{ color: meta.rail, display: "inline-flex", flex: "none" }}>
                    {tier === "official" ? (
                      <Crown style={{ width: 14, height: 14 }} />
                    ) : (
                      <Radio style={{ width: 14, height: 14 }} />
                    )}
                  </span>
                  <h2
                    className="font-cinzel font-bold"
                    style={{ fontSize: 16, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--vertigo-text)" }}
                  >
                    {meta.group}
                  </h2>
                  <div
                    className="flex-1 h-px"
                    style={{ background: `linear-gradient(90deg, ${meta.rail}, transparent)` }}
                  />
                  <span className="text-[10px] tracking-[1px]" style={{ color: "var(--vertigo-faint)" }}>
                    {items.length} caster{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
                >
                  {items.map((c) => (
                    <CasterCard key={c.id} c={c} meta={meta} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <VertigoFooter />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tarjeta de caster — sello con aro por tier + canales
// ─────────────────────────────────────────────────────────────

function CasterCard({ c, meta }: { c: CasterRow; meta: TierMeta }) {
  const plataformas = [c.twitchChannel, c.youtubeChannel, c.kickChannel].filter(Boolean).length;

  return (
    <div className="vertigo-card fx-card relative" style={{ padding: 0, overflow: "hidden" }}>
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: meta.rail }} aria-hidden />

      <div style={{ padding: "18px 20px 16px 23px" }}>
        <div className="flex items-center gap-3 min-w-0">
          {/* Sello con la inicial — aro dorado para oficiales */}
          <span
            className="flex items-center justify-center flex-none rounded-full font-cinzel font-bold"
            style={{
              width: 46,
              height: 46,
              fontSize: 18,
              color: meta.ring,
              border: `1.5px solid ${meta.ring}`,
              background: "rgba(124,58,237,0.08)",
              boxShadow: c.tier === "official" ? `0 0 14px ${meta.ring}44` : "none",
            }}
          >
            {c.displayName.charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-cinzel font-semibold text-[17px] text-[var(--vertigo-text)] truncate leading-tight">
              {c.displayName}
            </div>
            {c.approvedAt && (
              <div className="text-[10.5px] text-[var(--vertigo-faint)] mt-0.5">
                Al aire desde{" "}
                {fmt.dayMonYear(c.approvedAt)}
              </div>
            )}
          </div>
          <span className={`vertigo-badge ${meta.badge}`} style={{ flex: "none" }}>
            {meta.label}
          </span>
        </div>

        {/* Meta en una línea — sin cajitas */}
        <div
          className="flex items-center gap-x-5 gap-y-1 flex-wrap text-[11px] mt-3.5 mb-4"
          style={{ color: "var(--vertigo-faint)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Swords style={{ width: 11, height: 11, flex: "none" }} />
            {c.matchCount === 0
              ? "Estrena llave pronto"
              : c.matchCount === 1
              ? "1 llave transmitida"
              : `${c.matchCount} llaves transmitidas`}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users style={{ width: 11, height: 11, flex: "none" }} />
            {plataformas === 1 ? "1 plataforma" : `${plataformas} plataformas`}
          </span>
        </div>

        {/* Canales */}
        <div className="flex flex-wrap gap-2">
          {c.twitchChannel && (
            <a
              href={`https://twitch.tv/${c.twitchChannel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="vertigo-btn vertigo-btn-primary"
              style={{ padding: "8px 16px", fontSize: "11px" }}
            >
              <Twitch style={{ width: 13, height: 13 }} />
              Twitch
            </a>
          )}
          {c.youtubeChannel && (
            <a
              href={`https://youtube.com/@${c.youtubeChannel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="vertigo-btn vertigo-btn-ghost"
              style={{ padding: "8px 16px", fontSize: "11px" }}
            >
              <Youtube style={{ width: 13, height: 13 }} />
              YouTube
            </a>
          )}
          {c.kickChannel && (
            <a
              href={`https://kick.com/${c.kickChannel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="vertigo-btn vertigo-btn-ghost"
              style={{ padding: "8px 16px", fontSize: "11px" }}
            >
              Kick
            </a>
          )}
          {plataformas === 0 && (
            <span className="text-[12px] text-[var(--vertigo-faint)] italic">Sin canal configurado</span>
          )}
        </div>
      </div>
    </div>
  );
}
