"use client";

/**
 * BroadcastComposer — rediseño del composer de notificaciones masivas.
 *
 * Principios UI/UX aplicados:
 *  - Vista previa en vivo que ESPEJA la campana real (mismo template visual
 *    que .notif-panel): lo que el admin ve es lo que el usuario recibe.
 *  - Footer de acciones con jerarquía clara (primaria = enviar) y feedback
 *    de resultado como alerta accesible (aria-live), no texto suelto.
 *  - Envío destructivo-ish (masivo) protegido: modal de confirmación con el
 *    resumen real (audiencia, alcance, email) antes de disparar.
 *  - Contadores y validación progresiva: el estado del form siempre visible
 *    (alcance estimado, límites de caracteres), errores solo cuando aplican.
 *
 * Audiencias: all | captains | bettors | players | casters | team.
 * Email opcional → encola en email_queue (lo drena la Edge Function).
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Send,
  Megaphone,
  Loader2,
  Play,
  Bell,
  BellRing,
  Mail,
  CheckCircle2,
  AlertCircle,
  Link2,
  X,
  Clock,
} from "lucide-react";
import VertigoSelect from "@/components/admin/vertigo-select";
import type { VertigoOption } from "@/components/admin/vertigo-select";
import VertigoDateTime from "@/components/admin/vertigo-date-time";
import { iconFor, labelFor } from "@/components/notifications/notification-center";

const AUDIENCES: VertigoOption[] = [
  { value: "all", label: "Todos los usuarios" },
  { value: "captains", label: "Capitanes (dueños de equipos)" },
  { value: "bettors", label: "Apostadores (espectadores)" },
  { value: "players", label: "Jugadores" },
  { value: "casters", label: "Casters" },
  { value: "team", label: "Un equipo específico" },
];

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

/**
 * Plantillas por tipo de aviso: pre-cargan título y mensaje para no
 * reescribir lo mismo en cada fase. Se pueden editar libremente.
 */
const TEMPLATES: Record<string, { title: string; body: string }> = {
  broadcast: {
    title: "",
    body: "",
  },
  match_phase: {
    title: "Arranca la nueva fase del torneo",
    body: "Los cruces ya están sorteados. Revisá tu partido en el bracket y coordiná el horario con tu rival cuanto antes.",
  },
  match_scheduled: {
    title: "Cambio de horario en tu partido",
    body: "El partido se reprogramó. Mirá el nuevo horario en el fixture — avisale a tu rival si tenés problemas.",
  },
  bet_open: {
    title: "Apuestas abiertas",
    body: "Ya podés apostar tus puntos en los cruces de la ronda. El pozo se reparte entre los que acierten el resultado.",
  },
  match_ready: {
    title: "Confirmá que estás listo para jugar",
    body: "Tu llave se habilita pronto. Entrá al partido y marcá “Estoy listo” para que arranque a tiempo.",
  },
  match_open: {
    title: "Tu llave está habilitada",
    body: "El partido ya está disponible. Cargá el lineup y arraquen cuando estén los dos.",
  },
  match_lineup: {
    title: "Lineup abierto",
    body: "El capitán puede cargar la alineación. Tenés tiempo hasta el inicio del partido.",
  },
  comodin_open: {
    title: "Comodines abiertos",
    body: "Ya podés usar tus comodines de esta ronda: reroll, anular o elegir rival. Revisá las reglas en el handbook.",
  },
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: "Todos",
  captains: "Capitanes",
  bettors: "Apostadores",
  players: "Jugadores",
  casters: "Casters",
  team: "Equipo",
};

type Reach = {
  all: number;
  captains: number;
  bettors: number;
  players: number;
  casters: number;
};

export default function BroadcastComposer({
  teams,
  reach,
}: {
  teams: { id: string; name: string }[];
  reach: Reach;
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
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");

  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const cleanLink = link.trim();
  const titleLen = title.length;

  const selectedTeam = teams.find((t) => t.id === teamId);
  const teamNeedsPick = audience === "team" && !teamId;
  const canSend = !!cleanTitle && !teamNeedsPick;

  /** Alcance estimado de la audiencia elegida (desde los contadores reales). */
  const reachInfo = useMemo(() => {
    if (audience === "team") {
      return selectedTeam
        ? { count: 1, detail: `Capitán de ${selectedTeam.name}` }
        : { count: 0, detail: "Elegí un equipo" };
    }
    const count = reach[audience as keyof Reach] ?? 0;
    return { count, detail: AUDIENCE_LABEL[audience] ?? audience };
  }, [audience, selectedTeam, reach]);

  const typeMeta = iconFor(type);

  /** Valida y devuelve el mensaje de error, o null si el form está listo. */
  const validate = (): string | null => {
    if (!cleanTitle) return "El título es obligatorio.";
    if (audience === "team" && !teamId) return "Elegí un equipo para la audiencia.";
    if (scheduleMode && !scheduledFor) return "Elegí fecha y hora para el envío programado.";
    return null;
  };

  /** Primer click de "Enviar": valida y abre el modal de confirmación. */
  const requestSend = () => {
    setResult(null);
    const err = validate();
    if (err) {
      setResult({ ok: false, msg: err });
      return;
    }
    setConfirmOpen(true);
  };

  const send = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          teamAccountId: audience === "team" ? teamId : undefined,
          type,
          title: cleanTitle,
          body: cleanBody,
          link: cleanLink,
          email,
          // Convertir a ISO UTC ACÁ (browser) donde se conoce la timezone del
          // admin: si llegara como "YYYY-MM-DDTHH:mm" el server lo interpretaría
          // en SU zona (UTC en Vercel) y la hora se correría.
          scheduledFor:
            scheduleMode && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error ?? "Error al enviar" });
      } else if (data.scheduled) {
        const when = new Date(data.scheduledFor).toLocaleString("es-AR", {
          weekday: "long",
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
        setResult({ ok: true, msg: `Aviso programado para ${when}. El cron lo entrega solo.` });
        setTitle("");
        setBody("");
        setLink("");
        setScheduledFor("");
        setScheduleMode(false);
        router.refresh();
      } else if (!data.sent) {
        setResult({
          ok: false,
          msg: "La audiencia elegida no tiene cuentas destinatarias todavía — no se envió nada.",
        });
      } else {
        setResult({
          ok: true,
          msg: `Enviado a ${data.sent} ${data.sent === 1 ? "cuenta" : "cuentas"}${
            data.emails ? ` + ${data.emails} ${data.emails === 1 ? "email" : "emails"}` : ""
          }.`,
        });
        setTitle("");
        setBody("");
        setLink("");
        router.refresh(); // recarga el historial con el envío nuevo
      }
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  /** Vista previa real: una sola notificación a la campana del propio admin. */
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
        body: JSON.stringify({ type, title: cleanTitle, body: cleanBody, link: cleanLink }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error ?? "Error al enviar la prueba" });
      } else {
        setResult({ ok: true, msg: "Prueba enviada a tu campana — mirá el toast." });
      }
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  // Esc cierra el modal de confirmación (salvo mientras envía)
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, sending]);

  const teamOptions: VertigoOption[] = teams.length
    ? [{ value: "", label: "Elegí un equipo…" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]
    : [{ value: "", label: "No hay equipos registrados" }];

  const PreviewRow = (
    <div className="bcast-bell-row">
      <span className="bcast-row-icon">
        <typeMeta.Icon size={15} />
      </span>
      <span className="bcast-bell-main">
        <span className="bcast-bell-title">
          <span className="bcast-bell-dot" />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: cleanTitle ? undefined : "#5f5870",
            }}
          >
            {cleanTitle || "Título del aviso…"}
          </span>
        </span>
        {cleanBody ? <span className="bcast-bell-body">{cleanBody}</span> : null}
      </span>
      <span className="bcast-bell-time">ahora</span>
    </div>
  );

  return (
    <>
      <div className="bcast-grid">
        {/* ── Columna 1: composer ─────────────────────────────────── */}
        <div className="vertigo-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            className="vertigo-card-title"
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 28px 0" }}
          >
            <Megaphone size={18} style={{ color: "var(--vertigo-purple-soft)" }} />
            Redactar aviso
          </div>

          <div style={{ padding: "22px 28px 28px" }}>
            <div
              className="grid gap-x-6"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}
            >
              <div className="vertigo-field" style={{ marginBottom: 0 }}>
                <label htmlFor="bcast-audience">Audiencia</label>
                <VertigoSelect
                  defaultValue="all"
                  options={AUDIENCES}
                  onValueChange={(v) => setAudience(v)}
                />
              </div>
              <div className="vertigo-field" style={{ marginBottom: 0 }}>
                <label htmlFor="bcast-type">Tipo de aviso</label>
                <VertigoSelect
                  defaultValue="broadcast"
                  options={TYPES}
                  onValueChange={(v) => {
                    setType(v);
                    // Plantilla del tipo: pre-carga título/mensaje (editables).
                    const t = TEMPLATES[v];
                    if (t && t.title) setTitle(t.title);
                    if (t && t.body) setBody(t.body);
                  }}
                />
              </div>
            </div>

            {/* Selector de equipo: plegado sin salto de layout */}
            <div className="bcast-team-wrap" data-collapsed={audience !== "team"}>
              <div>
                <div className="vertigo-field">
                  <label htmlFor="bcast-team">Equipo</label>
                  <VertigoSelect
                    defaultValue=""
                    options={teamOptions}
                    onValueChange={(v) => setTeamId(v)}
                  />
                </div>
              </div>
            </div>

            {/* Alcance estimado: el estado del form, siempre visible */}
            <p className="vertigo-hint" style={{ marginBottom: 22 }} aria-live="polite">
              Llegaría a <b style={{ color: "var(--vertigo-purple-pale)" }}>~{reachInfo.count}</b>{" "}
              {reachInfo.count === 1 ? "cuenta" : "cuentas"}
              {" · "}
              {reachInfo.detail}
              {type !== "broadcast" ? ` · tipo ${labelFor(type)}` : ""}
            </p>

            <div className="vertigo-field">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <label htmlFor="bcast-title" style={{ marginBottom: 0 }}>
                  Título del aviso *
                </label>
                <span
                  style={{
                    font: "600 10px Inter, system-ui, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                    color: titleLen > 120 ? "var(--vertigo-warning)" : "var(--vertigo-faint)",
                  }}
                >
                  {titleLen}/160
                </span>
              </div>
              <input
                id="bcast-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Se confirma la fase de grupos"
                maxLength={160}
              />
              {titleLen > 120 && (
                <p className="vertigo-hint">Los títulos muy largos se cortan en la campana.</p>
              )}
            </div>

            <div className="vertigo-field">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <label htmlFor="bcast-body" style={{ marginBottom: 0 }}>
                  Mensaje
                </label>
                <span
                  style={{
                    font: "600 10px Inter, system-ui, sans-serif",
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--vertigo-faint)",
                  }}
                >
                  {body.length}/400
                </span>
              </div>
              <textarea
                id="bcast-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Detalle del aviso (opcional)"
                rows={3}
                maxLength={400}
                style={{ height: 96, resize: "vertical", paddingTop: 14, paddingBottom: 14 }}
              />
            </div>

            <div className="vertigo-field" style={{ marginBottom: 18 }}>
              <label htmlFor="bcast-link">Link (opcional)</label>
              <input
                id="bcast-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="/partido/abc… o /fixture"
              />
            </div>

            {/* Canal email: checkbox real con label asociado */}
            <label
              htmlFor="bcast-email"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                height: 46,
                borderRadius: 10,
                border: "1px solid var(--vertigo-input-border)",
                background: "var(--vertigo-input-bg)",
                padding: "0 14px",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 13,
                color: "var(--vertigo-text)",
                transition: "border-color 0.25s var(--vertigo-ease), background 0.25s var(--vertigo-ease)",
              }}
            >
              <input
                id="bcast-email"
                type="checkbox"
                checked={email}
                onChange={(e) => setEmail(e.target.checked)}
                style={{ accentColor: "var(--vertigo-purple)", width: 15, height: 15, cursor: "pointer", flex: "none" }}
              />
              <Mail size={14} style={{ color: "var(--vertigo-purple-soft)", flex: "none" }} />
              Enviar también por email
              <span className="vertigo-hint-inline ml-auto">(cola notify-email)</span>
            </label>

            {/* Programar envío: toggle + fecha/hora con el calendario de marca */}
            <label
              htmlFor="bcast-schedule-toggle"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                height: 46,
                marginTop: 10,
                borderRadius: 10,
                border: "1px solid var(--vertigo-input-border)",
                background: "var(--vertigo-input-bg)",
                padding: "0 14px",
                fontFamily: "Inter, system-ui, sans-serif",
                fontSize: 13,
                color: "var(--vertigo-text)",
                transition: "border-color 0.25s var(--vertigo-ease), background 0.25s var(--vertigo-ease)",
              }}
            >
              <input
                id="bcast-schedule-toggle"
                type="checkbox"
                checked={scheduleMode}
                onChange={(e) => {
                  setScheduleMode(e.target.checked);
                  if (!e.target.checked) setScheduledFor("");
                }}
                style={{ accentColor: "var(--vertigo-purple)", width: 15, height: 15, cursor: "pointer", flex: "none" }}
              />
              <Clock size={14} style={{ color: "var(--vertigo-purple-soft)", flex: "none" }} />
              Programar para más tarde
            </label>
            <div
              className="bcast-team-wrap"
              data-collapsed={!scheduleMode}
              style={{ marginTop: scheduleMode ? 0 : -10 }}
            >
              <div>
                <div className="vertigo-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="bcast-when">Fecha y hora de envío</label>
                  <VertigoDateTime
                    name="bcast-when"
                    onValueChange={(v) => setScheduledFor(v)}
                  />
                </div>
                {scheduledFor && (
                  <p className="vertigo-hint" style={{ marginTop: 8 }}>
                    Se envía el {new Date(scheduledFor).toLocaleString("es-AR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })} (hora local).
                  </p>
                )}
              </div>
            </div>

            {/* Footer de acciones: jerarquía primaria/secundaria + resultado */}
            <div className="bcast-actions">
              <button
                className="vertigo-btn vertigo-btn-primary"
                onClick={requestSend}
                disabled={sending || !canSend}
                title={
                  !cleanTitle
                    ? "Escribí el título del aviso"
                    : teamNeedsPick
                      ? "Elegí el equipo destinatario"
                      : scheduleMode && !scheduledFor
                        ? "Elegí fecha y hora del envío"
                        : scheduleMode
                          ? "Agendar el aviso"
                          : "Enviar a la audiencia elegida"
                }
              >
                {sending ? <Loader2 size={15} className="spin" /> : scheduleMode ? <Clock size={15} /> : <Send size={15} />}
                {sending ? "Enviando…" : scheduleMode ? "Agendar aviso" : "Enviar aviso"}
              </button>
              <button
                className="vertigo-btn vertigo-btn-ghost"
                onClick={sendTest}
                disabled={sending || !cleanTitle}
                title="Mandá el borrador actual a tu propia campana para ver exactamente cómo se ve"
              >
                {sending ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                {sending ? "Enviando…" : "Probar a mí"}
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
          </div>
        </div>

        {/* ── Columna 2: vista previa espejo de la campana ─────────── */}
        <div className="bcast-preview-sticky">
          <div className="bcast-preview">
            <div className="bcast-preview-tag">
              <BellRing size={12} />
              Vista previa — así llega a la campana
            </div>

            <div className="bcast-bell-mirror" aria-live="polite">
              <div className="bcast-bell-head">
                <span>Notificaciones</span>
                <Bell size={13} style={{ color: "#6b6378" }} />
              </div>
              {PreviewRow}
            </div>

            {/* Canales del envío: in-app siempre; email según checkbox */}
            <div className="bcast-channels">
              <span className="bcast-channel-chip is-on" style={{ cursor: "default" }}>
                <Bell size={10} />
                In-app
              </span>
              <button
                type="button"
                className={`bcast-channel-chip ${email ? "is-on" : ""}`}
                onClick={() => setEmail((v) => !v)}
                aria-pressed={email}
                title="Alternar el envío por email"
              >
                <Mail size={10} />
                Email
              </button>
              <span className="bcast-channel-chip is-locked" title="Push nativa si el usuario la tiene activada">
                Push · auto
              </span>
            </div>

            {cleanLink ? (
              <p className="bcast-preview-link" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link2 size={11} style={{ flex: "none" }} />
                {cleanLink}
              </p>
            ) : (
              <p className="vertigo-hint-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link2 size={11} style={{ flex: "none" }} />
                Sin link — el aviso abre el centro de notificaciones
              </p>
            )}

            <p className="vertigo-hint" style={{ margin: 0 }}>
              Este espejo replica el panel real de notificaciones: título, mensaje y tipografía
              exactas. Usá «Probar a mí» para recibirlo de verdad en tu campana.
            </p>
          </div>
        </div>
      </div>

      {/* ── Modal de confirmación del envío masivo ────────────────── */}
      {confirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(4,2,9,0.72)",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => !sending && setConfirmOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar envío"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(460px, 100%)",
              borderRadius: 16,
              border: "1px solid var(--vertigo-line)",
              background: "#161122",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              padding: 26,
              animation: "vertigoFadeUp 0.25s var(--vertigo-ease)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <span
                style={{
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: "rgba(124, 58, 237, 0.12)",
                  border: "1px solid rgba(124, 58, 237, 0.35)",
                  color: "var(--vertigo-purple-pale)",
                }}
              >
                <Megaphone size={19} />
              </span>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontFamily: "Cinzel, serif",
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "var(--vertigo-text)",
                    margin: 0,
                  }}
                >
                  Confirmar envío
                </h3>
                <p
                  style={{
                    margin: "6px 0 0",
                    font: "400 12px/1.55 Inter, system-ui, sans-serif",
                    color: "var(--vertigo-faint)",
                  }}
                >
                  La notificación llega al instante a la campana de cada cuenta y queda registrada
                  en el historial.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={sending}
                aria-label="Cerrar"
                style={{
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid var(--vertigo-line-soft)",
                  background: "transparent",
                  color: "var(--vertigo-faint)",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Resumen real de lo que se va a mandar */}
            <div
              style={{
                margin: "18px 0 0",
                borderRadius: 12,
                border: "1px solid var(--vertigo-line-soft)",
                background: "rgba(13, 9, 19, 0.6)",
                overflow: "hidden",
              }}
            >
              {[
                {
                  k: "Audiencia",
                  v: `${AUDIENCE_LABEL[audience]}${audience === "team" && selectedTeam ? ` — ${selectedTeam.name}` : ""}`,
                },
                { k: "Destinatarios", v: `~${reachInfo.count} ${reachInfo.count === 1 ? "cuenta" : "cuentas"}` },
                { k: "Título", v: cleanTitle },
                { k: "Mensaje", v: cleanBody || "—" },
                { k: "Email", v: email ? "Sí, además por email" : "No" },
                {
                  k: "Cuándo",
                  v: scheduleMode && scheduledFor
                    ? new Date(scheduledFor).toLocaleString("es-AR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Ahora mismo",
                },
              ].map((row, i, arr) => (
                <div
                  key={row.k}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "10px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--vertigo-line-soft)",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      flex: "none",
                      width: 96,
                      font: "700 9px Inter, system-ui, sans-serif",
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: "var(--vertigo-faint)",
                    }}
                  >
                    {row.k}
                  </span>
                  <span
                    style={{
                      font: "500 12.5px/1.5 Inter, system-ui, sans-serif",
                      color: "var(--vertigo-text)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {row.v}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 22 }}>
              <button
                className="vertigo-btn vertigo-btn-ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={sending}
              >
                Volver
              </button>
              <button className="vertigo-btn vertigo-btn-primary" onClick={send} disabled={sending}>
                {sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                {sending ? "Enviando…" : "Enviar ahora"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
