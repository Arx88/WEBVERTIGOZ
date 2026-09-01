"use client";

/**
 * VÉRTIGO Cup — MatchScoreboard (demo demo-ux-partido.html v10, port LITERAL).
 *
 * Scoreboard unificado de la SERIE: video de torneo de fondo, ronda con
 * hairlines doradas, badges de estado/formato/encuentro-activo, grid
 * 1fr / minmax(280px,380px) / 1fr con emblemas de 108px triple-glow,
 * banda "playing" en pill con civ 46px, score Cinzel 900 52px con colon
 * dorado, hairlines verticales al centro, banda meta y banda de stream.
 */

import Link from "next/link";
import {
  Clock,
  Calendar,
  Trophy,
  Youtube,
  Twitch,
  Users,
} from "lucide-react";
import { civName } from "@/lib/constants/civs";
import ReadyDeadlineTimer from "@/components/shared/ready-deadline-timer";
import LocalTime from "@/components/shared/local-time";
import { useNow } from "./realtime-hooks";

export interface ViewPlayers {
  id: string;
  displayName: string;
  isCaptain: boolean;
}

export interface ViewContext {
  playersA: ViewPlayers[];
  playersB: ViewPlayers[];
  pool: number;
  bettors: number;
}

interface Props {
  matchId: string;
  status: string;
  statusMeta: { label: string; cls: string };
  roundName: string | null;
  format: string | null;
  jornadaLabel: string | null;
  scheduledAtStart: string | null;
  teamA: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  teamB: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  /** Partida activa (encuentro): mapa/modo/formato/lineup/civs. */
  activeGame: {
    gameNumber: number;
    playerMode: string | null;
    map: string | null;
    gameMode: string | null;
    startedAt: string | null;
    lineupA: string[];
    lineupB: string[];
    civAssignA: Record<string, string>;
    civAssignB: Record<string, string>;
  } | null;
  streamEmbedEnabled: boolean;
  streamCaster: {
    displayName: string;
    twitchChannel: string | null;
    youtubeChannel: string | null;
    kickChannel: string | null;
  } | null;
  viewContext: ViewContext | null;
}

const MATCH_STATUS_META_REF: Record<string, { label: string; cls: string }> = {
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
export { MATCH_STATUS_META_REF };

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** Countdown al inicio + tolerancia W.O. — hoja aislada (solo ella tickea). */
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
            <Clock style={{ width: 22, height: 22, display: "inline", marginRight: 10, verticalAlign: "middle" }} strokeWidth={1.25} />
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

export default function MatchScoreboard({
  status,
  statusMeta,
  roundName,
  format,
  jornadaLabel,
  scheduledAtStart,
  teamA,
  teamB,
  scoreA,
  scoreB,
  winnerTeamId,
  activeGame,
  streamEmbedEnabled,
  streamCaster,
  viewContext,
}: Props) {
  const isFinished = status === "finished";
  const isLive = status === "in_progress";
  const winnerSide =
    winnerTeamId && teamA && winnerTeamId === teamA.id ? "A" : winnerTeamId && teamB && winnerTeamId === teamB.id ? "B" : null;
  // En juego (o terminado) el marcador de la serie SIEMPRE es visible con sus
  // cifras — el sello VS queda para las fases previas (demo: 1:0 en juego).
  const showScores = isLive || scoreA > 0 || scoreB > 0 || isFinished || status === "disputed" || status === "forfeit";

  // Encuentro activo con sorteo publicado → badge "Ahora: partida N — …"
  const activeBadge =
    activeGame && (activeGame.map || activeGame.gameMode)
      ? [
          `Ahora: partida ${activeGame.gameNumber}`,
          activeGame.map,
          activeGame.gameMode,
          activeGame.playerMode,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  // Banda "playing" de cada equipo: lineup del encuentro activo
  const lineupOf = (side: "A" | "B") => {
    if (!activeGame || activeGame.lineupA.length === 0) return [] as { id: string; civ: string | null }[];
    const ids = side === "A" ? activeGame.lineupA : activeGame.lineupB;
    const assign = side === "A" ? activeGame.civAssignA : activeGame.civAssignB;
    return ids.map((id) => ({ id, civ: assign[id] ?? null }));
  };
  const playingA = lineupOf("A");
  const playingB = lineupOf("B");

  return (
    <section className="partido-msb" aria-label="Scoreboard del partido">
      {/* Fondo: video de torneo + velo (como el VERSUS real) */}
      <div className="msb-art" aria-hidden="true">
        <video autoPlay muted loop playsInline tabIndex={-1} src="/landing/proxima-partida-bg.mp4" />
      </div>

      {/* Ronda al centro, flanqueada por hairlines doradas */}
      <div className="msb-top">
        <span className="hairline" />
        <span className="round">{roundName ?? "Partido"}</span>
        <span className="hairline rev" />
      </div>

      {/* Badges de SERIE: estado · formato · jornada · (encuentro activo) */}
      <div className="msb-badges">
        <span className={`badge ${isLive ? "success" : ""}`}>
          {isLive && <i />}
          {statusMeta.label}
        </span>
        {format && <span className="badge">Al mejor de {format.replace(/^BO/i, "")}</span>}
        {jornadaLabel && <span className="badge">{jornadaLabel}</span>}
        {activeBadge && <span className="badge fuchsia">{activeBadge}</span>}
      </div>

      <div className="msb-grid">
        <ScoreboardTeam
          side="left"
          name={teamA?.name ?? "Por definir"}
          seed={teamA?.seed ?? null}
          emblemUrl={teamA?.emblemUrl ?? null}
          teamId={teamA?.id}
          isWinner={winnerSide === "A"}
          playing={playingA.map((pl) => ({
            name: viewContext?.playersA.find((p) => p.id === pl.id)?.displayName ?? "Jugador",
            isCaptain: viewContext?.playersA.find((p) => p.id === pl.id)?.isCaptain ?? false,
            civ: pl.civ,
          }))}
          bench={viewContext?.playersA
            .filter((p) => !playingA.some((pl) => pl.id === p.id))
            .map((p) => (p.isCaptain ? `★ ${p.displayName}` : p.displayName)) ?? []}
        />

        <div className="msb-center">
          <div className="msb-kicker">{format ? `Al mejor de ${format.replace(/^BO/i, "")}` : "Serie"}</div>
          {showScores ? (
            <div className="msb-score">
              {isLive && <i className="live-dot" title="Partida en juego" />}
              <span>{scoreA}</span>
              <span className="colon">:</span>
              <span>{scoreB}</span>
            </div>
          ) : (
            <div className="msb-vs">VS</div>
          )}
          <div className="msb-score-label">Serie</div>
          {isFinished && winnerSide && (
            <span className="msb-win-badge">
              <Trophy style={{ width: 11, height: 11 }} />
              {(winnerSide === "A" ? teamA?.name : teamB?.name) ?? ""}
            </span>
          )}
        </div>

        <ScoreboardTeam
          side="right"
          name={teamB?.name ?? "Por definir"}
          seed={teamB?.seed ?? null}
          emblemUrl={teamB?.emblemUrl ?? null}
          teamId={teamB?.id}
          isWinner={winnerSide === "B"}
          playing={playingB.map((pl) => ({
            name: viewContext?.playersB.find((p) => p.id === pl.id)?.displayName ?? "Jugador",
            isCaptain: viewContext?.playersB.find((p) => p.id === pl.id)?.isCaptain ?? false,
            civ: pl.civ,
          }))}
          bench={viewContext?.playersB
            .filter((p) => !playingB.some((pl) => pl.id === p.id))
            .map((p) => (p.isCaptain ? `★ ${p.displayName}` : p.displayName)) ?? []}
        />
      </div>

      {/* Meta: fecha · partida activa (arrancó) · pozo · caster */}
      <div className="msb-meta">
        {scheduledAtStart && (
          <span className="meta-item">
            <Calendar />
            <LocalTime value={scheduledAtStart} variant="dayMonTime" />
          </span>
        )}
        {!scheduledAtStart && status === "scheduled" && (
          <span className="meta-item">
            <Calendar />
            FECHA A CONFIRMAR
          </span>
        )}
        {activeGame?.startedAt && isLive && (
          <span className="meta-item">
            <Clock />
            Partida {activeGame.gameNumber} · arrancó <LocalTime value={activeGame.startedAt} variant="time" />
          </span>
        )}
        {viewContext && viewContext.pool > 0 && (
          <span className="meta-item">
            <Users />
            {viewContext.pool.toLocaleString("es-AR")} VGC en el pozo
          </span>
        )}
        {streamCaster && (
          <span className="meta-item">
            <Youtube />
            Caster: <span className="truncate max-w-[180px]">{streamCaster.displayName}</span>
          </span>
        )}
      </div>

      {/* Countdown + tolerancia W.O. (timer aislado) */}
      <ScheduledTimers scheduledAtStart={scheduledAtStart} status={status} />

      {/* Stream links */}
      {streamEmbedEnabled && streamCaster && (
        <div className="msb-stream">
          {streamCaster.twitchChannel && (
            <a
              href={`https://twitch.tv/${streamCaster.twitchChannel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="stream-link primary"
            >
              <Twitch style={{ width: 13, height: 13 }} />
              Ver en Twitch
            </a>
          )}
          {streamCaster.youtubeChannel && (
            <a
              href={`https://youtube.com/@${streamCaster.youtubeChannel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="stream-link"
            >
              <Youtube style={{ width: 13, height: 13 }} />
              Ver en YouTube
            </a>
          )}
          {isLive && (
            <span className="stream-live">
              <i />
              EN VIVO
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/** Equipo del scoreboard — DOM LITERAL de la demo: emblem-row 108px,
 *  team-side con nick Cinzel 900 clamp(30px,3.6vw,46px), banda playing
 *  en pill 999px con civ 46px + nick 18px/800 + sub gold-soft, banca. */
function ScoreboardTeam({
  side,
  name,
  seed,
  emblemUrl,
  teamId,
  isWinner,
  playing,
  bench,
}: {
  side: "left" | "right";
  name: string;
  seed: number | null;
  emblemUrl: string | null;
  teamId?: string;
  isWinner: boolean;
  playing: { name: string; isCaptain: boolean; civ: string | null }[];
  bench: string[];
}) {
  const inner = (
    <>
      <div className="msb-emblem-row">
        <div className="msb-emblem">
          {emblemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emblemUrl} alt={`Escudo de ${name}`} />
          ) : (
            <Trophy style={{ width: 44, height: 44, color: "var(--vertigo-purple-soft)" }} strokeWidth={1.1} />
          )}
        </div>
        <div className="msb-team-side">
          <div className="nick">{name}</div>
          {seed != null && <div className="sub">Seed #{seed}</div>}
        </div>
      </div>

      {/* Banda "playing": quiénes juegan ESTE encuentro (lineup declarado) */}
      {playing.length > 0 && (
        <div className="msb-playing">
          <div className="civ">
            {playing[0].civ ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/civs/${playing[0].civ}.webp`} alt={civName(playing[0].civ)} />
            ) : null}
          </div>
          <div className="who">
            <div className="nick">{playing[0].name}</div>
            <div className="sub">
              {playing[0].isCaptain
                ? `★ Capitán${playing[0].civ ? ` — ${civName(playing[0].civ)}` : ""}`
                : playing[0].civ
                  ? civName(playing[0].civ)
                  : "Jugador"}
            </div>
          </div>
        </div>
      )}

      {/* Banca: roster − lineup (solo si hay lineup declarado) */}
      {playing.length > 0 && bench.length > 0 && (
        <div className="msb-bench">
          Banca&nbsp;&nbsp;<b>{bench.join(" · ")}</b>
        </div>
      )}
    </>
  );

  if (teamId) {
    return (
      <Link
        href={`/equipos/${teamId}`}
        className={`msb-team ${side} ${isWinner ? "winner" : ""}`}
        style={{ textDecoration: "none" }}
      >
        {inner}
      </Link>
    );
  }
  return <div className={`msb-team ${side} ${isWinner ? "winner" : ""}`}>{inner}</div>;
}
