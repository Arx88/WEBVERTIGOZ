"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle2 } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import LiveDrawRoulette from "@/components/ruleta/live-draw-roulette";
import { useReadyWindow } from "@/components/shared/ready-deadline-timer";
import { deriveTeamPalette } from "@/components/team/team-banner-bg";
import { fmt } from "@/lib/format";

export interface StreamTeam {
  id: string;
  name: string;
  emblemUrl: string | null;
}

export interface StreamMatchData {
  id: string;
  status: string;
  format: string | null;
  scheduledAtStart: string | null;
  jornadaLabel: string | null;
  readyAAt: string | null;
  readyBAt: string | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  roundName: string | null;
  /** La partida más reciente está en "drawing" (re-sorteo de una partida 2/3
      de BO3: el match queda in_progress pero la ruleta debe salir igual). */
  activeGameDrawing: boolean;
  teamA: StreamTeam | null;
  teamB: StreamTeam | null;
}

function fmtHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Escena de la VISTA STREAM (Browser Source de OBS).
 *
 * Fondo animado de marca con tinte a cada lado del color del equipo,
 * escudos + nombres enfrentados, indicador de READY por equipo y la
 * cuenta de la ventana abajo. Se actualiza sola por Realtime: cuando un
 * capitán confirma, su READY se prende sin recargar.
 */
export default function StreamScreen({ match }: { match: StreamMatchData }) {
  const router = useRouter();
  const { phase, msToOpen, msToDeadline } = useReadyWindow(match.scheduledAtStart, match.status);

  // Refresco en vivo: cambios en el match → re-render del server.
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 350);
    };
    const channel = supabase
      .channel(`overlay-match-${match.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match", filter: `id=eq.${match.id}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_game", filter: `match_id=eq.${match.id}` },
        scheduleRefresh
      )
      .subscribe();
    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, [match.id, router]);

  const [colorA] = deriveTeamPalette(match.teamA?.id ?? "a");
  const [colorB] = deriveTeamPalette(match.teamB?.id ?? "b");

  // La ruleta sale cuando el match está en sorteo (P1) o cuando la partida
  // más reciente está en sorteo (re-giro de la partida 2/3 de un BO3).
  const showRoulette = match.status === "drawing" || match.activeGameDrawing;

  const preMatch = match.status === "scheduled" || match.status === "open";
  const inGame = match.status === "in_progress";
  const closed = match.status === "finished" || match.status === "forfeit";
  const winnerName =
    match.winnerTeamId && match.teamA?.id === match.winnerTeamId
      ? match.teamA.name
      : match.winnerTeamId && match.teamB?.id === match.winnerTeamId
      ? match.teamB.name
      : null;

  const kicker = [
    match.roundName,
    match.jornadaLabel,
    match.format,
  ].filter(Boolean).join("  ·  ");

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "#070310",
        color: "var(--vertigo-text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* RULETA EN VIVO — fullscreen durante el sorteo (capturada por OBS
          desde este mismo Browser Source). */}
      {showRoulette && <LiveDrawRoulette matchId={match.id} />}
      {/* ══ FONDO: video de marca + tinte de cada equipo a su lado ══ */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <video
        autoPlay
        muted
        loop
        playsInline
        src="/landing/mi-reino-hero.mp4"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center 35%", opacity: 0.45,
        }}
      />
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 55% 75% at 10% 50%, ${colorA}30, transparent 62%)`,
      }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 55% 75% at 90% 50%, ${colorB}30, transparent 62%)`,
      }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(7,3,16,0.62) 0%, rgba(7,3,16,0.32) 45%, rgba(7,3,16,0.85) 100%)",
      }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, boxShadow: "inset 0 0 240px rgba(0,0,0,0.8)" }} />
      {/* Línea dorada superior */}
      <div aria-hidden style={{
        position: "absolute", top: 0, left: "8%", right: "8%", height: 2,
        background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)",
      }} />

      {/* ══ CONTENIDO ══ */}
      <div style={{
        position: "relative", zIndex: 2, flex: 1,
        display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "4.5vh 4vw",
      }}>
        {/* Kicker superior */}
        <header style={{ textAlign: "center" }}>
          <div style={{
            fontSize: "clamp(11px, 1vw, 16px)", fontWeight: 700,
            letterSpacing: "6px", textTransform: "uppercase",
            color: "#e9d18a", textShadow: "0 2px 14px rgba(0,0,0,0.8)",
          }}>
            Vértigo Cup
          </div>
          {kicker && (
            <div style={{
              marginTop: 8,
              fontSize: "clamp(10px, 0.85vw, 14px)", fontWeight: 600,
              letterSpacing: "3px", textTransform: "uppercase",
              color: "rgba(207,200,221,0.75)", textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            }}>
              {kicker}
            </div>
          )}
        </header>

        {/* Enfrentamiento: escudo — VS — escudo */}
        <section style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "clamp(24px, 4.5vw, 90px)",
        }}>
          <TeamSide team={match.teamA} readyAt={match.readyAAt} preMatch={preMatch} />
          <VsMedallion />
          <TeamSide team={match.teamB} readyAt={match.readyBAt} preMatch={preMatch} />
        </section>

        {/* Franja inferior: ventana de READY, estado o marcador */}
        <footer style={{ textAlign: "center", minHeight: "16vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
          {preMatch && match.status === "open" && (
            <BottomNote color="var(--vertigo-success)">
              ✓ Ambos equipos listos — llave habilitada para el sorteo
            </BottomNote>
          )}

          {preMatch && match.status === "scheduled" && phase === "early" && (
            <>
              <BottomLabel>El READY se habilita en</BottomLabel>
              <BigCountdown>{fmtHMS(msToOpen ?? 0)}</BigCountdown>
            </>
          )}

          {preMatch && match.status === "scheduled" && (phase === "open" || phase === "grace") && (
            <>
              <BottomLabel danger={phase === "grace"}>
                {phase === "grace" ? "Tolerancia en curso — W.O. automático en" : "W.O. automático en"}
              </BottomLabel>
              <BigCountdown danger={phase === "grace"}>{fmtHMS(msToDeadline ?? 0)}</BigCountdown>
            </>
          )}

          {preMatch && match.status === "scheduled" && phase === "expired" && (
            <BottomNote color="var(--vertigo-danger)">Tiempo agotado — resolviendo W.O.…</BottomNote>
          )}

          {preMatch && match.status === "scheduled" && phase === "no-date" && (
            <BottomNote color="var(--vertigo-muted)">Sin horario asignado</BottomNote>
          )}

          {match.status === "drawing" && <BottomNote color="#fbbf24">◆ Sorteo en curso — el azar decide</BottomNote>}
          {match.status === "lineup" && <BottomNote color="#fbbf24">Fase de lineup</BottomNote>}
          {match.status === "comodin_window" && <BottomNote color="#fbbf24">Ventana de comodines abierta</BottomNote>}

          {(inGame || closed) && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "clamp(18px, 2.5vw, 44px)" }}>
                <BigCountdown>{match.scoreA}</BigCountdown>
                <span className="font-cinzel" style={{ fontSize: "clamp(18px, 2vw, 30px)", color: "var(--vertigo-faint)" }}>—</span>
                <BigCountdown>{match.scoreB}</BigCountdown>
              </div>
              <BottomNote color={closed ? "#e9d18a" : "var(--vertigo-success)"}>
                {closed
                  ? winnerName ? `Ganador: ${winnerName}` : "Llave cerrada"
                  : "Partida en juego"}
              </BottomNote>
            </>
          )}
        </footer>
      </div>
    </main>
  );
}

/* ── Piezas ─────────────────────────────────────────────── */

function TeamSide({
  team,
  readyAt,
  preMatch,
}: {
  team: StreamTeam | null;
  readyAt: string | null;
  preMatch: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2.2vh", flex: "0 1 30%", minWidth: 0 }}>
      {/* Escudo */}
      <div style={{
        width: "clamp(110px, 11vw, 190px)", height: "clamp(110px, 11vw, 190px)",
        borderRadius: 24, overflow: "hidden", flexShrink: 0,
        border: "2px solid rgba(212,175,55,0.55)",
        background: "rgba(13,9,19,0.85)",
        boxShadow: "0 16px 44px rgba(0,0,0,0.6), 0 0 34px rgba(212,175,55,0.16)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {team?.emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.emblemUrl} alt={team.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Shield style={{ width: "42%", height: "42%", color: "var(--vertigo-purple-soft)" }} strokeWidth={1.1} />
        )}
      </div>

      {/* Nombre */}
      <div
        className="font-cinzel"
        style={{
          fontSize: "clamp(20px, 2.6vw, 44px)", fontWeight: 700,
          textTransform: "uppercase", letterSpacing: "1px",
          textAlign: "center", lineHeight: 1.1,
          textShadow: "0 3px 22px rgba(0,0,0,0.85), 0 0 2px rgba(233,209,138,0.3)",
          overflowWrap: "anywhere",
        }}
      >
        {team?.name ?? "—"}
      </div>

      {/* Indicador de READY */}
      {preMatch && <ReadyPill readyAt={readyAt} />}
    </div>
  );
}

function ReadyPill({ readyAt }: { readyAt: string | null }) {
  if (readyAt) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "10px 22px", borderRadius: 999,
        border: "1.5px solid rgba(34,197,94,0.55)",
        background: "rgba(34,197,94,0.13)",
        boxShadow: "0 0 26px rgba(34,197,94,0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
        fontSize: "clamp(11px, 1vw, 16px)", fontWeight: 700, letterSpacing: "2.5px",
        textTransform: "uppercase", color: "#4ade80",
        textShadow: "0 1px 8px rgba(0,0,0,0.7)",
      }}>
        <CheckCircle2 style={{ width: "1.15em", height: "1.15em" }} />
        Ready · {fmt.time(readyAt)}
      </div>
    );
  }
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      padding: "10px 22px", borderRadius: 999,
      border: "1.5px dashed rgba(207,200,221,0.28)",
      background: "rgba(10,6,17,0.45)",
      fontSize: "clamp(10px, 0.9vw, 14px)", fontWeight: 600, letterSpacing: "2.5px",
      textTransform: "uppercase", color: "rgba(207,200,221,0.5)",
      textShadow: "0 1px 8px rgba(0,0,0,0.7)",
    }}>
      Esperando confirmación
    </div>
  );
}

function VsMedallion() {
  return (
    <div style={{ position: "relative", flexShrink: 0, width: "clamp(84px, 8vw, 140px)", height: "clamp(84px, 8vw, 140px)" }}>
      {/* Diamante exterior */}
      <div aria-hidden style={{
        position: "absolute", inset: "12%",
        border: "1.5px solid rgba(212,175,55,0.5)",
        transform: "rotate(45deg)", borderRadius: 10,
        background: "rgba(10,6,17,0.6)",
        boxShadow: "0 0 34px rgba(212,175,55,0.22), inset 0 0 22px rgba(212,175,55,0.08)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span
          className="font-cinzel"
          style={{
            fontSize: "clamp(22px, 2.4vw, 40px)", fontWeight: 800,
            color: "#e9d18a", letterSpacing: "2px",
            textShadow: "0 0 18px rgba(212,175,55,0.5), 0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          VS
        </span>
      </div>
    </div>
  );
}

function BottomLabel({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div style={{
      fontSize: "clamp(11px, 1vw, 16px)", fontWeight: 700,
      letterSpacing: "4px", textTransform: "uppercase",
      color: danger ? "var(--vertigo-danger)" : "rgba(207,200,221,0.8)",
      textShadow: "0 2px 10px rgba(0,0,0,0.8)",
      marginBottom: "1vh",
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
        fontSize: "clamp(44px, 5.5vw, 88px)", fontWeight: 700, lineHeight: 1,
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
      fontSize: "clamp(14px, 1.5vw, 24px)", fontWeight: 700,
      letterSpacing: "3px", textTransform: "uppercase",
      color, textShadow: "0 2px 14px rgba(0,0,0,0.85)",
    }}>
      {children}
    </div>
  );
}
