/**
 * VÉRTIGO Cup — Generador de 12 escudos heráldicos medievales SVG.
 *
 * Cada escudo es un SVG 512x512 con:
 *  - campo (fondo) en dos colores según modelo heráldico
 *  - símbolo central (el animal/figura del nombre) en dorado
 *  - borde de escudo con ornamento sutil
 * Estilo "premium sobrio medieval" — sin glow, líneas limpias.
 *
 * Uso: npx tsx scripts/generate-emblems.ts
 * Output: public/emblems/{slug}.svg
 */

import * as fs from "fs";
import * as path from "path";

interface EmblemSpec {
  slug: string;      // nombre de archivo
  name: string;      // nombre legible (debe matchear la DB)
  fieldA: string;    // color campo izquierdo
  fieldB: string;    // color campo derecho
  metal: string;     // color del símbolo
  symbol: string;    // path SVG del símbolo (en viewBox 0 0 100 100)
}

// Símbolos heráldicos como paths SVG (100x100), estilizados
const SYMBOLS: Record<string, string> = {
  knight: `<path d="M50 12 L62 24 L62 40 L74 52 L66 60 L66 82 L34 82 L34 60 L26 52 L38 40 L38 24 Z M50 22 L56 28 L44 28 Z"/>`,
  eagle: `<path d="M50 14 L58 26 L74 20 L66 34 L78 42 L62 46 L66 60 L54 52 L50 70 L46 52 L34 60 L38 46 L22 42 L34 34 L26 20 L42 26 Z"/>`,
  dragon: `<path d="M30 78 Q24 60 34 46 L30 34 L42 38 L46 24 L58 34 L56 46 Q70 52 66 66 Q74 74 68 78 L52 70 Q42 82 30 78 Z M58 30 L62 22 L66 30 Z"/>`,
  lion: `<circle cx="50" cy="42" r="16"/><path d="M42 34 Q34 26 40 20 M58 34 Q66 26 60 20 M38 52 L30 70 L40 66 L44 78 L50 68 L56 78 L60 66 L70 70 L62 52 Z"/>`,
  wolf: `<path d="M28 30 L38 22 L50 32 L62 22 L72 30 L66 44 L70 56 L58 60 L60 74 L50 68 L40 74 L42 60 L30 56 L34 44 Z M42 42 L46 46 M58 42 L54 46"/>`,
  raven: `<path d="M30 24 Q46 18 58 30 L74 34 L62 44 L64 58 Q54 74 40 70 L28 76 L34 62 L26 50 L34 40 Z M48 34 L42 40 L50 44 Z"/>`,
  bear: `<circle cx="38" cy="32" r="6"/><circle cx="62" cy="32" r="6"/><path d="M32 40 Q50 30 68 40 L72 58 Q68 76 50 78 Q32 76 28 58 Z M44 58 Q50 64 56 58"/>`,
  falcon: `<path d="M50 16 L60 28 L76 26 L66 40 L74 52 L58 52 L60 68 L50 60 L40 68 L42 52 L26 52 L34 40 L24 26 L40 28 Z"/>`,
  serpent: `<path d="M30 76 Q24 62 38 56 Q58 50 54 38 Q50 26 62 24 L72 28 L66 36 Q60 48 46 52 Q34 56 38 66 Q40 74 30 76 Z M62 26 L66 20 L70 26 Z"/>`,
  bull: `<path d="M28 26 Q34 18 42 26 L50 34 L58 26 Q66 18 72 26 L68 40 L72 52 L60 56 L58 72 L50 64 L42 72 L40 56 L28 52 L32 40 Z M40 44 L44 48 M60 44 L56 48"/>`,
  unicorn: `<path d="M50 12 L56 30 L50 44 L44 30 Z M34 44 Q50 36 66 44 L72 58 Q66 74 50 76 Q34 74 28 58 Z M46 56 L50 62 L54 56"/>`,
  phoenix: `<circle cx="50" cy="34" r="10"/><path d="M50 44 L34 40 L22 52 L36 54 L28 70 L44 62 L50 80 L56 62 L72 70 L64 54 L78 52 L66 40 Z"/>`,
};

// Paleta heráldica "premium sobrio": gules, azur, sable, sinople + metales
function shield(spec: EmblemSpec): string {
  const { fieldA, fieldB, metal, symbol } = spec;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${fieldA}"/>
      <stop offset="1" stop-color="${fieldB}"/>
    </linearGradient>
    <linearGradient id="m" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F0D98C"/>
      <stop offset="0.5" stop-color="${metal}"/>
      <stop offset="1" stop-color="#A8842C"/>
    </linearGradient>
  </defs>
  <!-- Escudo -->
  <path d="M256 28 L424 68 L424 268 Q424 400 256 484 Q88 400 88 268 L88 68 Z"
        fill="url(#f)" stroke="${metal}" stroke-width="10"/>
  <path d="M256 44 L408 80 L408 268 Q408 388 256 466 Q104 388 104 268 L104 80 Z"
        fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="3"/>
  <!-- Símbolo -->
  <g transform="translate(156,140) scale(2.0)" fill="url(#m)" stroke="#1a1206" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
    ${symbol}
  </g>
  <!-- Ornamento inferior -->
  <path d="M176 396 Q256 428 336 396" fill="none" stroke="${metal}" stroke-width="4" stroke-linecap="round" opacity="0.7"/>
</svg>`;
}

const SPECS: EmblemSpec[] = [
  { slug: "caballero", name: "Caballero", fieldA: "#2b2f6e", fieldB: "#10122b", metal: "#D4AF37", symbol: SYMBOLS.knight },
  { slug: "aguila", name: "Águila", fieldA: "#6e1f1f", fieldB: "#260b0b", metal: "#D4AF37", symbol: SYMBOLS.eagle },
  { slug: "dragon", name: "Dragón", fieldA: "#14532d", fieldB: "#06210f", metal: "#D4AF37", symbol: SYMBOLS.dragon },
  { slug: "leon", name: "León", fieldA: "#7c2d12", fieldB: "#2a0e05", metal: "#D4AF37", symbol: SYMBOLS.lion },
  { slug: "lobo", name: "Lobo", fieldA: "#1f2937", fieldB: "#0a0f16", metal: "#C9CCD6", symbol: SYMBOLS.wolf },
  { slug: "cuervo", name: "Cuervo", fieldA: "#111827", fieldB: "#03060c", metal: "#8B2CF5", symbol: SYMBOLS.raven },
  { slug: "oso", name: "Oso", fieldA: "#3f2d1e", fieldB: "#160d06", metal: "#D4AF37", symbol: SYMBOLS.bear },
  { slug: "halcon", name: "Halcón", fieldA: "#0e3a5f", fieldB: "#07223a", metal: "#D4AF37", symbol: SYMBOLS.falcon },
  { slug: "serpiente", name: "Serpiente", fieldA: "#164e2a", fieldB: "#04200e", metal: "#D4AF37", symbol: SYMBOLS.serpent },
  { slug: "toro", name: "Toro", fieldA: "#5f1d1d", fieldB: "#200808", metal: "#D4AF37", symbol: SYMBOLS.bull },
  { slug: "unicornio", name: "Unicornio", fieldA: "#e7e5ee", fieldB: "#b9b4cc", metal: "#8B2CF5", symbol: SYMBOLS.unicorn },
  { slug: "fenix", name: "Fénix", fieldA: "#7f1d1d", fieldB: "#2b0606", metal: "#F59E0B", symbol: SYMBOLS.phoenix },
];

function main() {
  const outDir = path.resolve(process.cwd(), "public", "emblems");
  fs.mkdirSync(outDir, { recursive: true });
  for (const spec of SPECS) {
    const file = path.join(outDir, `${spec.slug}.svg`);
    fs.writeFileSync(file, shield(spec), "utf-8");
    console.log(`✓ ${spec.slug}.svg`);
  }
  console.log(`\n${SPECS.length} emblemas generados en public/emblems/`);
}

main();
