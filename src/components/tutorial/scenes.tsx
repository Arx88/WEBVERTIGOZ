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
  DEMO_FORCED, DEMO_RESULT, DEMO_REROLL_MAP_ID, LINEUP_PLAYERS,
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
    <div className="tut-full grid place-items-center" style={{ color: "#fff", fontFamily: "var(--font-inter)", fontSize: 13, letterSpacing: "0.3em" }}>
      {text.toUpperCase()}
    </div>
  );
}

function MockWindow({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="tut-mock">
      <div className="tut-mock-bar">
        <span className="tut-mock-brand">
          <img src="/logo.png" alt="" />
          VÉRTIGO
        </span>
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
      <div className="emb-wrap"><img className="emb" src={team.emblem} alt={team.name} /></div>
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
        <div className="tut-window-timer" style={{ color: opened ? "var(--vertigo-success)" : undefined }}>
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

/** Panel lateral que deja claro QUÉ civs le tocan a QUÉ equipo */
function TeamCivPanel({ team, civs, active }: { team: DemoTeam; civs: string[]; active: boolean }) {
  return (
    <div className={`tut-civ-panel ${active ? "on" : ""}`} style={{ "--team-color": team.color } as React.CSSProperties}>
      <div className="tcp-head">
        <img src={team.emblem} alt="" />
        <div>
          <div className="tcp-team">{team.name}</div>
          <div className="tcp-sub">{active ? "SORTEANDO SUS CIVS…" : "CIVS SORTEADAS"}</div>
        </div>
      </div>
      <div className="tcp-civs">
        {civs.length === 0 ? (
          <span className="tcp-empty">{active ? "girando el memotest…" : "esperando su turno"}</span>
        ) : (
          civs.map((c, i) => (
            <span key={c} className="tut-civ-pill"><img src={civImg(c)} alt="" />CIV {i + 1} · {civName(c)}</span>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// 7. MEMOTEST (componente real) — con paneles por equipo
// ============================================================
export function SceneMemotest({ ctx }: { ctx: DemoSceneCtx }) {
  const [side, setSide] = useState<"A" | "B">("A");
  const [trigger, setTrigger] = useState(false);
  const revealedA = useRef<string[]>([]);
  const revealedB = useRef<string[]>([]);
  const [, force] = useState(0);
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
    force((v) => v + 1);

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
        {/* Paneles de equipo: dejan claro qué civs son de quién */}
        <div className="tut-memo-panels">
          <TeamCivPanel team={TEAM_A} civs={revealedA.current} active={side === "A"} />
          <div className="tut-memo-vs">VS</div>
          <TeamCivPanel team={TEAM_B} civs={revealedB.current} active={side === "B"} />
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
    { label: "MODO", value: DEMO_RESULT.mode, img: "/modes/game-mode/guerras-imperiales.webp", color: "#7c3aed" },
    { label: "FORMATO", value: DEMO_RESULT.format, img: "/modes/player-mode/2vs2.webp", color: "#a78bfa" },
    {
      label: mapIsReroll ? "MAPA · RE-GIRADO" : "MAPA",
      value: mapIsReroll ? DEMO_RESULT.mapReroll : DEMO_RESULT.map,
      img: mapIsReroll ? "/modes/maps/cuatro-lagos.webp" : "/modes/maps/crater.webp",
      color: mapIsReroll ? "#fb7185" : "#7c3aed",
    },
    { label: "LLAVE", value: DEMO_RESULT.llave, img: "/modes/llave/bo3.webp", color: "#D4AF37" },
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
// 9-10. Lineup — quiénes juegan + QUÉ CIV USA CADA UNO
// ============================================================
export function SceneLineup({ ctx, team }: { ctx: DemoSceneCtx; team: DemoTeam }) {
  const ms = useDemoClock(ctx.speed);
  const picked = ms > 1600;
  const civsPhase = ms > 3000;
  const confirmed = ms > 5200;

  const lineupNames = LINEUP_PLAYERS[team.id];
  const drawnCivs = team.id === "A"
    ? (ctx.demo.civsA.length ? ctx.demo.civsA : TEAM_A.civPool.slice(0, 2))
    : (ctx.demo.civsB.length ? ctx.demo.civsB : TEAM_B.civPool.slice(0, 2));
  const roster = team.players.map((p) => {
    const slot = lineupNames.indexOf(p.name);
    return { ...p, plays: slot >= 0, civ: picks(slot, drawnCivs, civsPhase) };
  });

  return (
    <MockWindow url="vertigo-cup.vercel.app/mis-partidos">
      <div className="tut-mock-title">Declarar lineup de {team.name}</div>
      <div className="tut-mock-sub">
        Formato 2 VS 2 → el capitán elige QUIÉNES juegan y ASIGNA una de las civs sorteadas a cada uno.
      </div>
      <div className="tut-roster">
        {roster.map((p) => (
          <div key={p.name} className={`tut-roster-row ${p.plays && picked ? "plays" : ""} ${!p.plays && picked ? "benched" : ""}`}>
            <div className="rr-left">
              <span className="rr-name">{p.name}</span>
              <span className="rr-role">{p.isCaptain ? "CAPITÁN" : p.tag.toUpperCase()}</span>
            </div>
            <div className="rr-right">
              {p.plays ? (
                picked ? (
                  p.civ ? (
                    <span className="tut-civ-pill big"><img src={civImg(p.civ)} alt="" />{civName(p.civ)}</span>
                  ) : (
                    <span className="rr-state pick">ELIGIENDO CIV…</span>
                  )
                ) : (
                  <span className="rr-state">ELEGIRÁ EL CAPITÁN</span>
                )
              ) : (
                picked && <span className="rr-state off">AL BANCO</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 20 }}>
        <AutoButton
          speed={ctx.speed}
          delay={confirmed ? 0 : 5200}
          label={<><Users style={{ width: 16, height: 16, display: "inline", marginRight: 8, verticalAlign: "-3px" }} />CONFIRMAR LINEUP · READY #2</>}
          doneLabel="READY #2 ✓"
        />
      </div>
    </MockWindow>
  );
}

function picks(slot: number, civs: string[], civsPhase: boolean): string | null {
  if (!civsPhase || slot < 0) return null;
  return civs[slot] ?? null;
}

// ============================================================
// 11. Ventana de comodines — inventario POR EQUIPO + invocación épica
// ============================================================
const COMODINES_INVENTORY = [
  { img: "/comodin-regirar.png", label: "RE-GIRAR", times: "×2 POR TORNEO", note: "re-gira 1 fase o las civs" },
  { img: "/comodin-anular.png", label: "ANULAR", times: "×1 POR TORNEO", note: "solo 1v1 / 2v2" },
  { img: "/comodin-elegir.png", label: "ELEGIR RIVAL", times: "×1 POR TORNEO", note: "solo 1v1 / 2v2 · excluye ANULAR" },
  { img: "/comodin-invocar.png", label: "INVOCAR PRO", times: "×1 POR TORNEO", note: "durante la partida" },
];

function ComodinInventory({ team, usingLabel }: { team: DemoTeam; usingLabel?: string }) {
  return (
    <div className="tut-inv" style={{ "--team-color": team.color } as React.CSSProperties}>
      <div className="tinv-head">
        <img src={team.emblem} alt="" />
        <div className="tinv-name">{team.name}</div>
      </div>
      <div className="tinv-list">
        {COMODINES_INVENTORY.map((c) => {
          const isActive = usingLabel === c.label;
          return (
            <div key={c.label} className={`tinv-item ${isActive ? "active" : ""}`}>
              <img src={c.img} alt={c.label} />
              <div className="tinv-txt">
                <span className="tinv-label">{c.label} <em>{c.times}</em></span>
                <span className="tinv-note">{c.note}</span>
              </div>
              {isActive && <span className="tinv-use">EN USO</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Secuencia CINEMATOGRÁFICA con beats:
 *  0.5s luz converge → 0.8s la carta entra → 1.5s impacto (shockwave + flash)
 *  → 2.25s el nombre "slam" → 2.75s estandarte del reino.
 * La carta ya no gira 360° plana: entra, flota con vaivén holográfico
 * y un barrido de luz especular (shine) como carta premium de verdad.
 */
function ComodinEpic({ img, name, team }: { img: string; name: string; team: DemoTeam }) {
  const particles = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    angle: (i / 36) * 360,
    r: 150 + ((i * 53) % 110),
    dur: 2.4 + ((i * 0.17) % 2.6),
    delay: (i * 0.11) % 1.6,
    size: 2 + ((i * 7) % 5),
    color: ["#D4AF37", "#7c3aed", "#a78bfa", "#c4b5fd"][i % 4],
  })), []);

  return (
    <div className="tut-epic">
      <div className="tut-epic-flash" />
      <div className="tut-epic-rays" />
      <div className="tut-epic-glow" />
      <div className="tut-epic-center">
        <div className="tut-epic-beam" />
        {/* partículas en órbita (aparecen con la luz) */}
        <div className="tut-epic-orbit">
          {particles.map((p, i) => (
            <i
              key={i}
              className="tut-particle"
              style={{
                "--p-angle": `${p.angle}deg`,
                "--p-r": `${p.r}px`,
                "--p-dur": `${p.dur}s`,
                "--p-delay": `-${p.delay}s`,
                width: p.size, height: p.size,
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`,
              } as React.CSSProperties}
            />
          ))}
        </div>
        {/* shockwaves de impacto */}
        <div className="tut-epic-shock"><i /><i /><i /></div>
        {/* comodín: la IMAGEN es la carta (no hay caja). wrapper = entrada,
            3d = vaivén infinito */}
        <div className="tut-epic-aura" />
        <div className="tut-epic-enter">
          <div className="tut-epic-3d">
            <img className="tut-epic-art" src={img} alt={name} />
          </div>
        </div>
        <div className="tut-epic-pedestal" />
        <div className="tut-epic-name">{name}</div>
        <div className="tut-epic-divider"><i /></div>
        <div className="tut-epic-team">
          <img src={team.emblem} alt="" />
          {team.name}
        </div>
        <div className="tut-epic-sub">COMODÍN ACTIVADO · EL ADMIN EJECUTA EL GIRO</div>
      </div>
    </div>
  );
}

export function SceneComodin({ ctx }: { ctx: DemoSceneCtx }) {
  const ms = useDemoClock(ctx.speed);
  const secondsLeft = Math.max(0, 300 - Math.floor(ms / 1000));
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const epicStart = 4600;
  const inEpic = ms > epicStart && ms < epicStart + 6400;

  return (
    <div className="tut-comodin-root">
      <div className="tut-window-timer">
        <Timer style={{ width: 26, height: 26, display: "inline", marginRight: 10, verticalAlign: -4 }} />
        {inEpic ? "PAUSA" : `${mm}:${ss}`}
      </div>
      <div className="tut-mock-sub" style={{ textAlign: "center", margin: "2px 0 16px" }}>
        {inEpic
          ? "El timer se PAUSA mientras un comodín está en ejecución."
          : "Ventana de 5 minutos. Cada equipo tiene su propio inventario de comodines."}
      </div>
      <div className="tut-inventories">
        <ComodinInventory team={TEAM_A} />
        <div className="tut-inv-sep">VS</div>
        <ComodinInventory team={TEAM_B} usingLabel={inEpic ? "RE-GIRAR" : undefined} />
      </div>
      {inEpic && <ComodinEpic img="/comodin-regirar.png" name="RE-GIRAR" team={TEAM_B} />}
    </div>
  );
}

// ============================================================
// 12. RE-GIRAR — la RULETA REAL gira SOLO la fase MAPA
// ============================================================
export function SceneReroll({ ctx }: { ctx: DemoSceneCtx }) {
  const doneRef = useRef(false);
  return (
    <div className="tut-full">
      <ConfigProvider>
        <Roulette
          key="reroll-map-only"
          forced={{ ...DEMO_FORCED, mapId: DEMO_REROLL_MAP_ID }}
          autoStart
          startPhase="spinning-map-mode"
          configOverride={{ firstRound: false }}
          interactive={false}
          onResult={(_resolved, resolvedMap) => {
            if (doneRef.current) return;
            doneRef.current = true;
            ctx.setDemo((p) => ({ ...p, mapId: resolvedMap?.map.id ?? DEMO_REROLL_MAP_ID }));
            window.setTimeout(ctx.onDone, 600);
          }}
        />
      </ConfigProvider>
      <div className="tut-reroll-banner">
        <img src="/comodin-regirar.png" alt="" />
        <span>COMODÍN RE-GIRAR · ORDEN DEL CUERVO · GIRA SOLO LA FASE MAPA</span>
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
      {/* CIVS ASIGNADAS POR JUGADOR — esto es lo que se juega */}
      <div className="tut-lineup-final">
        {(["A", "B"] as const).map((id) => {
          const t = id === "A" ? TEAM_A : TEAM_B;
          const civs = id === "A"
            ? (ctx.demo.civsA.length ? ctx.demo.civsA : TEAM_A.civPool.slice(0, 2))
            : (ctx.demo.civsB.length ? ctx.demo.civsB : TEAM_B.civPool.slice(0, 2));
          const players = LINEUP_PLAYERS[id];
          return (
            <div key={id} className="tlf-team" style={{ "--team-color": t.color } as React.CSSProperties}>
              <div className="tlf-team-name"><img src={t.emblem} alt="" />{t.name}</div>
              {players.map((pname, i) => (
                <div key={pname} className="tlf-row">
                  <span className="tlf-player">{pname}</span>
                  {civs[i] && <span className="tut-civ-pill"><img src={civImg(civs[i])} alt="" />{civName(civs[i])}</span>}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="tut-chip-group" style={{ justifyContent: "center", marginTop: 14 }}>
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
const CONFETTI_COLORS = ["#D4AF37", "#7c3aed", "#a78bfa", "#c4b5fd", "#5b21b6"];

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
