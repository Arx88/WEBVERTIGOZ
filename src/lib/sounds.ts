/**
 * VÉRTIGO — Motor de sonido del sitio.
 *
 * Síntesis 100% WebAudio en runtime (cero archivos, cero payload).
 *
 * Diseño:
 *   — Cadena de master con compresor suave (pega las capas) + reverb
 *     sintetizada por envío (IR de ruido generada en runtime) + lowpass
 *     de calidez. Nada suena "seco de tutorial".
 *   — Instrumentos con identidad por categoría: pluck FM (madera/kalimba)
 *     para UI, campanas inarmónicas para metal/vidrio, thumps graves para
 *     cuerpos, ruido filtrado para aires y transients.
 *   — Humanización: cada reproducción varía afinación (cents), ganancia y
 *     paneo — repetir una acción nunca suena idéntico.
 *
 * Uso:
 *   import { playSound } from "@/lib/sounds";
 *   playSound("success");
 *
 * Cobertura global: el SoundProvider delega "tap"/"page" en clicks,
 * "hover" en la navegación y sonifica los toasts de Sonner; la ruleta
 * tiene su propio audio scoped.
 */

export type SoundName =
  | "tap"        // click de botón (madera, dry, alternancia L/R)
  | "page"       // navegación interna (whoosh + confirmación)
  | "hover"      // hover en nav (transient casi imperceptible)
  | "swipe"      // avance de paso (wizard, carruseles)
  | "toggle-on"  // switch activado (motivo ascendente)
  | "toggle-off" // switch desactivado (motivo descendente)
  | "pop"        // apertura de modal / panel
  | "success"    // acción completada (toast success)
  | "error"      // acción rechazada (toast error)
  | "chime"      // notificación neutra (toast info)
  | "reveal"     // resultado que aparece (ready, sorteo del captain)
  | "victory"    // victoria / logro
  | "coin";      // apuesta / moneda

const MUTE_KEY = "vertigo-sound-muted";
const MUTE_EVENT = "vertigo-sound-mute-change";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let verb: ConvolverNode | null = null;
let lastPanSide = 1; // el tap alterna izquierda/derecha: micro-vida

/** Volumen general del sitio — presente pero discreto. */
const MASTER_GAIN = 0.5;

/** Jitter de afinación en cents y de ganancia — humanización. */
const jit = (amount: number): number => (Math.random() * 2 - 1) * amount;
const gjit = (g: number): number => g * (0.92 + Math.random() * 0.16);

/** IR de reverb sintetizada: ruido estéreo con decaimiento exponencial. */
function makeImpulse(c: AudioContext, dur: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(2, len, c.sampleRate);
  const pre = Math.floor(c.sampleRate * 0.012); // pre-delay 12ms
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      if (i < pre) {
        d[i] = 0;
        continue;
      }
      const t = (i - pre) / (len - pre);
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4) * 0.5;
    }
  }
  return buf;
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();

      // Reverb por envío.
      verb = ctx.createConvolver();
      verb.buffer = makeImpulse(ctx, 0.55);
      const verbGain = ctx.createGain();
      verbGain.gain.value = 0.6;
      verb.connect(verbGain);

      // Bus: master → compresor (glue) → lowpass (calidez) → salida.
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 18;
      comp.ratio.value = 3;
      comp.attack.value = 0.004;
      comp.release.value = 0.16;
      const warmth = ctx.createBiquadFilter();
      warmth.type = "lowpass";
      warmth.frequency.value = 6200;
      warmth.Q.value = 0.3;
      master.connect(comp);
      comp.connect(warmth);
      warmth.connect(ctx.destination);
      verbGain.connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Nodo de salida por voz: paneo estéreo opcional + envío a reverb.
 * Devuelve el GainNode al que las voces deben conectarse.
 */
function out(pan: number, send: number): GainNode {
  const c = ctx!;
  const exit = c.createGain();
  let dest: AudioNode = master!;
  if (c.createStereoPanner && pan !== 0) {
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(master!);
    dest = p;
  }
  exit.connect(dest);
  if (verb && send > 0) {
    const s = c.createGain();
    s.gain.value = send;
    exit.connect(s);
    s.connect(verb);
  }
  return exit;
}

interface ToneOpts {
  /** Retardo desde "ahora", en segundos. */
  at?: number;
  /** Duración total de la nota. */
  dur: number;
  /** Frecuencia inicial. */
  freq: number;
  /** Barrido de frecuencia opcional (glissando). */
  freqEnd?: number;
  /** Volumen pico de esta voz (0–1, antes del master). */
  gain: number;
  /** Ataque lineal en segundos (suavidad de entrada). */
  attack?: number;
  type?: OscillatorType;
  /** Desafinación en cents — ensancha campanas y pads. */
  detune?: number;
  /** Paneo estéreo -1..1. */
  pan?: number;
  /** Envío a reverb 0..1. */
  send?: number;
}

function tone(o: ToneOpts): void {
  const c = ctx!;
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), t0 + o.dur);
  }
  if (o.detune) osc.detune.setValueAtTime(o.detune, t0);

  const attack = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  osc.connect(g);
  g.connect(out(o.pan ?? 0, o.send ?? 0));
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

interface FMOpts {
  at?: number;
  dur?: number;
  gain?: number;
  /** Ratio modulador/portador: 3≈kalimba, 2≈madera, 1.5≈oscuro. */
  ratio?: number;
  /** Índice de modulación: brillo del ataque. */
  index?: number;
  detune?: number;
  pan?: number;
  send?: number;
}

/** Pluck FM (2 operadores): madera/kalimba — la voz "física" de la UI. */
function pluck(freq: number, o: FMOpts = {}): void {
  const c = ctx!;
  const t0 = c.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.14;
  const f = freq * Math.pow(2, (o.detune ?? 0) / 1200);

  const car = c.createOscillator();
  const mod = c.createOscillator();
  const mg = c.createGain();
  const g = c.createGain();
  car.frequency.setValueAtTime(f, t0);
  mod.frequency.setValueAtTime(f * (o.ratio ?? 3), t0);
  mg.gain.setValueAtTime(f * (o.index ?? 1.6), t0);
  mg.gain.exponentialRampToValueAtTime(1, t0 + 0.05); // el brillo decae rápido
  mod.connect(mg);
  mg.connect(car.frequency);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.07, t0 + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  car.connect(g);
  g.connect(out(o.pan ?? 0, o.send ?? 0));
  mod.start(t0);
  car.start(t0);
  mod.stop(t0 + dur + 0.05);
  car.stop(t0 + dur + 0.05);
}

interface BellOpts {
  at?: number;
  dur?: number;
  gain?: number;
  detune?: number;
  pan?: number;
  send?: number;
}

/** Campana aditiva con parciales inarmónicos (1 : 2.756 : 5.4) — metal/vidrio. */
function bell(freq: number, o: BellOpts = {}): void {
  const c = ctx!;
  const t0 = c.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.9;
  const det = Math.pow(2, (o.detune ?? 0) / 1200);
  const parts: Array<[number, number, number]> = [
    [1, 1, 1], // fundamental
    [2.756, 0.4, 0.55], // parcial inarmónico
    [5.4, 0.18, 0.3], // brillo, decae primero
  ];
  for (const [ratio, amp, dec] of parts) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.frequency.setValueAtTime(freq * ratio * det, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime((o.gain ?? 0.06) * amp, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * dec + 0.05);
    osc.connect(g);
    g.connect(out(o.pan ?? 0, o.send ?? 0));
    osc.start(t0);
    osc.stop(t0 + dur * dec + 0.1);
  }
}

interface NoiseOpts {
  at?: number;
  dur: number;
  gain: number;
  type?: BiquadFilterType;
  freq: number;
  freqEnd?: number;
  Q?: number;
  /** Subida y caída (aires) en vez de ataque instantáneo. */
  swell?: boolean;
  pan?: number;
  send?: number;
}

/** Ruido filtrado: transients (tick), aires (whoosh), texturas. */
function noiseBurst(o: NoiseOpts): void {
  const c = ctx!;
  const t0 = c.currentTime + (o.at ?? 0);
  const len = Math.max(16, Math.floor(c.sampleRate * o.dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.Q.value = o.Q ?? 1;
  f.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd !== undefined) {
    f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + o.dur);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  if (o.swell) {
    g.gain.linearRampToValueAtTime(o.gain, t0 + o.dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  } else {
    g.gain.linearRampToValueAtTime(o.gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  }
  src.connect(f);
  f.connect(g);
  g.connect(out(o.pan ?? 0, o.send ?? 0));
  src.start(t0);
  src.stop(t0 + o.dur + 0.02);
}

/** Transient de ruido ultra corto (14ms) — el "golpe" táctil de un click. */
function tick(pan = 0): void {
  noiseBurst({ dur: 0.014, gain: 0.05, freq: 2400, Q: 0.9, pan });
}

/** Cuerpo grave que cae — el "pecho" de pops y errores. */
function thump(o: { at?: number; f0?: number; f1?: number; dur?: number; gain?: number; send?: number } = {}): void {
  tone({
    freq: o.f0 ?? 170,
    freqEnd: o.f1 ?? 62,
    dur: o.dur ?? 0.1,
    gain: o.gain ?? 0.09,
    attack: 0.004,
    send: o.send ?? 0.05,
  });
}

/**
 * Presets — cada categoría tiene instrumento, registro y espacio propios.
 * Todo en Do mayor / pentatónica cálida; la cohesión la da el master
 * (compresor + reverb), la variedad la dan los instrumentos.
 */
const PRESETS: Record<SoundName, () => void> = {
  tap: () => {
    // Click físico: transient + cuerpo de madera corto, alterna L/R.
    lastPanSide = -lastPanSide;
    const pan = lastPanSide * (0.04 + Math.random() * 0.03);
    tick(pan);
    pluck(540, { dur: 0.07, gain: gjit(0.075), ratio: 2.5, index: 1.2, pan, send: 0.03, detune: jit(35) });
  },
  page: () => {
    // Pasar página: whoosh aireo + pluck grave que confirma el cambio.
    noiseBurst({ dur: 0.13, gain: 0.05, freq: 700, freqEnd: 2600, Q: 0.8, pan: -0.15, send: 0.08, swell: true });
    pluck(392, { at: 0.05, dur: 0.12, gain: 0.045, ratio: 2, index: 1, send: 0.08, detune: jit(20) });
  },
  hover: () => {
    // Casi imperceptible: un susurro de aire agudo.
    noiseBurst({ dur: 0.012, gain: 0.014, freq: 3400, Q: 1.2 });
  },
  swipe: () => {
    // Avance: aire que se abre + quinta corta ascendente (E4→B4).
    noiseBurst({ dur: 0.11, gain: 0.045, freq: 900, freqEnd: 2200, Q: 0.9, send: 0.07, swell: true });
    pluck(329.63, { dur: 0.12, gain: 0.05, ratio: 2, index: 1.1, send: 0.07, detune: jit(20) });
    pluck(493.88, { at: 0.05, dur: 0.14, gain: 0.045, ratio: 2, index: 1.1, send: 0.07, detune: jit(20) });
  },
  "toggle-on": () => {
    // Kalimba ascendente D4→A4 con golpecito final.
    pluck(293.66, { dur: 0.1, gain: 0.07, ratio: 3, index: 1.5, send: 0.06 });
    pluck(440, { at: 0.06, dur: 0.14, gain: 0.065, ratio: 3, index: 1.5, send: 0.06, detune: jit(12) });
    tick(0.05);
  },
  "toggle-off": () => {
    // Espejo descendente A4→D4, un poco más oscuro.
    pluck(440, { dur: 0.09, gain: 0.06, ratio: 3, index: 1.4, send: 0.05 });
    pluck(293.66, { at: 0.06, dur: 0.14, gain: 0.06, ratio: 2.5, index: 1.2, send: 0.05, detune: jit(12) });
  },
  pop: () => {
    // Corcho: golpe de aire + cuerpo grave que cae + sub.
    noiseBurst({ dur: 0.03, gain: 0.03, freq: 1200, Q: 1.4 });
    thump({ f0: 210, f1: 70, dur: 0.09, gain: 0.1 });
    thump({ f0: 90, f1: 50, dur: 0.16, gain: 0.05, send: 0.08 });
  },
  success: () => {
    // Arpegio C mayor "estrumado" (timing humano), sub C3 y brillo final.
    const strum = () => jit(0.012);
    pluck(523.25, { dur: 0.22, gain: 0.085, ratio: 2, index: 1.3, send: 0.12, detune: jit(8) });
    pluck(659.25, { at: 0.07 + strum(), dur: 0.22, gain: 0.075, ratio: 2, index: 1.3, send: 0.12, detune: jit(8) });
    pluck(783.99, { at: 0.14 + strum(), dur: 0.3, gain: 0.075, ratio: 2, index: 1.3, send: 0.14, detune: jit(8) });
    tone({ freq: 130.81, dur: 0.4, gain: 0.04, at: 0.1, send: 0.08 });
    bell(1567.98, { at: 0.24, dur: 0.5, gain: 0.02, send: 0.16 });
  },
  error: () => {
    // Madera oscura descendente (Eb4→Bb3) + thud: "no" sin agresividad.
    pluck(311.13, { dur: 0.18, gain: 0.075, ratio: 1.5, index: 0.9, send: 0.06 });
    pluck(233.08, { at: 0.12, dur: 0.26, gain: 0.075, ratio: 1.5, index: 0.9, send: 0.07, detune: jit(10) });
    thump({ at: 0.12, f0: 130, f1: 70, dur: 0.14, gain: 0.05 });
  },
  chime: () => {
    // Campana de vidrio: fundamental + quinta desafinada, cola larga.
    bell(880, { dur: 1.1, gain: 0.05, send: 0.2, detune: jit(5) });
    bell(1318.51, { at: 0.05, dur: 0.8, gain: 0.022, send: 0.2, detune: 6 });
  },
  reveal: () => {
    // Bloom: aire que se abre + quinta que crece + destello arriba.
    noiseBurst({ dur: 0.28, gain: 0.035, type: "lowpass", freq: 500, freqEnd: 3200, send: 0.1, swell: true });
    tone({ freq: 196, dur: 0.7, gain: 0.055, attack: 0.08, send: 0.14 });
    tone({ freq: 293.66, dur: 0.7, gain: 0.05, attack: 0.1, at: 0.04, send: 0.14 });
    pluck(1318.51, { at: 0.2, dur: 0.3, gain: 0.03, ratio: 2, index: 1.2, send: 0.18 });
  },
  victory: () => {
    // Fanfarria: arpegio G4-D5-G5-D6 estrumado + quintas graves + aire.
    const notes = [392, 587.33, 783.99, 1174.66];
    notes.forEach((f, i) =>
      pluck(f, { at: i * 0.09 + jit(0.012), dur: 0.3, gain: 0.075, ratio: 2, index: 1.3, send: 0.16, detune: jit(8) }));
    tone({ freq: 98, dur: 0.6, gain: 0.05, attack: 0.02, at: 0.27, send: 0.1 });
    tone({ freq: 146.83, dur: 0.6, gain: 0.04, attack: 0.02, at: 0.27, send: 0.1 });
    noiseBurst({ dur: 0.35, gain: 0.03, type: "highpass", freq: 5000, at: 0.3, send: 0.12, swell: true });
  },
  coin: () => {
    // Ficha metálica: doble golpe inarmónico + shimmer.
    bell(1567.98, { dur: 0.16, gain: 0.05, send: 0.08, detune: jit(15) });
    bell(1046.5, { at: 0.06, dur: 0.24, gain: 0.05, send: 0.1, detune: jit(15) });
    noiseBurst({ dur: 0.05, gain: 0.012, type: "highpass", freq: 6000 });
  },
};

/** Dispara un sonido del sitio. Nunca lanza; no-op en server, silencio o SSR. */
export function playSound(name: SoundName): void {
  if (isSoundMuted()) return;
  if (!ensureCtx() || !ctx || !master) return;
  try {
    PRESETS[name]();
  } catch {
    /* un bache de audio nunca rompe la UI */
  }
}

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    window.dispatchEvent(new CustomEvent(MUTE_EVENT, { detail: muted }));
  } catch {
    /* storage bloqueado — el toggle vive solo en memoria */
  }
}

export function onSoundMuteChange(cb: (muted: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => cb((e as CustomEvent<boolean>).detail);
  window.addEventListener(MUTE_EVENT, handler);
  return () => window.removeEventListener(MUTE_EVENT, handler);
}
