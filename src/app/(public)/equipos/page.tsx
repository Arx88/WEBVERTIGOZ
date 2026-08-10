import Link from "next/link";
import { Shield, Users } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface EquipoCardData {
  id: string;
  name: string;
  tagline?: string | null;
  emblemId?: string | null;
  seed?: number | null;
  eloTotal?: number | null;
  playerCount: number;
  editionName?: string | null;
}

async function fetchEquipos(): Promise<EquipoCardData[]> {
  try {
    const supabase = await getSupabaseServer();

    // Solo equipos aprobados
    const { data: regs } = (await supabase
      .from("team_registration")
      .select(
        "id, seed, elo_freeze_snapshot, team_account:team_account_id ( id, name, tagline, emblem_id ), tournament_edition:tournament_edition_id ( name )"
      )
      .eq("status", "approved")
      .order("seed", { ascending: true, nullsFirst: false })
      .limit(64)) as { data: any };

    if (!regs || regs.length === 0) return [];

    // Conteo de jugadores por inscripción
    const ids: string[] = regs.map((r: any) => r.id);
    const { data: players } = (await supabase
      .from("player_registration")
      .select("team_registration_id")
      .in("team_registration_id", ids)) as { data: any };

    const countByReg: Record<string, number> = {};
    for (const p of players ?? []) {
      const key = p.team_registration_id as string;
      countByReg[key] = (countByReg[key] ?? 0) + 1;
    }

    return regs.map((r: any) => ({
      id: r.id,
      name: r.team_account?.name ?? "—",
      tagline: r.team_account?.tagline ?? null,
      emblemId: r.team_account?.emblem_id ?? null,
      seed: r.seed ?? null,
      eloTotal: r.elo_freeze_snapshot ?? null,
      playerCount: countByReg[r.id] ?? 0,
      editionName: r.tournament_edition?.name ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function EquiposPage() {
  const equipos = await fetchEquipos();

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">EQUIPOS</span>
        </div>
        <div className="vertigo-header-right">
          <span className="vertigo-badge vertigo-badge-purple">
            {equipos.length} inscriptos
          </span>
        </div>
      </header>

      <main className="vertigo-content" style={{ maxWidth: "1200px", padding: "40px 32px" }}>
        <div className="vertigo-page-title">
          <span className="vertigo-kicker">EQUIPOS</span>
          <h1 className="vertigo-title">Equipos inscriptos</h1>
          <div className="vertigo-divider"><span></span><i></i><span></span></div>
          <p className="vertigo-desc">
            Grilla de reinos confirmados para la edición. Cada equipo tiene 3 jugadores y un pool
            de civilizaciones elegido al inscribirse.
          </p>
        </div>

        {equipos.length === 0 ? (
          <div className="vertigo-card premium">
            <div className="vertigo-empty">
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                <Shield style={{ width: 52, height: 52, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              </div>
              <div className="vertigo-empty-title">Sin equipos confirmados</div>
              <p className="vertigo-empty-desc">
                Las inscripciones se publican acá apenas son aprobadas por el staff.
                Volver a intentarlo más tarde.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "18px" }}>
            {equipos.map((eq) => (
              <Link
                key={eq.id}
                href={`/equipos/${eq.id}`}
                className="vertigo-link-card"
                style={{ padding: "24px" }}
              >
                {/* Header del equipo */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "20px" }}>
                  <div
                    style={{
                      flex: "none",
                      width: 56, height: 56,
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1.5px solid var(--vertigo-purple)",
                      background: "rgba(124,58,237,0.08)",
                      color: "var(--vertigo-purple-soft)",
                    }}
                  >
                    <Shield style={{ width: 24, height: 24 }} strokeWidth={1.25} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                      {eq.seed != null && (
                        <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: "10px", padding: "3px 10px" }}>
                          #{eq.seed}
                        </span>
                      )}
                      {eq.editionName && (
                        <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--vertigo-faint)" }}>
                          {eq.editionName}
                        </span>
                      )}
                    </div>
                    <div className="vertigo-link-card-title" style={{ marginBottom: "4px", fontSize: "17px" }}>{eq.name}</div>
                    {eq.tagline && (
                      <div className="vertigo-link-card-desc" style={{ fontStyle: "italic", fontSize: "13px" }}>
                        &ldquo;{eq.tagline}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", paddingTop: "18px", borderTop: "1px solid var(--vertigo-line-soft)" }}>
                  <div className="vertigo-info-card" style={{ padding: "14px 16px" }}>
                    <div className="vertigo-info-card-label" style={{ marginBottom: "2px" }}>ELO total</div>
                    <div className="vertigo-info-card-value" style={{ fontSize: "16px" }}>
                      {eq.eloTotal ? eq.eloTotal.toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="vertigo-info-card" style={{ padding: "14px 16px" }}>
                    <div className="vertigo-info-card-label" style={{ marginBottom: "2px" }}>Jugadores</div>
                    <div className="vertigo-info-card-value" style={{ fontSize: "16px" }}>{eq.playerCount} / 3</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
