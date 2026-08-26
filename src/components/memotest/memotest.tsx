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
}

type AnimState = "idle" | "spinning" | "flipping" | "revealed";

export default function Memotest({
  cards,
  civsToDraw,
  teamSide,
  alreadyDrawn,
  onCivDrawn,
  trigger,
}: MemotestProps) {
  const [animState, setAnimState] = useState<AnimState>("idle");
  const [activeIndex, setActiveIndex] = useState(0);
  const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
  const [revealedCivs, setRevealedCivs] = useState<MemotestCard[]>([]);
  const [currentDrawIndex, setCurrentDrawIndex] = useState(0);

  const spinRafRef = useRef<number | null>(null);
  const spinStartRef = useRef<number>(0);
  const spinTargetRef = useRef<number>(0);

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

  useEffect(() => {
    if (trigger && animState === "idle" && currentDrawIndex < civsToDraw) {
      startSpin();
    }
  }, [trigger, animState, currentDrawIndex, civsToDraw]);

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
          setRevealedCivs((prev) => [...prev, revealedCard]);
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
          }, 1000);
        }, 800);
      }
    };

    spinRafRef.current = requestAnimationFrame(animate);
  }, [availableCards, civsToDraw, currentDrawIndex, onCivDrawn]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="label-premium text-gold/80">
            SORTEO DE CIVILIZACIONES · EQUIPO {teamSide}
          </div>
          <div className="text-text-secondary text-sm mt-1">
            {sortedCount} de {totalCivsToSort} sorteadas
          </div>
        </div>
        {animState === "spinning" && (
          <div className="text-accent text-caption uppercase tracking-wider animate-pulse">
            ◆ Sorteando...
          </div>
        )}
        {animState === "flipping" && (
          <div className="text-gold text-caption uppercase tracking-wider animate-pulse">
            ◆ Revelando...
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {cards.map((card, idx) => {
          const isRevealed = revealedCivs.some((r) => r.civId === card.civId);
          const isFlipping = flipGridIndex === idx;
          const isActive = activeGridIndex === idx;

          return (
            <MemotestCard
              key={card.id}
              card={card}
              isRevealed={isRevealed}
              isFlipping={isFlipping}
              isActive={isActive}
            />
          );
        })}
      </div>

      {revealedCivs.length > 0 && (
        <div className="border border-border-subtle bg-bg-elevated p-4">
          <div className="label-premium text-gold/80 mb-3">
            CIVILIZACIONES ASIGNADAS
          </div>
          <div className="flex flex-wrap gap-2">
            {revealedCivs.map((civ, idx) => (
              <div
                key={civ.civId}
                className="px-3 py-1 border border-gold/40 bg-gold/5 text-gold text-sm font-medium"
              >
                <span className="tabular-nums mr-2">{idx + 1}.</span>
                {civ.civName}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MemotestCard({
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
      className="aspect-square relative"
      style={{ perspective: "1000px" }}
    >
      <div
        className="relative w-full h-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: (isRevealed || isFlipping) ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* DORSO — logo AoE2; al frenar el selector, flip y aparece el escudo */}
        <div
          className={cn(
            "absolute inset-0 border-2 rounded-md overflow-hidden bg-[#6A0DAD]",
            isActive
              ? "border-gold scale-105"
              : "border-border-subtle"
          )}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <img
            src="/brand/aoe2-logo.webp"
            alt="Age of Empires II"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {isActive && (
            <div
              className="absolute inset-0 border-4 border-gold rounded-md animate-pulse"
              style={{ boxShadow: "0 0 20px rgba(212, 175, 55, 0.5)" }}
            />
          )}
        </div>

        {/* FRENTE */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center",
            "border-2 rounded-md overflow-hidden",
            "bg-bg-elevated border-gold"
          )}
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {card.civImageUrl ? (
            <img
              src={card.civImageUrl}
              alt={card.civName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="font-serif text-3xl text-gold font-bold">
              {card.civName.charAt(0)}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg-elevated to-transparent p-2">
            <div className="text-caption text-text-primary text-center uppercase tracking-wider font-medium">
              {card.civName}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
