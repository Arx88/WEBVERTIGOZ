#!/usr/bin/env node
/**
 * Aplica drizzle/2026-09-01-notifications.sql a la DB de Supabase.
 * Uso: node scripts/apply-notifications.mjs
 * Requiere DATABASE_URL (o SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL) en .env.local
 */

import fs from "fs";
import path from "path";
import postgres from "postgres";

function readEnvLocal() {
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...readEnvLocal(), ...process.env };

let sql = null;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = env.SUPABASE_DB_PASSWORD;
const hosts = ["aws-1-eu-west-1", "aws-1-us-east-1", "aws-0-eu-west-1", "aws-0-us-east-1"];

for (const hostBase of hosts) {
  for (const port of [5432, 6543]) {
    if (!ref || !password) break;
    const candidate = postgres(
      `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${hostBase}.pooler.supabase.com:${port}/postgres`,
      { max: 1, prepare: false, connect_timeout: 5, idle_timeout: 10 },
    );
    try {
      await candidate`SELECT 1 as ok`;
      sql = candidate;
      console.log(`Conectado a ${hostBase}.pooler.supabase.com:${port}`);
      break;
    } catch {
      try { await candidate.end(); } catch {}
    }
  }
  if (sql) break;
}

if (!sql) {
  const direct = env.DATABASE_URL
    ? postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 })
    : null;
  if (direct) {
    try {
      await direct`SELECT 1 as ok`;
      sql = direct;
      console.log("Conectado vía DATABASE_URL");
    } catch { try { await direct.end(); } catch {} }
  }
}

if (!sql) {
  console.error("✗ No pude conectar a la DB (probé poolers y DATABASE_URL)");
  process.exit(1);
}

const sqlFile = process.argv[2] || "drizzle/2026-09-01-notifications.sql";
const migration = fs.readFileSync(sqlFile, "utf-8");

console.log(`Aplicando ${sqlFile} (${migration.length} chars)...`);
try {
  await sql.unsafe(migration);
  console.log("✓ Migración aplicada");
} catch (err) {
  console.error("✗ Error:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
