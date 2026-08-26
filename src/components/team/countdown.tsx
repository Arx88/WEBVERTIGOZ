"use client";

import { useEffect, useState } from "react";

/**
 * Cuenta regresiva al inicio de la próxima partida. Se calcula en cliente
 * (empieza como placeholder para no pelear con la hidratación) y se
 * refresca cada 30 segundos.
 */
export function MatchCountdown({ targetIso }: { targetIso: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!targetIso) return <span>Horario a confirmar</span>;

  if (now === null) return <span suppressHydrationWarning>···</span>;

  const diff = new Date(targetIso).getTime() - now;
  if (diff <= -3 * 3600_000) return <span>Finalizada o reprogramada</span>;
  if (diff <= 0) return <span style={{ color: "var(--vertigo-gold)", fontWeight: 700 }}>¡A jugar!</span>;

  const mins = Math.floor(diff / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const rem = mins % 60;

  let label: string;
  if (days > 0) label = `en ${days}d ${hours}h`;
  else if (hours > 0) label = `en ${hours}h ${rem}m`;
  else label = `en ${rem}m`;

  return (
    <span
      suppressHydrationWarning
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 10px",
        borderRadius: "999px",
        background: days > 0 ? "rgba(124,58,237,0.14)" : "rgba(212,175,55,0.12)",
        border: `1px solid ${days > 0 ? "rgba(124,58,237,0.35)" : "rgba(212,175,55,0.35)"}`,
        fontWeight: 700,
        fontSize: "11px",
        color: days > 0 ? "var(--vertigo-purple-pale)" : "var(--vertigo-gold)",
      }}
    >
      {label}
    </span>
  );
}
