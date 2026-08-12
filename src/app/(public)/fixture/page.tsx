import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface FixtureMatch {
  id: string;
  status: string;
  scheduledAtStart: string | null;
  scheduledAtEnd: string | null;
  jornadaLabel: string | null;
  roundName: string | null;
  format: string | null;
  teamA: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  teamB: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Programado", cls: "vertigo-badge-purple" },
  open: { label: "Abierto", cls: "vertigo-badge-success" },
  drawing: { label: "Sorteando", cls: "vertigo-badge-warning" },
  lineup: { label: "Lineup", cls: "vertigo-badge-warning" },
  comodin_window: { label: "Comodines", cls: "vertigo-badge-warning" },
  in_progress: { label: "En juego", cls: "vertigo-badge-success" },
  finished: { label: "Finalizado", cls: "vertigo-badge-purple" },
  disputed: { label: "Disputa", cls: "vertigo-badge-danger" },
  forfeit: { label: "W.O.", cls: "vertigo-badge-danger" },
  cancelled: { label: "Cancelado", cls: "vertigo-badge-danger" },
};

async function loadFixture(): Promise<FixtureMatch[]> {
  try {
    const supabase = await getSupabaseServer();

    const { data: matchesRaw } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id")
      .neq("status", "cancelled")
      .order("scheduled_at_start", { ascending: true, nullsFirst: false })
      .limit(120)) as { data: any };

    if (!matchesRaw || matchesRaw.length === 0) return [];

    // Round names
    const roundIds: string[] = matchesRaw.map((m: any) => m.round_id).filter(Boolean);
    let roundMap: Record<string, string> = {};
    if (roundIds.length > 0) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id, name")
        .in("id", roundIds)) as { data: any };
      for (const r of rounds ?? []) roundMap[r.id] = r.name;
    }

    // Team names
    const teamIds: string[] = [];
    for (const m of matchesRaw) {
      if (m.team_a_id) teamIds.push(m.team_a_id);
      if (m.team_b_id) teamIds.push(m.team_b_id);
    }
    let teamMap: Record<string, { name: string; seed: number | null; emblemUrl: string | null }> = {};
    if (teamIds.length > 0) {
      const { data: teams } = (await supabase
        .from("team_registration")
        .select("id, seed, team_account:team_account_id ( name, emblem:emblem_id ( image_url ) )")
        .in("id", teamIds)) as { data: any };
      for (const t of teams ?? []) {
        teamMap[t.id] = {
          name: t.team_account?.name ?? "—",
          seed: t.seed ?? null,
          emblemUrl: t.team_account?.emblem?.image_url ?? null,
        };
      }
    }

    return matchesRaw.map((m: any) => ({
      id: m.id,
      status: m.status,
      scheduledAtStart: m.scheduled_at_start ?? null,
      scheduledAtEnd: m.scheduled_at_end ?? null,
      jornadaLabel: m.jornada_label ?? null,
      roundName: m.round_id ? roundMap[m.round_id] ?? null : null,
      format: m.format ?? null,
      teamA: m.team_a_id
        ? { id: m.team_a_id, name: teamMap[m.team_a_id]?.name ?? "—", seed: teamMap[m.team_a_id]?.seed ?? null, emblemUrl: teamMap[m.team_a_id]?.emblemUrl ?? null }
        : null,
      teamB: m.team_b_id
        ? { id: m.team_b_id, name: teamMap[m.team_b_id]?.name ?? "—", seed: teamMap[m.team_b_id]?.seed ?? null, emblemUrl: teamMap[m.team_b_id]?.emblemUrl ?? null }
        : null,
      scoreA: m.score_a ?? 0,
      scoreB: m.score_b ?? 0,
      winnerTeamId: m.winner_team_id ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function FixturePage() {
  const matches = await loadFixture();

  // Agrupar por jornada label
  const groups: Record<string, FixtureMatch[]> = {};
  for (const m of matches) {
    const key = m.jornadaLabel ?? "Sin jornada";
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Sin jornada") return 1;
    if (b === "Sin jornada") return -1;
    return a.localeCompare(b, "es", { numeric: true });
  });

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">FIXTURE</span>
        </div>
        <div className="vertigo-header-right">
          <Link href="/bracket" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Bracket
          </Link>
          <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Resultados
          </Link>
        </div>
      </header>

      <main className="vertigo-content">
        <span className="vertigo-kicker">FIXTURE</span>
        <h1 className="vertigo-title">Calendario de partidos</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Todas las llaves programadas, agrupadas por jornada. Sin partidas simultáneas: cada
          match tiene su ventana de stream asignada.
        </p>

        {matches.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Calendar
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">No hay partidos programados</div>
              <p className="vertigo-empty-desc">
                El fixture se publica cuando el staff confirma el bracket y asigna las jornadas.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groupKeys.map((key) => (
              <section key={key}>
                <div className="vertigo-subtitle">{key}</div>
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
                >
                  {groups[key].map((m) => {
                    const statusMeta = STATUS_BADGE[m.status] ?? STATUS_BADGE.scheduled;
                    const isAWinner = m.winnerTeamId && m.teamA && m.winnerTeamId === m.teamA.id;
                    const isBWinner = m.winnerTeamId && m.teamB && m.winnerTeamId === m.teamB.id;
                    return (
                      <Link key={m.id} href={`/partido/${m.id}`} className="vertigo-link-card">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] tracking-[1.5px] uppercase text-[var(--vertigo-faint)]">
                            {m.roundName ?? "—"}
                            {m.format && ` · ${m.format}`}
                          </span>
                          <span className={`vertigo-badge ${statusMeta.cls}`} style={{ fontSize: 9, padding: "3px 8px" }}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          <FixtureTeamRow
                            name={m.teamA?.name ?? "Por definir"}
                            seed={m.teamA?.seed ?? null}
                            score={m.scoreA}
                            isWinner={!!isAWinner}
                            emblemUrl={m.teamA?.emblemUrl}
                          />
                          <FixtureTeamRow
                            name={m.teamB?.name ?? "Por definir"}
                            seed={m.teamB?.seed ?? null}
                            score={m.scoreB}
                            isWinner={!!isBWinner}
                            emblemUrl={m.teamB?.emblemUrl}
                          />
                        </div>
                        {m.scheduledAtStart && (
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--vertigo-line-soft)] text-[11px] text-[var(--vertigo-faint)]">
                            <Clock style={{ width: 11, height: 11 }} />
                            {new Date(m.scheduledAtStart).toLocaleString("es-AR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {m.scheduledAtEnd && (
                              <>
                                <span>—</span>
                                {new Date(m.scheduledAtEnd).toLocaleString("es-AR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FixtureTeamRow({
  name,
  seed,
  score,
  isWinner,
  emblemUrl,
}: {
  name: string;
  seed: number | null;
  score: number;
  isWinner: boolean;
  emblemUrl?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {/* Emblema del equipo */}
        {emblemUrl && (
          <div
            className="flex-none rounded-full overflow-hidden border flex items-center justify-center"
            style={{
              width: 20, height: 20,
              borderColor: isWinner ? "rgba(212,175,55,0.5)" : "var(--vertigo-line)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={emblemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
        {seed != null && (
          <span className="text-[10px] text-[var(--vertigo-faint)] flex-none">#{seed}</span>
        )}
        <span
          className={`text-[13px] truncate ${isWinner ? "text-[var(--vertigo-text)] font-medium" : "text-[var(--vertigo-muted)]"}`}
        >
          {name}
        </span>
      </div>
      <span
        className={`font-cinzel text-[15px] font-bold tabular-nums flex-none ${isWinner ? "text-[var(--vertigo-purple-pale)]" : "text-[var(--vertigo-faint)]"}`}
      >
        {score}
      </span>
    </div>
  );
}
