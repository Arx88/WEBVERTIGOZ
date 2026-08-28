/**
 * VÉRTIGO Cup — Análisis estratégico del build order.
 *
 * Convierte la secuencia cruda de acciones (unidades, tecnologías y
 * edificios en orden cronológico) en una lectura estratégica legible:
 * apertura (fast castle, scout rush, MAA rush…), composición del
 * ejército (caballería, arqueros, artillería, unidad única…) y
 * economía (pesca, boom). Cada tag lleva un icono (nombre de lucide)
 * para presentarlo en la UI.
 *
 * Es una función pura: recibe el build order completo + uptimes y
 * devuelve tags. Se corre del lado del servidor al curar el análisis,
 * de modo que el payload guardado ya trae la lectura hecha.
 */

export interface StrategyTag {
  /** Nombre del icono de lucide-react. */
  icon: string;
  /** Etiqueta corta en español. */
  label: string;
  /** Detalle opcional: recuento o tiempo. */
  detail?: string;
  kind: "opening" | "army" | "economy";
}

interface OrderItem {
  at: string;
  seconds: number;
  kind: string;
  name: string;
}

interface UptimeLike {
  age: string | null;
  seconds: number | null;
}

const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

// Unidades que NO son ejército (economía/transporte).
const ECON_UNITS = new Set([
  "villager",
  "fishing ship",
  "trade cart",
  "trade cog",
  "transport ship",
  "sheep",
  "deer",
  "boar",
  "relic",
]);

// Clasificación de unidades genéricas (no únicas). Lo que no caiga
// aquí ni en ECON se trata como unidad única de la civilización.
const CLASS_MEMBERS: Record<string, string[]> = {
  militia: ["militia", "man-at-arms", "long swordsman", "two-handed swordsman", "champion"],
  spear: ["spearman", "pikeman", "halberdier", "eagle warrior", "elite eagle warrior"],
  archer: ["archer", "crossbowman", "arbalest", "arbalester", "skirmisher", "elite skirmisher"],
  cavarcher: ["cavalry archer", "heavy cavalry archer"],
  cavalry: [
    "scout cavalry",
    "knight",
    "paladin",
    "camel rider",
    "heavy camel rider",
    "light cavalry",
    "hussar",
    "battle elephant",
    "steppe lancer",
  ],
  siege: [
    "mangonel",
    "onager",
    "siege onager",
    "battering ram",
    "capped ram",
    "siege ram",
    "trebuchet",
    "scorpion",
    "heavy scorpion",
    "bombard cannon",
    "siege tower",
    "petard",
  ],
  monk: ["monk", "missionary"],
  naval: [
    "galley",
    "fire ship",
    "fire galley",
    "demolition ship",
    "demolition raft",
    "heavy demolition ship",
    "cannon galleon",
  ],
};

const CLASS_META: Record<string, { label: string; icon: string }> = {
  militia: { label: "Milicias", icon: "Sword" },
  spear: { label: "Lanceros", icon: "Shield" },
  archer: { label: "Arqueros", icon: "Target" },
  cavarcher: { label: "Arqueros a caballo", icon: "Crosshair" },
  cavalry: { label: "Caballería", icon: "Wind" },
  siege: { label: "Artillería", icon: "Bomb" },
  monk: { label: "Monjes", icon: "Church" },
  naval: { label: "Barcos de guerra", icon: "Ship" },
};

const NAME_TO_CLASS = new Map<string, string>();
for (const [cls, names] of Object.entries(CLASS_MEMBERS)) {
  for (const n of names) NAME_TO_CLASS.set(n, cls);
}

function classifyUnit(name: string): "econ" | "uu" | string {
  const n = norm(name);
  if (ECON_UNITS.has(n)) return "econ";
  return NAME_TO_CLASS.get(n) ?? "uu";
}

function fmtClock(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}

/**
 * Analiza el build order de un jugador y devuelve tags estratégicos.
 *
 * @param buildOrder secuencia completa de acciones (sin truncar).
 * @param uptimes    tiempos de avance de edad (feudal/castle/imperial).
 */
export function analyzeStrategy(buildOrder: OrderItem[], uptimes: UptimeLike[]): StrategyTag[] {
  const tags: StrategyTag[] = [];

  // ── Conteos ──
  const unitCount = new Map<string, number>(); // nombre normalizado → cantidad
  const classCount = new Map<string, number>(); // clase → cantidad
  const uuCount = new Map<string, number>(); // unidad única → cantidad
  let villagerCount = 0;
  let fishingCount = 0;
  let scoutCount = 0;
  let firstScoutAt: number | null = null;
  let militiaBeforeFeudal = 0;

  const buildingCount = new Map<string, number>();

  for (const b of buildOrder) {
    if (b.kind === "unit") {
      const n = norm(b.name);
      unitCount.set(n, (unitCount.get(n) ?? 0) + 1);
      if (n === "villager") villagerCount++;
      if (n === "fishing ship") fishingCount++;
      if (n === "scout cavalry") {
        scoutCount++;
        if (firstScoutAt == null) firstScoutAt = b.seconds;
      }
      const cls = classifyUnit(b.name);
      if (cls === "militia") {
        // se cuenta aparte para detectar MAA rush (antes de feudal)
      }
      if (cls !== "econ" && cls !== "uu") classCount.set(cls, (classCount.get(cls) ?? 0) + 1);
      if (cls === "uu") uuCount.set(b.name, (uuCount.get(b.name) ?? 0) + 1);
    } else if (b.kind === "building") {
      const n = norm(b.name);
      buildingCount.set(n, (buildingCount.get(n) ?? 0) + 1);
    }
  }

  // ── Tiempos de edad ──
  const ageAt = new Map<string, number>();
  for (const u of uptimes ?? []) if (u.age && u.seconds != null) ageAt.set(u.age, u.seconds);
  const feudal = ageAt.get("feudal_age") ?? null;
  const castle = ageAt.get("castle_age") ?? null;

  // MAA rush: milicias producidas antes de avanzar a feudal.
  if (feudal != null) {
    for (const b of buildOrder) {
      if (b.kind !== "unit") continue;
      if (classifyUnit(b.name) !== "militia") continue;
      if (b.seconds < feudal) militiaBeforeFeudal++;
    }
  }

  // ════════════ APERTURA ════════════
  const opening: StrategyTag[] = [];

  // Fast Castle: castillos antes de ~15:00.
  if (castle != null && castle <= 900) {
    opening.push({ icon: "Castle", label: "Fast Castle", detail: fmtClock(castle), kind: "opening" });
  }

  // Scout rush: scouts producidos en feudal (antes de castillos).
  const scoutInFeudal = firstScoutAt != null && (castle == null || firstScoutAt < castle);
  if (scoutCount >= 10 && scoutInFeudal) {
    opening.push({ icon: "Zap", label: "Scout rush", detail: `×${scoutCount}`, kind: "opening" });
  }

  // MAA rush: milicias en edad oscura (antes de feudal).
  if (militiaBeforeFeudal >= 3) {
    opening.push({ icon: "Flame", label: "MAA rush", detail: `×${militiaBeforeFeudal}`, kind: "opening" });
  }

  tags.push(...opening.slice(0, 2));

  // ════════════ EJÉRCITO ════════════
  const army: StrategyTag[] = [];

  // Unidad única más producida (si es relevante).
  const topUU = [...uuCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topUU && topUU[1] >= 12) {
    army.push({ icon: "Sparkles", label: topUU[0], detail: `×${topUU[1]}`, kind: "army" });
  }

  // Clases genéricas dominantes.
  const topClasses = [...classCount.entries()]
    .filter(([cls, c]) => c >= 10 && CLASS_META[cls])
    .sort((a, b) => b[1] - a[1]);
  for (const [cls, c] of topClasses) {
    if (army.length >= 3) break;
    army.push({ icon: CLASS_META[cls].icon, label: CLASS_META[cls].label, detail: `×${c}`, kind: "army" });
  }

  tags.push(...army.slice(0, 3));

  // ════════════ ECONOMÍA ════════════
  const townCenters = buildingCount.get("town center") ?? 0;
  if (fishingCount >= 10) {
    tags.push({ icon: "Fish", label: "Pesca", detail: `×${fishingCount}`, kind: "economy" });
  } else if (townCenters >= 3 || villagerCount >= 150) {
    tags.push({ icon: "TrendingUp", label: "Boom", detail: townCenters >= 3 ? `${townCenters} TC` : `×${villagerCount} aldeanos`, kind: "economy" });
  }

  return tags;
}
