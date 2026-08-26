import Link from "next/link";
import { Calendar, Clock, Radio, ChevronRight, Swords, Trophy } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import VertigoFooter from "@/components/shared/vertigo-footer";

export const dynamic = "force-dynamic";

interface FixtureMatch {
  id: string;
  status: string;
  scheduledAtStart: string | null;
  scheduledAtEnd: string | null;
  jornadaLabel: string | null;
  roundName: string | null;
  format: string | null;
  teamA: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  teamB: { id: string; name: string; seed: number | null; emblemUrl: string | null } | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Programado", cls: "vertigo-badge-purple" },
  open: { label: "Abierto", cls: "vertigo-badge-success" },
  drawing: { label: "Sorteando", cls: "vertigo-badge-warning" },
  lineup: { label: "Lineup", cls: "vertigo-badge-warning" },
  comodin_window: { label: "Comodines", cls: "vertigo-badge-warning" },
  in_progress: { label: "En juego", cls: "vertigo-badge-success" },
  finished: { label: "Finalizado", cls: "vertigo-badge-purple" },
  disputed: { label: "Disputa", cls: "vertigo-badge-danger" },
  forfeit: { label: "W.O.", cls: "vertigo-badge-danger" },
  cancelled: { label: "Cancelado", cls: "vertigo-badge-danger" },
};

/** Riel de color por estado (mismo lenguaje que las boletas de /apuestas) */
const STATUS_RAIL: Record<string, string> = {
  scheduled: "rgba(124,58,237,0.55)",
  open: "var(--vertigo-success)",
  drawing: "var(--vertigo-warning)",
  lineup: "var(--vertigo-warning)",
  comodin_window: "var(--vertigo-warning)",
  in_progress: "var(--vertigo-success)",
  finished: "rgba(124,58,237,0.9)",
  disputed: "var(--vertigo-danger)",
  forfeit: "var(--vertigo-danger)",
  cancelled: "var(--vertigo-danger)",
};

const LIVE_STATUSES = ["open", "drawing", "lineup", "comodin_window", "in_progress", "disputed"];

async function loadFixture(): Promise<FixtureMatch[]> {
  try {
    const supabase = await getSupabaseServer();

    const { data: matchesRaw } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, score_a, score_b, winner_team_id, team_a_id, team_b_id, round_id")
      .neq("status", "cancelled")
      .order("scheduled_at_start", { ascending: true, nullsFirst: false })
      .limit(120)) as { data: any };

    if (!matchesRaw || matchesRaw.length === 0) return [];

    // Round names
    const roundIds: string[] = matchesRaw.map((m: any) => m.round_id).filter(Boolean);
    let roundMap: Record<string, string> = {};
    if (roundIds.length > 0) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id, name")
        .in("id", roundIds)) as { data: any };
      for (const r of rounds ?? []) roundMap[r.id] = r.name;
    }

    // Team names
    const teamIds: string[] = [];
    for (const m of matchesRaw) {
      if (m.team_a_id) teamIds.push(m.team_a_id);
      if (m.team_b_id) teamIds.push(m.team_b_id);
    }
    let teamMap: Record<string, { name: string; seed: number | null; emblemUrl: string | null }> = {};
    if (teamIds.length > 0) {
      const { data: teams } = (await supabase
        .from("team_registration")
        .select("id, seed, team_account:team_account_id ( name, emblem:emblem_id ( image_url ) )")
        .in("id", teamIds)) as { data: any };
      for (const t of teams ?? []) {
        teamMap[t.id] = {
          name: t.team_account?.name ?? "—",
          seed: t.seed ?? null,
          emblemUrl: t.team_account?.emblem?.image_url ?? null,
        };
      }
    }

    return matchesRaw.map((m: any) => ({
      id: m.id,
      status: m.status,
      scheduledAtStart: m.scheduled_at_start ?? null,
      scheduledAtEnd: m.scheduled_at_end ?? null,
      jornadaLabel: m.jornada_label ?? null,
      roundName: m.round_id ? roundMap[m.round_id] ?? null : null,
      format: m.format ?? null,
      teamA: m.team_a_id
        ? { id: m.team_a_id, name: teamMap[m.team_a_id]?.name ?? "—", seed: teamMap[m.team_a_id]?.seed ?? null, emblemUrl: teamMap[m.team_a_id]?.emblemUrl ?? null }
        : null,
      teamB: m.team_b_id
        ? { id: m.team_b_id, name: teamMap[m.team_b_id]?.name ?? "—", seed: teamMap[m.team_b_id]?.seed ?? null, emblemUrl: teamMap[m.team_b_id]?.emblemUrl ?? null }
        : null,
      scoreA: m.score_a ?? 0,
      scoreB: m.score_b ?? 0,
      winnerTeamId: m.winner_team_id ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function FixturePage() {
  const matches = await loadFixture();

  // Agrupar por jornada label
  const groups: Record<string, FixtureMatch[]> = {};
  for (const m of matches) {
    const key = m.jornadaLabel ?? "Sin jornada";
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  }
  const groupKeys = Object.keys(groups).sort((a, b) => {
    if (a === "Sin jornada") return 1;
    if (b === "Sin jornada") return -1;
    return a.localeCompare(b, "es", { numeric: true });
  });

  const liveNow = matches.filter((m) => LIVE_STATUSES.includes(m.status)).length;

  // Próxima llave en el stream: primera programada/abierta con fecha vigente
  // (tolerancia de 90 min para no mostrar una que ya arrancó hace rato)
  const nowMs = Date.now();
  const nextUp =
    matches.find(
      (m) =>
        ["scheduled", "open"].includes(m.status) &&
        m.scheduledAtStart &&
        new Date(m.scheduledAtStart).getTime() >= nowMs - 90 * 60 * 1000
    ) ??
    matches.find((m) => LIVE_STATUSES.includes(m.status)) ??
    null;

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">FIXTURE</span>
        </div>
        <div className="vertigo-header-right">
          <Link href="/bracket" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Bracket
          </Link>
          <Link href="/resultados" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            Resultados
          </Link>
        </div>
      </header>

      <main className="vertigo-content" style={{ maxWidth: "none", padding: "40px 32px" }}>
        {/* ═══ HERO ═══ */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 18,
            border: "1px solid var(--vertigo-line-soft)",
            marginBottom: 28,
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div
            style={{
              position: "absolute", inset: 0,
              backgroundImage: "url('/landing/fondo-castillo.webp')",
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              opacity: 0.3,
              transform: "scale(1.04)",
            }}
          />
          <div
            style={{
              position: "absolute", inset: 0,
              background:
                "linear-gradient(180deg, rgba(7,3,16,0.35) 0%, rgba(7,3,16,0.78) 70%, rgba(7,3,16,0.94) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.55), transparent)",
            }}
          />
          <div
            style={{
              position: "relative", zIndex: 2, padding: "44px 40px 36px",
              display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <span className="vertigo-kicker">CALENDARIO · JORNADAS · VENTANAS DE STREAM</span>
            <h1
              className="vertigo-title"
              style={{
                fontSize: "clamp(30px, 4.6vw, 54px)",
                lineHeight: 0.95,
                margin: "6px 0 12px",
                textShadow: "0 4px 32px rgba(0,0,0,0.6)",
              }}
            >
              El camino, día por día
            </h1>
            <p className="vertigo-desc" style={{ maxWidth: 640, margin: 0, fontSize: 15 }}>
              Todas las llaves programadas, agrupadas por jornada. Sin partidas simultáneas:
              cada llave tiene su ventana de stream asignada.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <span className="vertigo-badge vertigo-badge-purple" style={{ padding: "7px 14px", fontSize: 11 }}>
                <Calendar style={{ width: 12, height: 12 }} />
                {matches.length} llaves
              </span>
              <span className="vertigo-badge vertigo-badge-warning" style={{ padding: "7px 14px", fontSize: 11 }}>
                <Swords style={{ width: 12, height: 12 }} />
                {groupKeys.length} jornada{groupKeys.length !== 1 ? "s" : ""}
              </span>
              {liveNow > 0 && (
                <span className="vertigo-badge vertigo-badge-success" style={{ padding: "7px 14px", fontSize: 11 }}>
                  <Radio style={{ width: 12, height: 12 }} />
                  {liveNow} en vivo
                </span>
              )}
              <Link
                href="/bracket"
                className="vertigo-btn vertigo-btn-ghost"
                style={{ padding: "6px 14px", fontSize: 11, marginLeft: "auto" }}
              >
                Ver el bracket
                <ChevronRight style={{ width: 12, height: 12 }} />
              </Link>
            </div>
            </div>

            {/* Próxima llave en el stream — anclada a la derecha del hero */}
            {nextUp && <NextUpCard m={nextUp} />}
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Calendar
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">No hay partidos programados</div>
              <p className="vertigo-empty-desc">
                El fixture se publica cuando el staff confirma el bracket y asigna las jornadas.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-10 mb-10">
            {groupKeys.map((key) => (
              <section key={key}>
                {/* Header editorial de jornada */}
                <div className="flex items-center gap-3 mb-4">
                  <h2
                    className="font-cinzel font-bold"
                    style={{ fontSize: 16, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--vertigo-text)" }}
                  >
                    {key}
                  </h2>
                  <div
                    className="flex-1 h-px"
                    style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.45), transparent)" }}
                  />
                  <span className="text-[10px] tracking-[1px]" style={{ color: "var(--vertigo-faint)" }}>
                    {rangoJornada(groups[key]) && <span className="uppercase">{rangoJornada(groups[key])} · </span>}
                    {groups[key].length} llave{groups[key].length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}
                >
                  {groups[key].map((m) => (
                    <FixtureMatchCard key={m.id} m={m} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <VertigoFooter />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tarjeta de llave del fixture — mini boleta con riel de estado
// ─────────────────────────────────────────────────────────────

function FixtureMatchCard({ m }: { m: FixtureMatch }) {
  const meta = STATUS_BADGE[m.status] ?? STATUS_BADGE.scheduled;
  const rail = STATUS_RAIL[m.status] ?? STATUS_RAIL.scheduled;
  const live = LIVE_STATUSES.includes(m.status);
  const decidido = m.status === "finished" || m.status === "disputed" || m.status === "forfeit";
  const showScore = decidido || m.scoreA > 0 || m.scoreB > 0;
  // Chip de día: solo HOY/MAÑANA — el resto de fechas ya se explican solas
  const diaChip = diaRelativo(m.scheduledAtStart);

  return (
    <Link
      href={`/partido/${m.id}`}
      className="fx-card relative group flex flex-col rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        textDecoration: "none",
        background: "linear-gradient(180deg, rgba(22,17,32,0.72), rgba(13,9,19,0.92))",
        border: "1px solid var(--vertigo-line-soft)",
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: rail }} aria-hidden />

      <div style={{ padding: "14px 16px 13px 19px" }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[9.5px] tracking-[1.5px] uppercase truncate" style={{ color: "var(--vertigo-faint)" }}>
            {m.roundName ?? "Llave"}
            {m.format && <span style={{ color: "var(--vertigo-purple-soft)" }}> · {m.format}</span>}
          </span>
          <span className={`vertigo-badge ${meta.cls}`} style={{ fontSize: 9, padding: "3px 8px", flex: "none" }}>
            {live && <span className="brk-pulse" />}
            {meta.label}
          </span>
        </div>

        <VersusTeams m={m} showScore={showScore} />

        <div
          className="flex items-center gap-2 mt-3 pt-3 text-[11px]"
          style={{ borderTop: "1px solid var(--vertigo-line-soft)", color: "var(--vertigo-faint)" }}
        >
          {m.scheduledAtStart ? (
            <>
              <Clock style={{ width: 11, height: 11, flex: "none" }} />
              {diaChip && (
                <span
                  className="flex-none"
                  style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    letterSpacing: 1.5,
                    color: "#0b0713",
                    background: "linear-gradient(90deg, #D4AF37, #f0d878)",
                    borderRadius: 999,
                    padding: "2px 7px",
                  }}
                >
                  {diaChip}
                </span>
              )}
              <span className="truncate">
                {new Date(m.scheduledAtStart).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {m.scheduledAtEnd &&
                  ` — ${new Date(m.scheduledAtEnd).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </>
          ) : (
            <span className="truncate">Fecha por confirmar</span>
          )}
          <ChevronRight
            className="ml-auto transition-transform group-hover:translate-x-0.5"
            style={{ width: 13, height: 13, color: "var(--vertigo-purple-soft)", flex: "none" }}
          />
        </div>
      </div>
    </Link>
  );
}

function FixtureTeamRow({
  name,
  seed,
  emblemUrl,
  score,
  isWinner,
  isLoser,
}: {
  name: string;
  seed: number | null;
  emblemUrl: string | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Escudo con aro: dorado si ganó */}
        <span
          className="flex-none rounded-full overflow-hidden flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            border: isWinner ? "1.5px solid rgba(212,175,55,0.7)" : "1px solid var(--vertigo-line)",
            boxShadow: isWinner ? "0 0 12px rgba(212,175,55,0.25)" : "none",
            background: "var(--vertigo-input-bg, #0e0a14)",
          }}
        >
          {emblemUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={emblemUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Trophy style={{ width: 14, height: 14, color: "var(--vertigo-faint)" }} strokeWidth={1.4} />
          )}
        </span>
        <div className="min-w-0">
          <div
            className="text-[13.5px] truncate leading-tight"
            style={{
              fontWeight: isWinner ? 700 : 500,
              color: isWinner ? "var(--vertigo-gold)" : isLoser ? "var(--vertigo-faint)" : "var(--vertigo-text)",
            }}
          >
            {name}
          </div>
          {seed != null && (
            <div className="text-[9px] font-bold uppercase mt-0.5" style={{ letterSpacing: 1.5, color: "var(--vertigo-faint)" }}>
              Seed #{seed}
            </div>
          )}
        </div>
      </div>
      {score != null && (
        <span
          className="font-cinzel font-bold tabular-nums flex-none"
          style={{ fontSize: 18, color: isWinner ? "var(--vertigo-gold)" : "var(--vertigo-faint)" }}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Cara a cara compartido: dos filas de equipo con sello VS al medio
// ─────────────────────────────────────────────────────────────

function VersusTeams({ m, showScore }: { m: FixtureMatch; showScore: boolean }) {
  const aWin = !!m.winnerTeamId && !!m.teamA && m.winnerTeamId === m.teamA.id;
  const bWin = !!m.winnerTeamId && !!m.teamB && m.winnerTeamId === m.teamB.id;

  return (
    <div className="flex flex-col gap-1.5">
      <FixtureTeamRow
        name={m.teamA?.name ?? "Por definir"}
        seed={m.teamA?.seed ?? null}
        emblemUrl={m.teamA?.emblemUrl ?? null}
        score={showScore ? m.scoreA : null}
        isWinner={aWin}
        isLoser={bWin}
      />
      {/* Sello VS sobre hairline — marca el cruce sin agregar ruido */}
      <div className="flex items-center gap-2.5" aria-hidden>
        <span className="flex-1 h-px" style={{ background: "var(--vertigo-line-soft)" }} />
        <span className="font-cinzel font-bold" style={{ fontSize: 8, letterSpacing: 3, color: "rgba(212,175,55,0.65)" }}>
          VS
        </span>
        <span className="flex-1 h-px" style={{ background: "var(--vertigo-line-soft)" }} />
      </div>
      <FixtureTeamRow
        name={m.teamB?.name ?? "Por definir"}
        seed={m.teamB?.seed ?? null}
        emblemUrl={m.teamB?.emblemUrl ?? null}
        score={showScore ? m.scoreB : null}
        isWinner={bWin}
        isLoser={aWin}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tiempo: chips HOY/MAÑANA y rango de fechas por jornada
// ─────────────────────────────────────────────────────────────

function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "HOY" / "MAÑANA" — cualquier otro día no necesita chip: la fecha ya lo dice. */
function diaRelativo(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (mismoDia(d, new Date())) return "HOY";
  if (mismoDia(d, new Date(Date.now() + 86_400_000))) return "MAÑANA";
  return null;
}

/** Rango de fechas de una jornada: "24 ago" o "22 ago – 29 ago"; "" si no hay fechas. */
function rangoJornada(ms: FixtureMatch[]): string {
  const ts = ms
    .map((m) => (m.scheduledAtStart ? new Date(m.scheduledAtStart).getTime() : null))
    .filter((t): t is number => t != null);
  if (ts.length === 0) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
  const min = new Date(Math.min(...ts));
  const max = new Date(Math.max(...ts));
  return mismoDia(min, max) ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

// ─────────────────────────────────────────────────────────────
// Próxima llave en el stream — tarjeta de vidrio con marco dorado
// anclada a la derecha del hero del fixture
// ─────────────────────────────────────────────────────────────

function NextUpCard({ m }: { m: FixtureMatch }) {
  const meta = STATUS_BADGE[m.status] ?? STATUS_BADGE.scheduled;
  const live = LIVE_STATUSES.includes(m.status);
  const decidido = m.status === "finished" || m.status === "disputed" || m.status === "forfeit";
  const showScore = decidido || m.scoreA > 0 || m.scoreB > 0;

  return (
    <Link
      href={`/partido/${m.id}`}
      className="fx-card relative group flex flex-col rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        flex: "0 1 330px",
        minWidth: 290,
        alignSelf: "flex-end",
        textDecoration: "none",
        background: "linear-gradient(160deg, rgba(30,22,46,0.82), rgba(13,9,19,0.94))",
        border: "1px solid rgba(212,175,55,0.35)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.55), 0 0 30px rgba(212,175,55,0.08)",
        backdropFilter: "blur(10px)",
      }}
    >
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: live ? "var(--vertigo-success)" : "rgba(212,175,55,0.8)" }}
        aria-hidden
      />
      <div style={{ padding: "16px 18px 15px 21px" }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className="inline-flex items-center gap-1.5"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "var(--vertigo-gold)" }}
          >
            <Radio style={{ width: 11, height: 11 }} className={live ? "brk-pulse" : undefined} />
            {live ? "AHORA EN EL STREAM" : "PRÓXIMA EN EL STREAM"}
          </span>
          <span className={`vertigo-badge ${meta.cls}`} style={{ fontSize: 9, padding: "3px 8px", flex: "none" }}>
            {meta.label}
          </span>
        </div>

        <VersusTeams m={m} showScore={showScore} />

        <div
          className="flex items-center gap-2 mt-3 pt-3 text-[11px]"
          style={{ borderTop: "1px solid rgba(212,175,55,0.18)", color: "var(--vertigo-muted)" }}
        >
          {m.scheduledAtStart ? (
            <>
              <Clock style={{ width: 11, height: 11, flex: "none", color: "var(--vertigo-gold)" }} />
              <span className="truncate">
                {new Date(m.scheduledAtStart).toLocaleString("es-AR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </>
          ) : (
            <span className="truncate">Fecha por confirmar</span>
          )}
          <span
            className="ml-auto inline-flex items-center gap-0.5 flex-none transition-transform group-hover:translate-x-0.5"
            style={{ color: "var(--vertigo-gold)", fontWeight: 700, fontSize: 10.5, letterSpacing: 1 }}
          >
            Abrir llave
            <ChevronRight style={{ width: 12, height: 12 }} />
          </span>
        </div>
      </div>
    </Link>
  );
}
