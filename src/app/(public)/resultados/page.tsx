import Link from "next/link";
import { Trophy } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import DuelCard from "@/components/shared/duel-card";

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

export default async function ResultadosPage() {
  const rows = await loadResultados();

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">RESULTADOS</span>
        </div>
        <div className="vertigo-header-right">
          <Link href="/apuestas" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Apuestas
          </Link>
          <Link href="/fixture" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Fixture
          </Link>
          <Link href="/standings" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Tabla
          </Link>
        </div>
      </header>

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
          <div className="flex flex-col gap-4">
            {rows.map((m) => {
              const isFinished = m.status === "finished";
              const disputed = m.status === "disputed";
              const forfeit = m.status === "forfeit";
              return (
                <div key={m.id} style={{ position: "relative" }}>
                  {/* Badges de estado sobre la card */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)", fontWeight: 700 }}>
                      {m.roundName ?? "—"}{m.format && ` · ${m.format}`}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {disputed && <span className="vertigo-badge vertigo-badge-danger" style={{ fontSize: 9, padding: "3px 10px" }}>Disputa</span>}
                      {forfeit && <span className="vertigo-badge vertigo-badge-danger" style={{ fontSize: 9, padding: "3px 10px" }}>W.O.</span>}
                      {m.finishedAt && (
                        <span style={{ fontSize: 10, color: "var(--vertigo-faint)" }}>
                          {new Date(m.finishedAt).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                  </div>

                  <DuelCard
                    teamA={m.teamA ? { id: m.teamA.id, name: m.teamA.name, seed: m.teamA.seed, emblemUrl: m.teamA.emblemUrl, tagline: m.teamA.tagline } : null}
                    teamB={m.teamB ? { id: m.teamB.id, name: m.teamB.name, seed: m.teamB.seed, emblemUrl: m.teamB.emblemUrl, tagline: m.teamB.tagline } : null}
                    scoreA={m.scoreA}
                    scoreB={m.scoreB}
                    winnerId={m.winnerTeamId}
                    href={`/partido/${m.id}`}
                    live={false}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
