import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Clock, Shield, Trophy, Shuffle, Layers,
  Users, Sparkles, AlertTriangle, Play, Pause, CheckCircle2,
} from "lucide-react";

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

const COMODIN_LABEL: Record<string, string> = {
  reroll: "Reroll",
  anular: "Anular",
  elegir_rival: "Elegir rival",
  invocar_pro: "Invocar pro",
};

export default async function AdminPartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { id } = await params;

  const { data: match } = (await supabase
    .from("match")
    .select(`
      id, slot_index, status, format, score_a, score_b,
      scheduled_at_start, scheduled_at_end, jornada_label,
      ready_a_at, ready_b_at, ready_lineup_a_at, ready_lineup_b_at,
      winner_team_id, finished_at, anular_used_by_team_id, elegir_rival_used_by_team_id,
      round:round_id (id, index, name, bracket:bracket_id (tournament_edition_id)),
      team_a:team_a_id (id, team_account:team_account_id (name, tagline),
        players:player_registration (id, display_name, is_captain, max_rating_rm_1v1)),
      team_b:team_b_id (id, team_account:team_account_id (name, tagline),
        players:player_registration (id, display_name, is_captain, max_rating_rm_1v1)),
      games:match_game (id, game_number, status, game_mode, antimeta_mode, player_mode, map,
        lineup_a, lineup_b, civs_a, civs_b, winner_team_id, started_at, finished_at,
        draw:draw_id (commit_hash, revealed_seed, status)
      ),
      comodin_usages:comodin_usage (id, comodin_type, status, target_phase, notes, requested_at, executed_at)
    `)
    .eq("id", id)
    .single()) as { data: any };

  if (!match) notFound();

  const meta = STATUS_META[match.status] ?? STATUS_META.scheduled;
  const teamA = match.team_a;
  const teamB = match.team_b;
  const winnerA = match.winner_team_id && teamA?.id === match.winner_team_id;
  const winnerB = match.winner_team_id && teamB?.id === match.winner_team_id;
  const games = match.games ?? [];
  const comodinUsages = match.comodin_usages ?? [];
  const isFinished = match.status === "finished";
  const isScheduled = match.status === "scheduled";

  return (
    <div className="vertigo-fade-in">
      <Link href="/admin/jornadas" className="vertigo-btn vertigo-btn-ghost mb-4">
        <ChevronLeft style={{ width: 14, height: 14 }} />
        Volver a jornadas
      </Link>

      <span className="vertigo-kicker">{match.round?.name ?? "PARTIDO"}</span>
      <h1 className="vertigo-title">Partido</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>

      {/* Status badge grande */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <span className={`vertigo-badge ${meta.cls}`} style={{ padding: "8px 16px", fontSize: 12 }}>
          <span className="vertigo-status-dot" style={{ background: meta.dot, width: 8, height: 8 }} />
          {meta.label}
        </span>
        {match.format && (
          <span className="vertigo-badge vertigo-badge-purple" style={{ padding: "8px 16px", fontSize: 12 }}>
            {match.format}
          </span>
        )}
        {match.jornada_label && (
          <span className="vertigo-badge vertigo-badge-purple" style={{ padding: "8px 16px", fontSize: 12 }}>
            {match.jornada_label}
          </span>
        )}
        {match.scheduled_at_start && (
          <span className="text-xs text-[var(--vertigo-muted)] flex items-center gap-1">
            <Clock style={{ width: 12, height: 12 }} />
            {new Date(match.scheduled_at_start).toLocaleString("es-AR")}
          </span>
        )}
      </div>

      {/* Team cards */}
      <section className="mb-8">
        <div className="vertigo-subtitle">Equipos</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TeamCard
            label="Equipo A"
            team={teamA}
            isWinner={winnerA}
            score={match.score_a}
            ready={match.ready_a_at}
            readyLineup={match.ready_lineup_a_at}
          />
          <TeamCard
            label="Equipo B"
            team={teamB}
            isWinner={winnerB}
            score={match.score_b}
            ready={match.ready_b_at}
            readyLineup={match.ready_lineup_b_at}
          />
        </div>
      </section>

      {/* Acciones */}
      <section className="mb-8">
        <div className="vertigo-subtitle">Acciones</div>
        <div className="vertigo-card">
          <div className="vertigo-action-bar">
            {isScheduled && (
              <button className="vertigo-btn vertigo-btn-primary">
                <Play style={{ width: 14, height: 14 }} />
                Abrir partido
              </button>
            )}
            {!isFinished && !isScheduled && (
              <button className="vertigo-btn vertigo-btn-success">
                <CheckCircle2 style={{ width: 14, height: 14 }} />
                Marcar finalizado
              </button>
            )}
            {match.status !== "disputed" && (
              <Link href="/admin/disputas" className="vertigo-btn vertigo-btn-danger">
                <AlertTriangle style={{ width: 14, height: 14 }} />
                Ver disputas
              </Link>
            )}
            <button className="vertigo-btn vertigo-btn-ghost">
              <Pause style={{ width: 14, height: 14 }} />
              Pausar
            </button>
          </div>
          <p className="text-xs text-[var(--vertigo-faint)] mt-3">
            Las acciones avanzadas (sorteo, lineup, comodines) se ejecutan desde los paneles de cada capitán.
            Acá solo se supervisa y se marcan resultados manuales si hace falta.
          </p>
        </div>
      </section>

      {/* Resultado del sorteo */}
      {games.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Resultado del sorteo</div>
          <div className="flex flex-col gap-4">
            {games.map((g: any) => (
              <div key={g.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-3">
                    <span className="vertigo-badge vertigo-badge-purple">Partida {g.game_number}</span>
                    <span className={`vertigo-badge ${STATUS_META[g.status]?.cls ?? "vertigo-badge-purple"}`}>
                      {STATUS_META[g.status]?.label ?? g.status}
                    </span>
                  </div>
                  {g.draw?.commit_hash && (
                    <span className="font-mono text-[11px] text-[var(--vertigo-faint)]">
                      {g.draw.commit_hash.slice(0, 16)}…
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Modo</div>
                    <div className="vertigo-info-card-value text-sm">{g.game_mode ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Antimeta</div>
                    <div className="vertigo-info-card-value text-sm">{g.antimeta_mode ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Player mode</div>
                    <div className="vertigo-info-card-value text-sm">{g.player_mode ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Mapa</div>
                    <div className="vertigo-info-card-value text-sm">{g.map ?? "—"}</div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Draw status</div>
                    <div className="vertigo-info-card-value text-sm">{g.draw?.status ?? "—"}</div>
                  </div>
                </div>

                {(g.civs_a?.length > 0 || g.civs_b?.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-[var(--vertigo-line-soft)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">Civs Equipo A</div>
                      <div className="flex flex-wrap gap-1">
                        {(g.civs_a ?? []).map((c: string, i: number) => (
                          <span key={i} className="vertigo-badge vertigo-badge-purple">{c}</span>
                        ))}
                        {(!g.civs_a || g.civs_a.length === 0) && <span className="text-xs text-[var(--vertigo-faint)]">—</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">Civs Equipo B</div>
                      <div className="flex flex-wrap gap-1">
                        {(g.civs_b ?? []).map((c: string, i: number) => (
                          <span key={i} className="vertigo-badge vertigo-badge-purple">{c}</span>
                        ))}
                        {(!g.civs_b || g.civs_b.length === 0) && <span className="text-xs text-[var(--vertigo-faint)]">—</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lineups */}
      {games.length > 0 && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Lineups</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ label: "Equipo A", team: teamA, games }, { label: "Equipo B", team: teamB, games }].map(({ label, team, games }) => (
              <div key={label} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="font-cinzel text-base text-[var(--vertigo-text)]">
                    {team?.team_account?.name ?? label}
                  </div>
                  <Users style={{ width: 16, height: 16, color: "var(--vertigo-purple-soft)" }} />
                </div>
                {games.map((g: any, idx: number) => {
                  const lineup = idx === 0 ? g.lineup_a : g.lineup_b;
                  return (
                    <div key={g.id} className="mb-3 last:mb-0">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-1">
                        Partida {g.game_number}
                      </div>
                      {Array.isArray(lineup) && lineup.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {lineup.map((pid: string, i: number) => {
                            const player = team?.players?.find((p: any) => p.id === pid);
                            return (
                              <span key={i} className="vertigo-badge vertigo-badge-purple">
                                {player?.display_name ?? pid.slice(0, 8)}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--vertigo-faint)]">Sin lineup declarado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comodines usados */}
      <section className="mb-8">
        <div className="vertigo-subtitle">Comodines usados</div>
        {comodinUsages.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Sparkles className="mx-auto mb-3" style={{ width: 36, height: 36, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">Sin comodines</div>
              <p className="vertigo-empty-desc">Ninguno de los dos equipos usó comodines en esta llave todavía.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comodinUsages.map((c: any) => (
              <div key={c.id} className="vertigo-card">
                <div className="vertigo-card-header">
                  <div className="flex items-center gap-2">
                    <Sparkles style={{ width: 14, height: 14, color: "var(--vertigo-purple-soft)" }} />
                    <span className="font-cinzel text-sm text-[var(--vertigo-text)]">
                      {COMODIN_LABEL[c.comodin_type] ?? c.comodin_type}
                    </span>
                  </div>
                  <span className="vertigo-badge vertigo-badge-purple">{c.status}</span>
                </div>
                {c.target_phase && (
                  <div className="text-xs text-[var(--vertigo-muted)] mb-2">
                    Fase objetivo: <span className="text-[var(--vertigo-purple-pale)]">{c.target_phase}</span>
                  </div>
                )}
                {c.notes && (
                  <div className="text-xs text-[var(--vertigo-muted)]">{c.notes}</div>
                )}
                <div className="text-[11px] text-[var(--vertigo-faint)] mt-2">
                  Pedido: {new Date(c.requested_at).toLocaleString("es-AR")}
                  {c.executed_at && ` · Ejecutado: ${new Date(c.executed_at).toLocaleString("es-AR")}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Disputas */}
      {match.status === "disputed" && (
        <section className="mb-8">
          <div className="vertigo-subtitle">Disputa activa</div>
          <div className="vertigo-card">
            <div className="flex items-start gap-3">
              <AlertTriangle className="flex-none text-[var(--vertigo-danger)] mt-0.5" style={{ width: 18, height: 18 }} />
              <div>
                <div className="vertigo-card-title">Partido en disputa</div>
                <p className="text-sm text-[var(--vertigo-muted)] mt-2">
                  Este partido tiene una disputa abierta. Revisala desde el panel de disputas para ver evidencias y resolver.
                </p>
                <Link href="/admin/disputas" className="vertigo-btn vertigo-btn-danger mt-3">
                  <Shield style={{ width: 14, height: 14 }} />
                  Ir a disputas
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Resultado final */}
      {isFinished && (
        <section>
          <div className="vertigo-subtitle">Resultado final</div>
          <div className="vertigo-card">
            <div className="flex items-center gap-4">
              <Trophy style={{ width: 28, height: 28, color: "var(--vertigo-purple-pale)" }} strokeWidth={1.5} />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Ganador</div>
                <div className="font-cinzel text-xl text-[var(--vertigo-text)]">
                  {winnerA ? teamA?.team_account?.name : winnerB ? teamB?.team_account?.name : "—"}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Score</div>
                <div className="font-cinzel text-2xl text-[var(--vertigo-purple-pale)]">
                  {match.score_a} - {match.score_b}
                </div>
              </div>
            </div>
            {match.finished_at && (
              <div className="text-xs text-[var(--vertigo-faint)] mt-3 pt-3 border-t border-[var(--vertigo-line-soft)]">
                Finalizado: {new Date(match.finished_at).toLocaleString("es-AR")}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function TeamCard({
  label,
  team,
  isWinner,
  score,
  ready,
  readyLineup,
}: {
  label: string;
  team: any;
  isWinner: boolean;
  score: number;
  ready: string | null;
  readyLineup: string | null;
}) {
  const name = team?.team_account?.name ?? "—";
  const tagline = team?.team_account?.tagline;
  const players = team?.players ?? [];

  return (
    <div className={`vertigo-card ${isWinner ? "border-[var(--vertigo-purple)]" : ""}`}>
      <div className="vertigo-card-header">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex items-center justify-center rounded-full border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)] flex-none"
            style={{ width: 40, height: 40 }}
          >
            <Shield style={{ width: 18, height: 18 }} strokeWidth={1.25} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">{label}</div>
            <div className="font-cinzel text-base font-semibold text-[var(--vertigo-text)] truncate">
              {name}
            </div>
            {tagline && <div className="text-xs italic text-[var(--vertigo-muted)] truncate">&ldquo;{tagline}&rdquo;</div>}
          </div>
        </div>
        <div className="text-right flex-none">
          <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)]">Score</div>
          <div
            className="font-cinzel text-3xl font-bold"
            style={{ color: isWinner ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)" }}
          >
            {score}
          </div>
        </div>
      </div>

      {isWinner && (
        <div className="mb-3">
          <span className="vertigo-badge vertigo-badge-success">
            <Trophy style={{ width: 11, height: 11 }} />
            Ganador
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="vertigo-info-card">
          <div className="vertigo-info-card-label">READY #1</div>
          <div className="vertigo-info-card-value text-xs">
            {ready ? new Date(ready).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "—"}
          </div>
        </div>
        <div className="vertigo-info-card">
          <div className="vertigo-info-card-label">READY #2</div>
          <div className="vertigo-info-card-value text-xs">
            {readyLineup ? new Date(readyLineup).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "—"}
          </div>
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-[var(--vertigo-faint)] mb-2">Jugadores</div>
      <div className="flex flex-wrap gap-1">
        {players.map((p: any) => (
          <span key={p.id} className="vertigo-badge vertigo-badge-purple">
            {p.is_captain ? "★ " : ""}{p.display_name}
            {p.max_rating_rm_1v1 !== null && (
              <span className="text-[var(--vertigo-faint)] ml-1">{p.max_rating_rm_1v1}</span>
            )}
          </span>
        ))}
        {players.length === 0 && <span className="text-xs text-[var(--vertigo-faint)]">Sin jugadores</span>}
      </div>
    </div>
  );
}
