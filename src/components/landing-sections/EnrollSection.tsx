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
          <span className="badge-thin">Últimos 3 cupos disponibles</span>
        </div>

        <h2 className="reveal landing-title relative mt-8 font-cinzel text-[26px] leading-[1.25] md:text-[42px] md:leading-[1.2] uppercase tracking-[0.06em] max-w-3xl">
          El vértigo es el instante<br />
          entre conocer tu destino y<br />
          tener que enfrentarlo
        </h2>

        <p className="reveal relative mt-6 max-w-xl text-[13px] md:text-[15px] leading-relaxed text-[#e6d3f5]/80">
          Tres jugadores. Una civilización. Un giro que decide el mapa, el modo y las reglas
          de la batalla. Inscribí tu equipo antes de que se agoten los cupos.
        </p>

        <div className="reveal relative mt-10">
          <a href="/registro" className="btn-vertigo">
            Inscribir equipo
          </a>
        </div>

        <div className="reveal relative mt-9">
          <a
            href="/registro-espectador"
            className="badge-thin transition-all duration-200 hover:border-[#ff2e9e]/80 hover:text-white"
          >
            ¿No jugás? · Apostá como espectador · 1000 puntos de bienvenida
          </a>
        </div>
      </div>
    </section>
  );
}
