"use server";

/**
 * VÉRTIGO Cup — Ciclo de vida de la edición del torneo.
 *
 * Crear edición nueva, editar la configuración, transiciones de estado
 * (draft → registration → active → finished) y subida del handbook.
 *
 * Patrón de tournament.ts: guard por sesión admin + service role para los
 * writes (bypass RLS solo dentro de operaciones validadas).
 */

import { revalidatePath } from "next/cache";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { uploadHandbookInternal } from "@/lib/handbook-upload";

// ============================================================
// Helpers
// ============================================================

async function requireAdminAccount() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado.");
  const { data: account } = (await supabase
    .from("account")
    .select("id, role")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) {
    throw new Error("Sin permisos de administrador.");
  }
  return { supabase, account };
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function intOr(fd: FormData, key: string, fallback: number): number {
  const raw = fd.get(key);
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

function dateOrNull(fd: FormData, key: string): string | null {
  const raw = String(fd.get(key) ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function strOrNull(fd: FormData, key: string, max: number): string | null {
  const raw = String(fd.get(key) ?? "").trim();
  return raw ? raw.slice(0, max) : null;
}

/** Payload de configuración compartido por crear y editar. */
function editionPayload(fd: FormData) {
  return {
    name: String(fd.get("name") ?? "").trim().slice(0, 120),
    description: strOrNull(fd, "description", 2000),
    elo_cap: intOr(fd, "elo_cap", 3500),
    elo_tolerance: intOr(fd, "elo_tolerance", 20),
    elo_field: strOrNull(fd, "elo_field", 50) ?? "rm_1v1_max",
    team_size: intOr(fd, "team_size", 3),
    max_teams: intOr(fd, "max_teams", 32),
    civs_base: intOr(fd, "civs_base", 9),
    civs_extra_finalist: intOr(fd, "civs_extra_finalist", 3),
    comodin_reroll: intOr(fd, "comodin_reroll", 2),
    comodin_anular: intOr(fd, "comodin_anular", 1),
    comodin_elegir_rival: intOr(fd, "comodin_elegir_rival", 1),
    comodin_invocar_pro: intOr(fd, "comodin_invocar_pro", 1),
    comodin_window_minutes: intOr(fd, "comodin_window_minutes", 5),
    invocar_pro_minutes: intOr(fd, "invocar_pro_minutes", 5),
    commit_reveal_enabled: fd.get("commit_reveal_enabled") != null,
    draw_timeout_minutes: intOr(fd, "draw_timeout_minutes", 5),
    twitch_channel: strOrNull(fd, "twitch_channel", 100),
    youtube_channel: strOrNull(fd, "youtube_channel", 100),
    kick_channel: strOrNull(fd, "kick_channel", 100),
    terms_text: strOrNull(fd, "terms_text", 20000),
    restream_required: fd.get("restream_required") != null,
    registration_opens_at: dateOrNull(fd, "registration_opens_at"),
    registration_closes_at: dateOrNull(fd, "registration_closes_at"),
    starts_at: dateOrNull(fd, "starts_at"),
    ends_at: dateOrNull(fd, "ends_at"),
  };
}

/** Campos que afectan la estructura del bracket ya generado. */
const STRUCTURAL_KEYS = [
  "team_size",
  "max_teams",
  "civs_base",
  "civs_extra_finalist",
] as const;

// ============================================================
// Crear edición
// ============================================================

export async function createEditionAction(
  fd: FormData
): Promise<{ ok: boolean; error?: string; editionId?: string }> {
  try {
    await requireAdminAccount();
    const payload = editionPayload(fd);
    if (!payload.name) return { ok: false, error: "Falta el nombre de la edición." };

    const slugInput = String(fd.get("slug") ?? "").trim();
    const slug = slugify(slugInput || payload.name);
    if (!slug) return { ok: false, error: "No se pudo generar un slug válido." };

    const service = getSupabaseServiceRole() as any;

    // Invariante: un solo torneo "vivo" (borrador / inscripciones / en curso).
    // Crear otro exige cerrar el actual (finalizarlo) o que su fecha de fin ya
    // haya pasado — si no, habría dos ediciones compitiendo por inscripciones,
    // bracket y fixture público.
    const STATUS_LABEL: Record<string, string> = {
      draft: "borrador",
      registration: "inscripciones abiertas",
      active: "en curso",
    };
    const { data: viva } = await service
      .from("tournament_edition")
      .select("id, name, status, ends_at")
      .neq("status", "finished")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (viva) {
      const ended = viva.ends_at && new Date(viva.ends_at).getTime() < Date.now();
      if (!ended) {
        return {
          ok: false,
          error: `Ya hay un torneo vivo: «${viva.name}» (${STATUS_LABEL[viva.status] ?? viva.status}). Finalizalo desde Ciclo de vida antes de crear otro.`,
        };
      }
    }

    const { data: clash } = await service
      .from("tournament_edition")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (clash) return { ok: false, error: `Ya existe una edición con el slug "${slug}".` };

    const { data: created, error } = await service
      .from("tournament_edition")
      .insert({ ...payload, slug, status: "draft" })
      .select("id")
      .single();
    if (error) return { ok: false, error: `No se pudo crear: ${error.message}` };

    revalidatePath("/admin/torneo");
    return { ok: true, editionId: created.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

// ============================================================
// Editar configuración
// ============================================================

export async function updateEditionAction(
  fd: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminAccount();
    const editionId = String(fd.get("edition_id") ?? "").trim();
    if (!editionId) return { ok: false, error: "Falta edition_id." };

    const payload = editionPayload(fd);
    if (!payload.name) return { ok: false, error: "Falta el nombre de la edición." };

    const service = getSupabaseServiceRole() as any;

    // Con bracket generado, la estructura queda congelada (los matches ya existen).
    const { data: bracket } = await service
      .from("bracket")
      .select("id")
      .eq("tournament_edition_id", editionId)
      .limit(1)
      .maybeSingle();
    if (bracket) {
      const { data: current } = await service
        .from("tournament_edition")
        .select("team_size, max_teams, civs_base, civs_extra_finalist")
        .eq("id", editionId)
        .single();
      if (current) {
        const changed = STRUCTURAL_KEYS.filter(
          (k) => (payload as any)[k] !== (current as any)[k]
        );
        if (changed.length > 0) {
          return {
            ok: false,
            error: `Hay un bracket generado: no se puede cambiar ${changed.join(", ")}. Borrá el bracket primero si querés reestructurar la edición.`,
          };
        }
      }
    }

    const { error } = await service
      .from("tournament_edition")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", editionId);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };

    revalidatePath("/admin/torneo");
    revalidatePath("/admin/handbook");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

// ============================================================
// Transiciones de estado
// ============================================================

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["registration"],
  registration: ["draft", "active"],
  active: ["finished"],
  finished: ["active"],
};

/** Partidos de la edición que no terminaron (ni fueron W.O. / cancelados). */
async function countUnfinishedMatches(service: any, editionId: string): Promise<number> {
  const { data: brackets } = await service
    .from("bracket")
    .select("id")
    .eq("tournament_edition_id", editionId);
  const bracketIds = (brackets ?? []).map((b: any) => b.id);
  if (bracketIds.length === 0) return 0;

  const { data: rounds } = await service
    .from("round")
    .select("id")
    .in("bracket_id", bracketIds);
  const roundIds = (rounds ?? []).map((r: any) => r.id);
  if (roundIds.length === 0) return 0;

  const { count } = (await service
    .from("match")
    .select("id", { count: "exact", head: true })
    .in("round_id", roundIds)
    .not("status", "in", "(finished,forfeit,cancelled)")) as { count: number | null };
  return count ?? 0;
}

export async function setEditionStatusAction(
  fd: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminAccount();
    const editionId = String(fd.get("edition_id") ?? "").trim();
    const next = String(fd.get("next_status") ?? "").trim();
    const confirmed = fd.get("confirm") != null;
    if (!editionId || !next) return { ok: false, error: "Faltan datos." };

    const service = getSupabaseServiceRole() as any;

    const { data: edition } = await service
      .from("tournament_edition")
      .select("id, name, status")
      .eq("id", editionId)
      .single();
    if (!edition) return { ok: false, error: "Edición no encontrada." };

    const allowed = ALLOWED_TRANSITIONS[edition.status] ?? [];
    if (!allowed.includes(next)) {
      return { ok: false, error: `Transición inválida: ${edition.status} → ${next}.` };
    }

    // Invariante: una sola edición con inscripciones abiertas. Todo el sistema
    // (wizard, cupo del landing, anti-doble) resuelve "la edición abierta"
    // tomando la más nueva — abrir dos deja a la vieja como zombi: figura
    // abierta pero inalcanzable. Se bloquea explícitamente.
    if (next === "registration") {
      const { data: otraAbierta } = await service
        .from("tournament_edition")
        .select("id, name")
        .eq("status", "registration")
        .neq("id", editionId)
        .limit(1)
        .maybeSingle();
      if (otraAbierta) {
        return {
          ok: false,
          error: `Ya hay una edición con inscripciones abiertas: «${otraAbierta.name}». Cerrala (iniciar torneo o volver a borrador) antes de abrir esta.`,
        };
      }
    }

    // Cerrar el torneo con partidos pendientes exige confirmación explícita.
    if (next === "finished") {
      const unfinished = await countUnfinishedMatches(service, editionId);
      if (unfinished > 0 && !confirmed) {
        return {
          ok: false,
          error: `Hay ${unfinished} partido${unfinished === 1 ? "" : "s"} sin finalizar. Confirmá para cerrar la edición de todos modos.`,
        };
      }
    }

    const { error } = await service
      .from("tournament_edition")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", editionId);
    if (error) return { ok: false, error: `No se pudo cambiar el estado: ${error.message}` };

    revalidatePath("/admin/torneo");
    revalidatePath("/bracket");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

// ============================================================
// Handbook
// ============================================================

export async function uploadHandbookAction(
  fd: FormData
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminAccount();
    const editionId = String(fd.get("edition_id") ?? "").trim();
    const file = fd.get("file") as File | null;
    if (!editionId) return { ok: false, error: "Falta edition_id." };

    const res = await uploadHandbookInternal(editionId, file as File);
    if (!res.ok) return { ok: false, error: res.error };

    revalidatePath("/admin/handbook");
    revalidatePath("/admin/torneo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

// ============================================================
// Emblemas: activar/desactivar y eliminar
// ============================================================

export async function toggleEmblemAction(
  emblemId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminAccount();
    const service = getSupabaseServiceRole() as any;
    const { data: emblem } = await service
      .from("emblem")
      .select("id, is_active")
      .eq("id", emblemId)
      .single();
    if (!emblem) return { ok: false, error: "Emblema no encontrado." };

    const { error } = await service
      .from("emblem")
      .update({ is_active: !emblem.is_active })
      .eq("id", emblemId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/emblemas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

export async function deleteEmblemAction(
  emblemId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminAccount();
    const service = getSupabaseServiceRole() as any;

    const { data: emblem } = await service
      .from("emblem")
      .select("id, image_url")
      .eq("id", emblemId)
      .single();
    if (!emblem) return { ok: false, error: "Emblema no encontrado." };

    // ¿Hay equipos usando este emblema? No romper su identidad.
    const { count } = (await service
      .from("team_account")
      .select("id", { count: "exact", head: true })
      .eq("emblem_id", emblemId)) as { count: number | null };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `${count} equipo${count === 1 ? "" : "s"} usa${count === 1 ? "" : "n"} este emblema. Desactivalo en vez de borrarlo.`,
      };
    }

    const { error } = await service.from("emblem").delete().eq("id", emblemId);
    if (error) return { ok: false, error: error.message };

    // Si el archivo es nuestro (path del bucket público emblems), lo borramos.
    const url: string = emblem.image_url ?? "";
    const marker = "/object/public/emblems/";
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = url.slice(idx + marker.length);
      await service.storage.from("emblems").remove([path]);
    }

    revalidatePath("/admin/emblemas");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}
