import BracketView, { type MatchData } from "@/components/bracket/bracket-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";

// Datos de ejemplo para mostrar el bracket
const EXAMPLE_MATCHES: MatchData[] = [
  // R1, slot 0: Team Alpha (seed 1) vs Team Omega (seed 32) — finalizado 2-0
  {
    roundIndex: 0,
    slotIndex: 0,
    teamA: { name: "Alpha", seed: 1 },
    teamB: { name: "Omega", seed: 32 },
    status: "finished",
    winnerSide: "A",
    scoreA: 2,
    scoreB: 0,
  },
  // R1, slot 1: Team Bravo (seed 16) vs Team November (seed 17) — en juego
  {
    roundIndex: 0,
    slotIndex: 1,
    teamA: { name: "Bravo", seed: 16 },
    teamB: { name: "November", seed: 17 },
    status: "in_progress",
    scoreA: 1,
    scoreB: 1,
  },
  // R1, slot 2: Team Charlie (seed 8) vs Team Mike (seed 25) — sorteando
  {
    roundIndex: 0,
    slotIndex: 2,
    teamA: { name: "Charlie", seed: 8 },
    teamB: { name: "Mike", seed: 25 },
    status: "drawing",
  },
  // R1, slot 3: programado
  {
    roundIndex: 0,
    slotIndex: 3,
    teamA: { name: "Delta", seed: 9 },
    teamB: { name: "Lima", seed: 24 },
    status: "scheduled",
    scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString(),
  },
  // R2, slot 0: ganador R1 slot 0 vs ganador R1 slot 1
  {
    roundIndex: 1,
    slotIndex: 0,
    teamA: { name: "Alpha", seed: 1 },
    status: "scheduled",
  },
];

export default function TorneoPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* HEADER */}
      <header className="border-b border-border-subtle">
        <div className="mx-auto max-w-[1600px] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-gold/60 rotate-45 flex items-center justify-center">
              <span className="-rotate-45 font-serif text-gold text-lg font-bold">V</span>
            </div>
            <div>
              <div className="font-serif text-xl">VÉRTIGO Cup</div>
              <div className="text-caption text-text-tertiary uppercase tracking-wider">
                Edición 2026 · Single Elimination
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="live">
              <span className="relative inline-flex h-1.5 w-1.5 mr-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-danger" />
              </span>
              EN VIVO
            </Badge>
            <Badge variant="outline">3 partidas hoy</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] w-full px-6 py-8 flex-1">
        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Equipos", value: "32", sub: "inscriptos" },
            { label: "Jugadores", value: "96", sub: "total" },
            { label: "Partidos", value: "31", sub: "en el bracket" },
            { label: "Rondas", value: "5", sub: "hasta la final" },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="label-premium text-text-tertiary">{stat.label}</div>
                <div className="font-serif text-3xl text-gold mt-1 tabular-nums">{stat.value}</div>
                <div className="text-caption text-text-tertiary mt-1">{stat.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Divider size="sm" />

        {/* Bracket */}
        <div className="mt-8">
          <div className="flex items-baseline justify-between mb-6">
            <h1 className="font-serif text-3xl">Bracket del Torneo</h1>
            <div className="flex items-center gap-2 text-caption text-text-tertiary">
              <span className="w-3 h-3 border border-accent/40 inline-block" /> Sorteando
              <span className="w-3 h-3 border border-danger/60 inline-block ml-3" /> En juego
              <span className="w-3 h-3 border border-warning/40 inline-block ml-3" /> Comodines
            </div>
          </div>

          <Card>
            <CardContent className="p-2">
              <BracketView bracketSize={32} matches={EXAMPLE_MATCHES} />
            </CardContent>
          </Card>
        </div>

        {/* Footer info */}
        <div className="mt-8 border-l-2 border-gold/40 pl-4 py-2">
          <p className="text-caption text-text-secondary leading-relaxed">
            <span className="text-gold">Bracket demostración:</span> los partidos reales se generan
            automáticamente cuando se completa la inscripción y se realiza el sorteo
            inicial de llaves. La estructura sigue el seeding estándar "snake" para
            que los mejores seeds se crucen lo más tarde posible.
          </p>
        </div>
      </div>
    </main>
  );
}
