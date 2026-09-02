import Link from "next/link";
import { LogIn } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import UserMenu from "@/components/auth/user-menu";
import NotificationCenter from "@/components/notifications/notification-center";

/**
 * Píldora de sesión fija arriba a la derecha en todas las páginas públicas.
 * Server component: resuelve la sesión por cookies en cada request.
 * Sin sesión → "Ingresar". Con sesión → UserMenu (menú según rol).
 */
export default async function AuthBadge() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="fixed top-4 right-4 z-[100] flex items-center gap-2">
        <NotificationCenter />
        <Link
          href="/login"
          className="group flex items-center gap-2 rounded-full border border-[rgba(255,46,158,0.28)] bg-[rgba(10,0,17,0.75)] px-5 py-2.5 backdrop-blur-md transition-all duration-300 hover:border-[#ff2e9e]/80 hover:shadow-[0_0_28px_rgba(255,46,158,0.35)]"
        >
          <LogIn className="h-4 w-4 text-[#ff2e9e]" />
          <span className="font-cinzel text-[11px] uppercase tracking-[0.32em] text-[#ffb4dc] transition-colors duration-200 group-hover:text-white">
            Ingresar
          </span>
        </Link>
      </div>
    );
  }

  const { data: account } = await supabase
    .from("account")
    .select("display_name, role")
    .eq("supabase_auth_id", user.id)
    .maybeSingle();

  const displayName =
    (account as { display_name?: string | null } | null)?.display_name ||
    user.email?.split("@")[0] ||
    "Usuario";
  const role = (account as { role?: string | null } | null)?.role ?? "";

  return (
    <div className="fixed top-4 right-4 z-[100] flex items-center gap-2">
      <NotificationCenter />
      <UserMenu displayName={displayName} role={role} />
    </div>
  );
}
