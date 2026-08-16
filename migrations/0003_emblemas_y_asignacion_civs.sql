-- ============================================================
-- VÉRTIGO Cup — Migración 0003
-- a) Emblemas nuevos (emblema-1..4.webp, subidos a /public/emblems)
-- b) Asignación de civ por jugador en el lineup (flujo real = tutorial)
--
-- Idempotente: puede correrse varias veces sin efectos secundarios.
-- Correr en el SQL Editor de Supabase del proyecto tomlvgzwleolsxksiygs.
-- ============================================================

-- a) Nuevos escudos (los PNG de "CARD ICONS/Emblemas" ya convertidos a webp).
--    ON CONFLICT DO NOTHING: si ya existen no pisa nada.
INSERT INTO emblem (name, image_url, category, sort_order, is_active)
VALUES
  ('Emblema I',   '/emblems/emblema-1.webp', 'premium', 13, true),
  ('Emblema II',  '/emblems/emblema-2.webp', 'premium', 14, true),
  ('Emblema III', '/emblems/emblema-3.webp', 'premium', 15, true),
  ('Emblema IV',  '/emblems/emblema-4.webp', 'premium', 16, true)
ON CONFLICT DO NOTHING;

-- b) match_game.civ_assignment_a/b: mapa player_registration_id -> civ_id.
--    El capitán declara QUIÉN juega y QUÉ CIV USA cada uno (igual que el
--    tutorial). Vacío = sin asignar todavía.
ALTER TABLE match_game ADD COLUMN IF NOT EXISTS civ_assignment_a jsonb DEFAULT '{}';
ALTER TABLE match_game ADD COLUMN IF NOT EXISTS civ_assignment_b jsonb DEFAULT '{}';

-- Verificación
SELECT name, image_url, category, sort_order FROM emblem ORDER BY sort_order;
SELECT column_name FROM information_schema.columns WHERE table_name = 'match_game' AND column_name LIKE 'civ_assignment%';
