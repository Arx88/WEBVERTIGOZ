"use client";
import { useWizard } from "@/components/wizard/wizard-context";
import { useState, useEffect } from "react";
import { Mail, Lock, Check, AlertCircle } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Step1Account() {
  const { data, updateData } = useWizard();
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailValid = EMAIL_REGEX.test(data.email);
  const passwordValid = data.password.length >= 6;
  const showEmailError = emailTouched && data.email.length > 0 && !emailValid;

  return (
    <>
      {/* Toggle crear/ya tengo */}
      <div className="field">
        <label>¿Ya tenés cuenta o creás una nueva?</label>
        <div style={{
          display: "flex",
          gap: "12px",
          marginBottom: "28px",
          background: "var(--input-bg)",
          padding: "6px",
          borderRadius: "12px",
          border: "1px solid var(--input-border)",
        }}>
          {[
            { val: false, label: "Crear cuenta" },
            { val: true, label: "Ya tengo cuenta" },
          ].map((opt) => (
            <button
              key={String(opt.val)}
              onClick={() => updateData({ existingAccount: opt.val })}
              style={{
                flex: 1, padding: "14px", fontSize: "12px", fontWeight: 700,
                letterSpacing: "2px", textTransform: "uppercase", borderRadius: "8px",
                cursor: "pointer", transition: "all .3s cubic-bezier(.22,1,.36,1)",
                background: data.existingAccount === opt.val
                  ? "linear-gradient(180deg, rgba(124,58,237,0.3), rgba(124,58,237,0.15))"
                  : "transparent",
                border: `1px solid ${data.existingAccount === opt.val ? "rgba(124,58,237,0.6)" : "transparent"}`,
                color: data.existingAccount === opt.val ? "#efe9ff" : "var(--muted)",
                boxShadow: data.existingAccount === opt.val
                  ? "0 0 0 3px rgba(124,58,237,0.15), 0 4px 20px rgba(124,58,237,0.25)"
                  : "none",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Email con validación visual */}
      <div className="field" style={{ marginBottom: "24px" }}>
        <label htmlFor="email" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <Mail style={{ width: 12, height: 12, color: "var(--faint)" }} />
          Email del equipo
          {data.email.length > 0 && emailValid && (
            <span style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--vertigo-success, #22c55e)",
              background: "rgba(34,197,94,0.1)",
              padding: "2px 8px",
              borderRadius: "999px",
              border: "1px solid rgba(34,197,94,0.25)",
            }}>
              <Check style={{ width: 10, height: 10 }} />
              Válido
            </span>
          )}
        </label>
        <input
          id="email"
          type="email"
          placeholder="tu@email.com"
          value={data.email}
          onChange={(e) => { updateData({ email: e.target.value }); setEmailTouched(true); }}
          onFocus={() => setEmailTouched(true)}
          autoComplete="email"
          style={{
            borderColor: showEmailError ? "var(--danger)" : emailValid && data.email.length > 0 ? "var(--vertigo-success, #22c55e)" : undefined,
            paddingRight: data.email.length > 0 ? "44px" : undefined,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        />
        {showEmailError && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            marginTop: "8px", fontSize: "12px", color: "var(--danger)",
          }}>
            <AlertCircle style={{ width: 13, height: 13 }} />
            Ingresá un email válido
          </div>
        )}
      </div>

      {/* Password con validación visual */}
      <div className="field" style={{ marginBottom: "8px" }}>
        <label htmlFor="password" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <Lock style={{ width: 12, height: 12, color: "var(--faint)" }} />
          {data.existingAccount ? "Contraseña" : "Crear contraseña"}
          {passwordTouched && data.password.length >= 6 && (
            <span style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--vertigo-success, #22c55e)",
              background: "rgba(34,197,94,0.1)",
              padding: "2px 8px",
              borderRadius: "999px",
              border: "1px solid rgba(34,197,94,0.25)",
            }}>
              <Check style={{ width: 10, height: 10 }} />
              OK
            </span>
          )}
        </label>
        <input
          id="password"
          type="password"
          placeholder="••••••••"
          value={data.password}
          onChange={(e) => { updateData({ password: e.target.value }); setPasswordTouched(true); }}
          onFocus={() => setPasswordTouched(true)}
          autoComplete={data.existingAccount ? "current-password" : "new-password"}
          minLength={6}
          style={{
            borderColor: passwordTouched && data.password.length > 0 && !passwordValid ? "var(--danger)" : undefined,
          }}
        />
        {!data.existingAccount && (
          <p style={{
            fontSize: "12px",
            color: "var(--faint)",
            marginTop: "10px",
            maxWidth: "560px",
            lineHeight: 1.5,
            fontFamily: "Inter, sans-serif",
          }}>
            Mínimo 6 caracteres. Esta cuenta es por equipo — después vas a cargar los 3 jugadores.
          </p>
        )}
        {data.existingAccount && (
          <p style={{
            fontSize: "12px",
            color: "var(--faint)",
            marginTop: "10px",
            fontFamily: "Inter, sans-serif",
          }}>
            Usá la contraseña de tu cuenta existente.
          </p>
        )}
      </div>
    </>
  );
}
