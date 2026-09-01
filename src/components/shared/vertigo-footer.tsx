import Link from "next/link";
import { ART_BANDERA } from "@/lib/art";

/**
 * VÉRTIGO Cup — Footer cinematográfico.
 *
 * Cierra la página con la bandera del torneo, en la misma clave que el hero:
 * arte full-bleed que se funde con el fondo (#0a0011) por arriba y por abajo,
 * con el bloque de texto apoyado abajo a la izquierda sobre un tinte oscuro.
 *
 * El tagline por defecto es la frase del vértigo; la sección de apuestas le
 * pasa el suyo propio (juego de palabras con el pozo).
 */
export default function VertigoFooter({
  tagline = "El vértigo es el instante entre conocer tu destino y tener que enfrentarlo.",
}: {
  tagline?: string;
}) {
  return (
    <footer
      className="relative overflow-hidden rounded-2xl"
      style={{
        border: "1px solid rgba(212,175,55,0.22)",
        boxShadow: "0 -24px 60px rgba(0,0,0,0.35)",
      }}
    >
      {/* Arte: la bandera y el campamento, en video loop (poster = imagen estática) */}
      <video
        autoPlay
        muted
        loop
        playsInline
        src="/landing/bandera-loop.mp4"
        poster={ART_BANDERA}
        aria-hidden
        tabIndex={-1}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 42%",
          opacity: 0.52,
          pointerEvents: "none",
        }}
      />
      {/* Fundido vertical: la página se disuelve en la imagen y vuelve a disolverse */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #0a0011 0%, rgba(10,0,17,0.6) 24%, rgba(10,0,17,0.18) 52%, rgba(10,0,17,0.85) 100%)",
        }}
      />
      {/* Tinte lateral para la legibilidad del texto */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(7,0,17,0.88) 0%, rgba(7,0,17,0.4) 42%, rgba(7,0,17,0) 72%)",
        }}
      />
      {/* Línea dorada inferior — espejo de la del hero */}
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

      <div
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: 330,
          padding: "120px 38px 26px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{ width: 28, height: 1, background: "rgba(212,175,55,0.7)" }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "rgba(240,216,120,0.85)",
            }}
          >
            VÉRTIGO Cup · Age of Empires II
          </span>
        </div>

        <div
          className="font-cinzel"
          style={{
            fontSize: "clamp(24px, 3.2vw, 38px)",
            fontWeight: 700,
            lineHeight: 1.05,
            color: "var(--vertigo-text)",
            textShadow: "0 4px 28px rgba(0,0,0,0.7)",
          }}
        >
          La bandera sigue en pie.
        </div>
        <p
          style={{
            marginTop: 8,
            maxWidth: 520,
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--vertigo-muted)",
          }}
        >
          {tagline}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            flexWrap: "wrap",
            marginTop: 22,
            paddingTop: 16,
            borderTop: "1px solid rgba(212,175,55,0.22)",
          }}
        >
          {[
            { href: "/bracket", label: "Bracket" },
            { href: "/resultados", label: "Resultados" },
            { href: "/casters", label: "Casters" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "var(--vertigo-muted)",
                textDecoration: "none",
              }}
            >
              {l.label}
            </Link>
          ))}
          <span
            style={{
              marginLeft: "auto",
              fontSize: 10,
              letterSpacing: 1,
              color: "var(--vertigo-faint)",
            }}
          >
            Los puntos son de juego — no tienen valor monetario.
          </span>
        </div>
      </div>
    </footer>
  );
}
