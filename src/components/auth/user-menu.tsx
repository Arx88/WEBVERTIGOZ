"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Coins, Flag, LogOut, Mic, Shield, Swords, Trophy } from "lucide-react";
import { logoutAction } from "@/server/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";

type MenuItem = { href: string; label: string; Icon: typeof Coins };

function itemsFor(role: string): MenuItem[] {
  switch (role) {
    case "spectator":
      return [{ href: "/apuestas", label: "Mis apuestas", Icon: Coins }];
    case "caster":
      return [{ href: "/casters", label: "Mi perfil de caster", Icon: Mic }];
    case "admin":
    case "super_admin":
      return [{ href: "/admin", label: "Panel de administración", Icon: Shield }];
    default:
      return [
        { href: "/mi-equipo", label: "Mi equipo", Icon: Swords },
        { href: "/mis-partidos", label: "Mis partidos", Icon: Trophy },
        { href: "/disputas", label: "Disputas", Icon: Flag },
      ];
  }
}

/**
 * Chip de usuario con menú desplegable. Los destinos del menú dependen del
 * rol de la cuenta (espectador / caster / capitán / admin).
 */
export default function UserMenu({ displayName, role }: { displayName: string; role: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials =
    displayName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "V";
  const items = itemsFor(role);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex cursor-pointer items-center gap-2.5 rounded-full border border-[rgba(255,46,158,0.28)] bg-[rgba(10,0,17,0.75)] py-1.5 pl-2 pr-3 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.45)] transition-all duration-300 hover:border-[#ff2e9e]/70 hover:shadow-[0_0_22px_rgba(255,46,158,0.25)]"
        title={ROLE_LABEL[role] ?? ""}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-[#ff2e9e] to-[#7c3aed] font-cinzel text-[12px] font-bold tracking-wide text-white">
          {initials}
        </span>
        <span className="max-w-[140px] truncate text-[13px] font-medium text-[#f2eef7]">
          {displayName}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#ffb4dc]/70 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[101] mt-2 w-60 overflow-hidden rounded-xl border border-[rgba(255,46,158,0.22)] bg-[rgba(10,0,17,0.96)] shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          <div className="border-b border-[rgba(255,255,255,0.07)] px-4 py-3">
            <p className="truncate text-[13px] font-semibold text-[#f2eef7]">{displayName}</p>
            <p className="font-cinzel mt-0.5 text-[10px] uppercase tracking-[0.28em] text-[#ffb4dc]/80">
              {ROLE_LABEL[role] ?? "Miembro"}
            </p>
          </div>

          <div className="py-1.5">
            {items.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-[#e6d3f5]/85 transition-colors duration-150 hover:bg-[rgba(255,46,158,0.12)] hover:text-white"
              >
                <Icon className="h-4 w-4 text-[#ff2e9e]" />
                {label}
              </Link>
            ))}
          </div>

          <div className="border-t border-[rgba(255,255,255,0.07)] py-1.5">
            <form action={logoutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[13px] text-[#e6d3f5]/70 transition-colors duration-150 hover:bg-[rgba(255,46,158,0.12)] hover:text-white"
              >
                <LogOut className="h-4 w-4 text-[#ffb4dc]/70" />
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
