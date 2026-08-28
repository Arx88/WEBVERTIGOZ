"use client";

/**
 * VÉRTIGO Cup — GameAnalysisCard ("Informe de partida")
 *
 * Card post-partida con el análisis archivado desde AoE2 Companion.
 * Se monta dentro de la GameCard existente cuando la partida está
 * terminada Y tiene análisis archivado; el link "Ver replay" manual
 * sigue intacto al lado. El payload pesado se busca on-demand acá.
 *
 * Diseño: box-score editorial, left-aligned y tabular. Sin brillos ni
 * sweeps animados. Jerarquía clara: mapa como título, scoreboard a
 * ancho completo, filas de jugador en columnas alineadas, mapa final
 * acotado en dos columnas junto al chat.
 */

import { useEffect, useState } from "react";
import {
  Crown,
  Flag,
  Download,
  ExternalLink,
  MessageSquare,
  Hammer,
  ChevronDown,
  Map as MapIcon,
  Swords,
} from "lucide-react";
import { civName } from "@/lib/constants/civs";

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
  winner: boolean;
  resignedAt: string | null;
  resignedSeconds: number | null;
  uptimes: Uptime[];
  buildOrder: BuildItem[];
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
   Piezas
   ============================================================ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        className="text-[10px] font-bold uppercase text-[var(--vertigo-purple-soft)]"
        style={{ letterSpacing: "2px" }}
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
    <div className="mt-2" aria-label="Progresión de edades">
      <div className="flex h-[6px] w-full overflow-hidden rounded-full" style={{ background: "#0d0915" }}>
        {segs.map((s, i) => {
          const w = ((s.to - s.from) / total) * 100;
          if (w <= 0) return null;
          return (
            <div
              key={i}
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
            className="absolute font-mono text-[8.5px] text-[var(--vertigo-faint)]"
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

function PlayerRow({ pl, durationSeconds }: { pl: AnalysisPlayer; durationSeconds: number | null }) {
  const civSlug = normalizeCivSlug(pl.civ);
  return (
    <div className="py-2.5" style={{ borderBottom: "1px solid var(--vertigo-line-soft)" }}>
      <div className="flex items-center gap-3">
        {civSlug ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/civs/${civSlug}.webp`}
            alt={civName(civSlug)}
            className="flex-none rounded-md"
            style={{
              width: 34,
              height: 34,
              objectFit: "cover",
              border: `1.5px solid ${pl.colorHex ?? "var(--vertigo-line)"}`,
            }}
          />
        ) : (
          <div className="flex-none rounded-md" style={{ width: 34, height: 34, background: "var(--vertigo-line-soft)" }} />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-semibold text-[var(--vertigo-text)] truncate">{pl.name ?? "—"}</span>
            {pl.winner && <Crown style={{ width: 12, height: 12, color: GOLD, flexShrink: 0 }} />}
          </div>
          <div className="text-[11px] text-[var(--vertigo-faint)] truncate">
            {civSlug ? civName(civSlug) : "Civ desconocida"}
            {pl.colorHex && (
              <span
                className="inline-block w-[7px] h-[7px] rounded-full ml-1.5 align-middle"
                style={{ background: pl.colorHex }}
                title="Color en la partida"
              />
            )}
          </div>
        </div>

        {pl.eapm != null && (
          <div className="flex-none text-right" style={{ width: 52 }}>
            <div className="text-[8px] font-bold uppercase text-[var(--vertigo-faint)]" style={{ letterSpacing: "1px" }}>
              eAPM
            </div>
            <div className="font-mono text-[15px] font-semibold text-[var(--vertigo-text)]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {pl.eapm}
            </div>
          </div>
        )}

        <div className="flex-none text-right" style={{ width: 78 }}>
          {pl.winner ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase" style={{ color: GOLD, letterSpacing: "0.5px" }}>
              Ganó
            </span>
          ) : pl.resignedSeconds != null ? (
            <span className="inline-flex items-center gap-1 font-mono text-[11px]" style={{ color: "#fda4af", fontVariantNumeric: "tabular-nums" }}>
              <Flag style={{ width: 10, height: 10 }} />
              {fmtClock(pl.resignedSeconds)}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--vertigo-faint)]">—</span>
          )}
        </div>
      </div>

      <AgeTrack uptimes={pl.uptimes} durationSeconds={durationSeconds} />

      {pl.buildOrder.length > 0 && (
        <details className="group mt-2">
          <summary
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase cursor-pointer select-none text-[var(--vertigo-faint)] hover:text-[var(--vertigo-purple-soft)] transition-colors"
            style={{ letterSpacing: "1px" }}
          >
            <Hammer style={{ width: 10, height: 10 }} />
            Build order · {pl.buildOrder.length}
            <ChevronDown style={{ width: 11, height: 11 }} className="transition-transform group-open:rotate-180" />
          </summary>
          <div
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-[3px] mt-2 pr-1"
            style={{ maxHeight: 190, overflowY: "auto" }}
          >
            {pl.buildOrder.map((b, j) => (
              <div key={j} className="flex items-center gap-2 text-[11px] leading-[1.5]">
                <span className="font-mono text-[var(--vertigo-faint)] flex-none" style={{ minWidth: 36, fontVariantNumeric: "tabular-nums" }}>
                  {fmtClock(b.seconds)}
                </span>
                <span
                  className="flex-none rounded-[2px]"
                  style={{
                    width: 6,
                    height: 6,
                    background: b.kind === "unit" ? "var(--vertigo-purple-soft)" : b.kind === "tech" ? "#fda4af" : "var(--vertigo-success)",
                  }}
                  title={b.kind === "unit" ? "Unidad" : b.kind === "tech" ? "Tecnología" : "Edificio"}
                />
                <span className="text-[var(--vertigo-muted)] capitalize truncate">{b.name.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function TeamBlock({
  name,
  color,
  players,
  winner,
  hasWinner,
  durationSeconds,
}: {
  name: string;
  color: string;
  players: AnalysisPlayer[];
  winner: boolean;
  hasWinner: boolean;
  durationSeconds: number | null;
}) {
  return (
    <div className="mt-5 first:mt-0">
      <div className="flex items-center gap-2.5 pb-2" style={{ borderBottom: "1px solid var(--vertigo-line)" }}>
        <span className="flex-none w-[8px] h-[8px] rounded-[2px] rotate-45" style={{ background: color }} />
        <span
          className="font-[Cinzel,serif] text-[13px] font-semibold uppercase text-[var(--vertigo-text)] truncate"
          style={{ letterSpacing: "1.2px" }}
        >
          {name}
        </span>
        {hasWinner && (
          <span
            className="ml-auto flex-none text-[9px] font-bold uppercase rounded-full"
            style={{
              padding: "2px 9px",
              letterSpacing: "1px",
              color: winner ? GOLD : "var(--vertigo-faint)",
              border: winner ? "1px solid rgba(212,175,55,0.4)" : "1px solid var(--vertigo-line)",
              background: winner ? "rgba(212,175,55,0.07)" : "transparent",
            }}
          >
            {winner ? "Victoria" : "Derrota"}
          </span>
        )}
      </div>
      {players.length === 0 && (
        <div className="text-[12px] text-[var(--vertigo-faint)] py-3">Sin datos de jugadores</div>
      )}
      {players.map((pl, i) => (
        <PlayerRow key={pl.profileId ?? i} pl={pl} durationSeconds={durationSeconds} />
      ))}
    </div>
  );
}

function TeamSide({ name, winner, hasWinner, right }: { name: string; winner: boolean; hasWinner: boolean; right?: boolean }) {
  return (
    <div className={`flex-1 min-w-0 flex flex-col ${right ? "items-end text-right" : "items-start"}`}>
      <div className={`flex items-center gap-2 max-w-full ${right ? "flex-row-reverse" : ""}`}>
        {winner && <Crown style={{ width: 15, height: 15, color: GOLD, flexShrink: 0 }} />}
        <span
          className="font-[Cinzel,serif] font-bold uppercase truncate"
          style={{ fontSize: 15, letterSpacing: "1px", color: winner ? GOLD : "var(--vertigo-text)" }}
        >
          {name}
        </span>
      </div>
      {hasWinner && (
        <span
          className="mt-0.5 text-[9px] font-bold uppercase"
          style={{ letterSpacing: "1.5px", color: winner ? "rgba(212,175,55,0.85)" : "var(--vertigo-faint)" }}
        >
          {winner ? "Victoria" : "Derrota"}
        </span>
      )}
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

  if (failed) return null;
  if (!data) {
    return (
      <div className="vertigo-card" style={{ padding: "22px 20px" }}>
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-[10px] w-32 rounded-full" style={{ background: "var(--vertigo-line-soft)" }} />
          <div className="h-[22px] w-52 rounded-full" style={{ background: "var(--vertigo-line-soft)" }} />
          <div className="h-[80px] rounded-xl" style={{ background: "var(--vertigo-line-soft)" }} />
        </div>
        <div className="text-[11px] text-[var(--vertigo-faint)] mt-3">Preparando el informe de la partida…</div>
      </div>
    );
  }

  const p = data.payload ?? {};
  const players = p.players ?? [];
  const teamNames = [teamAName, teamBName];
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
  const resignations = players
    .filter((pl) => pl.resignedSeconds != null)
    .slice()
    .sort((a, b) => (a.resignedSeconds ?? 0) - (b.resignedSeconds ?? 0));
  const chat = p.chat ?? [];
  const nameColor = new Map<string, string>();
  for (const pl of players) if (pl.name && pl.colorHex) nameColor.set(pl.name.toLowerCase(), pl.colorHex);

  const title = p.mapName ?? p.lobbyName ?? "Partida";
  const metaBits = [
    p.patch ? `Patch ${p.patch}` : null,
    p.lobbyName && p.mapName ? `Sala ${p.lobbyName}` : null,
    p.server ?? null,
  ].filter(Boolean) as string[];

  return (
    <div className="vertigo-card">
      {/* ---------- Header: mapa como título, duración a la derecha ---------- */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-[var(--vertigo-purple-soft)]"
            style={{ letterSpacing: "2.5px" }}
          >
            <Swords style={{ width: 12, height: 12 }} />
            Informe de partida
          </div>
          <div
            className="font-[Cinzel,serif] font-bold uppercase text-[var(--vertigo-text)] mt-1.5 truncate"
            style={{ fontSize: "clamp(18px, 2.6vw, 23px)", letterSpacing: "1px" }}
          >
            {title}
          </div>
          {metaBits.length > 0 && (
            <div className="text-[11.5px] text-[var(--vertigo-faint)] mt-1">{metaBits.join(" · ")}</div>
          )}
        </div>
        {p.durationSeconds != null && (
          <div className="text-right flex-none">
            <div className="font-mono font-semibold text-[var(--vertigo-text)]" style={{ fontSize: 24, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
              {fmtClock(p.durationSeconds)}
            </div>
            <div className="text-[9px] font-bold uppercase text-[var(--vertigo-faint)] mt-0.5" style={{ letterSpacing: "1.5px" }}>
              Duración
            </div>
          </div>
        )}
      </div>

      {/* ---------- Scoreboard: equipo A | VS | equipo B a ancho completo ---------- */}
      <div
        className="flex items-center gap-3 rounded-xl mt-4"
        style={{ padding: "13px 16px", background: "rgba(10,7,17,0.55)", border: "1px solid var(--vertigo-line-soft)" }}
      >
        <TeamSide name={teamNames[0]} winner={winnerIdx === 0} hasWinner={winnerIdx != null} />
        <span className="flex-none font-[Cinzel,serif] text-[11px] font-bold text-[var(--vertigo-faint)]" style={{ letterSpacing: "1px" }}>
          VS
        </span>
        <TeamSide name={teamNames[1]} winner={winnerIdx === 1} hasWinner={winnerIdx != null} right />
      </div>

      {/* ---------- Momentos clave (resignations) ---------- */}
      {resignations.length > 0 && (
        <div className="mt-4">
          <SectionLabel>Momentos clave</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {resignations.map((pl, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full text-[11.5px]"
                style={{ padding: "5px 11px", background: "rgba(251,113,133,0.06)", border: "1px solid rgba(251,113,133,0.18)" }}
              >
                <Flag style={{ width: 10, height: 10, color: "#fda4af" }} />
                <span className="text-[var(--vertigo-text)] font-medium">{pl.name ?? "Un jugador"}</span>
                <span className="text-[var(--vertigo-faint)]">resignó</span>
                <span className="font-mono" style={{ color: "#fda4af", fontVariantNumeric: "tabular-nums" }}>
                  {fmtClock(pl.resignedSeconds)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Equipos ---------- */}
      <div className="mt-6">
        <SectionLabel>Los ejércitos</SectionLabel>
        {byTeam.map((teamPlayers, ti) => (
          <TeamBlock
            key={ti}
            name={teamNames[ti]}
            color={TEAM_COLORS[ti]}
            players={teamPlayers}
            winner={winnerIdx === ti}
            hasWinner={winnerIdx != null}
            durationSeconds={p.durationSeconds ?? null}
          />
        ))}
        {orphans.length > 0 && (
          <TeamBlock
            name="Sin equipo"
            color="var(--vertigo-faint)"
            players={orphans}
            winner={false}
            hasWinner={false}
            durationSeconds={p.durationSeconds ?? null}
          />
        )}
      </div>

      {/* ---------- Mapa final + chat, en dos columnas ---------- */}
      {(data.svgUrl || chat.length > 0) && (
        <div
          className={`mt-6 grid gap-5 ${data.svgUrl && chat.length > 0 ? "md:grid-cols-[280px_minmax(0,1fr)]" : ""}`}
        >
          {data.svgUrl && (
            <div className="min-w-0">
              <SectionLabel>El campo de batalla</SectionLabel>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--vertigo-line)", maxWidth: 300 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.svgUrl} alt="Mapa final de la partida" className="w-full block" style={{ background: "#000" }} />
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--vertigo-muted)]">
                <MapIcon style={{ width: 11, height: 11, color: "var(--vertigo-purple-soft)" }} />
                {p.mapName ?? "Mapa final"}
                {p.durationSeconds != null && (
                  <span className="font-mono text-[10px] text-[var(--vertigo-faint)] ml-auto" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtClock(p.durationSeconds)}
                  </span>
                )}
              </div>
            </div>
          )}

          {chat.length > 0 && (
            <div className="min-w-0">
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  <MessageSquare style={{ width: 11, height: 11 }} />
                  Chat de la partida · {chat.length}
                </span>
              </SectionLabel>
              <div className="flex flex-col gap-[3px] pr-1.5" style={{ maxHeight: 300, overflowY: "auto" }}>
                {chat.map((c, i) => {
                  // player puede ser el nombre (string) o el índice de slot del jugador (number)
                  const bySlot = typeof c.player === "number" ? players[c.player] : null;
                  const playerName = bySlot?.name ?? (c.player != null ? String(c.player) : null);
                  const color = bySlot?.colorHex ?? (playerName
                    ? nameColor.get(playerName.toLowerCase()) ?? "var(--vertigo-purple-soft)"
                    : "var(--vertigo-faint)");
                  const spectator = c.audience === "spectator";
                  return (
                    <div key={i} className="flex items-baseline gap-2 text-[11.5px] leading-[1.55]">
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
      )}

      {/* ---------- Acciones ---------- */}
      <div className="flex flex-wrap gap-2.5 mt-6 pt-5" style={{ borderTop: "1px solid var(--vertigo-line-soft)" }}>
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
    </div>
  );
}
