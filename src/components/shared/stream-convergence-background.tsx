"use client";

/**
 * StreamConvergenceBackground — fondo WebGL que reproduce el shader
 * "Stream Convergence" de ThreeUI (https://threeui.com/backgrounds/
 * portal-field/stream-convergence): líneas violetaíndigo que convergen
 * hacia el centro. Se usa en la pantalla de carga.
 *
 * Es WebGL puro (sin three.js): un canvas a pantalla completa con un
 * póster que dibuja ondas convergendo.
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
    throw new Error(gl.getShaderInfoLog(shader) ?? "Stream Convergence shader compilation failed");
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

    const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
    if (!gl) return undefined;

    const vertex = compile(gl, gl.VERTEX_SHADER, STREAM_CONVERGENCE_VERTEX_SHADER);
    const fragment = compile(
      gl,
      gl.FRAGMENT_SHADER,
      `precision highp float;\n${STREAM_CONVERGENCE_FRAGMENT_SHADER}`,
    );
    const program = gl.createProgram();
    if (!program) return undefined;

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Stream Convergence program link failed");
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uFidelity = gl.getUniformLocation(program, "u_interactive_fidelity");

    let frame = 0;
    let visible = true;

    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * dpr));
      canvas.height = Math.max(1, Math.round(bounds.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
    };

    const render = (now: number) => {
      // Si el navegador recicló el contexto, frenar el loop hasta el restore
      if (gl.isContextLost()) {
        frame = 0;
        return;
      }
      const options = optionsRef.current;
      gl.uniform1f(uTime, now * 0.0003 * options.speed);
      gl.uniform1f(uFidelity, options.fidelity);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = visible && !document.hidden ? requestAnimationFrame(render) : 0;
    };

    // Si el contexto se pierde (los navegadores reciclan WebGL bajo presión de
    // memoria), pausar y redibujar al restaurarlo — el fondo nunca queda muerto.
    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
    const onContextRestored = () => {
      resize();
      if (visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
    };

    // Al volver a la pestaña, reanudar el loop si quedó frenado
    const onVisibilityChange = () => {
      if (!document.hidden && visible && !frame) frame = requestAnimationFrame(render);
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const resizeObserver = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && !frame) frame = requestAnimationFrame(render);
      if (!visible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });

    resizeObserver.observe(host);
    intersection.observe(host);
    resize();
    frame = requestAnimationFrame(render);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      gl.deleteBuffer(buffer);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      gl.deleteProgram(program);
      // CRÍTICO: liberar el contexto WebGL explícitamente. Sin esto, cada loader
      // deja un contexto vivo hasta que GC pase; los navegadores tienen un tope
      // de contextos activos y al agotarse getContext() devuelve null → loader
      // sin fondo animado.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
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