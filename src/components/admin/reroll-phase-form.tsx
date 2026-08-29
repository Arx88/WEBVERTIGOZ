"use client";

import { useState } from "react";
import { rerollDrawPhaseFormAction } from "@/server/actions/match-day";

/**
 * Re-girar una fase del sorteo (MODO/ANTIMETA/MAPA/LLAVE/CIVS).
 *
 * El sorteo SOLO se ve en el modo stream: al tocar, este formulario abre o
 * enfoca la pestaña `/overlay/[match_id]` (mismo nombre de ventana → no se
 * duplica) y recién después ejecuta el re-giro. La ruleta de la stream se
 * entera por Realtime y anima el nuevo resultado.
 */
export default function RerollPhaseForm({
  matchId,
  gameNumber,
  phase,
  children,
}: {
  matchId: string;
  gameNumber: number;
  phase: string;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        window.open(`/overlay/${matchId}`, `vertigo-stream-${matchId}`);
        const fd = new FormData(e.currentTarget);
        void rerollDrawPhaseFormAction(fd).catch((err: unknown) =>
          setError(
            err instanceof Error ? err.message : "No se pudo re-girar la fase."
          )
        );
      }}
    >
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="game_number" value={gameNumber} />
      <input type="hidden" name="phase" value={phase} />
      {children}
      {error && (
        <span
          style={{
            display: "block",
            fontSize: 11,
            color: "#fb7185",
            marginTop: 4,
          }}
        >
          {error}
        </span>
      )}
    </form>
  );
}
