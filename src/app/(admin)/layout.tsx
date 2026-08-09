import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account || !["admin", "super_admin"].includes(account.role)) {
    redirect("/mi-equipo");
  }

  const navItems = [
    { href: "/admin", label: "Centro" },
    { href: "/admin/torneo", label: "Torneo" },
    { href: "/admin/equipos", label: "Equipos" },
    { href: "/admin/bracket", label: "Bracket" },
    { href: "/admin/jornadas", label: "Jornadas" },
    { href: "/admin/casters", label: "Casters" },
    { href: "/admin/emblemas", label: "Emblemas" },
    { href: "/admin/handbook", label: "Handbook" },
    { href: "/admin/disputas", label: "Disputas" },
    { href: "/admin/auditoria", label: "Auditoría" },
  ];

  return (
    <div className="vertigo-page vertigo-shell">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">ADMIN</span>
        </div>
        <nav className="vertigo-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className="vertigo-header-right">
          <form action={logoutAction} style={{ display: "inline" }}>
            <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="vertigo-content vertigo-scroll">
        {children}
      </main>
    </div>
  );
}
