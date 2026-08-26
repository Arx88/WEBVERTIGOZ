/**
 * Formateo de fechas determinístico.
 *
 * Por qué existe: las páginas se server-renderizan y luego se hidratan en el
 * browser. Si la fecha se formatea con `toLocaleString` "a secas", el servidor
 * (que en producción corre en UTC) y el browser (en la zona horaria del usuario)
 * producen textos distintos para la misma fecha → React lanza hydration mismatch
 * y puede haber parpadeo. Fijando `timeZone` a Argentina, ambos lados emiten
 * exactamente el mismo string.
 *
 * Uso: `import { fmt } from "@/lib/format"` → `fmt.dayMonTime(m.scheduledAtStart)`.
 * Todas aceptan `string | number | Date | null | undefined`; ante null/inválido
 * devuelven "—".
 */

const LOCALE = "es-AR";
const TZ = "America/Argentina/Buenos_Aires";

export type DateInput = string | number | Date | null | undefined;

function format(input: DateInput, options: Intl.DateTimeFormatOptions): string {
  if (input === null || input === undefined || input === "") return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, { timeZone: TZ, ...options });
}

export const fmt = {
  /** "24/8/2026, 22:00:00" — fecha y hora completas. */
  dateTime: (d: DateInput) => format(d, {}),

  /** "24/8/2026" — solo fecha. */
  date: (d: DateInput) => format(d, { day: "numeric", month: "numeric", year: "numeric" }),

  /** "22:00" — solo hora. */
  time: (d: DateInput) => format(d, { hour: "2-digit", minute: "2-digit" }),

  /** "24 ago, 22:00" — día de 2 dígitos, mes corto y hora. */
  dayMonTime: (d: DateInput) =>
    format(d, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),

  /** "24 ago, 22:00" — día numérico (sin cero), mes corto y hora. */
  dayMonTimeNum: (d: DateInput) =>
    format(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),

  /** "24 ago 2026, 22:00" — fecha media + hora corta. */
  dateTimeMedium: (d: DateInput) => format(d, { dateStyle: "medium", timeStyle: "short" }),

  /** "lunes, 24 de agosto, 22:00" — fecha larga con día de la semana y hora. */
  longDateTime: (d: DateInput) =>
    format(d, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }),

  /** "24 ago" — día y mes corto. */
  dayMon: (d: DateInput) => format(d, { day: "2-digit", month: "short" }),

  /** "24 ago 2026" — día, mes corto y año. */
  dayMonYear: (d: DateInput) => format(d, { day: "2-digit", month: "short", year: "numeric" }),

  /** "24 de agosto, 22:00" — día, mes largo y hora. */
  dayLongMonTime: (d: DateInput) =>
    format(d, { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }),

  /** "lun, 24 ago, 22:00" — día de semana corto + fecha corta + hora. */
  weekdayShortTime: (d: DateInput) =>
    format(d, { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
};
