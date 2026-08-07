"use client";

import { useState } from "react";
import { BookOpen, Loader2, Download } from "lucide-react";

export default function RulesSection() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      // TODO: integrar con Supabase Storage cuando el handbook esté subido
      // Por ahora, redirect a /admin/handbook donde el admin puede subirlo
      window.location.href = "/admin/handbook";
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative w-full min-h-[95vh] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/landing/universidad.webp"
          alt="Universidad"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,0,20,0.85)_0%,rgba(10,0,20,0.25)_60%,transparent_100%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0a0011] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0011]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl min-h-[95vh] flex items-center px-6">
        <div className="max-w-xl">
          <div className="reveal flex items-center gap-3">
            <BookOpen className="w-4 h-4 text-[#ff2e9e]" />
            <span className="font-cinzel text-[11px] tracking-[0.42em] uppercase text-[#ffb4dc]">Reglas y normativa</span>
          </div>

          <div className="reveal mt-4 hairline w-64" />

          <h3 className="reveal mt-6 font-cinzel text-[24px] md:text-[36px] leading-[1.18] uppercase tracking-[0.04em] text-neon">
            Un verdadero guerrero<br />
            siempre estudia el campo<br />
            de batalla y a sus rivales.
          </h3>

          <p className="reveal mt-5 max-w-md text-[13px] md:text-[14px] leading-relaxed text-[#e6d3f5]/80">
            Descargá el handbook oficial: formato del torneo, cartas de poder, penalizaciones
            y todo lo que tu equipo necesita saber antes del primer giro.
          </p>

          <div className="reveal mt-9">
            <button
              onClick={handleDownload}
              disabled={loading}
              data-testid="download-handbook-btn"
              className="btn-vertigo disabled:opacity-70"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Preparando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Download className="w-4 h-4" /> Descargar Handbook
                </span>
              )}
            </button>
            <p className="mt-4 font-cinzel text-[10px] tracking-[0.32em] uppercase text-[#ffb4dc]/60">
              Archivo PDF · Reglamento completo
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
