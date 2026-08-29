/**
 * Ver los 16 matches de Ronda 1 del bracket activo — nombres de equipos.
 * SOLO LECTURA. Uso: node scripts/db-cleanup/inspect-r1.mjs
 */
import { connectDb } from "./connect.mjs";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows } = await q(
  `SELECT m.slot_index, m.status, m.scheduled_at_start,
          ta.name AS team_a, tb.name AS team_b
     FROM "match" m
     JOIN round r ON r.id = m.round_id
     LEFT JOIN team_registration tra ON tra.id = m.team_a_id
     LEFT JOIN team_registration trb ON trb.id = m.team_b_id
     LEFT JOIN team_account ta ON ta.id = tra.team_account_id
     LEFT JOIN team_account tb ON tb.id = trb.team_account_id
    WHERE r.bracket_id = 'e0150d1a-89f1-4a29-a97f-111ab4764ab7' AND r.index = 0
    ORDER BY m.slot_index`
);
console.log(JSON.stringify(rows, null, 1));
await client.end();
