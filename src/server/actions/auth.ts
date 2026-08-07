"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function logoutAction() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/login");
}

export async function approveTeamAction(registrationId: string) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: account } = await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single();

  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("Sin permisos de administrador");
  }

  const { error } = await supabase
    .from("team_registration")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by_id: account.id,
    })
    .eq("id", registrationId);

  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/admin/equipos");
}

export async function rejectTeamAction(registrationId: string) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: account } = await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single();

  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("Sin permisos de administrador");
  }

  const { error } = await supabase
    .from("team_registration")
    .update({ status: "rejected" })
    .eq("id", registrationId);

  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/admin/equipos");
}
