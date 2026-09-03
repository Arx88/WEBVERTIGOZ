"use client";

/**
 * BroadcastHistory — historial de envíos del staff (rediseño 2026-09).
 *
 * Sustituye la lista plana anterior por una tabla de marca:
 *  - Contadores por audiencia en el header, que filtran al click
 *    (feedback inmediato, sin recargar).
 *  - Cada fila es un acordeón (details/summary, accesible y sin JS extra):
 *    en la cabecera va quién envió, a quién, cuándo y cuántos alcanzó;
 *    el detalle plegable muestra el mensaje completo y el link.
 *  - Estado vacío con guía de la acción principal (ir a redactar).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History,
  Mail,
  Users,
  ExternalLink,
  ChevronDown,
  Clock,
  X,
  Shield,
  Swords,
  UserRound,
  UsersRound,
  Headphones,
  Flag,
} from "lucide-react";

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Todos",
  captains: "Capitanes",
  bettors: "Apostadores",
  players: "Jugadores",
  casters: "Casters",
  team: "Equipo",
};

const AUDIENCE_ICON: Record<string, { Icon: typeof Users }> = {
  all: { Icon: UsersRound },
  captains: { Icon: Flag },
  bettors: { Icon: UserRound },
  players: { Icon: Swords },
  casters: { Icon: Headphones },
  team: { Icon: Shield },
};

const TYPE_LABEL: Record<string, string> = {
  broadcast: "Aviso general",
  match_phase: "Fase / partido",
  match_scheduled: "Programado",
  bet_open: "Apuestas",
};

export default function BroadcastHistory({
  rows,
  scheduled = [],
}: {
  rows: any[];
  /** Avisos programados pendientes (scheduled_broadcast status=pending). */
  scheduled?: any[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const cancel = async (id: string) => {
    setCancelling(id);
    try {
      const res = await fetch(`/api/admin/notifications/scheduled?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "No se pudo cancelar");
      } else {
        router.refresh();
      }
    } finally {
      setCancelling(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.audience] = (c[r.audience] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = filter ? rows.filter((r) => r.audience === filter) : rows;

  return (
    <div
      className="vertigo-card"
      style={{ maxWidth: 1180, marginTop: 24, padding: 0, overflow: "hidden" }}
    >
      {/* Header con título + contadores filtrables */}
      <div className="bcast-hist-head">
        <div className="bcast-hist-title">
          <History size={18} style={{ color: "var(--vertigo-purple-soft)" }} />
          Historial de envíos
        </div>

        {rows.length > 0 && (
          <div className="bcast-hist-counts" role="group" aria-label="Filtrar por audiencia">
            <button
              type="button"
              className={`bcast-hist-count ${filter === null ? "is-active" : ""}`}
              onClick={() => setFilter(null)}
              title="Todos los envíos"
            >
              {rows.length}
            </button>
            {Object.entries(counts).map(([aud, n]) => (
              <button
                key={aud}
                type="button"
                className={`bcast-hist-count ${filter === aud ? "is-active" : ""}`}
                onClick={() => setFilter(filter === aud ? null : aud)}
                title={AUDIENCE_LABEL[aud] ?? aud}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Avisos programados pendientes: con hora de envío y cancelar */}
      {scheduled.length > 0 && (
        <div>
          {scheduled.map((s: any) => (
            <div
              key={s.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 24px",
                borderBottom: "1px solid var(--vertigo-line-soft)",
                background: "rgba(212, 175, 55, 0.04)",
              }}
            >
              <span
                className="bcast-hist-icon"
                title="Aviso programado"
                style={{
                  color: "var(--vertigo-warning)",
                  borderColor: "rgba(251, 191, 36, 0.3)",
                  background: "rgba(251, 191, 36, 0.08)",
                }}
              >
                <Clock size={16} />
              </span>
              <span className="bcast-hist-main">
                <span className="bcast-hist-title-line">{s.title}</span>
                <span className="bcast-hist-meta">
                  <b>Programado</b>
                  <span className="sep">·</span>
                  {AUDIENCE_LABEL[s.audience] ?? s.audience}
                  <span className="sep">·</span>
                  se envía el{" "}
                  {new Date(s.scheduled_for).toLocaleString("es-AR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {s.email ? (
                    <>
                      <span className="sep">·</span>
                      <span className="bcast-hist-mail">
                        <Mail size={9} />
                        EMAIL
                      </span>
                    </>
                  ) : null}
                </span>
              </span>
              <button
                type="button"
                className="vertigo-btn vertigo-btn-danger"
                style={{ padding: "7px 14px", fontSize: 10, flex: "none" }}
                onClick={() => cancel(s.id)}
                disabled={cancelling === s.id}
                title="Cancelar este aviso programado"
              >
                <X size={12} />
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="vertigo-empty" style={{ padding: "40px 24px 48px" }}>
          <History
            className="mx-auto mb-4"
            style={{ width: 44, height: 44, color: "var(--vertigo-faint)" }}
            strokeWidth={1}
          />
          <div className="vertigo-empty-title">
            {filter ? "Nada enviado a esta audiencia" : "Todavía no enviaste ningún aviso"}
          </div>
          <p className="vertigo-empty-desc">
            {filter
              ? "Cuando mandes un aviso a esta audiencia, va a aparecer acá."
              : "Cada broadcast queda registrado acá, con el emisor, la audiencia y el horario."}
          </p>
          {!filter && (
            <Link href="#redactar" className="vertigo-btn vertigo-btn-ghost" style={{ marginTop: 18 }}>
              Redactar el primero
            </Link>
          )}
        </div>
      ) : (
        <div>
          {visible.map((r: any) => {
            const sender =
              r.sent_by?.display_name || r.sent_by?.email?.split("@")[0] || "Cuenta eliminada";
            const { Icon } = AUDIENCE_ICON[r.audience] ?? AUDIENCE_ICON.all;
            return (
              <details key={r.id} className="bcast-hist-row">
                <summary>
                  <span className="bcast-hist-icon" title={AUDIENCE_LABEL[r.audience] ?? r.audience}>
                    <Icon size={16} />
                  </span>
                  <span className="bcast-hist-main">
                    <span className="bcast-hist-title-line">
                      {r.title}
                      {r.email_sent && (
                        <span className="bcast-hist-mail">
                          <Mail size={9} />
                          EMAIL
                        </span>
                      )}
                    </span>
                    <span className="bcast-hist-meta">
                      <b>{AUDIENCE_LABEL[r.audience] ?? r.audience}</b>
                      <span className="sep">·</span>
                      {TYPE_LABEL[r.type] ?? r.type}
                      <span className="sep">·</span>
                      <span>{r.targets} destinatario{r.targets === 1 ? "" : "s"}</span>
                      <span className="sep">·</span>
                      <span>
                        por <b>{sender}</b>
                      </span>
                      <span className="sep">·</span>
                      {new Date(r.sent_at).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                  <ChevronDown size={15} className="bcast-hist-chev" />
                </summary>

                <div className="bcast-hist-detail">
                  {r.body || "El aviso no tenía mensaje (solo título)."}
                  {r.link && (
                    <Link href={r.link} className="bcast-hist-link">
                      <ExternalLink size={11} />
                      {r.link}
                    </Link>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
