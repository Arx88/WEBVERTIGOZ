"use client";

import { useWizard } from "@/components/wizard/wizard-context";

export default function Step4Captain() {
  const { data, updatePlayer } = useWizard();
  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  const eloMax = 3520;
  const isWithinCap = totalElo <= eloMax;

  function setCaptain(slot: 0 | 1 | 2) {
    data.players.forEach((_, idx) => {
      updatePlayer(idx as 0 | 1 | 2, { isCaptain: idx === slot });
    });
  }

  const selectedCaptain = data.players.findIndex((p) => p.isCaptain);

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 46, 158, 0.7)", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px" }}>
          PASO 04
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 600, color: "#f5eaff", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
          Elegir capitán
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(255, 180, 220, 0.6)", marginTop: "8px" }}>
          Será el contacto oficial con el staff del torneo.
        </p>
      </div>

      {/* ELO check */}
      <div style={{
        padding: "10px 14px",
        background: isWithinCap ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
        border: `1px solid ${isWithinCap ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
        borderRadius: "4px",
        marginBottom: "20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: "11px", letterSpacing: "0.15em", textTransform: "uppercase",
          color: isWithinCap ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
          {isWithinCap ? "✓ ELO dentro del cap" : "✗ ELO excedido"}
        </span>
        <span style={{ fontSize: "14px", fontWeight: 600, color: isWithinCap ? "#22c55e" : "#ef4444" }}>
          {totalElo} / {eloMax}
        </span>
      </div>

      {/* 3 cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {data.players.map((player, idx) => {
          const isCaptain = player.isCaptain;
          return (
            <button
              key={idx}
              onClick={() => setCaptain(idx as 0 | 1 | 2)}
              disabled={!player.aoe2ProfileId}
              style={{
                padding: "20px 12px",
                borderRadius: "6px",
                background: isCaptain ? "rgba(255, 46, 158, 0.08)" : "rgba(255, 46, 158, 0.02)",
                border: `1px solid ${isCaptain ? "#ff2e9e" : "rgba(255, 46, 158, 0.12)"}`,
                cursor: player.aoe2ProfileId ? "pointer" : "not-allowed",
                opacity: player.aoe2ProfileId ? 1 : 0.4,
                transition: "all 200ms ease",
                boxShadow: isCaptain ? "0 0 0 1px #ff2e9e, 0 0 16px rgba(255, 46, 158, 0.25)" : "none",
                position: "relative",
              }}
            >
              {isCaptain && (
                <div style={{
                  position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)",
                  background: "#ff2e9e", color: "#0a0011",
                  fontSize: "9px", fontWeight: 700, letterSpacing: "0.15em",
                  padding: "3px 10px", borderRadius: "10px",
                  textTransform: "uppercase",
                }}>
                  Capitán
                </div>
              )}
              <div style={{
                width: "44px", height: "44px", borderRadius: "50%",
                border: `1px solid ${isCaptain ? "#ff2e9e" : "rgba(255, 180, 220, 0.2)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: isCaptain ? "#ff2e9e" : "rgba(255, 180, 220, 0.4)",
                fontSize: "18px", fontWeight: 600,
                margin: "0 auto 10px",
              }}>
                {player.displayName.charAt(0).toUpperCase() || "?"}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#f5eaff", textAlign: "center" }}>
                {player.displayName || "Sin cargar"}
              </div>
              {player.maxRatingRm1v1 !== undefined && player.maxRatingRm1v1 !== null && (
                <div style={{ fontSize: "11px", color: "rgba(255, 180, 220, 0.5)", textAlign: "center", marginTop: "4px" }}>
                  ELO: <span style={{ color: "#ff2e9e", fontWeight: 600 }}>{player.maxRatingRm1v1}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedCaptain === -1 && (
        <p style={{ textAlign: "center", fontSize: "12px", color: "rgba(255, 180, 220, 0.4)" }}>
          Hacé click en un jugador para elegirlo capitán.
        </p>
      )}
    </div>
  );
}
