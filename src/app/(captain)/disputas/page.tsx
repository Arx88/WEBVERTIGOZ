import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import SiteNav from "@/components/nav/site-nav";
import { AlertTriangle, Shield, Clock, FileText, ArrowRight } from "lucide-react";
import { createDisputeAction } from "@/server/actions/disputes";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

const DISPUTE_WINDOW_MINUTES = 30;

export default async function DisputasPage() {
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

  // 2. Team account
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
        <SiteNav />
        <main className="vertigo-content vertigo-scroll vertigo-fade-in">
          <span className="vertigo-kicker">CAPITÁN</span>
          <h1 className="vertigo-title">Disputas</h1>
          <div className="vertigo-divider"><span></span><i></i><span></span></div>
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Shield className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">No tenés reino todavía</div>
              <p className="vertigo-empty-desc" style={{ marginBottom: "24px" }}>Inscribí tu reino para poder abrir disputas sobre tus partidos.</p>
              <Link href="/registro"><button className="vertigo-btn vertigo-btn-primary">Inscribir mi reino →</button></Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 3. Registration
  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id, status, tournament_edition_id")
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  const latestReg = regs;

  // 4. Partidos finalizados recientes (candidatos a disputa)
  const windowStart = new Date(Date.now() - DISPUTE_WINDOW_MINUTES * 60 * 1000).toISOString();
  let disputableMatches: any[] = [];
  let rivalNames: Record<string, string> = {};

  if (latestReg?.id) {
    const { data: fm } = (await supabase
      .from("match")
      .select("id, status, finished_at, scheduled_at_start, jornada_label, format, score_a, score_b, winner_team_id, team_a_id, team_b_id")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .eq("status", "finished")
      .gte("finished_at", windowStart)
      .order("finished_at", { ascending: false })
      .limit(10)) as { data: any };
    disputableMatches = fm ?? [];

    // Resolver nombres rivales
    const rivalIds = new Set<string>();
    for (const m of disputableMatches) {
      if (m.team_a_id && m.team_a_id !== latestReg.id) rivalIds.add(m.team_a_id);
      if (m.team_b_id && m.team_b_id !== latestReg.id) rivalIds.add(m.team_b_id);
    }
    if (rivalIds.size > 0) {
      const { data: rivalTeams } = (await supabase
        .from("team_registration")
        .select("id, team_account:team_account_id (name)")
        .in("id", Array.from(rivalIds))) as { data: any };
      for (const r of rivalTeams ?? []) {
        rivalNames[r.id] = r.team_account?.name ?? "Rival";
      }
    }
  }

  // 5. Disputas existentes del equipo
  let existingDisputes: any[] = [];
  if (latestReg?.id) {
    const { data: ds } = (await supabase
      .from("dispute")
      .select("id, reason, status, resolution_notes, created_at, resolved_at, match_id")
      .eq("raised_by_team_id", latestReg.id)
      .order("created_at", { ascending: false })
      .limit(20)) as { data: any };
    existingDisputes = ds ?? [];
  }

  return (
    <div className="vertigo-page vertigo-shell">
      <SiteNav />

      <main className="vertigo-content vertigo-scroll vertigo-fade-in">
        <span className="vertigo-kicker">CAPITÁN</span>
        <h1 className="vertigo-title">Disputas</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Abrí un reclamo sobre un partido finalizado. Tenés una ventana de {DISPUTE_WINDOW_MINUTES} minutos post-finalización.
        </p>

        {/* BANNER WARNING */}
        <div className="vertigo-card mb-8" style={{ borderColor: "rgba(251, 191, 36, 0.35)", background: "rgba(251, 191, 36, 0.04)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle style={{ width: 20, height: 20, color: "#fbbf24", flex: "none", marginTop: 2 }} />
            <div>
              <div className="text-[13px] font-semibold text-[#fbbf24] tracking-[1px] uppercase mb-1">Antes de abrir una disputa</div>
              <p className="text-[13px] text-[var(--vertigo-muted)] leading-relaxed">
                Las disputas son revisadas por un Super Admin. Incluí toda la evidencia necesaria (screenshots, replays, timestamps).
                El abuso del sistema de disputas puede resultar en sanciones. La ventana para reclamar es de {DISPUTE_WINDOW_MINUTES} minutos
                posterior a la finalización del partido.
              </p>
            </div>
          </div>
        </div>

        {/* ABRIR NUEVA DISPUTA */}
        <section className="mb-8">
          <div className="vertigo-subtitle">
            <FileText style={{ width: 14, height: 14 }} />
            Abrir nueva disputa
            {disputableMatches.length > 0 && (
              <span className="vertigo-badge vertigo-badge-warning ml-1">{disputableMatches.length}</span>
            )}
          </div>
          {disputableMatches.length === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Clock className="mx-auto mb-3" style={{ width: 36, height: 36, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin partidos disputables</div>
                <p className="vertigo-empty-desc">
                  No tenés partidos finalizados dentro de la ventana de {DISPUTE_WINDOW_MINUTES} minutos. Cuando finalice un partido,
                  aparecerá acá para que puedas abrir una disputa.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {disputableMatches.map((m) => {
                const isTeamA = m.team_a_id === latestReg?.id;
                const rivalId = isTeamA ? m.team_b_id : m.team_a_id;
                const rivalName = rivalId ? (rivalNames[rivalId] ?? "Rival") : "—";
                const ourScore = isTeamA ? m.score_a : m.score_b;
                const rivalScore = isTeamA ? m.score_b : m.score_a;
                const won = m.winner_team_id === latestReg?.id;
                const finishedAt = m.finished_at ? new Date(m.finished_at) : null;
                const minutesLeft = finishedAt
                  ? Math.max(0, DISPUTE_WINDOW_MINUTES - Math.floor((Date.now() - finishedAt.getTime()) / 60000))
                  : 0;
                return (
                  <div key={m.id} className="vertigo-card">
                    <div className="vertigo-card-header">
                      <div className="flex items-center gap-3 min-w-0 flex-wrap">
                        <span className={`vertigo-badge ${won ? "vertigo-badge-success" : "vertigo-badge-danger"}`}>
                          {won ? "VICTORIA" : "DERROTA"}
                        </span>
                        <span className="text-[14px] font-semibold text-[var(--vertigo-text)]">
                          vs {rivalName}
                        </span>
                        <span className="font-[Cinzel,serif] text-[16px] font-bold text-[var(--vertigo-purple-pale)]">
                          {ourScore} - {rivalScore}
                        </span>
                        {m.format && <span className="vertigo-badge vertigo-badge-purple">{m.format}</span>}
                      </div>
                      <span className={`vertigo-status ${minutesLeft > 5 ? "vertigo-badge-warning" : "vertigo-badge-danger"}`}>
                        <Clock style={{ width: 11, height: 11 }} />
                        {minutesLeft} min restantes
                      </span>
                    </div>

                    {/* Formulario */}
                    <form action={createDisputeAction} className="flex flex-col gap-4">
                      <input type="hidden" name="matchId" value={m.id} />
                      <input type="hidden" name="teamRegistrationId" value={latestReg?.id ?? ""} />

                      <div className="vertigo-field" style={{ maxWidth: "none", marginBottom: 0 }}>
                        <label htmlFor={`reason-${m.id}`}>Motivo del reclamo</label>
                        <textarea
                          id={`reason-${m.id}`}
                          name="reason"
                          required
                          rows={3}
                          placeholder="Describí el incidente con el mayor detalle posible: jugada, minuto, jugadores involucrados..."
                          style={{ height: "auto", padding: "12px 16px", resize: "vertical", minHeight: 96 }}
                        />
                      </div>

                      <div className="vertigo-field" style={{ maxWidth: "none", marginBottom: 0 }}>
                        <label htmlFor={`evidence-${m.id}`}>Evidencia (URLs, una por línea)</label>
                        <textarea
                          id={`evidence-${m.id}`}
                          name="evidenceUrls"
                          rows={2}
                          placeholder="https://imgur.com/...&#10;https://youtube.com/..."
                          style={{ height: "auto", padding: "12px 16px", resize: "vertical", minHeight: 64 }}
                        />
                      </div>

                      <div className="vertigo-action-bar">
                        <button type="submit" className="vertigo-btn" style={{ background: "linear-gradient(180deg, #b45309, #92400e)", color: "#fff", padding: "13px 24px" }}>
                          <AlertTriangle style={{ width: 13, height: 13 }} />
                          Abrir disputa
                        </button>
                        <Link href={`/partido/${m.id}`} className="vertigo-btn vertigo-btn-ghost ml-auto">
                          Ver partido <ArrowRight style={{ width: 13, height: 13 }} />
                        </Link>
                      </div>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* MIS DISPUTAS */}
        <section>
          <div className="vertigo-subtitle">
            <Shield style={{ width: 14, height: 14 }} />
            Mis disputas
            {existingDisputes.length > 0 && (
              <span className="vertigo-badge vertigo-badge-purple ml-1">{existingDisputes.length}</span>
            )}
          </div>
          {existingDisputes.length === 0 ? (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Shield className="mx-auto mb-3" style={{ width: 36, height: 36, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin disputas abiertas</div>
                <p className="vertigo-empty-desc">Tus disputas previas aparecerán acá con su estado actual.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {existingDisputes.map((d) => {
                const info = disputeStatusInfo(d.status);
                return (
                  <div key={d.id} className="vertigo-card">
                    <div className="vertigo-card-header">
                      <div className="flex items-center gap-3 min-w-0 flex-wrap">
                        <span className={`vertigo-status ${info.cls}`}>
                          <span className="vertigo-status-dot" style={{ background: info.dot }} />
                          {info.label}
                        </span>
                        <span className="text-[11px] text-[var(--vertigo-faint)] tracking-[1.5px] uppercase flex items-center gap-1">
                          <Clock style={{ width: 11, height: 11 }} />
                          {fmt.dateTimeMedium(d.created_at)}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--vertigo-faint)]">#{d.id.slice(0, 8)}</span>
                    </div>
                    <p className="text-[13px] text-[var(--vertigo-text)] leading-relaxed mb-2">{d.reason}</p>
                    {d.resolution_notes && (
                      <div className="mt-3 p-3 rounded-[8px] border border-[var(--vertigo-line-soft)] bg-[var(--vertigo-input-bg)]">
                        <div className="text-[10px] text-[var(--vertigo-faint)] tracking-[1.5px] uppercase mb-1">Resolución del Super Admin</div>
                        <p className="text-[12px] text-[var(--vertigo-muted)] leading-relaxed">{d.resolution_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function disputeStatusInfo(status: string): { cls: string; label: string; dot: string } {
  switch (status) {
    case "open":
      return { cls: "vertigo-badge-warning", label: "Abierta", dot: "#fbbf24" };
    case "reviewing":
      return { cls: "vertigo-badge-purple", label: "En revisión", dot: "var(--vertigo-purple)" };
    case "resolved":
      return { cls: "vertigo-badge-success", label: "Resuelta", dot: "var(--vertigo-success)" };
    case "rejected":
      return { cls: "vertigo-badge-danger", label: "Rechazada", dot: "var(--vertigo-danger)" };
    default:
      return { cls: "vertigo-badge-purple", label: status, dot: "var(--vertigo-purple)" };
  }
}
