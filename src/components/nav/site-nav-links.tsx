"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Swords,
  Castle,
  Scale,
  Network,
  Trophy,
  CalendarDays,
  Coins,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  /** Separador vertical sutil antes de este item (corte visual entre grupos). */
  sepBefore?: boolean;
}

const ICONS: Record<string, LucideIcon> = {
  swords: Swords,
  castle: Castle,
  scale: Scale,
  network: Network,
  trophy: Trophy,
  calendar: CalendarDays,
  coins: Coins,
  settings: Settings,
};

/**
 * Links del nav unificado con estado activo según la ruta actual.
 * Cliente solo por el usePathname; el resto del nav es server component.
 * Los iconos llegan como nombre de string porque los componentes de lucide
 * no se pueden serializar de server a client.
 */
export function SiteNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="vertigo-nav">
      {items.map(({ href, label, icon, sepBefore }) => {
        const Icon = icon ? ICONS[icon] : null;
        return (
          <Fragment key={href}>
            {sepBefore && <span className="vertigo-nav-sep" aria-hidden />}
            <Link href={href} className={pathname === href ? "active" : ""}>
              {Icon && <Icon className="vertigo-nav-icon" aria-hidden />}
              {label}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
