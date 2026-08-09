import { describe, it, expect } from "vitest";
import {
  generateServerSeed,
  hashSeed,
  deterministicIndex,
  deterministicIndices,
  verifyCommit,
  generateClientSeed,
  computeHashChain,
} from "@/lib/crypto";

// ============================================================
// TESTS — generateServerSeed
// ============================================================

describe("generateServerSeed", () => {
  it("genera un string de 64 hex chars (32 bytes)", () => {
    const seed = generateServerSeed();
    expect(seed).toHaveLength(64);
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("genera seeds diferentes en cada llamada", () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seeds.add(generateServerSeed());
    }
    expect(seeds.size).toBe(100); // todos únicos
  });
});

// ============================================================
// TESTS — hashSeed (SHA-256)
// ============================================================

describe("hashSeed", () => {
  it("genera hash SHA-256 de 64 hex chars", () => {
    const hash = hashSeed("test-seed-123");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinista — mismo input = mismo output", () => {
    const h1 = hashSeed("test-seed-123");
    const h2 = hashSeed("test-seed-123");
    expect(h1).toBe(h2);
  });

  it("input diferente → output diferente", () => {
    const h1 = hashSeed("seed-1");
    const h2 = hashSeed("seed-2");
    expect(h1).not.toBe(h2);
  });

  it("matchea SHA-256 conocido de 'abc'", () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(hashSeed("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("matchea SHA-256 conocido de string vacío", () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hashSeed("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});

// ============================================================
// TESTS — deterministicIndex (HMAC-SHA256)
// ============================================================

describe("deterministicIndex", () => {
  it("devuelve un índice entre 0 y N-1", () => {
    const idx = deterministicIndex(4, "server-seed", "client-seed", 0);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(4);
  });

  it("es determinista — mismo input = mismo output", () => {
    const i1 = deterministicIndex(10, "server-seed", "client-seed", 0);
    const i2 = deterministicIndex(10, "server-seed", "client-seed", 0);
    expect(i1).toBe(i2);
  });

  it("cambia con stepIndex diferente", () => {
    const i0 = deterministicIndex(10, "server-seed", "client-seed", 0);
    const i1 = deterministicIndex(10, "server-seed", "client-seed", 1);
    // No es garantía que sean distintos, pero la probabilidad de colisión es baja
    // Si colisionan en este test, ejecutá de nuevo — pero lo más probable es que sean distintos
    const i2 = deterministicIndex(10, "server-seed", "client-seed", 2);
    // Al menos uno de los 3 debe ser distinto
    const unique = new Set([i0, i1, i2]);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("cambia con clientSeed diferente", () => {
    const i1 = deterministicIndex(10, "server-seed", "client-A", 0);
    const i2 = deterministicIndex(10, "server-seed", "client-B", 0);
    // Mismo razonamiento — al menos deberían poder ser distintos
    const i3 = deterministicIndex(10, "server-seed", "client-C", 0);
    const unique = new Set([i1, i2, i3]);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("cambia con serverSeed diferente", () => {
    const i1 = deterministicIndex(10, "server-A", "client-seed", 0);
    const i2 = deterministicIndex(10, "server-B", "client-seed", 0);
    const i3 = deterministicIndex(10, "server-C", "client-seed", 0);
    const unique = new Set([i1, i2, i3]);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("distribución aproximadamente uniforme (test estadístico básico)", () => {
    // Generar 1000 índices y verificar que la distribución es razonable
    const N = 4;
    const counts = [0, 0, 0, 0];
    for (let step = 0; step < 1000; step++) {
      const idx = deterministicIndex(N, "test-server-seed", "test-client", step);
      counts[idx]++;
    }
    // Cada índice debería aparecer entre 200 y 300 veces (esperado ~250)
    counts.forEach((c) => {
      expect(c).toBeGreaterThan(150);
      expect(c).toBeLessThan(350);
    });
  });

  it("N=1 siempre devuelve 0", () => {
    expect(deterministicIndex(1, "any", "any", 0)).toBe(0);
    expect(deterministicIndex(1, "any", "any", 999)).toBe(0);
  });
});

// ============================================================
// TESTS — deterministicIndices (batch)
// ============================================================

describe("deterministicIndices", () => {
  it("devuelve count índices", () => {
    const indices = deterministicIndices(5, 10, "server", "client", 0);
    expect(indices).toHaveLength(5);
    indices.forEach((i) => {
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(10);
    });
  });

  it("es consistente con deterministicIndex individual", () => {
    const indices = deterministicIndices(3, 10, "server", "client", 0);
    expect(indices[0]).toBe(deterministicIndex(10, "server", "client", 0));
    expect(indices[1]).toBe(deterministicIndex(10, "server", "client", 1));
    expect(indices[2]).toBe(deterministicIndex(10, "server", "client", 2));
  });

  it("startStep offset funciona", () => {
    const indices = deterministicIndices(2, 10, "server", "client", 5);
    expect(indices[0]).toBe(deterministicIndex(10, "server", "client", 5));
    expect(indices[1]).toBe(deterministicIndex(10, "server", "client", 6));
  });
});

// ============================================================
// TESTS — verifyCommit
// ============================================================

describe("verifyCommit", () => {
  it("devuelve true cuando revealedSeed corresponde a commitHash", () => {
    const seed = generateServerSeed();
    const commitHash = hashSeed(seed);
    expect(verifyCommit(seed, commitHash)).toBe(true);
  });

  it("devuelve false cuando revealedSeed NO corresponde", () => {
    const seed = generateServerSeed();
    const wrongSeed = generateServerSeed();
    const commitHash = hashSeed(seed);
    expect(verifyCommit(wrongSeed, commitHash)).toBe(false);
  });

  it("devuelve false para strings vacíos o inválidos", () => {
    expect(verifyCommit("", "")).toBe(false);
    expect(verifyCommit("invalid", "also-invalid")).toBe(false);
  });
});

// ============================================================
// TESTS — generateClientSeed
// ============================================================

describe("generateClientSeed", () => {
  it("genera client seed con matchId", () => {
    const cs = generateClientSeed("match-123");
    expect(cs).toBe("vertigo:match-123");
  });

  it("genera client seed con bracketId si no hay matchId", () => {
    const cs = generateClientSeed(undefined, "bracket-456");
    expect(cs).toBe("vertigo:bracket-456");
  });

  it("usa timestamp si no hay matchId ni bracketId", () => {
    const cs = generateClientSeed();
    expect(cs).toMatch(/^vertigo:\d+$/);
  });
});

// ============================================================
// TESTS — computeHashChain
// ============================================================

describe("computeHashChain", () => {
  it("genera hash de 64 hex chars", () => {
    const hash = computeHashChain(null, "event-data");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("es determinista — mismo input = mismo output", () => {
    const h1 = computeHashChain("prev-hash", "event-data");
    const h2 = computeHashChain("prev-hash", "event-data");
    expect(h1).toBe(h2);
  });

  it("previousHash null usa string de ceros", () => {
    const h1 = computeHashChain(null, "event-data");
    const h2 = computeHashChain("0".repeat(64), "event-data");
    expect(h1).toBe(h2);
  });

  it("cambia si previousHash cambia", () => {
    const h1 = computeHashChain("prev-1", "event-data");
    const h2 = computeHashChain("prev-2", "event-data");
    expect(h1).not.toBe(h2);
  });

  it("cambia si eventData cambia", () => {
    const h1 = computeHashChain("prev", "event-1");
    const h2 = computeHashChain("prev", "event-2");
    expect(h1).not.toBe(h2);
  });

  it("encadenamiento: cambiar un evento rompe toda la cadena posterior", () => {
    // Cadena original: e1 → e2 → e3
    const h1_orig = computeHashChain(null, "event-1");
    const h2_orig = computeHashChain(h1_orig, "event-2");
    const h3_orig = computeHashChain(h2_orig, "event-3");

    // Cadena modificada: e1' (cambiado) → e2 → e3
    const h1_mod = computeHashChain(null, "event-1-MODIFICADO");
    const h2_mod = computeHashChain(h1_mod, "event-2");
    const h3_mod = computeHashChain(h2_mod, "event-3");

    // El primer hash cambia
    expect(h1_mod).not.toBe(h1_orig);
    // El segundo también (porque depende del primero)
    expect(h2_mod).not.toBe(h2_orig);
    // El tercero también (aunque el evento sea el mismo)
    expect(h3_mod).not.toBe(h3_orig);
  });
});
