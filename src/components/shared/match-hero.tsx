"use client";

/**
 * VÉRTIGO Cup — MatchHero
 *
 * Banner cinematográfico de una partida: mapa, modo y atmósfera del enfrentamiento.
 * Usa la imagen correspondiente al sorteo de la DB (mapa, modo) o el vortex como
 * fallback. Es el primer impacto visual que tiene alguien al entrar a /partido/[id].
 *
 * Estilo: hero oscuro premium — imagen de fondo (con overlay oscuro degradado),
 * status del partido arriba a la derecha, detalles del sorteo en tarjetas de vidrio.
 */

import Image from "next/image";
import { artForMode, artForMap, ART_FALLBACK } from "@/lib/art";
import { Trophy, Dices, Layers, Map as MapIcon, Zap } from "lucide-react";

export interface MatchHeroProps {
  mapName?: string | null;
  gameModeName?: string | null;
  antimetaName?: string | null;
  playerModeName?: string | null;
  llaveName?: string | null;
  status: string;
  civsA?: string[];
  civsB?: string[];
  /** Quién está viendo esto — si es un juego en vivo, mostrar pulse */
  live?: boolean;
}

export default function MatchHero({
  mapName,
  gameModeName,
  antimetaName,
  playerModeName,
  llaveName,
  status,
  civsA,
  civsB,
  live,
}: MatchHeroProps) {
  // Elegir la imagen del mapa sorteado primero; si no hay, la del modo
  const mapArt = artForMap(mapName);
  const modeArt = artForMode(gameModeName);
  const bgImage = mapArt ?? modeArt ?? ART_FALLBACK;
  const hasArt = Boolean(mapArt || modeArt);

  const isDrawing = status === "drawing";
  const isOpen = status === "open";
  const isPlaying = status === "in_progress";
  const isFinished = status === "finished";

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        border: "1px solid var(--vertigo-line-soft)",
        minHeight: 300,
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* Fondo: imagen del mapa o modo */}
      <div style={{ position: "absolute", inset: 0 }}>
        {hasArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgImage}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
              opacity: 0.55,
            }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #0a0714 0%, #120a1e 50%, #05030a 100%)" }} />
        )}
        {/* Overlay oscuro para legibilidad */}
        <div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(7,3,16,0.2) 0%, rgba(7,3,16,0.55) 50%, rgba(7,3,16,0.92) 100%)",
          }}
        />
        {/* Tinte violeta en el borde inferior */}
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: "45%",
            background: "linear-gradient(0deg, rgba(124,58,237,0.1) 0%, transparent 100%)",
          }}
        />
        {/* Línea dorada superior */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)" }} />
      </div>

      {/* Contenido */}
      <div
        style={{
          position: "relative", zIndex: 2, padding: "32px 32px 26px",
          display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: 300,
        }}
      >
        {/* Estado del partido */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "2.5px",
                textTransform: "uppercase",
                color: "var(--vertigo-faint)",
              }}
            >
              {status === "scheduled" && "Programado"}
              {status === "open" && "Abierto"}
              {status === "drawing" && "Sorteo en curso"}
              {status === "lineup" && "Declarando lineup"}
              {status === "comodin_window" && "Ventana de comodines"}
              {status === "in_progress" && "Partida en juego"}
              {status === "finished" && "Finalizado"}
              {status === "disputed" && "En disputa"}
              {status === "forfeit" && "W.O."}
              {status === "cancelled" && "Cancelado"}
            </span>
            {live && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 10px",
                  borderRadius: 999,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  background: isPlaying ? "rgba(34,197,94,0.15)" : isDrawing ? "rgba(251,191,36,0.12)" : "rgba(124,58,237,0.1)",
                  color: isPlaying ? "var(--vertigo-success)" : isDrawing ? "#fbbf24" : "var(--vertigo-purple-soft)",
                  border: `1px solid ${isPlaying ? "rgba(34,197,94,0.35)" : isDrawing ? "rgba(251,191,36,0.35)" : "rgba(124,58,237,0.25)"}`,
                  animation: isPlaying || isDrawing ? "pulse 1.6s ease-in-out infinite" : "none",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                LIVE
              </span>
            )}
          </div>
          {llaveName && (
            <span
              className="vertigo-badge vertigo-badge-purple"
              style={{ fontSize: 11, padding: "5px 14px", letterSpacing: "1.5px" }}
            >
              {llaveName}
            </span>
          )}
        </div>

        {/* Título del modo/mapa */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            className="font-cinzel"
            style={{
              fontSize: "clamp(24px, 3.4vw, 40px)",
              fontWeight: 700,
              lineHeight: 0.95,
              color: "var(--vertigo-text)",
              textShadow: "0 4px 28px rgba(0,0,0,0.7)",
              letterSpacing: "-0.01em",
            }}
          >
            {gameModeName ?? "Modo por sortear"}
            {mapName ? ` · ${mapName}` : ""}
          </div>
          {antimetaName && (
            <div style={{ fontSize: 13, color: "var(--vertigo-purple-soft)", fontWeight: 600, letterSpacing: "1px", marginTop: 4 }}>
              Sub-modo: {antimetaName}
            </div>
          )}
          {playerModeName && (
            <div style={{ fontSize: 13, color: "var(--vertigo-muted)", letterSpacing: "0.5px" }}>
              Formato: {playerModeName}
            </div>
          )}
        </div>

        {/* Civs sorteadas si las hay */}
        {(civsA?.length || civsB?.length) && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            {[...(civsA ?? []).map((c) => ({ civ: c, side: "A" })), ...(civsB ?? []).map((c) => ({ civ: c, side: "B" }))].map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "rgba(13,9,19,0.72)",
                  border: `1px solid ${item.side === "A" ? "rgba(124,58,237,0.35)" : "rgba(251,113,133,0.35)"}`,
                  backdropFilter: "blur(8px)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/civs/${item.civ}.webp`}
                  alt={item.civ}
                  style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.6px",
                    color: item.side === "A" ? "var(--vertigo-purple-pale)" : "#fda4af",
                  }}
                >
                  {item.civ}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pulse del live (CSS animation) */}
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.9)}}`}</style>
    </div>
  );
}
