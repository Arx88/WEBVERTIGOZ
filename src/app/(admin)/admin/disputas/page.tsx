import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { resolveDisputeAction } from "./dispute-actions";
import Link from "next/link";
import { LogOut, Shield, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDisputasPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account")
    .select("id, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!accountData || !["admin", "super_admin"].includes(accountData.role)) {
    redirect("/mi-equipo");
  }

  // Buscar todas las disputas
  const { data: disputes } = (await supabase
    .from("dispute")
    .select(`
      id, reason, description, screenshot_url, status, admin_response, created_at, resolved_at,
      match:match_id (id, status, score_a, score_b, team_a_id, team_b_id, round:round_id (name)),
      team:team_registration_id (id, team_account:team_account_id (name))
    `)
    .order("created_at", { ascending: false })) as { data: any[] };

  const open = (disputes ?? []).filter((d) => d.status === "open");
  const reviewing = (disputes ?? []).filter((d) => d.status === "reviewing");
  const resolved = (disputes ?? []).filter((d) => d.status === "resolved" || d.status === "rejected");

  const statusInfo: Record<string, { label: string; color: string }> = {
    open: { label: "ABIERTA", color: "var(--vertigo-warning)" },
    reviewing: { label: "EN REVISIÓN", color: "var(--vertigo-purple-soft)" },
    resolved: { label: "RESUELTA", color: "var(--vertigo-success)" },
    rejected: { label: "RECHAZADA", color: "var(--vertigo-danger)" },
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span className="vertigo-kicker">DISPUTAS</span>
          <h1 className="vertigo-title">Resolución de disputas</h1>
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
          <div className="vertigo-stat-label">ABIERTAS</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-warning)" }}>{open.length}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">EN REVISIÓN</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-purple-soft)" }}>{reviewing.length}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">RESUELTAS</div>
          <div className="vertigo-stat-value" style={{ color: "var(--vertigo-success)" }}>{resolved.length}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">TOTAL</div>
          <div className="vertigo-stat-value">{disputes?.length ?? 0}</div>
        </div>
      </div>

      {/* Lista de disputas */}
      {(!disputes || disputes.length === 0) ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <div className="vertigo-empty-title">Sin disputas</div>
            <p className="vertigo-empty-desc">Cuando los capitanes abran disputas, aparecerán acá.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Abiertas primero */}
          {[...open, ...reviewing, ...resolved].map((d) => {
            const info = statusInfo[d.status] ?? statusInfo.open;
            const isOpen = d.status === "open" || d.status === "reviewing";

            return (
              <div key={d.id} style={{
                padding: "16px",
                background: "var(--vertigo-panel)",
                borderRadius: "12px",
                border: `1px solid ${info.color}55`,
              }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{
                      padding: "3px 10px",
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

                {/* Match info */}
                <div style={{ fontSize: "12px", color: "var(--vertigo-muted)", marginBottom: "8px" }}>
                  {d.match?.round?.name ?? "Match"} ·{" "}
                  <Link href={`/admin/partido/${d.match?.id}`} style={{ color: "var(--vertigo-purple-soft)" }}>
                    Ver partido
                  </Link>
                  {" · "}Equipo: <strong style={{ color: "var(--vertigo-text)" }}>{d.team?.team_account?.name ?? "—"}</strong>
                </div>

                {/* Description */}
                <div style={{
                  padding: "10px 12px",
                  background: "var(--vertigo-bg)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "var(--vertigo-text)",
                  marginBottom: "8px",
                  lineHeight: 1.5,
                }}>
                  {d.description}
                </div>

                {/* Screenshot */}
                {d.screenshot_url && (
                  <div style={{ marginBottom: "8px" }}>
                    <a href={d.screenshot_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)" }}>
                      <AlertCircle size={10} style={{ display: "inline", marginRight: "4px" }} />
                      Ver screenshot
                    </a>
                  </div>
                )}

                {/* Admin response si ya resuelta */}
                {d.admin_response && (
                  <div style={{
                    padding: "10px 12px",
                    background: "rgba(124,58,237,0.08)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "var(--vertigo-purple-soft)",
                    marginBottom: "8px",
                  }}>
                    <strong>Respuesta del staff:</strong> {d.admin_response}
                  </div>
                )}

                {/* Formulario de resolución (solo si abierta) */}
                {isOpen && (
                  <form action={resolveDisputeAction} style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    <input type="hidden" name="dispute_id" value={d.id} />

                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Decisión</label>
                      <select name="resolution" style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }}>
                        <option value="resolved">Resolver a favor del equipo</option>
                        <option value="rejected">Rechazar disputa</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Respuesta / reasoning</label>
                      <textarea name="admin_response" rows={2} required style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }} placeholder="Explicá la decisión..." />
                    </div>

                    <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-purple)", color: "#fff", alignSelf: "flex-start" }}>
                      <Shield size={14} style={{ display: "inline", marginRight: "6px" }} />
                      Resolver disputa
                    </button>
                  </form>
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
    </div>
  );
}
