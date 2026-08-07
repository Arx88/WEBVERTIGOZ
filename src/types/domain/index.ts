/**
 * Tipos del dominio VÉRTIGO (no de DB, de negocio).
 */

// ============================================================
// AoE2 Companion
// ============================================================

export interface Aoe2ProfileSummary {
  profileId: number;
  name: string;
  steamId?: string;
  country?: string;
  clan?: string;
  platform?: string;
  verified?: boolean;
}

export interface Aoe2Leaderboard {
  leaderboardId: string;
  rating: number;
  maxRating: number;
  rank?: number;
  rankCountry?: number;
  wins: number;
  losses: number;
  games: number;
  streak: number;
  drops: number;
  lastMatchTime?: string;
  total?: number;
}

export interface Aoe2CivStat {
  civName: string;
  civImageUrl?: string;
  games: number;
  wins: number;
  losses: number;
}

export interface Aoe2MapStat {
  mapName: string;
  mapImageUrl?: string;
  games: number;
  wins: number;
  losses: number;
}

export interface Aoe2Stat {
  leaderboardId: string;
  civ: Aoe2CivStat[];
  map: Aoe2MapStat[];
}

export interface Aoe2LinkedProfile {
  profileId: number;
  name: string;
  platform?: string;
}

export interface Aoe2Profile {
  profileId: number;
  name: string;
  steamId?: string;
  country?: string;
  clan?: string;
  platform?: string;
  verified?: boolean;
  socialLiquipedia?: string;
  socialTwitch?: string;
  socialDiscord?: string;
  socialYoutube?: string;
  leaderboards: Aoe2Leaderboard[];
  stats: Aoe2Stat[];
  linkedProfiles?: Aoe2LinkedProfile[];
}

// ============================================================
// Tipos de la ruleta
// ============================================================

export interface RouletteMode {
  id: string;
  title: string;
  tag: string;
  color: string;
  img: string;
  tagline: string;
  description?: string;
  rules?: string[];
  kind: "MODO" | "ANTIMETA" | "FORMATO" | "LLAVE";
}

export interface RouletteMap {
  id: string;
  title: string;
  tag: string;
  color: string;
  img: string;
  kind: "MAPA";
}

export interface RouletteConfig {
  gameModes: RouletteMode[];
  antimetaModes: RouletteMode[];
  playerModes: RouletteMode[];
  mapModes: RouletteMap[];
  llaveModes: RouletteMode[];
}

// ============================================================
// Resultado del sorteo
// ============================================================

export interface DrawResult {
  gameMode: string;
  antimetaMode?: string;
  playerMode: "1v1" | "2v2" | "3v3" | "fusion";
  map: string;
  llaveFormat?: "BO3" | "BO1";
  civsA: string[];
  civsB: string[];
}

// ============================================================
// Comodines
// ============================================================

export interface ComodinInventory {
  rerollAvailable: number;
  anularAvailable: number;
  elegirRivalAvailable: number;
  invocarProAvailable: number;
}

// ============================================================
// Equipo (vista pública)
// ============================================================

export interface TeamPublicProfile {
  id: string;
  name: string;
  tagline?: string;
  emblemUrl?: string;
  editionName: string;
  players: {
    id: string;
    displayName: string;
    country?: string;
    isCaptain: boolean;
    ratingRm1v1Current?: number;
    aoe2ProfileId: number;
  }[];
  seed?: number;
  wins: number;
  losses: number;
}

// ============================================================
// Match (vista pública)
// ============================================================

export interface MatchPublicView {
  id: string;
  roundName: string;
  teamA?: TeamPublicProfile;
  teamB?: TeamPublicProfile;
  status: string;
  scheduledAtStart?: string;
  scheduledAtEnd?: string;
  jornadaLabel?: string;
  format?: "BO3" | "BO1";
  scoreA: number;
  scoreB: number;
  winnerTeamId?: string;
  streamEmbedEnabled: boolean;
  games?: GamePublicView[];
}

export interface GamePublicView {
  id: string;
  gameNumber: number;
  status: string;
  gameMode?: string;
  antimetaMode?: string;
  playerMode?: "1v1" | "2v2" | "3v3" | "fusion";
  map?: string;
  civsA?: string[];
  civsB?: string[];
  winnerTeamId?: string;
  replayUrl?: string;
  startedAt?: string;
  finishedAt?: string;
}
