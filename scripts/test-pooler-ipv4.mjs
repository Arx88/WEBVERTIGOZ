import postgres from "postgres";

const REF = "tomlvgzwleolsxksiygs";
const PASS = "RebelbyteEra1-";

const regions = ["us-east-1", "us-west-1", "eu-west-1", "eu-central-1", "ap-southeast-1"];

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  console.log(`\n→ ${region} (user postgres.${REF})...`);
  try {
    const sql = postgres(`postgresql://postgres.${REF}:${PASS}@${host}:6543/postgres`, { connect_timeout: 8 });
    const r = await sql`SELECT 1 as ok`;
    console.log(`✓ OK:`, r);
    await sql.end();
    break;
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 80)}`);
  }
  
  // También probar con user solo "postgres"
  console.log(`→ ${region} (user postgres solo)...`);
  try {
    const sql = postgres(`postgresql://postgres:${PASS}@${host}:6543/postgres`, { connect_timeout: 8 });
    const r = await sql`SELECT 1 as ok`;
    console.log(`✓ OK:`, r);
    await sql.end();
    break;
  } catch (e) {
    console.log(`✗ ${e.message.slice(0, 80)}`);
  }
}
