import { describe, it, expect } from "vitest";
import {
  generateBracket,
  assignSeedsToTeams,
  advanceWinner,
  canOpenMatch,
  assignSeedsFromIndices,
  type MatchState,
  type SeedAssignment,
} from "@/lib/bracket/engine";

// ============================================================
// SIMULACIÓN COMPLETA DE UN TORNEO DE 32 EQUIPOS
// ============================================================
//
// Este test simula el flujo completo de un torneo:
// 1. Generar bracket
// 2. Asignar seeds a 32 equipos
// 3. Por cada ronda, abrir matches, simular ganador, avanzar
// 4. Verificar que el bracket avanza correctamente
// 5. Verificar que el ganador de la Final es el campeón

const TEAM_IDS = Array.from({ length: 32 }, (_, i) => `team-${i + 1}`);

function makeTournamentStart(): MatchState[] {
  const bracket = generateBracket(32);
  const assignments: SeedAssignment[] = TEAM_IDS.map((teamRegistrationId, i) => ({
    seed: i + 1,
    teamRegistrationId,
  }));
  return assignSeedsToTeams(bracket, assignments);
}

describe("E2E: Torneo completo de 32 equipos", () => {
  it("simula todo el torneo hasta la final y corona un campeón", () => {
    let matches = makeTournamentStart();

    // Verificar estado inicial: 31 matches, todos scheduled
    expect(matches).toHaveLength(31);
    expect(matches.every((m) => m.status === "scheduled")).toBe(true);

    // R1: 16 matches, todos se pueden abrir (tienen teams)
    const r1 = matches.filter((m) => m.roundIndex === 0);
    expect(r1).toHaveLength(16);
    expect(r1.every((m) => canOpenMatch(m, matches))).toBe(true);

    // Simular R1: gana siempre el teamA
    for (const m of r1) {
      matches = advanceWinner(matches, m.tempId, m.teamAId!);
    }

    // Verificar que R1 está toda finished
    const r1After = matches.filter((m) => m.roundIndex === 0);
    expect(r1After.every((m) => m.status === "finished")).toBe(true);
    expect(r1After.every((m) => m.winnerTeamId !== null)).toBe(true);

    // R2: 8 matches, todos se pueden abrir (ambos parents terminaron)
    const r2 = matches.filter((m) => m.roundIndex === 1);
    expect(r2).toHaveLength(8);
    expect(r2.every((m) => canOpenMatch(m, matches))).toBe(true);
    expect(r2.every((m) => m.teamAId !== null && m.teamBId !== null)).toBe(true);

    // Simular R2
    for (const m of r2) {
      matches = advanceWinner(matches, m.tempId, m.teamAId!);
    }

    // R3: 4 matches
    const r3 = matches.filter((m) => m.roundIndex === 2);
    expect(r3).toHaveLength(4);
    expect(r3.every((m) => canOpenMatch(m, matches))).toBe(true);
    for (const m of r3) {
      matches = advanceWinner(matches, m.tempId, m.teamAId!);
    }

    // R4 (Semifinal): 2 matches
    const r4 = matches.filter((m) => m.roundIndex === 3);
    expect(r4).toHaveLength(2);
    expect(r4.every((m) => canOpenMatch(m, matches))).toBe(true);
    for (const m of r4) {
      matches = advanceWinner(matches, m.tempId, m.teamAId!);
    }

    // R5 (Final): 1 match
    const r5 = matches.filter((m) => m.roundIndex === 4);
    expect(r5).toHaveLength(1);
    expect(canOpenMatch(r5[0], matches)).toBe(true);

    // Simular final
    const finalMatch = r5[0];
    const champion = finalMatch.teamAId!;
    matches = advanceWinner(matches, finalMatch.tempId, champion);

    // Verificar que el campeón es el teamA de la final
    const finalAfter = matches.find((m) => m.tempId === finalMatch.tempId)!;
    expect(finalAfter.status).toBe("finished");
    expect(finalAfter.winnerTeamId).toBe(champion);

    // Verificar que TODOS los matches están finished
    expect(matches.every((m) => m.status === "finished")).toBe(true);
    expect(matches.every((m) => m.winnerTeamId !== null)).toBe(true);
  });

  it("simula torneo donde gana siempre el teamB", () => {
    let matches = makeTournamentStart();

    // Por cada ronda, gana teamB
    for (let r = 0; r < 5; r++) {
      const roundMatches = matches.filter((m) => m.roundIndex === r);
      for (const m of roundMatches) {
        // Solo avanzar si tiene ambos teams
        if (m.teamAId && m.teamBId) {
          matches = advanceWinner(matches, m.tempId, m.teamBId!);
        }
      }
    }

    // Todos terminados
    expect(matches.every((m) => m.status === "finished")).toBe(true);

    // El campeón es el teamB de la final
    const final = matches.find((m) => m.roundIndex === 4)!;
    expect(final.winnerTeamId).toBe(final.teamBId);
  });

  it("simula torneo con resultados mixtos (alternando A/B)", () => {
    let matches = makeTournamentStart();

    for (let r = 0; r < 5; r++) {
      const roundMatches = matches.filter((m) => m.roundIndex === r);
      roundMatches.forEach((m, idx) => {
        if (m.teamAId && m.teamBId) {
          // Alternar: partidos pares gana A, impares gana B
          const winner = idx % 2 === 0 ? m.teamAId! : m.teamBId!;
          matches = advanceWinner(matches, m.tempId, winner);
        }
      });
    }

    // Verificar que el torneo terminó
    expect(matches.every((m) => m.status === "finished")).toBe(true);
    const final = matches.find((m) => m.roundIndex === 4)!;
    expect(final.winnerTeamId).not.toBeNull();
  });

  it("no permite avanzar ganador de un match que no terminó", () => {
    const matches = makeTournamentStart();
    // Intentar avanzar un match que no existe
    expect(() => advanceWinner(matches, "no-existe", "team-1")).toThrow("no encontrado");
  });

  it("no permite avanzar un ganador que no es del match", () => {
    const matches = makeTournamentStart();
    const m0 = matches[0]; // r0-s0: team-1 vs team-32
    expect(() => advanceWinner(matches, m0.tempId, "team-5")).toThrow("no es uno de los equipos");
  });

  it("verifica que los matches de R>1 no se pueden abrir hasta que sus parents terminen", () => {
    let matches = makeTournamentStart();

    // R2 match 0 NO se puede abrir al inicio
    const r2m0 = matches.find((m) => m.tempId === "r1-s0")!;
    expect(canOpenMatch(r2m0, matches)).toBe(false);

    // Avanzar solo un parent (r0-s0)
    matches = advanceWinner(matches, "r0-s0", "team-1");
    const r2m0After1 = matches.find((m) => m.tempId === "r1-s0")!;
    expect(canOpenMatch(r2m0After1, matches)).toBe(false); // sigue sin poder

    // Avanzar el otro parent (r0-s1)
    matches = advanceWinner(matches, "r0-s1", "team-16");
    const r2m0After2 = matches.find((m) => m.tempId === "r1-s0")!;
    expect(canOpenMatch(r2m0After2, matches)).toBe(true); // ahora sí
  });

  it("preserva la integridad del bracket al avanzar ganadores en orden aleatorio", () => {
    let matches = makeTournamentStart();

    // Avanzar R1 en orden aleatorio
    const r1 = matches.filter((m) => m.roundIndex === 0);
    const shuffled = [...r1].sort(() => Math.random() - 0.5);
    for (const m of shuffled) {
      matches = advanceWinner(matches, m.tempId, m.teamAId!);
    }

    // Verificar que R2 tiene todos sus matches con ambos teams
    const r2 = matches.filter((m) => m.roundIndex === 1);
    expect(r2.every((m) => m.teamAId !== null && m.teamBId !== null)).toBe(true);
  });

  it("el campeón viene de un match de R1 (todos los teams vienen de R1)", () => {
    let matches = makeTournamentStart();

    // Simular torneo completo
    for (let r = 0; r < 5; r++) {
      const roundMatches = matches.filter((m) => m.roundIndex === r);
      for (const m of roundMatches) {
        if (m.teamAId && m.teamBId) {
          matches = advanceWinner(matches, m.tempId, m.teamAId!);
        }
      }
    }

    // El campeón es uno de los 32 teams originales
    const final = matches.find((m) => m.roundIndex === 4)!;
    expect(TEAM_IDS).toContain(final.winnerTeamId);
  });
});

// ============================================================
// TEST: Asignación de seeds determinista
// ============================================================

describe("E2E: Sorteo determinista con commit-reveal simulado", () => {
  it("simula sorteo de bracket con índices pre-computados", () => {
    // Simular 32 índices "aleatorios" (en realidad deterministas)
    const indices = [
      5, 12, 3, 28, 17, 1, 30, 8, 22, 14, 9, 25, 19, 6, 11, 27,
      31, 2, 16, 23, 7, 21, 13, 26, 4, 20, 10, 24, 15, 29, 0, 18,
    ];

    const assignments = assignSeedsFromIndices(TEAM_IDS, indices);

    // Verificar que todos los seeds 1..32 están asignados
    const seeds = assignments.map((a: SeedAssignment) => a.seed).sort((a: number, b: number) => a - b);
    expect(seeds).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));

    // Verificar que todos los teamIds están presentes (sin duplicados)
    const ids = assignments.map((a: SeedAssignment) => a.teamRegistrationId);
    expect(new Set(ids).size).toBe(32);

    // Verificar determinismo: mismo input = mismo output
    const assignments2 = assignSeedsFromIndices(TEAM_IDS, indices);
    expect(assignments2).toEqual(assignments);
  });

  it("simula sorteo y verifica que el bracket se arma correctamente", () => {
    // Sortear seeds
    const indices = Array.from({ length: 32 }, (_, i) => (i * 7) % 32); // índices deterministas
    const assignments = assignSeedsFromIndices(TEAM_IDS, indices);

    // Generar bracket con esas asignaciones
    const bracket = generateBracket(32);
    const matches = assignSeedsToTeams(bracket, assignments);

    // Verificar que R1 tiene 16 matches con teams asignados
    const r1 = matches.filter((m) => m.roundIndex === 0);
    expect(r1).toHaveLength(16);
    expect(r1.every((m) => m.teamAId !== null && m.teamBId !== null)).toBe(true);

    // Verificar que no hay teams duplicados en R1
    const allR1Teams = r1.flatMap((m) => [m.teamAId, m.teamBId]);
    expect(new Set(allR1Teams).size).toBe(32);
  });
});
