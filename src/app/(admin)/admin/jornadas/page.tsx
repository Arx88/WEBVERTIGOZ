import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Clock, AlertCircle, ChevronRight } from "lucide-react";

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
      id, status, scheduled_at_start, scheduled_at_end, jornada_label, format,
      round:round_id (name),
      team_a:team_a_id (id),
      team_b:team_b_id (id)
    `)
    .order("scheduled_at_start", { ascending: true, nullsFirst: false })
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
      <span className="vertigo-kicker">JORNADAS</span>
      <h1 className="vertigo-title">Programación de partidos</h1>
      <div className="vertigo-divider"><span></span><i></i><span></span></div>
      <p className="vertigo-desc">
        Asigná fecha y hora a cada partido. Sin partidas simultáneas — el torneo se streama de a una llave por vez.
      </p>

      <div className="vertigo-stats">
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Total partidos</div>
          <div className="vertigo-stat-value">{total}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Programados</div>
          <div className="vertigo-stat-value text-[var(--vertigo-purple-pale)]">{scheduled}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">En juego</div>
          <div className="vertigo-stat-value text-[#fbbf24]">{inProgress}</div>
        </div>
        <div className="vertigo-stat">
          <div className="vertigo-stat-label">Finalizados</div>
          <div className="vertigo-stat-value text-[var(--vertigo-success)]">{finished}</div>
        </div>
      </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {jMatches.map((m: any) => {
                  const meta = STATUS_META[m.status] ?? STATUS_META.scheduled;
                  return (
                    <Link key={m.id} href={`/admin/partido/${m.id}`} className="vertigo-link-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`vertigo-badge ${meta.cls}`}>
                          <span className="vertigo-status-dot" style={{ background: meta.dot }} />
                          {meta.label}
                        </span>
                        {m.format && (
                          <span className="vertigo-badge vertigo-badge-purple">{m.format}</span>
                        )}
                      </div>
                      <div className="font-cinzel text-sm text-[var(--vertigo-text)] mb-2">
                        {m.round?.name ?? "Ronda"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--vertigo-muted)]">
                        <Clock style={{ width: 12, height: 12 }} />
                        {m.scheduled_at_start
                          ? new Date(m.scheduled_at_start).toLocaleString("es-AR", {
                              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                            })
                          : "Sin programar"}
                      </div>
                    </Link>
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
