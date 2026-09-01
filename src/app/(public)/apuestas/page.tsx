import Link from "next/link";
import { redirect } from "next/navigation";
import { Coins, Trophy, Users, Swords, Ticket, Crown, Flame, XCircle, Undo2 } from "lucide-react";
import { getSupabaseServer, getSupabaseServiceRole } from "@/lib/supabase/server";
import { WELCOME_POINTS } from "@/lib/constants";
import { loadApuestasData, type MyBet } from "./apuestas-data";
import WelcomePointsModal from "./welcome-points-modal";
import LlaveCard from "./llave-card";
import VertigoFooter from "@/components/shared/vertigo-footer";
import SiteNav from "@/components/nav/site-nav";
import { ART_REY } from "@/lib/art";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

const BET_STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "En juego", cls: "vertigo-badge-purple" },
  won: { label: "Ganada", cls: "vertigo-badge-success" },
  lost: { label: "Perdida", cls: "vertigo-badge-danger" },
  voided: { label: "Reintegrada", cls: "vertigo-badge-warning" },
};

const MEDAL_BG = [
  "linear-gradient(170deg, rgba(212,175,55,0.24), rgba(212,175,55,0.05) 55%, rgba(212,175,55,0.02))",
  "linear-gradient(170deg, rgba(192,192,192,0.17), rgba(192,192,192,0.04) 55%, rgba(192,192,192,0.02))",
  "linear-gradient(170deg, rgba(205,127,50,0.17), rgba(205,127,50,0.04) 55%, rgba(205,127,50,0.02))",
];
const MEDAL_BORDER = ["rgba(212,175,55,0.6)", "rgba(192,192,192,0.45)", "rgba(205,127,50,0.45)"];
const MEDAL_TEXT = ["var(--vertigo-gold)", "#d4d4d8", "#e0a370"];

export default async function ApuestasPage() {
  const supabase = (await getSupabaseServer()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/registro-espectador");

  const { data: account } = (await supabase
    .from("account")
    .select("id, role, display_name")
    .eq("supabase_auth_id", user.id)
    .maybeSingle()) as { data: any };
  if (!account || account.role !== "spectator") redirect("/registro-espectador");

  // Agregados del pozo con service role (las bets ajenas no son públicas)
  let data: Awaited<ReturnType<typeof loadApuestasData>>;
  try {
    const admin = getSupabaseServiceRole() as any;
    data = await loadApuestasData(admin, account.id);
  } catch {
    data = { balance: 0, ranking: [], myRank: null, totalSpectators: 0, llaves: [], myBets: [] };
  }

  const totalPool = data.llaves.reduce((acc, l) => acc + l.pool, 0);
  const totalBettors = data.llaves.reduce((acc, l) => acc + l.bettors, 0);
  const sinApuesta = data.llaves.filter((l) => !l.myBet);
  const stakeEnJuego = data.myBets
    .filter((b) => b.status === "pending")
    .reduce((acc, b) => acc + b.stake, 0);
  const leaderBalance = data.ranking[0]?.balance ?? null;
  const gapToLeader =
    leaderBalance !== null && data.myRank !== null && data.myRank > 1
      ? Math.max(0, leaderBalance - data.balance)
      : 0;
  const soyLider = data.myRank === 1;

  return (
    <div className="vertigo-page vertigo-shell vertigo-fade-in">
      <WelcomePointsModal points={WELCOME_POINTS} />

      <SiteNav />

      <main className="vertigo-content">
        {/* ═══ HERO CINEMATOGRÁFICO — la mina de oro del espectador ═══ */}
        <section
          className="relative overflow-hidden rounded-2xl mb-8"
          style={{
            border: "1px solid rgba(212,175,55,0.28)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.5)",
          }}
        >
          <video
            src="/brand/mina-de-oro.mp4"
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            className="absolute inset-0"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 32%" }}
          />
          {/* Legibilidad: oscuro desde la izquierda + fundido al fondo de la página */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(7,0,17,0.95) 0%, rgba(7,0,17,0.78) 34%, rgba(7,0,17,0.30) 62%, rgba(7,0,17,0.06) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(7,0,17,0.30) 0%, transparent 30%, rgba(7,0,17,0.72) 72%, #0a0011 99%)",
            }}
          />

          <div
            className="relative z-10 flex flex-col justify-end"
            style={{ minHeight: 480, padding: "170px 38px 26px" }}
          >
            {/* Eyebrow + pozo en vivo */}
            <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
              <div className="flex items-center gap-3">
                <span style={{ height: 1, width: 28, background: "rgba(212,175,55,0.7)" }} />
                <span
                  className="text-[10px] uppercase font-bold"
                  style={{ letterSpacing: "4px", color: "var(--vertigo-gold)" }}
                >
                  Vértigo Cup · Apuestas de espectadores
                </span>
              </div>
              <span
                className="flex items-center gap-2 text-[11px] px-3.5 py-1.5 rounded-full"
                style={{
                  background: "rgba(7,0,17,0.55)",
                  border: "1px solid rgba(212,175,55,0.35)",
                  color: "var(--vertigo-muted)",
                  backdropFilter: "blur(6px)",
                }}
              >
                <span className="apu-live-dot apu-live-dot--gold" />
                <span className="font-cinzel font-bold text-[var(--vertigo-gold)]">
                  {totalPool.toLocaleString("es-AR")}
                </span>
                pts en juego ahora
              </span>
            </div>

            {/* Titular */}
            <h1
              className="font-cinzel font-bold"
              style={{
                fontSize: "clamp(30px, 4.6vw, 54px)",
                lineHeight: 0.98,
                color: "var(--vertigo-text)",
                textShadow: "0 6px 34px rgba(0,0,0,0.85)",
                maxWidth: 620,
              }}
            >
              La mina está abierta.
            </h1>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--vertigo-muted)",
                maxWidth: 500,
                marginTop: 10,
                textShadow: "0 2px 14px rgba(0,0,0,0.9)",
              }}
            >
              Cada llave es una veta: elegí al ganador, cargá tus puntos y el pozo se lo
              reparten entre los que aciertan.
            </p>

            {/* Rail de stats: el saldo manda, la posición acompaña. El pozo ya vive en el chip. */}
            <div
              className="flex items-end gap-x-8 gap-y-4 flex-wrap mt-7 pt-5"
              style={{ borderTop: "1px solid rgba(212,175,55,0.22)" }}
            >
              <div>
                <div
                  className="text-[9px] uppercase font-bold flex items-center gap-1.5"
                  style={{ letterSpacing: "3px", color: "var(--vertigo-faint)" }}
                >
                  <Coins style={{ width: 11, height: 11, color: "var(--vertigo-gold)" }} />
                  Tu saldo
                </div>
                <div
                  className="font-cinzel font-bold leading-none mt-1.5"
                  style={{ fontSize: 42, color: "var(--vertigo-gold)", textShadow: "0 0 28px rgba(212,175,55,0.4)" }}
                >
                  {data.balance.toLocaleString("es-AR")}
                  <span
                    className="text-[14px] ml-1.5 font-semibold"
                    style={{ color: "var(--vertigo-muted)", textShadow: "none" }}
                  >
                    pts
                  </span>
                </div>
                <div
                  className="text-[11px] mt-1.5"
                  style={{ color: data.myBets.length === 0 ? "var(--vertigo-success)" : "var(--vertigo-faint)" }}
                >
                  {data.myBets.length === 0 ? (
                    <>🎁 Bienvenida cargada: todo tuyo para apostar</>
                  ) : stakeEnJuego > 0 ? (
                    <>
                      <span className="text-[var(--vertigo-purple-pale)] font-bold">
                        {stakeEnJuego.toLocaleString("es-AR")}
                      </span>{" "}
                      pts en juego · el resto es tuyo
                    </>
                  ) : (
                    "todo tu saldo está disponible"
                  )}
                </div>
              </div>

              <span className="self-stretch hidden md:block" style={{ width: 1, background: "rgba(212,175,55,0.18)" }} />

              <div>
                <div
                  className="text-[9px] uppercase font-bold flex items-center gap-1.5"
                  style={{ letterSpacing: "3px", color: "var(--vertigo-faint)" }}
                >
                  <Trophy style={{ width: 11, height: 11 }} />
                  Tu posición
                </div>
                <div className="font-cinzel font-bold text-[26px] leading-none mt-1.5 text-[var(--vertigo-text)]">
                  {data.myRank ? `#${data.myRank}` : "—"}
                  <span className="text-[12px] ml-1 font-normal" style={{ color: "var(--vertigo-muted)" }}>
                    de {data.totalSpectators}
                  </span>
                </div>
                <div
                  className="text-[11px] mt-1.5"
                  style={{ color: soyLider ? "var(--vertigo-gold)" : "var(--vertigo-faint)" }}
                >
                  {soyLider ? (
                    <>👑 ¡Vas primero! Defendé la corona</>
                  ) : gapToLeader > 0 ? (
                    <>
                      A{" "}
                      <span className="font-bold" style={{ color: "var(--vertigo-gold)" }}>
                        {gapToLeader.toLocaleString("es-AR")} pts
                      </span>{" "}
                      del liderato 🏆
                    </>
                  ) : (
                    "sumá puntos acertando llaves"
                  )}
                </div>
              </div>

              {/* CTA de urgencia: llaves esperando mi apuesta */}
              {sinApuesta.length > 0 && (
                <Link
                  href={`/partido/${sinApuesta[0].matchId}`}
                  className="apu-cta ml-auto inline-flex items-center gap-2.5 flex-none"
                  style={{
                    padding: "14px 24px",
                    borderRadius: 12,
                    textDecoration: "none",
                  }}
                >
                  <Flame style={{ width: 16, height: 16, flexShrink: 0 }} />
                  <span className="font-cinzel font-bold uppercase text-[12px]" style={{ letterSpacing: "1.5px" }}>
                    {sinApuesta.length === 1
                      ? "1 llave espera tu apuesta"
                      : `Apostar en ${sinApuesta.length} llaves`}
                  </span>
                  <span className="font-cinzel font-bold text-[13px]">→</span>
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ═══ MIS APUESTAS — justo debajo del hero ═══ */}
        <section className="mb-10">
            <SectionHead
              title="Mis apuestas"
              caption={data.myBets.length > 0 ? `${data.myBets.length} jugadas` : undefined}
            />
            <div className="vertigo-card">
          {data.myBets.length === 0 ? (
            <div className="vertigo-empty" style={{ padding: "48px 24px" }}>
              <Ticket
                style={{ width: 40, height: 40, color: "var(--vertigo-faint)", margin: "0 auto 12px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Todavía no apostaste</div>
              <p className="vertigo-empty-desc">
                Elegí una llave abierta y jugate tus puntos. Acertar te multiplica.
              </p>
              {data.llaves.length > 0 && (
                <a href="#llaves" className="vertigo-btn vertigo-btn-primary mt-4">
                  Ver las llaves abiertas
                </a>
              )}
            </div>
          ) : (
            <>
              {/* mini-stats de la cartera */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  {
                    label: "En juego",
                    value: stakeEnJuego.toLocaleString("es-AR"),
                    unit: "pts",
                    tint: "var(--vertigo-purple-pale)",
                  },
                  {
                    label: "Acertadas",
                    value: String(data.myBets.filter((b) => b.status === "won").length),
                    unit: null as string | null,
                    tint: data.myBets.some((b) => b.status === "won")
                      ? "var(--vertigo-success)"
                      : "var(--vertigo-text)",
                  },
                  {
                    label: "Jugadas",
                    value: String(data.myBets.length),
                    unit: null as string | null,
                    tint: "var(--vertigo-text)",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-lg text-center py-2"
                    style={{ background: "rgba(124,58,237,0.06)", border: "1px solid var(--vertigo-line-soft)" }}
                  >
                    <div className="font-cinzel font-bold text-[16px] leading-none" style={{ color: s.tint }}>
                      {s.value}
                      {s.unit && <span className="text-[9px] font-normal ml-0.5">{s.unit}</span>}
                    </div>
                    <div
                      className="text-[9px] uppercase tracking-[1.5px] mt-1.5"
                      style={{ color: "var(--vertigo-faint)" }}
                    >
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {data.myBets.map((b) => (
                  <MyBetRow key={b.id} bet={b} />
                ))}
              </div>
            </>
          )}
        </div>
        </section>

        {/* ═══ LLAVES ABIERTAS ═══ */}
        <span id="llaves" className="block -mt-24 pt-24" aria-hidden />
        <SectionHead
          title="Llaves abiertas"
          caption={
            data.llaves.length > 0
              ? `${totalBettors} apuestas activas · las cuotas se mueven con cada apuesta`
              : undefined
          }
        />
        {data.llaves.length === 0 ? (
          <div className="vertigo-card">
            <div className="vertigo-empty">
              <Swords
                style={{ width: 48, height: 48, color: "var(--vertigo-faint)", margin: "0 auto 16px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">No hay llaves abiertas</div>
              <p className="vertigo-empty-desc">
                Cuando el bracket genere la próxima ronda, vas a poder apostar acá. Las
                apuestas cierran en el momento en que la llave abre.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}
          >
            {data.llaves.map((l) => (
              <LlaveCard key={l.matchId} llave={l} />
            ))}
          </div>
        )}

        {/* ═══ RANKING — ancho completo, el rey respira ═══ */}
        <section className="mt-10 mb-10">
            <SectionHead
              title="Ranking de espectadores"
              caption={leaderBalance !== null ? "el #1 se lleva el premio del staff" : undefined}
              gold
            />
            <div className="vertigo-card" style={{ padding: 0, display: "flex", alignItems: "stretch" }}>
              {/* IZQUIERDA — la imagen de la caja: el rey mirando su reino */}
              <div className="relative hidden md:block flex-none" style={{ width: "38%", minHeight: 440 }}>
                <img
                  src={ART_REY}
                  alt=""
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "20% 28%",
                  }}
                />
                {/* fundido hacia el contenido + anclaje inferior */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, rgba(13,9,19,0) 55%, rgba(13,9,19,0.94) 100%)",
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(0deg, rgba(10,0,17,0.88) 0%, rgba(10,0,17,0) 38%)",
                  }}
                />
                <div style={{ position: "absolute", left: 24, right: 24, bottom: 20 }}>
                  <div style={{ width: 26, height: 1, background: "rgba(212,175,55,0.7)", marginBottom: 9 }} />
                  <div
                    className="font-cinzel font-bold"
                    style={{ fontSize: 13, letterSpacing: 2.5, textTransform: "uppercase", color: "var(--vertigo-gold)" }}
                  >
                    El trono del pozo
                  </div>
                  <div className="text-[11px] mt-1" style={{ color: "var(--vertigo-muted)" }}>
                    Algunas guerras son físicas, otras comerciales.
                  </div>
                </div>
              </div>

              {/* DERECHA — el ranking */}
              <div className="relative flex-1 min-w-0" style={{ padding: 28 }}>
          {data.ranking.length === 0 ? (
            <div className="vertigo-empty" style={{ padding: "48px 24px" }}>
              <Trophy
                style={{ width: 40, height: 40, color: "var(--vertigo-faint)", margin: "0 auto 12px" }}
                strokeWidth={1}
              />
              <div className="vertigo-empty-title">Sin apostadores todavía</div>
              <p className="vertigo-empty-desc">La primera apuesta arranca el ranking.</p>
            </div>
          ) : (
            <>
              {/* PODIO escalonado: el 1° se levanta sobre los otros dos */}
              <div className="grid grid-cols-3 gap-3 mb-5 items-end">
                {data.ranking.slice(0, 3).map((r, idx) => {
                  const isGold = idx === 0;
                  return (
                    <div
                      key={r.accountId}
                      className="relative rounded-xl flex flex-col items-center justify-end text-center overflow-hidden"
                      style={{
                        minHeight: isGold ? 172 : idx === 1 ? 148 : 132,
                        padding: "14px 8px 12px",
                        background: MEDAL_BG[idx],
                        border: `1px solid ${MEDAL_BORDER[idx]}`,
                        boxShadow: isGold ? "0 0 30px rgba(212,175,55,0.16)" : undefined,
                      }}
                    >
                      <span
                        className="absolute top-2 left-2.5 font-cinzel font-bold text-[11px]"
                        style={{ color: MEDAL_TEXT[idx], opacity: 0.85 }}
                      >
                        #{idx + 1}
                      </span>
                      {isGold && (
                        <Crown
                          style={{
                            width: 22,
                            height: 22,
                            color: "var(--vertigo-gold)",
                            marginBottom: 6,
                            filter: "drop-shadow(0 0 10px rgba(212,175,55,0.6))",
                          }}
                          fill="rgba(212,175,55,0.4)"
                        />
                      )}
                      <span
                        className="flex items-center justify-center rounded-full font-cinzel font-bold mb-2"
                        style={{
                          width: isGold ? 42 : 36,
                          height: isGold ? 42 : 36,
                          fontSize: isGold ? 16 : 14,
                          color: MEDAL_TEXT[idx],
                          background: "rgba(10,6,17,0.55)",
                          border: `1px solid ${MEDAL_BORDER[idx]}`,
                        }}
                      >
                        {(r.displayName?.[0] ?? "?").toUpperCase()}
                      </span>
                      <span
                        className="text-[12px] font-semibold text-[var(--vertigo-text)] max-w-full truncate px-1"
                        title={r.displayName}
                      >
                        {r.displayName}
                        {r.isMe && (
                          <span
                            className="ml-1 text-[9px] uppercase tracking-widest"
                            style={{ color: "var(--vertigo-purple-soft)" }}
                          >
                            vos
                          </span>
                        )}
                      </span>
                      <span
                        className="font-cinzel font-bold leading-none mt-1.5"
                        style={{ fontSize: isGold ? 21 : 17, color: isGold ? "var(--vertigo-gold)" : "var(--vertigo-text)" }}
                      >
                        {r.balance.toLocaleString("es-AR")}
                        <span className="text-[10px] ml-1 font-normal" style={{ color: "var(--vertigo-faint)" }}>
                          pts
                        </span>
                      </span>
                      {r.wins > 0 && (
                        <span
                          className="mt-2 text-[9px] uppercase font-bold rounded-full px-2 py-0.5"
                          style={{
                            letterSpacing: "1px",
                            color: "var(--vertigo-success)",
                            border: "1px solid rgba(34,197,94,0.35)",
                            background: "rgba(34,197,94,0.08)",
                          }}
                        >
                          🎯 {r.wins} {r.wins === 1 ? "acierto" : "aciertos"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resto de la mesa: barra de oro relativa al líder */}
              {data.ranking.length > 3 && (
                <div className="flex flex-col gap-1.5">
                  {data.ranking.slice(3).map((r, idx) => {
                    const rank = idx + 4;
                    const pct = leaderBalance ? Math.max(4, Math.round((r.balance / leaderBalance) * 100)) : 0;
                    return (
                      <div
                        key={r.accountId}
                        className="rounded-lg px-3 py-2.5"
                        style={{
                          background: r.isMe ? "rgba(124,58,237,0.12)" : "rgba(255,255,255,0.015)",
                          border: r.isMe ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="flex items-center justify-center flex-none font-cinzel font-bold rounded-lg"
                            style={{ width: 30, height: 30, fontSize: 12, color: "var(--vertigo-muted)", border: "1px solid var(--vertigo-line)" }}
                          >
                            {rank}
                          </span>
                          <span
                            className="flex items-center justify-center flex-none rounded-full font-cinzel font-bold"
                            style={{
                              width: 28,
                              height: 28,
                              fontSize: 11,
                              color: "var(--vertigo-purple-soft)",
                              background: "rgba(124,58,237,0.12)",
                              border: "1px solid rgba(124,58,237,0.3)",
                            }}
                          >
                            {(r.displayName?.[0] ?? "?").toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[13px] text-[var(--vertigo-text)] truncate">
                                {r.displayName}
                                {r.isMe && (
                                  <span
                                    className="ml-1.5 text-[9px] uppercase tracking-widest"
                                    style={{ color: "var(--vertigo-purple-soft)" }}
                                  >
                                    vos
                                  </span>
                                )}
                              </span>
                              {r.wins > 0 && (
                                <span
                                  className="text-[9px] flex-none"
                                  style={{ color: "var(--vertigo-success)" }}
                                  title={`${r.wins} ${r.wins === 1 ? "llave acertada" : "llaves acertadas"}`}
                                >
                                  🎯 {r.wins}
                                </span>
                              )}
                            </div>
                            <div
                              className="h-[3px] rounded-full mt-1.5 overflow-hidden"
                              style={{ background: "var(--vertigo-line-soft)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pct}%`,
                                  background: r.isMe
                                    ? "linear-gradient(90deg, #7c3aed, #a855f7)"
                                    : "linear-gradient(90deg, rgba(212,175,55,0.7), rgba(212,175,55,0.25))",
                                }}
                              />
                            </div>
                          </div>
                          <div className="text-right flex-none">
                            <div className="font-cinzel font-bold text-[15px] leading-none text-[var(--vertigo-purple-pale)]">
                              {r.balance.toLocaleString("es-AR")}
                            </div>
                            {r.enJuego > 0 && (
                              <div className="text-[9px] mt-1" style={{ color: "var(--vertigo-faint)" }}>
                                {r.enJuego.toLocaleString("es-AR")} en juego
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Goal gradient: brecha al líder / defendiendo corona */}
              {data.myRank !== null && data.ranking.length > 0 && (
                <div
                  className="mt-4 px-4 py-3 rounded-lg text-[12px] flex items-center gap-2"
                  style={{
                    background: soyLider ? "rgba(212,175,55,0.08)" : "rgba(124,58,237,0.07)",
                    border: soyLider ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(124,58,237,0.35)",
                    color: "var(--vertigo-muted)",
                  }}
                >
                  {soyLider ? (
                    <>
                      <Crown style={{ width: 14, height: 14, color: "var(--vertigo-gold)", flexShrink: 0 }} />
                      Vas primero con {data.balance.toLocaleString("es-AR")} pts. Al final del torneo, el premio es tuyo… si aguantás.
                    </>
                  ) : (
                    <>
                      <Flame style={{ width: 14, height: 14, color: "var(--vertigo-warning)", flexShrink: 0 }} />
                      Una llave acertada puede escalarte varios puestos. A {gapToLeader > 0 ? gapToLeader.toLocaleString("es-AR") : "algunos"} pts del #1.
                    </>
                  )}
                </div>
              )}
            </>
          )}
          <div className="mt-4 pt-3 border-t border-[var(--vertigo-line-soft)] flex items-center gap-2 text-[11px] text-[var(--vertigo-faint)]">
            <Users style={{ width: 12, height: 12, color: "var(--vertigo-muted)", flexShrink: 0 }} />
            El espectador con más puntos al final del torneo gana un premio del staff.
          </div>
              </div>
            </div>
          </section>

        {/* ═══ FOOTER CINEMATOGRÁFICO ═══ */}
        <VertigoFooter tagline="Algunas guerras son físicas, otras comerciales." />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Header de sección editorial: título Cinzel + regla degradada + caption
// ─────────────────────────────────────────────────────────────

function SectionHead({ title, caption, gold }: { title: string; caption?: string; gold?: boolean }) {
  return (
    <div className="flex items-center gap-4 mb-4 mt-1">
      <h2
        className="font-cinzel font-bold text-[19px] tracking-wide whitespace-nowrap"
        style={{ color: "var(--vertigo-text)" }}
      >
        {title}
      </h2>
      <span
        className="flex-1 h-px"
        style={{
          background: gold
            ? "linear-gradient(90deg, rgba(212,175,55,0.45), transparent)"
            : "linear-gradient(90deg, rgba(124,58,237,0.45), transparent)",
        }}
      />
      {caption && (
        <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--vertigo-faint)" }}>
          {caption}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Fila de apuesta propia
// ─────────────────────────────────────────────────────────────

const BET_VISUAL: Record<string, { rail: string; bg: string }> = {
  pending: { rail: "rgba(124,58,237,0.9)", bg: "rgba(124,58,237,0.09)" },
  won: { rail: "var(--vertigo-success)", bg: "rgba(34,197,94,0.08)" },
  lost: { rail: "var(--vertigo-danger)", bg: "rgba(239,68,68,0.07)" },
  voided: { rail: "var(--vertigo-warning)", bg: "rgba(245,158,11,0.07)" },
};

function MyBetRow({ bet }: { bet: MyBet }) {
  const meta = BET_STATUS_META[bet.status] ?? BET_STATUS_META.pending;
  const v = BET_VISUAL[bet.status] ?? BET_VISUAL.pending;
  const fecha = bet.placedAt ? fmt.dayMon(bet.placedAt) : null;

  return (
    <Link
      href={`/partido/${bet.matchId}`}
      className="relative flex items-center gap-3 rounded-xl overflow-hidden transition-all hover:-translate-y-px"
      style={{
        textDecoration: "none",
        padding: "12px 14px",
        background: v.bg,
        border: "1px solid var(--vertigo-line)",
      }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: v.rail }} aria-hidden />

      {/* sello de estado */}
      <span
        className="relative flex-none flex items-center justify-center rounded-full"
        style={{ width: 30, height: 30, background: "rgba(10,6,17,0.8)", border: `1px solid ${v.rail}` }}
      >
        {bet.status === "pending" && <span className="apu-live-dot" />}
        {bet.status === "won" && (
          <Trophy style={{ width: 14, height: 14, color: "var(--vertigo-success)" }} fill="rgba(34,197,94,0.25)" />
        )}
        {bet.status === "lost" && <XCircle style={{ width: 14, height: 14, color: "var(--vertigo-danger)" }} />}
        {bet.status === "voided" && <Undo2 style={{ width: 14, height: 14, color: "var(--vertigo-warning)" }} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[13px] truncate">
          <span className="font-semibold text-[var(--vertigo-text)]">{bet.pickedTeamName}</span>
          {bet.opponentName && <span className="text-[var(--vertigo-faint)]"> vs {bet.opponentName}</span>}
        </div>
        <div className="text-[10.5px] text-[var(--vertigo-faint)] mt-0.5 truncate">
          {bet.matchLabel ?? "Llave"} · apostaste{" "}
          <span className="font-bold text-[var(--vertigo-purple-pale)]">{bet.stake.toLocaleString("es-AR")} pts</span>
          {fecha && <> · {fecha}</>}
        </div>
        {bet.status === "pending" && (
          <div className="text-[11px] font-bold mt-1">
            {bet.cobroSiGana != null ? (
              <span className="text-[var(--vertigo-success)]">
                Si gana → +{bet.cobroSiGana.toLocaleString("es-AR")} pts
                <span className="font-normal text-[var(--vertigo-faint)]"> a cuota ×{bet.cuota?.toFixed(2)}</span>
              </span>
            ) : (
              <span className="text-[var(--vertigo-muted)]">Cuota por definir — se mueve con cada apuesta</span>
            )}
          </div>
        )}
      </div>

      <div className="flex-none flex flex-col items-end gap-1">
        {bet.status === "won" && (
          <span className="font-cinzel font-bold text-[15px] text-[var(--vertigo-success)]">
            +{bet.payout.toLocaleString("es-AR")}
          </span>
        )}
        {bet.status === "lost" && (
          <span className="font-cinzel font-bold text-[15px]" style={{ color: "rgba(239,68,68,0.75)" }}>
            −{bet.stake.toLocaleString("es-AR")}
          </span>
        )}
        {bet.status === "voided" && (
          <span className="font-cinzel font-bold text-[15px] text-[var(--vertigo-warning)]">
            +{bet.stake.toLocaleString("es-AR")}
          </span>
        )}
        <span className={`vertigo-badge ${meta.cls} badge-thin`}>{meta.label}</span>
      </div>
    </Link>
  );
}
