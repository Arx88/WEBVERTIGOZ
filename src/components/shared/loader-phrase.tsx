"use client";

import { useRef } from "react";

/**
 * LoaderPhrase — frase del loading con rotación de ciclo completo.
 *
 * Mantiene una cola barajada a nivel de módulo: cada carga consume la
 * siguiente frase de la cola, y recién cuando se vieron las 9 se vuelve
 * a barajar. Así ninguna frase se repite hasta agotar el ciclo.
 *
 * La frase se reserva con un ref durante el render (no con useState),
 * para que el doble render de StrictMode en dev no consuma dos frases
 * por navegación.
 */
const LOADER_PHRASES = [
  "Preparando el campo de batalla…",
  "Reuniendo a los ejércitos…",
  "Convocando a los reinos…",
  "Afilando las espadas…",
  "Reclutando aldeanos…",
  "Recogiendo madera y oro…",
  "Levantando el castillo…",
  "Preparando el asedio…",
  "Wololo. Wololo. Wololo…",
];

let queue: string[] = [];

function shuffle(source: string[]): string[] {
  const copy = [...source];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function nextPhrase(): string {
  if (queue.length === 0) queue = shuffle(LOADER_PHRASES);
  return queue.pop()!;
}

export default function LoaderPhrase() {
  const phraseRef = useRef<string | null>(null);
  if (phraseRef.current === null) phraseRef.current = nextPhrase();
  return <div className="vertigo-loader-label">{phraseRef.current}</div>;
}