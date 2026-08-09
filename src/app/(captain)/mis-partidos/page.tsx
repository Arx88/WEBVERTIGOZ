import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { useRerollAction, useAnularAction, useElegirRivalAction } from "./comodin-actions";
import { civName } from "@/lib/constants/civs";
import { Crown, Clock, Trophy, LogOut, Sparkles, RotateCcw, Ban, Target } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MisPartidosPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Account
  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account) redirect("/login");
  if (account.role === "admin" || account.role === "super_admin") redirect("/admin");
  if (account.role === "caster") redirect("/caster");

  // 2. Team
  const { data: team } = (await supabase
    .from("team_account")
    .select("id, name")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) redirect("/mi-equipo");

  // 3. Team registration activa
  const { data: reg } = (await supabase
    .from("team_registration")
    .select(`
      id, seed, status, elo_freeze_snapshot,
      tournament_edition:tournament_edition_id (id, name)
    `)
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };

  if (!reg) {
    return (
      <CaptainShell teamName={team.name} account={account}>
        <div style={{ padding: "40px", background: "var(--vertigo-panel)", borderRadius: "12px", textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Sin inscripción activa</h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            Tu equipo no está inscripto en ninguna edición activa.
          </p>
        </div>
      </CaptainShell>
    );
  }

  // 4. Comodin inventory
  const { data: comodinInv } = (await supabase
    .from("comodin_inventory")
    .select("id, reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
    .eq("team_registration_id", reg.id)
    .single()) as { data: any };

  // 5. Próximos matches (no finished)
  const { data: upcomingMatches } = (await supabase
    .from("match")
    .select(`
      id, status, scheduled_at_start, scheduled_at_end, jornada_label, format,
      score_a, score_b, winner_team_id, team_a_id, team_b_id,
      round:round_id (id, name, index)
    `)
    .or(`team_a_id.eq.${reg.id},team_b_id.eq.${reg.id}`)
    .in("status", ["scheduled", "open", "drawing", "lineup", "comodin_window", "in_progress"])
    .order("scheduled_at_start", { ascending: true, nullsFirst: false })
    .limit(5)) as { data: any[] };

  // 6. Matches finalizados
  const { data: finishedMatches } = (await supabase
    .from("match")
    .select(`
      id, status, scheduled_at_start, score_a, score_b, winner_team_id, format,
      team_a_id, team_b_id,
      round:round_id (id, name, index)
    `)
    .or(`team_a_id.eq.${reg.id},team_b_id.eq.${reg.id}`)
    .in("status", ["finished", "forfeit"])
    .order("scheduled_at_start", { ascending: false })
    .limit(10)) as { data: any[] };

  // 7. Rival names
  const allMatches = [...(upcomingMatches ?? []), ...(finishedMatches ?? [])];
  const rivalIds = allMatches.map((m) => m.team_a_id === reg.id ? m.team_b_id : m.team_a_id).filter(Boolean);
  let rivalsMap: Record<string, any> = {};
  if (rivalIds.length > 0) {
    const { data: rivalsData } = (await supabase
      .from("team_registration")
      .select(`id, team_account:team_account_id (id, name)`)
      .in("id", rivalIds)) as { data: any[] };
    rivalsData?.forEach((r) => { rivalsMap[r.id] = r; });
  }

  // 8. Current game + draw para próximos matches
  const upcomingWithGames = await Promise.all((upcomingMatches ?? []).map(async (m) => {
    const { data: games } = (await supabase
      .from("match_game")
      .select(`
        id, game_number, status, game_mode, antimeta_mode, player_mode, map,
        civs_a, civs_b, draw_id, lineup_a, lineup_b
      `)
      .eq("match_id", m.id)
      .order("game_number", { ascending: true })) as { data: any[] };

    const currentGame = games?.find((g: any) => g.status !== "finished") ?? games?.[games.length - 1] ?? null;

    let draw: any = null;
    if (currentGame?.draw_id) {
      const { data: drawData } = (await supabase
        .from("roulette_draw")
        .select("id, status, commit_hash, public_inputs, result, published_at")
        .eq("id", currentGame.draw_id)
        .single()) as { data: any };
      draw = drawData;
    }

    // Comodines usados en este match
    const { data: usages } = (await supabase
      .from("comodin_usage")
      .select("id, comodin_type, executed_at")
      .eq("match_id", m.id)
      .order("executed_at", { ascending: true })) as { data: any[] };

    return { ...m, currentGame, draw, comodinUsages: usages ?? [] };
  }));

  return (
    <CaptainShell teamName={team.name} account={account}>
      {/* Comodines disponibles */}
      {comodinInv && (
        <section style={{ marginBottom: "32px" }}>
          <h2 style={{
            fontSize: "14px",
            color: "var(--vertigo-purple-soft)",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}>
            Mis comodines
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
          }}>
            <ComodinMini icon={<RotateCcw size={14} />} label="Re-girar" available={comodinInv.reroll_available} total={2} color="#4A6FA5" />
            <ComodinMini icon={<Ban size={14} />} label="Anular" available={comodinInv.anular_available} total={1} color="#7A5A8A" />
            <ComodinMini icon={<Target size={14} />} label="Elegir rival" available={comodinInv.elegir_rival_available} total={1} color="#5B8C5A" />
            <ComodinMini icon={<Sparkles size={14} />} label="INVOCAR PRO" available={comodinInv.invocar_pro_available} total={1} color="#C44536" />
          </div>
        </section>
      )}

      {/* Próximos partidos */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{
          fontSize: "14px",
          color: "var(--vertigo-purple-soft)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          Próximos partidos ({upcomingWithGames.length})
        </h2>
        {upcomingWithGames.length === 0 ? (
          <div style={{ padding: "20px", background: "var(--vertigo-panel)", borderRadius: "10px", color: "var(--vertigo-muted)", fontSize: "13px", textAlign: "center" }}>
            No tenés partidos programados.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {upcomingWithGames.map((m) => {
              const rivalId = m.team_a_id === reg.id ? m.team_b_id : m.team_a_id;
              const rival = rivalsMap[rivalId];
              const isComodinWindow = m.status === "comodin_window" || m.status === "lineup";
              const drawPublished = m.draw?.status === "published";
              const myCivs = m.team_a_id === reg.id ? m.currentGame?.civs_a : m.currentGame?.civs_b;

              return (
                <div key={m.id} style={{
                  padding: "20px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "12px",
                  border: `1px solid ${isComodinWindow ? "var(--vertigo-warning)" : "var(--vertigo-line)"}`,
                }}>
                  {/* Header del match */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>{m.round?.name}</span>
                      <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "2px" }}>
                        vs {rival?.team_account?.name ?? "Por definir"}
                      </div>
                    </div>
                    <span style={{
                      padding: "4px 10px",
                      background: `${m.status === "comodin_window" || m.status === "lineup" ? "var(--vertigo-warning)" : m.status === "in_progress" ? "var(--vertigo-danger)" : "var(--vertigo-purple)"}22`,
                      color: m.status === "comodin_window" || m.status === "lineup" ? "var(--vertigo-warning)" : m.status === "in_progress" ? "var(--vertigo-danger)" : "var(--vertigo-purple-soft)",
                      borderRadius: "999px",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                    }}>
                      {m.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "var(--vertigo-muted)", marginBottom: "12px" }}>
                    {m.scheduled_at_start && (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} />
                        {new Date(m.scheduled_at_start).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                    <div>Formato: {m.format ?? "Por sortear"}</div>
                  </div>

                  {/* Resultado del sorteo si publicado */}
                  {drawPublished && m.currentGame && (
                    <div style={{
                      padding: "12px",
                      background: "rgba(124,58,237,0.08)",
                      borderRadius: "8px",
                      border: "1px solid var(--vertigo-purple)",
                      marginBottom: "12px",
                    }}>
                      <div style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>
                        Resultado del sorteo
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: "8px", fontSize: "12px" }}>
                        <div><div style={{ color: "var(--vertigo-muted)", fontSize: "10px" }}>MODO</div><div style={{ fontWeight: 600 }}>{m.currentGame.game_mode ?? "—"}</div></div>
                        <div><div style={{ color: "var(--vertigo-muted)", fontSize: "10px" }}>ANTIMETA</div><div style={{ fontWeight: 600 }}>{m.currentGame.antimeta_mode ?? "—"}</div></div>
                        <div><div style={{ color: "var(--vertigo-muted)", fontSize: "10px" }}>FORMATO</div><div style={{ fontWeight: 600 }}>{m.currentGame.player_mode ?? "—"}</div></div>
                        <div><div style={{ color: "var(--vertigo-muted)", fontSize: "10px" }}>MAPA</div><div style={{ fontWeight: 600 }}>{m.currentGame.map ?? "—"}</div></div>
                      </div>
                      {Array.isArray(myCivs) && myCivs.length > 0 && (
                        <div style={{ marginTop: "8px", fontSize: "12px" }}>
                          <span style={{ color: "var(--vertigo-muted)" }}>Tus civs: </span>
                          {myCivs.map((c: string) => civName(c)).join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Acciones de comodines si ventana abierta */}
                  {isComodinWindow && comodinInv && (
                    <div style={{
                      padding: "12px",
                      background: "rgba(251,191,36,0.08)",
                      borderRadius: "8px",
                      border: "1px solid var(--vertigo-warning)",
                    }}>
                      <div style={{ fontSize: "12px", color: "var(--vertigo-warning)", fontWeight: 700, marginBottom: "8px" }}>
                        ⚡ Ventana de comodines abierta
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {comodinInv.reroll_available > 0 && (
                          <form action={useRerollAction.bind(null, m.id, reg.id)}>
                            <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: "11px", padding: "6px 12px", borderColor: "#4A6FA5" }}>
                              <RotateCcw size={11} style={{ display: "inline", marginRight: "4px" }} />
                              Re-girar ({comodinInv.reroll_available})
                            </button>
                          </form>
                        )}
                        {comodinInv.anular_available > 0 && (
                          <form action={useAnularAction.bind(null, m.id, reg.id)}>
                            <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: "11px", padding: "6px 12px", borderColor: "#7A5A8A" }}>
                              <Ban size={11} style={{ display: "inline", marginRight: "4px" }} />
                              Anular jugador ({comodinInv.anular_available})
                            </button>
                          </form>
                        )}
                        {comodinInv.elegir_rival_available > 0 && (
                          <form action={useElegirRivalAction.bind(null, m.id, reg.id)}>
                            <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: "11px", padding: "6px 12px", borderColor: "#5B8C5A" }}>
                              <Target size={11} style={{ display: "inline", marginRight: "4px" }} />
                              Elegir rival ({comodinInv.elegir_rival_available})
                            </button>
                          </form>
                        )}
                      </div>
                      {m.comodinUsages.length > 0 && (
                        <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--vertigo-muted)" }}>
                          Usados en este match: {m.comodinUsages.map((u: any) => u.comodin_type).join(", ")}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Link al partido */}
                  <div style={{ marginTop: "12px", textAlign: "right" }}>
                    <Link href={`/partido/${m.id}`} style={{ fontSize: "12px", color: "var(--vertigo-purple-soft)", textDecoration: "none" }}>
                      Ver partido →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Historial */}
      <section>
        <h2 style={{
          fontSize: "14px",
          color: "var(--vertigo-purple-soft)",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          marginBottom: "12px",
        }}>
          Historial ({finishedMatches?.length ?? 0})
        </h2>
        {(!finishedMatches || finishedMatches.length === 0) ? (
          <div style={{ padding: "20px", background: "var(--vertigo-panel)", borderRadius: "10px", color: "var(--vertigo-muted)", fontSize: "13px", textAlign: "center" }}>
            Sin partidas jugadas todavía.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {finishedMatches.map((m) => {
              const rivalId = m.team_a_id === reg.id ? m.team_b_id : m.team_a_id;
              const rival = rivalsMap[rivalId];
              const won = m.winner_team_id === reg.id;
              const myScore = m.team_a_id === reg.id ? m.score_a : m.score_b;
              const rivalScore = m.team_a_id === reg.id ? m.score_b : m.score_a;
              return (
                <Link
                  key={m.id}
                  href={`/partido/${m.id}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "var(--vertigo-panel)",
                    borderRadius: "10px",
                    border: `1px solid ${won ? "rgba(34,197,94,0.3)" : "var(--vertigo-line)"}`,
                    textDecoration: "none",
                    color: "var(--vertigo-text)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      fontSize: "10px",
                      fontWeight: 700,
                      background: won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: won ? "var(--vertigo-success)" : "var(--vertigo-danger)",
                    }}>
                      {won ? "GANASTE" : "PERDISTE"}
                    </span>
                    <div>
                      <div style={{ fontSize: "13px" }}>{m.round?.name} vs {rival?.team_account?.name ?? "—"}</div>
                      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                        {m.scheduled_at_start ? new Date(m.scheduled_at_start).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: won ? "var(--vertigo-success)" : "var(--vertigo-muted)" }}>
                    {myScore}-{rivalScore}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </CaptainShell>
  );
}

// ============================================================
// LAYOUT
// ============================================================

function CaptainShell({ teamName, account, children }: { teamName: string; account: any; children: React.ReactNode }) {
  return (
    <div className="vertigo-page vertigo-shell">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">{teamName.toUpperCase()}</span>
        </div>
        <nav className="vertigo-nav">
          <Link href="/mi-equipo">Reino</Link>
          <Link href="/mis-partidos">Partidos</Link>
          <Link href="/disputas">Disputas</Link>
        </nav>
        <div className="vertigo-header-right">
          <form action={logoutAction} style={{ display: "inline" }}>
            <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
              <LogOut size={12} style={{ display: "inline", marginRight: "4px" }} />
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="vertigo-content vertigo-scroll">
        <span className="vertigo-kicker">CAPITÁN</span>
        <h1 className="vertigo-title">Mis partidos</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        {children}
      </main>
    </div>
  );
}

function ComodinMini({ icon, label, available, total, color }: { icon: React.ReactNode; label: string; available: number; total: number; color: string }) {
  const isAvailable = available > 0;
  return (
    <div style={{
      padding: "10px",
      background: isAvailable ? `${color}15` : "var(--vertigo-panel)",
      borderRadius: "8px",
      border: `1px solid ${isAvailable ? color : "var(--vertigo-line)"}`,
      opacity: isAvailable ? 1 : 0.5,
      textAlign: "center",
    }}>
      <div style={{ color: isAvailable ? color : "var(--vertigo-muted)", marginBottom: "4px" }}>{icon}</div>
      <div style={{ fontSize: "10px", color: "var(--vertigo-muted)", letterSpacing: "0.5px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color: isAvailable ? color : "var(--vertigo-muted)", fontFamily: "Inter, sans-serif" }}>
        {available}/{total}
      </div>
    </div>
  );
}
