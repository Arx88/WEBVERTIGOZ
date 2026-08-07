"use client";

import { useState } from "react";
import Memotest, { type MemotestCard } from "@/components/memotest/memotest";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

// 9 civs de ejemplo (deberían ser las que el equipo eligió)
const EXAMPLE_CIVS: MemotestCard[] = [
  { id: "1", civId: "britons", civName: "Britanos" },
  { id: "2", civId: "franks", civName: "Francos" },
  { id: "3", civId: "goths", civName: "Godos" },
  { id: "4", civId: "teutons", civName: "Teutones" },
  { id: "5", civId: "japanese", civName: "Japoneses" },
  { id: "6", civId: "chinese", civName: "Chinos" },
  { id: "7", civId: "byzantines", civName: "Bizantinos" },
  { id: "8", civId: "persians", civName: "Persas" },
  { id: "9", civId: "saracens", civName: "Sarracenos" },
];

export default function MemotestDemoPage() {
  const [trigger, setTrigger] = useState(false);
  const [drawnCivs, setDrawnCivs] = useState<string[]>([]);

  function handleStart() {
    setDrawnCivs([]);
    setTrigger(false);
    setTimeout(() => setTrigger(true), 100);
  }

  function handleReset() {
    setTrigger(false);
    setDrawnCivs([]);
  }

  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-border-subtle">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="font-serif text-xl">VÉRTIGO · Memotest Demo</div>
          <div className="text-caption text-text-tertiary uppercase tracking-wider">
            Animación de sorteo de civilizaciones
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <div className="border-l-2 border-gold/40 pl-4 py-2">
          <p className="text-text-secondary text-sm font-light">
            Esta es la animación del memotest que se usa para sortear las
            civilizaciones durante una partida. El selector se mueve tipo
            slot-machine, frena en una tarjeta, y esa tarjeta hace flip 3D
            revelando la civ. Las civs ya sorteadas se quitan del pool.
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleStart} disabled={trigger}>
            <Play className="w-4 h-4" />
            Sortear 3 civs (3v3)
          </Button>
          <Button onClick={handleReset} variant="ghost">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>

        <Memotest
          cards={EXAMPLE_CIVS}
          civsToDraw={3}
          teamSide="A"
          alreadyDrawn={drawnCivs}
          onCivDrawn={(civ, idx) => {
            console.log(`Civ sorteada ${idx + 1}:`, civ);
            setDrawnCivs((prev) => [...prev, civ.civId]);
          }}
          trigger={trigger}
        />

        {drawnCivs.length === 3 && (
          <div className="border border-success/40 bg-success/5 p-4 text-success text-sm">
            ✓ Sorteo completo. Las 3 civs ya están asignadas a los jugadores del equipo A.
            El equipo B debe hacer su propio sorteo con sus 9 civs elegidas.
          </div>
        )}
      </div>
    </main>
  );
}
