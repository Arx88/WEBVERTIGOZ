"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import VertigoSelect from "@/components/admin/vertigo-select";

/**
 * W.O. manual (admin). El selector decide quién pierde:
 * - Equipo A ausente → gana B (y avanza en el bracket).
 * - Equipo B ausente → gana A.
 * - Ambos ausentes → W.O. sin ganador; el admin decide después.
 *
 * Con requireWinner=true se usa para RESOLVER un W.O. doble ya cerrado:
 * obliga a elegir quién pierde (no hay opción "sin ganador") y el botón
 * puede etiquetarse distinto vía buttonLabel.
 */
export default function ForfeitForm({
  matchId,
  action,
  teamAId,
  teamBId,
  teamAName,
  teamBName,
  requireWinner = false,
  buttonLabel,
}: {
  matchId: string;
  action: (formData: FormData) => void;
  teamAId?: string | null;
  teamBId?: string | null;
  teamAName?: string;
  teamBName?: string;
  requireWinner?: boolean;
  buttonLabel?: string;
}) {
  const options = [
    requireWinner
      ? { value: "", label: "— Elegí quién pierde —" }
      : { value: "", label: "Ambos (sin ganador)" },
    ...(teamAId ? [{ value: teamAId, label: teamAName ?? "Equipo A" }] : []),
    ...(teamBId ? [{ value: teamBId, label: teamBName ?? "Equipo B" }] : []),
  ];
  const [value, setValue] = useState("");

  return (
    <form
      action={action}
      className="flex items-end gap-2 flex-wrap"
      onSubmit={(e) => {
        if (requireWinner && !value) {
          e.preventDefault();
          return;
        }
        const detalle = value
          ? `Pierde ${value === teamAId ? teamAName ?? "Equipo A" : teamBName ?? "Equipo B"} y avanza el rival.`
          : "W.O. doble: la llave cierra SIN ganador y decidís vos después.";
        if (!confirm(`¿Marcar W.O.? ${detalle}`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="match_id" value={matchId} />
      <div className="flex flex-col gap-1 min-w-[210px]">
        <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">
          {requireWinner ? "Quién pierde" : "Equipo ausente"}
        </label>
        <VertigoSelect
          name="absent_team_id"
          options={options}
          defaultValue=""
          compact
          onValueChange={setValue}
        />
      </div>
      <button type="submit" className="vertigo-btn vertigo-btn-danger">
        <AlertTriangle style={{ width: 14, height: 14 }} /> {buttonLabel ?? "W.O."}
      </button>
    </form>
  );
}
