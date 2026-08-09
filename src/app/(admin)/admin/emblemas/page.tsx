import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { uploadEmblemAction } from "@/server/actions/auth";
import { Shield, Upload, ImageIcon, Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminEmblemasPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: emblems } = (await supabase
    .from("emblem")
    .select("id, name, image_url, category, is_active, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .limit(200)) as { data: any };

  const total = emblems?.length ?? 0;
  const active = emblems?.filter((e: any) => e.is_active).length ?? 0;
  const inactive = total - active;

  return (
    <div className="vertigo-fade-in">
      <span className="vertigo-kicker">EMBLEMAS</span>
      <h1 className="vertigo-title">Gestión de emblemas</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        Subí los escudos que los equipos podrán elegir al inscribirse. Formato SVG o PNG transparente, 512×512px cuadrado. Mínimo 50 recomendados.
      </p>

      <div className="vertigo-stats">
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Total</div>
          <div className="vertigo-stat-value">{total}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Activos</div>
          <div className="vertigo-stat-value text-[var(--vertigo-success)]">{active}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Inactivos</div>
          <div className="vertigo-stat-value text-[var(--vertigo-faint)]">{inactive}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Recomendado</div>
          <div className="vertigo-stat-value text-base">≥ 50</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-6">
        {/* Uploader */}
        <section>
          <div className="vertigo-subtitle">Subir nuevo emblema</div>
          <div className="vertigo-card">
            <form action={uploadEmblemAction} className="flex flex-col gap-5">
              <div className="vertigo-field">
                <label>Nombre</label>
                <input
                  type="text"
                  name="name"
                  placeholder="Ej: Lobo Rojo"
                  required
                  maxLength={60}
                />
              </div>

              <div className="vertigo-field">
                <label>Categoría (opcional)</label>
                <input
                  type="text"
                  name="category"
                  placeholder="animales, runas, armas…"
                  maxLength={30}
                />
              </div>

              <div className="vertigo-field">
                <label>Archivo (SVG o PNG)</label>
                <input
                  type="file"
                  name="file"
                  accept="image/svg+xml,image/png"
                  required
                  className="!h-auto !py-3 file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-[var(--vertigo-purple)] file:text-white file:font-semibold file:text-xs file:cursor-pointer file:uppercase file:tracking-wider"
                />
              </div>

              <div className="vertigo-action-bar">
                <button type="submit" className="vertigo-btn vertigo-btn-primary">
                  <Upload style={{ width: 14, height: 14 }} />
                  Subir emblema
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Grid */}
        <section>
          <div className="vertigo-subtitle">
            Emblemas existentes
            <span className="vertigo-badge vertigo-badge-purple ml-2">{total}</span>
          </div>
          {total === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Shield className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin emblemas</div>
                <p className="vertigo-empty-desc">Subí el primer emblema usando el formulario de la izquierda.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {emblems.map((e: any) => (
                <div key={e.id} className="vertigo-card flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-lg border border-[var(--vertigo-line-soft)] flex items-center justify-center mb-3 overflow-hidden bg-[var(--vertigo-input-bg)]">
                    {e.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.image_url}
                        alt={e.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon style={{ width: 24, height: 24, color: "var(--vertigo-faint)" }} />
                    )}
                  </div>
                  <div className="font-cinzel text-sm text-[var(--vertigo-text)] truncate w-full">
                    {e.name}
                  </div>
                  {e.category && (
                    <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mt-1">
                      {e.category}
                    </div>
                  )}
                  <div className="mt-2">
                    {e.is_active ? (
                      <span className="vertigo-badge vertigo-badge-success">
                        <Check style={{ width: 10, height: 10 }} />
                        Activo
                      </span>
                    ) : (
                      <span className="vertigo-badge vertigo-badge-purple">
                        <X style={{ width: 10, height: 10 }} />
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
