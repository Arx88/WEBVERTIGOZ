"use client";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step4Captain() {
  const { data, updatePlayer } = useWizard();
  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  return (
    <>
      <div className="chips-head">
        <span className={`counter ${totalElo <= 3520 ? "full" : ""}`} style={{ borderColor: totalElo > 3520 ? "var(--danger)" : undefined, color: totalElo > 3520 ? "var(--danger)" : undefined }}>
          ELO TOTAL: {totalElo} / 3520
        </span>
      </div>
      <div className="chips" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
        {data.players.map((player, idx) => {
          const sel = player.isCaptain;
          return (
            <button key={idx} className={`chip ${sel ? "sel" : ""}`}
              onClick={() => data.players.forEach((_, i) => updatePlayer(i as 0 | 1 | 2, { isCaptain: i === idx }))}
              disabled={!player.aoe2ProfileId}
              style={{ opacity: !player.aoe2ProfileId ? 0.4 : 1, padding: "16px 8px" }}>
              <div style={{ fontSize: "11px", opacity: 0.7, marginBottom: "4px" }}>{idx === 0 ? "CAPITÁN" : `JUGADOR ${idx + 1}`}</div>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>{player.displayName || "Sin cargar"}</div>
              {sel && <div style={{ fontSize: "10px", marginTop: "4px", color: "var(--purple-pale)" }}>★ Elegido</div>}
            </button>
          );
        })}
      </div>
    </>
  );
}
