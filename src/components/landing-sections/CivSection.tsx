"use client";

import { useEffect, useRef, useState } from "react";
import { Dices } from "lucide-react";

const PHRASES = [
  "Los 3 jugadores de cada equipo deberán manejar una civilización en conjunto",
  "Solo podrán usar unidades únicas y asedio",
  "El límite de población se extiende a 500",
  "2 vs 2, elijan quiénes jugarán",
  "El modo cambia a Rey de la Colina",
];

export default function CivSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onEnded = () => {
      setIndex((i) => (i + 1) % PHRASES.length);
      v.currentTime = 0;
      v.play().catch(() => {});
    };
    v.addEventListener("ended", onEnded);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.15 }
    );
    io.observe(v);

    return () => {
      v.removeEventListener("ended", onEnded);
      io.disconnect();
    };
  }, []);

  return (
    <section data-testid="civ-section" className="relative w-full overflow-hidden bg-[#0a0011]">
      <div className="relative w-full">
        <video
          ref={videoRef}
          data-testid="roulette-video"
          className="block w-full h-auto"
          muted
          playsInline
          autoPlay
          preload="auto"
          poster="/landing/ruleta-poster.jpg"
        >
          <source src="/landing/ruleta.webm" type="video/webm" />
          <source src="/landing/ruleta.mp4" type="video/mp4" />
        </video>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(10,0,20,0.55)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-[#0a0011] via-[rgba(10,0,17,0.7)] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 md:h-40 bg-gradient-to-b from-transparent to-[#0a0011]" />
      </div>

      <div className="relative z-20 mx-auto max-w-3xl px-6 pb-16 pt-10 text-center md:absolute md:inset-x-0 md:top-0 md:pt-20 md:pb-0">
        <div className="reveal flex justify-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 border-y border-[rgba(255,46,158,0.35)]">
            <Dices className="w-4 h-4 text-[#ff2e9e]" />
            <span className="font-cinzel text-[12px] tracking-[0.42em] text-[#ffb4dc] uppercase">7 · 7 · 7</span>
            <Dices className="w-4 h-4 text-[#ff2e9e]" />
          </span>
        </div>

        <div className="reveal mt-8 mx-auto max-w-3xl">
          <p className="font-cinzel text-[10px] tracking-[0.42em] uppercase text-[#ffb4dc]/70">
            Regla del giro
          </p>
          <h3
            key={index}
            data-testid="civ-phrase"
            className="phrase-in mt-5 font-cinzel text-[20px] md:text-[32px] leading-[1.3] uppercase tracking-[0.05em] text-neon min-h-[2.6em] flex items-center justify-center"
          >
            &ldquo;{PHRASES[index]}&rdquo;
          </h3>

          <div data-testid="civ-phrase-dots" className="mt-7 flex items-center justify-center gap-2">
            {PHRASES.map((_, i) => (
              <span
                key={i}
                className={`h-[6px] rounded-full transition-all duration-500 ${
                  i === index
                    ? "w-6 bg-[#ff2e9e] shadow-[0_0_10px_rgba(255,46,158,0.9)]"
                    : "w-[6px] bg-[rgba(255,180,220,0.28)]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
