import Link from "next/link";
import { LogIn } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import UserMenu from "@/components/auth/user-menu";
import SoundToggle from "@/components/shared/sound-toggle";
import { SiteNavLinks, type NavItem } from "./site-nav-links";
import { NavProgress } from "./nav-progress";

/**
 * VÉRTIGO Cup — Nav unificado.
 *
 * Un solo nav para todo el sitio: logo + menú según el rol del viewer +
 * chip de sesión INTEGRADO en la barra (centrado vertical, ya no flota
 * fijo sobre el header). El estado activo de los links marca la página
 * actual — no hace falta un tag de sección aparte.
 *
 * Orden por importancia de uso según rol:
 *  - Capitanes (owner): su hub diario primero (Mis Partidos / Mi Reino /
 *    Disputas), separado visualmente del grupo torneo.
 *  - Espectadores: Apuestas segunda (su feature de engagement).
 *  - Anónimos: Apuestas última, como gancho de conversión.
 *  - Admins: grupo torneo + Admin.
 */
export default async function SiteNav() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "";
  let displayName = "";
  if (user) {
    const { data: account } = await supabase
      .from("account")
      .select("display_name, role")
      .eq("supabase_auth_id", user.id)
      .maybeSingle();
    role = (account as { role?: string | null } | null)?.role ?? "";
    displayName =
      (account as { display_name?: string | null } | null)?.display_name ||
      user.email?.split("@")[0] ||
      "Usuario";
  }

  const torneo: NavItem[] = [
    { href: "/bracket", label: "Bracket", icon: "network" },
    { href: "/resultados", label: "Resultados", icon: "trophy" },
    { href: "/fixture", label: "Fixture", icon: "calendar" },
  ];

  // Streams de casters: visible para TODOS (participantes, apostadores,
  // casters, anónimos) — es la vidriera pública del torneo.
  const casters: NavItem = { href: "/casters", label: "Casters", icon: "radio" };

  let items: NavItem[];
  if (user && role === "owner") {
    items = [
      { href: "/mi-equipo", label: "Mi Reino", icon: "castle" },
      { href: "/mis-partidos", label: "Mis Partidos", icon: "swords" },
      { href: "/disputas", label: "Disputas", icon: "scale" },
      { ...torneo[0], sepBefore: true },
      torneo[1],
      torneo[2],
      { ...casters, sepBefore: true },
    ];
  } else if (user && role === "spectator") {
    items = [
      torneo[0],
      { href: "/apuestas", label: "Apuestas", icon: "coins" },
      torneo[2],
      torneo[1],
      { ...casters, sepBefore: true },
    ];
  } else if (!user) {
    items = [
      torneo[0],
      torneo[1],
      torneo[2],
      { href: "/apuestas", label: "Apuestas", icon: "coins" },
      { ...casters, sepBefore: true },
    ];
  } else {
    items = [...torneo, { ...casters, sepBefore: true }];
    if (role === "admin" || role === "super_admin") {
      items.push({ href: "/admin", label: "Admin", icon: "settings", sepBefore: true });
    }
  }

  return (
    <header className="vertigo-header">
      <div className="vertigo-header-left">
        <Link href="/" className="vertigo-logo" aria-label="VÉRTIGO CUP — inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-vertigo.webp"
            alt="VÉRTIGO CUP"
            className="vertigo-logo-img"
          />
        </Link>
        <SiteNavLinks items={items} />
      </div>

      <div className="vertigo-header-right">
        <SoundToggle />
        {user ? (
          <UserMenu displayName={displayName} role={role} />
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full border border-[rgba(255,46,158,0.28)] bg-[rgba(10,0,17,0.6)] px-4 py-2 backdrop-blur-md transition-all duration-300 hover:border-[#ff2e9e]/80 hover:shadow-[0_0_18px_rgba(255,46,158,0.3)]"
          >
            <LogIn className="h-3.5 w-3.5 text-[#ff2e9e]" />
            <span className="font-cinzel text-[10px] uppercase tracking-[0.28em] text-[#ffb4dc]">
              Ingresar
            </span>
          </Link>
        )}
      </div>
      <NavProgress />
    </header>
  );
}
