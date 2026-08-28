"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlarmClock, Hourglass, TimerOff } from "lucide-react";
import {
  READY_WINDOW_MIN,
  computeReadyPhase,
  type ReadyWindowState,
} from "@/lib/match-rules";

export type { ReadyPhase, ReadyWindowState } from "@/lib/match-rules";

export function useReadyWindow(scheduledAtStart: string | null, status: string): ReadyWindowState {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return computeReadyPhase(scheduledAtStart, status, now);
}

function fmtHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Timer visible de la ventana de READY.
 * variant="block": tarjeta stat (página pública / admin).
 * variant="chip": línea compacta (panel del capitán, junto al botón).
 */
export default function ReadyDeadlineTimer({
  scheduledAtStart,
  status,
  variant = "block",
}: {
  scheduledAtStart: string | null;
  status: string;
  variant?: "block" | "chip";
}) {
  const router = useRouter();
  const { phase, msToOpen, msToDeadline } = useReadyWindow(scheduledAtStart, status);
  const refreshedRef = useRef(false);

  // Al agotarse la tolerancia, el server ya puede aplicar el W.O.:
  // refrescamos para que la página lo refleje (enforcement lazy).
  useEffect(() => {
    if (phase === "expired" && !refreshedRef.current) {
      refreshedRef.current = true;
      const t = setTimeout(() => router.refresh(), 1200);
      return () => clearTimeout(t);
    }
  }, [phase, router]);

  if (phase === "inactive" || phase === "no-date") return null;

  if (phase === "early") {
    const label = `READY se habilita en ${fmtHMS(msToOpen ?? 0)}`;
    return variant === "block" ? (
      <div className="vertigo-stat" style={{ textAlign: "center" }}>
        <div className="vertigo-stat-label">Ventana de READY</div>
        <div className="vertigo-stat-value" style={{ fontSize: 20 }}>
          <Hourglass style={{ width: 18, height: 18, display: "inline", marginRight: 8, verticalAlign: "middle", color: "var(--vertigo-faint)" }} strokeWidth={1.5} />
          {fmtHMS(msToOpen ?? 0)}
        </div>
        <div className="text-[11px] text-[var(--vertigo-faint)] mt-1">
          Se puede confirmar desde {READY_WINDOW_MIN} min antes del horario
        </div>
      </div>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--vertigo-muted)]">
        <Hourglass style={{ width: 12, height: 12, color: "var(--vertigo-faint)" }} />
        {label}
      </span>
    );
  }

  if (phase === "open") {
    return variant === "block" ? (
      <div className="vertigo-stat" style={{ textAlign: "center", borderColor: "rgba(34,197,94,0.35)" }}>
        <div className="vertigo-stat-label" style={{ color: "var(--vertigo-success)" }}>Ventana de READY abierta</div>
        <div className="text-[11px] text-[var(--vertigo-muted)] mt-1">
          W.O. automático en {fmtHMS(msToDeadline ?? 0)} si no confirmás
        </div>
      </div>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--vertigo-success)" }}>
        <AlarmClock style={{ width: 12, height: 12 }} />
        Ventana abierta · W.O. en {fmtHMS(msToDeadline ?? 0)}
      </span>
    );
  }

  if (phase === "grace") {
    const urgent = (msToDeadline ?? 0) <= 5 * 60_000;
    return variant === "block" ? (
      <div
        className="vertigo-stat"
        style={{
          textAlign: "center",
          borderColor: "rgba(251,113,133,0.5)",
          background: "rgba(251,113,133,0.07)",
        }}
      >
        <div className="vertigo-stat-label" style={{ color: "var(--vertigo-danger)" }}>
          Tolerancia en curso — W.O. automático
        </div>
        <div className="vertigo-stat-value" style={{ fontSize: 26, color: urgent ? "var(--vertigo-danger)" : undefined }}>
          <AlarmClock
            style={{ width: 20, height: 20, display: "inline", marginRight: 8, verticalAlign: "middle" }}
            strokeWidth={1.5}
          />
          {fmtHMS(msToDeadline ?? 0)}
        </div>
        <div className="text-[11px] text-[var(--vertigo-muted)] mt-1">
          El equipo que no confirmó READY pierde la llave
        </div>
      </div>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--vertigo-danger)" }}>
        <AlarmClock style={{ width: 12, height: 12 }} />
        W.O. automático en {fmtHMS(msToDeadline ?? 0)}
      </span>
    );
  }

  // expired
  return variant === "block" ? (
    <div className="vertigo-stat" style={{ textAlign: "center", borderColor: "rgba(251,113,133,0.5)" }}>
      <div className="vertigo-stat-label" style={{ color: "var(--vertigo-danger)" }}>Tiempo agotado</div>
      <div className="text-[11px] text-[var(--vertigo-muted)] mt-1">
        <TimerOff style={{ width: 12, height: 12, display: "inline", marginRight: 6 }} />
        Aplicando resultado por W.O.…
      </div>
    </div>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--vertigo-danger)" }}>
      <TimerOff style={{ width: 12, height: 12 }} />
      Tiempo agotado
    </span>
  );
}
