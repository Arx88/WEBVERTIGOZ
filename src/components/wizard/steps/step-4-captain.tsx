"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Crown, AlertCircle, Check, Info, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Step 4 — Elegir capitán
// Layout: 3 cards en row centradas + ELO check bar arriba
// ============================================================

export default function WizardStepCaptain() {
  const { data, updatePlayer } = useWizard();

  function setCaptain(slot: 0 | 1 | 2) {
    data.players.forEach((_, idx) => {
      updatePlayer(idx as 0 | 1 | 2, { isCaptain: idx === slot });
    });
  }

  const totalElo = data.players.reduce((sum, p) => sum + (p.maxRatingRm1v1 ?? 0), 0);
  const eloCap = 3500;
  const eloTolerance = 20;
  const eloMax = eloCap + eloTolerance;
  const isWithinCap = totalElo <= eloMax;

  const selectedCaptain = data.players.findIndex((p) => p.isCaptain);

  return (
    <div className="flex flex-col gap-5">
      {/* ====== ELO bar ====== */}
      <div
        className={cn(
          "wiz-card !rounded-[4px] px-5 py-4 flex items-center justify-between",
          isWithinCap ? "wiz-card-active" : "!border-[rgba(255,77,109,0.5)]"
        )}
        style={!isWithinCap ? { background: "rgba(255,77,109,0.04)" } : undefined}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center",
              isWithinCap
                ? "border-[rgba(255,46,158,0.5)] text-[#ff2e9e]"
                : "border-[rgba(255,77,109,0.5)] text-[#ff4d6d]"
            )}
          >
            {isWithinCap ? (
              <Check className="w-5 h-5" strokeWidth={2} />
            ) : (
              <AlertCircle className="w-5 h-5" strokeWidth={2} />
            )}
          </div>
          <div>
            <div className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              Verificación ELO
            </div>
            <div
              className={cn(
                "font-cinzel text-[15px] tracking-[0.04em] mt-0.5",
                isWithinCap ? "text-[#f5eaff]" : "text-[#ff4d6d]"
              )}
            >
              {isWithinCap ? "Dentro del límite" : "Excede el límite"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "font-cinzel text-[28px] tabular-nums leading-none",
              isWithinCap ? "text-[#f5eaff]" : "text-[#ff4d6d]"
            )}
          >
            {totalElo}
          </div>
          <div className="wiz-caption text-[9px] mt-1" style={{ letterSpacing: "0.18em" }}>
            de {eloMax} máx
          </div>
        </div>
      </div>

      {/* ====== Captain cards (3 cols) ====== */}
      <div className="grid grid-cols-3 gap-4">
        {data.players.map((player, idx) => (
          <button
            key={idx}
            onClick={() => setCaptain(idx as 0 | 1 | 2)}
            disabled={player.aoe2ProfileId === null}
            className={cn(
              "relative p-5 flex flex-col items-center text-center transition-all min-h-[220px] !rounded-[4px] disabled:opacity-40 disabled:cursor-not-allowed group",
              player.isCaptain
                ? "wiz-card-active"
                : "wiz-card hover:!border-[rgba(255,46,158,0.45)]"
            )}
          >
            {/* Captain badge */}
            {player.isCaptain && (
              <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 border-y border-[rgba(255,46,158,0.5)] bg-[rgba(255,46,158,0.08)] rounded-[2px]">
                <Crown className="w-2.5 h-2.5 text-[#ff2e9e]" strokeWidth={2} />
                <span className="font-cinzel text-[8px] tracking-[0.18em] uppercase text-[#ff2e9e]">
                  Capitán
                </span>
              </div>
            )}

            {/* Slot number top-left */}
            <span className="absolute top-3 left-3 font-cinzel text-[10px] tabular-nums tracking-[0.18em] text-[rgba(255,180,220,0.35)]">
              {String(idx + 1).padStart(2, "0")}
            </span>

            {/* Avatar */}
            <div
              className={cn(
                "w-16 h-16 rounded-full border flex items-center justify-center mb-4 mt-3 transition-all",
                player.isCaptain
                  ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_18px_rgba(255,46,158,0.5)]"
                  : "border-[rgba(255,46,158,0.35)] text-[rgba(255,180,220,0.55)] group-hover:border-[rgba(255,46,158,0.55)]"
              )}
            >
              {player.isCaptain ? (
                <Crown className="w-8 h-8" strokeWidth={1.25} />
              ) : (
                <span className="font-cinzel text-[22px] text-[rgba(255,180,220,0.55)]">{idx + 1}</span>
              )}
            </div>

            {/* Name */}
            <div className="font-cinzel text-[14px] text-[#f5eaff] mb-1 truncate w-full px-1">
              {player.displayName}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-cinzel text-[rgba(255,180,220,0.55)] mb-2">
              {player.country && (
                <span className="flex items-center gap-1">
                  <Flag className="w-2.5 h-2.5" strokeWidth={1.5} />
                  {player.country}
                </span>
              )}
              {player.clan && <span>· {player.clan}</span>}
            </div>

            {player.maxRatingRm1v1 !== undefined && (
              <div className="mt-1 flex items-baseline gap-1">
                <span className="font-cinzel text-[18px] tabular-nums text-[#ff2e9e]">
                  {player.maxRatingRm1v1}
                </span>
                <span className="font-inter text-[9px] tracking-[0.18em] uppercase text-[rgba(255,180,220,0.45)]">
                  ELO máx
                </span>
              </div>
            )}

            {/* Hover hint */}
            {!player.isCaptain && player.aoe2ProfileId !== null && (
              <span className="mt-3 font-cinzel text-[9px] tracking-[0.18em] uppercase text-[rgba(255,180,220,0.35)] opacity-0 group-hover:opacity-100 transition-opacity">
                Click para elegir
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ====== Info bar ====== */}
      <div className="grid sm:grid-cols-2 gap-3 max-w-3xl mx-auto w-full">
        <div className="wiz-panel-sunken border-l-2 !border-l-[#ff2e9e] px-4 py-3 rounded-[4px] flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-[#ff2e9e] mt-0.5 shrink-0" strokeWidth={1.5} />
          <p className="wiz-body text-[12px]">
            El capitán será el <span className="text-[#ff2e9e] font-semibold">contacto oficial</span> con el staff y responsable de declarar el lineup antes de cada partida.
          </p>
        </div>
        {selectedCaptain === -1 ? (
          <div className="wiz-panel-sunken px-4 py-3 rounded-[4px] flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)] shrink-0" strokeWidth={1.5} />
            <p className="wiz-meta text-[11px] normal-case">
              Seleccioná un jugador como capitán para continuar.
            </p>
          </div>
        ) : (
          <div className="wiz-panel-active px-4 py-3 rounded-[4px] flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[#ff2e9e] shrink-0" strokeWidth={2} />
            <p className="wiz-meta text-[11px] normal-case">
              Capitán elegido: <span className="text-[#ff2e9e] font-cinzel tracking-[0.04em]">{data.players[selectedCaptain].displayName}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
