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

      <main className="vertigo-content">
        <span className="vertigo-kicker">EQUIPOS</span>
        <h1 className="vertigo-title">Equipos inscriptos</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        <p className="vertigo-desc">
          Grilla de reinos confirmados para la edición. Cada equipo tiene 3 jugadores y un pool
          de civilizaciones elegido al inscribirse.
        </p>

        {equipos.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Users
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Sin equipos confirmados</div>
              <p className="vertigo-empty-desc">
                Las inscripciones se publican acá apenas son aprobadas por el staff.
                Volver a intentarlo más tarde.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {equipos.map((eq) => (
              <Link
                key={eq.id}
                href={`/equipos/${eq.id}`}
                className="vertigo-link-card"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex items-center justify-center flex-none rounded-lg border border-[var(--vertigo-purple)] text-[var(--vertigo-purple-soft)]"
                    style={{ width: 52, height: 52 }}
                  >
                    <Shield style={{ width: 22, height: 22 }} strokeWidth={1.25} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {eq.seed != null && (
                        <span className="vertigo-badge vertigo-badge-purple">
                          #{eq.seed}
                        </span>
                      )}
                      {eq.editionName && (
                        <span className="text-[10px] uppercase tracking-[1.5px] text-[var(--vertigo-faint)] truncate">
                          {eq.editionName}
                        </span>
                      )}
                    </div>
                    <div className="vertigo-link-card-title truncate">{eq.name}</div>
                    {eq.tagline && (
                      <div className="vertigo-link-card-desc italic truncate">
                        &ldquo;{eq.tagline}&rdquo;
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 gap-2 mt-5 pt-4 border-t border-[var(--vertigo-line-soft)]"
                >
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">ELO total</div>
                    <div className="vertigo-info-card-value">
                      {eq.eloTotal ?? "—"}
                    </div>
                  </div>
                  <div className="vertigo-info-card">
                    <div className="vertigo-info-card-label">Jugadores</div>
                    <div className="vertigo-info-card-value">{eq.playerCount} / 3</div>
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
