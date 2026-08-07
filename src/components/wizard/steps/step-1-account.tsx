"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Mail, Lock, User, LogIn, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Step 1 — Cuenta
// Layout: 2 columnas
//   LEFT  (40%) — hero panel: brand mark + tagline phrase
//   RIGHT (60%) — toggle + email/password + info box
// ============================================================

export default function WizardStepAccount() {
  const { data, updateData } = useWizard();

  return (
    <div className="grid lg:grid-cols-[2fr_3fr] gap-6 lg:gap-8 items-stretch">
      {/* ====== LEFT — Brand visual side ====== */}
      <aside className="wiz-hero-panel relative hidden lg:flex flex-col justify-between p-8 min-h-[460px]">
        {/* Brand mark */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rotate-45 border border-[rgba(255,46,158,0.7)] flex items-center justify-center shadow-[0_0_18px_rgba(255,46,158,0.4)]">
            <span className="-rotate-45 font-cinzel text-[#ff2e9e] text-base font-bold">V</span>
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-cinzel text-[14px] tracking-[0.42em] uppercase text-[#f5eaff]">
              Vértigo
            </span>
            <span className="font-inter text-[9px] tracking-[0.22em] uppercase text-[rgba(255,180,220,0.55)] mt-1">
              Cup · 3a Edición
            </span>
          </div>
        </div>

        {/* Phrase */}
        <div className="relative">
          <span className="block h-px w-12 bg-[rgba(255,46,158,0.55)] mb-5" />
          <p className="font-cinzel text-[20px] md:text-[22px] leading-[1.32] uppercase tracking-[0.04em] text-neon">
            El vértigo es el instante
            <br />
            entre conocer tu destino
            <br />
            y tener que enfrentarlo.
          </p>
        </div>

        {/* Footer caption */}
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff2e9e] shadow-[0_0_8px_rgba(255,46,158,0.7)]" />
          <span className="font-inter text-[10px] tracking-[0.18em] uppercase text-[rgba(255,180,220,0.55)]">
            Inscripción de equipo · AoE2 DE
          </span>
        </div>
      </aside>

      {/* ====== RIGHT — Form ====== */}
      <div className="flex flex-col justify-center gap-6 max-w-md w-full mx-auto lg:mx-0">
        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <span className="h-px w-6 bg-[rgba(255,46,158,0.55)]" />
          <span className="wiz-section-eyebrow">
            Acceso del equipo
          </span>
        </div>

        <p className="wiz-body">
          Comenzá creando la <strong>cuenta de tu equipo</strong>. Será el acceso
          principal para gestionar tu inscripción, ver tus partidos y administrar
          al equipo en futuras ediciones del torneo.
        </p>

        {/* Toggle: nueva cuenta vs existente */}
        <div className="flex border border-[rgba(255,46,158,0.22)] divide-x divide-[rgba(255,46,158,0.22)] rounded-[4px] overflow-hidden">
          <button
            onClick={() => updateData({ existingAccount: false })}
            className={cn(
              "flex-1 px-3 py-3 font-cinzel text-[11px] tracking-[0.22em] uppercase transition-all flex items-center justify-center gap-2",
              !data.existingAccount
                ? "bg-[rgba(255,46,158,0.08)] text-[#f5eaff] border-b-2 border-[#ff2e9e] -mb-px"
                : "text-[rgba(255,180,220,0.55)] hover:text-[#ffb4dc]"
            )}
          >
            <User className="w-3.5 h-3.5" strokeWidth={1.5} />
            Crear cuenta
          </button>
          <button
            onClick={() => updateData({ existingAccount: true })}
            className={cn(
              "flex-1 px-3 py-3 font-cinzel text-[11px] tracking-[0.22em] uppercase transition-all flex items-center justify-center gap-2",
              data.existingAccount
                ? "bg-[rgba(255,46,158,0.08)] text-[#f5eaff] border-b-2 border-[#ff2e9e] -mb-px"
                : "text-[rgba(255,180,220,0.55)] hover:text-[#ffb4dc]"
            )}
          >
            <LogIn className="w-3.5 h-3.5" strokeWidth={1.5} />
            Ya tengo cuenta
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label htmlFor="email" className="wiz-label">
              Email del equipo
            </label>
            <div className="relative">
              <Mail
                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,180,220,0.55)]"
                strokeWidth={1.5}
              />
              <input
                id="email"
                type="email"
                placeholder="equipo@gmail.com"
                className="wiz-input pl-11"
                value={data.email}
                onChange={(e) => updateData({ email: e.target.value })}
                autoComplete="email"
                required
              />
            </div>
            <p className="wiz-meta mt-2 normal-case">
              Será el contacto principal con el staff.
            </p>
          </div>

          <div>
            <label htmlFor="password" className="wiz-label">
              {data.existingAccount ? "Contraseña" : "Crear contraseña"}
            </label>
            <div className="relative">
              <Lock
                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,180,220,0.55)]"
                strokeWidth={1.5}
              />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                className="wiz-input pl-11"
                value={data.password}
                onChange={(e) => updateData({ password: e.target.value })}
                autoComplete={data.existingAccount ? "current-password" : "new-password"}
                minLength={6}
                required
              />
            </div>
            {!data.existingAccount && (
              <p className="wiz-meta mt-2 normal-case">
                Mínimo 6 caracteres.
              </p>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="wiz-panel-sunken border-l-2 !border-l-[#ff2e9e] px-4 py-3 rounded-[4px] flex items-start gap-3">
          <Info className="w-4 h-4 text-[#ff2e9e] mt-0.5 shrink-0" strokeWidth={1.5} />
          <p className="wiz-body text-[13px]">
            Esta cuenta es <span className="text-[#ff2e9e] font-semibold">por equipo</span>, no por jugador.
            El dueño podrá cargar los 3 jugadores y elegir un capitán como
            contacto oficial con el staff.
          </p>
        </div>
      </div>
    </div>
  );
}
