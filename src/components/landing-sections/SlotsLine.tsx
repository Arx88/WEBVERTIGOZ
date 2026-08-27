"use client";

import { useEffect, useState } from "react";
import { Swords } from "lucide-react";

type Slots = {
  open: boolean;
  maxTeams?: number;
  taken?: number;
  remaining?: number;
};

/**
 * Línea de cupo para el header de "Elegí tu camino": texto puro, sin caja.
 * — Normal: "Quedan 31 de 32 lugares" (oro sobrio)
 * — ≤ 8:    "Últimos N lugares" (rosa, pulso sutil)
 * — Lleno:  "Cupo completo" (sin animación)
 * — Sin edición abierta: no se renderiza.
 */
export default function SlotsLine() {
  const [slots, setSlots] = useState<Slots | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tournament/slots")
      .then((r) => (r.ok ? r.json() : { open: false }))
      .then((d: Slots) => {
        if (!cancelled) setSlots(d);
      })
      .catch(() => {
        if (!cancelled) setSlots({ open: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!slots?.open) return null;

  const max = slots.maxTeams ?? 32;
  const taken = Math.min(slots.taken ?? 0, max);
  const remaining = Math.max(0, max - taken);
  const urgent = remaining > 0 && remaining <= 8;
  const full = remaining === 0;

  return (
    <div data-testid="slots-line" className="slots-line-in mt-8 flex items-center justify-center gap-3">
      <Swords className={`h-3.5 w-3.5 ${urgent ? "text-[#ff2e9e]/80" : "text-[#D4AF37]/70"}`} />
      <span
        className={`font-cinzel text-[11px] uppercase tracking-[0.4em] md:text-[12px] ${
          urgent ? "slots-urgent text-[#ffb4dc]" : full ? "text-[#e6d3f5]/50" : "text-[#e9d18a]/85"
        }`}
      >
        {full
          ? `Cupo completo — ${max} equipos`
          : urgent
            ? `Últimos ${remaining} lugares de ${max}`
            : `Quedan ${remaining} de ${max} lugares`}
      </span>
      <Swords className={`h-3.5 w-3.5 ${urgent ? "text-[#ff2e9e]/80" : "text-[#D4AF37]/70"}`} />
    </div>
  );
}
