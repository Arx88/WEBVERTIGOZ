import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import SiteNav from "@/components/nav/site-nav";
import VertigoFooter from "@/components/shared/vertigo-footer";
import { DISCORD_INVITE_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const SECCIONES: { titulo: string; cuerpo: string[] }[] = [
  {
    titulo: "1. El torneo",
    cuerpo: [
      "VÉRTIGO Cup es un torneo amateur de Age of Empires II. La inscripción y la participación en el torneo implican la aceptación íntegra de estos Términos y Condiciones y del handbook oficial del torneo.",
      "La organización se reserva el derecho de admisión y de decidir sobre cualquier situación no contemplada en este documento.",
    ],
  },
  {
    titulo: "2. Inscripción y elegibilidad",
    cuerpo: [
      "Los equipos se inscriben a través del sitio oficial dentro de la ventana de inscripción de cada edición. La organización verifica el ELO y la identidad de los jugadores, y puede rechazar o anular inscripciones que no cumplan los requisitos.",
      "Cada jugador solo puede formar parte de un equipo por edición.",
    ],
  },
  {
    titulo: "3. Reglamento de competencia",
    cuerpo: [
      "El handbook oficial es la autoridad máxima en materia de formato, sorteo, cartas de poder, comodines, pausas, desconexiones y penalizaciones. En caso de conflicto entre estos términos y el handbook, prevalece el handbook.",
      "Las decisiones del staff y los resultados de las disputas son inapelables una vez firmes.",
    ],
  },
  {
    titulo: "4. Puntos y apuestas",
    cuerpo: [
      "Los puntos de espectador y el sistema de apuestas son exclusivamente recreativos. Los puntos no tienen valor monetario, no pueden comprarse, venderse ni canjearse por dinero o bienes, y no constituyen un juego de azar con premio.",
      "La organización puede ajustar, pausar o cancelar el sistema de puntos en cualquier momento.",
    ],
  },
  {
    titulo: "5. Formas de pago",
    cuerpo: [
      "Los únicos medios de pago aceptados por la organización son PayPal y Mercado Pago, siempre a través de los canales oficiales comunicados por el staff.",
      "Ningún pago realizado por fuera de los canales oficiales será reconocido. La organización nunca solicita pagos por mensaje directo.",
    ],
  },
  {
    titulo: "6. Conducta",
    cuerpo: [
      "Se exige respeto entre jugadores, staff, casters y espectadores. El acoso, el discurso de odio, el cheating y cualquier forma de manipulación de resultados se sancionan con penalizaciones que pueden llegar a la descalificación y la expulsión permanente.",
    ],
  },
  {
    titulo: "7. Modificaciones",
    cuerpo: [
      "La organización puede modificar estos términos durante el desarrollo del torneo. Los cambios se anuncian en el Discord oficial y en el sitio; la participación posterior al anuncio implica su aceptación.",
    ],
  },
  {
    titulo: "8. Contacto",
    cuerpo: [
      "El canal oficial de comunicación es el Discord del torneo. Ante cualquier duda sobre estos términos, consultá con el staff antes de actuar.",
    ],
  },
];

export default function TerminosPage() {
  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <SiteNav />

      <main className="vertigo-content" style={{ maxWidth: 860, padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <span className="vertigo-kicker">
            <Scale style={{ width: 12, height: 12 }} />
            VÉRTIGO CUP · AGE OF EMPIRES II
          </span>
          <h1
            className="vertigo-title"
            style={{ fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1, margin: "8px 0 10px" }}
          >
            Términos y Condiciones
          </h1>
          <p className="vertigo-desc" style={{ margin: 0, fontSize: 14 }}>
            Las reglas del juego fuera del juego. Última actualización: agosto 2026.
          </p>
        </div>

        {/* Secciones */}
        <div className="flex flex-col gap-4 mb-10">
          {SECCIONES.map((s) => (
            <section key={s.titulo} className="vertigo-card" style={{ padding: "22px 26px" }}>
              <h2
                className="font-cinzel font-bold"
                style={{
                  fontSize: 14,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "var(--vertigo-text)",
                  marginBottom: 10,
                }}
              >
                {s.titulo}
              </h2>
              {s.cuerpo.map((p, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.7,
                    color: "var(--vertigo-muted)",
                    margin: i > 0 ? "10px 0 0" : 0,
                  }}
                >
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>

        {/* CTA Discord */}
        <div
          className="vertigo-card"
          style={{
            padding: "20px 26px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
            border: "1px solid rgba(212,175,55,0.3)",
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div className="font-cinzel font-bold" style={{ fontSize: 14, color: "var(--vertigo-text)" }}>
              ¿Dudas con estos términos?
            </div>
            <div style={{ fontSize: 12.5, color: "var(--vertigo-muted)", marginTop: 4 }}>
              El staff responde en el Discord oficial del torneo.
            </div>
          </div>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="vertigo-btn vertigo-btn-ghost"
            style={{ padding: "8px 16px", fontSize: 11 }}
          >
            Ir al Discord
            <ChevronRight style={{ width: 12, height: 12 }} />
          </a>
        </div>

        <div style={{ textAlign: "center", marginTop: 28 }}>
          <Link
            href="/"
            style={{
              fontSize: 11,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "var(--vertigo-faint)",
              textDecoration: "none",
            }}
          >
            ← Volver al inicio
          </Link>
        </div>

        <div style={{ marginTop: 40 }}>
          <VertigoFooter />
        </div>
      </main>
    </div>
  );
}
