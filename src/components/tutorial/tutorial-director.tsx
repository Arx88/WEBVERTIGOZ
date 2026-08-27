"use client";

/**
 * VÉRTIGO Cup — TUTORIAL · director
 *
 * Motor que reproduce el guion de escenas en orden, con:
 *  - play / pausa / reinicio / salto de escena
 *  - velocidad 1x / 2x / 4x
 *  - barra superior con POV activo + barra de progreso de escenas
 *  - estado compartido de la demo (civs, mapa re-girado, score, ganador)
 *
 * No usa BD ni sesión: la demo es 100% local.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Footprints, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import {
  INITIAL_DEMO_STATE, POV_COLOR, SCENES, TEAM_A, TEAM_B,
  type DemoSceneCtx, type DemoState,
} from "./demo-data";
import {
  SceneAdminAgenda, SceneAdminDraw, SceneComodin, SceneFinal, SceneIntro,
  SceneLineup, SceneMemotest, ScenePartida, SceneReady, SceneResultado,
  SceneReroll, SceneRoulette, SceneSummary, SceneT15,
} from "./scenes";

const SPEEDS = [1, 2, 4] as const;

interface DirectorProps {
  onClose: () => void;
}

export default function TutorialDirector({ onClose }: DirectorProps) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [demo, setDemo] = useState<DemoState>(INITIAL_DEMO_STATE);
  const [progress, setProgress] = useState(0); // 0..1 dentro de la escena actual
  // PASO A PASO: al terminar cada escena pausa en vez de avanzar sola.
  const [stepMode, setStepMode] = useState(false);
  const stepModeRef = useRef(false);

  const elapsedRef = useRef(0); // ms acumulados de la escena (respeta pausa)
  const pendingNextRef = useRef(false); // onDone llegó en pausa → ejecutar al reanudar

  const scene = SCENES[sceneIndex];

  useEffect(() => {
    stepModeRef.current = stepMode;
  }, [stepMode]);

  // reset del reloj interno al cambiar de escena
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
  }, [sceneIndex]);

  /** Avanza a la siguiente escena (o reinicia al terminar el guion) */
  const next = useCallback(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setSceneIndex((i) => {
      if (i >= SCENES.length - 1) {
        setDemo(INITIAL_DEMO_STATE);
        return 0;
      }
      return i + 1;
    });
  }, []);

  const goto = useCallback((i: number) => {
    pendingNextRef.current = false;
    setSceneIndex(Math.max(0, Math.min(SCENES.length - 1, i)));
  }, []);

  const restart = useCallback(() => {
    pendingNextRef.current = false;
    setDemo(INITIAL_DEMO_STATE);
    setSceneIndex(0);
    setProgress(0);
    setPlaying(true);
  }, []);

  // Reloj del director para escenas "timed" (respeta pausa y velocidad)
  useEffect(() => {
    if (!playing || scene.kind !== "timed") return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsedRef.current += (now - last) * speed;
      last = now;
      const p = Math.min(1, elapsedRef.current / scene.ms);
      setProgress(p);
      if (p >= 1) {
        if (stepModeRef.current) {
          // PASO A PASO: pausa al fin de la escena; el usuario decide cuándo seguir
          setProgress(1);
          setPlaying(false);
        } else {
          next();
        }
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sceneIndex, playing, speed, scene.kind, scene.ms, next]);

  // Si una escena "event" terminó en pausa, avanza al reanudar
  useEffect(() => {
    if (playing && pendingNextRef.current) {
      pendingNextRef.current = false;
      next();
    }
  }, [playing, next]);

  const togglePlay = useCallback(() => {
    // En PASO A PASO con la escena ya completa, PLAY = avanzar a la siguiente
    if (!playing && stepMode && progress >= 1) {
      next();
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [playing, stepMode, progress, next]);

  // Atajos de teclado: ESPACIO pausa/play · ← → navegan escenas
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goto(Math.max(0, sceneIndex - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, next, goto, sceneIndex]);

  const sceneCtx: DemoSceneCtx = {
    demo,
    setDemo: (u) => setDemo((p) => u(p)),
    speed: playing ? speed : 0.0001,
    onDone: () => {
      if (playing) next();
      else pendingNextRef.current = true;
    },
  };

  const povColor = POV_COLOR[scene.pov];

  return (
    <div className="tut-root" style={{ "--pov-color": povColor } as React.CSSProperties}>
      {/* Fondo del LOGIN: video + overlay */}
      <video className="tut-bg-video" autoPlay muted loop playsInline>
        <source src="/landing/wizard-bg.mp4" type="video/mp4" />
      </video>
      <div className="tut-bg-overlay" />

      {/* TOP BAR */}
      <div className="tut-topbar">
        <div className="tut-brand">
          <img src="/logo.png" alt="VÉRTIGO" />
          VÉRTIGO <span className="sep">TUTORIAL</span>
        </div>
        <div className="tut-pov">
          <span className="dot" />
          POV · {scene.pov}
        </div>
        <div className="tut-scene-title-wrap">
          <span className="tut-scene-num">{String(sceneIndex + 1).padStart(2, "0")}/{String(SCENES.length).padStart(2, "0")}</span>
          <span className="tut-scene-title">{scene.title}</span>
        </div>
        <div className="tut-controls">
          <button className="tut-btn" onClick={togglePlay} title={playing ? "Pausar (ESPACIO)" : "Reproducir (ESPACIO)"}>
            {playing ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
            <span className="lbl">{playing ? "PAUSA" : "PLAY"}</span>
          </button>
          {stepMode && !playing && progress >= 1 && (
            <button
              className="tut-btn next-cta"
              onClick={() => {
                next();
                setPlaying(true);
              }}
              title="Escena completada — seguir (→)"
            >
              <SkipForward style={{ width: 13, height: 13 }} />
              <span className="lbl">SIGUIENTE</span>
            </button>
          )}
          <button
            className={`tut-btn ghost ${stepMode ? "stepmode-on" : ""}`}
            onClick={() => setStepMode((s) => !s)}
            title="Pausa al final de cada escena para verla con calma"
          >
            <Footprints style={{ width: 13, height: 13 }} />
            <span className="lbl">PASO A PASO</span>
          </button>
          <button className="tut-btn ghost" onClick={next} title="Escena siguiente">
            <SkipForward style={{ width: 13, height: 13 }} />
          </button>
          <button className="tut-btn ghost" onClick={restart} title="Reiniciar">
            <RotateCcw style={{ width: 13, height: 13 }} />
          </button>
          <div className="tut-speed">
            {SPEEDS.map((s) => (
              <button key={s} className={speed === s ? "on" : ""} onClick={() => setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <button className="tut-btn ghost" onClick={onClose} title="Salir del tutorial">
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {/* STAGE */}
      <div className="tut-stage">
        <div className="tut-scene" key={scene.id}>
          {scene.id === "intro" && <SceneIntro ctx={sceneCtx} />}
          {scene.id === "admin-agenda" && <SceneAdminAgenda ctx={sceneCtx} />}
          {scene.id === "t15" && <SceneT15 ctx={sceneCtx} />}
          {scene.id === "ready-a" && <SceneReady ctx={sceneCtx} team={TEAM_A} />}
          {scene.id === "ready-b" && <SceneReady ctx={sceneCtx} team={TEAM_B} />}
          {scene.id === "admin-draw" && <SceneAdminDraw ctx={sceneCtx} />}
          {scene.id === "ruleta" && <SceneRoulette ctx={sceneCtx} />}
          {scene.id === "memotest" && <SceneMemotest ctx={sceneCtx} />}
          {scene.id === "summary" && <SceneSummary ctx={sceneCtx} />}
          {scene.id === "lineup-a" && <SceneLineup ctx={sceneCtx} team={TEAM_A} />}
          {scene.id === "lineup-b" && <SceneLineup ctx={sceneCtx} team={TEAM_B} />}
          {scene.id === "comodin" && <SceneComodin ctx={sceneCtx} />}
          {scene.id === "reroll" && <SceneReroll ctx={sceneCtx} />}
          {scene.id === "reroll-summary" && <SceneSummary ctx={sceneCtx} />}
          {scene.id === "partida" && <ScenePartida ctx={sceneCtx} />}
          {scene.id === "admin-resultado" && <SceneResultado ctx={sceneCtx} />}
          {scene.id === "final" && <SceneFinal ctx={sceneCtx} />}
        </div>
      </div>

      {/* CAPTION BAR (narrador) */}
      <div className="tut-caption-bar" key={`cap-${scene.id}`}>
        <div className="tut-kicker">{scene.kicker}</div>
        <div className="tut-desc">{scene.desc}</div>
        <div className="tut-kbd-hint">ESPACIO = pausa · ← → = escenas · activá PASO A PASO para mirar sin apuro</div>
      </div>

      {/* PROGRESS */}
      <div className="tut-progress">
        <span className="tut-progress-label">
          {scene.kind === "event" ? "ESCENA AUTOMÁTICA" : "GUION"}
        </span>
        <div className="tut-steps">
          {SCENES.map((s, i) => (
            <div
              key={s.id}
              className={`tut-step ${i < sceneIndex ? "done" : ""} ${i === sceneIndex ? "active" : ""}`}
              onClick={() => goto(i)}
              title={`${i + 1}. ${s.title}`}
            >
              <span
                className="fill"
                style={{
                  transform: i < sceneIndex ? "scaleX(1)" : i === sceneIndex ? `scaleX(${progress})` : "scaleX(0)",
                }}
              />
            </div>
          ))}
        </div>
        <span className="tut-progress-label">{String(sceneIndex + 1).padStart(2, "0")}/{String(SCENES.length).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
