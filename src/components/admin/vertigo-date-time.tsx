"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import VertigoSelect from "./vertigo-select";

const PAD = (n: number) => String(n).padStart(2, "0");
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];
const HORAS = Array.from({ length: 24 }, (_, i) => ({ value: PAD(i), label: `${PAD(i)} h` }));
const MINUTOS = Array.from({ length: 60 }, (_, i) => ({ value: PAD(i), label: PAD(i) }));
const POPUP_H = 360;

/** "2026-08-07T20:00" → partes locales (acepta también con segundos) */
function parseLocalInput(v: string) {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return {
    y: +m[1], mo: +m[2], d: +m[3],
    hh: m[4] != null ? +m[4] : null, mm: m[5] != null ? +m[5] : null,
  };
}

function toLocalInput(date: Date, hh: number, mm: number) {
  return `${date.getFullYear()}-${PAD(date.getMonth() + 1)}-${PAD(date.getDate())}T${PAD(hh)}:${PAD(mm)}`;
}

/**
 * Calendario del panel con el look de VÉRTIGO. Reemplaza al
 * <input type="datetime-local"> nativo (su popup no se puede estilizar).
 * — Grilla mensual (lunes primero) con navegación por mes y año.
 * — Hora y minuto con VertigoSelect; botones Hoy y Limpiar.
 * — Input hidden con el mismo formato "YYYY-MM-DDTHH:mm" que enviaba el
 *   nativo, así las server actions no cambian.
 * — `required`: bloquea el submit del form mientras esté vacío.
 * — Popup en portal sobre <body> (fixed): ninguna tarjeta lo recorta.
 */
export default function VertigoDateTime({
  name,
  defaultValue = "",
  required = false,
  disabled = false,
  className = "",
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [missing, setMissing] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const initParts = parseLocalInput(defaultValue);
  const [time, setTimeState] = useState({ h: initParts?.hh ?? 20, m: initParts?.mm ?? 0 });
  const now = new Date();
  const [view, setView] = useState(() => {
    const p = parseLocalInput(defaultValue);
    return p ? new Date(p.y, p.mo - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  function placePopup() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.bottom + 6;
    const top = below + POPUP_H > window.innerHeight && r.top - POPUP_H > 0
      ? Math.max(8, r.top - POPUP_H - 6)
      : below;
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - 286 - 8)) });
  }

  // Cerrar con click afuera (el popup vive en portal, fuera de rootRef)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    // Seguir al scroll de la página (no al del propio popup)
    const onScroll = (e: Event) => {
      if (!popRef.current?.contains(e.target as Node)) placePopup();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  // Al abrir: posicionar
  useEffect(() => {
    if (!open) return;
    placePopup();
  }, [open]);

  // required: frenar el submit del form si sigue vacío
  useEffect(() => {
    if (!required) return;
    const form = hiddenRef.current?.form;
    if (!form) return;
    const onSubmit = (e: Event) => {
      if (!valueRef.current) {
        e.preventDefault();
        setMissing(true);
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [required]);

  const parts = parseLocalInput(value);

  function setFromDate(d: Date) {
    const next = toLocalInput(d, time.h, time.m);
    setValue(next);
    setMissing(false);
  }
  function setTime(h: number, m: number) {
    setTimeState({ h, m });
    if (parts) {
      setValue(toLocalInput(new Date(parts.y, parts.mo - 1, parts.d), h, m));
      setMissing(false);
    }
  }
  function openAt() {
    if (disabled) return;
    const p = parseLocalInput(value);
    setView(p ? new Date(p.y, p.mo - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1));
    setOpen(true);
  }

  // Grilla: lunes primero, incluye días de meses lindantes
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(view.getFullYear(), view.getMonth(), 1 - offset + i);
    return {
      date: d,
      inMonth: d.getMonth() === view.getMonth(),
      input: `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`,
    };
  });
  const todayInput = `${now.getFullYear()}-${PAD(now.getMonth() + 1)}-${PAD(now.getDate())}`;
  const selectedDay = parts ? `${parts.y}-${PAD(parts.mo)}-${PAD(parts.d)}` : "";

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <input ref={hiddenRef} type="hidden" name={name} value={value} />
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt())}
        className={`flex w-full items-center justify-between gap-2 rounded-[10px] border bg-[var(--vertigo-input-bg)] px-3.5 py-2.5 text-left font-medium text-[14px] text-[var(--vertigo-text)] transition-colors hover:border-[#3a3049] focus:border-[var(--vertigo-purple)] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.14)] focus:outline-none ${
          missing ? "border-[#ff2e9e]/70" : "border-[var(--vertigo-input-border)]"
        } ${disabled ? "cursor-not-allowed border-dashed opacity-45" : "cursor-pointer"}`}
      >
        <span className={`truncate ${parts ? "" : "text-[#5f5870]"}`}>
          {parts
            ? `${PAD(parts.d)}/${PAD(parts.mo)}/${parts.y} ${PAD(parts.hh ?? 0)}:${PAD(parts.mm ?? 0)}`
            : required
              ? "Elegí fecha y hora *"
              : "Elegí fecha y hora"}
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-[#D4AF37]" />
      </button>

      {open &&
        createPortal(
          <div
            ref={popRef}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-[9999] w-[286px] rounded-[12px] border border-[#2a2334] bg-[#161122] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
          >
            {/* Navegación mes/año */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setView(new Date(view.getFullYear() - 1, view.getMonth(), 1))} className="rounded-md p-1 text-[#8f86a3] transition-colors hover:bg-[rgba(124,58,237,0.18)] hover:text-white" aria-label="Año anterior">
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="rounded-md p-1 text-[#8f86a3] transition-colors hover:bg-[rgba(124,58,237,0.18)] hover:text-white" aria-label="Mes anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
              <span className="font-cinzel text-[13px] uppercase tracking-[0.18em] text-[#e9d18a]">
                {MESES[view.getMonth()]} {view.getFullYear()}
              </span>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="rounded-md p-1 text-[#8f86a3] transition-colors hover:bg-[rgba(124,58,237,0.18)] hover:text-white" aria-label="Mes siguiente">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setView(new Date(view.getFullYear() + 1, view.getMonth(), 1))} className="rounded-md p-1 text-[#8f86a3] transition-colors hover:bg-[rgba(124,58,237,0.18)] hover:text-white" aria-label="Año siguiente">
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Días de la semana */}
            <div className="mb-1 grid grid-cols-7">
              {DIAS.map((d) => (
                <span key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-[#8f86a3]">
                  {d}
                </span>
              ))}
            </div>

            {/* Grilla de días */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map(({ date, inMonth, input }) => {
                const isSel = input === selectedDay;
                const isToday = input === todayInput;
                return (
                  <button
                    key={input}
                    type="button"
                    onClick={() => setFromDate(date)}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[12px] transition-colors ${
                      isSel
                        ? "bg-gradient-to-br from-[#f0d78a] to-[#c49a2c] font-bold text-[#1a1206] shadow-[0_0_10px_rgba(212,175,55,0.45)]"
                        : "text-[#cfc8dd] hover:bg-[rgba(124,58,237,0.2)] hover:text-white"
                    } ${!inMonth && !isSel ? "opacity-30" : ""} ${isToday && !isSel ? "ring-1 ring-inset ring-[#D4AF37]/60" : ""}`}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            {/* Hora + minuto + atajos */}
            <div className="mt-3 flex items-center gap-2 border-t border-[#2a2334] pt-3">
            <div className="w-[88px]" key={`h-${time.h}`}>
              <VertigoSelect compact options={HORAS} defaultValue={PAD(time.h)} title="Hora" onValueChange={(v) => setTime(+v, time.m)} />
            </div>
            <span className="text-[13px] font-bold text-[#8f86a3]">:</span>
            <div className="w-[76px]" key={`m-${time.m}`}>
              <VertigoSelect compact options={MINUTOS} defaultValue={PAD(time.m)} title="Minuto" onValueChange={(v) => setTime(time.h, +v)} />
            </div>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFromDate(now)}
                  className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#e9d18a]/90 transition-colors hover:bg-[rgba(212,175,55,0.12)]"
                >
                  Hoy
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => { setValue(""); setMissing(false); }}
                    className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-[#8f86a3] transition-colors hover:bg-[rgba(255,46,158,0.12)] hover:text-[#ffb4dc]"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
