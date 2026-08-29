/**
 * VÉRTIGO Cup — Análisis estratégico del build order.
 *
 * Convierte la secuencia cruda de acciones (unidades, tecnologías y
 * edificios en orden cronológico) en una lectura estratégica legible:
 * apertura (fast castle, scout rush, MAA rush, archer rush, "abrió
 * monjes/arqueros/caballería…"), composición del ejército (caballería,
 * arqueros, artillería, unidad única…) y economía (pesca, boom).
 *
 * Es una función pura: recibe el build order completo + uptimes y
 * devuelve tags. Se corre del lado del servidor al curar el análisis,
 * de modo que el payload guardado ya trae la lectura hecha. También
 * corre client-side como fallback para payloads viejos.
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

export interface ProductionCounts {
  villagers: number;
  military: number;
  fishingShips: number;
  tradeCarts: number;
}

/**
 * Conteo de producción por tipo desde el build order crudo. Lo consume
 * la curación del análisis (match-sync) para persistir los totales por
 * jugador y alimentar los superlativos de la partida (chips).
 */
export function productionCounts(buildOrder: { kind: string; name: string }[]): ProductionCounts {
  let villagers = 0;
  let military = 0;
  let fishingShips = 0;
  let tradeCarts = 0;
  for (const b of buildOrder) {
    if (b.kind !== "unit") continue;
    const n = norm(b.name);
    if (n === "villager") villagers++;
    else if (n === "fishing ship") fishingShips++;
    else if (n === "trade cart" || n === "trade cog") tradeCarts++;
    if (classifyUnit(n) !== "econ") military++;
  }
  return { villagers, military, fishingShips, tradeCarts };
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

/** "Rattan Archer" → "Rattan archer" para mostrar el nombre de la UU. */
function prettyUnit(name: string): string {
  const n = name.replace(/_/g, " ").trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/**
 * Analiza el build order de un jugador y devuelve tags estratégicos.
 *
 * @param buildOrder secuencia completa de acciones (sin truncar).
 * @param uptimes    tiempos de avance de edad (feudal/castillos/imperial).
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

  const beforeCastle = (seconds: number) => castle == null || seconds < castle;

  // ════════════ APERTURA ════════════
  const opening: StrategyTag[] = [];

  // Fast Castle: castillos antes de ~15:00.
  if (castle != null && castle <= 900) {
    opening.push({ icon: "Castle", label: "Fast Castle", detail: fmtClock(castle), kind: "opening" });
  }

  // Unidades militares antes de castillos: ahí viven los rushes.
  let scoutsBeforeCastle = 0;
  let archerLineBeforeCastle = 0; // archer/crossbow/arbalest (sin skirm)
  let militiaBeforeCastle = 0;
  let firstMilitiaAt: number | null = null;
  for (const b of buildOrder) {
    if (b.kind !== "unit") continue;
    if (!beforeCastle(b.seconds)) continue;
    const n = norm(b.name);
    if (n === "scout cavalry") scoutsBeforeCastle++;
    if (["archer", "crossbowman", "arbalest", "arbalester"].includes(n)) archerLineBeforeCastle++;
    if (CLASS_MEMBERS.militia.includes(n)) {
      militiaBeforeCastle++;
      if (firstMilitiaAt == null) firstMilitiaAt = b.seconds;
    }
  }

  const rushTags: StrategyTag[] = [];
  if (scoutCount >= 8 && (firstScoutAt == null || beforeCastle(firstScoutAt))) {
    rushTags.push({ icon: "Zap", label: "Scout rush", detail: `×${scoutCount}`, kind: "opening" });
  }
  if (militiaBeforeCastle >= 4) {
    const isDrush = feudal != null && firstMilitiaAt != null && firstMilitiaAt < feudal;
    rushTags.push({
      icon: "Flame",
      label: isDrush ? "Drush + MAA" : "MAA rush",
      detail: `×${militiaBeforeCastle}`,
      kind: "opening",
    });
  }
  if (archerLineBeforeCastle >= 6) {
    rushTags.push({ icon: "Target", label: "Archer rush", detail: `×${archerLineBeforeCastle}`, kind: "opening" });
  }
  opening.push(...rushTags);

  // Sin rush identificable: la apertura es la PRIMERA unidad militar del
  // jugador (aunque sea después de un Fast Castle — "abrió monjes",
  // "abrió rattan archer", "abrió mangonel"…).
  let openedClass: string | null = null; // clase/uu de la primera unidad militar
  let openedUUName: string | null = null; // nombre de la UU, si abrió con ella
  if (rushTags.length === 0) {
    const firstMilitary = buildOrder.find((b) => b.kind === "unit" && classifyUnit(b.name) !== "econ");
    if (firstMilitary) {
      const cls = classifyUnit(firstMilitary.name);
      openedClass = cls;
      if (cls === "uu") {
        openedUUName = prettyUnit(firstMilitary.name);
        opening.push({
          icon: "Sparkles",
          label: `Abrió ${openedUUName}`,
          detail: fmtClock(firstMilitary.seconds),
          kind: "opening",
        });
      } else if (CLASS_META[cls]) {
        opening.push({
          icon: CLASS_META[cls].icon,
          label: `Abrió ${CLASS_META[cls].label.toLowerCase()}`,
          detail: fmtClock(firstMilitary.seconds),
          kind: "opening",
        });
      }
    }
  }

  tags.push(...opening.slice(0, 3));

  // ════════════ EJÉRCITO ════════════
  const army: StrategyTag[] = [];

  // La clase (o UU) con la que abrió ya está contada en la apertura: si es la
  // misma dominante, no se repite como composición ("abrió artillería" +
  // "artillería" es lo mismo dicho dos veces).
  // Unidad única más producida (si es relevante y no es la de la apertura).
  const topUU = [...uuCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topUU && topUU[1] >= 12 && prettyUnit(topUU[0]) !== openedUUName) {
    army.push({ icon: "Sparkles", label: prettyUnit(topUU[0]), detail: `×${topUU[1]}`, kind: "army" });
  }

  // Clases genéricas dominantes (excluida la clase con la que abrió).
  const topClasses = [...classCount.entries()]
    .filter(([cls, c]) => c >= 10 && CLASS_META[cls] && cls !== openedClass)
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
