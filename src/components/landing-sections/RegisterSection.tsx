import { Coins, Mic, Swords } from "lucide-react";

const PATHS = [
  {
    href: "/registro-caster",
    img: "/landing/registro-caster.webp",
    imgHover: "/landing/registro-caster-hover.webp",
    role: "Caster",
    character: "Monje",
    blurb: "Relatá la batalla desde el palco oficial de VÉRTIGO.",
    Icon: Mic,
  },
  {
    href: "/registro",
    img: "/landing/registro-equipo.webp",
    imgHover: "/landing/registro-equipo-hover.webp",
    role: "Equipo",
    character: "Guerrero",
    blurb: "Tres jugadores, una civilización y un giro que lo decide todo.",
    Icon: Swords,
  },
  {
    href: "/registro-espectador",
    img: "/landing/registro-apostador.webp",
    imgHover: "/landing/registro-apostador-hover.webp",
    role: "Apostador",
    character: "Aldeano",
    blurb: "Apostá tus puntos en cada llave y trepá en el ranking.",
    Icon: Coins,
  },
];

export default function RegisterSection() {
  return (
    <section data-testid="register-section" className="relative w-full py-24 md:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#0a0011] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#0a0011]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="reveal flex items-center justify-center gap-3">
          <Swords className="w-4 h-4 text-[#ff2e9e]" />
          <span className="font-cinzel text-[11px] tracking-[0.42em] uppercase text-[#ffb4dc]">
            Elegí tu camino
          </span>
          <Swords className="w-4 h-4 text-[#ff2e9e]" />
        </div>
        <div className="reveal mx-auto mt-4 hairline w-64" />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {PATHS.map(({ href, img, imgHover, role, character, blurb, Icon }) => (
            <a
              key={href}
              href={href}
              className="reveal group relative block overflow-hidden rounded-lg border border-[rgba(255,46,158,0.22)] bg-[#12001f] transition-all duration-300 hover:border-[#ff2e9e]/80 hover:shadow-[0_0_36px_rgba(255,46,158,0.28)]"
            >
              <div className="relative aspect-[556/949] overflow-hidden">
                {/* Variante hover del arte: dissolve con blur para tapar el ghosting entre artes */}
                <img
                  src={img}
                  alt={`Registrarse como ${role} — ${character}`}
                  width={556}
                  height={949}
                  className="h-full w-full object-cover object-top transition-all duration-700 ease-out group-hover:scale-[1.06] group-hover:opacity-0 group-hover:blur-[12px]"
                />
                <img
                  src={imgHover}
                  alt=""
                  aria-hidden="true"
                  width={556}
                  height={949}
                  className="absolute inset-0 h-full w-full scale-[1.06] object-cover object-top opacity-0 blur-[16px] transition-all duration-700 ease-out group-hover:scale-100 group-hover:opacity-100 group-hover:blur-[0px]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(10,0,17,0.12)] to-[rgba(7,0,13,0.94)]" />
              </div>

                  <div className="absolute inset-x-0 bottom-0 p-7 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Icon className="h-6 w-6 text-[#ff2e9e]" />
                      <span className="font-cinzel text-[12px] tracking-[0.42em] uppercase text-[#ffb4dc]">
                        {character}
                      </span>
                    </div>
                    <h3 className="landing-title mt-2.5 font-cinzel text-[30px] md:text-[38px] uppercase tracking-[0.06em]">
                      {role}
                    </h3>
                    <p className="mt-3 text-[14px] md:text-[16px] leading-relaxed text-[#e6d3f5]/75">
                      {blurb}
                    </p>
                    <span className="mt-5 inline-block font-cinzel text-[12px] tracking-[0.32em] uppercase text-[#ff2e9e] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      Registrarme →
                    </span>
                  </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
