import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Trophy, Users, Shield, Calendar, Mic, BookOpen,
  Settings, ScrollText, Layers,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminTorneoPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name, slug, status, elo_cap, elo_tolerance, max_teams, team_size, civs_base, civs_extra_finalist, comodin_reroll, comodin_anular, comodin_elegir_rival, comodin_invocar_pro, comodin_window_minutes, starts_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };

  const editionId = edition?.id;
  let totalTeams = 0;
  let pendingTeams = 0;
  if (editionId) {
    const { count: total } = (await supabase
      .from("team_registration")
      .select("id", { count: "exact", head: true })
      .eq("tournament_edition_id", editionId)) as { count: number | null };
    totalTeams = total ?? 0;
    const { count: pending } = (await supabase
      .from("team_registration")
      .select("id", { count: "exact", head: true })
      .eq("tournament_edition_id", editionId)
      .eq("status", "pending")) as { count: number | null };
    pendingTeams = pending ?? 0;
  }

  const STATUS_LABEL: Record<string, string> = {
    draft: "Borrador",
    registration: "Inscripción abierta",
    active: "En curso",
    finished: "Finalizada",
  };

  return (
    <div className="vertigo-fade-in">
      <span className="vertigo-kicker">TORNEO</span>
      <h1 className="vertigo-title">Configuración de la edición</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        Editá los parámetros de la edición activa: ELO cap, comodines, jornadas, casters oficiales y handbook.
      </p>

      <div className="vertigo-stats">
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Edición</div>
          <div className="vertigo-stat-value text-base">{edition?.name ?? "—"}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Status</div>
          <div className="vertigo-stat-value text-base">
            {edition ? STATUS_LABEL[edition.status] ?? edition.status : "—"}
          </div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Equipos</div>
          <div className="vertigo-stat-value">{totalTeams} / {edition?.max_teams ?? 32}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Pendientes</div>
          <div className="vertigo-stat-value text-[#fbbf24]">{pendingTeams}</div>
        </div>
      </div>

      <section className="mb-10">
        <div className="vertigo-subtitle">Parámetros del torneo</div>
        {!edition ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <div className="vertigo-empty-title">Sin edición activa</div>
              <p className="vertigo-empty-desc">Todavía no se creó ninguna edición del torneo.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">ELO Cap</div>
              <div className="vertigo-info-card-value">{edition.elo_cap} <span className="text-[var(--vertigo-faint)] text-xs">±{edition.elo_tolerance}</span></div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Tamaño de equipo</div>
              <div className="vertigo-info-card-value">{edition.team_size} jugadores</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Equipos máximos</div>
              <div className="vertigo-info-card-value">{edition.max_teams}</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Civs base</div>
              <div className="vertigo-info-card-value">{edition.civs_base}</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Civs extra (finalista)</div>
              <div className="vertigo-info-card-value">{edition.civs_extra_finalist}</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Inicio</div>
              <div className="vertigo-info-card-value text-sm">
                {edition.starts_at ? new Date(edition.starts_at).toLocaleDateString("es-AR") : "Sin fecha"}
              </div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Comodín · Reroll</div>
              <div className="vertigo-info-card-value">{edition.comodin_reroll}</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Comodín · Anular</div>
              <div className="vertigo-info-card-value">{edition.comodin_anular}</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Comodín · Elegir rival</div>
              <div className="vertigo-info-card-value">{edition.comodin_elegir_rival}</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Comodín · Invocar pro</div>
              <div className="vertigo-info-card-value">{edition.comodin_invocar_pro}</div>
            </div>
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Ventana comodines</div>
              <div className="vertigo-info-card-value">{edition.comodin_window_minutes} min</div>
            </div>
          </div>
        )}
      </section>

      <section className="mb-10">
        <div className="vertigo-subtitle">Accesos rápidos</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link href="/admin/equipos" className="vertigo-link-card">
            <Users className="vertigo-link-card-icon" />
            <div className="vertigo-link-card-title">Inscripciones</div>
            <p className="vertigo-link-card-desc">Aprobar equipos, validar ELO y perfiles de AoE2 Companion.</p>
          </Link>
          <Link href="/admin/bracket" className="vertigo-link-card">
            <Layers className="vertigo-link-card-icon" />
            <div className="vertigo-link-card-title">Bracket</div>
            <p className="vertigo-link-card-desc">Generar bracket SE de 32, sorteo inicial de seeds.</p>
          </Link>
          <Link href="/admin/jornadas" className="vertigo-link-card">
            <Calendar className="vertigo-link-card-icon" />
            <div className="vertigo-link-card-title">Jornadas</div>
            <p className="vertigo-link-card-desc">Programar horarios de partidos y asignar casters.</p>
          </Link>
          <Link href="/admin/casters" className="vertigo-link-card">
            <Mic className="vertigo-link-card-icon" />
            <div className="vertigo-link-card-title">Casters</div>
            <p className="vertigo-link-card-desc">Gestionar casters oficiales y de comunidad.</p>
          </Link>
          <Link href="/admin/emblemas" className="vertigo-link-card">
            <Shield className="vertigo-link-card-icon" />
            <div className="vertigo-link-card-title">Emblemas</div>
            <p className="vertigo-link-card-desc">Subir escudos para que los equipos elijan al inscribirse.</p>
          </Link>
          <Link href="/admin/handbook" className="vertigo-link-card">
            <BookOpen className="vertigo-link-card-icon" />
            <div className="vertigo-link-card-title">Handbook</div>
            <p className="vertigo-link-card-desc">Subir PDF con el reglamento completo del torneo.</p>
          </Link>
        </div>
      </section>

      <section>
        <div className="vertigo-subtitle">Nota</div>
        <div className="vertigo-card">
          <div className="flex items-start gap-3">
            <Settings className="flex-none text-[var(--vertigo-purple-soft)] mt-0.5" style={{ width: 18, height: 18 }} />
            <div>
              <div className="vertigo-card-title">Editor de parámetros</div>
              <p className="text-sm text-[var(--vertigo-muted)] mt-2 leading-relaxed">
                El editor visual de configuración estará disponible próximamente. Los parámetros actuales se muestran arriba en modo lectura. Para modificarlos, ejecutá SQL directo contra la tabla <code className="text-[var(--vertigo-purple-pale)]">tournament_edition</code>.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
