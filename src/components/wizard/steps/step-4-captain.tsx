"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Crown, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="max-w-3xl mx-auto space-y-6 text-center">
      <p className="wiz-body max-w-xl mx-auto">
        El <strong>capitán</strong> será el contacto oficial con el staff, el
        responsable de confirmar &ldquo;Listo&rdquo; en cada llave, declarar el
        lineup antes de cada partida y ejecutar los comodines cuando corresponda.
      </p>

      {/* ELO check */}
      <div
        className={cn(
          "border px-5 py-4 flex items-center justify-between",
          isWithinCap
            ? "border-[rgba(255,46,158,0.4)] bg-[rgba(255,46,158,0.04)]"
            : "border-[rgba(255,77,109,0.5)] bg-[rgba(255,77,109,0.04)]"
        )}
      >
        <div className="flex items-center gap-3 text-left">
          <div
            className={cn(
              "w-9 h-9 rounded-full border flex items-center justify-center",
              isWithinCap
                ? "border-[rgba(255,46,158,0.5)] text-[#ff2e9e]"
                : "border-[rgba(255,77,109,0.5)] text-[#ff4d6d]"
            )}
          >
            {isWithinCap ? (
              <Check className="w-4 h-4" strokeWidth={2} />
            ) : (
              <AlertCircle className="w-4 h-4" strokeWidth={2} />
            )}
          </div>
          <div>
            <div className="wiz-caption" style={{ letterSpacing: "0.32em" }}>
              Verificación ELO
            </div>
            <div
              className={cn(
                "font-cinzel text-base tracking-[0.04em]",
                isWithinCap ? "text-[#f5eaff]" : "text-[#ff4d6d]"
              )}
            >
              {isWithinCap ? "Dentro del límite" : "Excede el límite"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-cinzel text-2xl tabular-nums text-[#f5eaff]">
            {totalElo}
          </div>
          <div className="wiz-caption text-[9px]" style={{ letterSpacing: "0.18em" }}>
            de {eloMax} máx
          </div>
        </div>
      </div>

      {/* Selector de capitán */}
      <div className="grid grid-cols-3 gap-3">
        {data.players.map((player, idx) => (
          <button
            key={idx}
            onClick={() => setCaptain(idx as 0 | 1 | 2)}
            disabled={player.aoe2ProfileId === null}
            className={cn(
              "relative p-4 flex flex-col items-center text-center transition-all min-h-[180px] disabled:opacity-40 disabled:cursor-not-allowed",
              player.isCaptain
                ? "bg-[rgba(255,46,158,0.06)] border border-[rgba(255,46,158,0.7)] shadow-[0_0_18px_rgba(255,46,158,0.22)]"
                : "bg-[rgba(20,0,31,0.4)] border border-[rgba(255,46,158,0.16)] hover:border-[rgba(255,46,158,0.45)]"
            )}
          >
            {player.isCaptain && (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 border-y border-[rgba(255,46,158,0.5)] bg-[rgba(255,46,158,0.08)]">
                <Crown className="w-2.5 h-2.5 text-[#ff2e9e]" strokeWidth={2} />
                <span className="font-cinzel text-[8px] tracking-[0.18em] uppercase text-[#ff2e9e]">
                  Capitán
                </span>
              </div>
            )}

            <div
              className={cn(
                "w-14 h-14 rounded-full border flex items-center justify-center mb-3",
                player.isCaptain
                  ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_14px_rgba(255,46,158,0.45)]"
                  : "border-[rgba(255,46,158,0.35)] text-[rgba(255,180,220,0.55)]"
              )}
            >
              {player.isCaptain ? (
                <Crown className="w-7 h-7" strokeWidth={1.25} />
              ) : (
                <span className="font-cinzel text-xl text-[rgba(255,180,220,0.55)]">{idx + 1}</span>
              )}
            </div>

            <div className="font-cinzel text-[13px] text-[#f5eaff] mb-1 truncate w-full px-1">
              {player.displayName}
            </div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] font-cinzel text-[rgba(255,180,220,0.55)] mb-2">
              {player.country && <span>{player.country}</span>}
              {player.clan && <span>· {player.clan}</span>}
            </div>
            {player.maxRatingRm1v1 !== undefined && (
              <div className="text-[11px] text-[#e6d3f5]">
                ELO máx:{" "}
                <span className="font-cinzel font-semibold text-[#ff2e9e] tabular-nums">
                  {player.maxRatingRm1v1}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Info box */}
      <div className="wiz-panel border-l-2 border-l-[#ff2e9e] px-4 py-3 text-left inline-block">
        <p className="text-[13px] leading-relaxed text-[#e6d3f5]">
          El capitán puede ser cualquiera de los 3 jugadores. Podrás cambiarlo
          antes del inicio del torneo contactando al staff.
        </p>
      </div>

      {selectedCaptain === -1 && (
        <div className="wiz-caption text-[11px] normal-case" style={{ letterSpacing: "0.04em" }}>
          Seleccioná un jugador como capitán para continuar.
        </div>
      )}
    </div>
  );
}
