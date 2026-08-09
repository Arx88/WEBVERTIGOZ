import { describe, it, expect } from "vitest";
import {
  generateBracket,
  assignSeedsToTeams,
  advanceWinner,
  canOpenMatch,
  shuffleSeeds,
  assignSeedsFromIndices,
  BRACKET_SIZE,
  BRACKET_ROUNDS,
  type MatchState,
  type SeedAssignment,
} from "@/lib/bracket/engine";

// ============================================================
// FIXTURES
// ============================================================

const TEAM_IDS = Array.from({ length: 32 }, (_, i) => `team-${i + 1}`);

function makeAssignments(): SeedAssignment[] {
  return TEAM_IDS.map((teamRegistrationId, i) => ({
    seed: i + 1,
    teamRegistrationId,
  }));
}

function makeBracketWithTeams(): MatchState[] {
  const bracket = generateBracket(BRACKET_SIZE);
  return assignSeedsToTeams(bracket, makeAssignments());
}

// ============================================================
// TESTS — generateBracket
// ============================================================

describe("generateBracket", () => {
  it("genera bracket de 32 con 5 rondas y 31 matches", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    expect(bracket.rounds).toHaveLength(BRACKET_ROUNDS);
    expect(bracket.totalMatches).toBe(31);
    expect(bracket.bracketSize).toBe(32);

    // R1: 16 matches, R2: 8, R3: 4, R4: 2, R5: 1
    expect(bracket.rounds[0].matches).toHaveLength(16);
    expect(bracket.rounds[1].matches).toHaveLength(8);
    expect(bracket.rounds[2].matches).toHaveLength(4);
    expect(bracket.rounds[3].matches).toHaveLength(2);
    expect(bracket.rounds[4].matches).toHaveLength(1);
  });

  it("nombra las rondas correctamente", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    expect(bracket.rounds[0].name).toBe("Ronda 1");
    expect(bracket.rounds[1].name).toBe("Octavos de Final");
    expect(bracket.rounds[2].name).toBe("Cuartos de Final");
    expect(bracket.rounds[3].name).toBe("Semifinal");
    expect(bracket.rounds[4].name).toBe("Final");
  });

  it("R1 tiene seeds snake (1 vs 32, 2 vs 31, ...)", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    const r1 = bracket.rounds[0].matches;

    // Match 0: seed 1 vs seed 32
    expect(r1[0].seedA).toBe(1);
    expect(r1[0].seedB).toBe(32);

    // Match 1: seed 16 vs seed 17 (snake pattern)
    expect(r1[1].seedA).toBe(16);
    expect(r1[1].seedB).toBe(17);

    // Match 15: seed 11 vs seed 22
    expect(r1[15].seedA).toBe(11);
    expect(r1[15].seedB).toBe(22);
  });

  it("R>1 no tiene seeds asignados (vienen de parents)", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    const r2 = bracket.rounds[1].matches;
    expect(r2[0].seedA).toBeNull();
    expect(r2[0].seedB).toBeNull();
  });

  it("parentMatchAId y parentMatchBId son correctos", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    const r2 = bracket.rounds[1].matches;
    // Match 0 de R2 viene de Match 0 y Match 1 de R1
    expect(r2[0].parentMatchAId).toBe("r0-s0");
    expect(r2[0].parentMatchBId).toBe("r0-s1");
  });

  it("rechaza bracketSize que no es potencia de 2", () => {
    expect(() => generateBracket(7)).toThrow("potencia de 2");
    expect(() => generateBracket(33)).toThrow("potencia de 2");
  });

  it("rechaza bracketSize < 2", () => {
    expect(() => generateBracket(1)).toThrow("mínimo 2");
  });
});

// ============================================================
// TESTS — assignSeedsToTeams
// ============================================================

describe("assignSeedsToTeams", () => {
  it("asigna teams a R1 según seeds", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    const matches = assignSeedsToTeams(bracket, makeAssignments());

    // Match 0 de R1: seed 1 (team-1) vs seed 32 (team-32)
    const m0 = matches.find((m) => m.tempId === "r0-s0")!;
    expect(m0.teamAId).toBe("team-1");
    expect(m0.teamBId).toBe("team-32");
  });

  it("R>1 queda con teams null hasta avanzar ganadores", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    const matches = assignSeedsToTeams(bracket, makeAssignments());

    const r2m0 = matches.find((m) => m.tempId === "r1-s0")!;
    expect(r2m0.teamAId).toBeNull();
    expect(r2m0.teamBId).toBeNull();
  });

  it("falla si faltan asignaciones", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    const incomplete = makeAssignments().slice(0, 31);
    expect(() => assignSeedsToTeams(bracket, incomplete)).toThrow(/asignaciones/);
  });

  it("falla si falta un seed", () => {
    const bracket = generateBracket(BRACKET_SIZE);
    const assignments = makeAssignments();
    assignments[0] = { seed: 99, teamRegistrationId: "team-1" }; // seed 1 falta
    expect(() => assignSeedsToTeams(bracket, assignments)).toThrow("Falta asignar el seed 1");
  });

  it("todos los matches empiezan en status=scheduled", () => {
    const matches = makeBracketWithTeams();
    expect(matches.every((m) => m.status === "scheduled")).toBe(true);
  });
});

// ============================================================
// TESTS — advanceWinner
// ============================================================

describe("advanceWinner", () => {
  it("avanza ganador al slot A del próximo match si parentMatchAId", () => {
    const matches = makeBracketWithTeams();
    const r1m0 = matches.find((m) => m.tempId === "r0-s0")!;

    // team-1 (seed 1) gana
    const updated = advanceWinner(matches, "r0-s0", "team-1");

    const r2m0 = updated.find((m) => m.tempId === "r1-s0")!;
    expect(r2m0.teamAId).toBe("team-1");
    expect(r2m0.teamBId).toBeNull(); // todavía no avanzó el otro parent
  });

  it("avanza ganador al slot B del próximo match si parentMatchBId", () => {
    const matches = makeBracketWithTeams();
    // r0-s1 tiene seedA=16 (team-16), seedB=17 (team-17). Es parent B de r1-s0.
    // Si gana team-17, debe ir al slot B de r1-s0.
    const updated = advanceWinner(matches, "r0-s1", "team-17");

    const r2m0 = updated.find((m) => m.tempId === "r1-s0")!;
    expect(r2m0.teamAId).toBeNull(); // parent A (r0-s0) no avanzó
    expect(r2m0.teamBId).toBe("team-17");
  });

  it("marca el match terminado como finished con winnerTeamId", () => {
    const matches = makeBracketWithTeams();
    const updated = advanceWinner(matches, "r0-s0", "team-1");

    const finished = updated.find((m) => m.tempId === "r0-s0")!;
    expect(finished.status).toBe("finished");
    expect(finished.winnerTeamId).toBe("team-1");
  });

  it("falla si el ganador no es uno de los equipos del match", () => {
    const matches = makeBracketWithTeams();
    expect(() => advanceWinner(matches, "r0-s0", "team-999")).toThrow(
      "no es uno de los equipos"
    );
  });

  it("falla si el match no existe", () => {
    const matches = makeBracketWithTeams();
    expect(() => advanceWinner(matches, "no-existe", "team-1")).toThrow(
      "no encontrado"
    );
  });

  it("cuando ambos parents de R2 avanzan, R2 tiene ambos teams", () => {
    const matches = makeBracketWithTeams();
    let updated = advanceWinner(matches, "r0-s0", "team-1");
    updated = advanceWinner(updated, "r0-s1", "team-16");

    const r2m0 = updated.find((m) => m.tempId === "r1-s0")!;
    expect(r2m0.teamAId).toBe("team-1");
    expect(r2m0.teamBId).toBe("team-16");
  });

  it("avanza ganador de la Final sin error (no hay próximo)", () => {
    const matches = makeBracketWithTeams();

    // Helper: simula el torneo completo avanzando siempre el teamA de cada match
    function simulateTournament(matches: MatchState[]): MatchState[] {
      let current = matches;
      // Por cada ronda, avanzar el ganador de cada match (siempre teamA)
      for (let r = 0; r < BRACKET_ROUNDS; r++) {
        const roundMatches = current.filter((m) => m.roundIndex === r);
        for (const m of roundMatches) {
          // Solo avanzar si el match tiene ambos teams (programado o listo)
          if (m.teamAId && m.teamBId) {
            // El ganador es teamAId
            current = advanceWinner(current, m.tempId, m.teamAId);
          }
        }
      }
      return current;
    }

    const final = simulateTournament(matches);

    // La final debe estar finished con un ganador
    const finalMatch = final.find((m) => m.tempId === "r4-s0")!;
    expect(finalMatch.status).toBe("finished");
    expect(finalMatch.winnerTeamId).not.toBeNull();
  });
});

// ============================================================
// TESTS — canOpenMatch
// ============================================================

describe("canOpenMatch", () => {
  it("R1 match se puede abrir si tiene ambos teams", () => {
    const matches = makeBracketWithTeams();
    const r1m0 = matches.find((m) => m.tempId === "r0-s0")!;
    expect(canOpenMatch(r1m0, matches)).toBe(true);
  });

  it("R2 match NO se puede abrir si faltan ambos parents", () => {
    const matches = makeBracketWithTeams();
    const r2m0 = matches.find((m) => m.tempId === "r1-s0")!;
    expect(canOpenMatch(r2m0, matches)).toBe(false);
  });

  it("R2 match NO se puede abrir si falta un parent", () => {
    const matches = makeBracketWithTeams();
    const updated = advanceWinner(matches, "r0-s0", "team-1");
    const r2m0 = updated.find((m) => m.tempId === "r1-s0")!;
    expect(canOpenMatch(r2m0, updated)).toBe(false);
  });

  it("R2 match se puede abrir si ambos parents terminaron", () => {
    const matches = makeBracketWithTeams();
    let updated = advanceWinner(matches, "r0-s0", "team-1");
    updated = advanceWinner(updated, "r0-s1", "team-16");
    const r2m0 = updated.find((m) => m.tempId === "r1-s0")!;
    expect(canOpenMatch(r2m0, updated)).toBe(true);
  });

  it("NO se puede abrir si ya está finished", () => {
    const matches = makeBracketWithTeams();
    const updated = advanceWinner(matches, "r0-s0", "team-1");
    const finished = updated.find((m) => m.tempId === "r0-s0")!;
    expect(canOpenMatch(finished, updated)).toBe(false);
  });
});

// ============================================================
// TESTS — shuffleSeeds
// ============================================================

describe("shuffleSeeds", () => {
  it("genera 32 asignaciones con seeds 1..32", () => {
    const assignments = shuffleSeeds(TEAM_IDS);
    expect(assignments).toHaveLength(32);

    const seeds = assignments.map((a) => a.seed).sort((a, b) => a - b);
    expect(seeds).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it("todos los teamRegistrationId están presentes", () => {
    const assignments = shuffleSeeds(TEAM_IDS);
    const ids = assignments.map((a) => a.teamRegistrationId);
    expect(new Set(ids).size).toBe(32);
    TEAM_IDS.forEach((id) => expect(ids).toContain(id));
  });

  it("falla si no hay 32 teamIds", () => {
    expect(() => shuffleSeeds(TEAM_IDS.slice(0, 31))).toThrow(/teamIds/);
  });
});

// ============================================================
// TESTS — assignSeedsFromIndices
// ============================================================

describe("assignSeedsFromIndices", () => {
  it("asigna seeds deterministamente desde índices", () => {
    // Índices [0,1,2,...,31] → seed 1=team-1, seed 2=team-2, ...
    const indices = Array.from({ length: 32 }, (_, i) => i);
    const assignments = assignSeedsFromIndices(TEAM_IDS, indices);

    expect(assignments).toHaveLength(32);
    expect(assignments[0]).toEqual({ seed: 1, teamRegistrationId: "team-1" });
    expect(assignments[31]).toEqual({ seed: 32, teamRegistrationId: "team-32" });
  });

  it("maneja índices duplicados buscando el siguiente libre", () => {
    // Todos los índices = 0 → debería asignar team-1 al seed 1, team-2 al seed 2, etc.
    const indices = Array.from({ length: 32 }, () => 0);
    const assignments = assignSeedsFromIndices(TEAM_IDS, indices);

    const ids = assignments.map((a) => a.teamRegistrationId);
    expect(new Set(ids).size).toBe(32); // sin duplicados
    TEAM_IDS.forEach((id) => expect(ids).toContain(id));
  });

  it("falla si no hay 32 teamIds", () => {
    expect(() => assignSeedsFromIndices(TEAM_IDS.slice(0, 31), Array(32).fill(0))).toThrow(
      /teamIds/
    );
  });

  it("falla si no hay 32 índices", () => {
    expect(() => assignSeedsFromIndices(TEAM_IDS, Array(31).fill(0))).toThrow(
      /índices/
    );
  });

  it("es determinista — mismo input = mismo output", () => {
    const indices = [5, 12, 3, 28, 17, 1, 30, 8, 22, 14, 9, 25, 19, 6, 11, 27,
      31, 2, 16, 23, 7, 21, 13, 26, 4, 20, 10, 24, 15, 29, 0, 18];
    const a1 = assignSeedsFromIndices(TEAM_IDS, indices);
    const a2 = assignSeedsFromIndices(TEAM_IDS, indices);
    expect(a1).toEqual(a2);
  });
});
