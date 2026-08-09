import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import Link from "next/link";
import { LogOut, Users, Trophy, Calendar, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminTorneoPage() {
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

  // Buscar edición activa
  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, slug, name, status, elo_cap, elo_tolerance, civs_base, civs_extra_finalist, handbook_url, handbook_uploaded_at")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  // Contar inscripciones
  let stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
  if (edition) {
    const { data: regs } = (await supabase
      .from("team_registration")
      .select("status")
      .eq("tournament_edition_id", edition.id)) as { data: any[] };
    stats = {
      total: regs?.length ?? 0,
      pending: regs?.filter((r) => r.status === "pending").length ?? 0,
      approved: regs?.filter((r) => r.status === "approved").length ?? 0,
      rejected: regs?.filter((r) => r.status === "rejected").length ?? 0,
    };
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span className="vertigo-kicker">TORNEO</span>
          <h1 className="vertigo-title">Configuración de la edición</h1>
        </div>
        <form action={logoutAction} style={{ display: "inline" }}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost">
            <LogOut size={14} style={{ display: "inline", marginRight: "6px" }} />
            Salir
          </button>
        </form>
      </div>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      {!edition ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <div className="vertigo-empty-title">No hay edición activa</div>
            <p className="vertigo-empty-desc">Creá una edición con slug "vertigo-2026-1" para empezar.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats generales */}
          <div className="vertigo-stats" style={{ marginBottom: "24px" }}>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">EDICIÓN</div>
              <div className="vertigo-stat-value" style={{ fontSize: "16px" }}>{edition.name}</div>
            </div>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">STATUS</div>
              <div className="vertigo-stat-value" style={{ fontSize: "16px" }}>{edition.status}</div>
            </div>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">EQUIPOS</div>
              <div className="vertigo-stat-value">{stats.approved}/32</div>
            </div>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">PENDIENTES</div>
              <div className="vertigo-stat-value" style={{ color: "var(--vertigo-warning)" }}>{stats.pending}</div>
            </div>
          </div>

          {/* Configuración de la edición */}
          <section style={{ marginBottom: "32px" }}>
            <h2 className="vertigo-subtitle">Parámetros del torneo</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <ConfigBox label="ELO Cap" value={edition.elo_cap?.toString() ?? "3500"} />
              <ConfigBox label="ELO Tolerancia" value={`+${edition.elo_tolerance ?? 20}`} />
              <ConfigBox label="ELO Máximo" value={`${(edition.elo_cap ?? 3500) + (edition.elo_tolerance ?? 20)}`} />
              <ConfigBox label="Civs base" value={`${edition.civs_base ?? 9}`} />
              <ConfigBox label="Civs extra (finalistas)" value={`${edition.civs_extra_finalist ?? 3}`} />
              <ConfigBox label="Handbook" value={edition.handbook_uploaded_at ? "Subido" : "Pendiente"} />
            </div>
          </section>

          {/* Accesos rápidos */}
          <section style={{ marginBottom: "32px" }}>
            <h2 className="vertigo-subtitle">Accesos rápidos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              <QuickLink href="/admin/equipos" icon={<Users size={18} />} title="Gestionar equipos" desc={`${stats.total} inscripciones`} />
              <QuickLink href="/admin/bracket" icon={<Trophy size={18} />} title="Ver bracket" desc="Sorteo y partidos" />
              <QuickLink href="/admin/jornadas" icon={<Calendar size={18} />} title="Jornadas" desc="Programación de partidos" />
              <QuickLink href="/admin/auditoria" icon={<Shield size={18} />} title="Auditoría" desc="Logs y verificación" />
            </div>
          </section>

          {/* Nota sobre configuración */}
          <section>
            <div style={{
              padding: "16px",
              background: "rgba(124,58,237,0.05)",
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: "12px",
            }}>
              <h3 style={{ fontSize: "14px", color: "var(--vertigo-purple-soft)", marginBottom: "8px" }}>
                ⚙ Edición de parámetros
              </h3>
              <p style={{ fontSize: "13px", color: "var(--vertigo-muted)", lineHeight: 1.5 }}>
                Los parámetros del torneo (ELO cap, civs, etc.) se configuran directamente en la base de datos
                en la tabla <code>tournament_edition</code>. Una UI para editarlos desde el admin se agregará
                en una futura iteración. Por ahora, contactá al equipo de desarrollo para cambios.
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ConfigBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "12px 14px", background: "var(--vertigo-panel)", borderRadius: "8px", border: "1px solid var(--vertigo-line)" }}>
      <div style={{ fontSize: "10px", color: "var(--vertigo-muted)", letterSpacing: "1px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "16px", color: "var(--vertigo-text)", marginTop: "4px", fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{value}</div>
    </div>
  );
}

function QuickLink({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href} style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "14px",
      background: "var(--vertigo-panel)",
      borderRadius: "10px",
      border: "1px solid var(--vertigo-line)",
      textDecoration: "none",
      color: "var(--vertigo-text)",
    }}>
      <div style={{ color: "var(--vertigo-purple-soft)" }}>{icon}</div>
      <div>
        <div style={{ fontSize: "13px", fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>{desc}</div>
      </div>
    </Link>
  );
}
