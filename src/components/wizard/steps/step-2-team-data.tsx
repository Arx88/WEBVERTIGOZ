"use client";

import { useWizard } from "@/components/wizard/wizard-context";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255, 46, 158, 0.04)",
  border: "1px solid rgba(255, 46, 158, 0.15)",
  borderRadius: "4px",
  padding: "12px 16px",
  color: "#f5eaff",
  fontSize: "14px",
  fontFamily: "Inter, system-ui, sans-serif",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 500,
  color: "#ffb4dc",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  marginBottom: "8px",
};

const EMBLEMS = [
  "Caballero", "Águila", "Dragón", "León", "Lobo", "Cuervo",
  "Oso", "Halcón", "Serpiente", "Toro", "Unicornio", "Fénix",
].map((name, i) => ({ id: `e${i + 1}`, name }));

export default function Step2TeamData() {
  const { data, updateData } = useWizard();

  return (
    <div style={{ maxWidth: "520px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{
          fontSize: "10px", color: "rgba(255, 46, 158, 0.7)",
          letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px",
        }}>
          PASO 02
        </div>
        <h1 style={{
          fontSize: "28px", fontWeight: 600, color: "#f5eaff",
          fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em",
        }}>
          Datos del equipo
        </h1>
      </div>

      {/* Nombre + Frase */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "28px" }}>
        <div>
          <label style={labelStyle}>Nombre *</label>
          <input
            placeholder="Los Invencibles"
            value={data.teamName}
            onChange={(e) => updateData({ teamName: e.target.value })}
            maxLength={60}
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = "rgba(255, 46, 158, 0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(255, 46, 158, 0.1)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255, 46, 158, 0.15)"; e.target.style.boxShadow = "none"; }}
          />
        </div>
        <div>
          <label style={labelStyle}>Frase</label>
          <input
            placeholder="Honor et gloria"
            value={data.teamTagline}
            onChange={(e) => updateData({ teamTagline: e.target.value })}
            maxLength={140}
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = "rgba(255, 46, 158, 0.5)"; e.target.style.boxShadow = "0 0 0 3px rgba(255, 46, 158, 0.1)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255, 46, 158, 0.15)"; e.target.style.boxShadow = "none"; }}
          />
        </div>
      </div>

      {/* Emblema */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
          <label style={labelStyle}>Escudo *</label>
          <span style={{ fontSize: "11px", color: "rgba(255, 180, 220, 0.4)" }}>
            {data.emblemId ? "✓ Elegido" : "Elegí uno"}
          </span>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "8px",
        }}>
          {EMBLEMS.map((emblem) => {
            const active = data.emblemId === emblem.id;
            return (
              <button
                key={emblem.id}
                onClick={() => updateData({ emblemId: emblem.id })}
                style={{
                  aspectRatio: "1",
                  padding: "8px",
                  borderRadius: "4px",
                  background: active ? "rgba(255, 46, 158, 0.1)" : "rgba(255, 46, 158, 0.03)",
                  border: `1px solid ${active ? "#ff2e9e" : "rgba(255, 46, 158, 0.15)"}`,
                  cursor: "pointer",
                  transition: "all 200ms ease",
                  boxShadow: active ? "0 0 0 1px #ff2e9e, 0 0 12px rgba(255, 46, 158, 0.3)" : "none",
                }}
              >
                <div style={{
                  width: "100%", height: "100%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%",
                  border: `1px solid ${active ? "#ff2e9e" : "rgba(255, 180, 220, 0.2)"}`,
                  color: active ? "#ff2e9e" : "rgba(255, 180, 220, 0.4)",
                  fontSize: "14px", fontWeight: 600,
                }}>
                  {emblem.name.charAt(0)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      {data.teamName && (
        <div style={{
          padding: "16px",
          background: "rgba(255, 46, 158, 0.04)",
          border: "1px solid rgba(255, 46, 158, 0.1)",
          borderRadius: "4px",
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
          <div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#f5eaff" }}>
              {data.teamName}
            </div>
            {data.teamTagline && (
              <div style={{ fontSize: "12px", color: "rgba(255, 180, 220, 0.6)", fontStyle: "italic", marginTop: "2px" }}>
                &ldquo;{data.teamTagline}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
