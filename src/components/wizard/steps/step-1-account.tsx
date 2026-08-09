"use client";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step1Account() {
  const { data, updateData } = useWizard();
  return (
    <>
      <div className="field">
        <label>¿Ya tenés cuenta o creás una nueva?</label>
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          {[
            { val: false, label: "Crear cuenta" },
            { val: true, label: "Ya tengo cuenta" },
          ].map((opt) => (
            <button
              key={String(opt.val)}
              onClick={() => updateData({ existingAccount: opt.val })}
              style={{
                flex: 1, padding: "12px", fontSize: "12px", fontWeight: 600,
                letterSpacing: "1.8px", textTransform: "uppercase", borderRadius: "9px",
                cursor: "pointer", transition: "all .3s cubic-bezier(.22,1,.36,1)",
                background: data.existingAccount === opt.val ? "linear-gradient(180deg,rgba(124,58,237,.25),rgba(124,58,237,.10))" : "var(--input-bg)",
                border: `1px solid ${data.existingAccount === opt.val ? "var(--purple)" : "var(--input-border)"}`,
                color: data.existingAccount === opt.val ? "#efe9ff" : "var(--muted)",
                boxShadow: data.existingAccount === opt.val ? "0 0 0 3px rgba(124,58,237,.12), 0 4px 18px rgba(124,58,237,.22)" : "none",
              }}
            >{opt.label}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">Email del equipo</label>
        <input id="email" type="email" placeholder="tu@email.com" value={data.email}
          onChange={(e) => updateData({ email: e.target.value })} autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="password">{data.existingAccount ? "Contraseña" : "Crear contraseña"}</label>
        <input id="password" type="password" placeholder="••••••••" value={data.password}
          onChange={(e) => updateData({ password: e.target.value })}
          autoComplete={data.existingAccount ? "current-password" : "new-password"} minLength={6} />
      </div>
      {!data.existingAccount && (
        <p style={{ fontSize: "12.5px", color: "var(--muted)", maxWidth: "560px", fontWeight: 500 }}>
          Esta cuenta es por equipo, no por jugador. Podrás cargar hasta 3 jugadores en el siguiente paso.
        </p>
      )}
    </>
  );
}
