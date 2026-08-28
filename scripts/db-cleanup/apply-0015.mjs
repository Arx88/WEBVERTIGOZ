/**
 * Aplica migrations/0015_waitlist_admin_read.sql directo a la DB
 * vía el pooler de Supabase (mismo mecanismo que apply-0012..0014).
 *
 * Uso: node scripts/db-cleanup/apply-0015.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { connectDb } from "./connect.mjs";

const sqlFile = path.resolve(import.meta.dirname, "../../migrations/0015_waitlist_admin_read.sql");

async function main() {
  const sql = fs.readFileSync(sqlFile, "utf8");
  const client = await connectDb();
  try {
    await client.query(sql);
    console.log("✓ 0015 aplicado: policy cupo_waitlist_admin_read");

    const pol = await client.query(
      `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'cupo_waitlist'`
    );
    console.log("  policies:", pol.rows.map((r) => `${r.policyname}(${r.cmd})`).join(", ") || "(ninguna)");
    if (!pol.rows.some((r) => r.policyname === "cupo_waitlist_admin_read")) process.exitCode = 1;
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
