"use client";
/**
 * NotificationCenter — campana de notificaciones para usuarios autenticados.
 *
 * Se monta DONDE vive el chip de sesión (AuthBadge en el landing, header-right
 * en las páginas internas), así la campana queda integrada en la barra junto al
 * avatar — nunca flotando por encima del contenido.
 *
 * Entrega: Realtime (postgres_changes, instantáneo) + polling cada 45s y al
 * volver el foco como respaldo. Al llegar una notificación NUEVA: sonido por
 * tipo (motor @/lib/sounds, respeta el mute global) y la campana oscila.
 *
 * Visitantes: este componente no renderiza nada; el banner de cupos vive en
 * SlotsBanner (montado global en el layout).
 */
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  BellPlus,
  BellRing,
  CalendarClock,
  CheckCheck,
  Coins,
  ListChecks,
  Megaphone,
  RotateCcw,
  ShieldCheck,
  Swords,
  TrendingDown,
  TrendingUp,
  Trophy,
  Wand2,
  X,
} from "lucide-react";
import { playSound, type SoundName } from "@/lib/sounds";
import { getSupabaseBrowser } from "@/lib/supabase/client";
/**
 * Convierte la VAPID key (URL-safe base64) al Uint8Array que exige
 * pushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  match_id: string | null;
  read_at: string | null;
  created_at: string;
}
const POLL_MS = 45_000;
/** Un solo sonido por tanda: si llegan 5 a la vez, suena el más importante. */
const SOUND_THROTTLE_MS = 1500;
export function iconFor(type: string) {
  switch (type) {
    case "bet_won":
      return { Icon: TrendingUp, className: "text-[#4ade80]" };
    case "bet_lost":
      return { Icon: TrendingDown, className: "text-[#fb7185]" };
    case "bet_voided":
      return { Icon: RotateCcw, className: "text-[#fbbf24]" };
    case "bet_open":
      return { Icon: Coins, className: "text-[#a78bfa]" };
    case "match_scheduled":
      return { Icon: CalendarClock, className: "text-[#a78bfa]" };
    case "match_phase":
      return { Icon: Swords, className: "text-[#f0abfc]" };
    case "match_result":
      return { Icon: Swords, className: "text-[#c4b5fd]" };
    case "match_ready":
      return { Icon: AlarmClock, className: "text-[#fbbf24]" };
    case "match_open":
      return { Icon: ShieldCheck, className: "text-[#4ade80]" };
    case "match_lineup":
      return { Icon: ListChecks, className: "text-[#a78bfa]" };
    case "comodin_open":
      return { Icon: Wand2, className: "text-[#c4b5fd]" };
    case "broadcast":
      return { Icon: Megaphone, className: "text-[#fbbf24]" };
    default:
      return { Icon: Trophy, className: "text-[#a78bfa]" };
  }
}
export function labelFor(type: string) {
  switch (type) {
    case "bet_won":
      return "APUESTA GANADA";
    case "bet_lost":
      return "APUESTA PERDIDA";
    case "bet_voided":
      return "APUESTA ANULADA";
    case "bet_open":
      return "APUESTA ABIERTA";
    case "match_scheduled":
      return "PARTIDO PROGRAMADO";
    case "match_phase":
      return "NUEVA FASE";
    case "match_result":
      return "RESULTADO";
    case "match_ready":
      return "ESTOY LISTO";
    case "match_open":
      return "LLAVE HABILITADA";
    case "match_lineup":
      return "LINEUP";
    case "comodin_open":
      return "COMODINES";
    case "broadcast":
      return "AVISO DEL STAFF";
    default:
      return "NOTIFICACIÓN";
  }
}
/** Sonido por tipo de notificación (solo llega nueva, respeta el mute global). */
function soundForType(type: string): SoundName {
  switch (type) {
    case "bet_won":
      return "coin"; // ficha metálica: ganaste puntos
    case "bet_lost":
      return "error"; // madera descendente suave: no acertaste
    default:
      return "chime"; // neutra: apuestas abiertas, fases, programado, resultado
  }
}
export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min}m`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `${hs}h`;
  return `${Math.floor(hs / 24)}d`;
}
export default function NotificationCenter() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const [toast, setToast] = useState<NotificationRow | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pushState, setPushState] = useState<"unsupported" | "idle" | "requesting" | "on" | "off" | "denied">("idle");
  const [pushBusy, setPushBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  const lastSoundAtRef = useRef(0);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastExitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Cierra el toast (con animacion de salida). */
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastExitRef.current) clearTimeout(toastExitRef.current);
    setToastLeaving(true);
    toastExitRef.current = setTimeout(() => setToast(null), 350);
  }, []);
  /** Avisa la llegada: sonido (throttled) + campana oscila una vez. */
  const announce = useCallback((rows: NotificationRow[]) => {
    if (rows.length === 0) return;
    // Prioridad: ganar apuesta > perder apuesta > resto.
    const top =
      rows.find((r) => r.type === "bet_won") ??
      rows.find((r) => r.type === "bet_lost") ??
      rows[0];
    const now = Date.now();
    if (now - lastSoundAtRef.current >= SOUND_THROTTLE_MS) {
      lastSoundAtRef.current = now;
      playSound(soundForType(top.type));
    }
    setRinging(true);
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    ringTimerRef.current = setTimeout(() => setRinging(false), 1000);
    // Toast de entrada: se ve la primera linea durante 6s.
    setToastLeaving(false);
    setToast(top);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastLeaving(true);
      toastExitRef.current = setTimeout(() => setToast(null), 350);
    }, 6000);
  }, []);
  const loadNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      const data = await res.json();
      setAuthenticated(!!data.authenticated);
      if (data.authenticated) {
        setAccountId(data.accountId ?? null);
        const rows = (data.notifications ?? []) as NotificationRow[];
        const incoming = firstLoadRef.current
          ? []
          : rows.filter((r) => !knownIdsRef.current.has(r.id));
        knownIdsRef.current = new Set(rows.map((r) => r.id));
        firstLoadRef.current = false;
        setNotifications(rows);
        setUnread(data.unread ?? 0);
        if (incoming.length > 0) announce(incoming);
      }
    } catch {
      /* silencio: el polling reintenta */
    }
  }, [announce]);
  // Portal: el toast usa position:fixed y un ancestro con transform
  // (vertigo-fade-in) lo rompería — renderizado directo en <body>.
  useEffect(() => setMounted(true), []);
  // Realtime: llega una notificación nueva → prepend + sonido + campana.
  useEffect(() => {
    if (!accountId) return;
    let channel: { unsubscribe: () => void } | null = null;
    try {
      const supabase = getSupabaseBrowser();
      channel = supabase
        .channel(`notifications-${accountId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notification", filter: `account_id=eq.${accountId}` },
          (payload) => {
            const row = payload.new as NotificationRow;
            if (!row?.id) return;
            if (knownIdsRef.current.has(row.id)) return; // ya lo trajo el polling
            knownIdsRef.current.add(row.id);
            setNotifications((prev) => [row, ...prev].slice(0, 30));
            setUnread((u) => u + 1);
            announce([row]);
          },
        )
        .subscribe();
    } catch {
      /* sin realtime el polling cubre */
    }
    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [accountId, announce]);
  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, POLL_MS);
    const onFocus = () => loadNotifs();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastExitRef.current) clearTimeout(toastExitRef.current);
    };
  }, [loadNotifs]);
  // Cerrar el panel al hacer click afuera
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const markAllRead = async () => {
    setUnread(0);
    setNotifications((rows) => rows.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      /* el polling reconcilia */
    }
  };
  const markRead = async (id: string) => {
    setUnread((u) => Math.max(0, u - 1));
    setNotifications((rows) => rows.map((r) => (r.id === id ? { ...r, read_at: r.read_at ?? new Date().toISOString() } : r)));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* el polling reconcilia */
    }
  };
  /**
   * Activa/desactiva las notificaciones push de este navegador.
   * Estado pushState: unsupported (sin Push API) | on/off/denied.
   */
  const togglePush = useCallback(async () => {
    if (pushBusy) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
    if (!reg) {
      // Sin SW registrado aún: registralo en el momento (dev: sin flag también)
      try {
        const r = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        return togglePush();
      } catch {
        setPushState("unsupported");
        return;
      }
    }

    setPushBusy(true);
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Ya está activo → dar de baja en el navegador y en la DB
        await sub.unsubscribe();
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        setPushState("off");
        return;
      }

      const permission = await Notification?.requestPermission?.();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setPushState("unsupported");
        return;
      }
      const newSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = newSub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });
      setPushState("on");
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy]);

  // Estado inicial: ya hay suscripción activa en este navegador?
  useEffect(() => {
    if (authenticated !== true) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        if (!reg) {
          setPushState("idle");
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        setPushState(sub ? "on" : "off");
      })
      .catch(() => setPushState("unsupported"));
  }, [authenticated]);

  // Visitante o sesión desconocida: sin campana (el banner es SlotsBanner).
  if (authenticated !== true) return null;
  return (
    <div className="notif-root" ref={panelRef}>
      <button
        type="button"
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className={`notif-bell${ringing ? " is-ringing" : ""}`}
      >
        <Bell className="notif-bell-icon" />
        {unread > 0 && <span className="notif-bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {toast && mounted && createPortal(
        <div className={`notif-toast${toastLeaving ? " is-leaving" : ""}`} role="status">
          {(() => {
            const { Icon, className } = iconFor(toast.type);
            const inner = (
              <>
                <span className={`notif-toast-icon ${className}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="notif-toast-main">
                  <span className="notif-toast-kicker">{labelFor(toast.type)}</span>
                  <span className="notif-toast-title">{toast.title}</span>
                  {toast.body && <span className="notif-toast-body-text">{toast.body}</span>}
                </span>
              </>
            );
            return toast.link ? (
              <a
                href={toast.link}
                className="notif-toast-body"
                onClick={() => {
                  markRead(toast.id);
                  dismissToast();
                }}
              >
                {inner}
              </a>
            ) : (
              <button
                type="button"
                className="notif-toast-body"
                onClick={() => {
                  markRead(toast.id);
                  dismissToast();
                }}
              >
                {inner}
              </button>
            );
          })()}
          <button type="button" className="notif-toast-close" aria-label="Cerrar" onClick={dismissToast}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>,
        document.body
      )}

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notificaciones">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notificaciones</span>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="notif-mark-all">
                <CheckCheck className="h-3 w-3" />
                Leídas
              </button>
            )}
          </div>

          <div className="notif-panel-tools">
            <button
              type="button"
              className={`notif-filter${filterUnread ? " is-on" : ""}`}
              onClick={() => setFilterUnread((v) => !v)}
            >
              No leídas{unread > 0 ? ` (${unread})` : ""}
            </button>
            <a href="/notificaciones" className="notif-history-link">
              Ver historial
            </a>
          </div>

          {pushState !== "unsupported" && pushState !== "idle" && (
            <div className="notif-push-row">
              <button
                type="button"
                className={`notif-push-btn${pushState === "on" ? " is-on" : ""}`}
                onClick={togglePush}
                disabled={pushBusy}
                title={
                  pushState === "denied"
                    ? "Permiso bloqueado por el navegador: activalo en la configuración del sitio"
                    : undefined
                }
              >
                {pushState === "on" ? (
                  <>
                    <BellRing className="h-3.5 w-3.5" />
                    Notificaciones de escritorio activadas
                  </>
                ) : (
                  <>
                    <BellPlus className="h-3.5 w-3.5" />
                    {pushBusy
                      ? "Conectando…"
                      : pushState === "denied"
                        ? "Permiso bloqueado en el navegador"
                        : "Activar notificaciones del navegador"}
                  </>
                )}
              </button>
            </div>
          )}

          <div className="notif-list">
            {notifications.length === 0 && (
              <div className="notif-empty">
                Todo tranquilo en el asedio. No hay novedades todavía — las apuestas, llaves y fases te van a avisar acá.
              </div>
            )}
            {(() => {
              const visible = filterUnread ? notifications.filter((n) => !n.read_at) : notifications;
              return visible.map((n) => {
              const { Icon, className } = iconFor(n.type);
              const content = (
                <>
                  <span className={`notif-row-icon ${className}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="notif-row-main">
                    <span className="notif-row-title">
                      {!n.read_at && <span className="notif-unread-dot" aria-hidden />}
                      {n.title}
                    </span>
                    {n.body && <span className="notif-row-body">{n.body}</span>}
                  </span>
                  <span className="notif-row-time" title={new Date(n.created_at).toLocaleString("es-AR")}>
                    {timeAgo(n.created_at)}
                  </span>
                </>
              );
              return n.link ? (
                <a
                  key={n.id}
                  href={n.link}
                  onClick={() => {
                    markRead(n.id);
                    setOpen(false);
                  }}
                  className={`notif-row${!n.read_at ? " is-unread" : ""}`}
                >
                  {content}
                </a>
              ) : (
                <button key={n.id} type="button" onClick={() => markRead(n.id)} className={`notif-row${!n.read_at ? " is-unread" : ""}`}>
                  {content}
                </button>
              );
              });
            })()}
            {filterUnread && notifications.length > 0 && notifications.every((n) => n.read_at) && (
              <div className="notif-empty">No tenés notificaciones sin leer.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
