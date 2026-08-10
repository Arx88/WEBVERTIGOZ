"use client";

import Link from "next/link";
import { logoutAction } from "@/server/actions/auth";
import { LogOut, ChevronRight } from "lucide-react";

type ActiveTab = "reino" | "partidos" | "disputas";

/**
 * Header del captain con identidad del equipo visible.
 * Logo + escudo del equipo + nombre + tagline + nav contextual.
 */
export function CaptainHeader({
  active,
  teamTag,
  teamName,
  emblemUrl,
}: {
  active: ActiveTab;
  teamTag?: string;
  teamName?: string;
  emblemUrl?: string;
}) {
  return (
    <header className="vertigo-header">
      <div className="vertigo-header-left">
        {/* Logo con glow */}
        <Link href="/" className="vertigo-logo" style={{ opacity: 0.9 }}>
          VÉRTIGO
        </Link>

        {/* Separador */}
        <div style={{ width: "1px", height: "24px", background: "var(--vertigo-line)" }} />

        {/* Identidad del equipo */}
        {teamName && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Escudo pequeño */}
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1.5px solid var(--vertigo-purple)",
                background: "var(--vertigo-input-bg)",
                flex: "none",
                boxShadow: "0 0 12px rgba(124,58,237,0.2)",
              }}
            >
              {emblemUrl ? (
                <img src={emblemUrl} alt={teamName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{
                  width: "100%", height: "100%",
                  display: "grid", placeItems: "center",
                  fontFamily: "Cinzel, serif", fontSize: "14px", fontWeight: 700,
                  color: "var(--vertigo-purple-soft)",
                }}>
                  {teamName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--vertigo-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px" }}>
                {teamName}
              </div>
              {teamTag && (
                <div style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                  {teamTag}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Nav con breadcrumb-style */}
        <nav className="vertigo-nav" style={{ marginLeft: teamName ? "8px" : "0" }}>
          <Link href="/mi-equipo" className={active === "reino" ? "active" : ""}>
            Mi Reino
          </Link>
          <Link href="/mis-partidos" className={active === "partidos" ? "active" : ""}>
            Mis Partidos
          </Link>
          <Link href="/disputas" className={active === "disputas" ? "active" : ""}>
            Disputas
          </Link>
        </nav>
      </div>

      <div className="vertigo-header-right">
        {/* Indicador de sección activa para mobile */}
        <span className="vertigo-section-tag" style={{ display: "none" }}>
          {active === "reino" ? "MI REINO" : active === "partidos" ? "MIS PARTIDOS" : "DISPUTAS"}
        </span>
        <form action={logoutAction}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 18px", fontSize: "10px", gap: "6px" }}>
            <LogOut style={{ width: 13, height: 13 }} />
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
