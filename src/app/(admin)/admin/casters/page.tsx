import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createCasterAction,
  setCasterTierAction,
  toggleCasterApprovalAction,
  deleteCasterAction,
} from "@/server/actions/auth";
import { Mic, Twitch, Youtube, Check, ExternalLink, Trash2, EyeOff, Eye, Clock } from "lucide-react";
import { ART_PREDICADOR } from "@/lib/art";
import HeroStat from "@/components/shared/hero-stat";
import { fmt } from "@/lib/format";

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

  // Llaves asignadas por caster — contexto para decidir tier y aprobaciones
  const casterIds = (casters ?? []).map((c: any) => c.id);
  const { data: matchRows } = casterIds.length
    ? ((await supabase
        .from("match")
        .select("stream_caster_id")
        .in("stream_caster_id", casterIds)) as { data: any })
    : { data: null };
  const matchCount: Record<string, number> = {};
  for (const m of matchRows ?? []) {
    if (m.stream_caster_id) matchCount[m.stream_caster_id] = (matchCount[m.stream_caster_id] ?? 0) + 1;
  }

  const total = casters?.length ?? 0;
  const official = casters?.filter((c: any) => c.tier === "official").length ?? 0;
  const secondary = casters?.filter((c: any) => c.tier === "secondary").length ?? 0;
  const community = casters?.filter((c: any) => c.tier === "community").length ?? 0;

  // Pendientes primero: es la acción urgente del staff
  const pendientes = (casters ?? []).filter((c: any) => !c.approved_at);
  const activos = (casters ?? []).filter((c: any) => !!c.approved_at);
  const pendientesCount = pendientes.length;

  return (
    <div className="vertigo-fade-in">
      {/* ═══ HERO compacto — el predicador ═══ */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid var(--vertigo-line-soft)",
          marginBottom: 22,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ART_PREDICADOR}
          alt=""
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center 30%", opacity: 0.38,
          }}
        />
        <div
          style={{
            position: "absolute", inset: 0,
            background:
              "linear-gradient(180deg, rgba(7,3,16,0.32) 0%, rgba(7,3,16,0.6) 60%, rgba(7,3,16,0.9) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)",
          }}
        />
        <div
          style={{
            position: "relative", zIndex: 2, padding: "36px 32px 28px",
            display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: 360,
          }}
        >
          <span className="vertigo-kicker">STAFF · MODERACIÓN DE TRANSMISIÓN</span>
          <h1
            className="vertigo-title"
            style={{ fontSize: "clamp(24px, 3.2vw, 38px)", margin: "6px 0 10px", textShadow: "0 4px 28px rgba(0,0,0,0.6)" }}
          >
            Gestión de casters
          </h1>
          <p className="vertigo-desc" style={{ margin: 0, fontSize: 14, maxWidth: 640 }}>
            Aprobá casters, asigná tier (oficial/secundario/comunidad) y vinculá canales Twitch,
            YouTube o Kick. Los pendientes aparecen primero.
          </p>
          {/* Métricas del roster integradas al hero */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <HeroStat value={total} label="Total" color="var(--vertigo-purple-pale)" />
            <HeroStat value={official} label="Oficiales" color="var(--vertigo-success)" />
            <HeroStat value={secondary} label="Secundarios" color="var(--vertigo-purple-soft)" />
            <HeroStat value={community} label="Comunidad" color="#fbbf24" />
            <HeroStat value={pendientesCount} label="Pendientes" color="var(--vertigo-danger)" />
          </div>
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

        {/* Lista: pendientes primero, después los que están al aire */}
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
            <div className="flex flex-col gap-5">
              {pendientes.length > 0 && (
                <section>
                  <div className="vertigo-subtitle" style={{ color: "var(--vertigo-danger)" }}>
                    <Clock style={{ width: 12, height: 12 }} />
                    Pendientes de aprobación
                    <span className="vertigo-badge vertigo-badge-danger ml-2">{pendientes.length}</span>
                  </div>
                  <div className="flex flex-col gap-3 mt-3">
                    {pendientes.map((c: any) => (
                      <CasterAdminCard key={c.id} c={c} llaves={matchCount[c.id] ?? 0} />
                    ))}
                  </div>
                </section>
              )}
              {activos.length > 0 && (
                <section>
                  <div className="vertigo-subtitle">
                    <Check style={{ width: 12, height: 12 }} />
                    Al aire
                    <span className="vertigo-badge vertigo-badge-success ml-2">{activos.length}</span>
                  </div>
                  <div className="flex flex-col gap-3 mt-3">
                    {activos.map((c: any) => (
                      <CasterAdminCard key={c.id} c={c} llaves={matchCount[c.id] ?? 0} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tarjeta de moderación — datos del caster + acciones de staff
// ─────────────────────────────────────────────────────────────

function CasterAdminCard({ c, llaves }: { c: any; llaves: number }) {
  return (
    <div className="vertigo-card">
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
              {c.approved_at
                ? `Aprobado ${fmt.date(c.approved_at)}`
                : "No aprobado — oculto en /casters"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-none">
          {!c.approved_at && (
            <span className="vertigo-badge vertigo-badge-danger">Oculto</span>
          )}
          <span className="vertigo-badge vertigo-badge-purple">
            {llaves === 0 ? "Sin llaves" : llaves === 1 ? "1 llave" : `${llaves} llaves`}
          </span>
          <span className={`vertigo-badge ${TIER_BADGE[c.tier] ?? "vertigo-badge-purple"}`}>
            {TIER_LABEL[c.tier] ?? c.tier}
          </span>
        </div>
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
            href={`https://youtube.com/@${String(c.youtube_channel).replace(/^@/, "")}`}
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

      {/* Moderación */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--vertigo-line)]">
        <form action={setCasterTierAction} className="flex items-center gap-2">
          <input type="hidden" name="caster_id" value={c.id} />
          <select
            name="tier"
            defaultValue={c.tier}
            className="!w-auto text-[12px]"
            title="Tier del caster"
          >
            <option value="official">Oficial</option>
            <option value="secondary">Secundario</option>
            <option value="community">Comunidad</option>
          </select>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost !py-1.5 !px-3 text-[12px]">
            <Check style={{ width: 12, height: 12 }} />
            Aplicar tier
          </button>
        </form>

        <form action={toggleCasterApprovalAction} className="ml-auto">
          <input type="hidden" name="caster_id" value={c.id} />
          {c.approved_at ? (
            <button type="submit" className="vertigo-btn vertigo-btn-ghost !py-1.5 !px-3 text-[12px]" title="Ocultar de /casters">
              <EyeOff style={{ width: 12, height: 12 }} />
              Desaprobar
            </button>
          ) : (
            <button type="submit" className="vertigo-btn vertigo-btn-primary !py-1.5 !px-3 text-[12px]" title="Hacer visible en /casters">
              <Eye style={{ width: 12, height: 12 }} />
              Aprobar
            </button>
          )}
        </form>

        <form action={deleteCasterAction}>
          <input type="hidden" name="caster_id" value={c.id} />
          <button type="submit" className="vertigo-btn vertigo-btn-danger !py-1.5 !px-3 text-[12px]" title="Eliminar caster">
            <Trash2 style={{ width: 12, height: 12 }} />
          </button>
        </form>
      </div>
    </div>
  );
}
