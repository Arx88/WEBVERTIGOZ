/**
 * Fondo de banner: imagen de marca del torneo como capa base + paleta
 * derivada del id del equipo como tinte único (determinística: mismo
 * equipo, mismas siempre). Sin imagen, cae al emblema difuminado.
 */
const PALETTES: [string, string][] = [
  ["#7c3aed", "#ff2e9e"], // violeta → rosa (marca)
  ["#d8a13f", "#5b21b6"], // dorado → violeta profundo
  ["#ff2e7e", "#4c1d95"], // magenta → índigo
  ["#22e5c2", "#6d28d9"], // turquesa → violeta
  ["#f59e0b", "#be185d"], // ámbar → vino
  ["#8b5cf6", "#0ea5e9"], // lila → cielo
];

export function deriveTeamPalette(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function TeamBannerBg({
  emblemUrl,
  seed,
  backgroundImage,
}: {
  emblemUrl?: string | null;
  seed: string;
  /** Imagen de marca (castillo, trofeo…): base del banner, con tinte único encima. */
  backgroundImage?: string;
}) {
  const [c1, c2] = deriveTeamPalette(seed);
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {backgroundImage ? (
        // Imagen de marca del torneo, nítida y protagonista
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url('${backgroundImage}')`,
            backgroundSize: "cover",
            backgroundPosition: "center 35%",
          }}
        />
      ) : (
        // El emblema del equipo, gigante y difuminado: identidad única
        emblemUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={emblemUrl}
            alt=""
            style={{
              position: "absolute",
              left: "-25%",
              top: "-45%",
              width: "150%",
              height: "190%",
              objectFit: "cover",
              filter: "blur(54px) saturate(1.7) brightness(0.85)",
              opacity: 0.55,
            }}
          />
        )
      )}
      {/* Tinte de la paleta derivada (sutil para no tapar la imagen) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: backgroundImage ? 0.45 : 1,
          background: `radial-gradient(62% 95% at 12% 8%, ${c1}59, transparent 62%), radial-gradient(52% 85% at 88% 18%, ${c2}47, transparent 66%)`,
        }}
      />
      {/* Oscurecer hacia abajo para legibilidad del texto */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(7,3,16,0.30) 0%, rgba(7,3,16,0.78) 62%, #070310 100%)",
        }}
      />
      {/* Borde dorado inferior */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
        }}
      />
    </div>
  );
}
