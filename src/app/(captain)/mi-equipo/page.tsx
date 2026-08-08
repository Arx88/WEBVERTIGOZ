import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { Shield, Crown, Users, Calendar, Swords, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MiEquipoPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: accountData } = (await supabase
    .from("account").select("id, email, role, display_name").eq("supabase_auth_id", user.id).single()) as { data: any };

  if (accountData?.role === "admin" || accountData?.role === "super_admin") redirect("/admin");
  if (accountData?.role === "caster") redirect("/caster");

  const { data: teamAccount } = (await supabase
    .from("team_account").select("id, name, tagline, emblem_id, created_at")
    .eq("owner_id", accountData?.id).order("created_at", { ascending: false }).limit(1).maybeSingle()) as { data: any };

  if (!teamAccount) {
    return (
      <div className="vertigo-page vertigo-shell">
        <header className="vertigo-header">
          <div className="vertigo-header-left">
            <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
            <span className="vertigo-section-tag">MI EQUIPO</span>
          </div>
          <form action={logoutAction}><button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>Salir</button></form>
        </header>
        <main className="vertigo-content">
          <div className="vertigo-empty">
            <div className="vertigo-empty-title">No tenés equipo todavía</div>
            <p className="vertigo-empty-desc" style={{ marginBottom: "24px" }}>Para acceder a esta página necesitás inscribir primero tu equipo en el torneo.</p>
            <Link href="/registro"><button className="vertigo-btn vertigo-btn-primary">Inscribir mi equipo →</button></Link>
          </div>
        </main>
      </div>
    );
  }

  const { data: registrations } = (await supabase
    .from("team_registration")
    .select("id, status, elo_freeze_snapshot, elo_verification_status, base_civ_ids, extra_civ_ids, submitted_at, approved_at, tournament_edition:slug, tournament_edition:name, tournament_edition:status, tournament_edition:elo_cap, tournament_edition:elo_tolerance")
    .eq("team_account_id", teamAccount.id).order("submitted_at", { ascending: false })) as { data: any };

  let players: any[] = [];
  if (registrations && registrations.length > 0) {
    const { data: playerData } = (await supabase
      .from("player_registration")
      .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, rating_rm_1v1_current, aoe2_profile_id, is_verified")
      .eq("team_registration_id", registrations[0].id).order("is_captain", { ascending: false })) as { data: any };
    players = playerData ?? [];
  }

  const latestReg = registrations?.[0] as any;
  const edition = latestReg?.tournament_edition as any;
  const totalElo = players.reduce((sum: number, p: any) => sum + (p.max_rating_rm_1v1 ?? 0), 0);

  return (
    <div className="vertigo-page vertigo-shell">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">MI EQUIPO</span>
        </div>
        <form action={logoutAction}><button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}><LogOut style={{ width: "14px", height: "14px" }} />Salir</button></form>
      </header>

      <main className="vertigo-content vertigo-scroll">
        {/* Equipo */}
        <span className="vertigo-kicker">EQUIPO</span>
        <h1 className="vertigo-title">{teamAccount.name}</h1>
        <div className="vertigo-divider"><span></span><i></i><span></span></div>
        {teamAccount.tagline && <p className="vertigo-desc" style={{ fontStyle: "italic" }}>&ldquo;{teamAccount.tagline}&rdquo;</p>}

        {latestReg && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "32px" }}>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">ELO TOTAL</div>
              <div className="vertigo-stat-value">{totalElo}</div>
              <div className="vertigo-stat-sub">/ {(edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20)}</div>
            </div>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">VERIFICACIÓN</div>
              <div className="vertigo-stat-value" style={{ fontSize: "16px" }}>
                {latestReg.elo_verification_status === "verified" ? "✓ OK" : latestReg.elo_verification_status === "pending" ? "Pendiente" : "Faltó"}
              </div>
            </div>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">EDICIÓN</div>
              <div className="vertigo-stat-value" style={{ fontSize: "14px" }}>{edition?.name ?? "—"}</div>
            </div>
            <div className="vertigo-stat">
              <div className="vertigo-stat-label">ESTADO</div>
              <div style={{ marginTop: "4px" }}>
                <span className={`vertigo-badge ${latestReg.status === "approved" ? "vertigo-badge-success" : latestReg.status === "rejected" ? "vertigo-badge-danger" : "vertigo-badge-warning"}`}>
                  {latestReg.status === "approved" ? "APROBADO" : latestReg.status === "rejected" ? "RECHAZADO" : "PENDIENTE"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Jugadores */}
        {players.length > 0 && (
          <div className="vertigo-card" style={{ marginBottom: "16px" }}>
            <div className="vertigo-card-header">
              <div className="vertigo-card-title"><Users style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", color: "var(--vertigo-purple-soft)" }} />Jugadores</div>
              <span style={{ fontSize: "11px", color: "var(--vertigo-faint)" }}>{players.length} de 3</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
              {players.map((p: any, idx: number) => (
                <div key={p.id} style={{ textAlign: "center", padding: "12px", border: `1px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line-soft)"}`, borderRadius: "9px", background: p.is_captain ? "rgba(124,58,237,0.06)" : "transparent" }}>
                  {p.is_captain && <div style={{ marginBottom: "6px" }}><span className="vertigo-badge vertigo-badge-purple"><Crown style={{ width: "10px", height: "10px" }} />Capitán</span></div>}
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: `1px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`, display: "flex", alignItems: "center", justifyContent: "center", color: p.is_captain ? "var(--vertigo-purple-soft)" : "var(--vertigo-faint)", fontSize: "16px", fontWeight: 600, margin: "0 auto 8px" }}>
                    {p.display_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--vertigo-text)", fontFamily: "Inter, sans-serif" }}>{p.display_name}</div>
                  <div style={{ fontSize: "11px", color: "var(--vertigo-faint)", marginTop: "2px" }}>{p.country} {p.clan && `· ${p.clan}`}</div>
                  {p.max_rating_rm_1v1 !== null && <div style={{ fontSize: "11px", color: "var(--vertigo-purple-soft)", marginTop: "4px" }}>ELO: {p.max_rating_rm_1v1}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Civs */}
        {latestReg && Array.isArray(latestReg.base_civ_ids) && (
          <div className="vertigo-card" style={{ marginBottom: "16px" }}>
            <div className="vertigo-card-header">
              <div className="vertigo-card-title"><Swords style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", color: "var(--vertigo-purple-soft)" }} />Civilizaciones</div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "1.7px", textTransform: "uppercase", marginBottom: "8px" }}>CIVS BASE (9)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(latestReg.base_civ_ids as string[]).map((civId: string, idx: number) => (
                  <span key={civId} className="vertigo-badge vertigo-badge-purple">{idx + 1}. {civId}</span>
                ))}
              </div>
            </div>
            {Array.isArray(latestReg.extra_civ_ids) && (latestReg.extra_civ_ids as string[]).length > 0 && (
              <div>
                <div style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "1.7px", textTransform: "uppercase", marginBottom: "8px" }}>CIVS EXTRA (3)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(latestReg.extra_civ_ids as string[]).map((civId: string, idx: number) => (
                    <span key={civId} className="vertigo-badge" style={{ color: "var(--vertigo-muted)", borderColor: "var(--vertigo-line)" }}>{idx + 1}. {civId}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Próximos partidos */}
        <div className="vertigo-card">
          <div className="vertigo-card-header">
            <div className="vertigo-card-title"><Calendar style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", color: "var(--vertigo-purple-soft)" }} />Próximos partidos</div>
          </div>
          <div className="vertigo-empty">
            <p className="vertigo-empty-desc">
              {latestReg?.status === "approved"
                ? "No tenés partidos programados aún. Cuando el bracket esté generado, van a aparecer acá."
                : "Tu inscripción está pendiente de aprobación. Una vez aprobada, podrás ver tus partidos acá."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
