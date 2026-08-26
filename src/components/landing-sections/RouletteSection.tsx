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
        <div className="absolute inset-x-0 bottom-0 h-48 md:h-56 bg-gradient-to-b from-transparent via-[rgba(10,0,17,0.55)] to-[#0a0011]" />
      </div>

      <div className="relative z-20 mx-auto w-full max-w-5xl px-6 text-center">
        <div className="reveal flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 border-y border-[rgba(255,46,158,0.35)]">
            <Sparkles className="w-4 h-4 text-[#ff2e9e]" />
            <span className="font-cinzel text-[11px] tracking-[0.42em] text-[#ffb4dc] uppercase">Cartas de poder</span>
          </span>
        </div>

        <h3 className="reveal landing-title mt-7 font-cinzel text-[21px] md:text-[33px] leading-[1.3] uppercase tracking-[0.06em] max-w-4xl mx-auto">
          &ldquo;Cada acción está en manos del azar,<br />
          pero tendrás el poder de cambiarlo&rdquo;
        </h3>
      </div>

      <div
        data-testid="power-cards"
        className="relative z-20 mt-16 flex items-center justify-center px-6
                   md:mt-0 md:absolute md:right-[3%] lg:right-[6%] md:top-1/2 md:-translate-y-1/2 md:px-0"
      >
        <div className="relative flex items-end justify-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-20 -bottom-10 top-10 bg-[radial-gradient(ellipse_at_center_bottom,rgba(255,46,158,0.28),rgba(150,40,255,0.14)_45%,transparent_72%)] blur-xl"
          />
          <img
            src="/landing/carta-invocar.png"
            alt="Invocar Pro"
            data-testid="card-invocar"
            className="card-fan-a w-[54%] max-w-[280px] md:w-[310px] lg:w-[380px] md:max-w-none"
          />
          <img
            src="/landing/carta-girar.png"
            alt="Girar de Nuevo"
            data-testid="card-girar"
            className="card-fan-b -ml-[15%] md:-ml-16 lg:-ml-20 w-[50%] max-w-[264px] md:w-[294px] lg:w-[360px] md:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
