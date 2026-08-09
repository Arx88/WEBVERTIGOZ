"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

// Wrappers para form actions (Next.js espera (formData) => void | Promise<void>)
async function wrap<T>(fn: () => Promise<T>, _fd: FormData): Promise<void> {
  await fn();
}

export async function createCasterAction(fd: FormData): Promise<void> {
  await wrap(async () => {
    const admin = await requireAdmin();
    if (!admin) throw new Error("No autorizado.");

    const name = fd.get("name") as string;
    const platform = (fd.get("platform") as string) || "twitch";
    const channelUrl = (fd.get("channel_url") as string) || null;
    const tier = (fd.get("tier") as string) || "community";
    const bio = (fd.get("bio") as string) || null;

    if (!name || name.trim().length < 2) {
      throw new Error("Nombre requerido (mínimo 2 caracteres).");
    }

    const supabase = (await getSupabaseServer()) as any;
    const { error } = await supabase.from("caster").insert({
      name: name.trim(),
      platform,
      channel_url: channelUrl,
      tier,
      bio,
    });

    if (error) throw new Error(`DB error: ${error.message}`);

    revalidatePath("/admin/casters");
    revalidatePath("/casters");
  }, fd);
}

export async function updateCasterAction(fd: FormData): Promise<void> {
  await wrap(async () => {
    const admin = await requireAdmin();
    if (!admin) throw new Error("No autorizado.");

    const id = fd.get("id") as string;
    const name = fd.get("name") as string;
    const platform = (fd.get("platform") as string) || "twitch";
    const channelUrl = (fd.get("channel_url") as string) || null;
    const tier = (fd.get("tier") as string) || "community";
    const bio = (fd.get("bio") as string) || null;

    if (!id) throw new Error("ID requerido.");
    if (!name) throw new Error("Nombre requerido.");

    const supabase = (await getSupabaseServer()) as any;
    const { error } = await supabase
      .from("caster")
      .update({
        name: name.trim(),
        platform,
        channel_url: channelUrl,
        tier,
        bio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) throw new Error(`DB error: ${error.message}`);

    revalidatePath("/admin/casters");
    revalidatePath("/casters");
  }, fd);
}

export async function deleteCasterAction(fd: FormData): Promise<void> {
  await wrap(async () => {
    const admin = await requireAdmin();
    if (!admin) throw new Error("No autorizado.");

    const id = fd.get("id") as string;
    if (!id) throw new Error("ID requerido.");

    const supabase = (await getSupabaseServer()) as any;
    const { error } = await supabase.from("caster").delete().eq("id", id);

    if (error) throw new Error(`DB error: ${error.message}`);

    revalidatePath("/admin/casters");
    revalidatePath("/casters");
  }, fd);
}
