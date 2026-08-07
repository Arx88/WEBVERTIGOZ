"use client";

import { useWizard } from "@/components/wizard/wizard-context";

export default function Step8Terms() {
  const { data, updateData } = useWizard();

  const restreamChecked = data.restreamAccepted;
  const termsChecked = data.termsAcceptedAt !== null;

  function toggleRestream() {
    updateData({ restreamAccepted: !restreamChecked });
  }

  function toggleTerms() {
    updateData({ termsAcceptedAt: termsChecked ? null : new Date() });
  }

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 46, 158, 0.7)", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px" }}>
          PASO 08
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 600, color: "#f5eaff", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
          Términos del torneo
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(255, 180, 220, 0.6)", marginTop: "8px" }}>
          Aceptá ambos términos para continuar.
        </p>
      </div>

      {/* Card 1: Restream */}
      <TermCard
        checked={restreamChecked}
        onToggle={toggleRestream}
        title="Permiso de transmisión"
        body="Acepto que mis partidas en el torneo VÉRTIGO puedan ser transmitidas en vivo por los canales oficiales (Twitch, YouTube, Kick) y por casters community autorizados por el staff."
        channels={["Twitch", "YouTube", "Kick"]}
      />

      {/* Card 2: Reglamento */}
      <div style={{ marginTop: "12px" }}>
        <TermCard
          checked={termsChecked}
          onToggle={toggleTerms}
          title="Reglamento del torneo"
          body="Confirmo que los 3 jugadores del equipo hemos leído el Handbook oficial y aceptamos cumplir con todas las reglas, mecánicas de sorteo, uso de comodines y protocolos de disputa."
          channels={["Handbook descargado ✓"]}
        />
      </div>

      {/* Status */}
      <div style={{
        marginTop: "20px",
        padding: "12px 16px",
        background: restreamChecked && termsChecked ? "rgba(34, 197, 94, 0.06)" : "rgba(255, 46, 158, 0.04)",
        border: `1px solid ${restreamChecked && termsChecked ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 46, 158, 0.12)"}`,
        borderRadius: "4px",
        textAlign: "center",
      }}>
        <span style={{
          fontSize: "12px", fontWeight: 600,
          color: restreamChecked && termsChecked ? "#22c55e" : "rgba(255, 180, 220, 0.5)",
          letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          {restreamChecked && termsChecked ? "✓ Ambos términos aceptados" : "Falta aceptar términos"}
        </span>
      </div>
    </div>
  );
}

function TermCard({
  checked, onToggle, title, body, channels,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  body: string;
  channels: string[];
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: "20px",
        background: checked ? "rgba(255, 46, 158, 0.06)" : "rgba(255, 46, 158, 0.02)",
        border: `1px solid ${checked ? "rgba(255, 46, 158, 0.4)" : "rgba(255, 46, 158, 0.12)"}`,
        borderRadius: "6px",
        cursor: "pointer",
        transition: "all 200ms ease",
        display: "flex",
        gap: "14px",
      }}
    >
      {/* Checkbox custom */}
      <div style={{
        width: "20px", height: "20px", flexShrink: 0,
        borderRadius: "3px",
        border: `2px solid ${checked ? "#ff2e9e" : "rgba(255, 180, 220, 0.3)"}`,
        background: checked ? "#ff2e9e" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#0a0011", fontSize: "12px", fontWeight: 700,
        marginTop: "2px",
        transition: "all 200ms ease",
      }}>
        {checked && "✓"}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#f5eaff", marginBottom: "6px" }}>
          {title}
        </div>
        <p style={{ fontSize: "12px", color: "rgba(255, 180, 220, 0.7)", lineHeight: 1.5, marginBottom: "8px" }}>
          {body}
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {channels.map((c) => (
            <span key={c} style={{
              fontSize: "10px",
              padding: "3px 8px",
              border: "1px solid rgba(255, 46, 158, 0.2)",
              borderRadius: "10px",
              color: "rgba(255, 180, 220, 0.6)",
              letterSpacing: "0.1em",
            }}>
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
