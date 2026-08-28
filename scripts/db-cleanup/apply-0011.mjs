/**
 * Aplica migrations/0011_propaga_ganador_tardio.sql directo a la DB
 * vía el pooler de Supabase (mismo mecanismo que el resto de db-cleanup).
 *
 * Uso: node scripts/db-cleanup/apply-0011.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "./connect.mjs";

const sqlFile = path.resolve(import.meta.dirname, "../../migrations/0011_propaga_ganador_tardio.sql");

async function main() {
  const sql = fs.readFileSync(sqlFile, "utf8");
  const client = await connectDb();
  try {
    await client.query(sql);
    console.log("✓ 0011 aplicado: propagate_match_winner cubre ganador tardío");

    const { rows } = await client.query(
      `SELECT prosrc FROM pg_proc WHERE proname = 'propagate_match_winner'`
    );
    const src = rows[0]?.prosrc ?? "";
    const ok = rows.length === 1 && src.includes("OLD.winner_team_id IS DISTINCT FROM NEW.winner_team_id");
    console.log(ok ? "✓ verificado: la función incluye la asignación tardía" : "✗ la función NO incluye la asignación tardía");
    return ok ? 0 : 1;
  } finally {
    await client.end();
  }
}

// process.exit explícito: en Windows el pool puede dejar el event loop vivo.
main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error("✗", e.message ?? e);
    process.exit(1);
  });
