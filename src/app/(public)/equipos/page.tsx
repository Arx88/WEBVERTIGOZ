import Link from "next/link";
import { Shield, Users } from "lucide-react";
import { getSupabaseServer } from "@/lib/supabase/server";
import SiteNav from "@/components/nav/site-nav";

export const dynamic = "force-dynamic";

interface EquipoCardData {
  id: string;
  name: string;
  tagline?: string | null;
  emblemId?: string | null;
  emblemUrl?: string | null;
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
        "id, seed, elo_freeze_snapshot, team_account:team_account_id ( id, name, tagline, emblem_id, emblem:emblem_id ( image_url ) ), tournament_edition:tournament_edition_id ( name )"
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
      emblemUrl: r.team_account?.emblem?.image_url ?? null,
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
      <SiteNav />

      <main className="vertigo-content" style={{ maxWidth: "1200px", padding: "40px 32px" }}>
        {/* ═══ HERO CINEMATOGRÁFICO ═══ */}
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
              backgroundPosition: "center 40%",
              opacity: 0.26,
              transform: "scale(1.03)",
            }}
          />
          <div
            style={{
              position: "absolute", inset: 0,
              background:
                "linear-gradient(180deg, rgba(7,3,16,0.4) 0%, rgba(7,3,16,0.82) 75%, rgba(7,3,16,0.95) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
            }}
          />
          <div style={{ position: "relative", zIndex: 2, padding: "42px 40px 34px" }}>
            <span className="vertigo-kicker">EQUIPOS DEL TORNEO</span>
            <h1
              className="vertigo-title"
              style={{ fontSize: "clamp(28px, 4vw, 46px)", lineHeight: 0.95, margin: "6px 0 10px", textShadow: "0 4px 28px rgba(0,0,0,0.6)" }}
            >
              Los 32 reinos
            </h1>
            <p className="vertigo-desc" style={{ maxWidth: 620, margin: 0, fontSize: 15 }}>
              Cada equipo inscribió a sus 3 jugadores, eligió su emblema y su pool de civilizaciones.
              Acá están todos, con su identidad.
            </p>
            <div style={{ marginTop: 16 }}>
              <span className="vertigo-badge vertigo-badge-purple">
                {equipos.length} inscriptos
              </span>
            </div>
          </div>
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
                      width: 64, height: 64,
                      borderRadius: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: eq.emblemUrl ? "2px solid rgba(212,175,55,0.4)" : "1.5px solid var(--vertigo-purple)",
                      background: eq.emblemUrl ? "rgba(212,175,55,0.06)" : "rgba(124,58,237,0.08)",
                      color: "var(--vertigo-purple-soft)",
                      boxShadow: eq.emblemUrl ? "0 0 0 1px rgba(212,175,55,0.12), 0 4px 16px rgba(0,0,0,0.4)" : "none",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {eq.emblemUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={eq.emblemUrl}
                        alt={eq.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Shield style={{ width: 26, height: 26 }} strokeWidth={1.25} />
                    )}
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
