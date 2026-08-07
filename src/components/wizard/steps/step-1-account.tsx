"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Mail, Lock, User, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WizardStepAccount() {
  const { data, updateData } = useWizard();

  return (
    <div className="max-w-md mx-auto space-y-6 text-center">
      <p className="wiz-body">
        Comenzá creando la <strong>cuenta de tu equipo</strong>. Será el acceso
        principal para gestionar tu inscripción, ver tus partidos y administrar
        al equipo en futuras ediciones del torneo.
      </p>

      {/* Toggle: nueva cuenta vs existente */}
      <div className="flex border border-[rgba(255,46,158,0.22)] divide-x divide-[rgba(255,46,158,0.22)]">
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

      <div className="space-y-5 text-left">
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
          <p className="wiz-caption mt-2 normal-case tracking-[0.04em] text-[11px] text-[rgba(255,180,220,0.45)]" style={{ letterSpacing: "0.06em" }}>
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
            <p className="wiz-caption mt-2 normal-case tracking-[0.04em] text-[11px] text-[rgba(255,180,220,0.45)]" style={{ letterSpacing: "0.06em" }}>
              Mínimo 6 caracteres.
            </p>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="wiz-panel border-l-2 border-l-[#ff2e9e] px-4 py-3 text-left">
        <p className="text-[13px] leading-relaxed text-[#e6d3f5]">
          Esta cuenta es <span className="text-[#ff2e9e] font-semibold">por equipo</span>, no por jugador.
          El dueño podrá cargar los 3 jugadores y elegir un capitán como
          contacto oficial con el staff.
        </p>
      </div>
    </div>
  );
}
