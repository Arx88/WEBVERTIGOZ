import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { Calendar, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FixturePage() {
  const supabase = (await getSupabaseServer()) as any;

  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  let matchesByJornada: Record<string, any[]> = {};

  if (edition) {
    const { data: bracket } = (await supabase
      .from("bracket")
      .select("id")
      .eq("tournament_edition_id", edition.id)
      .single()) as { data: any };

    if (bracket) {
      const { data: rounds } = (await supabase
        .from("round")
        .select("id, name, index")
        .eq("bracket_id", bracket.id)
        .order("index", { ascending: true })) as { data: any[] };

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map((r) => r.id);
        const { data: allMatches } = (await supabase
          .from("match")
          .select(`
            id, status, slot_index, scheduled_at_start, scheduled_at_end, jornada_label,
            team_a_id, team_b_id, score_a, score_b, winner_team_id,
            round:round_id (id, name, index)
          `)
          .in("round_id", roundIds)
          .order("scheduled_at_start", { ascending: true, nullsFirst: false })
          .order("slot_index", { ascending: true })) as { data: any[] };

        if (allMatches) {
          for (const m of allMatches) {
            const label = m.jornada_label ?? `Ronda ${m.round.index + 1}`;
            if (!matchesByJornada[label]) matchesByJornada[label] = [];
            matchesByJornada[label].push(m);
          }
        }
      }
    }
  }

  const jornadas = Object.entries(matchesByJornada);
  const totalMatches = jornadas.reduce((s, [, ms]) => s + ms.length, 0);

  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto">
      <div style={{ marginBottom: "32px" }}>
        <Link href="/" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al inicio
        </Link>
        <div style={{ marginTop: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "2px", textTransform: "uppercase" }}>
            {edition?.name ?? "VÉRTIGO Cup"}
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            Fixture
          </h1>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px", marginTop: "8px" }}>
            {totalMatches} partidos programados
          </p>
        </div>
      </div>

      {jornadas.length === 0 ? (
        <div style={{
          padding: "40px",
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          textAlign: "center",
          border: "1px solid var(--vertigo-line)",
        }}>
          <h2 style={{ fontSize: "20px", color: "var(--vertigo-text)", marginBottom: "8px" }}>
            Fixture no disponible
          </h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            El fixture se generará cuando se sortee el bracket.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {jornadas.map(([jornadaLabel, matches]) => (
            <section key={jornadaLabel}>
              <h2 style={{
                fontSize: "14px",
                color: "var(--vertigo-purple-soft)",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
                <Calendar size={16} />
                {jornadaLabel}
                <span style={{ fontSize: "11px", color: "var(--vertigo-muted)", fontWeight: 400 }}>
                  ({matches.length} partidos)
                </span>
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {matches.map((m) => {
                  const statusColors: Record<string, string> = {
                    scheduled: "#4A6FA5", open: "#22c55e", drawing: "#fbbf24",
                    lineup: "#a78bfa", comodin_window: "#fbbf24",
                    in_progress: "#ef4444", finished: "#22c55e",
                    disputed: "#ef4444", forfeit: "#6b7280", cancelled: "#6b7280",
                  };
                  const color = statusColors[m.status] ?? "#6b7280";
                  return (
                    <Link
                      key={m.id}
                      href={`/partido/${m.id}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "var(--vertigo-panel)",
                        borderRadius: "10px",
                        border: `1px solid ${color}44`,
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <span style={{
                          fontSize: "10px",
                          padding: "3px 8px",
                          background: `${color}22`,
                          color: color,
                          borderRadius: "999px",
                          fontWeight: 700,
                        }}>
                          {m.status.toUpperCase()}
                        </span>
                        <div>
                          <div style={{ fontSize: "13px", color: "var(--vertigo-text)" }}>
                            {m.round?.name} · Match #{m.slot_index + 1}
                          </div>
                          {m.scheduled_at_start && (
                            <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={10} />
                              {new Date(m.scheduled_at_start).toLocaleString("es-AR", {
                                weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--vertigo-muted)" }}>
                        {(m.score_a > 0 || m.score_b > 0 || m.status === "finished") ? (
                          <strong style={{ color: "var(--vertigo-text)" }}>{m.score_a}-{m.score_b}</strong>
                        ) : "Ver →"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
