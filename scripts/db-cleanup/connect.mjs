/**
 * Conexión a la base VÉRTIGO vía Supabase Pooler (descubre la región).
 * Export: getEnv(), getRef(), connectDb()
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const REGIONS = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "sa-east-1",
  "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1", "eu-north-2",
  "ap-south-1", "ap-south-2", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "ap-east-1", "me-central-1", "me-south-1", "af-south-1", "il-central-1",
];
const PREFIXES = [0, 1, 2];

export function getEnv() {
  const env = {};
  for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) env[m[1]] = m[2];
  }
  const ref = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!ref || !env.SUPABASE_DB_PASSWORD) {
    throw new Error("No pude armar la conexión: falta ref del proyecto o SUPABASE_DB_PASSWORD en .env.local");
  }
  return { env, ref };
}

let cachedRegion = null;

export async function findRegion(ref) {
  const cache = path.resolve(import.meta.dirname, ".region");
  if (fs.existsSync(cache)) {
    const r = fs.readFileSync(cache, "utf8").trim();
    if (r) return r; // host completo, ej: aws-1-eu-west-1
  }
  if (cachedRegion) return cachedRegion;

  const { Client } = pg;
  outer: for (const p of PREFIXES) {
    for (const region of REGIONS) {
    const host = `aws-${p}-${region}.pooler.supabase.com`;
    const c = new Client({
      host, port: 5432, user: `postgres.${ref}`, password: process.env.SUPABASE_DB_PASSWORD,
      database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
    });
    try {
      await c.connect();
      await c.query("SELECT 1");
      await c.end();
      const host = `aws-${p}-${region}`;
      fs.writeFileSync(cache, host);
      cachedRegion = host;
      console.log(`— pooler OK en: ${host}.pooler.supabase.com`);
      return host;
    } catch (e) {
      try { await c.end(); } catch {}
      const msg = String(e.message ?? "");
      if (/Tenant or user not found|password authentication/i.test(msg)) continue; // región equivocada
      // otra clase de error (p.ej. red): igual probamos la próxima
      if (/timeout|ENOTFOUND|ECONNREFUSED/i.test(msg)) continue;
      console.error(`  [${host}] error inesperado:`, msg.slice(0, 100));
    }}
  }
  throw new Error("No encontré la región del pooler en ninguna región conocida");
}

export async function connectDb() {
  const { ref } = getEnv();
  const host = await findRegion(ref);
  const client = new pg.Client({
    host: `${host}.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}
