export default function TrophySection() {
  return (
    <section className="relative w-full min-h-[95vh] overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/landing/monje-trofeo.png"
          alt="Monje con trofeo"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(270deg,rgba(10,0,20,0.85)_0%,rgba(10,0,20,0.25)_55%,transparent_100%)]" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0a0011] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#0a0011]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl min-h-[95vh] flex items-center justify-end px-6">
        <div className="max-w-lg text-right">
          <div className="reveal flex items-center gap-3 justify-end">
            <img src="/landing/trofeo.png" alt="trofeo" className="w-4 h-4 opacity-90" />
            <span className="font-cinzel text-[11px] tracking-[0.42em] uppercase text-[#ffb4dc]">Primera edición Vertigo Cup</span>
          </div>

          <div className="reveal ml-auto mt-4 hairline w-64" />

          <h3 className="reveal mt-6 font-cinzel text-[24px] md:text-[36px] leading-[1.18] uppercase tracking-[0.04em] text-neon">
            Solo el equipo que<br />
            soporte el peso del<br />
            destino, podrá levantar<br />
            la copa vértigo.
          </h3>

          <div className="reveal mt-9 flex justify-end">
            <img
              src="/landing/firma.png"
              alt="Vertigo Cup Staff"
              className="w-48 md:w-64 opacity-90 invert"
              style={{ filter: "invert(1) drop-shadow(0 0 12px rgba(255,46,158,0.35))" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
