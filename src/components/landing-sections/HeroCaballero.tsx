"use client";

import { useEffect, useRef } from "react";

// ══ Física del giro (misma que el prototipo validado en test-hero) ══
const STIFFNESS = 55; // rigidez: qué tan fuerte busca el objetivo
const DAMPING = 13; // amortiguación: ζ≈0.88 → asentamiento natural sin rebotes
const DEADZONE = 0.07; // zona muerta central: cerca del centro casi no gira
const CURVE_EXP = 1.4; // >1: hacia los bordes el giro se acentúa
const IDLE_SWAY = 0.018; // vaivén sutil al quedarse quieto ("respiración")
const SWAY_SPEED = 0.8; // velocidad del vaivén (rad/s)
const SEEK_TOLERANCE = 0.02; // ~medio frame a 24fps

/**
 * Hero del caballero: video fijo a pantalla completa cuyo frame sigue al mouse
 * con física de resorte (la cabeza gira hacia el cursor). Sin HUD ni textos:
 * el logo y los CTAs de la landing viven en HeroSection, encima.
 *
 * Avisa con onCanPlayThrough cuando el video está totalmente cargado, para que
 * HeroSection mantenga el loader de la página hasta ese momento (entrada limpia,
 * sin el pop del video cargando a medias sobre el hero clásico).
 */
export default function HeroCaballero({
  onCanPlayThrough,
}: {
  onCanPlayThrough?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let duration = 0;
    let metaReady = false;
    let seeking = false;
    let pendingTime: number | null = null;
    let pos = 0; // posición del "cuello" -1..1 (0 = centro)
    let vel = 0;
    let lastTs = 0;
    let raf = 0;
    let visible = true;
    let targetNorm = 0.5;

    const doSeek = (t: number) => {
      if (seeking) {
        pendingTime = t;
        return;
      }
      seeking = true;
      video.currentTime = t;
    };

    const onSeeked = () => {
      seeking = false;
      if (pendingTime !== null) {
        const t = pendingTime;
        pendingTime = null;
        doSeek(t);
      }
    };

    const onLoadedMetadata = () => {
      duration = video.duration;
      metaReady = true;
      video.currentTime = duration / 2; // arranca mirando al frente
    };

    // Curva de respuesta: mouse 0..1 → objetivo -1..1
    // Zona muerta central (mirada estable al frente) + acento no lineal en los bordes.
    const responseCurve = (n: number) => {
      const dx = n - 0.5;
      const mag = Math.max(0, Math.abs(dx) - DEADZONE) / (0.5 - DEADZONE);
      return Math.sign(dx) * Math.pow(mag, CURVE_EXP);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = video.getBoundingClientRect();
      targetNorm = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    };
    const onMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget) targetNorm = 0.5; // salió de la ventana
    };
    const onTouchMove = (e: TouchEvent) => {
      const rect = video.getBoundingClientRect();
      targetNorm = Math.min(1, Math.max(0, (e.touches[0].clientX - rect.left) / rect.width));
    };

    // Solo consume GPU/decodificador mientras el hero está a la vista
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(video);

    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;

      const dt = Math.min(0.05, lastTs ? (ts - lastTs) / 1000 : 0.016);
      lastTs = ts;

      if (REDUCED) {
        pos = responseCurve(targetNorm);
        vel = 0;
      } else {
        const target = responseCurve(targetNorm);
        const accel = (target - pos) * STIFFNESS - vel * DAMPING;
        vel += accel * dt;
        pos += vel * dt;
      }

      // "Respiración": micro-vaivén solo cuando está casi quieto
      const still = Math.max(0, 1 - Math.abs(vel) * 25);
      const norm = Math.min(
        1,
        Math.max(0, (pos + IDLE_SWAY * still * Math.sin((ts / 1000) * SWAY_SPEED)) * 0.5 + 0.5)
      );

      if (metaReady && duration > 0) {
        const t = Math.min(norm * duration, duration - 0.001);
        if (!seeking && Math.abs(video.currentTime - t) > SEEK_TOLERANCE) doSeek(t);
      }
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("seeked", onSeeked);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseout", onMouseOut);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("seeked", onSeeked);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src="/landing/knight-hero.mp4"
      muted
      playsInline
      preload="auto"
      onCanPlayThrough={onCanPlayThrough}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ objectPosition: "center 30%" }}
    />
  );
}
