/**
 * Aplica migrations/0012_aoe2_match_sync.sql directo a la DB
 * vía el pooler de Supabase (mismo mecanismo que el resto de db-cleanup).
 *
 * Uso: node scripts/db-cleanup/apply-0012.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "./connect.mjs";

const sqlFile = path.resolve(import.meta.dirname, "../../migrations/0012_aoe2_match_sync.sql");

async function main() {
  const sql = fs.readFileSync(sqlFile, "utf8");
  const client = await connectDb();
  try {
    await client.query(sql);
    console.log("✓ 0012 aplicado: columnas aoe2 en match_game + tabla match_game_analysis + bucket replays");

    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'match_game' AND column_name LIKE 'aoe2%' OR (table_name = 'match_game' AND column_name = 'rec_storage_path')
       ORDER BY column_name`
    );
    console.log("  columnas match_game:", cols.rows.map((r) => r.column_name).join(", "));

    const tbl = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'match_game_analysis'`
    );
    console.log(tbl.rows[0].n === 1 ? "✓ tabla match_game_analysis creada" : "✗ falta match_game_analysis");

    const bucket = await client.query(`SELECT id, public FROM storage.buckets WHERE id = 'replays'`);
    console.log(bucket.rows.length === 1 ? `✓ bucket replays (public=${bucket.rows[0].public})` : "✗ falta bucket replays");

    if (cols.rows.length < 4 || tbl.rows[0].n !== 1 || bucket.rows.length !== 1) process.exitCode = 1;
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
