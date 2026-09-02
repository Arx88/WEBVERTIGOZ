"use client";

/**
 * BroadcastForm — formulario de notificaciones masivas del staff.
 * Audiencias: all | captains | bettors | players | team (con selector).
 * Email opcional → encola en email_queue (lo drena la Edge Function).
 */

import { useState } from "react";
import { Send, Megaphone, Loader2 } from "lucide-react";

const AUDIENCES = [
  { value: "all", label: "Todos los usuarios" },
  { value: "captains", label: "Capitanes (dueños de equipos)" },
  { value: "bettors", label: "Apostadores (espectadores)" },
  { value: "players", label: "Jugadores" },
  { value: "team", label: "Un equipo específico" },
] as const;

const TYPES = [
  { value: "broadcast", label: "Aviso general" },
  { value: "match_phase", label: "Fase / partido" },
  { value: "match_scheduled", label: "Programado" },
  { value: "bet_open", label: "Apuestas" },
] as const;

export default function BroadcastForm({ teams }: { teams: { id: string; name: string }[] }) {
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
      }
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="vertigo-card" style={{ maxWidth: 760, marginTop: 18 }}>
      <div className="vertigo-card-title">
        <Megaphone size={18} style={{ color: "var(--vertigo-accent)" }} />
        Nuevo aviso
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label className="vertigo-field">
          <span>Audiencia</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="vertigo-field">
          <span>Tipo de aviso</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {audience === "team" && (
        <label className="vertigo-field" style={{ marginTop: 14 }}>
          <span>Equipo</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Elegí un equipo…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="vertigo-field" style={{ marginTop: 14 }}>
        <span>Título *</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Se confirma la fase de grupos"
          maxLength={160}
        />
      </label>

      <label className="vertigo-field" style={{ marginTop: 14 }}>
        <span>Mensaje</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Detalle del aviso (opcional)"
          rows={3}
          maxLength={400}
        />
      </label>

      <label className="vertigo-field" style={{ marginTop: 14 }}>
        <span>Link (opcional)</span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="/partido/abc… o /fixture"
        />
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 16,
          cursor: "pointer",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 13,
          color: "#d8d3e8",
        }}
      >
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
        Enviar también por email (cola notify-email)
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
        <button className="vertigo-btn vertigo-btn-primary" onClick={send} disabled={sending} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          {sending ? "Enviando…" : "Enviar aviso"}
        </button>
        {result && (
          <span style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 13, color: result.ok ? "var(--vertigo-success)" : "var(--vertigo-danger)" }}>
            {result.msg}
          </span>
        )}
      </div>
    </div>
  );
}
