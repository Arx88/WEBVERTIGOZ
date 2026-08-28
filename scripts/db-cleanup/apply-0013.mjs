/**
 * Aplica migrations/0013_cupo_waitlist.sql directo a la DB
 * vía el pooler de Supabase (mismo mecanismo que apply-0012).
 *
 * Uso: node scripts/db-cleanup/apply-0013.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "./connect.mjs";

const sqlFile = path.resolve(import.meta.dirname, "../../migrations/0013_cupo_waitlist.sql");

async function main() {
  const sql = fs.readFileSync(sqlFile, "utf8");
  const client = await connectDb();
  try {
    await client.query(sql);
    console.log("✓ 0013 aplicado: tabla cupo_waitlist + índices + RLS sin policies");

    const tbl = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'cupo_waitlist'`
    );
    console.log(tbl.rows[0].n === 1 ? "✓ tabla cupo_waitlist creada" : "✗ falta cupo_waitlist");

    const idx = await client.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'cupo_waitlist' ORDER BY indexname`
    );
    console.log("  índices:", idx.rows.map((r) => r.indexname).join(", "));

    const rls = await client.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'cupo_waitlist'`
    );
    console.log(rls.rows[0]?.relrowsecurity ? "✓ RLS activado (sin policies → solo service role)" : "✗ RLS no activado");

    if (tbl.rows[0].n !== 1 || !rls.rows[0]?.relrowsecurity) process.exitCode = 1;
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
