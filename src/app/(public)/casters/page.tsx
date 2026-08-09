import Link from "next/link";
import { Mic, Twitch, Youtube, CheckCircle2, Users } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";

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

const TIER_BADGE: Record<string, { label: string; cls: string }> = {
  official: { label: "Oficial", cls: "vertigo-badge-warning" },
  secondary: { label: "Secundario", cls: "vertigo-badge-purple" },
  community: { label: "Community", cls: "vertigo-badge-success" },
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

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">CASTERS</span>
        </div>
        <div className="vertigo-header-right">
          <span className="vertigo-badge vertigo-badge-purple">{casters.length} activos</span>
        </div>
      </header>

      <main className="vertigo-content">
        <span className="vertigo-kicker">CASTERS</span>
        <h1 className="vertigo-title">Casters del torneo</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Streamers oficiales y community que transmiten los partidos de VÉRTIGO. Tier oficial =
          transmisión principal en cada llave.
        </p>

        {/* Leyenda */}
        <div className="vertigo-action-bar mb-6">
          <span className="vertigo-badge vertigo-badge-warning">Oficial</span>
          <span className="vertigo-badge vertigo-badge-purple">Secundario</span>
          <span className="vertigo-badge vertigo-badge-success">Community</span>
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
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
          >
            {casters.map((c) => {
              const tierMeta = TIER_BADGE[c.tier] ?? TIER_BADGE.community;
              return (
                <div key={c.id} className="vertigo-card">
                  <div className="vertigo-card-header">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex items-center justify-center flex-none rounded-full border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)] font-cinzel font-bold"
                        style={{ width: 44, height: 44, fontSize: 18 }}
                      >
                        {c.displayName.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="vertigo-card-title truncate">{c.displayName}</div>
                        {c.approvedAt && (
                          <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">
                            Aprobado {new Date(c.approvedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`vertigo-badge ${tierMeta.cls}`}>{tierMeta.label}</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="vertigo-info-card">
                      <div className="vertigo-info-card-label">
                        <CheckCircle2 style={{ width: 11, height: 11 }} />
                        Partidos
                      </div>
                      <div className="vertigo-info-card-value">{c.matchCount}</div>
                    </div>
                    <div className="vertigo-info-card">
                      <div className="vertigo-info-card-label">
                        <Users style={{ width: 11, height: 11 }} />
                        Plataformas
                      </div>
                      <div className="vertigo-info-card-value">
                        {[c.twitchChannel, c.youtubeChannel, c.kickChannel].filter(Boolean).length}
                      </div>
                    </div>
                  </div>

                  {/* Canal links */}
                  <div className="vertigo-action-bar">
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
                    {!c.twitchChannel && !c.youtubeChannel && !c.kickChannel && (
                      <span className="text-[12px] text-[var(--vertigo-faint)] italic">
                        Sin canal configurado
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
