/**
 * Listar todos los team_account con el email del dueño.
 * SOLO LECTURA. Uso: node scripts/db-cleanup/inspect-owners.mjs
 */
import { connectDb } from "./connect.mjs";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows } = await q(
  `SELECT ta.id, ta.name, a.email AS owner_email, tr.status AS reg_status, tr.seed, tr.id AS reg_id
     FROM team_account ta
     LEFT JOIN account a ON a.id = ta.owner_id
     LEFT JOIN team_registration tr ON tr.team_account_id = ta.id
    ORDER BY a.email NULLS LAST, ta.name`
);
console.log(JSON.stringify(rows, null, 1));
await client.end();
