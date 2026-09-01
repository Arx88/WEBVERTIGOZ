/**
 * Busca eleman3007 y lista cuentas/equipos reales (no @vertigo.test).
 * SOLO LECTURA. Uso: node scripts/db-cleanup/inspect-eleman.mjs
 */
import { connectDb } from "./connect.mjs";

const client = await connectDb();
const q = (text, params) => client.query(text, params);

const { rows: eleman } = await q(
  `SELECT id, email, role, display_name FROM account WHERE email ILIKE '%eleman%'`
);
console.log("== cuenta eleman ==");
console.log(JSON.stringify(eleman, null, 1));

const { rows: all } = await q(
  `SELECT ta.id AS team_id, ta.name, a.email, tr.id AS reg_id, tr.status, tr.seed
     FROM team_account ta
     LEFT JOIN account a ON a.id = ta.owner_id
     LEFT JOIN team_registration tr ON tr.team_account_id = ta.id
    ORDER BY a.email NULLS LAST, ta.name`
);
console.log("\n== todos los equipos ==");
console.log(JSON.stringify(all, null, 1));

await client.end();
