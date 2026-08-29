"use client";

/**
 * VÉRTIGO Cup — GameAnalysisCard ("Informe de partida")
 *
 * Informe post-partida con el análisis archivado desde AoE2 Companion.
 * Composición:
 *
 *   1. BANDA VS: un solo frasco horizontal — los dos equipos frente a
 *      frente con el medallón central (⚔ VS ⚔ + duración). El lado
 *      ganador se pinta dorado.
 *   2. LA GALERÍA DE LA PARTIDA: chips de superlativo — War Machine,
 *      Population Beast, eAPM GOD, Speedrunner, Último en caer — cada
 *      uno con el jugador que se lo ganó. Los mismos chips aparecen
 *      en miniatura sobre la tarjeta de cada jugador.
 *   3. CAMPO DE BATALLA: UNA TARJETA POR JUGADOR — dos columnas de
 *      equipo (A izquierda, B derecha), cada jugador en su propia
 *      tarjeta con aire de sobra: escudo, nombre, galardones, stats a
 *      la derecha, barra de edades y lectura estratégica. La tarjeta
 *      del ganador lleva tinte dorado. En mobile se apila A → B.
 *   4. EL CAMPO FINAL: mapa final + chat a lo ancho, bajo el campo de
 *      batalla (en xl comparten fila: mapa + chat).
 *   5. ACCIONES: descargar .aoe2record / ver en Companion.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Download,
  ExternalLink,
  MessageSquare,
  Swords,
  Castle,
  Zap,
  Flame,
  Sparkles,
  Sword,
  Shield,
  Target,
  Crosshair,
  Wind,
  Bomb,
  Church,
  Ship,
  Fish,
  TrendingUp,
  Users,
  Timer,
  Heart,
  Trophy,
} from "lucide-react";
import { civName } from "@/lib/constants/civs";
import { analyzeStrategy, type StrategyTag } from "@/lib/aoe2/strategy";
import { computeSuperlatives, type Superlative } from "@/lib/aoe2/superlatives";

interface Uptime {
  age: string | null;
  at: string | null;
  seconds: number | null;
}

interface BuildItem {
  at: string;
  seconds: number;
  kind: string;
  name: string;
}

interface AnalysisPlayer {
  profileId: number | null;
  name: string | null;
  team: number | null;
  civ: string | null;
  civId: number | null;
  color: string | null;
  colorHex: string | null;
  eapm: number | null;
  eapmPeak?: number | null;
  /** Conteos curados desde v3 del payload (client-side caen a buildOrder). */
  villagersTrained?: number | null;
  militaryTrained?: number | null;
  winner: boolean;
  resignedAt: string | null;
  resignedSeconds: number | null;
  uptimes: Uptime[];
  /** Payloads nuevos traen la lectura estratégica ya calculada en el server. */
  strategy?: StrategyTag[];
  /** Payloads viejos (pre-strategy) traen el build order crudo: se analiza client-side. */
  buildOrder?: BuildItem[];
  timeseries: { t: number; o: number; r: number }[];
}

interface ChatLine {
  at: string | null;
  seconds: number | null;
  player: string | number | null;
  audience: string | null;
  message: string | null;
}

interface AnalysisPayload {
  source?: string;
  aoe2MatchId?: number | null;
  lobbyName?: string | null;
  mapName?: string | null;
  patch?: string | null;
  server?: string | null;
  duration?: string | null;
  durationSeconds?: number | null;
  players?: AnalysisPlayer[];
  chat?: ChatLine[];
}

interface AnalysisData {
  payload: AnalysisPayload;
  svgUrl: string | null;
  recUrl: string | null;
  aoe2MatchId: number | null;
  teamProfiles?: [number[], number[]] | null;
}

const SEG_LABELS: Record<string, string> = {
  dark_age: "Oscura",
  feudal_age: "Feudal",
  castle_age: "Castillos",
  imperial_age: "Imperial",
};

const SEG_COLORS: Record<string, string> = {
  dark_age: "#17111f",
  feudal_age: "rgba(124,58,237,0.32)",
  castle_age: "rgba(124,58,237,0.60)",
  imperial_age: "rgba(212,175,55,0.55)",
};

const TEAM_COLORS = ["#a78bfa", "#fda4af"];
const GOLD = "#D4AF37";

/** Iconos de los tags estratégicos (los nombres los pone strategy.ts). */
const TAG_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  Castle,
  Zap,
  Flame,
  Sparkles,
  Sword,
  Shield,
  Target,
  Crosshair,
  Wind,
  Bomb,
  Church,
  Ship,
  Fish,
  TrendingUp,
};

/** Iconos de los superlativos (los nombres los pone superlatives.ts). */
const SUPERLATIVE_ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  Swords,
  Users,
  Zap,
  Timer,
  Heart,
};

const TAG_KIND_COLOR: Record<StrategyTag["kind"], string> = {
  opening: "#D4AF37",
  army: "#a78bfa",
  economy: "#34d399",
};

// Companion devuelve el slug en singular/minúsculas a veces; el catálogo y los .webp usan otra forma
const CIV_SLUG_ALIASES: Record<string, string> = {
  muisca: "muiscas",
};

function normalizeCivSlug(civ: string | null | undefined): string | null {
  if (!civ) return null;
  const lower = civ.toLowerCase();
  return CIV_SLUG_ALIASES[lower] ?? lower;
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

/* ============================================================
   Piezas compartidas
   ============================================================ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span
        className="text-[10px] font-bold uppercase text-[var(--vertigo-purple-soft)]"
        style={{ letterSpacing: "2.5px" }}
      >
        {children}
      </span>
      <span
        className="h-px flex-1"
        style={{ background: "linear-gradient(90deg, var(--vertigo-line) 0%, transparent 100%)" }}
      />
    </div>
  );
}

/** Barra de edades proporcional, fina y sin texto interno. */
function AgeTrack({ uptimes, durationSeconds }: { uptimes: Uptime[]; durationSeconds: number | null }) {
  const at = new Map<string, number>();
  for (const u of uptimes) if (u.age && u.seconds != null) at.set(u.age, u.seconds);
  const feudal = at.get("feudal_age");
  const castle = at.get("castle_age");
  const imperial = at.get("imperial_age");
  if (feudal == null && castle == null && imperial == null) return null;

  const bounds: { age: string; t: number }[] = [{ age: "dark_age", t: 0 }];
  if (feudal != null) bounds.push({ age: "feudal_age", t: feudal });
  if (castle != null) bounds.push({ age: "castle_age", t: castle });
  if (imperial != null) bounds.push({ age: "imperial_age", t: imperial });
  const last = bounds[bounds.length - 1].t;
  const total = durationSeconds && durationSeconds > last ? durationSeconds : Math.max(last * 1.15, 1);

  const segs: { age: string; from: number; to: number }[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    segs.push({ age: bounds[i].age, from: bounds[i].t, to: bounds[i + 1].t });
  }
  segs.push({ age: bounds[bounds.length - 1].age, from: last, to: total });

  return (
    <div className="mt-4" aria-label="Progresión de edades">
      <div className="flex h-[6px] w-full overflow-hidden rounded-full" style={{ background: "#0d0915" }}>
        {segs.map((s, i) => {
          const w = ((s.to - s.from) / total) * 100;
          if (w <= 0) return null;
          return (
            <div
              key={i}
              className="ga-seg"
              style={{
                width: `${w}%`,
                background: SEG_COLORS[s.age],
                borderRight: i < segs.length - 1 ? "1px solid rgba(7,3,16,0.8)" : undefined,
              }}
              title={`${SEG_LABELS[s.age]} · ${fmtClock(s.from)} → ${fmtClock(s.to)}`}
            />
          );
        })}
      </div>
      <div className="relative h-[12px] mt-[2px]">
        {bounds.slice(1).map((b, i) => (
          <span
            key={i}
            className="ga-tick absolute font-mono text-[8.5px] text-[var(--vertigo-faint)]"
            style={{
              left: `${Math.min(96, Math.max(3, (b.t / total) * 100))}%`,
              transform: "translateX(-50%)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmtClock(b.t)}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Lectura estratégica del jugador: apertura, composición y economía.
 * Reemplaza el listado crudo de acciones del build order: lo que importa
 * es "¿abrió arqueros? ¿scout rush? ¿fast castle y después qué?".
 */
function StrategyChips({ pl }: { pl: AnalysisPlayer }) {
  const tags =
    pl.strategy && pl.strategy.length > 0
      ? pl.strategy
      : analyzeStrategy(pl.buildOrder ?? [], pl.uptimes);
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-3.5">
      {tags.map((t, i) => {
        const Icon = TAG_ICONS[t.icon];
        const color = TAG_KIND_COLOR[t.kind] ?? "#a78bfa";
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 rounded-full ga-chip-soft"
            style={{
              padding: "3.5px 10px",
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${color}33`,
            }}
            title={t.kind === "opening" ? "Apertura" : t.kind === "army" ? "Composición del ejército" : "Economía"}
          >
            {Icon && <Icon style={{ width: 11, height: 11, color, flexShrink: 0 }} />}
            <span className="text-[10.5px] font-semibold" style={{ color: "var(--vertigo-text)", letterSpacing: "0.3px" }}>
              {t.label}
            </span>
            {t.detail && (
              <span className="font-mono text-[10px]" style={{ color: "var(--vertigo-faint)", fontVariantNumeric: "tabular-nums" }}>
                {t.detail}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ============================================================
   Superlativos: chip grande (galería) y mini (tarjeta del jugador).
   Lenguaje visual ÚNICO: oro = prestigio. El color por premio vive
   solo en el icono, para no pelear con los colores de los equipos.
   Jerarquía adentro del chip: primero QUIÉN lo ganó, después el dato.
   ============================================================ */

const AWARD_GOLD_TEXT = "rgba(212,175,55,0.92)";
const AWARD_BORDER = "1px solid rgba(212,175,55,0.30)";
const AWARD_BG = "rgba(212,175,55,0.05)";

function SuperlativeChipBig({ chip, playerName }: { chip: Superlative; playerName: string | null }) {
  const Icon = SUPERLATIVE_ICONS[chip.icon];
  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-full ga-chip"
      style={{
        padding: "8px 17px 8px 9px",
        background: AWARD_BG,
        border: AWARD_BORDER,
      }}
      title={`${chip.label} · ${playerName ?? ""} · ${chip.detail}`}
    >
      <span
        className="flex-none flex items-center justify-center rounded-full"
        style={{ width: 28, height: 28, background: `${chip.color}1a`, border: `1px solid ${chip.color}55` }}
      >
        {Icon && <Icon style={{ width: 14, height: 14, color: chip.color }} />}
      </span>
      <span className="flex flex-col leading-tight" style={{ gap: 1 }}>
        <span className="text-[9px] font-bold uppercase" style={{ color: AWARD_GOLD_TEXT, letterSpacing: "1.6px" }}>
          {chip.label}
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-[12.5px] font-semibold text-[var(--vertigo-text)]">{playerName ?? "—"}</span>
          {chip.detail && (
            <span className="font-mono text-[10.5px]" style={{ color: "var(--vertigo-faint)", fontVariantNumeric: "tabular-nums" }}>
              {chip.detail}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

function SuperlativeChipMini({ chip }: { chip: Superlative }) {
  const Icon = SUPERLATIVE_ICONS[chip.icon];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full flex-none ga-chip"
      style={{
        padding: "2.5px 9px",
        background: AWARD_BG,
        border: AWARD_BORDER,
      }}
      title={`${chip.label} de la partida · ${chip.detail}`}
    >
      {Icon && <Icon style={{ width: 10, height: 10, color: chip.color, flexShrink: 0 }} />}
      <span className="text-[8.5px] font-bold uppercase" style={{ color: AWARD_GOLD_TEXT, letterSpacing: "0.9px" }}>
        {chip.label}
      </span>
    </span>
  );
}

/* ============================================================
   Tarjeta de jugador — UNA tarjeta por jugador, con aire.
   ============================================================ */

function PlayerCard({
  pl,
  durationSeconds,
  badges,
}: {
  pl: AnalysisPlayer;
  durationSeconds: number | null;
  badges: Superlative[];
}) {
  const civSlug = normalizeCivSlug(pl.civ);
  const winner = pl.winner;
  const awardIds = new Set(badges.map((b) => b.id));
  const hasEapmGod = awardIds.has("eapm_god");
  const hasLastStand = awardIds.has("last_stand");
  // Deduplicación: lo que la tarjeta ya muestra como stat (eAPM, resignación)
  // no se repite como mini chapa de galardón.
  const rowBadges = badges.filter((b) => b.id !== "eapm_god" && b.id !== "last_stand");

  return (
    <article className="ga-player-card" data-winner={winner ? "true" : undefined} style={{ padding: "17px 20px 19px" }}>
      <div className="flex items-start gap-4">
        {/* Escudo de civ con el color de la partida; corona flotante si ganó */}
        <div className="relative flex-none" style={{ width: 52, height: 52 }}>
          {civSlug ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/civs/${civSlug}.webp`}
              alt={civName(civSlug)}
              loading="lazy"
              decoding="async"
              className="rounded-[12px]"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                border: `2px solid ${pl.colorHex ?? "var(--vertigo-line)"}`,
                boxShadow: winner ? "0 0 16px rgba(212,175,55,0.25)" : "none",
              }}
            />
          ) : (
            <div
              className="rounded-[12px]"
              style={{ width: "100%", height: "100%", background: "var(--vertigo-line-soft)", border: `2px solid ${pl.colorHex ?? "var(--vertigo-line)"}` }}
            />
          )}
          {winner && (
            <span
              className="absolute flex items-center justify-center rounded-full"
              style={{
                top: -8,
                right: -8,
                width: 22,
                height: 22,
                background: "#0b0713",
                border: "1.5px solid rgba(212,175,55,0.6)",
              }}
              title="Ganador"
            >
              <Crown style={{ width: 12, height: 12, color: GOLD }} />
            </span>
          )}
        </div>

        {/* Nombre + galardones + civ */}
        <div className="flex-1 min-w-0" style={{ paddingTop: 3 }}>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[15px] font-semibold text-[var(--vertigo-text)] truncate max-w-full">
              {pl.name ?? "—"}
            </span>
            {rowBadges.map((b) => (
              <SuperlativeChipMini key={b.id} chip={b} />
            ))}
          </div>
          <div className="text-[12px] text-[var(--vertigo-faint)] truncate flex items-center gap-1.5" style={{ marginTop: 5 }}>
            {civSlug ? civName(civSlug) : "Civ desconocida"}
            {pl.colorHex && (
              <span
                className="inline-block w-[7px] h-[7px] rounded-full flex-none"
                style={{ background: pl.colorHex }}
                title="Color en la partida"
              />
            )}
          </div>
        </div>

        {/* Stats: columna derecha, alineadas y sin pelear con el nombre */}
        {(pl.eapm != null || winner || pl.resignedSeconds != null) && (
          <div className="flex-none flex flex-col items-end gap-1.5" style={{ paddingTop: 1 }}>
            {pl.eapm != null && (
              <span
                className="inline-flex items-center gap-1 rounded-md font-mono"
                style={{
                  padding: "3px 8px",
                  background: hasEapmGod ? AWARD_BG : "rgba(255,255,255,0.03)",
                  border: hasEapmGod ? AWARD_BORDER : "1px solid var(--vertigo-line-soft)",
                  fontVariantNumeric: "tabular-nums",
                }}
                title={hasEapmGod ? "eAPM GOD de la partida" : "Acciones efectivas por minuto"}
              >
                {hasEapmGod && <Zap style={{ width: 10, height: 10, color: "#facc15", flexShrink: 0 }} />}
                <span className="text-[12px] font-bold text-[var(--vertigo-text)]">{pl.eapm}</span>
                <span className="text-[8px] font-bold uppercase text-[var(--vertigo-faint)]" style={{ letterSpacing: "1px" }}>
                  eAPM{pl.eapmPeak != null ? ` · ${pl.eapmPeak}` : ""}
                </span>
              </span>
            )}
            {winner ? (
              <span
                className="inline-flex items-baseline gap-1.5 rounded-md font-mono"
                style={{
                  padding: "3px 8px",
                  background: "rgba(212,175,55,0.07)",
                  border: "1px solid rgba(212,175,55,0.35)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span className="text-[8px] font-bold uppercase" style={{ letterSpacing: "1.2px", color: GOLD }}>
                  Ganó
                </span>
                {pl.resignedSeconds != null && (
                  <span className="text-[10.5px]" style={{ color: "rgba(212,175,55,0.75)" }}>
                    {fmtClock(pl.resignedSeconds)}
                  </span>
                )}
              </span>
            ) : pl.resignedSeconds != null ? (
              <span
                className="inline-flex items-center gap-1 rounded-md font-mono"
                style={{
                  padding: "3px 8px",
                  background: hasLastStand ? AWARD_BG : "rgba(251,113,133,0.06)",
                  border: hasLastStand ? AWARD_BORDER : "1px solid rgba(251,113,133,0.25)",
                  fontVariantNumeric: "tabular-nums",
                }}
                title={hasLastStand ? "Last Stand de la partida" : undefined}
              >
                <span className="text-[8px] font-bold uppercase text-[var(--vertigo-faint)]" style={{ letterSpacing: "1px" }}>
                  Resignó
                </span>
                {hasLastStand && <Heart style={{ width: 10, height: 10, color: "#fb923c", flexShrink: 0 }} />}
                <span className="text-[10.5px]" style={{ color: hasLastStand ? "#fb923c" : "#fda4af" }}>
                  {fmtClock(pl.resignedSeconds)}
                </span>
              </span>
            ) : null}
          </div>
        )}
      </div>

      <AgeTrack uptimes={pl.uptimes} durationSeconds={durationSeconds} />

      <StrategyChips pl={pl} />
    </article>
  );
}

/* ============================================================
   Sección de equipo: cabecera + tarjetas de jugador apiladas
   ============================================================ */

function TeamSection({
  name,
  color,
  winner,
  hasWinner,
  players,
  durationSeconds,
  badgesByProfile,
}: {
  name: string;
  color: string;
  winner: boolean;
  hasWinner: boolean;
  players: AnalysisPlayer[];
  durationSeconds: number | null;
  badgesByProfile: Map<number, Superlative[]>;
}) {
  const gold = hasWinner && winner;
  return (
    <section className="min-w-0">
      <div
        className="flex items-center gap-3"
        style={{
          paddingBottom: 13,
          marginBottom: 15,
          borderBottom: `2px solid ${gold ? "rgba(212,175,55,0.5)" : "var(--vertigo-line)"}`,
        }}
      >
        <span className="flex-none" style={{ width: 10, height: 10, transform: "rotate(45deg)", background: gold ? GOLD : color }} />
        <span
          className="font-[Cinzel,serif] text-[16px] font-bold uppercase truncate"
          style={{ letterSpacing: "1.4px", color: gold ? GOLD : "var(--vertigo-text)" }}
        >
          {name}
        </span>
        {hasWinner && (
          <span
            className="flex-none ml-auto text-[9px] font-bold uppercase rounded-full"
            style={{
              padding: "3.5px 11px",
              letterSpacing: "1.2px",
              color: winner ? GOLD : "var(--vertigo-faint)",
              border: winner ? "1px solid rgba(212,175,55,0.4)" : "1px solid var(--vertigo-line)",
              background: winner ? "rgba(212,175,55,0.07)" : "transparent",
            }}
          >
            {winner ? "Victoria" : "Derrota"}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {players.length === 0 && (
          <div className="text-[12px] text-[var(--vertigo-faint)]" style={{ padding: "4px 2px" }}>
            Sin datos de jugadores
          </div>
        )}
        {players.map((pl, i) => (
          <PlayerCard
            key={pl.profileId ?? i}
            pl={pl}
            durationSeconds={durationSeconds}
            badges={pl.profileId != null ? badgesByProfile.get(pl.profileId) ?? [] : []}
          />
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Banda VS: un solo frasco, medallón central
   ============================================================ */

function VsBanner({
  teamNames,
  winnerIdx,
  hasWinner,
  durationSeconds,
}: {
  teamNames: [string, string];
  winnerIdx: number | null;
  hasWinner: boolean;
  durationSeconds: number | null;
}) {
  const side = (i: 0 | 1) => {
    const gold = hasWinner && winnerIdx === i;
    return (
      <div
        className={`flex-1 flex items-center gap-2.5 min-w-0 ${i === 1 ? "flex-row-reverse" : ""}`}
      >
        {gold && <Crown style={{ width: 17, height: 17, color: GOLD, flexShrink: 0 }} />}
        <span
          className={`font-[Cinzel,serif] font-bold uppercase truncate ${gold ? "ga-gold-breath" : ""}`}
          style={{
            fontSize: 18,
            letterSpacing: "1px",
            color: gold ? GOLD : "var(--vertigo-text)",
            textAlign: i === 1 ? "right" : "left",
          }}
        >
          {teamNames[i]}
        </span>
      </div>
    );
  };

  return (
    <div
      className="flex items-center gap-4 rounded-xl flex-wrap"
      style={{
        padding: "16px 22px",
        background:
          "linear-gradient(90deg, rgba(124,58,237,0.07) 0%, rgba(10,7,17,0.2) 35%, rgba(10,7,17,0.2) 65%, rgba(251,113,133,0.07) 100%)",
        border: `1.5px solid ${hasWinner ? "rgba(212,175,55,0.3)" : "var(--vertigo-line-soft)"}`,
      }}
    >
      {side(0)}

      {/* Medallón central: ⚔ VS ⚔ + duración */}
      <div className="flex-none flex flex-col items-center" style={{ minWidth: 96 }}>
        <div className="flex items-center gap-1.5">
          <span className="h-px w-6" style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.7))" }} />
          <Swords className="ga-medallion-swords" style={{ width: 13, height: 13, color: "rgba(212,175,55,0.85)" }} />
          <span
            className="font-[Cinzel,serif] text-[17px] font-bold"
            style={{ color: GOLD, letterSpacing: "3px", lineHeight: 1 }}
          >
            VS
          </span>
          <Swords className="ga-medallion-swords" style={{ width: 13, height: 13, color: "rgba(212,175,55,0.85)", transform: "scaleX(-1)" }} />
          <span className="h-px w-6" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.7), transparent)" }} />
        </div>
        <div
          className="font-mono font-bold text-[var(--vertigo-text)] mt-1"
          style={{ fontSize: 21, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}
        >
          {durationSeconds != null ? fmtClock(durationSeconds) : "—"}
        </div>
        <div className="text-[7.5px] font-bold uppercase" style={{ letterSpacing: "2px", color: "var(--vertigo-faint)" }}>
          Duración
        </div>
      </div>

      {side(1)}
    </div>
  );
}

/* ============================================================
   Card principal
   ============================================================ */

export default function GameAnalysisCard({
  gameId,
  teamAName,
  teamBName,
}: {
  gameId: string;
  teamAName: string;
  teamBName: string;
}) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/replays/analysis?game_id=${encodeURIComponent(gameId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no-analysis"))))
      .then((d) => {
        if (alive) setData(d as AnalysisData);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [gameId]);

  const p = data?.payload ?? null;
  const players = useMemo(() => p?.players ?? [], [p]);

  // Superlativos de la partida: se calculan client-side sobre los jugadores
  // curados (función pura) y alimentan la galería + las mini chapas de tarjeta.
  const superlatives = useMemo(() => computeSuperlatives(players), [players]);
  const badgesByProfile = useMemo(() => {
    const m = new Map<number, Superlative[]>();
    for (const s of superlatives) {
      if (s.profileId == null) continue;
      const arr = m.get(s.profileId) ?? [];
      arr.push(s);
      m.set(s.profileId, arr);
    }
    return m;
  }, [superlatives]);
  const nameOfProfile = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const pl of players) if (pl.profileId != null) m.set(pl.profileId, pl.name);
    return m;
  }, [players]);

  if (failed) return null;

  if (!data || !p) {
    return (
      <div
        className="rounded-[14px]"
        style={{ border: "1px solid var(--vertigo-line-soft)", background: "rgba(10,7,17,0.6)" }}
      >
        <div style={{ padding: "24px 28px" }}>
          <div className="animate-pulse flex flex-col gap-3">
            <div className="h-[10px] w-40 rounded-full" style={{ background: "var(--vertigo-line-soft)" }} />
            <div className="h-[62px] w-full rounded-xl" style={{ background: "var(--vertigo-line-soft)" }} />
            <div className="flex gap-3">
              <div className="h-[10px] flex-1 rounded-full" style={{ background: "var(--vertigo-line-soft)" }} />
              <div className="h-[10px] w-24 rounded-full" style={{ background: "var(--vertigo-line-soft)" }} />
            </div>
          </div>
          <div className="text-[11px] text-[var(--vertigo-faint)] mt-3">Preparando el informe de la partida…</div>
        </div>
      </div>
    );
  }

  const teamNames: [string, string] = [teamAName, teamBName];
  // Re-mapear jugadores a los equipos A/B reales del torneo vía profileId
  // (el orden de equipos en Companion es arbitrario). Fallback: el team del payload.
  const profSets = [new Set(data.teamProfiles?.[0] ?? []), new Set(data.teamProfiles?.[1] ?? [])];
  const teamOfPlayer = (pl: AnalysisPlayer): number | null => {
    if (pl.profileId != null) {
      if (profSets[0].has(pl.profileId)) return 0;
      if (profSets[1].has(pl.profileId)) return 1;
    }
    return pl.team;
  };
  const byTeam = [0, 1].map((t) => players.filter((pl) => teamOfPlayer(pl) === t));
  const orphans = players.filter((pl) => {
    const t = teamOfPlayer(pl);
    return t !== 0 && t !== 1;
  });
  const winnerIdx = players.some((pl) => teamOfPlayer(pl) === 0 && pl.winner)
    ? 0
    : players.some((pl) => teamOfPlayer(pl) === 1 && pl.winner)
      ? 1
      : null;
  const chat = p.chat ?? [];

  const metaBits = [
    p.mapName ?? null,
    p.patch ? `Patch ${p.patch}` : null,
    p.lobbyName ? `Sala ${p.lobbyName}` : null,
    p.server ?? null,
  ].filter(Boolean) as string[];

  const hasCenter = Boolean(data.svgUrl) || chat.length > 0;

  return (
    <div
      className="rounded-[14px] overflow-hidden vertigo-fade-in"
      style={{ border: "1px solid rgba(212,175,55,0.25)", background: "#0b0713" }}
    >
      {/* ═══════════ META + BANDA VS ═══════════ */}
      <div style={{ padding: "22px 28px 24px", borderBottom: "1px solid var(--vertigo-line-soft)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 16 }}>
          <div
            className="flex items-center gap-2 text-[9.5px] font-bold uppercase text-[var(--vertigo-purple-soft)]"
            style={{ letterSpacing: "2.5px" }}
          >
            <Swords style={{ width: 12, height: 12 }} />
            Informe de partida
          </div>
          {metaBits.length > 0 && (
            <div className="text-[9.5px] font-semibold uppercase text-right" style={{ letterSpacing: "1.5px", color: "var(--vertigo-faint)" }}>
              {metaBits.join("  ·  ")}
            </div>
          )}
        </div>

        <VsBanner
          teamNames={teamNames}
          winnerIdx={winnerIdx}
          hasWinner={winnerIdx != null}
          durationSeconds={p.durationSeconds ?? null}
        />

        {/* ═══════════ LA GALERÍA DE LA PARTIDA ═══════════ */}
        {superlatives.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <SectionLabel>
              <span className="inline-flex items-center gap-1.5">
                <Trophy style={{ width: 11, height: 11 }} />
                La galería de la partida
              </span>
            </SectionLabel>
            <div className="ga-stagger flex flex-wrap items-center gap-3">
              {superlatives.map((s, i) => (
                <SuperlativeChipBig key={`${s.id}-${s.profileId}-${i}`} chip={s} playerName={nameOfProfile.get(s.profileId ?? -1) ?? null} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ CAMPO DE BATALLA: una tarjeta por jugador ═══════════ */}
      <div style={{ padding: "26px 28px 30px" }}>
        <SectionLabel>Campo de batalla</SectionLabel>
        <div className="grid grid-cols-1 gap-x-10 gap-y-9 lg:grid-cols-2">
          <TeamSection
            name={teamNames[0]}
            color={TEAM_COLORS[0]}
            winner={winnerIdx === 0}
            hasWinner={winnerIdx != null}
            players={byTeam[0]}
            durationSeconds={p.durationSeconds ?? null}
            badgesByProfile={badgesByProfile}
          />
          <TeamSection
            name={teamNames[1]}
            color={TEAM_COLORS[1]}
            winner={winnerIdx === 1}
            hasWinner={winnerIdx != null}
            players={byTeam[1]}
            durationSeconds={p.durationSeconds ?? null}
            badgesByProfile={badgesByProfile}
          />
        </div>

        {orphans.length > 0 && (
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--vertigo-line-soft)" }}>
            <TeamSection
              name="Sin equipo"
              color="var(--vertigo-faint)"
              winner={false}
              hasWinner={false}
              players={orphans}
              durationSeconds={p.durationSeconds ?? null}
              badgesByProfile={badgesByProfile}
            />
          </div>
        )}
      </div>

      {/* ═══════════ EL CAMPO FINAL: mapa + chat a lo ancho ═══════════ */}
      {hasCenter && (
        <div style={{ padding: "26px 28px 30px", borderTop: "1px solid var(--vertigo-line-soft)" }}>
          <div className="grid grid-cols-1 gap-9 xl:grid-cols-[minmax(0,1fr)_minmax(300px,440px)] xl:gap-12">
            {data.svgUrl && (
              <div className="min-w-0">
                <SectionLabel>El campo final</SectionLabel>
                <div
                  className="rounded-xl overflow-hidden mx-auto"
                  style={{ border: "1px solid var(--vertigo-line)", maxWidth: 640 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.svgUrl}
                    alt="Mapa final de la partida"
                    loading="lazy"
                    decoding="async"
                    className="w-full block"
                    style={{ background: "#000" }}
                  />
                </div>
              </div>
            )}
            {chat.length > 0 && (
              <div className="min-w-0">
                <SectionLabel>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare style={{ width: 11, height: 11 }} />
                    Chat · {chat.length}
                  </span>
                </SectionLabel>
                <div className="vertigo-scroll flex flex-col gap-[4px]" style={{ maxHeight: 380, overflowY: "auto" }}>
                  {chat.map((c, i) => {
                    const bySlot = typeof c.player === "number" ? players[c.player] : null;
                    const playerName = bySlot?.name ?? (c.player != null ? String(c.player) : null);
                    const color = bySlot?.colorHex ?? (playerName
                      ? players.find((pl) => pl.name?.toLowerCase() === playerName.toLowerCase())?.colorHex ?? "var(--vertigo-purple-soft)"
                      : "var(--vertigo-faint)");
                    const spectator = c.audience === "spectator";
                    return (
                      <div key={i} className="flex items-baseline gap-2 text-[11.5px] leading-[1.6]">
                        <span className="font-mono text-[var(--vertigo-faint)] flex-none" style={{ minWidth: 38, fontVariantNumeric: "tabular-nums" }}>
                          {fmtClock(c.seconds)}
                        </span>
                        {playerName && (
                          <span className="flex-none font-semibold" style={{ color: spectator ? "var(--vertigo-faint)" : color }}>
                            {playerName}
                            {spectator ? " (espectador)" : ":"}
                          </span>
                        )}
                        <span className="text-[var(--vertigo-muted)]">{c.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ ACCIONES ═══════════ */}
      {(data.recUrl || data.aoe2MatchId) && (
        <div
          className="flex flex-wrap gap-2.5"
          style={{ padding: "18px 28px 24px", borderTop: "1px solid var(--vertigo-line-soft)" }}
        >
          {data.recUrl && (
            <a href={`/api/replays/rec?game_id=${encodeURIComponent(gameId)}`} className="vertigo-btn vertigo-btn-primary">
              <Download style={{ width: 13, height: 13 }} />
              Descargar .aoe2record
            </a>
          )}
          {data.aoe2MatchId && (
            <a
              href={`https://aoe2companion.com/match/${data.aoe2MatchId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="vertigo-btn vertigo-btn-ghost"
            >
              <ExternalLink style={{ width: 13, height: 13 }} />
              Ver en AoE2 Companion
            </a>
          )}
        </div>
      )}
    </div>
  );
}
