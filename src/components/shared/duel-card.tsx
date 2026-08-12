"use client";

/**
 * VÉRTIGO Cup — DuelCard
 *
 * La "tarjeta de duelo" — cómo se presenta un enfrentamiento entre dos reinos.
 * Cine de torneo: emblema grande, nombre del equipo con jerarquía, seed,
 * score prominente, y glow si es ganador. Es el bloque visual que se repite
 * en scoreboard, bracket, resultados, historial, perfil.
 *
 * Diseño: dos reinos enfrentados, divididos por un "VS" dramático con
 * una línea dorada. Premium sobrio — la tensión está en la jerarquía,
 * no en glows saturados.
 */

import Link from "next/link";

export interface DuelTeam {
  id: string;
  name: string;
  seed?: number | null;
  emblemUrl?: string | null;
  tagline?: string | null;
}

interface DuelCardProps {
  teamA: DuelTeam | null;
  teamB: DuelTeam | null;
  scoreA: number;
  scoreB: number;
  winnerId?: string | null;
  /** Etiqueta arriba (ej. "Ronda 1 · Partido 3") */
  eyebrow?: string;
  /** Estado textual (ej. "18:30 · Arabia") */
  subline?: string;
  /** Link al detalle del partido */
  href?: string;
  /** Tamaño del emblema */
  emblemSize?: number;
  /** Si el partido está en vivo, puntuar con pulso */
  live?: boolean;
}

export default function DuelCard({
  teamA,
  teamB,
  scoreA,
  scoreB,
  winnerId,
  eyebrow,
  subline,
  href,
  emblemSize = 56,
  live = false,
}: DuelCardProps) {
  const aWon = winnerId && teamA && winnerId === teamA.id;
  const bWon = winnerId && teamB && winnerId === teamB.id;

  const inner = (
    <div
      className="vertigo-card"
      style={{
        padding: "22px 26px",
        position: "relative",
        overflow: "hidden",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s cubic-bezier(.22,1,.36,1)",
        borderColor: live ? "rgba(124,58,237,0.5)" : undefined,
        boxShadow: live
          ? "0 0 0 1px rgba(124,58,237,0.2), 0 8px 32px rgba(124,58,237,0.22)"
          : undefined,
      }}
    >
      {/* Línea dorada si es partido importante (final o ganador definido) */}
      {(aWon || bWon) && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 24, right: 24, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.4), transparent)",
          }}
        />
      )}

      {/* Eyebrow */}
      {(eyebrow || subline) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          {eyebrow && (
            <span
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase",
                color: "var(--vertigo-faint)",
              }}
            >
              {eyebrow}
            </span>
          )}
          {subline && (
            <span style={{ fontSize: 11, color: "var(--vertigo-muted)", letterSpacing: "0.5px" }}>
              {subline}
            </span>
          )}
        </div>
      )}

      {/* Duelo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 20,
        }}
      >
        {/* TEAM A (izquierda, alineado a la derecha) */}
        <TeamBlock team={teamA} won={!!aWon} score={scoreA} align="right" emblemSize={emblemSize} />

        {/* VS dramático */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: "Cinzel, serif",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "6px",
              color: "var(--vertigo-faint)",
              marginBottom: 4,
            }}
          >
            VS
          </div>
          <div
            style={{
              width: 1,
              height: 18,
              margin: "0 auto",
              background: "linear-gradient(180deg, transparent, rgba(212,175,55,0.5), transparent)",
            }}
          />
          <div
            className="font-cinzel"
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--vertigo-purple-pale)",
              marginTop: 4,
              lineHeight: 1,
              letterSpacing: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {scoreA}<span style={{ color: "var(--vertigo-faint)", margin: "0 6px", fontWeight: 400 }}>–</span>{scoreB}
          </div>
        </div>

        {/* TEAM B (derecha) */}
        <TeamBlock team={teamB} won={!!bWon} score={scoreB} align="left" emblemSize={emblemSize} />
      </div>

      {/* Winner ribbon */}
      {(aWon || bWon) && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span
            className="vertigo-badge vertigo-badge-success"
            style={{ padding: "4px 14px", fontSize: 10, letterSpacing: "1.8px" }}
          >
            VICTORIA · {(aWon ? teamA : teamB)?.name}
          </span>
        </div>
      )}

      {live && (
        <div
          style={{
            position: "absolute",
            top: 12, right: 12,
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--vertigo-danger)",
              boxShadow: "0 0 10px rgba(251,113,133,0.7)",
              animation: "pulse 1.6s ease-in-out infinite",
            }}
          />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", color: "var(--vertigo-danger)", textTransform: "uppercase" }}>
            EN VIVO
          </span>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}`}</style>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: "none", color: "inherit" }} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function TeamBlock({
  team,
  won,
  score,
  align,
  emblemSize,
}: {
  team: DuelTeam | null;
  won: boolean;
  score: number;
  align: "left" | "right";
  emblemSize: number;
}) {
  const alignClass = align === "right" ? "items-end text-right" : "items-start text-left";

  if (!team) {
    return (
      <div className={`flex flex-col ${alignClass} gap-2 min-w-0`}>
        <div
          style={{
            width: emblemSize, height: emblemSize, borderRadius: 12,
            border: "1.5px dashed var(--vertigo-line)", display: "grid", placeItems: "center",
            color: "var(--vertigo-faint)", fontSize: 11,
          }}
        >
          ?
        </div>
        <span style={{ fontSize: 13, color: "var(--vertigo-faint)", fontStyle: "italic" }}>Por definir</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${alignClass} gap-2 min-w-0`}>
      {/* Emblema */}
      <div
        style={{
          width: emblemSize, height: emblemSize,
          borderRadius: 14,
          overflow: "hidden",
          flexShrink: 0,
          border: won
            ? "2px solid rgba(212,175,55,0.6)"
            : "1.5px solid var(--vertigo-line)",
          boxShadow: won
            ? "0 0 0 1px rgba(212,175,55,0.2), 0 0 24px rgba(212,175,55,0.25), 0 4px 16px rgba(0,0,0,0.4)"
            : "0 2px 8px rgba(0,0,0,0.3)",
          background: "var(--vertigo-input-bg)",
          transition: "box-shadow 0.3s ease",
        }}
      >
        {team.emblemUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.emblemUrl}
            alt={team.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%", height: "100%",
              display: "grid", placeItems: "center",
              fontFamily: "Cinzel, serif",
              fontSize: Math.round(emblemSize * 0.4),
              fontWeight: 700,
              color: won ? "#D4AF37" : "var(--vertigo-purple-soft)",
            }}
          >
            {team.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Nombre + seed */}
      <div>
        <div className="flex items-center gap-2 flex-wrap" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
          {team.seed != null && (
            <span
              className="vertigo-badge vertigo-badge-purple"
              style={{ fontSize: 9, padding: "2px 8px" }}
            >
              #{team.seed}
            </span>
          )}
          <span
            className="font-cinzel"
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: won ? "var(--vertigo-gold)" : "var(--vertigo-text)",
              lineHeight: 1.2,
              letterSpacing: "0.3px",
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "inline-block",
              textShadow: won ? "0 0 16px rgba(212,175,55,0.3)" : "none",
            }}
            title={team.name}
          >
            {team.name}
          </span>
        </div>
        {team.tagline && (
          <div
            style={{
              fontSize: 11,
              color: "var(--vertigo-faint)",
              fontStyle: "italic",
              marginTop: 3,
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={team.tagline}
          >
            “{team.tagline}”
          </div>
        )}
      </div>
    </div>
  );
}
