"use client";

/**
 * CARTA ÉPICA de comodín — la secuencia cinematográfica del tutorial
 * (luz converge → carta entra → impacto/shockwave → nombre SLAM →
 * estandarte del reino) disparada cuando el CAPITÁN ejecuta el comodín.
 *
 * Extraída de stream-screen.tsx para reutilizarse en el Stream View
 * del admin (preview de cómo se ve cada comodín en el stream).
 * Estilos globales tut-epic* (tutorial.css).
 */

import { Shield } from "lucide-react";
import type { CSSProperties } from "react";

export interface EpicTeam {
  id: string;
  name: string;
  emblemUrl: string | null;
}

export const COMODIN_META: Record<string, { img: string; name: string; sub: string }> = {
  reroll: { img: "/brand/icons/comodin-regirar.png", name: "RE-GIRAR", sub: "LA FASE SE VUELVE A SORTEAR" },
  anular: { img: "/brand/icons/comodin-anular.png", name: "ANULAR", sub: "JUGADOR ANULADO" },
  elegir_rival: { img: "/brand/icons/comodin-elegir.png", name: "ELEGIR RIVAL", sub: "RIVAL IMPUESTO" },
  invocar_pro: { img: "/brand/icons/comodin-invocar.png", name: "INVOCAR PRO", sub: "EL PRO ENTRA AL CHAT" },
};

export default function ComodinEpic({
  comodinType,
  team,
  targetName,
}: {
  comodinType: string;
  team: EpicTeam | null;
  targetName: string | null;
}) {
  const meta = COMODIN_META[comodinType] ?? COMODIN_META.reroll;
  // Partículas en órbita (deterministas — el overlay no necesita aleatorio)
  const particles = Array.from({ length: 36 }, (_, i) => ({
    angle: (i / 36) * 360,
    r: 150 + ((i * 53) % 110),
    dur: 2.4 + ((i * 0.17) % 2.6),
    delay: (i * 0.11) % 1.6,
    size: 2 + ((i * 7) % 5),
    color: ["#D4AF37", "#7c3aed", "#a78bfa", "#c4b5fd"][i % 4],
  }));

  return (
    <div className="tut-epic">
      <div className="tut-epic-flash" />
      <div className="tut-epic-rays" />
      <div className="tut-epic-glow" />
      <div className="tut-epic-center">
        <div className="tut-epic-beam" />
        <div className="tut-epic-orbit">
          {particles.map((p, i) => (
            <i
              key={i}
              className="tut-particle"
              style={{
                "--p-angle": `${p.angle}deg`,
                "--p-r": `${p.r}px`,
                "--p-dur": `${p.dur}s`,
                "--p-delay": `-${p.delay}s`,
                width: p.size, height: p.size,
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`,
              } as CSSProperties}
            />
          ))}
        </div>
        <div className="tut-epic-shock"><i /><i /><i /></div>
        <div className="tut-epic-aura" />
        <div className="tut-epic-enter">
          <div className="tut-epic-3d">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="tut-epic-art" src={meta.img} alt={meta.name} />
          </div>
        </div>
        <div className="tut-epic-pedestal" />
        <div className="tut-epic-name">{meta.name}</div>
        <div className="tut-epic-divider"><i /></div>
        {team && (
          <div className="tut-epic-team">
            {team.emblemUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.emblemUrl} alt="" />
            ) : (
              <Shield style={{ width: 34, height: 34 }} strokeWidth={1.2} />
            )}
            {team.name}
          </div>
        )}
        <div className="tut-epic-sub">
          {targetName ? `${meta.sub} · ${targetName.toUpperCase()}` : "COMODÍN ACTIVADO"}
        </div>
      </div>
    </div>
  );
}
