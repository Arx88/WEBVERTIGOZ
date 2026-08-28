/**
 * Validación de configuración sorteada vs. partida real de AoE2 Companion.
 *
 * El sorteo deja en match_game los TÍTULOS del preset ("ARENA",
 * "MUERTE SÚBITA") y Companion devuelve mapName en inglés ("Arena")
 * más flags booleanos de modo. Acá se normalizan ambos lados y se
 * comparan. MAPA y MODO son bloqueo duro para el auto-reporte;
 * tamaño de mapa y población NO se validan (en fusión 3 jugadores
 * pueden compartir civ y el tamaño no coincide con la cantidad de
 * jugadores).
 *
 * Los alias de mapas son el mismo conjunto que usa stats-cache.ts
 * (MAP_ALIASES) — se mantienen acá independientes porque aquello
 * normaliza slugs de leaderboard y esto nombres de sala reales.
 */

/** Normaliza a token comparable: minúsculas, sin acentos, [_] como separador. */
export function normalizeToken(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Alias conocidos por mapa canónico (inglés y español). */
const MAP_ALIASES: Record<string, string[]> = {
  arabia: ["arabia"],
  arena: ["arena"],
  atacama: ["atacama"],
  crater: ["crater", "crater_lake"],
  cresta_montanosa: ["cresta_montanosa", "crested_mountains", "mountain_range", "mountain_ridge"],
  cuatro_lagos: ["cuatro_lagos", "four_lakes"],
  cuenca_del_oro: ["cuenca_del_oro", "gold_basin", "gold_rush", "golden_pit"],
  migracion: ["migracion", "migration"],
  tormenta_de_polvo: ["tormenta_de_polvo", "sand_storm", "dust_storm", "haboob"],
};

/** ¿El mapName de Companion corresponde al mapa sorteado? */
export function mapMatches(drawnMap: string | null | undefined, companionMapName: string | null | undefined): boolean {
  const drawn = normalizeToken(drawnMap);
  const actual = normalizeToken(companionMapName);
  if (!drawn || !actual) return true; // sin datos de un lado → no bloquear
  if (drawn === actual) return true;
  const aliases = MAP_ALIASES[drawn] ?? [];
  return aliases.includes(actual);
}

/**
 * Flags de modo esperados según el modo sorteado.
 * `null` = modo no mapeable en la API (p.ej. ANTIMETA) → no validar.
 */
export function expectedModeFlags(gameMode: string | null | undefined): {
  regicideMode: boolean;
  suddenDeathMode: boolean;
  empireWarsMode: boolean;
} | null {
  switch (normalizeToken(gameMode)) {
    case "regicida":
      return { regicideMode: true, suddenDeathMode: false, empireWarsMode: false };
    case "muerte_subita":
      return { regicideMode: false, suddenDeathMode: true, empireWarsMode: false };
    case "guerras_imperiales":
      return { regicideMode: false, suddenDeathMode: false, empireWarsMode: true };
    case "antimeta":
    case "":
      return null;
    default:
      return null;
  }
}

export interface MatchConfigLike {
  mapName?: string | null;
  regicideMode?: boolean | null;
  suddenDeathMode?: boolean | null;
  empireWarsMode?: boolean | null;
}

export type ConfigCheckResult =
  | { ok: true }
  | { ok: false; kind: "map" | "mode"; expected: string; actual: string };

/**
 * Compara la configuración sorteada contra una partida candidata de
 * Companion. Devuelve el primer fallo (mapa, luego modo) u ok.
 */
export function checkMatchConfig(
  drawnMap: string | null | undefined,
  drawnMode: string | null | undefined,
  candidate: MatchConfigLike
): ConfigCheckResult {
  if (!mapMatches(drawnMap, candidate.mapName)) {
    return {
      ok: false,
      kind: "map",
      expected: drawnMap ?? "?",
      actual: candidate.mapName ?? "?",
    };
  }
  const expected = expectedModeFlags(drawnMode);
  if (expected) {
    const actual = {
      regicideMode: !!candidate.regicideMode,
      suddenDeathMode: !!candidate.suddenDeathMode,
      empireWarsMode: !!candidate.empireWarsMode,
    };
    if (
      actual.regicideMode !== expected.regicideMode ||
      actual.suddenDeathMode !== expected.suddenDeathMode ||
      actual.empireWarsMode !== expected.empireWarsMode
    ) {
      const describe = (f: { regicideMode: boolean; suddenDeathMode: boolean; empireWarsMode: boolean }) =>
        f.regicideMode ? "REGICIDA" : f.suddenDeathMode ? "MUERTE SÚBITA" : f.empireWarsMode ? "GUERRAS IMPERIALES" : "ESTÁNDAR";
      return {
        ok: false,
        kind: "mode",
        expected: drawnMode ?? "?",
        actual: describe(actual),
      };
    }
  }
  return { ok: true };
}
