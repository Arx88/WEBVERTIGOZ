import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import SiteNav from "@/components/nav/site-nav";
import { TeamBannerBg } from "@/components/team/team-banner-bg";
import { ComodinesGrid } from "@/components/team/comodin-cards";
import VertigoFooter from "@/components/shared/vertigo-footer";
import { confirmReadyAction } from "@/server/actions/ready";
import { NoDateBanner } from "@/components/shared/no-date-banner";
import { computeReadyPhase } from "@/lib/match-rules";
import { Calendar, History, ArrowRight, ArrowUpRight, Clock, CheckCircle, AlertCircle, Zap, Sparkles } from "lucide-react";
import { fmt } from "@/lib/format";
import LocalTime from "@/components/shared/local-time";

export const dynamic = "force-dynamic";

// Tira compacta de comodines (iconos de marca) dentro de cada tarjeta de partido
const COMODIN_STRIP = [
  { type: "reroll", label: "Re-girar", icon: "/comodines/reroll.webp" },
  { type: "anular", label: "Anular", icon: "/comodines/anular.webp" },
  { type: "elegir_rival", label: "Elegir rival", icon: "/comodines/elegir-rival.webp" },
  { type: "invocar_pro", label: "Invocar PRO", icon: "/comodines/invocar-pro.webp" },
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
    .select("id, name, tagline, emblem_id, emblem:emblem_id (image_url)")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) {
    return (
      <div className="vertigo-page vertigo-shell">
        <SiteNav />
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
          <div className="mt-6">
            <VertigoFooter />
          </div>
        </main>
      </div>
    );
  }

  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id, status, seed, tournament_edition_id")
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

  // Récord histórico real (no limitado a los últimos 10)
  let wins = 0;
  let losses = 0;
  if (latestReg?.id) {
    const orFilter = `team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`;
    const { count: totalFinished } = (await supabase
      .from("match")
      .select("id", { count: "exact", head: true })
      .or(orFilter)
      .eq("status", "finished")) as { count: number | null };
    const { count: totalWins } = (await supabase
      .from("match")
      .select("id", { count: "exact", head: true })
      .or(orFilter)
      .eq("status", "finished")
      .eq("winner_team_id", latestReg.id)) as { count: number | null };
    wins = totalWins ?? 0;
    losses = (totalFinished ?? 0) - wins;
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

  const totalComodines = COMODIN_STRIP.reduce((acc, c) => acc + comodinQty(c.type), 0);

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

  // Emblema real del equipo (de la DB), con fallback a los escudos genéricos
  const emblemUrl = team.emblem?.image_url ?? `/reinos/reino-${(team.id.charCodeAt(0) % 13) + 1}.webp`;

  const statusBadge = (() => {
    if (!latestReg) return { cls: "vertigo-badge-warning", label: "SIN INSCRIPCIÓN" };
    if (latestReg.status === "approved") return { cls: "vertigo-badge-success", label: "APROBADO" };
    if (latestReg.status === "rejected") return { cls: "vertigo-badge-danger", label: "RECHAZADO" };
    return { cls: "vertigo-badge-warning", label: "PENDIENTE" };
  })();

  const nextMatch = upcomingMatches[0];
  const nextRivalId = nextMatch ? (nextMatch.team_a_id === latestReg?.id ? nextMatch.team_b_id : nextMatch.team_a_id) : null;
  const nextRivalName = nextRivalId ? (rivalNames[nextRivalId] ?? "Rival") : (nextMatch ? "Por definir" : null);

  return (
    <div className="vertigo-page vertigo-shell">
      <SiteNav />

      <main className="vertigo-content vertigo-scroll vertigo-fade-in">

        {/* ===== HERO — video de marca + identidad + strip de datos ===== */}
        <div
          className="vertigo-card"
          style={{
            padding: 0, overflow: "hidden", position: "relative",
            marginBottom: "28px", border: "1px solid var(--vertigo-line)",
          }}
        >
          <TeamBannerBg
            emblemUrl={emblemUrl}
            seed={team.id}
            backgroundImage="/landing/castillo-vertigo.webp"
            backgroundVideo="/landing/mi-reino-hero.mp4"
          />
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
          }} />

          {/* Identidad */}
          <div className="vertigo-hero-identity" style={{ position: "relative", zIndex: 2, padding: "48px 46px 38px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "26px", minWidth: 0 }}>
              <div style={{
                flex: "none", width: "114px", height: "114px", borderRadius: "24px",
                overflow: "hidden", border: "2px solid rgba(212,175,55,0.55)",
                background: "var(--vertigo-input-bg)",
                boxShadow: "0 0 44px rgba(124,58,237,0.45), 0 8px 24px rgba(0,0,0,0.55)",
              }}>
                <img src={emblemUrl} alt={`Escudo de ${team.name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "3.5px", textTransform: "uppercase", color: "var(--vertigo-purple-soft)", marginBottom: "8px" }}>
                  Capitán · Mis partidos
                </div>
                <h1 style={{
                  fontFamily: "Cinzel, serif", fontSize: "clamp(34px, 4.5vw, 56px)",
                  fontWeight: 700, color: "var(--vertigo-text)", lineHeight: 1.05,
                  textShadow: "0 2px 20px rgba(0,0,0,0.7)",
                }}>
                  {team.name}
                </h1>
                {team.tagline && (
                  <p style={{ fontSize: "14px", fontStyle: "italic", color: "rgba(230,215,245,0.8)", marginTop: "8px", textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                    &ldquo;{team.tagline}&rdquo;
                  </p>
                )}
              </div>
            </div>
            {/* Estado + acceso al reino */}
            <div className="vertigo-hero-actions" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px", flex: "none", flexWrap: "wrap" }}>
              <span className={`vertigo-badge ${statusBadge.cls}`} style={{ fontSize: "12px", padding: "8px 22px", fontWeight: 700, letterSpacing: "2px", flex: "none", whiteSpace: "nowrap" }}>
                {statusBadge.label}
              </span>
              <Link
                href="/mi-equipo"
                className="vertigo-btn vertigo-btn-ghost"
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", fontSize: "12px", background: "rgba(7,3,16,0.45)", flex: "none", whiteSpace: "nowrap" }}
              >
                Ir a mi reino
                <ArrowUpRight style={{ width: 13, height: 13 }} />
              </Link>
            </div>
          </div>

          {/* Strip de datos de partidos, apoyado sobre el borde inferior */}
          <div className="vertigo-hero-strip" style={{
            position: "relative", zIndex: 2,
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            borderTop: "1px solid var(--vertigo-line)",
            background: "rgba(7,3,16,0.66)",
            backdropFilter: "blur(8px)",
          }}>
            {[
              {
                label: "Próximo encuentro",
                value: nextRivalName ?? "—",
                sub: nextMatch?.scheduled_at_start ? <LocalTime value={nextMatch.scheduled_at_start} variant="dayMonTimeNum" /> : (nextMatch ? "A confirmar" : "Sin programar"),
              },
              { label: "Récord", value: `${wins} – ${losses}`, sub: "V/D histórico" },
              { label: "Comodines", value: `${totalComodines}`, sub: "disponibles" },
              { label: "Próximos partidos", value: `${upcomingMatches.length}`, sub: "en calendario" },
            ].map((s, i) => (
              <div key={s.label} style={{
                padding: "16px 20px",
                borderLeft: i > 0 ? "1px solid var(--vertigo-line-soft)" : "none",
                minWidth: 0,
              }}>
                <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginBottom: "5px", whiteSpace: "nowrap" }}>
                  {s.label}
                </div>
                <div style={{
                  fontFamily: "Cinzel, serif", fontSize: "clamp(13px, 1.3vw, 17px)", fontWeight: 700,
                  color: "var(--vertigo-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {s.value}
                  {s.sub && <span style={{ fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 500, color: "var(--vertigo-faint)", marginLeft: "6px" }}>{s.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIS COMODINES */}
        <div className="vertigo-section">
          <div className="vertigo-subtitle">
            <Sparkles style={{ width: 14, height: 14 }} />
            Mis comodines
            {totalComodines > 0 && (
              <span className="vertigo-badge vertigo-badge-purple" style={{ marginLeft: "auto" }}>{totalComodines} disp.</span>
            )}
          </div>
          <ComodinesGrid
            comodin={{
              rerollAvailable: comodinQty("reroll"),
              anularAvailable: comodinQty("anular"),
              elegirRivalAvailable: comodinQty("elegir_rival"),
              invocarProAvailable: comodinQty("invocar_pro"),
            }}
          />
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
                // Ventana de READY: [15 min antes del horario, 15 min después].
                // Gating server-side; el timer vivo está en la página del partido.
                const readyWin = computeReadyPhase(m.scheduled_at_start ?? null, m.status, Date.now());
                return (
                  <div key={m.id} className="vertigo-card premium">
                    {/* Fondo de video + velo oscuro */}
                    <video
                      autoPlay muted loop playsInline
                      src="/landing/proxima-partida-bg.mp4"
                      aria-hidden="true"
                      tabIndex={-1}
                      style={{
                        position: "absolute", inset: 0, width: "100%", height: "100%",
                        objectFit: "cover", objectPosition: "center", pointerEvents: "none",
                      }}
                    />
                    <div aria-hidden style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(180deg, rgba(7,3,16,0.72) 0%, rgba(7,3,16,0.80) 55%, rgba(7,3,16,0.90) 100%)",
                      pointerEvents: "none",
                    }} />

                    <div style={{ position: "relative", zIndex: 1 }}>
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
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
                        <div className="vertigo-info-card" style={{ padding: "16px" }}>
                          <div className="vertigo-info-card-label" style={{ marginBottom: "4px" }}>Rival</div>
                          <div className="vertigo-info-card-value" style={{ fontSize: "15px" }}>
                            {m.team_a_id && m.team_b_id ? (
                              <Link href={`/equipos/${rivalId}`} style={{ color: "inherit", textDecoration: "none" }} title="Ver perfil del rival">
                                {rivalName}
                              </Link>
                            ) : (
                              rivalName
                            )}
                          </div>
                        </div>
                        <div className="vertigo-info-card" style={{ padding: "16px" }}>
                          <div className="vertigo-info-card-label" style={{ marginBottom: "4px" }}>Horario</div>
                          <div className="vertigo-info-card-value" style={{ fontSize: "13px" }}>
                            {m.scheduled_at_start
                              ? <LocalTime value={m.scheduled_at_start} variant="dayMonTimeNum" />
                              : <span style={{ color: "var(--vertigo-gold)", fontWeight: 600 }}>A confirmar</span>}
                          </div>
                        </div>
                        <div className="vertigo-info-card" style={{ padding: "16px" }}>
                          <div className="vertigo-info-card-label" style={{ marginBottom: "4px" }}>Formato</div>
                          <div className="vertigo-info-card-value" style={{ fontSize: "13px" }}>{m.format ?? "Por sorteo"}</div>
                        </div>
                      </div>

                      {/* Tira de comodines del reino para este partido */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
                        padding: "12px 16px", marginBottom: "16px",
                        background: "rgba(7,3,16,0.55)",
                        border: `1px solid ${isComodinWindow ? "rgba(212,175,55,0.45)" : "var(--vertigo-line-soft)"}`,
                        borderRadius: "12px",
                        boxShadow: isComodinWindow ? "0 0 22px rgba(212,175,55,0.15)" : "none",
                      }}>
                        <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)" }}>
                          Mis comodines
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                          {COMODIN_STRIP.map((c) => {
                            const qty = comodinQty(c.type);
                            const available = qty > 0;
                            return (
                              <div key={c.type} title={`${c.label}: ${qty} disponibles`} style={{ display: "flex", alignItems: "center", gap: "7px", opacity: available ? 1 : 0.55 }}>
                                <div style={{
                                  width: "34px", height: "34px", flex: "none", borderRadius: "9px", overflow: "hidden",
                                  border: `1.5px solid ${available ? (isComodinWindow ? "rgba(212,175,55,0.6)" : "rgba(124,58,237,0.42)") : "var(--vertigo-line)"}`,
                                  boxShadow: available && isComodinWindow ? "0 0 14px rgba(212,175,55,0.35)" : "none",
                                  filter: available ? "none" : "grayscale(1) brightness(0.7)",
                                }}>
                                  <img src={c.icon} alt={c.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                                <span style={{
                                  fontFamily: "Cinzel, serif", fontSize: "14px", fontWeight: 700,
                                  color: available ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                                }}>
                                  ×{qty}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {isComodinWindow && (
                          <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--vertigo-gold)" }}>
                            Ventana abierta
                          </span>
                        )}
                      </div>

                      {/* Alertas de estado — el botón READY solo existe dentro de la ventana */}
                      {isScheduled && !myReady && readyWin.phase === "no-date" && (
                        <div style={{ marginBottom: "16px" }}>
                          <NoDateBanner />
                        </div>
                      )}
                      {isScheduled && (myReady || readyWin.phase !== "no-date") && (
                        <div style={{
                          padding: "14px 18px",
                          background: myReady ? "rgba(34,197,94,0.08)" : readyWin.phase === "grace" || readyWin.phase === "expired" ? "rgba(251,113,133,0.07)" : "rgba(251,191,36,0.06)",
                          border: `1px solid ${myReady ? "rgba(34,197,94,0.3)" : readyWin.phase === "grace" || readyWin.phase === "expired" ? "rgba(251,113,133,0.4)" : "rgba(251,191,36,0.25)"}`,
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
                            ) : readyWin.phase === "early" ? (
                              <span style={{ color: "#fbbf24" }}>
                                El READY se habilita 15 min antes del horario
                                {readyWin.msToOpen != null && ` (faltan ~${Math.max(1, Math.ceil(readyWin.msToOpen / 60_000))} min)`}
                              </span>
                            ) : readyWin.phase === "grace" ? (
                              <span style={{ color: "var(--vertigo-danger)", fontWeight: 600 }}>⚠ Tolerancia en curso — si no confirmás antes del límite, perdés por W.O.</span>
                            ) : readyWin.phase === "expired" ? (
                              <span style={{ color: "var(--vertigo-danger)", fontWeight: 600 }}>Tiempo agotado — aplicando W.O.…</span>
                            ) : rivalReady ? (
                              <span style={{ color: "#fbbf24" }}>⚠ El rival está listo — Confirmá tu participación</span>
                            ) : (
                              <span style={{ color: "#fbbf24" }}>Confirmá tu participación para habilitar el sorteo</span>
                            )}
                          </div>
                          {!myReady && readyWin.phase === "early" && (
                            <button
                              type="button"
                              className="vertigo-btn vertigo-btn-success"
                              disabled
                              title="Se habilita 15 minutos antes del horario de la llave"
                              style={{ fontSize: "11px", padding: "10px 20px" }}
                            >
                              <CheckCircle style={{ width: 14, height: 14 }} />
                              ESTOY LISTO
                            </button>
                          )}
                          {!myReady && (readyWin.phase === "open" || readyWin.phase === "grace") && (
                            <form action={confirmReadyAction.bind(null, m.id)} style={{ display: "inline" }}>
                              <button
                                type="submit"
                                className={`vertigo-btn ${readyWin.phase === "grace" ? "vertigo-btn-danger" : "vertigo-btn-success"}`}
                                style={{ fontSize: "11px", padding: "10px 20px" }}
                              >
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

                      {/* Comodines: se usan desde el panel del capitán en la página del partido */}
                      {isComodinWindow && (
                        <div className="vertigo-action-bar" style={{ marginBottom: "16px" }}>
                          <Link href={`/partido/${m.id}`} className="vertigo-btn vertigo-btn-primary" style={{ padding: "11px 22px" }}>
                            <Sparkles style={{ width: 13, height: 13 }} />
                            Usar comodines ahora
                            <ArrowRight style={{ width: 13, height: 13 }} />
                          </Link>
                        </div>
                      )}

                      {/* CTA */}
                      <div className="vertigo-action-bar" style={{ marginTop: "0", paddingTop: "16px", borderTop: "1px solid var(--vertigo-line-soft)" }}>
                        <Link href={`/partido/${m.id}`} className="vertigo-btn vertigo-btn-primary" style={{ marginLeft: "auto", padding: "12px 28px" }}>
                          Ver partido <ArrowRight style={{ width: 15, height: 15 }} />
                        </Link>
                      </div>
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
                        {fmt.date(m.finished_at)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="mt-6">
          <VertigoFooter />
        </div>
      </main>
    </div>
  );
}
