"use client";

/**
 * VÉRTIGO Cup — TUTORIAL · escenas
 *
 * Cada escena es un fragmento de UI que reproduce un momento del flujo
 * de una LLAVE en modo demo. Las escenas "event" (ruleta, memotest, intro,
 * final) avisan al director con ctx.onDone(); las "timed" avanza el reloj.
 */

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar, Check, Dices, Shield, Trophy, Timer, Users,
} from "lucide-react";
import Memotest, { type MemotestCard } from "@/components/memotest/memotest";
import { ConfigProvider } from "@/lib/ruleta/config";
import {
  DEMO_FORCED, DEMO_RESULT, DEMO_REROLL_MAP_ID,
  TEAM_A, TEAM_B, civImg, civName,
  type DemoSceneCtx, type DemoTeam,
} from "./demo-data";

const Roulette = dynamic(
  () => import("@/components/ruleta/roulette").then((m) => m.Roulette),
  { ssr: false, loading: () => <SceneLoading text="Forjando la ruleta…" /> }
);

/** Avanza un reloj interno respetando el speed del director */
function useDemoClock(speed: number): number {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const d = now - last;
      last = now;
      setMs((v) => v + d * speed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return ms;
}

function SceneLoading({ text }: { text: string }) {
  return (
    <div className="tut-full grid place-items-center" style={{ color: "#c4b5fd", fontFamily: "var(--font-rajdhani)", fontSize: 13, letterSpacing: "0.3em" }}>
      {text.toUpperCase()}
    </div>
  );
}

function MockWindow({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="tut-mock">
      <div className="tut-mock-bar">
        <span className="d r" /><span className="d y" /><span className="d g" />
        <span className="url">{url}</span>
      </div>
      <div className="tut-mock-body">{children}</div>
    </div>
  );
}

function AutoButton({ label, doneLabel, delay, speed }: { label: React.ReactNode; doneLabel: React.ReactNode; delay: number; speed: number }) {
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setClicked(true), delay / speed);
    return () => clearTimeout(t);
  }, [delay, speed]);
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button className={`tut-listo ${clicked ? "done" : ""}`}>
        {clicked ? (
          <><Check className="check-mark" style={{ width: 16, height: 16, display: "inline", verticalAlign: "-3px" }} />{doneLabel}</>
        ) : label}
      </button>
      {clicked && <span className="tut-click-ripple" />}
    </div>
  );
}

function TeamCard({ team, ready, compact }: { team: DemoTeam; ready?: boolean; compact?: boolean }) {
  return (
    <div className="tut-teamcard" style={{ "--team-color": team.color } as React.CSSProperties}>
      <img className="emb" src={team.emblem} alt={team.name} />
      <div className="tname">{team.name}</div>
      <div className="tseed">SEED #{team.seed}</div>
      <div className="ttag">{team.tag}</div>
      {!compact && (
        <ul className="players">
          {team.players.map((p) => (
            <li key={p.name} className={p.isCaptain ? "captain" : ""}>
              <span>{p.name}</span>
              <em>{p.tag}</em>
            </li>
          ))}
        </ul>
      )}
      {ready && (
        <div className="tut-chip live" style={{ marginTop: 8 }}>● LISTO</div>
      )}
    </div>
  );
}

// ============================================================
// 0. INTRO
// ============================================================
export function SceneIntro({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const showCards = ms > 1600;
  useEffect(() => {
    if (ms > 5800) ctx.onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms > 5800]);
  return (
    <div className="tut-intro">
      <img className="tut-intro-logo" src="/logo.png" alt="VÉRTIGO Cup" />
      <h2>TUTORIAL <span>EN VIVO</span></h2>
      <p style={{ color: "var(--tut-muted)", fontFamily: "var(--font-rajdhani)", letterSpacing: "0.3em", fontSize: 12, textTransform: "uppercase", margin: 0 }}>
        Cómo se vive una LLAVE del torneo · punto por punto
      </p>
      {showCards && (
        <div className="tut-vs" style={{ animation: "tut-pop 0.5s ease both" }}>
          <TeamCard team={TEAM_A} compact />
          <div className="tut-vs-sep">VS</div>
          <TeamCard team={TEAM_B} compact />
        </div>
      )}
    </div>
  );
}

// ============================================================
// 1. ADMIN agenda la llave
// ============================================================
export function SceneAdminAgenda({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const step = (d: number) => Math.min(1, Math.max(0, (ms - d) / 500));
  return (
    <MockWindow url="vertigo-cup.vercel.app/admin/partido">
      <div className="tut-row">
        <div>
          <div className="tut-mock-title">Ronda 1 · Llave 08 — Crear</div>
          <div className="tut-mock-sub">El staff fija el cronograma del torneo.</div>
          <div className="tut-chip-group" style={{ opacity: step(300) }}>
            <span className="tut-chip purple"><Calendar style={{ width: 12, height: 12, display: "inline", marginRight: 6, verticalAlign: "-2px" }} />Sáb 21 mar · 19:00</span>
            <span className="tut-chip">Jornada 2</span>
            <span className="tut-chip">Eliminación directa</span>
          </div>
        </div>
        <AutoButton speed={ctx.speed} delay={2600} label="AGENDAR" doneLabel="AGENDADO" />
      </div>
      <div className="tut-vs" style={{ marginTop: 26, opacity: step(1200) }}>
        <TeamCard team={TEAM_A} compact />
        <div className="tut-vs-sep">VS</div>
        <TeamCard team={TEAM_B} compact />
      </div>
    </MockWindow>
  );
}

// ============================================================
// 2. T-15: la llave se abre
// ============================================================
export function SceneT15({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const opened = ms > 3200;
  const remaining = Math.max(0, Math.ceil((8000 - ms) / 1000));
  return (
    <MockWindow url="vertigo-cup.vercel.app/admin/partido/08">
      <div style={{ textAlign: "center" }}>
        <div className="tut-window-timer" style={{ color: opened ? "#4ade80" : undefined }}>
          {opened ? "ABIERTA" : `T-${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}
        </div>
        <div className="tut-mock-title" style={{ textAlign: "center" }}>
          {opened ? "Llave abierta — esperando READY #1 de ambos equipos" : "La llave se abre automáticamente"}
        </div>
        <div className="tut-mock-sub" style={{ textAlign: "center" }}>
          {opened
            ? "Todos los viewer reciben el estado nuevo por Realtime al instante."
            : "El sistema dispara la apertura 15 minutos antes. Nadie toca nada."}
        </div>
        <div className="tut-chip-group" style={{ justifyContent: "center" }}>
          <span className={`tut-chip ${opened ? "live" : "purple"}`}>{opened ? "● ABIERTA" : "SCHEDULED"}</span>
          <span className="tut-chip">{opened ? "REALTIME → web de los equipos" : "CRON: abierto en 15 min"}</span>
        </div>
      </div>
    </MockWindow>
  );
}

// ============================================================
// 3-4. READY #1 desde el POV de cada capitán
// ============================================================
export function SceneReady({ ctx, team }: { ctx: DemoSceneCtx; team: DemoTeam }) {
  const rival = team.id === "A" ? TEAM_B : TEAM_A;
  const rivalReady = team.id === "B"; // cuando le toca a B, A ya está listo
  return (
    <MockWindow url={`vertigo-cup.vercel.app/mis-partidos`}>
      <div className="tut-row">
        <div>
          <div className="tut-mock-title">Tu partida — vs {rival.name}</div>
          <div className="tut-mock-sub">
            {team.id === "A"
              ? "La llave está abierta. Toca [LISTO] para confirmar presencia."
              : "El rival ya confirmó. Tu confirmación habilita el sorteo."}
          </div>
          <div className="tut-chip-group">
            <span className={`tut-chip ${rivalReady ? "live" : "purple"}`}>
              {rival.name} {rivalReady ? "LISTO" : "—"}
            </span>
            <span className={`tut-chip ${team.id === "B" ? "live" : "purple"}`}>
              {team.name} LISTO (auto)
            </span>
          </div>
        </div>
        <AutoButton
          speed={ctx.speed}
          delay={3000}
          label={<><Shield style={{ width: 16, height: 16, display: "inline", marginRight: 8, verticalAlign: "-3px" }} />LISTO</>}
          doneLabel="LISTO ✓"
        />
      </div>
    </MockWindow>
  );
}

// ============================================================
// 5. ADMIN dispara el sorteo
// ============================================================
export function SceneAdminDraw({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const fired = ms > 3400;
  return (
    <MockWindow url="vertigo-cup.vercel.app/admin/partido/08">
      <div className="tut-row">
        <div>
          <div className="tut-mock-title">Partida 1 — Sorteo</div>
          <div className="tut-mock-sub">Ambos equipos LISTO. El commit-reveal ya está firmado.</div>
          <div className="tut-chip-group">
            <span className="tut-chip purple">FAIRNESS: SHA-256 ✓</span>
            <span className="tut-chip">SEED firmada</span>
            <span className={`tut-chip ${fired ? "live" : "gold"}`}>{fired ? "● SORTEANDO" : "DRAFT listo"}</span>
          </div>
        </div>
        <AutoButton
          speed={ctx.speed}
          delay={3400}
          label={<><Dices style={{ width: 16, height: 16, display: "inline", marginRight: 8, verticalAlign: "-3px" }} />INICIAR SORTEO</>}
          doneLabel="GIRANDO…"
        />
      </div>
    </MockWindow>
  );
}

// ============================================================
// 6. RULETA (componente real, resultado forzado)
// ============================================================
export function SceneRoulette({ ctx }: { ctx: DemoSceneCtx }) {
  const doneRef = useRef(false);
  return (
    <div className="tut-full">
      <ConfigProvider>
        <Roulette
          key="main-draw"
          forced={DEMO_FORCED}
          autoStart
          configOverride={{ firstRound: true }}
          interactive={false}
          onResult={() => {
            if (doneRef.current) return;
            doneRef.current = true;
            window.setTimeout(ctx.onDone, 400);
          }}
        />
      </ConfigProvider>
    </div>
  );
}

// ============================================================
// 7. MEMOTEST (componente real)
// ============================================================
export function SceneMemotest({ ctx }: { ctx: DemoSceneCtx }) {
  const [side, setSide] = useState<"A" | "B">("A");
  const [trigger, setTrigger] = useState(false);
  const revealedA = useRef<string[]>([]);
  const revealedB = useRef<string[]>([]);
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);
  const advanceTimer = useRef<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTrigger(true), 900);
    return () => {
      clearTimeout(t);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  const team = side === "A" ? TEAM_A : TEAM_B;
  const cards: MemotestCard[] = team.civPool.map((civId) => ({
    id: `${team.id}-${civId}`,
    civId,
    civName: civName(civId),
    civImageUrl: civImg(civId),
  }));

  const handleCivDrawn = (civ: MemotestCard) => {
    if (side === "A") revealedA.current = [...revealedA.current, civ.civId];
    else revealedB.current = [...revealedB.current, civ.civId];
    setCount((c) => c + 1);

    const teamCount = side === "A" ? revealedA.current.length : revealedB.current.length;
    if (teamCount >= 2) {
      advanceTimer.current = window.setTimeout(() => {
        if (side === "A") {
          setSide("B");
        } else if (!doneRef.current) {
          doneRef.current = true;
          ctx.setDemo((p) => ({ ...p, civsA: [...revealedA.current], civsB: [...revealedB.current] }));
          window.setTimeout(ctx.onDone, 400);
        }
      }, 1400 / ctx.speed);
    }
  };

  return (
    <div className="tut-full">
      <div className="tut-memo-wrap tut-memo-wrap-override">
        <div className="tut-memo-head">
          <span className={`sidea ${side === "A" ? "on" : ""}`}>{TEAM_A.name}</span>
          <span className="vs">VS</span>
          <span className={`sideb ${side === "B" ? "on" : ""}`}>{TEAM_B.name}</span>
        </div>
        <div className="tut-memo-scroller">
          <Memotest
            key={side}
            cards={cards}
            civsToDraw={2}
            teamSide={side}
            alreadyDrawn={side === "A" ? revealedA.current : revealedB.current}
            trigger={trigger}
            onCivDrawn={handleCivDrawn}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 8. Summary split-screen
// ============================================================
export function SceneSummary({ ctx }: { ctx: DemoSceneCtx }) {
  const civsA = ctx.demo.civsA.length ? ctx.demo.civsA : TEAM_A.civPool.slice(0, 2);
  const civsB = ctx.demo.civsB.length ? ctx.demo.civsB : TEAM_B.civPool.slice(0, 2);
  const mapIsReroll = ctx.demo.mapId === DEMO_REROLL_MAP_ID;
  const items = [
    { label: "MODO", value: DEMO_RESULT.mode, img: "/modes/game-mode/guerras-imperiales.webp", color: "#d8a13f" },
    { label: "FORMATO", value: DEMO_RESULT.format, img: "/modes/player-mode/2vs2.webp", color: "#22e5c2" },
    {
      label: mapIsReroll ? "MAPA · RE-GIRADO" : "MAPA",
      value: mapIsReroll ? DEMO_RESULT.mapReroll : DEMO_RESULT.map,
      img: mapIsReroll ? "/modes/maps/cuatro-lagos.webp" : "/modes/maps/crater.webp",
      color: mapIsReroll ? "#22e5c2" : "#ff6b00",
    },
    { label: "LLAVE", value: DEMO_RESULT.llave, img: "/modes/llave/bo3.webp", color: "#22e5c2" },
  ];
  return (
    <div style={{ width: "min(880px, 94%)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {items.map((it) => (
          <div key={it.label} className="tut-map-card" style={{ background: "var(--tut-panel)", borderTop: `3px solid ${it.color}`, borderRadius: 8, padding: 14 }}>
            <div className="imgw" style={{ height: 74 }}><img src={it.img} alt={it.value} /></div>
            <div style={{ fontSize: 10, color: "var(--tut-faint)" }}>{it.label}</div>
            <div>{it.value}</div>
          </div>
        ))}
      </div>
      <div className="tut-vs" style={{ marginTop: 26, gridTemplateColumns: "1fr auto 1fr" }}>
        <div className="tut-teamcard" style={{ "--team-color": TEAM_A.color } as React.CSSProperties}>
          <div className="tseed">{TEAM_A.name}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {civsA.map((c) => (
              <span key={c} className="tut-civ-pill"><img src={civImg(c)} alt="" />{civName(c)}</span>
            ))}
          </div>
        </div>
        <div className="tut-vs-sep">VS</div>
        <div className="tut-teamcard" style={{ "--team-color": TEAM_B.color } as React.CSSProperties}>
          <div className="tseed">{TEAM_B.name}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {civsB.map((c) => (
              <span key={c} className="tut-civ-pill"><img src={civImg(c)} alt="" />{civName(c)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 9-10. Lineup
// ============================================================
export function SceneLineup({ ctx, team }: { ctx: DemoSceneCtx; team: DemoTeam }) {
  const ms = useDemoClock(ctx.speed);
  const picked = ms > 1800;
  const confirmed = ms > 3800;
  const picks = team.players.filter((p) => !p.isCaptain); // 2 vs 2: juegan 2 (en la demo entran el rusher y el capitán)
  const lineupPicks = team.id === "A" ? [team.players[0], team.players[1]] : picks;
  return (
    <MockWindow url="vertigo-cup.vercel.app/mis-partidos">
      <div className="tut-mock-title">Declarar lineup de {team.name}</div>
      <div className="tut-mock-sub">El formato salió 2 VS 2 → declará quiénes entran al mapa.</div>
      <div className="tut-chip-group" style={{ marginBottom: 18 }}>
        {team.players.map((p) => {
          const plays = lineupPicks.some((x) => x.name === p.name);
          const active = picked && plays;
          return (
            <span
              key={p.name}
              className={`tut-chip ${active ? "live" : ""}`}
              style={picked && !plays ? { opacity: 0.4, textDecoration: "line-through" } : undefined}
            >
              {p.name} {active ? "· JUEGA" : ""}
            </span>
          );
        })}
      </div>
      <AutoButton
        speed={ctx.speed}
        delay={confirmed ? 0 : 3800}
        label={<><Users style={{ width: 16, height: 16, display: "inline", marginRight: 8, verticalAlign: "-3px" }} />CONFIRMAR READY #2</>}
        doneLabel="READY #2 ✓"
      />
    </MockWindow>
  );
}

// ============================================================
// 11. Ventana de comodines
// ============================================================
export function SceneComodin({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const secondsLeft = Math.max(0, 300 - Math.floor(ms / 1000));
  const usedReroll = ms > 5200;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const items = [
    { img: "/comodin-regirar.png", label: "RE-GIRAR", times: "×2", disabled: false, used: usedReroll },
    { img: "/comodin-anular.png", label: "ANULAR", times: "×1", disabled: usedReroll, used: false },
    { img: "/comodin-elegir.png", label: "ELEGIR RIVAL", times: "×1", disabled: usedReroll, used: false },
    { img: "/comodin-invocar.png", label: "INVOCAR PRO", times: "×1", disabled: true, used: false },
  ];
  return (
    <div style={{ textAlign: "center", width: "min(760px, 94%)" }}>
      <div className="tut-window-timer"><Timer style={{ width: 26, height: 26, display: "inline", marginRight: 10, verticalAlign: -4 }} />{usedReroll ? "PAUSA" : `${mm}:${ss}`}</div>
      <div className="tut-mock-sub" style={{ textAlign: "center" }}>
        {usedReroll
          ? "ORDEN DEL CUERVO usa RE-GIRAR (MAPA). El timer se pausa mientras el ADMIN ejecuta el giro."
          : "Ventana de 5 minutos. El primero en llegar se ejecuta primero."}
      </div>
      <div className="tut-comodines">
        {items.map((it) => (
          <div key={it.label} className={`tut-comod ${it.used ? "used" : ""} ${it.disabled ? "disabled" : ""}`}>
            {it.used && <span className="badge">✓</span>}
            <img src={it.img} alt={it.label} />
            <div className="cl">{it.label}</div>
            <div className="cn">{it.times}{it.label === "INVOCAR PRO" ? " · durante la partida" : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// 12. RE-GIRAR — el ADMIN re-gira SOLO el mapa
// ============================================================
export function SceneReroll({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const spinStart = 1200;
  const spinDur = 3600;
  const progress = Math.min(1, Math.max(0, (ms - spinStart) / spinDur));
  const eased = 1 - Math.pow(1 - progress, 4);
  const landed = progress >= 1;

  useEffect(() => {
    if (!landed) return;
    ctx.setDemo((p) => ({ ...p, mapId: DEMO_REROLL_MAP_ID }));
    const t = window.setTimeout(ctx.onDone, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landed]);

  return (
    <div style={{ textAlign: "center" }}>
      <div className="tut-mock-title" style={{ textAlign: "center", marginBottom: 2 }}>RE-GIRAR · FASE MAPA</div>
      <div className="tut-mock-sub" style={{ textAlign: "center" }}>
        El ADMIN confirmá el giro. Gira solo la fase MAPA — el resto del sorteo no se toca.
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22, marginTop: 24 }}>
        <div className="tut-map-card old" style={{ opacity: progress > 0.1 ? 0.45 : 1, transform: `scale(${1 - eased * 0.12})` }}>
          <div className="imgw"><img src="/modes/maps/crater.webp" alt="CRÁTER" /></div>
          <div>CRÁTER</div>
        </div>
        <div
          style={{
            width: 118, height: 118, borderRadius: "50%",
            border: "3px solid rgba(212,175,55,0.55)",
            borderTopColor: "#d4af37",
            display: "grid", placeItems: "center",
            transform: `rotate(${eased * 1080}deg)`,
            boxShadow: landed ? "0 0 34px rgba(34,229,194,0.5)" : "0 0 22px rgba(212,175,55,0.25)",
            transition: "box-shadow 0.4s",
            background: "radial-gradient(circle at 50% 32%, rgba(124,58,237,0.25), rgba(5,2,16,0.9))",
          }}
        >
          <Dices style={{ width: 40, height: 40, color: landed ? "#22e5c2" : "#d4af37" }} />
        </div>
        <div
          className="tut-map-card"
          style={{
            opacity: landed ? 1 : 0.15,
            transform: landed ? "scale(1.08)" : "scale(0.9)",
            transition: "all 0.5s ease",
            filter: landed ? "none" : "blur(1px)",
          }}
        >
          <div className="imgw" style={{ width: 150, height: 84, borderRadius: 8, overflow: "hidden", border: landed ? "2px solid rgba(34,229,194,0.8)" : "2px solid var(--tut-line)", boxShadow: landed ? "0 0 26px rgba(34,229,194,0.35)" : "none", transition: "all 0.4s" }}>
            <img src="/modes/maps/cuatro-lagos.webp" alt="CUATRO LAGOS" />
          </div>
          <div style={{ color: landed ? "#8ff5e6" : undefined }}>CUATRO LAGOS</div>
        </div>
      </div>
      <div className="tut-chip-group" style={{ justifyContent: "center", marginTop: 26 }}>
        <span className={`tut-chip ${landed ? "live" : "gold"}`}>
          {landed ? "● MAPA DEFINITIVO: CUATRO LAGOS" : "GIRANDO FASE MAPA…"}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// 13. La partida (AoE2 en juego)
// ============================================================
export function ScenePartida({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const chatMsgs = [
    { who: TEAM_B.players[0].name, text: "CARTA PRO", pro: true, at: 2000 },
    { who: "PRO · ElMago", text: "Barran el flanco norte antes de imperial.", pro: false, at: 3400 },
    { who: "ÁRBITRO", text: "INVOCAR PRO marcado como ejecutado.", pro: false, at: 4800 },
  ];
  return (
    <MockWindow url="vertigo-cup.vercel.app/partido/08">
      <div className="tut-score-mini">
        <span className="n">{TEAM_A.name}</span>
        <span className="v">0 — 0</span>
        <span className="n">{TEAM_B.name}</span>
      </div>
      <div className="tut-chip-group" style={{ justifyContent: "center" }}>
        <span className="tut-chip live">● EN JUEGO</span>
        <span className="tut-chip">{DEMO_RESULT.mode}</span>
        <span className="tut-chip">{ctx.demo.mapId === DEMO_REROLL_MAP_ID ? DEMO_RESULT.mapReroll : DEMO_RESULT.map}</span>
        <span className="tut-chip">{DEMO_RESULT.format}</span>
      </div>
      <div className="tut-chat">
        {chatMsgs.filter((m) => ms > m.at).map((m, i) => (
          <div key={i} className={`tut-chat-msg ${m.pro ? "pro" : ""}`} style={{ animationDelay: "0.05s" }}>
            <span className="who">{m.who}:</span>{m.pro ? `“${m.text}”` : m.text}
          </div>
        ))}
      </div>
    </MockWindow>
  );
}

// ============================================================
// 14. ADMIN carga el resultado
// ============================================================
export function SceneResultado({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const saved = ms > 3000;
  useEffect(() => {
    if (ms > 3200) ctx.setDemo((p) => ({ ...p, scoreA: 2, scoreB: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms > 3200]);
  return (
    <MockWindow url="vertigo-cup.vercel.app/admin/partido/08/resultado">
      <div className="tut-row">
        <div>
          <div className="tut-mock-title">Resultado final — Partida 1</div>
          <div className="tut-mock-sub">La llave pasa a FINISHED y el ganador avanza.</div>
          <div className="tut-chip-group">
            <span className={`tut-chip ${saved ? "live" : "purple"}`}>{TEAM_A.name} 2 — 0 {TEAM_B.name}</span>
            <span className="tut-chip">{saved ? "● FINISHED" : "por confirmar"}</span>
          </div>
        </div>
        <AutoButton
          speed={ctx.speed}
          delay={3000}
          label={<><Check style={{ width: 16, height: 16, display: "inline", marginRight: 8, verticalAlign: "-3px" }} />GUARDAR 2-0</>}
          doneLabel="GUARDADO ✓"
        />
      </div>
    </MockWindow>
  );
}

// ============================================================
// 15. FINAL
// ============================================================
const CONFETTI_COLORS = ["#ff2e7e", "#22e5c2", "#d8a13f", "#b06bff", "#ff6b00"];

export function SceneFinal({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const confetti = useMemo(() => Array.from({ length: 42 }, (_, i) => ({
    left: (i * 37) % 100,
    delay: (i * 0.13) % 2,
    dur: 2.6 + ((i * 0.21) % 1.8),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  })), []);
  useEffect(() => {
    ctx.setDemo((p) => ({ ...p, winner: "A" }));
    if (ms > 8000) ctx.onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms > 8000]);
  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      <div className="tut-confetti">
        {confetti.map((c, i) => (
          <i key={i} style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }} />
        ))}
      </div>
      <div className="tut-final-score">
        <div className="team">
          <img src={TEAM_A.emblem} alt={TEAM_A.name} />
          <div className="n">{TEAM_A.name}</div>
        </div>
        <div className={`num win`}>2</div>
        <div className="num">—</div>
        <div className="num">0</div>
        <div className="team">
          <img src={TEAM_B.emblem} alt={TEAM_B.name} style={{ opacity: 0.5 }} />
          <div className="n">{TEAM_B.name}</div>
        </div>
      </div>
      <div className="tut-trophy">
        <Trophy style={{ width: 20, height: 20 }} /> {TEAM_A.name} AVANZA DE RONDA
      </div>
      <div className="tut-chip-group" style={{ justifyContent: "center", marginTop: 20 }}>
        <span className="tut-chip purple">BRACKET actualizado en tiempo real</span>
        <span className="tut-chip gold">{TEAM_A.name} → Ronda 2, Llave 04</span>
      </div>
    </div>
  );
}
