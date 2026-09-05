"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// VÉRTIGO Memotest — Animación de sorteo de civilizaciones
// ============================================================
//
// Mecánica:
// 1. Grilla de N tarjetas cuadradas con el dorso AoE2 (logo "AGE OF EMPIRES II" violeta)
// 2. Un selector se mueve tipo slot-machine entre las tarjetas
// 3. Cuando frena, esa tarjeta hace flip 3D y revela la civ
// 4. La civ revelada se "asigna" al jugador actual
// 5. La tarjeta revelada se quita del pool (no repite)
//
// El "sorteo real" lo decide el server (commit-reveal).
// Esta animación es puramente visual.
// ============================================================

export interface MemotestCard {
  id: string;
  civId: string;
  civName: string;
  civImageUrl?: string;
}

interface MemotestProps {
  cards: MemotestCard[];
  civsToDraw: number;
  teamSide: "A" | "B";
  alreadyDrawn: string[];
  onCivDrawn: (civ: MemotestCard, slotIndex: number) => void;
  trigger: boolean;
  disabled?: boolean;
  /** Se dispara cuando terminan TODOS los sorteos (civsToDraw alcanzado) con las civs reveladas. */
  onComplete?: (revealedIds: string[]) => void;
  /** Fija las columnas (p. ej. pantalla 16:9 del stream). Sin valor: responsive. */
  columns?: number;
  /** Muestra la franja "CIVILIZACIONES ASIGNADAS" (en la stream las civs viven en la banda central). */
  showStrip?: boolean;
}

type AnimState = "idle" | "spinning" | "flipping" | "revealed";

export default function Memotest({
  cards,
  civsToDraw,
  teamSide,
  alreadyDrawn,
  onCivDrawn,
  trigger,
  columns,
  showStrip = true,
  onComplete,
}: MemotestProps) {
  const [animState, setAnimState] = useState<AnimState>("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const [revealedCivs, setRevealedCivs] = useState<MemotestCard[]>([]);
  const [currentDrawIndex, setCurrentDrawIndex] = useState(0);

  const spinRafRef = useRef<number | null>(null);
  const spinStartRef = useRef<number>(0);
  const spinTargetRef = useRef<number>(0);
  const revealedRef = useRef<MemotestCard[]>([]);

  const availableCards = cards.filter(
    (c) => !alreadyDrawn.includes(c.civId) && !revealedCivs.some((r) => r.civId === c.civId)
  );

  // Índices del spin/flip apuntan a availableCards, pero la grilla renderiza
  // `cards` completa (las ya sorteadas quedan dadas vuelta en su lugar).
  // Sin esta traducción el selector/flip pega en la ficha equivocada.
  const cardIndexOf = useCallback((availIdx: number): number => {
    let seen = -1;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (alreadyDrawn.includes(c.civId) || revealedCivs.some((r) => r.civId === c.civId)) continue;
      seen++;
      if (seen === availIdx) return i;
    }
    return -1;
  }, [cards, alreadyDrawn, revealedCivs]);

  const startSpin = useCallback(() => {
    if (availableCards.length === 0) return;
    setAnimState("spinning");

    const targetIdx = Math.floor(Math.random() * availableCards.length);
    spinTargetRef.current = targetIdx;
    spinStartRef.current = performance.now();

    const duration = 3000 + Math.random() * 1000;

    const animate = (now: number) => {
      const elapsed = now - spinStartRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const totalSpins = 4 + eased * (targetIdx + 2);
      const currentPos = Math.floor(totalSpins * availableCards.length) % availableCards.length;

      if (progress > 0.85) {
        setActiveIndex(targetIdx);
      } else {
        setActiveIndex(currentPos);
      }

      if (progress < 1) {
        spinRafRef.current = requestAnimationFrame(animate);
      } else {
        setActiveIndex(targetIdx);
        setAnimState("flipping");
        setFlippedIndex(targetIdx);

        setTimeout(() => {
          const revealedCard = availableCards[targetIdx];
          const nextRevealed = [...revealedRef.current, revealedCard];
          revealedRef.current = nextRevealed;
          setRevealedCivs(nextRevealed);
          onCivDrawn(revealedCard, currentDrawIndex);
          setFlippedIndex(null);
          setAnimState("revealed");

          setTimeout(() => {
            setCurrentDrawIndex((idx) => {
              const nextIdx = idx + 1;
              if (nextIdx < civsToDraw) {
                setAnimState("idle");
                return nextIdx;
              }
              return idx;
            });
            // Fin de la tanda de este equipo: el caller encadena el siguiente.
            if (currentDrawIndex + 1 >= civsToDraw) onComplete?.(nextRevealed.map((c) => c.civId));
          }, 1000);
        }, 800);
      }
    };

    spinRafRef.current = requestAnimationFrame(animate);
  }, [availableCards, civsToDraw, currentDrawIndex, onCivDrawn, onComplete]);

  useEffect(() => {
    if (trigger && animState === "idle" && currentDrawIndex < civsToDraw) {
      // Diferido a un timer: el linter exige no llamar setState sincrónico
      // dentro del cuerpo del efecto; el arranque queda idéntico.
      const id = window.setTimeout(startSpin, 0);
      return () => window.clearTimeout(id);
    }
  }, [trigger, animState, currentDrawIndex, civsToDraw, startSpin]);

  useEffect(() => {
    return () => {
      if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
    };
  }, []);

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        No hay civilizaciones para sortear.
      </div>
    );
  }

  const totalCivsToSort = civsToDraw;
  const sortedCount = revealedCivs.length;

  // Traducción única a índices de la grilla completa
  const activeGridIndex = animState === "spinning" ? cardIndexOf(activeIndex) : -1;
  const flipGridIndex = animState === "flipping" && flippedIndex != null ? cardIndexOf(flippedIndex) : -1;

  return (
    <div className="mt-root">
      {/* Overline central: reglas de oro + título + estado del sorteo */}
      <div className="mt-head">
        <i className="mt-rule" aria-hidden />
        <div className="mt-head-mid">
          <div className="label-premium text-gold/80">
            SORTEO DE CIVILIZACIONES · EQUIPO {teamSide}
          </div>
          <div className="mt-head-sub">
            <span className="text-text-secondary text-sm">
              {sortedCount} de {totalCivsToSort} sorteadas
            </span>
            {animState === "spinning" && (
              <span className="text-accent text-caption uppercase tracking-wider animate-pulse">
                ◆ Sorteando...
              </span>
            )}
            {animState === "flipping" && (
              <span className="text-gold text-caption uppercase tracking-wider animate-pulse">
                ◆ Revelando...
              </span>
            )}
          </div>
        </div>
        <i className="mt-rule mt-rule-r" aria-hidden />
      </div>

      <div
        className="mt-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3"
        style={columns ? ({ "--mt-cols": columns } as React.CSSProperties) : undefined}
      >
        {cards.map((card, idx) => {
          const isRevealed = revealedCivs.some((r) => r.civId === card.civId);
          const isFlipping = flipGridIndex === idx;
          const isActive = activeGridIndex === idx;

          return (
            <MemotestCardView
              key={card.id}
              card={card}
              isRevealed={isRevealed}
              isFlipping={isFlipping}
              isActive={isActive}
            />
          );
        })}
      </div>

      {showStrip && revealedCivs.length > 0 && (
        <div className="mt-strip">
          <div className="label-premium text-gold/80 mt-strip-title">
            CIVILIZACIONES ASIGNADAS
          </div>
          <div className="mt-strip-row">
            {revealedCivs.map((civ, idx) => (
              <div key={civ.civId} className="mt-seal">
                <span className="mt-seal-num tabular-nums">{idx + 1}</span>
                {civ.civImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={civ.civImageUrl} alt="" className="mt-seal-img" draggable={false} />
                ) : null}
                <span className="mt-seal-name">{civ.civName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemotestCardView({
  card,
  isRevealed,
  isFlipping,
  isActive,
}: {
  card: MemotestCard;
  isRevealed: boolean;
  isFlipping: boolean;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "mt-card",
        isRevealed && "is-revealed",
        isFlipping && "is-flipping",
        isActive && "is-active"
      )}
    >
      <div className="mt-inner">
        {/* DORSO — logo AoE2 enmarcado; al frenar el selector, flip y aparece la civ */}
        <div className="mt-face mt-back">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/aoe2-logo.webp"
            alt="Age of Empires II"
            draggable={false}
            className="mt-back-logo"
          />
        </div>

        {/* FRENTE */}
        <div className="mt-face mt-front">
          {card.civImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.civImageUrl} alt={card.civName} className="mt-front-art" draggable={false} />
          ) : (
            <div className="mt-front-initial font-serif">{card.civName.charAt(0)}</div>
          )}
          <div className="mt-front-name">{card.civName}</div>
          {isFlipping && <i className="mt-front-sheen" aria-hidden />}
        </div>
      </div>
    </div>
  );
}
