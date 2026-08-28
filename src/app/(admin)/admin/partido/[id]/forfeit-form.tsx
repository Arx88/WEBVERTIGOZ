"use client";

import { useRef } from "react";
import { AlertTriangle } from "lucide-react";

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
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <form
      action={action}
      className="flex items-end gap-2 flex-wrap"
      onSubmit={(e) => {
        const v = selectRef.current?.value ?? "";
        if (requireWinner && !v) {
          e.preventDefault();
          return;
        }
        const detalle = v
          ? `Pierde ${v === teamAId ? teamAName ?? "Equipo A" : teamBName ?? "Equipo B"} y avanza el rival.`
          : "W.O. doble: la llave cierra SIN ganador y decidís vos después.";
        if (!confirm(`¿Marcar W.O.? ${detalle}`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="match_id" value={matchId} />
      <div className="flex flex-col gap-1">
        <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">
          {requireWinner ? "Quién pierde" : "Equipo ausente"}
        </label>
        <select
          ref={selectRef}
          name="absent_team_id"
          defaultValue=""
          required={requireWinner}
          className="bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2 text-[12px] text-[var(--vertigo-text)] min-w-[190px]"
        >
          {requireWinner
            ? <option value="" disabled>— Elegí quién pierde —</option>
            : <option value="">Ambos (sin ganador)</option>}
          {teamAId && <option value={teamAId}>{teamAName ?? "Equipo A"}</option>}
          {teamBId && <option value={teamBId}>{teamBName ?? "Equipo B"}</option>}
        </select>
      </div>
      <button type="submit" className="vertigo-btn vertigo-btn-danger">
        <AlertTriangle style={{ width: 14, height: 14 }} /> {buttonLabel ?? "W.O."}
      </button>
    </form>
  );
}
