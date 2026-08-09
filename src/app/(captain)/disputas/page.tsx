import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { createDisputeAction } from "./dispute-actions";
import { LogOut, Shield, AlertCircle, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DisputasPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Account
  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account) redirect("/login");
  if (account.role === "admin" || account.role === "super_admin") redirect("/admin");
  if (account.role === "caster") redirect("/caster");

  // Team
  const { data: team } = (await supabase
    .from("team_account")
    .select("id, name")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) redirect("/mi-equipo");

  // Team registration
  const { data: reg } = (await supabase
    .from("team_registration")
    .select("id, status")
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };

  if (!reg) {
    return (
      <CaptainShell teamName={team.name}>
        <div style={{ padding: "40px", background: "var(--vertigo-panel)", borderRadius: "12px", textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Sin inscripción activa</h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            Tu equipo no está inscripto en ninguna edición activa.
          </p>
        </div>
      </CaptainShell>
    );
  }

  // Disputas existentes del team
  const { data: disputes } = (await supabase
    .from("dispute")
    .select(`
      id, reason, description, status, admin_response, created_at, resolved_at,
      match:match_id (id, status, round:round_id (name))
    `)
    .eq("team_registration_id", reg.id)
    .order("created_at", { ascending: false })) as { data: any[] };

  // Matches finalizados recientemente (para abrir disputa, ventana 30 min)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentMatches } = (await supabase
    .from("match")
    .select(`
      id, status, scheduled_at_start, finished_at, score_a, score_b, winner_team_id,
      team_a_id, team_b_id,
      round:round_id (id, name, index)
    `)
    .or(`team_a_id.eq.${reg.id},team_b_id.eq.${reg.id}`)
    .eq("status", "finished")
    .gte("finished_at", thirtyMinAgo)
    .order("finished_at", { ascending: false })) as { data: any[] };

  // Rival names para matches recientes
  const rivalIds = (recentMatches ?? []).map((m) =>
    m.team_a_id === reg.id ? m.team_b_id : m.team_a_id
  ).filter(Boolean);
  let rivalsMap: Record<string, any> = {};
  if (rivalIds.length > 0) {
    const { data: rivalsData } = (await supabase
      .from("team_registration")
      .select(`id, team_account:team_account_id (id, name)`)
      .in("id", rivalIds)) as { data: any[] };
    rivalsData?.forEach((r) => { rivalsMap[r.id] = r; });
  }

  const statusInfo: Record<string, { label: string; color: string }> = {
    open: { label: "ABIERTA", color: "var(--vertigo-warning)" },
    reviewing: { label: "EN REVISIÓN", color: "var(--vertigo-purple-soft)" },
    resolved: { label: "RESUELTA", color: "var(--vertigo-success)" },
    rejected: { label: "RECHAZADA", color: "var(--vertigo-danger)" },
  };

  return (
    <CaptainShell teamName={team.name}>
      {/* Info banner */}
      <div style={{
        padding: "16px",
        background: "rgba(251,191,36,0.08)",
        borderRadius: "10px",
        border: "1px solid var(--vertigo-warning)",
        marginBottom: "24px",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
      }}>
        <AlertCircle size={20} style={{ color: "var(--vertigo-warning)", flexShrink: 0, marginTop: "2px" }} />
        <div>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--vertigo-warning)", marginBottom: "4px" }}>
            Ventana de disputas: 30 minutos post-finalizado
          </div>
          <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", lineHeight: 1.5 }}>
            Podés abrir una disputa dentro de los 30 minutos posteriores a que un partido finalice.
            Incluí screenshots y descripción clara del problema. El staff revisará y resolverá.
          </div>
        </div>
      </div>

      {/* Abrir nueva disputa */}
      <section style={{ marginBottom: "32px" }}>
        <h2 className="vertigo-subtitle">Abrir nueva disputa</h2>
        {(!recentMatches || recentMatches.length === 0) ? (
          <div style={{
            padding: "20px",
            background: "var(--vertigo-panel)",
            borderRadius: "10px",
            border: "1px solid var(--vertigo-line)",
            color: "var(--vertigo-muted)",
            fontSize: "13px",
            textAlign: "center",
          }}>
            No hay partidos finalizados en la ventana de 30 minutos.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {recentMatches.map((m) => {
              const rivalId = m.team_a_id === reg.id ? m.team_b_id : m.team_a_id;
              const rival = rivalsMap[rivalId];
              const won = m.winner_team_id === reg.id;
              const myScore = m.team_a_id === reg.id ? m.score_a : m.score_b;
              const rivalScore = m.team_a_id === reg.id ? m.score_b : m.score_a;
              const minutesAgo = m.finished_at
                ? Math.floor((Date.now() - new Date(m.finished_at).getTime()) / 60000)
                : 0;
              const minutesLeft = Math.max(0, 30 - minutesAgo);

              return (
                <div key={m.id} style={{
                  padding: "16px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "10px",
                  border: "1px solid var(--vertigo-line)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>{m.round?.name}</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, marginTop: "2px" }}>
                        vs {rival?.team_account?.name ?? "—"}
                      </div>
                      <div style={{ fontSize: "12px", color: won ? "var(--vertigo-success)" : "var(--vertigo-danger)", marginTop: "2px" }}>
                        {won ? "Ganaste" : "Perdiste"} {myScore}-{rivalScore}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: "var(--vertigo-warning)", display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                        <Clock size={12} />
                        {minutesLeft} min restantes
                      </div>
                    </div>
                  </div>

                  <form action={createDisputeAction} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <input type="hidden" name="match_id" value={m.id} />
                    <input type="hidden" name="team_registration_id" value={reg.id} />

                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Motivo</label>
                      <select name="reason" style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }}>
                        <option value="unfair_play">Juego injusto / trampa</option>
                        <option value="smurf_suspect">Sospecha de smurf</option>
                        <option value="technical_issue">Problema técnico</option>
                        <option value="admin_decision">Decisión admin</option>
                        <option value="other">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Descripción (detalle del problema)</label>
                      <textarea name="description" rows={3} required style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }} placeholder="Describí qué pasó, con timestamps si es posible..." />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>URL de screenshot (opcional)</label>
                      <input name="screenshot_url" type="url" style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }} placeholder="https://..." />
                    </div>

                    <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-warning)", color: "#000", alignSelf: "flex-start" }}>
                      <Shield size={14} style={{ display: "inline", marginRight: "6px" }} />
                      Abrir disputa
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Disputas existentes */}
      <section>
        <h2 className="vertigo-subtitle">Mis disputas ({disputes?.length ?? 0})</h2>
        {(!disputes || disputes.length === 0) ? (
          <div style={{
            padding: "20px",
            background: "var(--vertigo-panel)",
            borderRadius: "10px",
            border: "1px solid var(--vertigo-line)",
            color: "var(--vertigo-muted)",
            fontSize: "13px",
            textAlign: "center",
          }}>
            Sin disputas abiertas.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {disputes.map((d) => {
              const info = statusInfo[d.status] ?? statusInfo.open;
              return (
                <div key={d.id} style={{
                  padding: "14px 16px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "10px",
                  border: `1px solid ${info.color}44`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{
                        padding: "3px 8px",
                        background: `${info.color}22`,
                        color: info.color,
                        borderRadius: "999px",
                        fontSize: "10px",
                        fontWeight: 700,
                      }}>
                        {info.label}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--vertigo-muted)" }}>
                        {d.reason.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                      {new Date(d.created_at).toLocaleString("es-AR")}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--vertigo-text)", marginBottom: "8px", lineHeight: 1.5 }}>
                    {d.description}
                  </p>
                  {d.admin_response && (
                    <div style={{
                      padding: "8px 12px",
                      background: "var(--vertigo-bg)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      color: "var(--vertigo-purple-soft)",
                      marginTop: "8px",
                    }}>
                      <strong>Respuesta del staff:</strong> {d.admin_response}
                    </div>
                  )}
                  {d.resolved_at && (
                    <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginTop: "8px" }}>
                      Resuelta: {new Date(d.resolved_at).toLocaleString("es-AR")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </CaptainShell>
  );
}

function CaptainShell({ teamName, children }: { teamName: string; children: React.ReactNode }) {
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
        <h1 className="vertigo-title">Disputas</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        {children}
      </main>
    </div>
  );
}
