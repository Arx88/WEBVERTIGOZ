/**
 * VÉRTIGO Cup — Superlativos de la partida (chips de galardón).
 *
 * De cada partida salen unos pocos protagonistas: el que más ejército
 * produjo, el que más aldeanos crió, el de dedos más rápidos… Estos
 * chips los señalan con un apodo.
 *
 * Reglas:
 *   - Una función pura sobre los jugadores curados del análisis: corre
 *     client-side al renderizar el informe (así sirve igual para payloads
 *     recién curados y para los archivados antes de los contadores).
 *   - Empates: el chip se lo llevan TODOS los que compartan el récord.
 *   - Umbrales mínimos para no premiar partidas de 10 minutos con
 *     "Population Beast ×6 aldeanos".
 *
 * Nota honesta: la API de Companion NO expone kills por jugador (solo
 * build order, uptimes, eAPM y resignation). Por eso el chip militar
 * mide PRODUCCIÓN de unidades ("War Machine") y no bajas reales.
 */

import { productionCounts } from "./strategy";

export type SuperlativeId =
  | "war_machine"
  | "population_beast"
  | "eapm_god"
  | "speedrunner"
  | "last_stand";

export interface Superlative {
  id: SuperlativeId;
  label: string;
  /** Nombre del icono de lucide-react (lo resuelve la card). */
  icon: string;
  /** Color de acento del chip. */
  color: string;
  /** El dato que ganó el récord: "×214 aldeanos", "97 eAPM"… */
  detail: string;
  /** Jugador que se lo lleva (null nunca se muestra). */
  profileId: number | null;
}

export interface SuperlativePlayer {
  profileId: number | null;
  eapm?: number | null;
  eapmPeak?: number | null;
  resignedSeconds?: number | null;
  villagersTrained?: number | null;
  militaryTrained?: number | null;
  buildOrder?: { kind: string; name: string }[];
  uptimes?: { age: string | null; seconds: number | null }[];
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

/** Aldeanos entrenados: campo curado (v3) o conteo client-side del build order. */
function villagersOf(p: SuperlativePlayer): number | null {
  if (p.villagersTrained != null) return p.villagersTrained;
  if (p.buildOrder) return productionCounts(p.buildOrder).villagers;
  return null;
}

/** Unidades militares entrenadas: campo curado (v3) o conteo client-side. */
function militaryOf(p: SuperlativePlayer): number | null {
  if (p.militaryTrained != null) return p.militaryTrained;
  if (p.buildOrder) return productionCounts(p.buildOrder).military;
  return null;
}

function castleAgeAt(p: SuperlativePlayer): number | null {
  return p.uptimes?.find((u) => u.age === "castle_age")?.seconds ?? null;
}

export function computeSuperlatives(players: SuperlativePlayer[]): Superlative[] {
  const out: Superlative[] = [];
  if (players.length === 0) return out;

  // ── War Machine: más producción militar de la partida (≥ 10 unidades) ──
  const military = players
    .map((p) => ({ p, v: militaryOf(p) }))
    .filter((x): x is { p: SuperlativePlayer; v: number } => x.v != null && x.v >= 10);
  if (military.length > 0) {
    const top = Math.max(...military.map((x) => x.v));
    for (const x of military.filter((x) => x.v === top)) {
      out.push({
        id: "war_machine",
        label: "War Machine",
        icon: "Swords",
        color: "#f87171",
        detail: `×${top} militares`,
        profileId: x.p.profileId,
      });
    }
  }

  // ── Population Beast: más aldeanos entrenados (≥ 15) ──
  const villagers = players
    .map((p) => ({ p, v: villagersOf(p) }))
    .filter((x): x is { p: SuperlativePlayer; v: number } => x.v != null && x.v >= 15);
  if (villagers.length > 0) {
    const top = Math.max(...villagers.map((x) => x.v));
    for (const x of villagers.filter((x) => x.v === top)) {
      out.push({
        id: "population_beast",
        label: "Population Beast",
        icon: "Users",
        color: "#34d399",
        detail: `×${top} aldeanos`,
        profileId: x.p.profileId,
      });
    }
  }

  // ── eAPM GOD: el más rápido; empate lo desempata el pico por minuto ──
  const withEapm = players.filter((p) => p.eapm != null && p.eapm > 0);
  if (withEapm.length > 0) {
    const top = Math.max(...withEapm.map((p) => p.eapm ?? 0));
    let winners = withEapm.filter((p) => p.eapm === top);
    if (winners.length > 1) {
      const topPeak = Math.max(...winners.map((p) => p.eapmPeak ?? p.eapm ?? 0));
      winners = winners.filter((p) => (p.eapmPeak ?? p.eapm ?? 0) === topPeak);
    }
    for (const w of winners) {
      out.push({
        id: "eapm_god",
        label: "eAPM GOD",
        icon: "Zap",
        color: "#facc15",
        detail: `${top} eAPM`,
        profileId: w.profileId,
      });
    }
  }

  // ── Speedrunner: llegó a Castillos antes que nadie (y ≤ 20:00) ──
  const castles = players
    .map((p) => ({ p, v: castleAgeAt(p) }))
    .filter((x): x is { p: SuperlativePlayer; v: number } => x.v != null && x.v >= 0);
  if (castles.length > 0) {
    const best = Math.min(...castles.map((x) => x.v));
    if (best <= 20 * 60) {
      for (const x of castles.filter((x) => x.v === best)) {
        out.push({
          id: "speedrunner",
          label: "Speedrunner",
          icon: "Timer",
          color: "#38bdf8",
          detail: `${fmtClock(best)} a Castillos`,
          profileId: x.p.profileId,
        });
      }
    }
  }

  // ── Último en caer: el que más resistió antes de rendirse ──
  const resigned = players.filter(
    (p) => p.resignedSeconds != null && p.resignedSeconds > 0
  );
  if (resigned.length > 0) {
    const top = Math.max(...resigned.map((p) => p.resignedSeconds ?? 0));
    for (const p of resigned.filter((p) => p.resignedSeconds === top)) {
      out.push({
        id: "last_stand",
        label: "Last Stand",
        icon: "Heart",
        color: "#fb923c",
        detail: `resistió ${fmtClock(top)}`,
        profileId: p.profileId,
      });
    }
  }

  return out;
}
