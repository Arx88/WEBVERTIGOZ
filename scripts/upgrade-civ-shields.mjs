/**
 * Baja los escudos HD de civs desde la carpeta de Drive del staff y los
 * convierte a WebP con alpha en public/civs/ (mismo nombre que ya usa el
 * juego: <civ>.webp). Las civs custom (mapuche/muiscas/tupis) no están en
 * Drive y conservan su archivo actual.
 *
 *   node scripts/upgrade-civ-shields.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const pairs = JSON.parse(fs.readFileSync(".tmp-drive-files.json", "utf8"));
const OUT = "public/civs";

async function download(id) {
  const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, {
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 500 || buf.subarray(0, 4).toString("binary").includes("<htm")) {
    throw new Error("respuesta no es una imagen (posible página de confirm)");
  }
  return buf;
}

let ok = 0;
const fails = [];
for (const { id, name } of pairs) {
  const civ = name.replace(/_shield\.png$/i, "").toLowerCase();
  try {
    const buf = await download(id);
    const meta = await sharp(buf).metadata();
    const out = path.join(OUT, `${civ}.webp`);
    await sharp(buf)
      .webp({ quality: 90, alphaQuality: 90 })
      .toFile(out + ".tmp.webp");
    fs.renameSync(out + ".tmp.webp", out);
    ok++;
    console.log(`✓ ${civ}: ${meta.width}x${meta.height} → ${out}`);
  } catch (e) {
    fails.push(civ);
    console.log(`✗ ${civ}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}

console.log(`\n${ok} convertidas, ${fails.length} fallos${fails.length ? ": " + fails.join(", ") : ""}`);
