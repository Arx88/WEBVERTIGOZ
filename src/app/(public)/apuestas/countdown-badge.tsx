"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";

/**
 * Cuenta regresiva al cierre de apuestas (= apertura de la llave).
 * Urgencia creciente: >6h tranquilo, <1h naranja, <10min parpadea rojo.
 */
export default function CountdownBadge({ target }: { target: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Primer render (SSR): sin tick todavía, mostramos versión estática.
  if (now === null) {
    return (
      <span className="text-[11px] text-[var(--vertigo-faint)] flex items-center gap-1">
        <Flame style={{ width: 11, height: 11 }} />
        Cerrá tu apuesta antes de que abra
      </span>
    );
  }

  const diff = new Date(target).getTime() - now;
  if (diff <= 0) {
    return (
      <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: "var(--vertigo-danger)" }}>
        <Flame style={{ width: 11, height: 11 }} />
        Cerrando apuestas…
      </span>
    );
  }

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  let label: string;
  if (days > 0) label = `${days}d ${hours}h`;
  else if (hours > 0) label = `${hours}h ${String(mins).padStart(2, "0")}m`;
  else label = `${mins}:${String(secs).padStart(2, "0")}`;

  const urgent = totalSec < 600; // <10 min
  const warm = totalSec < 3600 && !urgent; // <1 h

  return (
    <span
      className={`text-[11px] font-bold flex items-center gap-1 tabular-nums ${urgent ? "apu-countdown--urgent" : ""}`}
      style={{ color: urgent ? "var(--vertigo-danger)" : warm ? "var(--vertigo-warning)" : "var(--vertigo-purple-pale)" }}
      title="Las apuestas cierran cuando la llave abre"
    >
      <Flame style={{ width: 11, height: 11, flexShrink: 0 }} />
      Cerrás tu apuesta en {label}
    </span>
  );
}
