/**
 * Catálogo completo de civilizaciones de Age of Empires II.
 * 53 civs incluyendo todas las DLC (armenians, georgians, bengalis, dravidians,
 * gurjaras, jurchens, khitans, shu, wei, wu, mapuche, muiscas, tupies).
 *
 * La clave es el ID en minúsculas (matchea el nombre del archivo .webp en /public/civs/).
 * El valor es el nombre en español, como se muestra en el wizard y el perfil de equipo.
 */
export const CIV_NAMES: Record<string, string> = {
  // ─── Base game (Age of Kings) ───
  britons: "Britanos",
  franks: "Francos",
  goths: "Godos",
  teutons: "Teutones",
  japanese: "Japoneses",
  chinese: "Chinos",
  byzantines: "Bizantinos",
  persians: "Persas",
  saracens: "Sarracenos",
  turks: "Turcos",
  vikings: "Vikingos",
  mongols: "Mongoles",
  celts: "Celtas",
  spanish: "Españoles",
  aztecs: "Aztecas",
  mayans: "Mayas",
  huns: "Hunos",
  koreans: "Coreanos",
  // ─── The Conquerors ───
  // (ya están arriba: aztecs, mayans, huns, spanish, koreans)
  // ─── Forgotten Empires ───
  italians: "Italianos",
  hindustanis: "Hindustanos", // ← antes "indians", renombrado en DLC
  incas: "Incas",
  magyars: "Magiares",
  slavs: "Eslavos",
  berbers: "Bereberes",
  ethiopians: "Etíopes",
  malians: "Malianos",
  portuguese: "Portugueses",
  burmese: "Birmanos",
  khmer: "Jémeres",
  malay: "Malayos",
  vietnamese: "Vietnamitas",
  // ─── Rise of the Rajas ───
  // (ya están arriba: burmese, khmer, malay, vietnamese)
  // ─── Last Khans ───
  bulgarians: "Búlgaros",
  cumans: "Cumanos",
  lithuanians: "Lituanos",
  tatars: "Tártaros",
  // ─── Lords of the West ───
  burgundians: "Borgoñones",
  sicilians: "Sicilianos",
  // ─── Dawn of the Dukes ───
  poles: "Polacos",
  bohemians: "Bohemios",
  // ─── Dynasties of India ───
  bengalis: "Bengalíes",
  dravidians: "Drávidas",
  gurjaras: "Gurjaras",
  // ─── Return of Rome ───
  romans: "Romanos",
  // ─── The Mountain Royals ───
  armenians: "Armenios",
  georgians: "Georgianos",
  // ─── The Three Kingdoms ───
  jurchens: "Jurchen",
  khitans: "Kitán",
  shu: "Shu",
  wei: "Wei",
  wu: "Wu",
  // ─── Custom civs (mod VÉRTIGO) ───
  mapuche: "Mapuches",
  muiscas: "Muiscas",
  tupies: "Tupís",
};

/**
 * Lista de IDs de civs, ordenada alfabéticamente.
 * Útil para selectores y validación.
 */
export const CIV_IDS = Object.keys(CIV_NAMES).sort();

/**
 * Cantidad total de civs soportadas.
 */
export const CIV_COUNT = CIV_IDS.length;

/**
 * Devuelve el nombre en español de una civ, o el ID si no está en el catálogo.
 */
export function civName(id: string): string {
  return CIV_NAMES[id] ?? id;
}
