-- ============================================================
-- VÉRTIGO Cup — Migración 0004: Espectadores + Apuestas (pari-mutuel)
-- IDEMPOTENTE: puede ejecutarse múltiples veces sin romperse.
-- NO destructiva: no borra datos existentes.
--
-- Contenido:
--   a) Rol "spectator" en account_role
--   b) Tablas spectator_wallet y bet (+ enum bet_status)
--   c) Triggers: wallet de 1000 puntos al hacerse espectador,
--      débito al apostar, reintegro al cancelar, liquidación
--      pari-mutuel al terminar la llave, reintegro si se cancela.
--   d) RLS de las tablas nuevas
--   e) HARDENING: evita que un usuario se cambie el role por API
--      (la policy anterior lo permitía).
--
-- Reglas de negocio:
--   - 1 apuesta por espectador por llave (UNIQUE), monto libre.
--   - Se puede apostar mientras match.status = 'scheduled' (la llave
--     no abrió). Cancelar = delete del bet → reintegro.
--   - Liquidación pari-mutuel: pool = suma de stakes; cada acertante
--     cobra floor(stake * pool / stake_acertante). Las fracciones
--     van a la casa. Si nadie acierta, el pozo no se reparte.
--   - Forfeit liqu cuenta como resultado (hay ganador).
--   - Match cancelado → apuestas voided + reintegro.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- Fecha: 2026-08-24
-- ============================================================

-- ============================================================
-- A) ENUMS
-- ============================================================

-- Rol espectador. Nota: ALTER TYPE ... ADD VALUE no puede correr
-- dentro de un bloque de transacción; el SQL Editor de Supabase
-- ejecuta statement por statement, así que está bien acá arriba.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'spectator' AND enumtypid = 'account_role'::regtype
  ) THEN
    ALTER TYPE account_role ADD VALUE 'spectator';
  END IF;
END $$;

-- Estado de una apuesta.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bet_status') THEN
    CREATE TYPE bet_status AS ENUM ('pending', 'won', 'lost', 'voided');
  END IF;
END $$;

-- ============================================================
-- B) TABLAS
-- ============================================================

-- Wallet de puntos del espectador. Se crea con 1000 puntos vía trigger
-- al adquirir el rol spectator. Nunca puede quedar negativo.
CREATE TABLE IF NOT EXISTS spectator_wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS spectator_wallet_unique_account
  ON spectator_wallet (account_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spectator_wallet_balance_nonnegative') THEN
    ALTER TABLE spectator_wallet ADD CONSTRAINT spectator_wallet_balance_nonnegative CHECK (balance >= 0);
  END IF;
END $$;

-- Apuesta: un espectador elige qué equipo gana la llave y cuánto arriesga.
CREATE TABLE IF NOT EXISTS bet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spectator_account_id uuid NOT NULL REFERENCES account(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES "match"(id) ON DELETE CASCADE,
  picked_team_id uuid NOT NULL REFERENCES team_registration(id),
  stake integer NOT NULL,
  status bet_status NOT NULL DEFAULT 'pending',
  payout integer NOT NULL DEFAULT 0,
  placed_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

-- 1 apuesta por espectador por llave.
CREATE UNIQUE INDEX IF NOT EXISTS bet_unique_spectator_match
  ON bet (spectator_account_id, match_id);

CREATE INDEX IF NOT EXISTS bet_match_idx ON bet (match_id);
CREATE INDEX IF NOT EXISTS bet_status_idx ON bet (status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bet_stake_positive') THEN
    ALTER TABLE bet ADD CONSTRAINT bet_stake_positive CHECK (stake > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bet_payout_nonnegative') THEN
    ALTER TABLE bet ADD CONSTRAINT bet_payout_nonnegative CHECK (payout >= 0);
  END IF;
END $$;

-- ============================================================
-- C) TRIGGERS
-- ============================================================

-- C.1) Wallet de 1000 puntos al adquirir el rol spectator.
--      Cubre INSERT (cuenta creada ya como spectator) y UPDATE
--      (cuenta owner existente promovida a spectator por el servidor).
--      Espejo del patrón create_comodin_inventory().
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

-- C.2) Débito del stake al colocar la apuesta.
--      El CHECK balance >= 0 aborta la transacción si no alcanza.
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

-- C.3) Reintegro al cancelar (delete) una apuesta todavía pendiente.
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

-- C.4) Liquidación pari-mutuel cuando la llave termina.
--      finished/forfeit con ganador → ganadores cobran
--      floor(stake * pool / stake_acertante), perdedores pierden.
--      cancelled → voided + reintegro.
--      Solo actúa en la PRIMERA transición a estado terminal
--      (si el admin corrige un resultado después, no se re-liquida).
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
-- D) RLS
-- ============================================================

ALTER TABLE spectator_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet ENABLE ROW LEVEL SECURITY;

-- Wallet: solo la ve su dueño o un admin. La escritura NO está
-- expuesta a usuarios (solo triggers SECURITY DEFINER / service role).
DROP POLICY IF EXISTS "SpectatorWallet: lectura propia o admin" ON spectator_wallet;
CREATE POLICY "SpectatorWallet: lectura propia o admin"
  ON spectator_wallet FOR SELECT TO authenticated
  USING (account_id = current_account_id() OR is_admin());

-- Bets: lectura propia o admin. Las sumas públicas (cuotas) se
-- calculan server-side con service role, no se exponen filas ajenas.
DROP POLICY IF EXISTS "Bet: lectura propia o admin" ON bet;
CREATE POLICY "Bet: lectura propia o admin"
  ON bet FOR SELECT TO authenticated
  USING (spectator_account_id = current_account_id() OR is_admin());

-- Solo podés crear apuestas a tu nombre.
DROP POLICY IF EXISTS "Bet: insert propia" ON bet;
CREATE POLICY "Bet: insert propia"
  ON bet FOR INSERT TO authenticated
  WITH CHECK (spectator_account_id = current_account_id());

-- Solo podés borrar TU apuesta y mientras siga pendiente
-- (el server además exige que la llave siga 'scheduled').
DROP POLICY IF EXISTS "Bet: delete propia pendiente" ON bet;
CREATE POLICY "Bet: delete propia pendiente"
  ON bet FOR DELETE TO authenticated
  USING (spectator_account_id = current_account_id() AND status = 'pending');

-- ============================================================
-- E) HARDENING: la policy "Account: escritura propia" permitía a
--    cualquier usuario UPDATEar su propio role (¡a admin!) vía API.
--    Se fija el role: un usuario no puede cambiar su propio role
--    por RLS. Los cambios de rol legítimos usan service role
--    (que bypasea RLS).
-- ============================================================
DROP POLICY IF EXISTS "Account: escritura propia" ON account;
CREATE POLICY "Account: escritura propia"
  ON account FOR UPDATE TO authenticated
  USING (supabase_auth_id = auth.uid())
  WITH CHECK (
    supabase_auth_id = auth.uid()
    AND role = (SELECT a.role FROM public.account a WHERE a.supabase_auth_id = auth.uid())
  );

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'account_role'::regtype ORDER BY enumsortorder;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('spectator_wallet', 'bet');
SELECT tgname FROM pg_trigger
WHERE tgname IN ('on_account_spectator_wallet', 'on_bet_placed', 'on_bet_deleted', 'match_settle_bets');
SELECT policyname FROM pg_policies
WHERE tablename IN ('spectator_wallet', 'bet', 'account')
ORDER BY tablename, policyname;
