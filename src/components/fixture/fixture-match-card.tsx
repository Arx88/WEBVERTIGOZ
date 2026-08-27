"use client";

import Link from "next/link";
import { Clock, ChevronRight, Trophy } from "lucide-react";
import { useRef, useState } from "react";
import { fmt } from "@/lib/format";
import {
  STATUS_BADGE,
  STATUS_RAIL,
  LIVE_STATUSES,
  diaRelativo,
  type FixtureMatch,
} from "./fixture-shared";

const HOVER_VIDEO_SRC = "/landing/jornada-hover.mp4";
const HOVER_VIDEO_POSTER = "/landing/jornada-hover.jpg";

// ─────────────────────────────────────────────────────────────
// Tarjeta de llave del fixture — mini boleta con riel de estado.
// hoverVideo: las llaves "Sin jornada" revelan un video de fondo
// al pasar el mouse (solo esa caja, play/pausa con el hover).
// epic: treatment dorado + entrada animada dentro de la próxima jornada.
// ─────────────────────────────────────────────────────────────

export function FixtureMatchCard({
  m,
  epic = false,
  hoverVideo = false,
  index = 0,
}: {
  m: FixtureMatch;
  epic?: boolean;
  hoverVideo?: boolean;
  index?: number;
}) {
  const meta = STATUS_BADGE[m.status] ?? STATUS_BADGE.scheduled;
  const rail = STATUS_RAIL[m.status] ?? STATUS_RAIL.scheduled;
  const live = LIVE_STATUSES.includes(m.status);
  const decidido = m.status === "finished" || m.status === "disputed" || m.status === "forfeit";
  const showScore = decidido || m.scoreA > 0 || m.scoreB > 0;
  const diaChip = diaRelativo(m.scheduledAtStart);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hover, setHover] = useState(false);

  const onEnter = () => {
    if (!hoverVideo) return;
    setHover(true);
    videoRef.current?.play().catch(() => {});
  };
  const onLeave = () => {
    if (!hoverVideo) return;
    setHover(false);
    const v = videoRef.current;
    if (v) {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        /* noop */
      }
    }
  };

  return (
    <Link
      href={`/partido/${m.id}`}
      onMouseEnter={hoverVideo ? onEnter : undefined}
      onMouseLeave={hoverVideo ? onLeave : undefined}
      className={`fx-card relative group flex flex-col rounded-xl overflow-hidden transition-all hover:-translate-y-0.5${
        epic ? " fxt-card-epic fxt-rise" : ""
      }`}
      style={{
        textDecoration: "none",
        background: epic
          ? "linear-gradient(180deg, rgba(30,22,46,0.8), rgba(13,9,19,0.94))"
          : "linear-gradient(180deg, rgba(22,17,32,0.72), rgba(13,9,19,0.92))",
        border: epic ? "1px solid rgba(212,175,55,0.3)" : "1px solid var(--vertigo-line-soft)",
        animationDelay: epic ? `${Math.min(index, 8) * 90}ms` : undefined,
      }}
    >
      {/* Video de fondo al hover (solo llaves "Sin jornada") */}
      {hoverVideo && (
        <>
          <video
            ref={videoRef}
            className={`fxt-video-bg${hover ? " on" : ""}`}
            muted
            loop
            playsInline
            preload="metadata"
            poster={HOVER_VIDEO_POSTER}
            aria-hidden
          >
            <source src={HOVER_VIDEO_SRC} type="video/mp4" />
          </video>
          <span className={`fxt-video-shade${hover ? " on" : ""}`} aria-hidden />
        </>
      )}

      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: rail }} aria-hidden />

      <div style={{ padding: "14px 16px 13px 19px", position: "relative", zIndex: 2 }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[9.5px] tracking-[1.5px] uppercase truncate" style={{ color: "var(--vertigo-faint)" }}>
            {m.roundName ?? "Llave"}
            {m.format && <span style={{ color: "var(--vertigo-purple-soft)" }}> · {m.format}</span>}
          </span>
          <span className={`vertigo-badge ${meta.cls}`} style={{ fontSize: 9, padding: "3px 8px", flex: "none" }}>
            {live && <span className="brk-pulse" />}
            {meta.label}
          </span>
        </div>

        <VersusTeams m={m} showScore={showScore} />

        <div
          className="flex items-center gap-2 mt-3 pt-3 text-[11px]"
          style={{ borderTop: "1px solid var(--vertigo-line-soft)", color: "var(--vertigo-faint)" }}
        >
          {m.scheduledAtStart ? (
            <>
              <Clock style={{ width: 11, height: 11, flex: "none" }} />
              {diaChip && (
                <span
                  className="flex-none"
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    letterSpacing: 1.5,
                    color: "#0b0713",
                    background: "linear-gradient(90deg, #D4AF37, #f0d878)",
                    borderRadius: 999,
                    padding: "2px 7px",
                  }}
                >
                  {diaChip}
                </span>
              )}
              <span className="truncate">
                {fmt.dayMonTime(m.scheduledAtStart)}
                {m.scheduledAtEnd && ` — ${fmt.time(m.scheduledAtEnd)}`}
              </span>
            </>
          ) : (
            <span className="truncate">Fecha por confirmar</span>
          )}
          <ChevronRight
            className="ml-auto transition-transform group-hover:translate-x-0.5"
            style={{ width: 13, height: 13, color: "var(--vertigo-purple-soft)", flex: "none" }}
          />
        </div>
      </div>
    </Link>
  );
}

export function FixtureTeamRow({
  name,
  seed,
  emblemUrl,
  score,
  isWinner,
  isLoser,
}: {
  name: string;
  seed: number | null;
  emblemUrl: string | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Escudo con aro: dorado si ganó */}
        <span
          className="flex-none rounded-full overflow-hidden flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            border: isWinner ? "1.5px solid rgba(212,175,55,0.7)" : "1px solid var(--vertigo-line)",
            boxShadow: isWinner ? "0 0 12px rgba(212,175,55,0.25)" : "none",
            background: "var(--vertigo-input-bg, #0e0a14)",
          }}
        >
          {emblemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emblemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Trophy style={{ width: 14, height: 14, color: "var(--vertigo-faint)" }} strokeWidth={1.4} />
          )}
        </span>
        <div className="min-w-0">
          <div
            className="text-[13.5px] truncate leading-tight"
            style={{
              fontWeight: isWinner ? 700 : 500,
              color: isWinner ? "var(--vertigo-gold)" : isLoser ? "var(--vertigo-faint)" : "var(--vertigo-text)",
            }}
          >
            {name}
          </div>
          {seed != null && (
            <div className="text-[9px] font-bold uppercase mt-0.5" style={{ letterSpacing: 1.5, color: "var(--vertigo-faint)" }}>
              Seed #{seed}
            </div>
          )}
        </div>
      </div>
      {score != null && (
        <span
          className="font-cinzel font-bold tabular-nums flex-none"
          style={{ fontSize: 18, color: isWinner ? "var(--vertigo-gold)" : "var(--vertigo-faint)" }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cara a cara compartido: dos filas de equipo con sello VS al medio
// ─────────────────────────────────────────────────────────────

export function VersusTeams({ m, showScore }: { m: FixtureMatch; showScore: boolean }) {
  const aWin = !!m.winnerTeamId && !!m.teamA && m.winnerTeamId === m.teamA.id;
  const bWin = !!m.winnerTeamId && !!m.teamB && m.winnerTeamId === m.teamB.id;

  return (
    <div className="flex flex-col gap-1.5">
      <FixtureTeamRow
        name={m.teamA?.name ?? "Por definir"}
        seed={m.teamA?.seed ?? null}
        emblemUrl={m.teamA?.emblemUrl ?? null}
        score={showScore ? m.scoreA : null}
        isWinner={aWin}
        isLoser={bWin}
      />
      {/* Sello VS sobre hairline — marca el cruce sin agregar ruido */}
      <div className="flex items-center gap-2.5" aria-hidden>
        <span className="flex-1 h-px" style={{ background: "var(--vertigo-line-soft)" }} />
        <span className="font-cinzel font-bold" style={{ fontSize: 8, letterSpacing: 3, color: "rgba(212,175,55,0.65)" }}>
          VS
        </span>
        <span className="flex-1 h-px" style={{ background: "var(--vertigo-line-soft)" }} />
      </div>
      <FixtureTeamRow
        name={m.teamB?.name ?? "Por definir"}
        seed={m.teamB?.seed ?? null}
        emblemUrl={m.teamB?.emblemUrl ?? null}
        score={showScore ? m.scoreB : null}
        isWinner={bWin}
        isLoser={aWin}
      />
    </div>
  );
}
