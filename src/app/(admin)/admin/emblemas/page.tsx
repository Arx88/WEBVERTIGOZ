import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import EmblemasUploader from "./emblemas-uploader";
import Link from "next/link";
import { LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminEmblemasPage() {
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

  // Buscar emblemas existentes
  const { data: emblems } = (await supabase
    .from("emblem")
    .select("id, key, name, image_url, created_at")
    .order("created_at", { ascending: false })) as { data: any[] };

  // Buscar qué equipos usan cada emblema
  const emblemIds = (emblems ?? []).map((e) => e.id);
  let usageMap: Record<string, number> = {};
  if (emblemIds.length > 0) {
    const { data: teams } = (await supabase
      .from("team_account")
      .select("emblem_id")
      .not("emblem_id", "is", null)
      .in("emblem_id", emblemIds)) as { data: any[] };
    teams?.forEach((t) => {
      if (t.emblem_id) {
        usageMap[t.emblem_id] = (usageMap[t.emblem_id] ?? 0) + 1;
      }
    });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <span className="vertigo-kicker">EMBLEMAS</span>
          <h1 className="vertigo-title">Gestión de emblemas</h1>
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
        Subí los escudos que los equipos podrán elegir al inscribirse. Formato SVG o PNG transparente, 512×512px. {emblems?.length ?? 0} emblemas cargados.
      </p>

      {/* Uploader (client component) */}
      <EmblemasUploader />

      {/* Grilla de emblemas existentes */}
      <section style={{ marginTop: "32px" }}>
        <h2 className="vertigo-subtitle">Emblemas cargados ({emblems?.length ?? 0})</h2>
        {(!emblems || emblems.length === 0) ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <div className="vertigo-empty-title">Sin emblemas</div>
              <p className="vertigo-empty-desc">Subí el primer emblema usando el formulario de arriba.</p>
            </div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: "12px",
          }}>
            {emblems.map((e) => {
              const usage = usageMap[e.id] ?? 0;
              return (
                <div key={e.id} style={{
                  padding: "12px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "10px",
                  border: "1px solid var(--vertigo-line)",
                  textAlign: "center",
                }}>
                  {e.image_url ? (
                    <img
                      src={e.image_url}
                      alt={e.name}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "contain",
                        margin: "0 auto 8px",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "60px",
                      height: "60px",
                      margin: "0 auto 8px",
                      background: "var(--vertigo-bg)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--vertigo-muted)",
                      fontSize: "20px",
                    }}>
                      ?
                    </div>
                  )}
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--vertigo-text)", wordBreak: "break-word" }}>
                    {e.name}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--vertigo-muted)", marginTop: "2px" }}>
                    {usage > 0 ? `${usage} equipo${usage > 1 ? "s" : ""}` : "Sin usar"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
