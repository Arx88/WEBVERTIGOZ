"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import HeroCaballero from "./HeroCaballero";
import FoldText from "./FoldText";
import PageLoader from "@/components/shared/page-loader";

// Probabilidad de que la entrada muestre el hero del caballero (0..1).
// Override para pruebas: /?hero=knight o /?hero=clasico.
const KNIGHT_PROBABILITY = 0.3;

// useLayoutEffect real solo en cliente (evita el warning de SSR)
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function HeroSection() {
  // El sorteo corre antes del primer paint (useIsoLayoutEffect): si toca el
  // caballero, el loader de la página cubre la carga del video desde el inicio
  // y el hero aparece ya totalmente cargado, sin pop ni fondo mezclado.
  const [knight, setKnight] = useState(false);
  const [knightReady, setKnightReady] = useState(false);
  const [knightLoadingVisible, setKnightLoadingVisible] = useState(false);

  useIsoLayoutEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("hero");
    if (forced === "knight") {
      setKnight(true);
      return;
    }
    if (forced === "clasico" || forced === "classic") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (Math.random() < KNIGHT_PROBABILITY) setKnight(true);
  }, []);

  // El loader del caballero SOLO aparece si el video no está listo en 400ms
  // (con el video cacheado canplaythrough llega al instante → no hay segundo
  // loading que se superponga al de ruta). Si la red tarda, recién ahí cubre.
  useEffect(() => {
    if (!knight || knightReady) {
      setKnightLoadingVisible(false);
      return;
    }
    const t = setTimeout(() => setKnightLoadingVisible(true), 400);
    return () => clearTimeout(t);
  }, [knight, knightReady]);

  // Failsafe: si la red se atranca, revelar el hero igual tras 8s
  useEffect(() => {
    if (!knight || knightReady) return;
    const t = setTimeout(() => setKnightReady(true), 8000);
    return () => clearTimeout(t);
  }, [knight, knightReady]);

  return (
    <section className="relative w-full min-h-screen flex flex-col items-center justify-start pt-8 md:pt-10 overflow-hidden">
      <div className="absolute inset-0">
        {/* Capa base: siempre presente. Si entra el caballero, el video se funde encima. */}
        <Image
          src="/landing/hero.webp"
          alt="Vertigo Cup Hero"
          fill
          priority
          quality={90}
          className="object-cover object-center"
          sizes="100vw"
        />
        {knight && <HeroCaballero onCanPlayThrough={() => setKnightReady(true)} />}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,0,20,0.6)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0011]" />
      </div>

      {/* Con el caballero el layout cambia: logo anclado a la izquierda. */}
      <div
        className={`relative z-10 flex w-full flex-col pt-2 md:pt-4 ${
          knight ? "items-start px-8 md:px-14" : "items-center"
        }`}
      >
        <Image
          src="/landing/logo.png"
          alt="Age of Empires II - Vertigo Cup"
          width={280}
          height={120}
          priority
          className={`drop-shadow-[0_0_18px_rgba(255,46,158,0.35)] ${
            knight ? "w-[170px] md:w-[220px]" : "w-[210px] md:w-[280px]"
          }`}
        />
      </div>

      <div className="absolute bottom-16 md:bottom-20 left-0 right-0 z-10 flex flex-col items-center">
        <h2 className="landing-title font-cinzel text-[13px] md:text-[15px] tracking-[0.42em] uppercase">
          <FoldText text="Un giro, tres destinos." trigger="mount" hinge="top" stagger={0.03} />
        </h2>
        <a
          href="#enroll"
          className="mt-6 pulse-glow text-neon-pink"
          aria-label="Scroll"
        >
          <ChevronDown className="w-7 h-7" strokeWidth={1.5} />
        </a>
      </div>

      {/* Loader de la página mientras el video del caballero se carga completo
          (solo si no está cacheado: aparece tras 400ms sin canplaythrough) */}
      {knight && knightLoadingVisible && !knightReady && (
        <div className="fixed inset-0 z-[100]">
          <PageLoader />
        </div>
      )}
    </section>
  );
}
