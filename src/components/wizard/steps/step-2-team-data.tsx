"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Shield, Sparkles, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Step 2 — Datos del equipo
// Layout: 2 columnas
//   LEFT  (60%) — nombre + frase + grid de 12 emblemas (4×3)
//   RIGHT (40%) — preview card en vivo del equipo
// ============================================================

const EMBLEMS = [
  { id: "e1", name: "Caballero", glyph: "C" },
  { id: "e2", name: "Águila", glyph: "A" },
  { id: "e3", name: "Dragón", glyph: "D" },
  { id: "e4", name: "León", glyph: "L" },
  { id: "e5", name: "Lobo", glyph: "L" },
  { id: "e6", name: "Cuervo", glyph: "C" },
  { id: "e7", name: "Oso", glyph: "O" },
  { id: "e8", name: "Halcón", glyph: "H" },
  { id: "e9", name: "Serpiente", glyph: "S" },
  { id: "e10", name: "Toro", glyph: "T" },
  { id: "e11", name: "Unicornio", glyph: "U" },
  { id: "e12", name: "Fénix", glyph: "F" },
];

export default function WizardStepTeamData() {
  const { data, updateData } = useWizard();
  const selectedEmblem = EMBLEMS.find((e) => e.id === data.emblemId);

  return (
    <div className="grid lg:grid-cols-[3fr_2fr] gap-6 lg:gap-8 items-stretch">
      {/* ====== LEFT — Form + emblema grid ====== */}
      <div className="flex flex-col gap-6">
        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <span className="h-px w-6 bg-[rgba(255,46,158,0.55)]" />
          <span className="wiz-section-eyebrow">
            Identidad del equipo
          </span>
        </div>

        <p className="wiz-body">
          Estos datos representarán a tu equipo en todo el torneo. El nombre y la
          frase aparecerán en tu perfil público, en el bracket y en el stream.
        </p>

        {/* Nombre + Frase */}
        <div className="grid sm:grid-cols-2 gap-5">
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
            <p className="wiz-meta mt-2">
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
            <p className="wiz-meta mt-2">
              {data.teamTagline.length}/140 caracteres
            </p>
          </div>
        </div>

        {/* Emblema */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="wiz-label mb-0">Escudo del equipo *</span>
            <span className="wiz-caption text-[10px]">
              Elegí uno de los 12 disponibles
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {EMBLEMS.map((emblem) => {
              const isSelected = data.emblemId === emblem.id;
              return (
                <button
                  key={emblem.id}
                  onClick={() => updateData({ emblemId: emblem.id })}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center gap-1.5 p-2 transition-all rounded-[4px]",
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
      </div>

      {/* ====== RIGHT — Live preview ====== */}
      <aside className="flex flex-col gap-4">
        <div className="wiz-hero-panel relative flex-1 p-6 flex flex-col">
          {/* Header caption */}
          <div className="flex items-center justify-between mb-4">
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              Vista previa
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[rgba(255,46,158,0.3)] rounded-[4px]">
              <Sparkles className="w-2.5 h-2.5 text-[#ff2e9e]" strokeWidth={1.5} />
              <span className="font-cinzel text-[9px] tracking-[0.18em] uppercase text-[#ffb4dc]">
                En vivo
              </span>
            </span>
          </div>

          {/* Emblem block */}
          <div className="flex-1 flex flex-col items-center justify-center gap-5 py-4">
            <div
              className={cn(
                "w-24 h-24 rounded-full border flex items-center justify-center transition-all",
                data.emblemId
                  ? "border-[#ff2e9e] text-[#ff2e9e] shadow-[0_0_22px_rgba(255,46,158,0.4)]"
                  : "border-dashed border-[rgba(255,46,158,0.25)] text-[rgba(255,180,220,0.3)]"
              )}
            >
              {data.emblemId ? (
                <Shield className="w-12 h-12" strokeWidth={1.0} />
              ) : (
                <span className="font-cinzel text-[28px] tracking-[0.04em]">?</span>
              )}
            </div>

            <div className="text-center min-h-[3rem]">
              <div
                className={cn(
                  "font-cinzel text-[22px] tracking-[0.04em] uppercase text-[#f5eaff] transition-opacity",
                  !data.teamName && "opacity-30"
                )}
              >
                {data.teamName || "Nombre del equipo"}
              </div>
              {data.teamTagline ? (
                <div className="text-[13px] italic mt-2 text-[#e6d3f5] max-w-[18rem]">
                  &ldquo;{data.teamTagline}&rdquo;
                </div>
              ) : (
                <div className="text-[12px] italic mt-2 text-[rgba(255,180,220,0.3)]">
                  Tu frase del equipo aparecerá aquí
                </div>
              )}
            </div>

            {/* Emblem name chip */}
            {selectedEmblem && (
              <div className="mt-1 inline-flex items-center gap-2 px-3 py-1 border-y border-[rgba(255,46,158,0.4)] bg-[rgba(255,46,158,0.04)]">
                <Shield className="w-2.5 h-2.5 text-[#ff2e9e]" strokeWidth={1.5} />
                <span className="font-cinzel text-[10px] tracking-[0.18em] uppercase text-[#ff2e9e]">
                  {selectedEmblem.name}
                </span>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="flex items-start gap-2 pt-3 border-t border-[rgba(255,46,158,0.1)]">
            <Info className="w-3 h-3 text-[rgba(255,180,220,0.45)] mt-0.5 shrink-0" strokeWidth={1.5} />
            <p className="wiz-meta text-[10px] normal-case">
              Así se verá tu equipo en el bracket y en los streams oficiales.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
