"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown, X } from "lucide-react";
import { restoreDeviceAction, forgetDeviceAction } from "@/server/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import type { TrustedDevice } from "@/lib/device-trust";

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "V"
  );
}

/**
 * Tarjeta de cuenta recordada (acceso de UN clic). Ancho completo —
 * idéntico al de los campos de email/contraseña de abajo.
 *
 * La flecha y la X de "olvidar" comparten UN mismo slot al extremo
 * derecho: en reposo se ve la flecha; al hacer hover sobre la fila la
 * flecha se desvanece y la X aparece exactamente en su lugar — jamás se
 * superponen porque solo una es visible a la vez.
 */
function DeviceRow({ dev }: { dev: TrustedDevice }) {
  const name = dev.displayName || dev.email.split("@")[0];
  return (
    <div className="group relative w-full">
      <form action={restoreDeviceAction}>
        <input type="hidden" name="email" value={dev.email} />
        <button
          type="submit"
          className="qa-card flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[rgba(167,139,250,0.22)] bg-[rgba(124,58,237,0.10)] px-3 py-2 text-left transition-all duration-200 hover:border-[rgba(255,46,158,0.45)] hover:bg-[rgba(255,46,158,0.12)]"
          title={`Entrar como ${name}`}
        >
          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-to-b from-[#ff2e9e] to-[#7c3aed] font-cinzel text-[11px] font-bold text-white">
            {initialsOf(name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold text-white">
              {name}
            </span>
            <span className="block truncate text-[11px] text-[#b5adc4]">
              Entrar como {ROLE_LABEL[dev.role] ?? "Miembro"} · {dev.email}
            </span>
          </span>
          <ArrowRight
            size={16}
            className="qa-arrow flex-none text-[#c9bdf0] transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-0"
          />
        </button>
      </form>
      <form
        action={forgetDeviceAction}
        className="absolute right-2 top-1/2 -translate-y-1/2"
      >
        <input type="hidden" name="email" value={dev.email} />
        <button
          type="submit"
          aria-label={`Olvidar cuenta ${name}`}
          title={`Olvidar cuenta ${name}`}
          className="qa-forget-btn grid h-8 w-8 cursor-pointer place-items-center rounded-md bg-[rgba(23,16,33,0.85)] text-[#8d84a0] opacity-0 transition-all duration-200 hover:bg-[rgba(255,46,158,0.15)] hover:text-[#ff2e9e] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <X size={14} />
        </button>
      </form>
    </div>
  );
}

/**
 * Acceso rápido de UN clic: cada cuenta recordada es un formulario que
 * restaura la sesión sin contraseña (token de dispositivo confiable).
 *
 * Se muestra SOLO la primera cuenta; si hay más, el botón "Otras cuentas
 * (N)" vive AL FINAL de la lista: al desplegar, las cuentas extra quedan
 * contiguas a la primera (todas juntas) y el botón pasa a "Ocultar"
 * debajo de todas.
 */
export default function QuickAccess({ devices }: { devices: TrustedDevice[] }) {
  const [open, setOpen] = useState(false);
  if (!devices.length) return null;

  const [first, ...rest] = devices;

  return (
    <div style={{ marginBottom: "18px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
        <DeviceRow dev={first} />

        {open &&
          rest.map((dev) => <DeviceRow key={dev.email} dev={dev} />)}

        {rest.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "9px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(167,139,250,0.28)",
              background: "rgba(124,58,237,0.05)",
              color: "#b9a8e8",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all .2s ease",
            }}
          >
            <ChevronDown
              size={14}
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform .25s ease",
              }}
            />
            {open ? "Ocultar otras cuentas" : `Otras cuentas (${rest.length})`}
          </button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0" }}>
        <span style={{ flex: 1, height: "1px", background: "rgba(167,139,250,0.18)" }} />
        <span style={{ fontSize: "11px", color: "#8d84a0", whiteSpace: "nowrap" }}>
          o ingresá con tu contraseña
        </span>
        <span style={{ flex: 1, height: "1px", background: "rgba(167,139,250,0.18)" }} />
      </div>

      <style>{`
        /* En pantallas touch no hay hover: la X vive siempre visible
           (en el slot de la flecha, que se oculta) y la tarjeta le
           reserva aire para que el texto no pase por debajo. */
        @media (hover: none) {
          .qa-arrow { display: none; }
          .qa-forget-btn { opacity: 1; }
          .qa-card { padding-right: 46px; }
        }
      `}</style>
    </div>
  );
}
