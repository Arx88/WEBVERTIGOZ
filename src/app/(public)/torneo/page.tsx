import BracketView, { type MatchData } from "@/components/bracket/bracket-view";
import { Trophy } from "lucide-react";

const EXAMPLE_MATCHES: MatchData[] = [
  { roundIndex: 0, slotIndex: 0, teamA: { name: "Alpha", seed: 1 }, teamB: { name: "Omega", seed: 32 }, status: "finished", winnerSide: "A", scoreA: 2, scoreB: 0 },
  { roundIndex: 0, slotIndex: 1, teamA: { name: "Bravo", seed: 16 }, teamB: { name: "November", seed: 17 }, status: "in_progress", scoreA: 1, scoreB: 1 },
  { roundIndex: 0, slotIndex: 2, teamA: { name: "Charlie", seed: 8 }, teamB: { name: "Mike", seed: 25 }, status: "drawing" },
  { roundIndex: 0, slotIndex: 3, teamA: { name: "Delta", seed: 9 }, teamB: { name: "Lima", seed: 24 }, status: "scheduled", scheduledAt: new Date(Date.now() + 86400000 * 2).toISOString() },
  { roundIndex: 1, slotIndex: 0, teamA: { name: "Alpha", seed: 1 }, status: "scheduled" },
];

export default function TorneoPage() {
  return (
    <div className="vertigo-page vertigo-shell">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <a href="/" className="vertigo-logo">VÉRTIGO</a>
          <span className="vertigo-section-tag">TORNEO</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="vertigo-badge vertigo-badge-purple">Edición 2026</span>
          <span className="vertigo-badge vertigo-badge-warning">SE · 32 equipos</span>
        </div>
      </header>

      <main className="vertigo-content" style={{ maxWidth: "none", padding: "32px 24px" }}>
        {/* Stats */}
        <div className="vertigo-stats">
          <div className="vertigo-stat"><div className="vertigo-stat-label">EQUIPOS</div><div className="vertigo-stat-value">32</div><div className="vertigo-stat-sub">inscriptos</div></div>
          <div className="vertigo-stat"><div className="vertigo-stat-label">JUGADORES</div><div className="vertigo-stat-value">96</div><div className="vertigo-stat-sub">total</div></div>
          <div className="vertigo-stat"><div className="vertigo-stat-label">PARTIDOS</div><div className="vertigo-stat-value">31</div><div className="vertigo-stat-sub">en el bracket</div></div>
          <div className="vertigo-stat"><div className="vertigo-stat-label">RONDAS</div><div className="vertigo-stat-value">5</div><div className="vertigo-stat-sub">hasta la final</div></div>
        </div>

        {/* Bracket */}
        <div style={{ marginBottom: "16px" }}>
          <span className="vertigo-kicker">BRACKET</span>
          <h1 className="vertigo-title" style={{ fontSize: "24px" }}>Bracket del Torneo</h1>
        </div>

        <div className="vertigo-card" style={{ padding: "8px" }}>
          <BracketView bracketSize={32} matches={EXAMPLE_MATCHES} />
        </div>
      </main>
    </div>
  );
}
