"use client";

/**
 * BroadcastHistory — historial accionable + timeline de programados.
 * - Filtros con etiqueta + conteo (no solo números)
 * - Buscador en vivo
 * - Duplicar → recarga el composer vía evento bcast:reuse
 * - Programados como timeline con confirmar-cancelar en 2 pasos (sin alert)
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import {
  History, Mail, Users, ExternalLink, ChevronDown, Clock, X, Shield,
  Swords, UserRound, UsersRound, Headphones, Flag, Search, Copy, Check,
} from "lucide-react";

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Todos", captains: "Capitanes", bettors: "Apostadores",
  players: "Jugadores", casters: "Casters", team: "Equipo",
};

const AUDIENCE_ICON: Record<string, { Icon: typeof Users }> = {
  all: { Icon: UsersRound }, captains: { Icon: Flag }, bettors: { Icon: UserRound },
  players: { Icon: Swords }, casters: { Icon: Headphones }, team: { Icon: Shield },
};

const TYPE_LABEL: Record<string, string> = {
  broadcast: "Aviso general", match_phase: "Fase / partido", match_scheduled: "Programado",
  bet_open: "Apuestas", match_ready: "Estoy listo", match_open: "Llave",
  match_lineup: "Lineup", comodin_open: "Comodines",
};

export default function BroadcastHistory({ rows, scheduled = [] }: { rows: any[]; scheduled?: any[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const cancel = async (id: string) => {
    setCancelling(id);
    setCancelMsg(null);
    try {
      const res = await fetch(`/api/admin/notifications/scheduled?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCancelMsg(data.error ?? "No se pudo cancelar");
      } else {
        setConfirmId(null);
        router.refresh();
      }
    } finally {
      setCancelling(null);
    }
  };

  const reuse = (r: any) => {
    window.dispatchEvent(new CustomEvent("bcast:reuse", {
      detail: {
        title: r.title, body: r.body ?? "", link: r.link ?? "",
        type: r.type, audience: r.audience, email: !!r.email_sent,
      },
    }));
  };

  const reuseScheduled = (s: any) => {
    window.dispatchEvent(new CustomEvent("bcast:reuse", {
      detail: { title: s.title, body: "", link: "", type: "broadcast", audience: s.audience, email: !!s.email },
    }));
  };

  const copyLink = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1400);
    } catch { /* portapapeles bloqueado */ }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.audience] = (c[r.audience] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = rows.filter((r) => {
    if (filter && r.audience !== filter) return false;
    if (!q.trim()) return true;
    const hay = `${r.title ?? ""} ${r.body ?? ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div className="vertigo-card bcast-hist-card" style={{ maxWidth: 1180, marginTop: 24, padding: 0, overflow: "hidden" }}>
      <div className="bcast-hist-head">
        <div className="bcast-hist-title">
          <History size={18} style={{ color: "var(--vertigo-purple-soft)" }} />
          Historial de envíos
          <span className="bcast-hist-total">{rows.length}</span>
        </div>
        <div className="bcast-hist-tools">
          <label className="bcast-search">
            <Search size={13} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar título o mensaje…" aria-label="Buscar en historial" />
            {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar"><X size={12} /></button>}
          </label>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="bcast-pills" role="group" aria-label="Filtrar por audiencia">
          <button type="button" className={`bcast-pill ${filter === null ? "is-active" : ""}`} onClick={() => setFilter(null)}>
            Todos <b>{rows.length}</b>
          </button>
          {Object.entries(counts).map(([aud, n]) => {
            const { Icon } = AUDIENCE_ICON[aud] ?? AUDIENCE_ICON.all;
            return (
              <button
                key={aud} type="button"
                className={`bcast-pill ${filter === aud ? "is-active" : ""}`}
                onClick={() => setFilter(filter === aud ? null : aud)}
              >
                <Icon size={12} /> {AUDIENCE_LABEL[aud] ?? aud} <b>{n}</b>
              </button>
            );
          })}
        </div>
      )}

      {/* Timeline programados */}
      {scheduled.length > 0 && (
        <div className="bcast-timeline">
          <div className="bcast-timeline-head"><Clock size={13} /> Programados · se entregan solos</div>
          {scheduled.map((s: any, i: number) => {
            const prev = scheduled[i - 1];
            const clash = prev && Math.abs(new Date(s.scheduled_for).getTime() - new Date(prev.scheduled_for).getTime()) < 2 * 3600_000;
            return (
              <div key={s.id} className="bcast-tl-row">
                <span className="bcast-tl-dot" />
                {i < scheduled.length - 1 && <span className="bcast-tl-line" />}
                <div className="bcast-tl-card">
                  <div className="bcast-tl-main">
                    <b>{s.title}</b>
                    <span className="bcast-hist-meta">
                      {AUDIENCE_LABEL[s.audience] ?? s.audience}
                      <span className="sep">·</span> {fmt.weekdayShortTime(s.scheduled_for)}
                      {s.email && <><span className="sep">·</span><span className="bcast-hist-mail"><Mail size={9} />EMAIL</span></>}
                      {clash && <span className="bcast-clash">muy pegado al anterior</span>}
                    </span>
                  </div>
                  <div className="bcast-tl-actions">
                    <button type="button" className="bcast-mini" onClick={() => reuseScheduled(s)} title="Cargar como borrador">
                      <Copy size={11} /> Duplicar
                    </button>
                    {confirmId === s.id ? (
                      <span className="bcast-confirm-inline">
                        ¿Cancelar?
                        <button type="button" className="bcast-mini danger" disabled={cancelling === s.id} onClick={() => cancel(s.id)}>
                          {cancelling === s.id ? "Cancelando…" : "Sí, cancelar"}
                        </button>
                        <button type="button" className="bcast-mini" onClick={() => setConfirmId(null)}>No</button>
                      </span>
                    ) : (
                      <button type="button" className="bcast-mini danger" onClick={() => { setConfirmId(s.id); setCancelMsg(null); }}>
                        <X size={11} /> Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {cancelMsg && <p className="bcast-warn" style={{ margin: "0 24px 14px" }}>{cancelMsg}</p>}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="vertigo-empty" style={{ padding: "40px 24px 48px" }}>
          <History className="mx-auto mb-4" style={{ width: 44, height: 44, color: "var(--vertigo-faint)" }} strokeWidth={1} />
          <div className="vertigo-empty-title">{filter || q ? "Sin resultados" : "Todavía no enviaste ningún aviso"}</div>
          <p className="vertigo-empty-desc">
            {filter || q ? "Probá con otra audiencia o limpiá el buscador." : "Cada broadcast queda registrado acá, con emisor, audiencia y horario."}
          </p>
          {!filter && !q && (
            <Link href="#redactar" className="vertigo-btn vertigo-btn-ghost" style={{ marginTop: 18 }}>Redactar el primero</Link>
          )}
        </div>
      ) : (
        <div>
          {visible.map((r: any) => {
            const sender = r.sent_by?.display_name || r.sent_by?.email?.split("@")[0] || "Cuenta eliminada";
            const { Icon } = AUDIENCE_ICON[r.audience] ?? AUDIENCE_ICON.all;
            return (
              <details key={r.id} className="bcast-hist-row">
                <summary>
                  <span className="bcast-hist-icon" title={AUDIENCE_LABEL[r.audience] ?? r.audience}><Icon size={16} /></span>
                  <span className="bcast-hist-main">
                    <span className="bcast-hist-title-line">
                      {r.title}
                      {r.email_sent && <span className="bcast-hist-mail"><Mail size={9} />EMAIL</span>}
                      <span className="bcast-type">{TYPE_LABEL[r.type] ?? r.type}</span>
                    </span>
                    <span className="bcast-hist-meta">
                      <b>{AUDIENCE_LABEL[r.audience] ?? r.audience}</b>
                      <span className="sep">·</span>
                      <span>{r.targets} destinatario{r.targets === 1 ? "" : "s"}</span>
                      <span className="sep">·</span>
                      <span>por <b>{sender}</b></span>
                      <span className="sep">·</span>
                      {fmt.dayMonTime(r.sent_at)}
                    </span>
                  </span>
                  <ChevronDown size={15} className="bcast-hist-chev" />
                </summary>
                <div className="bcast-hist-detail">
                  {r.body || "El aviso no tenía mensaje (solo título)."}
                  <div className="bcast-detail-actions">
                    {r.link && (
                      <Link href={r.link} className="bcast-hist-link"><ExternalLink size={11} />{r.link}</Link>
                    )}
                    <span style={{ display: "inline-flex", gap: 8, marginLeft: "auto" }}>
                      {r.link && (
                        <button type="button" className="bcast-mini" onClick={() => copyLink(r.id, r.link)} title="Copiar link">
                          {copied === r.id ? <Check size={11} /> : <Copy size={11} />} {copied === r.id ? "Copiado" : "Copiar link"}
                        </button>
                      )}
                      <button type="button" className="bcast-mini gold" onClick={() => reuse(r)} title="Cargar este aviso como borrador nuevo">
                        <Copy size={11} /> Reutilizar
                      </button>
                    </span>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
