"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

// Placeholder emblems (luego se cargan de Supabase Storage)
const PLACEHOLDER_EMBLEMS = [
  { id: "e1", name: "Caballero", url: "" },
  { id: "e2", name: "Águila", url: "" },
  { id: "e3", name: "Dragón", url: "" },
  { id: "e4", name: "León", url: "" },
  { id: "e5", name: "Lobo", url: "" },
  { id: "e6", name: "Cuervo", url: "" },
  { id: "e7", name: "Oso", url: "" },
  { id: "e8", name: "Halcón", url: "" },
  { id: "e9", name: "Serpiente", url: "" },
  { id: "e10", name: "Toro", url: "" },
  { id: "e11", name: "Unicornio", url: "" },
  { id: "e12", name: "Fénix", url: "" },
];

export default function WizardStepTeamData() {
  const { data, updateData } = useWizard();

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        Estos datos representarán a tu equipo en todo el torneo. El nombre y la
        frase aparecerán en tu perfil público, en el bracket y en el stream.
      </p>

      {/* Nombre + Frase */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="teamName">Nombre del equipo *</Label>
          <Input
            id="teamName"
            placeholder="Los Invencibles"
            value={data.teamName}
            onChange={(e) => updateData({ teamName: e.target.value })}
            maxLength={60}
            required
          />
          <p className="text-caption text-text-tertiary">
            {data.teamName.length}/60 caracteres
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="teamTagline">Frase del equipo</Label>
          <Input
            id="teamTagline"
            placeholder="Honor et gloria"
            value={data.teamTagline}
            onChange={(e) => updateData({ teamTagline: e.target.value })}
            maxLength={140}
          />
          <p className="text-caption text-text-tertiary">
            {data.teamTagline.length}/140 caracteres
          </p>
        </div>
      </div>

      {/* Emblema */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <Label>Escudo del equipo *</Label>
          <span className="text-caption text-text-tertiary">
            Elige uno de los escudos disponibles
          </span>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {PLACEHOLDER_EMBLEMS.map((emblem) => (
            <button
              key={emblem.id}
              onClick={() => updateData({ emblemId: emblem.id })}
              className={cn(
                "aspect-square border flex flex-col items-center justify-center gap-2 p-3 transition-all group",
                data.emblemId === emblem.id
                  ? "border-gold bg-gold/5"
                  : "border-border-subtle hover:border-border-strong hover:bg-bg-hover"
              )}
            >
              {/* Placeholder visual del escudo */}
              <div className={cn(
                "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-colors",
                data.emblemId === emblem.id
                  ? "border-gold text-gold"
                  : "border-border-strong text-text-tertiary group-hover:text-text-secondary"
              )}>
                <Shield className="w-6 h-6" strokeWidth={1.25} />
              </div>
              <span className={cn(
                "text-caption uppercase tracking-wider",
                data.emblemId === emblem.id ? "text-gold" : "text-text-tertiary"
              )}>
                {emblem.name}
              </span>
            </button>
          ))}
        </div>

        <p className="text-caption text-text-tertiary mt-4">
          La galería completa de 50+ escudos estará disponible próximamente.
          Por ahora, todos los equipos se asignan con un escudo genérico que
          podrá cambiarse más adelante.
        </p>
      </div>

      {/* Preview */}
      {data.teamName && (
        <div className="border border-border-subtle bg-bg-elevated p-6">
          <div className="label-premium text-gold/80 mb-3">VISTA PREVIA</div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-gold/60 flex items-center justify-center text-gold">
              <Shield className="w-8 h-8" strokeWidth={1.25} />
            </div>
            <div>
              <div className="font-serif text-2xl">{data.teamName}</div>
              {data.teamTagline && (
                <div className="text-text-secondary text-sm italic mt-1">
                  "{data.teamTagline}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
