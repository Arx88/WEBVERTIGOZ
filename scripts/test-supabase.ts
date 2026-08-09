import postgres from "postgres";

/**
 * Script para probar conexión a Supabase via pooler (IPv4).
 */

const SUPABASE_REF = "tomlvgzwleolsxksiygs";
const SUPABASE_DB_PASSWORD = "RebelbyteEra1-";

async function tryConnect(region: string): Promise<boolean> {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const user = `postgres.${SUPABASE_REF}`;
  const url = `postgresql://${user}:${encodeURIComponent(SUPABASE_DB_PASSWORD)}@${host}:5432/postgres`;
  console.log(`\nProbando pooler ${host} (user: ${user})...`);

  try {
    const sql = postgres(url, { connect_timeout: 10 } as never);
    const r = await sql`SELECT current_database() as db, version() as v`;
    console.log(`✓ ${region} → CONEXIÓN OK`);
    console.log(`  DB: ${r[0].db}`);
    console.log(`  Version: ${String(r[0].v).slice(0, 80)}`);
    await sql.end();
    return true;
  } catch (e) {
    console.log(`✗ ${region} → ${(e as Error).message.slice(0, 100)}`);
    return false;
  }
}

async function main() {
  const regions = [
    "us-east-1",
    "us-west-1",
    "eu-west-1",
    "eu-central-1",
    "ap-southeast-1",
    "ap-northeast-1",
    "sa-east-1",
  ];
  for (const r of regions) {
    const ok = await tryConnect(r);
    if (ok) {
      console.log(`\n>>> Región correcta: ${r}`);
      process.exit(0);
    }
  }
  console.log("\nNo se pudo conectar a ninguna región. Probá conexión directa o revisá credenciales.");
  process.exit(1);
}

main();


