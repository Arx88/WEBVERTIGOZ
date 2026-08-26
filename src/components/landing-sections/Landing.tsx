"use client";

import { useEffect, useRef } from "react";
import HeroSection from "./HeroSection";
import EnrollSection from "./EnrollSection";
import RegisterSection from "./RegisterSection";
import RouletteSection from "./RouletteSection";
import CivSection from "./CivSection";
import RulesSection from "./RulesSection";
import TrophySection from "./TrophySection";
import Footer from "./Footer";

export default function Landing() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <main ref={rootRef} className="relative w-full overflow-hidden bg-[#0a0011] text-white">
      <HeroSection />
      <EnrollSection />
      <RegisterSection />
      <RouletteSection />
      <CivSection />
      <RulesSection />
      <TrophySection />
      <Footer />
    </main>
  );
}
