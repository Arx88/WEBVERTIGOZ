"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWizard, type WizardPlayerDraft } from "@/components/wizard/wizard-context";
import { Search, UserPlus, X, Flag, Star, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
        // Limitar a 5 resultados — dropdown limpio
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
      // Auto-avanzar al siguiente slot vacío
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

  return (
    <div className="max-w-4xl mx-auto space-y-5 text-center">
      <p className="wiz-body max-w-2xl mx-auto">
        Buscá a cada jugador por su <strong>nombre in-game en AoE2 Companion</strong>.
        Validamos identidad, ELO máximo histórico RM 1v1 y que la suma total no
        supere el límite del torneo.
      </p>

      {/* ELO Cap progress */}
      <div className="wiz-panel px-5 py-4 text-left">
        <div className="flex items-center justify-between mb-2">
          <span className="wiz-caption" style={{ letterSpacing: "0.32em" }}>
            ELO total del equipo
          </span>
          <span
            className={cn(
              "font-cinzel text-2xl tabular-nums tracking-wide",
              isWithinCap ? "text-[#f5eaff]" : "text-[#ff4d6d]"
            )}
          >
            {totalElo}
            <span className="text-[rgba(255,180,220,0.5)] text-base"> / {eloMax}</span>
          </span>
        </div>
        <div className="h-1 w-full bg-[rgba(255,46,158,0.08)] overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              isWithinCap
                ? "bg-gradient-to-r from-[rgba(255,46,158,0.55)] to-[#ff2e9e] shadow-[0_0_8px_rgba(255,46,158,0.55)]"
                : "bg-[#ff4d6d]"
            )}
            style={{ width: `${Math.min(100, (totalElo / eloMax) * 100)}%` }}
          />
        </div>
        <p className="wiz-caption mt-2 normal-case text-[11px] text-[rgba(255,180,220,0.45)]" style={{ letterSpacing: "0.04em" }}>
          Tope: 3500 · Tolerancia +{eloTolerance} = {eloMax} máx absoluto (suma maxRating RM 1v1 histórico)
        </p>
      </div>

      {/* Slots de jugadores */}
      <div className="grid grid-cols-3 gap-3">
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

      {/* Búsqueda en tiempo real (sin botón Buscar) */}
      {!allPlayersLoaded && (
        <div className="wiz-panel px-5 py-4 text-left">
          <div className="flex items-baseline justify-between mb-2">
            <span className="wiz-label mb-0">Cargar jugador {activeSlot + 1}</span>
            <span className="wiz-caption text-[10px]" style={{ letterSpacing: "0.06em" }}>
              Buscá por nombre in-game · tiempo real
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

          {/* Hint mientras escribe poco */}
          {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && !loading && (
            <p className="mt-2 wiz-caption text-[10px] normal-case text-[rgba(255,180,220,0.45)]" style={{ letterSpacing: "0.04em" }}>
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
                  className="w-full flex items-center justify-between p-3 bg-[rgba(20,0,31,0.5)] border border-[rgba(255,46,158,0.16)] hover:border-[rgba(255,46,158,0.6)] hover:bg-[rgba(255,46,158,0.04)] transition-all text-left group"
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

          {/* Estado inicial (sin haber buscado todavía) */}
          {!loading && !searchQuery && (
            <p className="mt-2 wiz-caption text-[10px] normal-case text-[rgba(255,180,220,0.4)]" style={{ letterSpacing: "0.04em" }}>
              Escribí el nombre del jugador {activeSlot + 1} para buscarlo en AoE2 Companion.
            </p>
          )}
        </div>
      )}

      {allPlayersLoaded && (
        <div className="wiz-panel border-l-2 border-l-[#ff2e9e] px-4 py-3 text-left inline-block">
          <p className="text-[13px] leading-relaxed text-[#e6d3f5]">
            <Check className="w-4 h-4 inline mr-2 text-[#ff2e9e]" strokeWidth={2} />
            Los 3 jugadores están cargados. Continuá al siguiente paso para
            elegir quién será el <span className="text-[#ff2e9e] font-semibold">capitán</span> del equipo.
          </p>
        </div>
      )}
    </div>
  );
}

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
        "wiz-slot",
        isActive && "wiz-slot-active",
        !isLoaded && !isActive && "wiz-slot-empty"
      )}
      style={{ minHeight: 150 }}
    >
      {isLoaded ? (
        <>
          <div className="w-11 h-11 rounded-full border border-[rgba(255,46,158,0.55)] flex items-center justify-center mb-2">
            <UserPlus className="w-5 h-5 text-[#ff2e9e]" strokeWidth={1.25} />
          </div>
          <div className="font-cinzel text-[13px] text-[#f5eaff] mb-1 truncate w-full px-1">
            {player.displayName}
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] font-cinzel text-[rgba(255,180,220,0.55)] mb-1">
            {player.country && <span>{player.country}</span>}
            {player.clan && <span>· {player.clan}</span>}
          </div>
          {player.maxRatingRm1v1 !== undefined && (
            <div className="text-[11px] text-[#e6d3f5]">
              ELO máx:{" "}
              <span className="font-cinzel font-semibold text-[#ff2e9e] tabular-nums">
                {player.maxRatingRm1v1}
              </span>
            </div>
          )}
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
        </>
      ) : (
        <>
          <div className="w-11 h-11 rounded-full border border-dashed border-[rgba(255,46,158,0.35)] flex items-center justify-center mb-2">
            <UserPlus className="w-5 h-5 text-[rgba(255,180,220,0.55)]" strokeWidth={1.5} />
          </div>
          <div className="font-cinzel text-[12px] tracking-[0.22em] uppercase text-[rgba(255,180,220,0.55)] mb-1">
            Jugador {slot + 1}
          </div>
          <div className="wiz-caption text-[9px] normal-case" style={{ letterSpacing: "0.08em" }}>
            {isActive ? "Buscá abajo ↓" : "Click para cargar"}
          </div>
        </>
      )}
    </button>
  );
}
