"use client";
import { useWizard } from "@/components/wizard/wizard-context";

export default function Step4Captain() {
  const { data, updatePlayer, config } = useWizard();
  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  const eloCap = config.eloMax;
  const isWithinCap = totalElo <= eloCap;

  function setCaptain(slot: 0 | 1 | 2) {
    data.players.forEach((_, idx) => {
      updatePlayer(idx as 0 | 1 | 2, { isCaptain: idx === slot });
    });
  }

  return (
    <>
      {/* ELO bar */}
      <div className="chips-head" style={{ marginBottom: "20px" }}>
        <span className={`counter ${totalElo > 0 ? "full" : ""}`}
          style={{ borderColor: totalElo > eloCap ? "var(--danger)" : undefined, color: totalElo > eloCap ? "var(--danger)" : undefined }}>
          ELO TOTAL: {totalElo} / {eloCap} {isWithinCap ? "✓" : "✗"}
        </span>
      </div>

      {/* 1 columna, 1 fila por jugador */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "560px" }}>
        {data.players.map((player, idx) => {
          const isCaptain = player.isCaptain;
          const hasElo = player.maxRatingRm1v1 != null && player.maxRatingRm1v1 > 0;
          return (
            <button
              key={idx}
              onClick={() => setCaptain(idx as 0 | 1 | 2)}
              disabled={!player.aoe2ProfileId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 20px",
                borderRadius: "12px",
                background: isCaptain ? "linear-gradient(180deg,rgba(124,58,237,0.12),rgba(124,58,237,0.04))" : "var(--input-bg)",
                border: `1px solid ${isCaptain ? "var(--purple)" : "var(--input-border)"}`,
                cursor: player.aoe2ProfileId ? "pointer" : "default",
                opacity: player.aoe2ProfileId ? 1 : 0.4,
                transition: "all 0.25s var(--ease)",
                boxShadow: isCaptain ? "0 0 0 1px var(--purple), 0 4px 18px rgba(124,58,237,0.15)" : "none",
                textAlign: "left",
                width: "100%",
              }}
            >
              {/* Avatar circular */}
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: `2px solid ${isCaptain ? "var(--purple)" : "var(--input-border)"}`,
                background: isCaptain ? "rgba(124,58,237,0.1)" : "var(--input-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isCaptain ? "var(--purple-pale)" : "var(--faint)",
                fontSize: "20px",
                fontWeight: 700,
                fontFamily: "Cinzel, serif",
                flex: "none",
              }}>
                {player.displayName?.charAt(0).toUpperCase() || "?"}
              </div>

              {/* Info del jugador */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text)",
                  fontFamily: "Inter, sans-serif",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {player.displayName || "Sin cargar"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--faint)", marginTop: "2px", fontFamily: "Inter, sans-serif" }}>
                  {player.country || "?"} {player.clan && `· ${player.clan}`}
                  {idx === 0 && !player.isCaptain && " · Capitán sugerido"}
                </div>
              </div>

              {/* ELO destacado */}
              <div style={{ textAlign: "right", flex: "none" }}>
                {hasElo ? (
                  <>
                    <div style={{
                      fontFamily: "Cinzel, serif",
                      fontSize: "22px",
                      fontWeight: 700,
                      color: isCaptain ? "var(--purple-pale)" : "var(--purple-soft)",
                      lineHeight: 1,
                    }}>
                      {player.maxRatingRm1v1}
                    </div>
                    <div style={{ fontSize: "9px", color: "var(--faint)", letterSpacing: "1.5px", textTransform: "uppercase", marginTop: "2px" }}>
                      ELO máx
                    </div>
                  </>
                ) : player.maxRatingRm1v1 === -1 ? (
                  <div style={{ fontSize: "11px", color: "var(--danger)" }}>Sin ranked</div>
                ) : player.maxRatingRm1v1 === null ? (
                  <div style={{ fontSize: "11px", color: "var(--faint)" }}>Cargando...</div>
                ) : (
                  <div style={{ fontSize: "11px", color: "var(--faint)" }}>—</div>
                )}
              </div>

              {/* Badge capitán */}
              {isCaptain && (
                <div style={{
                  flex: "none",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "var(--purple)",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  fontFamily: "Inter, sans-serif",
                }}>
                  ★ Capitán
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "16px", fontFamily: "Inter, sans-serif", maxWidth: "560px" }}>
        Hacé click en un jugador para elegirlo capitán. Será el contacto oficial con el staff del torneo.
      </p>
    </>
  );
}
