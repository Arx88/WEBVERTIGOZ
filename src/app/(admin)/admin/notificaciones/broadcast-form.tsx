"use client";

/**
 * BroadcastForm — formulario de notificaciones masivas del staff.
 * Audiencias: all | captains | bettors | players | team (con selector).
 * Email opcional → encola en email_queue (lo drena la Edge Function).
 *
 * Campos con el design system del admin: .vertigo-field + label real, y
 * VertigoSelect (el dropdown de marca del panel) para las opciones.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Megaphone, Loader2, Play } from "lucide-react";
import VertigoSelect from "@/components/admin/vertigo-select";
import type { VertigoOption } from "@/components/admin/vertigo-select";

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

export default function BroadcastForm({ teams }: { teams: { id: string; name: string }[] }) {
  const router = useRouter();
  const [audience, setAudience] = useState<string>("all");
  const [teamId, setTeamId] = useState("");
  const [type, setType] = useState("broadcast");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const send = async () => {
    setResult(null);
    if (!title.trim()) {
      setResult({ ok: false, msg: "El título es obligatorio." });
      return;
    }
    if (audience === "team" && !teamId) {
      setResult({ ok: false, msg: "Elegí un equipo para la audiencia." });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          teamAccountId: audience === "team" ? teamId : undefined,
          type,
          title,
          body,
          link,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error ?? "Error al enviar" });
      } else {
        setResult({
          ok: true,
          msg: `Enviado a ${data.sent} cuentas${data.emails ? ` + ${data.emails} emails` : ""}.`,
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
    if (!title.trim()) {
      setResult({ ok: false, msg: "El título es obligatorio para la prueba." });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, body, link }),
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

  const teamOptions: VertigoOption[] = [
    { value: "", label: "Elegí un equipo…" },
    ...teams.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <div className="vertigo-card" style={{ maxWidth: 820, marginTop: 24 }}>
      <div className="vertigo-card-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Megaphone size={18} style={{ color: "var(--vertigo-purple-soft)" }} />
        Nuevo aviso
      </div>

      <div className="grid gap-x-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
        <div className="vertigo-field" style={{ marginBottom: 0 }}>
          <label>Audiencia</label>
          <VertigoSelect
            defaultValue="all"
            options={AUDIENCES}
            onValueChange={(v) => setAudience(v)}
          />
        </div>
        <div className="vertigo-field" style={{ marginBottom: 0 }}>
          <label>Tipo de aviso</label>
          <VertigoSelect
            defaultValue="broadcast"
            options={TYPES}
            onValueChange={(v) => setType(v)}
          />
        </div>
      </div>

      {audience === "team" && (
        <div className="vertigo-field">
          <label>Equipo</label>
          <VertigoSelect
            defaultValue=""
            options={teamOptions}
            onValueChange={(v) => setTeamId(v)}
          />
        </div>
      )}

      <div className="vertigo-field">
        <label>Título *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Se confirma la fase de grupos"
          maxLength={160}
        />
      </div>

      <div className="vertigo-field">
        <label>Mensaje</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Detalle del aviso (opcional)"
          rows={3}
          maxLength={400}
          style={{ height: 96, resize: "vertical" }}
        />
      </div>

      <div className="vertigo-field">
        <label>Link (opcional)</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/partido/abc… o /fixture"
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 2,
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
          type="checkbox"
          checked={email}
          onChange={(e) => setEmail(e.target.checked)}
          style={{ accentColor: "var(--vertigo-purple)", width: 15, height: 15, cursor: "pointer", flex: "none" }}
        />
        Enviar también por email
        <span className="vertigo-hint-inline ml-auto">(cola notify-email)</span>
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
        <button className="vertigo-btn vertigo-btn-primary" onClick={send} disabled={sending} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          {sending ? "Enviando…" : "Enviar aviso"}
        </button>
        <button className="vertigo-btn vertigo-btn-ghost" onClick={sendTest} disabled={sending} style={{ display: "inline-flex", gap: 8, alignItems: "center" }} title="Mandá el borrador actual a tu propia campana para ver exactamente cómo se ve">
          {sending ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
          {sending ? "Enviando…" : "Probar a mí"}
        </button>
        {result && (
          <span
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 12.5,
              color: result.ok ? "var(--vertigo-success)" : "var(--vertigo-danger)",
            }}
          >
            {result.msg}
          </span>
        )}
      </div>
    </div>
  );
}