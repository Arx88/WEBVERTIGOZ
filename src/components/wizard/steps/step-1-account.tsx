"use client";

import { useWizard } from "@/components/wizard/wizard-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, LogIn } from "lucide-react";

export default function WizardStepAccount() {
  const { data, updateData } = useWizard();

  return (
    <div className="max-w-md mx-auto space-y-8">
      <div className="space-y-2">
        <p className="text-text-secondary text-sm font-light leading-relaxed">
          Comienza creando la cuenta de tu equipo. Esta cuenta será el acceso
          principal para gestionar tu inscripción, ver tus partidos y administrar
          tu equipo en futuras ediciones del torneo.
        </p>
      </div>

      {/* Toggle: nueva cuenta vs existente */}
      <div className="flex border border-border-subtle">
        <button
          onClick={() => updateData({ existingAccount: false })}
          className={`flex-1 px-4 py-3 text-label transition-colors ${
            !data.existingAccount
              ? "bg-bg-hover text-text-primary border-b-2 border-gold"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          <User className="w-4 h-4 inline mr-2" strokeWidth={1.5} />
          CREAR CUENTA
        </button>
        <button
          onClick={() => updateData({ existingAccount: true })}
          className={`flex-1 px-4 py-3 text-label transition-colors ${
            data.existingAccount
              ? "bg-bg-hover text-text-primary border-b-2 border-gold"
              : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          <LogIn className="w-4 h-4 inline mr-2" strokeWidth={1.5} />
          YA TENGO CUENTA
        </button>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email del equipo</Label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" strokeWidth={1.5} />
            <Input
              id="email"
              type="email"
              placeholder="equipo@gmail.com"
              className="pl-10"
              value={data.email}
              onChange={(e) => updateData({ email: e.target.value })}
              autoComplete="email"
              required
            />
          </div>
          <p className="text-caption text-text-tertiary">
            Será el contacto principal del equipo con el staff.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">
            {data.existingAccount ? "Contraseña" : "Crear contraseña"}
          </Label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" strokeWidth={1.5} />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              className="pl-10"
              value={data.password}
              onChange={(e) => updateData({ password: e.target.value })}
              autoComplete={data.existingAccount ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>
          {!data.existingAccount && (
            <p className="text-caption text-text-tertiary">
              Mínimo 6 caracteres.
            </p>
          )}
        </div>
      </div>

      {/* Info box premium */}
      <div className="border-l-2 border-gold/40 pl-4 py-2">
        <p className="text-caption text-text-secondary leading-relaxed">
          Esta cuenta es <span className="text-gold">por equipo</span>, no por jugador.
          El dueño de la cuenta podrá cargar los 3 jugadores y elegir un capitán
          que será el contacto oficial con el staff.
        </p>
      </div>
    </div>
  );
}
