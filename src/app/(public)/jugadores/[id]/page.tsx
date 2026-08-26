import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Star, ExternalLink, History, Trophy, MapPin, Swords, Users } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

interface PlayerPageData {
  id: string;
  displayName: string;
  country: string | null;
  clan: string | null;
  platform: string | null;
  isCaptain: boolean;
  isVerified: boolean;
  aoe2ProfileId: number;
  aoe2SteamId: string | null;
  maxRatingRm1v1: number | null;
  ratingRm1v1Current: number | null;
  ratingRm1v1Rank: number | null;
  team: {
    id: string;
    name: string;
    tagline: string | null;
    seed: number | null;
    editionName: string | null;
  } | null;
  matches: {
    id: string;
    status: string;
    format: string | null;
    scheduledAtStart: string | null;
    roundName: string | null;
    teamName: string;
    opponentName: string;
    isWin: boolean;
    isLoss: boolean;
    scoreFor: number;
    scoreAgainst: number;
  }[];
}

async function loadPlayer(id: string): Promise<PlayerPageData | null> {
  try {
    const supabase = await getSupabaseServer();

    const { data: player } = (await supabase
      .from("player_registration")
      .select("id, display_name, country, clan, platform, is_captain, is_verified, aoe2_profile_id, aoe2_steam_id, max_rating_rm_1v1, rating_rm_1v1_current, rating_rm_1v1_rank, team_registration_id")
      .eq("id", id)
      .maybeSingle()) as { data: any };

    if (!player) return null;

    // Team
    let team: PlayerPageData["team"] = null;
    if (player.team_registration_id) {
      const { data: reg } = (await supabase
        .from("team_registration")
        .select("id, seed, team_account:team_account_id ( id, name, tagline ), tournament_edition:tournament_edition_id ( name )")
        .eq("id", player.team_registration_id)
        .maybeSingle()) as { data: any };
      if (reg) {
        team = {
          id: reg.id,
          name: reg.team_account?.name ?? "—",
          tagline: reg.team_account?.tagline ?? null,
          seed: reg.seed ?? null,
          editionName: reg.tournament_edition?.name ?? null,
        };
      }
    }

    // Matches del equipo donde este player participó (todos los del equipo)
    const matches: PlayerPageData["matches"] = [];
    if (player.team_registration_id) {
      const { data: matchesA } = (await supabase
        .from("match")
        .select("id, status, format, scheduled_at_start, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id")
        .eq("team_a_id", player.team_registration_id)
        .in("status", ["finished", "forfeit"])
        .order("scheduled_at_start", { ascending: false, nullsFirst: false })
        .limit(20)) as { data: any };

      const { data: matchesB } = (await supabase
        .from("match")
        .select("id, status, format, scheduled_at_start, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id")
        .eq("team_b_id", player.team_registration_id)
        .in("status", ["finished", "forfeit"])
        .order("scheduled_at_start", { ascending: false, nullsFirst: false })
        .limit(20)) as { data: any };

      const allMatches: any[] = [...(matchesA ?? []), ...(matchesB ?? [])];
      const roundIds: string[] = allMatches.map((m) => m.round_id).filter(Boolean);
      const opponentIds: string[] = allMatches.map((m) => (m.team_a_id === player.team_registration_id ? m.team_b_id : m.team_a_id)).filter(Boolean);

      let roundMap: Record<string, string> = {};
      if (roundIds.length > 0) {
        const { data: rounds } = (await supabase.from("round").select("id, name").in("id", roundIds)) as { data: any };
        for (const r of rounds ?? []) roundMap[r.id] = r.name;
      }
      let oppMap: Record<string, string> = {};
      if (opponentIds.length > 0) {
        const { data: opps } = (await supabase
          .from("team_registration")
          .select("id, team_account:team_account_id ( name )")
          .in("id", opponentIds)) as { data: any };
        for (const o of opps ?? []) oppMap[o.id] = o.team_account?.name ?? "—";
      }

      for (const m of allMatches) {
        const isTeamA = m.team_a_id === player.team_registration_id;
        const oppId = isTeamA ? m.team_b_id : m.team_a_id;
        const scoreFor = isTeamA ? m.score_a ?? 0 : m.score_b ?? 0;
        const scoreAgainst = isTeamA ? m.score_b ?? 0 : m.score_a ?? 0;
        const isWin = m.winner_team_id === player.team_registration_id;
        const isLoss = !!m.winner_team_id && !isWin;
        matches.push({
          id: m.id,
          status: m.status,
          format: m.format ?? null,
          scheduledAtStart: m.scheduled_at_start ?? null,
          roundName: m.round_id ? roundMap[m.round_id] ?? null : null,
          teamName: team?.name ?? "—",
          opponentName: oppId ? oppMap[oppId] ?? "—" : "—",
          isWin,
          isLoss,
          scoreFor,
          scoreAgainst,
        });
      }

      matches.sort((a, b) => {
        const ta = a.scheduledAtStart ? new Date(a.scheduledAtStart).getTime() : 0;
        const tb = b.scheduledAtStart ? new Date(b.scheduledAtStart).getTime() : 0;
        return tb - ta;
      });
    }

    return {
      id: player.id,
      displayName: player.display_name ?? "—",
      country: player.country ?? null,
      clan: player.clan ?? null,
      platform: player.platform ?? null,
      isCaptain: !!player.is_captain,
      isVerified: !!player.is_verified,
      aoe2ProfileId: player.aoe2_profile_id,
      aoe2SteamId: player.aoe2_steam_id ?? null,
      maxRatingRm1v1: player.max_rating_rm_1v1 ?? null,
      ratingRm1v1Current: player.rating_rm_1v1_current ?? null,
      ratingRm1v1Rank: player.rating_rm_1v1_rank ?? null,
      team,
      matches,
    };
  } catch {
    return null;
  }
}

const COMPANION_URL = "https://aoe2companion.com/app/profile";

export default async function JugadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await loadPlayer(id);
  if (!data) notFound();

  const wins = data.matches.filter((m) => m.isWin).length;
  const losses = data.matches.filter((m) => m.isLoss).length;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">JUGADOR</span>
        </div>
        <div className="vertigo-header-right">
          {data.team && (
            <Link href={`/equipos/${data.team.id}`} className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
              ← {data.team.name}
            </Link>
          )}
        </div>
      </header>

      <main className="vertigo-content">
        {/* HEADER */}
        <div className="flex items-start gap-5 flex-wrap mb-8">
          <div
            className="flex items-center justify-center flex-none rounded-full border-2 font-cinzel font-bold"
            style={{
              width: 80,
              height: 80,
              borderColor: data.isCaptain ? "var(--vertigo-purple)" : "var(--vertigo-line)",
              color: data.isCaptain ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
              fontSize: 32,
            }}
          >
            {data.displayName.charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <span className="vertigo-kicker">JUGADOR</span>
            <h1 className="vertigo-title" style={{ marginBottom: 4 }}>{data.displayName}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {data.isCaptain && (
                <span className="vertigo-badge vertigo-badge-purple">
                  <Crown style={{ width: 11, height: 11 }} />
                  Capitán
                </span>
              )}
              {data.isVerified && (
                <span className="vertigo-badge vertigo-badge-success">
                  <Star style={{ width: 11, height: 11 }} />
                  Verificado
                </span>
              )}
              {data.country && (
                <span className="vertigo-badge vertigo-badge-purple">
                  <MapPin style={{ width: 11, height: 11 }} />
                  {data.country}
                </span>
              )}
              {data.clan && <span className="vertigo-badge vertigo-badge-purple">Clan: {data.clan}</span>}
              {data.platform && <span className="vertigo-badge vertigo-badge-purple">{data.platform}</span>}
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="vertigo-stats">
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">ELO Máx</div>
            <div className="vertigo-stat-value">{data.maxRatingRm1v1 ?? "—"}</div>
            <div className="vertigo-stat-sub">RM 1v1 histórico</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">ELO Actual</div>
            <div className="vertigo-stat-value">{data.ratingRm1v1Current ?? "—"}</div>
            <div className="vertigo-stat-sub">RM 1v1</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">Rank</div>
            <div className="vertigo-stat-value">{data.ratingRm1v1Rank ?? "—"}</div>
            <div className="vertigo-stat-sub">global</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">Win Rate</div>
            <div className="vertigo-stat-value">{winRate}%</div>
            <div className="vertigo-stat-sub">{wins}V · {losses}D</div>
          </div>
        </div>

        {/* LINK AOE2 COMPANION */}
        <div className="vertigo-card mb-8">
          <div className="vertigo-card-header">
            <div className="vertigo-card-title">
              <ExternalLink
                style={{ width: 16, height: 16, display: "inline", marginRight: 8, color: "var(--vertigo-purple-soft)" }}
              />
              Perfil AoE2 Companion
            </div>
            <span className="vertigo-badge vertigo-badge-purple">#{data.aoe2ProfileId}</span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="vertigo-info-card-label" style={{ marginBottom: 6 }}>Profile ID</div>
              <div className="vertigo-info-card-value">{data.aoe2ProfileId}</div>
              {data.aoe2SteamId && (
                <div className="text-[11px] text-[var(--vertigo-faint)] mt-2">
                  Steam ID: <span className="font-mono">{data.aoe2SteamId}</span>
                </div>
              )}
            </div>
            <a
              href={`${COMPANION_URL}/${data.aoe2ProfileId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="vertigo-btn vertigo-btn-primary"
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
              Ver en AoE2 Companion
            </a>
          </div>
        </div>

        {/* HISTORIAL */}
        <div className="vertigo-subtitle">
          <History style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
          Historial de partidos
        </div>
        {data.matches.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <History
                style={{ width: 40, height: 40, color: "var(--vertigo-faint)", margin: "0 auto 12px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Sin partidos jugados</div>
              <p className="vertigo-empty-desc">
                Cuando su equipo dispute el primer partido, va a aparecer acá.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {data.matches.map((m) => (
              <Link key={m.id} href={`/partido/${m.id}`} className="vertigo-link-card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] tracking-[1.5px] uppercase text-[var(--vertigo-faint)]">
                    {m.roundName ?? "—"}
                    {m.format && ` · ${m.format}`}
                  </span>
                  <div className="flex items-center gap-2">
                    {m.isWin && <span className="vertigo-badge vertigo-badge-success" style={{ fontSize: 9, padding: "3px 8px" }}>Victoria</span>}
                    {m.isLoss && <span className="vertigo-badge vertigo-badge-danger" style={{ fontSize: 9, padding: "3px 8px" }}>Derrota</span>}
                    {m.scheduledAtStart && (
                      <span className="text-[10px] text-[var(--vertigo-faint)]">
                        {fmt.dayMon(m.scheduledAtStart)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid items-center gap-3" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
                  <div className="flex items-center gap-2 min-w-0 justify-end flex-row-reverse">
                    {data.team?.seed != null && <span className="text-[10px] text-[var(--vertigo-faint)] flex-none">#{data.team.seed}</span>}
                    <span className={`text-[14px] truncate ${m.isWin ? "text-[var(--vertigo-text)] font-semibold" : "text-[var(--vertigo-muted)]"}`}>
                      {m.teamName}
                    </span>
                  </div>
                  <div className="font-cinzel text-2xl font-bold text-[var(--vertigo-purple-pale)] flex-none">
                    {m.scoreFor}<span className="text-[var(--vertigo-faint)] mx-2">—</span>{m.scoreAgainst}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[14px] truncate ${m.isLoss ? "text-[var(--vertigo-text)] font-semibold" : "text-[var(--vertigo-muted)]"}`}>
                      {m.opponentName}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* TEAM LINK */}
        {data.team && (
          <>
            <div className="vertigo-subtitle mt-8">
              <Users style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
              Equipo
            </div>
            <Link href={`/equipos/${data.team.id}`} className="vertigo-link-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Trophy
                    style={{ width: 28, height: 28, color: "var(--vertigo-purple-soft)" }}
                    strokeWidth={1.25}
                  />
                  <div className="min-w-0">
                    <div className="vertigo-link-card-title truncate">{data.team.name}</div>
                    {data.team.tagline && (
                      <div className="text-[12px] italic text-[var(--vertigo-muted)] truncate">
                        &ldquo;{data.team.tagline}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  {data.team.seed != null && <span className="vertigo-badge vertigo-badge-purple">#{data.team.seed}</span>}
                  {data.team.editionName && <span className="vertigo-badge vertigo-badge-purple">{data.team.editionName}</span>}
                  <Swords style={{ width: 14, height: 14, color: "var(--vertigo-faint)" }} />
                </div>
              </div>
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
