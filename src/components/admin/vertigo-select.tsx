"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type VertigoOption = { value: string; label: string };

/**
 * Dropdown del panel con el look de VÉRTIGO. Reemplaza al <select> nativo,
 * cuyo popup de opciones no se puede estilizar. Incluye un input hidden con
 * el valor elegido para que los <form action={serverAction}> sigan enviando
 * el dato igual que antes. Navegación por teclado: flechas, Enter, Esc.
 * El popup se monta en portal sobre <body> (fixed): ninguna tarjeta con
 * overflow:hidden lo puede recortar.
 */
export default function VertigoSelect({
  name,
  options,
  defaultValue,
  className = "",
  compact = false,
  disabled = false,
  title,
  onValueChange,
}: {
  name?: string;
  options: VertigoOption[];
  defaultValue?: string;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  title?: string;
  onValueChange?: (value: string) => void;
}) {
  const initial = options.some((o) => o.value === defaultValue)
    ? (defaultValue as string)
    : (options[0]?.value ?? "");
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  // La opción vacía "" (p. ej. "Elegí un equipo…") es un placeholder:
  // se muestra en gris como texto de ejemplo, nunca en blanco de valor real.
  const showingPlaceholder = !selected || value === "";

  function placePopup() {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const LIST_MAX_H = 264 + 12; // max-h-64 + padding
    const below = r.bottom + 6;
    const top = below + LIST_MAX_H > window.innerHeight && r.top - LIST_MAX_H > 0
      ? Math.max(8, r.top - LIST_MAX_H - 6)
      : below;
    setPos({
      top,
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 180) - 8)),
      width: Math.max(r.width, 180),
    });
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

  // Al abrir: posicionar, resaltar el elegido y llevarlo a la vista
  useEffect(() => {
    if (!open) return;
    placePopup();
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setHighlight(idx);
    requestAnimationFrame(() => {
      const el = popRef.current?.children[idx] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pick(v: string) {
    setValue(v);
    setOpen(false);
    onValueChange?.(v);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(options.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        if (options[highlight]) pick(options[highlight].value);
        break;
      case "Escape":
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={onKeyDown}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={title}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-[10px] border bg-[var(--vertigo-input-bg)] px-3.5 text-left font-medium text-[var(--vertigo-text)] transition-colors hover:border-[#3a3049] focus:border-[var(--vertigo-purple)] focus:shadow-[0_0_0_3px_rgba(124,58,237,0.14)] focus:outline-none ${
          compact ? "min-h-0 py-1.5 text-[12px]" : "min-h-[46px] py-2.5 text-[14px]"
        } ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
      >
        <span className={`truncate ${showingPlaceholder ? "text-[#5f5870]" : ""}`}>
          {selected?.label ?? "— Elegí una opción —"}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#D4AF37] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <ul
            ref={popRef}
            role="listbox"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
            // El portal vive en <body>, fuera del DOM de quien lo hospeda
            // (p. ej. el popup de VertigoDateTime): sin stopPropagation, el
            // mousedown llega al handler "click afuera" del hospedador y lo
            // cierra antes de que el click elija la opción.
            onMouseDown={(e) => e.stopPropagation()}
            className="vertigo-scroll z-[9999] max-h-64 overflow-auto rounded-[10px] border border-[#2a2334] bg-[#161122] py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.65)]"
          >
            {options.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li key={o.value || `opt-${i}`} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o.value)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[13px] transition-colors ${
                      i === highlight
                        ? "bg-[rgba(124,58,237,0.18)] text-white"
                        : "text-[#cfc8dd]"
                    } ${isSel ? "text-[#e9d18a]" : ""}`}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
