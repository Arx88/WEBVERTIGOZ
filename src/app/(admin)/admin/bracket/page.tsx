import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { generateBracketAction } from "@/server/actions/auth";
import { generateRealBracketFormAction, deleteBracketFormAction } from "@/server/actions/tournament";
import { generateBracket, ROUND_NAMES_32, BRACKET_SIZE, BRACKET_ROUNDS } from "@/lib/bracket/engine";
import { Layers, Shuffle, AlertCircle, ChevronRight, Crown, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { cls: string; dot: string; label: string }> = {
  scheduled: { cls: "vertigo-badge-purple", dot: "var(--vertigo-purple-soft)", label: "Programado" },
  open: { cls: "vertigo-badge-purple", dot: "var(--vertigo-purple-soft)", label: "Abierto" },
  drawing: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Sorteando" },
  lineup: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Lineup" },
  comodin_window: { cls: "vertigo-badge-warning", dot: "#fbbf24", label: "Comodines" },
  in_progress: { cls: "vertigo-badge-danger", dot: "var(--vertigo-danger)", label: "En juego" },
  finished: { cls: "vertigo-badge-success", dot: "var(--vertigo-success)", label: "Finalizado" },
  disputed: { cls: "vertigo-badge-danger", dot: "var(--vertigo-danger)", label: "Disputa" },
  forfeit: { cls: "vertigo-badge-purple", dot: "var(--vertigo-faint)", label: "W.O." },
  cancelled: { cls: "vertigo-badge-purple", dot: "var(--vertigo-faint)", label: "Cancelado" },
};

export default async function AdminBracketPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name, status, max_teams")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()) as { data: any };

  const editionId = edition?.id;

  const { data: approvedRegs } = (await supabase
    .from("team_registration")
    .select("id, seed, team_account:team_account_id (name)")
    .eq("tournament_edition_id", editionId ?? "")
    .eq("status", "approved")
    .order("seed", { ascending: true, nullsFirst: false })) as { data: any };

  const approvedCount = approvedRegs?.length ?? 0;
  const seededCount = approvedRegs?.filter((r: any) => r.seed !== null).length ?? 0;

  // Fetch existing matches (if bracket exists)
  let matchesByRound: Map<number, any[]> = new Map();
  let totalMatches = 0;
  if (editionId) {
    const { data: brackets } = (await supabase
      .from("bracket")
      .select("id, type, rounds_count")
      .eq("tournament_edition_id", editionId)
      .eq("type", "winner")) as { data: any };

    const bracketId = brackets?.[0]?.id;
    if (bracketId) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id, index, name, bracket_id")
        .eq("bracket_id", bracketId)
        .order("index", { ascending: true })) as { data: any };

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map((r: any) => r.id);
        const { data: matches } = (await supabase
          .from("match")
          .select(`
            id, slot_index, status, format, score_a, score_b, scheduled_at_start, winner_team_id,
            round:round_id (id, index, name),
            team_a:team_a_id (id, team_account:team_account_id (name)),
            team_b:team_b_id (id, team_account:team_account_id (name))
          `)
          .in("round_id", roundIds)
          .order("slot_index", { ascending: true })) as { data: any };

        totalMatches = matches?.length ?? 0;
        matchesByRound = new Map();
        (matches ?? []).forEach((m: any) => {
          const rIdx = m.round?.index ?? 0;
          if (!matchesByRound.has(rIdx)) matchesByRound.set(rIdx, []);
          matchesByRound.get(rIdx)!.push(m);
        });
      }
    }
  }

  // Bracket estructural (siempre generado, para mostrar layout)
  const bracket = generateBracket(BRACKET_SIZE);
  const hasBracket = totalMatches > 0;
  const canGenerate = approvedCount >= BRACKET_SIZE && !hasBracket;

  // Map seeded team names by seed number for R1 display
  const seedToTeam = new Map<number, string>();
  (approvedRegs ?? []).forEach((r: any) => {
    if (r.seed !== null) seedToTeam.set(r.seed, r.team_account?.name ?? `Seed ${r.seed}`);
  });

  return (
    <div className="vertigo-fade-in">
      <span className="vertigo-kicker">BRACKET</span>
      <h1 className="vertigo-title">Bracket del torneo</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        Generar bracket SE de 32, sorteo inicial de seeds (aleatorio puro), visualizar partidos por ronda.
      </p>

      <div className="vertigo-stats">
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Equipos aprobados</div>
          <div className="vertigo-stat-value">{approvedCount} / {BRACKET_SIZE}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Con seed asignado</div>
          <div className="vertigo-stat-value text-[var(--vertigo-purple-pale)]">{seededCount}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Partidos creados</div>
          <div className="vertigo-stat-value">{totalMatches}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Rondas</div>
          <div className="vertigo-stat-value">{BRACKET_ROUNDS}</div>
        </div>
      </div>

      {/* Sorteo inicial de seeds */}
      <section className="mb-8">
        <div className="vertigo-subtitle">Sorteo inicial de seeds + generación del bracket</div>
        <div className="vertigo-card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div
              className="flex items-center justify-center rounded-lg border border-[var(--vertigo-purple)] bg-[rgba(124,58,237,0.06)] text-[var(--vertigo-purple-soft)] flex-none"
              style={{ width: 56, height: 56 }}
            >
              <Shuffle style={{ width: 24, height: 24 }} strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-cinzel text-base text-[var(--vertigo-text)]">
                Sorteo aleatorio puro
              </div>
              <p className="text-sm text-[var(--vertigo-muted)] mt-1 leading-relaxed">
                Asigna seeds 1..32 a los equipos aprobados usando Fisher-Yates shuffle.
                Los emparejamientos de R1 siguen snake-seeding (1 vs 32, 2 vs 31, …).
                Requiere <span className="text-[var(--vertigo-purple-pale)]">{BRACKET_SIZE} equipos aprobados</span>.
              </p>
              <div className="text-xs text-[var(--vertigo-faint)] mt-2 flex items-center gap-2">
                <Users style={{ width: 12, height: 12 }} />
                <span>Aprobados: {approvedCount} / {BRACKET_SIZE}</span>
                <span>·</span>
                <span>{hasBracket ? "Bracket ya generado" : "Sin generar"}</span>
              </div>
            </div>
            {editionId && (
              <div className="flex gap-2 flex-none">
                <form action={generateBracketAction}>
                  <input type="hidden" name="edition_id" value={editionId} />
                  <button
                    type="submit"
                    className="vertigo-btn vertigo-btn-ghost flex-none"
                    disabled={approvedCount < BRACKET_SIZE}
                  >
                    <Shuffle style={{ width: 14, height: 14 }} />
                    {seededCount > 0 ? "Re-sortear seeds" : "Sortear seeds"}
                  </button>
                </form>
                <form action={generateRealBracketFormAction}>
                  <input type="hidden" name="edition_id" value={editionId} />
                  <button
                    type="submit"
                    className="vertigo-btn vertigo-btn-primary flex-none"
                    disabled={seededCount !== BRACKET_SIZE}
                  >
                    <Layers style={{ width: 14, height: 14 }} />
                    {hasBracket ? "Regenerar completo" : "Generar bracket"}
                  </button>
                </form>
              </div>
            )}
          </div>
          {approvedCount < BRACKET_SIZE && (
            <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)] flex items-start gap-3">
              <AlertCircle className="flex-none text-[#fbbf24] mt-0.5" style={{ width: 14, height: 14 }} />
              <p className="text-xs text-[var(--vertigo-muted)]">
                Faltan <span className="text-[#fbbf24] font-semibold">{BRACKET_SIZE - approvedCount} equipos</span> por aprobar
                antes de poder generar el bracket. Sin byes — siempre 32 equipos (decisión del usuario #3).
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Bracket visual */}
      <section>
        <div className="vertigo-subtitle">Bracket SE · 32 equipos</div>
        {hasBracket ? (
          <div className="vertigo-card vertigo-scroll overflow-x-auto p-4">
            <div className="flex gap-4 min-w-max">
              {bracket.rounds.map((round) => {
                const persisted = matchesByRound.get(round.index) ?? [];
                return (
                  <div key={round.index} className="flex flex-col" style={{ width: 220 }}>
                    <div className="vertigo-subtitle mb-3">{round.name}</div>
                    <div className="flex flex-col gap-2 flex-1 justify-around">
                      {round.matches.map((m) => {
                        const persistedMatch = persisted.find((p: any) => p.slot_index === m.slotIndex);
                        const teamAName = persistedMatch?.team_a?.team_account?.name
                          ?? (m.seedA ? seedToTeam.get(m.seedA) ?? `Seed ${m.seedA}` : "—");
                        const teamBName = persistedMatch?.team_b?.team_account?.name
                          ?? (m.seedB ? seedToTeam.get(m.seedB) ?? `Seed ${m.seedB}` : "—");
                        const status = persistedMatch?.status ?? "scheduled";
                        const meta = STATUS_META[status] ?? STATUS_META.scheduled;
                        const winnerA = persistedMatch?.winner_team_id && persistedMatch?.team_a?.id === persistedMatch.winner_team_id;
                        const winnerB = persistedMatch?.winner_team_id && persistedMatch?.team_b?.id === persistedMatch.winner_team_id;
                        const matchHref = persistedMatch?.id ? `/admin/partido/${persistedMatch.id}` : null;
                        const inner = (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">
                                #{m.seedA ?? "?"} vs #{m.seedB ?? "?"}
                              </span>
                              <span className={`vertigo-badge ${meta.cls}`} style={{ padding: "2px 7px", fontSize: 9 }}>
                                <span className="vertigo-status-dot" style={{ background: meta.dot }} />
                                {meta.label}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1 border-b border-[var(--vertigo-line-soft)]">
                              <span className={`truncate ${winnerA ? "text-[var(--vertigo-success)] font-semibold" : "text-[var(--vertigo-muted)]"}`}>
                                {winnerA && <Crown style={{ width: 10, height: 10, display: "inline", marginRight: 4 }} />}
                                {teamAName}
                              </span>
                              <span className={`font-mono ml-2 ${winnerA ? "text-[var(--vertigo-purple-pale)]" : "text-[var(--vertigo-faint)]"}`}>
                                {persistedMatch?.score_a ?? ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs py-1">
                              <span className={`truncate ${winnerB ? "text-[var(--vertigo-success)] font-semibold" : "text-[var(--vertigo-muted)]"}`}>
                                {winnerB && <Crown style={{ width: 10, height: 10, display: "inline", marginRight: 4 }} />}
                                {teamBName}
                              </span>
                              <span className={`font-mono ml-2 ${winnerB ? "text-[var(--vertigo-purple-pale)]" : "text-[var(--vertigo-faint)]"}`}>
                                {persistedMatch?.score_b ?? ""}
                              </span>
                            </div>
                          </>
                        );
                        const cardClass = "vertigo-card" + (matchHref ? " hover:border-[var(--vertigo-purple)] transition-colors cursor-pointer block" : "");
                        return matchHref ? (
                          <Link key={m.tempId} href={matchHref} className={cardClass} style={{ padding: 10 }}>
                            {inner}
                          </Link>
                        ) : (
                          <div key={m.tempId} className={cardClass} style={{ padding: 10 }}>
                            {inner}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Layers className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">Bracket sin generar</div>
              <p className="vertigo-empty-desc">
                Una vez sorteados los seeds y creado el bracket, vas a ver acá las 5 rondas:
                Ronda 1 · Octavos · Cuartos · Semifinal · Final.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                {ROUND_NAMES_32.map((name, i) => (
                  <span key={name} className="vertigo-badge vertigo-badge-purple">
                    <ChevronRight style={{ width: 10, height: 10 }} />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
