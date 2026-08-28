/**
 * Conversión de zona horaria para la programación de llaves.
 *
 * VertigoDateTime manda la hora de pared que tipeó el admin
 * ("YYYY-MM-DDTHH:mm") junto con el offset UTC del browser del admin PARA
 * ESA fecha (`<name>_tz_offset`, minutos con la convención JS de
 * getTimezoneOffset(): positivos al oeste de UTC). Acá ese par se convierte
 * en un instante UTC, que es lo único que se guarda en la DB.
 *
 * Si el offset no llega (form viejo, curl, etc.) se usa el horario oficial
 * del torneo: Argentina (UTC−3 → +180 min).
 */

/** America/Argentina/Buenos_Aires (UTC−3): getTimezoneOffset() devuelve +180. */
export const FALLBACK_TZ_OFFSET_MIN = 180;

/**
 * "2026-08-28T20:00" + "180" → Date(2026-08-28T23:00:00Z).
 * Devuelve null si la hora de pared es inválida.
 */
export function parseWallClockWithOffset(
  wallStr: string,
  offsetStr: string | null | undefined
): Date | null {
  const m = wallStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const parsed = Number(offsetStr);
  const offsetMin =
    offsetStr != null && offsetStr.trim() !== "" && Number.isFinite(parsed)
      ? parsed
      : FALLBACK_TZ_OFFSET_MIN;
  // Convención JS: getTimezoneOffset() es lo que se le SUMA a la hora local
  // para obtener UTC (ART UTC−3 → +180).
  const utcMs =
    Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + offsetMin * 60_000;
  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d;
}
