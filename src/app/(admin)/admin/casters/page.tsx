import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { createCasterAction, updateCasterAction, deleteCasterAction } from "./caster-actions";
import Link from "next/link";
import { LogOut, Plus, Edit, Trash2, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminCastersPage() {
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

  const { data: casters } = (await supabase
    .from("caster")
    .select("id, name, channel_url, platform, tier, bio, created_at")
    .order("tier", { ascending: true })
    .order("name", { ascending: true })) as { data: any[] };

  const tierLabels: Record<string, { label: string; color: string }> = {
    official: { label: "OFICIAL", color: "var(--vertigo-purple)" },
    secondary: { label: "SECUNDARIO", color: "var(--vertigo-warning)" },
    community: { label: "COMUNIDAD", color: "var(--vertigo-muted)" },
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span className="vertigo-kicker">CASTERS</span>
          <h1 className="vertigo-title">Gestión de casters</h1>
        </div>
        <form action={logoutAction} style={{ display: "inline" }}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost">
            <LogOut size={14} style={{ display: "inline", marginRight: "6px" }} />
            Salir
          </button>
        </form>
      </div>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      <p className="vertigo-desc" style={{ marginBottom: "24px" }}>
        {casters?.length ?? 0} casters registrados. Asignar tier (official/secondary/community), vincular canales.
      </p>

      {/* Formulario de creación */}
      <section style={{ marginBottom: "32px" }}>
        <h2 className="vertigo-subtitle" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Plus size={14} /> Nuevo caster
        </h2>
        <form action={createCasterAction} style={{
          padding: "16px",
          background: "var(--vertigo-panel)",
          borderRadius: "10px",
          border: "1px solid var(--vertigo-line)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
        }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Nombre</label>
            <input name="name" type="text" required style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Plataforma</label>
            <select name="platform" style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }}>
              <option value="twitch">Twitch</option>
              <option value="youtube">YouTube</option>
              <option value="kick">Kick</option>
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>URL del canal</label>
            <input name="channel_url" type="url" placeholder="https://twitch.tv/..." style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Tier</label>
            <select name="tier" style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }}>
              <option value="official">Oficial</option>
              <option value="secondary">Secundario</option>
              <option value="community">Comunidad</option>
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "11px", color: "var(--vertigo-muted)", marginBottom: "4px" }}>Bio (opcional)</label>
            <textarea name="bio" rows={2} style={{ width: "100%", padding: "8px", background: "var(--vertigo-bg)", border: "1px solid var(--vertigo-line)", borderRadius: "6px", color: "var(--vertigo-text)", fontSize: "13px" }} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="vertigo-btn" style={{ background: "var(--vertigo-purple)", color: "#fff" }}>
              <Plus size={14} style={{ display: "inline", marginRight: "6px" }} />
              Crear caster
            </button>
          </div>
        </form>
      </section>

      {/* Lista de casters */}
      <section>
        <h2 className="vertigo-subtitle">Casters registrados</h2>
        {(!casters || casters.length === 0) ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <div className="vertigo-empty-title">Sin casters</div>
              <p className="vertigo-empty-desc">Creá el primer caster usando el formulario de arriba.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {casters.map((c) => {
              const tier = tierLabels[c.tier] ?? tierLabels.community;
              return (
                <div key={c.id} style={{
                  padding: "14px 16px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "10px",
                  border: `1px solid ${tier.color}44`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{
                        padding: "3px 8px",
                        background: `${tier.color}22`,
                        color: tier.color,
                        borderRadius: "999px",
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "1px",
                      }}>
                        {tier.label}
                      </span>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 700 }}>{c.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                          {c.platform}
                          {c.channel_url && (
                            <>
                              {" · "}
                              <a href={c.channel_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--vertigo-purple-soft)", textDecoration: "none" }}>
                                <Eye size={10} style={{ display: "inline", marginRight: "2px" }} />
                                Ver canal
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <form action={deleteCasterAction} style={{ display: "flex", gap: "8px" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ fontSize: "11px", padding: "4px 8px", borderColor: "var(--vertigo-danger)", color: "var(--vertigo-danger)" }}>
                        <Trash2 size={12} />
                      </button>
                    </form>
                  </div>
                  {c.bio && (
                    <p style={{ fontSize: "12px", color: "var(--vertigo-muted)", lineHeight: 1.5 }}>{c.bio}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
