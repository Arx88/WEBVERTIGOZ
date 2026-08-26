"use client";

import Link from "next/link";
import { Coins, Users, TrendingUp } from "lucide-react";
import type { BettableLlave } from "./apuestas-data";
import CountdownBadge from "./countdown-badge";

/** Cuota pari-mutuel: multiplicador = pozo / apostado al equipo. */
function cuota(pool: number, stake: number): string {
  if (stake <= 0 || pool <= 0) return "—";
  return `×${(pool / stake).toFixed(2)}`;
}

/**
 * Card de llave apostable con feedback de pozo en vivo:
 * barra de dinero A vs B, % del pozo por bando, countdown al cierre
 * y CTA con pulso. Cliente para que el countdown tickee.
 */
export default function LlaveCard({ llave }: { llave: BettableLlave }) {
  const sides = [
    { team: llave.teamA, stake: llave.stakeA, isPick: llave.myBet?.pickedTeamId === llave.teamA.id },
    { team: llave.teamB, stake: llave.stakeB, isPick: llave.myBet?.pickedTeamId === llave.teamB.id },
  ];

  const pctA = llave.pool > 0 ? Math.round((llave.stakeA / llave.pool) * 100) : 50;
  const pctB = 100 - pctA;
  // La cuota más alta = más ganancia potencial: la destacamos en oro.
  const bestSide =
    llave.stakeA !== llave.stakeB ? (llave.stakeA < llave.stakeB ? "A" : "B") : null;

  return (
    <div
      className="vertigo-card flex flex-col"
      style={{
        borderColor: llave.myBet ? "rgba(34,197,94,0.35)" : "var(--vertigo-line)",
        boxShadow: llave.myBet ? "0 0 24px rgba(34,197,94,0.08)" : undefined,
      }}
    >
      {/* Header */}
      <div className="vertigo-card-header">
        <div className="vertigo-card-title">{llave.roundName ?? "Llave"}</div>
        <div className="flex items-center gap-2">
          {llave.format && <span className="vertigo-badge vertigo-badge-purple">{llave.format}</span>}
          {llave.myBet ? (
            <span className="vertigo-badge vertigo-badge-success">✓ Apostaste</span>
          ) : (
            <span className="vertigo-badge flex items-center gap-1.5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.5)", color: "var(--vertigo-purple-pale)" }}>
              <span className="apu-live-dot" />
              ABIERTA
            </span>
          )}
        </div>
      </div>

      {/* Equipos + cuotas grandes */}
      <div className="flex flex-col gap-2 mb-3">
        {sides.map(({ team, stake, isPick }, i) => {
          const side = i === 0 ? "A" : "B";
          const share = llave.pool > 0 ? Math.round((stake / llave.pool) * 100) : null;
          const isBest = bestSide === side;
          return (
            <div
              key={team.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
              style={{
                border: isPick ? "1px solid rgba(34,197,94,0.55)" : "1px solid var(--vertigo-line-soft)",
                background: isPick ? "rgba(34,197,94,0.08)" : "rgba(19,15,27,0.5)",
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-semibold text-[var(--vertigo-text)] truncate">{team.name}</span>
                  {team.seed != null && (
                    <span className="text-[10px] text-[var(--vertigo-faint)] flex-none">#{team.seed}</span>
                  )}
                  {isPick && (
                    <span className="text-[9px] uppercase tracking-widest text-[var(--vertigo-success)] flex-none">tu pick</span>
                  )}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--vertigo-faint)" }}>
                  {share != null ? `${share}% del pozo apuesta acá` : "sin apuestas todavía"}
                </div>
              </div>
              <div className="flex flex-col items-end flex-none">
                <span
                  className="font-cinzel font-bold text-[20px] leading-none"
                  style={{ color: isBest && !isPick ? "var(--vertigo-gold)" : isPick ? "var(--vertigo-success)" : "var(--vertigo-purple-pale)", textShadow: isBest ? "0 0 14px rgba(212,175,55,0.35)" : undefined }}
                >
                  {cuota(llave.pool, stake)}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-[var(--vertigo-faint)] mt-1">
                  {stake > 0 ? `${stake.toLocaleString("es-AR")} pts` : "cuota base"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de dinero A vs B — dónde está poniendo la plata la gente */}
      <div className="mb-4">
        <div
          className="flex h-[7px] rounded-full overflow-hidden"
          style={{ background: "var(--vertigo-line-soft)" }}
        >
          <div
            className="apu-bar-fill h-full"
            style={{
              width: `${llave.pool > 0 ? pctA : 50}%`,
              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
            }}
          />
          <div
            className="apu-bar-fill h-full"
            style={{
              width: `${llave.pool > 0 ? pctB : 50}%`,
              background: "linear-gradient(90deg, #D4AF37, #f0d878)",
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px]">
          <span style={{ color: "var(--vertigo-purple-soft)" }}>{llave.pool > 0 ? `${pctA}% va a ${llave.teamA.name}` : "El primer apuesta define la cuota"}</span>
          <span style={{ color: "var(--vertigo-gold)" }}>{llave.pool > 0 ? `${pctB}% a ${llave.teamB.name}` : ""}</span>
        </div>
      </div>

      {/* Pozo + apostadores */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div
          className="rounded-lg px-3 py-2"
          style={{ border: "1px solid rgba(212,175,55,0.3)", background: "rgba(212,175,55,0.06)" }}
        >
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-[var(--vertigo-gold)]">
            <Coins style={{ width: 10, height: 10 }} />
            Pozo
          </div>
          <div className="font-cinzel font-bold text-[16px] text-[var(--vertigo-text)] mt-0.5">
            {llave.pool.toLocaleString("es-AR")}
            <span className="text-[10px] ml-1 text-[var(--vertigo-muted)]">pts</span>
          </div>
        </div>
        <div
          className="rounded-lg px-3 py-2"
          style={{ border: "1px solid var(--vertigo-line-soft)", background: "rgba(19,15,27,0.5)" }}
        >
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">
            <Users style={{ width: 10, height: 10 }} />
            Apostadores
          </div>
          <div className="font-cinzel font-bold text-[16px] text-[var(--vertigo-text)] mt-0.5">
            {llave.bettors}
            {llave.bettors > 0 && (
              <span className="text-[10px] ml-1 text-[var(--vertigo-muted)]">ya juegan</span>
            )}
          </div>
        </div>
      </div>

      {/* Cierre + CTA */}
      <div className="mt-auto">
        {llave.scheduledAtStart && (
          <div className="mb-3">
            <CountdownBadge target={llave.scheduledAtStart} />
          </div>
        )}
        <Link
          href={`/partido/${llave.matchId}`}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-lg font-cinzel font-semibold uppercase tracking-[2px] ${llave.myBet ? "vertigo-btn vertigo-btn-primary" : "apu-cta"}`}
          style={{ padding: "11px 18px", fontSize: "12px", textDecoration: "none", border: "none" }}
        >
          {llave.myBet ? (
            <>Ver mi apuesta</>
          ) : (
            <>
              <TrendingUp style={{ width: 14, height: 14 }} />
              Apostar ahora
            </>
          )}
        </Link>
      </div>
    </div>
  );
}
