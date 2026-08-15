"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Mode, hexToRgba } from "@/lib/ruleta/modes";
import { useConfig, type ConfigMode, type ConfigMap } from "@/lib/ruleta/config";

const MIN_RING = 8;

type Phase = "spinning-game-mode" | "spinning-antimeta-mode" | "spinning-player-mode-direct" | "spinning-player-mode-after-antimeta" | "spinning-map-mode" | "spinning-llave-mode" | "final";
interface ResolvedStep { key: string; mode: ConfigMode; layer: "h"|"v"; accent: string; stepNumber: number; label: string; modesList: ConfigMode[]; }
interface ResolvedMap { key: string; map: ConfigMap; stepNumber: number; }

/**
 * Ruleta VÉRTIGO — porte del repo WEBSITE-VERTIGO original.
 *
 * Refactor:
 * - Scope: en vez de document.body.classList.toggle, usa un wrapper con className propio
 * - Imports: usa @/lib/ruleta/* en vez de @/lib/*
 * - No afecta al resto del sitio (CSS scoping en ruleta.css)
 * - Props opcionales: onResult se llama cuando termina el sorteo (modo integrado)
 */
export interface RouletteProps {
  onResult?: (resolved: ResolvedStep[], resolvedMap: ResolvedMap | null) => void;
  /**
   * Resultados decididos por el servidor ("server decide / client anima").
   * Son los IDs de los modos ganadores (vienen de roulette_draw.result).
   * Cuando está presente, la ruleta reproduce ese resultado en vez de sortear.
   */
  forced?: {
    gameModeId: string;
    antimetaModeId?: string;   // solo si aplica
    playerModeId: string;
    mapId: string;
    llaveId?: string;          // solo si aplica (P1)
  };
  /** Admin: si es false, los viewers no pueden disparar el giro (solo miran) */
  interactive?: boolean;
  /**
   * Demo/tutorial: dispara el primer giro automáticamente cuando termina el
   * loader. Las fases siguientes ya avanzan solas. `/ruleta/demo` no lo usa.
   */
  autoStart?: boolean;
  /**
   * Override de la config de la ruleta (preset del server).
   * Si viene, reemplaza el useConfig/localStorage — la ruleta usa la config
   * del torneo, no la del navegador. Garantiza que todos los viewers ven
   * exactamente el mismo set de opciones.
   */
  configOverride?: Partial<import("@/lib/ruleta/config").ConfigState>;
}

export function Roulette(props: RouletteProps = {}) {
  const { forced } = props;
  const { config: localConfig } = useConfig();
  // El server (configOverride) pisa el localStorage: es la fuente de verdad.
  const config = { ...localConfig, ...props.configOverride };
  const GAME_MODES = config.gameModes, ANTIMETA_MODES = config.antimetaModes, PLAYER_MODES = config.playerModes, MAP_MODES = config.mapModes, LLAVE_MODES = config.llaveModes, firstRound = config.firstRound;
  const soundsEnabled = config.sounds.enabled, soundsVolume = config.sounds.volume;
  const musicEnabled = config.music.enabled, musicVolume = config.music.volume;
  const bgMode = config.background, initialGameModeIndex = config.initialGameModeIndex;

  const musicRef = useRef<HTMLAudioElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const activeStageRef = useRef<HTMLDivElement>(null);
  const cardElsRef = useRef<HTMLDivElement[]>([]);
  const vCardElsRef = useRef<HTMLDivElement[]>([]);
  const flashRef = useRef<HTMLDivElement>(null);
  const embersCanvasRef = useRef<HTMLCanvasElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderBarRef = useRef<HTMLDivElement>(null);
  const s = useRef({ hPos: initialGameModeIndex>=0&&initialGameModeIndex<GAME_MODES.length?initialGameModeIndex:Math.floor(GAME_MODES.length/2), vPos:0, hAnim:0, vAnim:0, fadeAnim:0, spinningH:false, spinningV:false, vFade:0, autoTimer:0, entryTimer:0, audioCtx:null as AudioContext|null });
  const [phase, setPhase] = useState<Phase>("spinning-game-mode");
  const phaseRef = useRef<Phase>("spinning-game-mode");
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const [resolved, setResolved] = useState<ResolvedStep[]>([]);
  const [vFade, setVFade] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [vOn, setVOn] = useState(false);
  const [loaderVisible, setLoaderVisible] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [resolvedMap, setResolvedMap] = useState<ResolvedMap | null>(null);
  const [mapPos, setMapPos] = useState(0);
  const [mapSpinning, setMapSpinning] = useState(false);
  const mapElsRef = useRef<HTMLDivElement[]>([]);
  const mapStateRef = useRef({ pos: 0, anim: 0, spinning: false });
  const ringModesRef = useRef<readonly (ConfigMode|ConfigMap)[]>([]);
  const FORCED_REF = useRef<RouletteProps["forced"]>(undefined);
  // Demo/tutorial: dispara el primer giro solo (sin click) cuando carga todo
  const autoStartedRef = useRef(false);

  const antimetaStep = resolved.find(r => r.label === "ANTIMETA");
  const MAPS_ACTIVE = antimetaStep?.mode.mapPool && antimetaStep.mode.mapPool !== "global" && antimetaStep.mode.mapPool.length ? antimetaStep.mode.mapPool : MAP_MODES;
  const activeModes = phase==="spinning-game-mode"?GAME_MODES:phase==="spinning-antimeta-mode"?ANTIMETA_MODES:phase==="spinning-player-mode-direct"||phase==="spinning-player-mode-after-antimeta"?PLAYER_MODES:phase==="spinning-map-mode"?MAPS_ACTIVE:phase==="spinning-llave-mode"?LLAVE_MODES:GAME_MODES;
  const spinNumber = resolved.length + (resolvedMap ? 1 : 0) + 1;
  const dynPhase = phase==="spinning-map-mode"||phase==="spinning-llave-mode";
  const dynIsV = dynPhase && spinNumber%2===0;
  const isVLayer = phase==="spinning-antimeta-mode"||phase==="spinning-player-mode-direct"||dynIsV;

  const ringModes = useMemo<readonly (ConfigMode|ConfigMap)[]>(()=>{
    const m=activeModes as readonly (ConfigMode|ConfigMap)[];
    if(m.length===0) return m;
    if(m.length>=MIN_RING) return m;
    const out=new Array<ConfigMode|ConfigMap>(MIN_RING);
    for(let i=0;i<MIN_RING;i++) out[i]=m[i%m.length];
    return out;
  },[activeModes]);
  // Ref espejo para que getForcedIndexForPhase siempre lea la lista activa actual
  ringModesRef.current=ringModes;

  const activeH = useCallback(()=>{const N=ringModes.length;return((Math.round(s.current.hPos)%N)+N)%N},[s,ringModes]);
  const activeV = useCallback(()=>{const N=ringModes.length;return((Math.round(s.current.vPos)%N)+N)%N},[s,ringModes]);

  const audioCtx = useCallback(()=>{
    if(!s.current.audioCtx){
      const AC=window.AudioContext||(window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
      s.current.audioCtx=new AC();
    }
    if(s.current.audioCtx.state==="suspended") s.current.audioCtx.resume();
    return s.current.audioCtx;
  },[s]);

  const tickSound = useCallback((progress=0)=>{
    if(!soundsEnabled) return;
    try{
      const a=audioCtx(),t=a.currentTime;
      const f=660-progress*380,d=0.04+progress*0.06,v=(0.06+progress*0.06)*soundsVolume;
      const o=a.createOscillator(),g=a.createGain();
      o.type="triangle";o.frequency.setValueAtTime(f,t);
      o.frequency.exponentialRampToValueAtTime(f*0.7,t+d);
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(v,t+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001,t+d);
      o.connect(g);g.connect(a.destination);
      o.start(t);o.stop(t+d+0.01);
    }catch{}
  },[audioCtx,soundsEnabled,soundsVolume]);

  const gong = useCallback(()=>{
    if(!soundsEnabled) return;
    try{
      const a=audioCtx(),t=a.currentTime,vs=soundsVolume;
      const drum=a.createOscillator(),dg=a.createGain();
      drum.type="sine";drum.frequency.setValueAtTime(110,t);
      drum.frequency.exponentialRampToValueAtTime(55,t+0.08);
      dg.gain.setValueAtTime(0.0001,t);
      dg.gain.linearRampToValueAtTime(0.5*vs,t+0.005);
      dg.gain.exponentialRampToValueAtTime(0.0001,t+1.5);
      drum.connect(dg);dg.connect(a.destination);
      drum.start(t);drum.stop(t+1.6);

      const cl=a.createOscillator(),cg=a.createGain();
      cl.type="triangle";cl.frequency.setValueAtTime(800,t);
      cg.gain.setValueAtTime(0.2*vs,t);
      cg.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
      cl.connect(cg);cg.connect(a.destination);
      cl.start(t);cl.stop(t+0.05);

      const h=a.createOscillator(),hg=a.createGain();
      h.type="sine";h.frequency.setValueAtTime(165,t);
      hg.gain.setValueAtTime(0.0001,t);
      hg.gain.linearRampToValueAtTime(0.12*vs,t+0.01);
      hg.gain.exponentialRampToValueAtTime(0.0001,t+1.2);
      h.connect(hg);hg.connect(a.destination);
      h.start(t);h.stop(t+1.3);
    }catch{}
  },[audioCtx,soundsEnabled,soundsVolume]);

  const selectSound = useCallback(()=>{
    if(!soundsEnabled) return;
    try{
      const a=audioCtx(),t=a.currentTime;
      const o=a.createOscillator(),g=a.createGain();
      o.type="triangle";o.frequency.setValueAtTime(660,t);
      o.frequency.exponentialRampToValueAtTime(880,t+0.03);
      g.gain.setValueAtTime(0.06*soundsVolume,t);
      g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
      o.connect(g);g.connect(a.destination);
      o.start(t);o.stop(t+0.09);
    }catch{}
  },[audioCtx,soundsEnabled,soundsVolume]);

  // ── "server decide / client anima" ──────────────────────────
  // `forced` trae los IDs de los modos ganadores decididos por el server.
  // Mapeamos ID → índice dentro de la lista ACTIVA actual (ringModes), robusto
  // aunque el anillo esté rellenado con repeticiones (< MIN_RING).
  const FORCED=props.forced;
  FORCED_REF.current=FORCED;
  const getForcedIndexForPhase=(ph:Phase):number|null=>{
    const F=FORCED_REF.current;
    if(!F) return null;
    const targetId =
      ph==="spinning-game-mode"?F.gameModeId:
      ph==="spinning-antimeta-mode"?F.antimetaModeId:
      (ph==="spinning-player-mode-direct"||ph==="spinning-player-mode-after-antimeta")?F.playerModeId:
      ph==="spinning-map-mode"?F.mapId:
      ph==="spinning-llave-mode"?F.llaveId:undefined;
    if(!targetId) return null;
    // Leer la lista activa actual vía ref (siempre actualizada tras render)
    const list=(ringModesRef.current??[]) as readonly {id:string}[];
    for(let i=0;i<list.length;i++){ if(list[i].id===targetId) return i; }
    return null;
  };

  const dramaticEase = (p:number)=>1-Math.pow(1-p,9);

  const renderH = useCallback(()=>{
    const N=ringModes.length,cw=cardElsRef.current[0]?.offsetWidth||600,sp=cw*0.66;
    const pm=((s.current.hPos%N)+N)%N;
    const act=((Math.round(s.current.hPos)%N)+N)%N;
    cardElsRef.current.forEach((el,i)=>{
      if(!el) return;
      let off=i-pm;
      if(off>N/2) off-=N;
      if(off<-N/2) off+=N;
      const a=Math.abs(off);
      const cl=Math.max(-1.25,Math.min(1.25,off));
      const x=off*sp;
      const z=-Math.min(a,2.5)*cw*0.38;
      const ry=cl*-28;
      const sc=a<1?1-a*0.12:Math.max(0.62,0.88-(a-1)*0.13);
      el.style.transform=`translate(-50%,-50%) translate3d(${x}px,0,${z}px) rotateY(${ry}deg) scale(${sc})`;
      el.style.zIndex=String(200-Math.round(a*20));
      el.style.opacity=String(a>2.6?0:1-Math.max(0,a-1.35)*0.5);
      el.classList.toggle("is-active",i===act);
    });
  },[s,ringModes]);

  const renderV = useCallback(()=>{
    const N=ringModes.length,cw=vCardElsRef.current[0]?.offsetWidth||600,ch=cw*9/16,sp=ch*0.74;
    const pm=((s.current.vPos%N)+N)%N;
    const act=((Math.round(s.current.vPos)%N)+N)%N;
    vCardElsRef.current.forEach((el,i)=>{
      if(!el) return;
      let off=i-pm;
      if(off>N/2) off-=N;
      if(off<-N/2) off+=N;
      const a=Math.abs(off);
      const cl=Math.max(-1.2,Math.min(1.2,off));
      const y=off*sp;
      const z=-Math.min(a,2.2)*ch*0.95;
      const rx=cl*30;
      const sc=a<1?1-a*0.1:Math.max(0.7,0.9-(a-1)*0.12);
      el.style.transform=`translate(-50%,-50%) translate3d(0,${y}px,${z}px) rotateX(${rx}deg) scale(${sc})`;
      el.style.zIndex=String(300-Math.round(a*20));
      el.style.opacity=String((a>2.4?0:1-Math.max(0,a-1.25)*0.55)*s.current.vFade);
      el.classList.toggle("is-active",i===act);
    });
  },[s,ringModes]);

  const animateH = useCallback((tg:number,du:number,done?:()=>void)=>{
    cancelAnimationFrame(s.current.hAnim);
    const start=s.current.hPos,t0=performance.now();
    let li=Math.floor(start);
    const step=(n:number)=>{
      const p=Math.min(1,(n-t0)/du);
      s.current.hPos=start+(tg-start)*dramaticEase(p);
      const ci=Math.floor(s.current.hPos);
      if(ci!==li){li=ci;tickSound(p);}
      renderH();
      if(p<1) s.current.hAnim=requestAnimationFrame(step);
      else{s.current.hPos=tg;renderH();done?.();}
    };
    s.current.hAnim=requestAnimationFrame(step);
  },[s,renderH,tickSound]);

  const animateV = useCallback((tg:number,du:number,done?:()=>void)=>{
    cancelAnimationFrame(s.current.vAnim);
    const start=s.current.vPos,t0=performance.now();
    let li=Math.floor(start);
    const step=(n:number)=>{
      const p=Math.min(1,(n-t0)/du);
      s.current.vPos=start+(tg-start)*dramaticEase(p);
      const ci=Math.floor(s.current.vPos);
      if(ci!==li){li=ci;tickSound(p);}
      renderV();
      if(p<1) s.current.vAnim=requestAnimationFrame(step);
      else{s.current.vPos=tg;renderV();done?.();}
    };
    s.current.vAnim=requestAnimationFrame(step);
  },[s,renderV,tickSound]);

  const setVFadeAnim = useCallback((target:number)=>{
    cancelAnimationFrame(s.current.fadeAnim);
    const sv=s.current.vFade,t0=performance.now();
    const step=(n:number)=>{
      const p=Math.min(1,(n-t0)/550);
      s.current.vFade=sv+(target-sv)*p;
      setVFade(s.current.vFade);
      renderV();
      if(p<1) s.current.fadeAnim=requestAnimationFrame(step);
    };
    s.current.fadeAnim=requestAnimationFrame(step);
  },[s,renderV]);

  const triggerFlash = useCallback(()=>{
    const f=flashRef.current;
    if(!f) return;
    f.classList.remove("go");
    void f.offsetWidth;
    f.classList.add("go");
  },[]);

  const finishMap = useCallback((mode: ConfigMode | ConfigMap) => {
    setResolvedMap({ key: `map-${mode.title}`, map: mode as ConfigMap, stepNumber: resolved.length + 1 });
    if (firstRound && LLAVE_MODES.length) {
      setPhase("spinning-llave-mode");
    } else {
      setPhase("final");
      window.setTimeout(() => setShowResults(true), 200);
      window.setTimeout(() => setDownloadReady(true), 2400);
    }
  }, [firstRound, LLAVE_MODES, resolved.length]);

  const spinH = useCallback(()=>{
    if(activeModes.length===0) return;
    if(s.current.spinningH||s.current.spinningV||mapStateRef.current.spinning) return;
    window.clearTimeout(s.current.entryTimer);
    s.current.spinningH=true;
    setSpinning(true);
    const N=ringModes.length,start=s.current.hPos,cm=((start%N)+N)%N;
    // "server decide / client anima": si hay resultado forzado para esta fase, usarlo
    const forcedIdx = getForcedIndexForPhase(phaseRef.current);
    const ti=(forcedIdx!=null?forcedIdx:Math.floor(Math.random()*N))%N;
    let d=((ti-cm)%N+N)%N;
    if(d===0) d=N;
    const L=6+Math.floor(Math.random()*4);
    animateH(start+L*N+d,7000+Math.random()*1500,()=>{
      s.current.spinningH=false;
      setSpinning(false);
      landedH();
    });
  },[s,ringModes,activeModes,animateH]);

  const landedH = useCallback(()=>{
    const i=activeH(),mode=ringModes[i] as ConfigMode;
    triggerFlash();
    const fr=cardElsRef.current[i]?.querySelector(".card-frame") as HTMLElement | null;
    if(fr){fr.classList.remove("win");void fr.offsetWidth;fr.classList.add("win");}
    gong();
    window.clearTimeout(s.current.entryTimer);
    s.current.entryTimer=window.setTimeout(()=>{
      const curPhase=phaseRef.current;
      if(curPhase==="spinning-player-mode-after-antimeta"){
        setResolved(p=>[...p,{key:`step-3-${mode.title}`,mode,layer:"h",accent:mode.color,stepNumber:3,label:"FORMATO",modesList:PLAYER_MODES}]);
        setPhase("spinning-map-mode");
        return;
      }
      if(curPhase==="spinning-map-mode"){finishMap(mode);return;}
      if(curPhase==="spinning-llave-mode"){
        setResolved(p=>[...p,{key:`step-llave-${mode.title}`,mode,layer:"h",accent:mode.color,stepNumber:resolved.length+2,label:"LLAVE",modesList:LLAVE_MODES}]);
        setPhase("final");
        window.setTimeout(()=>setShowResults(true),200);
        window.setTimeout(()=>setDownloadReady(true),2400);
        return;
      }
      setResolved(p=>[...p,{key:`step-1-${mode.title}`,mode,layer:"h",accent:mode.color,stepNumber:1,label:"MODO",modesList:GAME_MODES}]);
      if(mode.title==="ANTIMETA"){
        s.current.vPos=0;s.current.vFade=0;setVFade(0);
        setPhase("spinning-antimeta-mode");
      } else {
        s.current.vPos=0;s.current.vFade=0;setVFade(0);
        setPhase("spinning-player-mode-direct");
      }
    },1500);
  },[s,activeH,ringModes,triggerFlash,gong,PLAYER_MODES,GAME_MODES,LLAVE_MODES,finishMap,resolved.length]);

  const spinV = useCallback(()=>{
    if(activeModes.length===0) return;
    if(s.current.spinningV||s.current.spinningH) return;
    s.current.spinningV=true;
    setSpinning(true);
    const N=ringModes.length,start=s.current.vPos,cm=((start%N)+N)%N;
    const forcedIdx = getForcedIndexForPhase(phaseRef.current);
    const ti=(forcedIdx!=null?forcedIdx:Math.floor(Math.random()*N))%N;
    let d=((ti-cm)%N+N)%N;
    if(d===0) d=N;
    const L=6+Math.floor(Math.random()*4);
    animateV(start+L*N+d,7000+Math.random()*1500,()=>{
      s.current.spinningV=false;
      setSpinning(false);
      landedV();
    });
  },[s,ringModes,activeModes,animateV]);

  const landedV = useCallback(()=>{
    const i=activeV(),mode=ringModes[i] as ConfigMode;
    triggerFlash();
    const fr=vCardElsRef.current[i]?.querySelector(".card-frame") as HTMLElement | null;
    if(fr){fr.classList.remove("win");void fr.offsetWidth;fr.classList.add("win");}
    gong();
    setVFadeAnim(0);
    window.clearTimeout(s.current.entryTimer);
    s.current.entryTimer=window.setTimeout(()=>{
      const curPhase=phaseRef.current;
      if(curPhase==="spinning-antimeta-mode"){
        setResolved(p=>[...p,{key:`step-2-${mode.title}`,mode,layer:"v",accent:mode.color,stepNumber:2,label:"ANTIMETA",modesList:ANTIMETA_MODES}]);
        s.current.hPos=Math.round(s.current.hPos);
        setPhase("spinning-player-mode-after-antimeta");
      } else if(curPhase==="spinning-llave-mode"){
        setResolved(p=>[...p,{key:`step-llave-${mode.title}`,mode,layer:"v",accent:mode.color,stepNumber:resolved.length+2,label:"LLAVE",modesList:LLAVE_MODES}]);
        setPhase("final");
        window.setTimeout(()=>setShowResults(true),200);
        window.setTimeout(()=>setDownloadReady(true),2400);
      } else if(curPhase==="spinning-map-mode"){
        finishMap(mode);
      } else {
        setResolved(p=>[...p,{key:`step-2-${mode.title}`,mode,layer:"v",accent:mode.color,stepNumber:2,label:"FORMATO",modesList:PLAYER_MODES}]);
        setPhase("spinning-map-mode");
      }
    },1700);
  },[s,activeV,ringModes,triggerFlash,gong,setVFadeAnim,ANTIMETA_MODES,PLAYER_MODES,LLAVE_MODES,finishMap,resolved.length]);

  const handleSpinClick = useCallback(()=>{
    if(s.current.spinningH||s.current.spinningV) return;
    const curPhase=phaseRef.current;
    const dyn=(curPhase==="spinning-map-mode"||curPhase==="spinning-llave-mode")&&(resolved.length+(resolvedMap?1:0)+1)%2===0;
    if(curPhase==="spinning-antimeta-mode"||curPhase==="spinning-player-mode-direct"||dyn){
      if(s.current.vFade<1){
        setVFadeAnim(1);
        window.setTimeout(()=>spinV(),600);
      } else {
        spinV();
      }
    } else {
      spinH();
    }
  },[s,spinH,spinV,setVFadeAnim,resolved.length,resolvedMap]);

  useEffect(()=>{
    const isV=phase==="spinning-antimeta-mode"||phase==="spinning-player-mode-direct"||dynIsV;
    if(isV){
      setVOn(true);
      s.current.vPos=0;
      s.current.vFade=0;
      setVFade(0);
      if(activeModes.length===0){
        const curPhase=phaseRef.current;
        if(curPhase==="spinning-antimeta-mode"){
          setPhase("spinning-player-mode-after-antimeta");
        } else if(curPhase==="spinning-map-mode"||curPhase==="spinning-llave-mode"){
          setPhase("final");
          window.setTimeout(()=>setShowResults(true),200);
          window.setTimeout(()=>setDownloadReady(true),2400);
        } else {
          setPhase("spinning-map-mode");
        }
        return;
      }
      const t=window.setTimeout(()=>{
        setVFadeAnim(1);
        window.setTimeout(()=>{
          if(!s.current.spinningV) spinV();
        },900);
      },100);
      return()=>window.clearTimeout(t);
    } else if(phase==="spinning-player-mode-after-antimeta"||(dynPhase&&!dynIsV)){
      setVOn(false);
      if(activeModes.length===0){
        if(phase==="spinning-map-mode"||phase==="spinning-llave-mode"){
          setPhase("final");
          window.setTimeout(()=>setShowResults(true),200);
          window.setTimeout(()=>setDownloadReady(true),2400);
        } else {
          setPhase("spinning-map-mode");
        }
        return;
      }
      const t=window.setTimeout(()=>{
        if(!s.current.spinningH) spinH();
      },800);
      return()=>window.clearTimeout(t);
    }
  },[phase,activeModes,dynIsV,setVFadeAnim,spinV,spinH,s]);

  // Demo/tutorial: con `autoStart` el primer giro se dispara solo
  // (las fases siguientes ya avanzan automáticamente).
  useEffect(() => {
    if (!props.autoStart || autoStartedRef.current) return;
    const hasForced = !!props.forced;
    // sin forced (ruleta libre): la demo no avanza sola, el humano gira
    if (!hasForced) return;
    autoStartedRef.current = true;
    const t = window.setTimeout(() => handleSpinClick(), 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoStart, props.forced]);

  useEffect(()=>{
    const audio=musicRef.current;
    if(!audio) return;
    audio.volume=musicVolume;
    audio.loop=true;
    if(musicEnabled){
      audio.play().catch(()=>{});
    } else {
      audio.pause();
    }
  },[musicEnabled,musicVolume]);

  useEffect(()=>{
    if(!musicEnabled) return;
    const onInt=()=>{
      const a=musicRef.current;
      if(a&&a.paused) a.play().catch(()=>{});
      window.removeEventListener("click",onInt);
      window.removeEventListener("keydown",onInt);
    };
    window.addEventListener("click",onInt);
    window.addEventListener("keydown",onInt);
    return()=>{
      window.removeEventListener("click",onInt);
      window.removeEventListener("keydown",onInt);
    };
  },[musicEnabled]);

  useEffect(()=>{
    const canvas=embersCanvasRef.current;
    if(!canvas) return;
    const ctx=canvas.getContext("2d");
    if(!ctx) return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let arr:Array<{x:number;y:number;r:number;vy:number;vx:number;a:number;hue:number}>=[] as never;
    const size=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
    size();
    const spawn=(init:boolean)=>{
      const teal=Math.random()>0.55;
      return{x:Math.random()*window.innerWidth,y:init?Math.random()*window.innerHeight:window.innerHeight+12,r:Math.random()*2.2+0.6,vy:-(Math.random()*0.6+0.25),vx:(Math.random()-0.5)*0.4,a:Math.random()*0.45+0.15,hue:teal?168+Math.random()*12:320+Math.random()*15} as never;
    };
    for(let i=0;i<70;i++) arr.push(spawn(true));
    let raf=0;
    const loop=()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for(const p of arr){
        p.x+=p.vx;
        p.y+=p.vy;
        if(p.y<-14) Object.assign(p,spawn(false));
        ctx.beginPath();
        ctx.fillStyle=`hsla(${p.hue},90%,62%,${Math.max(0.05,p.a)})`;
        ctx.shadowColor=p.hue>300?"rgba(255,46,126,.7)":"rgba(34,229,194,.7)";
        ctx.shadowBlur=8;
        ctx.arc(p.x,p.y,p.r,0,7);
        ctx.fill();
      }
      raf=requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener("resize",size);
    return()=>{
      cancelAnimationFrame(raf);
      window.removeEventListener("resize",size);
    };
  },[]);

  useEffect(()=>{
    requestAnimationFrame(()=>renderH());
    const allModes=[...GAME_MODES,...ANTIMETA_MODES,...PLAYER_MODES,...LLAVE_MODES];
    let lc=0,lh=false;
    const hide=()=>{
      if(lh) return;
      lh=true;
      setLoaderVisible(false);
      window.setTimeout(()=>loaderRef.current?.remove(),700);
    };
    allModes.forEach(m=>{
      const im=new Image();
      im.src=m.img;
      im.onload=im.onerror=()=>{
        lc++;
        if(loaderBarRef.current) loaderBarRef.current.style.width=(lc/allModes.length*100)+"%";
        if(lc>=allModes.length) window.setTimeout(hide,350);
      };
    });
    const fp=new Image();
    fp.src="/fondo.webp";
    window.setTimeout(hide,10000);
    return()=>{
      window.clearTimeout(s.current.entryTimer);
      cancelAnimationFrame(s.current.hAnim);
      cancelAnimationFrame(s.current.vAnim);
      cancelAnimationFrame(s.current.fadeAnim);
    };
  },[]);

  useEffect(()=>{
    if(phase!=="spinning-game-mode"){
      s.current.hPos=0;
      s.current.vPos=0;
      s.current.vFade=0;
      setVFade(0);
    }
    const raf=requestAnimationFrame(()=>{
      if(isVLayer) renderV();
      else renderH();
    });
    return()=>cancelAnimationFrame(raf);
  },[phase]);

  useEffect(()=>{
    const onResize=()=>{renderH();renderV();};
    window.addEventListener("resize",onResize);
    return()=>window.removeEventListener("resize",onResize);
  },[renderH,renderV]);

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(s.current.spinningH||s.current.spinningV) return;
      const N=activeModes.length;
      if(N===0) return;
      if(e.key===" "){e.preventDefault();handleSpinClick();}
      else if(e.key==="ArrowRight"&&!isVLayer){e.preventDefault();animateH(Math.round(s.current.hPos)+1,650);}
      else if(e.key==="ArrowLeft"&&!isVLayer){e.preventDefault();animateH(Math.round(s.current.hPos)-1,650);}
      else if(e.key==="ArrowDown"&&isVLayer){e.preventDefault();animateV(Math.round(s.current.vPos)+1,600);}
      else if(e.key==="ArrowUp"&&isVLayer){e.preventDefault();animateV(Math.round(s.current.vPos)-1,600);}
      else if(e.key==="Enter"){e.preventDefault();handleSpinClick();}
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[s,activeModes,isVLayer,animateH,animateV,handleSpinClick]);

  const handleReset = useCallback(()=>{
    setResolved([]);
    setResolvedMap(null);
    setPhase("spinning-game-mode");
    setShowResults(false);
    setDownloadReady(false);
    s.current.hPos=initialGameModeIndex>=0&&initialGameModeIndex<GAME_MODES.length?initialGameModeIndex:Math.floor(GAME_MODES.length/2);
    s.current.vPos=0;
    s.current.vFade=0;
    setVFade(0);
    setVOn(false);
    mapStateRef.current.pos=0;
  },[s,initialGameModeIndex,GAME_MODES]);

  // Llamar onResult cuando el sorteo termina (phase=final y showResults=true)
  const onResultRef = useRef(props.onResult);
  onResultRef.current = props.onResult;
  useEffect(() => {
    if (phase === "final" && showResults && onResultRef.current) {
      // Esperar 2.5s para que el usuario vea los resultados en la ruleta antes de avanzar
      const timer = setTimeout(() => {
        onResultRef.current?.(resolved, resolvedMap);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, showResults, resolved, resolvedMap]);

  return (
    <div
      ref={wrapperRef}
      className={`ruleta-wrapper${vOn ? " v-on" : ""}${config.epicCards ? " epic-cards" : ""}`}
    >
      <audio ref={musicRef} src="/iron-banner-rise.mp3" preload="auto" aria-hidden="true" />
      {bgMode==="fondo"&&<div className="fondo-bg" />}
      {bgMode==="fondo"&&<div className="vortex" style={{opacity:0.3}} />}
      {bgMode==="vortex"&&<div className="vortex vortex-main" />}
      <div className="speedlines" />
      <div className="burst b1" />
      <div className="burst b2" />
      <canvas id="embers" ref={embersCanvasRef} />
      <div className="grain" />

      <div className="scene">
        <div className="floor-glow" />
        <div className="cross-glow" />
        <div className="h-layer">
          <div className="stage" key={phase} ref={activeStageRef}>
            {resolved.map(step=>(
              <div key={step.key} className="locked-wrap" style={{opacity:spinning?0:1} as React.CSSProperties}>
                <ResolvedLayer step={step} />
              </div>
            ))}
            {(phase==="spinning-game-mode"||phase==="spinning-player-mode-after-antimeta"||(dynPhase&&!dynIsV))&&ringModes.map((m,i)=>(
              <div key={`${m.id}~${i}`} ref={el=>{if(el)cardElsRef.current[i]=el;}} className="card h-card" style={{"--ac":m.color,"--ac-soft":hexToRgba(m.color,0.35)} as React.CSSProperties}
                onClick={()=>{
                  if(s.current.spinningH) return;
                  if(i===activeH()) handleSpinClick();
                  else {
                    selectSound();
                    const N=ringModes.length;
                    let d=i-(((s.current.hPos%N)+N)%N);
                    while(d<=0) d+=N;
                    animateH(s.current.hPos+d,650);
                  }
                }}>
                <CardInner mode={m} />
              </div>
            ))}
          </div>
        </div>
        <div className="v-layer" style={{ zIndex: (phase==="spinning-antimeta-mode"||phase==="spinning-player-mode-direct"||(dynPhase&&dynIsV)) ? undefined : 0 }}>
          <div className="v-stage">
            {(phase==="spinning-antimeta-mode"||phase==="spinning-player-mode-direct"||(dynPhase&&dynIsV))&&ringModes.map((m,i)=>(
              <div key={`${m.id}~${i}`} ref={el=>{if(el)vCardElsRef.current[i]=el;}} className="card v-card" style={{"--ac":m.color,"--ac-soft":hexToRgba(m.color,0.35),opacity:vFade} as React.CSSProperties}
                onClick={()=>{
                  if(s.current.spinningV) return;
                  if(i===activeV()) handleSpinClick();
                  else {
                    selectSound();
                    const N=ringModes.length;
                    let d=i-(((s.current.vPos%N)+N)%N);
                    while(d<=0) d+=N;
                    animateV(s.current.vPos+d,650);
                  }
                }}>
                <CardInner mode={m} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flash" ref={flashRef} />

      {showResults&&(
        <section className="results" aria-live="polite">
          <header className="results-head">
            <span className="results-eyebrow">SORTEO FINALIZADO</span>
            <h2 className="results-h">RESULTADOS</h2>
          </header>
          <div className="results-cards">
            {(resolvedMap&&resolved.length>0&&resolved[resolved.length-1].label==="LLAVE"?[...resolved.slice(0,-1),"__map",resolved[resolved.length-1]]:resolvedMap?[...resolved,"__map"]:resolved).map((item,idx)=>item==="__map"&&resolvedMap?(
              <article key={resolvedMap.key} className="rcard" style={{"--rc-accent":resolvedMap.map.color} as React.CSSProperties}>
                {resolvedMap.map.img?(
                  <>
                    <div className="rcard-img-wrap"><img src={resolvedMap.map.img} alt={resolvedMap.map.title} loading="eager" /></div>
                    <div className="rcard-shade" />
                  </>
                ):(
                  <div className="rcard-map-bg" style={{background:resolvedMap.map.color}} />
                )}
                <div className="rcard-body">
                  <span className="rcard-idx">PASO {String(resolvedMap.stepNumber).padStart(2,"0")}</span>
                  <h3 className="rcard-title">{resolvedMap.map.title}</h3>
                  <p className="rcard-tagline">{resolvedMap.map.tagline}</p>
                </div>
              </article>
            ):(
              <article key={(item as ResolvedStep).key} className="rcard" style={{"--rc-accent":(item as ResolvedStep).accent} as React.CSSProperties}>
                <div className="rcard-img-wrap"><img src={(item as ResolvedStep).mode.img} alt={(item as ResolvedStep).mode.title} loading="eager" width={3344} height={1882} /></div>
                <div className="rcard-shade" />
                <div className="rcard-body">
                  <span className="rcard-idx">PASO {String((item as ResolvedStep).stepNumber).padStart(2,"0")}</span>
                  <h3 className="rcard-title">{(item as ResolvedStep).mode.title}</h3>
                  <p className="rcard-tagline">{(item as ResolvedStep).mode.tagline}</p>
                </div>
              </article>
            ))}
          </div>
          {downloadReady&&(
            <div className="results-cta">
              <button onClick={handleReset} className="btn-ghost">NUEVO SORTEO</button>
            </div>
          )}
        </section>
      )}

      {loaderVisible&&(
        <div className="loader" ref={loaderRef}>
          <div className="loader-logo-wrap">
            <img src="/logo.png" alt="VERTIGO Ruleta" className="loader-logo" width={120} height={120} />
          </div>
          <h2 className="loader-title">RULETA DEL TORNEO</h2>
          <p className="loader-subtitle">Forjando la cruz de ruletas…</p>
          <div className="loader-bar"><i ref={loaderBarRef} /></div>
        </div>
      )}
    </div>
  );
}

function CardInner({ mode }: { mode: ConfigMode | ConfigMap }) {
  return (
    <div className="card-frame">
      <img src={mode.img} alt={mode.title} draggable={false} width={3344} height={1882} loading="eager" />
      <div className="shade" />
      <div className="shine" />
    </div>
  );
}

function ResolvedLayer({ step }: { step: ResolvedStep }) {
  return (
    <div className="h-layer locked-layer">
      <div className="stage">
        <div className="card h-card is-active locked-card" style={{"--ac":step.mode.color,"--ac-soft":hexToRgba(step.mode.color,0.35),transform:"translate(-50%, -50%) translate3d(0,0,0) rotateY(0deg) scale(1)",opacity:1,zIndex:50} as React.CSSProperties}>
          <CardInner mode={step.mode} />
        </div>
      </div>
    </div>
  );
}
