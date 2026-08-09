import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { CaptainHeader } from "@/components/captain/captain-header";
import { Dices, Ban, Target, UserPlus, Calendar, History, ArrowRight, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

// Defaults del schema (comodin_inventory): reroll=2, anular=1, elegir_rival=1, invocar_pro=1
const COMODINES_DEFAULT = [
  {
    type: "reroll",
    label: "Re-girar",
    desc: "Re-sortear una fase del resultado.",
    icon: Dices,
    defaultQty: 2,
  },
  {
    type: "anular",
    label: "Anular",
    desc: "Anular un jugador rival del lineup.",
    icon: Ban,
    defaultQty: 1,
  },
  {
    type: "elegir_rival",
    label: "Elegir rival",
    desc: "Elegir qué jugador rival enfrenta al tuyo.",
    icon: Target,
    defaultQty: 1,
  },
  {
    type: "invocar_pro",
    label: "Invocar PRO",
    desc: "Sustituir por un jugador PRO (solo finalistas).",
    icon: UserPlus,
    defaultQty: 1,
  },
];

export default async function MisPartidosPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Account + redirect por rol
  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account) redirect("/login");
  if (account.role === "admin" || account.role === "super_admin") redirect("/admin");
  if (account.role === "caster") redirect("/caster");

  // 2. Team account — para mostrar tag + buscar registration
  const { data: team } = (await supabase
    .from("team_account")
    .select("id, name, tagline")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) {
    return (
      <div className="vertigo-page vertigo-shell">
        <CaptainHeader active="partidos" />
        <main className="vertigo-content vertigo-scroll vertigo-fade-in">
          <span className="vertigo-kicker">CAPITÁN</span>
          <h1 className="vertigo-title">Mis partidos</h1>
          <div className="vertigo-divider"><span></span><i></i><span></span></div>
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Calendar className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">No tenés reino todavía</div>
              <p className="vertigo-empty-desc" style={{ marginBottom: "24px" }}>Inscribí tu reino para acceder a los partidos y comodines.</p>
              <Link href="/registro"><button className="vertigo-btn vertigo-btn-primary">Inscribir mi reino →</button></Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Registration — para vincular comodines y partidos
  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id, status, tournament_edition_id")
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  const latestReg = regs;

  // 4. Comodines — buscar inventario del equipo
  let comodinInventory: any = null;
  if (latestReg?.id) {
    const { data: inv } = (await supabase
      .from("comodin_inventory")
      .select("reroll_available, anular_available, elegir_rival_available, invocar_pro_available")
      .eq("team_registration_id", latestReg.id)
      .maybeSingle()) as { data: any };
    comodinInventory = inv;
  }

  // 5. Próximos partidos (scheduled, ready, in_progress)
  let upcomingMatches: any[] = [];
  if (latestReg?.id) {
    const { data: um } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, score_a, score_b, team_a_id, team_b_id")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .in("status", ["scheduled", "ready", "in_progress"])
      .order("scheduled_at_start", { ascending: true })
      .limit(10)) as { data: any };
    upcomingMatches = um ?? [];
  }

  // 6. Historial (finished)
  let pastMatches: any[] = [];
  if (latestReg?.id) {
    const { data: pm } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, jornada_label, format, score_a, score_b, winner_team_id, team_a_id, team_b_id, finished_at")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(10)) as { data: any };
    pastMatches = pm ?? [];
  }

  // Resolver nombres rivales
  const rivalIds = new Set<string>();
  for (const m of [...upcomingMatches, ...pastMatches]) {
    if (m.team_a_id && m.team_a_id !== latestReg?.id) rivalIds.add(m.team_a_id);
    if (m.team_b_id && m.team_b_id !== latestReg?.id) rivalIds.add(m.team_b_id);
  }
  const rivalNames: Record<string, string> = {};
  if (rivalIds.size > 0) {
    const { data: rivalTeams } = (await supabase
      .from("team_registration")
      .select("id, team_account:team_account_id (name)")
      .in("id", Array.from(rivalIds))) as { data: any };
    for (const r of rivalTeams ?? []) {
      rivalNames[r.id] = r.team_account?.name ?? "Rival";
    }
  }

  const comodinQty = (type: string): number => {
    if (!comodinInventory) return 0;
    switch (type) {
      case "reroll": return comodinInventory.reroll_available ?? 0;
      case "anular": return comodinInventory.anular_available ?? 0;
      case "elegir_rival": return comodinInventory.elegir_rival_available ?? 0;
      case "invocar_pro": return comodinInventory.invocar_pro_available ?? 0;
      default: return 0;
    }
  };

  return (
    <div className="vertigo-page vertigo-shell">
      <CaptainHeader active="partidos" teamTag={team.tagline ?? undefined} />

      <main className="vertigo-content vertigo-scroll vertigo-fade-in">
        <span className="vertigo-kicker">CAPITÁN</span>
        <h1 className="vertigo-title">Mis partidos</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Comodines disponibles, próximos enfrentamientos e historial del reino <strong className="text-[var(--vertigo-purple-pale)]">{team.name}</strong>.
        </p>

        {/* MIS COMODINES */}
        <section className="mb-8">
          <div className="vertigo-subtitle">
            <Dices style={{ width: 14, height: 14 }} />
            Mis comodines
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {COMODINES_DEFAULT.map((c) => {
              const qty = comodinQty(c.type);
              const Icon = c.icon;
              return (
                <div key={c.type} className="vertigo-info-card">
                  <div className="vertigo-info-card-label">
                    <Icon style={{ width: 12, height: 12, color: "var(--vertigo-purple-soft)" }} />
                    {c.label}
                  </div>
                  <div className="vertigo-info-card-value flex items-baseline gap-2">
                    <span className="font-[Cinzel,serif] text-[26px] font-bold leading-none text-[var(--vertigo-purple-pale)]">{qty}</span>
                    <span className="text-[11px] text-[var(--vertigo-faint)]">/ {c.defaultQty} disponibles</span>
                  </div>
                  <div className="text-[11px] text-[var(--vertigo-muted)] mt-2 leading-snug">{c.desc}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* PRÓXIMOS PARTIDOS */}
        <section className="mb-8">
          <div className="vertigo-subtitle">
            <Calendar style={{ width: 14, height: 14 }} />
            Próximos partidos
            {upcomingMatches.length > 0 && (
              <span className="vertigo-badge vertigo-badge-purple ml-1">{upcomingMatches.length}</span>
            )}
          </div>
          {upcomingMatches.length === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Calendar className="mx-auto mb-3" style={{ width: 36, height: 36, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin partidos programados</div>
                <p className="vertigo-empty-desc">
                  {latestReg?.status === "approved"
                    ? "Cuando el bracket esté generado, van a aparecer acá."
                    : "Tu inscripción está pendiente. Una vez aprobada, verás tus partidos acá."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {upcomingMatches.map((m) => {
                const isTeamA = m.team_a_id === latestReg?.id;
                const rivalId = isTeamA ? m.team_b_id : m.team_a_id;
                const rivalName = rivalId ? (rivalNames[rivalId] ?? "Rival") : "Por definir";
                const statusInfo = matchStatusInfo(m.status);
                return (
                  <div key={m.id} className="vertigo-card">
                    <div className="vertigo-card-header">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`vertigo-status ${statusInfo.cls}`}>
                          <span className="vertigo-status-dot" style={{ background: statusInfo.dot }} />
                          {statusInfo.label}
                        </span>
                        <span className="text-[11px] text-[var(--vertigo-faint)] tracking-[1.5px] uppercase">
                          {m.jornada_label ?? "Jornada"}
                        </span>
                      </div>
                      {m.format && (
                        <span className="vertigo-badge vertigo-badge-purple">{m.format}</span>
                      )}
                    </div>

                    {/* Rival y horario */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                      <div className="vertigo-info-card">
                        <div className="vertigo-info-card-label">Rival</div>
                        <div className="vertigo-info-card-value">{rivalName}</div>
                      </div>
                      <div className="vertigo-info-card">
                        <div className="vertigo-info-card-label">Horario</div>
                        <div className="vertigo-info-card-value">
                          {m.scheduled_at_start
                            ? new Date(m.scheduled_at_start).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })
                            : "A confirmar"}
                        </div>
                      </div>
                      <div className="vertigo-info-card">
                        <div className="vertigo-info-card-label">Formato</div>
                        <div className="vertigo-info-card-value">{m.format ?? "A decidir en partida 1"}</div>
                      </div>
                    </div>

                    {/* Botones de comodines */}
                    <div className="vertigo-action-bar">
                      <button className="vertigo-btn vertigo-btn-ghost" disabled>
                        <Dices style={{ width: 13, height: 13 }} />Re-girar
                      </button>
                      <button className="vertigo-btn vertigo-btn-ghost" disabled>
                        <Ban style={{ width: 13, height: 13 }} />Anular
                      </button>
                      <button className="vertigo-btn vertigo-btn-ghost" disabled>
                        <Target style={{ width: 13, height: 13 }} />Elegir rival
                      </button>
                      <Link href={`/partido/${m.id}`} className="vertigo-btn vertigo-btn-primary ml-auto">
                        Ver partido <ArrowRight style={{ width: 13, height: 13 }} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* HISTORIAL */}
        <section>
          <div className="vertigo-subtitle">
            <History style={{ width: 14, height: 14 }} />
            Historial
            {pastMatches.length > 0 && (
              <span className="vertigo-badge vertigo-badge-purple ml-1">{pastMatches.length}</span>
            )}
          </div>
          {pastMatches.length === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <History className="mx-auto mb-3" style={{ width: 36, height: 36, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin partidos jugados</div>
                <p className="vertigo-empty-desc">Tu historial de partidos finalizados aparecerá acá.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pastMatches.map((m) => {
                const isTeamA = m.team_a_id === latestReg?.id;
                const rivalId = isTeamA ? m.team_b_id : m.team_a_id;
                const rivalName = rivalId ? (rivalNames[rivalId] ?? "Rival") : "Rival";
                const ourScore = isTeamA ? m.score_a : m.score_b;
                const rivalScore = isTeamA ? m.score_b : m.score_a;
                const won = m.winner_team_id === latestReg?.id;
                return (
                  <Link key={m.id} href={`/partido/${m.id}`} className="vertigo-link-card">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`vertigo-badge ${won ? "vertigo-badge-success" : "vertigo-badge-danger"}`}>
                        {won ? "VICTORIA" : "DERROTA"}
                      </span>
                      {m.format && <span className="vertigo-badge vertigo-badge-purple">{m.format}</span>}
                    </div>
                    <div className="vertigo-link-card-title" style={{ fontSize: 14 }}>
                      vs {rivalName}
                    </div>
                    <div className="vertigo-link-card-desc flex items-center gap-3">
                      <span className="font-[Cinzel,serif] text-[18px] font-bold text-[var(--vertigo-purple-pale)]">
                        {ourScore} - {rivalScore}
                      </span>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock style={{ width: 11, height: 11 }} />
                        {m.finished_at ? new Date(m.finished_at).toLocaleDateString("es-AR") : "—"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function matchStatusInfo(status: string): { cls: string; label: string; dot: string } {
  switch (status) {
    case "in_progress":
      return { cls: "vertigo-badge-warning", label: "En curso", dot: "var(--vertigo-warning, #fbbf24)" };
    case "ready":
      return { cls: "vertigo-badge-success", label: "Listo", dot: "var(--vertigo-success)" };
    case "scheduled":
    default:
      return { cls: "vertigo-badge-purple", label: "Programado", dot: "var(--vertigo-purple)" };
  }
}
