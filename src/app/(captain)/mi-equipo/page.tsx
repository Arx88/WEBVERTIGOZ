import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { CaptainHeader } from "@/components/captain/captain-header";
import { Crown, Users, Calendar, Swords, Shield, Check, X } from "lucide-react";

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
        <CaptainHeader active="reino" />
        <main className="vertigo-content vertigo-scroll vertigo-fade-in">
          <span className="vertigo-kicker">MI REINO</span>
          <h1 className="vertigo-title">Sin reino</h1>
          <div className="vertigo-divider"><span></span><i></i><span></span></div>

          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Shield className="mx-auto mb-4" style={{ width: 48, height: 48, color: "var(--vertigo-faint)" }} strokeWidth={1} />
              <div className="vertigo-empty-title">No tenés reino todavía</div>
              <p className="vertigo-empty-desc" style={{ marginBottom: "24px" }}>Para acceder a esta página necesitás inscribir primero tu reino en el torneo.</p>
              <Link href="/registro"><button className="vertigo-btn vertigo-btn-primary">Inscribir mi reino →</button></Link>
            </div>
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
  let upcomingMatch: any = null;

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

    // 6. Próximo partido — query directa (match donde el equipo es A o B y está programado)
    const { data: matches } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, jornada_label, format, team_a_id, team_b_id, score_a, score_b")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .in("status", ["scheduled", "ready", "in_progress"])
      .order("scheduled_at_start", { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: any };
    upcomingMatch = matches;
  }

  const totalElo = players.reduce((s: number, p: any) => s + (p.max_rating_rm_1v1 ?? 0), 0);
  const eloMax = (edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20);
  const baseCivs = (latestReg?.base_civ_ids as string[]) ?? [];
  const extraCivs = (latestReg?.extra_civ_ids as string[]) ?? [];
  const status = latestReg?.status ?? "pending";

  const statusBadge = (() => {
    if (status === "approved") return { cls: "vertigo-badge-success", label: "APROBADO" };
    if (status === "rejected") return { cls: "vertigo-badge-danger", label: "RECHAZADO" };
    return { cls: "vertigo-badge-warning", label: "PENDIENTE" };
  })();

  const verificationLabel = (() => {
    switch (latestReg?.elo_verification_status) {
      case "verified": return "✓ OK";
      case "pending": return "Pendiente";
      default: return "—";
    }
  })();

  return (
    <div className="vertigo-page vertigo-shell">
      <CaptainHeader active="reino" teamTag={team.tagline ?? undefined} />

      <main className="vertigo-content vertigo-scroll vertigo-fade-in">
        {/* HEADER DEL REINO */}
        <div className="flex items-center gap-5 mb-6">
          <div className="flex-none rounded-[14px] overflow-hidden border border-[var(--vertigo-line)] bg-[var(--vertigo-input-bg)]" style={{ width: 72, height: 72 }}>
            <img src="/reinos/reino-1.webp" alt="Escudo" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="vertigo-kicker">MI REINO</span>
            <h1 className="vertigo-title" style={{ marginBottom: "4px" }}>{team.name}</h1>
            {team.tagline && <p className="text-sm italic text-[var(--vertigo-muted)]">&ldquo;{team.tagline}&rdquo;</p>}
          </div>
          <span className={`vertigo-badge ${statusBadge.cls}`}>{statusBadge.label}</span>
        </div>

        <div className="vertigo-divider"><span></span><i></i><span></span></div>

        {/* STATS */}
        <div className="vertigo-stats">
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">ELO TOTAL</div>
            <div className="vertigo-stat-value">{totalElo}</div>
            <div className="vertigo-stat-sub">/ {eloMax}</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">VERIFICACIÓN</div>
            <div className="vertigo-stat-value" style={{ fontSize: "18px" }}>{verificationLabel}</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">JUGADORES</div>
            <div className="vertigo-stat-value">{players.length}</div>
            <div className="vertigo-stat-sub">de 3</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">CIVS</div>
            <div className="vertigo-stat-value">{baseCivs.length + extraCivs.length}</div>
            <div className="vertigo-stat-sub">/ 12</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">EDICIÓN</div>
            <div className="vertigo-stat-value" style={{ fontSize: "13px" }}>{edition?.name ?? "—"}</div>
          </div>
        </div>

        {/* JUGADORES */}
        {players.length > 0 && (
          <section className="mb-6">
            <div className="vertigo-subtitle">
              <Users style={{ width: 14, height: 14 }} />
              Jugadores
              <span className="vertigo-badge vertigo-badge-purple ml-1">{players.length} / 3</span>
            </div>
            <div className="flex flex-col gap-2">
              {players.map((p: any) => (
                <div
                  key={p.id}
                  className={`vertigo-info-card flex items-center gap-4 ${p.is_captain ? "border-[var(--vertigo-purple)]" : ""}`}
                  style={p.is_captain ? { background: "rgba(124,58,237,0.06)" } : undefined}
                >
                  {/* Avatar */}
                  <div
                    className="flex-none rounded-full flex items-center justify-center font-[Cinzel,serif] font-bold"
                    style={{
                      width: 48, height: 48, fontSize: 20,
                      border: `2px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                      color: p.is_captain ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                    }}
                  >
                    {p.display_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-[var(--vertigo-text)]">{p.display_name}</span>
                      {p.is_captain && <Crown style={{ width: 13, height: 13, color: "var(--vertigo-purple-soft)" }} />}
                      {p.is_verified && <Check style={{ width: 13, height: 13, color: "var(--vertigo-success)" }} strokeWidth={2.5} />}
                    </div>
                    <div className="text-[12px] text-[var(--vertigo-faint)] mt-1">
                      {p.country || "?"}
                      {p.clan && ` · ${p.clan}`}
                      {p.is_captain && " · Capitán"}
                    </div>
                  </div>
                  {/* ELO */}
                  <div className="text-right flex-none">
                    {p.max_rating_rm_1v1 != null ? (
                      <>
                        <div className="font-[Cinzel,serif] text-[22px] font-bold leading-none text-[var(--vertigo-purple-soft)]">
                          {p.max_rating_rm_1v1}
                        </div>
                        <div className="text-[9px] tracking-[1.5px] uppercase text-[var(--vertigo-faint)] mt-1">
                          ELO máx
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-[var(--vertigo-faint)]">—</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CIVILIZACIONES */}
        {(baseCivs.length > 0 || extraCivs.length > 0) && (
          <section className="mb-6">
            <div className="vertigo-subtitle">
              <Swords style={{ width: 14, height: 14 }} />
              Civilizaciones
              <span className="vertigo-badge vertigo-badge-purple ml-1">{baseCivs.length + extraCivs.length} / 12</span>
            </div>
            <div className="vertigo-card">
              {/* Civs base */}
              <div className="mb-4">
                <div className="text-[10px] text-[var(--vertigo-faint)] tracking-[1.7px] uppercase mb-3">
                  Civs base ({baseCivs.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {baseCivs.map((civId: string) => (
                    <span key={civId} className="vertigo-badge vertigo-badge-purple" style={{ padding: "8px 12px", fontSize: "12px" }}>
                      <img src={`/civs/${civId}.webp`} alt={civId} className="w-7 h-7 object-contain" />
                      {CIV_NAMES[civId] ?? civId}
                    </span>
                  ))}
                  {baseCivs.length === 0 && (
                    <span className="text-[12px] text-[var(--vertigo-faint)]">Sin civs base asignadas.</span>
                  )}
                </div>
              </div>

              {/* Civs extra */}
              {extraCivs.length > 0 && (
                <div>
                  <div className="text-[10px] text-[var(--vertigo-faint)] tracking-[1.7px] uppercase mb-3">
                    Civs extra ({extraCivs.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extraCivs.map((civId: string) => (
                      <span key={civId} className="vertigo-badge" style={{ padding: "8px 12px", fontSize: "12px", color: "var(--vertigo-purple-pale)", border: "1px solid var(--vertigo-line)", background: "var(--vertigo-input-bg)" }}>
                        <img src={`/civs/${civId}.webp`} alt={civId} className="w-7 h-7 object-contain" />
                        {CIV_NAMES[civId] ?? civId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* CONFIRMACIONES */}
        <section className="mb-6">
          <div className="vertigo-subtitle">
            <Shield style={{ width: 14, height: 14 }} />
            Estado de inscripción
          </div>
          <div className="vertigo-card">
            <div className="flex flex-col gap-3">
              <ConfirmItem ok={!!latestReg?.handbook_downloaded_at} label="Handbook descargado" />
              <ConfirmItem ok={!!latestReg?.restream_accepted} label="Permiso de transmisión" />
              <ConfirmItem ok={!!latestReg?.terms_accepted_at} label="Términos aceptados" />
              <ConfirmItem ok={players.filter((p: any) => p.is_captain).length === 1} label="Capitán designado" />
            </div>
          </div>
        </section>

        {/* PRÓXIMA PARTIDA */}
        <section>
          <div className="vertigo-subtitle">
            <Calendar style={{ width: 14, height: 14 }} />
            Próxima partida
          </div>
          {upcomingMatch ? (
            <Link href={`/mis-partidos`} className="vertigo-link-card block">
              <div className="vertigo-link-card-title">{upcomingMatch.jornada_label ?? "Partido programado"}</div>
              <div className="vertigo-link-card-desc">
                {upcomingMatch.scheduled_at_start
                  ? new Date(upcomingMatch.scheduled_at_start).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })
                  : "Horario a confirmar"}
                {upcomingMatch.format && ` · Formato ${upcomingMatch.format}`}
              </div>
            </Link>
          ) : (
            <div className="vertigo-card">
              <div className="vertigo-empty">
                <Calendar className="mx-auto mb-3" style={{ width: 36, height: 36, color: "var(--vertigo-faint)" }} strokeWidth={1} />
                <div className="vertigo-empty-title">Sin partidos programados</div>
                <p className="vertigo-empty-desc">
                  {status === "approved"
                    ? "Cuando el bracket esté generado, van a aparecer acá."
                    : "Tu inscripción está pendiente de aprobación. Una vez aprobada, podrás ver tus partidos acá."}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ConfirmItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex-none rounded-full flex items-center justify-center"
        style={{
          width: 20, height: 20,
          background: ok ? "rgba(34,197,94,0.1)" : "rgba(251,113,133,0.1)",
          border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(251,113,133,0.3)"}`,
          color: ok ? "var(--vertigo-success)" : "var(--vertigo-danger)",
        }}
      >
        {ok ? <Check style={{ width: 12, height: 12 }} /> : <X style={{ width: 12, height: 12 }} />}
      </div>
      <span className={`text-[13px] ${ok ? "text-[var(--vertigo-text)]" : "text-[var(--vertigo-muted)]"}`}>
        {label}
      </span>
    </div>
  );
}
