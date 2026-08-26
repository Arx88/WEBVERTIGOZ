-- ============================================================
-- 0006 — Cache de stats AoE2 Companion por jugador (rm_team)
--
-- Guarda el winrate por civ y por mapa (leaderboard rm_team =
-- partidas de equipos, el formato del torneo) traído de
-- data.aoe2companion.com. Se refresca al aprobar la inscripción,
-- con un cron (/api/cron/refresh-stats) o bajo demanda.
-- ============================================================

create table if not exists player_stats_cache (
  id uuid primary key default gen_random_uuid(),
  aoe2_profile_id integer not null unique,
  player_registration_id uuid references player_registration(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_stats_cache_reg_idx
  on player_stats_cache (player_registration_id);

-- Lectura pública (son agregados del ladder, mismo dato que muestra Companion);
-- escritura solo service-role (sin políticas de insert/update).
alter table player_stats_cache enable row level security;

drop policy if exists "player_stats_cache_public_read" on player_stats_cache;
create policy "player_stats_cache_public_read"
  on player_stats_cache for select using (true);
