/**
 * Reemplazo total del catálogo de emblemas.
 *
 * 1. Lee los PNG de la carpeta indicada, deduplica por hash y optimiza a 512×512 (sharp).
 * 2. Sube al bucket público "emblems" con SERVICE ROLE.
 * 3. Inserta las filas nuevas en la tabla emblem.
 * 4. Reasigna team_account.emblem_id: match por nombre (Águila→Águila…) y el resto
 *    con los emblemas sobrantes sin repetir, en orden de creación del equipo.
 * 5. Borra las filas viejas del catálogo.
 *
 * Idempotencia: si ya existen emblemas marcados con category="2026-heraldica", aborta.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { getEnv, connectDb } from "./connect.mjs";

const SOURCE_DIR = process.argv[2];
if (!SOURCE_DIR || !fs.existsSync(SOURCE_DIR)) {
  console.error("Uso: node scripts/db-cleanup/replace-emblems.mjs \"<carpeta de PNGs>\"");
  process.exit(1);
}

const CATEGORY = "2026-heraldica";

/** Nombre visible (español) para cada archivo de la carpeta. */
const NAMES = {
  "16_bear.png": "Oso",
  "16_crab.png": "Cangrejo",
  "16_dolphin.png": "Delfín",
  "16_falcon.png": "Halcón",
  "16_goat.png": "Cabra",
  "16_kraken.png": "Kraken",
  "16_lion.png": "León Dorado",
  "16_owl.png": "Búho",
  "16_pegasus.png": "Pegaso",
  "16_seahorse.png": "Caballito de Mar",
  "16_serpent.png": "Serpiente",
  "16_shark.png": "Tiburón",
  "16_stag2.png": "Ciervo",
  "16_tiger.png": "Tigre",
  "16_turtle.png": "Tortuga",
  "16_unicorn.png": "Unicornio",
  "bear_black_cutout.png": "Oso Negro",
  "cut_boar.png": "Jabalí",
  "cut_bull.png": "Toro",
  "cut_eagle.png": "Águila",
  "cut_fox.png": "Zorro",
  "cut_griffin.png": "Grifo",
  "cut_horse.png": "Caballo",
  "cut_phoenix.png": "Fénix",
  "cut_ram.png": "Carnero",
  "cut_raven.png": "Cuervo",
  "cut_wolf2.png": "Lobo",
  "dragon_purple_cutout.png": "Dragón Púrpura",
  "dragon_shield_cutout.png": "Dragón",
  "lion_blue_shield_cutout2.png": "León Azul",
  "lion_shield_cutout.png": "León",
  "lion_shield_cutout (1).png": null, // duplicado exacto de lion_shield_cutout.png
  "stag_green_cutout.png": "Ciervo Esmeralda",
  "wolf_shield_cutout.png": "Lobo Gris",
};

/** Match por nombre: equipo con emblema viejo X → emblema nuevo Y. */
const MATCH_BY_NAME = {
  "Águila": "Águila",
  "Dragón": "Dragón",
  "León": "León",
  "Lobo": "Lobo",
  "Cuervo": "Cuervo",
  "Oso": "Oso",
  "Halcón": "Halcón",
  "Serpiente": "Serpiente",
  "Toro": "Toro",
  "Unicornio": "Unicornio",
  "Fénix": "Fénix",
  "Caballero": "Grifo", // bestia heráldica por antonomasia
};

const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const { env } = getEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── 0. Estado actual ──────────────────────────────────────────────────────────
const db = await connectDb();
const existing = await db.query("SELECT count(*)::int n FROM emblem WHERE category = $1", [CATEGORY]);
if (existing.rows[0].n > 0) {
  console.error(`Aborta: ya hay ${existing.rows[0].n} emblemas de categoría ${CATEGORY}.`);
  process.exit(1);
}

// ── 1. Leer + deduplicar + optimizar ─────────────────────────────────────────
const files = fs.readdirSync(SOURCE_DIR).filter((f) => /\.png$/i.test(f));
const seen = new Map(); // hash -> nombre elegido
const prepared = [];    // { name, slug, buffer }
for (const f of files) {
  const name = NAMES[f];
  if (name === null) { console.log(`· salto ${f} (duplicado)`); continue; }
  if (!name) { console.log(`· salto ${f} (sin nombre en el mapa)`); continue; }
  const buf = fs.readFileSync(path.join(SOURCE_DIR, f));
  const hash = crypto.createHash("md5").update(buf).digest("hex");
  if (seen.has(hash)) { console.log(`· salto ${f} (idéntico a ${seen.get(hash)})`); continue; }
  seen.set(hash, f);
  const buffer = await sharp(buf)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  prepared.push({ name, slug: slugify(name), buffer });
}
if (prepared.length === 0) { console.error("No quedó ningún emblema para subir."); process.exit(1); }
prepared.sort((a, b) => a.name.localeCompare(b.name, "es"));
console.log(`▸ ${prepared.length} emblemas únicos listos (de ${files.length} archivos)`);

// ── 2. Subir al bucket ───────────────────────────────────────────────────────
for (const p of prepared) {
  const storagePath = `${p.slug}.png`;
  const { error } = await supabase.storage.from("emblems").upload(storagePath, p.buffer, {
    contentType: "image/png", upsert: true,
  });
  if (error) { console.error(`✗ subiendo ${storagePath}: ${error.message}`); process.exit(1); }
  console.log(`↑ ${storagePath} (${Math.round(p.buffer.length / 1024)} KB)`);
}

// ── 3. Insertar catálogo nuevo ───────────────────────────────────────────────
const base = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/emblems`;
const inserted = []; // { id, name }
for (let i = 0; i < prepared.length; i++) {
  const p = prepared[i];
  const r = await db.query(
    `INSERT INTO emblem (name, image_url, category, is_active, sort_order)
     VALUES ($1, $2, $3, true, $4) RETURNING id, name`,
    [p.name, `${base}/${p.slug}.png`, CATEGORY, i + 1]
  );
  inserted.push(r.rows[0]);
}
console.log(`▸ ${inserted.length} filas insertadas en emblem`);

// ── 4. Reasignar equipos ─────────────────────────────────────────────────────
const byName = new Map(inserted.map((e) => [e.name, e.id]));
const teams = await db.query(`
  SELECT t.id, t.name AS team_name, e.name AS old_emblem
  FROM team_account t LEFT JOIN emblem e ON e.id = t.emblem_id
  ORDER BY t.created_at ASC
`);
const used = new Set();
let matched = 0;
for (const t of teams.rows) {
  const target = t.old_emblem ? MATCH_BY_NAME[t.old_emblem] : undefined;
  if (target && byName.has(target) && !used.has(target)) {
    await db.query("UPDATE team_account SET emblem_id = $1, updated_at = now() WHERE id = $2", [byName.get(target), t.id]);
    used.add(target); matched++;
    console.log(`⇄ ${t.team_name}: ${t.old_emblem} → ${target}`);
  } else {
    await db.query("UPDATE team_account SET emblem_id = NULL, updated_at = now() WHERE id = $1", [t.id]);
  }
}
// Repartir los sobrantes sin repetir
const leftovers = inserted.filter((e) => !used.has(e.name));
const orphans = teams.rows.filter((t) => !t.old_emblem || !MATCH_BY_NAME[t.old_emblem] || !byName.has(MATCH_BY_NAME[t.old_emblem]) || used.has(MATCH_BY_NAME[t.old_emblem]));
let li = 0;
for (const t of orphans) {
  if (li >= leftovers.length) { console.warn(`⚠ sin emblemas sobrantes para ${t.team_name}`); break; }
  const e = leftovers[li++];
  await db.query("UPDATE team_account SET emblem_id = $1, updated_at = now() WHERE id = $2", [e.id, t.id]);
  used.add(e.name);
  console.log(`★ ${t.team_name}: ${t.old_emblem ?? "—"} → ${e.name} (reparto)`);
}

// ── 5. Borrar catálogo viejo ─────────────────────────────────────────────────
const del = await db.query("DELETE FROM emblem WHERE category IS DISTINCT FROM $1 RETURNING name", [CATEGORY]);
console.log(`▸ ${del.rows.length} emblemas viejos eliminados: ${del.rows.map((r) => r.name).join(", ")}`);

// ── 6. Verificación ──────────────────────────────────────────────────────────
const check = await db.query(`
  SELECT
    (SELECT count(*)::int FROM emblem) AS total,
    (SELECT count(*)::int FROM team_account WHERE emblem_id IS NOT NULL) AS teams_with,
    (SELECT count(*)::int FROM team_account) AS teams_total,
    (SELECT count(*)::int FROM (SELECT emblem_id FROM team_account WHERE emblem_id IS NOT NULL GROUP BY emblem_id HAVING count(*) > 1) d) AS dupes
`);
const c = check.rows[0];
console.log(`\n■ FINAL: ${c.total} emblemas | ${c.teams_with}/${c.teams_total} equipos con escudo | repetidos: ${c.dupes}`);
await db.end();
