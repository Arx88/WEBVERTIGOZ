import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Mic } from "lucide-react";
import { ART_PREDICADOR } from "@/lib/art";
import HeroStat from "@/components/shared/hero-stat";
import CasterCreateForm from "./caster-create-form";
import CastersManager from "./casters-manager";

export const dynamic = "force-dynamic";

export default async function AdminCastersPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: casters } = (await supabase
    .from("caster")
    .select("id, display_name, tier, twitch_channel, youtube_channel, kick_channel, approved_at, approved_by_id, created_at, featured")
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

  const pendientesCount = (casters ?? []).filter((c: any) => !c.approved_at).length;

  return (
    <div className="vertigo-fade-in">
      {/* ═══ HERO — mismo concepto, versión compacta con aire ═══ */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          border: "1px solid var(--vertigo-line-soft)",
          marginBottom: 28,
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
              "linear-gradient(180deg, rgba(7,3,16,0.32) 0%, rgba(7,3,16,0.62) 60%, rgba(7,3,16,0.92) 100%)",
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
            position: "relative", zIndex: 2, padding: "30px 32px 26px",
            display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: 220,
          }}
        >
          <span className="vertigo-kicker">STAFF · MODERACIÓN DE TRANSMISIÓN</span>
          <h1
            className="vertigo-title"
            style={{ fontSize: "clamp(22px, 2.6vw, 32px)", margin: "6px 0 8px", textShadow: "0 4px 28px rgba(0,0,0,0.6)" }}
          >
            Gestión de casters
          </h1>
          <p className="vertigo-desc" style={{ margin: 0, fontSize: 13.5, maxWidth: 680, lineHeight: 1.6 }}>
            Aprobá, asigná tier y vinculá canales. El destacado ocupa el reproductor
            principal de /casters cuando está en vivo.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 18 }}>
            <HeroStat value={total} label="Total" color="var(--vertigo-purple-pale)" />
            <HeroStat value={official} label="Oficiales" color="var(--vertigo-success)" />
            <HeroStat value={secondary} label="Secundarios" color="var(--vertigo-purple-soft)" />
            <HeroStat value={community} label="Comunidad" color="#fbbf24" />
            <HeroStat value={pendientesCount} label="Pendientes" color="var(--vertigo-danger)" />
          </div>
        </div>
      </div>

      <div className="caster-layout">
        <section aria-label="Nuevo caster">
          <div className="caster-col-head">
            <h2>Nuevo caster</h2>
            <p>Alta en 2 pasos con vista previa.</p>
          </div>
          <CasterCreateForm />
        </section>

        <section aria-label="Roster">
          <div className="caster-col-head">
            <h2>Roster</h2>
            <p>Pendientes primero · buscá y filtrá sin recargar.</p>
          </div>
          {total === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Mic className="mx-auto mb-4" style={{ width: 44, height: 44, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin casters</div>
                <p className="vertigo-empty-desc">Cargá el primero con el formulario de alta.</p>
              </div>
            </div>
          ) : (
            <CastersManager casters={(casters ?? []) as any[]} matchCount={matchCount} />
          )}
        </section>
      </div>
    </div>
  );
}
