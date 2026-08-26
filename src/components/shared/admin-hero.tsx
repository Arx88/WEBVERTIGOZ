/**
 * VÉRTIGO Cup — AdminHero
 *
 * Hero cinematográfico estándar del panel de staff: el castillo en llamas con
 * la bandera de fondo, título del módulo y las métricas de la sección
 * integradas como stats de vidrio (reemplaza el patrón viejo de
 * kicker/título/divider + fila vertigo-stats aparte).
 * Server-safe: sin estado, sin eventos.
 */
import type { ReactNode } from "react";
import { ART_CASTILLO } from "@/lib/art";
import HeroStat from "./hero-stat";

export default function AdminHero({
  kicker,
  title,
  desc,
  stats = [],
}: {
  kicker: string;
  title: string;
  desc: ReactNode;
  stats?: { value: string | number; label: string; color?: string }[];
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 18,
        border: "1px solid var(--vertigo-line-soft)",
        marginBottom: 24,
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ART_CASTILLO}
        alt=""
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center 40%", opacity: 0.42,
        }}
      />
      <div
        style={{
          position: "absolute", inset: 0,
          background:
            "linear-gradient(180deg, rgba(7,3,16,0.35) 0%, rgba(7,3,16,0.6) 55%, rgba(7,3,16,0.92) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)",
        }}
      />
      <div
        style={{
          position: "relative", zIndex: 2, padding: "36px 32px 30px",
          display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: 360,
        }}
      >
        <span className="vertigo-kicker">{kicker}</span>
        <h1
          className="vertigo-title"
          style={{ fontSize: "clamp(24px, 3.2vw, 40px)", margin: "6px 0 10px", textShadow: "0 4px 28px rgba(0,0,0,0.6)" }}
        >
          {title}
        </h1>
        <p className="vertigo-desc" style={{ margin: 0, fontSize: 14, maxWidth: 680 }}>
          {desc}
        </p>
        {stats.length > 0 && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
            {stats.map((s) => (
              <HeroStat key={s.label} value={s.value} label={s.label} color={s.color ?? "var(--vertigo-text)"} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
