/**
 * Simulación del sorteo de la ruleta — CLIENT-SAFE.
 *
 * Réplica fiel de la lógica de draw-engine.ts (performDraw) pero sin
 * dependencias de Node: usa Math.random en vez de crypto.randomInt.
 * El draw-engine real importa "crypto" de Node y no corre en el browser.
 *
 * Se usa exclusivamente en el Stream View del admin: el sorteo simulado
 * NUNCA se persiste — solo anima la ruleta con las opciones del preset
 * real de la edición. Los sorteos reales siguen saliendo del server.
 */

import type { PresetConfig, PresetMode, DrawResult } from "./draw-engine";

/** Entero aleatorio en [0, max) — Math.random basta para previsualizar. */
function rndInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

/** pickWeighted client-safe: mismo algoritmo que draw-engine. */
function pickWeighted<T extends { weight?: number }>(items: T[]): T {
  const active = items.filter((i) => (i.weight ?? 1) > 0);
  if (active.length === 0) throw new Error("pickWeighted: no hay opciones activas");
  const total = active.reduce((s, i) => s + (i.weight ?? 1), 0);
  let roll = rndInt(total);
  for (const item of active) {
    roll -= item.weight ?? 1;
    if (roll < 0) return item;
  }
  return active[active.length - 1];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rndInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Opciones forzadas por fase (lo que el admin elige en la consola). */
export interface ForcedChoices {
  gameModeId?: string | null;
  antimetaModeId?: string | null;
  playerModeId?: string | null;
  mapId?: string | null;
  llaveId?: string | null;
}

function pick<T extends { weight?: number; id: string }>(items: T[], forcedId?: string | null): T {
  if (forcedId) {
    const forced = items.find((i) => i.id === forcedId);
    if (forced) return forced;
  }
  return pickWeighted(items);
}

/** Fallback de civsPerTeam según el título del formato (igual a draw-engine). */
function civsForPlayerModeTitle(title: string): number {
  const t = title.toLowerCase();
  if (t.includes("1") && t.includes("1")) return 1;
  if (t.includes("2") && t.includes("2")) return 2;
  if (t.includes("3") && t.includes("3")) return 3;
  if (t.includes("team") || t.includes("fus")) return 1;
  return 1;
}

/**
 * Simula el sorteo completo: MODO → ANTIMETA → FORMATO → MAPA → LLAVE.
 * No incluye el memotest de civs: esa escena se prueba por separado.
 */
export function simulateDraw(
  preset: PresetConfig,
  opts: { firstGame: boolean; forced?: ForcedChoices }
): Omit<DrawResult, "civsA" | "civsB"> {
  if (!preset.gameModes.length || !preset.playerModes.length || !preset.mapModes.length) {
    throw new Error("Preset incompleto: faltan gameModes, playerModes o mapModes.");
  }
  const forced = opts.forced ?? {};

  const gameMode = pick(preset.gameModes, forced.gameModeId);
  const isAntimeta = /antimeta/i.test(gameMode.title) || /antimeta/i.test(gameMode.id);
  const antimetaMode = isAntimeta && preset.antimetaModes.length > 0
    ? pick(preset.antimetaModes, forced.antimetaModeId)
    : null;

  const playerMode = pick(preset.playerModes, forced.playerModeId);

  // Pool de mapas: propio de la antimeta si lo define, si no el global.
  const am = antimetaMode as any;
  const mapSource = am?.mapPool && Array.isArray(am.mapPool) && am.mapPool.length > 0
    ? am.mapPool as PresetMode[]
    : preset.mapModes;
  const map = pick(mapSource, forced.mapId);

  const llave = opts.firstGame && preset.llaveModes.length > 0
    ? pick(preset.llaveModes, forced.llaveId)
    : null;

  return {
    gameMode,
    antimetaMode,
    playerMode,
    map,
    llave,
    seed: "",
    drawnAt: new Date().toISOString(),
  };
}

/** Simula el robo de N civs del pool de un equipo (memotest). */
export function simulateDrawCivs(pool: string[], n: number): string[] {
  const available = shuffle(pool);
  return available.slice(0, Math.min(n, available.length));
}

/** Cuántas civs corresponde al formato elegido. */
export function civsNeededFor(playerMode: PresetMode): number {
  return playerMode.civsPerTeam ?? civsForPlayerModeTitle(playerMode.title);
}

/**
 * Convierte un resultado simulado al shape `forced` que la ruleta espera
 * (los IDs que debe animar hasta mostrar como ganadores).
 */
export function toForced(result: Omit<DrawResult, "civsA" | "civsB">): {
  gameModeId: string;
  antimetaModeId?: string;
  playerModeId: string;
  mapId: string;
  llaveId?: string;
} {
  return {
    gameModeId: result.gameMode.id,
    ...(result.antimetaMode ? { antimetaModeId: result.antimetaMode.id } : {}),
    playerModeId: result.playerMode.id,
    mapId: result.map.id,
    ...(result.llave ? { llaveId: result.llave.id } : {}),
  };
}
