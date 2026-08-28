/**
 * Aplica migrations/0010_forfeit_propaga_ganador.sql directo a la DB
 * vía el pooler de Supabase (mismo mecanismo que el resto de db-cleanup).
 *
 * Uso: node scripts/db-cleanup/apply-0010.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "./connect.mjs";

const sqlFile = path.resolve(import.meta.dirname, "../../migrations/0010_forfeit_propaga_ganador.sql");

async function main() {
  const sql = fs.readFileSync(sqlFile, "utf8");
  const client = await connectDb();
  try {
    await client.query(sql);
    console.log("✓ 0010 aplicado: propagate_match_winner ahora cubre forfeit");

    const { rows } = await client.query(
      `SELECT prosrc FROM pg_proc WHERE proname = 'propagate_match_winner'`
    );
    const ok = rows.length === 1 && rows[0].prosrc.includes("'forfeit'");
    console.log(ok ? "✓ verificado: la función incluye forfeit" : "✗ la función NO incluye forfeit");
    if (!ok) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("✗", e.message ?? e);
  process.exit(1);
});
