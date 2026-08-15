"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useWizard } from "@/components/wizard/wizard-context";
import { AlertCircle } from "lucide-react";

interface SearchResult {
  profileId: number;
  name: string;
  steamId?: string;
  country?: string;
  clan?: string;
  verified?: boolean;
}

interface PlayerCardProps {
  player: {
    aoe2ProfileId: number | null;
    displayName: string;
    country?: string;
    clan?: string;
    maxRatingRm1v1?: number | null;
    ratingRm1v1Current?: number | null;
    isVerified: boolean;
  };
  index: number;
  onRemove: () => void;
}

function PlayerCard({ player, index, onRemove }: PlayerCardProps) {
  const elo = player.maxRatingRm1v1;
  const eloColor =
    elo == null || elo <= 0
      ? "var(--vertigo-faint)"
      : elo >= 2000
        ? "var(--vertigo-primary)"
        : elo >= 1500
          ? "var(--vertigo-purple-soft)"
          : "var(--vertigo-muted)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "16px 20px",
        borderRadius: "12px",
        background: "var(--vertigo-input-bg)",
        border: "1px solid var(--vertigo-line)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        animation: "vertigoFadeUp 0.4s cubic-bezier(.22,1,.36,1) both",
      }}
    >
      {/* Avatar circular */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Cinzel, serif",
          fontSize: 20,
          fontWeight: 600,
          color: "var(--vertigo-muted)",
          border: "2px solid var(--vertigo-input-border)",
          background: "rgba(255,255,255,0.02)",
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
            color: "var(--vertigo-text)",
            marginBottom: 4,
          }}
        >
          {player.displayName}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--vertigo-faint)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {player.country && <span>{player.country}</span>}
          {player.clan && <span>· {player.clan}</span>}
          {player.isVerified && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: "999px",
                background: "rgba(34,197,94,0.15)",
                color: "var(--vertigo-success)",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              ✓ Verificado
            </span>
          )}
        </div>
      </div>

      {/* ELO */}
      <div style={{ textAlign: "right", flex: "none" }}>
        <div
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: 24,
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

      {/* Quitar */}
      <button
        onClick={onRemove}
        style={{
          width: 36,
          height: 36,
          borderRadius: "10px",
          background: "rgba(251,113,133,0.08)",
          border: "1px solid rgba(251,113,133,0.25)",
          color: "var(--vertigo-danger)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(251,113,133,0.15)";
          e.currentTarget.style.borderColor = "var(--vertigo-danger)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(251,113,133,0.08)";
          e.currentTarget.style.borderColor = "rgba(251,113,133,0.25)";
        }}
        title="Cambiar jugador"
      >
        <svg viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export default function Step3Players() {
  const { data, updatePlayer, config } = useWizard();
  const totalElo = data.players.reduce((s, p) => s + (p.maxRatingRm1v1 ?? 0), 0);
  const eloCap = config.eloMax;
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allLoaded = data.players.every((p) => p.aoe2ProfileId !== null);
  const loadedIds = data.players.map((p) => p.aoe2ProfileId).filter((id): id is number => id !== null);
  const hasDuplicates = loadedIds.length !== new Set(loadedIds).size;

  async function fetchPlayer(result: SearchResult, index: number) {
    setLoading(index);
    setError(null);
    try {
      const res = await fetch(`/api/aoe2/profile?id=${result.profileId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const playerData = await res.json();
      updatePlayer(index as 0 | 1 | 2, {
        aoe2ProfileId: result.profileId,
        displayName: playerData.name || result.name || `Jugador #${result.profileId}`,
        steamId: playerData.steamId || result.steamId,
        country: playerData.country || result.country,
        clan: playerData.clan || result.clan,
        isVerified: playerData.verificationStatus === "verified" || result.verified === true,
        maxRatingRm1v1: playerData.maxRating ?? null,
        ratingRm1v1Current: playerData.currentRating ?? null,
      });
    } catch {
      updatePlayer(index as 0 | 1 | 2, {
        aoe2ProfileId: null,
        displayName: "",
        steamId: undefined,
        country: undefined,
        clan: undefined,
        isVerified: false,
        maxRatingRm1v1: null,
        ratingRm1v1Current: null,
      });
      setError(`No se pudo cargar el jugador ${index + 1}. Probá de nuevo.`);
    } finally {
      setLoading(null);
    }
  }

  function removePlayer(index: number) {
    updatePlayer(index as 0 | 1 | 2, {
      aoe2ProfileId: null,
      displayName: "",
      steamId: undefined,
      country: undefined,
      clan: undefined,
      isVerified: false,
      isCaptain: false,
      maxRatingRm1v1: null,
      ratingRm1v1Current: null,
    });
  }

  return (
    <>
      {/* Progreso de ELO */}
      <div
        style={{
          marginBottom: "28px",
          padding: "18px",
          borderRadius: "12px",
          background: "rgba(124,58,237,0.05)",
          border: "1px solid rgba(124,58,237,0.15)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "var(--vertigo-faint)",
            }}
          >
            ELO TOTAL DEL EQUIPO
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: totalElo > eloCap ? "var(--vertigo-danger)" : "var(--vertigo-purple-pale)",
            }}
          >
            {totalElo.toLocaleString()} / {eloCap.toLocaleString()}
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: "rgba(255,255,255,0.06)",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (totalElo / eloCap) * 100)}%`,
              background:
                totalElo > eloCap
                  ? "linear-gradient(90deg, #fb7185, #e11d48)"
                  : "linear-gradient(90deg, var(--vertigo-primary), var(--vertigo-purple-soft))",
              borderRadius: "4px",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* Lista de jugadores */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {data.players.map((player, idx) => {
          if (player.aoe2ProfileId && player.displayName) {
            return (
              <PlayerCard
                key={idx}
                player={player}
                index={idx}
                onRemove={() => removePlayer(idx)}
              />
            );
          }
          return (
            <PlayerInput
              key={idx}
              index={idx}
              onSelect={(r) => {
                fetchPlayer(r, idx);
              }}
              isLoading={loading === idx}
            />
          );
        })}
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px 18px",
            background: "rgba(251,113,133,0.08)",
            border: "1px solid rgba(251,113,133,0.25)",
            borderRadius: "10px",
            fontSize: "13px",
            color: "var(--vertigo-danger)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertCircle style={{ width: 16, height: 16, flex: "none" }} />
          {error}
        </div>
      )}

      {hasDuplicates && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px 18px",
            background: "rgba(251,113,133,0.08)",
            border: "1px solid rgba(251,113,133,0.25)",
            borderRadius: "10px",
            fontSize: "13px",
            color: "var(--vertigo-danger)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertCircle style={{ width: 16, height: 16, flex: "none" }} />
          Hay un jugador repetido. Cada jugador debe tener un perfil distinto de AoE2 Companion.
        </div>
      )}
      {allLoaded && totalElo > eloCap && (
        <div
          style={{
            marginTop: "20px",
            padding: "14px 18px",
            background: "rgba(251,113,133,0.08)",
            border: "1px solid rgba(251,113,133,0.25)",
            borderRadius: "10px",
            fontSize: "13px",
            color: "var(--vertigo-danger)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <AlertCircle style={{ width: 16, height: 16 }} />
          El ELO total ({totalElo.toLocaleString()}) supera el máximo ({eloCap.toLocaleString()}). Cambiá un jugador por uno con ELO más bajo.
        </div>
      )}

      <p
        style={{
          marginTop: "20px",
          fontSize: "12px",
          color: "var(--vertigo-faint)",
          maxWidth: "560px",
          lineHeight: 1.6,
        }}
      >
        Los datos se obtienen de AoE2 Companion. Si un jugador no tiene partidas ranked en RM 1v1,
        aparecerá como "Sin datos". Podés buscar por nombre de perfil o Steam ID.
      </p>
    </>
  );
}

function PlayerInput({
  index,
  onSelect,
  isLoading,
}: {
  index: number;
  onSelect: (r: SearchResult) => void;
  isLoading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    const reqId = ++reqIdRef.current;
    try {
      const res = await fetch(`/api/aoe2/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (reqId === reqIdRef.current) {
        setResults(json.profiles?.slice(0, 6) ?? []);
      }
    } catch {
      setResults([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          borderRadius: "12px",
          background: "var(--vertigo-input-bg)",
          border: `2px solid ${isLoading ? "rgba(124,58,237,0.5)" : isLoading ? "rgba(124,58,237,0.3)" : "var(--vertigo-line)"}`,
          transition: "border-color 0.2s",
        }}
      >
        <input
          type="text"
          placeholder={`Jugador ${index + 1} — Buscar en AoE2 Companion...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isLoading}
          style={{
            width: "100%",
            height: 52,
            padding: "0 18px",
            paddingRight: isLoading ? 44 : 18,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--vertigo-text)",
            fontSize: 14,
            fontFamily: "Inter, sans-serif",
          }}
        />
        {isLoading && (
          <div
            style={{
              position: "absolute",
              right: 16,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                border: "2px solid rgba(124,58,237,0.2)",
                borderTopColor: "var(--vertigo-primary)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--vertigo-input-bg)",
            border: "1px solid var(--vertigo-line)",
            borderRadius: "10px",
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}
        >
          {results.map((r) => (
            <button
              key={r.profileId}
              onClick={() => {
                onSelect(r);
                setQuery("");
                setResults([]);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "12px 16px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--vertigo-line-soft)",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(124,58,237,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "rgba(124,58,237,0.12)",
                  border: "1px solid var(--vertigo-line)",
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--vertigo-purple-soft)",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--vertigo-text)" }}>
                  {r.name}
                </div>
                <div
                  style={{ fontSize: 11, color: "var(--vertigo-faint)", marginTop: 2 }}
                >
                  #{r.profileId}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
