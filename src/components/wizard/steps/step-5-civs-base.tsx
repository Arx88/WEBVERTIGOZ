"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Check, Info, Swords, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Step 5 — Civilizaciones base (9)
// Layout: 2 columnas
//   LEFT  (flex-1) — grid 8 cols de 40 civs (responsive)
//   RIGHT (320px)  — sidebar summary de las 9 elegidas
// ============================================================

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

export default function WizardStepCivsBase() {
  const { data, updateData } = useWizard();
  const selectedIds = data.baseCivIds;
  const TARGET = 9;

  function toggleCiv(civId: string) {
    if (selectedIds.includes(civId)) {
      updateData({ baseCivIds: selectedIds.filter((id) => id !== civId) });
    } else if (selectedIds.length < TARGET) {
      updateData({ baseCivIds: [...selectedIds, civId] });
    }
  }

  const isComplete = selectedIds.length === TARGET;

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      {/* ====== LEFT — Civ grid ====== */}
      <div className="flex flex-col gap-4">
        {/* Top stats row */}
        <div className="flex items-center justify-between">
          <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
            Seleccionadas:&nbsp;
            <span className="text-[#ff2e9e] font-cinzel tabular-nums">{selectedIds.length}</span>
            <span className="text-[rgba(255,180,220,0.55)]"> / {TARGET}</span>
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 font-cinzel text-[10px] tracking-[0.28em] uppercase px-2.5 py-1 border rounded-[4px]",
              isComplete
                ? "border-[rgba(255,46,158,0.5)] text-[#ff2e9e] bg-[rgba(255,46,158,0.06)]"
                : "border-[rgba(255,46,158,0.18)] text-[rgba(255,180,220,0.55)]"
            )}
          >
            {isComplete ? (
              <>
                <Check className="w-2.5 h-2.5" strokeWidth={2} />
                Completo
              </>
            ) : (
              <>
                <Swords className="w-2.5 h-2.5" strokeWidth={2} />
                Pendiente
              </>
            )}
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {AOE2_CIVS.map((civ) => {
            const isSelected = selectedIds.includes(civ.id);
            const order = selectedIds.indexOf(civ.id) + 1;
            return (
              <button
                key={civ.id}
                onClick={() => toggleCiv(civ.id)}
                disabled={!isSelected && selectedIds.length >= TARGET}
                className={cn(
                  "wiz-civ-tile",
                  isSelected && "wiz-civ-tile-selected",
                  !isSelected && selectedIds.length >= TARGET && "wiz-civ-tile-locked"
                )}
              >
                {isSelected && (
                  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#ff2e9e] text-[#0a0011] flex items-center justify-center font-cinzel text-[10px] font-bold shadow-[0_0_8px_rgba(255,46,158,0.7)]">
                    {order}
                  </div>
                )}

                <div
                  className={cn(
                    "w-9 h-9 rounded-full border flex items-center justify-center mb-1.5 transition-colors",
                    isSelected
                      ? "border-[#ff2e9e] text-[#ff2e9e]"
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

        {/* Info bar bottom */}
        <div className="wiz-panel-sunken border-l-2 !border-l-[#ff2e9e] px-4 py-3 rounded-[4px] flex items-start gap-2 mt-2">
          <Info className="w-3.5 h-3.5 text-[#ff2e9e] mt-0.5 shrink-0" strokeWidth={1.5} />
          <p className="wiz-body text-[12px]">
            El día de cada partida, la ruleta sorteará cuál de estas civs te toca. Tu rival no verá tu pool completo, solo la civ que salió en el sorteo.
          </p>
        </div>
      </div>

      {/* ====== RIGHT — Sidebar summary ====== */}
      <aside className="wiz-card !rounded-[4px] p-5 lg:sticky lg:top-0">
        <div className="flex items-center justify-between mb-3">
          <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
            Tu pool base
          </span>
          <span className="font-cinzel text-[10px] tabular-nums tracking-[0.18em] text-[#ff2e9e]">
            {selectedIds.length}/{TARGET}
          </span>
        </div>

        {/* Numbered list */}
        {selectedIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full border border-dashed border-[rgba(255,46,158,0.25)] flex items-center justify-center mb-3">
              <Swords className="w-5 h-5 text-[rgba(255,180,220,0.35)]" strokeWidth={1.25} />
            </div>
            <p className="wiz-meta text-[10px] normal-case">
              Elegí tus 9 civs<br />principales
            </p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {Array.from({ length: TARGET }).map((_, idx) => {
              const civId = selectedIds[idx];
              if (!civId) {
                return (
                  <li
                    key={`empty-${idx}`}
                    className="flex items-center gap-2 px-2 py-1.5 border border-dashed border-[rgba(255,46,158,0.12)] rounded-[3px]"
                  >
                    <span className="font-cinzel text-[10px] tabular-nums text-[rgba(255,180,220,0.3)] w-5">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="font-cinzel text-[10px] tracking-[0.12em] uppercase text-[rgba(255,180,220,0.3)]">
                      —
                    </span>
                  </li>
                );
              }
              const civ = AOE2_CIVS.find((c) => c.id === civId);
              return (
                <li
                  key={civId}
                  className="flex items-center gap-2 px-2 py-1.5 border border-[rgba(255,46,158,0.4)] bg-[rgba(255,46,158,0.04)] rounded-[3px]"
                >
                  <span className="font-cinzel text-[10px] tabular-nums text-[rgba(255,180,220,0.55)] w-5">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="font-cinzel text-[11px] tracking-[0.12em] uppercase text-[#ff2e9e] truncate">
                    {civ?.name ?? civId}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {selectedIds.length > 0 && (
          <div className="mt-4 pt-3 border-t border-[rgba(255,46,158,0.1)]">
            <p className="wiz-meta text-[10px] normal-case">
              {isComplete
                ? "Pool completo. Continuá al siguiente paso."
                : `Faltan ${TARGET - selectedIds.length} civs para completar.`}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
