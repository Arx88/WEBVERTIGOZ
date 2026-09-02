// GENERADO desde src/components/shared/stream-convergence-bootstrap.ts (buildStreamConvergenceBootstrapJS).
// No editar a mano: regenerar con:
//   node --experimental-strip-types -e "import(String.raw`./src/components/shared/stream-convergence-bootstrap.ts`).then(m=>require(String.raw`fs`).writeFileSync(String.raw`public/loader-boot.js`, m.buildStreamConvergenceBootstrapJS()))"
// Se inyecta con <script src> en PageLoader para dibujar el fondo WebGL del loading ANTES de la hidratacion de React.
(function(){
"use strict";
var VERT="\n  attribute vec2 position;\n  varying vec2 vUv;\n  void main() {\n    vUv = position * 0.5 + 0.5;\n    gl_Position = vec4(position, 0.0, 1.0);\n  }\n";
var FRAG="precision highp float;\n"+"\n  uniform float u_time;\n  uniform vec2 u_resolution;\n  uniform float u_interactive_fidelity;\n  varying vec2 vUv;\n\n  mat2 rotate2d(float _angle){\n    return mat2(cos(_angle),-sin(_angle),\n                sin(_angle),cos(_angle));\n  }\n\n  void main() {\n    vec2 p = vUv * 2.0 - 1.0;\n    p.x *= u_resolution.x / u_resolution.y;\n    p = rotate2d(0.55) * p;\n\n    vec3 color = vec3(0.0);\n    float spread = 0.06 * (0.3 + u_interactive_fidelity * 0.7);\n\n    for(int i = 0; i < 3; i++) {\n      float offset = float(1 - i) * spread;\n      float y = p.y + offset + (sin(p.x * 2.5 - u_time * 1.5) * 0.12);\n      float wave = smoothstep(0.85, 0.99, sin(y * 6.0 + u_time * 2.0) * 0.5 + 0.5);\n\n      // Mezcla de color del tema violeta-índigo\n      if(i == 0) color.r += wave * 1.2;\n      if(i == 1) color.g += wave * 0.5;\n      if(i == 2) color.b += wave * 1.8;\n    }\n\n    float vignette = exp(-length(vUv * 2.0 - 1.0) * 0.8);\n    color *= vignette;\n\n    gl_FragColor = vec4(color, 1.0);\n  }\n";
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
    if(uTime)gl.uniform1f(uTime,now*0.0003*0.7);
    if(uFid)gl.uniform1f(uFid,0.5);
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
})();