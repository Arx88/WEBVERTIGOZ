"use client";
import { useWizard } from "@/components/wizard/wizard-context";
import { Crown, Star, Zap } from "lucide-react";

export default function Step4Captain() {
  const { data, updatePlayer, config } = useWizard();
  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  const eloCap = config.eloMax;
  const isWithinCap = totalElo <= eloCap;
  const allLoaded = data.players.every((p) => p.aoe2ProfileId !== null);

  function setCaptain(slot: 0 | 1 | 2) {
    data.players.forEach((_, idx) => {
      updatePlayer(idx as 0 | 1 | 2, { isCaptain: idx === slot });
    });
  }

  function getEloColor(elo: number | null | undefined): string {
    if (!elo || elo <= 0) return "var(--vertigo-faint)";
    if (elo >= 2000) return "var(--vertigo-primary)";
    if (elo >= 1500) return "var(--vertigo-purple-soft)";
    return "var(--vertigo-muted)";
  }

  return (
    <>
      {/* ELO general */}
      <div className="chips-head" style={{ marginBottom: "24px" }}>
        <span
          className={`counter ${totalElo > 0 ? "full" : ""}`}
          style={{
            fontSize: "13px",
            padding: "8px 16px",
            borderColor: totalElo > eloCap ? "var(--vertigo-danger)" : totalElo > eloCap * 0.8 ? "#fbbf24" : "var(--vertigo-primary)",
            color: totalElo > eloCap ? "var(--vertigo-danger)" : totalElo > eloCap * 0.8 ? "#fbbf24" : "var(--vertigo-purple-pale)",
          }}
        >
          ELO: {totalElo.toLocaleString()} / {eloCap.toLocaleString()}
          {!isWithinCap && " — EXCEDIDO"}
        </span>
      </div>

      {/* Explicación */}
      <p
        style={{
          fontSize: "14px",
          color: "var(--vertigo-muted)",
          marginBottom: "24px",
          maxWidth: "560px",
          lineHeight: 1.6,
        }}
      >
        Elegí al <strong style={{ color: "var(--vertigo-purple-soft)" }}>capitán del equipo</strong>. 
        Será el contacto oficial con el staff del torneo y quien habla en las disputas. 
        Hacé clic en la card del jugador para asignarlo.
      </p>

      {/* Cards de jugadores — lista de a una por fila, clickeables */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxWidth: "640px",
        }}
      >
        {data.players.map((player, idx) => {
          const isCaptain = player.isCaptain;
          const elo = player.maxRatingRm1v1;
          const eloColor = getEloColor(elo);
          const hasData = player.aoe2ProfileId && player.displayName;

          return (
            <button
              key={idx}
              onClick={() => setCaptain(idx as 0 | 1 | 2)}
              disabled={!hasData}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "14px 18px",
                borderRadius: "12px",
                textAlign: "left",
                cursor: hasData ? "pointer" : "default",
                opacity: hasData ? 1 : 0.4,
                border: `2px solid ${isCaptain ? "var(--vertigo-primary)" : "var(--vertigo-line)"}`,
                background: isCaptain
                  ? "linear-gradient(160deg, rgba(124,58,237,0.15) 0%, rgba(124,58,237,0.05) 100%)"
                  : "var(--vertigo-input-bg)",
                boxShadow: isCaptain
                  ? "0 0 0 3px rgba(124,58,237,0.15), 0 6px 20px rgba(124,58,237,0.2)"
                  : "0 2px 10px rgba(0,0,0,0.25)",
                transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
              }}
              onMouseEnter={(e) => {
                if (hasData && !isCaptain) {
                  e.currentTarget.style.borderColor = "var(--vertigo-purple-soft)";
                  e.currentTarget.style.background = "rgba(124,58,237,0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (hasData && !isCaptain) {
                  e.currentTarget.style.borderColor = "var(--vertigo-line)";
                  e.currentTarget.style.background = "var(--vertigo-input-bg)";
                }
              }}
              title={hasData ? `${player.displayName}` : "Cargando jugador..."}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  flex: "none",
                  border: `2px solid ${isCaptain ? "var(--vertigo-primary)" : "var(--vertigo-line)"}`,
                  background: isCaptain ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Cinzel, serif",
                  fontSize: 20,
                  fontWeight: 600,
                  color: isCaptain ? "var(--vertigo-purple-pale)" : "var(--vertigo-muted)",
                  transition: "all 0.3s ease",
                }}
              >
                {player.displayName?.charAt(0).toUpperCase() || "?"}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: isCaptain ? "var(--vertigo-purple-pale)" : "var(--vertigo-text)",
                    marginBottom: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {player.displayName || `Jugador ${idx + 1}`}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--vertigo-faint)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {hasData ? (
                    <>
                      {player.country || "?"}
                      {player.clan && ` · ${player.clan}`}
                    </>
                  ) : (
                    "Cargando datos..."
                  )}
                </div>
              </div>

              {/* ELO */}
              {hasData && (
                <div style={{ textAlign: "right", flex: "none" }}>
                  <div
                    style={{
                      fontFamily: "Cinzel, serif",
                      fontSize: 20,
                      fontWeight: 700,
                      color: eloColor,
                      lineHeight: 1,
                    }}
                  >
                    {elo ? elo.toLocaleString() : "—"}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: "var(--vertigo-faint)",
                      marginTop: 2,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    ELO máx
                  </div>
                </div>
              )}

              {/* Badge de capitán */}
              {isCaptain && (
                <div
                  style={{
                    flex: "none",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    background: "var(--vertigo-primary)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "1px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    boxShadow: "0 0 12px rgba(124,58,237,0.5)",
                  }}
                >
                  <Crown style={{ width: 10, height: 10 }} />
                  CAPITÁN
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
