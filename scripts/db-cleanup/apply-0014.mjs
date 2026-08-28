/**
 * Aplica migrations/0014_payment_deadline.sql directo a la DB
 * vía el pooler de Supabase (mismo mecanismo que apply-0012/0013).
 *
 * Uso: node scripts/db-cleanup/apply-0014.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "./connect.mjs";

const sqlFile = path.resolve(import.meta.dirname, "../../migrations/0014_payment_deadline.sql");

async function main() {
  const sql = fs.readFileSync(sqlFile, "utf8");
  const client = await connectDb();
  try {
    await client.query(sql);
    console.log("✓ 0014 aplicado: payment_window_hours + payment_deadline_at + status_reason");

    const cols = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE (table_name = 'tournament_edition' AND column_name = 'payment_window_hours')
          OR (table_name = 'team_registration' AND column_name IN ('payment_deadline_at', 'status_reason'))
       ORDER BY table_name, column_name`
    );
    console.log("  columnas:", cols.rows.map((r) => `${r.table_name}.${r.column_name}`).join(", "));
    if (cols.rows.length < 3) process.exitCode = 1;

    const idx = await client.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'team_registration' AND indexname = 'team_reg_unpaid_deadline_idx'`
    );
    console.log(idx.rows.length === 1 ? "✓ índice parcial del cron creado" : "✗ falta índice team_reg_unpaid_deadline_idx");
    if (idx.rows.length !== 1) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// process.exit explícito: en Windows el pool puede dejar el event loop vivo.
main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error("✗", e.message ?? e);
    process.exit(1);
  });
