"use client";
import { useState, useRef, useEffect } from "react";
import { useWizard } from "@/components/wizard/wizard-context";

interface SearchResult { profileId: number; name: string; country?: string; clan?: string; verified?: boolean; }

export default function Step3Players() {
  const { data, updatePlayer } = useWizard();
  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  const eloCap = 3500 + 20;

  return (
    <>
      {/* ELO bar */}
      <div className="chips-head" style={{ marginBottom: "20px" }}>
        <span className={`counter ${totalElo > 0 ? "full" : ""}`}
          style={{ borderColor: totalElo > eloCap ? "var(--danger)" : undefined, color: totalElo > eloCap ? "var(--danger)" : undefined }}>
          ELO TOTAL: {totalElo} / {eloCap}
        </span>
      </div>

      {data.players.map((player, idx) => (
        <div className="field" key={idx}>
          <label>{idx === 0 ? "Capitán — nombre en el juego" : `Jugador ${idx + 1}`}</label>
          {player.aoe2ProfileId ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input type="text" value={`${player.displayName}${player.maxRatingRm1v1 != null && player.maxRatingRm1v1 > 0 ? ` — ELO máx: ${player.maxRatingRm1v1}` : player.maxRatingRm1v1 === -1 ? " — Sin ELO RM 1v1" : player.maxRatingRm1v1 === null ? "" : ""}`} readOnly style={{ flex: 1 }} />
              <button className="btn ghost" style={{ padding: "10px 16px", fontSize: "11px" }}
                onClick={() => updatePlayer(idx as 0 | 1 | 2, { aoe2ProfileId: null, displayName: "", country: undefined, clan: undefined, isVerified: false, maxRatingRm1v1: undefined })}>
                Cambiar
              </button>
            </div>
          ) : (
            <PlayerSearch
              onSelect={async (r) => {
                // Guardar datos básicos inmediatamente + marcar que ELO está cargando
                updatePlayer(idx as 0 | 1 | 2, {
                  aoe2ProfileId: r.profileId, displayName: r.name,
                  country: r.country, clan: r.clan, isVerified: r.verified ?? false,
                  maxRatingRm1v1: null, // null = cargando, undefined = no cargado
                });

                // Buscar el ELO real en AoE2 Companion
                try {
                  const res = await fetch(`/api/aoe2/profile?id=${r.profileId}`);
                  if (res.ok) {
                    const data = await res.json();
                    // Si maxRating es null, significa que el perfil no tiene datos de RM 1v1
                    // (jugador nuevo o que nunca jugó ranked). Lo marcamos como -1 para distinguirlo.
                    updatePlayer(idx as 0 | 1 | 2, {
                      maxRatingRm1v1: data.maxRating != null ? data.maxRating : -1, // -1 = sin datos
                      ratingRm1v1Current: data.currentRating,
                      isVerified: data.verificationStatus === "verified",
                    });
                  } else {
                    updatePlayer(idx as 0 | 1 | 2, { maxRatingRm1v1: -1 }); // -1 = error
                  }
                } catch (e) {
                  updatePlayer(idx as 0 | 1 | 2, { maxRatingRm1v1: -1 }); // -1 = error
                }
              }}
            />
          )}
          {/* Mostrar ELO individual debajo del input */}
          {player.aoe2ProfileId && player.maxRatingRm1v1 != null && player.maxRatingRm1v1 > 0 && (
            <div style={{ fontSize: "12px", color: "var(--purple-pale)", marginTop: "6px", fontFamily: "Inter, sans-serif" }}>
              ELO máx RM 1v1: <strong>{player.maxRatingRm1v1}</strong>
              {player.country && <span style={{ color: "var(--faint)", marginLeft: "12px" }}>{player.country}</span>}
              {player.clan && <span style={{ color: "var(--faint)", marginLeft: "8px" }}>· {player.clan}</span>}
            </div>
          )}
          {player.aoe2ProfileId && player.maxRatingRm1v1 == null && (
            <div style={{ fontSize: "12px", color: "var(--faint)", marginTop: "6px", fontFamily: "Inter, sans-serif" }}>
              Cargando ELO...
            </div>
          )}
          {player.aoe2ProfileId && player.maxRatingRm1v1 === -1 && (
            <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "6px", fontFamily: "Inter, sans-serif" }}>
              Sin datos de ELO RM 1v1 (jugador sin partidas ranked)
            </div>
          )}
          {player.aoe2ProfileId && player.maxRatingRm1v1 === 0 && (
            <div style={{ fontSize: "12px", color: "var(--faint)", marginTop: "6px", fontFamily: "Inter, sans-serif" }}>
              ELO no disponible (perfil oculto)
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function PlayerSearch({ onSelect }: { onSelect: (r: SearchResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current;
      try {
        const res = await fetch(`/api/aoe2/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (reqId === reqIdRef.current) { setResults(data.profiles ?? []); setLoading(false); }
      } catch { if (reqId === reqIdRef.current) { setResults([]); setLoading(false); } }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div style={{ position: "relative" }}>
      <input type="text" placeholder="Buscar en AoE2 Companion..." value={query}
        onChange={(e) => setQuery(e.target.value)} style={{ width: "100%" }} />
      {loading && (
        <span style={{ position: "absolute", right: "18px", top: "50%", transform: "translateY(-50%)",
          width: "14px", height: "14px", border: "2px solid rgba(124,58,237,.2)", borderTopColor: "var(--purple)",
          borderRadius: "50%", animation: "spin .6s linear infinite" }} />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--input-bg)", border: "1px solid var(--input-border)", borderRadius: "9px",
          zIndex: 10, maxHeight: "200px", overflowY: "auto" }}>
          {results.slice(0, 5).map((r) => (
            <button key={r.profileId} onClick={() => { onSelect(r); setQuery(""); setResults([]); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 18px",
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: "1px solid var(--line-soft)" }}>
              <span style={{ fontSize: "13px", color: "var(--text)" }}>{r.name}</span>
              <span style={{ fontSize: "11px", color: "var(--faint)", marginLeft: "8px" }}>
                {r.country} · #{r.profileId}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
