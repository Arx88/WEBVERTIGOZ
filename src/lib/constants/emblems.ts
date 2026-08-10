/**
 * Mapeo de emblem_id (r1-r13) a paths de imágenes de reinos.
 * Los reinos son los escudos que los equipos eligen en el wizard (step 2).
 */

const REINO_IMAGES: Record<string, string> = {
  r1: "/reinos/reino-1.webp",
  r2: "/reinos/reino-2.webp",
  r3: "/reinos/reino-3.webp",
  r4: "/reinos/reino-4.webp",
  r5: "/reinos/reino-5.webp",
  r6: "/reinos/reino-6.webp",
  r7: "/reinos/reino-7.webp",
  r8: "/reinos/reino-8.webp",
  r9: "/reinos/reino-9.webp",
  r10: "/reinos/reino-10.webp",
  r11: "/reinos/reino-11.webp",
  r12: "/reinos/reino-12.webp",
  r13: "/reinos/reino-13.webp",
};

/**
 * Devuelve la URL de la imagen del emblema dado un emblem_id.
 * Si no existe, devuelve null (el caller debe mostrar un fallback).
 */
export function getEmblemUrl(emblemId: string | null | undefined): string | null {
  if (!emblemId) return null;
  return REINO_IMAGES[emblemId] ?? null;
}

/**
 * Lista de todos los reinos disponibles (para selectores, demo, etc.)
 */
export const ALL_REINOS = Object.entries(REINO_IMAGES).map(([id, img]) => ({ id, img }));

/**
 * Devuelve un reino aleatorio (para demo).
 */
export function getRandomReino(): { id: string; img: string } {
  const idx = Math.floor(Math.random() * ALL_REINOS.length);
  return ALL_REINOS[idx];
}
