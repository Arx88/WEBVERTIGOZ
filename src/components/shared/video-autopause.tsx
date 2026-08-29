"use client";

/**
 * VideoAutopause — pausa automática de videos fuera del viewport.
 *
 * El sitio usa videos de fondo en loop (landing, partidos, fixture,
 * bracket, equipos, auth). Todos tienen autoPlay: si bien solo UNO se ve
 * a la vez, el navegador descarga y decodifica TODOS los que ya montó,
 * gastando ancho de banda, CPU y batería en píxeles que nadie ve.
 *
 * Este componente vive en el root layout y:
 *  - Observa todo <video> del documento (también los montados después,
 *    vía MutationObserver — navegación client-side incluida).
 *  - Cuando un video sale del viewport: lo pausa y recuerda que estaba
 *    reproduciéndose.
 *  - Cuando vuelve a entrar: lo reanuda SOLO si fue esta capa la que lo
 *    pausó (nunca fuerza play() sobre un video que el usuario o el
 *    navegador tenían pausado — sin pelear con las políticas de autoplay).
 *
 * Cero impacto visual: pausar un video que no se ve no cambia nada.
 */

import { useEffect } from "react";

export default function VideoAutopause() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    // Por video: ¿lo pausamos nosotros? (solo entonces lo reanudamos)
    const pausedByUs = new WeakSet<HTMLVideoElement>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            if (pausedByUs.has(video) && video.paused) {
              // Reanudar silenciosamente: si el navegador bloquea el play
              // (política de autoplay), ignoramos la promesa rechazada.
              const p = video.play();
              if (p && typeof p.catch === "function") p.catch(() => {});
            }
            pausedByUs.delete(video);
          } else if (!video.paused) {
            pausedByUs.add(video);
            video.pause();
          }
        }
      },
      // Un pequeño margen: se considera "visible" apenas asoma al viewport.
      { rootMargin: "120px", threshold: 0 }
    );

    const observeAll = (root: ParentNode) => {
      const videos = root.querySelectorAll?.("video");
      for (const v of videos ?? []) io.observe(v);
    };

    observeAll(document);

    // Videos montados después (rutas client-side, tabs, colapsables…)
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node instanceof HTMLVideoElement) {
            io.observe(node);
          } else if (node instanceof HTMLElement) {
            observeAll(node);
          }
        }
        // También re-observar si un video cambió de src en el mismo nodo
        if (m.type === "attributes" && m.target instanceof HTMLVideoElement) {
          io.observe(m.target);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
