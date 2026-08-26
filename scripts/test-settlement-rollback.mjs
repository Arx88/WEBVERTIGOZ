/**
 * Prueba de liquidación SIN dejar rastro: dentro de una transacción que
 * termina en ROLLBACK, fuerza el final de una llave con apuestas pending
 * y verifica que el trigger settle_match_bets reparta el pozo correctamente.
 * También prueba el reintegro por cancelación (on_bet_deleted).
 *
 * Uso: node scripts/test-settlement-rollback.mjs
 */
import postgres from "postgres";

const pw = encodeURIComponent("RebelbyteEra1-");
const sql = postgres(
  `postgresql://postgres.tomlvgzwleolsxksiygs:${pw}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  { prepare: false }
);

// 1. Elegir una llave scheduled con apuestas pendientes (las del demo)
const [match] = await sql`
  SELECT m.id, m.team_a_id, m.team_b_id
  FROM "match" m
  WHERE m.status = 'scheduled'
    AND EXISTS (SELECT 1 FROM bet b WHERE b.match_id = m.id AND b.status = 'pending')
  LIMIT 1`;
if (!match) {
  console.log("No hay llaves scheduled con apuestas pending para probar.");
  process.exit(0);
}
console.log(`Llave de prueba: ${match.id.slice(0, 8)}… (gana equipo A)`);

const before = await sql`
  SELECT b.spectator_account_id, b.picked_team_id, b.stake, w.balance
  FROM bet b JOIN spectator_wallet w ON w.account_id = b.spectator_account_id
  WHERE b.match_id = ${match.id} AND b.status = 'pending'`;
const pool = before.reduce((s, b) => s + b.stake, 0);
const winStake = before.filter((b) => b.picked_team_id === match.team_a_id).reduce((s, b) => s + b.stake, 0);
console.log(`Pool=${pool} · stake al equipo A=${winStake} · apostadores=${before.length}`);

let resultado;
try {
  await sql.begin(async (tx) => {
    // 2. Reintegro por cancelación: borrar una apuesta pending debe devolver el stake
    const victima = before[0];
    const [w0] = await tx`
      SELECT balance FROM spectator_wallet WHERE account_id = ${victima.spectator_account_id}`;
    await tx`DELETE FROM bet WHERE match_id = ${match.id} AND spectator_account_id = ${victima.spectator_account_id}`;
    const [w1] = await tx`
      SELECT balance FROM spectator_wallet WHERE account_id = ${victima.spectator_account_id}`;
    resultado = { cancelOk: w1.balance === w0.balance + victima.stake };
    console.log(`Cancelación: balance ${w0.balance} → ${w1.balance} (stake ${victima.stake}) ${resultado.cancelOk ? "✓" : "✗ FALLO"}`);

    // El pozo real es el posterior a la cancelación del paso 2 —
    // hay que medirlo ANTES de liquidar (el trigger marca las bets al instante)
    const vigente = await tx`
      SELECT stake, picked_team_id FROM bet WHERE match_id = ${match.id} AND status = 'pending'`;
    const poolReal = vigente.reduce((s, b) => s + b.stake, 0);
    const winReal = vigente.filter((b) => b.picked_team_id === match.team_a_id).reduce((s, b) => s + b.stake, 0);
    console.log(`Pozo vigente al liquidar: ${poolReal} · lado A: ${winReal}`);

    // 3. Liquidar: la llave termina y gana el equipo A
    await tx`
      UPDATE "match" SET status = 'finished', winner_team_id = ${match.team_a_id}
      WHERE id = ${match.id}`;

    const despues = await tx`
      SELECT b.spectator_account_id, b.picked_team_id, b.stake, b.status, b.payout, w.balance
      FROM bet b JOIN spectator_wallet w ON w.account_id = b.spectator_account_id
      WHERE b.match_id = ${match.id} AND b.spectator_account_id != ${victima.spectator_account_id}`;

    let todoOk = true;
    for (const b of despues) {
      const gano = b.picked_team_id === match.team_a_id;
      const esperado = gano ? Math.floor((b.stake * poolReal) / winReal) : 0;
      const statusOk = b.status === (gano ? "won" : "lost");
      const payoutOk = b.payout === esperado;
      const orig = before.find((x) => x.spectator_account_id === b.spectator_account_id);
      const balanceOk = gano ? b.balance === orig.balance + esperado : b.balance === orig.balance;
      if (!statusOk || !payoutOk || !balanceOk) todoOk = false;
      console.log(
        `${gano ? "GANÓ " : "PERDIÓ"} stake=${b.stake} → status=${b.status} payout=${b.payout} (esperado ${esperado}) balance ${orig.balance}→${b.balance} ` +
        `${statusOk && payoutOk && balanceOk ? "✓" : "✗ FALLO"}`
      );
    }
    resultado.liquidacionOk = todoOk;
    console.log(todoOk ? "Liquidación ✓" : "Liquidación ✗ FALLO");

    // 4. Forzar ROLLBACK: nada de esto queda escrito
    throw new Error("rollback-de-prueba");
  });
} catch (e) {
  if (!String(e.message).includes("rollback-de-prueba")) throw e;
}

const [quedo] = await sql`
  SELECT count(*)::int AS n FROM bet WHERE match_id = ${match.id} AND status = 'pending'`;
console.log(`Tras rollback: apuestas pending de la llave = ${quedo.n} (deben ser ${before.length}) — datos intactos ${quedo.n === before.length ? "✓" : "✗"}`);

await sql.end();
