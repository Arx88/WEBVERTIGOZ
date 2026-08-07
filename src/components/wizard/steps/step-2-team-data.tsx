"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// Emblemas de la galería (12 disponibles en MVP)
const EMBLEMS = [
  { id: "e1", name: "Caballero" },
  { id: "e2", name: "Águila" },
  { id: "e3", name: "Dragón" },
  { id: "e4", name: "León" },
  { id: "e5", name: "Lobo" },
  { id: "e6", name: "Cuervo" },
  { id: "e7", name: "Oso" },
  { id: "e8", name: "Halcón" },
  { id: "e9", name: "Serpiente" },
  { id: "e10", name: "Toro" },
  { id: "e11", name: "Unicornio" },
  { id: "e12", name: "Fénix" },
];

export default function WizardStepTeamData() {
  const { data, updateData } = useWizard();

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-center">
      <p className="wiz-body max-w-xl mx-auto">
        Estos datos representarán a tu equipo en todo el torneo. El nombre y la
        frase aparecerán en tu perfil público, en el bracket y en el stream.
      </p>

      {/* Nombre + Frase */}
      <div className="grid md:grid-cols-2 gap-5 text-left">
        <div>
          <label htmlFor="teamName" className="wiz-label">
            Nombre del equipo *
          </label>
          <input
            id="teamName"
            placeholder="Los Invencibles"
            className="wiz-input"
            value={data.teamName}
            onChange={(e) => updateData({ teamName: e.target.value })}
            maxLength={60}
            required
          />
          <p className="wiz-caption mt-2 text-[10px]" style={{ letterSpacing: "0.06em" }}>
            {data.teamName.length}/60 caracteres
          </p>
        </div>

        <div>
          <label htmlFor="teamTagline" className="wiz-label">
            Frase del equipo
          </label>
          <input
            id="teamTagline"
            placeholder="Honor et gloria"
            className="wiz-input"
            value={data.teamTagline}
            onChange={(e) => updateData({ teamTagline: e.target.value })}
            maxLength={140}
          />
          <p className="wiz-caption mt-2 text-[10px]" style={{ letterSpacing: "0.06em" }}>
            {data.teamTagline.length}/140 caracteres
          </p>
        </div>
      </div>

      {/* Emblema */}
      <div className="text-left">
        <div className="flex items-baseline justify-between mb-3">
          <span className="wiz-label mb-0">Escudo del equipo *</span>
          <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.06em" }}>
            Elegí uno de los 12 disponibles
          </span>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
          {EMBLEMS.map((emblem) => {
            const isSelected = data.emblemId === emblem.id;
            return (
              <button
                key={emblem.id}
                onClick={() => updateData({ emblemId: emblem.id })}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center gap-1.5 p-2 transition-all",
                  isSelected
                    ? "bg-[rgba(255,46,158,0.06)] border border-[rgba(255,46,158,0.7)] shadow-[0_0_14px_rgba(255,46,158,0.18)]"
                    : "bg-[rgba(20,0,31,0.4)] border border-[rgba(255,46,158,0.14)] hover:border-[rgba(255,46,158,0.45)]"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-full border flex items-center justify-center transition-colors",
                    isSelected
                      ? "border-[#ff2e9e] text-[#ff2e9e]"
                      : "border-[rgba(255,46,158,0.3)] text-[rgba(255,180,220,0.55)]"
                  )}
                >
                  <Shield className="w-4 h-4" strokeWidth={1.25} />
                </div>
                <span
                  className={cn(
                    "font-cinzel text-[9px] tracking-[0.16em] uppercase text-center leading-tight",
                    isSelected ? "text-[#ff2e9e]" : "text-[rgba(255,180,220,0.55)]"
                  )}
                >
                  {emblem.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      {data.teamName && (
        <div className="wiz-panel px-6 py-5">
          <div className="wiz-caption mb-3 text-center" style={{ letterSpacing: "0.32em" }}>
            Vista previa
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-full border border-[rgba(255,46,158,0.6)] flex items-center justify-center text-[#ff2e9e] shadow-[0_0_14px_rgba(255,46,158,0.3)]">
              <Shield className="w-7 h-7" strokeWidth={1.25} />
            </div>
            <div className="text-left">
              <div className="font-cinzel text-xl text-[#f5eaff]">{data.teamName}</div>
              {data.teamTagline && (
                <div className="text-[13px] italic mt-1 text-[#e6d3f5]">
                  &ldquo;{data.teamTagline}&rdquo;
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
