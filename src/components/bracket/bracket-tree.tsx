"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Crown, Trophy, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/format";
import LocalTime from "@/components/shared/local-time";

export interface BracketTeamInfo {
  id: string;
  name: string;
  seed: number | null;
  emblemUrl: string | null;
}

export interface BracketMatchInfo {
  id: string | null;
  roundIndex: number;
  slotIndex: number;
  seedA: number | null;
  seedB: number | null;
  status: string;
  scheduledAtStart: string | null;
  teamA: BracketTeamInfo | null;
  teamB: BracketTeamInfo | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
}

interface Props {
  rounds: {
    index: number;
    name: string;
    matches: { tempId: string; slotIndex: number; seedA: number | null; seedB: number | null }[];
  }[];
  matches: BracketMatchInfo[];
  hrefPrefix?: string;
  championName?: string | null;
}

const CARD_W = 210;
const CARD_H = 100;
const V_GAP = 18;
const GUTTER = 28;
const CELL0 = CARD_H + V_GAP;

const STATUS_META: Record<string, { label: string; cls: string; edge: string; live: boolean }> = {
  scheduled: { label: "Programado", cls: "vertigo-badge-purple", edge: "var(--vertigo-line)", live: false },
  open: { label: "Abierto", cls: "vertigo-badge-success", edge: "var(--vertigo-success)", live: true },
  drawing: { label: "Sorteando", cls: "vertigo-badge-warning", edge: "var(--vertigo-warning)", live: true },
  lineup: { label: "Lineup", cls: "vertigo-badge-warning", edge: "var(--vertigo-warning)", live: true },
  comodin_window: { label: "Comodines", cls: "vertigo-badge-warning", edge: "var(--vertigo-warning)", live: true },
  in_progress: { label: "En juego", cls: "vertigo-badge-success", edge: "var(--vertigo-success)", live: true },
  finished: { label: "Finalizado", cls: "vertigo-badge-purple", edge: "var(--vertigo-purple)", live: false },
  disputed: { label: "Disputa", cls: "vertigo-badge-danger", edge: "var(--vertigo-danger)", live: true },
  forfeit: { label: "W.O.", cls: "vertigo-badge-danger", edge: "var(--vertigo-danger)", live: false },
  cancelled: { label: "Cancelado", cls: "vertigo-badge-danger", edge: "var(--vertigo-line)", live: false },
};

export default function BracketTree({ rounds, matches, hrefPrefix = "/partido", championName }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeRound, setActiveRound] = useState(0);

  const matchBySlot = useMemo(() => {
    const map = new Map<string, BracketMatchInfo>();
    for (const m of matches) map.set(`${m.roundIndex}:${m.slotIndex}`, m);
    return map;
  }, [matches]);

  const totalH = rounds[0] ? rounds[0].matches.length * CELL0 - V_GAP : 0;
  const natW = (rounds.length + 1) * (CARD_W + GUTTER) + 24;
  const [natH, setNatH] = useState(44 + 6 + totalH + V_GAP + 26);

  // El árbol escala para entrar en el ancho disponible: en desktop no hay
  // scroll horizontal. Debajo del 55% se clava el piso y el scroll vuelve.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = scrollRef.current;
    const tree = treeRef.current;
    if (!el || !tree) return;
    const fit = () => {
      const raw = (el.clientWidth - 36) / natW;
      setScale(raw >= 1 ? 1 : Math.max(raw, 0.55));
    };
    const measure = () => setNatH(tree.offsetHeight);
    fit();
    measure();
    const ro = new ResizeObserver(() => {
      fit();
      measure();
    });
    ro.observe(el);
    ro.observe(tree);
    return () => ro.disconnect();
  }, [natW]);

  // Rueda vertical → paneo horizontal, solo cuando queda overflow (piso 55%)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function jumpToRound(idx: number) {
    setActiveRound(idx);
    const col = columnRefs.current[idx];
    if (col && scrollRef.current) {
      scrollRef.current.scrollTo({ left: Math.max(0, col.offsetLeft * scale - 16), behavior: "smooth" });
    }
  }

  function jumpToChampion() {
    setActiveRound(rounds.length);
    scrollRef.current?.scrollTo({
      left: Math.max(0, scrollRef.current.scrollWidth - scrollRef.current.clientWidth),
      behavior: "smooth",
    });
  }

  return (
    <div className="brk-outer">
      <div className="brk-roundnav">
        {rounds.map((r, i) => (
          <button
            key={r.index}
            type="button"
            className={cn("brk-roundnav-chip", activeRound === i && "is-active")}
            onClick={() => jumpToRound(i)}
          >
            {r.name}
          </button>
        ))}
        <button
          type="button"
          className={cn("brk-roundnav-chip", activeRound === rounds.length && "is-active")}
          onClick={jumpToChampion}
        >
          <Trophy style={{ width: 10, height: 10 }} />
          Campeón
        </button>
      </div>

      <div ref={scrollRef} className="brk-scroll">
        {/* wrapper a tamaño escalado: su caja define el scroll real del contenedor */}
        <div style={{ width: natW * scale, height: natH * scale }}>
          <div
            ref={treeRef}
            className="brk-tree"
            style={{ minWidth: natW - 24, transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
          {rounds.map((round) => (
            <div
              key={round.index}
              ref={(el) => {
                columnRefs.current[round.index] = el;
              }}
              className="brk-col"
              style={{ width: CARD_W + GUTTER }}
            >
              <div className="brk-colhead" style={{ height: 44 }}>
                {round.index === rounds.length - 1 ? (
                  <Trophy style={{ width: 11, height: 11, color: "var(--vertigo-gold)", marginLeft: 20, flex: "none" }} />
                ) : (
                  <Swords style={{ width: 11, height: 11, color: "var(--vertigo-purple-soft)", marginLeft: 20, flex: "none" }} />
                )}
                <span
                  className={cn("brk-colhead-name", round.index === rounds.length - 1 && "brk-colhead-gold")}
                  style={{ paddingLeft: 0 }}
                >
                  {round.name}
                </span>
                <span className="brk-colhead-count">{round.matches.length}</span>
              </div>

              <div style={{ position: "relative", height: totalH + V_GAP }}>
                {round.matches.map((slot) => {
                  const cellH = CELL0 * Math.pow(2, round.index);
                  const m = matchBySlot.get(`${round.index}:${slot.slotIndex}`);
                  const isLastRound = round.index === rounds.length - 1;
                  return (
                    <div
                      key={slot.tempId}
                      className="brk-cell"
                      style={{ height: cellH, paddingLeft: GUTTER / 2 }}
                    >
                      {/* Conector entrante: codos desde las 2 llaves de la ronda anterior.
                          Se encienden en dorado cuando esa llave previa ya tiene ganador:
                          el bracket se ilumina a medida que avanza el torneo. */}
                      {round.index > 0 && (() => {
                        const prevA = matchBySlot.get(`${round.index - 1}:${slot.slotIndex * 2}`);
                        const prevB = matchBySlot.get(`${round.index - 1}:${slot.slotIndex * 2 + 1}`);
                        const aLit = !!prevA?.winnerTeamId;
                        const bLit = !!prevB?.winnerTeamId;
                        const spineLit = aLit && bLit;
                        return (
                          <>
                            <i aria-hidden className={cn("brk-conn", aLit && "brk-conn-lit")} style={{ left: -GUTTER / 2, top: "25%", width: GUTTER / 2 }} />
                            <i aria-hidden className={cn("brk-conn", bLit && "brk-conn-lit")} style={{ left: -GUTTER / 2, top: "75%", width: GUTTER / 2 }} />
                            <i
                              aria-hidden
                              className={cn("brk-conn", "brk-conn-v", spineLit && "brk-conn-lit")}
                              style={{ left: 0, top: "25%", height: "50%" }}
                            />
                            <i aria-hidden className={cn("brk-conn", spineLit && "brk-conn-lit")} style={{ left: 0, top: "50%", width: GUTTER / 2 }} />
                          </>
                        );
                      })()}

                      {/* Conector saliente: solo en la última ronda → hacia la columna del campeón */}
                      {isLastRound && (
                        <i
                          aria-hidden
                          className="brk-conn brk-conn-gold"
                          style={{ left: CARD_W + GUTTER / 2, top: "50%", width: GUTTER + 12 }}
                        />
                      )}

                      <BracketCard
                        m={m ?? null}
                        slotSeeds={{ a: slot.seedA, b: slot.seedB }}
                        href={m?.id ? `${hrefPrefix}/${m.id}` : null}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div
            ref={(el) => {
              columnRefs.current[rounds.length] = el;
            }}
            className="brk-col"
            style={{ width: CARD_W + 24 }}
          >
            <div className="brk-colhead" style={{ height: 44 }}>
              <span className="brk-colhead-name brk-colhead-gold">Campeón</span>
            </div>
            <div
              style={{
                position: "relative",
                height: totalH + V_GAP,
                display: "flex",
                alignItems: "center",
              }}
            >
              <ChampionPedestal name={championName ?? null} />
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChampionPedestal({ name }: { name: string | null }) {
  return (
    <div className="brk-champion">
      <div className={cn("brk-champion-ring", name && "is-crowned")}>
        <Trophy style={{ width: 30, height: 30 }} strokeWidth={1.4} />
      </div>
      <div className="brk-champion-title">Campeón</div>
      <div className={cn("brk-champion-name", !name && "is-empty")}>
        {name ?? "Por definir"}
      </div>
      <div className="brk-champion-glow" aria-hidden />
    </div>
  );
}

function BracketCard({
  m,
  slotSeeds,
  href,
}: {
  m: BracketMatchInfo | null;
  slotSeeds: { a: number | null; b: number | null };
  href: string | null;
}) {
  if (!m) {
    return (
      <div className="brk-card brk-empty" style={{ width: CARD_W, height: CARD_H }}>
        <div className="brk-empty-row">
          <SeedChip seed={slotSeeds.a} />
          <span>Por definir</span>
        </div>
        <div className="brk-empty-row">
          <SeedChip seed={slotSeeds.b} />
          <span>Por definir</span>
        </div>
      </div>
    );
  }

  const meta = STATUS_META[m.status] ?? STATUS_META.scheduled;
  const aWin = !!m.winnerTeamId && !!m.teamA && m.winnerTeamId === m.teamA.id;
  const bWin = !!m.winnerTeamId && !!m.teamB && m.winnerTeamId === m.teamB.id;

  const title = m.scheduledAtStart ? `Programado: ${fmt.dayLongMonTime(m.scheduledAtStart)}` : undefined;

  const card = (
    <div
      className={cn("brk-card", meta.live && "brk-live", (aWin || bWin) && "brk-finished")}
      style={{ width: CARD_W, height: CARD_H, borderLeftColor: meta.edge }}
      title={title}
    >
      <div className="brk-card-head">
        <span className="brk-card-slot">
          Llave {m.slotIndex + 1}
          {m.scheduledAtStart && (
            <span className="brk-card-fecha">
              {" · "}
              <LocalTime value={m.scheduledAtStart} variant="dayMon" />
              {" · "}
              <LocalTime value={m.scheduledAtStart} variant="time" />
            </span>
          )}
        </span>
        <span className={cn("vertigo-badge", meta.cls, "brk-status")}>
          {meta.live && <span className="brk-pulse" />}
          {meta.label}
        </span>
      </div>

      <TeamRow team={m.teamA} seed={m.teamA?.seed ?? slotSeeds.a} score={m.scoreA} isWinner={aWin} isLoser={bWin} />
      <div className="brk-vsline">
        <i />
        <span>VS</span>
        <i />
      </div>
      <TeamRow team={m.teamB} seed={m.teamB?.seed ?? slotSeeds.b} score={m.scoreB} isWinner={bWin} isLoser={aWin} />
    </div>
  );

  if (!href) {
    return <div style={{ width: CARD_W }}>{card}</div>;
  }
  return (
    <Link href={href} className="brk-link" style={{ width: CARD_W }}>
      {card}
    </Link>
  );
}

function TeamRow({
  team,
  seed,
  score,
  isWinner,
  isLoser,
}: {
  team: BracketTeamInfo | null;
  seed: number | null;
  score: number;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div className={cn("brk-team", isWinner && "is-winner", isLoser && "is-loser")}>
      <div className="brk-team-info">
        {team?.emblemUrl ? (
          <span className={cn("brk-emblem", isWinner && "is-winner")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={team.emblemUrl} alt="" />
          </span>
        ) : (
          <span className={cn("brk-emblem brk-emblem-ghost", isWinner && "is-winner")}>
            <Trophy style={{ width: 10, height: 10 }} strokeWidth={1.5} />
          </span>
        )}
        <span className="brk-team-name">{team?.name ?? "Por definir"}</span>
        {isWinner && <Crown className="brk-crown" style={{ width: 11, height: 11 }} />}
      </div>
      <div className="brk-team-right">
        {seed != null && <SeedChip seed={seed} />}
        {team && <span className="brk-score">{score}</span>}
      </div>
    </div>
  );
}

function SeedChip({ seed }: { seed: number | null }) {
  if (seed == null) return null;
  return <span className="brk-seed">#{seed}</span>;
}
