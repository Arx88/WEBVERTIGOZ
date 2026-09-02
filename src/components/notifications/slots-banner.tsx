"use client";

/**
 * SlotsBanner — banner de cupos para VISITANTES (montado en el layout).
 *
 * La caja es el contenedor de marca /brand/notification-frame.png (frame
 * neon con el escudo V y el panel de vidrio), fijo en la esquina INFERIOR
 * IZQUIERDA.
 *
 * Timing: no aparece al instante — espera la carga completa de la pagina
 * y 5s mas, con fade-in lento desde abajo + campana sutil. Todo el banner
 * es un enlace al wizard de registro (/registro); la X solo lo descarta.
 *
 * Descarte por SESION: cerrarlo guarda el flag en sessionStorage — dentro
 * de la misma sesion no vuelve, pero en cada sesion nueva (pestaña/browser
 * nuevo) reaparece. Los usuarios logueados jamas lo ven (esa vista es la
 * campana del nav).
 *
 * El texto vive centrado dentro del panel de vidrio del asset (centro del
 * vidrio: y 44.9% del alto, medido pixel a pixel sobre el PNG).
 *
 * Extiende /api/tournament/slots con ?scope=latest para que el cupo se
 * muestre aunque la edicion activa tenga inscripciones cerradas.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { playSound } from "@/lib/sounds";

interface SlotsInfo {
  open: boolean;
  status?: string | null;
  editionName?: string;
  maxTeams?: number;
  taken?: number;
  remaining?: number;
}

const POLL_MS = 45_000;
const DISMISS_KEY = "vertigo-slots-banner-dismissed";
/** Cuanto esperar tras la carga completa de la pagina (ms). */
const ENTER_DELAY_MS = 5_000;
/** Duracion de la animacion de salida (ms). */
const EXIT_MS = 380;

/** El descarte vive en sessionStorage: muere con la sesion de navegacion. */
function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false; /* modo privado: se descarta solo en memoria */
  }
}
function writeDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* sin storage: el flag de estado alcanza para la sesion */
  }
}

/** Contenedor de marca adjuntado por el dueño: frame + escudo V. */
const FRAME = "/brand/notification-frame.png";

export default function SlotsBanner() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [slots, setSlots] = useState<SlotsInfo | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [entered, setEntered] = useState(false);
  const authenticatedRef = useRef<boolean | null>(null);
  const announcedRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch("/api/tournament/slots?scope=latest", { cache: "no-store" });
      const data = (await res.json()) as SlotsInfo;
      setSlots(data.open || data.status ? data : null);
    } catch {
      /* sin slots no se muestra el banner */
    }
  }, []);

  useEffect(() => {
    // (La sesion se detecta via la API de notificaciones: mismo criterio
    // que la campana: logueado -> campana en el nav; visitante -> banner.)
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        authenticatedRef.current = !!d.authenticated;
        setAuthenticated(!!d.authenticated);
        if (!d.authenticated) {
          loadSlots();
          setBannerDismissed(readDismissed());
        }
      })
      .catch(() => {});

    const t = setInterval(() => {
      if (authenticatedRef.current === false) loadSlots();
    }, POLL_MS);
    const onFocus = () => {
      if (authenticatedRef.current === false) loadSlots();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadSlots]);

  // Timing de aparicion: 5s despues de la carga completa de la pagina.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const start = () => {
      t = setTimeout(() => setEntered(true), ENTER_DELAY_MS);
    };
    if (document.readyState === "complete") {
      start();
    } else {
      window.addEventListener("load", start, { once: true });
    }
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("load", start);
    };
  }, []);

  // Campana sutil al aparecer el banner (una vez por sesion).
  useEffect(() => {
    if (
      entered &&
      authenticated === false &&
      slots !== null &&
      !bannerDismissed &&
      !announcedRef.current
    ) {
      announcedRef.current = true;
      const t = setTimeout(() => playSound("chime"), 250);
      return () => clearTimeout(t);
    }
  }, [entered, authenticated, slots, bannerDismissed]);

  const dismissBanner = () => {
    if (leaving) return;
    writeDismissed();
    setLeaving(true);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => setBannerDismissed(true), EXIT_MS);
  };

  // Limpieza del timer de salida al desmontar.
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  // Visitante + cupo conocido + no descartado + ya pasaron los 5s.
  if (
    authenticated !== false ||
    slots === null ||
    bannerDismissed ||
    !entered
  ) {
    return null;
  }

  const remaining = slots.remaining ?? 0;
  const registrationOpen = !!slots?.open;

  return (
    <div className={`notif-slots-banner${leaving ? " is-leaving" : ""}`} role="status">
      <a href="/registro" className="notif-slots-link" aria-label="Ver cupos e inscribir mi equipo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FRAME} alt="" aria-hidden className="notif-slots-frame" />
        <div className="notif-slots-content">
          <span className="notif-slots-kicker">{slots?.editionName ?? "VERTIGO CUP"}</span>
          <span className="notif-slots-title">
            {remaining > 0 ? (
              <>
                Quedan <em>{remaining}</em> lugar{remaining === 1 ? "" : "es"}
              </>
            ) : (
              "Cupo completo"
            )}
          </span>
          {registrationOpen && remaining > 0 ? (
            <span className="notif-slots-cta">Inscribir mi equipo</span>
          ) : (
            <span className="notif-slots-sub">
              {slots?.maxTeams ?? 32} equipos ·{" "}
              {registrationOpen ? "abiertas" : "cerradas"}
            </span>
          )}
        </div>
      </a>
      <button
        type="button"
        aria-label="Descartar"
        onClick={dismissBanner}
        className="notif-slots-close"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
