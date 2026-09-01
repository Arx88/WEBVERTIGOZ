/**
 * Inspección previa a la limpieza de la primera llave.
 * SOLO LECTURA. Uso: node scripts/db-cleanup/inspect-first-key-clean.mjs
 */
import { connectDb } from "./connect.mjs";

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

// 1) Las dos cuentas objetivo
const { rows: accounts } = await q(
  `SELECT a.id, a.email, a.display_name, a.role
     FROM account a
    WHERE a.email IN ('eleman3007@gmail.com', 'damianemponce@gmail.com')`
);
console.log("== Cuentas objetivo ==");
console.log(JSON.stringify(accounts, null, 1));

// 2) Sus equipos y registraciones
const { rows: teams } = await q(
  `SELECT ta.id AS team_id, ta.name, a.email,
          tr.id AS reg_id, tr.status, tr.tournament_edition_id
     FROM team_account ta
     JOIN account a ON a.id = ta.owner_id
     LEFT JOIN team_registration tr ON tr.team_account_id = ta.id
    WHERE a.email IN ('eleman3007@gmail.com', 'damianemponce@gmail.com')`
);
console.log("\n== Equipos / registraciones ==");
console.log(JSON.stringify(teams, null, 1));

// 3) Estado actual de la primera llave
const { rows: match } = await q(
  `SELECT id, slot_index, status, format, score_a, score_b, winner_team_id,
          scheduled_at_start, draw_seed, ready_lineup_a_at, ready_lineup_b_at,
          team_a_id, team_b_id, parent_match_a_id, parent_match_b_id
     FROM "match" WHERE id = $1`,
  [MATCH_ID]
);
console.log("\n== Match (primera llave) ==");
console.log(JSON.stringify(match, null, 1));

if (match[0]) {
  // ¿Quién es quién en los equipos actuales?
  const ids = [match[0].team_a_id, match[0].team_b_id].filter(Boolean);
  if (ids.length) {
    const { rows: teams } = await q(
      `SELECT tr.id AS reg_id, ta.name, a.email
         FROM team_registration tr
         JOIN team_account ta ON ta.id = tr.team_account_id
         JOIN account a ON a.id = ta.owner_id
        WHERE tr.id = ANY($1::uuid[])`,
      [ids]
    );
    console.log("\n== Equipos actuales en la llave ==");
    console.log(JSON.stringify(teams, null, 1));
  }

  // 4) Partidas y draws de la llave
  const { rows: games } = await q(
    `SELECT id, game_number, status, map, player_mode, lineup_a, lineup_b, winner_team_id
       FROM match_game WHERE match_id = $1 ORDER BY game_number`,
    [MATCH_ID]
  );
  console.log("\n== match_games ==");
  console.log(JSON.stringify(games, null, 1));

  const { rows: draws } = await q(
    `SELECT d.id, d.status, d.match_game_id
       FROM roulette_draw d
       JOIN match_game g ON g.id = d.match_game_id
      WHERE g.match_id = $1`,
    [MATCH_ID]
  );
  console.log("\n== roulette_draws de la llave ==");
  console.log(JSON.stringify(draws, null, 1));
}

// 5) Match padre (Octavos) por si propagó ganador
const { rows: parent } = await q(
  `SELECT p.id, p.status, p.team_a_id, p.team_b_id, p.score_a, p.score_b
     FROM "match" p
    WHERE p.parent_match_a_id = $1 OR p.parent_match_b_id = $1`,
  [MATCH_ID]
);
console.log("\n== Match padre (Octavos) ==");
console.log(JSON.stringify(parent, null, 1));

await client.end();
