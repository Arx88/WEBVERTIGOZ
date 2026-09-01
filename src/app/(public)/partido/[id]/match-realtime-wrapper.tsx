"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Youtube,
  ArrowLeft,
  Crown,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { civName } from "@/lib/constants/civs";
import { artForMode, artForMap, ART_FALLBACK } from "@/lib/art";
import { CaptainMatchPanel, type CaptainPanelContext } from "@/components/captain/captain-match-panel";
import BetPanel, { type BetPanelContext } from "@/components/apuestas/bet-panel";
import { loadMatch, type GameView, type MatchData } from "./match-data";
import MatchScoreboard, { type ViewContext } from "./match-scoreboard";
import { useNow, usePhaseEnter } from "./realtime-hooks";
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
  /** Contexto de visualización pública (rosters A/B + pozo) para el scoreboard */
  viewContext?: ViewContext | null;
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

export default function MatchRealtimeWrapper({ matchId, initialMatch, captainContext, spectatorContext, viewContext }: Props) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchData | null>(initialMatch);

  // Sincronizar cuando el server re-renderiza con datos frescos (p.ej. tras un
  // form action con revalidatePath): useState ignora el nuevo prop por sí solo,
  // así que sin esto el capitán que confirma READY no vería su banner hasta
  // recargar a mano.
  // La comparación es por CONTENIDO (status + timestamps de fase + scores):
  // comparar por identidad del objeto es frágil — React puede conservar la
  // referencia entre renders del server component y el refresh en vivo
  // quedaría silenciosamente ignorado (bug real: la página quedaba pillada
  // en la fase vieja aunque router.refresh() traía datos nuevos).
  useEffect(() => {
    if (!initialMatch) return;
    setMatch((cur) => {
      if (!cur) return initialMatch;
      const changed =
        cur.status !== initialMatch.status ||
        cur.scoreA !== initialMatch.scoreA ||
        cur.scoreB !== initialMatch.scoreB ||
        cur.winnerTeamId !== initialMatch.winnerTeamId ||
        cur.readyLineupA !== initialMatch.readyLineupA ||
        cur.readyLineupB !== initialMatch.readyLineupB ||
        cur.comodinWindowExpiresAt !== initialMatch.comodinWindowExpiresAt ||
        // Un comodín solicitado (INSERT en comodin_usage) no toca ninguna de
        // las columnas de match: sin esta comparación el refresh en vivo
        // descartaba el RSC nuevo y el capitán no veía su solicitud ni el
        // bloqueo de exclusión mutua hasta recargar.
        JSON.stringify(cur.comodinUsages) !== JSON.stringify(initialMatch.comodinUsages) ||
        JSON.stringify(cur.activeGame) !== JSON.stringify(initialMatch.activeGame);
      return changed ? initialMatch : cur;
    });
  }, [initialMatch]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void refresh(), 350);
    };
    const channel = supabase
      .channel(`match-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match", filter: `id=eq.${matchId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_game", filter: `match_id=eq.${matchId}` },
        scheduleRefresh
      )
      // roulette_draw NO está en la publicación Realtime de este proyecto
      // (verificado empíricamente): la suscripción era un canal muerto. El
      // draw se refleja en match_game al persistirse (draw_id/map/civs
      // juntos), así que match_game ya cubre el refresh.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comodin_usage", filter: `match_id=eq.${matchId}` },
        scheduleRefresh
      )
      .subscribe((status) => {
        // Reconexión honesta: si el canal se cayó (red, laptop dormida,
        // token JWT expirado), un router.refresh() trae props frescos del
        // server; el useEffect de arriba (setMatch(initialMatch)) los captura.
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          scheduleRefresh();
        }
      });

    return () => {
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Refresco en vivo con el MISMO mecanismo que el overlay (verificado
  // actualizando solo): router.refresh() re-renderiza el server con props
  // frescos y el useEffect de arriba (setMatch(initialMatch)) los captura.
  // El loadMatch client-side directo quedó afuera: al superponerse con el
  // refresh del server duplicaba queries y, tras el primer evento, el canal
  // dejaba de disparar.
  async function refresh() {
    router.refresh();
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

  // Pestaña por defecto del informe de la serie: la partida en juego;
  // si ninguna, la última con informe archivado (la más fresca).
  const featuredGameIdx = (() => {
    const liveIdx = match.games.findIndex((g) => g.status === "in_progress" || g.status === "drawing");
    if (liveIdx >= 0) return liveIdx;
    for (let i = match.games.length - 1; i >= 0; i--) {
      if (match.games[i].status === "finished" && match.games[i].aoe2?.hasAnalysis) return i;
    }
    return -1;
  })();

  // Antes del primer sorteo la partida existe pero no tiene mapa/modo.
  const hasDrawnGame = !!(match.activeGame && (match.activeGame.map || match.activeGame.gameMode));

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

  // Glow del scoreboard cuando cambia la fase en vivo (realtime).
  const scoreboardPhaseCls = usePhaseEnter(match.status);

  return (
    <div className="flex flex-col gap-6">
      {/* La ruleta EN VIVO no vive en la página pública: es un visual de la
          stream (/overlay/[match_id]). Acá el espectador ve ya el resultado
          sorteado (mapa, modo, civs, sala) en las secciones de abajo. */}

      {/* VOLVER ATRÁS — flecha de historial del navegador */}
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
        }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} />
        Volver
      </button>

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

      {/* SCOREBOARD — pieza central del partido: habla de la SERIE (score,
          estado, formato, horario). El encuentro activo es un badge aparte
          ("Ahora: partida N — Mapa · Modo"); el fondo es el video de torneo,
          nunca el mapa de una sola partida (error de categoría BO3). */}
      <div className={scoreboardPhaseCls}>
        <MatchScoreboard
          matchId={matchId}
          status={match.status}
          statusMeta={statusMeta}
          roundName={match.roundName}
          format={match.format}
          jornadaLabel={match.jornadaLabel}
          scheduledAtStart={match.scheduledAtStart}
          teamA={match.teamA}
          teamB={match.teamB}
          scoreA={match.scoreA}
          scoreB={match.scoreB}
          winnerTeamId={match.winnerTeamId}
          activeGame={
            match.activeGame
              ? {
                  gameNumber: match.activeGame.gameNumber,
                  playerMode: match.activeGame.playerMode,
                  map: match.activeGame.map,
                  gameMode: match.activeGame.gameMode,
                  startedAt: match.activeGame.startedAt,
                  lineupA: match.activeGame.lineupA,
                  lineupB: match.activeGame.lineupB,
                  civAssignA: match.activeGame.civAssignA,
                  civAssignB: match.activeGame.civAssignB,
                }
              : null
          }
          streamEmbedEnabled={match.streamEmbedEnabled}
          streamCaster={match.streamCaster}
          viewContext={viewContext ?? null}
        />
      </div>

      {/* PANEL DEL CAPITÁN — solo si el viewer es capitán de un equipo de esta
          llave. La sección hace auto-scroll a la fase activa cuando llega por
          realtime (lineup, comodines, etc.) con glow de llegada. */}
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
          comodinInventory={captainContext.comodinInventory}
          comodinUsages={match.comodinUsages}
          readyA={!!match.readyA}
          readyB={!!match.readyB}
          readyLineupA={!!match.readyLineupA}
          readyLineupB={!!match.readyLineupB}
          playerMode={match.activeGame?.playerMode ?? null}
          myCivs={captainContext.myTeamRegId === match.teamA.id ? (match.activeGame?.civsA ?? []) : (match.activeGame?.civsB ?? [])}
          myLineup={
            captainContext.myTeamRegId === match.teamA.id
              ? match.activeGame?.lineupA ?? []
              : match.activeGame?.lineupB ?? []
          }
          myCivAssignment={
            captainContext.myTeamRegId === match.teamA.id
              ? match.activeGame?.civAssignA ?? {}
              : match.activeGame?.civAssignB ?? {}
          }
          comodinExpiresAt={match.comodinWindowExpiresAt}
          lobbyName={lobbyName}
          activeGame={
            match.activeGame
              ? {
                  map: match.activeGame.map,
                  gameMode: match.activeGame.gameMode,
                  playerMode: match.activeGame.playerMode,
                  civsA: match.activeGame.civsA,
                  civsB: match.activeGame.civsB,
                }
              : null
          }
        />
      )}

      {/* SALA DE AOE2 — por partida (el nombre es la clave de detección
          automática del resultado). Visible para todos: el capitán la crea. */}
      {lobbyName && match.activeGame && (
        <section className="vertigo-card match-lobby" aria-label={`Sala de la partida ${match.activeGame.gameNumber}`}>
          <div className="label">
            Sala de la partida {match.activeGame.gameNumber}
            <br />en Age of Empires 2
          </div>
          <LobbyCode name={lobbyName} />
          <div className="hint">
            Cada partida de la serie tiene su sala: creala con este nombre exacto y el resultado se detecta y carga solo.
          </div>
        </section>
      )}

      {/* INFORME DE LA SERIE — pestañas por partida (BO3: cada encuentro
          tiene SU informe). El GameCard con arte de mapa, civs y análisis
          de Companion es el contenido de la pestaña activa. */}
      {match.games.length > 0 && (
        <SeriesReport
          games={match.games}
          match={match}
          captainContext={captainContext}
          isFinished={isFinished}
          featuredGameIdx={featuredGameIdx}
        />
      )}

      {/* COMODINES USADOS — historial de la llave */}
      {match.comodinUsages.length > 0 && (
        <>
          <div className="match-sec-head">
            <span className="tag">Historial</span>
            <h2>Comodines usados</h2>
            <span className="rule" />
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

/**
 * Informe de la serie — pestañas por partida (estilo demo v10).
 * En BO3 cada encuentro tiene SU pestaña: terminadas llevan el score,
 * la actual "En juego", y las que todavía no existen "Si hace falta"
 * (disabled). El contenido de la pestaña activa es el GameCard completo
 * (arte del mapa, civs, análisis de Companion), que se conserva intacto.
 */
function SeriesReport({
  games,
  match,
  captainContext,
  isFinished,
  featuredGameIdx,
}: {
  games: GameView[];
  match: MatchData;
  captainContext?: CaptainPanelContext | null;
  isFinished: boolean;
  featuredGameIdx: number;
}) {
  const [activeIdx, setActiveIdx] = useState<number>(Math.max(0, featuredGameIdx));
  const prevFeatured = useRef<number>(featuredGameIdx);

  // Si la partida en juego cambia (realtime: se reportó un resultado y
  // arranca la siguiente), la pestaña activa la sigue.
  useEffect(() => {
    if (featuredGameIdx >= 0 && featuredGameIdx !== prevFeatured.current) {
      prevFeatured.current = featuredGameIdx;
      setActiveIdx(featuredGameIdx);
    }
  }, [featuredGameIdx]);

  const teamAName = match.teamA?.name ?? "A";
  const teamBName = match.teamB?.name ?? "B";
  const g = games[Math.min(activeIdx, games.length - 1)];

  const scoreAtGame = (game: GameView): string | null => {
    // Score de la partida: en 1v1 el score es implícito — mostramos el
    // ganador de forma compacta: "1—0" (A—B) según winner_team_id.
    if (game.status !== "finished" || !game.winnerTeamId) return null;
    if (match.teamA && game.winnerTeamId === match.teamA.id) return "1—0";
    if (match.teamB && game.winnerTeamId === match.teamB.id) return "0—1";
    return null;
  };

  return (
    <div>
      <div className="match-sec-head">
        <span className={`tag ${isFinished ? "gold" : ""}`}>Fase · {isFinished ? "Post-partida" : "Partidas"}</span>
        <h2>Informe de la serie</h2>
        <span className={`rule ${isFinished ? "gold" : ""}`} />
      </div>
      <div className="vertigo-card" style={{ overflow: "hidden" }}>
        {/* Las pestañas solo sirven para navegar una SERIE de varias partidas;
            con una sola (BO1) son ruido — el estado ya lo dicen el scoreboard
            y el GameCard. */}
        {games.length > 1 && (
          <div className="game-tabs" role="tablist" aria-label="Partidas de la serie">
            {games.map((game, i) => {
              const score = scoreAtGame(game);
              const isLive = game.status === "in_progress";
              const isLocked = game.status === "pending" || game.status === "scheduled";
              const cls = [
                "game-tab",
                i === activeIdx ? "active" : "",
                score ? "done" : "",
                isLive ? "live" : "",
                isLocked ? "locked" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={game.id}
                  type="button"
                  role="tab"
                  aria-selected={i === activeIdx}
                  className={cls}
                  disabled={isLocked}
                  onClick={() => setActiveIdx(i)}
                >
                  <span className="n">{game.gameNumber}</span>
                  <span className="st">
                    {score ? (
                      score
                    ) : isLive ? (
                      <>
                        <i />
                        En juego
                      </>
                    ) : isLocked ? (
                      "Si hace falta"
                    ) : (
                      (MATCH_STATUS_META[game.status] ?? MATCH_STATUS_META.scheduled).label
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {g && (
          <div style={{ padding: "0 0 6px" }}>
            <GameCard
              game={g}
              teamAName={teamAName}
              teamBName={teamBName}
              teamAId={match.teamA?.id}
              teamBId={match.teamB?.id}
              teamAEmblem={match.teamA?.emblemUrl ?? null}
              teamBEmblem={match.teamB?.emblemUrl ?? null}
              defaultOpen={true}
            />
          </div>
        )}
        {games.length > 1 && !captainContext && (
          <div className="text-[11px] text-[var(--vertigo-faint)]" style={{ padding: "8px 18px 14px" }}>
            {isFinished ? "Resultado y análisis por partida" : "Detalles técnicos del sorteo, partida por partida"}
          </div>
        )}
      </div>
    </div>
  );
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
              {/* En juego la pestaña de arriba ya lo dice — el badge de estado
                  solo suma en las demás fases (Programado, Finalizado…). */}
              {!isLive && <span className={`vertigo-badge ${statusMeta.cls}`}>{statusMeta.label}</span>}
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

/** Código de sala del encuentro — DOM LITERAL de la demo v10:
 *  código 26px violet-pale con glow + botón Copiar con gradiente violeta. */
function LobbyCode({ name }: { name: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard no disponible: el nombre queda visible para tipearlo
    }
  };
  return (
    <>
      <div className="code">{name}</div>
      <button type="button" onClick={copy} className={`copy-btn${copied ? " copied" : ""}`}>
        {copied ? <Check /> : <Copy />}
        <span>{copied ? "Copiado" : "Copiar"}</span>
      </button>
    </>
  );
}
