"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, CheckCircle2, Swords } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import LiveDrawRoulette from "@/components/ruleta/live-draw-roulette";
import ComodinEpic from "@/components/comodines/comodin-epic";
import PowerCardStage from "@/components/stream/power-card-stage";
import { useReadyWindow } from "@/components/shared/ready-deadline-timer";
import { deriveTeamPalette } from "@/components/team/team-banner-bg";
import { startDrawFormAction } from "@/server/actions/match-day";
import { fmt } from "@/lib/format";
import { ReadyTeamSide, ReadyTimerBoard, StatusBoard } from "@/components/stream/ready-scene";

export interface StreamTeam {
  id: string;
  name: string;
  emblemUrl: string | null;
  /** Roster (para el board de lineup: quiénes juegan y con qué civ). */
  players: { id: string; name: string; isCaptain: boolean }[];
}

/** Sorteo de la partida activa, ya persistido — lo que el stream MUESTRA
    (chips + lineup), no solo el nombre de la fase. */
export interface StreamActiveDraw {
  gameNumber: number;
  status: string;
  gameMode: string | null;
  playerMode: string | null;
  map: string | null;
  civsA: string[];
  civsB: string[];
  lineupA: string[];
  lineupB: string[];
  civAssignA: Record<string, string>;
  civAssignB: Record<string, string>;
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
  /** Estado del sync con AoE2 Companion de la partida activa (null si no
      hay partida). CORROBORA que la partida exista de verdad: mientras el
      watcher no encuentre la sala por su nombre, "en juego" es solo la
      intención del bracket, no un hecho. */
  activeGameSyncStatus: string | null;
  /** Cuándo arrancó la partida activa (para el mensaje de corroboración). */
  activeGameStartedAt: string | null;
  /** Sorteo persistido de la partida activa (chips + board de lineup). */
  activeDraw: StreamActiveDraw | null;
  readyLineupAAt: string | null;
  readyLineupBAt: string | null;
  comodinWindowExpiresAt: string | null;
  /** Comodines ya ejecutados (el capitán los usa al instante): el overlay
      dispara la CARTA ÉPICA cada vez que esta lista cambia por realtime. */
  executedComodins: {
    id: string;
    comodinType: string;
    teamRegId: string | null;
    targetName: string | null;
    /** ID del jugador objetivo (ANULAR/ELEGIR RIVAL): el board de lineup
        lo cruza con el roster para marcar al afectado mientras re-declara. */
    targetPlayerId: string | null;
  }[];
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
export default function StreamScreen({
  match,
  isAdmin,
  nextDrawGameNumber,
}: {
  match: StreamMatchData;
  /** El viewer tiene sesión de admin: ve el botón INICIAR SORTEO. OBS no. */
  isAdmin: boolean;
  /** Próxima partida a sortear (1 para la P1, 2/3 para el re-sorteo BO3). */
  nextDrawGameNumber: number | null;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);
  /** La ruleta terminó (onDone): se desmonta y no vuelve a salir para ESTA
      sesión de overlay aunque el match siga en "drawing" — el resultado ya
      se vio; si el admin aún no publicó el lineup, el footer lo dice. */
  const [rouletteDone, setRouletteDone] = useState(false);
  /** ¿El sorteo pasó EN VIVO ante esta pantalla? Contexto de montaje:
      snapshot del estado de sorteo con el que esta pantalla se montó por
      primera vez (survive a los router.refresh() — el componente no se
      re-monta, solo re-renderiza con props nuevas).
      - Montó sin sorteo en curso y el Realtime trajo "drawing" → EN VIVO.
      - Montó ya con el sorteo en curso (re-entrada, reload, OBS prendido
        tarde) → el sorteo ya pasó: la ruleta no se re-anima. */
  const drawActiveNow = match.status === "drawing" || !!match.activeGameDrawing;
  const mountedDrawRef = useRef<boolean | null>(null);
  if (mountedDrawRef.current === null) mountedDrawRef.current = drawActiveNow;
  const sawDrawLive = drawActiveNow && !mountedDrawRef.current;
  // Nuevo sorteo (false→true): la partida 2/3 de un BO3 se re-sortea con el
  // overlay ya abierto — la ruleta tiene que volver a salir aunque la P1
  // ya se hubiera visto (rouletteDone true desde el giro anterior).
  const prevDrawActiveRef = useRef(drawActiveNow);
  useEffect(() => {
    if (drawActiveNow && !prevDrawActiveRef.current) setRouletteDone(false);
    prevDrawActiveRef.current = drawActiveNow;
  }, [drawActiveNow]);
  // onDone estable: useReadyWindow tickea cada segundo y re-crea cualquier
  // arrow inline, lo que reseteaba el auto-cierre del panel estático en cada
  // tick (el timeout de 8s nunca disparaba). useCallback lo hace estable.
  const handleRouletteDone = useCallback(() => setRouletteDone(true), []);
  const { phase, msToOpen, msToDeadline } = useReadyWindow(match.scheduledAtStart, match.status);

  // ── CARTA DE PODER EN CURSO: re-declaración de lineup ──
  // Si una carta ejecutada (ANULAR/ELEGIR RIVAL) apunta a un jugador de uno
  // de los equipos y el match volvió a "lineup", el stream muestra el
  // escenario cinematográfico de la carta mientras ese equipo re-declara.
  // Se resuelve por id de jugador (targetPlayerId) contra cada roster.
  // ELEGIR RIVAL es MUTUO: si el equipo contrario también ejecutó su carta,
  // la escena se vuelve duelo (los dos rosters con su víctima marcada).
  const powerCardLive = (() => {
    if (match.status !== "lineup") return null;
    const cards = match.executedComodins.filter(
      (c) =>
        (c.comodinType === "anular" || c.comodinType === "elegir_rival") &&
        c.targetPlayerId != null &&
        (match.teamA?.players.some((p) => p.id === c.targetPlayerId) ||
          match.teamB?.players.some((p) => p.id === c.targetPlayerId))
    );
    const card = cards[0];
    if (!card || card.targetPlayerId == null) return null;
    const targetPlayerId: string = card.targetPlayerId;
    const affected =
      match.teamA?.players.some((p) => p.id === card.targetPlayerId) ? match.teamA : match.teamB;
    if (!affected) return null;
    const usedBy =
      card.teamRegId === match.teamA?.id ? match.teamA :
      card.teamRegId === match.teamB?.id ? match.teamB : null;
    // La otra carta del match (equipo contrario): duelo de cartas mutuas.
    const other = cards.find((c) => c !== card && c.targetPlayerId != null);
    let duel: null | {
      kind: "anular" | "elegir_rival";
      targetPlayerId: string;
      players: StreamTeam["players"];
      teamName: string;
      emblemUrl: string | null;
    } = null;
    if (other?.targetPlayerId != null) {
      const otherAffected =
        match.teamA?.players.some((p) => p.id === other.targetPlayerId) ? match.teamA : match.teamB;
      if (otherAffected && otherAffected.id !== affected.id) {
        duel = {
          kind: other.comodinType as "anular" | "elegir_rival",
          targetPlayerId: other.targetPlayerId,
          players: otherAffected.players,
          teamName: otherAffected.name,
          emblemUrl: otherAffected.emblemUrl,
        };
      }
    }
    return {
      kind: card.comodinType as "anular" | "elegir_rival",
      targetPlayerId,
      affectedTeamName: affected.name,
      affectedEmblemUrl: affected.emblemUrl,
      affectedPlayers: affected.players,
      duel,
    };
  })();

  // ── CARTA ÉPICA de comodín ──
  // El capitán usa el comodín desde /partido y el INSERT llega por realtime
  // (refresh → props nuevas). El comodín NUEVO (id que no estaba en el render
  // anterior) dispara la secuencia épica del tutorial. Snapshot de montaje:
  // si el overlay se abrió DESPUÉS de un comodín (recarga, OBS prendido
  // tarde), ese comodín ya pasó — no se re-anima.
  const [shownComodin, setShownComodin] = useState<{
    id: string;
    comodinType: string;
    team: StreamTeam | null;
    targetName: string | null;
  } | null>(null);
  const seenComodinIdsRef = useRef<Set<string> | null>(null);
  if (seenComodinIdsRef.current === null) {
    seenComodinIdsRef.current = new Set(match.executedComodins.map((c) => c.id));
  }
  // Detección del comodín NUEVO (id no visto): lo muestra. El desmonte a
  // 8.2s vive en OTRO effect (deps: shownComodin) — si viviera acá, el
  // re-render por cualquier otro cambio realtime (status, scores…) recrea
  // executedComodins con nueva referencia de array y el cleanup cancelaría
  // el timeout, dejando la carta clavada para siempre.
  useEffect(() => {
    const seen = seenComodinIdsRef.current!;
    const fresh = match.executedComodins.find((c) => !seen.has(c.id));
    if (!fresh) return;
    seen.add(fresh.id);
    const team =
      fresh.teamRegId === match.teamA?.id ? match.teamA :
      fresh.teamRegId === match.teamB?.id ? match.teamB : null;
    setShownComodin({ id: fresh.id, comodinType: fresh.comodinType, team, targetName: fresh.targetName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.executedComodins]);
  // Desmonte programado: la secencia dura ~8s y cede la escena. Un comodín
  // posterior reemplaza al actual y reinicia el reloj.
  useEffect(() => {
    if (!shownComodin) return;
    const t = setTimeout(() => setShownComodin(null), 8200);
    return () => clearTimeout(t);
  }, [shownComodin]);

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
      // Comodines: el capitán los ejecuta al instante desde /partido — este
      // canal es el que dispara la CARTA ÉPICA en el stream.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comodin_usage", filter: `match_id=eq.${match.id}` },
        scheduleRefresh
      )
      // roulette_draw NO está en la publicación de Realtime de este proyecto:
      // la suscripción es un canal muerto. El draw se refleja en match_game
      // (draw_id/map/civs se escriben juntos) y el fetch del resultado lo
      // hace la propia ruleta (polling de respaldo cada 3s).
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
  // Una vez que el resultado se vio en vivo (rouletteDone), no se re-monta:
  // el sorteo YA PASÓ, el footer muestra el resultado publicado.
  const showRoulette = drawActiveNow && !rouletteDone;
  const rouletteLive = sawDrawLive;

  // Botón INICIAR SORTEO (solo admin): el sorteo arranca desde la propia
  // stream. La P1 exige fecha + READY de ambos; las partidas 2/3 de un BO3
  // 1-1 ya están en curso y no requieren más precondiciones.
  const drawDisabledReason =
    nextDrawGameNumber == null
      ? null
      : nextDrawGameNumber === 1
      ? !match.scheduledAtStart
        ? "La llave no tiene fecha y horario asignados."
        : !match.readyAAt || !match.readyBAt
        ? "Ambos equipos deben confirmar READY primero."
        : null
      : null;
  const canStartDraw = nextDrawGameNumber != null && drawDisabledReason == null;

  const startDraw = async () => {
    if (!canStartDraw || starting) return;
    setStarting(true);
    setDrawError(null);
    try {
      const fd = new FormData();
      fd.set("match_id", match.id);
      fd.set("game_number", String(nextDrawGameNumber));
      await startDrawFormAction(fd);
      // El status pasa a "drawing": el refresh por realtime muestra la ruleta acá mismo.
    } catch (e) {
      setDrawError(
        e instanceof Error ? e.message : "No se pudo iniciar el sorteo."
      );
    } finally {
      setStarting(false);
    }
  };

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
          desde este mismo Browser Source). Al terminar (onDone) se desmonta
          y cede la escena al scoreboard con el resultado en el footer. */}
      {showRoulette && (
        <LiveDrawRoulette matchId={match.id} live={rouletteLive} onDone={handleRouletteDone} />
      )}
      {/* CARTA ÉPICA DE COMODÍN — el capitán la ejecutó al instante: sale
          sola en el stream con la secuencia cinematográfica del tutorial. */}
      {shownComodin && (
        <ComodinEpicStream
          comodinType={shownComodin.comodinType}
          team={shownComodin.team}
          targetName={shownComodin.targetName}
        />
      )}
      {/* ══ FONDO: video de marca + tinte de cada equipo a su lado ══ */}
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
          <ReadyTeamSide
            name={match.teamA?.name ?? "Equipo A"}
            emblemUrl={match.teamA?.emblemUrl ?? null}
            accent={colorA}
            side="A"
            readyAt={preMatch ? match.readyAAt : null}
            showState={preMatch}
          />
          <VsMedallion />
          <ReadyTeamSide
            name={match.teamB?.name ?? "Equipo B"}
            emblemUrl={match.teamB?.emblemUrl ?? null}
            accent={colorB}
            side="B"
            readyAt={preMatch ? match.readyBAt : null}
            showState={preMatch}
          />
        </section>

        {/* INICIAR SORTEO — SOLO visible para el admin (OBS no tiene sesión,
            así que nunca se captura). El sorteo arranca desde la stream. */}
        {isAdmin && !showRoulette && nextDrawGameNumber != null && (
          <div style={{
            position: "fixed", right: "clamp(16px, 2vw, 32px)", bottom: "clamp(16px, 2vh, 28px)",
            zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8,
          }}>
            <button
              type="button"
              onClick={() => void startDraw()}
              disabled={!canStartDraw || starting}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "13px 24px", borderRadius: 999, cursor: canStartDraw && !starting ? "pointer" : "not-allowed",
                border: `1.5px solid ${canStartDraw ? "rgba(212,175,55,0.7)" : "rgba(207,200,221,0.25)"}`,
                background: canStartDraw ? "rgba(20,14,8,0.92)" : "rgba(10,6,17,0.85)",
                boxShadow: canStartDraw ? "0 0 26px rgba(212,175,55,0.25)" : "none",
                fontSize: "clamp(11px, 0.95vw, 15px)", fontWeight: 800, letterSpacing: "2.5px",
                textTransform: "uppercase",
                color: canStartDraw ? "#e9d18a" : "rgba(207,200,221,0.4)",
              }}
            >
              <Dices style={{ width: 16, height: 16 }} />
              {starting ? "Iniciando…" : `Iniciar sorteo · Partida ${nextDrawGameNumber}`}
            </button>
            {drawDisabledReason && (
              <span style={{ fontSize: 11, color: "rgba(207,200,221,0.6)", maxWidth: 320, textAlign: "right", lineHeight: 1.4 }}>
                {drawDisabledReason}
              </span>
            )}
            {drawError && (
              <span style={{ fontSize: 11, color: "#fb7185", maxWidth: 320, textAlign: "right", lineHeight: 1.4 }}>
                {drawError}
              </span>
            )}
          </div>
        )}

        {/* Franja inferior: ventana de READY, estado o marcador */}
        <footer style={{ textAlign: "center", minHeight: "16vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
          {preMatch && match.status === "open" && (
            <StatusBoard
              label="Ventana cerrada"
              title="AMBOS LISTOS"
              success
              note={`Llave habilitada — el admin inicia el sorteo${match.activeDraw?.playerMode ? ` · ${match.activeDraw.playerMode}` : ""}`}
            />
          )}

          {preMatch && match.status === "scheduled" && phase === "early" && (
            <ReadyTimerBoard
              label="El READY se habilita en"
              time={fmtHMS(msToOpen ?? 0)}
              note="Ambos capitanes confirman desde su panel"
            />
          )}

          {preMatch && match.status === "scheduled" && (phase === "open" || phase === "grace") && (
            <ReadyTimerBoard
              label={phase === "grace" ? "Tolerancia — ventana de decisión en" : "Ventana de decisión de W.O. en"}
              time={fmtHMS(msToDeadline ?? 0)}
              danger={phase === "grace"}
              note={phase === "grace" ? "Últimos minutos: luego, el primero en confirmar avanza o decide el admin" : "Sin ambos READY, la llave entra en ventana de decisión"}
            />
          )}

          {preMatch && match.status === "scheduled" && phase === "wo" && (
            <BottomNote color="var(--vertigo-danger)">Ventana de decisión de W.O. — a la espera del admin</BottomNote>
          )}

          {preMatch && match.status === "scheduled" && phase === "no-date" && (
            <BottomNote color="var(--vertigo-muted)">Sin horario asignado</BottomNote>
          )}

          {drawActiveNow && !rouletteDone && <BottomNote color="#fbbf24">◆ Sorteo en curso — el azar decide</BottomNote>}
          {drawActiveNow && rouletteDone && (
            <>
              <BottomNote color="var(--vertigo-success)">✓ Sorteo realizado</BottomNote>
              {/* El resultado en pantalla aunque el admin aún no publicó:
                  nadie tiene que adivinar qué salió. */}
              <DrawChips draw={match.activeDraw} />
            </>
          )}

          {/* LINEUP: el stream muestra QUIÉNES eligen y las civs — el corazón
              de la fase, no solo su nombre. Salvo que una CARTA DE PODER
              obligue a re-declarar: entonces la escena es el escenario
              cinematográfico de la carta (continuación de la carta épica).
              Actualiza solo por Realtime. */}
          {match.status === "lineup" && match.activeDraw && !powerCardLive && (
            <LineupBoard
              draw={match.activeDraw}
              teamA={match.teamA}
              teamB={match.teamB}
              readyLineupAAt={match.readyLineupAAt}
              readyLineupBAt={match.readyLineupBAt}
            />
          )}
          {match.status === "lineup" && powerCardLive && (
            <PowerCardStage
              kind={powerCardLive.kind}
              playerId={powerCardLive.targetPlayerId}
              players={powerCardLive.affectedPlayers}
              teamName={powerCardLive.affectedTeamName}
              emblemUrl={powerCardLive.affectedEmblemUrl}
              duel={powerCardLive.duel}
              takeover
            />
          )}

          {/* COMODINES: countdown vivo del cierre de la ventana. */}
          {match.status === "comodin_window" && (
            <ComodinCountdown expiresAt={match.comodinWindowExpiresAt} />
          )}

          {(inGame || closed) && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "clamp(18px, 2.5vw, 44px)" }}>
                <BigCountdown>{match.scoreA}</BigCountdown>
                <span className="font-cinzel" style={{ fontSize: "clamp(18px, 2vw, 30px)", color: "var(--vertigo-faint)" }}>—</span>
                <BigCountdown>{match.scoreB}</BigCountdown>
              </div>
              {closed ? (
                <BottomNote color="#e9d18a">
                  {winnerName ? `Ganador: ${winnerName}` : "Llave cerrada"}
                </BottomNote>
              ) : (
                <InGameNote syncStatus={match.activeGameSyncStatus} />
              )}
            </>
          )}
        </footer>
      </div>
    </main>
  );
}

/* ── Piezas ─────────────────────────────────────────────── */

// TeamSide/ReadyPill reemplazados por ReadyTeamSide (ready-scene.tsx):
// escudo 3D + placa de nombre de alto fijo + estado reservado — idéntico
// al tour del admin, cero desalineación por largo de nombre.

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

/**
 * "Partida en juego" CORROBORADO: el estado del bracket dice in_progress,
 * pero el hecho real lo confirma el sync que busca la sala por su nombre
 * en AoE2 Companion. Mientras no la encuentre, se dice lo que pasa de
 * verdad ("buscando la sala") — no que la partida existe.
 */
function InGameNote({ syncStatus }: { syncStatus: string | null }) {
  switch (syncStatus) {
    case "live":
      return <BottomNote color="var(--vertigo-success)">◉ En vivo en AoE2</BottomNote>;
    case "synced":
      return <BottomNote color="var(--vertigo-success)">✓ Partida detectada</BottomNote>;
    case "config_mismatch":
    case "no_winner":
      return <BottomNote color="#fbbf24">⚠ Sala encontrada — verificando resultado</BottomNote>;
    // pending o sin partida sorteada todavía: no afirmamos que exista.
    default:
      return <BottomNote color="#fbbf24">Esperando la sala en AoE2…</BottomNote>;
  }
}

/** Chips del sorteo persistido: modo/formato/mapa + civs por equipo. */
function DrawChips({ draw }: { draw: StreamActiveDraw | null }) {
  if (!draw) return null;
  const cells = [
    { label: "MODO", value: draw.gameMode },
    { label: "FORMATO", value: draw.playerMode },
    { label: "MAPA", value: draw.map },
  ].filter((c) => !!c.value);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "clamp(10px, 1.2vw, 22px)", marginTop: "1vh" }}>
      {cells.map((c) => (
        <div key={c.label} style={{
          padding: "0.7vh 1.1vw", borderRadius: 10, textAlign: "center",
          border: "1.5px solid rgba(212,175,55,0.35)", background: "rgba(13,9,19,0.72)",
          minWidth: "clamp(110px, 10vw, 170px)",
        }}>
          <div style={{ fontSize: "clamp(8px, 0.7vw, 10px)", fontWeight: 700, letterSpacing: "2.5px", color: "rgba(207,200,221,0.55)", textTransform: "uppercase", marginBottom: 3 }}>
            {c.label}
          </div>
          <div className="font-cinzel" style={{ fontSize: "clamp(12px, 1.2vw, 19px)", fontWeight: 700, color: "#e9d18a" }}>
            {c.value}
          </div>
        </div>
      ))}
      {(draw.civsA.length > 0 || draw.civsB.length > 0) && (
        <div style={{
          padding: "0.7vh 1.1vw", borderRadius: 10, display: "flex", alignItems: "center", gap: "0.8vw",
          border: "1.5px solid rgba(167,139,250,0.35)", background: "rgba(13,9,19,0.72)",
        }}>
          {(["A", "B"] as const).map((side) => {
            const civs = side === "A" ? draw.civsA : draw.civsB;
            return (
              <div key={side} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {civs.map((civ) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={civ} src={`/civs/${civ}.webp`} alt={civNameEs(civ)} title={civNameEs(civ)} style={{ width: "clamp(26px, 2.2vw, 38px)", height: "clamp(26px, 2.2vw, 38px)", borderRadius: 8, objectFit: "cover", border: side === "A" ? "1.5px solid rgba(167,139,250,0.55)" : "1.5px solid rgba(253,164,175,0.55)" }} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Board de LINEUP para el stream: quiénes juegan y con qué civ, por equipo.
 * El que no declaró todavía muestra sus civs disponibles ("eligiendo…");
 * el que declaró muestra jugador + civ asignada con check de READY #2.
 * El refresh llega por Realtime (match_game → router.refresh()).
 */
function LineupBoard({
  draw,
  teamA,
  teamB,
  readyLineupAAt,
  readyLineupBAt,
}: {
  draw: StreamActiveDraw;
  teamA: StreamTeam | null;
  teamB: StreamTeam | null;
  readyLineupAAt: string | null;
  readyLineupBAt: string | null;
}) {
  return (
    <div className="sc-lineup-card" style={{ width: "min(94vw, 1100px)", margin: "0 auto 1.5vh" }}>
      <div
        className="font-cinzel"
        style={{
          textAlign: "center", marginBottom: "1.8vh",
          fontSize: "clamp(13px, 1.4vw, 21px)", fontWeight: 700,
          letterSpacing: "4px", textTransform: "uppercase", color: "#e9d18a",
          textShadow: "0 2px 14px rgba(0,0,0,0.85)",
        }}
      >
        LINEUP — Partida {draw.gameNumber} · {draw.playerMode ?? ""}
        {draw.map ? ` · ${draw.map}` : ""}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(12px, 2vw, 28px)" }}>
        <LineupSide
          teamName={teamA?.name ?? "Equipo A"}
          lineup={draw.lineupA}
          civAssign={draw.civAssignA}
          civsPool={draw.civsA}
          players={teamA?.players ?? []}
          ready={!!readyLineupAAt}
          accent="rgba(167,139,250,0.55)"
        />
        <LineupSide
          teamName={teamB?.name ?? "Equipo B"}
          lineup={draw.lineupB}
          civAssign={draw.civAssignB}
          civsPool={draw.civsB}
          players={teamB?.players ?? []}
          ready={!!readyLineupBAt}
          accent="rgba(253,164,175,0.55)"
        />
      </div>
    </div>
  );
}

function LineupSide({
  teamName,
  lineup,
  civAssign,
  civsPool,
  players,
  ready,
  accent,
}: {
  teamName: string;
  lineup: string[];
  civAssign: Record<string, string>;
  civsPool: string[];
  players: { id: string; name: string; isCaptain: boolean }[];
  ready: boolean;
  accent: string;
}) {
  const declared = lineup.length > 0;
  return (
    <div style={{
      textAlign: "center", minWidth: 0,
    }}>
      {/* Nombre con alto FIJO de 2 líneas: las filas de civs arrancan a la
          misma altura en ambas columnas, sin importar el largo del nombre. */}
      <div className="font-cinzel" style={{
        fontSize: "clamp(12px, 1.2vw, 19px)", fontWeight: 700,
        letterSpacing: "1.5px", textTransform: "uppercase",
        color: "var(--vertigo-text, #efeaf7)", overflowWrap: "anywhere",
        height: "2.6em", lineHeight: 1.3, marginBottom: "1.2vh",
      }}>
        {teamName}
      </div>
      {ready ? (
        // Declarado y confirmado: jugador + civ, listo para jugar.
        // 3v3/FUSIÓN no declara lineup (juegan todos): se listan los players
        // y las civs se reparten por índice del pool.
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh", alignItems: "center" }}>
          {(lineup.length > 0
            ? lineup.map((pid) => ({ pid, civ: civAssign[pid] }))
            : players.map((p, i) => ({ pid: p.id, civ: civAssign[p.id] ?? civsPool[i] }))
          ).map(({ pid, civ }, i) => {
            const p = players.find((x) => x.id === pid);
            const pName = p?.name ?? "Jugador";
            return (
              <div key={pid} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {civ && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/civs/${civ}.webp`} alt="" style={{ width: "clamp(26px, 2.4vw, 40px)", height: "clamp(26px, 2.4vw, 40px)", borderRadius: 8, objectFit: "cover", border: `1.5px solid ${accent}` }} />
                )}
                <span style={{ fontSize: "clamp(12px, 1.2vw, 18px)", fontWeight: 700, color: "#4ade80" }}>
                  {(p?.isCaptain ? "★ " : "") + pName}
                </span>
                {civ && <span key={i} style={{ fontSize: "clamp(10px, 0.95vw, 14px)", color: "rgba(207,200,221,0.8)" }}>{civNameEs(civ)}</span>}
              </div>
            );
          })}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "0.6vh 1.2vw", borderRadius: 999, marginTop: "0.6vh",
            border: "1.5px solid rgba(74,222,128,0.5)", background: "rgba(34,197,94,0.12)",
            fontSize: "clamp(10px, 0.95vw, 14px)", fontWeight: 700, letterSpacing: "2px",
            textTransform: "uppercase", color: "#4ade80",
          }}>
            <CheckCircle2 style={{ width: "1em", height: "1em" }} /> Ready
          </div>
        </div>
      ) : declared ? (
        // Declaró pero no confirmó: ya se ve quién juega y la asignación.
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8vh", alignItems: "center" }}>
          {lineup.map((pid) => {
            const p = players.find((x) => x.id === pid);
            const civ = civAssign[pid];
            const pName = p?.name ?? "Jugador";
            return (
              <div key={pid} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {civ && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/civs/${civ}.webp`} alt="" style={{ width: "clamp(26px, 2.4vw, 40px)", height: "clamp(26px, 2.4vw, 40px)", borderRadius: 8, objectFit: "cover", border: `1.5px solid ${accent}` }} />
                )}
                <span style={{ fontSize: "clamp(12px, 1.2vw, 18px)", fontWeight: 600, color: "var(--vertigo-text, #efeaf7)" }}>
                  {(p?.isCaptain ? "★ " : "") + pName}
                </span>
                {civ && <span style={{ fontSize: "clamp(10px, 0.95vw, 14px)", color: "rgba(207,200,221,0.8)" }}>{civNameEs(civ)}</span>}
              </div>
            );
          })}
          <div style={{ fontSize: "clamp(10px, 0.9vw, 13px)", letterSpacing: "2px", textTransform: "uppercase", color: "rgba(207,200,221,0.6)", marginTop: "0.5vh" }}>
            Confirmando…
          </div>
        </div>
      ) : (
        // Sin declarar: qué está en juego (civs sorteadas) mientras elige.
        <div style={{ display: "flex", flexDirection: "column", gap: "1vh", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {civsPool.length > 0 ? civsPool.map((civ) => (
              <div key={civ} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/civs/${civ}.webp`} alt="" style={{ width: "clamp(30px, 2.8vw, 46px)", height: "clamp(30px, 2.8vw, 46px)", borderRadius: 9, objectFit: "cover", border: `1.5px solid ${accent}`, opacity: 0.9 }} />
                <span style={{ fontSize: "clamp(9px, 0.8vw, 12px)", color: "rgba(207,200,221,0.75)" }}>{civNameEs(civ)}</span>
              </div>
            )) : (
              <span style={{ fontSize: "clamp(11px, 1vw, 15px)", color: "rgba(207,200,221,0.6)", fontStyle: "italic" }}>
                Sin civs sorteadas
              </span>
            )}
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "0.6vh 1.2vw", borderRadius: 999,
            border: `1.5px dashed ${accent}`, background: "rgba(10,6,17,0.45)",
            fontSize: "clamp(10px, 0.95vw, 14px)", fontWeight: 600, letterSpacing: "2px",
            textTransform: "uppercase", color: "rgba(207,200,221,0.7)",
          }}>
            <Swords style={{ width: "1em", height: "1em" }} /> Eligiendo lineup…
          </div>
        </div>
      )}
    </div>
  );
}

/** CARTA ÉPICA de comodín — extraída a src/components/comodines/comodin-epic.tsx
 *  (se reutiliza en el Stream View del admin). Alias local para no tocar los usos. */
const ComodinEpicStream = ComodinEpic;

/** Countdown vivo de la ventana de comodines (5 min desde la publicación). */
function ComodinCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  if (!expiresAt) {
    return <BottomNote color="#fbbf24">Ventana de comodines abierta</BottomNote>;
  }
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const done = left <= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8vh" }}>
      <BottomLabel>Ventana de comodines</BottomLabel>
      <BigCountdown danger={done || left < 60000}>
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </BigCountdown>
      {done && <BottomNote color="var(--vertigo-muted)">Cerrando — el admin arranca la partida</BottomNote>}
    </div>
  );
}

/** Nombre legible de civ para el stream (id del pool → español). */
function civNameEs(id: string): string {
  const map: Record<string, string> = {
    britons: "Britanos", franks: "Francos", goths: "Godos", teutons: "Teutones",
    japanese: "Japoneses", chinese: "Chinos", byzantines: "Bizantinos", persians: "Persas",
    saracens: "Sarracenos", mongols: "Mongoles", koreans: "Coreanos", hindustanis: "Hindúes",
    ethiopians: "Etíopes", khmer: "Jémer", magyars: "Magiares", wei: "Wei",
    incas: "Incas", mayans: "Mayas", jurchens: "Yurchen", turks: "Turcos", vikings: "Vikingos",
    aztecs: "Aztecas", huns: "Hunos", spanish: "Españoles", malians: "Malíes",
    berbers: "Bereberes", bulgarians: "Búlgaros", cumans: "Cumanos", lithuanians: "Lituanos",
    poles: "Polacos", burgundians: "Borgoñones", sicilians: "Sicilianos", tatars: "Tártaros",
    slavs: "Eslavos", vietnamese: "Vietnamitas", burmese: "Birmanos", malay: "Malayos",
    italians: "Italianos", indians: "Indios", portuguese: "Portugueses", dravidians: "Drávidas",
    bengalis: "Bengalíes", gurjaras: "Gurjaras", avars: "Ávaros", romans: "Romanos",
    shu: "Shu", wu: "Wu",
  };
  return map[id] ?? id;
}
