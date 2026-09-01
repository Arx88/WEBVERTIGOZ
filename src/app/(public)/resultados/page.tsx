import Link from "next/link";
import { Trophy, Swords, AlertTriangle, Clock } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import SiteNav from "@/components/nav/site-nav";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

interface ResultadoRow {
  id: string;
  status: string;
  format: string | null;
  scheduledAtStart: string | null;
  finishedAt: string | null;
  roundName: string | null;
  teamA: { id: string; name: string; seed: number | null; emblemUrl: string | null; tagline: string | null } | null;
  teamB: { id: string; name: string; seed: number | null; emblemUrl: string | null; tagline: string | null } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
}

async function loadResultados(): Promise<ResultadoRow[]> {
  try {
    const supabase = await getSupabaseServer();

    const { data: matchesRaw } = (await supabase
      .from("match")
      .select("id, status, format, scheduled_at_start, finished_at, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id")
      .in("status", ["finished", "forfeit", "disputed"])
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(60)) as { data: any };

    if (!matchesRaw || matchesRaw.length === 0) return [];

    const roundIds: string[] = matchesRaw.map((m: any) => m.round_id).filter(Boolean);
    let roundMap: Record<string, string> = {};
    if (roundIds.length > 0) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id, name")
        .in("id", roundIds)) as { data: any };
      for (const r of rounds ?? []) roundMap[r.id] = r.name;
    }

    const teamIds: string[] = [];
    for (const m of matchesRaw) {
      if (m.team_a_id) teamIds.push(m.team_a_id);
      if (m.team_b_id) teamIds.push(m.team_b_id);
    }
    let teamMap: Record<string, { name: string; seed: number | null; emblemUrl: string | null; tagline: string | null }> = {};
    if (teamIds.length > 0) {
      const { data: teams } = (await supabase
        .from("team_registration")
        .select("id, seed, team_account:team_account_id ( name, tagline, emblem:emblem_id ( image_url ) )")
        .in("id", teamIds)) as { data: any };
      for (const t of teams ?? []) {
        teamMap[t.id] = {
          name: t.team_account?.name ?? "—",
          seed: t.seed ?? null,
          emblemUrl: t.team_account?.emblem?.image_url ?? null,
          tagline: t.team_account?.tagline ?? null,
        };
      }
    }

    return matchesRaw.map((m: any) => ({
      id: m.id,
      status: m.status,
      format: m.format ?? null,
      scheduledAtStart: m.scheduled_at_start ?? null,
      finishedAt: m.finished_at ?? null,
      roundName: m.round_id ? roundMap[m.round_id] ?? null : null,
      teamA: m.team_a_id
        ? { id: m.team_a_id, ...teamMap[m.team_a_id] } : null,
      teamB: m.team_b_id
        ? { id: m.team_b_id, ...teamMap[m.team_b_id] } : null,
      scoreA: m.score_a ?? 0,
      scoreB: m.score_b ?? 0,
      winnerTeamId: m.winner_team_id ?? null,
    }));
  } catch {
    return [];
  }
}

/** Estado de la llave con la semántica del sitio (badge + icono). */
function statusBadge(status: string, format: string | null) {
  if (status === "disputed") {
    return (
      <span className="vertigo-badge vertigo-badge-danger" style={{ fontSize: 9, padding: "3px 10px" }}>
        <AlertTriangle style={{ width: 10, height: 10 }} /> Disputa
      </span>
    );
  }
  if (status === "forfeit") {
    return (
      <span className="vertigo-badge vertigo-badge-danger" style={{ fontSize: 9, padding: "3px 10px" }}>
        <Swords style={{ width: 10, height: 10 }} /> W.O.
      </span>
    );
  }
  return (
    <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: 9, padding: "3px 10px" }}>
      <Trophy style={{ width: 10, height: 10 }} /> Finalizado
    </span>
  );
}

/** Un lado de la llave: emblema + nombre (Cinzel) + tagline. Oro si ganó. */
function ResultSide({
  team,
  won,
  align,
}: {
  team: ResultadoRow["teamA"];
  won: boolean;
  align: "l" | "r";
}) {
  return (
    <div className={`res-side ${align === "r" ? "r" : ""} ${won ? "winner" : ""}`}>
      <div className="res-emblem">
        {team?.emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.emblemUrl} alt={`Escudo de ${team.name}`} />
        ) : (
          <Trophy style={{ width: 22, height: 22, color: "var(--vertigo-purple-soft)" }} strokeWidth={1.1} />
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="res-name">{team?.name ?? "Por definir"}</div>
        {team?.tagline && <div className="res-tagline">{team.tagline}</div>}
      </div>
    </div>
  );
}

export default async function ResultadosPage() {
  const rows = await loadResultados();

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <SiteNav />

      <main className="vertigo-content">
        <span className="vertigo-kicker">RESULTADOS</span>
        <h1 className="vertigo-title">Partidos finalizados</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Histórico de llaves disputadas. Incluye resultados de BO3, BO1, W.O. y partidos en
          disputa.
        </p>

        {rows.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Trophy
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Sin resultados aún</div>
              <p className="vertigo-empty-desc">
                Cuando se dispute el primer partido, su resultado va a aparecer acá.
              </p>
            </div>
          </div>
        ) : (
          <div className="res-list">
            {rows.map((m) => {
              const disputed = m.status === "disputed";
              const forfeit = m.status === "forfeit";
              const aWon = m.winnerTeamId === m.teamA?.id;
              const bWon = m.winnerTeamId === m.teamB?.id;
              return (
                <Link key={m.id} href={`/partido/${m.id}`} className="res-card">
                  {/* Banda superior: ronda + formato con hairlines doradas */}
                  <div className="res-top">
                    <span className="hairline" />
                    <span className="round">
                      {m.roundName ?? "—"}{m.format ? ` · ${m.format}` : ""}
                    </span>
                    <span className="hairline rev" />
                    <span className="when">
                      <Clock style={{ width: 10, height: 10, verticalAlign: -1, marginRight: 4 }} />
                      {m.finishedAt ? fmt.dayMonTime(m.finishedAt) : "—"}
                    </span>
                  </div>

                  {/* Cuerpo: equipo A — score — equipo B */}
                  <div className="res-body">
                    <ResultSide team={m.teamA} won={aWon} align="l" />
                    <div className="res-mid">
                      {forfeit ? (
                        /* W.O.: el score 0:0 no cuenta la historia — el pase
                           al rival es el resultado. */
                        <div className="res-score">
                          <span className="win" style={{ fontSize: 24, letterSpacing: "0.08em" }}>W.O.</span>
                        </div>
                      ) : (
                        <div className="res-score">
                          <span className={aWon ? "win" : ""}>{m.scoreA}</span>
                          <span className="colon">:</span>
                          <span className={bWon ? "win" : ""}>{m.scoreB}</span>
                        </div>
                      )}
                      <div className="res-format">
                        {forfeit
                          ? "Pase directo del rival"
                          : m.format === "BO1"
                            ? "Partido único"
                            : m.format
                              ? `Al mejor de ${m.format.replace(/^BO/i, "")}`
                              : "Serie"}
                      </div>
                      {statusBadge(m.status, m.format)}
                    </div>
                    <ResultSide team={m.teamB} won={bWon} align="r" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
