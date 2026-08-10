import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { CaptainHeader } from "@/components/captain/captain-header";
import { confirmReadyAction } from "@/server/actions/ready";
import { Dices, Ban, Target, UserPlus, Calendar, History, ArrowRight, Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const COMODINES_DEFAULT = [
  { type: "reroll", label: "Re-girar", desc: "Re-sortear una fase del resultado.", icon: Dices, defaultQty: 2 },
  { type: "anular", label: "Anular", desc: "Anular un jugador rival del lineup.", icon: Ban, defaultQty: 1 },
  { type: "elegir_rival", label: "Elegir rival", desc: "Elegir qué jugador rival enfrenta al tuyo.", icon: Target, defaultQty: 1 },
  { type: "invocar_pro", label: "Invocar PRO", desc: "Sustituir por un jugador PRO (solo finalistas).", icon: UserPlus, defaultQty: 1 },
];

export default async function MisPartidosPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account) redirect("/login");
  if (account.role === "admin" || account.role === "super_admin") redirect("/admin");
  if (account.role === "caster") redirect("/caster");

  const { data: team } = (await supabase
    .from("team_account")
    .select("id, name, tagline")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) {
    return (
      <div className="vertigo-page vertigo-shell">
        <CaptainHeader active="partidos" />
        <main className="vertigo-content vertigo-scroll vertigo-fade-in">
          <div className="vertigo-page-title">
            <span className="vertigo-kicker">CAPITÁN</span>
            <h1 className="vertigo-title">Mis partidos</h1>
            <div className="vertigo-divider"><span></span><i></i><span></span></div>
          </div>
          <div className="vertigo-card premium">
            <div className="vertigo-empty">
              <Calendar className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">No tenés reino todavía</div>
              <p className="vertigo-empty-desc" style={{ marginBottom: "24px" }}>Inscribí tu reino para acceder a los partidos y comodines.</p>
              <Link href="/registro"><button className="vertigo-btn vertigo-btn-primary">Inscribir mi reino →</button></Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id, status, tournament_edition_id")
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  const latestReg = regs;

  let comodinInventory: any = null;
  if (latestReg?.id) {
    const { data: inv } = (await supabase
      .from("comodin_inventory")
      .select("reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
      .eq("team_registration_id", latestReg.id)
      .maybeSingle()) as { data: any };
    comodinInventory = inv;
  }

  let upcomingMatches: any[] = [];
  if (latestReg?.id) {
    const { data: um } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, score_a, score_b, team_a_id, team_b_id, ready_a_at, ready_b_at")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .in("status", ["scheduled", "open", "drawing", "lineup", "comodin_window", "in_progress"])
      .order("scheduled_at_start", { ascending: true })
      .limit(10)) as { data: any };
    upcomingMatches = um ?? [];
  }

  let pastMatches: any[] = [];
  if (latestReg?.id) {
    const { data: pm } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, jornada_label, format, score_a, score_b, winner_team_id, team_a_id, team_b_id, finished_at")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(10)) as { data: any };
    pastMatches = pm ?? [];
  }

  const rivalIds = new Set<string>();
  for (const m of [...upcomingMatches, ...pastMatches]) {
    if (m.team_a_id && m.team_a_id !== latestReg?.id) rivalIds.add(m.team_a_id);
    if (m.team_b_id && m.team_b_id !== latestReg?.id) rivalIds.add(m.team_b_id);
  }
  const rivalNames: Record<string, string> = {};
  if (rivalIds.size > 0) {
    const { data: rivalTeams } = (await supabase
      .from("team_registration")
      .select("id, team_account:team_account_id (name)")
      .in("id", Array.from(rivalIds))) as { data: any };
    for (const r of rivalTeams ?? []) {
      rivalNames[r.id] = r.team_account?.name ?? "Rival";
    }
  }

  const comodinQty = (type: string): number => {
    if (!comodinInventory) return 0;
    switch (type) {
      case "reroll": return comodinInventory.reroll_available ?? 0;
      case "anular": return comodinInventory.anular_available ?? 0;
      case "elegir_rival": return comodinInventory.elegir_rival_available ?? 0;
      case "invocar_pro": return comodinInventory.invocar_pro_available ?? 0;
      default: return 0;
    }
  };

  const matchStatusInfo = (status: string): { cls: string; label: string; dot: string } => {
    switch (status) {
      case "in_progress": return { cls: "vertigo-badge-warning", label: "En curso", dot: "#fbbf24" };
      case "open": return { cls: "vertigo-badge-success", label: "Abierto", dot: "#22c55e" };
      case "drawing": return { cls: "vertigo-badge-warning", label: "Sorteando", dot: "#fbbf24" };
      case "lineup": return { cls: "vertigo-badge-warning", label: "Lineup", dot: "#fbbf24" };
      case "comodin_window": return { cls: "vertigo-badge-warning", label: "Comodines", dot: "#fbbf24" };
      case "scheduled": return { cls: "vertigo-badge-purple", label: "Programado", dot: "var(--vertigo-purple)" };
      default: return { cls: "vertigo-badge-purple", label: status, dot: "var(--vertigo-purple)" };
    }
  };

  return (
    <div className="vertigo-page vertigo-shell">
      <CaptainHeader active="partidos" teamTag={team.tagline ?? undefined} />

      <main className="vertigo-content vertigo-scroll vertigo-fade-in">
        <div className="vertigo-page-title">
          <span className="vertigo-kicker">CAPITÁN</span>
          <h1 className="vertigo-title">Mis partidos</h1>
          <div className="vertigo-divider"><span></span><i></i><span></span></div>
          <p className="vertigo-desc">
            Comodines disponibles, próximos enfrentamientos e historial del reino <strong style={{ color: "var(--vertigo-purple-pale)" }}>{team.name}</strong>.
          </p>
        </div>

        {/* MIS COMODINES */}
        <div className="vertigo-section">
          <div className="vertigo-subtitle">
            <Dices style={{ width: 14, height: 14 }} />
            Mis comodines
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "14px" }}>
            {COMODINES_DEFAULT.map((c) => {
              const qty = comodinQty(c.type);
              const Icon = c.icon;
              const available = qty > 0;
              return (
                <div
                  key={c.type}
                  className="vertigo-info-card"
                  style={{
                    opacity: available ? 1 : 0.5,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {!available && (
                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", borderRadius: "inherit", zIndex: 1 }} />
                  )}
                  <div className="vertigo-info-card-label" style={{ marginBottom: "10px" }}>
                    <Icon style={{ width: 14, height: 14, color: available ? "var(--vertigo-purple-soft)" : "var(--vertigo-faint)" }} />
                    {c.label}
                  </div>
                  <div className="vertigo-info-card-value" style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                    <span style={{
                      fontFamily: "Cinzel, serif",
                      fontSize: "32px",
                      fontWeight: 700,
                      lineHeight: 1,
                      color: available ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                    }}>{qty}</span>
                    <span style={{ fontSize: "11px", color: "var(--vertigo-faint)" }}>/ {c.defaultQty}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", lineHeight: 1.5 }}>{c.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PRÓXIMOS PARTIDOS */}
        <div className="vertigo-section">
          <div className="vertigo-subtitle">
            <Calendar style={{ width: 14, height: 14 }} />
            Próximos partidos
            {upcomingMatches.length > 0 && (
              <span className="vertigo-badge vertigo-badge-purple" style={{ marginLeft: "auto" }}>{upcomingMatches.length}</span>
            )}
          </div>
          {upcomingMatches.length === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Calendar style={{ width: 40, height: 40, color: "var(--vertigo-faint)", margin: "0 auto 16px", display: "block" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin partidos programados</div>
                <p className="vertigo-empty-desc">
                  {latestReg?.status === "approved"
                    ? "Cuando el bracket esté generado, van a aparecer acá."
                    : "Tu inscripción está pendiente. Una vez aprobada, verás tus partidos acá."}
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {upcomingMatches.map((m) => {
                const isTeamA = m.team_a_id === latestReg?.id;
                const rivalId = isTeamA ? m.team_b_id : m.team_a_id;
                const rivalName = rivalId ? (rivalNames[rivalId] ?? "Rival") : "Por definir";
                const statusInfo = matchStatusInfo(m.status);
                const myReady = isTeamA ? m.ready_a_at : m.ready_b_at;
                const rivalReady = isTeamA ? m.ready_b_at : m.ready_a_at;
                const isScheduled = m.status === "scheduled";
                const isOpen = m.status === "open";
                const isComodinWindow = m.status === "comodin_window";
                return (
                  <div key={m.id} className="vertigo-card premium">
                    {/* Header del partido */}
                    <div className="vertigo-card-header" style={{ marginBottom: "20px", paddingBottom: "18px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span className={`vertigo-status ${statusInfo.cls}`}>
                          <span className="vertigo-status-dot" style={{ background: statusInfo.dot }} />
                          {statusInfo.label}
                        </span>
                        <span style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "2px", textTransform: "uppercase" }}>
                          {m.jornada_label ?? "Jornada"}
                        </span>
                      </div>
                      {m.format && (
                        <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: "11px", padding: "5px 12px" }}>{m.format}</span>
                      )}
                    </div>

                    {/* Grid de info */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
                      <div className="vertigo-info-card" style={{ padding: "16px" }}>
                        <div className="vertigo-info-card-label" style={{ marginBottom: "4px" }}>Rival</div>
                        <div className="vertigo-info-card-value" style={{ fontSize: "15px" }}>{rivalName}</div>
                      </div>
                      <div className="vertigo-info-card" style={{ padding: "16px" }}>
                        <div className="vertigo-info-card-label" style={{ marginBottom: "4px" }}>Horario</div>
                        <div className="vertigo-info-card-value" style={{ fontSize: "13px" }}>
                          {m.scheduled_at_start
                            ? new Date(m.scheduled_at_start).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "A confirmar"}
                        </div>
                      </div>
                      <div className="vertigo-info-card" style={{ padding: "16px" }}>
                        <div className="vertigo-info-card-label" style={{ marginBottom: "4px" }}>Formato</div>
                        <div className="vertigo-info-card-value" style={{ fontSize: "13px" }}>{m.format ?? "Por sorteo"}</div>
                      </div>
                    </div>

                    {/* Alertas de estado */}
                    {isScheduled && (
                      <div style={{
                        padding: "14px 18px",
                        background: myReady ? "rgba(34,197,94,0.08)" : "rgba(251,191,36,0.06)",
                        border: `1px solid ${myReady ? "rgba(34,197,94,0.3)" : "rgba(251,191,36,0.25)"}`,
                        borderRadius: "10px",
                        marginBottom: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}>
                        <div style={{ fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                          {myReady ? (
                            <span style={{ color: "var(--vertigo-success)" }}>✓ Estás listo{rivalReady ? " — Rival también" : " — Esperando rival"}</span>
                          ) : rivalReady ? (
                            <span style={{ color: "#fbbf24" }}>⚠ El rival está listo — Confirmá tu participación</span>
                          ) : (
                            <span style={{ color: "#fbbf24" }}>Confirmá tu participación para habilitar el sorteo</span>
                          )}
                        </div>
                        {!myReady && (
                          <form action={confirmReadyAction.bind(null, m.id)} style={{ display: "inline" }}>
                            <button type="submit" className="vertigo-btn vertigo-btn-success" style={{ fontSize: "11px", padding: "10px 20px" }}>
                              <CheckCircle style={{ width: 14, height: 14 }} />
                              ESTOY LISTO
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    {isOpen && (
                      <div style={{
                        padding: "14px 18px",
                        background: "rgba(34,197,94,0.08)",
                        border: "1px solid rgba(34,197,94,0.25)",
                        borderRadius: "10px",
                        marginBottom: "16px",
                        fontSize: "13px",
                        color: "var(--vertigo-success)",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                        <Zap style={{ width: 16, height: 16 }} />
                        LLAVE HABILITADA — El admin puede sortear ahora
                      </div>
                    )}

                    {isComodinWindow && (
                      <div style={{
                        padding: "14px 18px",
                        background: "rgba(251,191,36,0.08)",
                        border: "1px solid rgba(251,191,36,0.25)",
                        borderRadius: "10px",
                        marginBottom: "16px",
                        fontSize: "13px",
                        color: "#fbbf24",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}>
                        <AlertCircle style={{ width: 16, height: 16 }} />
                        VENTANA DE COMODINES — Usá tus comodines ahora antes de que cierre
                      </div>
                    )}

                    {/* Comodines */}
                    {isComodinWindow && (
                      <div className="vertigo-action-bar" style={{ marginBottom: "16px" }}>
                        <button className="vertigo-btn vertigo-btn-ghost" disabled={comodinQty("reroll") === 0}>
                          <Dices style={{ width: 13, height: 13 }} />Re-girar ({comodinQty("reroll")})
                        </button>
                        <button className="vertigo-btn vertigo-btn-ghost" disabled={comodinQty("anular") === 0}>
                          <Ban style={{ width: 13, height: 13 }} />Anular ({comodinQty("anular")})
                        </button>
                        <button className="vertigo-btn vertigo-btn-ghost" disabled={comodinQty("elegir_rival") === 0}>
                          <Target style={{ width: 13, height: 13 }} />Elegir ({comodinQty("elegir_rival")})
                        </button>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="vertigo-action-bar" style={{ marginTop: "0", paddingTop: "16px", borderTop: "1px solid var(--vertigo-line-soft)" }}>
                      <Link href={`/partido/${m.id}`} className="vertigo-btn vertigo-btn-primary" style={{ marginLeft: "auto", padding: "12px 28px" }}>
                        Ver partido <ArrowRight style={{ width: 15, height: 15 }} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* HISTORIAL */}
        <div className="vertigo-section">
          <div className="vertigo-subtitle">
            <History style={{ width: 14, height: 14 }} />
            Historial
            {pastMatches.length > 0 && (
              <span className="vertigo-badge vertigo-badge-purple" style={{ marginLeft: "auto" }}>{pastMatches.length}</span>
            )}
          </div>
          {pastMatches.length === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <History style={{ width: 40, height: 40, color: "var(--vertigo-faint)", margin: "0 auto 16px", display: "block" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin partidos jugados</div>
                <p className="vertigo-empty-desc">Tu historial de partidos finalizados aparecerá acá.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "14px" }}>
              {pastMatches.map((m) => {
                const isTeamA = m.team_a_id === latestReg?.id;
                const rivalId = isTeamA ? m.team_b_id : m.team_a_id;
                const rivalName = rivalId ? (rivalNames[rivalId] ?? "Rival") : "Rival";
                const ourScore = isTeamA ? m.score_a : m.score_b;
                const rivalScore = isTeamA ? m.score_b : m.score_a;
                const won = m.winner_team_id === latestReg?.id;
                return (
                  <Link key={m.id} href={`/partido/${m.id}`} className="vertigo-link-card" style={{ padding: "20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <span className={`vertigo-badge ${won ? "vertigo-badge-success" : "vertigo-badge-danger"}`}>
                        {won ? "VICTORIA" : "DERROTA"}
                      </span>
                      {m.format && <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: "10px", padding: "4px 10px" }}>{m.format}</span>}
                    </div>
                    <div className="vertigo-link-card-title" style={{ fontSize: "15px", marginBottom: "6px" }}>
                      vs {rivalName}
                    </div>
                    <div className="vertigo-link-card-desc" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontFamily: "Cinzel, serif", fontSize: "20px", fontWeight: 700, color: won ? "var(--vertigo-purple-pale)" : "var(--vertigo-muted)" }}>
                        {ourScore} - {rivalScore}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--vertigo-faint)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock style={{ width: 11, height: 11 }} />
                        {m.finished_at ? new Date(m.finished_at).toLocaleDateString("es-AR") : "—"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
