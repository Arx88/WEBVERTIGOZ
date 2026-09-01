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
 * Fiabilidad:
 *  - Al desmontar se libera el contexto (WEBGL_lose_context) para no agotar
 *    el tope de contextos del navegador.
 *  - En React StrictMode (dev) el mismo canvas se remonta justo después de
 *    un loseContext(): getContext() devuelve el contexto PERDIDO. En ese caso
 *    se pide restoreContext() y se reinicializa todo en webglcontextrestored.
 *  - Si el navegador recicla el contexto en pleno uso, se reinicializa igual.
 *  - Red de seguridad CSS: .vertigo-loader::before lleva un gradiente animado
 *    detrás del canvas (el canvas es opaco cuando funciona, así que solo se
 *    ve si WebGL falla).
 */
import { useEffect, useRef } from "react";

const STREAM_CONVERGENCE_VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const STREAM_CONVERGENCE_FRAGMENT_SHADER = `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform float u_interactive_fidelity;
  varying vec2 vUv;

  mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= u_resolution.x / u_resolution.y;
    p = rotate2d(0.55) * p;

    vec3 color = vec3(0.0);
    float spread = 0.06 * (0.3 + u_interactive_fidelity * 0.7);

    for(int i = 0; i < 3; i++) {
      float offset = float(1 - i) * spread;
      float y = p.y + offset + (sin(p.x * 2.5 - u_time * 1.5) * 0.12);
      float wave = smoothstep(0.85, 0.99, sin(y * 6.0 + u_time * 2.0) * 0.5 + 0.5);

      // Mezcla de color del tema violeta-índigo
      if(i == 0) color.r += wave * 1.2;
      if(i == 1) color.g += wave * 0.5;
      if(i == 2) color.b += wave * 1.8;
    }

    float vignette = exp(-length(vUv * 2.0 - 1.0) * 0.8);
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
  }
`;

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
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    let gl: WebGLRenderingContext | null = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
    });
    if (!gl) return undefined;

    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let uTime: WebGLUniformLocation | null = null;
    let uResolution: WebGLUniformLocation | null = null;
    let uFidelity: WebGLUniformLocation | null = null;
    let ready = false;
    let frame = 0;
    let visible = true;

    // (Re)inicializa shaders/program/buffer. Se llama en el montaje inicial y
    // cada vez que el contexto se restaura (StrictMode, reciclaje del navegador).
    const initGL = () => {
      if (!gl || gl.isContextLost()) return;
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
          return;
        }
        gl.attachShader(prog, vertex);
        gl.attachShader(prog, fragment);
        gl.linkProgram(prog);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          gl.deleteProgram(prog);
          return;
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
      } catch {
        ready = false;
      }
    };

    const resize = () => {
      if (!gl || !ready) return;
      const bounds = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uResolution) gl.uniform2f(uResolution, canvas.width, canvas.height);
    };

    const render = (now: number) => {
      if (!gl || gl.isContextLost()) {
        frame = 0;
        return;
      }
      // Contexto vivo pero aún no inicializado (esperando restore): seguir en el loop
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

    const onContextLost = (event: Event) => {
      event.preventDefault();
      ready = false;
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const onContextRestored = () => {
      initGL();
      start();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) start();
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
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

    if (gl.isContextLost()) {
      // React StrictMode: el montaje anterior llamó loseContext() sobre este
      // mismo canvas y getContext() devuelve ese contexto perdido. Pedimos
      // restaurarlo; initGL + start ocurren en webglcontextrestored.
      gl.getExtension("WEBGL_lose_context")?.restoreContext();
    } else {
      initGL();
      start();
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (gl && !gl.isContextLost()) {
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
        // Liberar el contexto explícitamente para no agotar el tope del navegador.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    };
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
