"use client";

import { useState, useRef, useEffect } from "react";
import { useWizard, type PlayerDraft } from "@/components/wizard/wizard-context";

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255, 46, 158, 0.04)",
  border: "1px solid rgba(255, 46, 158, 0.15)",
  borderRadius: "4px",
  padding: "10px 12px",
  color: "#f5eaff",
  fontSize: "13px",
  fontFamily: "Inter, system-ui, sans-serif",
  outline: "none",
};

interface SearchResult {
  profileId: number;
  name: string;
  country?: string;
  clan?: string;
  verified?: boolean;
}

export default function Step3Players() {
  const { data, updatePlayer } = useWizard();
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2>(0);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{ fontSize: "10px", color: "rgba(255, 46, 158, 0.7)", letterSpacing: "0.4em", textTransform: "uppercase", marginBottom: "8px" }}>
          PASO 03
        </div>
        <h1 style={{ fontSize: "28px", fontWeight: 600, color: "#f5eaff", fontFamily: "Inter, system-ui, sans-serif", letterSpacing: "-0.01em" }}>
          Cargar jugadores
        </h1>
        <p style={{ fontSize: "13px", color: "rgba(255, 180, 220, 0.6)", marginTop: "8px" }}>
          Buscá por nombre in-game en AoE2 Companion. Seleccioná al jugador correcto.
        </p>
      </div>

      {/* 3 slots en row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {data.players.map((player, idx) => (
          <PlayerSlot
            key={idx}
            slot={idx as 0 | 1 | 2}
            player={player}
            isActive={activeSlot === idx}
            onClick={() => setActiveSlot(idx as 0 | 1 | 2)}
            onRemove={() => {
              updatePlayer(idx as 0 | 1 | 2, {
                aoe2ProfileId: null, displayName: "", steamId: undefined,
                country: undefined, clan: undefined, maxRatingRm1v1: undefined,
                isVerified: false, isCaptain: false,
              });
              setActiveSlot(idx as 0 | 1 | 2);
            }}
            onSelect={(result) => {
              updatePlayer(idx as 0 | 1 | 2, {
                aoe2ProfileId: result.profileId,
                displayName: result.name,
                country: result.country,
                clan: result.clan,
                isVerified: result.verified ?? false,
              });
              if (idx < 2) setActiveSlot((idx + 1) as 0 | 1 | 2);
            }}
          />
        ))}
      </div>

      {/* ELO bar */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(255, 46, 158, 0.05)",
        borderRadius: "4px",
        border: "1px solid rgba(255, 46, 158, 0.1)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", color: "#ffb4dc", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            ELO TOTAL
          </span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#f5eaff" }}>
            {data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0)} <span style={{ color: "rgba(255, 180, 220, 0.4)", fontSize: "11px" }}>/ 3520</span>
          </span>
        </div>
        <div style={{ height: "3px", background: "rgba(255, 46, 158, 0.1)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${Math.min(100, (data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0) / 3520) * 100)}%`,
            background: "linear-gradient(90deg, #ff2e9e, #ff6bb5)",
            transition: "width 300ms ease",
          }} />
        </div>
      </div>
    </div>
  );
}

function PlayerSlot({
  slot, player, isActive, onClick, onRemove, onSelect,
}: {
  slot: 0 | 1 | 2;
  player: PlayerDraft;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
  onSelect: (r: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current;
      try {
        const res = await fetch(`/api/aoe2/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (reqId === reqIdRef.current) {
          setResults(data.profiles ?? []);
          setLoading(false);
        }
      } catch {
        if (reqId === reqIdRef.current) {
          setResults([]);
          setLoading(false);
        }
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const isLoaded = player.aoe2ProfileId !== null;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px",
        borderRadius: "6px",
        background: isActive ? "rgba(255, 46, 158, 0.06)" : "rgba(255, 46, 158, 0.02)",
        border: `1px solid ${isActive ? "rgba(255, 46, 158, 0.4)" : "rgba(255, 46, 158, 0.12)"}`,
        cursor: "pointer",
        transition: "all 200ms ease",
        minHeight: "180px",
        position: "relative",
      }}
    >
      {/* Slot number */}
      <div style={{
        position: "absolute", top: "8px", right: "10px",
        fontSize: "10px", color: "rgba(255, 180, 220, 0.4)",
        letterSpacing: "0.2em", fontWeight: 600,
      }}>
        #{slot + 1}
      </div>

      {isLoaded ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "6px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: "rgba(255, 46, 158, 0.1)",
            border: "1px solid rgba(255, 46, 158, 0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ff2e9e", fontSize: "18px", fontWeight: 600,
            marginBottom: "4px",
          }}>
            {player.displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#f5eaff" }}>
            {player.displayName}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255, 180, 220, 0.5)" }}>
            {player.country} {player.clan && `· ${player.clan}`}
          </div>
          {player.maxRatingRm1v1 !== undefined && (
            <div style={{ fontSize: "11px", color: "#ff2e9e", fontWeight: 600 }}>
              ELO máx: {player.maxRatingRm1v1}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{
              marginTop: "6px", fontSize: "11px",
              color: "rgba(255, 180, 220, 0.4)",
              background: "transparent", border: "none", cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Cambiar jugador
          </button>
        </div>
      ) : (
        <div>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            border: "1px dashed rgba(255, 46, 158, 0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(255, 180, 220, 0.3)", fontSize: "16px", fontWeight: 600,
            margin: "0 auto 10px",
          }}>
            ?
          </div>
          {isActive ? (
            <div style={{ position: "relative" }}>
              <input
                placeholder="Buscar en AoE2..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ ...inputStyle, padding: "8px 10px", fontSize: "12px" }}
                autoFocus
                onFocus={(e) => { e.target.style.borderColor = "rgba(255, 46, 158, 0.5)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255, 46, 158, 0.15)"; }}
              />
              {loading && (
                <div style={{
                  position: "absolute", right: "8px", top: "8px",
                  width: "12px", height: "12px",
                  border: "2px solid rgba(255, 46, 158, 0.2)",
                  borderTopColor: "#ff2e9e",
                  borderRadius: "50%",
                  animation: "spin 0.6s linear infinite",
                }} />
              )}
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              {results.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0,
                  background: "#0a0011",
                  border: "1px solid rgba(255, 46, 158, 0.2)",
                  borderRadius: "4px",
                  marginTop: "4px",
                  zIndex: 10,
                  maxHeight: "180px",
                  overflowY: "auto",
                }}>
                  {results.slice(0, 5).map((r) => (
                    <button
                      key={r.profileId}
                      onClick={(e) => { e.stopPropagation(); onSelect(r); setQuery(""); setResults([]); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 10px", background: "transparent",
                        border: "none", cursor: "pointer",
                        borderBottom: "1px solid rgba(255, 46, 158, 0.08)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 46, 158, 0.08)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ fontSize: "12px", color: "#f5eaff", fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontSize: "10px", color: "rgba(255, 180, 220, 0.5)", marginTop: "2px" }}>
                        {r.country} · #{r.profileId}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", fontSize: "11px", color: "rgba(255, 180, 220, 0.4)" }}>
              Click para buscar
            </div>
          )}
        </div>
      )}
    </div>
  );
}
