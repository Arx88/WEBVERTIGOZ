"use client";

/**
 * Hooks compartidos de la página de partido (client).
 * Extraídos del wrapper para que MatchScoreboard y CaptainMatchPanel
 * los usen sin importar todo el wrapper (evita dependencia circular).
 */

import { useEffect, useRef, useState } from "react";

/** Tick de reloj: re-render del componente cada `intervalMs`. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/**
 * Marca "llegada de fase": cuando `phaseKey` cambia (p.ej. el status del
 * match llegó por realtime), aplica la clase `phase-enter` (glow violeta
 * 1.4s) durante ~1.6s y la saca. Devuelve el className a sumar.
 *
 * `enabled=false` desactiva el efecto (p.ej. prefers-reduced-motion lo
 * maneja el CSS con animation-duration 0.01ms, no hace falta gate aquí).
 */
export function usePhaseEnter(phaseKey: string): string {
  const [entering, setEntering] = useState(false);
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    if (prev !== null && prev !== phaseKey) {
      setEntering(true);
      const t = setTimeout(() => setEntering(false), 1600);
      setPrev(phaseKey);
      return () => clearTimeout(t);
    }
    if (prev === null) setPrev(phaseKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  return entering ? "phase-enter" : "";
}

/**
 * Auto-scroll guiado: cuando `phaseKey` cambia, lleva la sección a la vista
 * (smooth, con scroll-margin-top ya aplicado por CSS) SOLO si la sección no
 * estaba visible en el viewport — evita saltos espasmódicos si ya estás ahí.
 */
export function useAutoScrollOnPhase<T extends HTMLElement>(
  phaseKey: string
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = phaseKey;
    if (prev === null || prev === phaseKey) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const visible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (!visible) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  return ref;
}
