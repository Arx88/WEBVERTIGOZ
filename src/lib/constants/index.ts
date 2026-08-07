/**
 * Constantes del dominio VÉRTIGO.
 */

// Roles de cuenta (Supabase Auth app_metadata.role)
export const ACCOUNT_ROLES = {
  OWNER: "owner",           // dueño de cuenta de equipo
  PLAYER: "player",          // jugador dentro de un equipo
  ADMIN: "admin",            // staff del torneo
  SUPER_ADMIN: "super_admin", // admin con poderes extra (rollback, disputes)
  CASTER: "caster",           // streamer registrado
} as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[keyof typeof ACCOUNT_ROLES];

// Estados de un match (la llave)
export const MATCH_STATUS = {
  SCHEDULED: "scheduled",
  OPEN: "open",                  // llegó la hora, esperando READY #1
  DRAWING: "drawing",             // sorteo en curso
  LINEUP: "lineup",               // post-sorteo, declarar lineup
  COMODIN_WINDOW: "comodin_window", // 5 min para usar comodines
  IN_PROGRESS: "in_progress",     // partida en juego
  FINISHED: "finished",
  DISPUTED: "disputed",
  FORFEIT: "forfeit",
  CANCELLED: "cancelled",
} as const;

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

// Estados de un match_game (cada partida dentro de la llave)
export const GAME_STATUS = {
  PENDING: "pending",
  DRAWING: "drawing",
  LINEUP: "lineup",
  COMODIN_WINDOW: "comodin_window",
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
} as const;

export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

// Estados de inscripción de equipo
export const REGISTRATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUS)[keyof typeof REGISTRATION_STATUS];

// Estados de verificación de ELO
export const ELO_VERIFICATION = {
  VERIFIED: "verified",
  PENDING: "pending",       // perfil oculto, falta verificación manual
  HIDDEN: "hidden",          // shared=false en AoE2 Companion
  FAILED: "failed",          // no se pudo obtener el perfil
} as const;

export type EloVerification = (typeof ELO_VERIFICATION)[keyof typeof ELO_VERIFICATION];

// Formatos de llave
export const MATCH_FORMAT = {
  BO3: "BO3",
  BO1: "BO1", // = Deathmatch
} as const;

export type MatchFormat = (typeof MATCH_FORMAT)[keyof typeof MATCH_FORMAT];

// Modos de jugadores
export const PLAYER_MODE = {
  V1: "1v1",
  V2: "2v2",
  V3: "3v3",
  FUSION: "fusion",
} as const;

export type PlayerMode = (typeof PLAYER_MODE)[keyof typeof PLAYER_MODE];

// Tipos de comodín
export const COMODIN_TYPE = {
  REROLL: "reroll",
  ANULAR: "anular",
  ELEGIR_RIVAL: "elegir_rival",
  INVOCAR_PRO: "invocar_pro",
} as const;

export type ComodinType = (typeof COMODIN_TYPE)[keyof typeof COMODIN_TYPE];

// Fases de la ruleta (para re-girar)
export const ROULETTE_PHASE = {
  MODO: "MODO",
  ANTIMETA: "ANTIMETA",
  FORMATO: "FORMATO",
  MAPA: "MAPA",
  LLAVE: "LLAVE",
  CIVS: "CIVS",
} as const;

export type RoulettePhase = (typeof ROULETTE_PHASE)[keyof typeof ROULETTE_PHASE];

// Estados de caster
export const CASTER_TIER = {
  OFFICIAL: "official",
  SECONDARY: "secondary",
  COMMUNITY: "community",
} as const;

export type CasterTier = (typeof CASTER_TIER)[keyof typeof CASTER_TIER];

// Estados de torneo
export const TOURNAMENT_STATUS = {
  DRAFT: "draft",
  REGISTRATION: "registration",
  ACTIVE: "active",
  FINISHED: "finished",
} as const;

export type TournamentStatus = (typeof TOURNAMENT_STATUS)[keyof typeof TOURNAMENT_STATUS];

// Estados de sorteo (commit-reveal)
export const DRAW_STATUS = {
  COMMITTED: "committed",
  SPINNING: "spinning",
  REVEALED: "revealed",
  PUBLISHED: "published",
  CANCELLED: "cancelled",
} as const;

export type DrawStatus = (typeof DRAW_STATUS)[keyof typeof DRAW_STATUS];

// Defaults del torneo (configurables desde admin)
export const DEFAULTS = {
  ELO_CAP: 3500,
  ELO_TOLERANCE: 20,
  TEAM_SIZE: 3,
  MAX_TEAMS: 32,
  CIVS_BASE: 9,
  CIVS_EXTRA_FINALIST: 3,
  COMODIN_REROLL: 2,
  COMODIN_ANULAR: 1,
  COMODIN_ELEGIR_RIVAL: 1,
  COMODIN_INVOCAR_PRO: 1,
  COMODIN_WINDOW_MINUTES: 5,
  INVOCAR_PRO_MINUTES: 5,
  READY_TIMEOUT_MINUTES: 10,
  DRAW_TIMEOUT_MINUTES: 5,
  ELO_FIELD: "rm_1v1_max",
} as const;

// Tamaño del bracket (SE de 32)
export const BRACKET_SIZE = 32;
export const BRACKET_ROUNDS = 5; // 32 → 16 → 8 → 4 → 2 → 1

// Avatares genéricos auto-asignados (12 siluetas medievales)
export const GENERIC_AVATARS = [
  "knight", "archer", "monk", "scout", "berserker",
  "cataphract", "huskarl", "mameluke", "teutonic-knight",
  "samurai", "war-elephant", "longbowman",
] as const;

export type GenericAvatar = (typeof GENERIC_AVATARS)[keyof typeof GENERIC_AVATARS];
