"use client";

/**
 * StreamScreenPreview — TOUR de la pantalla del stream.
 *
 * Reproduce EXACTAMENTE lo que ve el espectador en cada paso de la vida
 * de una llave, con los mismos bloques visuales del overlay real
 * (stream-screen.tsx): video de marca + tinte radial por equipo, escudos
 * VS, pills de READY, chips del sorteo, board de LINEUP, countdown de
 * comodines, marcador y ganador — pero alimentado por el sorteo simulado
 * y los equipos elegidos en la consola, sin depender de match_id.
 *
 * El paso se elige desde la consola (selector del tour) o con las flechas
 * ◀ ▶ sobre el viewport: es el guion cronológico del stream.
 */

import { useEffect, useState } from "react";
import { Shield, Timer, CheckCircle2, Swords } from "lucide-react";
import PowerCardStage from "@/components/stream/power-card-stage";
import { deriveTeamPalette } from "@/components/team/team-banner-bg";
import { CIV_NAMES } from "@/lib/constants/civs";
import { StreamBackdrop, EmberField, VsMedallionEpic, PHASE_BG } from "@/components/stream/stream-cinema";
import { ReadyTeamSide, ReadyTimerBoard, StatusBoard } from "@/components/stream/ready-scene";
import type { StreamTeamLite } from "./stream-view";

export interface PreviewDraw {
  gameMode: string | null;
  antimetaMode: string | null;
  playerMode: string | null;
  map: string | null;
  llave: string | null;
  civsNeeded: number;
}

/** Roster demo para los pasos de CARTA DE PODER: la carta marca a UNO entre
    todos (mismo shape que StreamTeam.players del overlay real). 3 jugadores
    = máximo real por equipo en el torneo. */
const demoPlayersA = [
  { id: "dp1", name: "Jugador 1", isCaptain: true },
  { id: "dp2", name: "Jugador 2", isCaptain: false },
  { id: "dp3", name: "Jugador 3", isCaptain: false },
];
/** Roster demo del equipo B (para el duelo de la carta mutua). */
const demoPlayersB = [
  { id: "dpb1", name: "Jugador 1", isCaptain: true },
  { id: "dpb2", name: "Jugador 2", isCaptain: false },
  { id: "dpb3", name: "Jugador 3", isCaptain: false },
];

/** Los pasos del torneo tal como los vive el espectador del stream. */
export const TOUR_STEPS = [
  {
    key: "espera",
    label: "1 · Previo — esperando READY",
    when: "El partido está agendado y los capitanes aún no confirmaron.",
    phase: "scheduled-early" as const,
  },
  {
    key: "ready",
    label: "2 · Ready abierto — cuenta el W.O.",
    when: "La ventana de READY está abierta: el primero que falta se come el reloj.",
    phase: "scheduled-open" as const,
  },
  {
    key: "tolerancia",
    label: "3 · Tolerancia — último aviso",
    when: "Venció el plazo: última tolerancia antes de la ventana de decisión.",
    phase: "scheduled-grace" as const,
  },
  {
    key: "listos",
    label: "4 · Ambos listos",
    when: "Los dos equipos confirmaron: la llave queda habilitada para el sorteo.",
    phase: "open" as const,
  },
  {
    key: "sorteo",
    label: "5 · Sorteo en curso",
    when: "El admin inició el sorteo: la ruleta decide en vivo (ver escena 1).",
    phase: "drawing" as const,
  },
  {
    key: "resultado",
    label: "6 · Resultado del sorteo",
    when: "La ruleta terminó: modo, formato y mapa quedan en pantalla.",
    phase: "drawn" as const,
  },
  {
    key: "memotest",
    label: "7 · Memotest de civs",
    when: "Los equipos eligen sus civs (ver escena 3); acá queda registrado.",
    phase: "civs" as const,
  },
  {
    key: "lineup",
    label: "8 · Lineup — quiénes juegan",
    when: "Capitanes declaran jugadores y civs; el board muestra cada lado.",
    phase: "lineup" as const,
  },
  {
    key: "poder_jugador",
    label: "9 · Anular — jugador fuera",
    when: "Un capitán usó ANULAR: el jugador anulado queda fuera y su equipo re-declara el lineup sin él.",
    phase: "lineup" as const,
  },
  {
    key: "poder_elegir",
    label: "10 · Elegir rival — carta mutua",
    when: "Ambos capitanes usaron ELEGIR RIVAL: cada equipo impone un jugador del rival y los dos re-declaran su lineup.",
    phase: "lineup" as const,
  },
  {
    key: "comodines",
    label: "11 · Ventana de comodines",
    when: "5 minutos para gastar los comodines: el countdown corre en el stream.",
    phase: "comodin_window" as const,
  },
  {
    key: "partida",
    label: "12 · Partida en juego",
    when: "El marcador en vivo mientras la sala se sincroniza con AoE2.",
    phase: "in_progress" as const,
  },
  {
    key: "ganador",
    label: "13 · Llave cerrada",
    when: "Resultado final: el ganador avanza en el bracket.",
    phase: "finished" as const,
  },
] as const;

export type TourStepKey =
  | "espera"
  | "ready"
  | "tolerancia"
  | "listos"
  | "sorteo"
  | "resultado"
  | "memotest"
  | "lineup"
  | "poder_jugador"
  | "poder_elegir"
  | "comodines"
  | "partida"
  | "ganador";

function civNameEs(id: string): string {
  return CIV_NAMES[id] ?? id;
}

/** Hora local corta para las pills de READY (como fmt.time del overlay). */
function horaLocal(d: Date): string {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function fmtHMS(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* ── Piezas (mismos estilos del overlay real) ── */

// TeamSide/ReadyPill reemplazados por ReadyTeamSide (ready-scene.tsx):
// mismo bloque visual para overlay y tour, con simetría garantizada
// (placa de alto fijo, franja de estado reservada) y escudo 3D.

function VsMedallion() {
  return <VsMedallionEpic />;
}

function BottomLabel({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{
      fontSize: "clamp(9px, 2.6cqh, 16px)", fontWeight: 700,
      letterSpacing: "4px", textTransform: "uppercase",
      color: danger ? "var(--vertigo-danger)" : "rgba(207,200,221,0.8)",
      textShadow: "0 2px 10px rgba(0,0,0,0.8)",
      marginBottom: "0.8cqh",
    }}>
      {children}
    </div>
  );
}

function BigCountdown({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      className="font-cinzel"
      style={{
        fontSize: "clamp(28px, 13cqh, 88px)", fontWeight: 700, lineHeight: 1,
        fontVariantNumeric: "tabular-nums",
        color: danger ? "var(--vertigo-danger)" : "var(--vertigo-text)",
        textShadow: danger
          ? "0 0 30px rgba(251,113,133,0.45), 0 3px 16px rgba(0,0,0,0.85)"
          : "0 0 26px rgba(124,58,237,0.35), 0 3px 16px rgba(0,0,0,0.85)",
      }}
    >
      {children}
    </div>
  );
}

function BottomNote({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontSize: "clamp(10px, 3.4cqh, 24px)", fontWeight: 700,
      letterSpacing: "3px", textTransform: "uppercase",
      color, textShadow: "0 2px 14px rgba(0,0,0,0.85)",
    }}>
      {children}
    </div>
  );
}

/** Chips del sorteo (modo/formato/mapa + civs por equipo) — bloque del overlay. */
function DrawChips({ draw, civsA, civsB }: { draw: PreviewDraw | null; civsA: string[]; civsB: string[] }) {
  if (!draw) return null;
  const cells = [
    { label: "MODO", value: draw.gameMode },
    { label: "FORMATO", value: draw.playerMode },
    { label: "MAPA", value: draw.map },
  ].filter((c) => !!c.value);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "clamp(8px, 1.6cqw, 22px)", marginTop: "0.8cqh" }}>
      {cells.map((c, i) => (
        <div key={c.label} className="sc-chip" style={{ animationDelay: `${i * 0.09}s`, minWidth: "clamp(90px, 14cqw, 170px)" }}>
          <div style={{ fontSize: "clamp(7px, 1.8cqh, 10px)", fontWeight: 700, letterSpacing: "2.5px", color: "rgba(207,200,221,0.55)", textTransform: "uppercase", marginBottom: 3 }}>
            {c.label}
          </div>
          <div className="font-cinzel" style={{ fontSize: "clamp(10px, 3cqh, 19px)", fontWeight: 700, color: "#e9d18a" }}>
            {c.value}
          </div>
        </div>
      ))}
      {(civsA.length > 0 || civsB.length > 0) && (
        <div className="sc-chip" style={{ animationDelay: "0.27s", display: "flex", alignItems: "center", gap: "0.8cqw" }}>
          {(["A", "B"] as const).map((side) => {
            const civs = side === "A" ? civsA : civsB;
            return (
              <div key={side} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {civs.map((civ) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={civ} src={`/civs/${civ}.webp`} alt={civNameEs(civ)} title={civNameEs(civ)} style={{ width: "clamp(22px, 6cqh, 38px)", height: "clamp(22px, 6cqh, 38px)", borderRadius: 8, objectFit: "cover", border: side === "A" ? "1.5px solid rgba(167,139,250,0.55)" : "1.5px solid rgba(212,175,55,0.55)" }} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Board de LINEUP para el stream: quiénes juegan y con qué civ, por equipo. */
function LineupBoard({
  draw, teamA, teamB, civsA, civsB, readyA, readyB,
}: {
  draw: PreviewDraw;
  teamA: StreamTeamLite | null;
  teamB: StreamTeamLite | null;
  civsA: string[];
  civsB: string[];
  readyA: boolean;
  readyB: boolean;
}) {
  return (
    <div className="sc-lineup-card" style={{ width: "min(94cqw, 1100px)", margin: "0 auto 1.2cqh" }}>
      <div
        className="font-cinzel"
        style={{
          textAlign: "center", marginBottom: "1.4cqh",
          fontSize: "clamp(11px, 3.2cqh, 21px)", fontWeight: 700,
          letterSpacing: "4px", textTransform: "uppercase", color: "#e9d18a",
          textShadow: "0 2px 14px rgba(0,0,0,0.85)",
        }}
      >
        LINEUP — Partida 1 · {draw.playerMode ?? ""}{draw.map ? ` · ${draw.map}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(10px, 2cqw, 28px)" }}>
        <LineupSide
          teamName={teamA?.name ?? "Equipo A"}
          civsPool={civsA}
          ready={readyA}
          accent="rgba(167,139,250,0.55)"
        />
        <LineupSide
          teamName={teamB?.name ?? "Equipo B"}
          civsPool={civsB}
          ready={readyB}
          accent="rgba(212,175,55,0.55)"
        />
      </div>
    </div>
  );
}

function LineupSide({
  teamName, civsPool, ready, accent,
}: {
  teamName: string;
  civsPool: string[];
  ready: boolean;
  accent: string;
}) {
  return (
    <div className="sc-lineup-side" style={{
      textAlign: "center", minWidth: 0,
    }}>
      {/* Nombre con alto FIJO de 2 líneas: simetría entre columnas. */}
      <div className="font-cinzel" style={{
        fontSize: "clamp(10px, 3cqh, 19px)", fontWeight: 700,
        letterSpacing: "1.5px", textTransform: "uppercase",
        color: "var(--vertigo-text, #efeaf7)", overflowWrap: "anywhere",
        height: "2.6em", lineHeight: 1.3, marginBottom: "1cqh",
      }}>
        {teamName}
      </div>
      {ready ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7cqh", alignItems: "center" }}>
          {civsPool.map((civ, i) => (
            <div key={civ} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/civs/${civ}.webp`} alt="" style={{ width: "clamp(22px, 6.4cqh, 40px)", height: "clamp(22px, 6.4cqh, 40px)", borderRadius: 8, objectFit: "cover", border: `1.5px solid ${accent}` }} />
              <span style={{ fontSize: "clamp(10px, 3cqh, 18px)", fontWeight: 700, color: "#22c55e" }}>
                {i === 0 ? "★ " : ""}Jugador {i + 1}
              </span>
              <span style={{ fontSize: "clamp(9px, 2.4cqh, 14px)", color: "rgba(207,200,221,0.8)" }}>{civNameEs(civ)}</span>
            </div>
          ))}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "0.6cqh 1.2cqw", borderRadius: 999, marginTop: "0.6cqh",
            border: "1.5px solid rgba(74,222,128,0.5)", background: "rgba(34,197,94,0.12)",
            fontSize: "clamp(9px, 2.4cqh, 14px)", fontWeight: 700, letterSpacing: "2px",
            textTransform: "uppercase", color: "#22c55e",
          }}>
            <CheckCircle2 style={{ width: "1em", height: "1em" }} /> Ready
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8cqh", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {civsPool.length > 0 ? civsPool.map((civ) => (
              <div key={civ} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/civs/${civ}.webp`} alt="" style={{ width: "clamp(24px, 7cqh, 46px)", height: "clamp(24px, 7cqh, 46px)", borderRadius: 9, objectFit: "cover", border: `1.5px solid ${accent}`, opacity: 0.9 }} />
                <span style={{ fontSize: "clamp(8px, 2.2cqh, 12px)", color: "rgba(207,200,221,0.75)" }}>{civNameEs(civ)}</span>
              </div>
            )) : (
              <span style={{ fontSize: "clamp(9px, 2.6cqh, 15px)", color: "rgba(207,200,221,0.6)", fontStyle: "italic" }}>
                Sin civs sorteadas
              </span>
            )}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "0.6cqh 1.2cqw", borderRadius: 999,
            border: `1.5px dashed ${accent}`, background: "rgba(10,6,17,0.45)",
            fontSize: "clamp(9px, 2.4cqh, 14px)", fontWeight: 600, letterSpacing: "2px",
            textTransform: "uppercase", color: "rgba(207,200,221,0.7)",
          }}>
            <Swords style={{ width: "1em", height: "1em" }} /> Eligiendo lineup…
          </div>
        </div>
      )}
    </div>
  );
}

/** Countdown vivo de la ventana de comodines (5 min desde la publicación). */
function ComodinCountdown({ from }: { from: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, 5 * 60_000 - (now - from));
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8vh" }}>
      <BottomLabel danger={left < 60000}>Comodines</BottomLabel>
      <BigCountdown danger={left < 60000}>
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </BigCountdown>
    </div>
  );
}

export default function StreamScreenPreview({
  teamA,
  teamB,
  draw,
  memoRevealedA,
  tourStep = "espera",
  tourChangedAt = 0,
}: {
  teamA: StreamTeamLite | null;
  teamB: StreamTeamLite | null;
  draw: PreviewDraw | null;
  memoRevealedA: string[];
  tourStep?: TourStepKey;
  tourChangedAt?: number;
}) {
  const [colorA] = deriveTeamPalette(teamA?.id ?? "a");
  const [colorB] = deriveTeamPalette(teamB?.id ?? "b");

  const step = TOUR_STEPS.find((s) => s.key === tourStep) ?? TOUR_STEPS[0];
  const phase = step.phase;

  // Fechas coherentes del guion: READY confirmado hace 10 min, horarios fijos.
  // El “ahora” del guion es el montaje de la escena — no Date.now() en render.
  const [sceneNow] = useState(() => Date.now());
  const readyAAt = ["open", "drawing", "drawn", "civs", "lineup", "comodin_window", "in_progress", "finished"].includes(phase)
    ? new Date(sceneNow - 10 * 60000).toISOString() : null;
  const readyBAt = ["open", "drawing", "drawn", "civs", "lineup", "comodin_window", "in_progress", "finished"].includes(phase)
    ? new Date(sceneNow - 8 * 60000).toISOString() : null;

  const preMatch = ["scheduled-early", "scheduled-open", "scheduled-grace", "open"].includes(phase);
  const showReadyPills = preMatch;

  // Civs coherentes por paso: tras el memotest, cada equipo tiene las suyas.
  const civsA = memoRevealedA.length > 0 ? memoRevealedA : ["civs", "lineup", "comodin_window", "in_progress", "finished"].includes(phase) && draw
    ? ["franks", "mongols", "britons"].slice(0, Math.max(1, draw.civsNeeded))
    : [];
  const civsB = ["civs", "lineup", "comodin_window", "in_progress", "finished"].includes(phase) && draw
    ? ["britons", "franks", "mongols"].slice(0, Math.max(1, draw.civsNeeded))
    : [];

  // Marcador de ejemplo en los pasos de partida.
  const scoreA = phase === "in_progress" ? 1 : phase === "finished" ? 2 : 0;
  const scoreB = phase === "in_progress" ? 1 : phase === "finished" ? 1 : 0;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#050505", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* FONDO: arte por fase + grado de cine + brasas (capa compartida) */}
      <StreamBackdrop bg={PHASE_BG[phase] ?? PHASE_BG.open} colorA={colorA} colorB={colorB} />
      <EmberField />

      {/* CONTENIDO */}
      <div style={{
        position: "relative", zIndex: 2, flex: 1, minHeight: 0,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "3.5cqh 4cqw 3cqh",
      }}>
        {/* Marriba: SOLO en el previo. En partido, los escudos mandan. */}
        {phase === "scheduled-early" && (
          <header style={{ textAlign: "center", flex: "none" }}>
            <div style={{
              fontSize: "clamp(9px, 2.4cqh, 16px)", fontWeight: 700,
              letterSpacing: "6px", textTransform: "uppercase",
              color: "#e9d18a", textShadow: "0 2px 14px rgba(0,0,0,0.8)",
            }}>
              Vértigo Cup
            </div>
            <div style={{
              marginTop: "0.8cqh",
              fontSize: "clamp(8px, 2cqh, 14px)", fontWeight: 600,
              letterSpacing: "3px", textTransform: "uppercase",
              color: "rgba(207,200,221,0.75)", textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            }}>
              Cuartos de final · Jornada 3 · BO3
            </div>
          </header>
        )}
        {phase !== "scheduled-early" && <div style={{ flex: "none" }} aria-hidden />}

        {/* Enfrentamiento: escudo — VS — escudo (en lineup, el board ocupa el centro) */}
        <section style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "clamp(16px, 4.5cqw, 90px)",
          flex: phase === "lineup" && draw ? "0 0 auto" : 1,
          minHeight: 0,
          paddingTop: phase === "lineup" ? "1.2cqh" : 0,
        }}>
          {(phase !== "lineup" || !draw) && (
            <>
              <ReadyTeamSide
                name={teamA?.name ?? "Equipo A"}
                emblemUrl={teamA?.emblemUrl ?? null}
                accent={colorA}
                side="A"
                readyAt={showReadyPills ? readyAAt : null}
                showState={showReadyPills}
              />
              <VsMedallion />
              <ReadyTeamSide
                name={teamB?.name ?? "Equipo B"}
                emblemUrl={teamB?.emblemUrl ?? null}
                accent={colorB}
                side="B"
                readyAt={showReadyPills ? readyBAt : null}
                showState={showReadyPills}
              />
            </>
          )}
          {phase === "lineup" && draw && tourStep !== "poder_jugador" && tourStep !== "poder_elegir" && (
            <LineupBoard
              draw={draw}
              teamA={teamA}
              teamB={teamB}
              civsA={civsA}
              civsB={civsB}
              readyA={false}
              readyB={true}
            />
          )}
          {phase === "lineup" && draw && (tourStep === "poder_jugador" || tourStep === "poder_elegir") && (
            <PowerCardStage
              kind={tourStep === "poder_jugador" ? "anular" : "elegir_rival"}
              playerId={tourStep === "poder_jugador" ? demoPlayersA[1].id : demoPlayersA[2].id}
              players={demoPlayersA}
              teamName={teamA?.name ?? "Equipo A"}
              emblemUrl={teamA?.emblemUrl ?? null}
              duel={
                tourStep === "poder_elegir"
                  ? {
                      kind: "elegir_rival",
                      targetPlayerId: demoPlayersB[1].id,
                      players: demoPlayersB,
                      teamName: teamB?.name ?? "Equipo B",
                      emblemUrl: teamB?.emblemUrl ?? null,
                    }
                  : null
              }
            />
          )}
        </section>

        {/* Franja inferior: SOLO el dato del paso, sin verbos de relleno */}
        <footer style={{ textAlign: "center", flex: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: "1.2cqh" }}>
          {phase === "scheduled-early" && (
            <ReadyTimerBoard label="Ready en" time={fmtHMS(35 * 60_000)} note="El capitán de cada equipo confirma desde su panel" />
          )}
          {phase === "scheduled-open" && (
            <ReadyTimerBoard label="Ventana de decisión de W.O. en" time={fmtHMS(14 * 60_000)} note="Sin ambos READY, la llave entra en ventana de decisión" />
          )}
          {phase === "scheduled-grace" && (
            <ReadyTimerBoard label="Tolerancia — ventana de decisión en" time={fmtHMS(4 * 60_000)} danger note="Últimos minutos: luego decide el admin o avanza el primero en confirmar" />
          )}
          {phase === "open" && (
            <StatusBoard
              label="Ventana cerrada"
              title="AMBOS LISTOS"
              success
              note={`Llave habilitada — el admin inicia el sorteo de la partida 1${draw?.playerMode ? ` · ${draw.playerMode}` : ""}`}
            />
          )}
          {phase === "drawing" && (
            <>
              <StatusBoard
                label="En vivo"
                title="SORTEO EN CURSO"
                note="La ruleta decide modo, formato y mapa — escena Sorteo"
              />
              <DrawChips draw={draw} civsA={[]} civsB={[]} />
            </>
          )}
          {phase === "drawn" && (
            <>
              <BottomNote color="#22c55e">Sorteo realizado</BottomNote>
              <DrawChips draw={draw} civsA={[]} civsB={[]} />
            </>
          )}
          {phase === "civs" && (
            <>
              <BottomNote color="#e9d18a">Memotest de civs</BottomNote>
              <DrawChips draw={draw} civsA={civsA} civsB={civsB} />
            </>
          )}
          {phase === "comodin_window" && <ComodinCountdown from={tourChangedAt || sceneNow} />}
          {phase === "in_progress" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "clamp(14px, 3cqw, 44px)" }}>
                <BigCountdown>{scoreA}</BigCountdown>
                <span className="font-cinzel" style={{ fontSize: "clamp(14px, 4.6cqh, 30px)", color: "rgba(107,99,120,0.7)" }}>—</span>
                <BigCountdown>{scoreB}</BigCountdown>
              </div>
              <BottomNote color="#e9d18a">En partida</BottomNote>
            </>
          )}
          {phase === "finished" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "clamp(14px, 3cqw, 44px)" }}>
                <BigCountdown>{scoreA}</BigCountdown>
                <span className="font-cinzel" style={{ fontSize: "clamp(14px, 4.6cqh, 30px)", color: "rgba(107,99,120,0.7)" }}>—</span>
                <BigCountdown>{scoreB}</BigCountdown>
              </div>
              <BottomNote color="#e9d18a">Ganador: {teamA?.name ?? "Equipo A"}</BottomNote>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
