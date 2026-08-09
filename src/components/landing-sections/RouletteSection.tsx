"use client";

import { Sparkles } from "lucide-react";

export default function RouletteSection() {
  return (
    <section
      data-testid="roulette-section"
      className="relative w-full min-h-[95vh] pt-24 pb-24 md:pt-28 md:pb-32 overflow-hidden flex flex-col"
    >
      <div className="absolute inset-0">
        <img
          src="/landing/ruleta-fondo.webp"
          alt="Caballero girando la ruleta"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,0,20,0.65)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#0a0011] via-[rgba(10,0,17,0.5)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0011]" />
      </div>

      <div className="relative z-20 mx-auto w-full max-w-5xl px-6 text-center">
        <div className="reveal flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 border-y border-[rgba(255,46,158,0.35)]">
            <Sparkles className="w-4 h-4 text-[#ff2e9e]" />
            <span className="font-cinzel text-[11px] tracking-[0.42em] text-[#ffb4dc] uppercase">Cartas de poder</span>
          </span>
        </div>

        <h3 className="reveal mt-7 font-cinzel text-[21px] md:text-[33px] leading-[1.3] uppercase tracking-[0.06em] text-neon max-w-4xl mx-auto">
          &ldquo;Cada acción está en manos del azar,<br />
          pero tendrás el poder de cambiarlo&rdquo;
        </h3>
      </div>

      <div
        data-testid="power-cards"
        className="relative z-20 mt-16 flex items-center justify-center px-6
                   md:mt-0 md:absolute md:right-[4%] lg:right-[7%] md:top-[54%] md:-translate-y-1/2 md:px-0"
      >
        <div className="relative flex items-end justify-center">
          <img
            src="/landing/carta-invocar.png"
            alt="Invocar Pro"
            data-testid="card-invocar"
            className="card-fan-a w-[46%] max-w-[230px] md:w-[250px] lg:w-[300px] md:max-w-none"
          />
          <img
            src="/landing/carta-girar.png"
            alt="Girar de Nuevo"
            data-testid="card-girar"
            className="card-fan-b -ml-[14%] md:-ml-14 lg:-ml-16 w-[44%] max-w-[220px] md:w-[238px] lg:w-[286px] md:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
