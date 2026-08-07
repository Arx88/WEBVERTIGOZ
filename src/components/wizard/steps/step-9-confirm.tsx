"use client";

import { useWizard } from "@/components/wizard/wizard-context";

const CIV_NAMES: Record<string, string> = {
  britons: "Britanos", franks: "Francos", goths: "Godos", teutons: "Teutones",
  japanese: "Japoneses", chinese: "Chinos", byzantines: "Bizantinos", persians: "Persas",
  saracens: "Sarracenos", turks: "Turcos", vikings: "Vikingos", mongols: "Mongoles",
  celts: "Celtas", spanish: "Españoles", aztecs: "Aztecas", mayans: "Mayas",
  huns: "Hunos", koreans: "Coreanos", italians: "Italianos", indians: "Hindúes",
  incas: "Incas", magyars: "Magiares", slavs: "Eslavos", berbers: "Bereberes",
  ethiopians: "Etíopes", malians: "Malianos", portuguese: "Portugueses", burmese: "Birmanos",
  khmer: "Jémeres", malay: "Malayos", vietnamese: "Vietnamitas", bulgarians: "Búlgaros",
  cumans: "Cumanos", lithuanians: "Lituanos", tatars: "Tártaros", burgundians: "Borgoñones",
  sicilians: "Sicilianos", poles: "Polacos", bohemians: "Bohemios", romans: "Romanos",
};

export default function Step9Confirm() {
  const { data } = useWizard();

  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  const captain = data.players.find((p) => p.isCaptain);
  const hasData = data.teamName && data.players.every((p) => p.aoe2ProfileId);

  if (!hasData) {
    return (
      <div style={{ maxWidth: "400px", margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 46, 158, 0.7)", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px" }}>
          PASO 09
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 600, color: "#f5eaff", fontFamily: "Inter, system-ui, sans-serif", marginBottom: "12px" }}>
          Faltan datos
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(255, 180, 220, 0.6)", marginBottom: "20px" }}>
          Completá los pasos anteriores antes de confirmar la inscripción.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 46, 158, 0.7)", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px" }}>
          PASO 09
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 600, color: "#f5eaff", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
          Confirmá tu inscripción
        </h1>
      </div>

      {/* Equipo */}
      <div style={{
        padding: "16px",
        background: "rgba(255, 46, 158, 0.04)",
        border: "1px solid rgba(255, 46, 158, 0.15)",
        borderRadius: "4px",
        marginBottom: "12px",
        display: "flex", alignItems: "center", gap: "14px",
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          border: "1px solid rgba(255, 46, 158, 0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#ff2e9e", fontSize: "20px", fontWeight: 600,
        }}>
          {data.teamName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#f5eaff" }}>
            {data.teamName}
          </div>
          {data.teamTagline && (
            <div style={{ fontSize: "12px", color: "rgba(255, 180, 220, 0.6)", fontStyle: "italic", marginTop: "2px" }}>
              &ldquo;{data.teamTagline}&rdquo;
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "10px", color: "rgba(255, 180, 220, 0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            ELO TOTAL
          </div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "#ff2e9e" }}>
            {totalElo}
          </div>
        </div>
      </div>

      {/* Jugadores */}
      <div style={{
        padding: "16px",
        background: "rgba(255, 46, 158, 0.04)",
        border: "1px solid rgba(255, 46, 158, 0.15)",
        borderRadius: "4px",
        marginBottom: "12px",
      }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 180, 220, 0.6)", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: "10px" }}>
          Jugadores
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
          {data.players.map((p, idx) => (
            <div key={idx} style={{ textAlign: "center", position: "relative" }}>
              {p.isCaptain && (
                <div style={{
                  position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)",
                  background: "#ff2e9e", color: "#0a0011",
                  fontSize: "8px", fontWeight: 700, letterSpacing: "0.1em",
                  padding: "2px 6px", borderRadius: "8px", textTransform: "uppercase",
                }}>
                  CAP
                </div>
              )}
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                border: `1px solid ${p.isCaptain ? "#ff2e9e" : "rgba(255, 46, 158, 0.2)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: p.isCaptain ? "#ff2e9e" : "rgba(255, 180, 220, 0.5)",
                fontSize: "13px", fontWeight: 600, margin: "0 auto 4px",
              }}>
                {p.displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#f5eaff" }}>
                {p.displayName}
              </div>
              {p.maxRatingRm1v1 !== null && p.maxRatingRm1v1 !== undefined && (
                <div style={{ fontSize: "10px", color: "#ff2e9e", marginTop: "2px" }}>
                  {p.maxRatingRm1v1}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Civs */}
      <div style={{
        padding: "16px",
        background: "rgba(255, 46, 158, 0.04)",
        border: "1px solid rgba(255, 46, 158, 0.15)",
        borderRadius: "4px",
        marginBottom: "12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
          <span style={{ fontSize: "10px", color: "rgba(255, 180, 220, 0.6)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Civs base
          </span>
          <span style={{ fontSize: "11px", color: "#ff2e9e", fontWeight: 600 }}>
            {data.baseCivIds.length}/9
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
          {data.baseCivIds.map((civId, idx) => (
            <span key={civId} style={{
              fontSize: "10px", padding: "3px 8px",
              background: "rgba(255, 46, 158, 0.1)",
              border: "1px solid rgba(255, 46, 158, 0.3)",
              borderRadius: "10px",
              color: "#f5eaff",
            }}>
              {idx + 1}. {CIV_NAMES[civId] ?? civId}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
          <span style={{ fontSize: "10px", color: "rgba(255, 180, 220, 0.6)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Civs extra
          </span>
          <span style={{ fontSize: "11px", color: "#ff2e9e", fontWeight: 600 }}>
            {data.extraCivIds.length}/3
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {data.extraCivIds.map((civId, idx) => (
            <span key={civId} style={{
              fontSize: "10px", padding: "3px 8px",
              background: "rgba(255, 46, 158, 0.05)",
              border: "1px solid rgba(255, 46, 158, 0.15)",
              borderRadius: "10px",
              color: "rgba(255, 180, 220, 0.8)",
            }}>
              {idx + 1}. {CIV_NAMES[civId] ?? civId}
            </span>
          ))}
        </div>
      </div>

      {/* Status checks */}
      <div style={{
        padding: "14px 16px",
        background: "rgba(34, 197, 94, 0.04)",
        border: "1px solid rgba(34, 197, 94, 0.2)",
        borderRadius: "4px",
        display: "flex", flexDirection: "column", gap: "6px",
      }}>
        <StatusItem ok={!!data.handbookDownloadedAt} label="Handbook descargado" />
        <StatusItem ok={data.restreamAccepted} label="Permiso de transmisión aceptado" />
        <StatusItem ok={!!data.termsAcceptedAt} label="Reglamento aceptado" />
        <StatusItem ok={!!captain} label={`Capitán: ${captain?.displayName ?? "—"}`} />
      </div>

      <p style={{ fontSize: "11px", color: "rgba(255, 180, 220, 0.5)", textAlign: "center", marginTop: "16px", lineHeight: 1.5 }}>
        Al confirmar, tu equipo quedará pendiente de aprobación del staff.
      </p>
    </div>
  );
}

function StatusItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{
        width: "16px", height: "16px", borderRadius: "50%",
        background: ok ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
        border: `1px solid ${ok ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: ok ? "#22c55e" : "#ef4444",
        fontSize: "10px", fontWeight: 700,
      }}>
        {ok ? "✓" : "✗"}
      </div>
      <span style={{ fontSize: "12px", color: ok ? "#f5eaff" : "rgba(255, 180, 220, 0.6)" }}>
        {label}
      </span>
    </div>
  );
}
