"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { TEAM_A, TEAM_B } from "@/components/tutorial/demo-data";

const TutorialDirector = dynamic(
  () => import("@/components/tutorial/tutorial-director"),
  { ssr: false }
);

export default function TutorialPage() {
  const [started, setStarted] = useState(() =>
    typeof window !== "undefined" && window.location.hash.includes("play")
  );

  if (started) {
    return <TutorialDirector onClose={() => setStarted(false)} />;
  }

  return (
    <div className="tut-root tut-intro-page">
      <div className="tut-intro">
        <img className="tut-intro-logo" src="/logo.png" alt="VÉRTIGO Cup" />
        <h2>TUTORIAL <span>EN VIVO</span></h2>
        <p
          style={{
            color: "var(--tut-muted, #9a92a6)",
            fontFamily: "var(--font-rajdhani), sans-serif",
            letterSpacing: "0.28em",
            fontSize: 12,
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          Todo lo que pasa en una LLAVE, paso a paso
        </p>

        <div className="tut-vs" style={{ marginTop: 8 }}>
          <div className="tut-teamcard" style={{ "--team-color": TEAM_A.color } as React.CSSProperties}>
            <img className="emb" src={TEAM_A.emblem} alt={TEAM_A.name} />
            <div className="tname">{TEAM_A.name}</div>
            <div className="tseed">SEED #{TEAM_A.seed}</div>
          </div>
          <div className="tut-vs-sep">VS</div>
          <div className="tut-teamcard" style={{ "--team-color": TEAM_B.color } as React.CSSProperties}>
            <img className="emb" src={TEAM_B.emblem} alt={TEAM_B.name} />
            <div className="tname">{TEAM_B.name}</div>
            <div className="tseed">SEED #{TEAM_B.seed}</div>
          </div>
        </div>

        <p
          style={{
            fontFamily: "var(--font-rajdhani), sans-serif",
            fontSize: 15,
            lineHeight: 1.7,
            color: "rgba(232,226,244,0.85)",
            maxWidth: 620,
            margin: "6px auto 0",
          }}
        >
          Este demo reproduce una llave completa en modo automático: verás el
          punto de vista de <b style={{ color: "#fbbf24" }}>cada equipo</b>, del{" "}
          <b style={{ color: "#fbbf24" }}>ADMIN</b>, y del{" "}
          <b style={{ color: "#ff6b00" }}>stream en vivo</b> (ruleta real +
          memotest + comodines). Podés pausar, saltar escenas y acelerar.
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, marginTop: 26 }}>
          <button className="tut-btn" style={{ padding: "14px 34px", fontSize: 14 }} onClick={() => setStarted(true)}>
            <Play style={{ width: 16, height: 16 }} />
            <span className="lbl">EMPEZAR TUTORIAL</span>
          </button>

          <div className="tut-chip-group" style={{ justifyContent: "center", margin: 0 }}>
            <span className="tut-chip"><Sparkles style={{ width: 12, height: 12, display: "inline", marginRight: 6, verticalAlign: "-2px" }} />15 escenas</span>
            <span className="tut-chip">Ruleta y memotest REALES</span>
            <span className="tut-chip">Sin cuenta · 100% demo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
