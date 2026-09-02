"use client";

/**
 * NotificacionesList — historial paginado (client).
 * Reutiliza la API /api/notifications con ?limit&offset y los estilos
 * de fila del panel (notif-row) para que se vean iguales.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import {
  iconFor,
  timeAgo,
  type NotificationRow,
} from "@/components/notifications/notification-center";

const PAGE_SIZE = 25;

export default function NotificacionesList() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (from: number, append: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=${PAGE_SIZE}&offset=${from}`, { cache: "no-store" });
      const data = await res.json();
      setAuthenticated(!!data.authenticated);
      if (data.authenticated) {
        setRows((prev) => (append ? [...prev, ...(data.notifications ?? [])] : (data.notifications ?? [])));
        setTotal(data.total ?? 0);
        setUnread(data.unread ?? 0);
      }
    } catch {
      /* el boton reintenta */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, false);
  }, [load]);

  const markRead = async (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read_at: r.read_at ?? new Date().toISOString() } : r)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* la proxima carga reconcilia */
    }
  };

  const markAllRead = async () => {
    setUnread(0);
    setRows((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      /* silencio */
    }
  };

  const visible = filterUnread ? rows.filter((r) => !r.read_at) : rows;

  return (
    <div className="notif-page-card">
      <div className="notif-page-head">
        <div className="notif-page-title-row">
          <Bell className="h-5 w-5 text-[#ff2e9e]" />
          <h1 className="font-cinzel text-xl uppercase tracking-[0.2em] text-white">Notificaciones</h1>
          {unread > 0 && <span className="notif-page-count">{unread} sin leer</span>}
        </div>
        <div className="notif-page-actions">
          <button
            type="button"
            className={`notif-filter${filterUnread ? " is-on" : ""}`}
            onClick={() => setFilterUnread((v) => !v)}
          >
            No leídas{unread > 0 ? ` (${unread})` : ""}
          </button>
          {unread > 0 && (
            <button type="button" className="notif-mark-all" onClick={markAllRead}>
              <CheckCheck className="h-3 w-3" />
              Marcar todas leídas
            </button>
          )}
        </div>
      </div>

      {authenticated === false && (
        <div className="notif-empty">
          Ingresá para ver tus notificaciones.{" "}
          <Link href="/login" className="notif-history-link">Ingresar →</Link>
        </div>
      )}

      {authenticated === true && (
        <>
          {rows.length === 0 && !loading && (
            <div className="notif-empty">Todavía no hay novedades — las apuestas, llaves y fases te van a avisar acá.</div>
          )}

          <div className="notif-list notif-page-list">
            {visible.map((n) => {
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
                    <span className="notif-page-date">{new Date(n.created_at).toLocaleString("es-AR")}</span>
                  </span>
                </>
              );
              return n.link ? (
                <a key={n.id} href={n.link} onClick={() => markRead(n.id)} className={`notif-row${!n.read_at ? " is-unread" : ""}`}>
                  {content}
                </a>
              ) : (
                <button key={n.id} type="button" onClick={() => markRead(n.id)} className={`notif-row${!n.read_at ? " is-unread" : ""}`}>
                  {content}
                </button>
              );
            })}
          </div>

          {filterUnread && rows.length > 0 && visible.length === 0 && (
            <div className="notif-empty">No tenés notificaciones sin leer.</div>
          )}

          {offset + rows.length < total && (
            <div className="notif-page-more">
              <button
                type="button"
                className="notif-filter"
                disabled={loading}
                onClick={() => {
                  const next = offset + rows.length;
                  setOffset(next);
                  load(next, true);
                }}
              >
                {loading ? "Cargando…" : `Cargar más (${total - (offset + rows.length)} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
