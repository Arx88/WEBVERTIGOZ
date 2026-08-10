import Link from "next/link";
import { logoutAction } from "@/server/actions/auth";
import { LogOut } from "lucide-react";

type ActiveTab = "reino" | "partidos" | "disputas";

/**
 * Header simple del captain.
 * Logo VÉRTIGO + tag del equipo + nav (Reino, Partidos, Disputas) + logout.
 */
export function CaptainHeader({ active, teamTag }: { active: ActiveTab; teamTag?: string }) {
  return (
    <header className="vertigo-header">
      <div className="vertigo-header-left">
        <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
        <span className="vertigo-section-tag">{teamTag ?? "CAPITÁN"}</span>
      </div>
      <div className="vertigo-header-right">
        <nav className="vertigo-nav">
          <Link href="/mi-equipo" className={active === "reino" ? "active" : ""}>Reino</Link>
          <Link href="/mis-partidos" className={active === "partidos" ? "active" : ""}>Partidos</Link>
          <Link href="/disputas" className={active === "disputas" ? "active" : ""}>Disputas</Link>
        </nav>
        <form action={logoutAction}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            <LogOut style={{ width: 14, height: 14 }} />Salir
          </button>
        </form>
      </div>
    </header>
  );
}
