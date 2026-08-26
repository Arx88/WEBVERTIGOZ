"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Calendar,
  Swords,
  Trophy,
  Gamepad2,
  Sparkles,
  Youtube,
  Twitch,
  Layers,
  Users,
  ChevronDown,
  ArrowLeft,
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { civName } from "@/lib/constants/civs";
import LiveDrawRoulette from "@/components/ruleta/live-draw-roulette";
import MatchHero from "@/components/shared/match-hero";
import { artForMode, artForMap } from "@/lib/art";
import { CaptainMatchPanel, type CaptainPanelContext } from "@/components/captain/captain-match-panel";
import BetPanel, { type BetPanelContext } from "@/components/apuestas/bet-panel";
import { loadMatch, type GameView, type MatchData } from "./match-data";

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

export default function MatchRealtimeWrapper({ matchId, initialMatch, captainContext, spectatorContext }: Props) {
  const router = useRouter();
  const [match, setMatch] = useState<MatchData | null>(initialMatch);
  const now = useNow(1000);

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
  const start = match.scheduledAtStart ? new Date(match.scheduledAtStart).getTime() : null;
  const countdown = start ? start - now : null;
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

  return (
    <div className="flex flex-col gap-6">
      {/* RULETA EN VIVO — overlay fullscreen cuando el server dispara el sorteo
          (partida 1: match.status=drawing; partidas 2/3 del BO3: match queda
          in_progress pero la partida activa pasa a drawing) */}
      {(match.status === "drawing" || match.activeGame?.status === "drawing") && (
        <LiveDrawRoulette
          matchId={matchId}
          onDone={() => void refresh()}
        />
      )}

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
        }}
      >
        <ArrowLeft style={{ width: 13, height: 13 }} />
        Volver
      </button>

      {/* HERO cinematográfico del partido (modo + mapa, fondo con arte del sorteo).
          Muestra la partida ACTIVA: en BO3 1-1 es la partida 2/3, no la 1. */}
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

      {/* PANEL DEL CAPITÁN — solo si el viewer es capitán de un equipo de esta llave.
          Le da lineup, READY #2 y comodines en contexto del partido. */}
      {captainContext && match.teamA && match.teamB && (
        <CaptainMatchPanel
          matchId={matchId}
          status={match.status}
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
          scheduledAtStart={match.scheduledAtStart}
          comodinExpiresAt={match.comodinWindowExpiresAt}
        />
      )}

      {/* BOLETA DE APUESTAS — para el espectador es lo principal de la página:
          va antes del scoreboard. Los demás ven un CTA de registro discreto.
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

      {/* SCOREBOARD */}
      <div
        className="vertigo-card"
        style={{ background: "linear-gradient(180deg, rgba(23,16,38,0.55) 0%, rgba(13,9,19,0.92) 100%)" }}
      >
        {/* Ronda al centro, flanqueada por hairlines doradas */}
        <div className="flex items-center justify-center gap-3 flex-wrap" style={{ padding: "20px 24px 0" }}>
          <span style={{ width: 26, height: 1, background: "rgba(212,175,55,0.45)" }} />
          <span
            className="font-cinzel font-bold"
            style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "var(--vertigo-muted)" }}
          >
            {match.roundName ?? "Partido"}
          </span>
          <span style={{ width: 26, height: 1, background: "rgba(212,175,55,0.45)" }} />
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap" style={{ marginTop: 10, padding: "0 24px" }}>
          <span className={`vertigo-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
          {match.format && <span className="vertigo-badge vertigo-badge-purple">{match.format}</span>}
          {match.jornadaLabel && <span className="vertigo-badge vertigo-badge-purple">{match.jornadaLabel}</span>}
        </div>

        {/* Enfrentamiento: escudos grandes cara a cara con resplandor central */}
        <div
          className="relative grid items-center"
          style={{ gridTemplateColumns: "1fr auto 1fr", padding: "30px 24px 26px", columnGap: 14 }}
        >
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 260,
              height: 260,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 65%)",
            }}
          />
          <TeamSide
            name={match.teamA?.name ?? "Por definir"}
            seed={match.teamA?.seed ?? null}
            emblemUrl={match.teamA?.emblemUrl ?? null}
            score={showScores ? match.scoreA : null}
            isWinner={winnerSide === "A"}
            align="right"
            teamId={match.teamA?.id}
          />

          <div className="relative text-center">
            {showScores ? (
              <>
                <div className="text-[9px] tracking-[3px] uppercase text-[var(--vertigo-faint)] mb-1.5">Score</div>
                <div
                  className="font-cinzel font-bold leading-none text-[var(--vertigo-purple-pale)]"
                  style={{ fontSize: 40, textShadow: "0 0 26px rgba(124,58,237,0.35)" }}
                >
                  {match.scoreA}
                  <span className="text-[var(--vertigo-faint)] mx-2">—</span>
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

          <TeamSide
            name={match.teamB?.name ?? "Por definir"}
            seed={match.teamB?.seed ?? null}
            emblemUrl={match.teamB?.emblemUrl ?? null}
            score={showScores ? match.scoreB : null}
            isWinner={winnerSide === "B"}
            align="left"
            teamId={match.teamB?.id}
          />
        </div>

        {/* Meta en una línea bajo hairline — nada de cajitas */}
        <div
          className="flex items-center justify-center gap-x-6 gap-y-2 flex-wrap"
          style={{ padding: "14px 24px 18px", borderTop: "1px solid var(--vertigo-line-soft)" }}
        >
          {match.scheduledAtStart && (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--vertigo-muted)" }}>
              <Calendar style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
              {new Date(match.scheduledAtStart).toLocaleString("es-AR", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {/* Fin estimado y formato: datos operativos, solo interesan al capitán */}
          {captainContext && match.scheduledAtEnd && (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--vertigo-muted)" }}>
              <Clock style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
              Fin estimado{" "}
              {new Date(match.scheduledAtEnd).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {match.streamCaster && (
            <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--vertigo-muted)" }}>
              <Youtube style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
              <span className="truncate max-w-[180px]">{match.streamCaster.displayName}</span>
            </span>
          )}
        </div>

        {/* Countdown */}
        {countdown !== null && countdown > 0 && match.status === "scheduled" && (
          <div className="vertigo-stat mt-5" style={{ textAlign: "center" }}>
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

        {/* Stream link */}
        {match.streamEmbedEnabled && match.streamCaster && (
          <div className="vertigo-action-bar mt-5 pt-4 border-t border-[var(--vertigo-line-soft)]">
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

      {/* GAMES BO3 — plegados por defecto para espectadores: son specs del sorteo,
          relevantes sobre todo para capitanes. El panel de apuestas queda protagonista. */}
      {match.games.length > 0 && (
        <details className="apu-fold" open={!!captainContext || match.games.length <= 1}>
          <summary>
            <Gamepad2 style={{ width: 13, height: 13, color: "var(--vertigo-purple-soft)", flexShrink: 0 }} />
            Partidas del sorteo ({match.games.length})
            {!captainContext && (
              <span
                className="font-normal normal-case"
                style={{ fontSize: 11, letterSpacing: "0.5px", color: "var(--vertigo-faint)" }}
              >
                · detalles técnicos del sorteo
              </span>
            )}
            <ChevronDown className="apu-chev" style={{ width: 14, height: 14 }} />
          </summary>
          <div className="apu-fold-body">
            <div className="flex flex-col gap-4">
              {match.games.map((g) => (
                <GameCard key={g.id} game={g} teamAName={match.teamA?.name ?? "A"} teamBName={match.teamB?.name ?? "B"} teamAId={match.teamA?.id} teamBId={match.teamB?.id} />
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
      <div className="vertigo-action-bar">
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

function TeamSide({
  name,
  seed,
  emblemUrl,
  score,
  isWinner,
  align,
  teamId,
}: {
  name: string;
  seed: number | null;
  emblemUrl: string | null;
  score: number | null;
  isWinner: boolean;
  align: "left" | "right";
  teamId?: string;
}) {
  const inner = (
    <>
      {/* Escudo grande con doble aro: dorado si ganó, violeta si no */}
      <div
        className="relative flex items-center justify-center flex-none rounded-full overflow-hidden"
        style={{
          width: "clamp(68px, 17vw, 96px)",
          height: "clamp(68px, 17vw, 96px)",
          border: isWinner ? "2px solid rgba(212,175,55,0.75)" : "2px solid rgba(124,58,237,0.5)",
          background: "var(--vertigo-input-bg, #0e0a14)",
          boxShadow: isWinner
            ? "0 0 0 5px rgba(212,175,55,0.12), 0 0 32px rgba(212,175,55,0.28)"
            : "0 0 0 5px rgba(124,58,237,0.08), 0 0 24px rgba(124,58,237,0.16)",
        }}
      >
        {emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={emblemUrl} alt={`${name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Trophy style={{ width: 34, height: 34, color: "var(--vertigo-purple-soft)" }} strokeWidth={1.1} />
        )}
      </div>
      <div className={`mt-3 min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
        {seed != null && (
          <div
            className="text-[9px] font-bold uppercase mb-1"
            style={{ letterSpacing: 2, color: "var(--vertigo-faint)" }}
          >
            Seed #{seed}
          </div>
        )}
        <div
          className={`font-cinzel font-bold truncate ${isWinner ? "text-[var(--vertigo-gold)]" : "text-[var(--vertigo-text)]"}`}
          style={{ fontSize: "clamp(17px, 2vw, 23px)", lineHeight: 1.15, textShadow: "0 2px 18px rgba(0,0,0,0.5)" }}
        >
          {name}
        </div>
        {score != null && (
          <div
            className="font-cinzel font-bold mt-1.5 leading-none"
            style={{
              fontSize: 34,
              color: isWinner ? "var(--vertigo-gold)" : "var(--vertigo-purple-pale)",
              textShadow: "0 0 22px rgba(124,58,237,0.3)",
            }}
          >
            {score}
          </div>
        )}
      </div>
    </>
  );

  if (teamId) {
    return (
      <Link
        href={`/equipos/${teamId}`}
        className={`flex flex-col ${align === "right" ? "items-end" : "items-start"} min-w-0`}
        style={{ textDecoration: "none" }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"} min-w-0`}>
      {inner}
    </div>
  );
}

function GameCard({
  game,
  teamAName,
  teamBName,
  teamAId,
  teamBId,
}: {
  game: GameView;
  teamAName: string;
  teamBName: string;
  teamAId?: string;
  teamBId?: string;
}) {
  const statusMeta = MATCH_STATUS_META[game.status] ?? MATCH_STATUS_META.scheduled;
  const isAWinner = game.winnerTeamId && teamAId && game.winnerTeamId === teamAId;
  const isBWinner = game.winnerTeamId && teamBId && game.winnerTeamId === teamBId;

  const draw = game.drawResult;
  const gameMode = draw?.gameMode ?? game.gameMode;
  const antimetaMode = draw?.antimetaMode ?? game.antimetaMode;
  const playerMode = draw?.playerMode ?? game.playerMode;
  const map = draw?.map ?? game.map;
  const civsA = draw?.civsA ?? game.civsA ?? [];
  const civsB = draw?.civsB ?? game.civsB ?? [];

  // Imágenes del modo y del mapa sorteados (para mostrar arte, no solo texto)
  const gameModeArt = gameMode ? artForMode(gameMode) : null;
  const mapArt = map ? artForMap(map) : null;

  return (
    <div className="vertigo-card">
      <div className="vertigo-card-header">
        <div className="vertigo-card-title">
          <Layers style={{ width: 14, height: 14, display: "inline", marginRight: 8, color: "var(--vertigo-purple-soft)" }} />
          Partida {game.gameNumber}
        </div>
        <span className={`vertigo-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
      </div>

      {/* Sorteo */}
      <div className="vertigo-subtitle">
        <Swords style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
        Sorteo
      </div>
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
      >
        {/* Modo con imagen */}
        {gameMode && (
          <div className="vertigo-info-card" style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(124,58,237,0.25)", minHeight: 90 }}>
            <div style={{ height: 56, overflow: "hidden", position: "relative", borderRadius: "10px 10px 0 0" }}>
              <img src={gameModeArt ?? undefined} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(13,9,19,0.85) 100%)" }} />
            </div>
            <div style={{ padding: "8px 12px" }}>
              <div className="vertigo-info-card-label" style={{ marginBottom: 2, fontSize: 9 }}>Modo</div>
              <div className="vertigo-info-card-value" style={{ fontSize: 13, lineHeight: 1.2 }}>{gameMode}</div>
            </div>
          </div>
        )}
        {antimetaMode && (
          <div className="vertigo-info-card">
            <div className="vertigo-info-card-label">Antimeta</div>
            <div className="vertigo-info-card-value" style={{ fontSize: 13 }}>{antimetaMode}</div>
          </div>
        )}
        {playerMode && (
          <div className="vertigo-info-card">
            <div className="vertigo-info-card-label">
              <Users style={{ width: 11, height: 11 }} />
              Jugadores
            </div>
            <div className="vertigo-info-card-value" style={{ fontSize: 13 }}>{playerMode}</div>
          </div>
        )}
        {/* Mapa con imagen */}
        {map && (
          <div className="vertigo-info-card" style={{ padding: 0, overflow: "hidden", border: "1px solid rgba(124,58,237,0.25)", minHeight: 90 }}>
            <div style={{ height: 56, overflow: "hidden", position: "relative", borderRadius: "10px 10px 0 0" }}>
              <img src={mapArt ?? undefined} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(13,9,19,0.85) 100%)" }} />
            </div>
            <div style={{ padding: "8px 12px" }}>
              <div className="vertigo-info-card-label" style={{ marginBottom: 2, fontSize: 9 }}>Mapa</div>
              <div className="vertigo-info-card-value" style={{ fontSize: 13, lineHeight: 1.2 }}>{map}</div>
            </div>
          </div>
        )}
      </div>

      {/* Civs */}
      {(civsA.length > 0 || civsB.length > 0) && (
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div className="vertigo-info-card-label" style={{ marginBottom: 8 }}>
              {teamAName}
            </div>
            <div className="flex flex-wrap gap-2">
              {civsA.length === 0 ? (
                <span className="text-[12px] text-[var(--vertigo-faint)]">Sin sortear</span>
              ) : (
                civsA.map((c) => (
                  <span key={c} className={`vertigo-badge ${isAWinner ? "vertigo-badge-success" : "vertigo-badge-purple"}`}>
                    {civName(c)}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <div className="vertigo-info-card-label" style={{ marginBottom: 8 }}>
              {teamBName}
            </div>
            <div className="flex flex-wrap gap-2">
              {civsB.length === 0 ? (
                <span className="text-[12px] text-[var(--vertigo-faint)]">Sin sortear</span>
              ) : (
                civsB.map((c) => (
                  <span key={c} className={`vertigo-badge ${isBWinner ? "vertigo-badge-success" : "vertigo-badge-purple"}`}>
                    {civName(c)}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replay */}
      {game.replayUrl && (
        <div className="vertigo-action-bar">
          <a
            href={game.replayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="vertigo-btn vertigo-btn-ghost"
          >
            <Youtube style={{ width: 14, height: 14 }} />
            Ver replay
          </a>
        </div>
      )}
    </div>
  );
}
