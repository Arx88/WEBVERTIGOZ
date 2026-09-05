"use client";

import { useActionState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { confirmReadyAction } from "@/server/actions/ready";
import { playSound } from "@/lib/sounds";

/**
 * Botón ESTOY LISTO con feedback real: useActionState muestra el error
 * que devuelve la server action (ventana cerrada, sin equipo, etc.) y
 * un estado "CONFIRMANDO…" mientras corre. El form plano anterior
 * fallaba en silencio y parecía que el botón no andaba.
 */
export default function ConfirmReadyForm({
  matchId,
  phase,
}: {
  matchId: string;
  phase: "open" | "grace" | "wo";
}) {
  const [state, action, pending] = useActionState(confirmReadyAction.bind(null, matchId), null);

  // READY confirmado: tono cálido de "apareció el resultado".
  useEffect(() => {
    if (state && !state.error) playSound("reveal");
  }, [state]);

  return (
    <form
      action={action}
      style={{ display: "inline-flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}
    >
      <button
        type="submit"
        disabled={pending}
        className={`vertigo-btn ${phase === "grace" ? "vertigo-btn-danger" : phase === "wo" ? "vertigo-btn-primary" : "vertigo-btn-success"}`}
        style={{ fontSize: 11, padding: "10px 20px" }}
      >
        <CheckCircle2 style={{ width: 14, height: 14 }} />
        {pending ? "CONFIRMANDO…" : phase === "wo" ? "ESTOY LISTO — AVANZAR" : "ESTOY LISTO"}
      </button>
      {state?.error && (
        <span
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            color: "var(--vertigo-danger)",
            fontWeight: 600,
            textAlign: "right",
            maxWidth: 260,
          }}
        >
          {state.error}
        </span>
      )}
    </form>
  );
}
