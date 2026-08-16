/**
 * VÉRTIGO Cup — TUTORIAL (modo demo)
 *
 * Datos del partido ficticio que protagoniza el tutorial + guion de escenas.
 * Todo es estático: la demo no toca la BD ni requiere sesión.
 */

import { CIV_NAMES } from "@/lib/constants/civs";

export interface DemoPlayer {
  name: string;
  tag: string;
  isCaptain?: boolean;
}

export interface DemoTeam {
  id: "A" | "B";
  name: string;
  seed: number;
  color: string;
  emblem: string;
  tag: string;
  players: DemoPlayer[];
  /** pool de civs para el memotest (imagen en /public/civs/{id}.webp) */
  civPool: string[];
}

export const TEAM_A: DemoTeam = {
  id: "A",
  name: "REINO DEL ALBA",
  seed: 3,
  color: "#D4AF37",
  emblem: "/emblems/emblema-1.webp",
  tag: "Los favoritos",
  players: [
    { name: "ValastroX", tag: "Capitán", isCaptain: true },
    { name: "Kaelith", tag: "Rusher" },
    { name: "BrunoAOE", tag: "Boomer" },
  ],
  civPool: ["franks", "britons", "goths", "teutons", "japanese", "chinese", "celts", "spanish"],
};

export const TEAM_B: DemoTeam = {
  id: "B",
  name: "ORDEN DEL CUERVO",
  seed: 14,
  color: "#8B2CF5",
  emblem: "/emblems/emblema-2.webp",
  tag: "Los underdogs",
  players: [
    { name: "Morgath", tag: "Capitán", isCaptain: true },
    { name: "Sylvana", tag: "Flanker" },
    { name: "RuizGamer", tag: "Sniper" },
  ],
  civPool: ["byzantines", "persians", "saracens", "turks", "vikings", "mongols", "huns", "koreans"],
};

/**
 * Quiénes juegan en 2v2 (el capitán + 1). El resto queda en el banco.
 * Cada uno recibe una de las civs sorteadas (asignación del capitán).
 *
 * NOTA: los colores de los reinos (#D4AF37 / #8B2CF5) son los acentos de
 * identidad de cada equipo (emblemas emblema-1 / emblema-2), no acentos de
 * UI. Todo lo demás usa la paleta púrpura del sitio.
 */
export const LINEUP_PLAYERS: Record<"A" | "B", string[]> = {
  A: ["ValastroX", "Kaelith"],
  B: ["Morgath", "Sylvana"],
};

/**
 * Resultado guionado del sorteo que reproduce la ruleta (prop `forced`).
 * Filosofía del torneo: "server decide / client anima".
 */
export const DEMO_FORCED = {
  gameModeId: "gm-guerras", // GUERRAS IMPERIALES
  playerModeId: "pm-2vs2", // 2 VS 2
  mapId: "map-crater", // CRÁTER
  llaveId: "ll-bo3", // BO3
};

export const DEMO_MAP_ORIGINAL_ID = "map-crater";
export const DEMO_REROLL_MAP_ID = "map-cuatro-lagos";

export const DEMO_RESULT = {
  mode: "GUERRAS IMPERIALES",
  format: "2 VS 2",
  map: "CRÁTER",
  mapReroll: "CUATRO LAGOS",
  llave: "BO3",
};

export function civName(id: string): string {
  return CIV_NAMES[id] ?? id;
}

export function civImg(id: string): string {
  return `/civs/${id}.webp`;
}

export const FALLBACK_CIVS_A = TEAM_A.civPool.slice(0, 2);
export const FALLBACK_CIVS_B = TEAM_B.civPool.slice(0, 2);

// ============================================================
// Guion de escenas — el director las reproduce en orden.
// kind: "timed" avanza solo después de estMs/speed.
// kind: "event" avanza cuando la escena llama onDone (ruleta, memotest…).
// ============================================================

export type ScenePov =
  | "INTRO"
  | "ADMIN"
  | "EQUIPO A"
  | "EQUIPO B"
  | "EN VIVO"
  | "PARTIDA";

export const POV_COLOR: Record<ScenePov, string> = {
  INTRO: "#c4b5fd",
  ADMIN: "#a78bfa",
  "EQUIPO A": "#D4AF37", // identidad del emblema-1 (REINO DEL ALBA)
  "EQUIPO B": "#8B2CF5", // identidad del emblema-2 (ORDEN DEL CUERVO)
  "EN VIVO": "#fb7185", // danger del design system
  PARTIDA: "#fb7185",
};

export interface SceneMeta {
  id: string;
  pov: ScenePov;
  kicker: string;
  title: string;
  desc: string;
  /** duración estimada en 1x; en "event" es solo referencia para la barra */
  ms: number;
  kind: "timed" | "event";
}

export const SCENES: SceneMeta[] = [
  {
    id: "intro",
    pov: "INTRO",
    kicker: "APERTURA",
    title: "VÉRTIGO CUP · TUTORIAL EN VIVO",
    desc: "Esto es lo que pasa en una LLAVE del torneo, contado desde adentro. Cada cámara tiene un POV: los equipos, el ADMIN y el stream.",
    ms: 6000,
    kind: "event",
  },
  {
    id: "admin-agenda",
    pov: "ADMIN",
    kicker: "PUNTO DE VISTA · ADMIN",
    title: "1. EL ADMIN AGENDA LA LLAVE",
    desc: "El staff crea la llave con fecha y hora de inicio. Nadie sabe el modo ni el mapa: solo la RULETA lo decide, 15 minutos antes de jugar.",
    ms: 7000,
    kind: "timed",
  },
  {
    id: "t15",
    pov: "ADMIN",
    kicker: "T-15 MINUTOS",
    title: "2. LA LLAVE SE ABRE",
    desc: "Llegó la hora: el match pasa a ABIERTO y se invita a los equipos vía Realtime. El reloj del torneo no perdona.",
    ms: 8000,
    kind: "timed",
  },
  {
    id: "ready-a",
    pov: "EQUIPO A",
    kicker: "PUNTO DE VISTA · CAPITÁN EQUIPO A",
    title: "3. READY #1 — EQUIPO A",
    desc: "El capitán de REINO DEL ALBA ve la llave en su dashboard y toca [LISTO]. Todos los viewer pueden seguirlo en tiempo real.",
    ms: 6000,
    kind: "timed",
  },
  {
    id: "ready-b",
    pov: "EQUIPO B",
    kicker: "PUNTO DE VISTA · CAPITÁN EQUIPO B",
    title: "4. READY #1 — EQUIPO B",
    desc: "ORDEN DEL CUERVO confirma. Con ambos equipos LISTO, el server habilita el sorteo.",
    ms: 6000,
    kind: "timed",
  },
  {
    id: "admin-draw",
    pov: "ADMIN",
    kicker: "PUNTO DE VISTA · ADMIN",
    title: "5. EL ADMIN DISPARA EL SORTEO",
    desc: "El staff toca [INICIAR SORTEO]. El resultado ya está decidido por el server (commit-reveal SHA-256): lo que sigue es puro show.",
    ms: 6500,
    kind: "timed",
  },
  {
    id: "ruleta",
    pov: "EN VIVO",
    kicker: "STREAM · TODA LA WEB VE ESTO",
    title: "6. GIRA LA RULETA",
    desc: "5 fases: MODO → FORMATO → MAPA → LLAVE. Todos los viewers ven exactamente la misma animación, sincronizada por Realtime.",
    ms: 40000,
    kind: "event",
  },
  {
    id: "memotest",
    pov: "EN VIVO",
    kicker: "STREAM · SORTEO DE CIVS POR EQUIPO",
    title: "7. MEMOTEST DE CIVILIZACIONES",
    desc: "Formato 2 VS 2: cada equipo sortea SUS 2 civilizaciones. Primero REINO DEL ALBA, después ORDEN DEL CUERVO. Las civs de cada reino quedan claramente separadas.",
    ms: 45000,
    kind: "event",
  },
  {
    id: "summary",
    pov: "EN VIVO",
    kicker: "POST-SORTEO · RESUMEN",
    title: "8. ASÍ QUEDÓ EL SORTEO",
    desc: "Split-screen con todo lo que salió de la ruleta y las civs de cada team. Esto mismo viaja a la página del partido.",
    ms: 8000,
    kind: "timed",
  },
  {
    id: "lineup-a",
    pov: "EQUIPO A",
    kicker: "PUNTO DE VISTA · CAPITÁN EQUIPO A",
    title: "9. LINEUP + ASIGNACIÓN DE CIVS",
    desc: "No es 3v3 ni FUSIÓN: el capitán declara QUIÉN JUÉGA y ASIGNA una civilización sorteada a cada jugador que entra al mapa.",
    ms: 8000,
    kind: "timed",
  },
  {
    id: "lineup-b",
    pov: "EQUIPO B",
    kicker: "PUNTO DE VISTA · CAPITÁN EQUIPO B",
    title: "10. LINEUP DEL RIVAL",
    desc: "Morgath hace lo mismo para la ORDEN DEL CUERVO: jugadores + civs asignadas. Ambos confirman con READY #2.",
    ms: 8000,
    kind: "timed",
  },
  {
    id: "comodin",
    pov: "EQUIPO B",
    kicker: "VENTANA DE COMODINES · 5 MIN · INVENTARIO POR EQUIPO",
    title: "11. LA VENTANA DE COMODINES",
    desc: "Cada equipo tiene SU inventario: Re-girar ×2, Anular ×1, Elegir rival ×1 (Anular y Elegir rival son excluyentes) e Invocar PRO. La ORDEN DEL CUERVO activa RE-GIRAR…",
    ms: 12500,
    kind: "timed",
  },
  {
    id: "reroll",
    pov: "EN VIVO",
    kicker: "STREAM · RE-GIRAR FASE MAPA · RULETA REAL",
    title: "12. LA RULETA GIRA SOLO EL MAPA",
    desc: "El ADMIN confirma el comodín y la ruleta REAL gira únicamente la fase MAPA. Todo lo demás del sorteo queda intacto.",
    ms: 30000,
    kind: "event",
  },
  {
    id: "reroll-summary",
    pov: "EN VIVO",
    kicker: "POST-COMODÍN · RESUMEN ACTUALIZADO",
    title: "13. ASÍ QUEDÓ EL SORTEO",
    desc: "El RE-GIRAR cambió SOLO el mapa: el MODO, el FORMATO y la LLAVE quedan intactos. Este resumen actualizado viaja de nuevo a la página del partido.",
    ms: 8000,
    kind: "timed",
  },
  {
    id: "partida",
    pov: "PARTIDA",
    kicker: "AOE2 · EN JUEGO",
    title: "14. LA PARTIDA",
    desc: "El árbitro arranca la partida con las civs ya asignadas. INVOCAR PRO se puede escribir con “CARTA PRO” en el chat del sitio durante todo el juego.",
    ms: 9500,
    kind: "timed",
  },
  {
    id: "admin-resultado",
    pov: "ADMIN",
    kicker: "PUNTO DE VISTA · ADMIN",
    title: "15. SE CARGA EL RESULTADO",
    desc: "Terminó la serie: el ADMIN registra el 2-0. La llave queda FINISHED y el ganador avanza en el bracket.",
    ms: 7000,
    kind: "timed",
  },
  {
    id: "final",
    pov: "INTRO",
    kicker: "FIN DE LA LLAVE",
    title: "16. REINO DEL ALBA AVANZA",
    desc: "Score, civs, comodines usados y bracket actualizado — todo publicado en tiempo real. Fin de la demo.",
    ms: 10000,
    kind: "event",
  },
];

export interface DemoState {
  civsA: string[];
  civsB: string[];
  mapId: string; // mapa vigente (puede cambiar por RE-GIRAR)
  scoreA: number;
  scoreB: number;
  winner: "A" | "B" | null;
}

export const INITIAL_DEMO_STATE: DemoState = {
  civsA: [],
  civsB: [],
  mapId: DEMO_MAP_ORIGINAL_ID,
  scoreA: 0,
  scoreB: 0,
  winner: null,
};

/** Contexto que el director le pasa a cada escena */
export interface DemoSceneCtx {
  demo: DemoState;
  setDemo: (u: (p: DemoState) => DemoState) => void;
  /** multiplicador de velocidad del director (1, 2, 4) */
  speed: number;
  /** solo para escenas kind "event": avanza a la siguiente escena */
  onDone: () => void;
}
