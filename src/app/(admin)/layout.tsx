import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/server/actions/auth";
import { AdminSidebarNav } from "./admin-sidebar-nav";
import { LogOut, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

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
      <AdminSidebarNav
        userName={displayName}
        userRole={account.role === "super_admin" ? "Super Admin" : "Admin"}
        initials={initials}
      />

      {/* Contenido principal */}
      <div className="vertigo-admin-main vertigo-scroll">
        {/* Topbar — breadcrumb contexto + link al sitio + logout */}
        <div className="vertigo-admin-topbar">
          <div className="vertigo-admin-topbar-crumb">
            <span className="vertigo-admin-topbar-crumb-tag">Vértigo</span>
            <span className="vertigo-admin-topbar-crumb-sep" />
            <span className="vertigo-admin-topbar-crumb-current">Administración</span>
          </div>

          <div className="vertigo-admin-topbar-actions">
            <Link href="/" className="vertigo-btn vertigo-btn-ghost vertigo-topbar-link">
              <ExternalLink size={12} />
              Ver sitio
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="vertigo-btn vertigo-btn-ghost vertigo-topbar-link">
                <LogOut size={12} />
                Salir
              </button>
            </form>
          </div>
        </div>

        <div className="vertigo-admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
