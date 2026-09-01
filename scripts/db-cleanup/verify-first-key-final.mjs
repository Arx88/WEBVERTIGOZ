/**
 * Verificación final: eleman3007 vs PAPÁ de cristian, sin nada sorteado.
 * SOLO LECTURA. Uso: node scripts/db-cleanup/verify-first-key-final.mjs
 */
import { connectDb } from "./connect.mjs";

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows: match } = await q(
  `SELECT m.id, m.status, m.score_a, m.score_b, m.winner_team_id, m.draw_seed,
          m.scheduled_at_start,
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
console.log("== Primera llave ==");
console.log(JSON.stringify(match, null, 1));

const { rows: counts } = await q(
  `SELECT
     (SELECT count(*)::int FROM match_game WHERE match_id = $1) AS games,
     (SELECT count(*)::int FROM roulette_draw d JOIN match_game g ON g.id = d.match_game_id WHERE g.match_id = $1) AS draws`,
  [MATCH_ID]
);
console.log(`\ngames: ${counts[0].games} · draws: ${counts[0].draws}`);

// Roster de ambos equipos
const { rows: rosters } = await q(
  `SELECT ta.name AS team, a.email, pr.display_name, pr.is_captain
     FROM "match" m
     JOIN team_registration tr ON tr.id IN (m.team_a_id, m.team_b_id)
     JOIN team_account ta ON ta.id = tr.team_account_id
     JOIN account a ON a.id = ta.owner_id
     LEFT JOIN player_registration pr ON pr.team_registration_id = tr.id
    WHERE m.id = $1
    ORDER BY ta.name, pr.display_name`,
  [MATCH_ID]
);
console.log("\n== Rosters ==");
console.log(JSON.stringify(rosters, null, 1));

// Padre
const { rows: parent } = await q(
  `SELECT p.id, p.status, p.team_a_id, p.team_b_id
     FROM "match" p
    WHERE p.parent_match_a_id = $1 OR p.parent_match_b_id = $1`,
  [MATCH_ID]
);
console.log("\n== Padre (Octavos) ==");
console.log(JSON.stringify(parent, null, 1));

await client.end();
