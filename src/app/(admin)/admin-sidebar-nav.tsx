"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Trophy, Users, Brackets as BracketIcon,
  Calendar, Mic, Shield, BookOpen, AlertTriangle, ScrollText,
  BellRing, Menu, X, type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; section?: string }[] = [
  { href: "/admin", label: "Centro", icon: LayoutDashboard, section: "PRINCIPAL" },
  { href: "/admin/torneo", label: "Torneo", icon: Trophy, section: "TORNEO" },
  { href: "/admin/equipos", label: "Inscripciones", icon: Users, section: "TORNEO" },
  { href: "/admin/waitlist", label: "Lista de espera", icon: BellRing, section: "TORNEO" },
  { href: "/admin/bracket", label: "Bracket", icon: BracketIcon, section: "TORNEO" },
  { href: "/admin/jornadas", label: "Jornadas", icon: Calendar, section: "TORNEO" },
  { href: "/admin/casters", label: "Casters", icon: Mic, section: "CONTENIDO" },
  { href: "/admin/emblemas", label: "Emblemas", icon: Shield, section: "CONTENIDO" },
  { href: "/admin/handbook", label: "Handbook", icon: BookOpen, section: "CONTENIDO" },
  { href: "/admin/disputas", label: "Disputas", icon: AlertTriangle, section: "SOPORTE" },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText, section: "SOPORTE" },
];

const SECTIONS = [...new Set(NAV_ITEMS.map((i) => i.section).filter(Boolean))];

export function AdminSidebarNav({
  userName,
  userRole,
  initials,
}: {
  userName: string;
  userRole: string;
  initials: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, backdropFilter: "blur(4px)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Botón hamburguesa mobile */}
      <button
        className="vertigo-sidebar-mobile-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`vertigo-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        {/* Header con logo */}
        <div className="vertigo-sidebar-header">
          <Link href="/admin" style={{ textDecoration: "none", display: "block" }} onClick={() => setMobileOpen(false)}>
            <img
              src="/landing/logo.png"
              alt="VÉRTIGO Cup"
              style={{ width: 104, display: "block", margin: "0 auto" }}
            />
            <span className="vertigo-sidebar-tag">Panel de control</span>
          </Link>
        </div>

        {/* Nav agrupada por secciones */}
        <nav className="vertigo-sidebar-nav">
          {SECTIONS.map((section) => (
            <div key={section}>
              <div className="vertigo-sidebar-section">{section}</div>
              {NAV_ITEMS.filter((i) => i.section === section).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(item.href) ? "active" : ""}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer con usuario activo */}
        <div className="vertigo-sidebar-footer">
          <div className="vertigo-sidebar-user">
            <div className="vertigo-sidebar-user-avatar">{initials}</div>
            <div className="vertigo-sidebar-user-info">
              <div className="vertigo-sidebar-user-name">{userName}</div>
              <div className="vertigo-sidebar-user-role">{userRole}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
