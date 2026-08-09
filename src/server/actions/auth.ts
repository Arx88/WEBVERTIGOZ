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

async function requireAdminAccount() {
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
  return { supabase, account };
}

export async function createCasterAction(formData: FormData) {
  const { supabase, account } = await requireAdminAccount();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const tier = String(formData.get("tier") ?? "community");
  const twitch = String(formData.get("twitch_channel") ?? "").trim();
  const youtube = String(formData.get("youtube_channel") ?? "").trim();
  const kick = String(formData.get("kick_channel") ?? "").trim();

  if (!displayName) throw new Error("Falta nombre del caster");
  if (!["official", "secondary", "community"].includes(tier)) {
    throw new Error("Tier inválido");
  }

  const { error } = await supabase.from("caster").insert({
    account_id: account.id,
    display_name: displayName,
    tier,
    twitch_channel: twitch || null,
    youtube_channel: youtube || null,
    kick_channel: kick || null,
    approved_at: new Date().toISOString(),
    approved_by_id: account.id,
  });
  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/admin/casters");
}

export async function resolveDisputeAction(formData: FormData) {
  const { supabase, account } = await requireAdminAccount();
  const disputeId = String(formData.get("dispute_id") ?? "");
  const resolution = String(formData.get("resolution_notes") ?? "").trim();
  const verdict = String(formData.get("verdict") ?? "resolved");

  if (!disputeId) throw new Error("Falta ID de disputa");
  if (account.role !== "super_admin") {
    throw new Error("Solo super_admin puede resolver disputas");
  }

  const status = verdict === "rejected" ? "rejected" : "resolved";
  const { error } = await supabase
    .from("dispute")
    .update({
      status,
      resolution_notes: resolution || null,
      resolved_by_super_admin_id: account.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId);
  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/admin/disputas");
}

export async function generateBracketAction(formData: FormData) {
  const { supabase, account } = await requireAdminAccount();
  const editionId = String(formData.get("edition_id") ?? "");
  if (!editionId) throw new Error("Falta ID de edición");

  // Sorteo inicial de seeds: random puro (decisión #2 del usuario)
  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id")
    .eq("tournament_edition_id", editionId)
    .eq("status", "approved")) as { data: any };

  if (!regs || regs.length < 32) {
    throw new Error(`Faltan equipos aprobados — hay ${regs?.length ?? 0} de 32 necesarios`);
  }

  // Fisher-Yates shuffle
  const seeds = regs.map((r: any) => r.id);
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }

  // Asignar seeds
  await Promise.all(
    seeds.map((id: string, idx: number) =>
      supabase.from("team_registration").update({ seed: idx + 1 }).eq("id", id)
    )
  );

  revalidatePath("/admin/bracket");
  revalidatePath("/admin/jornadas");
}

export async function uploadEmblemAction(formData: FormData) {
  await requireAdminAccount();
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!name) throw new Error("Falta nombre del emblema");
  if (!file || file.size === 0) throw new Error("Falta archivo");
  // Stub — el uploader real está en EmblemasUploader client component
  revalidatePath("/admin/emblemas");
}
