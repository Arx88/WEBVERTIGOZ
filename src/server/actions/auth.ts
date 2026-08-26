"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { GENERIC_AVATARS } from "@/lib/constants";
import {
  ensureDeviceForSession,
  forgetDevice,
  homeForRole,
  restoreDeviceSession,
} from "@/lib/device-trust";
import { refreshPlayerStatsCache } from "@/lib/aoe2/stats-cache";

export async function logoutAction() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  // La cookie de dispositivo confiable NO se borra: permite volver a
  // entrar con un clic desde /login. Se puede olvidar desde el chip.
  revalidatePath("/");
  redirect("/");
}

/** Recuerda este navegador para la sesión actual (acceso rápido de un clic). */
export async function ensureDeviceTrustAction(): Promise<{ ok: boolean }> {
  await ensureDeviceForSession();
  return { ok: true };
}

/** Un clic en la cuenta recordada → restaura la sesión sin contraseña. */
export async function restoreDeviceAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (!email) redirect("/login");
  const res = await restoreDeviceSession(email);
  if (!res.ok) redirect("/login");
  revalidatePath("/", "layout");
  redirect(homeForRole(res.role));
}

/** Botón × del chip: olvida la cuenta recordada en este navegador. */
export async function forgetDeviceAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (email) await forgetDevice(email);
  revalidatePath("/login");
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

  // Control de cupo (defensa en profundidad): el wizard ya frena inscripciones
  // nuevas al llegar a max_teams, pero el admin puede aprobar a mano y superar
  // el cupo. Contamos solo los aprobados, que son los que ocupan slot.
  const service = getSupabaseServiceRole() as any;
  const { data: reg } = await service
    .from("team_registration")
    .select("id, status, tournament_edition_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) throw new Error("Inscripción no encontrada");
  if (reg.status !== "approved") {
    const { data: edition } = await service
      .from("tournament_edition")
      .select("max_teams")
      .eq("id", reg.tournament_edition_id)
      .maybeSingle();
    const maxTeams = edition?.max_teams ?? 32;
    const { count: approvedCount } = await service
      .from("team_registration")
      .select("id", { count: "exact", head: true })
      .eq("tournament_edition_id", reg.tournament_edition_id)
      .eq("status", "approved");
    if ((approvedCount ?? 0) >= maxTeams) {
      throw new Error(
        `Cupo lleno: ya hay ${approvedCount} equipos aprobados de ${maxTeams} permitidos. Rechazá o quitá alguno antes de aprobar otro.`
      );
    }
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

  // Cache inicial de stats Companion (rm_team) para el intel del equipo.
  // No bloquea la aprobación si Companion no responde.
  try {
    const admin = getSupabaseServiceRole() as any;
    const { data: players } = await admin
      .from("player_registration")
      .select("id, aoe2_profile_id")
      .eq("team_registration_id", registrationId);
    await Promise.all(
      (players ?? []).map((p: any) => refreshPlayerStatsCache(p.aoe2_profile_id, p.id))
    );
  } catch (e) {
    console.error("[approveTeam] refresco de stats falló (no fatal):", e);
  }

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
  const category = String(formData.get("category") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!name) throw new Error("Falta nombre del emblema");
  if (!file || file.size === 0) throw new Error("Falta archivo");

  const MAX_EMBLEM_BYTES = 2 * 1024 * 1024; // 2 MB
  if (file.size > MAX_EMBLEM_BYTES) throw new Error("El archivo supera los 2 MB");
  const lower = file.name.toLowerCase();
  const ext = lower.endsWith(".svg") || file.type === "image/svg+xml" ? "svg"
    : lower.endsWith(".png") || file.type === "image/png" ? "png"
    : null;
  if (!ext) throw new Error("Formato no soportado: solo SVG o PNG");

  // Bucket público emblems: el archivo sale del nombre del emblema (los
  // emblemas se referencian por URL pública desde el wizard y los equipos).
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "emblema";
  const path = `${slug}.${ext}`;

  const service = getSupabaseServiceRole() as any;
  const { error: upErr } = await service.storage
    .from("emblems")
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "31536000" });
  if (upErr) throw new Error(`Storage: ${upErr.message}`);

  const { data: pub } = service.storage.from("emblems").getPublicUrl(path);

  // sort_order al final de la lista
  const { data: last } = await service
    .from("emblem")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insErr } = await service.from("emblem").insert({
    name: name.slice(0, 60),
    category: category ? category.slice(0, 30) : null,
    image_url: pub?.publicUrl ?? "",
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (insErr) throw new Error(`No se pudo registrar el emblema: ${insErr.message}`);

  revalidatePath("/admin/emblemas");
  revalidatePath("/registro");
}

// ============================================================
// Auto-registro de casters (registro libre, el admin modera después)
// ============================================================

/**
 * Registro libre de caster: crea la cuenta (o loguea una existente),
 * la promueve a rol 'caster' e inserta la fila caster ya aprobada
 * con tier 'community'. Queda visible en /casters de inmediato;
 * el admin puede cambiar tier, desaprobar o eliminar después.
 */
export async function registerCasterAction(
  formData: FormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  const displayName = String(formData.get("display_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const twitch = String(formData.get("twitch_channel") ?? "").trim();
  const youtube = String(formData.get("youtube_channel") ?? "").trim();
  const kick = String(formData.get("kick_channel") ?? "").trim();

  if (!displayName) return { ok: false, error: "Elegí tu nombre de caster." };
  if (!email || !email.includes("@")) return { ok: false, error: "Ingresá un email válido." };
  if (password.length < 6) return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  if (!twitch && !youtube && !kick) {
    return { ok: false, error: "Cargá al menos un canal (Twitch, YouTube o Kick)." };
  }

  const admin = getSupabaseServiceRole() as any;
  const supabase = (await getSupabaseServer()) as any;

  // 1. Crear la cuenta de auth (auto-confirm) o loguear una existente
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "caster", display_name: displayName },
  });

  if (createErr) {
    if (!/already/i.test(createErr.message)) {
      return { ok: false, error: createErr.message };
    }
    // Cuenta existente → login para verificar que es su dueño
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) {
      return { ok: false, error: "Ya existe una cuenta con ese email y la contraseña no coincide. Iniciá sesión y volvé a intentar." };
    }
  } else {
    // Auto-login de la cuenta recién creada
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
    if (loginErr) return { ok: false, error: `Cuenta creada, pero falló el login: ${loginErr.message}` };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No se pudo verificar la sesión." };

  // 2. Promover el account a caster (el trigger de auth lo creó como 'owner')
  const { data: accountRow } = (await admin
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .maybeSingle()) as { data: any };

  if (!accountRow) {
    const { error: insErr } = await admin.from("account").insert({
      supabase_auth_id: user.id,
      email,
      role: "caster",
      display_name: displayName,
      avatar_key: GENERIC_AVATARS[Math.floor(Math.random() * GENERIC_AVATARS.length)],
    });
    if (insErr) return { ok: false, error: `Error creando tu cuenta: ${insErr.message}` };
  } else if (accountRow.role !== "caster") {
    const { error: upErr } = await admin
      .from("account")
      .update({ role: "caster", display_name: displayName })
      .eq("id", accountRow.id);
    if (upErr) return { ok: false, error: `Error activando tu cuenta de caster: ${upErr.message}` };
  }

  // 3. Fila caster: registro libre → ya aprobado, tier community
  const { data: accountFinal } = (await admin
    .from("account")
    .select("id")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  const { error: casterErr } = await admin.from("caster").insert({
    account_id: accountFinal.id,
    display_name: displayName,
    tier: "community",
    twitch_channel: twitch || null,
    youtube_channel: youtube || null,
    kick_channel: kick || null,
    approved_at: new Date().toISOString(),
    approved_by_id: null, // auto-registro: sin aprobador humano
  });
  if (casterErr) {
    if (/caster_unique_account/i.test(casterErr.message)) {
      return { ok: false, error: "Ya estás registrado como caster." };
    }
    return { ok: false, error: `Error creando tu perfil de caster: ${casterErr.message}` };
  }

  revalidatePath("/casters");
  revalidatePath("/admin/casters");
  await ensureDeviceForSession();
  return { ok: true };
}

// ============================================================
// Moderación de casters (admin)
// ============================================================

export async function setCasterTierAction(formData: FormData) {
  const { supabase } = await requireAdminAccount();
  const casterId = String(formData.get("caster_id") ?? "");
  const tier = String(formData.get("tier") ?? "");
  if (!casterId) throw new Error("Falta ID del caster");
  if (!["official", "secondary", "community"].includes(tier)) throw new Error("Tier inválido");

  const { error } = await supabase
    .from("caster")
    .update({ tier })
    .eq("id", casterId);
  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/admin/casters");
  revalidatePath("/casters");
}

/** Pone/saca approved_at. Sin approved_at el caster no aparece en /casters. */
export async function toggleCasterApprovalAction(formData: FormData) {
  const { supabase, account } = await requireAdminAccount();
  const casterId = String(formData.get("caster_id") ?? "");
  if (!casterId) throw new Error("Falta ID del caster");

  const { data: row } = (await supabase
    .from("caster")
    .select("approved_at")
    .eq("id", casterId)
    .single()) as { data: any };
  if (!row) throw new Error("Caster no encontrado");

  const { error } = row.approved_at
    ? await supabase
        .from("caster")
        .update({ approved_at: null, approved_by_id: null })
        .eq("id", casterId)
    : await supabase
        .from("caster")
        .update({ approved_at: new Date().toISOString(), approved_by_id: account.id })
        .eq("id", casterId);
  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/admin/casters");
  revalidatePath("/casters");
}

export async function deleteCasterAction(formData: FormData) {
  const { supabase } = await requireAdminAccount();
  const casterId = String(formData.get("caster_id") ?? "");
  if (!casterId) throw new Error("Falta ID del caster");

  const { error } = await supabase.from("caster").delete().eq("id", casterId);
  if (error) throw new Error(`Error: ${error.message}`);

  revalidatePath("/admin/casters");
  revalidatePath("/casters");
}
