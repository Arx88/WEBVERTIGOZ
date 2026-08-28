import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { scheduleMatchFormAction } from "@/server/actions/tournament";
import { Calendar, Clock, AlertCircle, ChevronRight, Save } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import VertigoDateTime from "@/components/admin/vertigo-date-time";
import LocalTime from "@/components/shared/local-time";

export const dynamic = "force-dynamic";

export default async function AdminJornadasPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account").select("id, role").eq("supabase_auth_id", user.id).single()) as { data: any };
  if (!account || !["admin", "super_admin"].includes(account.role)) redirect("/mi-equipo");

  const { data: matches } = (await supabase
    .from("match")
    .select(`
      id, status, scheduled_at_start, scheduled_at_end, jornada_label, format, slot_index,
      round:round_id (name, index),
      team_a:team_a_id (id, seed, team_account:team_account_id (name)),
      team_b:team_b_id (id, seed, team_account:team_account_id (name))
    `)
    .order("scheduled_at_start", { ascending: true, nullsFirst: false })
    .order("slot_index", { ascending: true })
    .limit(100)) as { data: any };

  const total = matches?.length ?? 0;
  const scheduled = matches?.filter((m: any) => m.status === "scheduled").length ?? 0;
  const inProgress = matches?.filter((m: any) =>
    ["open", "drawing", "lineup", "comodin_window", "in_progress"].includes(m.status)
  ).length ?? 0;
  const finished = matches?.filter((m: any) => ["finished", "forfeit"].includes(m.status)).length ?? 0;

  // Group by jornada_label
  const jornadas = new Map<string, any[]>();
  (matches ?? []).forEach((m: any) => {
    const key = m.jornada_label ?? "Sin jornada";
    if (!jornadas.has(key)) jornadas.set(key, []);
    jornadas.get(key)!.push(m);
  });

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

  return (
    <div className="vertigo-fade-in">
      <AdminHero
        kicker="JORNADAS"
        title="Programación de partidos"
        desc="Asigná fecha y hora a cada partido. Sin partidas simultáneas — el torneo se streama de a una llave por vez."
        stats={[
          { value: total, label: "Total partidos" },
          { value: scheduled, label: "Programados", color: "var(--vertigo-purple-pale)" },
          { value: inProgress, label: "En juego", color: "#fbbf24" },
          { value: finished, label: "Finalizados", color: "var(--vertigo-success)" },
        ]}
      />

      {total === 0 ? (
        <div className="vertigo-card">
          <div className="vertigo-empty">
            <Calendar className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
            <div className="vertigo-empty-title">Sin partidos programados</div>
            <p className="vertigo-empty-desc">
              El scheduler estará disponible cuando el bracket esté generado.
              Mientras tanto, generá el bracket desde la sección correspondiente.
            </p>
            <Link href="/admin/bracket" className="vertigo-btn vertigo-btn-primary mt-6">
              Ir a bracket
              <ChevronRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from(jornadas.entries()).map(([label, jMatches]) => (
            <section key={label}>
              <div className="vertigo-subtitle">
                {label}
                <span className="vertigo-badge vertigo-badge-purple ml-2">{jMatches.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {jMatches.map((m: any) => {
                  const meta = STATUS_META[m.status] ?? STATUS_META.scheduled;
                  const teamAName = m.team_a?.team_account?.name ?? "Por definir";
                  const teamBName = m.team_b?.team_account?.name ?? "Por definir";
                  const startLocal = m.scheduled_at_start ? toLocalInput(m.scheduled_at_start) : "";
                  const editable = m.status === "scheduled";
                  return (
                    <div key={m.id} className="vertigo-card" style={{ padding: 20 }}>
                      {/* Header */}
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`vertigo-badge ${meta.cls}`}>
                            <span className="vertigo-status-dot" style={{ background: meta.dot }} />
                            {meta.label}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest text-[var(--vertigo-faint)]">
                            {m.round?.name ?? "Ronda"} · slot {m.slot_index}
                          </span>
                          {m.format && (
                            <span className="vertigo-badge vertigo-badge-purple">{m.format}</span>
                          )}
                        </div>
                        <Link href={`/admin/partido/${m.id}`} className="vertigo-btn vertigo-btn-ghost" style={{ padding: "7px 14px", fontSize: 10 }}>
                          Abrir llave <ChevronRight style={{ width: 12, height: 12 }} />
                        </Link>
                      </div>

                      {/* Equipos */}
                      <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
                        <span className="font-cinzel text-sm text-[var(--vertigo-text)]">
                          {m.team_a?.seed != null ? `#${m.team_a.seed} ` : ""}{teamAName}
                        </span>
                        <span className="text-[var(--vertigo-faint)] text-xs uppercase tracking-widest">vs</span>
                        <span className="font-cinzel text-sm text-[var(--vertigo-text)]">
                          {m.team_b?.seed != null ? `#${m.team_b.seed} ` : ""}{teamBName}
                        </span>
                      </div>

                      {/* Programación actual + edición */}
                      <div className="flex items-center gap-3 mb-4 text-xs text-[var(--vertigo-muted)] flex-wrap">
                        <Clock style={{ width: 13, height: 13 }} />
                        {m.scheduled_at_start
                          ? <LocalTime value={m.scheduled_at_start} variant="dayMonTime" />
                          : "Sin programar"}
                        {m.jornada_label && (
                          <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: 9 }}>{m.jornada_label}</span>
                        )}
                      </div>

                      {editable ? (
                        <form action={scheduleMatchFormAction} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end pt-4 border-t border-[var(--vertigo-line-soft)]">
                          <input type="hidden" name="match_id" value={m.id} />
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Inicio</label>
                            <VertigoDateTime name="scheduled_at_start" defaultValue={startLocal} required />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] uppercase tracking-widest text-[var(--vertigo-faint)]">Jornada</label>
                            <input type="text" name="jornada_label" defaultValue={m.jornada_label ?? ""} placeholder="Jornada 1"
                              className="bg-[var(--vertigo-input-bg)] border border-[var(--vertigo-input-border)] rounded-md px-3 py-2 text-[13px] text-[var(--vertigo-text)] w-32" />
                          </div>
                          <button type="submit" className="vertigo-btn vertigo-btn-primary" style={{ padding: "9px 18px", fontSize: 10 }}>
                            <Save style={{ width: 13, height: 13 }} /> Guardar
                          </button>
                        </form>
                      ) : (
                        <div className="pt-4 border-t border-[var(--vertigo-line-soft)] text-[11px] text-[var(--vertigo-faint)] italic">
                          Solo se puede reprogramar un partido en estado "Programado".
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="vertigo-card mt-8">
        <div className="flex items-start gap-3">
          <AlertCircle className="flex-none text-[var(--vertigo-purple-soft)] mt-0.5" style={{ width: 18, height: 18 }} />
          <div>
            <div className="vertigo-card-title">Recordatorio</div>
            <p className="text-sm text-[var(--vertigo-muted)] mt-2 leading-relaxed">
              El torneo se streama de a una partida a la vez. Al programar jornadas, dejá al menos 2 horas
              entre partidos del mismo stream. Las jornadas se generan automáticamente al crear el bracket.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Convierte una fecha ISO (UTC) al valor que espera <input type="datetime-local">
 * (formato "YYYY-MM-DDTHH:mm" en hora local del navegador que renderiza el input).
 * Como esto corre server-side, usamos la hora UTC directamente: el admin
 * verá/edita en UTC. Lo documentamos en el label del campo.
 */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
