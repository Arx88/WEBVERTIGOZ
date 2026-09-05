"use server";

/**
 * VÉRTIGO Cup — Actions de RULETAS y STAFF.
 *
 * Ruletas: edita el preset_version de la edición activa. El preset es la
 * config de la ruleta/memotest: modos, antimetas (con su pool de mapas),
 * formatos, llaves, mapas y presentación — todo editable desde /admin/ruletas.
 * Cada guardado crea una NUEVA versión del preset si ya fue usado por
 * sorteos (historial intacto, draws viejos siguen apuntando a su versión).
 *
 * Staff: lista cuentas de staff y habilita/quita admins por email.
 * SOLO super_admin puede otorgar o quitar el rol de admin.
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { requireAdminAccount } from "./match-day";
import { logAdminAction } from "@/lib/admin-audit";

// ============================================================
// RULETAS (preset de la ruleta)
// ============================================================

const KIND_KEYS = {
  MODO: "gameModes",
  ANTIMETA: "antimetaModes",
  FORMATO: "playerModes",
  LLAVE: "llaveModes",
  MAPA: "mapModes",
} as const;

type Kind = keyof typeof KIND_KEYS;
type PresetMode = {
  id: string;
  title: string;
  tag?: string;
  color?: string;
  img?: string;
  kind?: string;
  weight?: number;
  civsPerTeam?: number;
  llaveFormat?: "BO1" | "BO3";
  [k: string]: unknown;
};
type PresetConfig = {
  gameModes: PresetMode[];
  antimetaModes: PresetMode[];
  playerModes: PresetMode[];
  mapModes: PresetMode[];
  llaveModes: PresetMode[];
  sounds?: { enabled: boolean; volume: number };
  music?: { enabled: boolean; volume: number };
  [k: string]: unknown;
};

/** Carga la edición activa + su preset (crea v1 si la edición no tiene). */
async function loadEditionPreset(service: any, editionId: string) {
  const { data: edition } = await service
    .from("tournament_edition")
    .select("id, name, preset_version_id")
    .eq("id", editionId)
    .single();
  if (!edition) return null;

  let preset = null;
  if (edition.preset_version_id) {
    const { data } = await service
      .from("preset_version")
      .select("*")
      .eq("id", edition.preset_version_id)
      .single();
    preset = data;
  }
  return { edition, preset };
}

/**
 * Guarda un config completo de preset en la edición.
 * PATRÓN DE VERSIONADO (compartido por todas las actions de ruletas):
 *  - Si el preset actual ya fue referenciado por sorteos (roulette_draw),
 *    INSERTA una versión nueva (n+1) y la engancha a la edición — el
 *    historial de draws viejos sigue apuntando a su versión original.
 *  - Si no, actualiza in place (es v1 sin uso).
 * Devuelve { ok: true } o { ok: false, error }.
 */
async function persistPresetConfig(
  service: any,
  editionId: string,
  preset: any,
  nextConfig: PresetConfig
): Promise<{ ok: boolean; error?: string }> {
  const { count } = (await service
    .from("roulette_draw")
    .select("id", { count: "exact", head: true })
    .eq("preset_version_id", preset.id)) as { count: number | null };
  const inUse = (count ?? 0) > 0;

  if (!inUse) {
    const { error } = await service
      .from("preset_version")
      .update({ config: nextConfig })
      .eq("id", preset.id);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
  } else {
    const { data: maxRow } = await service
      .from("preset_version")
      .select("version")
      .order("version", { ascending: false })
      .limit(1)
      .single();
    const nextVersion = (maxRow?.version ?? 0) + 1;
    const { data: created, error } = await service
      .from("preset_version")
      .insert({ version: nextVersion, config: nextConfig })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: `No se pudo crear la nueva versión: ${error?.message ?? "?"}` };
    await service
      .from("tournament_edition")
      .update({ preset_version_id: created.id, updated_at: new Date().toISOString() })
      .eq("id", editionId);
  }
  return { ok: true };
}

// ============================================================
// GUARDADO COMPLETO del preset (editor de /admin/ruletas)
// ============================================================

const LIST_NAME = {
  gameModes: "Modos",
  playerModes: "Formatos",
  mapModes: "Mapas",
} as const;

/**
 * Valida un config de preset venido del editor.
 * Reglas del sorteo (draw-engine) que el config tiene que respetar:
 *  - gameModes / playerModes / mapModes no vacíos Y con al menos una
 *    opción activa (weight>0): sin eso el sorteo revienta.
 *  - ids únicos (la ruleta en vivo matchea el resultado por id).
 *  - mapPool de un antimeta solo puede referenciar mapas existentes.
 */
function validatePresetConfig(config: PresetConfig): string | null {
  if (!config || typeof config !== "object") return "Config inválida.";
  for (const key of ["gameModes", "playerModes", "mapModes", "antimetaModes", "llaveModes"] as const) {
    if (!Array.isArray(config[key])) return `Falta la lista ${key} en la configuración.`;
  }
  for (const [key, label] of Object.entries(LIST_NAME)) {
    const arr = config[key as keyof typeof LIST_NAME] as PresetMode[];
    if (arr.length === 0) return `${label}: la lista no puede quedar vacía.`;
    if (!arr.some((m) => (m.weight ?? 1) > 0)) {
      return `${label}: tiene que quedar al menos una opción activa (peso mayor a 0).`;
    }
  }
  const mapIds = new Set((config.mapModes as PresetMode[]).map((m) => m.id));
  const allIds = new Set<string>();
  for (const key of ["gameModes", "playerModes", "mapModes", "antimetaModes", "llaveModes"] as const) {
    for (const m of config[key] as PresetMode[]) {
      if (!m.id || !m.title) return `Hay una opción sin id o título en ${key}.`;
      if (allIds.has(m.id)) return `Id duplicado: ${m.id}. Los ids tienen que ser únicos.`;
      allIds.add(m.id);
    }
  }
  for (const am of config.antimetaModes as PresetMode[]) {
    const pool = (am as any).mapPool;
    if (Array.isArray(pool)) {
      for (const p of pool as PresetMode[]) {
        if (!mapIds.has(p.id)) {
          return `El mapPool de "${am.title}" referencia un mapa que no existe: ${p.id ?? "?"}.`;
        }
      }
    }
  }
  return null;
}

/**
 * Guarda el config COMPLETO del preset de ruleta desde el editor de
 * /admin/ruletas (modos, antimetas con mapPool, formatos, llaves, mapas
 * y presentación). Un solo guardado = una sola versión nueva.
 */
export async function saveRuletaPresetAction(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const { account } = await requireAdminAccount();
    const service = getSupabaseServiceRole() as any;
    const editionId = String(fd.get("edition_id") ?? "").trim();
    if (!editionId) return { ok: false, error: "Falta edition_id." };

    const loaded = await loadEditionPreset(service, editionId);
    if (!loaded) return { ok: false, error: "Edición no encontrada." };
    if (!loaded.preset) return { ok: false, error: "La edición no tiene preset de ruleta. Se crea con el primer sorteo." };
    if (loaded.preset.is_frozen) return { ok: false, error: "El preset está congelado y no se puede editar." };

    let next: PresetConfig;
    try {
      next = JSON.parse(String(fd.get("preset_config") ?? ""));
    } catch {
      return { ok: false, error: "La configuración enviada no es un JSON válido." };
    }
    const invalid = validatePresetConfig(next);
    if (invalid) return { ok: false, error: invalid };

    const saved = await persistPresetConfig(service, editionId, loaded.preset, next);
    if (!saved.ok) return saved;

    await logAdminAction({
      supabase: service,
      accountId: account.id,
      action: "save_ruleta_preset",
      entityType: "tournament_edition",
      entityId: editionId,
      entityLabel: loaded.edition?.name ?? null,
      payload: { counts: {
        gameModes: next.gameModes?.length ?? 0,
        playerModes: next.playerModes?.length ?? 0,
        mapModes: next.mapModes?.length ?? 0,
        llaveModes: next.llaveModes?.length ?? 0,
        antimetaModes: next.antimetaModes?.length ?? 0,
      } },
    });

    revalidatePath("/admin/ruletas");
    revalidatePath("/admin/torneo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

/**
 * Guarda los pesos de las opciones del preset de la edición.
 * Crea una nueva preset_version (n+1) y la engancha a la edición, salvo que
 * el preset sea v1 sin usar (todavía no hay draws que lo referencien).
 */
export async function saveRuletaWeightsAction(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const { account } = await requireAdminAccount();
    const service = getSupabaseServiceRole() as any;
    const editionId = String(fd.get("edition_id") ?? "").trim();
    if (!editionId) return { ok: false, error: "Falta edition_id." };

    const loaded = await loadEditionPreset(service, editionId);
    if (!loaded) return { ok: false, error: "Edición no encontrada." };
    if (!loaded.preset) return { ok: false, error: "La edición no tiene preset de ruleta. Se crea con el primer sorteo." };

    const { preset } = loaded;
    if (preset.is_frozen) return { ok: false, error: "El preset está congelado y no se puede editar." };

    const config = preset.config as PresetConfig;

    // Aplicar pesos desde el form: weight_<list>_<id>
    const next: PresetConfig = JSON.parse(JSON.stringify(config));
    const lists: Kind[] = ["MODO", "ANTIMETA", "FORMATO", "LLAVE", "MAPA"];
    for (const list of lists) {
      const arr = next[KIND_KEYS[list]] as PresetMode[] | undefined;
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        const raw = fd.get(`weight_${list}_${item.id}`);
        if (raw != null) {
          const w = parseInt(String(raw), 10);
          item.weight = Number.isFinite(w) && w > 0 ? w : 1;
        }
      }
    }

    const saved = await persistPresetConfig(service, editionId, preset, next);
    if (!saved.ok) return saved;

    await logAdminAction({
      supabase: service,
      accountId: account.id,
      action: "save_ruleta_weights",
      entityType: "tournament_edition",
      entityId: editionId,
    });

    revalidatePath("/admin/ruletas");
    revalidatePath("/admin/torneo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

/** Alta/baja lógica de una opción del preset (activa/inactiva). */
export async function toggleRuletaOptionAction(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const { account } = await requireAdminAccount();
    const service = getSupabaseServiceRole() as any;
    const editionId = String(fd.get("edition_id") ?? "").trim();
    const list = String(fd.get("list") ?? "").trim() as Kind;
    const optionId = String(fd.get("option_id") ?? "").trim();
    const active = fd.get("active") != null;

    if (!editionId || !KIND_KEYS[list] || !optionId) return { ok: false, error: "Faltan datos." };

    const loaded = await loadEditionPreset(service, editionId);
    if (!loaded?.preset) return { ok: false, error: "La edición no tiene preset de ruleta." };
    const { preset } = loaded;
    if (preset.is_frozen) return { ok: false, error: "El preset está congelado y no se puede editar." };

    const config = preset.config as PresetConfig;
    const next: PresetConfig = JSON.parse(JSON.stringify(config));
    const arr = next[KIND_KEYS[list]] as PresetMode[] | undefined;
    if (!Array.isArray(arr)) return { ok: false, error: "Lista inválida." };

    // Inactiva = weight 0 (excluida del sorteo). Preserva el resto de campos.
    for (const item of arr) {
      if (item.id === optionId) {
        const w = typeof item.weight === "number" ? item.weight : 1;
        item.weight = active ? (w > 0 ? w : 1) : 0;
      }
    }

    const saved = await persistPresetConfig(service, editionId, preset, next);
    if (!saved.ok) return saved;

    await logAdminAction({
      supabase: service,
      accountId: account.id,
      action: "toggle_ruleta_option",
      entityType: "tournament_edition",
      entityId: editionId,
      payload: { list, option_id: optionId, active },
    });

    revalidatePath("/admin/ruletas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

// ============================================================
// STAFF (habilitar admins por email — solo super_admin otorga)
// ============================================================

/** Lista cuentas de staff + candidatos para el panel de staff. */
export async function listStaffAccounts(service: any) {
  const { data: staff } = (await service
    .from("account")
    .select("id, email, display_name, role, created_at, updated_at")
    .in("role", ["admin", "super_admin"])
    .order("created_at", { ascending: true })) as { data: any };
  return staff ?? [];
}

/**
 * Habilita un email como admin. SOLO super_admin.
 * Si el email ya tiene cuenta en el sitio, se le asigna el rol.
 * Si no existe, se crea el usuario en Supabase Auth con contraseña temporal
 * (debe cambiarla) y su fila account como admin.
 */
export async function setAdminRoleAction(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = (await getSupabaseServer()) as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado." };
    const { data: me } = (await supabase
      .from("account")
      .select("id, role")
      .eq("supabase_auth_id", user.id)
      .single()) as { data: any };
    // SOLO super_admin otorga o quita el rol de admin (decisión del dueño).
    if (!me || me.role !== "super_admin") {
      return { ok: false, error: "Solo el ADMIN MAX (super admin) puede habilitar o quitar admins." };
    }

    const service = getSupabaseServiceRole() as any;
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const role = String(fd.get("role") ?? "admin").trim();

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, error: "Email inválido." };
    }
    if (!["admin", "owner", "spectator", "caster"].includes(role)) {
      return { ok: false, error: "Rol destino inválido (usa admin, owner, spectator o caster)." };
    }

    // Buscar cuenta existente por email
    const { data: existing } = (await service
      .from("account")
      .select("id, role")
      .eq("email", email)
      .maybeSingle()) as { data: any };

    if (existing) {
      // Protección: no degradar a otro super_admin
      if (existing.role === "super_admin") {
        return { ok: false, error: "Esa cuenta es ADMIN MAX: no se puede modificar desde el panel." };
      }
      if (existing.role === role) {
        return { ok: false, error: `Esa cuenta ya es ${role}.` };
      }
      const { error } = await service.from("account").update({ role, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (error) return { ok: false, error: `No se pudo actualizar: ${error.message}` };

      await logAdminAction({
        supabase: service,
        accountId: me.id,
        action: "set_admin_role",
        entityType: "account",
        entityId: existing.id,
        entityLabel: email,
        payload: { from: existing.role, to: role },
      });

      revalidatePath("/admin/staff");
      return { ok: true };
    }

    // Email nuevo: crear en Auth (contraseña temporal). El trigger
    // on_auth_user_created de la DB inserta la fila account como 'owner'
    // al crear el auth user, así que acá hacemos UPSERT para forzar el rol.
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password: crypto.randomUUID() + "#Vg1",
      email_confirm: true,
    });
    if (createErr || !created?.user) {
      return { ok: false, error: `No se pudo crear el usuario: ${createErr?.message ?? "?"}` };
    }
    const { error: insErr } = await service.from("account").upsert({
      supabase_auth_id: created.user.id,
      email,
      role: "admin",
      display_name: email.split("@")[0],
    }, { onConflict: "supabase_auth_id" });
    if (insErr) return { ok: false, error: `Usuario creado, pero falló la fila de cuenta: ${insErr.message}` };

    await logAdminAction({
      supabase: service,
      accountId: me.id,
      action: "set_admin_role",
      entityType: "account",
      entityLabel: email,
      payload: { created: true, role: "admin" },
    });

    revalidatePath("/admin/staff");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}
