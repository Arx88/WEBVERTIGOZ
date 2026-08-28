-- 2026-08-28 — Caster destacado
-- Un solo caster puede estar `featured`: ocupa el reproductor principal de
-- /casters cuando está en vivo (si no, se muestra el más visto) y lleva el
-- badge "DESTACADO" en la grilla. Se administra desde /admin/casters.
ALTER TABLE caster ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
