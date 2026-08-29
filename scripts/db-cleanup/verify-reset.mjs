/**
 * Verificación post-reset de la llave de prueba.
 * SOLO LECTURA. Uso: node scripts/db-cleanup/verify-reset.mjs
 */
import { connectDb } from "./connect.mjs";

const MATCH_ID = "d8d2edbf-7468-4823-bd74-d1f88a3537a6";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows: match } = await q(
  `SELECT id, status, score_a, score_b, winner_team_id, scheduled_at_start FROM "match" WHERE id = $1`,
  [MATCH_ID]
);
console.log("== Match de prueba ==", match);

const { rows: games } = await q(
  `SELECT count(*)::int AS games FROM match_game WHERE match_id = $1`,
  [MATCH_ID]
);
console.log("== match_games restantes ==", games[0]);

const { rows: parent } = await q(
  `SELECT p.id, p.parent_match_a_id, p.parent_match_b_id,
          m.team_a_id, m.team_b_id, m.status
     FROM "match" p
     LEFT JOIN "match" m ON m.id = COALESCE(p.parent_match_a_id, p.parent_match_b_id)
    WHERE p.id = $1`,
  [MATCH_ID]
);
console.log("== Padre (Octavos) que recibía al ganador ==", parent);

const { rows: orphans } = await q(
  `SELECT m.id, m.slot_index, m.status
     FROM "match" m
     JOIN round r ON r.id = m.round_id
    WHERE r.bracket_id = 'e0150d1a-89f1-4a29-a97f-111ab4764ab7'
      AND r.index = 1
      AND (m.team_a_id IS NOT NULL OR m.team_b_id IS NOT NULL)`
);
console.log("== Octavos con equipos ya definidos (esperado: solo el slot del otro finished) ==", orphans);

await client.end();
console.log("\n— verificación completa");
