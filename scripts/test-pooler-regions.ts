import postgres from "postgres";

const REF = "tomlvgzwleolsxksiygs";
const PASS = "RebelbyteEra1-";

async function tryRegion(region: string, port: number): Promise<boolean> {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const user = `postgres.${REF}`;
  const url = `postgresql://${user}:${encodeURIComponent(PASS)}@${host}:${port}/postgres`;
  try {
    const sql = postgres(url, { connect_timeout: 8 } as never);
    const r = await sql`SELECT 1 as ok`;
    console.log(`✓ ${region}:${port} → OK`);
    await sql.end();
    return true;
  } catch (e) {
    console.log(`✗ ${region}:${port} → ${(e as Error).message.slice(0, 80)}`);
    return false;
  }
}

async function main() {
  const regions = [
    "us-east-1", "us-west-1", "us-east-2", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
    "sa-east-1", "ca-central-1",
  ];
  for (const r of regions) {
    const ok5432 = await tryRegion(r, 5432);
    const ok6543 = await tryRegion(r, 6543);
    if (ok5432 || ok6543) {
      console.log(`\n>>> Región correcta: ${r}`);
      process.exit(0);
    }
  }
  console.log("\nNo se pudo conectar a ninguna región.");
  process.exit(1);
}

main();
