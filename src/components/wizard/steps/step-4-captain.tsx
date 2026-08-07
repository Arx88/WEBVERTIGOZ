"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Star, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WizardStepCaptain() {
  const { data, updatePlayer } = useWizard();

  function setCaptain(slot: 0 | 1 | 2) {
    data.players.forEach((_, idx) => {
      updatePlayer(idx as 0 | 1 | 2, { isCaptain: idx === slot });
    });
  }

  const totalElo = data.players.reduce(
    (sum, p) => sum + (p.maxRatingRm1v1 ?? 0),
    0
  );
  const eloCap = 3500;
  const eloTolerance = 20;
  const eloMax = eloCap + eloTolerance;
  const isWithinCap = totalElo <= eloMax;

  const selectedCaptain = data.players.findIndex((p) => p.isCaptain);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        El capitán será el contacto oficial con el staff del torneo y el
        responsable de confirmar "Listo" en cada llave, declarar el lineup
        antes de cada partida y ejecutar los comodines cuando corresponda.
      </p>

      {/* ELO check */}
      <div className={cn(
        "border p-4 flex items-center justify-between",
        isWithinCap ? "border-success/40 bg-success/5" : "border-danger/40 bg-danger/5"
      )}>
        <div className="flex items-center gap-3">
          {isWithinCap ? (
            <div className="w-8 h-8 rounded-full bg-success/10 border border-success/40 flex items-center justify-center">
              <Star className="w-4 h-4 text-success" strokeWidth={2} />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-danger/10 border border-danger/40 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-danger" strokeWidth={2} />
            </div>
          )}
          <div>
            <div className="label-premium text-text-secondary">VERIFICACIÓN ELO</div>
            <div className={cn("font-serif text-lg", isWithinCap ? "text-success" : "text-danger")}>
              {isWithinCap ? "Dentro del límite" : "Excede el límite"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-serif tabular-nums">
            {totalElo}
          </div>
          <div className="text-caption text-text-tertiary">de {eloMax} máx</div>
        </div>
      </div>

      {/* Selector de capitán */}
      <div className="grid md:grid-cols-3 gap-4">
        {data.players.map((player, idx) => (
          <button
            key={idx}
            onClick={() => setCaptain(idx as 0 | 1 | 2)}
            disabled={player.aoe2ProfileId === null}
            className={cn(
              "border p-5 flex flex-col items-center text-center transition-all min-h-[200px] relative disabled:opacity-40 disabled:cursor-not-allowed",
              player.isCaptain
                ? "border-gold bg-gold/5"
                : "border-border-subtle hover:border-border-strong"
            )}
          >
            {player.isCaptain && (
              <div className="absolute top-3 right-3">
                <Badge variant="gold">
                  <Crown className="w-3 h-3 mr-1" strokeWidth={1.5} />
                  Capitán
                </Badge>
              </div>
            )}

            <div className={cn(
              "w-16 h-16 rounded-full border-2 flex items-center justify-center mb-3",
              player.isCaptain ? "border-gold text-gold" : "border-border-strong text-text-secondary"
            )}>
              {player.isCaptain ? (
                <Crown className="w-8 h-8" strokeWidth={1.25} />
              ) : (
                <span className="font-serif text-2xl text-text-tertiary">{idx + 1}</span>
              )}
            </div>

            <div className="font-medium text-text-primary mb-1">
              {player.displayName}
            </div>
            <div className="flex items-center gap-2 text-caption text-text-tertiary mb-3">
              {player.country && <span>{player.country}</span>}
              {player.clan && <span>· {player.clan}</span>}
            </div>
            {player.maxRatingRm1v1 !== undefined && (
              <div className="text-caption text-text-secondary">
                ELO máx: <span className="font-medium text-gold tabular-nums">{player.maxRatingRm1v1}</span>
              </div>
            )}
            {player.verificationStatus === "hidden" && (
              <Badge variant="warning" size="sm" className="mt-2">
                Falta verificación
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Info box */}
      <div className="border-l-2 border-gold/40 pl-4 py-2">
        <p className="text-caption text-text-secondary leading-relaxed">
          El capitán puede ser cualquiera de los 3 jugadores. Podrás cambiarlo
          antes del inicio del torneo si es necesario, contactando al staff.
        </p>
      </div>

      {selectedCaptain === -1 && (
        <div className="text-center text-text-tertiary text-sm">
          Seleccioná un jugador como capitán para continuar.
        </div>
      )}
    </div>
  );
}
