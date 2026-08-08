import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "@/server/actions/auth";
import { Crown, Users, Calendar, Swords, LogOut, Shield, Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

const CIV_NAMES: Record<string, string> = {
  britons: "Britanos", franks: "Francos", goths: "Godos", teutons: "Teutones",
  japanese: "Japoneses", chinese: "Chinos", byzantines: "Bizantinos", persians: "Persas",
  saracens: "Sarracenos", turks: "Turcos", vikings: "Vikingos", mongols: "Mongoles",
  celts: "Celtas", spanish: "Españoles", aztecs: "Aztecas", mayans: "Mayas",
  huns: "Hunos", koreans: "Coreanos", italians: "Italianos", hindustanis: "Hindúes",
  incas: "Incas", magyars: "Magiares", slavs: "Eslavos", berbers: "Bereberes",
  ethiopians: "Etíopes", malians: "Malianos", portuguese: "Portugueses", burmese: "Birmanos",
  khmer: "Jémeres", malay: "Malayos", vietnamese: "Vietnamitas", bulgarians: "Búlgaros",
  cumans: "Cumanos", lithuanians: "Lituanos", tatars: "Tártaros", burgundians: "Borgoñones",
  sicilians: "Sicilianos", poles: "Polacos", bohemians: "Bohemios", romans: "Romanos",
  armenians: "Armenios", georgians: "Georgianos", bengalis: "Bengalíes", dravidians: "Drávidas",
  gurjaras: "Gurjaras", jurchens: "Jurchen", khitans: "Kitan", shu: "Shu", wei: "Wei", wu: "Wu",
  mapuche: "Mapuche", muiscas: "Muiscas", tupies: "Tupies",
};

export default async function MiEquipoPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Account
  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account) redirect("/login");
  if (account.role === "admin" || account.role === "super_admin") redirect("/admin");
  if (account.role === "caster") redirect("/caster");

  // 2. Team account — usar maybeSingle por si no hay
  const { data: team } = (await supabase
    .from("team_account")
    .select("id, name, tagline, emblem_id, created_at")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) {
    return (
      <div className="vertigo-page vertigo-shell">
        <header className="vertigo-header">
          <div className="vertigo-header-left">
            <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
            <span className="vertigo-section-tag">MI REINO</span>
          </div>
          <form action={logoutAction}><button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>Salir</button></form>
        </header>
        <main className="vertigo-content">
          <div className="vertigo-empty">
            <div className="vertigo-empty-title">No tenés reino todavía</div>
            <p className="vertigo-empty-desc" style={{ marginBottom: "24px" }}>Para acceder a esta página necesitás inscribir primero tu reino en el torneo.</p>
            <Link href="/registro"><button className="vertigo-btn vertigo-btn-primary">Inscribir mi reino →</button></Link>
          </div>
        </main>
      </div>
    );
  }

  // 3. Registration — sin joins, query directa
  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id, status, elo_freeze_snapshot, elo_verification_status, elo_verification_reason, base_civ_ids, extra_civ_ids, submitted_at, approved_at, tournament_edition_id")
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })) as { data: any };

  const latestReg = regs?.[0];
  let edition: any = null;
  let players: any[] = [];

  if (latestReg) {
    // 4. Edition — query separada
    if (latestReg.tournament_edition_id) {
      const { data: ed } = (await supabase
        .from("tournament_edition")
        .select("id, name, slug, status, elo_cap, elo_tolerance")
        .eq("id", latestReg.tournament_edition_id)
        .maybeSingle()) as { data: any };
      edition = ed;
    }

    // 5. Players — query separada
    const { data: pd } = (await supabase
      .from("player_registration")
      .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, rating_rm_1v1_current, aoe2_profile_id, is_verified")
      .eq("team_registration_id", latestReg.id)
      .order("is_captain", { ascending: false })) as { data: any };
    players = pd ?? [];
  }

  const totalElo = players.reduce((s: number, p: any) => s + (p.max_rating_rm_1v1 ?? 0), 0);
  const eloMax = (edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20);
  const baseCivs = (latestReg?.base_civ_ids as string[]) ?? [];
  const extraCivs = (latestReg?.extra_civ_ids as string[]) ?? [];
  const status = latestReg?.status ?? "pending";

  return (
    <div className="vertigo-page vertigo-shell">
      <header className="vertigo-header">
        <div className="vertigo-header-left">
          <Link href="/" className="vertigo-logo">VÉRTIGO</Link>
          <span className="vertigo-section-tag">MI REINO</span>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "8px 16px", fontSize: "11px" }}>
            <LogOut style={{ width: "14px", height: "14px" }} />Salir
          </button>
        </form>
      </header>

      <main className="vertigo-content vertigo-scroll">
        {/* HEADER DEL REINO */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "14px", overflow: "hidden",
            border: "1px solid var(--vertigo-line)", flex: "none",
            background: "var(--vertigo-input-bg)",
          }}>
            <img src="/reinos/reino-1.webp" alt="Escudo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1 }}>
            <span className="vertigo-kicker">REINO</span>
            <h1 className="vertigo-title" style={{ marginBottom: "4px" }}>{team.name}</h1>
            {team.tagline && <p style={{ fontSize: "14px", color: "var(--vertigo-muted)", fontStyle: "italic" }}>&ldquo;{team.tagline}&rdquo;</p>}
          </div>
          <div>
            <span className={`vertigo-badge ${status === "approved" ? "vertigo-badge-success" : status === "rejected" ? "vertigo-badge-danger" : "vertigo-badge-warning"}`}>
              {status === "approved" ? "APROBADO" : status === "rejected" ? "RECHAZADO" : "PENDIENTE"}
            </span>
          </div>
        </div>

        {/* STATS */}
        <div className="vertigo-stats">
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">ELO TOTAL</div>
            <div className="vertigo-stat-value">{totalElo}</div>
            <div className="vertigo-stat-sub">/ {eloMax}</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">VERIFICACIÓN</div>
            <div className="vertigo-stat-value" style={{ fontSize: "14px" }}>
              {latestReg?.elo_verification_status === "verified" ? "✓ OK" : latestReg?.elo_verification_status === "pending" ? "Pendiente" : "—"}
            </div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">EDICIÓN</div>
            <div className="vertigo-stat-value" style={{ fontSize: "12px" }}>{edition?.name ?? "—"}</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">ENVIADO</div>
            <div className="vertigo-stat-value" style={{ fontSize: "12px" }}>
              {latestReg?.submitted_at ? new Date(latestReg.submitted_at).toLocaleDateString("es-AR") : "—"}
            </div>
          </div>
        </div>

        {/* JUGADORES */}
        {players.length > 0 && (
          <div className="vertigo-card" style={{ marginBottom: "16px" }}>
            <div className="vertigo-card-header">
              <div className="vertigo-card-title">
                <Users style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", color: "var(--vertigo-purple-soft)" }} />
                Jugadores
              </div>
              <span style={{ fontSize: "11px", color: "var(--vertigo-faint)" }}>{players.length} de 3</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {players.map((p: any, idx: number) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: "16px", padding: "16px",
                  borderRadius: "9px", border: `1px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line-soft)"}`,
                  background: p.is_captain ? "rgba(124,58,237,0.06)" : "transparent",
                }}>
                  {/* Avatar */}
                  <div style={{
                    width: "48px", height: "48px", borderRadius: "50%",
                    border: `2px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: p.is_captain ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                    fontSize: "20px", fontWeight: 700, fontFamily: "Cinzel, serif", flex: "none",
                  }}>
                    {p.display_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--vertigo-text)", fontFamily: "Inter, sans-serif" }}>
                      {p.display_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--vertigo-faint)", marginTop: "2px" }}>
                      {p.country || "?"} {p.clan && `· ${p.clan}`}
                      {p.is_captain && " · Capitán"}
                    </div>
                  </div>
                  {/* ELO */}
                  <div style={{ textAlign: "right" }}>
                    {p.max_rating_rm_1v1 != null ? (
                      <>
                        <div style={{ fontFamily: "Cinzel, serif", fontSize: "22px", fontWeight: 700, color: "var(--vertigo-purple-soft)" }}>
                          {p.max_rating_rm_1v1}
                        </div>
                        <div style={{ fontSize: "9px", color: "var(--vertigo-faint)", letterSpacing: "1.5px", textTransform: "uppercase" }}>
                          ELO máx
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "11px", color: "var(--vertigo-faint)" }}>—</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CIVILIZACIONES */}
        {baseCivs.length > 0 && (
          <div className="vertigo-card" style={{ marginBottom: "16px" }}>
            <div className="vertigo-card-header">
              <div className="vertigo-card-title">
                <Swords style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", color: "var(--vertigo-purple-soft)" }} />
                Civilizaciones
              </div>
              <span style={{ fontSize: "11px", color: "var(--vertigo-faint)" }}>{baseCivs.length + extraCivs.length} / 12</span>
            </div>

            {/* Civs base */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "1.7px", textTransform: "uppercase", marginBottom: "10px" }}>
                Civs base ({baseCivs.length})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {baseCivs.map((civId: string, idx: number) => (
                  <div key={civId} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 12px", borderRadius: "9px",
                    background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)",
                  }}>
                    <img src={`/civs/${civId}.webp`} alt={civId} style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                    <span style={{ fontSize: "12px", color: "var(--vertigo-text)", fontFamily: "Inter, sans-serif" }}>
                      {CIV_NAMES[civId] ?? civId}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Civs extra */}
            {extraCivs.length > 0 && (
              <div>
                <div style={{ fontSize: "10px", color: "var(--vertigo-faint)", letterSpacing: "1.7px", textTransform: "uppercase", marginBottom: "10px" }}>
                  Civs extra ({extraCivs.length})
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {extraCivs.map((civId: string, idx: number) => (
                    <div key={civId} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "8px 12px", borderRadius: "9px",
                      background: "var(--vertigo-input-bg)", border: "1px solid var(--vertigo-line)",
                    }}>
                      <img src={`/civs/${civId}.webp`} alt={civId} style={{ width: "28px", height: "28px", objectFit: "contain" }} />
                      <span style={{ fontSize: "12px", color: "var(--vertigo-muted)", fontFamily: "Inter, sans-serif" }}>
                        {CIV_NAMES[civId] ?? civId}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CONFIRMACIONES */}
        <div className="vertigo-card" style={{ marginBottom: "16px" }}>
          <div className="vertigo-card-header">
            <div className="vertigo-card-title">
              <Shield style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", color: "var(--vertigo-purple-soft)" }} />
              Estado de inscripción
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <ConfirmItem ok={!!latestReg?.handbook_downloaded_at} label="Handbook descargado" />
            <ConfirmItem ok={!!latestReg?.restream_accepted} label="Permiso de transmisión" />
            <ConfirmItem ok={!!latestReg?.terms_accepted_at} label="Términos aceptados" />
            <ConfirmItem ok={players.filter((p: any) => p.is_captain).length === 1} label="Capitán designado" />
          </div>
        </div>

        {/* PRÓXIMOS PARTIDOS */}
        <div className="vertigo-card">
          <div className="vertigo-card-header">
            <div className="vertigo-card-title">
              <Calendar style={{ width: "16px", height: "16px", display: "inline", marginRight: "8px", color: "var(--vertigo-purple-soft)" }} />
              Próximos partidos
            </div>
          </div>
          <div className="vertigo-empty">
            <p className="vertigo-empty-desc">
              {status === "approved"
                ? "No tenés partidos programados aún. Cuando el bracket esté generado, van a aparecer acá."
                : "Tu inscripción está pendiente de aprobación. Una vez aprobada, podrás ver tus partidos acá."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function ConfirmItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{
        width: "20px", height: "20px", borderRadius: "50%",
        background: ok ? "rgba(34,197,94,0.1)" : "rgba(251,113,133,0.1)",
        border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(251,113,133,0.3)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: ok ? "var(--vertigo-success)" : "var(--vertigo-danger)",
        fontSize: "11px", fontWeight: 700,
      }}>
        {ok ? <Check style={{ width: "12px", height: "12px" }} /> : <X style={{ width: "12px", height: "12px" }} />}
      </div>
      <span style={{ fontSize: "13px", color: ok ? "var(--vertigo-text)" : "var(--vertigo-muted)", fontFamily: "Inter, sans-serif" }}>
        {label}
      </span>
    </div>
  );
}
