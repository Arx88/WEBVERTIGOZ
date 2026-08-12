/**
 * Actualiza los emblemas en la DB para apuntar a los SVG reales
 * generados (en vez de /emblems/placeholder.svg que no existe).
 * Matchea por nombre (los 12 ya existen en DB).
 *
 * Uso: npx tsx scripts/update-emblems-urls.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] = m[2];
    }
  }
}
loadEnv();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MAP: { name: string; slug: string }[] = [
  { name: "Caballero", slug: "caballero" },
  { name: "Águila", slug: "aguila" },
  { name: "Dragón", slug: "dragon" },
  { name: "León", slug: "leon" },
  { name: "Lobo", slug: "lobo" },
  { name: "Cuervo", slug: "cuervo" },
  { name: "Oso", slug: "oso" },
  { name: "Halcón", slug: "halcon" },
  { name: "Serpiente", slug: "serpiente" },
  { name: "Toro", slug: "toro" },
  { name: "Unicornio", slug: "unicornio" },
  { name: "Fénix", slug: "fenix" },
];

async function main() {
  let updated = 0;
  for (const { name, slug } of MAP) {
    const { error } = await supabase
      .from("emblem")
      .update({ image_url: `/emblems/${slug}.svg` })
      .ilike("name", name);
    if (error) console.error(`✗ ${name}: ${error.message}`);
    else { updated++; console.log(`✓ ${name} → /emblems/${slug}.svg`); }
  }
  console.log(`\n${updated}/${MAP.length} emblemas actualizados.`);

  const { data } = await supabase.from("emblem").select("name, image_url").limit(20);
  console.log("\nEstado actual de emblems:");
  (data ?? []).forEach((e) => console.log(`  ${e.name}: ${e.image_url}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
