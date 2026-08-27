"use client";

import { civName } from "@/lib/constants/civs";

/**
 * Carousel de escudos de civilizaciones: marquee infinito que se pausa al
 * pasar el mouse. Las civs base llevan marco violeta; las extra, marco
 * dorado con etiqueta "Extra".
 */
export function CivCarousel({
  baseCivs,
  extraCivs = [],
}: {
  baseCivs: string[];
  extraCivs?: string[];
}) {
  const items = [
    ...baseCivs.map((id) => ({ id, extra: false })),
    ...extraCivs.map((id) => ({ id, extra: true })),
  ];
  if (items.length === 0) return null;

  // Repetir hasta llenar medio track (mínimo 12 tiles) para que el loop
  // translateX(-50%) sea siempre continuo, incluso con pools chicos.
  const repeats = Math.max(1, Math.ceil(12 / items.length));
  const half = Array.from({ length: repeats }, () => items).flat();

  return (
    <div className="civ-carousel" role="list" aria-label="Pool de civilizaciones">
      <div
        className="civ-carousel-track"
        style={{ animationDuration: `${half.length * 3.2}s` }}
      >
        {[0, 1].map((copy) => (
          <div className="civ-carousel-half" key={copy} aria-hidden={copy === 1}>
            {half.map(({ id, extra }, i) => (
              <div
                key={`${id}-${i}`}
                role="listitem"
                className={`civ-tile${extra ? " civ-tile-extra" : ""}`}
              >
                <div className="civ-tile-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/civs/${id}.webp`}
                    alt={civName(id)}
                    width={520}
                    height={520}
                    loading="lazy"
                    draggable={false}
                  />
                </div>
                <span className="civ-tile-name">{civName(id)}</span>
                {extra && <span className="civ-tile-tag">Extra</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <style>{`
        .civ-carousel {
          position: relative;
          overflow: hidden;
          margin: 4px -28px 0;
          padding: 10px 0 6px;
        }
        /* Desvanecido en los bordes, fundido con el fondo de la tarjeta */
        .civ-carousel::before,
        .civ-carousel::after {
          content: "";
          position: absolute;
          top: 0;
          bottom: 0;
          width: 90px;
          z-index: 2;
          pointer-events: none;
        }
        .civ-carousel::before {
          left: 0;
          background: linear-gradient(90deg, #0d0913 8%, transparent);
        }
        .civ-carousel::after {
          right: 0;
          background: linear-gradient(-90deg, #0d0913 8%, transparent);
        }

        .civ-carousel-track {
          display: flex;
          width: max-content;
          animation: civ-marquee linear infinite;
        }
        .civ-carousel:hover .civ-carousel-track {
          animation-play-state: paused;
        }
        @keyframes civ-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .civ-carousel-half { display: flex; }

        .civ-tile {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          width: 138px;
          padding: 8px 0 12px;
          cursor: default;
        }
        .civ-tile-frame {
          width: 98px;
          height: 98px;
          border-radius: 22px;
          border: 1px solid rgba(124, 58, 237, 0.42);
          background:
            radial-gradient(70% 70% at 50% 30%, rgba(124, 58, 237, 0.22), transparent 75%),
            rgba(10, 6, 18, 0.9);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
          display: grid;
          place-items: center;
          transition: transform .35s var(--vertigo-ease, ease), box-shadow .35s ease, border-color .35s ease;
        }
        .civ-tile-frame img {
          width: 78px;
          height: 78px;
          object-fit: contain;
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.55));
          transition: transform .35s ease, filter .35s ease;
        }
        .civ-tile:hover .civ-tile-frame {
          transform: translateY(-5px) scale(1.07);
          border-color: rgba(212, 175, 55, 0.75);
          box-shadow:
            0 14px 30px rgba(0, 0, 0, 0.55),
            0 0 26px rgba(124, 58, 237, 0.4),
            0 0 12px rgba(212, 175, 55, 0.22);
        }
        .civ-tile:hover .civ-tile-frame img {
          transform: scale(1.05);
          filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.6)) saturate(1.15) brightness(1.08);
        }
        .civ-tile-name {
          font-family: Cinzel, serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: var(--vertigo-muted);
          text-align: center;
          transition: color .3s ease;
        }
        .civ-tile:hover .civ-tile-name { color: var(--vertigo-text); }

        /* Civs extra: marco dorado + etiqueta */
        .civ-tile-extra .civ-tile-frame {
          border-color: rgba(212, 175, 55, 0.55);
          background:
            radial-gradient(70% 70% at 50% 30%, rgba(212, 175, 55, 0.16), transparent 75%),
            rgba(10, 6, 18, 0.9);
        }
        .civ-tile-extra:hover .civ-tile-frame {
          border-color: rgba(212, 175, 55, 0.9);
          box-shadow:
            0 14px 30px rgba(0, 0, 0, 0.55),
            0 0 26px rgba(212, 175, 55, 0.35);
        }
        .civ-tile-tag {
          position: absolute;
          top: 2px;
          right: 14px;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          color: #1a1206;
          background: linear-gradient(180deg, #e8c95a, #b8912a);
          padding: 3px 8px;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        }

        @media (prefers-reduced-motion: reduce) {
          .civ-carousel-track { animation: none; }
        }
        @media (max-width: 640px) {
          .civ-carousel { margin: 4px -18px 0; }
          .civ-tile { width: 116px; }
          .civ-tile-frame { width: 84px; height: 84px; }
          .civ-tile-frame img { width: 66px; height: 66px; }
        }
      `}</style>
    </div>
  );
}
