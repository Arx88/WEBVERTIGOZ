"use client";

/**
 * BroadcastComposer — centro de comando (rediseño visual premium).
 * Hero intacto. Todo lo demás reimaginado:
 *  - Stepper 01 Contenido / 02 Audiencia / 03 Envío
 *  - Galería de plantillas + variables {{equipo}} {{torneo}}
 *  - Audiencia como cards con alcance por canal + avatares
 *  - Preview multicapa: Campana / Toast / Push / Email
 *  - Preflight + type-to-confirm + envío con deshacer (8s)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send, Megaphone, Loader2, Play, Bell, BellRing, Mail, CheckCircle2,
  AlertCircle, Link2, X, Clock, Sparkles, UsersRound, Flag, UserRound,
  Swords, Headphones, Shield, ExternalLink, Undo2, ShieldAlert, Zap, Eye,
} from "lucide-react";
import VertigoSelect from "@/components/admin/vertigo-select";
import type { VertigoOption } from "@/components/admin/vertigo-select";
import VertigoDateTime from "@/components/admin/vertigo-date-time";
import { fmt } from "@/lib/format";
import { iconFor, labelFor } from "@/components/notifications/notification-center";

const AUD_META: Record<string, { label: string; hint: string; Icon: any }> = {
  all: { label: "Todos", hint: "Toda la base", Icon: UsersRound },
  captains: { label: "Capitanes", hint: "Dueños de equipo", Icon: Flag },
  bettors: { label: "Apostadores", hint: "Espectadores", Icon: UserRound },
  players: { label: "Jugadores", hint: "Rol player", Icon: Swords },
  casters: { label: "Casters", hint: "Equipo de relato", Icon: Headphones },
  team: { label: "Un equipo", hint: "Solo su capitán", Icon: Shield },
};

const TYPES: VertigoOption[] = [
  { value: "broadcast", label: "Aviso general" },
  { value: "match_phase", label: "Fase / partido" },
  { value: "match_scheduled", label: "Programado" },
  { value: "bet_open", label: "Apuestas" },
  { value: "match_ready", label: "ESTOY LISTO (apertura llave)" },
  { value: "match_open", label: "Llave habilitada" },
  { value: "match_lineup", label: "Lineup abierto" },
  { value: "comodin_open", label: "Comodines abiertos" },
];

const TEMPLATES: Record<string, { title: string; body: string; tip: string }> = {
  broadcast: { title: "", body: "", tip: "Lienzo en blanco para avisos del staff" },
  match_phase: {
    title: "Arranca la nueva fase del torneo",
    body: "Hola {{equipo}} — los cruces de {{torneo}} ya están sorteados. Revisá tu partido en el bracket y coordiná el horario con tu rival cuanto antes.",
    tip: "Fases, sorteos, arranques",
  },
  match_scheduled: {
    title: "Cambio de horario en tu partido",
    body: "Hola {{equipo}} — tu partido se reprogramó. Mirá el nuevo horario en el fixture y avisale a tu rival si tenés problemas.",
    tip: "Reprogramaciones",
  },
  bet_open: {
    title: "Apuestas abiertas",
    body: "Ya podés apostar tus puntos en los cruces de la ronda de {{torneo}}. El pozo se reparte entre los que acierten.",
    tip: "Apertura de pozo",
  },
  match_ready: {
    title: "Confirmá que estás listo para jugar",
    body: "Hola {{equipo}} — tu llave se habilita pronto. Entrá al partido y marcá “Estoy listo” para arrancar a tiempo.",
    tip: "Apertura de llave",
  },
  match_open: {
    title: "Tu llave está habilitada",
    body: "Hola {{equipo}} — el partido ya está disponible en {{torneo}}. Cargá el lineup y arranquen cuando estén los dos.",
    tip: "Llave disponible",
  },
  match_lineup: {
    title: "Lineup abierto",
    body: "Hola {{equipo}} — el capitán puede cargar la alineación de {{torneo}}. Tenés tiempo hasta el inicio del partido.",
    tip: "Alineaciones",
  },
  comodin_open: {
    title: "Comodines abiertos",
    body: "Hola {{equipo}} — ya podés usar tus comodines de esta ronda en {{torneo}}: reroll, anular o elegir rival.",
    tip: "Comodines",
  },
};

type Reach = { all: number; captains: number; bettors: number; players: number; casters: number };
type Push = { all: number; captains: number; bettors: number; players: number; casters: number };

function resolveVars(text: string, teamName?: string) {
  return (text || "")
    .replaceAll("{{equipo}}", teamName ?? "tu equipo")
    .replaceAll("{{torneo}}", "VÉRTIGO Cup")
    .replaceAll("{{capitan}}", teamName ? `capitán de ${teamName}` : "capitán");
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "V") + (p[1]?.[0] ?? "")).toUpperCase();
}

export default function BroadcastComposer({
  teams, reach, push, pushPct, samples, scheduled, recent,
}: {
  teams: { id: string; name: string }[];
  reach: Reach;
  push?: Push;
  pushPct?: number;
  samples?: Record<string, string[]>;
  scheduled?: any[];
  recent?: any[];
}) {
  const router = useRouter();
  const [audience, setAudience] = useState("all");
  const [teamId, setTeamId] = useState("");
  const [type, setType] = useState("broadcast");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [tab, setTab] = useState<"bell" | "toast" | "push" | "email">("bell");
  const [pending, setPending] = useState<null | { payload: any; left: number }>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const cleanLink = link.trim();
  const selectedTeam = teams.find((t) => t.id === teamId);
  const teamNeedsPick = audience === "team" && !teamId;

  const previewTitle = resolveVars(cleanTitle || "Título del aviso…", selectedTeam?.name);
  const previewBody = resolveVars(cleanBody, selectedTeam?.name);
  const typeMeta = iconFor(type);
  const TypeIcon = typeMeta.Icon as any;

  // Reutilizar desde el historial: evento global bcast:reuse
  useEffect(() => {
    const h = (e: any) => {
      const d = e.detail ?? {};
      if (d.type) setType(d.type);
      if (typeof d.title === "string") setTitle(d.title);
      if (typeof d.body === "string") setBody(d.body);
      if (typeof d.link === "string") setLink(d.link);
      if (typeof d.audience === "string") setAudience(d.audience);
      if (typeof d.teamAccountId === "string") setTeamId(d.teamAccountId);
      if (typeof d.email === "boolean") setEmail(d.email);
      setResult({ ok: true, msg: "Plantilla cargada del historial — revisá y enviá." });
      document.getElementById("redactar")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => titleRef.current?.focus(), 450);
    };
    window.addEventListener("bcast:reuse", h);
    return () => window.removeEventListener("bcast:reuse", h);
  }, []);

  const reachInfo = useMemo(() => {
    if (audience === "team") {
      return {
        count: selectedTeam ? 1 : 0,
        push: selectedTeam ? Math.min(1, push?.all ? 1 : 0) : 0,
        detail: selectedTeam ? `Capitán de ${selectedTeam.name}` : "Elegí un equipo",
      };
    }
    const count = reach[audience as keyof Reach] ?? 0;
    const p = push?.[audience as keyof Push] ?? 0;
    const labels: Record<string, string> = {
      all: "Toda la base", captains: "Capitanes", bettors: "Apostadores", players: "Jugadores", casters: "Casters",
    };
    return { count, push: p, detail: labels[audience] ?? audience };
  }, [audience, selectedTeam, reach, push]);

  const linkState = useMemo(() => {
    if (!cleanLink) return { ok: true as boolean | null, msg: "Sin link — abre el centro de notificaciones" };
    if (cleanLink.startsWith("/") && cleanLink.length >= 2) return { ok: true, msg: `Ruta interna válida → ${cleanLink}` };
    if (/^https?:\/\/[^\s]+\.[^\s]+/.test(cleanLink)) return { ok: true, msg: "URL externa válida" };
    return { ok: false, msg: "Link dudoso — usá /ruta-interna o https://…" };
  }, [cleanLink]);

  const titleHealth = title.length <= 70 ? "ok" : title.length <= 120 ? "warn" : "bad";

  const collision = useMemo(() => {
    if (!scheduleMode || !scheduledFor || !scheduled?.length) return null;
    const when = new Date(scheduledFor).getTime();
    if (Number.isNaN(when)) return null;
    const hit = scheduled.find((s: any) => {
      if (s.audience !== audience && audience !== "all" && s.audience !== "all") return false;
      const t = new Date(s.scheduled_for).getTime();
      return Math.abs(t - when) < 2 * 3600_000;
    });
    return hit ?? null;
  }, [scheduleMode, scheduledFor, scheduled, audience]);

  const risky = (audience === "all" && reachInfo.count >= 100) || (email && reachInfo.count >= 50);
  const needsType = risky;
  const typeOk = !needsType || confirmText.trim().toUpperCase() === "ENVIAR";

  const step = !cleanTitle ? 1 : teamNeedsPick || reachInfo.count === 0 ? 2 : 3;

  const validate = (): string | null => {
    if (!cleanTitle) return "El título es obligatorio.";
    if (audience === "team" && !teamId) return "Elegí un equipo para la audiencia.";
    if (linkState.ok === false) return "Revisá el link antes de enviar.";
    if (scheduleMode && !scheduledFor) return "Elegí fecha y hora para el envío programado.";
    if (reachInfo.count === 0) return "La audiencia elegida no tiene cuentas todavía.";
    return null;
  };

  const requestSend = () => {
    setResult(null);
    const err = validate();
    if (err) {
      setResult({ ok: false, msg: err });
      return;
    }
    setConfirmText("");
    setConfirmOpen(true);
  };

  const doPost = async (payload: any) => {
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) setResult({ ok: false, msg: data.error ?? "Error al enviar" });
      else if (data.scheduled) {
        setResult({ ok: true, msg: `Aviso programado para ${fmt.weekdayShortTime(data.scheduledFor)}. Se entrega solo.` });
        setTitle(""); setBody(""); setLink(""); setScheduledFor(""); setScheduleMode(false);
        router.refresh();
      } else if (!data.sent) {
        setResult({ ok: false, msg: "La audiencia no tiene destinatarios — no se envió nada." });
      } else {
        setResult({
          ok: true,
          msg: `Enviado a ${data.sent} ${data.sent === 1 ? "cuenta" : "cuentas"}${data.emails ? ` + ${data.emails} emails` : ""}.`,
        });
        setTitle(""); setBody(""); setLink("");
        router.refresh();
      }
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  // Envío con deshacer: 8s de gracia antes del POST real
  const armSend = () => {
    if (!typeOk || sending) return;
    const payload = {
      audience,
      teamAccountId: audience === "team" ? teamId : undefined,
      type,
      title: resolveVars(cleanTitle, selectedTeam?.name),
      body: resolveVars(cleanBody, selectedTeam?.name) || undefined,
      link: cleanLink || undefined,
      email,
      scheduledFor: scheduleMode && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
    };
    setConfirmOpen(false);
    setPending({ payload, left: 8 });
  };

  useEffect(() => {
    if (!pending) return;
    if (pending.left <= 0) {
      const p = pending.payload;
      // Diferido a callback: evita setState sincrónico en el body del effect
      const t = setTimeout(() => {
        setPending(null);
        void doPost(p);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPending((p) => (p ? { ...p, left: p.left - 1 } : p)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const sendTest = async () => {
    setResult(null);
    if (!cleanTitle) {
      setResult({ ok: false, msg: "El título es obligatorio para la prueba." });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: resolveVars(cleanTitle, selectedTeam?.name),
          body: resolveVars(cleanBody, selectedTeam?.name),
          link: cleanLink,
        }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ ok: false, msg: data.error ?? "Error en la prueba" });
      else setResult({ ok: true, msg: "Prueba en tu campana — mirá el toast arriba a la derecha." });
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, sending]);

  const insertVar = (v: string) => {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => (b ? `${b} ${v}` : v));
      return;
    }
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    const next = body.slice(0, s) + v + body.slice(e);
    setBody(next.slice(0, 400));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + v.length, s + v.length);
    });
  };

  const teamOptions: VertigoOption[] = teams.length
    ? [{ value: "", label: "Elegí un equipo…" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]
    : [{ value: "", label: "No hay equipos registrados" }];

  const sampleList = samples?.[audience] ?? [];

  return (
    <>
      {/* Stepper */}
      <div className="bcast-steps" aria-label="Progreso del aviso">
        {[
          { n: 1, t: "Contenido", done: !!cleanTitle },
          { n: 2, t: "Audiencia", done: !teamNeedsPick && reachInfo.count > 0 },
          { n: 3, t: "Envío", done: false },
        ].map((s, i) => (
          <div key={s.n} className={`bcast-step ${step >= s.n ? "is-on" : ""} ${s.done ? "is-done" : ""}`}>
            <span className="bcast-step-n">{s.done ? "✓" : `0${s.n}`}</span>
            <span className="bcast-step-t">{s.t}</span>
            {i < 2 && <span className="bcast-step-line" />}
          </div>
        ))}
        <span className="bcast-steps-live" aria-live="polite">
          <Eye size={11} /> {reachInfo.count} cuentas · push ~{reachInfo.push}
        </span>
      </div>

      <div className="bcast-grid">
        {/* ── Composer ── */}
        <div className="vertigo-card bcast-card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="bcast-card-head">
            <span className="bcast-card-icon"><Megaphone size={17} /></span>
            <div>
              <div className="bcast-card-title">Redactar aviso</div>
              <div className="bcast-card-sub">Plantilla → contenido → audiencia → envío con deshacer</div>
            </div>
            <span className="bcast-card-chip"><Zap size={11} /> en vivo</span>
          </div>

          <div className="bcast-body">
            {/* 01 Formato */}
            <section className="bcast-section">
            <header className="bcast-sec-head">
              <span className="bcast-sec-num">01</span>
              <div><h3>Formato del aviso</h3><p>Elegí una base — después lo pulís a tu tono.</p></div>
            </header>
            <div className="bcast-tpl-grid" role="listbox" aria-label="Plantillas">
              {TYPES.map((o) => {
                const m = iconFor(o.value);
                const active = type === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    title={TEMPLATES[o.value]?.tip ?? o.label}
                    className={`bcast-tpl ${active ? "is-active" : ""}`}
                    onClick={() => {
                      setType(o.value);
                      const t = TEMPLATES[o.value];
                      if (t?.title) setTitle(t.title);
                      if (t && "body" in t && t.body) setBody(t.body);
                    }}
                  >
                    <m.Icon size={17} className={m.className} />
                    <span className="bcast-tpl-t">{o.label}</span>
                    <span className="bcast-tpl-tip">{TEMPLATES[o.value]?.tip ?? ""}</span>
                  </button>
                );
              })}
            </div>
            </section>

            {/* 02 Contenido */}
            <section className="bcast-section">
            <header className="bcast-sec-head">
              <span className="bcast-sec-num">02</span>
              <div><h3>Contenido</h3><p>Lo esencial primero. Corto llega más lejos.</p></div>
            </header>
            <div className="vertigo-field">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <label htmlFor="bcast-title" style={{ marginBottom: 0 }}>Título *</label>
                <span className={`bcast-count ${titleHealth}`}>{title.length}/160 · ideal ≤70</span>
              </div>
              <input
                id="bcast-title" ref={titleRef} value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Se confirma la fase de grupos"
                maxLength={160}
              />
              <div className={`bcast-health ${titleHealth}`}><i style={{ width: `${Math.min(100, (title.length / 160) * 100)}%` }} /></div>
              {title.length > 70 && title.length <= 120 && (
                <p className="vertigo-hint">Se va a truncar en push/toast. Probá “Afilar”.</p>
              )}
              {title.length > 120 && (
                <p className="vertigo-hint" style={{ color: "var(--vertigo-warning)" }}>Muy largo: se corta en la campana.</p>
              )}
              <div className="bcast-tools">
                <button type="button" className="bcast-mini" onClick={() => setTitle((t) => t.split("—")[0].split(":")[0].slice(0, 70).trim())} title="Acortar al tramo principal">
                  <Sparkles size={11} /> Afilar título
                </button>
                <span className="bcast-tools-sep">Variables:</span>
                <button type="button" className="bcast-mini quiet" onClick={() => insertVar("{{equipo}}")} title="Inserta el nombre del equipo en el mensaje">{"{{equipo}}"}</button>
                <button type="button" className="bcast-mini quiet" onClick={() => insertVar("{{torneo}}")}>{"{{torneo}}"}</button>
              </div>
            </div>

            <div className="vertigo-field bcast-field">
              <div className="bcast-labelrow">
                <label htmlFor="bcast-body" style={{ marginBottom: 0 }}>Mensaje</label>
                <span className="bcast-count">{body.length}/400</span>
              </div>
              <textarea
                id="bcast-body" ref={bodyRef} value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Detalle (opcional). Podés usar {{equipo}} y {{torneo}}."
                rows={4} maxLength={400}
              />
            </div>

            <div className="vertigo-field bcast-field" style={{ marginBottom: 0 }}>
              <label htmlFor="bcast-link">Link <em>(opcional)</em></label>
              <div className="bcast-linkrow">
                <input id="bcast-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder="/partido/abc… o https://…" />
                {cleanLink && linkState.ok && (
                  <a className="bcast-mini" href={cleanLink.startsWith("/") ? cleanLink : cleanLink} target="_blank" rel="noreferrer" title="Abrir destino en pestaña nueva">
                    <ExternalLink size={11} /> Abrir
                  </a>
                )}
              </div>
              <p className={`vertigo-hint ${linkState.ok === false ? "bcast-err" : ""} bcast-hint`}>
                <Link2 size={11} /> {linkState.msg}
              </p>
            </div>
            </section>

            {/* 03 Audiencia */}
            <section className="bcast-section">
            <header className="bcast-sec-head">
              <span className="bcast-sec-num">02</span>
              <div><h3>Audiencia</h3><p>Una sola audiencia por envío. El alcance se calcula en vivo.</p></div>
            </header>
            <div className="bcast-aud-grid" role="radiogroup" aria-label="Audiencia">
              {Object.entries(AUD_META).map(([v, m]) => {
                const count = v === "team" ? teams.length : (reach[v as keyof Reach] ?? 0);
                const p = v === "team" ? undefined : push?.[v as keyof Push];
                const active = audience === v;
                return (
                  <button
                    key={v} type="button" role="radio" aria-checked={active}
                    className={`bcast-aud ${active ? "is-active" : ""}`}
                    onClick={() => setAudience(v)}
                  >
                    <m.Icon size={16} />
                    <b>{m.label}</b>
                    <small>{m.hint}</small>
                    <span className="bcast-aud-n">{v === "team" ? `${count} eq.` : `${count}`}</span>
                    {p !== undefined && <span className="bcast-aud-p">push ~{p}</span>}
                  </button>
                );
              })}
            </div>

            {audience === "team" && (
              <div className="vertigo-field bcast-teamfield">
                <label htmlFor="bcast-team">Equipo <em>— llega solo a su capitán</em></label>
                <VertigoSelect defaultValue="" options={teamOptions} onValueChange={(v) => setTeamId(v)} />
              </div>
            )}

            <div className="bcast-reach" aria-live="polite">
              <div className="bcast-reach-top">
                <span className="bcast-reach-big">~{reachInfo.count} <em>{reachInfo.count === 1 ? "cuenta" : "cuentas"}</em></span>
                <span className="bcast-reach-detail">{reachInfo.detail} · {labelFor(type)}</span>
              </div>
              <div className="bcast-reach-chans">
                <span className="bcast-reach-chan"><Bell size={11} /> In-app {reachInfo.count}</span>
                <span className="bcast-reach-chan"><BellRing size={11} /> Push ~{reachInfo.push}</span>
                <span className={`bcast-reach-chan ${email ? "is-on" : ""}`}><Mail size={11} /> Email {email ? reachInfo.count : "off"}</span>
              </div>
              {sampleList.length > 0 && audience !== "team" && (
                <div className="bcast-avatars">
                  {sampleList.slice(0, 5).map((n, i) => (
                    <span key={i} className="bcast-avatar" title={n}>{initials(n)}</span>
                  ))}
                  <span className="bcast-avatars-more">+{Math.max(0, reachInfo.count - sampleList.length)} más</span>
                </div>
              )}
            </div>
            </section>

            {/* 04 Envío */}
            <section className="bcast-section">
            <header className="bcast-sec-head">
              <span className="bcast-sec-num">03</span>
              <div><h3>Canales y envío</h3><p>Definí cómo sale. Siempre podés probar antes y deshacer después.</p></div>
            </header>
            <div className="bcast-toggles">
            <label htmlFor="bcast-email" className="bcast-toggle">
              <input id="bcast-email" type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              <span className="bcast-toggle-main"><Mail size={15} /><span><b>Enviar también por email</b><small>Cola notify-email · mismo título y mensaje</small></span></span>
            </label>
            <label htmlFor="bcast-schedule-toggle" className="bcast-toggle">
              <input
                id="bcast-schedule-toggle" type="checkbox" checked={scheduleMode}
                onChange={(e) => { setScheduleMode(e.target.checked); if (!e.target.checked) setScheduledFor(""); }}
              />
              <span className="bcast-toggle-main"><Clock size={15} /><span><b>Programar para más tarde</b><small>Se entrega solo a la hora elegida</small></span></span>
            </label>
            </div>
            {scheduleMode && (
              <div className="bcast-schedulebox">
                <VertigoDateTime name="bcast-when" onValueChange={(v) => setScheduledFor(v)} />
                {scheduledFor && (
                  <p className="vertigo-hint bcast-hint">Se envía el {fmt.longDateTime(scheduledFor)} (hora de Argentina).</p>
                )}
                {collision && (
                  <p className="bcast-warn"><ShieldAlert size={12} /> Colisiona con “{collision.title}” ({fmt.weekdayShortTime(collision.scheduled_for)}). Separalos 2hs.</p>
                )}
              </div>
            )}

            <div className="bcast-actions">
              <button className="vertigo-btn vertigo-btn-primary bcast-cta" onClick={requestSend} disabled={sending || !cleanTitle || teamNeedsPick}>
                {sending ? <Loader2 size={15} className="spin" /> : scheduleMode ? <Clock size={15} /> : <Send size={15} />}
                {sending ? "Enviando…" : scheduleMode ? "Revisar y agendar" : "Revisar y enviar"}
              </button>
              <button className="vertigo-btn vertigo-btn-ghost" onClick={sendTest} disabled={sending || !cleanTitle} title="Manda el borrador a tu campana">
                {sending ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Probar en mí
              </button>
              <div aria-live="polite" style={{ flexBasis: "100%" }}>
                {result && (
                  <div className={`bcast-alert ${result.ok ? "bcast-alert-ok" : "bcast-alert-err"}`}>
                    {result.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{result.msg}</span>
                  </div>
                )}
              </div>
            </div>
            </section>
          </div>
        </div>

        {/* ── Preview multicapa ── */}
        <div className="bcast-preview-sticky">
          <div className="bcast-preview">
            <div className="bcast-preview-tag"><BellRing size={12} /> Vista previa — lo que ven ellos</div>
            <div className="bcast-tabs" role="tablist" aria-label="Canales">
              {(["bell", "toast", "push", "email"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={`bcast-tab ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
                  {t === "bell" ? "Campana" : t === "toast" ? "Toast" : t === "push" ? "Push" : "Email"}
                </button>
              ))}
            </div>

            {tab === "bell" && (
              <div className="bcast-bell-mirror" aria-live="polite">
                <div className="bcast-bell-head"><span>Notificaciones</span><Bell size={13} style={{ color: "#6b6378" }} /></div>
                <div className="bcast-bell-row">
                  <span className="bcast-row-icon"><TypeIcon size={15} className={typeMeta.className} /></span>
                  <span className="bcast-bell-main">
                    <span className="bcast-bell-kicker">{labelFor(type)}</span>
                    <span className="bcast-bell-title">
                      <span className="bcast-bell-dot" />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: cleanTitle ? undefined : "#5f5870" }}>
                        {previewTitle}
                      </span>
                    </span>
                    {previewBody ? <span className="bcast-bell-body">{previewBody}</span> : null}
                  </span>
                  <span className="bcast-bell-time">ahora</span>
                </div>
              </div>
            )}

            {tab === "toast" && (
              <div className="bcast-toast-mirror">
                <span className={`bcast-toast-icon ${typeMeta.className}`}><TypeIcon size={20} /></span>
                <span className="bcast-toast-main">
                  <span className="bcast-toast-kicker">{labelFor(type)}</span>
                  <span className="bcast-toast-title">{previewTitle}</span>
                  {previewBody && <span className="bcast-toast-body">{previewBody}</span>}
                </span>
                <X size={13} style={{ color: "#6b6378" }} />
              </div>
            )}

            {tab === "push" && (
              <div className="bcast-push-mirror">
                <div className="bcast-push-app"><span className="bcast-push-logo">V</span> VÉRTIGO CUP · ahora</div>
                <div className="bcast-push-title">{previewTitle.slice(0, 90)}</div>
                {previewBody && <div className="bcast-push-body">{previewBody.slice(0, 140)}</div>}
                {previewTitle.length > 90 && <div className="bcast-push-cut">+ se recorta en el sistema</div>}
              </div>
            )}

            {tab === "email" && (
              <div className={`bcast-email-mirror ${email ? "" : "is-off"}`}>
                <div className="bcast-email-subject">{previewTitle || "Asunto del email…"}</div>
                <div className="bcast-email-pre">{previewBody?.slice(0, 90) || "Preheader…"}</div>
                <div className="bcast-email-body">{previewBody || "El cuerpo del email usa el mismo mensaje."}</div>
                {cleanLink && <span className="bcast-email-cta">Ver en VÉRTIGO Cup →</span>}
                {!email && <div className="bcast-email-off">Email apagado — activalo para incluirlo</div>}
              </div>
            )}

            <div className="bcast-channels">
              <span className="bcast-channel-chip is-on"><Bell size={10} /> In-app</span>
              <button type="button" className={`bcast-channel-chip ${email ? "is-on" : ""}`} onClick={() => setEmail((v) => !v)} aria-pressed={email}>
                <Mail size={10} /> Email
              </button>
              <span className="bcast-channel-chip is-locked" title="Push automática si el usuario la activó">Push · auto ~{reachInfo.push}</span>
            </div>

            <p className="vertigo-hint" style={{ margin: 0 }}>
              Espejo fiel: mismo icono, color y kicker que la campana real. “Probar en mí” lo manda de verdad a tu cuenta.
            </p>
          </div>
        </div>
      </div>

      {/* Barra deshacer */}
      {pending && (
        <div className="bcast-undo" role="status">
          <Undo2 size={15} />
          <span>Enviando en <b>{pending.left}s</b> a ~{reachInfo.count}…</span>
          <span className="bcast-undo-bar"><i style={{ width: `${(pending.left / 8) * 100}%` }} /></span>
          <button type="button" onClick={() => setPending(null)}>Deshacer</button>
        </div>
      )}

      {/* Modal preflight */}
      {confirmOpen && (
        <div className="bcast-modal" onClick={() => !sending && setConfirmOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Confirmar envío" onClick={(e) => e.stopPropagation()} className="bcast-modal-card">
            <div className="bcast-modal-top">
              <span className="bcast-modal-ico"><Megaphone size={19} /></span>
              <div style={{ flex: 1 }}>
                <h3>Confirmar envío</h3>
                <p>Llega al instante a la campana y queda en el historial. Tenés 8s para deshacer después.</p>
              </div>
              <button type="button" onClick={() => setConfirmOpen(false)} aria-label="Cerrar" className="bcast-x"><X size={14} /></button>
            </div>

            <div className="bcast-sum">
              {[
                { k: "Audiencia", v: `${AUD_META[audience]?.label}${audience === "team" && selectedTeam ? ` — ${selectedTeam.name}` : ""}` },
                { k: "Alcance", v: `~${reachInfo.count} in-app · ~${reachInfo.push} push${email ? ` · ${reachInfo.count} email` : ""}` },
                { k: "Título", v: resolveVars(cleanTitle, selectedTeam?.name) },
                { k: "Mensaje", v: resolveVars(cleanBody, selectedTeam?.name) || "—" },
                { k: "Cuándo", v: scheduleMode && scheduledFor ? fmt.weekdayShortTime(scheduledFor) : "Ahora mismo" },
              ].map((row, i) => (
                <div key={row.k} className="bcast-sum-row" style={{ borderTop: i === 0 ? "none" : undefined }}>
                  <span>{row.k}</span><b>{row.v}</b>
                </div>
              ))}
            </div>

            <div className="bcast-checks">
              <span className="bcast-check ok"><CheckCircle2 size={12} /> Título {title.length} chars</span>
              <span className={`bcast-check ${reachInfo.count > 0 ? "ok" : "bad"}`}>
                {reachInfo.count > 0 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />} {reachInfo.count} destinatarios
              </span>
              <span className={`bcast-check ${linkState.ok === false ? "bad" : "ok"}`}>
                {linkState.ok === false ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />} Link {cleanLink ? "válido" : "opcional"}
              </span>
              {collision && <span className="bcast-check bad"><AlertCircle size={12} /> Colisiona con otro programado</span>}
              {email && risky && <span className="bcast-check warn"><ShieldAlert size={12} /> Masivo + email: doble impacto</span>}
            </div>

            {needsType && (
              <div className="bcast-typecheck">
                <label htmlFor="bcast-confirm-text">Escribí <b>ENVIAR</b> para desbloquear (llega a ~{reachInfo.count})</label>
                <input id="bcast-confirm-text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ENVIAR" autoComplete="off" />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button className="vertigo-btn vertigo-btn-ghost" onClick={() => setConfirmOpen(false)}>Volver</button>
              <button className="vertigo-btn vertigo-btn-primary" onClick={armSend} disabled={!typeOk}>
                {scheduleMode ? <Clock size={15} /> : <Send size={15} />}
                {scheduleMode ? "Agendar aviso" : "Enviar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
