import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EquiposPage() {
  const supabase = (await getSupabaseServer()) as any;

  // Buscar edición activa
  const { data: edition } = (await supabase
    .from("tournament_edition")
    .select("id, name")
    .eq("slug", "vertigo-2026-1")
    .single()) as { data: any };

  let teams: any[] = [];

  if (edition) {
    const { data: regs } = (await supabase
      .from("team_registration")
      .select(`
        id, seed, status, elo_freeze_snapshot,
        team_account:team_account_id (id, name, tagline, emblem_id)
      `)
      .eq("tournament_edition_id", edition.id)
      .eq("status", "approved")
      .order("seed", { ascending: true })
      .is("seed", "not.null")) as { data: any[] };

    teams = regs ?? [];
  }

  return (
    <main className="min-h-screen px-6 py-12 max-w-6xl mx-auto">
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <Link href="/" style={{ fontSize: "13px", color: "var(--vertigo-muted)", textDecoration: "none" }}>
          ← Volver al inicio
        </Link>
        <div style={{ marginTop: "12px" }}>
          <span style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", letterSpacing: "2px", textTransform: "uppercase" }}>
            {edition?.name ?? "VÉRTIGO Cup"}
          </span>
          <h1 style={{ fontSize: "36px", fontWeight: 700, marginTop: "4px", fontFamily: "Cinzel, serif" }}>
            Equipos inscriptos
          </h1>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px", marginTop: "8px" }}>
            {teams.length} de 32 equipos aprobados
          </p>
        </div>
      </div>

      {teams.length === 0 ? (
        <div style={{
          padding: "40px",
          background: "var(--vertigo-panel)",
          borderRadius: "12px",
          textAlign: "center",
          border: "1px solid var(--vertigo-line)",
        }}>
          <h2 style={{ fontSize: "20px", color: "var(--vertigo-text)", marginBottom: "8px" }}>
            Aún no hay equipos aprobados
          </h2>
          <p style={{ color: "var(--vertigo-muted)", fontSize: "14px" }}>
            Cuando el staff apruebe las inscripciones, los equipos aparecerán acá.
          </p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "16px",
        }}>
          {teams.map((reg) => {
            const team = reg.team_account;
            if (!team) return null;
            return (
              <Link
                key={reg.id}
                href={`/equipos/${reg.id}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "12px",
                  padding: "20px",
                  background: "var(--vertigo-panel)",
                  borderRadius: "12px",
                  border: "1px solid var(--vertigo-line)",
                  textDecoration: "none",
                  color: "var(--vertigo-text)",
                  transition: "transform 0.2s, border-color 0.2s",
                }}
                className="team-card-hover"
              >
                {/* Escudo */}
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "var(--vertigo-bg)",
                  border: "2px solid var(--vertigo-purple)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                  fontWeight: 700,
                  fontFamily: "Cinzel, serif",
                  color: "var(--vertigo-purple-soft)",
                }}>
                  {team.name?.charAt(0).toUpperCase() ?? "?"}
                </div>

                {/* Info */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", letterSpacing: "1px" }}>
                    SEED #{reg.seed ?? "—"}
                  </div>
                  <div style={{ fontSize: "15px", fontWeight: 700, marginTop: "4px" }}>
                    {team.name}
                  </div>
                  {team.tagline && (
                    <div style={{ fontSize: "11px", color: "var(--vertigo-muted)", fontStyle: "italic", marginTop: "2px" }}>
                      "{team.tagline}"
                    </div>
                  )}
                  <div style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", marginTop: "6px" }}>
                    ELO: {reg.elo_freeze_snapshot ?? "—"}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .team-card-hover:hover {
          transform: translateY(-2px);
          border-color: var(--vertigo-purple) !important;
        }
      `}</style>
    </main>
  );
}
