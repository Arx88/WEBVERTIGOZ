import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Verifica que el usuario autenticado sea admin o super_admin.
 * Usar en API routes y server actions que requieren permisos admin.
 *
 * @returns El account del usuario si es admin, o null si no lo es.
 */
export async function requireAdmin(): Promise<{
  id: string;
  role: string;
  display_name: string;
} | null> {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: account } = (await supabase
    .from("account")
    .select("id, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account || !["admin", "super_admin"].includes(account.role)) {
    return null;
  }

  return account;
}

/**
 * Verifica que el usuario autenticado sea super_admin (más restrictivo).
 * Usar en endpoints que crean/promueven admins.
 */
export async function requireSuperAdmin(): Promise<{
  id: string;
  role: string;
  display_name: string;
} | null> {
  const account = await requireAdmin();
  if (!account || account.role !== "super_admin") return null;
  return account;
}
