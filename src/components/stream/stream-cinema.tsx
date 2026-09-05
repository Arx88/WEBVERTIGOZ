"use client";

/**
 * StreamCinema — capa cinematográfica compartida de las pantallas del stream.
 *
 * Dirección de arte: oscuridad púrpura + oro Vértigo + un hilo de teal.
 * Nada vibrante, nada de texto nuevo: fondo épico con Ken Burns lento,
 * grado de cine (viñeta + letterbox + grano), brasas subiendo en canvas
 * (pocas, lentas) y medallón VS con brillo dorado. Todo decorativo
 * (aria-hidden) y quieto con `prefers-reduced-motion`.
 */

import { useEffect, useRef } from "react";

/* ── Fondo por fase del tour ─────────────────────────────────────────── */
export const PHASE_BG: Record<string, string> = {
  "scheduled-early": "/streams/bg/espera.mp4",
  "scheduled-open": "/streams/bg/ready.mp4",
  "scheduled-grace": "/streams/bg/tolerancia.mp4",
  open: "/streams/bg/listos.mp4",
  drawing: "/streams/bg/sorteo.mp4",
  drawn: "/streams/bg/resultado.mp4",
  civs: "/streams/bg/civs.mp4",
  lineup: "/streams/bg/lineup.mp4",
  comodin_window: "/streams/bg/comodines.mp4",
  in_progress: "/streams/bg/partida.mp4",
  finished: "/streams/bg/ganador.mp4",
};

export function StreamBackdrop({
  bg,
  colorA,
  colorB,
}: {
  bg: string;
  colorA: string;
  colorB: string;
}) {
  return (
    <div aria-hidden className="sc-backdrop">
      {/* Dos videos apilados: al cambiar de fase el nuevo entra con fade
          y el viejo se va — sin flash negro entre pasos. */}
      <video key={bg} src={bg} autoPlay muted loop playsInline className="sc-bg" />
      <div className="sc-rays" />
      <div className="sc-stage" />
      <div className="sc-tint-a" style={{ background: `radial-gradient(ellipse 55% 75% at 10% 50%, ${colorA}30, transparent 62%)` }} />
      <div className="sc-tint-b" style={{ background: `radial-gradient(ellipse 55% 75% at 90% 50%, ${colorB}30, transparent 62%)` }} />
      <div className="sc-grade" />
      <div className="sc-grain" />
      <div className="sc-hairline" />
    </div>
  );
}

/* ── Brasas: pocas, lentas, pequeñas. Sin abuso. ─────────────────────── */
const EMBER_COLORS = ["233,209,138", "233,209,138", "167,139,250", "212,175,55"];

export function EmberField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    type Ember = { x: number; y: number; r: number; vy: number; sway: number; ph: number; tw: number; c: string; a: number };
    let embers: Ember[] = [];

    const seed = () => {
      const area = w * h;
      const n = Math.max(22, Math.min(52, Math.round(area / 26000)));
      embers = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        vy: 0.08 + Math.random() * 0.28,
        sway: 8 + Math.random() * 22,
        ph: Math.random() * Math.PI * 2,
        tw: 0.5 + Math.random() * 1.6,
        c: EMBER_COLORS[Math.floor(Math.random() * EMBER_COLORS.length)],
        a: 0.14 + Math.random() * 0.3,
      }));
    };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width * dpr));
      h = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
      seed();
    };
    fit();

    const ro = new ResizeObserver(fit);
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);

    const onVis = () => {
      running = document.visibilityState === "visible";
      if (running) loop();
    };
    document.addEventListener("visibilitychange", onVis);

    let t = 0;
    const loop = () => {
      if (!running) return;
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const e of embers) {
        e.y -= e.vy * dpr;
        if (e.y < -6) {
          e.y = h + 6;
          e.x = Math.random() * w;
        }
        const x = e.x + Math.sin(t * e.tw + e.ph) * e.sway * 0.14 * dpr;
        const alpha = e.a * (0.55 + 0.45 * Math.sin(t * e.tw * 1.7 + e.ph));
        ctx.beginPath();
        ctx.arc(x, e.y, e.r * dpr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${e.c},${alpha.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="sc-embers" />;
}

/* ── Medallón VS épico: diamante doble, sheen dorado lento, VS en oro ── */
export function VsMedallionEpic() {
  return (
    <div aria-hidden className="sc-vs">
      <div className="sc-vs-halo" />
      <div className="sc-vs-diamond" />
      <div className="sc-vs-sheen" />
      <div className="sc-vs-core">
        <span className="font-cinzel sc-vs-text">VS</span>
      </div>
    </div>
  );
}
