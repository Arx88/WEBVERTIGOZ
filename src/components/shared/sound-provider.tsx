"use client";

/**
 * SoundProvider — cobertura global de sonido sin tocar cada página:
 *
 * 1. DELEGACIÓN DE CLICKS: todo <button>, <a> o [role="button"] del sitio
 *    suena: "page" (pasar página) en links internos, "tap" en el resto
 *    (un solo listener en document). La ruleta queda excluida
 *    (tiene su propio audio scoped) y [data-sound-off] silencia un árbol.
 *
 * 1b. HOVER EN NAVEGACIÓN: links/botones del header y del nav suenan
 *     "hover" (casi imperceptible, con antirrebote de 80ms).
 *
 * 2. OBSERVADOR DE TOASTS: los toasts de Sonner son el canal universal de
 *    feedback del sitio — success/error/info suenan solos, sin modificar
 *    ninguno de los call-sites.
 *
 * Se monta una vez en el root layout. No renderiza nada.
 */

import { useEffect } from "react";
import { playSound } from "@/lib/sounds";

const INTERACTIVE = "button, a, [role='button'], input[type='submit']";

function isDisabled(el: Element): boolean {
  const anyEl = el as HTMLButtonElement;
  return (
    anyEl.disabled === true ||
    el.getAttribute("aria-disabled") === "true" ||
    el.closest("[disabled]") !== null
  );
}

export default function SoundProvider() {
  useEffect(() => {
    // ── 1. Tap global en interacción ──────────────────────────────────
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 && e.type === "mousedown") return;
      const path = e.composedPath() as Element[];
      const el = path.find((n) => n instanceof Element && n.matches?.(INTERACTIVE));
      if (!el || isDisabled(el)) return;
      // Exclusiones: ruleta con audio propio; árboles marcados como mudos.
      if (el.closest(".ruleta-wrapper") || el.closest("[data-sound-off]")) return;
      // Links internos → "page" (pasar página); botones y resto → "tap".
      const a = el.closest("a[href]") as HTMLAnchorElement | null;
      const internal = a !== null && (a.getAttribute("href")?.startsWith("/") ?? false) && a.target !== "_blank";
      playSound(internal ? "page" : "tap");
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });

    // Enter/Space dispara click en la mayoría de navegadores, pero algunos
    // componentes custom usan keydown: cubrimos el caso accesible básico.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const el = e.target as Element | null;
      if (!el?.matches?.(INTERACTIVE) || isDisabled(el)) return;
      if (el.closest(".ruleta-wrapper") || el.closest("[data-sound-off]")) return;
      playSound("tap");
    };
    document.addEventListener("keydown", onKey, { capture: true });

    // ── 1b. Hover sutil solo en la navegación (header/nav) ────────────
    let lastHover = 0;
    const onHover = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastHover < 80) return;
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
      if (!el || isDisabled(el)) return;
      if (!el.closest("header, nav")) return;
      if (el.closest(".ruleta-wrapper") || el.closest("[data-sound-off]")) return;
      lastHover = now;
      playSound("hover");
    };
    document.addEventListener("mouseover", onHover, { passive: true });

    // ── 2. Toasts de Sonner → success / error / chime ─────────────────
    const seen = new WeakSet<Element>();
    const classify = (toast: Element) => {
      const type = toast.getAttribute("data-type");
      if (type === "success") playSound("success");
      else if (type === "error") playSound("error");
      else playSound("chime");
    };
    const scan = (root: Element) => {
      root.querySelectorAll?.("[data-sonner-toast]").forEach((t) => {
        if (!seen.has(t)) {
          seen.add(t);
          classify(t);
        }
      });
    };
    const observer = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return;
          if (n.matches?.("[data-sonner-toast]")) {
            if (!seen.has(n)) {
              seen.add(n);
              classify(n);
            }
          } else {
            scan(n);
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("keydown", onKey, { capture: true });
      document.removeEventListener("mouseover", onHover);
      observer.disconnect();
    };
  }, []);

  return null;
}
