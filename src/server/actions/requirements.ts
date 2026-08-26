"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";

const TOGGLEABLE = [
  "anti_smurf_check",
  "payment_confirmed",
  "tutorial_watched",
  "discord_joined",
] as const;
type ToggleField = (typeof TOGGLEABLE)[number];

/**
 * El capitán autogestiona los requisitos que se marcan solos:
 * tutorial del torneo visto y unirse al Discord.
 */
export async function markRequirementAction(formData: FormData) {
  const field = String(formData.get("field") ?? "");
  if (field !== "tutorial_watched" && field !== "discord_joined") return;
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!registrationId) return;

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .maybeSingle()) as { data: any };
  if (!account) return;

  const service = getSupabaseServiceRole();
  const { data: reg } = (await service
    .from("team_registration")
    .select("id, team_account:team_account_id ( owner_id )")
    .eq("id", registrationId)
    .maybeSingle()) as { data: any };
  if (!reg) return;

  const isOwner = reg.team_account?.owner_id === account.id;
  const isAdmin = ["admin", "super_admin"].includes(account.role ?? "");
  if (!isOwner && !isAdmin) return;

  await service
    .from("team_registration")
    .update({ [field]: true, updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  revalidatePath("/mi-equipo");
  revalidatePath("/admin/equipos");
}

/** El staff marca/desmarca cualquier requisito desde el panel de equipos. */
export async function toggleRequirementAction(formData: FormData) {
  const field = String(formData.get("field") ?? "");
  if (!TOGGLEABLE.includes(field as ToggleField)) return;
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!registrationId) return;

  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: account } = (await supabase
    .from("account")
    .select("role")
    .eq("supabase_auth_id", user.id)
    .maybeSingle()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role ?? "")) return;

  const service = getSupabaseServiceRole();
  const { data: reg } = (await service
    .from("team_registration")
    .select(`id, ${field}`)
    .eq("id", registrationId)
    .maybeSingle()) as { data: any };
  if (!reg) return;

  await service
    .from("team_registration")
    .update({ [field]: !reg[field], updated_at: new Date().toISOString() })
    .eq("id", registrationId);
  revalidatePath("/admin/equipos");
  revalidatePath("/mi-equipo");
}
