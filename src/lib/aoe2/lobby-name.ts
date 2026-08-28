/**
 * Nombre de sala (lobby) para las partidas de AoE2 del torneo.
 *
 * El nombre es la CLAVE DE DESCUBRIMIENTO del watcher: los jugadores
 * crean la sala en AoE2 con este nombre exacto y el sync la busca en
 * AoE2 Companion. Es una derivación pura y determinística de datos que
 * ya están en DB (jornada_label + slot_index + game_number) — no se
 * guarda en ninguna columna, se recalcula igual en cada render.
 *
 * Formato: `J{jornada}-VCUP-P{partido}G{game}` → p.ej. "J1-VCUP-P3G2".
 * - El formato de la llave (BO1/BO3) NO va en el nombre: la fase LLAVE
 *   puede decidirlo después de que el nombre ya fue mostrado.
 * - Si la jornada no tiene número parseable se usa un slug corto del
 *   label, y como último recurso 4 chars del match id (anti-colisión).
 * - Tope 32 caracteres (límite del nombre de sala en AoE2).
 */

export const EVENT_TAG = "VCUP";
const MAX_LEN = 32;

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

/** Tag de jornada: "Jornada 1" → "J1"; sin número → slug corto del label. */
export function jornadaTag(jornadaLabel: string | null | undefined, matchId: string): string {
  const num = jornadaLabel?.match(/(\d+)/)?.[1];
  if (num) return `J${num}`;
  if (jornadaLabel && jornadaLabel.trim()) {
    const slug = slugify(jornadaLabel.trim());
    if (slug) return slug.slice(0, 8);
  }
  return matchId.replace(/-/g, "").slice(0, 4).toUpperCase();
}

export interface LobbyNameInput {
  jornadaLabel: string | null | undefined;
  slotIndex: number;
  gameNumber: number;
  matchId: string;
}

/** Nombre de sala determinístico para una partida. */
export function lobbyNameForGame(input: LobbyNameInput): string {
  const j = jornadaTag(input.jornadaLabel, input.matchId);
  const name = `${j}-${EVENT_TAG}-P${input.slotIndex + 1}G${input.gameNumber}`;
  return name.slice(0, MAX_LEN);
}

/**
 * Compara un nombre de sala de Companion contra el esperado.
 * Case-insensitive y tolerante a espacios extra (el nombre lo tipea un
 * humano en el cliente de AoE2).
 */
export function lobbyNameMatches(expected: string, candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(expected) === norm(candidate);
}

/**
 * Parsea una referencia a un match de Companion pegada por el admin
 * (vínculo forzado). Acepta:
 *  - el id numérico directo: "502615667"
 *  - URL del sitio: https://www.aoe2companion.com/match/502615667
 *  - URL con query param: ...?matchId=502615667
 */
export function parseCompanionMatchRef(input: string): string | null {
  const s = input.trim();
  if (/^\d{6,}$/.test(s)) return s;
  const m = s.match(/aoe2companion\.com\/(?:match(?:es)?\/|\?[^#]*matchId=)(\d+)/i);
  if (m) return m[1];
  const bare = s.match(/matchId=(\d+)/i);
  return bare ? bare[1] : null;
}
