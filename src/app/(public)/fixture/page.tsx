import Link from "next/link";
import { Calendar, Clock, Radio, ChevronRight, Swords } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import VertigoFooter from "@/components/shared/vertigo-footer";
import SiteNav from "@/components/nav/site-nav";
import LocalTime from "@/components/shared/local-time";
import {
  STATUS_BADGE,
  LIVE_STATUSES,
  mismoDia,
  type FixtureMatch,
} from "@/components/fixture/fixture-shared";
import { FixtureMatchCard, VersusTeams } from "@/components/fixture/fixture-match-card";

export const dynamic = "force-dynamic";

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

  // La jornada que contiene la próxima llave recibe el tratamiento épico
  const nextKey = nextUp ? (nextUp.jornadaLabel ?? "Sin jornada") : null;

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <SiteNav />

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
          {/* Fondo: video de marca en loop (el mismo del hero de Mi Reino) */}
          <video
            autoPlay
            muted
            loop
            playsInline
            src="/landing/mi-reino-hero.mp4"
            poster="/landing/fondo-castillo.webp"
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
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
            {groupKeys.map((key) => {
              const epic = key === nextKey;
              const isSinJornada = key === "Sin jornada";
              const rango = rangoJornada(groups[key]);

              const grid = (
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}
                >
                  {groups[key].map((m, i) => (
                    <FixtureMatchCard key={m.id} m={m} epic={epic} hoverVideo={isSinJornada} index={i} />
                  ))}
                </div>
              );

              if (!epic) {
                return (
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
                        {rango && <span className="uppercase">{rango} · </span>}
                        {groups[key].length} llave{groups[key].length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {grid}
                  </section>
                );
              }

              // ═══ PRÓXIMA JORNADA — treatment épico y cinematográfico ═══
              return (
                <section key={key} className="fxt-epic">
                  <span className="fxt-epic-glow" aria-hidden />
                  <span className="fxt-epic-rays" aria-hidden />
                  <span className="fxt-dots" aria-hidden>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <i
                        key={i}
                        style={{
                          left: `${6 + i * 11}%`,
                          animationDelay: `${(i * 1.1).toFixed(1)}s`,
                          animationDuration: `${7 + (i % 3) * 2.5}s`,
                        }}
                      />
                    ))}
                  </span>

                  <div className="relative" style={{ zIndex: 2 }}>
                    <div className="flex items-end justify-between gap-4 flex-wrap">
                      <div>
                        <span className="fxt-kicker">PROXIMA JORNADA</span>
                        <h2
                          className="font-cinzel font-bold"
                          style={{
                            fontSize: "clamp(22px, 3vw, 32px)",
                            letterSpacing: 2.5,
                            textTransform: "uppercase",
                            lineHeight: 1.05,
                            margin: "4px 0 0",
                            color: "var(--vertigo-gold)",
                            textShadow: "0 2px 28px rgba(212,175,55,0.3)",
                          }}
                        >
                          {key}
                        </h2>
                      </div>
                      <span
                        className="text-[10px] tracking-[1.5px] uppercase"
                        style={{ color: "rgba(244,220,138,0.75)", fontWeight: 700 }}
                      >
                        {rango && <span>{rango} · </span>}
                        {groups[key].length} llave{groups[key].length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="fxt-epic-line" aria-hidden />

                  <div className="relative" style={{ zIndex: 2 }}>
                    {grid}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <VertigoFooter />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tiempo: chips HOY/MAÑANA y rango de fechas por jornada
// ─────────────────────────────────────────────────────────────

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
                <LocalTime value={m.scheduledAtStart} variant="weekdayShortTime" />
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
