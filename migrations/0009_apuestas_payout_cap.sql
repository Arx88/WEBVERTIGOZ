-- 0009 — Apuestas: tope de multiplicador de pago (×10)
--
-- Problema: en un pozo hiper-inclinado (ej. 2000 pts al favorito y 1 pt al
-- outsider), si sale el outsider el dividendo es floor(1 × 2001 / 1) = ×2001.
-- Matemáticamente el pari-mutuel siempre puede pagar (el pago sale del pozo),
-- pero dividendos de ese tamaño son absurdos para un torneo comunitario y
-- confunden: nadie entiende qué está pasando.
--
-- Cambio: el payout de cada boleta tiene tope stake × 10. El excedente del
-- pozo no se reparte (queda quemado — desinflación leve, intencional).
--
-- NOTA: BET_MAX_PAYOUT_MULT = 10 en src/lib/constants/index.ts debe espejar
-- este 10 (la UI muestra el cobro estimado con el mismo tope).
-- Idempotente: se puede correr más de una vez.

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
            payout = LEAST(
              floor(stake::numeric * total_pool / winning_stake),
              stake * 10  -- tope ×10: dividendos creíbles (ver 0009)
            )::bigint,
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
