"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { Shield, Crown, Star, FileText, Check, Swords } from "lucide-react";

export default function WizardStepConfirm() {
  const { data } = useWizard();

  const totalElo = data.players.reduce(
    (sum, p) => sum + (p.maxRatingRm1v1 ?? 0),
    0
  );
  const captain = data.players.find((p) => p.isCaptain);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        Revisá todos los datos antes de confirmar. Una vez enviada la inscripción,
        el staff del torneo la revisará y aprobará. Algunos campos podrán
        modificarse más adelante, pero las civilizaciones elegidas y la cuenta
        de equipo son definitivas para esta edición.
      </p>

      {/* Equipo */}
      <section className="border border-border-subtle bg-bg-elevated p-6">
        <div className="label-premium text-gold/80 mb-4">EQUIPO</div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-gold/60 flex items-center justify-center text-gold">
            <Shield className="w-8 h-8" strokeWidth={1.25} />
          </div>
          <div className="flex-1">
            <div className="font-serif text-2xl">{data.teamName}</div>
            {data.teamTagline && (
              <div className="text-text-secondary text-sm italic mt-1">"{data.teamTagline}"</div>
            )}
          </div>
        </div>
      </section>

      {/* Jugadores */}
      <section className="border border-border-subtle bg-bg-elevated p-6">
        <div className="label-premium text-gold/80 mb-4">JUGADORES</div>
        <div className="grid md:grid-cols-3 gap-4">
          {data.players.map((player, idx) => (
            <div key={idx} className="text-center">
              <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center mx-auto mb-2 border-border-strong text-text-secondary">
                {player.isCaptain ? (
                  <Crown className="w-6 h-6 text-gold" strokeWidth={1.25} />
                ) : (
                  <span className="font-serif text-lg">{idx + 1}</span>
                )}
              </div>
              <div className="font-medium text-sm">{player.displayName}</div>
              <div className="text-caption text-text-tertiary mt-1">
                {player.country} · {player.clan ?? "—"}
              </div>
              {player.maxRatingRm1v1 !== undefined && (
                <div className="text-caption text-text-secondary mt-1">
                  ELO máx: <span className="text-gold tabular-nums">{player.maxRatingRm1v1}</span>
                </div>
              )}
              {player.isCaptain && (
                <Badge variant="gold" size="sm" className="mt-2">
                  <Crown className="w-2.5 h-2.5 mr-1" strokeWidth={1.5} />
                  Capitán
                </Badge>
              )}
            </div>
          ))}
        </div>

        <Divider size="sm" />

        <div className="flex items-center justify-between">
          <span className="label-premium text-text-secondary">ELO TOTAL</span>
          <span className="font-serif text-2xl tabular-nums">
            {totalElo} <span className="text-text-tertiary text-base">/ 3520</span>
          </span>
        </div>
      </section>

      {/* Civs */}
      <section className="border border-border-subtle bg-bg-elevated p-6">
        <div className="label-premium text-gold/80 mb-4">CIVILIZACIONES</div>
        <div className="mb-4">
          <div className="text-caption text-text-tertiary mb-2 uppercase tracking-wider">
            9 civs base
          </div>
          <div className="flex flex-wrap gap-2">
            {data.baseCivIds.map((civId, idx) => (
              <Badge key={civId} variant="gold">
                <span className="tabular-nums mr-1">{idx + 1}.</span>
                {civId}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <div className="text-caption text-text-tertiary mb-2 uppercase tracking-wider">
            3 civs extra (final)
          </div>
          <div className="flex flex-wrap gap-2">
            {data.extraCivIds.map((civId, idx) => (
              <Badge key={civId} variant="outline">
                <span className="tabular-nums mr-1">{idx + 1}.</span>
                {civId}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* Confirmaciones */}
      <section className="border border-border-subtle bg-bg-elevated p-6">
        <div className="label-premium text-gold/80 mb-4">CONFIRMACIONES</div>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <Check className="w-4 h-4 text-success" strokeWidth={2} />
            <span className="text-text-secondary text-sm">
              Cuenta de equipo: <span className="text-text-primary">{data.email}</span>
            </span>
          </li>
          <li className="flex items-center gap-3">
            {data.handbookDownloadedAt ? (
              <Check className="w-4 h-4 text-success" strokeWidth={2} />
            ) : (
              <FileText className="w-4 h-4 text-text-tertiary" strokeWidth={1.5} />
            )}
            <span className="text-text-secondary text-sm">
              Handbook descargado
            </span>
          </li>
          <li className="flex items-center gap-3">
            {data.restreamAccepted ? (
              <Check className="w-4 h-4 text-success" strokeWidth={2} />
            ) : (
              <Star className="w-4 h-4 text-text-tertiary" strokeWidth={1.5} />
            )}
            <span className="text-text-secondary text-sm">
              Permiso de transmisión aceptado
            </span>
          </li>
          <li className="flex items-center gap-3">
            {data.termsAcceptedAt ? (
              <Check className="w-4 h-4 text-success" strokeWidth={2} />
            ) : (
              <Swords className="w-4 h-4 text-text-tertiary" strokeWidth={1.5} />
            )}
            <span className="text-text-secondary text-sm">
              Reglamento aceptado
            </span>
          </li>
        </ul>
      </section>

      {/* Advertencia final */}
      <div className="border-l-2 border-gold/40 pl-4 py-2">
        <p className="text-caption text-text-secondary leading-relaxed">
          Al confirmar, tu equipo quedará <span className="text-gold">pendiente de aprobación</span>.
          El staff revisará los perfiles AoE2 Companion de los 3 jugadores y la suma de ELO.
          Recibirás la confirmación por email antes del inicio del torneo.
        </p>
      </div>
    </div>
  );
}
