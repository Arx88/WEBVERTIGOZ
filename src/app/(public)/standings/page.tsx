import Link from "next/link";
import { Trophy, Medal, TrendingUp } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import SiteNav from "@/components/nav/site-nav";

export const dynamic = "force-dynamic";

interface StandRow {
  teamId: string;
  teamName: string;
  seed: number | null;
  wins: number;
  losses: number;
  scoreFor: number;
  scoreAgainst: number;
}

async function loadStandings(): Promise<StandRow[]> {
  try {
    const supabase = await getSupabaseServer();

    const { data: matchesRaw } = (await supabase
      .from("match")
      .select("id, status, score_a, score_b, winner_team_id, team_a_id, team_b_id")
      .in("status", ["finished", "forfeit"])
      .limit(200)) as { data: any };

    if (!matchesRaw || matchesRaw.length === 0) return [];

    const teamIds: string[] = [];
    for (const m of matchesRaw) {
      if (m.team_a_id) teamIds.push(m.team_a_id);
      if (m.team_b_id) teamIds.push(m.team_b_id);
    }
    const uniqueIds = Array.from(new Set(teamIds));

    let teamMap: Record<string, { name: string; seed: number | null }> = {};
    if (uniqueIds.length > 0) {
      const { data: teams } = (await supabase
        .from("team_registration")
        .select("id, seed, team_account:team_account_id ( name )")
        .in("id", uniqueIds)) as { data: any };
      for (const t of teams ?? []) {
        teamMap[t.id] = {
          name: t.team_account?.name ?? "—",
          seed: t.seed ?? null,
        };
      }
    }

    const stats: Record<string, StandRow> = {};
    for (const m of matchesRaw) {
      const a = m.team_a_id;
      const b = m.team_b_id;
      if (a && !stats[a]) {
        stats[a] = {
          teamId: a,
          teamName: teamMap[a]?.name ?? "—",
          seed: teamMap[a]?.seed ?? null,
          wins: 0,
          losses: 0,
          scoreFor: 0,
          scoreAgainst: 0,
        };
      }
      if (b && !stats[b]) {
        stats[b] = {
          teamId: b,
          teamName: teamMap[b]?.name ?? "—",
          seed: teamMap[b]?.seed ?? null,
          wins: 0,
          losses: 0,
          scoreFor: 0,
          scoreAgainst: 0,
        };
      }
      if (a && b) {
        stats[a].scoreFor += m.score_a ?? 0;
        stats[a].scoreAgainst += m.score_b ?? 0;
        stats[b].scoreFor += m.score_b ?? 0;
        stats[b].scoreAgainst += m.score_a ?? 0;
        if (m.winner_team_id === a) {
          stats[a].wins += 1;
          stats[b].losses += 1;
        } else if (m.winner_team_id === b) {
          stats[b].wins += 1;
          stats[a].losses += 1;
        }
      }
    }

    return Object.values(stats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const diffA = a.scoreFor - a.scoreAgainst;
      const diffB = b.scoreFor - b.scoreAgainst;
      if (diffB !== diffA) return diffB - diffA;
      return b.scoreFor - a.scoreFor;
    });
  } catch {
    return [];
  }
}

export default async function StandingsPage() {
  const rows = await loadStandings();

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <SiteNav />

      <main className="vertigo-content">
        <span className="vertigo-kicker">STANDINGS</span>
        <h1 className="vertigo-title">Tabla de posiciones</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Ranking por victorias · diferencia de score · score a favor. El #1 de cada edición
          obtiene el título VÉRTIGO.
        </p>

        {rows.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Trophy
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Tabla vacía</div>
              <p className="vertigo-empty-desc">
                Apenas se dispute el primer partido, los equipos van a aparecer ordenados acá.
              </p>
            </div>
          </div>
        ) : (
          <div className="vertigo-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="vertigo-scroll" style={{ overflowX: "auto" }}>
              <table className="vertigo-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>#</th>
                    <th>Equipo</th>
                    <th style={{ width: 70, textAlign: "center" }}>V</th>
                    <th style={{ width: 70, textAlign: "center" }}>D</th>
                    <th style={{ width: 90, textAlign: "center" }}>SF</th>
                    <th style={{ width: 90, textAlign: "center" }}>SC</th>
                    <th style={{ width: 90, textAlign: "center" }}>Dif</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const pos = idx + 1;
                    const diff = row.scoreFor - row.scoreAgainst;
                    const isFirst = pos === 1;
                    return (
                      <tr key={row.teamId}>
                        <td>
                          <div className="flex items-center gap-2">
                            {isFirst ? (
                              <Trophy style={{ width: 14, height: 14, color: "var(--vertigo-purple-pale)" }} strokeWidth={1.5} />
                            ) : pos === 2 ? (
                              <Medal style={{ width: 14, height: 14, color: "var(--vertigo-faint)" }} strokeWidth={1.5} />
                            ) : pos === 3 ? (
                              <Medal style={{ width: 14, height: 14, color: "var(--vertigo-faint)" }} strokeWidth={1.5} />
                            ) : (
                              <span className="text-[var(--vertigo-faint)] tabular-nums">{pos}</span>
                            )}
                            {isFirst && (
                              <span className="vertigo-badge vertigo-badge-warning" style={{ fontSize: 9, padding: "2px 7px" }}>
                                #1
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2 min-w-0">
                            <Link
                              href={`/equipos/${row.teamId}`}
                              className={`truncate hover:text-[var(--vertigo-purple-pale)] transition-colors ${isFirst ? "text-[var(--vertigo-purple-pale)] font-semibold" : "text-[var(--vertigo-text)]"}`}
                              style={{ textDecoration: "none" }}
                            >
                              {row.teamName}
                            </Link>
                            {row.seed != null && (
                              <span className="text-[10px] text-[var(--vertigo-faint)] flex-none">#{row.seed}</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="font-cinzel font-bold text-[var(--vertigo-success)]">{row.wins}</span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className="font-cinzel font-bold text-[var(--vertigo-danger)]">{row.losses}</span>
                        </td>
                        <td style={{ textAlign: "center" }} className="tabular-nums">{row.scoreFor}</td>
                        <td style={{ textAlign: "center" }} className="tabular-nums">{row.scoreAgainst}</td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            className={`tabular-nums font-semibold ${diff > 0 ? "text-[var(--vertigo-success)]" : diff < 0 ? "text-[var(--vertigo-danger)]" : "text-[var(--vertigo-faint)]"}`}
                          >
                            {diff > 0 ? "+" : ""}{diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="vertigo-action-bar mt-4">
          <span className="vertigo-badge vertigo-badge-warning">
            <Trophy style={{ width: 11, height: 11 }} />
            #1 — Campeón
          </span>
          <span className="vertigo-badge vertigo-badge-purple">
            <TrendingUp style={{ width: 11, height: 11 }} />
            Orden: V · Dif · SF
          </span>
        </div>
      </main>
    </div>
  );
}
