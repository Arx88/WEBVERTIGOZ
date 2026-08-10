import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/server/actions/auth";
import { AdminSidebarNav } from "./admin-sidebar-nav";
import { LogOut } from "lucide-react";

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
      <AdminSidebarNav />

      {/* Contenido principal */}
      <div className="vertigo-admin-main vertigo-scroll">
        {/* Topbar —Nombre usuario y logout */}
        <div className="vertigo-admin-topbar">
          <div className="vertigo-admin-topbar-user">
            <div className="vertigo-sidebar-user-avatar" style={{ width: "34px", height: "34px", fontSize: "13px" }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--vertigo-text)" }}>{displayName}</div>
              <div style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                {account.role === "super_admin" ? "Super Admin" : "Admin"}
              </div>
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "10px" }}>
              <LogOut size={12} />
              Salir
            </button>
          </form>
        </div>

        <div className="vertigo-admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}
