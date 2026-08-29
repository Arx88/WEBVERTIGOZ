"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Calendar,
  Trophy,
  Gamepad2,
  Sparkles,
  Youtube,
  Twitch,
  ChevronDown,
  ArrowLeft,
  Crown,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { civName } from "@/lib/constants/civs";
import MatchHero from "@/components/shared/match-hero";
import { artForMode, artForMap, ART_FALLBACK } from "@/lib/art";
import { CaptainMatchPanel, type CaptainPanelContext } from "@/components/captain/captain-match-panel";
import BetPanel, { type BetPanelContext } from "@/components/apuestas/bet-panel";
import ReadyDeadlineTimer from "@/components/shared/ready-deadline-timer";
import { loadMatch, type GameView, type MatchData } from "./match-data";
import LocalTime from "@/components/shared/local-time";
import { lobbyNameForGame } from "@/lib/aoe2/lobby-name";
import GameAnalysisCard from "./game-analysis-card";

export { loadMatch };
export type { GameView, MatchData };

interface Props {
  matchId: string;
  initialMatch: MatchData | null;
  /** Contexto del capitán si el viewer es capitán de un equipo de este match */
  captainContext?: CaptainPanelContext | null;
  /** Contexto del espectador para el panel de apuestas (null si no se resolvió) */
  spectatorContext?: BetPanelContext | null;
}

const MATCH_STATUS_META: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Programado", cls: "vertigo-badge-purple" },
  open: { label: "Abierto", cls: "vertigo-badge-success" },
  drawing: { label: "Sorteando", cls: "vertigo-badge-warning" },
  lineup: { label: "Lineup", cls: "vertigo-badge-warning" },
  comodin_window: { label: "Comodines", cls: "vertigo-badge-warning" },
  in_progress: { label: "En juego", cls: "vertigo-badge-success" },
  finished: { label: "Finalizado", cls: "vertigo-badge-purple" },
  disputed: { label: "Disputa", cls: "vertigo-badge-danger" },
  forfeit: { label: "W.O.", cls: "vertigo-badge-danger" },
  cancelled: { label: "Cancelado", cls: "vertigo-badge-danger" },
};

const COMODIN_LABELS: Record<string, string> = {
  reroll: "Reroll",
  anular: "Anular",
  elegir_rival: "Elegir rival",
  invocar_pro: "Invocar PRO",
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Countdown + tolerancia W.O. de una llave programada, aislados en un
 * componente hoja: es el ÚNICO que se re-renderiza cada segundo. Antes el
 * tick de 1s vivía en el wrapper raíz y re-pintaba la página entera
 * (hero, apuestas, panel del capitán, todas las partidas) 60 veces por minuto.
 */
function ScheduledTimers({ scheduledAtStart, status }: { scheduledAtStart: string | null; status: string }) {
  const now = useNow(1000);
  const start = scheduledAtStart ? new Date(scheduledAtStart).getTime() : null;
  if (status !== "scheduled" || start === null) return null;
  const countdown = start - now;
  return (
    <>
      {countdown > 0 && (
        <div className="vertigo-stat" style={{ textAlign: "center", margin: "20px 28px 4px" }}>
          <div className="vertigo-stat-label">Comienza en</div>
          <div className="vertigo-stat-value">
            <Clock
              style={{ width: 22, height: 22, display: "inline", marginRight: 10, verticalAlign: "middle" }}
              strokeWidth={1.25}
            />
            {formatCountdown(countdown)}
          </div>
        </div>
      )}
      {now >= start && (
        <div style={{ margin: "16px 28px 4px" }}>
          <ReadyDeadlineTimer scheduledAtStart={scheduledAtStart} status={status} variant="block" />
        </div>
      )}
    </>
  );
}

export default function MatchRealtimeWrapper({ matchId, initialMatch, captainContext, spectatorContext }: Props) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchData | null>(initialMatch);

  // Sincronizar cuando el server re-renderiza con datos frescos (p.ej. tras un
  // form action con revalidatePath): useState ignora el nuevo prop por sí solo,
  // así que sin esto el capitán que confirma READY no vería su banner hasta
  // recargar a mano.
  useEffect(() => {
    setMatch(initialMatch);
  }, [initialMatch]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match", filter: `id=eq.${matchId}` },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_game", filter: `match_id=eq.${matchId}` },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "roulette_draw" },
        () => void refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comodin_usage", filter: `match_id=eq.${matchId}` },
        () => void refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function refresh() {
    try {
      const supabase = getSupabaseBrowser();
      const data = await loadMatch(supabase, matchId);
      setMatch(data);
    } catch {
      // ignore
    }
  }

  if (!match) {
    return (
      <div className="vertigo-card">
        <div className="vertigo-empty">
          <div className="vertigo-empty-title">Partido no encontrado</div>
          <p className="vertigo-empty-desc">
            El partido puede haber sido cancelado o aún no se generó.
          </p>
        </div>
      </div>
    );
  }

  const statusMeta = MATCH_STATUS_META[match.status] ?? MATCH_STATUS_META.scheduled;
  const isFinished = match.status === "finished";
  const winnerSide =
    match.winnerTeamId && match.teamA && match.winnerTeamId === match.teamA.id
      ? "A"
      : match.winnerTeamId && match.teamB && match.winnerTeamId === match.teamB.id
      ? "B"
      : null;

  // Antes de que caiga el primer juego no hay score real: los 0 son un placeholder
  // feo, así que se muestra el sello VS hasta que exista número o resultado.
  const showScores =
    match.scoreA > 0 || match.scoreB > 0 || isFinished || match.status === "disputed" || match.status === "forfeit";

  // Juego para el HERO: la partida con sorteo más reciente (con mapa),
  // para que un BO3 en 1-1 muestre la partida decisiva y no la 1.
  const heroGame =
    [...match.games].sort((a, b) => b.gameNumber - a.gameNumber).find((g) => g.map) ??
    match.games[match.games.length - 1] ??
    match.games[0] ??
    null;

  // Partida "destacada" que abre desplegada por defecto: la que está en juego;
  // si ninguna, la última con informe archivado (la más fresca). Las partidas
  // SIN análisis se dejan abiertas (su cuerpo es solo civs, liviano). El resto
  // se pliega: cada informe es pesado y un BO3 completo necesita aire.
  const featuredGameIdx = (() => {
    const liveIdx = match.games.findIndex((g) => g.status === "in_progress" || g.status === "drawing");
    if (liveIdx >= 0) return liveIdx;
    for (let i = match.games.length - 1; i >= 0; i--) {
      if (match.games[i].status === "finished" && match.games[i].aoe2?.hasAnalysis) return i;
    }
    return -1;
  })();

  // Antes del primer sorteo la partida existe pero no tiene mapa/modo: el hero
  // solo diría "Modo por sortear" y no aporta nada. En ese caso manda al VERSUS
  // (ronda, escudos, horario) arriba vía `order` y el hero no se renderiza.
  const hasDrawnGame = !!(heroGame && (heroGame.map || heroGame.gameMode));

  // Nombre de la sala AoE2 de la partida activa (derivado, no se guarda):
  // el capitán crea la sala con este nombre exacto y el resultado se detecta solo.
  const lobbyName =
    match.activeGame && match.activeGame.map && !isFinished
      ? lobbyNameForGame({
          jornadaLabel: match.jornadaLabel,
          slotIndex: match.slotIndex,
          gameNumber: match.activeGame.gameNumber,
          matchId,
        })
      : null;

  return (
    <div className="flex flex-col gap-6">
      {/* La ruleta EN VIVO no vive en la página pública: es un visual de la
          stream (/overlay/[match_id]). Acá el espectador ve ya el resultado
          sorteado (mapa, modo, civs, sala) en las secciones de abajo. */}

      {/* VOLVER ATRÁS — flecha de historial del navegador, arriba del hero */}
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="Volver atrás"
        className="self-start inline-flex items-center gap-2 rounded-full transition-all hover:-translate-x-0.5"
        style={{
          padding: "7px 14px 7px 11px",
          fontSize: "11px",
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          fontWeight: 600,
          color: "var(--vertigo-muted)",
          background: "rgba(19,15,27,0.6)",
          border: "1px solid var(--vertigo-line)",
          cursor: "pointer",
          // Sin sorteo el VERSUS sube al tope (order -1); Volver queda arriba suyo
          ...(!hasDrawnGame ? { order: -2 } : {}),
        }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} />
        Volver
      </button>

      {/* HERO cinematográfico del partido (modo + mapa, fondo con arte del sorteo).
          Muestra la partida ACTIVA: en BO3 1-1 es la partida 2/3, no la 1.
          Antes del primer sorteo no se renderiza (solo diría "Modo por sortear").
          Cuando el partido TERMINÓ se oculta: repetiría lo que ya cuentan
          las cards por partida, y el protagonismo pasa al resultado. */}
      {hasDrawnGame && !isFinished && (
        <MatchHero
          mapName={heroGame?.map ?? null}
          gameModeName={heroGame?.gameMode ?? null}
          antimetaName={heroGame?.antimetaMode ?? null}
          playerModeName={heroGame?.playerMode ?? null}
          llaveName={match.format ?? null}
          status={match.status}
          civsA={heroGame?.civsA ?? []}
          civsB={heroGame?.civsB ?? []}
          live={match.status === "in_progress" || match.status === "drawing"}
        />
      )}

      {/* PANEL DEL CAPITÁN — solo si el viewer es capitán de un equipo de esta llave.
          Le da lineup, READY #2 y comodines en contexto del partido. */}
      {captainContext && match.teamA && match.teamB && (
        <CaptainMatchPanel
          matchId={matchId}
          status={match.status}
          scheduledAtStart={match.scheduledAtStart}
          myTeamRegId={captainContext.myTeamRegId}
          teamA={{ id: match.teamA.id, name: match.teamA.name, seed: match.teamA.seed }}
          teamB={{ id: match.teamB.id, name: match.teamB.name, seed: match.teamB.seed }}
          myPlayers={captainContext.myPlayers}
          rivalPlayers={captainContext.rivalPlayers}
          annulledPlayerIds={captainContext.annulledPlayerIds}
          rivalAnnulledPlayerIds={captainContext.rivalAnnulledPlayerIds}
          readyA={!!match.readyA}
          readyB={!!match.readyB}
          readyLineupA={!!match.readyLineupA}
          readyLineupB={!!match.readyLineupB}
          playerMode={match.activeGame?.playerMode ?? null}
          myCivs={captainContext.myTeamRegId === match.teamA.id ? (match.activeGame?.civsA ?? []) : (match.activeGame?.civsB ?? [])}
          comodinExpiresAt={match.comodinWindowExpiresAt}
          lobbyName={lobbyName}
        />
      )}

      {/* BOLETA DE APUESTAS — para el espectador es lo principal de la página:
          va antes del scoreboard. Anónimos ven un CTA de registro discreto y
          los participantes (capitán/admin/caster) no ven nada de apuestas.
          Se cierra sola cuando la llave abre (status llega por realtime). */}
      {spectatorContext && (
        <BetPanel
          context={spectatorContext}
          matchId={matchId}
          status={match.status}
          teamA={match.teamA ? { id: match.teamA.id, name: match.teamA.name, seed: match.teamA.seed } : null}
          teamB={match.teamB ? { id: match.teamB.id, name: match.teamB.name, seed: match.teamB.seed } : null}
        />
      )}

      {/* ENFRENTAMIENTO — bloque VERSUS, pieza central del partido.
          Antes del primer sorteo sube al tope de la página (order -1):
          es lo útil (ronda, escudos, horario); el hero no se renderiza. */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 18,
          border: "1px solid var(--vertigo-line)",
          background: "#0d0913",
          boxShadow: "var(--shadow-lg)",
          ...(!hasDrawnGame ? { order: -1 } : {}),
        }}
      >
        {/* Fondo de video + velo oscuro para legibilidad */}
        <video
          autoPlay
          muted
          loop
          playsInline
          src="/landing/proxima-partida-bg.mp4"
          aria-hidden="true"
          tabIndex={-1}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(7,3,16,0.66) 0%, rgba(7,3,16,0.78) 55%, rgba(7,3,16,0.90) 100%)",
            pointerEvents: "none",
          }}
        />
        {/* Línea dorada superior — espejo del hero */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 2 }}>
          {/* Ronda al centro, flanqueada por hairlines doradas */}
          <div className="flex items-center justify-center gap-3 flex-wrap" style={{ padding: "26px 28px 0" }}>
            <span style={{ width: 30, height: 1, background: "rgba(212,175,55,0.5)" }} />
            <span
              className="font-cinzel font-bold"
              style={{
                fontSize: 13,
                letterSpacing: 3.5,
                textTransform: "uppercase",
                color: "var(--vertigo-text)",
                textShadow: "0 2px 14px rgba(0,0,0,0.6)",
              }}
            >
              {match.roundName ?? "Partido"}
            </span>
            <span style={{ width: 30, height: 1, background: "rgba(212,175,55,0.5)" }} />
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 12, padding: "0 28px" }}>
            <span className={`vertigo-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
            {match.format && <span className="vertigo-badge vertigo-badge-purple">{match.format}</span>}
            {match.jornadaLabel && <span className="vertigo-badge vertigo-badge-purple">{match.jornadaLabel}</span>}
          </div>

        {/* VERSUS: escudos cara a cara, cada equipo centrado en su mitad */}
        <div
          className="relative grid items-center"
          style={{ gridTemplateColumns: "1fr auto 1fr", justifyItems: "center", padding: "34px 20px 30px", columnGap: 12 }}
        >
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 65%)",
            }}
          />
          <TeamBlock
            name={match.teamA?.name ?? "Por definir"}
            seed={match.teamA?.seed ?? null}
            emblemUrl={match.teamA?.emblemUrl ?? null}
            isWinner={winnerSide === "A"}
            teamId={match.teamA?.id}
          />

          <div className="relative flex flex-col items-center justify-center text-center" style={{ minWidth: 90 }}>
            {showScores ? (
              <>
                <div className="text-[9px] tracking-[3px] uppercase text-[var(--vertigo-faint)] mb-2">Score</div>
                <div
                  className="font-cinzel font-bold leading-none text-[var(--vertigo-purple-pale)]"
                  style={{
                    fontSize: "clamp(36px, 5vw, 48px)",
                    fontVariantNumeric: "tabular-nums",
                    textShadow: "0 0 26px rgba(124,58,237,0.35)",
                  }}
                >
                  {match.scoreA}
                  <span style={{ color: "rgba(212,175,55,0.8)", margin: "0 10px", fontSize: "0.72em", verticalAlign: "0.06em" }}>:</span>
                  {match.scoreB}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center" style={{ minHeight: 64 }}>
                <span
                  className="font-cinzel font-bold text-[17px] tracking-[1px] flex items-center justify-center rounded-full"
                  style={{
                    width: 58,
                    height: 58,
                    color: "var(--vertigo-gold)",
                    background: "#0b0713",
                    border: "1px solid rgba(212,175,55,0.5)",
                    boxShadow: "0 0 0 6px rgba(10,6,17,0.9), 0 0 26px rgba(212,175,55,0.18)",
                  }}
                >
                  VS
                </span>
              </div>
            )}
            {isFinished && winnerSide && (
              <div className="mt-3">
                <span className="vertigo-badge vertigo-badge-success">
                  <Trophy style={{ width: 11, height: 11 }} />
                  {winnerSide === "A" ? match.teamA?.name : match.teamB?.name}
                </span>
              </div>
            )}
          </div>

          <TeamBlock
            name={match.teamB?.name ?? "Por definir"}
            seed={match.teamB?.seed ?? null}
            emblemUrl={match.teamB?.emblemUrl ?? null}
            isWinner={winnerSide === "B"}
            teamId={match.teamB?.id}
          />
        </div>

        {/* Meta en una línea bajo hairline — banda inferior sobre el video */}
        <div
          className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap"
          style={{ padding: "16px 28px", borderTop: "1px solid var(--vertigo-line-soft)", background: "rgba(7,3,16,0.35)" }}
        >
          {match.scheduledAtStart && (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--vertigo-muted)" }}>
              <Calendar style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
              <LocalTime value={match.scheduledAtStart} variant="dayMonTime" />
            </span>
          )}
          {!match.scheduledAtStart && match.status === "scheduled" && (
            <span
              className="vertigo-badge vertigo-badge-warning"
              style={{ fontSize: 10, padding: "5px 12px" }}
              title="La organización todavía no confirmó el horario de esta llave"
            >
              <Calendar style={{ width: 11, height: 11 }} />
              FECHA A CONFIRMAR
            </span>
          )}
          {/* Stream y caster: datos operativos de la transmisión */}
          {match.streamCaster && (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--vertigo-muted)" }}>
              <Youtube style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
              <span className="truncate max-w-[180px]">{match.streamCaster.displayName}</span>
            </span>
          )}
        </div>

        {/* Countdown + tolerancia W.O. (timer aislado: solo él se re-renderiza cada segundo) */}
        <ScheduledTimers scheduledAtStart={match.scheduledAtStart} status={match.status} />

        {/* Stream link */}
        {match.streamEmbedEnabled && match.streamCaster && (
          <div
            className="vertigo-action-bar"
            style={{
              margin: "16px 28px 24px",
              paddingTop: 16,
              borderTop: "1px solid var(--vertigo-line-soft)",
              justifyContent: "center",
            }}
          >
            {match.streamCaster.twitchChannel && (
              <a
                href={`https://twitch.tv/${match.streamCaster.twitchChannel}`}
                target="_blank"
                rel="noopener noreferrer"
                className="vertigo-btn vertigo-btn-primary"
              >
                <Twitch style={{ width: 14, height: 14 }} />
                Ver en Twitch
              </a>
            )}
            {match.streamCaster.youtubeChannel && (
              <a
                href={`https://youtube.com/@${match.streamCaster.youtubeChannel}`}
                target="_blank"
                rel="noopener noreferrer"
                className="vertigo-btn vertigo-btn-ghost"
              >
                <Youtube style={{ width: 14, height: 14 }} />
                Ver en YouTube
              </a>
            )}
          </div>
        )}
        </div>
      </div>

      {/* GAMES BO3 — plegados por defecto para espectadores: son specs del sorteo,
          relevantes sobre todo para capitanes. El panel de apuestas queda protagonista. */}
      {match.games.length > 0 && (
        <details className="apu-fold" open={!!captainContext || match.games.length <= 1 || isFinished}>
          <summary>
            <Gamepad2 style={{ width: 13, height: 13, color: "var(--vertigo-purple-soft)", flexShrink: 0 }} />
            Partidas del sorteo ({match.games.length})
            {!captainContext && (
              <span
                className="font-normal normal-case"
                style={{ fontSize: 11, letterSpacing: "0.5px", color: "var(--vertigo-faint)" }}
              >
                · {isFinished ? "resultado y análisis por partida" : "detalles técnicos del sorteo"}
              </span>
            )}
            <ChevronDown className="apu-chev" style={{ width: 14, height: 14 }} />
          </summary>
          <div className="apu-fold-body">
            <div className="flex flex-col gap-4">
              {match.games.map((g, i) => (
                <GameCard key={g.id} game={g} teamAName={match.teamA?.name ?? "A"} teamBName={match.teamB?.name ?? "B"} teamAId={match.teamA?.id} teamBId={match.teamB?.id} teamAEmblem={match.teamA?.emblemUrl ?? null} teamBEmblem={match.teamB?.emblemUrl ?? null} defaultOpen={i === featuredGameIdx || !(g.status === "finished" && g.aoe2?.hasAnalysis)} />
              ))}
            </div>
          </div>
        </details>
      )}

      {/* COMODINES USADOS */}
      {match.comodinUsages.length > 0 && (
        <>
          <div className="vertigo-subtitle">
            <Sparkles style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
            Comodines usados
          </div>
          <div className="vertigo-card">
            <div className="flex flex-col gap-3">
              {match.comodinUsages.map((c) => {
                const statusCls =
                  c.status === "executed"
                    ? "vertigo-badge-success"
                    : c.status === "cancelled" || c.status === "revoked"
                    ? "vertigo-badge-danger"
                    : "vertigo-badge-warning";
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--vertigo-line-soft)] last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="vertigo-badge vertigo-badge-purple flex-none">
                        {COMODIN_LABELS[c.comodinType] ?? c.comodinType}
                      </span>
                      <span className="text-[13px] text-[var(--vertigo-text)] truncate">
                        {c.teamName ?? "Equipo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                      {c.notes && (
                        <span className="text-[11px] text-[var(--vertigo-faint)] truncate max-w-[200px]">
                          {c.notes}
                        </span>
                      )}
                      <span className={`vertigo-badge ${statusCls}`}>{c.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* VOLVER */}
      <div className="vertigo-action-bar" style={{ justifyContent: "center", marginTop: 4 }}>
        {spectatorContext?.kind === "spectator" && (
          <Link href="/apuestas" className="vertigo-btn vertigo-btn-primary">
            ← Mis apuestas
          </Link>
        )}
        <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost">
          ← Ver resultados
        </Link>
      </div>
    </div>
  );
}

function TeamBlock({
  name,
  seed,
  emblemUrl,
  isWinner,
  teamId,
}: {
  name: string;
  seed: number | null;
  emblemUrl: string | null;
  isWinner: boolean;
  teamId?: string;
}) {
  const inner = (
    <>
      {/* Escudo con doble aro: dorado si ganó, violeta si no */}
      <div
        className="relative flex items-center justify-center flex-none rounded-full overflow-hidden"
        style={{
          width: "clamp(78px, 18vw, 108px)",
          height: "clamp(78px, 18vw, 108px)",
          border: isWinner ? "2px solid rgba(212,175,55,0.75)" : "2px solid rgba(124,58,237,0.5)",
          background: "var(--vertigo-input-bg, #0e0a14)",
          boxShadow: isWinner
            ? "0 0 0 5px rgba(212,175,55,0.12), 0 0 34px rgba(212,175,55,0.30)"
            : "0 0 0 5px rgba(124,58,237,0.08), 0 0 26px rgba(124,58,237,0.18)",
        }}
      >
        {emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emblemUrl} alt={`${name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Trophy style={{ width: 36, height: 36, color: "var(--vertigo-purple-soft)" }} strokeWidth={1.1} />
        )}
      </div>
      {seed != null && (
        <div
          className="text-[9px] font-bold uppercase"
          style={{ letterSpacing: 2, color: "var(--vertigo-faint)", marginTop: 12 }}
        >
          Seed #{seed}
        </div>
      )}
      <div
        className={`font-cinzel font-bold ${isWinner ? "text-[var(--vertigo-gold)]" : "text-[var(--vertigo-text)]"}`}
        style={{
          fontSize: "clamp(16px, 2vw, 22px)",
          lineHeight: 1.15,
          marginTop: seed != null ? 6 : 12,
          maxWidth: 230,
          overflowWrap: "break-word",
          textShadow: "0 2px 18px rgba(0,0,0,0.5)",
        }}
      >
        {name}
      </div>
    </>
  );

  if (teamId) {
    return (
      <Link
        href={`/equipos/${teamId}`}
        className="flex flex-col items-center text-center min-w-0"
        style={{ textDecoration: "none" }}
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex flex-col items-center text-center min-w-0">{inner}</div>;
}

/** Numeración romana para el título de cada partida (BO1..BO7). */
const GAME_ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

/** Fila de civs por equipo: escudos grandes con nombre, oro si ganó. */
function CivRow({
  name,
  civs,
  winner,
  showWinner,
  color,
}: {
  name: string;
  civs: string[];
  winner: boolean;
  showWinner: boolean;
  color: string;
}) {
  const gold = showWinner && winner;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <span className="flex-none" style={{ width: 8, height: 8, transform: "rotate(45deg)", background: gold ? "#D4AF37" : color }} />
        <span
          className="text-[10px] font-bold uppercase truncate"
          style={{ letterSpacing: "1.8px", color: gold ? "#D4AF37" : "var(--vertigo-muted)" }}
        >
          {name}
        </span>
        {gold && <Crown style={{ width: 11, height: 11, color: "#D4AF37", flexShrink: 0 }} />}
      </div>
      <div className="flex flex-wrap gap-2.5">
        {civs.length === 0 ? (
          <span className="text-[12px] text-[var(--vertigo-faint)]">Sin sortear</span>
        ) : (
          civs.map((c) => (
            <div key={c} className="flex flex-col items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/civs/${c}.webp`}
                alt={civName(c)}
                title={civName(c)}
                loading="lazy"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  objectFit: "cover",
                  border: gold ? "1.5px solid rgba(212,175,55,0.55)" : "1.5px solid var(--vertigo-line)",
                  boxShadow: gold ? "0 0 14px rgba(212,175,55,0.18)" : "none",
                }}
              />
              <span className="text-[9px] text-[var(--vertigo-faint)]">{civName(c)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GameCard({
  game,
  teamAName,
  teamBName,
  teamAId,
  teamBId,
  teamAEmblem,
  teamBEmblem,
  defaultOpen = false,
}: {
  game: GameView;
  teamAName: string;
  teamBName: string;
  teamAId?: string;
  teamBId?: string;
  /** Escudos de equipo para el informe post-partida. */
  teamAEmblem?: string | null;
  teamBEmblem?: string | null;
  /** Cada partida se puede plegar: abre por defecto sólo la destacada. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const statusMeta = MATCH_STATUS_META[game.status] ?? MATCH_STATUS_META.scheduled;
  const isAWinner = !!(game.winnerTeamId && teamAId && game.winnerTeamId === teamAId);
  const isBWinner = !!(game.winnerTeamId && teamBId && game.winnerTeamId === teamBId);
  const winnerName = isAWinner ? teamAName : isBWinner ? teamBName : null;
  const isLive = game.status === "in_progress";

  const draw = game.drawResult;
  const gameMode = draw?.gameMode ?? game.gameMode;
  const antimetaMode = draw?.antimetaMode ?? game.antimetaMode;
  const playerMode = draw?.playerMode ?? game.playerMode;
  const map = draw?.map ?? game.map;
  const civsA = draw?.civsA ?? game.civsA ?? [];
  const civsB = draw?.civsB ?? game.civsB ?? [];

  // Fondo: arte del MAPA sorteado (protagonista visual); fallback modo/vortex.
  const bgArt = artForMap(map) ?? artForMode(gameMode) ?? ART_FALLBACK;

  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--vertigo-line-soft)", background: "#0b0713" }}>
      {/* ═══ BANDA: sólo el título vive sobre el arte del mapa ═══ */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", inset: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgArt}
            alt=""
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%", opacity: 0.45 }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, rgba(10,7,17,0.92) 0%, rgba(10,7,17,0.55) 55%, rgba(10,7,17,0.35) 100%), linear-gradient(0deg, rgba(10,7,17,0.95) 0%, rgba(10,7,17,0.25) 100%)",
            }}
          />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.45), transparent)" }} />
        </div>

        <div
          onClick={() => setOpen((o) => !o)}
          style={{ position: "relative", zIndex: 2, padding: "16px 24px 14px", cursor: "pointer" }}
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div
                className="text-[9.5px] font-bold uppercase text-[var(--vertigo-faint)]"
                style={{ letterSpacing: "2.2px", marginBottom: 4 }}
              >
                PARTIDA {GAME_ROMAN[game.gameNumber - 1] ?? game.gameNumber}
                {gameMode ? ` · ${gameMode.toUpperCase()}` : ""}
                {playerMode ? ` · ${playerMode.toUpperCase()}` : ""}
              </div>
              <div
                className="font-[Cinzel,serif] font-bold uppercase text-[var(--vertigo-text)] truncate"
                style={{ fontSize: "clamp(19px, 2.4vw, 26px)", letterSpacing: "0.5px", lineHeight: 1.1, textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}
              >
                {map ?? "Esperando el sorteo"}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end flex-none">
              {isLive && (
                <span
                  className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase rounded-full"
                  style={{
                    padding: "3px 10px",
                    letterSpacing: "1.5px",
                    color: "var(--vertigo-success)",
                    border: "1px solid rgba(34,197,94,0.35)",
                    background: "rgba(34,197,94,0.12)",
                    animation: "vcup-pulse 1.6s ease-in-out infinite",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                  En juego
                </span>
              )}
              {winnerName && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase rounded-full"
                  style={{
                    padding: "3px 11px",
                    letterSpacing: "1px",
                    color: "#D4AF37",
                    border: "1px solid rgba(212,175,55,0.4)",
                    background: "rgba(212,175,55,0.08)",
                  }}
                >
                  <Crown style={{ width: 11, height: 11 }} />
                  {winnerName}
                </span>
              )}
              <span className={`vertigo-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
              {!open && game.status === "finished" && game.aoe2?.hasAnalysis && (
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold uppercase rounded-full"
                  style={{
                    padding: "3px 10px",
                    letterSpacing: "1.2px",
                    color: "#D4AF37",
                    border: "1px solid rgba(212,175,55,0.35)",
                    background: "rgba(212,175,55,0.07)",
                  }}
                >
                  <Sparkles style={{ width: 10, height: 10 }} />
                  Informe listo
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((o) => !o);
                }}
                aria-expanded={open}
                aria-controls={`game-detail-${game.id}`}
                title={open ? "Plegar partida" : "Desplegar partida"}
                className="vertigo-btn vertigo-btn-ghost"
                style={{ padding: "5px 12px", fontSize: 10.5, gap: 6 }}
              >
                <ChevronDown
                  style={{
                    width: 12,
                    height: 12,
                    transform: open ? "rotate(180deg)" : "none",
                    transition: "transform 0.25s var(--vertigo-ease)",
                  }}
                />
                {open ? "Ocultar" : "Detalle"}
              </button>
              {game.replayUrl && (
                <a
                  href={game.replayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="vertigo-btn vertigo-btn-ghost"
                  style={{ padding: "5px 12px", fontSize: 10.5 }}
                >
                  <Youtube style={{ width: 12, height: 12 }} />
                  Replay
                </a>
              )}
            </div>
          </div>
          {antimetaMode && (
            <div className="text-[10.5px] font-semibold uppercase mt-1.5" style={{ letterSpacing: "1.2px", color: "var(--vertigo-purple-soft)" }}>
              Antimeta: {antimetaMode}
            </div>
          )}
        </div>
      </div>

      {/* ═══ CUERPO SÓLIDO: la información NUNCA sobre una imagen.
          Plegable por partida: cada informe es pesado y un BO3 completo
          con todo abierto no da aire. El header sigue visible. ═══ */}
      {open && (
        <div
          id={`game-detail-${game.id}`}
          className="vertigo-fade-in"
          style={{ padding: "18px 24px 22px", borderTop: "1px solid var(--vertigo-line-soft)" }}
        >
        {/* Civs: escudos grandes por equipo, oro para el ganador */}
        {(civsA.length > 0 || civsB.length > 0) && (
          <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
            <CivRow name={teamAName} civs={civsA} winner={isAWinner} showWinner={!!winnerName} color="#a78bfa" />
            <CivRow name={teamBName} civs={civsB} winner={isBWinner} showWinner={!!winnerName} color="#fda4af" />
          </div>
        )}

        {/* Análisis post-partida (AoE2 Companion) — solo si terminó y fue archivada.
            El link "Replay" manual convive en la banda. */}
        {game.status === "finished" && game.aoe2?.hasAnalysis && (
          <div style={{ marginTop: 20 }}>
            <GameAnalysisCard
              gameId={game.id}
              teamAName={teamAName}
              teamBName={teamBName}
              teamAEmblem={teamAEmblem}
              teamBEmblem={teamBEmblem}
            />
          </div>
        )}
        </div>
      )}

      <style>{`@keyframes vcup-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.92)}}`}</style>
    </div>
  );
}
