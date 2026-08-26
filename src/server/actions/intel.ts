"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { getCachedTeamStats } from "@/lib/aoe2/stats-cache";

/**
 * Refuerza el cache de stats Companion de los jugadores de una
 * inscripción. Solo el dueño del equipo (o un admin) puede pedirlo.
 */
export async function refreshTeamIntelAction(formData: FormData): Promise<void> {
  const registrationId = String(formData.get("registrationId") ?? "");
  if (!registrationId) return;

  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: account } = await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single();
  if (!account) return;

  const { data: reg } = await supabase
    .from("team_registration")
    .select("id, team_account:team_account_id ( owner_id )")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return;

  const isOwner = reg.team_account?.owner_id === account.id;
  const isAdmin = ["admin", "super_admin"].includes(account.role);
  if (!isOwner && !isAdmin) return;

  // maxAgeDays 0 → refresca todo lo que venga
  await getCachedTeamStats(
    await playersOf(registrationId),
    { ensureFresh: true, maxAgeDays: 0 }
  );

  revalidatePath("/mi-equipo");
}

/** PlayerRefs de una inscripción (helper compartido por action y cron). */
export async function playersOf(
  registrationId: string
): Promise<{ playerRegistrationId: string; aoe2ProfileId: number }[]> {
  const admin = getSupabaseServiceRole() as any;
  const { data } = await admin
    .from("player_registration")
    .select("id, aoe2_profile_id")
    .eq("team_registration_id", registrationId);
  return (data ?? []).map((p: any) => ({
    playerRegistrationId: p.id,
    aoe2ProfileId: p.aoe2_profile_id,
  }));
}
