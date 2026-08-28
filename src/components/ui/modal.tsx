"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { playSound } from "@/lib/sounds";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Ancho máximo del panel en px (default 440) */
  maxWidth?: number;
  /** Muestra el botón X de cerrar (default true) */
  showClose?: boolean;
}

/**
 * Modal primitivo de VÉRTIGO — overlay oscuro con blur y panel central.
 * El CSS del wizard está scopado a .wizard-page, así que las páginas
 * públicas necesitan su propio overlay.
 */
export function Modal({ open, onClose, children, maxWidth = 440, showClose = true }: ModalProps) {
  // Portal a <body>: si la página envuelve el contenido en un nodo con
  // transform (ej. .vertigo-fade-in conserva matrix(1,0,0,1,0,0) tras la
  // animación), el position:fixed del overlay pasa a ser relativo a ese nodo
  // y el overlay termina ocupando TODO el documento (el panel queda centrado
  // a miles de px fuera del viewport). El portal lo saca de ahí.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Sonido de apertura (respeta el mute global).
  useEffect(() => {
    if (open) playSound("pop");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(7, 3, 16, 0.82)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth,
          background: "var(--vertigo-modal)",
          border: "1px solid var(--vertigo-line)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.12)",
          animation: "vertigo-modal-in 0.28s var(--vertigo-ease)",
        }}
      >
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--vertigo-line)",
              background: "transparent",
              color: "var(--vertigo-muted)",
              cursor: "pointer",
              transition: "all 0.2s var(--vertigo-ease)",
            }}
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        )}
        {children}
      </div>
      <style>{`
        @keyframes vertigo-modal-in {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}      </style>
    </div>,
    document.body
  );
}
