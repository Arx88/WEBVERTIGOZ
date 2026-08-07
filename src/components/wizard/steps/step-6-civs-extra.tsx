"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// Lista oficial de 40 civs de AoE2 DE (misma que step 5)
const AOE2_CIVS = [
  { id: "britons", name: "Britanos" },
  { id: "franks", name: "Francos" },
  { id: "goths", name: "Godos" },
  { id: "teutons", name: "Teutones" },
  { id: "japanese", name: "Japoneses" },
  { id: "chinese", name: "Chinos" },
  { id: "byzantines", name: "Bizantinos" },
  { id: "persians", name: "Persas" },
  { id: "saracens", name: "Sarracenos" },
  { id: "turks", name: "Turcos" },
  { id: "vikings", name: "Vikingos" },
  { id: "mongols", name: "Mongoles" },
  { id: "celts", name: "Celtas" },
  { id: "spanish", name: "Españoles" },
  { id: "aztecs", name: "Aztecas" },
  { id: "mayans", name: "Mayas" },
  { id: "huns", name: "Hunos" },
  { id: "koreans", name: "Coreanos" },
  { id: "italians", name: "Italianos" },
  { id: "indians", name: "Hindúes" },
  { id: "incas", name: "Incas" },
  { id: "magyars", name: "Magiares" },
  { id: "slavs", name: "Eslavos" },
  { id: "berbers", name: "Bereberes" },
  { id: "ethiopians", name: "Etíopes" },
  { id: "malians", name: "Malianos" },
  { id: "portuguese", name: "Portugueses" },
  { id: "burmese", name: "Birmanos" },
  { id: "khmer", name: "Jémeres" },
  { id: "malay", name: "Malayos" },
  { id: "vietnamese", name: "Vietnamitas" },
  { id: "bulgarians", name: "Búlgaros" },
  { id: "cumans", name: "Cumanos" },
  { id: "lithuanians", name: "Lituanos" },
  { id: "tatars", name: "Tártaros" },
  { id: "burgundians", name: "Borgoñones" },
  { id: "sicilians", name: "Sicilianos" },
  { id: "poles", name: "Polacos" },
  { id: "bohemians", name: "Bohemios" },
  { id: "romans", name: "Romanos" },
];

export default function WizardStepCivsExtra() {
  const { data, updateData } = useWizard();
  const selectedIds = data.extraCivIds;
  const baseCivIds = data.baseCivIds;
  const TARGET = 3;

  function toggleCiv(civId: string) {
    if (selectedIds.includes(civId)) {
      updateData({ extraCivIds: selectedIds.filter((id) => id !== civId) });
    } else if (selectedIds.length < TARGET) {
      updateData({ extraCivIds: [...selectedIds, civId] });
    }
  }

  const isComplete = selectedIds.length === TARGET;

  return (
    <div className="max-w-5xl mx-auto space-y-5 text-center">
      <p className="wiz-body max-w-2xl mx-auto">
        Elegí <strong>{TARGET} civs extra</strong> que se sumarán a tu pool si
        llegás a la final. Tendrás <strong>12 civs totales</strong> para el
        sorteo. Las civs extra no pueden repetir con las 9 base.
      </p>

      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="wiz-caption" style={{ letterSpacing: "0.32em" }}>
          Seleccionadas:{" "}
          <span className="text-[#ff2e9e] font-cinzel tabular-nums">{selectedIds.length}</span>
          <span className="text-[rgba(255,180,220,0.55)]"> / {TARGET}</span>
        </span>
        <span
          className={cn(
            "font-cinzel text-[10px] tracking-[0.28em] uppercase px-2 py-1 border",
            isComplete
              ? "border-[rgba(255,46,158,0.5)] text-[#ff2e9e] bg-[rgba(255,46,158,0.06)]"
              : "border-[rgba(255,46,158,0.18)] text-[rgba(255,180,220,0.55)]"
          )}
        >
          {isComplete ? "Completo" : "Pendiente"}
        </span>
      </div>

      {/* Resumen civs base (locked) */}
      <div className="wiz-panel px-5 py-3 text-left">
        <div className="wiz-caption flex items-center gap-2 mb-2" style={{ letterSpacing: "0.32em" }}>
          <Lock className="w-3 h-3 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
          Civs base ya elegidas (no modificables)
        </div>
        <div className="flex flex-wrap gap-2">
          {baseCivIds.map((civId) => {
            const civ = AOE2_CIVS.find((c) => c.id === civId);
            return (
              <span
                key={civId}
                className="inline-flex items-center px-2.5 py-1 border border-[rgba(255,46,158,0.15)] opacity-50"
              >
                <span className="font-cinzel text-[10px] tracking-[0.12em] uppercase text-[rgba(255,180,220,0.7)]">
                  {civ?.name ?? civId}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Grid de civs extra */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-2">
        {AOE2_CIVS.map((civ) => {
          const isSelected = selectedIds.includes(civ.id);
          const isBase = baseCivIds.includes(civ.id);
          const order = selectedIds.indexOf(civ.id) + 1;
          return (
            <button
              key={civ.id}
              onClick={() => !isBase && toggleCiv(civ.id)}
              disabled={isBase || (!isSelected && selectedIds.length >= TARGET)}
              className={cn(
                "wiz-civ-tile",
                isBase && "wiz-civ-tile-locked",
                isSelected && "wiz-civ-tile-selected",
                !isBase && !isSelected && selectedIds.length >= TARGET && "wiz-civ-tile-locked"
              )}
            >
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#ff2e9e] text-[#0a0011] flex items-center justify-center font-cinzel text-[10px] font-bold shadow-[0_0_8px_rgba(255,46,158,0.7)]">
                  {order}
                </div>
              )}

              {isBase && (
                <div className="absolute top-1 right-1 text-[rgba(255,180,220,0.55)]">
                  <Lock className="w-3 h-3" strokeWidth={1.5} />
                </div>
              )}

              <div
                className={cn(
                  "w-9 h-9 rounded-full border flex items-center justify-center mb-1.5 transition-colors",
                  isSelected
                    ? "border-[#ff2e9e] text-[#ff2e9e]"
                    : isBase
                    ? "border-[rgba(255,46,158,0.2)] text-[rgba(255,180,220,0.35)]"
                    : "border-[rgba(255,46,158,0.3)] text-[rgba(255,180,220,0.55)]"
                )}
              >
                {isSelected ? (
                  <Check className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <span className="font-cinzel text-sm font-bold">
                    {civ.name.charAt(0)}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "font-cinzel text-[9px] uppercase tracking-[0.1em] text-center leading-tight",
                  isSelected ? "text-[#ff2e9e]" : "text-[rgba(255,180,220,0.55)]"
                )}
              >
                {civ.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      {selectedIds.length > 0 && (
        <div className="wiz-panel px-5 py-4 text-left">
          <div className="wiz-caption mb-3" style={{ letterSpacing: "0.32em" }}>
            Tus {TARGET} civs extra (final)
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((civId, idx) => {
              const civ = AOE2_CIVS.find((c) => c.id === civId);
              return (
                <span
                  key={civId}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[rgba(255,46,158,0.4)] bg-[rgba(255,46,158,0.04)]"
                >
                  <span className="font-cinzel text-[10px] tabular-nums text-[rgba(255,180,220,0.55)]">
                    {String(idx + 1).padStart(2, "0")}.
                  </span>
                  <span className="font-cinzel text-[11px] tracking-[0.12em] uppercase text-[#ff2e9e]">
                    {civ?.name ?? civId}
                  </span>
                </span>
              );
            })}
          </div>
          <p className="wiz-caption mt-3 normal-case text-[11px] text-[rgba(255,180,220,0.45)]" style={{ letterSpacing: "0.04em" }}>
            Tu equipo jugará la final con 9 + 3 = 12 civs disponibles para el sorteo.
          </p>
        </div>
      )}
    </div>
  );
}
