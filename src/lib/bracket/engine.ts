/**
 * Motor de Single Elimination de 32 equipos.
 *
 * Genera la estructura del bracket (rounds + matches + parent links).
 * Lógica pura, sin dependencias de DB.
 *
 * Ver docs/SPEC.md sección 3.1 para detalle del formato.
 */

export const BRACKET_SIZE = 32;
export const BRACKET_ROUNDS = 5;

export const ROUND_NAMES_32 = [
  "Ronda 1",
  "Octavos de Final",
  "Cuartos de Final",
  "Semifinal",
  "Final",
] as const;

export interface GeneratedMatch {
  /** ID temporal (uuid generado al persistir) */
  tempId: string;
  roundIndex: number;
  roundName: string;
  slotIndex: number;
  /** Match del que viene el equipo A (null en R1) */
  parentMatchAId: string | null;
  /** Match del que viene el equipo B (null en R1) */
  parentMatchBId: string | null;
  /** Seed asignado al slot A (null si viene de parent) */
  seedA: number | null;
  /** Seed asignado al slot B (null si viene de parent) */
  seedB: number | null;
}

export interface GeneratedBracket {
  rounds: {
    index: number;
    name: string;
    matches: GeneratedMatch[];
  }[];
  totalMatches: number;
  bracketSize: number;
}

/**
 * Genera la estructura de un bracket SE de N equipos (potencia de 2).
 *
 * El bracket tiene:
 *  - Ronda 1: N/2 matches
 *  - Ronda 2: N/4 matches
 *  - ...
 *  - Final: 1 match
 *
 * Total = N - 1 matches.
 *
 * Los matches de R1 se emparejan con seeding estándar "snake":
 *   seed 1 vs seed N, seed 2 vs seed N-1, etc.
 * Esto evita que los 2 mejores seeds se crucen en R1.
 */
export function generateBracket(
  bracketSize: number = BRACKET_SIZE
): GeneratedBracket {
  if ((bracketSize & (bracketSize - 1)) !== 0) {
    throw new Error(`bracketSize debe ser potencia de 2, recibí ${bracketSize}`);
  }
  if (bracketSize < 2) throw new Error("bracketSize mínimo 2");

  const roundsCount = Math.log2(bracketSize);
  const rounds: GeneratedBracket["rounds"] = [];

  for (let r = 0; r < roundsCount; r++) {
    const matchesCount = bracketSize / Math.pow(2, r + 1);
    const matches: GeneratedMatch[] = [];

    for (let s = 0; s < matchesCount; s++) {
      const match: GeneratedMatch = {
        tempId: `r${r}-s${s}`,
        roundIndex: r,
        roundName: getRoundName(r, roundsCount),
        slotIndex: s,
        parentMatchAId: r === 0 ? null : `r${r - 1}-s${s * 2}`,
        parentMatchBId: r === 0 ? null : `r${r - 1}-s${s * 2 + 1}`,
        seedA: r === 0 ? getSeedForSlot(s, bracketSize, 0) : null,
        seedB: r === 0 ? getSeedForSlot(s, bracketSize, 1) : null,
      };
      matches.push(match);
    }
    rounds.push({
      index: r,
      name: getRoundName(r, roundsCount),
      matches,
    });
  }

  return {
    rounds,
    totalMatches: bracketSize - 1,
    bracketSize,
  };
}

function getRoundName(roundIndex: number, totalRounds: number): string {
  if (totalRounds === 5) return ROUND_NAMES_32[roundIndex];
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semifinal";
  if (fromEnd === 3) return "Cuartos de Final";
  if (fromEnd === 4) return "Octavos de Final";
  return `Ronda ${roundIndex + 1}`;
}

function getSeedForSlot(
  slotIndex: number,
  bracketSize: number,
  side: 0 | 1
): number {
  const seedsA = generateStandardSeeds(bracketSize);
  return side === 0 ? seedsA[slotIndex * 2] : seedsA[slotIndex * 2 + 1];
}

/**
 * Genera el array estándar de seeds para SE de N equipos.
 *
 *   - Para bracket de 2: [1, 2]
 *   - Para bracket de 4: [1, 4, 2, 3]
 *   - Para bracket de 8: [1, 8, 4, 5, 2, 7, 3, 6]
 *   - Para bracket de 16: [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]
 *   - Para bracket de 32: [1, 32, 16, 17, 8, 25, 9, 24, 4, 29, 13, 20, 5, 28, 12, 21, 2, 31, 15, 18, 7, 26, 10, 23, 3, 30, 14, 19, 6, 27, 11, 22]
 */
function generateStandardSeeds(bracketSize: number): number[] {
  if (bracketSize === 1) return [1];
  if (bracketSize === 2) return [1, 2];

  const prev = generateStandardSeeds(bracketSize / 2);
  const result: number[] = [];

  for (let i = 0; i < prev.length; i += 2) {
    const a = prev[i];
    const b = prev[i + 1];
    result.push(a, bracketSize + 1 - a);
    result.push(b, bracketSize + 1 - b);
  }

  return result;
}

/**
 * Devuelve los byes (pasadas automáticas) para un bracket de N equipos
 * cuando hay M equipos reales (M < N).
 */
export function getByes(teamCount: number, bracketSize: number = BRACKET_SIZE): number[] {
  const byeCount = bracketSize - teamCount;
  if (byeCount <= 0) return [];
  return Array.from({ length: byeCount }, (_, i) => i + 1);
}

/**
 * Dado un bracket generado y un match (roundIndex, slotIndex),
 * devuelve el match siguiente (al que avanza el ganador).
 */
export function getNextMatch(
  bracket: GeneratedBracket,
  roundIndex: number,
  slotIndex: number
): GeneratedMatch | null {
  if (roundIndex >= bracket.rounds.length - 1) return null;
  const nextRound = bracket.rounds[roundIndex + 1];
  const nextSlot = Math.floor(slotIndex / 2);
  return nextRound.matches[nextSlot];
}
