const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const TARGET_DIRS = [
  "public/modes",
  "public/landing",
];

const SIZE_THRESHOLD = 1024 * 1024; // 1MB

async function processDir(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDir(fullPath);
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(".png")) continue;
    const stat = await fs.promises.stat(fullPath);
    if (stat.size < SIZE_THRESHOLD) continue;

    const webpPath = fullPath.replace(/\.png$/i, ".webp");
    console.log(`Converting ${fullPath} (${(stat.size/1024/1024).toFixed(1)}MB) → webp`);

    try {
      await sharp(fullPath)
        .webp({ quality: 85, lossless: false })
        .toFile(webpPath);
      const newStat = await fs.promises.stat(webpPath);
      console.log(`  ✓ ${(newStat.size/1024/1024).toFixed(1)}MB (${((1 - newStat.size/stat.size)*100).toFixed(0)}% reducción)`);
      // Borrar el PNG original
      await fs.promises.unlink(fullPath);
      console.log(`  ✓ PNG original borrado`);
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`);
    }
  }
}

(async () => {
  for (const dir of TARGET_DIRS) {
    if (fs.existsSync(dir)) {
      await processDir(dir);
    }
  }
  console.log("\nListo.");
})();
