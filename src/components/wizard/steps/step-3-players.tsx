"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWizard, type WizardPlayerDraft } from "@/components/wizard/wizard-context";
import { Search, UserPlus, X, Flag, Star, AlertCircle, Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Step 3 — Cargar jugadores
// Layout:
//   ROW 1 — 3 columnas (slots verticales, uno por jugador)
//   ROW 2 — search panel inline (debounce 400ms, sin botón Buscar)
//   ROW 3 — ELO bar (sticky bottom of content area)
// ============================================================

interface SearchResult {
  profileId: number;
  name: string;
  steamId?: string;
  country?: string;
  clan?: string;
  verified?: boolean;
}

export default function WizardStepPlayers() {
  const { data, updatePlayer } = useWizard();
  const [activeSlot, setActiveSlot] = useState<0 | 1 | 2>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const reqIdRef = useRef(0);

  // Debounce 400ms — búsqueda en tiempo real
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length === 0) {
      setDebouncedQuery("");
      setSearchResults([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    if (q.length < 3) {
      setDebouncedQuery("");
      setSearchResults([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => setDebouncedQuery(q), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Ejecutar búsqueda cuando cambia el debouncedQuery
  useEffect(() => {
    if (!debouncedQuery) return;
    let cancelled = false;
    const myReqId = ++reqIdRef.current;

    (async () => {
      try {
        setError(null);
        const res = await fetch(`/api/aoe2/search?q=${encodeURIComponent(debouncedQuery)}`);
        if (cancelled || myReqId !== reqIdRef.current) return;
        if (!res.ok) throw new Error("Error en búsqueda");
        const json = await res.json();
        if (cancelled || myReqId !== reqIdRef.current) return;
        const top5 = (json.profiles ?? []).slice(0, 5);
        setSearchResults(top5);
        setHasSearched(true);
        if (top5.length === 0) {
          setError("No se encontraron jugadores con ese nombre.");
        }
      } catch (e) {
        if (cancelled || myReqId !== reqIdRef.current) return;
        setError(e instanceof Error ? e.message : "Error desconocido");
        setSearchResults([]);
        setHasSearched(true);
      } finally {
        if (!cancelled && myReqId === reqIdRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const handleSelectPlayer = useCallback(
    (result: SearchResult) => {
      const draft: Partial<WizardPlayerDraft> = {
        aoe2ProfileId: result.profileId,
        displayName: result.name,
        steamId: result.steamId,
        country: result.country,
        clan: result.clan,
        isVerified: result.verified ?? false,
        verificationStatus: result.verified ? "verified" : "hidden",
      };
      updatePlayer(activeSlot, draft);
      setSearchQuery("");
      setSearchResults([]);
      setError(null);
      setHasSearched(false);
      if (activeSlot < 2) {
        const next = (activeSlot + 1) as 0 | 1 | 2;
        setActiveSlot(next);
      }
    },
    [activeSlot, updatePlayer]
  );

  function handleRemovePlayer(slot: 0 | 1 | 2) {
    updatePlayer(slot, {
      aoe2ProfileId: null,
      displayName: "",
      steamId: undefined,
      country: undefined,
      clan: undefined,
      maxRatingRm1v1: undefined,
      ratingRm1v1Current: undefined,
      ratingRm1v1Rank: undefined,
      isVerified: false,
      isCaptain: false,
      verificationStatus: "pending",
    });
    setActiveSlot(slot);
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
    setHasSearched(false);
  }

  const totalElo = data.players.reduce((sum, p) => sum + (p.maxRatingRm1v1 ?? 0), 0);
  const eloCap = 3500;
  const eloTolerance = 20;
  const eloMax = eloCap + eloTolerance;
  const isWithinCap = totalElo <= eloMax;
  const allPlayersLoaded = data.players.every((p) => p.aoe2ProfileId !== null);
  const loadedCount = data.players.filter((p) => p.aoe2ProfileId !== null).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ====== ROW 1 — 3 player slots ====== */}
      <div className="grid grid-cols-3 gap-4">
        {data.players.map((player, idx) => (
          <PlayerSlot
            key={idx}
            slot={idx as 0 | 1 | 2}
            player={player}
            isActive={activeSlot === idx}
            onClick={() => {
              setActiveSlot(idx as 0 | 1 | 2);
              setSearchQuery("");
              setSearchResults([]);
              setError(null);
              setHasSearched(false);
            }}
            onRemove={() => handleRemovePlayer(idx as 0 | 1 | 2)}
          />
        ))}
      </div>

      {/* ====== ROW 2 — Inline search + ELO bar side-by-side ====== */}
      <div className={cn("grid gap-4 items-stretch", allPlayersLoaded ? "grid-cols-1" : "lg:grid-cols-[3fr_2fr]")}>
        {/* Search panel */}
        {!allPlayersLoaded && (
          <div className="wiz-card p-5">
            <div className="flex items-baseline justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-cinzel text-[11px] tracking-[0.32em] uppercase text-[#ffb4dc]">
                  Cargar jugador {activeSlot + 1}
                </span>
              </div>
              <span className="wiz-caption text-[10px]">
                Tiempo real · 400ms
              </span>
            </div>

            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(255,180,220,0.55)]"
                strokeWidth={1.5}
              />
              <input
                placeholder="ej: Hera, Viper, Liereyy..."
                className="wiz-input pl-11 pr-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {loading && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 wiz-spin" />
              )}
              {!loading && searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setError(null);
                    setHasSearched(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,180,220,0.55)] hover:text-[#ff2e9e] transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && !loading && (
              <p className="mt-2 wiz-meta text-[10px] normal-case">
                Escribí al menos 3 caracteres para iniciar la búsqueda…
              </p>
            )}

            {error && !loading && (
              <div className="mt-2 flex items-start gap-2 text-[13px] text-[#ff4d6d]">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
                <span>{error}</span>
              </div>
            )}

            {/* Dropdown resultados */}
            {searchResults.length > 0 && !loading && (
              <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto wiz-scroll-hide">
                {searchResults.map((result) => (
                  <button
                    key={result.profileId}
                    onClick={() => handleSelectPlayer(result)}
                    className="w-full flex items-center justify-between p-3 bg-[rgba(20,0,31,0.5)] border border-[rgba(255,46,158,0.16)] hover:border-[rgba(255,46,158,0.6)] hover:bg-[rgba(255,46,158,0.04)] transition-all text-left group rounded-[4px]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full border border-[rgba(255,46,158,0.35)] flex items-center justify-center shrink-0">
                        <UserPlus className="w-4 h-4 text-[#ff2e9e]" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-cinzel text-[13px] text-[#f5eaff] truncate flex items-center gap-2">
                          {result.name}
                          {result.verified && (
                            <span className="inline-flex items-center gap-1 text-[#ff2e9e]">
                              <Star className="w-3 h-3" fill="currentColor" strokeWidth={0} />
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[rgba(255,180,220,0.55)] flex items-center gap-2 mt-0.5 uppercase tracking-[0.08em] font-cinzel">
                          {result.country && (
                            <span className="flex items-center gap-1">
                              <Flag className="w-3 h-3" strokeWidth={1.5} />
                              {result.country}
                            </span>
                          )}
                          {result.clan && <span>{result.clan}</span>}
                          <span>#{result.profileId}</span>
                        </div>
                      </div>
                    </div>
                    <span className="wiz-caption text-[10px] text-[rgba(255,180,220,0.55)] group-hover:text-[#ff2e9e] transition-colors shrink-0 ml-3">
                      Seleccionar →
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!loading && !searchQuery && (
              <p className="mt-2 wiz-meta text-[10px] normal-case">
                Escribí el nombre del jugador {activeSlot + 1} para buscarlo en AoE2 Companion.
              </p>
            )}
          </div>
        )}

        {/* ELO panel */}
        <div className={cn("wiz-card p-5", allPlayersLoaded && "max-w-2xl mx-auto w-full")}>
          <div className="flex items-center justify-between mb-3">
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.32em" }}>
              ELO total · RM 1v1
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 border rounded-[4px]",
                isWithinCap
                  ? "border-[rgba(255,46,158,0.4)] text-[#ffb4dc]"
                  : "border-[rgba(255,77,109,0.5)] text-[#ff4d6d]"
              )}
            >
              <span className="font-cinzel text-[9px] tracking-[0.18em] uppercase">
                {isWithinCap ? "Dentro" : "Excede"}
              </span>
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span
              className={cn(
                "font-cinzel text-[36px] tabular-nums leading-none",
                isWithinCap ? "text-[#ff2e9e]" : "text-[#ff4d6d]"
              )}
              style={isWithinCap ? { textShadow: "0 0 18px rgba(255,46,158,0.5)" } : undefined}
            >
              {totalElo}
            </span>
            <span className="font-cinzel text-[14px] tabular-nums text-[rgba(255,180,220,0.55)]">
              / {eloMax} máx
            </span>
          </div>

          <div className="h-1.5 w-full bg-[rgba(255,46,158,0.08)] rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500 rounded-full",
                isWithinCap
                  ? "bg-gradient-to-r from-[rgba(255,46,158,0.55)] to-[#ff2e9e] shadow-[0_0_8px_rgba(255,46,158,0.55)]"
                  : "bg-[#ff4d6d]"
              )}
              style={{ width: `${Math.min(100, (totalElo / eloMax) * 100)}%` }}
            />
          </div>

          <p className="wiz-meta mt-3 text-[10px] normal-case">
            Tope 3500 · Tolerancia +{eloTolerance} · suma maxRating histórico RM 1v1
          </p>
        </div>
      </div>

      {/* ====== ROW 3 — All loaded confirmation ====== */}
      {allPlayersLoaded && (
        <div className="wiz-panel-active border-l-2 !border-l-[#ff2e9e] px-5 py-4 rounded-[4px] flex items-start gap-3 max-w-3xl mx-auto">
          <Check className="w-5 h-5 text-[#ff2e9e] mt-0.5 shrink-0" strokeWidth={2} />
          <p className="wiz-body text-[13px]">
            Los <span className="text-[#ff2e9e] font-semibold">3 jugadores</span> están cargados ({loadedCount}/3).
            Continuá al siguiente paso para elegir quién será el <span className="text-[#ff2e9e] font-semibold">capitán</span> del equipo.
          </p>
        </div>
      )}

      {!allPlayersLoaded && loadedCount > 0 && (
        <div className="wiz-panel-sunken px-4 py-2.5 rounded-[4px] flex items-center gap-2 max-w-3xl mx-auto">
          <Info className="w-3.5 h-3.5 text-[rgba(255,180,220,0.55)] shrink-0" strokeWidth={1.5} />
          <p className="wiz-meta text-[11px] normal-case">
            {loadedCount}/3 jugadores cargados. Faltan {3 - loadedCount} para continuar.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PlayerSlot — vertical card
// ============================================================
function PlayerSlot({
  slot,
  player,
  isActive,
  onClick,
  onRemove,
}: {
  slot: 0 | 1 | 2;
  player: WizardPlayerDraft;
  isActive: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const isLoaded = player.aoe2ProfileId !== null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "wiz-slot relative !rounded-[4px] min-h-[200px] flex-1",
        isActive && "wiz-slot-active",
        isLoaded && !isActive && "wiz-slot-loaded",
        !isLoaded && !isActive && "wiz-slot-empty"
      )}
    >
      {/* Top-right status (X remove or slot index) */}
      {isLoaded ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 text-[rgba(255,180,220,0.55)] hover:text-[#ff4d6d] cursor-pointer transition-colors"
          role="button"
          aria-label="Quitar jugador"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </span>
      ) : (
        <span className="absolute top-2 right-2 font-cinzel text-[10px] tabular-nums tracking-[0.18em] text-[rgba(255,180,220,0.4)]">
          {String(slot + 1).padStart(2, "0")}
        </span>
      )}

      {isLoaded ? (
        <div className="flex flex-col items-center gap-2 px-2">
          <div className="w-14 h-14 rounded-full border border-[rgba(255,46,158,0.55)] flex items-center justify-center shadow-[0_0_14px_rgba(255,46,158,0.25)]">
            <UserPlus className="w-6 h-6 text-[#ff2e9e]" strokeWidth={1.25} />
          </div>
          <div className="font-cinzel text-[13px] text-[#f5eaff] text-center truncate w-full">
            {player.displayName}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-cinzel text-[rgba(255,180,220,0.55)]">
            {player.country && (
              <span className="flex items-center gap-1">
                <Flag className="w-2.5 h-2.5" strokeWidth={1.5} />
                {player.country}
              </span>
            )}
            {player.clan && <span>· {player.clan}</span>}
          </div>
          {player.maxRatingRm1v1 !== undefined && (
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-cinzel text-[16px] tabular-nums text-[#ff2e9e]">
                {player.maxRatingRm1v1}
              </span>
              <span className="font-inter text-[9px] tracking-[0.18em] uppercase text-[rgba(255,180,220,0.45)]">
                ELO máx
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-2">
          <div className="w-14 h-14 rounded-full border border-dashed border-[rgba(255,46,158,0.3)] flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-[rgba(255,180,220,0.45)]" strokeWidth={1.5} />
          </div>
          <div className="font-cinzel text-[12px] tracking-[0.22em] uppercase text-[rgba(255,180,220,0.55)]">
            Jugador {slot + 1}
          </div>
          <div className="wiz-caption text-[9px] normal-case">
            {isActive ? "Buscá abajo ↓" : "Click para cargar"}
          </div>
        </div>
      )}
    </button>
  );
}
