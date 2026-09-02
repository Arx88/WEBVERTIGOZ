/**
 * Stream Convergence — fuentes compartidas entre el componente cliente
 * (stream-convergence-background.tsx) y el bootstrap pre-hidratación.
 *
 * Este archivo NO es "use client": el PageLoader (server component) lo
 * importa para inyectar el mismo shader en el script inline, y el
 * componente cliente lo usa para compilar el programa WebGL. Así hay una
 * única fuente de verdad del efecto.
 */

export const STREAM_CONVERGENCE_VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const STREAM_CONVERGENCE_FRAGMENT_SHADER = `
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

// Valores por defecto del efecto (el bootstrap replica la apariencia
// exacta del componente con estos parámetros).
export const STREAM_CONVERGENCE_DEFAULT_SPEED = 0.7;
export const STREAM_CONVERGENCE_DEFAULT_FIDELITY = 0.5;

/**
 * Construye el script inline del bootstrap pre-hidratación (ES5 puro:
 * corre en el primer parseo del HTML, antes de que exista React).
 *
 * Por qué existe: en una carga real, el loading.tsx del servidor se pinta
 * como HTML crudo ANTES de que React hidrate (en dev, mientras el bundle
 * compila, esa ventana dura segundos). En esa ventana el canvas existía
 * pero nadie lo dibujaba → solo se veía el gradiente CSS de respaldo
 * ("fondo sólido"). Este script arranca el WebGL sobre el MISMO canvas
 * que React va a hidratar, y expone host.__vertigoBoot para que el
 * componente cliente lo adopte (frena el loop y toma el contexto).
 */
export function buildStreamConvergenceBootstrapJS(): string {
  const vert = JSON.stringify(STREAM_CONVERGENCE_VERTEX_SHADER);
  const frag = JSON.stringify(STREAM_CONVERGENCE_FRAGMENT_SHADER);
  const speed = String(STREAM_CONVERGENCE_DEFAULT_SPEED);
  const fidelity = String(STREAM_CONVERGENCE_DEFAULT_FIDELITY);
  return `(function(){
"use strict";
var VERT=${vert};
var FRAG="precision highp float;\\n"+${frag};
function boot(host){
  if(host.__vertigoBoot)return;
  var canvas=host.querySelector("canvas");
  if(!canvas)return;
  var gl=canvas.getContext("webgl",{alpha:true,antialias:false});
  if(!gl)return;
  function sh(type,src){
    var s=gl.createShader(type);
    if(!s)return null;
    gl.shaderSource(s,src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){gl.deleteShader(s);return null;}
    return s;
  }
  var v=sh(gl.VERTEX_SHADER,VERT);
  var f=sh(gl.FRAGMENT_SHADER,FRAG);
  if(!v||!f)return;
  var prog=gl.createProgram();
  if(!prog){gl.deleteShader(v);gl.deleteShader(f);return;}
  gl.attachShader(prog,v);
  gl.attachShader(prog,f);
  gl.linkProgram(prog);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){gl.deleteProgram(prog);return;}
  gl.useProgram(prog);
  var buf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(prog,"position");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  var uTime=gl.getUniformLocation(prog,"u_time");
  var uRes=gl.getUniformLocation(prog,"u_resolution");
  var uFid=gl.getUniformLocation(prog,"u_interactive_fidelity");
  var raf=0;
  function resize(){
    var r=host.getBoundingClientRect();
    var dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.max(1,Math.round(r.width*dpr));
    canvas.height=Math.max(1,Math.round(r.height*dpr));
    gl.viewport(0,0,canvas.width,canvas.height);
    if(uRes)gl.uniform2f(uRes,canvas.width,canvas.height);
  }
  function free(lose){
    if(raf)cancelAnimationFrame(raf);
    raf=0;
    window.removeEventListener("resize",resize);
    if(prog)gl.deleteProgram(prog);
    if(buf)gl.deleteBuffer(buf);
    if(lose&&gl.getExtension("WEBGL_lose_context"))gl.getExtension("WEBGL_lose_context").loseContext();
    host.__vertigoBoot=null;
  }
  function tick(now){
    raf=0;
    if(!host.isConnected){free(true);return;}
    if(gl.isContextLost())return;
    if(document.hidden){raf=requestAnimationFrame(tick);return;}
    if(uTime)gl.uniform1f(uTime,now*0.0003*${speed});
    if(uFid)gl.uniform1f(uFid,${fidelity});
    gl.drawArrays(gl.TRIANGLES,0,6);
    raf=requestAnimationFrame(tick);
  }
  host.__vertigoBoot={stop:function(){
    free(false);
  }};
  window.addEventListener("resize",resize);
  resize();
  raf=requestAnimationFrame(tick);
}
var hosts=document.querySelectorAll(".stream-convergence-bg");
for(var i=0;i<hosts.length;i++){
  try{boot(hosts[i]);}catch(e){}
}
// El script corre antes/después de que el canvas exista según el orden de
// parseo del HTML: si no había host aún, observar el DOM hasta que llegue
// (y auto-desmontarse al encontrarlo — es un observer de un solo uso).
if(hosts.length===0){
  var mo=new MutationObserver(function(muts,obs){
    for(var m=0;m<muts.length;m++){
      var added=muts[m].addedNodes;
      for(var n=0;n<added.length;n++){
        var node=added[n];
        if(node.nodeType!==1)continue;
        var el=node;
        if(el.classList&&el.classList.contains("stream-convergence-bg")){
          try{boot(el);}catch(e2){}
          obs.disconnect();
          return;
        }
        var inner=el.querySelectorAll?el.querySelectorAll(".stream-convergence-bg"):null;
        if(inner&&inner.length){
          try{boot(inner[0]);}catch(e3){}
          obs.disconnect();
          return;
        }
      }
    }
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});
  // Si en 10s no apareció (navegación interrumpida), soltar el observer.
  setTimeout(function(){mo.disconnect();},10000);
}
})();`;
}
