"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { civName } from "@/lib/constants/civs";
import LiveDrawRoulette from "@/components/ruleta/live-draw-roulette";
import MatchHero from "@/components/shared/match-hero";
import { artForMode, artForMap } from "@/lib/art";
import { CaptainMatchPanel, type CaptainPanelContext } from "@/components/captain/captain-match-panel";

export interface GameView {
  id: string;
  gameNumber: number;
  status: string;
  gameMode: string | null;
  antimetaMode: string | null;
  playerMode: string | null;
  map: string | null;
  civsA: string[];
  civsB: string[];
  winnerTeamId: string | null;
  replayUrl: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  drawResult: {
    gameMode?: string;
    antimetaMode?: string;
    playerMode?: string;
    map?: string;
    civsA?: string[];
    civsB?: string[];
  } | null;
}

export interface MatchData {
  id: string;
  status: string;
  format: string | null;
  scheduledAtStart: string | null;
  scheduledAtEnd: string | null;
  jornadaLabel: string | null;
  roundName: string | null;
  teamA: {
    id: string;
    name: string;
    seed: number | null;
  } | null;
  teamB: {
    id: string;
    name: string;
    seed: number | null;
  } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  // READY #1 / READY #2 y ventana de comodines (para el panel del capitán)
  readyA: boolean;
  readyB: boolean;
  readyLineupA: boolean;
  readyLineupB: boolean;
  comodinWindowExpiresAt: string | null;
  streamEmbedEnabled: boolean;
  streamCaster: {
    displayName: string;
    twitchChannel: string | null;
    youtubeChannel: string | null;
    kickChannel: string | null;
  } | null;
  comodinUsages: {
    id: string;
    comodinType: string;
    status: string;
    teamName: string | null;
    notes: string | null;
  }[];
  games: GameView[];
}

interface Props {
  matchId: string;
  initialMatch: MatchData | null;
  /** Contexto del capitán si el viewer es capitán de un equipo de este match */
  captainContext?: CaptainPanelContext | null;
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

export default function MatchRealtimeWrapper({ matchId, initialMatch, captainContext }: Props) {
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

  return (
    <div className="flex flex-col gap-6">
      {/* RULETA EN VIVO — overlay fullscreen cuando el server dispara el sorteo */}
      {match.status === "drawing" && (
        <LiveDrawRoulette
          matchId={matchId}
          onDone={() => void refresh()}
        />
      )}

      {/* HERO cinematográfico del partido (modo + mapa, fondo con arte del sorteo) */}
      <MatchHero
        mapName={match.games[0]?.map ?? null}
        gameModeName={match.games[0]?.gameMode ?? null}
        antimetaName={match.games[0]?.antimetaMode ?? null}
        playerModeName={match.games[0]?.playerMode ?? null}
        llaveName={match.format ?? null}
        status={match.status}
        civsA={match.games[0]?.civsA ?? []}
        civsB={match.games[0]?.civsB ?? []}
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
          annulledPlayerIds={captainContext.annulledPlayerIds}
          readyA={!!match.readyA}
          readyB={!!match.readyB}
          readyLineupA={!!match.readyLineupA}
          readyLineupB={!!match.readyLineupB}
          format={match.format}
          scheduledAtStart={match.scheduledAtStart}
          comodinExpiresAt={match.comodinWindowExpiresAt}
        />
      )}

      {/* SCOREBOARD */}
      <div className="vertigo-card">
        <div className="vertigo-card-header">
          <div className="vertigo-card-title">
            <Swords
              style={{ width: 16, height: 16, display: "inline", marginRight: 8, color: "var(--vertigo-purple-soft)" }}
            />
            {match.roundName ?? "Partido"}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`vertigo-badge ${statusMeta.cls}`}>{statusMeta.label}</span>
            {match.format && <span className="vertigo-badge vertigo-badge-purple">{match.format}</span>}
            {match.jornadaLabel && <span className="vertigo-badge vertigo-badge-purple">{match.jornadaLabel}</span>}
          </div>
        </div>

        {/* Scoreboard principal */}
        <div className="grid items-center gap-4" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
          <TeamSide
            name={match.teamA?.name ?? "Por definir"}
            seed={match.teamA?.seed ?? null}
            score={match.scoreA}
            isWinner={winnerSide === "A"}
            align="right"
            teamId={match.teamA?.id}
          />

          <div className="text-center">
            <div className="text-[10px] tracking-[2px] uppercase text-[var(--vertigo-faint)] mb-1">Score</div>
            <div className="font-cinzel font-bold text-3xl text-[var(--vertigo-purple-pale)]">
              {match.scoreA} <span className="text-[var(--vertigo-faint)] mx-1">—</span> {match.scoreB}
            </div>
            {isFinished && winnerSide && (
              <div className="mt-2">
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
            score={match.scoreB}
            isWinner={winnerSide === "B"}
            align="left"
            teamId={match.teamB?.id}
          />
        </div>

        {/* Info grid */}
        <div
          className="grid gap-3 mt-6"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
        >
          {match.scheduledAtStart && (
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">
                <Calendar style={{ width: 11, height: 11 }} />
                Inicio
              </div>
              <div className="vertigo-info-card-value" style={{ fontSize: 13 }}>
                {new Date(match.scheduledAtStart).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          )}
          {match.scheduledAtEnd && (
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Fin estimado</div>
              <div className="vertigo-info-card-value" style={{ fontSize: 13 }}>
                {new Date(match.scheduledAtEnd).toLocaleString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          )}
          {match.format && (
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Formato</div>
              <div className="vertigo-info-card-value">{match.format}</div>
            </div>
          )}
          {match.streamCaster && (
            <div className="vertigo-info-card">
              <div className="vertigo-info-card-label">Caster</div>
              <div className="vertigo-info-card-value truncate">
                {match.streamCaster.displayName}
              </div>
            </div>
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

      {/* GAMES BO3 */}
      {match.games.length > 0 && (
        <>
          <div className="vertigo-subtitle">
            <Gamepad2 style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
            Partidas ({match.games.length})
          </div>
          <div className="flex flex-col gap-4">
            {match.games.map((g) => (
              <GameCard key={g.id} game={g} teamAName={match.teamA?.name ?? "A"} teamBName={match.teamB?.name ?? "B"} teamAId={match.teamA?.id} teamBId={match.teamB?.id} />
            ))}
          </div>
        </>
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
  score,
  isWinner,
  align,
  teamId,
}: {
  name: string;
  seed: number | null;
  score: number;
  isWinner: boolean;
  align: "left" | "right";
  teamId?: string;
}) {
  const inner = (
    <>
      <div
        className="flex items-center justify-center flex-none rounded-lg border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)] mb-3"
        style={{ width: 56, height: 56 }}
      >
        <Trophy style={{ width: 24, height: 24 }} strokeWidth={1.25} />
      </div>
      <div className={align === "right" ? "text-right" : "text-left"}>
        {seed != null && (
          <div className={`vertigo-badge vertigo-badge-purple mb-1 ${align === "right" ? "ml-auto" : ""}`}>
            Seed #{seed}
          </div>
        )}
        <div
          className={`font-cinzel text-[18px] font-semibold truncate ${isWinner ? "text-[var(--vertigo-purple-pale)]" : "text-[var(--vertigo-text)]"}`}
        >
          {name}
        </div>
        <div className="font-cinzel text-4xl font-bold text-[var(--vertigo-text)] mt-1">
          {score}
        </div>
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

// ============================================================
// LOADER (compartido por server y client)
// ============================================================

export async function loadMatch(supabase: any, matchId: string): Promise<MatchData | null> {
  const { data: match } = (await supabase
    .from("match")
    .select(
      "id, status, format, scheduled_at_start, scheduled_at_end, jornada_label, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id, stream_caster_id, stream_embed_enabled, ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at, comodin_window_expires_at"
    )
    .eq("id", matchId)
    .maybeSingle()) as { data: any };

  if (!match) return null;

  // Team A
  let teamA: MatchData["teamA"] = null;
  if (match.team_a_id) {
    const { data: ta } = (await supabase
      .from("team_registration")
      .select("id, seed, team_account:team_account_id ( name )")
      .eq("id", match.team_a_id)
      .maybeSingle()) as { data: any };
    if (ta) {
      teamA = {
        id: ta.id,
        name: ta.team_account?.name ?? "—",
        seed: ta.seed ?? null,
      };
    }
  }

  // Team B
  let teamB: MatchData["teamB"] = null;
  if (match.team_b_id) {
    const { data: tb } = (await supabase
      .from("team_registration")
      .select("id, seed, team_account:team_account_id ( name )")
      .eq("id", match.team_b_id)
      .maybeSingle()) as { data: any };
    if (tb) {
      teamB = {
        id: tb.id,
        name: tb.team_account?.name ?? "—",
        seed: tb.seed ?? null,
      };
    }
  }

  // Round
  let roundName: string | null = null;
  if (match.round_id) {
    const { data: round } = (await supabase
      .from("round")
      .select("name")
      .eq("id", match.round_id)
      .maybeSingle()) as { data: any };
    if (round) roundName = round.name;
  }

  // Caster
  let streamCaster: MatchData["streamCaster"] = null;
  if (match.stream_caster_id) {
    const { data: caster } = (await supabase
      .from("caster")
      .select("display_name, twitch_channel, youtube_channel, kick_channel")
      .eq("id", match.stream_caster_id)
      .maybeSingle()) as { data: any };
    if (caster) {
      streamCaster = {
        displayName: caster.display_name ?? "—",
        twitchChannel: caster.twitch_channel ?? null,
        youtubeChannel: caster.youtube_channel ?? null,
        kickChannel: caster.kick_channel ?? null,
      };
    }
  }

  // Games
  const { data: gamesRaw } = (await supabase
    .from("match_game")
    .select("id, game_number, status, game_mode, antimeta_mode, player_mode, map, civs_a, civs_b, winner_team_id, replay_url, started_at, finished_at, draw_id")
    .eq("match_id", matchId)
    .order("game_number", { ascending: true })) as { data: any };

  const games: GameView[] = [];
  for (const g of gamesRaw ?? []) {
    let drawResult: GameView["drawResult"] = null;
    if (g.draw_id) {
      const { data: draw } = (await supabase
        .from("roulette_draw")
        .select("result, status")
        .eq("id", g.draw_id)
        .maybeSingle()) as { data: any };
      if (draw && draw.result) {
        const r = draw.result as any;
        drawResult = {
          gameMode: r.gameMode,
          antimetaMode: r.antimetaMode,
          playerMode: r.playerMode,
          map: r.map,
          civsA: r.civsA,
          civsB: r.civsB,
        };
      }
    }
    games.push({
      id: g.id,
      gameNumber: g.game_number,
      status: g.status,
      gameMode: g.game_mode ?? null,
      antimetaMode: g.antimeta_mode ?? null,
      playerMode: g.player_mode ?? null,
      map: g.map ?? null,
      civsA: (g.civs_a as string[]) ?? [],
      civsB: (g.civs_b as string[]) ?? [],
      winnerTeamId: g.winner_team_id ?? null,
      replayUrl: g.replay_url ?? null,
      startedAt: g.started_at ?? null,
      finishedAt: g.finished_at ?? null,
      drawResult,
    });
  }

  // Comodín usages
  const { data: comodinRaw } = (await supabase
    .from("comodin_usage")
    .select("id, comodin_type, status, notes, comodin_inventory_id")
    .eq("match_id", matchId)
    .order("requested_at", { ascending: true })) as { data: any };

  // Para cada uso, traer el team name (via comodin_inventory)
  const invIds: string[] = (comodinRaw ?? [])
    .map((c: any) => c.comodin_inventory_id)
    .filter(Boolean);
  let invToTeam: Record<string, string> = {};
  if (invIds.length > 0) {
    const { data: invs } = (await supabase
      .from("comodin_inventory")
      .select("id, team_registration_id")
      .in("id", invIds)) as { data: any };
    const regIds: string[] = (invs ?? []).map((i: any) => i.team_registration_id).filter(Boolean);
    let regToName: Record<string, string> = {};
    if (regIds.length > 0) {
      const { data: regs } = (await supabase
        .from("team_registration")
        .select("id, team_account:team_account_id ( name )")
        .in("id", regIds)) as { data: any };
      for (const r of regs ?? []) {
        regToName[r.id] = r.team_account?.name ?? "—";
      }
    }
    for (const i of invs ?? []) {
      invToTeam[i.id] = regToName[i.team_registration_id] ?? "—";
    }
  }

  const comodinUsages: MatchData["comodinUsages"] = (comodinRaw ?? []).map((c: any) => ({
    id: c.id,
    comodinType: c.comodin_type,
    status: c.status,
    teamName: c.comodin_inventory_id ? invToTeam[c.comodin_inventory_id] ?? null : null,
    notes: c.notes ?? null,
  }));

  return {
    id: match.id,
    status: match.status,
    format: match.format ?? null,
    scheduledAtStart: match.scheduled_at_start ?? null,
    scheduledAtEnd: match.scheduled_at_end ?? null,
    jornadaLabel: match.jornada_label ?? null,
    roundName,
    teamA,
    teamB,
    scoreA: match.score_a ?? 0,
    scoreB: match.score_b ?? 0,
    winnerTeamId: match.winner_team_id ?? null,
    readyA: !!match.ready_a_at,
    readyB: !!match.ready_b_at,
    readyLineupA: !!match.ready_lineup_a_at,
    readyLineupB: !!match.ready_lineup_b_at,
    comodinWindowExpiresAt: match.comodin_window_expires_at ?? null,
    streamEmbedEnabled: !!match.stream_embed_enabled,
    streamCaster,
    comodinUsages,
    games,
  };
}
