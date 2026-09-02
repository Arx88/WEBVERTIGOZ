"use client";
import { useEffect } from "react";

/**
 * Registra el service worker de notificaciones push (/sw.js).
 * Solo en producción o si el flag NEXT_PUBLIC_ENABLE_PUSH=1 (dev).
 * El SW no intercepta navegación — solo recibe push.
 */
export function PushBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const enabled =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_ENABLE_PUSH === "1";
    if (!enabled) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        /* sin SW: el push simplemente no está disponible */
      });
  }, []);
  return null;
}
