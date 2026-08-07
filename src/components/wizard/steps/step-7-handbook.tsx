"use client";

import { useState } from "react";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step7Handbook() {
  const { data, updateData } = useWizard();
  const [loading, setLoading] = useState(false);
  const downloaded = data.handbookDownloadedAt !== null;

  async function handleDownload() {
    setLoading(true);
    try {
      // Abrir el PDF en una nueva pestaña
      window.open("https://tomlvgzwleolsxksiygs.supabase.co/storage/v1/object/public/handbook/vertigo-handbook.pdf", "_blank");
      // Marcar como descargado después de 1s
      setTimeout(() => {
        updateData({ handbookDownloadedAt: new Date() });
        setLoading(false);
      }, 1000);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", textAlign: "center" }}>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 46, 158, 0.7)", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px" }}>
          PASO 07
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 600, color: "#f5eaff", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
          Handbook del torneo
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(255, 180, 220, 0.6)", marginTop: "8px", lineHeight: 1.5 }}>
          Descargá el reglamento oficial antes de aceptar los términos.
        </p>
      </div>

      {/* Estado: descargado o pendiente */}
      <div style={{
        padding: "32px 24px",
        background: downloaded ? "rgba(34, 197, 94, 0.06)" : "rgba(255, 46, 158, 0.04)",
        border: `1px solid ${downloaded ? "rgba(34, 197, 94, 0.3)" : "rgba(255, 46, 158, 0.15)"}`,
        borderRadius: "6px",
        marginBottom: "16px",
      }}>
        <div style={{
          width: "48px", height: "48px",
          borderRadius: "50%",
          border: `1px solid ${downloaded ? "#22c55e" : "#ff2e9e"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          color: downloaded ? "#22c55e" : "#ff2e9e",
          fontSize: "20px",
        }}>
          {downloaded ? "✓" : "📄"}
        </div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#f5eaff", marginBottom: "6px" }}>
          {downloaded ? "Handbook descargado" : "Handbook Oficial"}
        </div>
        <div style={{ fontSize: "11px", color: "rgba(255, 180, 220, 0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          PDF · 8 secciones · Reglas completas
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={loading || downloaded}
        style={{
          width: "100%",
          padding: "14px 24px",
          background: downloaded ? "rgba(34, 197, 94, 0.1)" : "#ff2e9e",
          color: downloaded ? "#22c55e" : "#0a0011",
          border: downloaded ? "1px solid rgba(34, 197, 94, 0.4)" : "none",
          borderRadius: "4px",
          fontSize: "13px",
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          cursor: loading ? "wait" : "pointer",
          transition: "all 200ms ease",
          boxShadow: downloaded ? "none" : "0 0 16px rgba(255, 46, 158, 0.3)",
        }}
      >
        {loading ? "DESCARGANDO..." : downloaded ? "✓ DESCARGADO" : "DESCARGAR HANDBOOK"}
      </button>

      {downloaded && (
        <p style={{ fontSize: "11px", color: "rgba(34, 197, 94, 0.7)", marginTop: "10px" }}>
          Ya podés continuar al siguiente paso.
        </p>
      )}
    </div>
  );
}
