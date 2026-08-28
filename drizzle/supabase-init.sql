-- ============================================================
-- VÉRTIGO Cup — Schema completo de Supabase (IDEMPOTENTE)
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- Este script puede ejecutarse múltiples veces sin romperse.
-- ============================================================

-- ============================================================
-- 1. ENUMS (con DROP IF EXISTS para que sea idempotente)
-- ============================================================

DROP TYPE IF EXISTS account_role CASCADE;
DROP TYPE IF EXISTS bet_status CASCADE;
DROP TYPE IF EXISTS bracket_type CASCADE;
DROP TYPE IF EXISTS caster_tier CASCADE;
DROP TYPE IF EXISTS comodin_status CASCADE;
DROP TYPE IF EXISTS comodin_type CASCADE;
DROP TYPE IF EXISTS dispute_status CASCADE;
DROP TYPE IF EXISTS draw_status CASCADE;
DROP TYPE IF EXISTS elo_verification CASCADE;
DROP TYPE IF EXISTS game_status CASCADE;
DROP TYPE IF EXISTS match_format CASCADE;
DROP TYPE IF EXISTS match_status CASCADE;
DROP TYPE IF EXISTS player_mode CASCADE;
DROP TYPE IF EXISTS registration_status CASCADE;
DROP TYPE IF EXISTS tournament_status CASCADE;

CREATE TYPE account_role AS ENUM('owner', 'player', 'admin', 'super_admin', 'caster', 'spectator');
CREATE TYPE bet_status AS ENUM('pending', 'won', 'lost', 'voided');
CREATE TYPE bracket_type AS ENUM('winner', 'consolation');
CREATE TYPE caster_tier AS ENUM('official', 'secondary', 'community');
CREATE TYPE comodin_status AS ENUM('pending', 'executing', 'executed', 'cancelled', 'revoked');
CREATE TYPE comodin_type AS ENUM('reroll', 'anular', 'elegir_rival', 'invocar_pro');
CREATE TYPE dispute_status AS ENUM('open', 'reviewing', 'resolved', 'rejected');
CREATE TYPE draw_status AS ENUM('committed', 'spinning', 'revealed', 'published', 'cancelled');
CREATE TYPE elo_verification AS ENUM('verified', 'pending', 'hidden', 'failed');
CREATE TYPE game_status AS ENUM('pending', 'drawing', 'lineup', 'comodin_window', 'in_progress', 'finished');
CREATE TYPE match_format AS ENUM('BO3', 'BO1');
CREATE TYPE match_status AS ENUM('scheduled', 'open', 'drawing', 'lineup', 'comodin_window', 'in_progress', 'finished', 'disputed', 'forfeit', 'cancelled');
CREATE TYPE player_mode AS ENUM('1v1', '2v2', '3v3', 'fusion');
CREATE TYPE registration_status AS ENUM('pending', 'approved', 'rejected');
CREATE TYPE tournament_status AS ENUM('draft', 'registration', 'active', 'finished');

-- ============================================================
-- 2. TABLAS (DROP IF EXISTS primero)
-- ============================================================

-- Drop en orden inverso para no romper foreign keys
DROP TABLE IF EXISTS bet CASCADE;
DROP TABLE IF EXISTS spectator_wallet CASCADE;
DROP TABLE IF EXISTS dispute CASCADE;
DROP TABLE IF EXISTS comodin_usage CASCADE;
DROP TABLE IF EXISTS comodin_inventory CASCADE;
DROP TABLE IF EXISTS draw_audit_log CASCADE;
DROP TABLE IF EXISTS roulette_draw CASCADE;
DROP TABLE IF EXISTS match_game CASCADE;
DROP TABLE IF EXISTS "match" CASCADE;
DROP TABLE IF EXISTS round CASCADE;
DROP TABLE IF EXISTS bracket CASCADE;
DROP TABLE IF EXISTS player_registration CASCADE;
DROP TABLE IF EXISTS team_registration CASCADE;
DROP TABLE IF EXISTS tournament_config CASCADE;
DROP TABLE IF EXISTS tournament_edition CASCADE;
DROP TABLE IF EXISTS preset_version CASCADE;
DROP TABLE IF EXISTS caster CASCADE;
DROP TABLE IF EXISTS emblem CASCADE;
DROP TABLE IF EXISTS team_account CASCADE;
DROP TABLE IF EXISTS account CASCADE;

-- Crear tablas
CREATE TABLE account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  supabase_auth_id uuid NOT NULL,
  email varchar(255) NOT NULL,
  role account_role DEFAULT 'owner' NOT NULL,
  display_name varchar(100),
  avatar_key varchar(50),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT account_supabase_auth_id_unique UNIQUE(supabase_auth_id),
  CONSTRAINT account_email_unique UNIQUE(email)
);

CREATE TABLE emblem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name varchar(60) NOT NULL,
  image_url varchar(500) NOT NULL,
  category varchar(30),
  is_active boolean DEFAULT true NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE preset_version (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  version integer NOT NULL,
  frozen_at timestamptz,
  is_frozen boolean DEFAULT false NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE team_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  owner_id uuid NOT NULL,
  name varchar(60) NOT NULL,
  tagline varchar(140),
  emblem_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE tournament_edition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  slug varchar(80) NOT NULL,
  name varchar(120) NOT NULL,
  description text,
  banner_url varchar(500),
  status tournament_status DEFAULT 'draft' NOT NULL,
  elo_cap integer DEFAULT 3500 NOT NULL,
  elo_tolerance integer DEFAULT 20 NOT NULL,
  elo_field varchar(50) DEFAULT 'rm_1v1_max' NOT NULL,
  team_size integer DEFAULT 3 NOT NULL,
  max_teams integer DEFAULT 32 NOT NULL,
  civs_base integer DEFAULT 9 NOT NULL,
  civs_extra_finalist integer DEFAULT 3 NOT NULL,
  comodin_reroll integer DEFAULT 2 NOT NULL,
  comodin_anular integer DEFAULT 1 NOT NULL,
  comodin_elegir_rival integer DEFAULT 1 NOT NULL,
  comodin_invocar_pro integer DEFAULT 1 NOT NULL,
  comodin_window_minutes integer DEFAULT 5 NOT NULL,
  invocar_pro_minutes integer DEFAULT 5 NOT NULL,
  commit_reveal_enabled boolean DEFAULT true NOT NULL,
  draw_timeout_minutes integer DEFAULT 5 NOT NULL,
  twitch_channel varchar(100),
  youtube_channel varchar(100),
  kick_channel varchar(100),
  handbook_url varchar(500),
  handbook_uploaded_at timestamptz,
  terms_text text,
  restream_required boolean DEFAULT true NOT NULL,
  preset_version_id uuid,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT tournament_edition_slug_unique UNIQUE(slug)
);

CREATE TABLE team_registration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  team_account_id uuid NOT NULL,
  tournament_edition_id uuid NOT NULL,
  base_civ_ids jsonb NOT NULL,
  extra_civ_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  elo_freeze_snapshot integer,
  elo_verification_status elo_verification DEFAULT 'pending' NOT NULL,
  elo_verification_reason text,
  status registration_status DEFAULT 'pending' NOT NULL,
  seed integer,
  restream_accepted boolean DEFAULT false NOT NULL,
  handbook_downloaded_at timestamptz,
  terms_accepted_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX team_reg_unique_team_edition ON team_registration(team_account_id, tournament_edition_id);

CREATE TABLE player_registration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  team_registration_id uuid NOT NULL,
  aoe2_profile_id integer NOT NULL,
  aoe2_steam_id varchar(30),
  display_name varchar(100) NOT NULL,
  country varchar(2),
  clan varchar(30),
  platform varchar(20),
  is_verified boolean DEFAULT false NOT NULL,
  max_rating_rm_1v1 integer,
  rating_rm_1v1_current integer,
  rating_rm_1v1_rank integer,
  is_captain boolean DEFAULT false NOT NULL,
  linked_profiles jsonb DEFAULT '[]'::jsonb,
  verification_payload jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX player_reg_unique_aoe2 ON player_registration(team_registration_id, aoe2_profile_id);

CREATE TABLE bracket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tournament_edition_id uuid NOT NULL,
  type bracket_type DEFAULT 'winner' NOT NULL,
  rounds_count integer DEFAULT 5 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE round (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  bracket_id uuid NOT NULL,
  index integer NOT NULL,
  name varchar(40) NOT NULL
);

CREATE TABLE caster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  display_name varchar(100) NOT NULL,
  twitch_channel varchar(100),
  youtube_channel varchar(100),
  kick_channel varchar(100),
  tier caster_tier DEFAULT 'community' NOT NULL,
  featured boolean DEFAULT false NOT NULL,
  approved_at timestamptz,
  approved_by_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX caster_unique_account ON caster(account_id);

CREATE TABLE "match" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  round_id uuid NOT NULL,
  slot_index integer NOT NULL,
  parent_match_a_id uuid,
  parent_match_b_id uuid,
  team_a_id uuid,
  team_b_id uuid,
  status match_status DEFAULT 'scheduled' NOT NULL,
  scheduled_at_start timestamptz,
  scheduled_at_end timestamptz,
  jornada_label varchar(60),
  ready_a_at timestamptz,
  ready_b_at timestamptz,
  ready_lineup_a_at timestamptz,
  ready_lineup_b_at timestamptz,
  format match_format,
  winner_team_id uuid,
  score_a integer DEFAULT 0 NOT NULL,
  score_b integer DEFAULT 0 NOT NULL,
  stream_caster_id uuid,
  stream_embed_enabled boolean DEFAULT false NOT NULL,
  anular_used_by_team_id uuid,
  elegir_rival_used_by_team_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  finished_at timestamptz
);

CREATE TABLE match_game (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  match_id uuid NOT NULL,
  game_number integer NOT NULL,
  status game_status DEFAULT 'pending' NOT NULL,
  draw_id uuid,
  game_mode varchar(50),
  antimeta_mode varchar(50),
  player_mode player_mode,
  map varchar(50),
  lineup_a jsonb DEFAULT '[]'::jsonb,
  lineup_b jsonb DEFAULT '[]'::jsonb,
  civs_a jsonb DEFAULT '[]'::jsonb,
  civs_b jsonb DEFAULT '[]'::jsonb,
  winner_team_id uuid,
  replay_url varchar(500),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX match_game_unique_match_number ON match_game(match_id, game_number);

CREATE TABLE roulette_draw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  match_game_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  status draw_status DEFAULT 'committed' NOT NULL,
  commit_hash varchar(80) NOT NULL,
  revealed_seed varchar(80),
  public_inputs jsonb NOT NULL,
  preset_version_id uuid,
  committed_at timestamptz DEFAULT now() NOT NULL,
  spinning_at timestamptz,
  revealed_at timestamptz,
  published_at timestamptz,
  cancelled_at timestamptz,
  result jsonb
);

CREATE TABLE draw_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  draw_id uuid NOT NULL,
  event_type varchar(30) NOT NULL,
  hash_chain varchar(80) NOT NULL,
  previous_hash varchar(80),
  actor_account_id uuid NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE comodin_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  team_registration_id uuid NOT NULL,
  reroll_available integer DEFAULT 2 NOT NULL,
  anular_available integer DEFAULT 1 NOT NULL,
  elegir_rival_available integer DEFAULT 1 NOT NULL,
  invocar_pro_available integer DEFAULT 1 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX comodin_inv_unique_team ON comodin_inventory(team_registration_id);

CREATE TABLE comodin_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  comodin_inventory_id uuid NOT NULL,
  match_id uuid NOT NULL,
  match_game_id uuid,
  comodin_type comodin_type NOT NULL,
  target_phase varchar(20),
  target_player_id uuid,
  status comodin_status DEFAULT 'pending' NOT NULL,
  requested_at timestamptz DEFAULT now() NOT NULL,
  executed_at timestamptz,
  revoked_at timestamptz,
  executed_by_account_id uuid,
  revoked_by_account_id uuid,
  result_payload jsonb,
  notes text
);

CREATE TABLE dispute (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  match_id uuid NOT NULL,
  raised_by_team_id uuid NOT NULL,
  reason text NOT NULL,
  evidence_urls jsonb DEFAULT '[]'::jsonb,
  status dispute_status DEFAULT 'open' NOT NULL,
  resolution_notes text,
  resolved_by_super_admin_id uuid,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE spectator_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  account_id uuid NOT NULL,
  balance integer DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT spectator_wallet_account_id_unique UNIQUE(account_id),
  CONSTRAINT spectator_wallet_balance_nonnegative CHECK (balance >= 0)
);

CREATE TABLE bet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  spectator_account_id uuid NOT NULL,
  match_id uuid NOT NULL,
  picked_team_id uuid NOT NULL,
  stake integer NOT NULL,
  status bet_status DEFAULT 'pending' NOT NULL,
  payout integer DEFAULT 0 NOT NULL,
  placed_at timestamptz DEFAULT now() NOT NULL,
  settled_at timestamptz,
  CONSTRAINT bet_stake_positive CHECK (stake > 0),
  CONSTRAINT bet_payout_nonnegative CHECK (payout >= 0)
);
CREATE UNIQUE INDEX bet_unique_spectator_match ON bet(spectator_account_id, match_id);
CREATE INDEX bet_match_idx ON bet(match_id);
CREATE INDEX bet_status_idx ON bet(status);

CREATE TABLE tournament_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tournament_edition_id uuid NOT NULL,
  key varchar(60) NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX tournament_config_unique ON tournament_config(tournament_edition_id, key);

-- ============================================================
-- 3. FOREIGN KEYS
-- ============================================================

ALTER TABLE team_account ADD CONSTRAINT team_account_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES account(id) ON DELETE RESTRICT;
ALTER TABLE team_account ADD CONSTRAINT team_account_emblem_id_fkey
  FOREIGN KEY (emblem_id) REFERENCES emblem(id) ON DELETE SET NULL;

ALTER TABLE tournament_edition ADD CONSTRAINT tournament_edition_preset_version_id_fkey
  FOREIGN KEY (preset_version_id) REFERENCES preset_version(id) ON DELETE SET NULL;

ALTER TABLE team_registration ADD CONSTRAINT team_reg_team_account_fkey
  FOREIGN KEY (team_account_id) REFERENCES team_account(id) ON DELETE CASCADE;
ALTER TABLE team_registration ADD CONSTRAINT team_reg_tournament_fkey
  FOREIGN KEY (tournament_edition_id) REFERENCES tournament_edition(id) ON DELETE CASCADE;
ALTER TABLE team_registration ADD CONSTRAINT team_reg_approved_by_fkey
  FOREIGN KEY (approved_by_id) REFERENCES account(id) ON DELETE SET NULL;

ALTER TABLE player_registration ADD CONSTRAINT player_reg_team_reg_fkey
  FOREIGN KEY (team_registration_id) REFERENCES team_registration(id) ON DELETE CASCADE;

ALTER TABLE bracket ADD CONSTRAINT bracket_tournament_fkey
  FOREIGN KEY (tournament_edition_id) REFERENCES tournament_edition(id) ON DELETE CASCADE;

ALTER TABLE round ADD CONSTRAINT round_bracket_fkey
  FOREIGN KEY (bracket_id) REFERENCES bracket(id) ON DELETE CASCADE;

ALTER TABLE caster ADD CONSTRAINT caster_account_fkey
  FOREIGN KEY (account_id) REFERENCES account(id) ON DELETE CASCADE;
ALTER TABLE caster ADD CONSTRAINT caster_approved_by_fkey
  FOREIGN KEY (approved_by_id) REFERENCES account(id) ON DELETE SET NULL;

ALTER TABLE "match" ADD CONSTRAINT match_round_fkey
  FOREIGN KEY (round_id) REFERENCES round(id) ON DELETE CASCADE;
ALTER TABLE "match" ADD CONSTRAINT match_team_a_fkey
  FOREIGN KEY (team_a_id) REFERENCES team_registration(id) ON DELETE SET NULL;
ALTER TABLE "match" ADD CONSTRAINT match_team_b_fkey
  FOREIGN KEY (team_b_id) REFERENCES team_registration(id) ON DELETE SET NULL;
ALTER TABLE "match" ADD CONSTRAINT match_winner_fkey
  FOREIGN KEY (winner_team_id) REFERENCES team_registration(id) ON DELETE SET NULL;
ALTER TABLE "match" ADD CONSTRAINT match_caster_fkey
  FOREIGN KEY (stream_caster_id) REFERENCES caster(id) ON DELETE SET NULL;

ALTER TABLE match_game ADD CONSTRAINT match_game_match_fkey
  FOREIGN KEY (match_id) REFERENCES "match"(id) ON DELETE CASCADE;
ALTER TABLE match_game ADD CONSTRAINT match_game_winner_fkey
  FOREIGN KEY (winner_team_id) REFERENCES team_registration(id) ON DELETE SET NULL;

ALTER TABLE roulette_draw ADD CONSTRAINT draw_match_game_fkey
  FOREIGN KEY (match_game_id) REFERENCES match_game(id) ON DELETE CASCADE;
ALTER TABLE roulette_draw ADD CONSTRAINT draw_admin_fkey
  FOREIGN KEY (admin_id) REFERENCES account(id) ON DELETE RESTRICT;
ALTER TABLE roulette_draw ADD CONSTRAINT draw_preset_fkey
  FOREIGN KEY (preset_version_id) REFERENCES preset_version(id) ON DELETE SET NULL;

ALTER TABLE draw_audit_log ADD CONSTRAINT log_draw_fkey
  FOREIGN KEY (draw_id) REFERENCES roulette_draw(id) ON DELETE CASCADE;
ALTER TABLE draw_audit_log ADD CONSTRAINT log_actor_fkey
  FOREIGN KEY (actor_account_id) REFERENCES account(id) ON DELETE RESTRICT;

ALTER TABLE comodin_inventory ADD CONSTRAINT comodin_inv_team_fkey
  FOREIGN KEY (team_registration_id) REFERENCES team_registration(id) ON DELETE CASCADE;

ALTER TABLE comodin_usage ADD CONSTRAINT comodin_use_inv_fkey
  FOREIGN KEY (comodin_inventory_id) REFERENCES comodin_inventory(id) ON DELETE CASCADE;
ALTER TABLE comodin_usage ADD CONSTRAINT comodin_use_match_fkey
  FOREIGN KEY (match_id) REFERENCES "match"(id) ON DELETE CASCADE;
ALTER TABLE comodin_usage ADD CONSTRAINT comodin_use_match_game_fkey
  FOREIGN KEY (match_game_id) REFERENCES match_game(id) ON DELETE SET NULL;
ALTER TABLE comodin_usage ADD CONSTRAINT comodin_use_target_player_fkey
  FOREIGN KEY (target_player_id) REFERENCES player_registration(id) ON DELETE SET NULL;
ALTER TABLE comodin_usage ADD CONSTRAINT comodin_use_executed_by_fkey
  FOREIGN KEY (executed_by_account_id) REFERENCES account(id) ON DELETE SET NULL;
ALTER TABLE comodin_usage ADD CONSTRAINT comodin_use_revoked_by_fkey
  FOREIGN KEY (revoked_by_account_id) REFERENCES account(id) ON DELETE SET NULL;

ALTER TABLE dispute ADD CONSTRAINT dispute_match_fkey
  FOREIGN KEY (match_id) REFERENCES "match"(id) ON DELETE CASCADE;
ALTER TABLE dispute ADD CONSTRAINT dispute_team_fkey
  FOREIGN KEY (raised_by_team_id) REFERENCES team_registration(id) ON DELETE CASCADE;
ALTER TABLE dispute ADD CONSTRAINT dispute_resolver_fkey
  FOREIGN KEY (resolved_by_super_admin_id) REFERENCES account(id) ON DELETE SET NULL;

ALTER TABLE spectator_wallet ADD CONSTRAINT spectator_wallet_account_fkey
  FOREIGN KEY (account_id) REFERENCES account(id) ON DELETE CASCADE;

ALTER TABLE bet ADD CONSTRAINT bet_spectator_fkey
  FOREIGN KEY (spectator_account_id) REFERENCES account(id) ON DELETE CASCADE;
ALTER TABLE bet ADD CONSTRAINT bet_match_fkey
  FOREIGN KEY (match_id) REFERENCES "match"(id) ON DELETE CASCADE;
ALTER TABLE bet ADD CONSTRAINT bet_picked_team_fkey
  FOREIGN KEY (picked_team_id) REFERENCES team_registration(id) ON DELETE CASCADE;

ALTER TABLE tournament_config ADD CONSTRAINT tournament_config_edition_fkey
  FOREIGN KEY (tournament_edition_id) REFERENCES tournament_edition(id) ON DELETE CASCADE;

-- ============================================================
-- 4. TRIGGERS (updated_at automático)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS account_updated ON account;
CREATE TRIGGER account_updated BEFORE UPDATE ON account FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS team_account_updated ON team_account;
CREATE TRIGGER team_account_updated BEFORE UPDATE ON team_account FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tournament_edition_updated ON tournament_edition;
CREATE TRIGGER tournament_edition_updated BEFORE UPDATE ON tournament_edition FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS team_registration_updated ON team_registration;
CREATE TRIGGER team_registration_updated BEFORE UPDATE ON team_registration FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS player_registration_updated ON player_registration;
CREATE TRIGGER player_registration_updated BEFORE UPDATE ON player_registration FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS match_updated ON "match";
CREATE TRIGGER match_updated BEFORE UPDATE ON "match" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS match_game_updated ON match_game;
CREATE TRIGGER match_game_updated BEFORE UPDATE ON match_game FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS caster_updated ON caster;
CREATE TRIGGER caster_updated BEFORE UPDATE ON caster FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS comodin_inventory_updated ON comodin_inventory;
CREATE TRIGGER comodin_inventory_updated BEFORE UPDATE ON comodin_inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS dispute_updated ON dispute;
CREATE TRIGGER dispute_updated BEFORE UPDATE ON dispute FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS spectator_wallet_updated ON spectator_wallet;
CREATE TRIGGER spectator_wallet_updated BEFORE UPDATE ON spectator_wallet FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS tournament_config_updated ON tournament_config;
CREATE TRIGGER tournament_config_updated BEFORE UPDATE ON tournament_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 5. STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('handbook', 'handbook', false),
  ('emblems', 'emblems', true),
  ('disputes', 'disputes', false),
  ('avatars', 'avatars', true),
  ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. RLS (Row-Level Security)
-- ============================================================

ALTER TABLE account ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_edition ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_registration ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket ENABLE ROW LEVEL SECURITY;
ALTER TABLE round ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match" ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_game ENABLE ROW LEVEL SECURITY;
ALTER TABLE roulette_draw ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE comodin_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE comodin_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE caster ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute ENABLE ROW LEVEL SECURITY;
ALTER TABLE spectator_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE emblem ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_version ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account
    WHERE supabase_auth_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account
    WHERE supabase_auth_id = auth.uid()
    AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION current_account_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM account WHERE supabase_auth_id = auth.uid();
$$;

-- Borrar todas las policies existentes y recrear
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename, schemaname FROM pg_policies WHERE schemaname = 'public' OR schemaname = 'storage') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Tournament edition
CREATE POLICY "Tournament edition: lectura pública"
  ON tournament_edition FOR SELECT TO anon, authenticated
  USING (status IN ('registration', 'active', 'finished'));
CREATE POLICY "Tournament edition: escritura solo admin"
  ON tournament_edition FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Bracket / Round / Match / MatchGame
CREATE POLICY "Bracket: lectura pública" ON bracket FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Round: lectura pública" ON round FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Match: lectura pública" ON "match" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "MatchGame: lectura pública" ON match_game FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "RouletteDraw: lectura pública cuando revealed/published"
  ON roulette_draw FOR SELECT TO anon, authenticated
  USING (status IN ('revealed', 'published'));
CREATE POLICY "DrawAuditLog: lectura pública"
  ON draw_audit_log FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Bracket: escritura admin" ON bracket FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Round: escritura admin" ON round FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Match: escritura admin" ON "match" FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "MatchGame: escritura admin" ON match_game FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "RouletteDraw: escritura admin" ON roulette_draw FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "DrawAuditLog: append-only admin" ON draw_audit_log FOR INSERT TO authenticated WITH CHECK (is_admin());

-- Emblem
CREATE POLICY "Emblem: lectura pública" ON emblem FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Emblem: escritura admin" ON emblem FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Preset
CREATE POLICY "PresetVersion: lectura pública" ON preset_version FOR SELECT TO anon, authenticated USING (is_frozen = true);
CREATE POLICY "PresetVersion: escritura admin" ON preset_version FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Account
CREATE POLICY "Account: lectura propia o admin"
  ON account FOR SELECT TO authenticated
  USING (supabase_auth_id = auth.uid() OR is_admin());
-- Hardening: fija el role en el WITH CHECK para que un usuario no pueda
-- cambiarse su propio role (p. ej. a admin) vía API directa. Los cambios
-- de rol legítimos usan service role, que bypasea RLS.
CREATE POLICY "Account: escritura propia"
  ON account FOR UPDATE TO authenticated
  USING (supabase_auth_id = auth.uid())
  WITH CHECK (
    supabase_auth_id = auth.uid()
    AND role = (SELECT a.role FROM public.account a WHERE a.supabase_auth_id = auth.uid())
  );
CREATE POLICY "Account: insert propia"
  ON account FOR INSERT TO authenticated
  WITH CHECK (supabase_auth_id = auth.uid());

-- Team account
CREATE POLICY "TeamAccount: lectura pública" ON team_account FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "TeamAccount: insert dueño" ON team_account FOR INSERT TO authenticated
  WITH CHECK (owner_id = current_account_id());
CREATE POLICY "TeamAccount: update dueño" ON team_account FOR UPDATE TO authenticated
  USING (owner_id = current_account_id())
  WITH CHECK (owner_id = current_account_id());

-- Team registration
CREATE POLICY "TeamReg: lectura dueño o admin"
  ON team_registration FOR SELECT TO authenticated
  USING (
    team_account_id IN (SELECT id FROM team_account WHERE owner_id = current_account_id())
    OR is_admin()
  );
CREATE POLICY "TeamReg: insert dueño"
  ON team_registration FOR INSERT TO authenticated
  WITH CHECK (
    team_account_id IN (SELECT id FROM team_account WHERE owner_id = current_account_id())
  );
CREATE POLICY "TeamReg: update dueño o admin"
  ON team_registration FOR UPDATE TO authenticated
  USING (
    team_account_id IN (SELECT id FROM team_account WHERE owner_id = current_account_id())
    OR is_admin()
  );

-- Player registration
CREATE POLICY "PlayerReg: lectura dueño o admin"
  ON player_registration FOR SELECT TO authenticated
  USING (
    team_registration_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
    OR is_admin()
  );
CREATE POLICY "PlayerReg: insert dueño"
  ON player_registration FOR INSERT TO authenticated
  WITH CHECK (
    team_registration_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
  );
CREATE POLICY "PlayerReg: update dueño o admin"
  ON player_registration FOR UPDATE TO authenticated
  USING (
    team_registration_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
    OR is_admin()
  );

-- Comodin inventory
CREATE POLICY "ComodinInv: lectura dueño o admin"
  ON comodin_inventory FOR SELECT TO authenticated
  USING (
    team_registration_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
    OR is_admin()
  );
CREATE POLICY "ComodinInv: update dueño o admin"
  ON comodin_inventory FOR UPDATE TO authenticated
  USING (
    team_registration_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
    OR is_admin()
  );

-- Comodin usage
CREATE POLICY "ComodinUse: lectura dueño o admin"
  ON comodin_usage FOR SELECT TO authenticated
  USING (
    comodin_inventory_id IN (
      SELECT ci.id FROM comodin_inventory ci
      JOIN team_registration tr ON ci.team_registration_id = tr.id
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
    OR is_admin()
  );
CREATE POLICY "ComodinUse: insert dueño"
  ON comodin_usage FOR INSERT TO authenticated
  WITH CHECK (
    comodin_inventory_id IN (
      SELECT ci.id FROM comodin_inventory ci
      JOIN team_registration tr ON ci.team_registration_id = tr.id
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
  );
CREATE POLICY "ComodinUse: update admin"
  ON comodin_usage FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Caster
CREATE POLICY "Caster: lectura pública" ON caster FOR SELECT TO anon, authenticated USING (approved_at IS NOT NULL);
CREATE POLICY "Caster: insert propia" ON caster FOR INSERT TO authenticated
  WITH CHECK (account_id = current_account_id());
CREATE POLICY "Caster: update admin o propia" ON caster FOR UPDATE TO authenticated
  USING (is_admin() OR account_id = current_account_id())
  WITH CHECK (is_admin() OR account_id = current_account_id());

-- Spectator wallet (solo lectura propia/admin; escritura exclusivamente
-- vía triggers SECURITY DEFINER / service role)
CREATE POLICY "SpectatorWallet: lectura propia o admin"
  ON spectator_wallet FOR SELECT TO authenticated
  USING (account_id = current_account_id() OR is_admin());

-- Bets: lectura propia o admin; las sumas públicas (cuotas) se calculan
-- server-side con service role, no se exponen filas ajenas
CREATE POLICY "Bet: lectura propia o admin"
  ON bet FOR SELECT TO authenticated
  USING (spectator_account_id = current_account_id() OR is_admin());
CREATE POLICY "Bet: insert propia"
  ON bet FOR INSERT TO authenticated
  WITH CHECK (spectator_account_id = current_account_id());
CREATE POLICY "Bet: delete propia pendiente"
  ON bet FOR DELETE TO authenticated
  USING (spectator_account_id = current_account_id() AND status = 'pending');

-- Dispute
CREATE POLICY "Dispute: lectura dueño o admin"
  ON dispute FOR SELECT TO authenticated
  USING (
    raised_by_team_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
    OR is_admin()
  );
CREATE POLICY "Dispute: insert dueño"
  ON dispute FOR INSERT TO authenticated
  WITH CHECK (
    raised_by_team_id IN (
      SELECT tr.id FROM team_registration tr
      JOIN team_account ta ON tr.team_account_id = ta.id
      WHERE ta.owner_id = current_account_id()
    )
  );
CREATE POLICY "Dispute: update admin"
  ON dispute FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Tournament config
CREATE POLICY "TournamentConfig: lectura admin" ON tournament_config FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "TournamentConfig: escritura admin"
  ON tournament_config FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 7. STORAGE POLICIES
-- ============================================================

-- Handbook (solo admin)
CREATE POLICY "Handbook bucket: lectura admin"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'handbook' AND is_admin());
CREATE POLICY "Handbook bucket: insert admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'handbook' AND is_admin());
CREATE POLICY "Handbook bucket: update admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'handbook' AND is_admin())
  WITH CHECK (bucket_id = 'handbook' AND is_admin());
CREATE POLICY "Handbook bucket: delete admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'handbook' AND is_admin());

-- Emblems (lectura pública, escritura admin)
CREATE POLICY "Emblems bucket: lectura pública"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'emblems');
CREATE POLICY "Emblems bucket: insert admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'emblems' AND is_admin());
CREATE POLICY "Emblems bucket: update admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'emblems' AND is_admin())
  WITH CHECK (bucket_id = 'emblems' AND is_admin());
CREATE POLICY "Emblems bucket: delete admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'emblems' AND is_admin());

-- Avatars (lectura pública)
CREATE POLICY "Avatars bucket: lectura pública"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

-- Disputes (admin + dueño del equipo)
CREATE POLICY "Disputes bucket: lectura admin o dueño"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'disputes' AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM dispute d
        JOIN team_registration tr ON d.raised_by_team_id = tr.id
        JOIN team_account ta ON tr.team_account_id = ta.id
        WHERE ta.owner_id = current_account_id()
      )
    )
  );
CREATE POLICY "Disputes bucket: insert autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'disputes');

-- ============================================================
-- 8. SEED: edición por defecto + emblemas
-- ============================================================

INSERT INTO tournament_edition (
  slug, name, description, status,
  elo_cap, elo_tolerance, elo_field,
  team_size, max_teams,
  civs_base, civs_extra_finalist,
  comodin_reroll, comodin_anular, comodin_elegir_rival, comodin_invocar_pro,
  comodin_window_minutes, invocar_pro_minutes,
  commit_reveal_enabled, draw_timeout_minutes,
  restream_required
) VALUES (
  'vertigo-2026-1',
  'VÉRTIGO Cup 2026 - Edición 1',
  'Primera edición del torneo VÉRTIGO. 32 equipos, single elimination, sorteos con ruleta 15 minutos antes de cada partida.',
  'draft',
  3500, 20, 'rm_1v1_max',
  3, 32,
  9, 3,
  2, 1, 1, 1,
  5, 5,
  true, 5,
  true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO emblem (name, image_url, category, sort_order)
VALUES
  ('Caballero', '/emblems/placeholder.svg', 'generic', 1),
  ('Águila', '/emblems/placeholder.svg', 'generic', 2),
  ('Dragón', '/emblems/placeholder.svg', 'generic', 3),
  ('León', '/emblems/placeholder.svg', 'generic', 4),
  ('Lobo', '/emblems/placeholder.svg', 'generic', 5),
  ('Cuervo', '/emblems/placeholder.svg', 'generic', 6),
  ('Oso', '/emblems/placeholder.svg', 'generic', 7),
  ('Halcón', '/emblems/placeholder.svg', 'generic', 8),
  ('Serpiente', '/emblems/placeholder.svg', 'generic', 9),
  ('Toro', '/emblems/placeholder.svg', 'generic', 10),
  ('Unicornio', '/emblems/placeholder.svg', 'generic', 11),
  ('Fénix', '/emblems/placeholder.svg', 'generic', 12)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. TRIGGER: crear account automáticamente al registrarse en auth
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO account (supabase_auth_id, email, role)
  VALUES (NEW.id, NEW.email, 'owner')
  ON CONFLICT (supabase_auth_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 10. TRIGGER: crear comodin_inventory al insertar team_registration
-- ============================================================

CREATE OR REPLACE FUNCTION create_comodin_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edition_id uuid;
  reroll_count integer;
  anular_count integer;
  elegir_count integer;
  pro_count integer;
BEGIN
  SELECT tournament_edition_id INTO edition_id FROM team_registration WHERE id = NEW.id;
  IF edition_id IS NULL THEN RETURN NEW; END IF;

  SELECT comodin_reroll, comodin_anular, comodin_elegir_rival, comodin_invocar_pro
  INTO reroll_count, anular_count, elegir_count, pro_count
  FROM tournament_edition WHERE id = edition_id;

  INSERT INTO comodin_inventory (team_registration_id, reroll_available, anular_available, elegir_rival_available, invocar_pro_available)
  VALUES (NEW.id, reroll_count, anular_count, elegir_count, pro_count)
  ON CONFLICT (team_registration_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_team_registration_created ON team_registration;
CREATE TRIGGER on_team_registration_created
  AFTER INSERT ON team_registration
  FOR EACH ROW EXECUTE FUNCTION create_comodin_inventory();

-- ============================================================
-- 11. TRIGGERS: espectadores y apuestas (pari-mutuel)
-- ============================================================

-- Wallet de 1000 puntos al adquirir el rol spectator.
-- Cubre INSERT (cuenta creada ya como spectator) y UPDATE
-- (cuenta owner existente promovida a spectator por el servidor).
CREATE OR REPLACE FUNCTION grant_spectator_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'spectator'
     AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'spectator') THEN
    INSERT INTO spectator_wallet (account_id, balance)
    VALUES (NEW.id, 1000)
    ON CONFLICT (account_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_account_spectator_wallet ON account;
CREATE TRIGGER on_account_spectator_wallet
  AFTER INSERT OR UPDATE ON account
  FOR EACH ROW EXECUTE FUNCTION grant_spectator_wallet();

-- Débito del stake al colocar la apuesta.
-- El CHECK balance >= 0 aborta la transacción si no alcanza.
CREATE OR REPLACE FUNCTION debit_bet_stake()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE spectator_wallet
  SET balance = balance - NEW.stake, updated_at = now()
  WHERE account_id = NEW.spectator_account_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_bet_placed ON bet;
CREATE TRIGGER on_bet_placed
  AFTER INSERT ON bet
  FOR EACH ROW EXECUTE FUNCTION debit_bet_stake();

-- Reintegro al cancelar (delete) una apuesta todavía pendiente.
CREATE OR REPLACE FUNCTION refund_bet_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = 'pending' THEN
    UPDATE spectator_wallet
    SET balance = balance + OLD.stake, updated_at = now()
    WHERE account_id = OLD.spectator_account_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_bet_deleted ON bet;
CREATE TRIGGER on_bet_deleted
  AFTER DELETE ON bet
  FOR EACH ROW EXECUTE FUNCTION refund_bet_on_delete();

-- Liquidación pari-mutuel cuando la llave termina.
-- finished/forfeit con ganador → ganadores cobran
-- floor(stake * pool / stake_acertante), perdedores pierden.
-- cancelled → voided + reintegro.
-- Solo actúa en la PRIMERA transición a estado terminal
-- (si el admin corrige un resultado después, no se re-liquida).
CREATE OR REPLACE FUNCTION settle_match_bets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_pool bigint;
  winning_stake bigint;
BEGIN
  IF NEW.winner_team_id IS NOT NULL
     AND NEW.status IN ('finished', 'forfeit')
     AND OLD.status NOT IN ('finished', 'forfeit', 'cancelled') THEN

    SELECT COALESCE(SUM(stake), 0),
           COALESCE(SUM(stake) FILTER (WHERE picked_team_id = NEW.winner_team_id), 0)
    INTO total_pool, winning_stake
    FROM bet
    WHERE match_id = NEW.id AND status = 'pending';

    IF total_pool > 0 THEN
      IF winning_stake > 0 THEN
        UPDATE bet
        SET status = 'won',
            payout = floor(stake::numeric * total_pool / winning_stake)::bigint,
            settled_at = now()
        WHERE match_id = NEW.id
          AND status = 'pending'
          AND picked_team_id = NEW.winner_team_id;

        UPDATE spectator_wallet w
        SET balance = balance + b.payout, updated_at = now()
        FROM bet b
        WHERE b.spectator_account_id = w.account_id
          AND b.match_id = NEW.id
          AND b.status = 'won';
      END IF;

      -- Perdedores (o todos, si nadie acertó: el pozo no se reparte).
      UPDATE bet
      SET status = 'lost', settled_at = now()
      WHERE match_id = NEW.id AND status = 'pending';
    END IF;

  ELSIF NEW.status = 'cancelled'
        AND OLD.status IS DISTINCT FROM 'cancelled' THEN

    UPDATE bet
    SET status = 'voided', settled_at = now()
    WHERE match_id = NEW.id AND status = 'pending';

    UPDATE spectator_wallet w
    SET balance = balance + b.stake, updated_at = now()
    FROM bet b
    WHERE b.spectator_account_id = w.account_id
      AND b.match_id = NEW.id
      AND b.status = 'voided';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_settle_bets ON "match";
CREATE TRIGGER match_settle_bets
  AFTER UPDATE ON "match"
  FOR EACH ROW EXECUTE FUNCTION settle_match_bets();

-- ============================================================
-- FIN
-- Verificar con:
-- SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- Debería devolver 19
-- ============================================================
