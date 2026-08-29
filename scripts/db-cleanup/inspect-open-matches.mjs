/**
 * Diagnóstico: matches en estado "open" y la llave de prueba d8d2edbf.
 * SOLO LECTURA. Uso: node scripts/db-cleanup/inspect-open-matches.mjs
 */
import { connectDb } from "./connect.mjs";

const TEST_MATCH = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows: openMatches } = await q(
  `SELECT id, slot_index, status, scheduled_at_start, ready_a_at, ready_b_at,
          format, score_a, score_b, winner_team_id, finished_at
     FROM "match"
    WHERE status = 'open'
    ORDER BY scheduled_at_start NULLS LAST`
);
console.log("== Matches en status 'open' ==");
console.log(JSON.stringify(openMatches, null, 1));

const { rows: test } = await q(
  `SELECT id, slot_index, status, scheduled_at_start, ready_a_at, ready_b_at,
          format, score_a, score_b, winner_team_id, finished_at, jornada_label
     FROM "match" WHERE id = $1`,
  [TEST_MATCH]
);
console.log("\n== Llave de prueba d8d2edbf ==");
console.log(JSON.stringify(test, null, 1));

if (test[0]) {
  const { rows: games } = await q(
    `SELECT id, game_number, status FROM match_game WHERE match_id = $1 ORDER BY game_number`,
    [TEST_MATCH]
  );
  console.log("\n== match_games ==", games);
}

await client.end();