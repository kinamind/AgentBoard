/* AgentBoard story animation — player chrome: scaling, controls, language, version switch */
(()=>{
"use strict";
const {$,clamp,seg,tr,W,H,TOTAL}=ST;
let t=0,playing=true,last=performance.now();
const q=new URLSearchParams(location.search);
if(q.has("t"))t=clamp(parseFloat(q.get("t"))||0,0,TOTAL);
if(q.get("paused")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)playing=false;
if(q.get("ui")==="0"){const s=document.createElement("style");s.textContent="#ui,#skip,#ver{display:none!important}";document.head.appendChild(s)}
try{localStorage.setItem("agentboard.intro","story")}catch(e){}

const mmss=s=>Math.floor(s/60)+":"+String(Math.floor(s%60)).padStart(2,"0");
function render(){
  ST.render(t);
  const pct=t/TOTAL*100;$("#fill").style.width=pct+"%";$("#knob").style.left=pct+"%";
  ST.setT($("#time"),mmss(t)+" / "+mmss(TOTAL));
  let ci=0;ST.CHAPTERS.forEach((c,i)=>{if(t>=c[0])ci=i});
  document.querySelectorAll("#chapters button").forEach((b,i)=>b.classList.toggle("on",i===ci));
}
function buildChapters(){
  const box=$("#chapters");box.innerHTML="";
  ST.CHAPTERS.forEach((c,i,a)=>{
    const b=document.createElement("button");b.textContent=String(i+1).padStart(2,"0")+"  "+tr(c[1]);
    b.style.width=(((i<a.length-1?a[i+1][0]:TOTAL)-c[0])/TOTAL*100)+"%";
    b.onclick=()=>seek(c[0]+.05);box.appendChild(b);
  });
}
function applyLang(){
  document.documentElement.lang=ST.lang==="zh"?"zh-CN":"en";
  document.querySelectorAll("[data-k]").forEach(e=>{e.textContent=tr(e.dataset.k)});
  $("#bLang").textContent=ST.lang==="zh"?"EN":"中文";
  document.querySelectorAll("#ver a").forEach(a=>{const u=new URL(a.getAttribute("href"),location.href);u.searchParams.set("lang",ST.lang);a.href=u.pathname+u.search});
  buildChapters();render();
}
function seek(s){t=clamp(s,0,TOTAL);render()}
function setPlaying(v){playing=v;$("#bPlay").textContent=v?"❚❚":"▶"}
function fit(){const k=Math.min(innerWidth/W,innerHeight/H);const st=$("#stage");st.style.setProperty("--k",k);st.style.setProperty("--shift",(playing||!document.body.classList.contains("idle")?72/k:0)+"px")}
addEventListener("resize",fit);

{const tk=$("#track");ST.CHAPTERS.slice(1).forEach(c=>{const i=document.createElement("i");i.className="tick";i.style.left=(c[0]/TOTAL*100)+"%";tk.appendChild(i)});
 let drag=false;const at=e=>{const r=tk.getBoundingClientRect();seek((e.clientX-r.left)/r.width*TOTAL)};
 tk.addEventListener("pointerdown",e=>{drag=true;tk.setPointerCapture(e.pointerId);at(e)});
 tk.addEventListener("pointermove",e=>{if(drag)at(e)});tk.addEventListener("pointerup",()=>{drag=false})}
$("#bPlay").onclick=()=>{if(t>=TOTAL)seek(0);setPlaying(!playing)};
$("#bReplay").onclick=()=>{seek(0);setPlaying(true)};
$("#bLang").onclick=()=>{ST.lang=ST.lang==="zh"?"en":"zh";applyLang()};
$("#bFull").onclick=()=>{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()};
addEventListener("keydown",e=>{
  if(e.code==="Space"){e.preventDefault();$("#bPlay").click()}
  else if(e.code==="ArrowRight")seek(t+5);else if(e.code==="ArrowLeft")seek(t-5);
  else if(/^Digit[1-7]$/.test(e.code))seek(ST.CHAPTERS[+e.code.slice(5)-1][0]+.05);
  else if(e.code==="KeyR"){seek(0);setPlaying(true)}else if(e.code==="KeyL")$("#bLang").click();else if(e.code==="KeyF")$("#bFull").click();
  else if(e.code==="KeyV")$("#ver a:not(.on)").click();
});
let idleT;const wake=()=>{document.body.classList.remove("idle");fit();clearTimeout(idleT);idleT=setTimeout(()=>{if(playing){document.body.classList.add("idle");fit()}},2800)};
["mousemove","pointerdown","keydown","touchstart"].forEach(ev=>addEventListener(ev,wake));

function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(playing){t+=dt;if(t>=TOTAL){t=TOTAL;setPlaying(false)}}
  render();requestAnimationFrame(frame);
}
fit();applyLang();setPlaying(playing);wake();
requestAnimationFrame(n=>{last=n;frame(n)});
window.__ab={seek:s=>{seek(s);setPlaying(false)},get t(){return t}};
})();
