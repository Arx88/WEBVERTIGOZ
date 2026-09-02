"use client";

/**
 * StreamConvergenceBackground — fondo WebGL que reproduce el shader
 * "Stream Convergence" de ThreeUI (https://threeui.com/backgrounds/
 * portal-field/stream-convergence): líneas violeta-índigo que convergen
 * hacia el centro. Se usa en la pantalla de carga.
 *
 * Es WebGL puro (sin three.js): un canvas a pantalla completa con un
 * shader que dibuja ondas convergiendo.
 *
 * Fiabilidad — el loader JAMÁS debe quedarse sin el fondo 3D. Este
 * componente pasa por remontajes constantes (loading.tsx por navegación,
 * StrictMode en dev, loader del hero del caballero) y cada desmonte libera
 * el contexto con WEBGL_lose_context para no agotar el tope del navegador.
 * Eso deja 4 modos de falla en el remonte, TODOS cubiertos por un watchdog
 * unificado (HEARTBEAT_MS) que corre mientras el fondo no esté sano y se
 * apaga solo cuando todo dibuja:
 *
 *  1. getContext("webgl") devuelve null (tope de contextos vivos).
 *  2. El contexto llega PERDIDO (dev StrictMode: getContext devuelve el
 *     contexto que el montaje anterior acaba de loseContext()). Se pide
 *     restoreContext() y el evento webglcontextrestored NO siempre llega
 *     (GPU ocupada con el video del hero + GlowCursor).
 *  3. webglcontextrestored llega pero initGL() falla (compile/link con la
 *     GPU ocupada): ready queda false y nada lo reintentaba.
 *  4. El contexto muere en pleno uso (reciclaje del navegador).
 *
 * Escalada del watchdog: reintenta init sobre el canvas actual (1 y 3),
 * pide restoreContext (2) y, si el canvas no revive, LO REEMPLAZA por uno
 * nuevo en el DOM (un canvas recién creado siempre obtiene un contexto
 * limpio — cubre 1 y 2 rebeldes). canvasRef/glHost se mantienen
 * sincronizados con el canvas vivo, no con el que React renderizó.
 *
 * Red de seguridad CSS: .stream-convergence-bg lleva un gradiente animado
 * detrás del canvas (solo se ve si WebGL no puede iniciar).
 */
import { useEffect, useRef } from "react";
import {
  STREAM_CONVERGENCE_VERTEX_SHADER,
  STREAM_CONVERGENCE_FRAGMENT_SHADER,
  STREAM_CONVERGENCE_DEFAULT_SPEED,
  STREAM_CONVERGENCE_DEFAULT_FIDELITY,
} from "@/components/shared/stream-convergence-bootstrap";

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create Stream Convergence shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info ?? "Stream Convergence shader compilation failed");
  }
  return shader;
}

// Watchdog: mientras el fondo no esté sano (contexto vivo + programa
// inicializado), re-chequea cada HEARTBEAT_MS y escala el rescate.
const HEARTBEAT_MS = 300;

// Estructura que expone el bootstrap pre-hidratación sobre el host
// (ver stream-convergence-bootstrap.ts).
interface VertigoBoot {
  stop: () => void;
}

export default function StreamConvergenceBackground({
  className = "",
  speed = 0.7,
  fidelity = 0.5,
  opacity = 0.9,
}: {
  className?: string;
  speed?: number;
  fidelity?: number;
  opacity?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ speed, fidelity, opacity });
  optionsRef.current = { speed, fidelity, opacity };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !canvasRef.current) return undefined;

    // El canvas que React renderizó (para liberar su contexto en el
    // cleanup aunque el activo sea el de rescate).
    const reactCanvas: HTMLCanvasElement = canvasRef.current;

    // Canvas VIVO: puede no ser el que React renderizó si el watchdog
    // hizo un swap (getContext fresco). Todo el efecto habla con este.
    let glHost: HTMLCanvasElement | null = canvasRef.current;
    let gl: WebGLRenderingContext | null = null;

    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uResolution: WebGLUniformLocation | null = null;
    let uFidelity: WebGLUniformLocation | null = null;
    let ready = false;
    let frame = 0;
    let visible = true;
    let disposed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    // Cuántos restoreContext() seguidos tolerar antes de reemplazar el canvas.
    let restoreAttempts = 0;
    const MAX_RESTORES = 3;
    // Tope TOTAL de pases del watchdog (cada pase = trabajo GPU). Sin esto,
    // una GPU colgada = compilación de shaders eterna cada 300ms.
    let heartAttempts = 0;
    const MAX_HEART_ATTEMPTS = 20; // ~6s de rescate, luego gradiente CSS

    // ADOPCIÓN del bootstrap pre-hidratación: el script inline del
    // PageLoader ya arrancó el WebGL sobre este canvas (antes de que
    // React existiera). Al hidratar, frenamos SU loop y nos quedamos con
    // el mismo contexto — así no hay dos loops dibujando sobre el mismo
    // canvas ni un flash de fondo sólido al transicionar.
    const hostBoot = host as HTMLDivElement & { __vertigoBoot?: VertigoBoot };
    const boot = hostBoot.__vertigoBoot;
    if (boot) {
      boot.stop();
      hostBoot.__vertigoBoot = undefined;
    }
    // El contexto del bootstrap es el mismo que getContext() devuelve:
    // el programa del bootstrap queda huérfano y el efecto crea el suyo.

    // (Re)inicializa shaders/program/buffer sobre el contexto actual. Se
    // llama en el montaje y en cada restore. Devuelve true si quedó listo
    // para dibujar.
    const initGL = (): boolean => {
      if (!gl || gl.isContextLost()) return false;
      try {
        const vertex = compile(gl, gl.VERTEX_SHADER, STREAM_CONVERGENCE_VERTEX_SHADER);
        const fragment = compile(
          gl,
          gl.FRAGMENT_SHADER,
          `precision highp float;\n${STREAM_CONVERGENCE_FRAGMENT_SHADER}`,
        );
        const prog = gl.createProgram();
        if (!prog) {
          gl.deleteShader(vertex);
          gl.deleteShader(fragment);
          return false;
        }
        gl.attachShader(prog, vertex);
        gl.attachShader(prog, fragment);
        gl.linkProgram(prog);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          gl.deleteProgram(prog);
          return false;
        }
        gl.useProgram(prog);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW,
        );
        const position = gl.getAttribLocation(prog, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        uTime = gl.getUniformLocation(prog, "u_time");
        uResolution = gl.getUniformLocation(prog, "u_resolution");
        uFidelity = gl.getUniformLocation(prog, "u_interactive_fidelity");

        program = prog;
        buffer = buf;
        ready = true;
        resize();
        return true;
      } catch {
        ready = false;
        return false;
      }
    };

    const resize = () => {
      if (!gl || !ready || !glHost) return;
      const bounds = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      glHost.width = Math.max(1, Math.round(bounds.width * dpr));
      glHost.height = Math.max(1, Math.round(bounds.height * dpr));
      gl.viewport(0, 0, glHost.width, glHost.height);
      if (uResolution) gl.uniform2f(uResolution, glHost.width, glHost.height);
    };

    const render = (now: number) => {
      if (disposed || !gl || gl.isContextLost()) {
        frame = 0;
        return;
      }
      // Contexto vivo pero aún no inicializado (esperando restore): seguir
      // en el loop para no perder el tick de readiness.
      if (!ready) {
        frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
        return;
      }
      const options = optionsRef.current;
      if (uTime) gl.uniform1f(uTime, now * 0.0003 * options.speed);
      if (uFidelity) gl.uniform1f(uFidelity, options.fidelity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
    };

    const start = () => {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render);
    };

    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      // El watchdog se apaga al sanar (o tras agotar los intentos): la
      // próxima caída lo rearma desde los event handlers.
      heartAttempts = 0;
    };

    const scheduleHeartbeat = () => {
      if (heartbeat || disposed) return;
      // Tope de trabajo: cada pase fallido compila shaders / pide contextos
      // (trabajo GPU). Sin tope, una GPU colgada significaba recompilar
      // shaders cada 300ms para siempre = fuga de CPU/GPU en loaders
      // viejos que quedan colgados. Agotado el tope, el fondo queda en el
      // gradiente CSS de respaldo (aceptable: es el último recurso).
      if (heartAttempts >= MAX_HEART_ATTEMPTS) return;
      heartbeat = setInterval(heart, HEARTBEAT_MS);
    };

    // Pase de rescate: devuelve true si el fondo quedó sano (y por ende
    // programa el watchdog para el próximo problema).
    const heart = (): boolean => {
      if (disposed) return false;
      heartAttempts += 1;
      if (heartAttempts >= MAX_HEART_ATTEMPTS) {
        stopHeartbeat();
        return false; // gradient CSS de respaldo: fin del rescate
      }
      // 1) ¿El canvas actual tiene un contexto vivo e inicializado?
      if (gl && !gl.isContextLost() && ready) {
        stopHeartbeat();
        return true;
      }
      // 2) Contexto perdido: pedir restauración. Si el evento no llega (GPU
      //    ocupada) el heartbeat lo reintenta; tras MAX_RESTORES intentos
      //    seguidos sin revivir, escala directo al paso 4 (canvas nuevo).
      if (gl && gl.isContextLost()) {
        restoreAttempts += 1;
        if (restoreAttempts <= MAX_RESTORES) {
          gl.getExtension("WEBGL_lose_context")?.restoreContext();
          return false;
        }
        // restoreContext estéril: tratar el canvas como irrecuperable y
        // pasar al reemplazo (paso 4 abajo).
        gl = null;
      } else {
        restoreAttempts = 0;
      }
      // 3) Sin contexto (null o se esfumó): probar el canvas actual…
      if (glHost) {
        const ctx = glHost.getContext("webgl", { alpha: true, antialias: false });
        if (ctx && !ctx.isContextLost()) {
          gl = ctx;
          if (initGL()) {
            start();
            return true;
          }
          return false; // initGL falló (GPU ocupada): reintenta el próximo tick
        }
      }
      // 4) Canvas irrecuperable: crear uno NUEVO propio y adjuntarlo junto
      //    al de React (sin tocar su DOM). Un canvas recién creado SIEMPRE
      //    obtiene un contexto limpio, y React puede desmontar el suyo sin
      //    que elNotFoundError del replaceChild rompa el unmount.
      const old = glHost;
      const fresh = document.createElement("canvas");
      fresh.style.width = "100%";
      fresh.style.height = "100%";
      fresh.style.display = "block";
      // Paridad visual con el canvas de React (ver return del JSX).
      fresh.style.opacity = String(optionsRef.current.opacity);
      if (old && old.parentElement) {
        old.parentElement.appendChild(fresh);
        // El canvas roto queda invisible detrás del nuevo. Liberarle el
        // contexto YA: acumular contextos WebGL muertos en remounts seguidos
        // agota el tope del navegador (y su memoria GPU).
        old.style.display = "none";
        old.removeEventListener("webglcontextlost", onContextLost);
        old.removeEventListener("webglcontextrestored", onContextRestored);
        if (gl) {
          const lose = gl.getExtension("WEBGL_lose_context");
          lose?.loseContext();
        }
      } else {
        host.appendChild(fresh);
      }
      glHost = fresh;
      canvasRef.current = fresh;
      bindContextEvents(fresh);
      restoreAttempts = 0;
      const freshCtx = fresh.getContext("webgl", { alpha: true, antialias: false });
      if (freshCtx && !freshCtx.isContextLost()) {
        gl = freshCtx;
        if (initGL()) {
          start();
          return true;
        }
      }
      return false;
    };

    // Buscar la salud una vez por tick hasta que esté sana; al lograrlo,
    // el watchdog queda armado para cualquier caída futura.
    scheduleHeartbeat();

    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      ready = false;
      scheduleHeartbeat();
    };

    const onContextRestored = () => {
      if (initGL()) start();
    };

    function bindContextEvents(target: HTMLCanvasElement) {
      target.addEventListener("webglcontextlost", onContextLost);
      target.addEventListener("webglcontextrestored", onContextRestored);
    }

    const onVisibilityChange = () => {
      if (!document.hidden) start();
    };

    if (glHost) bindContextEvents(glHost);

    // Primera pasada inmediata: montaje normal o StrictMode (contexto
    // perdido recién llegado). heart() maneja ambos.
    heart();

    document.addEventListener("visibilitychange", onVisibilityChange);

    const resizeObserver = new ResizeObserver(() => resize());
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) start();
      else if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    resizeObserver.observe(host);
    intersection.observe(host);

    return () => {
      disposed = true;
      stopHeartbeat();
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (glHost) {
        glHost.removeEventListener("webglcontextlost", onContextLost);
        glHost.removeEventListener("webglcontextrestored", onContextRestored);
      }
      if (gl && !gl.isContextLost()) {
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
        // Liberar el contexto explícitamente para no agotar el tope del navegador.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
      // El contexto del canvas ORIGINAL de React (cuando el activo es el de
      // rescate) también hay que liberarlo: quedaba vivo y acumulándose en
      // cada navegación (loading.tsx se monta/desmonta todo el tiempo).
      if (glHost !== reactCanvas) {
        const origCtx = reactCanvas.getContext("webgl", { alpha: true, antialias: false });
        if (origCtx && !origCtx.isContextLost()) {
          origCtx.getExtension("WEBGL_lose_context")?.loseContext();
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={hostRef} className={`stream-convergence-bg${className ? ` ${className}` : ""}`} aria-hidden>
      <canvas
        ref={canvasRef}
        style={{
          opacity: optionsRef.current.opacity,
        }}
      />
    </div>
  );
}
