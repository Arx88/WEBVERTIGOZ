"use client";

/**
 * NotificacionesList — historial paginado (client).
 *
 * Rediseñado para parecerse al resto del sitio (resultados / fixture):
 * cabecera editorial + badges de estado, toolbar con filtro segmentado,
 * búsqueda y "marcar todas leídas", y las notificaciones agrupadas por
 * día como tarjetas (no como filas del panel).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCheck, Search, BellRing, ChevronRight, Inbox } from "lucide-react";
import {
  iconFor,
  labelFor,
  timeAgo,
  type NotificationRow,
} from "@/components/notifications/notification-center";

const PAGE_SIZE = 20;

type Filter = "all" | "unread";

/** Bucket por día editorial: Hoy / Ayer / Esta semana / Anteriores. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  const n = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(n) - startOfDay(d)) / 86400000);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7) return "Esta semana";
  return "Anteriores";
}
const DAY_ORDER = ["Hoy", "Ayer", "Esta semana", "Anteriores"];

function groupRows(rows: NotificationRow[]) {
  const groups: Record<string, NotificationRow[]> = {};
  for (const r of rows) {
    const k = dayKey(r.created_at);
    (groups[k] ??= []).push(r);
  }
  return DAY_ORDER.filter((k) => groups[k]).map((k) => ({
    label: k,
    rows: groups[k],
  }));
}

export default function NotificacionesList() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(async (from: number, append: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notifications?limit=${PAGE_SIZE}&offset=${from}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setAuthenticated(!!data.authenticated);
      if (data.authenticated) {
        setRows((prev) =>
          append ? [...prev, ...(data.notifications ?? [])] : data.notifications ?? []
        );
        setTotal(data.total ?? 0);
        setUnread(data.unread ?? 0);
      }
    } catch {
      /* el botón reintenta */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(0, false);
  }, [load]);

  const markRead = async (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, read_at: r.read_at ?? new Date().toISOString() } : r))
    );
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* la próxima carga reconcilia */
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

  const visible = useMemo(() => {
    let out = rows;
    if (filter === "unread") out = out.filter((r) => !r.read_at);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (r) => r.title.toLowerCase().includes(q) || (r.body ?? "").toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, filter, query]);

  const groups = useMemo(() => groupRows(visible), [visible]);

  return (
    <div className="notif-page">
      {/* ── Cabecera editorial del sitio ── */}
      <span className="vertigo-kicker">CENTRO DE NOTIFICACIONES</span>
      <h1 className="vertigo-title" style={{ fontSize: "clamp(28px, 4.2vw, 44px)" }}>
        Notificaciones
      </h1>
      <div className="vertigo-divider">
        <span />
        <i />
        <span />
      </div>
      <p className="vertigo-desc" style={{ marginBottom: 22 }}>
        Apuestas resueltas, llaves programadas, fases y avisos del staff — todo tu
        historial en un solo lugar.
      </p>

      {/* ── Badges de estado ── */}
      {authenticated === true && (
        <div className="notif-stat-row">
          <span className="vertigo-badge vertigo-badge-purple" style={{ padding: "7px 14px", fontSize: 11 }}>
            <BellRing style={{ width: 12, height: 12 }} />
            {total} notificacione{total !== 1 ? "s" : ""}
          </span>
          {unread > 0 ? (
            <span className="vertigo-badge vertigo-badge-warning" style={{ padding: "7px 14px", fontSize: 11 }}>
              <BellRing style={{ width: 12, height: 12 }} />
              {unread} sin leer
            </span>
          ) : (
            <span className="vertigo-badge vertigo-badge-success" style={{ padding: "7px 14px", fontSize: 11 }}>
              <CheckCheck style={{ width: 12, height: 12 }} />
              Todo al día
            </span>
          )}
        </div>
      )}

      {authenticated === false && (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <Inbox
              style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
              strokeWidth={1}
            />
            <div className="vertigo-empty-title">Ingresá para ver tus notificaciones</div>
            <p className="vertigo-empty-desc">
              Tu historial de apuestas, llaves y avisos del staff vive acá. Entrá con tu cuenta.
            </p>
            <Link href="/login" className="vertigo-btn vertigo-btn-primary" style={{ marginTop: 18 }}>
              Ingresar
            </Link>
          </div>
        </div>
      )}

      {authenticated === true && (
        <>
          {/* ── Toolbar: filtro segmentado + búsqueda + marcar todas ── */}
          <div className="notif-toolbar">
            <div className="notif-seg" role="tablist" aria-label="Filtrar notificaciones">
              <button
                type="button"
                role="tab"
                aria-selected={filter === "all"}
                className={`notif-seg-btn${filter === "all" ? " is-on" : ""}`}
                onClick={() => setFilter("all")}
              >
                Todas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === "unread"}
                className={`notif-seg-btn${filter === "unread" ? " is-on" : ""}`}
                onClick={() => setFilter("unread")}
              >
                No leídas{unread > 0 ? ` (${unread})` : ""}
              </button>
            </div>

            <label className="notif-search">
              <Search style={{ width: 15, height: 15 }} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en tus notificaciones…"
              />
            </label>

            {unread > 0 && filter === "all" && (
              <button
                type="button"
                className="vertigo-btn vertigo-btn-ghost notif-mark"
                style={{ padding: "8px 14px", fontSize: 11.5, whiteSpace: "nowrap", marginLeft: "auto" }}
                onClick={markAllRead}
              >
                <CheckCheck style={{ width: 14, height: 14 }} />
                Marcar todas leídas
              </button>
            )}
          </div>

          {/* ── Estado vacío (según filtro/búsqueda) ── */}
          {visible.length === 0 && !loading && (
            <div className="vertigo-card" style={{ marginTop: 20 }}>
              <div className="vertigo-empty">
                <Inbox
                  style={{ width: 44, height: 44, color: "var(--vertigo-faint)", margin: "0 auto 14px" }}
                  strokeWidth={1}
                />
                <div className="vertigo-empty-title">
                  {query.trim()
                    ? "No hay resultados para tu búsqueda"
                    : filter === "unread"
                    ? "No tenés notificaciones sin leer"
                    : "Todavía no hay novedades"}
                </div>
                <p className="vertigo-empty-desc">
                  Las apuestas, llaves y fases te van a avisar acá en cuanto se muevan.
                </p>
              </div>
            </div>
          )}

          {/* ── Grupos por día ── */}
          <div className="notif-groups">
          {groups.map((g) => (
            <section key={g.label} className="notif-group">
              <div className="notif-group-head">
                <span className="notif-group-title">{g.label}</span>
                <span className="notif-group-line" aria-hidden />
                <span className="notif-group-count">
                  {g.rows.length} notificacione{g.rows.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="notif-items">
                {g.rows.map((n) => {
                  const { Icon, className } = iconFor(n.type);
                  const unreadRow = !n.read_at;
                  const content = (
                    <>
                      <span className={`notif-item-icon ${className}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="notif-item-main">
                        <span className="notif-item-top">
                          <span className="notif-item-kicker">{labelFor(n.type)}</span>
                          <span className="notif-item-ago">{timeAgo(n.created_at)}</span>
                        </span>
                        <span className="notif-item-title">{n.title}</span>
                        {n.body && <span className="notif-item-body">{n.body}</span>}
                        <span className="notif-item-date">
                          {new Date(n.created_at).toLocaleString("es-AR")}
                        </span>
                      </span>
                      <span className="notif-item-action" aria-hidden>
                        <ChevronRight style={{ width: 16, height: 16 }} />
                      </span>
                    </>
                  );
                  return n.link ? (
                    <Link
                      key={n.id}
                      href={n.link}
                      onClick={() => markRead(n.id)}
                      className={`notif-item${unreadRow ? " is-unread" : ""}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markRead(n.id)}
                      className={`notif-item${unreadRow ? " is-unread" : ""}`}
                    >
                      {content}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          </div>

          {/* ── Cargar más ── */}
          {offset + rows.length < total && (
            <div className="notif-page-more">
              <button
                type="button"
                className="vertigo-btn vertigo-btn-ghost"
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
