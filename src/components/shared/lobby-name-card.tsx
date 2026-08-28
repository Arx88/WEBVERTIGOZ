"use client";

import { useState } from "react";
import { Copy, Check, Gamepad2 } from "lucide-react";

/**
 * Nombre de sala para la partida de AoE2.
 *
 * Los jugadores crean la sala en AoE2 con este nombre EXACTO; el watcher
 * del sitio descubre la partida en Companion por el nombre y auto-reporta
 * el resultado (archivando rec + análisis).
 *
 * variant="block": tarjeta para el Centro de operaciones del admin.
 * variant="chip": línea compacta para el panel del capitán.
 */
export default function LobbyNameCard({
  name,
  variant = "block",
}: {
  name: string;
  variant?: "block" | "chip";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(name);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard no disponible: el nombre igual está visible para tipearlo
    }
  };

  if (variant === "chip") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--vertigo-muted)]">
        <Gamepad2 style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
        Sala AoE2:{" "}
        <code
          style={{
            fontFamily: "var(--font-mono, monospace)",
            color: "var(--vertigo-text)",
            background: "rgba(255,255,255,0.06)",
            padding: "1px 6px",
            borderRadius: 4,
            letterSpacing: 0.5,
          }}
        >
          {name}
        </code>
        <button
          type="button"
          onClick={copy}
          title="Copiar nombre de sala"
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 2,
            color: copied ? "var(--vertigo-success)" : "var(--vertigo-faint)",
          }}
        >
          {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
        </button>
      </span>
    );
  }

  return (
    <div className="vertigo-stat" style={{ textAlign: "center" }}>
      <div className="vertigo-stat-label">Nombre de sala en AoE2</div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1.5,
          margin: "6px 0 10px",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {name}
      </div>
      <button
        type="button"
        onClick={copy}
        className="vertigo-btn vertigo-btn-ghost"
        style={{ padding: "6px 14px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        {copied ? (
          <>
            <Check style={{ width: 12, height: 12 }} /> Copiado
          </>
        ) : (
          <>
            <Copy style={{ width: 12, height: 12 }} /> Copiar nombre
          </>
        )}
      </button>
      <div className="text-[11px] text-[var(--vertigo-faint)] mt-2">
        Creá la sala con este nombre exacto — el resultado se detecta y carga solo.
      </div>
    </div>
  );
}
