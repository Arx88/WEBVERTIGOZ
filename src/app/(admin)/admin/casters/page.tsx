import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createCasterAction } from "@/server/actions/auth";
import { Mic, Twitch, Youtube, Check, X, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const TIER_BADGE: Record<string, string> = {
  official: "vertigo-badge-success",
  secondary: "vertigo-badge-purple",
  community: "vertigo-badge-warning",
};

const TIER_LABEL: Record<string, string> = {
  official: "Oficial",
  secondary: "Secundario",
  community: "Comunidad",
};

export default async function AdminCastersPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: casters } = (await supabase
    .from("caster")
    .select("id, display_name, tier, twitch_channel, youtube_channel, kick_channel, approved_at, approved_by_id, created_at")
    .order("created_at", { ascending: false })) as { data: any };

  const total = casters?.length ?? 0;
  const official = casters?.filter((c: any) => c.tier === "official").length ?? 0;
  const secondary = casters?.filter((c: any) => c.tier === "secondary").length ?? 0;
  const community = casters?.filter((c: any) => c.tier === "community").length ?? 0;

  return (
    <div className="vertigo-fade-in">
      <span className="vertigo-kicker">CASTERS</span>
      <h1 className="vertigo-title">Gestión de casters</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        Aprobá casters, asigná tier (oficial/secundario/comunidad) y vinculá canales Twitch, YouTube o Kick.
      </p>

      <div className="vertigo-stats">
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Total</div>
          <div className="vertigo-stat-value">{total}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Oficiales</div>
          <div className="vertigo-stat-value text-[var(--vertigo-success)]">{official}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Secundarios</div>
          <div className="vertigo-stat-value text-[var(--vertigo-purple-pale)]">{secondary}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Comunidad</div>
          <div className="vertigo-stat-value text-[#fbbf24]">{community}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* Formulario */}
        <section>
          <div className="vertigo-subtitle">Nuevo caster</div>
          <div className="vertigo-card">
            <form action={createCasterAction} className="flex flex-col gap-5">
              <div className="vertigo-field">
                <label>Nombre visible</label>
                <input
                  type="text"
                  name="display_name"
                  placeholder="Ej: VÉRTIGO Cast"
                  required
                  maxLength={100}
                />
              </div>

              <div className="vertigo-field">
                <label>Tier</label>
                <select name="tier" defaultValue="community">
                  <option value="official">Oficial — stream principal</option>
                  <option value="secondary">Secundario — co-stream</option>
                  <option value="community">Comunidad — stream libre</option>
                </select>
              </div>

              <div className="vertigo-field">
                <label>Twitch</label>
                <input
                  type="text"
                  name="twitch_channel"
                  placeholder="vertigoaoe (sin URL)"
                  maxLength={100}
                />
              </div>

              <div className="vertigo-field">
                <label>YouTube</label>
                <input
                  type="text"
                  name="youtube_channel"
                  placeholder="@vertigoaoe"
                  maxLength={100}
                />
              </div>

              <div className="vertigo-field">
                <label>Kick</label>
                <input
                  type="text"
                  name="kick_channel"
                  placeholder="vertigo"
                  maxLength={100}
                />
              </div>

              <div className="vertigo-action-bar">
                <button type="submit" className="vertigo-btn vertigo-btn-primary">
                  <Mic style={{ width: 14, height: 14 }} />
                  Crear caster
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Lista */}
        <section>
          <div className="vertigo-subtitle">
            Casters registrados
            <span className="vertigo-badge vertigo-badge-purple ml-2">{total}</span>
          </div>
          {total === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Mic className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin casters</div>
                <p className="vertigo-empty-desc">Cargá el primer caster usando el formulario de la izquierda.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {casters.map((c: any) => (
                <div key={c.id} className="vertigo-card">
                  <div className="vertigo-card-header">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex items-center justify-center rounded-full border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)] flex-none"
                        style={{ width: 38, height: 38 }}
                      >
                        <Mic style={{ width: 16, height: 16 }} strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-cinzel text-base font-semibold text-[var(--vertigo-text)] truncate">
                          {c.display_name}
                        </div>
                        <div className="text-[11px] text-[var(--vertigo-faint)]">
                          Aprobado {c.approved_at ? new Date(c.approved_at).toLocaleDateString("es-AR") : "—"}
                        </div>
                      </div>
                    </div>
                    <span className={`vertigo-badge ${TIER_BADGE[c.tier] ?? "vertigo-badge-purple"} flex-none`}>
                      {TIER_LABEL[c.tier] ?? c.tier}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {c.twitch_channel && (
                      <a
                        href={`https://twitch.tv/${c.twitch_channel}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vertigo-badge vertigo-badge-purple hover:opacity-80"
                      >
                        <Twitch style={{ width: 12, height: 12 }} />
                        {c.twitch_channel}
                        <ExternalLink style={{ width: 10, height: 10 }} />
                      </a>
                    )}
                    {c.youtube_channel && (
                      <a
                        href={`https://youtube.com/${c.youtube_channel}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="vertigo-badge vertigo-badge-purple hover:opacity-80"
                      >
                        <Youtube style={{ width: 12, height: 12 }} />
                        {c.youtube_channel}
                        <ExternalLink style={{ width: 10, height: 10 }} />
                      </a>
                    )}
                    {c.kick_channel && (
                      <span className="vertigo-badge vertigo-badge-purple">
                        Kick · {c.kick_channel}
                      </span>
                    )}
                    {!c.twitch_channel && !c.youtube_channel && !c.kick_channel && (
                      <span className="vertigo-badge vertigo-badge-purple">
                        Sin canales vinculados
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
