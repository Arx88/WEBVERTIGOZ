"use client";

import { useMemo } from "react";
import {
  generateBracket,
  type GeneratedBracket,
  type GeneratedMatch,
} from "@/lib/bracket/engine";
import { cn } from "@/lib/utils";

interface BracketViewProps {
  bracketSize?: number;
  matches?: MatchData[];
  className?: string;
}

export interface MatchData {
  roundIndex: number;
  slotIndex: number;
  teamA?: { name: string; emblemUrl?: string; seed?: number };
  teamB?: { name: string; emblemUrl?: string; seed?: number };
  status: "scheduled" | "open" | "drawing" | "lineup" | "comodin_window" | "in_progress" | "finished" | "disputed" | "forfeit" | "cancelled";
  winnerSide?: "A" | "B";
  scoreA?: number;
  scoreB?: number;
  scheduledAt?: string;
}

const STATUS_COLORS: Record<MatchData["status"], string> = {
  scheduled: "border-border-subtle",
  open: "border-accent/40",
  drawing: "border-accent animate-pulse",
  lineup: "border-warning/40",
  comodin_window: "border-warning/40",
  in_progress: "border-danger/60",
  finished: "border-border-strong",
  disputed: "border-danger",
  forfeit: "border-border-subtle opacity-50",
  cancelled: "border-border-subtle opacity-30",
};

const STATUS_LABELS: Record<MatchData["status"], string> = {
  scheduled: "PROGRAMADO",
  open: "ABIERTO",
  drawing: "SORTEANDO",
  lineup: "LINEUP",
  comodin_window: "COMODINES",
  in_progress: "EN JUEGO",
  finished: "FINALIZADO",
  disputed: "DISPUTA",
  forfeit: "W.O.",
  cancelled: "CANCELADO",
};

export default function BracketView({
  bracketSize = 32,
  matches = [],
  className,
}: BracketViewProps) {
  const bracket = useMemo(() => generateBracket(bracketSize), [bracketSize]);

  // Layout: 5 columnas (rounds) lado a lado
  const columnWidth = 220;
  const matchHeight = 60;
  const gap = 16;
  const totalWidth = bracket.rounds.length * (columnWidth + gap) - gap;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div
        className="flex gap-4 min-w-max p-4"
        style={{ minWidth: `${totalWidth}px` }}
      >
        {bracket.rounds.map((round) => (
          <RoundColumn
            key={round.index}
            round={round}
            matches={matches.filter((m) => m.roundIndex === round.index)}
            columnWidth={columnWidth}
            matchHeight={matchHeight}
            bracketSize={bracketSize}
          />
        ))}
      </div>
    </div>
  );
}

function RoundColumn({
  round,
  matches,
  columnWidth,
  matchHeight,
  bracketSize,
}: {
  round: GeneratedBracket["rounds"][number];
  matches: MatchData[];
  columnWidth: number;
  matchHeight: number;
  bracketSize: number;
}) {
  // Espaciado vertical entre matches crece exponencialmente por ronda
  const matchesCount = round.matches.length;
  const totalRounds = Math.log2(bracketSize);
  const verticalSpacing = Math.pow(2, totalRounds - round.index - 1) * matchHeight;

  return (
    <div
      className="flex flex-col"
      style={{ width: `${columnWidth}px` }}
    >
      <div className="label-premium text-gold/80 mb-3 sticky top-0 bg-bg z-10 py-2">
        {round.name}
      </div>

      <div className="flex flex-col justify-around flex-1" style={{ gap: `${verticalSpacing - matchHeight}px` }}>
        {round.matches.map((m) => {
          const matchData = matches.find((md) => md.slotIndex === m.slotIndex);
          return (
            <MatchCard
              key={m.tempId}
              match={m}
              data={matchData}
              width={columnWidth}
              height={matchHeight}
            />
          );
        })}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  data,
  width,
  height,
}: {
  match: GeneratedMatch;
  data?: MatchData;
  width: number;
  height: number;
}) {
  const status = data?.status ?? "scheduled";
  const teamA = data?.teamA;
  const teamB = data?.teamB;
  const winnerA = data?.winnerSide === "A";
  const winnerB = data?.winnerSide === "B";

  return (
    <div
      className={cn(
        "border bg-bg-elevated transition-colors",
        STATUS_COLORS[status]
      )}
      style={{ width: `${width}px`, minHeight: `${height}px` }}
    >
      {/* Status badge */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border-subtle">
        <span className="text-caption text-text-tertiary uppercase tracking-wider">
          {match.seedA ? `#${match.seedA}` : "?"} vs {match.seedB ? `#${match.seedB}` : "?"}
        </span>
        <span className={cn(
          "text-caption",
          status === "drawing" || status === "in_progress" || status === "open"
            ? "text-accent"
            : "text-text-tertiary"
        )}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Team A */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border-subtle">
        <TeamSlot team={teamA} seed={match.seedA} winner={winnerA} />
        <span className={cn(
          "font-mono text-sm tabular-nums",
          winnerA ? "text-gold" : "text-text-tertiary"
        )}>
          {data?.scoreA ?? ""}
        </span>
      </div>

      {/* Team B */}
      <div className="flex items-center justify-between px-2 py-1.5">
        <TeamSlot team={teamB} seed={match.seedB} winner={winnerB} />
        <span className={cn(
          "font-mono text-sm tabular-nums",
          winnerB ? "text-gold" : "text-text-tertiary"
        )}>
          {data?.scoreB ?? ""}
        </span>
      </div>

      {/* Scheduled time */}
      {data?.scheduledAt && status === "scheduled" && (
        <div className="px-2 py-1 border-t border-border-subtle text-caption text-text-tertiary">
          {new Date(data.scheduledAt).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}

function TeamSlot({
  team,
  seed,
  winner,
}: {
  team?: { name: string; emblemUrl?: string; seed?: number };
  seed: number | null;
  winner: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 text-text-tertiary">
        <div className="w-5 h-5 rounded-full border border-border-subtle" />
        <span className="text-sm italic">—</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-5 h-5 rounded-full border border-border-strong flex items-center justify-center shrink-0">
        {team.emblemUrl ? (
          <img src={team.emblemUrl} alt="" className="w-full h-full object-cover rounded-full" />
        ) : (
          <span className="text-caption text-text-tertiary">{team.name.charAt(0)}</span>
        )}
      </div>
      <span className={cn(
        "text-sm truncate",
        winner ? "text-text-primary font-medium" : "text-text-secondary"
      )}>
        {team.name}
      </span>
    </div>
  );
}
