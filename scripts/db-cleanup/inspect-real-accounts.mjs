/**
 * Emails reales (no @vertigo.test) dueños de equipos — solo lectura.
 * Uso: node scripts/db-cleanup/inspect-real-accounts.mjs
 */
import { connectDb } from "./connect.mjs";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows } = await q(
  `SELECT DISTINCT a.email, a.role
     FROM account a
     JOIN team_account ta ON ta.owner_id = a.id
    WHERE a.email NOT LIKE '%@vertigo.test'
    ORDER BY a.email`
);
console.log(JSON.stringify(rows, null, 1));
await client.end();
