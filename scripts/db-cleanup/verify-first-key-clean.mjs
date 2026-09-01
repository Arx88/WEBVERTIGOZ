/**
 * Verificación final tras la limpieza de la primera llave.
 * SOLO LECTURA. Uso: node scripts/db-cleanup/verify-first-key-clean.mjs
 */
import { connectDb } from "./connect.mjs";

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows: match } = await q(
  `SELECT m.id, m.status, m.score_a, m.score_b, m.winner_team_id, m.draw_seed,
          ta.name AS team_a, tb.name AS team_b,
          a_a.email AS email_a, a_b.email AS email_b
     FROM "match" m
     LEFT JOIN team_registration tra ON tra.id = m.team_a_id
     LEFT JOIN team_registration trb ON trb.id = m.team_b_id
     LEFT JOIN team_account ta ON ta.id = tra.team_account_id
     LEFT JOIN team_account tb ON tb.id = trb.team_account_id
     LEFT JOIN account a_a ON a_a.id = ta.owner_id
     LEFT JOIN account a_b ON a_b.id = tb.owner_id
    WHERE m.id = $1`,
  [MATCH_ID]
);
console.log("== Match final ==");
console.log(JSON.stringify(match, null, 1));

const { rows: games } = await q(
  `SELECT count(*)::int AS cnt FROM match_game WHERE match_id = $1`,
  [MATCH_ID]
);
console.log(`\nmatch_games restantes: ${games[0].cnt}`);

const { rows: draws } = await q(
  `SELECT count(*)::int AS cnt FROM roulette_draw d
   JOIN match_game g ON g.id = d.match_game_id
   WHERE g.match_id = $1`,
  [MATCH_ID]
);
console.log(`roulette_draws restantes: ${draws[0].cnt}`);

const { rows: parent } = await q(
  `SELECT p.id, p.status, p.team_a_id, p.team_b_id
     FROM "match" p
    WHERE p.parent_match_a_id = $1 OR p.parent_match_b_id = $1`,
  [MATCH_ID]
);
console.log(`\n== Padre ==`);
console.log(JSON.stringify(parent, null, 1));

await client.end();
