"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

/**
 * GlowCursor (React Bits) — estela de luz WebGL que sigue al cursor.
 * Portado tal cual; montado SOLO en el landing (Landing.tsx). Canvas fijo a
 * pantalla completa, pointer-events: none y mix-blend-mode: screen, así no
 * interfiere con clicks ni con el resto del contenido.
 */

const MAX_POINTS = 64;

const VERTEX_SHADER = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

#define MAX_POINTS 64

uniform vec2 uResolution;
uniform vec2 uPoints[MAX_POINTS];
uniform float uPointCount;
uniform vec3 uColor;
uniform vec3 uSecondaryColor;
uniform float uTrailWidth;
uniform float uTaper;
uniform float uGlowIntensity;
uniform float uGlowSpread;
uniform float uHotspot;
uniform float uBrightness;
uniform float uOpacity;
uniform float uPulseSpeed;
uniform float uNoiseStrength;
uniform float uTime;
uniform float uFade;

varying vec2 vUv;

float sRGB(float x) {
  if (x <= 0.00031308) return 12.92 * x;
  return 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float filmGrain(vec2 p, float time) {
  float frame = time * 18.0;
  float frameIndex = mod(floor(frame), 256.0);
  float nextFrameIndex = mod(frameIndex + 1.0, 256.0);
  float blend = fract(frame);
  blend = blend * blend * (3.0 - 2.0 * blend);
  vec2 pixel = floor(p);
  float current = hash(pixel + vec2(frameIndex * 17.0, frameIndex * 31.0));
  float next = hash(pixel + vec2(nextFrameIndex * 17.0, nextFrameIndex * 31.0));
  return mix(current, next, blend) * 2.0 - 1.0;
}

void main() {
  vec2 pixel = vUv * uResolution;
  float denominator = max(uPointCount - 1.0, 1.0);
  float strongest = 0.0;
  float strongestCore = 0.0;
  float colorWeight = 0.0;
  vec3 colorSum = vec3(0.0);

  // Trail envolvente: los puntos viven en [min, max] de uPoints; descartar
  // píxeles lejos de esa caja evita correr el loop completo de segmentos
  // en el ~95% de la pantalla que la estela no toca. La caja sigue siendo
  // válida durante el fade (los puntos no se mueven cuando se desvanecen).
  vec2 lo = uPoints[0];
  vec2 hi = uPoints[0];
  for (int i = 1; i < MAX_POINTS; i++) {
    lo = min(lo, uPoints[i]);
    hi = max(hi, uPoints[i]);
  }
  float pad = uTrailWidth * (uGlowSpread * 1.4 + 1.6) + 4.0;
  if (pixel.x < lo.x - pad || pixel.x > hi.x + pad || pixel.y < lo.y - pad || pixel.y > hi.y + pad) {
    discard;
  }

  for (int i = 0; i < MAX_POINTS - 1; i++) {
    float index = float(i);
    float active = 1.0 - step(uPointCount - 1.0, index);
    if (active < 0.5) break; // puntos inactivos: todos los siguientes también
    vec2 start = uPoints[i];
    vec2 end = uPoints[i + 1];
    vec2 toPixel = pixel - start;
    vec2 segment = end - start;
    float along = clamp(dot(toPixel, segment) / max(dot(segment, segment), 0.0001), 0.0, 1.0);
    float progress = clamp((index + along) / denominator, 0.0, 1.0);
    float life = pow(max(1.0 - progress, 0.0), mix(0.55, 1.25, uTaper));
    float width = uTrailWidth * mix(1.0, 0.25, pow(progress, mix(0.55, 1.6, uTaper)));
    float distanceToTrail = length(toPixel - segment * along);
    float falloff = max(width * (0.8 + uGlowSpread * 1.4), 0.5);
    float beam = min(1.0, (falloff * falloff) / (distanceToTrail * distanceToTrail + falloff * falloff));
    float core = exp(-pow(distanceToTrail / max(width, 0.5), 2.0) * 2.5);
    float pulseAmount = min(abs(uPulseSpeed), 1.0);
    float pulse = 1.0 + sin(uTime * uPulseSpeed * 3.0 - progress * 11.0) * 0.16 * pulseAmount;
    float intensity = (core + beam * uGlowIntensity * 0.55) * life * pulse * active;
    vec3 segmentColor = mix(uColor, uSecondaryColor, progress);

    strongest = max(strongest, intensity);
    strongestCore = max(strongestCore, core * life * active);
    colorSum += segmentColor * intensity;
    colorWeight += intensity;
  }

  float alpha = clamp(strongest * uOpacity * uFade, 0.0, 1.0);
  if (alpha < 0.0005) discard;

  float grain = filmGrain(pixel, uTime);
  float noiseAmount = (1.0 - exp(-uNoiseStrength * 2.2)) * 0.4;
  vec3 color = colorSum / max(colorWeight, 0.0001);
  color = mix(color, vec3(1.0), smoothstep(0.25, 0.95, strongestCore) * uHotspot);
  float luminance = sRGB(clamp(strongest * uBrightness, 0.0, 1.0));
  luminance *= 1.0 + grain * noiseAmount;
  vec3 additiveColor = color * luminance;
  gl_FragColor = vec4(additiveColor, alpha);
}
`;

const hexToRgb = (hex: string): [number, number, number] => {
  let value = (hex || "").replace("#", "").trim();
  if (value.length === 3) value = value.split("").map((c) => c + c).join("");
  const parsed = Number.parseInt(value || "000000", 16);
  return [((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255];
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export interface GlowCursorProps {
  color?: string;
  secondaryColor?: string;
  trailLength?: number;
  trailWidth?: number;
  trailTaper?: number;
  followSpeed?: number;
  glowIntensity?: number;
  glowSpread?: number;
  hotspot?: number;
  brightness?: number;
  opacity?: number;
  pulseSpeed?: number;
  noiseStrength?: number;
  idleFade?: boolean;
  idleTimeout?: number;
  fadeDuration?: number;
  maxDevicePixelRatio?: number;
  enabled?: boolean;
}

export default function GlowCursor({
  color = "#d667f9",
  secondaryColor = "#A78BFA",
  trailLength = 40,
  trailWidth = 8,
  trailTaper = 0.8,
  followSpeed = 0.16,
  glowIntensity = 1.9,
  glowSpread = 1.2,
  hotspot = 0.65,
  brightness = 1.25,
  opacity = 1,
  pulseSpeed = 1.1,
  noiseStrength = 0.035,
  idleFade = true,
  idleTimeout = 700,
  fadeDuration = 900,
  maxDevicePixelRatio = 1.5,
  enabled = true,
}: GlowCursorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const configRef = useRef({
    color, secondaryColor, trailLength, trailWidth, trailTaper, followSpeed,
    glowIntensity, glowSpread, hotspot, brightness, opacity, pulseSpeed,
    noiseStrength, idleFade, idleTimeout, fadeDuration, enabled,
  });
  configRef.current = {
    color, secondaryColor, trailLength, trailWidth, trailTaper, followSpeed,
    glowIntensity, glowSpread, hotspot, brightness, opacity, pulseSpeed,
    noiseStrength, idleFade, idleTimeout, fadeDuration, enabled,
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Canvas IMPERATIVO, siempre recién creado: el contexto WebGL vive y
    // muere con este efecto. Reusar el canvas de React tras un
    // loseContext() devuelve un contexto ya muerto y el link del
    // programa falla (ogl deja uniformLocations undefined → TypeError
    // en el primer render). Canvas propio por montaje = contexto limpio.
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "60";
    canvas.style.mixBlendMode = "screen";
    host.appendChild(canvas);

    const cfg = configRef.current;
    // Sin WebGL (GPU bloqueada, headless, etc.) ogl lanza al construir el
    // Renderer con gl nulo — la estela es decorativa: no debe tumbar la
    // landing entera en el error boundary. Fallamos en silencio.
    let renderer: Renderer;
    try {
      renderer = new Renderer({
        canvas,
        alpha: true,
        dpr: Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio),
      });
    } catch {
      host.removeChild(canvas);
      return;
    }
    const gl = renderer.gl;
    if (!gl) {
      host.removeChild(canvas);
      return;
    }
    gl.clearColor(0, 0, 0, 0);

    const pointData = Array(MAX_POINTS * 2).fill(0);
    const points = Array.from({ length: MAX_POINTS }, () => ({ x: 0, y: 0 }));
    const target = { x: 0, y: 0 };
    const head = { x: 0, y: 0 };

    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uResolution: { value: [1, 1] },
        uPoints: { value: pointData },
        uPointCount: { value: cfg.trailLength },
        uColor: { value: hexToRgb(cfg.color) },
        uSecondaryColor: { value: hexToRgb(cfg.secondaryColor) },
        uTrailWidth: { value: cfg.trailWidth },
        uTaper: { value: cfg.trailTaper },
        uGlowIntensity: { value: cfg.glowIntensity },
        uGlowSpread: { value: cfg.glowSpread },
        uHotspot: { value: cfg.hotspot },
        uBrightness: { value: cfg.brightness },
        uOpacity: { value: cfg.opacity },
        uPulseSpeed: { value: cfg.pulseSpeed },
        uNoiseStrength: { value: cfg.noiseStrength },
        uTime: { value: 0 },
        uFade: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    let width = 1;
    let height = 1;
    let initialized = false;
    let pointerInside = false;
    let fade = 0;
    let lastInputTime = performance.now();
    let lastFrameTime = performance.now();
    let raf = 0;
    let destroyed = false;

    const resize = () => {
      width = Math.max(window.innerWidth, 1);
      height = Math.max(window.innerHeight, 1);
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [width, height];
    };

    const initializeTrail = (x: number, y: number) => {
      target.x = x;
      target.y = y;
      head.x = x;
      head.y = y;
      for (const p of points) {
        p.x = x;
        p.y = y;
      }
      initialized = true;
      fade = 1;
    };

    const updatePointer = (event: PointerEvent) => {
      const x = clamp(event.clientX, 0, width);
      const y = clamp(height - event.clientY, 0, height);
      if (!initialized) initializeTrail(x, y);
      target.x = x;
      target.y = y;
      pointerInside = true;
      lastInputTime = performance.now();
    };

    const onPointerLeave = () => {
      pointerInside = false;
      lastInputTime = performance.now();
    };

    const render = (now: number) => {
      if (destroyed) return;
      const c = configRef.current;
      const delta = Math.min((now - lastFrameTime) / 16.667, 3);
      lastFrameTime = now;

      if (initialized && c.enabled) {
        const headEase = 1 - Math.pow(1 - clamp(c.followSpeed, 0.01, 0.99), delta);
        const chainBase = clamp(0.28 + c.followSpeed * 0.35, 0.08, 0.92);
        const chainEase = 1 - Math.pow(1 - chainBase, delta);
        head.x += (target.x - head.x) * headEase;
        head.y += (target.y - head.y) * headEase;
        points[0].x = head.x;
        points[0].y = head.y;

        for (let i = 1; i < MAX_POINTS; i++) {
          points[i].x += (points[i - 1].x - points[i].x) * chainEase;
          points[i].y += (points[i - 1].y - points[i].y) * chainEase;
        }

        for (let i = 0; i < MAX_POINTS; i++) {
          pointData[i * 2] = points[i].x;
          pointData[i * 2 + 1] = points[i].y;
        }
      }

      const idleFor = now - lastInputTime;
      const shouldFade = c.idleFade && (!pointerInside || idleFor > c.idleTimeout);
      const fadeStep = (16.667 * delta) / Math.max(c.fadeDuration, 16);
      const fadeTarget = initialized && c.enabled && !shouldFade ? 1 : 0;
      fade += (fadeTarget - fade) * Math.min(1, fadeStep * 7);

      program.uniforms.uTime.value = now * 0.001;
      program.uniforms.uFade.value = fade;

      // El contexto puede morir en pleno uso (reciclaje del navegador):
      // ogl no tolera un render sobre contexto perdido (uniformLocations
      // undefined → TypeError). La estela es decorativa: si muere, se
      // apaga en silencio en vez de tumbar la landing.
      if (gl.isContextLost()) return;
      try {
        renderer.render({ scene: mesh });
      } catch {
        return;
      }
      if (!destroyed) raf = requestAnimationFrame(render);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(document.documentElement);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    resize();
    raf = requestAnimationFrame(render);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", updatePointer);
      document.removeEventListener("pointerleave", onPointerLeave);
      mesh.geometry.remove();
      program.remove();
      renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [maxDevicePixelRatio]);

  return <div ref={hostRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] hidden md:block" />;
}
