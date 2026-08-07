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
  transition: "all 200ms ease",
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

export default function Step1Account() {
  const { data, updateData } = useWizard();

  return (
    <div style={{ maxWidth: "440px" }}>
      {/* Toggle Crear / Ya tengo */}
      <div style={{
        display: "flex",
        background: "rgba(255, 46, 158, 0.05)",
        borderRadius: "4px",
        padding: "3px",
        marginBottom: "24px",
      }}>
        {[
          { val: false, label: "Crear cuenta" },
          { val: true, label: "Ya tengo cuenta" },
        ].map((opt) => {
          const active = data.existingAccount === opt.val;
          return (
            <button
              key={String(opt.val)}
              onClick={() => updateData({ existingAccount: opt.val })}
              style={{
                flex: 1,
                padding: "10px",
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: "3px",
                transition: "all 200ms ease",
                background: active ? "#ff2e9e" : "transparent",
                color: active ? "#0a0011" : "rgba(255, 180, 220, 0.5)",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Email */}
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Email</label>
        <input
          type="email"
          placeholder="tu@email.com"
          value={data.email}
          onChange={(e) => updateData({ email: e.target.value })}
          autoComplete="email"
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(255, 46, 158, 0.5)";
            e.target.style.boxShadow = "0 0 0 3px rgba(255, 46, 158, 0.1)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255, 46, 158, 0.15)";
            e.target.style.boxShadow = "none";
          }}
        />
      </div>

      {/* Password */}
      <div style={{ marginBottom: "24px" }}>
        <label style={labelStyle}>
          {data.existingAccount ? "Contraseña" : "Crear contraseña"}
        </label>
        <input
          type="password"
          placeholder="••••••••"
          value={data.password}
          onChange={(e) => updateData({ password: e.target.value })}
          autoComplete={data.existingAccount ? "current-password" : "new-password"}
          minLength={6}
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.borderColor = "rgba(255, 46, 158, 0.5)";
            e.target.style.boxShadow = "0 0 0 3px rgba(255, 46, 158, 0.1)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "rgba(255, 46, 158, 0.15)";
            e.target.style.boxShadow = "none";
          }}
        />
        {!data.existingAccount && (
          <p style={{
            fontSize: "11px",
            color: "rgba(255, 180, 220, 0.4)",
            marginTop: "6px",
          }}>
            Mínimo 6 caracteres.
          </p>
        )}
      </div>

      {/* Info box */}
      <div style={{
        padding: "12px 14px",
        background: "rgba(255, 46, 158, 0.05)",
        borderLeft: "2px solid rgba(255, 46, 158, 0.4)",
        borderRadius: "2px",
      }}>
        <p style={{
          fontSize: "12px",
          color: "rgba(255, 180, 220, 0.7)",
          lineHeight: 1.5,
        }}>
          Esta cuenta es por equipo, no por jugador. Vas a poder cargar 3 jugadores después.
        </p>
      </div>
    </div>
  );
}
