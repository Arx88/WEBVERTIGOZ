/**
 * Mapeo de IDs de modo/mapa/formato/llave a su imagen de arte.
 * Las rutas son archivos reales en /public/modes/ y /public/brand/.
 */

const MODE_ART: Record<string, string> = {
  // Modos de juego
  "gm-antimeta": "/modes/game-mode/antimeta.webp",
  "gm-guerras": "/modes/game-mode/guerras-imperiales.webp",
  "gm-muerte": "/modes/game-mode/muerte-subdita.webp",
  "gm-regicida": "/modes/game-mode/regicida.webp",
  // Antimeta sub-variantes
  "am-500pop": "/modes/game-mode/antimeta/500pop.webp",
  "am-barcos": "/modes/game-mode/antimeta/barcos.webp",
  "am-feudal": "/modes/game-mode/antimeta/feudal.webp",
  "am-meso": "/modes/game-mode/antimeta/mesoamerica.webp",
  "am-rey": "/modes/game-mode/antimeta/rey-de-la-colina.webp",
  "am-unicas": "/modes/game-mode/antimeta/unidades-unicas.webp",
};

const MAP_ART: Record<string, string> = {
  "map-arabia": "/modes/maps/arabia.webp",
  "map-arena": "/modes/maps/arena.webp",
  "map-atacama": "/modes/maps/atacama.webp",
  "map-crater": "/modes/maps/crater.webp",
  "map-cresta": "/modes/maps/cresta-montanosa.webp",
  "map-cuatro-lagos": "/modes/maps/cuatro-lagos.webp",
  "map-cuenca-oro": "/modes/maps/cuenca-del-oro.webp",
  "map-migracion": "/modes/maps/migracion.webp",
  "map-tormenta": "/modes/maps/tormenta-de-polvo.webp",
};

const PLAYER_ART: Record<string, string> = {
  "pm-1vs1": "/modes/player-mode/1vs1.webp",
  "pm-2vs2": "/modes/player-mode/2vs2.webp",
  "pm-3vs3": "/modes/player-mode/3vs3.webp",
  "pm-team": "/modes/player-mode/team.webp",
};

const LLAVE_ART: Record<string, string> = {
  "ll-bo3": "/modes/llave/bo3.webp",
  "ll-deathmatch": "/modes/llave/deathmatch.webp",
};

const BRAND_ART: Record<string, string> = {
  // Arte cinematográfico del torneo (descargado del Drive de branding)
  "hero-trofeo": "/brand/hero-trofeo.png",
  "trofeo-vertigo": "/brand/trofeo-vertigo.png",
  "ruleta-overlay": "/brand/ruleta-overlay.png",
  "selector-cilindrico": "/brand/selector-cilindrico.png",
  "fortaleza-incendio": "/brand/fortaleza-incendio.png",
  "fortaleza-bandera": "/brand/fortaleza-bandera.png",
  "post-deathmatch": "/brand/post-deathmatch.png",
  "duelo-1v1": "/brand/duelo-1v1.png",
  "batalla-3v3": "/brand/batalla-3v3.png",
  "fusion-equipo": "/brand/fusion-equipo.png",
  "modo-antimeta": "/brand/modo-antimeta.png",
  "regicida-aftermath": "/brand/regicida-aftermath.png",
  "explosion-tension": "/brand/explosion-tension.png",
};

/** Devuelve la imagen de arte para un id de modo/mapa/formato/llave. */
export function artForMode(idOrTitle: string | null | undefined): string | null {
  if (!idOrTitle) return null;
  const key = normalizeKey(idOrTitle);
  return MODE_ART[key] ?? MAP_ART[key] ?? PLAYER_ART[key] ?? LLAVE_ART[key] ?? BRAND_ART[key] ?? null;
}

/** Devuelve la imagen de arte para un mapa. */
export function artForMap(idOrTitle: string | null | undefined): string | null {
  if (!idOrTitle) return null;
  return MAP_ART[normalizeKey(idOrTitle)] ?? null;
}

/** Devuelve la imagen de cinemática de branding. */
export function artForBrand(key: string | null | undefined): string | null {
  if (!key) return null;
  return BRAND_ART[key] ?? null;
}

/** Normaliza un título o id a su clave de asset. */
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-");
}

/** Imagen por defecto si no hay match: el vortex del torneo. */
export const ART_FALLBACK = "/modes/vortex.webp";

/** Comodines (del Drive de icons). */
export const COMODIN_ART: Record<string, string> = {
  reroll: "/brand/icons/comodin-regirar.png",
  anular: "/brand/icons/comodin-anular.png",
  elegir_rival: "/brand/icons/comodin-elegir.png",
  invocar_pro: "/brand/icons/comodin-invocar.png",
};

export function artForComodin(type: string | null | undefined): string | null {
  if (!type) return null;
  return COMODIN_ART[type] ?? null;
}
