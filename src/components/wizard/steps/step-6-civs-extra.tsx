"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        Elegí <span className="text-gold">{TARGET} civilizaciones extra</span> que se
        sumarán a tu pool si tu equipo llega a la final. En la final tendrás un total
        de <span className="text-gold">12 civs</span> disponibles para el sorteo. Las
        civs extra no pueden repetir con las 9 base.
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

      {/* Resumen civs base (locked) */}
      <div className="border border-border-subtle bg-bg-elevated p-4">
        <div className="label-premium text-text-tertiary mb-2 flex items-center gap-2">
          <Lock className="w-3 h-3" strokeWidth={1.5} />
          CIVS BASE YA ELEGIDAS (NO MODIFICABLES)
        </div>
        <div className="flex flex-wrap gap-2">
          {baseCivIds.map((civId) => {
            const civ = AOE2_CIVS.find((c) => c.id === civId);
            return (
              <Badge key={civId} variant="outline" className="opacity-50">
                {civ?.name ?? civId}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Grid de civs extra */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-2">
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
                "aspect-[3/4] border flex flex-col items-center justify-center p-2 transition-all relative group",
                isBase
                  ? "border-border-subtle opacity-30 cursor-not-allowed"
                  : isSelected
                  ? "border-gold bg-gold/5"
                  : "border-border-subtle hover:border-border-strong hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed"
              )}
            >
              {isSelected && (
                <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-gold text-bg flex items-center justify-center text-caption font-bold">
                  {order}
                </div>
              )}

              {isBase && (
                <div className="absolute top-1 right-1">
                  <Lock className="w-3 h-3 text-text-tertiary" strokeWidth={1.5} />
                </div>
              )}

              <div className={cn(
                "w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2 transition-colors",
                isSelected
                  ? "border-gold text-gold"
                  : isBase
                  ? "border-border-strong text-text-tertiary"
                  : "border-border-strong text-text-tertiary group-hover:text-text-secondary"
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
            TUS {TARGET} CIVILIZACIONES EXTRA
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
          <p className="text-caption text-text-tertiary mt-3">
            Tu equipo jugará la final con 9 + 3 = 12 civs disponibles para el sorteo.
          </p>
        </div>
      )}
    </div>
  );
}
