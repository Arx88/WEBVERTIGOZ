-- ============================================================
-- VÉRTIGO Cup — Migración Fase 0: Fundamentos y Seguridad
-- IDEMPOTENTE: puede ejecutarse múltiples veces sin romperse.
-- NO destructiva: no borra datos existentes.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- Fecha: 2026-08-11
-- ============================================================

-- ============================================================
-- A) CONSTRAINTS que faltaban (integridad estructural del bracket)
-- ============================================================

-- Un solo bracket "winner" por edición (evita duplicados en race condition)
CREATE UNIQUE INDEX IF NOT EXISTS bracket_unique_edition_type
  ON bracket (tournament_edition_id, type);

-- Un índice único de ronda por bracket
CREATE UNIQUE INDEX IF NOT EXISTS round_unique_bracket_index
  ON round (bracket_id, index);

-- Un slot único por ronda
CREATE UNIQUE INDEX IF NOT EXISTS match_unique_round_slot
  ON "match" (round_id, slot_index);

-- Próximos partidos: query frecuente por scheduled_at_start
CREATE INDEX IF NOT EXISTS match_scheduled_at_idx
  ON "match" (scheduled_at_start);

-- ============================================================
-- B) match_game: FK draw_id faltante + columna llave_format
-- ============================================================
-- El schema Drizzle declaraba "draw_id uuid" sin FK ni columna extra
-- para el formato de llave (BO3/Deathmatch) que sortea la ruleta en P1.

ALTER TABLE match_game ADD COLUMN IF NOT EXISTS llave_format varchar(20);

-- Agregar la FK draw_id → roulette_draw (solo si no existe ya)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'match_game_draw_fkey'
  ) THEN
    ALTER TABLE match_game
      ADD CONSTRAINT match_game_draw_fkey
      FOREIGN KEY (draw_id) REFERENCES roulette_draw(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- C) match: ventana de comodines con fin server-side + seed del draw
-- ============================================================
-- comodin_window_expires_at: el countdown de 5 min se calcula en server
--   (no se confía en el timer del cliente).
-- draw_seed: el seed criptográfico del sorteo (guardado server-side para
--   auditoría interna; NO se expone al cliente).
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS comodin_window_expires_at timestamptz;
ALTER TABLE "match" ADD COLUMN IF NOT EXISTS draw_seed varchar(128);

-- ============================================================
-- D) comodin_inventory: no puede quedar negativo
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comodin_inv_reroll_nonnegative') THEN
    ALTER TABLE comodin_inventory ADD CONSTRAINT comodin_inv_reroll_nonnegative CHECK (reroll_available >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comodin_inv_anular_nonnegative') THEN
    ALTER TABLE comodin_inventory ADD CONSTRAINT comodin_inv_anular_nonnegative CHECK (anular_available >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comodin_inv_elegir_nonnegative') THEN
    ALTER TABLE comodin_inventory ADD CONSTRAINT comodin_inv_elegir_nonnegative CHECK (elegir_rival_available >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'comodin_inv_pro_nonnegative') THEN
    ALTER TABLE comodin_inventory ADD CONSTRAINT comodin_inv_pro_nonnegative CHECK (invocar_pro_available >= 0);
  END IF;
END $$;

-- ============================================================
-- E) TRIGGER: avance automático del ganador al siguiente match
-- ============================================================
-- Cuando match.status pasa a "finished" y hay winner_team_id,
-- se propaga el ganador al parent match (slot A o B según slot_index
-- par/impar del match actual: los matches hijo 2N y 2N+1 alimentan
-- al match padre slot N de la ronda siguiente).

CREATE OR REPLACE FUNCTION propagate_match_winner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  parent_id uuid;
  next_round_id uuid;
  parent_slot int;
BEGIN
  -- Solo actuar en la transición a "finished" con un ganador definido.
  IF NEW.status = 'finished'
     AND OLD.status IS DISTINCT FROM 'finished'
     AND NEW.winner_team_id IS NOT NULL THEN

    -- Ronda siguiente del mismo bracket.
    SELECT r2.id INTO next_round_id
    FROM round r1
    JOIN round r2 ON r2.bracket_id = r1.bracket_id AND r2.index = r1.index + 1
    WHERE r1.id = NEW.round_id;

    -- Si hay ronda siguiente, el ganador avanza al match slot floor(slot_index/2).
    IF next_round_id IS NOT NULL THEN
      parent_slot := (NEW.slot_index / 2)::int;

      SELECT m2.id INTO parent_id
      FROM "match" m2
      WHERE m2.round_id = next_round_id
        AND m2.slot_index = parent_slot;

      IF parent_id IS NOT NULL THEN
        -- slot_index par del hijo → llena team_a del padre; impar → team_b.
        IF NEW.slot_index % 2 = 0 THEN
          UPDATE "match" SET team_a_id = NEW.winner_team_id, updated_at = now()
          WHERE id = parent_id;
        ELSE
          UPDATE "match" SET team_b_id = NEW.winner_team_id, updated_at = now()
          WHERE id = parent_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_propagate_winner ON "match";
CREATE TRIGGER match_propagate_winner
  AFTER UPDATE ON "match"
  FOR EACH ROW EXECUTE FUNCTION propagate_match_winner();

-- ============================================================
-- F) RLS: endurecer draw_audit_log (fairness interno)
-- ============================================================
-- Antes: USING(true) — cualquiera leía los hashes.
-- Ahora: solo admins (o service role) pueden leer el log.
-- Helper is_admin() reutilizable.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account a
    WHERE a.supabase_auth_id = auth.uid()
      AND a.role IN ('admin', 'super_admin')
  );
$$;

ALTER TABLE draw_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS draw_audit_log_select ON draw_audit_log;
DROP POLICY IF EXISTS draw_audit_log_admin_read ON draw_audit_log;

CREATE POLICY draw_audit_log_admin_read ON draw_audit_log
  FOR SELECT USING (is_admin());

-- Escritura solo vía service role (server actions). Nadie más.
DROP POLICY IF EXISTS draw_audit_log_insert ON draw_audit_log;

-- ============================================================
-- G) preset_version: poblar con el preset v1 de la ruleta
-- ============================================================
-- Hoy la ruleta lee su config de localStorage del navegador.
-- Esto la mueve a la DB: fuente de verdad del torneo.
-- El config JSON replica src/lib/ruleta/config.tsx DEFAULT_CONFIG.

INSERT INTO preset_version (version, is_frozen, config)
SELECT 1, false, $cfg${
  "gameModes": [
    {"id":"gm-antimeta","title":"ANTIMETA","tag":"CAOS","color":"#ff2e7e","img":"/modes/game-mode/antimeta.webp","kind":"MODO","tagline":"El caos reescribe las reglas de la guerra.","description":"Rompe el equilibrio competitivo. El modo Antimeta abandona las estrategias convencionales.","rules":["Configuración extrema al azar","Prohibido repetir estrategias","Sin guías externas","El azar decide las condiciones"]},
    {"id":"gm-guerras","title":"GUERRAS IMPERIALES","tag":"ÉPICO","color":"#d8a13f","img":"/modes/game-mode/guerras-imperiales.webp","kind":"MODO","tagline":"Guerra total desde el primer segundo.","description":"Comienza en la Edad Imperial y desata el infierno desde el primer segundo.","rules":["Inicio directo en Edad Imperial","Recursos elevados","Tecnologías militares desbloqueadas","Gana quien elimine a todos"]},
    {"id":"gm-muerte","title":"MUERTE SÚBITA","tag":"TENSIÓN","color":"#22e5c2","img":"/modes/game-mode/muerte-subdita.webp","kind":"MODO","tagline":"El reloj no perdona. Solo el acero decide.","description":"El reloj no perdona. Dispones de un único instante para construir y prepararte.","rules":["Período de preparación limitado","Sin reconstruir edificios clave","Recursos finitos","Solo un sobreviviente"]},
    {"id":"gm-regicida","title":"REGICIDA","tag":"REY","color":"#b06bff","img":"/modes/game-mode/regicida.webp","kind":"MODO","tagline":"Protege al rey o pierde el reino entero.","description":"El rey es la corona y la corona es todo. Protege a tu monarca o pierde el reino.","rules":["Cada jugador inicia con un Rey","Si el Rey muere, eliminado","El Rey puede refugiarse en castillos","Protege al monarca o pierde todo"]}
  ],
  "antimetaModes": [
    {"id":"am-500pop","title":"500 POP","tag":"MASIVO","color":"#ff2e7e","img":"/modes/game-mode/antimeta/500pop.webp","kind":"ANTIMETA","tagline":"Ejércitos colosales. Macro sin tregua.","description":"Límite de población disparado a 500. Ejércitos colosales chocan.","rules":["Límite de población: 500","Recursos iniciales elevados","Batallas a escala masiva","Requiere macro intensa"]},
    {"id":"am-barcos","title":"BARCOS","tag":"NAVAL","color":"#22e5c2","img":"/modes/game-mode/antimeta/barcos.webp","kind":"ANTIMETA","tagline":"El océano es el único campo de batalla.","description":"El mar es el único campo de batalla. Solo unidades navales.","rules":["Solo unidades navales","Mapa con predominio de agua","Control de rutas marítimas","Prohibidas unidades terrestres"]},
    {"id":"am-feudal","title":"FEUDAL","tag":"RÁPIDO","color":"#ff6b00","img":"/modes/game-mode/antimeta/feudal.webp","kind":"ANTIMETA","tagline":"Atascados en el feudal. La micro lo es todo.","description":"Atascados en la Edad Feudal para siempre. Sin avanzar a Castillos.","rules":["Bloqueado en Edad Feudal","Sin unidades de Castillos","Solo tecnologías feudales","Microgestión es la clave"]},
    {"id":"am-meso","title":"MESOAMÉRICA","tag":"CULTURA","color":"#d8a13f","img":"/modes/game-mode/antimeta/mesoamerica.webp","kind":"ANTIMETA","tagline":"Selva, sol y civilizaciones precolombinas.","description":"Solo civilizaciones precolombinas: Mayas, Aztecas e Incas.","rules":["Mayas, Aztecas, Incas","Mapas selváticos","Sin caballería tradicional","Unidades únicas precolombinas"]},
    {"id":"am-rey","title":"REY DE LA COLINA","tag":"CONTROL","color":"#b06bff","img":"/modes/game-mode/antimeta/rey-de-la-colina.webp","kind":"ANTIMETA","tagline":"Controla la colina o muere intentándolo.","description":"Existe un único punto estratégico: la Colina. Quien la controle, gana.","rules":["Punto central único","Gana quien la controle al final","Alianzas dinámicas","Asedio permanente"]},
    {"id":"am-unicas","title":"UNIDADES ÚNICAS","tag":"ÉLITE","color":"#ff5aa5","img":"/modes/game-mode/antimeta/unidades-unicas.webp","kind":"ANTIMETA","tagline":"Solo las élites de cada civilización.","description":"Solo unidades únicas de cada civilización.","rules":["Solo unidades únicas","Castillos obligatorios","Sin unidades estándar","Conocimiento de contras"]}
  ],
  "playerModes": [
    {"id":"pm-1vs1","title":"1 VS 1","tag":"DUELO","color":"#ff2e7e","img":"/modes/player-mode/1vs1.webp","kind":"FORMATO","tagline":"Un duelo de dos mentes estratégicas.","description":"Un duelo directo entre dos mentes estratégicas.","rules":["Un jugador por bando","Sin aliados","Mapa pequeño","Habilidad individual"],"civsPerTeam":1},
    {"id":"pm-2vs2","title":"2 VS 2","tag":"EQUIPO","color":"#22e5c2","img":"/modes/player-mode/2vs2.webp","kind":"FORMATO","tagline":"Dos cabezas piensan mejor que una.","description":"La coordinación con tu compañero se vuelve tan importante como tu habilidad.","rules":["Dos jugadores por bando","Comunicación por voz","Roles divididos","Sincronización de ataques"],"civsPerTeam":2},
    {"id":"pm-3vs3","title":"3 VS 3","tag":"BATALLA","color":"#d8a13f","img":"/modes/player-mode/3vs3.webp","kind":"FORMATO","tagline":"Seis mentes, una sola máquina de guerra.","description":"El 3 vs 3 eleva la complejidad táctica a otro nivel.","rules":["Tres jugadores por bando","Mapa de mayor tamaño","Estrategias de flanco","Economía compartida viable"],"civsPerTeam":3},
    {"id":"pm-team","title":"TEAM","tag":"GUERRA","color":"#b06bff","img":"/modes/player-mode/team.webp","kind":"FORMATO","tagline":"3 jugadores, una sola civilización.","description":"Modo FUSIÓN: los 3 jugadores del equipo manejan juntos una sola civilización.","rules":["Tres jugadores, una civ","Sin separar controles","Coordinación total","Distribución de tareas libre"],"civsPerTeam":1}
  ],
  "mapModes": [
    {"id":"map-arabia","title":"ARABIA","tag":"CLÁSICO","color":"#22e5c2","img":"/modes/maps/arabia.webp","kind":"MAPA","tagline":"El clásico mapa abierto.","description":"Terreno abierto, recursos equilibrados y espacio para expandir.","rules":["Mapa abierto","Recursos equilibrados","Sin obstáculos naturales","Ideal para 1vs1"]},
    {"id":"map-arena","title":"ARENA","tag":"CERRADO","color":"#ff2e7e","img":"/modes/maps/arena.webp","kind":"MAPA","tagline":"Bosque cerrado, batallas tempranas.","description":"Arena rodea el mapa de bosque denso.","rules":["Bosque perimetral","Inicio cercano","Batallas tempranas","Poca expansión"]},
    {"id":"map-atacama","title":"ATACAMA","tag":"DESIERTO","color":"#d8a13f","img":"/modes/maps/atacama.webp","kind":"MAPA","tagline":"El desierto más árido exige control total.","description":"Mapa desértico y abierto con rutas de expansión agresivas.","rules":["Terreno abierto","Pocos recursos cercanos","Control del centro","Empujes agresivos"]},
    {"id":"map-crater","title":"CRÁTER","tag":"ALTURAS","color":"#ff6b00","img":"/modes/maps/crater.webp","kind":"MAPA","tagline":"La batalla por el centro lo decide todo.","description":"Concentra los recursos en el centro del mapa.","rules":["Recursos centrales","Control del cráter","Asedio constante","Pocas rutas de escape"]},
    {"id":"map-cresta","title":"CRESTA MONTAÑOSA","tag":"MONTAÑA","color":"#b06bff","img":"/modes/maps/cresta-montanosa.webp","kind":"MAPA","tagline":"Colinas y cuellos de botella.","description":"Terreno elevado y pasos estrechos.","rules":["Terreno elevado","Cuellos de botella","Ventaja con arqueros","Control de pasos"]},
    {"id":"map-cuatro-lagos","title":"CUATRO LAGOS","tag":"NAVAL","color":"#22e5c2","img":"/modes/maps/cuatro-lagos.webp","kind":"MAPA","tagline":"El agua cruza el campo de batalla.","description":"Cuatro lagos reparten el mapa en islas de tierra.","rules":["Mapa con agua","Control naval","Desembarcos","Recursos en islas"]},
    {"id":"map-cuenca-oro","title":"CUENCA DEL ORO","tag":"ORO","color":"#d8a13f","img":"/modes/maps/cuenca-del-oro.webp","kind":"MAPA","tagline":"El oro decide quién domina.","description":"El metal más valioso en zonas disputadas.","rules":["Oro abundante","Minas disputadas","Escaramuzas tempranas","Economía clave"]},
    {"id":"map-migracion","title":"MIGRACIÓN","tag":"NÓMADA","color":"#ff5aa5","img":"/modes/maps/migracion.webp","kind":"MAPA","tagline":"Comienzas sin pueblo, eliges tu destino.","description":"Los jugadores inician sin centro urbano y deben fundar su imperio.","rules":["Inicio nómada","Mover el centro urbano","Elegir posición","Exploración vital"]},
    {"id":"map-tormenta","title":"TORMENTA DE POLVO","tag":"DESIERTO","color":"#ff6b00","img":"/modes/maps/tormenta-de-polvo.webp","kind":"MAPA","tagline":"La tormenta oculta tus movimientos.","description":"Visibilidad reducida, juego por intuición.","rules":["Visibilidad reducida","Exploración arriesgada","Ataques sorpresa","Adaptación constante"]}
  ],
  "llaveModes": [
    {"id":"ll-deathmatch","title":"DEATHMATCH","tag":"LLAVE","color":"#ff2e7e","img":"/modes/llave/deathmatch.webp","kind":"LLAVE","tagline":"A muerte: un solo partido decide la llave.","description":"Un solo partido. Quien gana, avanza.","rules":["Un solo partido","Sin ventaja de mapa","Ganador avanza","Eliminación directa"],"llaveFormat":"BO1"},
    {"id":"ll-bo3","title":"BO3","tag":"LLAVE","color":"#22e5c2","img":"/modes/llave/bo3.webp","kind":"LLAVE","tagline":"Al mejor de 3 partidos.","description":"El primero que gane dos partidos se lleva la llave.","rules":["Mejor de 3","Ganar 2 partidos","Ban de mapas","Estrategia por serie"],"llaveFormat":"BO3"}
  ],
  "sounds": {"enabled": true, "volume": 1},
  "music": {"enabled": false, "volume": 0.2}
}$cfg$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM preset_version WHERE version = 1);

-- Vincular la edición activa al preset (si no tiene uno ya).
UPDATE tournament_edition
SET preset_version_id = (SELECT id FROM preset_version WHERE version = 1)
WHERE preset_version_id IS NULL;

-- ============================================================
-- H) tournament_config: defaults clave-valor por edición
-- ============================================================
-- Config operativa editable que no amerita columna propia.

INSERT INTO tournament_config (tournament_edition_id, key, value)
SELECT id, k.key, k.value
FROM tournament_edition te
CROSS JOIN (VALUES
  ('ready_timeout_minutes', '10'::jsonb),
  ('comodin_window_minutes', '5'::jsonb),
  ('stream_embed_enabled_default', 'false'::jsonb),
  ('bracket_size', '32'::jsonb),
  ('seeding', '"snake"'::jsonb),
  ('reveal_phases', '["MODO","ANTIMETA","FORMATO","MAPA","LLAVE","CIVS"]'::jsonb)
) AS k(key, value)
WHERE te.slug = 'vertigo-2026-1'
ON CONFLICT (tournament_edition_id, key) DO NOTHING;

-- ============================================================
-- VERIFICACIÓN (correr después):
--   SELECT count(*) FROM preset_version;          -- >= 1
--   SELECT count(*) FROM tournament_config;        -- >= 6
--   SELECT conname FROM pg_constraint WHERE conname LIKE '%nonnegative'; -- 4
--   SELECT tgname FROM pg_trigger WHERE tgname='match_propagate_winner'; -- 1
-- ============================================================
