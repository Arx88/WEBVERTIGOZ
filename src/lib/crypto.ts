/**
 * Funciones criptográficas para commit-reveal fairness de los sorteos.
 *
 * El flujo es:
 * 1. Server genera serverSeed (32 bytes random, 64 hex chars)
 * 2. Server calcula commitHash = SHA-256(serverSeed) y lo guarda en DB (público)
 * 3. Server guarda serverSeed en memoria (NO en DB) hasta el reveal
 * 4. Para cada etapa del sorteo, se computa el índice determinista:
 *    idx = parseInt(HMAC-SHA256(serverSeed, clientSeed + stepIndex).slice(0,8), 16) % N
 * 5. Después del sorteo (o N días), server publica serverSeed (reveal)
 * 6. Cualquiera puede verificar: SHA-256(revealedSeed) === commitHash
 *
 * HMAC-SHA256 es más seguro que SHA-256 directo porque el serverSeed nunca
 * aparece como input del hash, solo como clave. Incluso si un atacante conoce
 * el clientSeed y el stepIndex, no puede brute-forcear el serverSeed.
 */

import { createHmac, createHash, randomBytes } from "crypto";

/**
 * Genera un serverSeed aleatorio de 32 bytes (64 hex chars).
 * Solo se guarda en memoria del servidor hasta el reveal.
 */
export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Calcula el commit hash (SHA-256 del serverSeed).
 * Este es el valor que se guarda en DB y es público.
 */
export function hashSeed(serverSeed: string): string {
  return createHash("sha256").update(serverSeed).digest("hex");
}

/**
 * Computa el índice determinista para una etapa del sorteo.
 * Misma seed + mismo clientSeed + mismo step = mismo resultado. Siempre.
 *
 * @param N - Cantidad de items en la etapa (ej. 4 modos de juego)
 * @param serverSeed - Seed del servidor (solo conocida por server hasta reveal)
 * @param clientSeed - Seed del cliente (puede ser pública, ej. matchId)
 * @param stepIndex - Índice de la etapa (0=modo, 1=antimeta, 2=formato, 3=mapa, 4=civs, 5=llave)
 * @returns Índice ganador (0 a N-1)
 */
export function deterministicIndex(
  N: number,
  serverSeed: string,
  clientSeed: string,
  stepIndex: number
): number {
  const message = `${clientSeed}:${stepIndex}`;
  const hmac = createHmac("sha256", serverSeed).update(message).digest("hex");
  // Usar los primeros 8 hex chars (32 bits) para el módulo
  return parseInt(hmac.slice(0, 8), 16) % N;
}

/**
 * Computa N índices deterministas en una sola llamada (más eficiente para sorteo completo).
 * Útil para el seeding draw donde necesitamos 32 índices de una vez.
 */
export function deterministicIndices(
  count: number,
  N: number,
  serverSeed: string,
  clientSeed: string,
  startStep: number = 0
): number[] {
  const indices: number[] = [];
  for (let i = 0; i < count; i++) {
    indices.push(deterministicIndex(N, serverSeed, clientSeed, startStep + i));
  }
  return indices;
}

/**
 * Verifica que revealed_seed corresponde a commit_hash.
 * Usado en /sorteos/[id]/verificar.
 */
export function verifyCommit(
  revealedSeed: string,
  commitHash: string
): boolean {
  return hashSeed(revealedSeed) === commitHash;
}

/**
 * Genera un clientSeed público a partir de un matchId o bracketId.
 * El clientSeed no necesita ser secreto — su único propósito es que cada sorteo
 * tenga resultados distintos incluso si el serverSeed se reutilizara (que no debería).
 */
export function generateClientSeed(matchId?: string, bracketId?: string): string {
  const base = matchId ?? bracketId ?? Date.now().toString();
  return `vertigo:${base}`;
}

/**
 * Computa el hash de la cadena de auditoría (hashChain).
 * Cada evento del log se encadena al anterior: hashChain_n = SHA-256(previousHash + eventData)
 * Esto hace que el log sea inmutable: cambiar un evento rompe toda la cadena posterior.
 */
export function computeHashChain(
  previousHash: string | null,
  eventData: string
): string {
  const prev = previousHash ?? "0".repeat(64);
  return createHash("sha256").update(prev + eventData).digest("hex");
}
