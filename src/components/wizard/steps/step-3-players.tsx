"use client";

import { useState } from "react";
import { useWizard, type WizardPlayerDraft } from "@/components/wizard/wizard-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, X, Loader2, Flag, Star, AlertCircle } from "lucide-react";
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (searchQuery.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      // TODO: replace with real Server Action hitting AoE2 Companion proxy
      const res = await fetch(`/api/aoe2/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Error en búsqueda");
      const data = await res.json();
      setSearchResults(data.profiles ?? []);
      if ((data.profiles ?? []).length === 0) {
        setError("No se encontraron jugadores con ese nombre.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlayer(result: SearchResult) {
    setLoading(true);
    setError(null);
    try {
      // TODO: traer maxRating RM 1v1 histórico con getMaxRatingRm1v1
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
      // Avanzar al siguiente slot automáticamente si quedan
      if (activeSlot < 2) setActiveSlot((activeSlot + 1) as 0 | 1 | 2);
    } finally {
      setLoading(false);
    }
  }

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
  }

  const totalElo = data.players.reduce(
    (sum, p) => sum + (p.maxRatingRm1v1 ?? 0),
    0
  );
  const eloCap = 3500;
  const eloTolerance = 20;
  const eloMax = eloCap + eloTolerance;
  const isWithinCap = totalElo <= eloMax;
  const allPlayersLoaded = data.players.every((p) => p.aoe2ProfileId !== null);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <p className="text-text-secondary text-sm font-light leading-relaxed">
        Buscá a cada uno de tus 3 jugadores por su nombre in-game en AoE2 Companion.
        Validaremos automáticamente su identidad, su ELO máximo histórico RM 1v1
        y que la suma total no supere el límite del torneo.
      </p>

      {/* ELO Cap progress */}
      <div className="border border-border-subtle bg-bg-elevated p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="label-premium text-text-secondary">ELO TOTAL DEL EQUIPO</span>
          <span className={cn(
            "font-serif text-2xl tabular-nums",
            isWithinCap ? "text-text-primary" : "text-danger"
          )}>
            {totalElo} <span className="text-text-tertiary text-base">/ {eloMax}</span>
          </span>
        </div>
        <div className="h-1 w-full bg-bg-hover rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              isWithinCap ? "bg-gold" : "bg-danger"
            )}
            style={{ width: `${Math.min(100, (totalElo / eloMax) * 100)}%` }}
          />
        </div>
        <p className="text-caption text-text-tertiary mt-2">
          Tope: 3500 · Tolerancia: +{eloTolerance} = {eloMax} máximo absoluto (suma maxRating RM 1v1 histórico)
        </p>
      </div>

      {/* Slots de jugadores */}
      <div className="grid md:grid-cols-3 gap-4">
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
            }}
            onRemove={() => handleRemovePlayer(idx as 0 | 1 | 2)}
          />
        ))}
      </div>

      {/* Búsqueda */}
      {!allPlayersLoaded && (
        <div className="border border-border-subtle bg-bg-elevated p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <Label>Cargar jugador {activeSlot + 1}</Label>
            <span className="text-caption text-text-tertiary">
              Buscá por nombre in-game
            </span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" strokeWidth={1.5} />
              <Input
                placeholder="ej: Hera, Viper, Liereyy..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading || searchQuery.length < 3}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </Button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-danger text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
              <span>{error}</span>
            </div>
          )}

          {/* Resultados */}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {searchResults.map((result) => (
                <button
                  key={result.profileId}
                  onClick={() => handleSelectPlayer(result)}
                  className="w-full flex items-center justify-between p-3 border border-border-subtle hover:border-gold/60 hover:bg-bg-hover transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-bg-hover border border-border-strong flex items-center justify-center">
                      <UserPlus className="w-4 h-4 text-text-secondary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="font-medium text-text-primary flex items-center gap-2">
                        {result.name}
                        {result.verified && (
                          <Badge variant="gold" size="sm">
                            <Star className="w-2.5 h-2.5 mr-1" strokeWidth={2} />
                            Verificado
                          </Badge>
                        )}
                      </div>
                      <div className="text-caption text-text-tertiary flex items-center gap-3 mt-0.5">
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
                  <span className="text-caption text-text-tertiary uppercase tracking-wider">
                    Seleccionar →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {allPlayersLoaded && (
        <div className="border-l-2 border-gold/40 pl-4 py-2">
          <p className="text-caption text-text-secondary leading-relaxed">
            ✓ Los 3 jugadores están cargados. Continuá al siguiente paso para
            elegir quién será el <span className="text-gold">capitán</span> del equipo.
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
        "border p-5 flex flex-col items-center text-center transition-all min-h-[180px]",
        isActive ? "border-gold bg-gold/5" : "border-border-subtle hover:border-border-strong",
        !isLoaded && "border-dashed"
      )}
    >
      {isLoaded ? (
        <>
          <div className="w-14 h-14 rounded-full bg-bg-hover border-2 border-gold/40 flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-gold" strokeWidth={1.25} />
          </div>
          <div className="font-medium text-text-primary text-sm mb-1">
            {player.displayName}
          </div>
          <div className="flex items-center gap-2 text-caption text-text-tertiary mb-2">
            {player.country && <span>{player.country}</span>}
            {player.clan && <span>· {player.clan}</span>}
          </div>
          {player.maxRatingRm1v1 !== undefined && (
            <div className="text-caption text-text-secondary">
              ELO máx: <span className="font-medium text-gold tabular-nums">{player.maxRatingRm1v1}</span>
            </div>
          )}
          {player.verificationStatus === "hidden" && (
            <Badge variant="warning" size="sm" className="mt-2">
              Falta verificación
            </Badge>
          )}
          <span
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-2 right-2 text-text-tertiary hover:text-danger cursor-pointer"
            role="button"
            aria-label="Quitar jugador"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </span>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-border-strong flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-text-tertiary" strokeWidth={1.5} />
          </div>
          <div className="font-medium text-text-tertiary text-sm mb-1">
            Jugador {slot + 1}
          </div>
          <div className="text-caption text-text-tertiary">
            {isActive ? "Buscá abajo ↑" : "Click para cargar"}
          </div>
        </>
      )}
    </button>
  );
}
