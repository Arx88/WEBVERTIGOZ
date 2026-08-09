import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/server/actions/auth";
import {
  LayoutDashboard, Trophy, Users, Brackets as BracketIcon,
  Calendar, Mic, Shield, BookOpen, AlertTriangle, ScrollText, LogOut,
} from "lucide-react";

export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: "/admin", label: "Centro", icon: LayoutDashboard },
  { href: "/admin/torneo", label: "Torneo", icon: Trophy },
  { href: "/admin/equipos", label: "Equipos", icon: Users },
  { href: "/admin/bracket", label: "Bracket", icon: BracketIcon },
  { href: "/admin/jornadas", label: "Jornadas", icon: Calendar },
  { href: "/admin/casters", label: "Casters", icon: Mic },
  { href: "/admin/emblemas", label: "Emblemas", icon: Shield },
  { href: "/admin/handbook", label: "Handbook", icon: BookOpen },
  { href: "/admin/disputas", label: "Disputas", icon: AlertTriangle },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role, display_name, email")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account || !["admin", "super_admin"].includes(account.role)) {
    redirect("/mi-equipo");
  }

  const displayName = account.display_name || account.email?.split("@")[0] || "Admin";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="vertigo-admin-shell">
      {/* Sidebar */}
      <aside className="vertigo-sidebar">
        {/* Header */}
        <div className="vertigo-sidebar-header">
          <Link href="/" className="vertigo-sidebar-logo">VÉRTIGO</Link>
          <div className="vertigo-sidebar-tag">Admin Panel</div>
        </div>

        {/* Navigation */}
        <nav className="vertigo-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              <item.icon />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer — user info + logout */}
        <div className="vertigo-sidebar-footer">
          <div className="vertigo-sidebar-user">
            <div className="vertigo-sidebar-user-avatar">{initials}</div>
            <div className="vertigo-sidebar-user-info">
              <div className="vertigo-sidebar-user-name">{displayName}</div>
              <div className="vertigo-sidebar-user-role">{account.role === "super_admin" ? "Super Admin" : "Admin"}</div>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ width: "100%", justifyContent: "center", padding: "10px", fontSize: "11px" }}>
              <LogOut size={14} />
              Salir
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="vertigo-admin-main vertigo-scroll">
        <div className="vertigo-admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
