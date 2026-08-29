/**
 * Detalle del match de Ronda 1: PSX vs PAPÁ de cristian (las cuentas reales de prueba).
 * SOLO LECTURA. Uso: node scripts/db-cleanup/inspect-cristian-match.mjs
 */
import { connectDb } from "./connect.mjs";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows } = await q(
  `SELECT m.id AS match_id, m.slot_index, m.status, m.format, m.scheduled_at_start,
          m.score_a, m.score_b, m.winner_team_id,
          r.id AS round_id, r.index AS round_index, r.name AS round_name,
          tra.id AS reg_a, trb.id AS reg_b,
          ta.name AS team_a, tb.name AS team_b,
          a_a.email AS owner_a_email, a_b.email AS owner_b_email
     FROM "match" m
     JOIN round r ON r.id = m.round_id
     JOIN team_registration tra ON tra.id = m.team_a_id
     JOIN team_registration trb ON trb.id = m.team_b_id
     JOIN team_account ta ON ta.id = tra.team_account_id
     JOIN team_account tb ON tb.id = trb.team_account_id
     LEFT JOIN account a_a ON a_a.id = ta.owner_id
     LEFT JOIN account a_b ON a_b.id = tb.owner_id
    WHERE r.bracket_id = 'e0150d1a-89f1-4a29-a97f-111ab4764ab7'
      AND r.index = 0
      AND (a_a.email LIKE '%@gmail.com' OR a_b.email LIKE '%@gmail.com')`
);
console.log(JSON.stringify(rows, null, 1));

if (rows[0]) {
  const { rows: games } = await q(
    `SELECT id, game_number, status FROM match_game WHERE match_id = $1 ORDER BY game_number`,
    [rows[0].match_id]
  );
  console.log("\n== match_games ==", games);
}

await client.end();
