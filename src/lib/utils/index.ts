import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind con clsx sin conflictos.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea fechas en español.
 */
export function formatDate(date: Date | string | number, opts?: Intl.DateTimeFormatOptions) {
  const d = new Date(date);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

/**
 * Formatea horas en español.
 */
export function formatTime(date: Date | string | number) {
  const d = new Date(date);
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formatea datetime en formato corto.
 */
export function formatDateTime(date: Date | string | number) {
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/**
 * Calcula tiempo relativo en español.
 */
export function timeAgo(date: Date | string | number): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 30) return `hace ${days}d`;
  return formatDate(d);
}

/**
 * Valida un email.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Genera un slug a partir de un texto.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Trunca texto con elipsis.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

/**
 * Genera ID corto aleatorio (para URLs públicas de sorteos).
 */
export function shortId(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
