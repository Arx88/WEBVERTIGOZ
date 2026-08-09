import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { commitDraw, revealDraw } from "@/server/actions/draw";
import Link from "next/link";
import { LogOut, Sparkles, Eye, Trophy, Users } from "lucide-react";
import { generateBracket, BRACKET_SIZE } from "@/lib/bracket/engine";

export const dynamic = "force-dynamic";

// Wrappers para form actions
async function wrap<T>(fn: () => Promise<T>, _fd: FormData): Promise<void> {
  await fn();
}
async function commitSeedingDrawAction(bracketId: string, fd: FormData) {
  await wrap(() => commitDraw("seeding", { bracketId }), fd);
}
async function revealSeedingDrawAction(drawId: string, fd: FormData) {
  await wrap(() => revealDraw(drawId), fd);
}

export default async function AdminBracketPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) {
    redirect("/mi-equipo");
  }

  // Buscar la edición activa
  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, slug, name, status")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  // Buscar bracket de la edición
  let bracket: any = null;
  let rounds: any[] = [];
  let matches: any[] = [];
  let teamRegs: any[] = [];
  let seedingDraws: any[] = [];

  if (edition) {
    const { data: bracketData } = (await supabase
      .from("bracket")
      .select("id, type, rounds_count, created_at")
      .eq("tournament_edition_id", edition.id)
      .eq("type", "winner")
      .single()) as { data: any };
    bracket = bracketData;

    if (bracket) {
      // Rounds + matches
      const { data: roundsData } = (await supabase
        .from("round")
        .select("id, index, name")
        .eq("bracket_id", bracket.id)
        .order("index", { ascending: true })) as { data: any[] };
      rounds = roundsData ?? [];

      if (rounds.length > 0) {
        const roundIds = rounds.map((r) => r.id);
        const { data: matchesData } = (await supabase
          .from("match")
          .select(`
            id, status, slot_index, team_a_id, team_b_id, winner_team_id,
            score_a, score_b, scheduled_at_start, jornada_label,
            round:round_id (id, name, index)
          `)
          .in("round_id", roundIds)
          .order("slot_index", { ascending: true })) as { data: any[] };
        matches = matchesData ?? [];
      }

      // Team registrations (para mostrar nombres)
      const { data: regsData } = (await supabase
        .from("team_registration")
        .select(`
          id, seed, status, elo_freeze_snapshot,
          team_account:team_account_id (id, name, tagline)
        `)
        .eq("tournament_edition_id", edition.id)
        .order("seed", { ascending: true })) as { data: any[] };
      teamRegs = regsData ?? [];

      // Seeding draws
      const { data: drawsData } = (await supabase
        .from("seeding_draw")
        .select("id, status, commit_hash, revealed_seed, public_inputs, result, committed_at, revealed_at, published_at")
        .eq("bracket_id", bracket.id)
        .order("committed_at", { ascending: false })) as { data: any[] };
      seedingDraws = drawsData ?? [];
    }
  }

  // Generar estructura del bracket para visualización
  const generatedBracket = generateBracket(BRACKET_SIZE);

  // Map team_registration_id → team info
  const teamMap = new Map<string, any>();
  teamRegs.forEach((t) => teamMap.set(t.id, t));

  // Mapear matches por round + slotIndex
  const matchMap = new Map<string, any>();
  matches.forEach((m) => {
    matchMap.set(`${m.round.index}-${m.slot_index}`, m);
  });

  // Stats
  const totalMatches = matches.length;
  const finishedMatches = matches.filter((m) => m.status === "finished" || m.status === "forfeit").length;
  const inProgressMatches = matches.filter((m) => m.status === "in_progress").length;
  const scheduledMatches = matches.filter((m) => m.status === "scheduled").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span className="vertigo-kicker">BRACKET</span>
          <h1 className="vertigo-title">Bracket del torneo</h1>
        </div>
        <form action={logoutAction} style={{ display: "inline" }}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost">
            <LogOut size={14} style={{ display: "inline", marginRight: "6px" }} />
            Salir
          </button>
        </form>
      </div>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      {/* Stats */}
      <div className="vertigo-stats" style={{ marginBottom: "24px" }}>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">EQUIPOS</div>
          <div className="vertigo-stat-value">{teamRegs.filter((t) => t.status === "approved").length}/32</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">PARTIDOS</div>
          <div className="vertigo-stat-value">{totalMatches}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">FINALIZADOS</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-success)" }}>{finishedMatches}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">EN JUEGO</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-danger)" }}>{inProgressMatches}</div>
        </div>
      </div>

      {/* Estado del bracket */}
      <section style={{ marginBottom: "32px" }}>
        {!bracket ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <div className="vertigo-empty-title">Bracket no generado</div>
              <p className="vertigo-empty-desc">
                Cuando se completen las inscripciones (32 equipos aprobados), generá el bracket acá.
                El sistema creará 31 matches en 5 rondas (R1, Octavos, Cuartos, Semifinal, Final).
              </p>
              {teamRegs.filter((t) => t.status === "approved").length >= 32 && (
                <form action={async () => {
                  "use server";
                  // TODO: server action generateBracketForEdition
                  // Por ahora es placeholder — se implementa cuando se necesite
                }}>
                  <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-purple)", color: "#fff" }}>
                    <Sparkles size={14} style={{ display: "inline", marginRight: "6px" }} />
                    Generar bracket
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Sorteo de bracket (seeding draw) */}
            <div style={{ marginBottom: "24px", padding: "16px", background: "var(--vertigo-panel)", borderRadius: "12px", border: "1px solid var(--vertigo-line)" }}>
              <h2 className="vertigo-subtitle" style={{ marginBottom: "12px" }}>Sorteo inicial de seeds</h2>
              {seedingDraws.length === 0 ? (
                <div>
                  <p style={{ fontSize: "13px", color: "var(--vertigo-muted)", marginBottom: "12px" }}>
                    No se ha sorteado el bracket todavía. El sorteo inicial asigna seeds 1-32 a los equipos de forma aleatoria con commit-reveal.
                  </p>
                  <form action={commitSeedingDrawAction.bind(null, bracket.id)}>
                    <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-purple)", color: "#fff" }}>
                      <Sparkles size={14} style={{ display: "inline", marginRight: "6px" }} />
                      Iniciar sorteo de bracket
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  {seedingDraws.map((draw) => (
                    <div key={draw.id} style={{ marginBottom: "12px", padding: "12px", background: "var(--vertigo-bg)", borderRadius: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>SORTEO</span>{" "}
                          <code style={{ fontSize: "11px" }}>{draw.id.slice(0, 8)}</code>
                          {" "}
                          <span style={{
                            padding: "2px 8px",
                            background: `${draw.status === "revealed" ? "var(--vertigo-success)" : draw.status === "published" ? "var(--vertigo-purple)" : "var(--vertigo-warning)"}22`,
                            color: draw.status === "revealed" ? "var(--vertigo-success)" : draw.status === "published" ? "var(--vertigo-purple-soft)" : "var(--vertigo-warning)",
                            borderRadius: "999px",
                            fontSize: "10px",
                            fontWeight: 700,
                          }}>{draw.status.toUpperCase()}</span>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          {draw.status === "committed" && !draw.revealed_seed && (
                            <form action={revealSeedingDrawAction.bind(null, draw.id)}>
                              <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }}>
                                <Eye size={12} style={{ display: "inline", marginRight: "4px" }} />
                                Revelar
                              </button>
                            </form>
                          )}
                          <Link href={`/sorteos/${draw.id}/verificar`} className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: "11px", padding: "4px 10px" }}>
                            Verificar
                          </Link>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                        Commit: <code>{draw.commit_hash?.slice(0, 32)}...</code>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bracket visual */}
            <div style={{ overflowX: "auto", paddingBottom: "16px" }}>
              <div style={{ display: "flex", gap: "20px", minWidth: "max-content" }}>
                {generatedBracket.rounds.map((round) => (
                  <div key={round.index} style={{ minWidth: "220px" }}>
                    <div style={{
                      fontSize: "11px",
                      color: "var(--vertigo-muted)",
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      marginBottom: "12px",
                      paddingBottom: "6px",
                      borderBottom: "1px solid var(--vertigo-line)",
                    }}>
                      {round.name}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {round.matches.map((genMatch) => {
                        const dbMatch = matchMap.get(`${round.index}-${genMatch.slotIndex}`);
                        const teamA = dbMatch?.team_a_id ? teamMap.get(dbMatch.team_a_id) : null;
                        const teamB = dbMatch?.team_b_id ? teamMap.get(dbMatch.team_b_id) : null;
                        const status = dbMatch?.status ?? "pending";

                        const statusColors: Record<string, string> = {
                          scheduled: "#4A6FA5",
                          open: "#22c55e",
                          drawing: "#fbbf24",
                          lineup: "#a78bfa",
                          comodin_window: "#fbbf24",
                          in_progress: "#ef4444",
                          finished: "#22c55e",
                          disputed: "#ef4444",
                          forfeit: "#6b7280",
                          cancelled: "#6b7280",
                          pending: "#6b7280",
                        };
                        const color = statusColors[status] ?? "#6b7280";

                        return (
                          <Link
                            key={genMatch.tempId}
                            href={dbMatch ? `/admin/partido/${dbMatch.id}` : "#"}
                            style={{
                              display: "block",
                              padding: "10px",
                              background: "var(--vertigo-panel)",
                              borderRadius: "8px",
                              border: `1px solid ${color}55`,
                              textDecoration: "none",
                              cursor: dbMatch ? "pointer" : "default",
                              opacity: dbMatch ? 1 : 0.5,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                              <span style={{ fontSize: "10px", color: "var(--vertigo-muted)" }}>M{round.index + 1}-{genMatch.slotIndex + 1}</span>
                              {dbMatch && (
                                <span style={{
                                  fontSize: "9px",
                                  padding: "1px 6px",
                                  background: `${color}22`,
                                  color: color,
                                  borderRadius: "999px",
                                  fontWeight: 700,
                                }}>{status.toUpperCase()}</span>
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: teamA ? "var(--vertigo-text)" : "var(--vertigo-muted)" }}>
                              {teamA?.team_account?.name ?? (genMatch.seedA ? `Seed ${genMatch.seedA}` : "—")}
                              {dbMatch?.winner_team_id === dbMatch?.team_a_id && dbMatch && (
                                <Trophy size={10} style={{ display: "inline", marginLeft: "4px", color: "var(--vertigo-success)" }} />
                              )}
                              {dbMatch && <span style={{ float: "right", color: dbMatch.winner_team_id === dbMatch.team_a_id ? "var(--vertigo-success)" : "var(--vertigo-muted)" }}>{dbMatch.score_a}</span>}
                            </div>
                            <div style={{ fontSize: "12px", color: teamB ? "var(--vertigo-text)" : "var(--vertigo-muted)", marginTop: "2px" }}>
                              {teamB?.team_account?.name ?? (genMatch.seedB ? `Seed ${genMatch.seedB}` : "—")}
                              {dbMatch?.winner_team_id === dbMatch?.team_b_id && dbMatch && (
                                <Trophy size={10} style={{ display: "inline", marginLeft: "4px", color: "var(--vertigo-success)" }} />
                              )}
                              {dbMatch && <span style={{ float: "right", color: dbMatch.winner_team_id === dbMatch.team_b_id ? "var(--vertigo-success)" : "var(--vertigo-muted)" }}>{dbMatch.score_b}</span>}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
