-- ============================================================
-- 0012 — Sync de partidas AoE2 Companion + análisis post-partida
--
-- El sitio genera un nombre de sala único por partida (p.ej.
-- "J1-VCUP-P3G2") y un watcher busca esa partida en AoE2 Companion:
-- cuando encuentra la partida válida (nombre + mapa + modo + ganador)
-- archiva el .aoe2record, persiste el análisis y auto-reporta el
-- resultado reutilizando la misma lógica del reporte manual.
--
-- Todo es ADITIVO: match_game agrega columnas de vínculo/estado de
-- sync y se crea match_game_analysis. El reporte manual y el campo
-- replay_url siguen funcionando exactamente igual que antes.
-- ============================================================

alter table match_game add column if not exists aoe2_match_id bigint;
alter table match_game add column if not exists aoe2_sync_status varchar(20) not null default 'pending';
alter table match_game add column if not exists aoe2_checked_at timestamptz;
alter table match_game add column if not exists aoe2_flag text;
alter table match_game add column if not exists rec_storage_path varchar(300);

create table if not exists match_game_analysis (
  match_game_id uuid primary key references match_game(id) on delete cascade,
  aoe2_match_id bigint,
  payload jsonb not null default '{}'::jsonb,
  svg_storage_path varchar(300),
  fetched_at timestamptz not null default now()
);

-- Lectura pública (el análisis se muestra en la página pública del partido);
-- escritura solo service-role (sin políticas de insert/update).
alter table match_game_analysis enable row level security;

drop policy if exists "match_game_analysis_public_read" on match_game_analysis;
create policy "match_game_analysis_public_read"
  on match_game_analysis for select using (true);

-- Bucket privado para los .aoe2record y los SVG del mapa final
-- (mismo patrón que el bucket `handbook`: se guarda el PATH en DB
-- y la URL firmada se genera al leer).
insert into storage.buckets (id, name, public)
values ('replays', 'replays', false)
on conflict (id) do nothing;
