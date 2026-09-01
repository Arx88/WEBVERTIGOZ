/**
 * VÉRTIGO Cup — Validación de configuración sorteada vs. partida real de AoE2 Companion.
 *
 * EL NOMBRE DE SALA ES LA CLAVE ÚNICA DE DESCUBRIMIENTO: el capitán lo copia
 * y pega (botón COPIAR), no se tipea. Mapa y modo NO bloquean el auto-reporte
 * — son REFUERZO INFORMATIVO: se comparan para describir la partida y
 * detectar diferencias en el flag del admin, pero nunca invalidan un
 * match con el nombre exacto. Si una partida se cancela por mala config y
 * se re-juega, hay dos salas con el mismo nombre y vale la ÚLTIMA (más
 * reciente): eso ya lo maneja el watcher (sort por started desc).
 *
 * Tamaño de mapa y población no se comparan (en fusión 3 jugadores
 * comparten civ y el tamaño no coincide con la cantidad de jugadores).
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
  if (!drawn || !actual) return true; // sin datos de un lado → sin objeción
  if (drawn === actual) return true;
  const aliases = MAP_ALIASES[drawn] ?? [];
  return aliases.includes(actual);
}

/**
 * Flags de modo esperados según el modo sorteado.
 * `null` = modo no mapeable en la API (p.ej. ANTIMETA) → sin objeción.
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

/** Refuerzo informativo: cómo quedó la config real vs. la sorteada. */
export interface ConfigCheckResult {
  /** Nunca false: la config no bloquea el auto-reporte. */
  ok: true;
  /** Descripción de la partida para el flag/admin. */
  note: string | null;
  /** True si mapa o modo difieren de lo sorteado — informativo. */
  diverged: boolean;
  drawnMap?: string | null;
  drawnMode?: string | null;
  actualMap?: string | null;
}

/**
 * Compara la configuración sorteada contra una partida candidata de
 * Companion y devuelve una DESCRIPCIÓN (refuerzo informativo). Nunca
 * bloquea: un match con el nombre exacto es la partida del torneo aunque
 * el mapa o el modo difieran (los jugadores pudieron armar la sala con
 * otra config; el resultado vale igual).
 */
export function checkMatchConfig(
  drawnMap: string | null | undefined,
  drawnMode: string | null | undefined,
  candidate: MatchConfigLike
): ConfigCheckResult {
  const mapOk = mapMatches(drawnMap, candidate.mapName);
  const expected = expectedModeFlags(drawnMode);
  const modeOk = expected
    ? !!candidate.regicideMode === expected.regicideMode &&
      !!candidate.suddenDeathMode === expected.suddenDeathMode &&
      !!candidate.empireWarsMode === expected.empireWarsMode
    : true;

  if (mapOk && modeOk) {
    return { ok: true, note: null, diverged: false, drawnMap, drawnMode, actualMap: candidate.mapName ?? null };
  }

  const parts: string[] = [];
  if (!mapOk) parts.push(`mapa sorteado "${drawnMap ?? "?"}", sala en "${candidate.mapName ?? "?"}"`);
  if (!modeOk && expected) {
    const describe = (f: { regicideMode: boolean; suddenDeathMode: boolean; empireWarsMode: boolean }) =>
      f.regicideMode ? "REGICIDA" : f.suddenDeathMode ? "MUERTE SÚBITA" : f.empireWarsMode ? "GUERRAS IMPERIALES" : "ESTÁNDAR";
    parts.push(`modo sorteado "${drawnMode ?? "?"}", sala en ${describe({
      regicideMode: !!candidate.regicideMode,
      suddenDeathMode: !!candidate.suddenDeathMode,
      empireWarsMode: !!candidate.empireWarsMode,
    })}`);
  }
  return {
    ok: true,
    note: `Config difiere (${parts.join(" · ")}) — la partida vale igual (nombre exacto).`,
    diverged: true,
    drawnMap,
    drawnMode,
    actualMap: candidate.mapName ?? null,
  };
}
