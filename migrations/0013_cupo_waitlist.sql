-- ============================================================
-- 0013 — Waitlist de cupo ("avisame si se libera un lugar")
--
-- Cuando el cupo de la edición está lleno, el wizard muestra el
-- freno con un botón "Notificarme si hay lugar": el mail queda
-- anotado acá, asociado a la edición. Upsert idempotente por
-- (tournament_edition_id, email) — anotarse dos veces no duplica.
--
-- Escritura/lectura SOLO vía service role (server actions y
-- panel de staff): RLS activado sin policies.
-- `notified_at` queda para el futuro job que avise cuando el
-- staff libere lugares (hoy la lista la gestiona el staff).
-- ============================================================

create table if not exists cupo_waitlist (
  id uuid primary key default gen_random_uuid(),
  tournament_edition_id uuid not null references tournament_edition(id) on delete cascade,
  email varchar(255) not null,
  source varchar(30) not null default 'wizard_freno',
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists cupo_waitlist_unique_edition_email
  on cupo_waitlist (tournament_edition_id, email);

create index if not exists cupo_waitlist_edition_idx
  on cupo_waitlist (tournament_edition_id, created_at desc);

alter table cupo_waitlist enable row level security;
-- Sin policies: el rol anon/authenticated no puede leer ni escribir.
