-- ============================================================
-- 0010: W.O. (forfeit) también propaga al ganador en el bracket
-- ============================================================
-- El trigger propagate_match_winner (migración 0001) solo disparaba
-- en la transición a status='finished'. Un W.O. manual o automático
-- usa status='forfeit', así que el ganador NO avanzaba de ronda.
-- Se amplía la condición para que 'forfeit' con ganador definido
-- propague igual que 'finished'.

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
  -- Actuar en la transición a "finished" o "forfeit" con ganador definido.
  IF NEW.status IN ('finished', 'forfeit')
     AND OLD.status IS DISTINCT FROM NEW.status
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

-- El trigger match_propagate_winner ya existe (0001) y apunta a la
-- función por nombre, así que CREATE OR REPLACE alcanza.
