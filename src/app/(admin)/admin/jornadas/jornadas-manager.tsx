"use client";

/**
 * Jornadas v2 — claro antes que compacto:
 * - Una jornada a la vez (tabs) → cero scroll eterno, mapa siempre visible
 * - Cards explícitas: estado, equipos, hora, [Editar horario] + [Abrir llave]
 * - El form aparece solo al pedirlo; solape <2hs se avisa en contexto
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight, Clock, Pencil, Save, Search, X } from "lucide-react";
import VertigoDateTime from "@/components/admin/vertigo-date-time";
import LocalTime from "@/components/shared/local-time";
import { scheduleMatchFormAction } from "@/server/actions/tournament";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function JornadasManager({
  matches, order, meta,
}: {
  matches: any[];
  order: string[];
  meta: Record<string, { cls: string; dot: string; label: string }>;
}) {
  const [active, setActive] = useState(order[0] ?? "");
  const [q, setQ] = useState("");
  const [soloSinHora, setSoloSinHora] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const clashIds = useMemo(() => {
    const timed = (matches ?? []).filter((m) => m.scheduled_at_start).sort((a, b) =>
      new Date(a.scheduled_at_start).getTime() - new Date(b.scheduled_at_start).getTime());
    const s = new Set<string>();
    for (let i = 1; i < timed.length; i++) {
      const diff = new Date(timed[i].scheduled_at_start).getTime() - new Date(timed[i - 1].scheduled_at_start).getTime();
      if (diff < 2 * 3600_000) { s.add(timed[i].id); s.add(timed[i - 1].id); }
    }
    return s;
  }, [matches]);

  const counts = useMemo(() => {
    const c = new Map<string, { total: number; sinHora: number; clash: number }>();
    for (const label of order) {
      const rows = (matches ?? []).filter((m) => (m.jornada_label ?? "Sin jornada") === label);
      c.set(label, {
        total: rows.length,
        sinHora: rows.filter((m) => !m.scheduled_at_start).length,
        clash: rows.filter((m) => clashIds.has(m.id)).length,
      });
    }
    return c;
  }, [matches, order, clashIds]);

  const rows = useMemo(() => {
    const hay = q.trim().toLowerCase();
    return (matches ?? [])
      .filter((m) => (m.jornada_label ?? "Sin jornada") === active)
      .filter((m) => (soloSinHora ? !m.scheduled_at_start : true))
      .filter((m) => {
        if (!hay) return true;
        const a = m.team_a?.team_account?.name ?? "";
        const b = m.team_b?.team_account?.name ?? "";
        return `${a} ${b}`.toLowerCase().includes(hay);
      });
  }, [matches, active, q, soloSinHora]);

  const activeCount = counts.get(active);

  return (
    <div>
      {/* Tabs de jornada — el mapa, siempre visible */}
      <div className="jor2-tabs" role="tablist" aria-label="Jornadas">
        {order.map((label) => {
          const c = counts.get(label);
          const isOn = label === active;
          return (
            <button
              key={label} role="tab" aria-selected={isOn}
              className={`jor2-tab ${isOn ? "is-active" : ""}`}
              onClick={() => { setActive(label); setEditing(null); }}
            >
              <b>{label}</b>
              <span>{c?.total ?? 0}</span>
              {(c?.sinHora ?? 0) > 0 && <i className="is-warn" title={`${c?.sinHora} sin hora`}>{c?.sinHora}⏰</i>}
              {(c?.clash ?? 0) > 0 && <i className="is-bad" title="Solape <2hs">⚠</i>}
            </button>
          );
        })}
      </div>

      {/* Toolbar simple: buscar + solo sin hora */}
      <div className="jor2-tools">
        <label className="jor2-search">
          <Search size={13} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar equipo en ${active}…`} aria-label="Buscar equipo" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Limpiar"><X size={12} /></button>}
        </label>
        <button
          type="button"
          className={`jor2-toggle ${soloSinHora ? "is-active" : ""}`}
          onClick={() => setSoloSinHora((v) => !v)}
          aria-pressed={soloSinHora}
        >
          <Clock size={12} /> Solo sin hora
        </button>
        <span className="jor2-hint">
          {rows.length} partido{rows.length === 1 ? "" : "s"}
          {activeCount && activeCount.clash > 0 ? ` · ${activeCount.clash} con solape <2hs` : " · single stream: ≥2hs entre partidos"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="vertigo-card"><div className="vertigo-empty">
          <div className="vertigo-empty-title">Nada acá</div>
          <p className="vertigo-empty-desc">{soloSinHora ? "Todo programado en esta jornada. 👏" : "Probá con otra búsqueda."}</p>
        </div></div>
      ) : (
        <div className="jor2-list">
          {rows.map((m: any) => {
            const mm = meta[m.status] ?? meta.scheduled;
            const a = m.team_a?.team_account?.name ?? "Por definir";
            const b = m.team_b?.team_account?.name ?? "Por definir";
            const ea = m.team_a?.team_account?.emblem?.image_url ?? null;
            const eb = m.team_b?.team_account?.emblem?.image_url ?? null;
            // Misma regla que el backend: solo bloquea terminado y W.O. con ganador
            const locked = m.status === "finished" || (m.status === "forfeit" && !!m.winner_team_id);
            const editable = !locked;
            const needsReset = editable && m.status !== "scheduled" && !!(m.ready_a_at || m.ready_b_at);
            const liveWarn = editable && ["open", "drawing", "lineup", "comodin_window", "in_progress"].includes(m.status);
            const isEd = editing === m.id;
            const isClash = clashIds.has(m.id);
            return (
              <article key={m.id} className={`jor2-card ${isClash ? "is-clash" : ""}`}>
                <header className="jor2-head">
                  <span className={`vertigo-badge ${mm.cls}`}>
                    <span className="vertigo-status-dot" style={{ background: mm.dot }} />
                    {mm.label}
                  </span>
                  <span className="jor2-sub">{m.round?.name ?? "Ronda"} · slot {m.slot_index}</span>
                  {m.format && <span className="vertigo-badge vertigo-badge-purple">{m.format}</span>}
                  {isClash && <span className="jor2-clash"><AlertTriangle size={10} /> A &lt;2hs de otro</span>}
                </header>

                <div className="jor2-vs">
                  <span className="jor2-side">
                    {ea
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={ea} alt="" className="jor2-emblem" loading="lazy" />
                      : <span className="jor2-emblem-fb" aria-hidden>{(a.trim()[0] ?? "V").toUpperCase()}</span>}
                    <span className="jor2-team">{a}</span>
                    {m.team_a?.seed != null && <span className="jor2-seed">Seed #{m.team_a.seed}</span>}
                  </span>
                  <span className="jor2-vslabel">vs</span>
                  <span className="jor2-side">
                    {eb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={eb} alt="" className="jor2-emblem" loading="lazy" />
                      : <span className="jor2-emblem-fb" aria-hidden>{(b.trim()[0] ?? "V").toUpperCase()}</span>}
                    <span className="jor2-team">{b}</span>
                    {m.team_b?.seed != null && <span className="jor2-seed">Seed #{m.team_b.seed}</span>}
                  </span>
                </div>

                <div className="jor2-when">
                  <CalendarClock size={13} />
                  {m.scheduled_at_start
                    ? <LocalTime value={m.scheduled_at_start} variant="dayMonTime" />
                    : <b className="jor2-nt">Sin hora asignada</b>}
                </div>

                {isEd && editable ? (
                  <form action={scheduleMatchFormAction} className="jor2-form">
                    <input type="hidden" name="match_id" value={m.id} />
                    {needsReset && (
                      <p className="jor2-warn"><AlertTriangle size={12} /> Ya hay confirmaciones “Estoy listo” — al guardar se reinician y los equipos reconfirman.</p>
                    )}
                    {liveWarn && !needsReset && (
                      <p className="jor2-warn"><AlertTriangle size={12} /> Llave en curso — reprogramar la mueve igual. Avisá en el chat del partido.</p>
                    )}
                    <div className="jor2-f">
                      <label>Inicio</label>
                      <VertigoDateTime name="scheduled_at_start" defaultValue={m.scheduled_at_start ? toLocalInput(m.scheduled_at_start) : ""} required />
                    </div>
                    <div className="jor2-f jor2-fsm">
                      <label>Jornada</label>
                      <input type="text" name="jornada_label" defaultValue={m.jornada_label ?? ""} placeholder="Jornada 1" />
                    </div>
                    <div className="jor2-formbtns">
                      <button type="submit" className="vertigo-btn vertigo-btn-primary"><Save size={13} /> {m.scheduled_at_start ? "Guardar cambios" : "Programar"}</button>
                      <button type="button" className="vertigo-btn vertigo-btn-ghost" onClick={() => setEditing(null)}>Cerrar</button>
                    </div>
                  </form>
                ) : (
                  <footer className="jor2-foot">
                    {editable ? (
                      <button type="button" className="vertigo-btn vertigo-btn-primary jor2-edit" onClick={() => setEditing(m.id)}>
                        <Pencil size={12} /> {m.scheduled_at_start ? "Editar horario" : "Programar"}
                      </button>
                    ) : (
                      <span className="jor2-locked">Finalizado — no se puede reprogramar.</span>
                    )}
                    <Link href={`/admin/partido/${m.id}`} className="vertigo-btn vertigo-btn-ghost">
                      Abrir llave <ChevronRight size={12} />
                    </Link>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
