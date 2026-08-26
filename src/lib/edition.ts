/**
 * VÉRTIGO Cup — Resolución de la edición del torneo.
 *
 * Todas las páginas y actions resuelven la edición por STATUS (no por slug
 * hardcodeado): así se puede cerrar una edición y abrir otra sin tocar código.
 *
 *  - Panel admin: prioriza la edición viva (registration/active); una nueva
 *    edición en draft no tapa a la que sigue en curso.
 *  - Inscripciones: apuntan a la edición con status="registration".
 *
 * El handbook vive en un bucket PRIVADO: en DB se guarda el PATH de Storage y
 * la URL firmada se genera al leer (nunca expira en la BD).
 */
import { getSupabaseServiceRole } from "@/lib/supabase/server";

/** Columnas estándar al leer una edición (las que usa el panel y el wizard). */
export const EDITION_SELECT = `
  id, slug, name, description, status,
  elo_cap, elo_tolerance, elo_field, team_size, max_teams,
  civs_base, civs_extra_finalist,
  comodin_reroll, comodin_anular, comodin_elegir_rival, comodin_invocar_pro,
  comodin_window_minutes, invocar_pro_minutes,
  commit_reveal_enabled, draw_timeout_minutes,
  twitch_channel, youtube_channel, kick_channel,
  handbook_url, handbook_uploaded_at,
  terms_text, restream_required,
  registration_opens_at, registration_closes_at, starts_at, ends_at,
  created_at, updated_at
`;

/**
 * Edición a gestionar en el panel: id explícito (?edition=) → edición viva
 * (registration/active, la más nueva) → última creada.
 */
export async function getEditionForAdmin(sb: any, explicitId?: string | null) {
  if (explicitId) {
    const { data } = await sb
      .from("tournament_edition")
      .select(EDITION_SELECT)
      .eq("id", explicitId)
      .maybeSingle();
    if (data) return data;
  }
  const { data: viva } = await sb
    .from("tournament_edition")
    .select(EDITION_SELECT)
    .in("status", ["registration", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (viva) return viva;
  const { data: ultima } = await sb
    .from("tournament_edition")
    .select(EDITION_SELECT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ultima ?? null;
}

/**
 * Edición que recibe las inscripciones: la única con status="registration".
 * Fallback: la última creada (para no romper el wizard si nadie abrió aún).
 */
export async function getEditionForRegistration(sb: any) {
  const { data: abierta } = await sb
    .from("tournament_edition")
    .select(EDITION_SELECT)
    .eq("status", "registration")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (abierta) return abierta;
  const { data: ultima } = await sb
    .from("tournament_edition")
    .select(EDITION_SELECT)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ultima ?? null;
}

/** Path canónico del PDF del handbook dentro del bucket privado `handbook`. */
export function handbookStoragePath(slug: string): string {
  return `edicion-${slug}.pdf`;
}

/**
 * URL descargable del handbook. Si en DB hay una URL http (datos viejos) se
 * usa tal cual; si hay un path de Storage se firma con service role (el bucket
 * es privado y las policies solo le permiten leer a admins).
 */
export async function signHandbookUrl(
  edition: { handbook_url: string | null } | null
): Promise<string | null> {
  const url = edition?.handbook_url;
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  try {
    const service = getSupabaseServiceRole() as any;
    const { data } = await service.storage
      .from("handbook")
      .createSignedUrl(url, 60 * 60 * 24);
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
