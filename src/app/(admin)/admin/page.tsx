import Link from "next/link";
import { Trophy, Users, Shield, BookOpen } from "lucide-react";

const cards = [
  { href: "/admin/torneo", icon: Trophy, title: "Edición del Torneo", desc: "Crear/editar edición, preset, configuración de ELO cap, comodines y jornadas." },
  { href: "/admin/equipos", icon: Users, title: "Equipos", desc: "Aprobar inscripciones, validar perfiles AoE2 Companion, gestionar ELO." },
  { href: "/admin/bracket", icon: Shield, title: "Bracket", desc: "Generar bracket, sorteo inicial de llaves, gestión de partidos." },
  { href: "/admin/handbook", icon: BookOpen, title: "Handbook", desc: "Subir PDF del reglamento. Bloquea la inscripción hasta que se descarga." },
];

export default function AdminHomePage() {
  return (
    <div>
      <span className="vertigo-kicker">PANEL DE ADMINISTRACIÓN</span>
      <h1 className="vertigo-title">Centro de control</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">Gestioná todos los aspectos del torneo VÉRTIGO desde este panel.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} style={{ textDecoration: "none" }}>
            <div className="vertigo-card vertigo-fade-in" style={{ cursor: "pointer", height: "100%" }}>
              <card.icon style={{ width: "24px", height: "24px", color: "var(--vertigo-purple-soft)", strokeWidth: 1.25, marginBottom: "16px" }} />
              <div className="vertigo-card-title" style={{ fontSize: "14px", marginBottom: "8px" }}>{card.title}</div>
              <p style={{ fontSize: "13px", color: "var(--vertigo-muted)", lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
