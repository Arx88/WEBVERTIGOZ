"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Barrita de progreso fucsia debajo del header.
 * Arranca al clickear un link interno (o popstate), crece asintóticamente
 * hasta ~85% estilo loading, y completa al 100% + fade cuando cambia la ruta.
 */
export function NavProgress() {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);
  const progressRef = useRef(0);
  const pathnameRef = useRef(pathname);

  const stop = () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const reset = () => {
    stop();
    const bar = barRef.current;
    if (!bar) return;
    bar.style.transition = "none";
    bar.style.width = "0%";
    bar.style.opacity = "0";
  };

  const start = () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    progressRef.current = 0;
    const bar = barRef.current;
    if (!bar) return;
    if (timerRef.current != null) clearTimeout(timerRef.current);
    bar.style.transition = "none";
    bar.style.opacity = "1";
    bar.style.width = "0%";
    const tick = () => {
      if (!loadingRef.current) return;
      progressRef.current += (85 - progressRef.current) * 0.055;
      bar.style.width = `${progressRef.current}%`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    // Seguridad: si la navegación nunca llega, la barra no queda colgada
    if (stallRef.current != null) clearTimeout(stallRef.current);
    stallRef.current = setTimeout(() => {
      if (loadingRef.current) {
        loadingRef.current = false;
        reset();
      }
    }, 8000);
  };

  const finish = () => {
    if (!loadingRef.current) return;
    loadingRef.current = false;
    stop();
    if (stallRef.current != null) clearTimeout(stallRef.current);
    const bar = barRef.current;
    if (!bar) return;
    bar.style.transition = "width 0.25s ease-out, opacity 0.4s ease 0.2s";
    bar.style.width = "100%";
    bar.style.opacity = "0";
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      bar.style.transition = "none";
      bar.style.width = "0%";
    }, 700);
  };

  // Arrancar al clickear cualquier link interno
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^[a-z]+:/i.test(href) || href.startsWith("//")) return;
      if (href === window.location.pathname) return;
      start();
    };
    const onPop = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Completar cuando cambia la ruta
  useEffect(() => {
    if (pathname !== pathnameRef.current) {
      pathnameRef.current = pathname;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(
    () => () => {
      stop();
      if (timerRef.current != null) clearTimeout(timerRef.current);
      if (stallRef.current != null) clearTimeout(stallRef.current);
    },
    []
  );

  return (
    <div className="vertigo-nav-progress" aria-hidden>
      <div ref={barRef} className="vertigo-nav-progress-bar" />
    </div>
  );
}
