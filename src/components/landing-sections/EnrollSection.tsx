"use client";

export default function EnrollSection() {
  return (
    <section id="enroll" className="relative w-full min-h-[95vh] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/landing/fondo-castillo.webp"
          alt="Castillo en llamas"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(10,0,20,0.75)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0a0011] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0011]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl min-h-[95vh] flex flex-col items-center justify-center text-center px-6">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-[420px] bg-[radial-gradient(ellipse_at_center,rgba(10,0,20,0.8)_0%,rgba(10,0,20,0.45)_45%,transparent_75%)]" />
        <div className="reveal relative">
          <span className="badge-thin">Trailer Vértigo Cup</span>
        </div>

        <div className="reveal relative mt-8 w-full max-w-4xl aspect-video overflow-hidden border border-[#D4AF37]/40 shadow-[0_4px_12px_rgba(0,0,0,0.4)]">
          <video
            className="h-full w-full object-cover"
            src="/landing/trailer.mp4"
            poster="/landing/trailer-poster.jpg"
            controls
            preload="metadata"
            playsInline
          />
        </div>

      </div>
    </section>
  );
}
