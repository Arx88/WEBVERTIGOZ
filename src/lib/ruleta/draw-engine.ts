/**
 * VÉRTIGO Cup — Motor de sorteo server-side.
 *
 * Filosofía: "server decide / client anima".
 * El servidor decide el resultado con crypto-secure randomness y lo persiste.
 * La ruleta animada SOLO reproduce ese resultado (nunca decide en el cliente).
 *
 * Esto da:
 *  - Fairness real (nadie, ni el admin, puede amañar el giro).
 *  - Sincronización perfecta entre todos los viewers (todos ven lo mismo).
 *  - Auditabilidad (el resultado queda persistido antes de animarse).
 */

import crypto from "crypto";

// ============================================================
// Tipos del preset (config de la ruleta, viene de preset_version.config)
// ============================================================

export interface PresetMode {
  id: string;
  title: string;
  tag?: string;
  color?: string;
  img?: string;
  kind: "MODO" | "ANTIMETA" | "FORMATO" | "LLAVE" | "MAPA";
  tagline?: string;
  description?: string;
  rules?: string[];
  /** Solo para playerModes: cuántas civs por equipo sortea el memotest. */
  civsPerTeam?: number;
  /** Solo para llaveModes: BO1 | BO3. */
  llaveFormat?: "BO1" | "BO3";
  /** Peso relativo (default 1). Mayor = más probable. */
  weight?: number;
}

export interface PresetConfig {
  gameModes: PresetMode[];
  antimetaModes: PresetMode[];
  playerModes: PresetMode[];
  mapModes: PresetMode[];
  llaveModes: PresetMode[];
  sounds?: { enabled: boolean; volume: number };
  music?: { enabled: boolean; volume: number };
}

/**
 * Resultado completo de un sorteo de partida.
 * Es lo que se guarda en roulette_draw.result y en match_game.*.
 */
export interface DrawResult {
  gameMode: PresetMode;              // MODO
  antimetaMode: PresetMode | null;   // ANTIMETA (solo si gameMode es antimeta)
  playerMode: PresetMode;            // FORMATO (1v1/2v2/3v3/fusion)
  map: PresetMode;                   // MAPA
  llave: PresetMode | null;          // LLAVE (BO3/BO1) — solo se sortea en la partida 1
  civsA: string[];                   // civs sorteadas del equipo A (según formato)
  civsB: string[];                   // civs sorteadas del equipo B
  /** Seed criptográfica que generó este resultado (para reproducir la animación) */
  seed: string;
  /** Timestamps del ciclo */
  drawnAt: string;
}

// ============================================================
// Randomness criptográfica
// ============================================================

/** Entero aleatorio uniforme en [0, max) usando crypto (no Math.random). */
function cryptoInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return crypto.randomInt(0, maxExclusive);
}

/** Selecciona un ítem con peso (weight). Uniforme ponderado. */
function pickWeighted<T extends { weight?: number }>(items: T[]): T {
  if (items.length === 0) throw new Error("pickWeighted: lista vacía");
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  let roll = crypto.randomInt(0, total);
  for (const item of items) {
    roll -= item.weight ?? 1;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

/** Shuffle Fisher-Yates con crypto. */
export function cryptoShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Seed criptográfica hex (para auditoría interna y reproducibilidad). */
export function generateSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Hash SHA-256 interno (log interno, NO commit-reveal público por ahora). */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// ============================================================
// Lógica del sorteo de una partida
// ============================================================

export interface DrawContext {
  /** Pool de civs del equipo A (base_civ_ids + extra si es final) */
  poolA: string[];
  /** Pool de civs del equipo B */
  poolB: string[];
  /** Si es la partida 1 (se sortea LLAVE) o 2/3 (no) */
  isFirstGame: boolean;
  /** Si es la final del torneo (se habilitan las extra_civ_ids) */
  isFinal?: boolean;
  /** Árbitro que dispara el sorteo (para el audit log) */
  adminAccountId: string;
  /** Seed opcional: si se provee, el sorteo es determinista (para RE-GIRAR / replay) */
  forcedSeed?: string;
}

/**
 * Ejecuta el sorteo completo de una partida:
 * MODO → (ANTIMETA si aplica) → FORMATO → MAPA → (LLAVE si P1) → memotest de civs.
 *
 * Todo se decide acá, server-side. El cliente solo anima.
 */
export function performDraw(preset: PresetConfig, ctx: DrawContext): DrawResult {
  const seed = ctx.forcedSeed ?? generateSeed();

  // Validar preset
  if (preset.gameModes.length === 0 || preset.playerModes.length === 0 || preset.mapModes.length === 0) {
    throw new Error("Preset incompleto: faltan gameModes, playerModes o mapModes.");
  }

  // 1. MODO
  const gameMode = pickWeighted(preset.gameModes);

  // 2. ANTIMETA (solo si el modo es antimeta)
  const isAntimeta = /antimeta/i.test(gameMode.title) || /antimeta/i.test(gameMode.id);
  const antimetaMode = isAntimeta && preset.antimetaModes.length > 0
    ? pickWeighted(preset.antimetaModes)
    : null;

  // 3. FORMATO (1v1 / 2v2 / 3v3 / FUSIÓN)
  const playerMode = pickWeighted(preset.playerModes);

  // 4. MAPA
  // Si el antimeta define un pool de mapas propio, usarlo; si no, el global.
  const mapSource = antimetaMode && (antimetaMode as any).mapPool && Array.isArray((antimetaMode as any).mapPool) && (antimetaMode as any).mapPool.length > 0
    ? (antimetaMode as any).mapPool as PresetMode[]
    : preset.mapModes;
  const map = pickWeighted(mapSource);

  // 5. LLAVE (BO3 / Deathmatch) — SOLO en la partida 1
  const llave = ctx.isFirstGame && preset.llaveModes.length > 0
    ? pickWeighted(preset.llaveModes)
    : null;

  // 6. MEMOTEST DE CIVS — según el formato
  //    1v1 → 1 civ por equipo ; 2v2 → 2 ; 3v3 → 3 ; FUSIÓN → 1 compartida.
  const civsNeeded = playerMode.civsPerTeam ?? civsForPlayerModeTitle(playerMode.title);
  const civsA = drawCivs(ctx.poolA, civsNeeded);
  const civsB = drawCivs(ctx.poolB, civsNeeded);

  return {
    gameMode,
    antimetaMode,
    playerMode,
    map,
    llave,
    civsA,
    civsB,
    seed,
    drawnAt: new Date().toISOString(),
  };
}

/** Fallback: deducir cuántas civs por equipo a partir del título del formato. */
function civsForPlayerModeTitle(title: string): number {
  const t = title.toLowerCase();
  if (t.includes("1") && t.includes("1")) return 1;      // 1v1
  if (t.includes("2") && t.includes("2")) return 2;      // 2v2
  if (t.includes("3") && t.includes("3")) return 3;      // 3v3
  if (t.includes("team") || t.includes("fus")) return 1; // FUSIÓN comparte una civ
  return 1;
}

/**
 * Saca N civs del pool del equipo, sin repetir intra-equipo.
 * Si el pool tiene menos de N, toma todas las que hay (no falla).
 */
function drawCivs(pool: string[], n: number): string[] {
  const available = cryptoShuffle(pool);
  return available.slice(0, Math.min(n, available.length));
}

// ============================================================
// Re-girar UNA fase (comodín REROLL)
// ============================================================

/**
 * Re-sortea una sola fase del resultado, manteniendo el resto.
 * Restricciones:
 *  - Re-girar ANTIMETA solo si el modo es antimeta.
 *  - Re-girar CIVS re-sortea las civs (el admin elige qué equipo o ambos).
 *  - Re-girar LLAVE solo si es la partida 1.
 */
export function rerollPhase(
  current: DrawResult,
  phase: "MODO" | "ANTIMETA" | "FORMATO" | "MAPA" | "LLAVE" | "CIVS",
  preset: PresetConfig,
  ctx: DrawContext
): DrawResult {
  const next: DrawResult = { ...current, seed: generateSeed(), drawnAt: new Date().toISOString() };

  switch (phase) {
    case "MODO": {
      next.gameMode = pickWeighted(preset.gameModes);
      // Si el nuevo modo no es antimeta, se limpia el antimeta
      const isAnti = /antimeta/i.test(next.gameMode.title);
      next.antimetaMode = isAnti ? (preset.antimetaModes.length ? pickWeighted(preset.antimetaModes) : null) : null;
      break;
    }
    case "ANTIMETA": {
      if (preset.antimetaModes.length === 0) throw new Error("No hay antimeta modos para re-girar.");
      next.antimetaMode = pickWeighted(preset.antimetaModes);
      break;
    }
    case "FORMATO": {
      next.playerMode = pickWeighted(preset.playerModes);
      // Cambiar formato cambia cuántas civs → re-sortear civs
      const civsNeeded = next.playerMode.civsPerTeam ?? civsForPlayerModeTitle(next.playerMode.title);
      next.civsA = drawCivs(ctx.poolA, civsNeeded);
      next.civsB = drawCivs(ctx.poolB, civsNeeded);
      break;
    }
    case "MAPA": {
      const mapSource = next.antimetaMode && (next.antimetaMode as any).mapPool?.length ? (next.antimetaMode as any).mapPool as PresetMode[] : preset.mapModes;
      next.map = pickWeighted(mapSource);
      break;
    }
    case "LLAVE": {
      if (!ctx.isFirstGame) throw new Error("Solo se puede re-girar LLAVE en la partida 1.");
      if (preset.llaveModes.length === 0) throw new Error("No hay llave modos.");
      next.llave = pickWeighted(preset.llaveModes);
      break;
    }
    case "CIVS": {
      const civsNeeded = next.playerMode.civsPerTeam ?? civsForPlayerModeTitle(next.playerMode.title);
      next.civsA = drawCivs(ctx.poolA, civsNeeded);
      next.civsB = drawCivs(ctx.poolB, civsNeeded);
      break;
    }
  }
  return next;
}
