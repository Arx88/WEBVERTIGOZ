import { Crown, Crosshair, WifiOff } from "lucide-react";
import type { PlayerIntel } from "@/lib/aoe2/stats-cache";

/**
 * INTEL DEL EQUIPO — por cada compañero: winrate en los mapas del torneo
 * y con las civs de su propio pool, según partidas de EQUIPOS (rm_team)
 * del ladder público. Datos cacheados en BD (player_stats_cache).
 */
function wrColor(wr: number | null): string {
  if (wr === null) return "var(--vertigo-faint)";
  if (wr >= 55) return "var(--vertigo-success)";
  if (wr >= 45) return "var(--vertigo-purple-pale)";
  return "var(--vertigo-danger)";
}

export function IntelPanel({
  intel,
  footer,
}: {
  intel: PlayerIntel[];
  /** Slot para acciones (ej. botón de refrescar) junto al subtítulo. */
  footer?: React.ReactNode;
}) {
  if (intel.length === 0) return null;

  return (
    <div className="vertigo-section" style={{ marginBottom: "32px" }}>
      <div className="vertigo-subtitle">
        <Crosshair style={{ width: 14, height: 14 }} />
        Intel del equipo
        <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--vertigo-faint)", fontWeight: 500 }}>
          Ladder público · partidas de equipos
        </span>
        {footer}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px" }}>
        {intel.map((p) => (
          <div
            key={p.playerRegistrationId}
            className="vertigo-card"
            style={{
              padding: "18px 20px",
              border: p.isCaptain ? "1px solid rgba(124,58,237,0.4)" : "1px solid var(--vertigo-line)",
              background: p.isCaptain ? "rgba(124,58,237,0.06)" : undefined,
            }}
          >
            {/* Header del jugador */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: "50%", flex: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "Cinzel, serif", fontSize: 17, fontWeight: 700,
                  border: `2px solid ${p.isCaptain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                  background: "rgba(124,58,237,0.12)",
                  color: p.isCaptain ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                }}
              >
                {p.displayName.charAt(0).toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--vertigo-text)" }}>
                    {p.displayName}
                  </span>
                  {p.isCaptain && <Crown style={{ width: 13, height: 13, color: "var(--vertigo-purple-soft)" }} />}
                </div>
                {p.topCivLabel && (
                  <div style={{ fontSize: 11, color: "var(--vertigo-faint)", marginTop: 2 }}>
                    Civ más jugada: {p.topCivLabel}
                  </div>
                )}
              </div>
              {p.eloMax != null && (
                <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: 10, flex: "none" }}>
                  ELO {p.eloMax}
                </span>
              )}
            </div>

            {!p.hasData ? (
              <div
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "12px 14px", borderRadius: "10px",
                  background: "rgba(255,255,255,0.03)", border: "1px dashed var(--vertigo-line)",
                  fontSize: 12, color: "var(--vertigo-faint)", lineHeight: 1.5,
                }}
              >
                <WifiOff style={{ width: 15, height: 15, opacity: 0.6, flex: "none" }} />
                Sin partidas suficientes en el ladder público. Se actualizará cuando tenga actividad ranked de equipos.
              </div>
            ) : (
              <>
                {/* Mapas del torneo */}
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginBottom: "8px" }}>
                  Mapas del torneo
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                  {p.maps.map((m) => (
                    <span
                      key={m.id}
                      title={m.wr !== null ? `${m.label}: ${m.wr}% (${m.games} partidas)` : `${m.label}: sin datos`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "5px",
                        padding: "4px 9px", borderRadius: "8px",
                        background: m.wr !== null ? "rgba(255,255,255,0.04)" : "transparent",
                        border: `1px solid ${m.wr !== null ? "var(--vertigo-line-soft)" : "1px dashed var(--vertigo-line)"}`,
                        fontSize: 10.5,
                      }}
                    >
                      <span style={{ color: "var(--vertigo-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{m.label}</span>
                      <strong style={{ color: wrColor(m.wr), fontWeight: 700 }}>{m.wr !== null ? `${m.wr}%` : "—"}</strong>
                    </span>
                  ))}
                </div>

                {/* Pool de civs del equipo */}
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginBottom: "8px" }}>
                  Con su pool
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: "7px" }}>
                  {p.civs.map((c) => (
                    <div
                      key={c.id}
                      title={c.wr !== null ? `${c.label}: ${c.wr}% (${c.games} partidas)` : `${c.label}: sin datos en ladder`}
                      style={{
                        display: "flex", alignItems: "center", gap: "7px",
                        padding: "5px 7px", borderRadius: "9px",
                        border: c.wr !== null ? "1px solid var(--vertigo-line-soft)" : "1px dashed var(--vertigo-line)",
                        background: "rgba(255,255,255,0.02)", opacity: c.wr !== null ? 1 : 0.55,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.img} alt={c.label} style={{ width: 24, height: 24, borderRadius: 5, objectFit: "cover", flex: "none" }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: "var(--vertigo-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.label}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: wrColor(c.wr), lineHeight: 1.2 }}>
                          {c.wr !== null ? `${c.wr}%` : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
