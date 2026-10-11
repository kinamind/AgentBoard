/* AgentBoard story animation — timeline & choreography */
(()=>{
"use strict";
const {S,A,clamp,lerp,seg,E,mixc,sp,kf,setA,setX,setO,setT,show,tr,W,H,TOTAL,rng}=ST;
const w=ST.w,$=ST.$;
const DCOL=["#6366f1","#ec4899","#22d3ee","#f59e0b","#10b981","#a78bfa"];
const NEUT="#8793bd";
const GLY=["</>","QA","Aa","Ad","?!","%","PM","→","@",">_","$","§"];

/* ───────── sky / time of day ───────── */
const NIGHT={top:"#050716",bot:"#141a3c",star:1,moon:1,sun:0,sunY:380,light:.28,rain:0,lamp:1};
const DAY={top:"#6fb6f4",bot:"#d8ecff",star:0,moon:0,sun:1,sunY:140,light:1,rain:0,lamp:0};
const OUT={top:"#090b18",bot:"#171a2c",star:0,moon:0,sun:0,sunY:400,light:.1,rain:1,lamp:0};
const SKY=[
  [0,NIGHT],[9.5,NIGHT],[11.5,DAY],[24,DAY],
  [31,{top:"#5b4a96",bot:"#ffa66a",star:0,moon:0,sun:1,sunY:300,light:.72,rain:0,lamp:.7}],
  [35.5,{top:"#101433",bot:"#2b2f5c",star:.6,moon:.8,sun:0,sunY:400,light:.34,rain:0,lamp:1}],
  [38.2,{top:"#090b18",bot:"#171a2c",star:0,moon:0,sun:0,sunY:400,light:.22,rain:1,lamp:1}],
  [39.3,OUT],[45.5,OUT],
  [47.8,{top:"#1b2350",bot:"#f0a273",star:.3,moon:0,sun:1,sunY:370,light:.38,rain:0,lamp:0}],
  [52.5,{top:"#4d8fe0",bot:"#cfe6ff",star:0,moon:0,sun:1,sunY:200,light:.85,rain:0,lamp:0}],
  [58,DAY],[67,DAY],
  [71,{top:"#ff9a56",bot:"#ffe2a6",star:0,moon:0,sun:1,sunY:250,light:1,rain:0,lamp:0}],
  [76,{top:"#ff9a56",bot:"#ffe2a6",star:0,moon:0,sun:1,sunY:250,light:1,rain:0,lamp:0}]
];
function skyAt(t){
  let i=0;while(i<SKY.length-2&&t>=SKY[i+1][0])i++;
  const[t0,a]=SKY[i],[t1,b]=SKY[i+1],u=t<=t0?0:t>=t1?1:E.io(seg(t,t0,t1));
  const o={top:mixc(a.top,b.top,u),bot:mixc(a.bot,b.bot,u)};
  for(const k of["star","moon","sun","sunY","light","rain","lamp"])o[k]=lerp(a[k],b[k],u);
  return o;
}

/* ───────── layout tables ───────── */
const F=[200,440,680,920,1160,1400],B=[260,500,740,980,1220,1460];
const HOME=[];for(let k=0;k<6;k++){HOME.push([F[k],952]);HOME.push([B[k],870])}
const QPOS=[[610,930],[1000,930],[520,880],[1100,880],[430,960],[1200,960],[350,900],[1300,900],[270,950],[1400,950],[190,890],[1500,890]];
const PADX=j=>560+230*j,PADY=905;
const padPos=i=>[PADX(i>>1)+(i%2?50:-50),PADY+10];
const dscale=y=>clamp(.78+(y-860)/130*.31,.7,1.15);
const spawnT=i=>10.9+i*.55,askT=i=>22.6+i*.82,deadT=i=>38.5+i*.06,reviveT=i=>47+i*.1,walkT=i=>51.4+(i>>1)*.2;
const HOLO=[1060,430];

/* ───────── actors ───────── */
const robots=[];for(let i=0;i<12;i++)robots.push(ST.mkRobot(w.gRob,GLY[i]));
const founderSeat=ST.mkFounder(w.gSeat),founderStand=ST.mkFounder(w.gFront);
const bubbles=[],tags=[];
for(let i=0;i<12;i++){
  const g=S("g",{},w.gBub),inner=S("g",{},g);
  S("path",{d:"M-34 -54 H34 a16 16 0 0 1 16 16 V-18 a16 16 0 0 1 -16 16 H10 L0 10 L-10 -2 H-34 a16 16 0 0 1 -16 -16 V-38 a16 16 0 0 1 16 -16Z",fill:"#fff",stroke:"#e11d48","stroke-width":3.5},inner);
  const tx=S("text",{x:0,y:-18,"text-anchor":"middle","font-size":36,"font-weight":900,fill:"#e11d48"},inner);
  bubbles.push({g,inner,tx});
  const tg=S("g",{},w.gBub);S("rect",{x:-62,y:0,width:124,height:30,rx:15,fill:"rgba(10,12,28,.78)"},tg);
  const tt=S("text",{x:0,y:21,"text-anchor":"middle","font-size":18,"font-weight":600,fill:"#fff"},tg);tags.push({g:tg,tt});
}

/* ───────── pads, beams, hologram, star, card, fixer ───────── */
const pads=[];
for(let j=0;j<6;j++){
  const g=S("g",{},w.gZone),inner=S("g",{},g);
  S("ellipse",{cx:0,cy:0,rx:118,ry:32,fill:DCOL[j],opacity:.2,stroke:DCOL[j],"stroke-width":3},inner);
  S("ellipse",{cx:0,cy:0,rx:84,ry:21,fill:"none",stroke:DCOL[j],"stroke-width":2,"stroke-dasharray":"6 8",opacity:.6},inner);
  S("line",{x1:0,y1:-6,x2:0,y2:-196,stroke:"#586078","stroke-width":4},inner);
  S("rect",{x:-84,y:-232,width:168,height:40,rx:12,fill:"#12152a",stroke:DCOL[j],"stroke-width":3},inner);
  const t=S("text",{x:0,y:-205,"text-anchor":"middle","font-size":22,"font-weight":700,fill:"#fff"},inner);
  pads.push({g,inner,t,glow:inner.firstChild});
}
const beams=[],pkts=[];
for(let j=0;j<6;j++){
  const px=PADX(j),d=`M${HOLO[0]} 470 C${HOLO[0]} 650 ${px} 700 ${px} ${PADY-90}`;
  const p=S("path",{d,fill:"none",stroke:DCOL[j],"stroke-width":3,"stroke-linecap":"round",opacity:0},w.gFx);
  const len=p.getTotalLength();A(p,{"stroke-dasharray":len,"stroke-dashoffset":len});
  beams.push({p,len});
  pkts.push(S("rect",{x:-16,y:-10,width:32,height:20,rx:6,fill:DCOL[j],opacity:0},w.gFx));
}
const fan=S("polygon",{fill:"#67e8f9",opacity:0},w.gFx);
const holo=S("g",{},w.gFx);
S("ellipse",{cx:0,cy:172,rx:96,ry:16,fill:"url(#gHolo)"},holo);
S("polygon",{points:"-44,172 44,172 120,40 -120,40",fill:"rgba(129,140,248,.14)"},holo);
const hRings=[0,1,2].map(i=>S("ellipse",{cx:0,cy:30+i*34,rx:130-i*12,ry:30-i*3,fill:"none",stroke:"#a5b4fc","stroke-width":2.5,"stroke-dasharray":"10 14",opacity:.8-i*.2},holo));
const core=S("g",{},holo);
S("rect",{x:-48,y:-48,width:96,height:96,rx:26,fill:"url(#gBrand)",stroke:"rgba(255,255,255,.5)","stroke-width":2},core);
S("path",{d:"M-20 22 L0 -24 L20 22 M-11 6 H11",fill:"none",stroke:"#fff","stroke-width":8,"stroke-linecap":"round","stroke-linejoin":"round"},core);
const orbit=DCOL.map(c=>S("circle",{r:8,fill:c},holo));
const star=S("g",{},w.gFx);
S("circle",{r:60,fill:"url(#gSun)"},star);
S("path",{d:"M0 -34 L10 -11 L35 -9 L16 7 L22 31 L0 18 L-22 31 L-16 7 L-35 -9 L-10 -11Z",fill:"#ffd23f",stroke:"#ff9f1c","stroke-width":3,"stroke-linejoin":"round"},star);
const goalPill=S("g",{},w.gFx);
S("rect",{x:-150,y:-24,width:300,height:48,rx:24,fill:"rgba(12,15,30,.82)",stroke:"#ffd23f","stroke-width":2},goalPill);
const goalTx=S("text",{x:0,y:8,"text-anchor":"middle","font-size":24,"font-weight":700,fill:"#fff"},goalPill);
const card=S("g",{},w.gFx);const cardIn=S("g",{},card);
S("rect",{x:-100,y:-62,width:200,height:124,rx:18,fill:"#fffaf0",stroke:"#f5b301","stroke-width":4},cardIn);
S("circle",{cx:-72,cy:-36,r:9,fill:"#f5b301"},cardIn);
const cardTx=S("text",{x:-54,y:-30,"font-size":17,"font-weight":800,fill:"#3a3f66"},cardIn);
const yes=S("g",{transform:"translate(-44 22)"},cardIn);S("circle",{r:22,fill:"#10b981"},yes);S("path",{d:"M-9 0 L-3 7 L10 -8",fill:"none",stroke:"#fff","stroke-width":5,"stroke-linecap":"round","stroke-linejoin":"round"},yes);
const no=S("g",{transform:"translate(44 22)"},cardIn);S("circle",{r:22,fill:"#cbd1e6"},no);S("path",{d:"M-8 -8 L8 8 M8 -8 L-8 8",stroke:"#fff","stroke-width":5,"stroke-linecap":"round"},no);
const tap=S("circle",{cx:-44,cy:22,r:10,fill:"none",stroke:"#10b981","stroke-width":4,opacity:0},cardIn);
const drone=S("g",{},w.gFx);
S("circle",{r:20,fill:"#e8ecff",stroke:"#6366f1","stroke-width":4},drone);S("circle",{r:6,fill:"#10b981"},drone);
const prop=S("line",{x1:-26,y1:-26,x2:26,y2:-26,stroke:"#6366f1","stroke-width":5,"stroke-linecap":"round"},drone);
const fixBeam=S("line",{stroke:"#34d399","stroke-width":5,"stroke-linecap":"round",opacity:0},w.gFx);
const sparks=[0,1,2,3,4,5].map(i=>S("circle",{r:4,fill:i%2?"#fbbf24":"#f43f5e",opacity:0},w.gFx));
const okMark=S("g",{opacity:0},w.gFx);S("circle",{r:20,fill:"#10b981",stroke:"#fff","stroke-width":3},okMark);S("path",{d:"M-8 0 L-2 7 L9 -7",fill:"none",stroke:"#fff","stroke-width":4.5,"stroke-linecap":"round","stroke-linejoin":"round"},okMark);
/* idea bulb (act I) */
const idea=S("g",{},w.gFx);
S("circle",{cx:0,cy:0,r:64,fill:"url(#gSun)"},idea);
S("circle",{cx:0,cy:0,r:34,fill:"#ffe27a",stroke:"#f5b301","stroke-width":4},idea);
S("rect",{x:-14,y:30,width:28,height:18,rx:5,fill:"#9aa3cf"},idea);
const ideaRays=S("g",{},idea);for(let i=0;i<8;i++){const a=i/8*Math.PI*2;S("line",{x1:Math.cos(a)*50,y1:Math.sin(a)*50,x2:Math.cos(a)*66,y2:Math.sin(a)*66,stroke:"#ffd23f","stroke-width":5,"stroke-linecap":"round"},ideaRays)}
/* sparkles for the enter-press and tidy-up */
const spk=[0,1,2,3,4,5,6,7].map(i=>S("circle",{r:5,fill:i%2?"#fff":"#a5b4fc",opacity:0},w.gFx));

/* ───────── overlays (outside the world) ───────── */
const capEl=$("#cap"),capT=$("#capT"),chapEl=$("#chap"),flashEl=$("#flash"),fadeEl=$("#fade"),endEl=$("#end"),ctaEl=$("#cta");
const CUES=[[.8,3.6,"s0"],[4.6,9.4,"s1"],[10.8,15.6,"s2"],[16.2,21.6,"s3"],[22.6,27.4,"s4"],[28,33.2,"s5"],[33.8,37.6,"s6"],[39.2,44.4,"s7"],[46.4,50.4,"s8"],[50.8,55.6,"s9"],[56.2,60.2,"s10"],[60.6,63.4,"s11"],[63.8,66.4,"s12"],[67,71,"s13"],[71.4,73.4,"s14"]];
const CHAPTERS=ST.CHAPTERS=[[0,"c1"],[10,"c2"],[22,"c3"],[38,"c4"],[46,"c5"],[56,"c6"],[66,"c7"]];
const ROMAN=["I","II","III","IV","V","VI","VII"];
let prevCue=-1;

/* ───────── camera ───────── */
const CX=[[0,1181],[3.6,900],[4.6,800],[7,800],[8.2,640],[9.6,640],[11.2,960],[22,960],[28,900],[33,820],[36,800],[37.6,800],[38.4,711],[41,711],[43.4,960],[46,960],[48,800],[49.6,900],[52,960],[58,960],[60.4,1060],[62.6,900],[64.2,600],[66,700],[67.4,960],[70.4,1181],[73,960],[76,960]];
const CY=[[0,415],[3.6,470],[4.6,430],[7,430],[8.2,540],[11.2,570],[22,570],[28,540],[33,500],[36,490],[37.6,490],[38.4,540],[41,540],[43.4,570],[46,570],[48,540],[52,570],[58,570],[60.4,480],[62.6,600],[64.2,640],[66,640],[67.4,570],[70.4,420],[73,570],[76,570]];
const CS=[[0,1.3],[3.6,1.55],[4.6,1.9],[7,1.9],[8.2,1.4],[9.6,1.4],[11.2,1],[22,1],[28,1.2],[33,1.4],[36,1.9],[37.6,2],[38.4,1.4],[41,1.4],[43.4,1],[46,1],[48,1.8],[49.6,1.3],[52,1.05],[58,1.05],[60.4,1.5],[62.6,1.2],[64.2,1.45],[66,1.45],[67.4,1],[70.4,1.3],[73,1],[76,1]];

/* ───────── founder poses ───────── */
function seatPose(t){
  const p={x:790,y:520,sc:1,legs:false,t,hl:[-44,80],hr:[44,80],mug:0};
  const ty=Math.sin(t*16)*5;
  p.mood=sp([[0,.15],[3.3,.1],[3.8,.95],[10,.9],[21,.85],[23,.3],[27,-.2],[32,-.85],[36,-1],[38.4,-1],[40,-.9],[48,-.6],[49.2,-.2],[66.3,.9],[76,1]],t);
  p.bags=sp([[0,0],[22,0],[34,.9],[49.3,.9],[66.3,0],[67,0]],t);
  p.messy=sp([[0,0],[24,0],[35,1],[49.3,1],[66.3,0],[67,0]],t);
  p.slump=sp([[0,0],[38.4,0],[39.4,1],[47.4,1],[48.8,0],[76,0]],t);
  p.sweat=sp([[0,0],[26,0],[34,1],[38.4,1],[39.2,0],[76,0]],t);
  p.shake=E.io(seg(t,24,36))*(t<38.4?.9:0);
  p.ey=(t>3.7&&t<4.5?1.25:1)*(1-p.slump*.9);
  p.look=t<3.6?[0,.6]:t<6?[0,-.6]:t>22.6&&t<38.4?[Math.sin(t*3)*.9,Math.sin(t*4)*.5]:[0,.4];
  if(t<4.4){p.hl=[-44,80+ty];p.hr=[44,80-ty]}
  else if(t<6.6){const u=E.pop(seg(t,4.4,5))*(1-E.io(seg(t,5.8,6.6)));p.hl=[lerp(-44,-100,u),lerp(80,-80,u)];p.hr=[lerp(44,100,u),lerp(80,-80,u)]}
  else if(t<8.3){p.hl=[-44,80+ty];p.hr=[44,80-ty]}
  else if(t<10.7){const u=E.io(seg(t,8.3,9.1));p.hl=[lerp(-44,-50,u),lerp(80,-118,u)];p.hr=[lerp(44,50,u),lerp(80,-118,u)]}
  else if(t<22.5){const u=E.io(seg(t,10.7,11.5)),a=Math.sin(t*3)*14;p.hl=[lerp(-50,-155,u),lerp(-118,-35+a,u)];p.hr=[lerp(50,155,u),lerp(-118,-35-a,u)]}
  else if(t<38.4){
    const a=E.io(seg(t,22.5,32)),b=E.io(seg(t,34,35.4));
    const fl=[-125+Math.sin(t*6)*65*a,-45+Math.sin(t*8+1)*75*a],fr=[125+Math.sin(t*7+2)*65*a,-45+Math.sin(t*9)*75*a];
    p.hl=[lerp(fl[0],-52,b),lerp(fl[1],-112,b)];p.hr=[lerp(fr[0],52,b),lerp(fr[1],-112,b)];
  }
  else if(t<48.8){p.hl=[-96,84];p.hr=[96,84]}
  else if(t<66.3){p.hl=[-44,80];p.hr=[44,80]}
  else{p.hl=[-50,-118];p.hr=[50,-118]}
  return p;
}
function standPose(t){
  const p={x:380,y:696,sc:.8,legs:true,t,hl:[-40,150],hr:[40,150],mug:0,bags:0,messy:0,slump:0,sweat:0,shake:0,ey:1,look:[1,-.3],tilt:0};
  p.mood=t<51?.35:.9;
  const r=E.out(seg(t,51,51.6))*(1-E.io(seg(t,52,52.6)));
  if(t>=51&&t<52.6){p.hr=[lerp(40,70,r),lerp(150,-150,r)]}
  if(t>=56.4&&t<63.8){
    p.mug=1;p.hr=[44,62];p.hl=[-30,72];
    const s1=Math.sin(seg(t,58.2,59.4)*Math.PI),s2=Math.sin(seg(t,60.4,61.4)*Math.PI);
    const s=Math.max(t>58.2&&t<59.4?s1:0,t>60.4&&t<61.4?s2:0);
    p.hr=[lerp(44,14,s),lerp(62,-44,s)];
  }
  if(t>=63.6&&t<66.4){
    const u=E.io(seg(t,63.6,64.8)),tp=t>65.2&&t<65.6?Math.sin(seg(t,65.2,65.6)*Math.PI)*16:0;
    p.hr=[lerp(44,125,u),lerp(62,-24,u)+tp];p.mug=1-u;p.hl=[-30,72];
  }
  return p;
}

/* ───────── robot behaviour ───────── */
function robot(i,t){
  const H0=HOME[i],Q=QPOS[i],Z=padPos(i),d=i>>1,ts=spawnT(i);
  const s={x:790,y:540,sc:.3,col:NEUT,op:0,t,id:i,eye:0,look:0,bulb:"#34d399",bulbOp:1};
  if(t<ts)return s;
  s.op=1;
  const ta=askT(i),td=deadT(i),tr_=reviveT(i),tw=walkT(i),fl=(t-ts)/.95;
  let px=H0[0],py=H0[1],walking=0,dir=0;
  if(t<ta){px=H0[0];py=H0[1]}
  else if(t<ta+1.8){const p=E.io((t-ta)/1.8);px=lerp(H0[0],Q[0],p);py=lerp(H0[1],Q[1],p);walking=1;dir=Q[0]-H0[0]}
  else if(t<tw){px=Q[0];py=Q[1]}
  else if(t<tw+2){const p=E.io((t-tw)/2);px=lerp(Q[0],Z[0],p);py=lerp(Q[1],Z[1],p);walking=1;dir=Z[0]-Q[0]}
  else{px=Z[0];py=Z[1]}
  s.x=px;s.y=py;s.sc=dscale(py);
  if(fl<1){const p=E.io(clamp(fl));s.x=lerp(790,H0[0],p);s.y=lerp(540,H0[1],p)-Math.sin(p*Math.PI)*300;s.sc=dscale(H0[1])*lerp(.3,1,E.out(p));s.tilt=(1-p)*540;s.aL=s.aR=150;s.eye=2;return s}
  s.sq=.3*Math.max(0,1-(t-ts-.95)/.32);
  const idle=Math.sin(t*3+i)*2;
  if(t<ta){
    s.bob=idle;s.look=0;
    if(((t+i*1.7)%6)<1.1&&t<22){s.aR=100+30*Math.sin(t*10);s.eye=2}
    return s;
  }
  if(t<td){
    const st=E.io(seg(t,ta,35));
    s.bob=walking?Math.abs(Math.sin(t*12))*7:Math.abs(Math.sin(t*9+i))*3*st;
    if(walking){s.aL=25*Math.sin(t*12);s.aR=-25*Math.sin(t*12)}else{s.aL=40+35*Math.sin(t*8+i)*st;s.aR=40+35*Math.sin(t*8+i+1.5)*st}
    s.x+=Math.sin(t*9+i)*2*st;
    s.eye=t>ta+1.8?3:0;s.bulb="#f43f5e";s.look=px<790?1:-1;
    return s;
  }
  if(t<tr_){
    const p=E.out(seg(t,td,td+.7));s.slump=p;s.eye=1;s.bulbOp=0;s.tilt=p*(i%2?9:-9);s.y+=p*6;
    return s;
  }
  /* revived */
  const rv=seg(t,tr_,tr_+.9);s.slump=1-E.out(rv);s.bulb="#fbbf24";s.bulbOp=rv>0?(Math.sin(t*30)>-.3?1:.2):0;s.eye=rv>.4?0:1;
  s.bob=walking?Math.abs(Math.sin(t*12))*7:idle;
  if(walking){s.aL=25*Math.sin(t*12);s.aR=-25*Math.sin(t*12);s.look=dir>0?1:-1}
  if(t>=tw+2){
    s.col=mixc(NEUT,DCOL[d],seg(t,tw+2,tw+2.6));s.bulb=DCOL[d];s.bulbOp=1;s.look=0;
    if(t>=56.6){
      s.aL=40+35*Math.sin(t*7+i);s.aR=40+35*Math.sin(t*7+i+1.6);s.bob=Math.abs(Math.sin(t*7+i))*3;
      s.ring=((t-56.6-d*.3)%2.1)/2.1;s.ringCol=DCOL[d];
      if(t>66.3&&((t*.5+i)%5)<.7)s.eye=2;
    }
    if(i===0&&t>=60.9&&t<62.6){s.eye=3;s.bulb="#f43f5e";s.aL=s.aR=120+30*Math.sin(t*20);s.ring=null}
    if(i===0&&t>=62.6&&t<63.6){s.eye=2}
    if(t>=65.6&&t<66.4){const q=t-65.6;s.eye=2;s.aL=s.aR=150;s.y-=Math.abs(Math.sin(q*9))*40;s.ring=null}
  }
  return s;
}

/* ───────── renderers ───────── */
const stick=w.stick,rainL=w.rain;
let lastOrder="";
function renderWorld(t){
  /* camera */
  const stress=E.io(seg(t,24,36))*(t<38.4?1:0);
  let s=sp(CS,t),cx=sp(CX,t),cy=sp(CY,t);
  cx=clamp(cx,960/s,1920-960/s);cy=clamp(cy,440/s,1080-440/s);
  cx+=Math.sin(t*37)*3*stress;cy+=Math.cos(t*29)*2*stress;
  setX(ST.cam,`translate(960 510) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);
  /* sky + light */
  const k=skyAt(t);
  setA(w.skyA,"stop-color",k.top);setA(w.skyB,"stop-color",k.bot);
  w.stars.forEach(o=>setO(o.e,k.star*(.5+.5*Math.sin(t*2+o.p))));
  setX(w.sunG,`translate(${w.WIN.x+130} ${(w.WIN.y+k.sunY).toFixed(1)})`);setO(w.sunG,k.sun);setO(w.moon,k.moon);
  w.clouds.forEach(c=>{const x=((c.x-w.WIN.x+t*(5+3*c.k))%(w.WIN.w+200))+w.WIN.x-100;setX(c.e,`translate(${x.toFixed(1)} ${c.y})`);setO(c.e,k.sun*.85*(k.light>.5?1:.55))});
  const fc=mixc(k.bot,"#3b4570",.45),nc=mixc(k.bot,"#12162c",.72);
  w.far.forEach(e=>setA(e,"fill",fc));w.near.forEach(e=>setA(e,"fill",nc));
  const night=1-clamp(k.light*1.3);
  w.lights.forEach(o=>setO(o.e,night*(Math.sin(t*.3+o.p*3)>-.3?1:.2)));
  w.rain.forEach(r=>{const y=w.WIN.y+((t*r.sp*900+r.o)%(w.WIN.h+80))-40,x=r.x-(y-w.WIN.y)*.18;A(r.e,{x1:x.toFixed(1),y1:y.toFixed(1),x2:(x-6).toFixed(1),y2:(y+22).toFixed(1),opacity:(k.rain*.55).toFixed(2)})});
  setO(w.shaft,k.sun*k.light*.16);
  let lamp=k.lamp;if(t>38.2&&t<39.3)lamp=Math.sin(t*60)>0?1:.2;
  setO(w.shade,(1-k.light)*.78);setO(w.lampGlow,lamp*(1-k.light)*.9);setA(w.bulb,"fill",lamp>.5?"#ffe9a8":"#7a7f9f");
  const lap=t<39.3?(1-k.light)*.6:0;
  setO(w.lapLight,Math.max(lap,.5*E.pop(seg(t,46.4,47.4))*(t<52?1:0)));
  /* door sign */
  const drop=E.out(seg(t,7.8,8.7)),swing=(t>8.6?14*Math.exp(-(t-8.6)*1.6)*Math.sin((t-8.6)*6):0)+(t>39.9?10*Math.exp(-(t-39.9)*1.4)*Math.sin((t-39.9)*6):0);
  const flip=Math.cos(clamp(seg(t,39.1,39.9))*Math.PI),closed=t>=39.5&&t<47.2;
  setX(w.sign,`translate(220 ${(318+(1-drop)*-300).toFixed(1)}) rotate(${swing.toFixed(2)})`);setO(w.sign,seg(t,7.8,8));
  setX(w.signBoard,`scale(${Math.abs(flip).toFixed(3)} 1)`);setT(w.signTxt,closed?tr("closed"):tr("plate"));setA(w.signTxt,"fill",closed?"#e11d48":"#3a3f66");
  /* wall props */
  const ang=3*clamp(t,0,10.8)+1080*E.io(seg(t,10.8,37))+720*E.io(seg(t,66,75));
  setX(w.hHand,`rotate(${ang.toFixed(1)})`);setX(w.mHand,`rotate(${(ang*12).toFixed(1)})`);
  const day=t<10.8?1:t<37?Math.floor(lerp(1,90,E.io(seg(t,10.8,37)))):t<66?90:Math.floor(lerp(90,180,E.io(seg(t,66,75))));
  setT(w.calTxt,tr("day").replace("{n}",day));setA(w.calTxt,"font-size",ST.lang==="zh"?30:26);
  setT(w.chartTitle,tr("chartT"));
  const pd=seg(t,11.5,38);A(w.chDown,{"stroke-dashoffset":w.chDownLen*(1-pd)});setO(w.chDown,seg(t,11.4,11.6)*(1-seg(t,46.4,47.4)));
  const pu=E.io(seg(t,67,75));A(w.chUp,{"stroke-dashoffset":w.chUpLen*(1-pu)});setO(w.chUp,seg(t,66.8,67.4));
  setT(w.chMul,"×3.1");setO(w.chMul,seg(t,73.2,74.2));
  stick.forEach(o=>{const p=E.pop(seg(t,o.t,o.t+.3));setX(o.g,`translate(${o.x.toFixed(0)} ${o.y.toFixed(0)}) rotate(${o.r.toFixed(0)}) scale(${Math.max(p,.001).toFixed(3)})`);setO(o.g,seg(t,o.t,o.t+.1)*(1-seg(t,48.2,49.3)))});
  /* desk items */
  const np=Math.floor(lerp(0,10,seg(t,22.5,36)));w.papers.forEach((e,i)=>setO(e,(i<np?1:0)*(1-seg(t,48,49))));
  const ring=t>24&&t<38.4;setX(w.phone,`translate(${(655+(ring?Math.sin(t*50)*2:0)).toFixed(1)} 598)`);
  w.waves.forEach((e,i)=>setO(e,ring?Math.max(0,Math.sin(t*10-i*1.2)):0));
  w.coins.forEach((c,i)=>{const p=E.pop(seg(t,67+i*.6,67.5+i*.6));setX(c,`translate(655 ${598-i*9}) scale(${Math.max(p,.001).toFixed(3)})`);setO(c,seg(t,67+i*.6,67.1+i*.6))});
  w.steam.forEach((e,i)=>{setO(e,(t<22||t>66)?.55+.3*Math.sin(t*3+i):0);setX(e,`translate(0 ${(-Math.abs(Math.sin(t*1.5+i))*6).toFixed(1)})`)});
  const enter=seg(t,7.2,7.5)*(1-seg(t,7.5,8.2));setO(w.lapGlow,Math.max(enter*.9,E.pop(seg(t,46.4,47))*(t<52?.7:0)));
  setO(w.puck,seg(t,46.4,47));
  /* plant */
  const hth=t<22?1:t<38?lerp(1,.25,E.io(seg(t,22,38))):t<66?.25:lerp(.25,1.15,E.io(seg(t,66,75)));
  w.leaves.forEach(l=>{const ag=l.k*26+(1-clamp(hth,0,1))*(l.k>=0?1:-1)*(42+Math.abs(l.k)*20);setX(l.g,`translate(0 -66) rotate(${ag.toFixed(1)}) scale(${lerp(.5,1.05,clamp(hth,0,1.15)).toFixed(3)})`)});
  /* idea bulb + sparkles */
  const ib=E.pop(seg(t,3.6,4.2))*(1-E.in(seg(t,6.4,7.2)));setX(idea,`translate(790 ${(345-Math.sin(t*3)*5).toFixed(1)}) scale(${Math.max(ib,.001).toFixed(3)})`);setO(idea,ib>0?1:0);setX(ideaRays,`rotate(${(t*30).toFixed(1)})`);
  spk.forEach((e,i)=>{
    let u=0,cxp=790,cyp=540;
    if(t>7.3&&t<8.3){u=seg(t,7.3,8.3);cxp=790;cyp=540}
    else if(t>48.4&&t<49.3){u=seg(t,48.4,49.3);cxp=930;cyp=620}
    const a=i/8*Math.PI*2+(t*2);A(e,{cx:(cxp+Math.cos(a)*lerp(10,110,E.out(u))).toFixed(1),cy:(cyp+Math.sin(a)*lerp(10,90,E.out(u))-u*30).toFixed(1)});setO(e,u>0&&u<1?1-u:0);
  });
  /* founders */
  const seated=t<49.3||t>=66.3;
  show(founderSeat.root,seated);show(founderStand.root,!seated);
  if(seated)founderSeat.set(seatPose(t));else founderStand.set(standPose(t));
  /* robots */
  const st=robots.map((r,i)=>robot(i,t));
  st.forEach((o,i)=>robots[i].set(o));
  const order=st.map((o,i)=>[o.y,i]).sort((a,b)=>a[0]-b[0]).map(a=>a[1]).join(",");
  if(order!==lastOrder){lastOrder=order;order.split(",").forEach(i=>w.gRob.appendChild(robots[i].root))}
  st.forEach((o,i)=>{
    const ta=askT(i),td=deadT(i),b=bubbles[i],on=t>=ta&&t<td;
    const p=E.pop(seg(t,ta,ta+.4))*(1-E.in(seg(t,td-.2,td)));
    const bump=1+.12*Math.max(0,Math.sin(t*3.7+i*1.7));
    setX(b.g,`translate(${o.x.toFixed(1)} ${(o.y-210*o.sc).toFixed(1)}) scale(${(on?Math.max(p,.001)*bump:.001).toFixed(3)})`);setO(b.g,on?1:0);
    setT(b.tx,["!","?","$","!!"][Math.floor(t*.7+i*1.3)%4]);
    const tg=tags[i],tv=t>12.4&&t<21.8?E.out(seg(t,12.4+i*.15,13+i*.15))*(1-seg(t,20.8,21.8)):0;
    setX(tg.g,`translate(${o.x.toFixed(1)} ${(o.y+16).toFixed(1)})`);setO(tg.g,tv*o.op);setT(tg.tt,tr("ro"+i));
  });
  /* pads */
  pads.forEach((p,j)=>{
    const a=E.pop(seg(t,52.2+j*.22,52.9+j*.22));setX(p.g,`translate(${PADX(j)} ${PADY})`);setX(p.inner,`scale(${Math.max(a,.001).toFixed(3)})`);setO(p.g,seg(t,52.2+j*.22,52.5+j*.22));setT(p.t,tr("dn"+j));
  });
  /* hologram */
  const hp=E.pop(seg(t,46.8,48.6));
  setX(holo,`translate(${HOLO[0]} ${HOLO[1]}) scale(${Math.max(hp,.001).toFixed(3)})`);setO(holo,hp>0?1:0);
  hRings.forEach((r,i)=>A(r,{"stroke-dashoffset":(t*(30+i*14)*(i%2?-1:1)).toFixed(1)}));
  setX(core,`translate(0 ${(-Math.sin(t*2)*8).toFixed(1)}) rotate(${(Math.sin(t*1.2)*6).toFixed(1)})`);
  orbit.forEach((o,i)=>{const a=t*.9+i*Math.PI/3;A(o,{cx:(Math.cos(a)*132).toFixed(1),cy:(30+Math.sin(a)*34).toFixed(1)});setO(o,Math.sin(a)>0?1:.55)});
  /* goal star + pill */
  const flyT=seg(t,51.2,52.4),hand=[380+70*.8,696-150*.8];
  let sx,sy,so=0;
  if(t>=51.2&&t<52.4){const p=E.io(flyT);sx=lerp(hand[0],HOLO[0],p);sy=lerp(hand[1],255,p)-Math.sin(p*Math.PI)*170;so=1}
  else if(t>=52.4){sx=HOLO[0];sy=255-Math.sin(t*2)*8;so=1}
  if(so){setX(star,`translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${(t<52.4?lerp(.5,1,flyT):1).toFixed(3)}) rotate(${(t*40).toFixed(1)})`)}
  setO(star,so);
  setX(goalPill,`translate(${HOLO[0]} 190)`);setO(goalPill,seg(t,53,53.8));setT(goalTx,tr("goal"));
  /* beams + task packets */
  beams.forEach((b,j)=>{const p=E.io(seg(t,53.4+j*.1,54.6+j*.1));A(b.p,{"stroke-dashoffset":b.len*(1-p)});setO(b.p,p>0?.5:0)});
  pkts.forEach((e,j)=>{
    if(t<56){setO(e,0);return}
    const ph=((t-56-j*.3)%2.1)/1.3;
    if(ph>=1){setO(e,0);return}
    const b=beams[j],pt=b.p.getPointAtLength(b.len*E.io(ph));setX(e,`translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);setO(e,Math.min(1,ph*6)*(1-seg(ph,.85,1)));
  });
  /* radar sweep */
  const rf=seg(t,59.4,60.2)*(1-seg(t,64,64.8));
  if(rf>0){const th=lerp(.55,2.6,Math.abs(((t*.35)%2)-1)),pts=[[HOLO[0],520]];for(let i=-3;i<=3;i++){const a=th+i*.05;pts.push([HOLO[0]+Math.cos(a)*900,520+Math.sin(a)*900])}A(fan,{points:pts.map(p=>p.join(",")).join(" ")})}
  setO(fan,rf*.14);
  /* error + autonomous fix (engineering robot) */
  const r0=st[0],ez=seg(t,60.9,61);
  sparks.forEach((e,i)=>{const on=t>=60.9&&t<62.6,a=t*14+i*1.05;A(e,{cx:(r0.x+Math.cos(a)*30).toFixed(1),cy:(r0.y-120*r0.sc+Math.sin(a*1.3)*24).toFixed(1)});setO(e,on?(Math.sin(a*3)>0?1:.2):0)});
  const dIn=E.io(seg(t,61.2,62.1)),dOut=E.io(seg(t,62.8,63.6));
  const tgt=[r0.x,r0.y-170*r0.sc];
  let dx=lerp(HOLO[0],tgt[0],dIn),dy=lerp(HOLO[1]+80,tgt[1]-30,dIn);dx=lerp(dx,HOLO[0],dOut);dy=lerp(dy,HOLO[1]+80,dOut);
  setX(drone,`translate(${dx.toFixed(1)} ${(dy+Math.sin(t*9)*4).toFixed(1)})`);setO(drone,t>=61.2&&t<63.7?1:0);A(prop,{x1:-26*Math.cos(t*40),x2:26*Math.cos(t*40)});
  const fb=t>=62.1&&t<62.8;A(fixBeam,{x1:dx.toFixed(1),y1:(dy+18).toFixed(1),x2:r0.x.toFixed(1),y2:(r0.y-130*r0.sc).toFixed(1)});setO(fixBeam,fb?.9:0);
  setX(okMark,`translate(${r0.x.toFixed(1)} ${(r0.y-215*r0.sc).toFixed(1)}) scale(${Math.max(E.pop(seg(t,62.6,63.1)),.001).toFixed(3)})`);setO(okMark,t>=62.6&&t<64.2?1-seg(t,63.6,64.2):0);
  /* decision card */
  const cIn=E.io(seg(t,63.5,64.9));
  let kx=lerp(HOLO[0],520,cIn),ky=lerp(HOLO[1],600,cIn)-Math.sin(cIn*Math.PI)*120;
  if(t>=64.9)ky=600+Math.sin(t*3)*5;
  setX(card,`translate(${kx.toFixed(1)} ${ky.toFixed(1)}) scale(${(lerp(.4,1,cIn)).toFixed(3)}) rotate(${((1-cIn)*-14).toFixed(1)})`);setO(card,t>=63.5&&t<66.4?1-seg(t,66,66.4):0);
  setT(cardTx,tr("card"));setA(cardTx,"font-size",ST.lang==="zh"?17:13);
  const tp=seg(t,65.3,65.9);A(tap,{r:(10+34*E.out(tp)).toFixed(1)});setO(tap,tp>0&&tp<1?1-tp:0);setA(yes,"transform",`translate(-44 22) scale(${(1+.18*Math.sin(clamp(seg(t,65.3,65.8))*Math.PI)).toFixed(3)})`);
}

function renderChrome(t){
  let idx=-1;for(let i=0;i<CUES.length;i++)if(t>=CUES[i][0]&&t<=CUES[i][1]){idx=i;break}
  if(idx<0){capEl.style.opacity=0;prevCue=-1}
  else{const c=CUES[idx];if(idx!==prevCue||capT._l!==ST.lang){capT.textContent=tr(c[2]);prevCue=idx;capT._l=ST.lang}
    const o=Math.min(seg(t,c[0],c[0]+.45),1-seg(t,c[1]-.4,c[1]));capEl.style.opacity=o.toFixed(3);capEl.style.transform=`translateY(${((1-o)*10).toFixed(1)}px)`}
  let ci=0;CHAPTERS.forEach((c,i)=>{if(t>=c[0])ci=i});const c0=CHAPTERS[ci][0];
  chapEl.textContent=ROMAN[ci]+"  ·  "+tr(CHAPTERS[ci][1]);chapEl.style.opacity=(Math.min(seg(t,c0,c0+.6),1-seg(t,c0+3.2,c0+4))*.9).toFixed(3);
  const tri=(a,b,m)=>t<a||t>b?0:t<m?(t-a)/(m-a):(b-t)/(b-m);
  const fl=Math.max(.85*tri(49,49.9,49.35),.85*tri(66,66.9,66.35),.55*tri(38.8,39,38.9),.35*tri(39.5,39.7,39.6));
  flashEl.style.opacity=fl.toFixed(3);
  fadeEl.style.opacity=(seg(t,44.4,45.7)*(1-seg(t,46,46.9))).toFixed(3);
  const eo=E.out(seg(t,71.8,73));endEl.style.opacity=eo.toFixed(3);endEl.style.transform=`translateY(${((1-eo)*16).toFixed(1)}px)`;
  const co=E.out(seg(t,74,75));ctaEl.style.opacity=co.toFixed(3);ctaEl.classList.toggle("on",t>74.2);
  setT($("#end1"),tr("end1"));setT($("#end2"),tr("end2"));
}
ST.render=t=>{renderWorld(t);renderChrome(t)};
})();
