import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { CaptainHeader } from "@/components/captain/captain-header";
import {
  Crown, Users, Calendar, Swords, Shield, Check, X, ChevronRight,
  Zap, Clock, Trophy, Flag, TrendingUp, BarChart2
} from "lucide-react";

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

const CIV_KEYS = Object.keys(CIV_NAMES);

export default async function MiEquipoPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: account } = (await supabase
    .from("account")
    .select("id, email, role, display_name")
    .eq("supabase_auth_id", user.id)
    .single()) as { data: any };

  if (!account) redirect("/login");
  if (account.role === "admin" || account.role === "super_admin") redirect("/admin");
  if (account.role === "caster") redirect("/caster");

  const { data: team } = (await supabase
    .from("team_account")
    .select("id, name, tagline, emblem_id, created_at")
    .eq("owner_id", account.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  if (!team) {
    return <NotRegistered />;
  }

  const { data: regs } = (await supabase
    .from("team_registration")
    .select("id, status, elo_freeze_snapshot, elo_verification_status, elo_verification_reason, base_civ_ids, extra_civ_ids, submitted_at, approved_at, tournament_edition_id")
    .eq("team_account_id", team.id)
    .order("submitted_at", { ascending: false })) as { data: any };

  const latestReg = regs?.[0];
  let edition: any = null;
  let players: any[] = [];
  let upcomingMatch: any = null;
  let pastMatches: any[] = [];

  if (latestReg) {
    if (latestReg.tournament_edition_id) {
      const { data: ed } = (await supabase
        .from("tournament_edition")
        .select("id, name, slug, status, elo_cap, elo_tolerance")
        .eq("id", latestReg.tournament_edition_id)
        .maybeSingle()) as { data: any };
      edition = ed;
    }

    const { data: pd } = (await supabase
      .from("player_registration")
      .select("id, display_name, country, clan, is_captain, max_rating_rm_1v1, rating_rm_1v1_current, aoe2_profile_id, is_verified")
      .eq("team_registration_id", latestReg.id)
      .order("is_captain", { ascending: false })) as { data: any };
    players = pd ?? [];

    const { data: matches } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, jornada_label, format, team_a_id, team_b_id, score_a, score_b, winner_team_id")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .in("status", ["scheduled", "open", "in_progress", "comodin_window"])
      .order("scheduled_at_start", { ascending: true })
      .limit(1)
      .maybeSingle()) as { data: any };
    upcomingMatch = matches;

    // Historial de partidos del torneo
    const { data: past } = (await supabase
      .from("match")
      .select("id, status, scheduled_at_start, jornada_label, format, score_a, score_b, winner_team_id, team_a_id, team_b_id, games:match_game (game_mode, player_mode, map)")
      .or(`team_a_id.eq.${latestReg.id},team_b_id.eq.${latestReg.id}`)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(6)) as { data: any };
    pastMatches = past ?? [];
  }

  // Fetch datos full de AoE2 Companion para cada jugador (en paralelo)
  const playerProfiles = await Promise.all(
    players.map(async (p) => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/aoe2/profile-full?id=${p.aoe2_profile_id}`, {
          next: { revalidate: 1800 },
        });
        if (res.ok) return await res.json();
      } catch {}
      return null;
    })
  );

  // Fetch ELO promedio del torneo (para percentile)
  const totalElo = players.reduce((s: number, p: any) => s + (p.max_rating_rm_1v1 ?? 0), 0);
  const { data: allApproved } = (await supabase
    .from("team_registration")
    .select("elo_freeze_snapshot")
    .eq("tournament_edition_id", edition?.id ?? "")
    .eq("status", "approved")) as { data: any };
  const allElos = (allApproved ?? []).map((r: any) => r.elo_freeze_snapshot ?? 0).filter((e: number) => e > 0);
  const tournamentMaxElo = allElos.length > 0 ? Math.max(...allElos) : 0;
  const eloPercentile = tournamentMaxElo > 0 ? Math.round((totalElo / tournamentMaxElo) * 100) : null;

  const eloMax = (edition?.elo_cap ?? 3500) + (edition?.elo_tolerance ?? 20);
  const eloPct = Math.min(100, Math.round((totalElo / eloMax) * 100));
  const baseCivs = (latestReg?.base_civ_ids as string[]) ?? [];
  const extraCivs = (latestReg?.extra_civ_ids as string[]) ?? [];
  const status = latestReg?.status ?? "pending";
  const captain = players.find((p: any) => p.is_captain);

  const statusBadge = (() => {
    if (status === "approved") return { cls: "vertigo-badge-success", label: "APROBADO" };
    if (status === "rejected") return { cls: "vertigo-badge-danger", label: "RECHAZADO" };
    return { cls: "vertigo-badge-warning", label: "PENDIENTE" };
  })();

  const checklist = [
    { ok: !!latestReg?.handbook_downloaded_at, label: "Handbook descargado" },
    { ok: !!latestReg?.restream_accepted, label: "Permiso de transmisión" },
    { ok: !!latestReg?.terms_accepted_at, label: "Términos aceptados" },
    { ok: players.filter((p: any) => p.is_captain).length === 1, label: "Capitán designado" },
  ];
  const completedCount = checklist.filter((c) => c.ok).length;

  const emblemIdx = team.id ? (team.id.charCodeAt(0) % 13) + 1 : 1;
  const emblemUrl = `/reinos/reino-${emblemIdx}.webp`;

  const verificationLabel = (() => {
    switch (latestReg?.elo_verification_status) {
      case "verified": return { text: "✓ Verificado", color: "var(--vertigo-success)" };
      case "pending": return { text: "Pendiente", color: "var(--vertigo-warning)" };
      case "hidden": return { text: "Oculto", color: "var(--vertigo-faint)" };
      default: return { text: "—", color: "var(--vertigo-faint)" };
    }
  })();

  // Stats del equipo combinados
  const combinedCivStats: Record<string, { games: number; wins: number }> = {};
  playerProfiles.forEach((profile) => {
    if (!profile?.civStats) return;
    profile.civStats.forEach((cs: any) => {
      if (!combinedCivStats[cs.civ]) combinedCivStats[cs.civ] = { games: 0, wins: 0 };
      combinedCivStats[cs.civ].games += cs.games;
      combinedCivStats[cs.civ].wins += cs.wins;
    });
  });

  const topTeamCivs = Object.entries(combinedCivStats)
    .map(([civ, stats]) => ({ civ, ...stats, winrate: Math.round((stats.wins / stats.games) * 100) }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 6);

  return (
    <div className="vertigo-page vertigo-shell">
      <CaptainHeader
        active="reino"
        teamTag={team.tagline ?? undefined}
        teamName={team.name}
        emblemUrl={emblemUrl}
      />

      <main className="vertigo-content vertigo-scroll vertigo-fade-in">

        {/* ===== HERO DEL REINO ===== */}
        <div
          className="vertigo-card"
          style={{
            padding: 0, overflow: "hidden", position: "relative", minHeight: "180px",
            marginBottom: "24px", border: "1px solid var(--vertigo-line)",
          }}
        >
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "url('/landing/fondo-castillo.webp')",
            backgroundSize: "cover", backgroundPosition: "center 30%", opacity: 0.4,
          }} />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, transparent 0%, rgba(7,3,16,0.5) 40%, rgba(7,3,16,0.92) 100%)",
          }} />
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "2px",
            background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)",
          }} />
          <div style={{ position: "relative", zIndex: 2, padding: "28px 32px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "20px" }}>
              <div style={{
                flex: "none", width: "80px", height: "80px", borderRadius: "16px",
                overflow: "hidden", border: "2px solid rgba(124,58,237,0.5)",
                background: "var(--vertigo-input-bg)",
                boxShadow: "0 0 32px rgba(124,58,237,0.35), 0 4px 16px rgba(0,0,0,0.5)",
              }}>
                <img src={emblemUrl} alt={`Escudo de ${team.name}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "var(--vertigo-purple-soft)", marginBottom: "6px" }}>
                  MI REINO
                </div>
                <h1 style={{
                  fontFamily: "Cinzel, serif", fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 700, color: "var(--vertigo-text)", lineHeight: 1,
                  textShadow: "0 2px 12px rgba(0,0,0,0.6)",
                }}>
                  {team.name}
                </h1>
                {team.tagline && (
                  <p style={{ fontSize: "13px", fontStyle: "italic", color: "var(--vertigo-muted)", marginTop: "6px" }}>
                    &ldquo;{team.tagline}&rdquo;
                  </p>
                )}
              </div>
            </div>
            <span className={`vertigo-badge ${statusBadge.cls}`} style={{ fontSize: "12px", padding: "8px 20px", fontWeight: 700, letterSpacing: "1.5px" }}>
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* ===== ELO + CHECKLIST ROW ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", marginBottom: "24px" }}>

          {/* ELO total con barra */}
          <div className="vertigo-card" style={{ padding: "24px 28px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: "28px", right: "28px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)" }} />
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
              <div>
                <div className="vertigo-stat-label" style={{ marginBottom: "8px" }}>ELO TOTAL DEL EQUIPO</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                  <span style={{
                    fontFamily: "Cinzel, serif", fontSize: "clamp(44px, 5vw, 64px)",
                    fontWeight: 700, lineHeight: 1,
                    color: eloPct > 90 ? "var(--vertigo-danger)" : eloPct > 70 ? "#fbbf24" : "var(--vertigo-purple-pale)",
                    textShadow: "0 0 40px rgba(124,58,237,0.4)",
                  }}>
                    {totalElo.toLocaleString()}
                  </span>
                  <span style={{ fontSize: "18px", color: "var(--vertigo-faint)", marginBottom: "4px" }}>/ {eloMax.toLocaleString()}</span>
                </div>
              </div>
              <div style={{ flex: 1, maxWidth: "380px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)" }}>
                    Capacidad
                  </span>
                  <span style={{
                    fontSize: "13px", fontWeight: 700,
                    color: eloPct > 90 ? "var(--vertigo-danger)" : eloPct > 70 ? "#fbbf24" : "var(--vertigo-purple-pale)",
                  }}>
                    {eloPct}%
                  </span>
                </div>
                <div style={{
                  height: "12px", background: "rgba(255,255,255,0.06)", borderRadius: "6px",
                  overflow: "hidden", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
                }}>
                  <div style={{
                    height: "100%", width: `${eloPct}%`, borderRadius: "6px",
                    background: eloPct > 90 ? "linear-gradient(90deg, #fb7185, #e11d48)" : eloPct > 70 ? "linear-gradient(90deg, #fbbf24, #f59e0b)" : "linear-gradient(90deg, var(--vertigo-purple), var(--vertigo-purple-soft))",
                    boxShadow: "0 0 16px rgba(124,58,237,0.5)",
                    transition: "width 1s ease",
                  }} />
                </div>
                {/* Percentil vs torneo */}
                {eloPercentile !== null && eloPercentile !== undefined && (
                  <div style={{
                    marginTop: "10px",
                    padding: "8px 12px",
                    background: eloPercentile >= 80 ? "rgba(212,175,55,0.1)" : "rgba(124,58,237,0.08)",
                    border: `1px solid ${eloPercentile >= 80 ? "rgba(212,175,55,0.3)" : "rgba(124,58,237,0.2)"}`,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: eloPercentile >= 80 ? "var(--vertigo-gold)" : "var(--vertigo-purple-soft)" }}>
                      Percentil del torneo
                    </span>
                    <span style={{
                      fontFamily: "Cinzel, serif",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: eloPercentile >= 80 ? "var(--vertigo-gold)" : "var(--vertigo-purple-pale)",
                    }}>
                      Top {100 - eloPercentile}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Checklist de inscripción */}
          <div className="vertigo-card" style={{ padding: "22px", display: "flex", alignItems: "center", gap: "18px" }}>
            <div style={{ position: "relative", width: "68px", height: "68px", flex: "none" }}>
              <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="34" cy="34" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                <circle
                  cx="34" cy="34" r="28" fill="none"
                  stroke={completedCount === 4 ? "var(--vertigo-success)" : "var(--vertigo-purple)"}
                  strokeWidth="5"
                  strokeDasharray={`${(completedCount / 4) * 175.9} 175.9`}
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 6px rgba(124,58,237,0.5))", transition: "stroke-dasharray 1s ease" }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700,
                color: completedCount === 4 ? "var(--vertigo-success)" : "var(--vertigo-text)",
              }}>
                {completedCount}/4
              </div>
            </div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--vertigo-text)", marginBottom: "4px" }}>
                {completedCount === 4 ? "¡Inscripción completa!" : "Progreso"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--vertigo-faint)" }}>
                {completedCount === 4 ? "Todo listo para competir." : "Completá los requisitos."}
              </div>
            </div>
          </div>
        </div>

        {/* ===== STATS ROW ===== */}
        <div className="vertigo-stats" style={{ marginBottom: "32px" }}>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">Verificación ELO</div>
            <div style={{ fontFamily: "Cinzel, serif", fontSize: "17px", fontWeight: 700, marginTop: "6px", color: verificationLabel.color }}>
              {verificationLabel.text}
            </div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">Jugadores</div>
            <div className="vertigo-stat-value">{players.length}</div>
            <div className="vertigo-stat-sub">de 3 integrantes</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">Civs registradas</div>
            <div className="vertigo-stat-value">{baseCivs.length + extraCivs.length}</div>
            <div className="vertigo-stat-sub">9 base + 3 extra</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">Capitán</div>
            <div style={{ fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700, marginTop: "6px", color: "var(--vertigo-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {captain?.display_name ?? "—"}
            </div>
            <div className="vertigo-stat-sub">{captain ? `ELO ${captain.max_rating_rm_1v1 ?? "?"}` : "Sin asignar"}</div>
          </div>
          <div className="vertigo-stat">
            <div className="vertigo-stat-label">Edición</div>
            <div style={{ fontFamily: "Cinzel, serif", fontSize: "13px", fontWeight: 700, marginTop: "6px", color: "var(--vertigo-text)", lineHeight: 1.3 }}>
              {edition?.name ?? "—"}
            </div>
          </div>
        </div>

        {/* ===== JUGADORES + CIVS DEL EQUIPO ===== */}
        <div className="vertigo-grid-2" style={{ marginBottom: "32px" }}>

          {/* JUGADORES */}
          <div className="vertigo-section">
            <div className="vertigo-subtitle">
              <Users style={{ width: 14, height: 14 }} />
              Jugadores
              <span className="vertigo-badge vertigo-badge-purple" style={{ marginLeft: "auto" }}>{players.length} / 3</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {players.map((p, idx) => {
                const profile = playerProfiles[idx];
                const topCiv = profile?.civStats?.[0];
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "18px 20px", borderRadius: "14px",
                      border: `1px solid ${p.is_captain ? "rgba(124,58,237,0.4)" : "var(--vertigo-line)"}`,
                      background: p.is_captain ? "rgba(124,58,237,0.08)" : "rgba(13,9,19,0.6)",
                      boxShadow: p.is_captain ? "0 0 24px rgba(124,58,237,0.15)" : "0 2px 8px rgba(0,0,0,0.2)",
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: "relative", flex: "none" }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "Cinzel, serif", fontSize: "24px", fontWeight: 700,
                        border: `2px solid ${p.is_captain ? "var(--vertigo-purple)" : "var(--vertigo-line)"}`,
                        color: p.is_captain ? "var(--vertigo-purple-pale)" : "var(--vertigo-faint)",
                        background: p.is_captain ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                        boxShadow: p.is_captain ? "0 0 16px rgba(124,58,237,0.2)" : "none",
                      }}>
                        {p.display_name?.charAt(0).toUpperCase() || "?"}
                      </div>
                      {p.max_rating_rm_1v1 != null && p.max_rating_rm_1v1 > 0 && (
                        <div style={{
                          position: "absolute", bottom: "-4px", right: "-4px",
                          background: "rgba(124,58,237,0.95)", border: "1.5px solid var(--vertigo-purple)",
                          borderRadius: "999px", padding: "2px 7px",
                          fontSize: "9px", fontWeight: 700, color: "#fff", fontFamily: "Cinzel, serif",
                          boxShadow: "0 2px 8px rgba(124,58,237,0.4)",
                        }}>
                          {p.max_rating_rm_1v1}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--vertigo-text)" }}>{p.display_name}</span>
                        {p.is_captain && <Crown style={{ width: 14, height: 14, color: "var(--vertigo-purple-soft)" }} />}
                        {p.is_verified && (
                          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "999px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "var(--vertigo-success)", fontWeight: 700 }}>
                            ✓
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--vertigo-faint)", marginTop: "4px" }}>
                        {p.country || "?"}
                        {p.clan && ` · ${p.clan}`}
                        {p.is_captain && " · Capitán"}
                        {topCiv && ` · Top civ: ${topCiv.civName} (${topCiv.winrate}%)`}
                      </div>
                    </div>

                    {/* ELO + Forma */}
                    <div style={{ textAlign: "right", flex: "none" }}>
                      {p.max_rating_rm_1v1 != null && p.max_rating_rm_1v1 > 0 && (
                        <>
                          <div style={{ fontFamily: "Cinzel, serif", fontSize: "26px", fontWeight: 700, lineHeight: 1, color: "var(--vertigo-purple-soft)" }}>
                            {p.max_rating_rm_1v1.toLocaleString()}
                          </div>
                          <div style={{ fontSize: "9px", letterSpacing: "2px", textTransform: "uppercase", color: "var(--vertigo-faint)", marginTop: "4px" }}>
                            ELO máx
                          </div>
                          {/* Forma = current/max */}
                          {p.rating_rm_1v1_current && p.max_rating_rm_1v1 && (() => {
                            const formIndex = p.rating_rm_1v1_current / p.max_rating_rm_1v1;
                            const color = formIndex >= 0.95 ? "var(--vertigo-success)" : formIndex >= 0.85 ? "var(--vertigo-warning)" : "var(--vertigo-danger)";
                            const pct = Math.round(formIndex * 100);
                            return (
                              <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
                                <div style={{ fontSize: "10px", fontWeight: 700, color, letterSpacing: "1px" }}>
                                  {pct >= 95 ? "🔥 Racha" : pct >= 85 ? "⚡ En forma" : "📉 Bajando"}
                                </div>
                                <div style={{ display: "flex", gap: "6px", fontSize: "10px", color: "var(--vertigo-faint)" }}>
                                  <span>{p.rating_rm_1v1_current} now</span>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CIVS DEL EQUIPO + TOP CIVS COMBINADAS */}
          <div className="vertigo-section">
            {/* Pool de civs elegidas */}
            <div style={{ marginBottom: "20px" }}>
              <div className="vertigo-subtitle">
                <Swords style={{ width: 14, height: 14 }} />
                Mi pool de civs
                <span className="vertigo-badge vertigo-badge-purple" style={{ marginLeft: "auto" }}>{baseCivs.length + extraCivs.length} / 12</span>
              </div>
              <div className="vertigo-card" style={{ padding: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: "8px" }}>
                  {[...baseCivs, ...extraCivs].map((civId, idx) => {
                    const isExtra = idx >= baseCivs.length;
                    return (
                      <div
                        key={civId}
                        title={CIV_NAMES[civId] ?? civId}
                        style={{
                          position: "relative",
                          opacity: isExtra ? 0.55 : 1,
                          transition: "transform 0.2s ease",
                          cursor: "default",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            paddingBottom: "100%", // aspect-ratio 1:1 via padding trick
                            position: "relative",
                            borderRadius: "10px",
                            overflow: "hidden",
                            border: `2px solid ${isExtra ? "var(--vertigo-line)" : "rgba(124,58,237,0.4)"}`,
                            background: "var(--vertigo-input-bg)",
                            boxShadow: isExtra ? "none" : "0 0 12px rgba(124,58,237,0.15)",
                          }}
                        >
                          <img
                            src={`/civs/${civId}.webp`}
                            alt={CIV_NAMES[civId] ?? civId}
                            style={{
                              position: "absolute", inset: 0, width: "100%", height: "100%",
                              objectFit: "cover",
                            }}
                          />
                          {/* Overlay gradiente en la parte inferior */}
                          <div style={{
                            position: "absolute", bottom: 0, left: 0, right: 0,
                            height: "40%",
                            background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.7))",
                          }} />
                        </div>
                        {isExtra && (
                          <div style={{
                            position: "absolute", bottom: "4px", left: "0", right: "0",
                            textAlign: "center", fontSize: "7px", fontWeight: 700,
                            letterSpacing: "1px", textTransform: "uppercase", color: "var(--vertigo-faint)",
                            zIndex: 2,
                          }}>
                            Extra
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Nombres debajo */}
                <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid var(--vertigo-line-soft)", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {baseCivs.map((civId) => (
                    <span key={civId} style={{ fontSize: "11px", color: "var(--vertigo-muted)" }}>
                      {CIV_NAMES[civId] ?? civId}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Top civs del equipo (combinando los 3 jugadores) */}
            {topTeamCivs.length > 0 && (
              <div>
                <div className="vertigo-subtitle">
                  <TrendingUp style={{ width: 14, height: 14 }} />
                  Civs más usadas del equipo
                  <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--vertigo-faint)", fontWeight: 500 }}>
                    AoE2 Companion RM 1v1
                  </span>
                </div>
                <div className="vertigo-card" style={{ padding: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {topTeamCivs.map((cs) => (
                      <div key={cs.civ} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "6px", overflow: "hidden", flex: "none", border: "1.5px solid var(--vertigo-line)" }}>
                          <img src={`/civs/${cs.civ}.webp`} alt={cs.civ} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--vertigo-text)" }}>{CIV_NAMES[cs.civ] ?? cs.civ}</div>
                        </div>
                        {/* Barra de winrate */}
                        <div style={{ width: "80px", flex: "none" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "var(--vertigo-faint)", marginBottom: "3px" }}>
                            <span>{cs.games}p</span>
                            <span style={{ color: cs.winrate >= 60 ? "var(--vertigo-success)" : cs.winrate >= 45 ? "var(--vertigo-purple-pale)" : "var(--vertigo-danger)", fontWeight: 700 }}>
                              {cs.winrate}%
                            </span>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.06)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{
                              height: "100%", width: `${cs.winrate}%`, borderRadius: "2px",
                              background: cs.winrate >= 60 ? "var(--vertigo-success)" : cs.winrate >= 45 ? "var(--vertigo-purple-soft)" : "var(--vertigo-danger)",
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== HISTORIAL DEL TORNEO ===== */}
        {pastMatches.length > 0 && (
          <div className="vertigo-section">
            <div className="vertigo-subtitle">
              <Trophy style={{ width: 14, height: 14 }} />
              Historial del torneo
            </div>
            <div className="vertigo-card" style={{ padding: 0, overflow: "hidden" }}>
              {pastMatches.map((m, idx) => {
                const isTeamA = m.team_a_id === latestReg?.id;
                const won = m.winner_team_id === latestReg?.id;
                const ourScore = isTeamA ? m.score_a : m.score_b;
                const theirScore = isTeamA ? m.score_b : m.score_a;
                // Obtener datos del sorteo si existe
                const gameData = m.games?.[0];
                const sorteoInfo = gameData
                  ? [gameData.game_mode, gameData.player_mode?.toUpperCase(), gameData.map].filter(Boolean).join(" · ")
                  : null;
                return (
                  <Link key={m.id} href={`/partido/${m.id}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: "16px",
                        padding: "16px 24px",
                        borderBottom: idx < pastMatches.length - 1 ? "1px solid var(--vertigo-line-soft)" : "none",
                        transition: "background 0.2s ease",
                      }}
                    >
                      {/* Indicador resultado */}
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "8px", flex: "none",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: won ? "rgba(34,197,94,0.12)" : "rgba(251,113,133,0.1)",
                        border: `1.5px solid ${won ? "rgba(34,197,94,0.35)" : "rgba(251,113,133,0.3)"}`,
                        fontFamily: "Cinzel, serif", fontSize: "16px", fontWeight: 700,
                        color: won ? "var(--vertigo-success)" : "var(--vertigo-danger)",
                      }}>
                        {won ? "V" : "D"}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--vertigo-text)" }}>
                          {isTeamA ? "vs Equipo B" : "vs Equipo A"}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--vertigo-faint)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span>{m.jornada_label ?? "Partido"}</span>
                          {sorteoInfo && (
                            <span style={{ color: "var(--vertigo-muted)", fontSize: "11px" }}>· {sorteoInfo}</span>
                          )}
                          {m.format && (
                            <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: "9px", padding: "2px 8px" }}>
                              {m.format}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Score */}
                      <div style={{
                        fontFamily: "Cinzel, serif", fontSize: "20px", fontWeight: 700,
                        color: won ? "var(--vertigo-success)" : "var(--vertigo-danger)",
                        flex: "none",
                      }}>
                        {ourScore}–{theirScore}
                      </div>
                      <ChevronRight style={{ width: 16, height: 16, color: "var(--vertigo-faint)", flex: "none" }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== PRÓXIMA PARTIDA ===== */}
        <div className="vertigo-section">
          <div className="vertigo-subtitle">
            <Calendar style={{ width: 14, height: 14 }} />
            Próxima partida
          </div>
          {upcomingMatch ? (
            <Link href="/mis-partidos" style={{ textDecoration: "none" }}>
              <div
                className="vertigo-link-card"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "20px 28px",
                  border: "1px solid rgba(124,58,237,0.35)",
                  background: "rgba(124,58,237,0.06)",
                  boxShadow: "0 0 24px rgba(124,58,237,0.1)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "12px",
                    background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Zap style={{ width: 24, height: 24, color: "var(--vertigo-purple-soft)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--vertigo-text)", fontFamily: "Cinzel, serif" }}>
                      {upcomingMatch.jornada_label ?? "Partido programado"}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--vertigo-muted)", marginTop: "3px", display: "flex", alignItems: "center", gap: "8px" }}>
                      {upcomingMatch.scheduled_at_start
                        ? new Date(upcomingMatch.scheduled_at_start).toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
                        : "Horario a confirmar"}
                      {upcomingMatch.format && (
                        <span className="vertigo-badge vertigo-badge-purple" style={{ fontSize: "10px", padding: "3px 10px" }}>
                          {upcomingMatch.format}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight style={{ width: 22, height: 22, color: "var(--vertigo-purple-soft)" }} />
              </div>
            </Link>
          ) : (
            <div className="vertigo-card">
              <div style={{ textAlign: "center", padding: "44px 20px", color: "var(--vertigo-faint)" }}>
                <Calendar style={{ width: "44px", height: "44px", margin: "0 auto 16px", display: "block", opacity: 0.35 }} strokeWidth={1} />
                <div style={{ fontFamily: "Cinzel, serif", fontSize: "18px", fontWeight: 600, color: "var(--vertigo-muted)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Sin partidos programados
                </div>
                <p style={{ fontSize: "14px", color: "var(--vertigo-faint)", maxWidth: "400px", margin: "0 auto", lineHeight: 1.6 }}>
                  {status === "approved"
                    ? "Cuando el bracket esté generado, tus partidos van a aparecer acá."
                    : "Tu inscripción está pendiente de aprobación. Una vez aprobada, verás tus partidos acá."}
                </p>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

function NotRegistered() {
  return (
    <div className="vertigo-page vertigo-shell">
      <main className="vertigo-content vertigo-scroll vertigo-fade-in">
        <div className="vertigo-page-title">
          <span className="vertigo-kicker">MI REINO</span>
          <h1 className="vertigo-title">Sin reino</h1>
        </div>
        <div className="vertigo-card" style={{ textAlign: "center", padding: "80px 24px", maxWidth: "560px", margin: "0 auto" }}>
          <Shield style={{ width: 72, height: 72, color: "var(--vertigo-faint)", margin: "0 auto 20px", display: "block", opacity: 0.3 }} strokeWidth={1} />
          <div style={{ fontFamily: "Cinzel, serif", fontSize: "22px", fontWeight: 600, color: "var(--vertigo-muted)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "1.5px" }}>
            No tenés reino todavía
          </div>
          <p style={{ fontSize: "15px", color: "var(--vertigo-faint)", maxWidth: "420px", margin: "0 auto 32px", lineHeight: 1.6 }}>
            Para acceder a esta página necesitás inscribir primero tu reino en el torneo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            <Link href="/registro">
              <button className="vertigo-btn vertigo-btn-primary" style={{ padding: "16px 40px", fontSize: "13px" }}>
                Inscribir mi reino →
              </button>
            </Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="vertigo-btn vertigo-btn-ghost" style={{ padding: "12px 24px", fontSize: "11px" }}>
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}