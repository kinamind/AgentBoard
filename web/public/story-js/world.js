/* AgentBoard story animation — the office world (static structure + refs) */
(()=>{
"use strict";
const {S,A,rng,W,H,tr}=ST;
const world=document.getElementById("world");
const defs=S("defs",{},world);
defs.innerHTML=`
<linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1"><stop id="skyA" offset="0" stop-color="#050716"/><stop id="skyB" offset="1" stop-color="#141a3c"/></linearGradient>
<radialGradient id="gLamp"><stop offset="0" stop-color="#ffd890" stop-opacity=".9"/><stop offset=".5" stop-color="#ffb860" stop-opacity=".25"/><stop offset="1" stop-color="#ffb860" stop-opacity="0"/></radialGradient>
<radialGradient id="gHolo"><stop offset="0" stop-color="#c7d2fe" stop-opacity=".85"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
<radialGradient id="gSun"><stop offset="0" stop-color="#fff3c4" stop-opacity="1"/><stop offset=".35" stop-color="#ffd877" stop-opacity=".55"/><stop offset="1" stop-color="#ffd877" stop-opacity="0"/></radialGradient>
<linearGradient id="gBrand" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
<linearGradient id="gShaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d6" stop-opacity=".55"/><stop offset="1" stop-color="#fff6d6" stop-opacity="0"/></linearGradient>
<linearGradient id="gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8957c"/><stop offset="1" stop-color="#8f6f58"/></linearGradient>
<clipPath id="cw"><rect x="1240" y="110" width="460" height="410"/></clipPath>`;

const cam=ST.cam=S("g",{},world);
const L=()=>S("g",{},cam);
const gBack=L(),gWin=L(),gWall=L(),gSeat=L(),gDesk=L(),gZone=L(),gRob=L(),gBub=L(),gFront=L(),gShade=L(),gGlow=L(),gFx=L();
const w=ST.w={gSeat,gDesk,gZone,gRob,gBub,gFront,gFx,gGlow};
const R=rng(7);

/* ── room shell ── */
S("rect",{x:-200,y:-200,width:W+400,height:920,fill:"#d6dbf0"},gBack);
S("rect",{x:-200,y:520,width:W+400,height:200,fill:"#c3cae8"},gBack);
S("rect",{x:-200,y:512,width:W+400,height:10,fill:"#aab3d9"},gBack);
S("rect",{x:-200,y:720,width:W+400,height:500,fill:"url(#gFloor)"},gBack);
[770,830,900,985,1075].forEach(y=>S("line",{x1:-200,y1:y,x2:W+200,y2:y,stroke:"rgba(0,0,0,.09)","stroke-width":3},gBack));
S("rect",{x:-200,y:706,width:W+400,height:18,fill:"#9aa3cf"},gBack);
S("ellipse",{cx:960,cy:905,rx:780,ry:105,fill:"rgba(99,102,241,.13)"},gBack);
w.shaft=S("polygon",{points:"1250,330 1690,330 1360,1000 900,1000",fill:"url(#gShaft)",opacity:0},gBack);

/* ── window with living sky ── */
const WIN=w.WIN={x:1240,y:110,w:460,h:410};
const inWin=S("g",{"clip-path":"url(#cw)"},gWin);
S("rect",{x:WIN.x,y:WIN.y,width:WIN.w,height:WIN.h,fill:"url(#gSky)"},inWin);
w.skyA=document.getElementById("skyA");w.skyB=document.getElementById("skyB");
w.stars=[];for(let i=0;i<46;i++){w.stars.push({e:S("circle",{cx:WIN.x+R()*WIN.w,cy:WIN.y+R()*WIN.h*.62,r:.8+R()*1.6,fill:"#fff"},inWin),p:R()*6})}
w.sunG=S("g",{},inWin);
S("circle",{cx:0,cy:0,r:120,fill:"url(#gSun)"},w.sunG);S("circle",{cx:0,cy:0,r:38,fill:"#fff4c8"},w.sunG);
w.moon=S("g",{transform:`translate(${WIN.x+330} ${WIN.y+90})`},inWin);
S("circle",{r:36,fill:"#f4f1e0"},w.moon);S("circle",{cx:-10,cy:-8,r:7,fill:"#dcd8c4"},w.moon);S("circle",{cx:12,cy:10,r:9,fill:"#dcd8c4"},w.moon);
w.clouds=[0,1,2].map(i=>({e:S("g",{},inWin),x:WIN.x+60+i*170,y:WIN.y+70+i*38,k:i}));
w.clouds.forEach(c=>{S("ellipse",{cx:0,cy:0,rx:56,ry:16,fill:"#fff"},c.e);S("ellipse",{cx:-20,cy:-12,rx:30,ry:16,fill:"#fff"},c.e);S("ellipse",{cx:18,cy:-16,rx:34,ry:18,fill:"#fff"},c.e)});
w.far=[];w.near=[];w.lights=[];
for(let x=WIN.x-10,i=0;x<WIN.x+WIN.w;i++){const bw=32+R()*26,bh=70+R()*100;w.far.push(S("rect",{x,y:WIN.y+WIN.h-bh,width:bw,height:bh},inWin));x+=bw-4}
for(let x=WIN.x-20,i=0;x<WIN.x+WIN.w;i++){
  const bw=46+R()*40,bh=110+R()*120,y=WIN.y+WIN.h-bh;w.near.push(S("rect",{x,y,width:bw,height:bh},inWin));
  for(let cx=x+8;cx<x+bw-10;cx+=14)for(let cy=y+12;cy<WIN.y+WIN.h-8;cy+=18)if(R()<.45)w.lights.push({e:S("rect",{x:cx,y:cy,width:6,height:9,fill:"#ffd77a"},inWin),p:R()*9});
  x+=bw+2;
}
w.rain=[];for(let i=0;i<70;i++)w.rain.push({e:S("line",{stroke:"#9db4e8","stroke-width":1.6,"stroke-linecap":"round"},inWin),x:WIN.x+R()*(WIN.w+80),o:R()*500,sp:.8+R()*.6});
S("rect",{x:WIN.x-8,y:WIN.y-8,width:WIN.w+16,height:WIN.h+16,rx:6,fill:"none",stroke:"#eef0fb","stroke-width":16},gWin);
S("line",{x1:WIN.x+WIN.w/2,y1:WIN.y,x2:WIN.x+WIN.w/2,y2:WIN.y+WIN.h,stroke:"#eef0fb","stroke-width":9},gWin);
S("line",{x1:WIN.x,y1:WIN.y+WIN.h*.5,x2:WIN.x+WIN.w,y2:WIN.y+WIN.h*.5,stroke:"#eef0fb","stroke-width":9},gWin);
S("rect",{x:WIN.x-26,y:WIN.y+WIN.h+6,width:WIN.w+52,height:16,rx:6,fill:"#b9c1e0"},gWin);

/* ── door + nameplate sign ── */
S("rect",{x:112,y:242,width:216,height:480,rx:6,fill:"#7d86b8"},gWall);
S("rect",{x:124,y:254,width:192,height:468,rx:4,fill:"#94735a"},gWall);
S("rect",{x:144,y:278,width:152,height:170,rx:6,fill:"#86664e"},gWall);S("rect",{x:144,y:470,width:152,height:210,rx:6,fill:"#86664e"},gWall);
S("circle",{cx:290,cy:500,r:9,fill:"#e8d9a8"},gWall);
S("circle",{cx:220,cy:318,r:6,fill:"#586078"},gWall);
const sign=w.sign=S("g",{},gWall);
S("line",{x1:0,y1:0,x2:-70,y2:46,stroke:"#586078","stroke-width":3},sign);S("line",{x1:0,y1:0,x2:70,y2:46,stroke:"#586078","stroke-width":3},sign);
const sBoard=w.signBoard=S("g",{},sign);
S("rect",{x:-104,y:42,width:208,height:66,rx:10,fill:"#f6f0e2",stroke:"#6b4f37","stroke-width":4},sBoard);
w.signTxt=S("text",{x:0,y:84,"text-anchor":"middle","font-size":26,"font-weight":800,fill:"#3a3f66"},sBoard);

/* ── wall chart, clock, calendar ── */
const ch=w.chart=S("g",{transform:"translate(430 150)"},gWall);
S("rect",{width:300,height:240,rx:12,fill:"#f6f8ff",stroke:"#9aa3cf","stroke-width":5},ch);
w.chartTitle=S("text",{x:18,y:34,"font-size":20,"font-weight":700,fill:"#4a5280"},ch);
for(let i=0;i<4;i++)S("line",{x1:18,y1:70+i*34,x2:282,y2:70+i*34,stroke:"#dfe4f6","stroke-width":2},ch);
const dn=u=>u<.3?.45+.8*u:.69*(1-Math.pow((u-.3)/.7,1.3));
const up=u=>.08+.9*Math.pow(u,1.7)+.03*Math.sin(u*22)*u;
const path=f=>{let d="";for(let i=0;i<=40;i++){const u=i/40;d+=(i?"L":"M")+(24+252*u).toFixed(1)+" "+(196-120*Math.max(0,f(u))).toFixed(1)}return d};
w.chDown=S("path",{d:path(dn),fill:"none",stroke:"#e11d48","stroke-width":6,"stroke-linecap":"round","stroke-linejoin":"round"},ch);
w.chUp=S("path",{d:path(up),fill:"none",stroke:"#10b981","stroke-width":6,"stroke-linecap":"round","stroke-linejoin":"round",opacity:0},ch);
w.chDownLen=w.chDown.getTotalLength();w.chUpLen=w.chUp.getTotalLength();
w.chMul=S("text",{x:282,y:34,"text-anchor":"end","font-size":24,"font-weight":800,fill:"#10b981",opacity:0},ch);
const clk=w.clock=S("g",{transform:"translate(960 250)"},gWall);
S("circle",{r:72,fill:"#f6f8ff",stroke:"#6b4f37","stroke-width":8},clk);
for(let i=0;i<12;i++){const a=i/12*Math.PI*2;S("line",{x1:Math.sin(a)*56,y1:-Math.cos(a)*56,x2:Math.sin(a)*64,y2:-Math.cos(a)*64,stroke:"#586078","stroke-width":3},clk)}
w.hHand=S("line",{x1:0,y1:0,x2:0,y2:-34,stroke:"#2a2f55","stroke-width":6,"stroke-linecap":"round"},clk);
w.mHand=S("line",{x1:0,y1:0,x2:0,y2:-52,stroke:"#2a2f55","stroke-width":4,"stroke-linecap":"round"},clk);
S("circle",{r:5,fill:"#e11d48"},clk);
const cal=w.cal=S("g",{transform:"translate(1040 180)"},gWall);
S("rect",{width:124,height:150,rx:10,fill:"#fff",stroke:"#9aa3cf","stroke-width":4},cal);
S("rect",{width:124,height:38,rx:10,fill:"#e11d48"},cal);S("rect",{y:24,width:124,height:14,fill:"#e11d48"},cal);
w.calTxt=S("text",{x:62,y:100,"text-anchor":"middle","font-size":30,"font-weight":800,fill:"#2a2f55"},cal);
S("circle",{cx:30,cy:4,r:5,fill:"#586078"},cal);S("circle",{cx:94,cy:4,r:5,fill:"#586078"},cal);

/* ── sticky notes (chaos) ── */
w.stick=[];{
  const zones=[[340,530,270,170],[1190,540,700,170],[1715,120,185,380],[745,120,135,240],[1175,120,60,380],[340,120,80,300]];
  const cols=["#ffe36e","#ffb3c7","#9ff0d0","#b6c8ff"];
  for(let i=0;i<30;i++){const z=zones[i%zones.length],g=S("g",{},gWall);
    S("rect",{x:-22,y:-22,width:44,height:44,rx:3,fill:cols[i%4]},g);S("line",{x1:-14,y1:-6,x2:14,y2:-6,stroke:"rgba(0,0,0,.25)","stroke-width":3},g);S("line",{x1:-14,y1:6,x2:6,y2:6,stroke:"rgba(0,0,0,.2)","stroke-width":3},g);
    w.stick.push({g,x:z[0]+R()*z[2],y:z[1]+R()*z[3],r:(R()-.5)*40,t:24+i*.46});}
}

/* ── seated layer: chair ── */
S("rect",{x:722,y:462,width:136,height:250,rx:28,fill:"#454a79"},gSeat);

/* ── desk ── */
S("ellipse",{cx:900,cy:778,rx:340,ry:20,fill:"rgba(0,0,0,.2)"},gDesk);
S("rect",{x:640,y:630,width:520,height:142,fill:"#7d5f42"},gDesk);
S("rect",{x:660,y:650,width:230,height:50,rx:6,fill:"#6b4f37"},gDesk);S("rect",{x:910,y:650,width:230,height:50,rx:6,fill:"#6b4f37"},gDesk);
S("rect",{x:660,y:710,width:230,height:50,rx:6,fill:"#6b4f37"},gDesk);S("rect",{x:910,y:710,width:230,height:50,rx:6,fill:"#6b4f37"},gDesk);
[775,1025].forEach(x=>{S("rect",{x:x-30,y:668,width:60,height:8,rx:4,fill:"#d9c8a8"},gDesk);S("rect",{x:x-30,y:728,width:60,height:8,rx:4,fill:"#d9c8a8"},gDesk)});
S("rect",{x:620,y:600,width:560,height:32,rx:8,fill:"#a5835f"},gDesk);
S("rect",{x:624,y:602,width:552,height:6,rx:3,fill:"rgba(255,255,255,.25)"},gDesk);
/* papers (chaos pile) */
w.papers=[];for(let i=0;i<10;i++){const e=S("rect",{x:906+((i*7)%11)-5,y:598-(i+1)*6,width:62,height:7,rx:2,fill:i%2?"#fff":"#eef0fb",stroke:"#c3cae8","stroke-width":1,transform:`rotate(${((i*37)%19)-9} 937 ${598-i*6})`},gDesk);w.papers.push(e)}
/* phone */
const ph=w.phone=S("g",{transform:"translate(655 598)"},gDesk);
S("rect",{x:-26,y:-18,width:52,height:18,rx:6,fill:"#2a2f55"},ph);S("rect",{x:-18,y:-24,width:36,height:8,rx:4,fill:"#586078"},ph);
w.waves=[0,1,2].map(i=>S("path",{d:`M${-8-i*9} ${-32-i*8} Q0 ${-44-i*10} ${8+i*9} ${-32-i*8}`,fill:"none",stroke:"#e11d48","stroke-width":3,"stroke-linecap":"round",opacity:0},ph));
/* coins (results) */
w.coins=[];for(let i=0;i<9;i++){const g=S("g",{transform:`translate(655 ${598-i*9})`,opacity:0},gDesk);S("ellipse",{rx:26,ry:7,fill:"#f5b301",stroke:"#b27d00","stroke-width":2},g);w.coins.push(g)}
/* mug */
const mug=S("g",{transform:"translate(1000 600)"},gDesk);
S("rect",{x:-16,y:-34,width:32,height:34,rx:6,fill:"#fff",stroke:"#c3cae8","stroke-width":2},mug);S("path",{d:"M16 -26 q14 0 14 12 q0 10 -14 10",fill:"none",stroke:"#c3cae8","stroke-width":4},mug);
w.steam=[0,1].map(i=>S("path",{d:`M${-6+i*12} -40 q-8 -12 0 -22 q8 -10 0 -20`,fill:"none",stroke:"rgba(255,255,255,.7)","stroke-width":3,"stroke-linecap":"round",opacity:0},mug));
/* lamp */
const lamp=S("g",{transform:"translate(1148 598)"},gDesk);
S("ellipse",{rx:30,ry:8,fill:"#586078"},lamp);S("path",{d:"M0 -2 L-22 -70 L-52 -92",fill:"none",stroke:"#6b74a8","stroke-width":8,"stroke-linecap":"round","stroke-linejoin":"round"},lamp);
S("path",{d:"M-70 -104 L-34 -112 L-48 -78 Z",fill:"#6b74a8"},lamp);w.bulb=S("circle",{cx:-46,cy:-86,r:9,fill:"#ffe9a8"},lamp);
/* laptop */
S("rect",{x:700,y:588,width:180,height:12,rx:5,fill:"#8d96bd"},gDesk);
S("rect",{x:710,y:520,width:160,height:70,rx:9,fill:"#b7bfdc",stroke:"#8d96bd","stroke-width":3},gDesk);
w.lapLogo=S("circle",{cx:790,cy:555,r:12,fill:"url(#gBrand)"},gDesk);
w.lapGlow=S("rect",{x:710,y:520,width:160,height:70,rx:9,fill:"#a5b4fc",opacity:0},gDesk);
/* projector puck (hologram source) */
w.puck=S("g",{transform:"translate(1060 600)",opacity:0},gDesk);
S("ellipse",{rx:50,ry:11,fill:"#6b74a8"},w.puck);S("ellipse",{cx:0,cy:-4,rx:36,ry:7,fill:"#a5b4fc"},w.puck);
/* plant (grows / wilts) */
const plant=w.plant=S("g",{transform:"translate(1800 722)"},gWall);
S("path",{d:"M-34 0 L-26 -62 L26 -62 L34 0 Z",fill:"#c2704e"},plant);S("rect",{x:-30,y:-70,width:60,height:12,rx:4,fill:"#a95a3b"},plant);
w.leaves=[-1,0,1,-.5,.5].map((k,i)=>{const g=S("g",{transform:"translate(0 -66)"},plant);S("path",{d:"M0 0 C-18 -40 -10 -90 0 -120 C10 -90 18 -40 0 0Z",fill:i%2?"#2fa36b":"#3dbd7d"},g);return{g,k,i}});

/* ── light & mood overlays ── */
w.shade=S("path",{d:`M-200 -200H${W+200}V1280H-200Z M${WIN.x-8} ${WIN.y-8}H${WIN.x+WIN.w+8}V${WIN.y+WIN.h+8}H${WIN.x-8}Z`,fill:"#050818","fill-rule":"evenodd",opacity:.7},gShade);
w.lampGlow=S("circle",{cx:1100,cy:540,r:520,fill:"url(#gLamp)",opacity:0},gGlow);
w.lapLight=S("ellipse",{cx:790,cy:470,rx:210,ry:150,fill:"url(#gHolo)",opacity:0},gGlow);
})();
