"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Lista oficial de 40 civs de AoE2 DE
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        Elegí <span className="text-gold">{TARGET} civilizaciones</span> principales
        que tu equipo podrá usar durante el torneo. El día de cada partida, la ruleta
        sorteará cuál de estas 9 civs te toca. Tu rival no verá tu pool completo, solo
        la civ que salió en el sorteo.
      </p>

      {/* Progress */}
      <div className="flex items-center justify-between">
        <Label>
          Seleccionadas: <span className="text-gold tabular-nums">{selectedIds.length}</span> / {TARGET}
        </Label>
        <Badge variant={selectedIds.length === TARGET ? "success" : "outline"}>
          {selectedIds.length === TARGET ? "Completo" : "Pendiente"}
        </Badge>
      </div>

      {/* Grid de civs */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2">
        {AOE2_CIVS.map((civ) => {
          const isSelected = selectedIds.includes(civ.id);
          const order = selectedIds.indexOf(civ.id) + 1;
          return (
            <button
              key={civ.id}
              onClick={() => toggleCiv(civ.id)}
              disabled={!isSelected && selectedIds.length >= TARGET}
              className={cn(
                "aspect-[3/4] border flex flex-col items-center justify-center p-2 transition-all relative group",
                isSelected
                  ? "border-gold bg-gold/5"
                  : "border-border-subtle hover:border-border-strong hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
              )}
            >
              {/* Número de orden */}
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gold text-bg flex items-center justify-center text-caption font-bold">
                  {order}
                </div>
              )}

              {/* Placeholder ilustración civ */}
              <div className={cn(
                "w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 transition-colors",
                isSelected ? "border-gold text-gold" : "border-border-strong text-text-tertiary group-hover:text-text-secondary"
              )}>
                {isSelected ? (
                  <Check className="w-5 h-5" strokeWidth={1.5} />
                ) : (
                  <span className="font-serif text-base font-bold">
                    {civ.name.charAt(0)}
                  </span>
                )}
              </div>

              <span className={cn(
                "text-caption uppercase tracking-wider text-center leading-tight",
                isSelected ? "text-gold" : "text-text-tertiary"
              )}>
                {civ.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      {selectedIds.length > 0 && (
        <div className="border border-border-subtle bg-bg-elevated p-5">
          <div className="label-premium text-gold/80 mb-3">
            TUS {TARGET} CIVILIZACIONES
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((civId, idx) => {
              const civ = AOE2_CIVS.find((c) => c.id === civId);
              return (
                <Badge key={civId} variant="gold">
                  <span className="tabular-nums mr-1">{idx + 1}.</span>
                  {civ?.name ?? civId}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
