"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Trophy, Users, Brackets as BracketIcon,
  Calendar, Mic, Shield, BookOpen, AlertTriangle, ScrollText,
  Menu, X, type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon; section?: string }[] = [
  { href: "/admin", label: "Centro", icon: LayoutDashboard, section: "PRINCIPAL" },
  { href: "/admin/torneo", label: "Torneo", icon: Trophy, section: "TORNEO" },
  { href: "/admin/equipos", label: "Equipos", icon: Users, section: "TORNEO" },
  { href: "/admin/bracket", label: "Bracket", icon: BracketIcon, section: "TORNEO" },
  { href: "/admin/jornadas", label: "Jornadas", icon: Calendar, section: "TORNEO" },
  { href: "/admin/casters", label: "Casters", icon: Mic, section: "CONTENIDO" },
  { href: "/admin/emblemas", label: "Emblemas", icon: Shield, section: "CONTENIDO" },
  { href: "/admin/handbook", label: "Handbook", icon: BookOpen, section: "CONTENIDO" },
  { href: "/admin/disputas", label: "Disputas", icon: AlertTriangle, section: "SOPORTE" },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText, section: "SOPORTE" },
];

const SECTIONS = [...new Set(NAV_ITEMS.map(i => i.section).filter(Boolean))];

export function AdminSidebarNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === "/admin") return pathname === "/admin" || pathname === "/admin/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const navContent = (
    <>
      {SECTIONS.map((section) => (
        <div key={section}>
          <div className="vertigo-sidebar-section">{section}</div>
          {NAV_ITEMS.filter(i => i.section === section).map((item) => (
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
    </>
  );

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
        {navContent}
      </aside>
    </>
  );
}
