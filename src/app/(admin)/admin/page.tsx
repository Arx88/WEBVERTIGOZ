import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Trophy, Users, Shield, Calendar, Mic, AlertTriangle, ScrollText,
  BookOpen, BellRing, ArrowRight, type LucideIcon,
} from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";

export const dynamic = "force-dynamic";

type Section = {
  href: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string;
  metric?: { value: string | number; label: string; alert?: boolean };
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  registration: "Inscripción abierta",
  active: "En curso",
  finished: "Finalizada",
};

export default async function AdminHomePage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name, status, elo_cap, elo_tolerance")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };

  let registered = 0;
  let pending = 0;
  let approved = 0;
  let openDisputes = 0;
  let emblemCount = 0;
  let casterCount = 0;

  if (edition?.id) {
    const [regTotal, regPending, regApproved, disp, emb, cas] = await Promise.all([
      supabase.from("team_registration").select("id", { count: "exact", head: true }).eq("tournament_edition_id", edition.id),
      supabase.from("team_registration").select("id", { count: "exact", head: true }).eq("tournament_edition_id", edition.id).eq("status", "pending"),
      supabase.from("team_registration").select("id", { count: "exact", head: true }).eq("tournament_edition_id", edition.id).eq("status", "approved"),
      supabase.from("dispute").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"]),
      supabase.from("emblem").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("caster").select("id", { count: "exact", head: true }),
    ]);
    registered = (regTotal.count as number | null) ?? 0;
    pending = (regPending.count as number | null) ?? 0;
    approved = (regApproved.count as number | null) ?? 0;
    openDisputes = (disp.count as number | null) ?? 0;
    emblemCount = (emb.count as number | null) ?? 0;
    casterCount = (cas.count as number | null) ?? 0;
  }

  // Waitlist de cupo (cross-edición): solo admins pueden leerla (policy 0015).
  const { count: waitlistCount } = await supabase
    .from("cupo_waitlist")
    .select("id", { count: "exact", head: true });

  const editionLabel = edition ? (STATUS_LABEL[edition.status] ?? edition.status) : "Sin edición";
  const maxTeams = 32;

  const SECTIONS: Section[] = [
    {
      href: "/admin/equipos",
      icon: Users,
      title: "Inscripciones",
      desc: "Aprobar o rechazar equipos, validar perfiles de AoE2 Companion, verificar ELO cap y gestionar capitanes.",
      accent: "#a78bfa",
      metric: { value: pending, label: "pendientes de revisar", alert: pending > 0 },
    },
    {
      href: "/admin/waitlist",
      icon: BellRing,
      title: "Lista de espera",
      desc: "Emails anotados cuando el cupo quedó lleno. Al liberarse lugar (pago vencido o rechazo) el cron los avisa solos. Export en CSV.",
      accent: "#a78bfa",
      metric: { value: (waitlistCount as number | null) ?? 0, label: "anotados" },
    },
    {
      href: "/admin/torneo",
      icon: Trophy,
      title: "Edición del Torneo",
      desc: "Configurar ELO cap, tolerancia, civs base/extra, comodines y parámetros generales de la edición activa.",
      accent: "#7c3aed",
      metric: { value: `${approved}/${maxTeams}`, label: "reinos aprobados" },
    },
    {
      href: "/admin/bracket",
      icon: Shield,
      title: "Bracket",
      desc: "Generar bracket SE de 32, sorteo inicial de seeds con commit-reveal, visualizar partidos por ronda.",
      accent: "#c4b5fd",
    },
    {
      href: "/admin/jornadas",
      icon: Calendar,
      title: "Jornadas",
      desc: "Programar horarios de partidos, asignar casters, definir jornadas y ventanas de transmisión.",
      accent: "#7c3aed",
    },
    {
      href: "/admin/casters",
      icon: Mic,
      title: "Casters",
      desc: "Gestionar casters oficiales y de comunidad, vincular canales de Twitch, YouTube o Kick.",
      accent: "#a78bfa",
      metric: { value: casterCount, label: "casters registrados" },
    },
    {
      href: "/admin/emblemas",
      icon: Shield,
      title: "Emblemas",
      desc: "Subir escudos SVG o PNG para que los equipos elijan al inscribirse. Mínimo 50 emblemas recomendados.",
      accent: "#c4b5fd",
      metric: { value: emblemCount, label: "emblemas activos" },
    },
    {
      href: "/admin/disputas",
      icon: AlertTriangle,
      title: "Disputas",
      desc: "Resolver reclamos de capitanes, revisar screenshots, aplicar decisiones y restaurar resultados.",
      accent: "#fb7185",
      metric: { value: openDisputes, label: "disputas abiertas", alert: openDisputes > 0 },
    },
    {
      href: "/admin/handbook",
      icon: BookOpen,
      title: "Handbook",
      desc: "Subir y versionar el reglamento oficial que descargan los equipos durante la inscripción.",
      accent: "#7c3aed",
    },
    {
      href: "/admin/auditoria",
      icon: ScrollText,
      title: "Auditoría",
      desc: "Verificación criptográfica de sorteos, log inmutable con hash chain, export CSV de eventos.",
      accent: "#22c55e",
    },
  ];

  return (
    <div className="vertigo-fade-in">
      {/* Cabecera con estado vivo de la edición — métricas integradas al hero */}
      <AdminHero
        kicker="Panel de administración"
        title="Centro de control"
        desc={
          edition?.name ? (
            <>
              <strong style={{ color: "var(--vertigo-purple-pale)" }}>{edition.name}</strong> —{" "}
              {editionLabel.toLowerCase()} · ELO cap {edition.elo_cap?.toLocaleString()} (+{edition.elo_tolerance}).
              Todo lo que necesitás para gestionar el ciclo de vida del torneo, en un solo lugar.
            </>
          ) : (
            "Gestioná todos los aspectos del torneo VÉRTIGO desde este panel."
          )
        }
        stats={[
          { value: `${registered} / ${maxTeams}`, label: "Inscripciones" },
          { value: pending, label: "Pendientes", color: pending > 0 ? "var(--vertigo-warning)" : "var(--vertigo-text)" },
          { value: approved, label: "Aprobados", color: "var(--vertigo-success)" },
          { value: openDisputes, label: "Disputas", color: openDisputes > 0 ? "var(--vertigo-danger)" : "var(--vertigo-text)" },
        ]}
      />

      {/* Grid de secciones */}
      <div className="vertigo-stagger" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "18px",
      }}>
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="vertigo-link-card premium"
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "18px" }}>
              <section.icon
                className="vertigo-link-card-icon"
                style={{ color: section.accent, marginBottom: 0 }}
              />
              {section.metric && (
                <span
                  className={`vertigo-badge ${section.metric.alert ? "vertigo-badge-warning" : "vertigo-badge-purple"}`}
                >
                  {section.metric.value} {section.metric.label}
                </span>
              )}
            </div>
            <div className="vertigo-link-card-title">{section.title}</div>
            <p className="vertigo-link-card-desc">{section.desc}</p>
            <span className="vertigo-link-card-cta">
              Entrar al módulo
              <ArrowRight size={13} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
