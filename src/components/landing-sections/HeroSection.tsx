"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="relative w-full min-h-screen flex flex-col items-center justify-start pt-8 md:pt-10 overflow-hidden">
      <div className="absolute inset-0">
        <Image
          src="/landing/hero.webp"
          alt="Vertigo Cup Hero"
          fill
          priority
          quality={90}
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,0,20,0.6)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0011]" />
      </div>

      <div className="relative z-10 flex flex-col items-center pt-2 md:pt-4">
        <Image
          src="/landing/logo.png"
          alt="Age of Empires II - Vertigo Cup"
          width={280}
          height={120}
          priority
          className="w-[210px] md:w-[280px] drop-shadow-[0_0_18px_rgba(255,46,158,0.35)]"
        />
      </div>

      <div className="absolute bottom-16 md:bottom-20 left-0 right-0 z-10 flex flex-col items-center">
        <h2 className="landing-title font-cinzel text-[13px] md:text-[15px] tracking-[0.42em] uppercase reveal">
          Un giro, tres destinos.
        </h2>
        <a
          href="#enroll"
          className="mt-6 pulse-glow text-neon-pink"
          aria-label="Scroll"
        >
          <ChevronDown className="w-7 h-7" strokeWidth={1.5} />
        </a>
      </div>
    </section>
  );
}
