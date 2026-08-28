/**
 * Restaura la llave d8d2edbf (Ronda 1 slot 0, PSX vs PAPÁ de cristian)
 * a estado scheduled con horario cercano para re-probar el flujo READY.
 *
 * Uso: node scripts/db-cleanup/restore-d8d2edbf.mjs [minutos-hasta-inicio]
 */
import { connectDb } from "./connect.mjs";

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";
const minutesAhead = Number(process.argv[2] ?? 3);

async function main() {
  const client = await connectDb();
  try {
    await client.query(
      `UPDATE "match" SET
         status = 'scheduled',
         winner_team_id = NULL,
         finished_at = NULL,
         ready_a_at = NULL,
         ready_b_at = NULL,
         scheduled_at_start = now() + ($1 || ' minutes')::interval,
         updated_at = now()
       WHERE id = $2`,
      [String(minutesAhead), MATCH_ID]
    );
    const { rows } = await client.query(
      `SELECT status, winner_team_id,
              extract(epoch FROM scheduled_at_start) AS start_epoch,
              extract(epoch FROM finished_at) AS fin_epoch,
              ready_a_at, ready_b_at
       FROM "match" WHERE id = $1`,
      [MATCH_ID]
    );
    const r = rows[0];
    console.log("✓ llave restaurada:", r.status, "| winner:", r.winner_team_id);
    console.log("  inicio (UTC):", new Date(r.start_epoch * 1000).toISOString());
    console.log("  finished_at:", r.fin_epoch, "| ready_a:", r.ready_a_at, "| ready_b:", r.ready_b_at);
    return 0;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("✗", e.message ?? e);
    process.exit(1);
  });
