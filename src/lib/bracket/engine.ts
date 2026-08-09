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

// ============================================================
// ASIGNACIÓN DE SEEDS A EQUIPOS
// ============================================================

/**
 * Match con estado (extiende GeneratedMatch con teams asignados y resultado).
 */
export interface MatchState extends GeneratedMatch {
  teamAId: string | null;
  teamBId: string | null;
  winnerTeamId: string | null;
  status: string;
}

/**
 * Asignación de seed a team_registration_id.
 */
export interface SeedAssignment {
  seed: number;
  teamRegistrationId: string;
}

/**
 * Dado un bracket generado y un array de asignaciones seed→team,
 * devuelve los matches de R1 con los teams asignados a sus slots.
 *
 * Los matches de R>1 quedan con teamAId/teamBId = null (se llenan al avanzar ganadores).
 *
 * @param bracket Bracket generado por generateBracket()
 * @param assignments Array de { seed, teamRegistrationId } (debe tener bracketSize elementos)
 */
export function assignSeedsToTeams(
  bracket: GeneratedBracket,
  assignments: SeedAssignment[]
): MatchState[] {
  if (assignments.length !== bracket.bracketSize) {
    throw new Error(
      `Esperaba ${bracket.bracketSize} asignaciones, recibí ${assignments.length}`
    );
  }

  // Mapa seed → teamRegistrationId
  const seedToTeam = new Map<number, string>();
  for (const a of assignments) {
    seedToTeam.set(a.seed, a.teamRegistrationId);
  }

  // Validar que todos los seeds 1..bracketSize estén presentes
  for (let s = 1; s <= bracket.bracketSize; s++) {
    if (!seedToTeam.has(s)) {
      throw new Error(`Falta asignar el seed ${s}`);
    }
  }

  const allMatches: MatchState[] = [];

  for (const round of bracket.rounds) {
    for (const m of round.matches) {
      const state: MatchState = {
        ...m,
        teamAId: m.seedA !== null ? seedToTeam.get(m.seedA) ?? null : null,
        teamBId: m.seedB !== null ? seedToTeam.get(m.seedB) ?? null : null,
        winnerTeamId: null,
        status: "scheduled",
      };
      allMatches.push(state);
    }
  }

  return allMatches;
}

// ============================================================
// AVANCE DE GANADOR
// ============================================================

/**
 * Dado el estado actual de todos los matches y el ID de un match que terminó,
 * devuelve el nuevo estado con el ganador escrito en el próximo match.
 *
 * Reglas:
 * - Si el match es la Final (roundIndex === rounds.length - 1), no hay próximo match.
 * - El ganador va al slot A del próximo match si slotIndex del match actual es par,
 *   al slot B si es impar.
 * - El próximo match solo se puede "abrir" (status=scheduled → open) cuando AMBOS
 *   padres ya tienen ganador. Esta lógica de status la maneja el server action,
 *   no esta función pura.
 *
 * @param matches Estado actual de todos los matches
 * @param finishedMatchTempId tempId del match que terminó
 * @param winnerTeamId ID del equipo ganador
 * @returns Nuevo array de matches con el ganador avanzado
 */
export function advanceWinner(
  matches: MatchState[],
  finishedMatchTempId: string,
  winnerTeamId: string
): MatchState[] {
  const finishedMatch = matches.find((m) => m.tempId === finishedMatchTempId);
  if (!finishedMatch) {
    throw new Error(`Match ${finishedMatchTempId} no encontrado`);
  }

  // Validar que el ganador sea uno de los dos equipos del match
  if (
    winnerTeamId !== finishedMatch.teamAId &&
    winnerTeamId !== finishedMatch.teamBId
  ) {
    throw new Error(
      `El ganador ${winnerTeamId} no es uno de los equipos del match (A=${finishedMatch.teamAId}, B=${finishedMatch.teamBId})`
    );
  }

  // Marcar el match como finished con su ganador
  const updatedMatches = matches.map((m) => {
    if (m.tempId === finishedMatchTempId) {
      return { ...m, winnerTeamId, status: "finished" };
    }
    return m;
  });

  // Encontrar el próximo match por parentMatchAId o parentMatchBId.
  // Si no hay próximo match, era la final y no hay nada que avanzar.
  const nextMatch = updatedMatches.find(
    (m) =>
      m.parentMatchAId === finishedMatchTempId ||
      m.parentMatchBId === finishedMatchTempId
  );

  if (!nextMatch) {
    // Era la final, no hay próximo match
    return updatedMatches;
  }

  // Determinar si el ganador va al slot A o B
  const goesToSlotA = nextMatch.parentMatchAId === finishedMatchTempId;

  return updatedMatches.map((m) => {
    if (m.tempId === nextMatch.tempId) {
      if (goesToSlotA) {
        return { ...m, teamAId: winnerTeamId };
      } else {
        return { ...m, teamBId: winnerTeamId };
      }
    }
    return m;
  });
}

/**
 * Verifica si un match está listo para ser "abierto" (status: scheduled → open).
 * Solo se puede abrir cuando AMBOS matches padres tienen ganador (o son de R1
 * con teams asignados).
 */
export function canOpenMatch(match: MatchState, allMatches: MatchState[]): boolean {
  if (match.status !== "scheduled") return false;
  // R1: se puede abrir si tiene ambos teams asignados
  if (match.parentMatchAId === null && match.parentMatchBId === null) {
    return match.teamAId !== null && match.teamBId !== null;
  }
  // R>1: se puede abrir si ambos padres terminaron
  const parentA = allMatches.find((m) => m.tempId === match.parentMatchAId);
  const parentB = allMatches.find((m) => m.tempId === match.parentMatchBId);
  return parentA?.winnerTeamId != null && parentB?.winnerTeamId != null;
}

// ============================================================
// SORTEO DE SEEDS (para commit-reveal)
// ============================================================

/**
 * Genera una permutación aleatoria de seeds 1..N para los teamIds dados.
 *
 * Esta función NO usa commit-reveal (es random puro). El server action
 * drawBracketSeeds la usa COMO FALLBACK cuando no hay commit-reveal.
 * En producción, el sorteo real usa deterministicIndices() de lib/crypto.ts.
 *
 * @param teamIds Array de team_registration_id (debe tener 32 elementos)
 * @returns Array de { seed, teamRegistrationId }
 */
export function shuffleSeeds(teamIds: string[]): SeedAssignment[] {
  if (teamIds.length !== BRACKET_SIZE) {
    throw new Error(
      `Esperaba ${BRACKET_SIZE} teamIds, recibí ${teamIds.length}`
    );
  }

  // Fisher-Yates shuffle
  const shuffled = [...teamIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Asignar seeds 1..32 según el orden del shuffle
  return shuffled.map((teamRegistrationId, seed) => ({
    seed: seed + 1,
    teamRegistrationId,
  }));
}

/**
 * Genera asignaciones de seeds deterministas usando un array de índices
 * pre-computados (de deterministicIndices en lib/crypto.ts).
 *
 * @param teamIds Array de team_registration_id (32 elementos, orden original)
 * @param indices Array de 32 índices (0-31) pre-computados con HMAC-SHA256
 * @returns Array de { seed, teamRegistrationId }
 */
export function assignSeedsFromIndices(
  teamIds: string[],
  indices: number[]
): SeedAssignment[] {
  if (teamIds.length !== BRACKET_SIZE) {
    throw new Error(`Esperaba ${BRACKET_SIZE} teamIds`);
  }
  if (indices.length !== BRACKET_SIZE) {
    throw new Error(`Esperaba ${BRACKET_SIZE} índices`);
  }

  // Para cada seed (1..32), el teamRegistrationId es teamIds[indices[seed-1]]
  const assignments: SeedAssignment[] = [];
  const usedIndices = new Set<number>();

  for (let seed = 1; seed <= BRACKET_SIZE; seed++) {
    let idx = indices[seed - 1] % BRACKET_SIZE;
    // Evitar duplicados: si el índice ya fue usado, buscar el siguiente libre
    while (usedIndices.has(idx)) {
      idx = (idx + 1) % BRACKET_SIZE;
    }
    usedIndices.add(idx);
    assignments.push({
      seed,
      teamRegistrationId: teamIds[idx],
    });
  }

  return assignments;
}
