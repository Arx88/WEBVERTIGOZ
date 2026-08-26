import { ArrowRight, X } from "lucide-react";
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
 * Acceso rápido de UN clic: cada cuenta recordada es un formulario que
 * restaura la sesión sin contraseña (token de dispositivo confiable).
 * Server component puro — sin estado ni localStorage.
 */
export default function QuickAccess({ devices }: { devices: TrustedDevice[] }) {
  if (!devices.length) return null;

  return (
    <div style={{ marginBottom: "22px" }}>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "2px",
          textTransform: "uppercase",
          color: "#b9a8e8",
          marginBottom: "10px",
        }}
      >
        Acceso rápido · última cuenta
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {devices.map((dev) => {
          const name = dev.displayName || dev.email.split("@")[0];
          return (
            <div key={dev.email} className="group relative">
              <form action={restoreDeviceAction}>
                <input type="hidden" name="email" value={dev.email} />
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-[rgba(167,139,250,0.22)] bg-[rgba(124,58,237,0.10)] px-3 py-2.5 text-left transition-all duration-200 hover:border-[rgba(255,46,158,0.45)] hover:bg-[rgba(255,46,158,0.12)]"
                  title={`Entrar como ${name}`}
                >
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gradient-to-b from-[#ff2e9e] to-[#7c3aed] font-cinzel text-[12px] font-bold text-white">
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
                    className="flex-none text-[#c9bdf0] transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[#ff2e9e]"
                  />
                </button>
              </form>
              <form action={forgetDeviceAction} className="absolute right-2 top-2">
                <input type="hidden" name="email" value={dev.email} />
                <button
                  type="submit"
                  aria-label={`Olvidar cuenta ${name}`}
                  className="grid h-6 w-6 cursor-pointer place-items-center rounded-md bg-[rgba(23,16,33,0.85)] text-[#8d84a0] opacity-0 transition-all duration-200 hover:bg-[rgba(255,255,255,0.12)] hover:text-white focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              </form>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "18px 0" }}>
        <span style={{ flex: 1, height: "1px", background: "rgba(167,139,250,0.18)" }} />
        <span style={{ fontSize: "11px", color: "#8d84a0", whiteSpace: "nowrap" }}>
          o ingresá con tu contraseña
        </span>
        <span style={{ flex: 1, height: "1px", background: "rgba(167,139,250,0.18)" }} />
      </div>
    </div>
  );
}
