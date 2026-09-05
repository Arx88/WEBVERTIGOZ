"use client";

/**
 * ReadyScene — piezas compartidas de las pantallas de READY (overlay OBS + tour).
 *
 * Principios (regla de oro de simetría del proyecto):
 *  - NADA depende del largo del texto: el escudo, la placa de nombre
 *    (alto fijo de 2 renglones) y la franja de estado son zonas de huella
 *    idéntica en ambos lados. Un nombre de 1 línea y otro de 3 producen
 *    exactamente la misma geometría de columna.
 *  - Cero cajas para "hacer columnas": la columna es contenido puro;
 *    la única pieza de vidrio es el tablero del reloj, centrado abajo.
 *  - Cinematografía: escudo como moneda 3D flotando con halo, sheen y
 *    reflejo en el piso; reloj de torneo con dado 3D y dígitos en celdas
 *    (nada de texto gigante genérico).
 *
 * Unidades cqh/cqw: dentro del viewport del tour (container-type: size)
 * escalan con el monitor; en el overlay caen al viewport real. Con
 * prefers-reduced-motion todo queda estático.
 */

import { Shield, CheckCircle2 } from "lucide-react";
import { fmt } from "@/lib/format";

/** Columna de equipo del READY: escudo 3D + placa + estado (huella fija). */
export function ReadyTeamSide({
  name,
  emblemUrl,
  accent,
  side,
  readyAt,
  showState,
}: {
  name: string;
  emblemUrl: string | null;
  /** Color del equipo para halo/glow (deriveTeamPalette). */
  accent: string;
  side: "A" | "B";
  /** Confirmación READY — null muestra el pill de espera. */
  readyAt: string | null;
  /** Reserva la franja de estado (fases previas). Fuera de ella, la franja no existe. */
  showState: boolean;
}) {
  return (
    <div className="rs-team" data-side={side} style={{ "--rs-accent": accent } as React.CSSProperties}>
      {/* Escudo 3D: moneda inclinada con halo + sheen */}
      <div className="rs-crest-scene">
        <div className="rs-crest-halo" aria-hidden />
        <div className="rs-coin">
          {emblemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emblemUrl} alt={name} />
          ) : (
            <Shield style={{ width: "42%", height: "42%", color: "var(--vertigo-purple-soft)" }} strokeWidth={1.1} />
          )}
          <span className="rs-coin-sheen" aria-hidden />
        </div>
      </div>
      {/* Placa de nombre: alto fijo 2 renglones + hairlines flanqueando */}
      <div className="rs-plate">
        <span className="rs-plate-name">{name}</span>
      </div>
      {/* Franja de estado RESERVADA: el chip flota siempre a la misma altura */}
      {showState && (
        <div className="rs-state">
          {readyAt ? (
            <div className="rs-pill rs-pill--on">
              <CheckCircle2 style={{ width: "1em", height: "1em" }} />
              Ready · {fmt.time(readyAt)}
            </div>
          ) : (
            <div className="rs-pill rs-pill--wait">
              <span className="rs-pill-dot" aria-hidden />
              Esperando confirmación
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Reloj del READY — minimal de broadcast: etiqueta en versalitas con
 * hairlines, UNA cifra tabular y nada más. Sin cajas por dígito, sin
 * adornos. `danger` lo pinta rojo y lo hace respirar.
 */
export function ReadyTimerBoard({
  label,
  time,
  danger,
  note,
}: {
  label: string;
  /** Hora formateada HH:MM:SS o MM:SS. */
  time: string;
  danger?: boolean;
  note?: string;
}) {
  return (
    <div className={`rs-clock${danger ? " danger" : ""}`} role="timer" aria-label={`${label}: ${time}`}>
      <div className="rs-clock-head" aria-hidden>
        <span className="rs-clock-rule" />
        <span>{label}</span>
        <span className="rs-clock-rule rev" />
      </div>
      <div className="rs-clock-time">{time}</div>
      {note && <div className="rs-clock-note">{note}</div>}
    </div>
  );
}

/**
 * Tablero de ESTADO (sin reloj): misma geometría del rs-clock — hairlines
 * + versalitas arriba, cuerpo grande, nota abajo — pero el cuerpo es un
 * veredicto ("AMBOS LISTOS"), no una cifra. Estados de la llave que no
 * miden tiempo.
 */
export function StatusBoard({
  label,
  title,
  note,
  danger,
  success,
}: {
  label: string;
  title: string;
  note?: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <div
      className={`rs-clock${danger ? " danger" : ""}${success ? " success" : ""}`}
      role="status"
      aria-label={`${label}: ${title}`}
    >
      <div className="rs-clock-head" aria-hidden>
        <span className="rs-clock-rule" />
        <span>{label}</span>
        <span className="rs-clock-rule rev" />
      </div>
      <div className="rs-clock-time rs-clock-status">{title}</div>
      {note && <div className="rs-clock-note">{note}</div>}
    </div>
  );
}
