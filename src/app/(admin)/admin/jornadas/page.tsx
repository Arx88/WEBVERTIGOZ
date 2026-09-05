import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import AdminHero from "@/components/shared/admin-hero";
import JornadasManager from "./jornadas-manager";

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
      winner_team_id, ready_a_at, ready_b_at,
      round:round_id (name, index),
      team_a:team_a_id (id, seed, team_account:team_account_id (name, emblem:emblem_id (image_url))),
      team_b:team_b_id (id, seed, team_account:team_account_id (name, emblem:emblem_id (image_url)))
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

  // Orden de jornadas (estable, por primer horario)
  const order: string[] = [];
  for (const m of matches ?? []) {
    const key = m.jornada_label ?? "Sin jornada";
    if (!order.includes(key)) order.push(key);
  }

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
        compact
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
            <Calendar className="mx-auto mb-4" style={{ width: 44, height: 44, color: "var(--vertigo-faint)" }} strokeWidth={1} />
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
        <JornadasManager matches={(matches ?? []) as any[]} order={order} meta={STATUS_META} />
      )}
    </div>
  );
}
