/**
 * VÉRTIGO Cup — Schema de Base de Datos (Drizzle + Postgres)
 *
 * Modelo completo del torneo. Ver docs/SPEC.md para el detalle funcional.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const accountRole = pgEnum("account_role", [
  "owner",        // dueño de cuenta de equipo
  "player",       // jugador dentro de un equipo (sin login propio)
  "admin",        // staff del torneo
  "super_admin",  // admin con poderes extra
  "caster",       // streamer registrado
]);

export const tournamentStatus = pgEnum("tournament_status", [
  "draft",
  "registration",
  "active",
  "finished",
]);

export const registrationStatus = pgEnum("registration_status", [
  "pending",
  "approved",
  "rejected",
]);

export const eloVerification = pgEnum("elo_verification", [
  "verified",
  "pending",
  "hidden",
  "failed",
]);

export const matchStatus = pgEnum("match_status", [
  "scheduled",
  "open",
  "drawing",
  "lineup",
  "comodin_window",
  "in_progress",
  "finished",
  "disputed",
  "forfeit",
  "cancelled",
]);

export const gameStatus = pgEnum("game_status", [
  "pending",
  "drawing",
  "lineup",
  "comodin_window",
  "in_progress",
  "finished",
]);

export const matchFormat = pgEnum("match_format", ["BO3", "BO1"]);

export const playerMode = pgEnum("player_mode", [
  "1v1",
  "2v2",
  "3v3",
  "fusion",
]);

export const comodinType = pgEnum("comodin_type", [
  "reroll",
  "anular",
  "elegir_rival",
  "invocar_pro",
]);

export const comodinStatus = pgEnum("comodin_status", [
  "pending",
  "executing",
  "executed",
  "cancelled",
  "revoked",
]);

export const drawStatus = pgEnum("draw_status", [
  "committed",
  "spinning",
  "revealed",
  "published",
  "cancelled",
]);

export const casterTier = pgEnum("caster_tier", [
  "official",
  "secondary",
  "community",
]);

export const bracketType = pgEnum("bracket_type", [
  "winner",
  "consolation",
]);

export const disputeStatus = pgEnum("dispute_status", [
  "open",
  "reviewing",
  "resolved",
  "rejected",
]);

// ============================================================
// CUENTAS Y USUARIOS
// ============================================================

/**
 * Cuenta de Supabase Auth.
 * Espejo de auth.users con metadatos de rol.
 */
export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  supabaseAuthId: uuid("supabase_auth_id").notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: accountRole("role").notNull().default("owner"),
  displayName: varchar("display_name", { length: 100 }),
  avatarKey: varchar("avatar_key", { length: 50 }), // generic avatar slug
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Cuenta de equipo (persiste entre ediciones).
 */
export const teamAccount = pgTable("team_account", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull().references(() => account.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 60 }).notNull(),
  tagline: varchar("tagline", { length: 140 }),
  emblemId: uuid("emblem_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// EMBLEMAS
// ============================================================

export const emblem = pgTable("emblem", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 60 }).notNull(),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  category: varchar("category", { length: 30 }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// PRESETS Y EDICIONES
// ============================================================

/**
 * Preset versionado del torneo (modos, mapas, civs disponibles, comodines config).
 * Inmutable una vez congelado.
 */
export const presetVersion = pgTable("preset_version", {
  id: uuid("id").primaryKey().defaultRandom(),
  version: integer("version").notNull(),
  frozenAt: timestamp("frozen_at", { withTimezone: true }),
  isFrozen: boolean("is_frozen").notNull().default(false),
  config: jsonb("config").notNull(), // { gameModes, antimetaModes, playerModes, maps, comodinConfig, ... }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Edición del torneo (recurrente).
 */
export const tournamentEdition = pgTable("tournament_edition", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  bannerUrl: varchar("banner_url", { length: 500 }),
  status: tournamentStatus("status").notNull().default("draft"),
  // ELO cap (configurable)
  eloCap: integer("elo_cap").notNull().default(3500),
  eloTolerance: integer("elo_tolerance").notNull().default(20),
  eloField: varchar("elo_field", { length: 50 }).notNull().default("rm_1v1_max"),
  // Config del bracket
  teamSize: integer("team_size").notNull().default(3),
  maxTeams: integer("max_teams").notNull().default(32),
  civsBase: integer("civs_base").notNull().default(9),
  civsExtraFinalist: integer("civs_extra_finalist").notNull().default(3),
  // Comodines config (admin configurable)
  comodinReroll: integer("comodin_reroll").notNull().default(2),
  comodinAnular: integer("comodin_anular").notNull().default(1),
  comodinElegirRival: integer("comodin_elegir_rival").notNull().default(1),
  comodinInvocarPro: integer("comodin_invocar_pro").notNull().default(1),
  comodinWindowMinutes: integer("comodin_window_minutes").notNull().default(5),
  invocarProMinutes: integer("invocar_pro_minutes").notNull().default(5),
  // Fairness config
  commitRevealEnabled: boolean("commit_reveal_enabled").notNull().default(true),
  drawTimeoutMinutes: integer("draw_timeout_minutes").notNull().default(5),
  // Casters / streaming
  twitchChannel: varchar("twitch_channel", { length: 100 }),
  youtubeChannel: varchar("youtube_channel", { length: 100 }),
  kickChannel: varchar("kick_channel", { length: 100 }),
  // Handbook
  handbookUrl: varchar("handbook_url", { length: 500 }),
  handbookUploadedAt: timestamp("handbook_uploaded_at", { withTimezone: true }),
  // Terms
  termsText: text("terms_text"),
  restreamRequired: boolean("restream_required").notNull().default(true),
  // Relations
  presetVersionId: uuid("preset_version_id").references(() => presetVersion.id),
  // Timestamps
  registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
  registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Inscripción de un equipo a una edición.
 */
export const teamRegistration = pgTable("team_registration", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamAccountId: uuid("team_account_id").notNull().references(() => teamAccount.id, { onDelete: "cascade" }),
  tournamentEditionId: uuid("tournament_edition_id").notNull().references(() => tournamentEdition.id, { onDelete: "cascade" }),
  // Civs elegidas (inmutables una vez confirmadas)
  baseCivIds: jsonb("base_civ_ids").notNull(), // string[] de civ ids
  extraCivIds: jsonb("extra_civ_ids").notNull().default([]), // string[] — solo se usan si llega a final
  // ELO snapshot freeze
  eloFreezeSnapshot: integer("elo_freeze_snapshot"),
  eloVerificationStatus: eloVerification("elo_verification_status").notNull().default("pending"),
  eloVerificationReason: text("elo_verification_reason"),
  // Wizard status
  status: registrationStatus("status").notNull().default("pending"),
  seed: integer("seed"), // asignado por sorteo inicial o admin
  // Términos
  restreamAccepted: boolean("restream_accepted").notNull().default(false),
  handbookDownloadedAt: timestamp("handbook_downloaded_at", { withTimezone: true }),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedById: uuid("approved_by_id").references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueTeamEdition: uniqueIndex("team_reg_unique_team_edition").on(t.teamAccountId, t.tournamentEditionId),
}));

/**
 * Jugador dentro de una inscripción de equipo.
 */
export const playerRegistration = pgTable("player_registration", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamRegistrationId: uuid("team_registration_id").notNull().references(() => teamRegistration.id, { onDelete: "cascade" }),
  // AoE2 Companion data (snapshot al inscribir)
  aoe2ProfileId: integer("aoe2_profile_id").notNull(),
  aoe2SteamId: varchar("aoe2_steam_id", { length: 30 }),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  country: varchar("country", { length: 2 }),
  clan: varchar("clan", { length: 30 }),
  platform: varchar("platform", { length: 20 }),
  isVerified: boolean("is_verified").notNull().default(false),
  // ELO snapshot freeze
  maxRatingRm1v1: integer("max_rating_rm_1v1"),
  ratingRm1v1Current: integer("rating_rm_1v1_current"),
  ratingRm1v1Rank: integer("rating_rm_1v1_rank"),
  // Captain
  isCaptain: boolean("is_captain").notNull().default(false),
  // Anti-smurf
  linkedProfiles: jsonb("linked_profiles").default([]), // aoe2 profile_id[] vinculados
  // Raw payload para auditoría
  verificationPayload: jsonb("verification_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueTeamPlayerAoe2: uniqueIndex("player_reg_unique_aoe2").on(t.teamRegistrationId, t.aoe2ProfileId),
}));

// ============================================================
// BRACKET
// ============================================================

export const bracket = pgTable("bracket", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentEditionId: uuid("tournament_edition_id").notNull().references(() => tournamentEdition.id, { onDelete: "cascade" }),
  type: bracketType("type").notNull().default("winner"),
  roundsCount: integer("rounds_count").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const round = pgTable("round", {
  id: uuid("id").primaryKey().defaultRandom(),
  bracketId: uuid("bracket_id").notNull().references(() => bracket.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  name: varchar("name", { length: 40 }).notNull(), // "Ronda 1", "Octavos", "Cuartos", "Semis", "Final"
});

/**
 * El MATCH (la LLAVE del torneo).
 */
export const match = pgTable("match", {
  id: uuid("id").primaryKey().defaultRandom(),
  roundId: uuid("round_id").notNull().references(() => round.id, { onDelete: "cascade" }),
  slotIndex: integer("slot_index").notNull(),
  // Para vincular con los matches padres (de dónde vienen los equipos)
  parentMatchAId: uuid("parent_match_a_id"),
  parentMatchBId: uuid("parent_match_b_id"),
  // Equipos (nullable hasta que avancen)
  teamAId: uuid("team_a_id").references(() => teamRegistration.id),
  teamBId: uuid("team_b_id").references(() => teamRegistration.id),
  // Estado
  status: matchStatus("status").notNull().default("scheduled"),
  // Scheduling (configurable por admin)
  scheduledAtStart: timestamp("scheduled_at_start", { withTimezone: true }),
  scheduledAtEnd: timestamp("scheduled_at_end", { withTimezone: true }),
  jornadaLabel: varchar("jornada_label", { length: 60 }),
  // READY #1 (apertura)
  readyAAt: timestamp("ready_a_at", { withTimezone: true }),
  readyBAt: timestamp("ready_b_at", { withTimezone: true }),
  // READY #2 (lineup)
  readyLineupAAt: timestamp("ready_lineup_a_at", { withTimezone: true }),
  readyLineupBAt: timestamp("ready_lineup_b_at", { withTimezone: true }),
  // Formato (decidido en partida 1)
  format: matchFormat("format"),
  // Resultado
  winnerTeamId: uuid("winner_team_id").references(() => teamRegistration.id),
  scoreA: integer("score_a").notNull().default(0),
  scoreB: integer("score_b").notNull().default(0),
  // Caster asignado
  streamCasterId: uuid("stream_caster_id").references(() => caster.id),
  streamEmbedEnabled: boolean("stream_embed_enabled").notNull().default(false),
  // Comodines usados en esta llave (mutuamente excluyentes anular/elegir)
  anularUsedByTeamId: uuid("anular_used_by_team_id").references(() => teamRegistration.id),
  elegirRivalUsedByTeamId: uuid("elegir_rival_used_by_team_id").references(() => teamRegistration.id),
  // Auditoría
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

/**
 * Cada partida dentro de una llave (1 a 3 partidas si es BO3).
 */
export const matchGame = pgTable("match_game", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => match.id, { onDelete: "cascade" }),
  gameNumber: integer("game_number").notNull(), // 1, 2, 3
  status: gameStatus("status").notNull().default("pending"),
  // Sorteo (commit-reveal fairness)
  // Referencia post-declaración de rouletteDraw (definida más abajo)
  drawId: uuid("draw_id"),
  // Resultado del sorteo (snapshot)
  gameMode: varchar("game_mode", { length: 50 }),
  antimetaMode: varchar("antimeta_mode", { length: 50 }),
  playerMode: playerMode("player_mode"),
  map: varchar("map", { length: 50 }),
  // Lineups declarados
  lineupA: jsonb("lineup_a").default([]), // player_registration_id[]
  lineupB: jsonb("lineup_b").default([]),
  // Civs sorteadas
  civsA: jsonb("civs_a").default([]), // civ_id[]
  civsB: jsonb("civs_b").default([]),
  // Resultado
  winnerTeamId: uuid("winner_team_id").references(() => teamRegistration.id),
  replayUrl: varchar("replay_url", { length: 500 }),
  // Timestamps
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueMatchGame: uniqueIndex("match_game_unique_match_number").on(t.matchId, t.gameNumber),
}));

// ============================================================
// SORTEO (commit-reveal fairness)
// ============================================================

/**
 * Sorteo de la ruleta para un match_game específico.
 */
export const rouletteDraw = pgTable("roulette_draw", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchGameId: uuid("match_game_id").notNull().references(() => matchGame.id, { onDelete: "cascade" }),
  adminId: uuid("admin_id").notNull().references(() => account.id),
  status: drawStatus("status").notNull().default("committed"),
  // Commit-reveal
  commitHash: varchar("commit_hash", { length: 80 }).notNull(),
  revealedSeed: varchar("revealed_seed", { length: 80 }),
  publicInputs: jsonb("public_inputs").notNull(),
  // Preset snapshot al sortear
  presetVersionId: uuid("preset_version_id").references(() => presetVersion.id),
  // Timestamps del ciclo commit-reveal
  committedAt: timestamp("committed_at", { withTimezone: true }).notNull().defaultNow(),
  spinningAt: timestamp("spinning_at", { withTimezone: true }),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  // Resultado (snapshot del DrawResult)
  result: jsonb("result"), // { gameMode, antimetaMode, playerMode, map, llaveFormat, civsA, civsB }
});

/**
 * Log inmutable append-only para auditoría.
 */
export const drawAuditLog = pgTable("draw_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  drawId: uuid("draw_id").notNull().references(() => rouletteDraw.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 30 }).notNull(), // commit | spin_start | spin_end | reveal | publish | cancel
  hashChain: varchar("hash_chain", { length: 80 }).notNull(),
  previousHash: varchar("previous_hash", { length: 80 }),
  actorAccountId: uuid("actor_account_id").notNull().references(() => account.id),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Sorteo inicial del bracket (asignación de seeds 1-32 a los equipos).
 * Usa commit-reveal igual que roulette_draw, pero para el sorteo de bracket completo.
 */
export const seedingDraw = pgTable("seeding_draw", {
  id: uuid("id").primaryKey().defaultRandom(),
  bracketId: uuid("bracket_id").notNull().references(() => bracket.id, { onDelete: "cascade" }),
  tournamentEditionId: uuid("tournament_edition_id").notNull().references(() => tournamentEdition.id),
  // Commit-reveal (fairness)
  commitHash: varchar("commit_hash", { length: 80 }).notNull(),
  revealedSeed: varchar("revealed_seed", { length: 80 }),
  publicInputs: jsonb("public_inputs").notNull(), // { teamIds: [...], bracketSize: 32 }
  // Resultado: array de { seed, teamId }
  result: jsonb("result"), // [{ seed: 1, teamRegistrationId: "..." }, ...]
  // Estado
  status: drawStatus("status").notNull().default("committed"),
  // Auditoría
  adminId: uuid("admin_id").notNull().references(() => account.id),
  committedAt: timestamp("committed_at", { withTimezone: true }).notNull().defaultNow(),
  spinningAt: timestamp("spinning_at", { withTimezone: true }),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
});

// ============================================================
// COMODINES
// ============================================================

/**
 * Inventario de comodines por equipo por edición.
 * Cantidades configurables desde admin (en tournament_edition).
 */
export const comodinInventory = pgTable("comodin_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamRegistrationId: uuid("team_registration_id").notNull().references(() => teamRegistration.id, { onDelete: "cascade" }),
  // Disponibles (decrecen al usar)
  rerollAvailable: integer("reroll_available").notNull().default(2),
  anularAvailable: integer("anular_available").notNull().default(1),
  elegirRivalAvailable: integer("elegir_rival_available").notNull().default(1),
  invocarProAvailable: integer("invocar_pro_available").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueTeamInventory: uniqueIndex("comodin_inv_unique_team").on(t.teamRegistrationId),
}));

/**
 * Registro de cada uso de comodín.
 */
export const comodinUsage = pgTable("comodin_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  comodinInventoryId: uuid("comodin_inventory_id").notNull().references(() => comodinInventory.id, { onDelete: "cascade" }),
  matchId: uuid("match_id").notNull().references(() => match.id, { onDelete: "cascade" }),
  matchGameId: uuid("match_game_id").references(() => matchGame.id, { onDelete: "set null" }),
  // Tipo
  comodinType: comodinType("comodin_type").notNull(),
  // Para reroll: qué fase re-girar
  targetPhase: varchar("target_phase", { length: 20 }), // MODO | ANTIMETA | FORMATO | MAPA | CIVS
  // Para anular/elegir_rival: jugador objetivo
  targetPlayerId: uuid("target_player_id").references(() => playerRegistration.id),
  // Estado
  status: comodinStatus("status").notNull().default("pending"),
  // Ejecución
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  executedByAccountId: uuid("executed_by_account_id").references(() => account.id), // el admin
  revokedByAccountId: uuid("revoked_by_account_id").references(() => account.id),
  // Resultado (qué cambió)
  resultPayload: jsonb("result_payload"),
  notes: text("notes"),
});

// ============================================================
// CASTERS
// ============================================================

export const caster = pgTable("caster", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => account.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  twitchChannel: varchar("twitch_channel", { length: 100 }),
  youtubeChannel: varchar("youtube_channel", { length: 100 }),
  kickChannel: varchar("kick_channel", { length: 100 }),
  tier: casterTier("tier").notNull().default("community"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedById: uuid("approved_by_id").references(() => account.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueCasterAccount: uniqueIndex("caster_unique_account").on(t.accountId),
}));

// ============================================================
// DISPUTAS
// ============================================================

export const dispute = pgTable("dispute", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id").notNull().references(() => match.id, { onDelete: "cascade" }),
  raisedByTeamId: uuid("raised_by_team_id").notNull().references(() => teamRegistration.id),
  reason: text("reason").notNull(),
  evidenceUrls: jsonb("evidence_urls").default([]), // string[]
  status: disputeStatus("status").notNull().default("open"),
  resolutionNotes: text("resolution_notes"),
  resolvedBySuperAdminId: uuid("resolved_by_super_admin_id").references(() => account.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// CONFIG ADICIONAL (clave-valor por edición)
// ============================================================

/**
 * Config extendida por edición (clave-valor JSON).
 * Para settings que no merecen columna propia.
 */
export const tournamentConfig = pgTable("tournament_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentEditionId: uuid("tournament_edition_id").notNull().references(() => tournamentEdition.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 60 }).notNull(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniqueConfig: uniqueIndex("tournament_config_unique").on(t.tournamentEditionId, t.key),
}));

// ============================================================
// RELACIONES
// ============================================================

export const accountRelations = relations(account, ({ many, one }) => ({
  teamAccounts: many(teamAccount),
  casts: many(caster),
}));

export const teamAccountRelations = relations(teamAccount, ({ many, one }) => ({
  owner: one(account, { fields: [teamAccount.ownerId], references: [account.id] }),
  emblem: one(emblem, { fields: [teamAccount.emblemId], references: [emblem.id] }),
  registrations: many(teamRegistration),
}));

export const tournamentEditionRelations = relations(tournamentEdition, ({ many, one }) => ({
  preset: one(presetVersion, { fields: [tournamentEdition.presetVersionId], references: [presetVersion.id] }),
  registrations: many(teamRegistration),
  brackets: many(bracket),
}));

export const teamRegistrationRelations = relations(teamRegistration, ({ many, one }) => ({
  teamAccount: one(teamAccount, { fields: [teamRegistration.teamAccountId], references: [teamAccount.id] }),
  tournament: one(tournamentEdition, { fields: [teamRegistration.tournamentEditionId], references: [tournamentEdition.id] }),
  players: many(playerRegistration),
  comodinInventory: many(comodinInventory),
}));

export const playerRegistrationRelations = relations(playerRegistration, ({ one }) => ({
  teamRegistration: one(teamRegistration, { fields: [playerRegistration.teamRegistrationId], references: [teamRegistration.id] }),
}));

export const bracketRelations = relations(bracket, ({ many, one }) => ({
  tournament: one(tournamentEdition, { fields: [bracket.tournamentEditionId], references: [tournamentEdition.id] }),
  rounds: many(round),
}));

export const roundRelations = relations(round, ({ many, one }) => ({
  bracket: one(bracket, { fields: [round.bracketId], references: [bracket.id] }),
  matches: many(match),
}));

export const matchRelations = relations(match, ({ many, one }) => ({
  round: one(round, { fields: [match.roundId], references: [round.id] }),
  teamA: one(teamRegistration, { fields: [match.teamAId], references: [teamRegistration.id], relationName: "teamA" }),
  teamB: one(teamRegistration, { fields: [match.teamBId], references: [teamRegistration.id], relationName: "teamB" }),
  winner: one(teamRegistration, { fields: [match.winnerTeamId], references: [teamRegistration.id], relationName: "winner" }),
  games: many(matchGame),
  draws: many(rouletteDraw),
  comodinUsages: many(comodinUsage),
  disputes: many(dispute),
}));

export const matchGameRelations = relations(matchGame, ({ one, many }) => ({
  match: one(match, { fields: [matchGame.matchId], references: [match.id] }),
  draw: one(rouletteDraw, { fields: [matchGame.drawId], references: [rouletteDraw.id] }),
}));

export const rouletteDrawRelations = relations(rouletteDraw, ({ many, one }) => ({
  matchGame: one(matchGame, { fields: [rouletteDraw.matchGameId], references: [matchGame.id] }),
  admin: one(account, { fields: [rouletteDraw.adminId], references: [account.id] }),
  auditLogs: many(drawAuditLog),
}));

export const drawAuditLogRelations = relations(drawAuditLog, ({ one }) => ({
  draw: one(rouletteDraw, { fields: [drawAuditLog.drawId], references: [rouletteDraw.id] }),
  actor: one(account, { fields: [drawAuditLog.actorAccountId], references: [account.id] }),
}));

export const seedingDrawRelations = relations(seedingDraw, ({ one }) => ({
  bracket: one(bracket, { fields: [seedingDraw.bracketId], references: [bracket.id] }),
  tournamentEdition: one(tournamentEdition, { fields: [seedingDraw.tournamentEditionId], references: [tournamentEdition.id] }),
  admin: one(account, { fields: [seedingDraw.adminId], references: [account.id] }),
}));

export const comodinInventoryRelations = relations(comodinInventory, ({ one, many }) => ({
  teamRegistration: one(teamRegistration, { fields: [comodinInventory.teamRegistrationId], references: [teamRegistration.id] }),
  usages: many(comodinUsage),
}));

export const comodinUsageRelations = relations(comodinUsage, ({ one }) => ({
  inventory: one(comodinInventory, { fields: [comodinUsage.comodinInventoryId], references: [comodinInventory.id] }),
  match: one(match, { fields: [comodinUsage.matchId], references: [match.id] }),
  matchGame: one(matchGame, { fields: [comodinUsage.matchGameId], references: [matchGame.id] }),
  targetPlayer: one(playerRegistration, { fields: [comodinUsage.targetPlayerId], references: [playerRegistration.id] }),
}));

export const casterRelations = relations(caster, ({ one, many }) => ({
  account: one(account, { fields: [caster.accountId], references: [account.id] }),
  matches: many(match),
}));

export const disputeRelations = relations(dispute, ({ one }) => ({
  match: one(match, { fields: [dispute.matchId], references: [match.id] }),
  raisedByTeam: one(teamRegistration, { fields: [dispute.raisedByTeamId], references: [teamRegistration.id] }),
}));
