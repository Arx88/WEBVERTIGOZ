import Link from "next/link";
import { Trophy, Users, Shield, BookOpen, Calendar, Mic, AlertTriangle, ScrollText } from "lucide-react";

const SECTIONS = [
  {
    href: "/admin/torneo",
    icon: Trophy,
    title: "Edición del Torneo",
    desc: "Configurar ELO cap, tolerancia, civs base/extra, comodines y parámetros generales de la edición activa.",
    accent: "#7c3aed",
  },
  {
    href: "/admin/equipos",
    icon: Users,
    title: "Inscripciones",
    desc: "Aprobar o rechazar equipos, validar perfiles de AoE2 Companion, verificar ELO cap y gestionar capitanes.",
    accent: "#a78bfa",
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
  },
  {
    href: "/admin/emblemas",
    icon: Shield,
    title: "Emblemas",
    desc: "Subir escudos SVG o PNG para que los equipos elijan al inscribirse. Mínimo 50 emblemas recomendados.",
    accent: "#c4b5fd",
  },
  {
    href: "/admin/disputas",
    icon: AlertTriangle,
    title: "Disputas",
    desc: "Resolver reclamos de capitanes, revisar screenshots, aplicar decisiones y restaurar resultados.",
    accent: "#fb7185",
  },
  {
    href: "/admin/auditoria",
    icon: ScrollText,
    title: "Auditoría",
    desc: "Verificación criptográfica de sorteos, log inmutable con hash chain, export CSV de eventos.",
    accent: "#22c55e",
  },
];

export default function AdminHomePage() {
  return (
    <div className="vertigo-fade-in">
      <span className="vertigo-kicker">PANEL DE ADMINISTRACIÓN</span>
      <h1 className="vertigo-title">Centro de control</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        Gestioná todos los aspectos del torneo VÉRTIGO desde este panel. Cada módulo está diseñado para una tarea específica del ciclo de vida del torneo.
      </p>

      {/* Grid de secciones */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "16px",
      }}>
        {SECTIONS.map((section, i) => (
          <Link
            key={section.href}
            href={section.href}
            className="vertigo-link-card vertigo-fade-in"
            style={{ animationDelay: `${0.05 * i}s` }}
          >
            <section.icon
              className="vertigo-link-card-icon"
              style={{ color: section.accent }}
            />
            <div className="vertigo-link-card-title">{section.title}</div>
            <p className="vertigo-link-card-desc">{section.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
