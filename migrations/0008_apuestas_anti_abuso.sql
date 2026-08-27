-- 0008 — Apuestas: anti-abuso de cancelaciones (penalidad 25%)
--
-- Contexto: cancelar era un DELETE con reintegro del 100% mientras la
-- llave estuviera 'scheduled'. Eso permitía SPOOFING gratis: apostar
-- fuerte a un lado para mover las cuotas exhibidas, dejar que otros
-- sigan esa cuota inflada y cancelar sin costo, infinitas veces.
--
-- Cambio: el reintegro al cancelar pasa a ser del 75% (penalidad 25%).
-- Cada ciclo apostar/cancelar ahora cuesta 25% del monto: el spoofing
-- deja de ser rentable.
--
-- NOTAS:
--   * El reintegro por llave CANCELADA (status → voided) sigue siendo
--     del 100%: lo maneja settle_match_bets y NO pasa por este trigger.
--   * floor() redondea hacia abajo: una boleta de 1 punto no reintegra
--     nada al cancelarse (0 pts) — castigo extra al micro-spoofing.
--   * Idempotente: se puede correr más de una vez.

CREATE OR REPLACE FUNCTION refund_bet_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = 'pending' THEN
    UPDATE spectator_wallet
    SET balance = balance + floor(OLD.stake * 0.75), updated_at = now()
    WHERE account_id = OLD.spectator_account_id;
  END IF;
  RETURN OLD;
END;
$$;
