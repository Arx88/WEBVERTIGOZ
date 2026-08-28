"use client";

/**
 * LocalTime — muestra un instante UTC en la zona horaria del visitante.
 *
 * Por qué existe: el HTML se server-renderiza, así que no puede depender de
 * la zona del visitante sin romper hidratación. Entonces:
 *   1. En SSR (y primer render del cliente) emite el texto es-AR/ART de
 *      `fmt.*` — determinístico, idéntico en ambos lados.
 *   2. Después del mount lo cambia por el formato local del browser.
 * Para usuarios en Argentina el texto no cambia; el resto del mundo ve el
 * horario equivalente en su propia zona.
 *
 * Uso: `<LocalTime value={m.scheduledAtStart} variant="dayMonTime" />`.
 * Los countdowns no necesitan esto: computan desde el instante UTC.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { fmt, type DateInput } from "@/lib/format";

/** Mismas opciones que fmt.*, pero SIN timeZone fijada → zona del browser. */
const LOCAL_OPTIONS: Record<keyof typeof fmt, Intl.DateTimeFormatOptions> = {
  dateTime: {},
  date: { day: "numeric", month: "numeric", year: "numeric" },
  time: { hour: "2-digit", minute: "2-digit" },
  dayMonTime: { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
  dayMonTimeNum: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  dateTimeMedium: { dateStyle: "medium", timeStyle: "short" },
  longDateTime: { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" },
  dayMon: { day: "2-digit", month: "short" },
  dayMonYear: { day: "2-digit", month: "short", year: "numeric" },
  dayLongMonTime: { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" },
  weekdayShortTime: { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" },
};

export type LocalTimeVariant = keyof typeof LOCAL_OPTIONS;

function toLocalText(value: DateInput, variant: LocalTimeVariant): string | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("es-AR", LOCAL_OPTIONS[variant]);
}

export default function LocalTime({
  value,
  variant = "dayMonTime",
  className,
  style,
}: {
  value: DateInput;
  variant?: LocalTimeVariant;
  className?: string;
  style?: CSSProperties;
}) {
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    setLocal(toLocalText(value, variant));
  }, [value, variant]);
  return (
    <span className={className} style={style}>
      {local ?? fmt[variant](value)}
    </span>
  );
}
