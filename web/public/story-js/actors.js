/* AgentBoard story animation — actors: the founder and the robot agents */
(()=>{
"use strict";
const {S,A,clamp,lerp,mixc,setA,setX,setO}=ST;

/* ───────── founder ───────── */
ST.mkFounder=function(parent){
  const root=S("g",{},parent);
  const legs=S("g",{},root);
  [-1,1].forEach(s=>{
    S("rect",{x:s*30-16,y:150,width:32,height:150,rx:14,fill:"#2a2f55"},legs);
    S("path",{d:`M${s*30-22} 300 h44 v10 a10 10 0 0 1 -10 10 h-24 a10 10 0 0 1 -10 -10Z`,fill:"#12152a"},legs);
  });
  const upper=S("g",{},root);
  S("path",{d:"M-66 6 C-66 -16 -40 -28 0 -28 C40 -28 66 -16 66 6 L58 178 L-58 178 Z",fill:"#4a56a6"},upper);
  S("path",{d:"M-22 -28 L0 20 L22 -28 Z",fill:"#eef0fa"},upper);
  S("rect",{x:-14,y:-48,width:28,height:26,rx:10,fill:"#e0b690"},upper);
  const head=S("g",{},upper);
  [-1,1].forEach(s=>S("circle",{cx:s*60,cy:-76,r:11,fill:"#e8bd9a"},head));
  S("circle",{cx:0,cy:-80,r:60,fill:"#f2cfae"},head);
  S("path",{d:"M-64 -86 C-74 -170 74 -170 64 -86 C48 -126 -34 -132 -64 -86 Z",fill:"#2a2438"},head);
  const tufts=[S("path",{d:"M-30 -134 L-40 -170 L-12 -140Z",fill:"#2a2438"},head),S("path",{d:"M-2 -142 L8 -180 L18 -140Z",fill:"#2a2438"},head),S("path",{d:"M30 -134 L50 -166 L40 -128Z",fill:"#2a2438"},head)];
  const bagsL=S("path",{d:"M-36 -64 Q-24 -57 -12 -64",fill:"none",stroke:"#a77c80","stroke-width":3.5,"stroke-linecap":"round",opacity:0},head);
  const bagsR=S("path",{d:"M12 -64 Q24 -57 36 -64",fill:"none",stroke:"#a77c80","stroke-width":3.5,"stroke-linecap":"round",opacity:0},head);
  const cheekL=S("ellipse",{cx:-38,cy:-56,rx:11,ry:7,fill:"#f08a8a",opacity:0},head);
  const cheekR=S("ellipse",{cx:38,cy:-56,rx:11,ry:7,fill:"#f08a8a",opacity:0},head);
  const eyes=S("g",{},head);
  const eL=S("ellipse",{cx:-24,cy:-80,rx:7,ry:8,fill:"#1b1622"},eyes),eR=S("ellipse",{cx:24,cy:-80,rx:7,ry:8,fill:"#1b1622"},eyes);
  S("circle",{cx:-22,cy:-83,r:2.5,fill:"#fff"},eyes);S("circle",{cx:26,cy:-83,r:2.5,fill:"#fff"},eyes);
  const bL=S("path",{fill:"none",stroke:"#2a2438","stroke-width":5,"stroke-linecap":"round"},head),bR=S("path",{fill:"none",stroke:"#2a2438","stroke-width":5,"stroke-linecap":"round"},head);
  const mouth=S("path",{fill:"none",stroke:"#7a3b3b","stroke-width":5,"stroke-linecap":"round"},head);
  const sweat=S("path",{d:"M62 -112 C54 -96 54 -88 62 -88 C70 -88 70 -96 62 -112 Z",fill:"#7dd3fc",opacity:0},head);
  const armL=S("path",{fill:"none",stroke:"#3d4890","stroke-width":28,"stroke-linecap":"round"},root);
  const armR=S("path",{fill:"none",stroke:"#3d4890","stroke-width":28,"stroke-linecap":"round"},root);
  const hL=S("circle",{r:15,fill:"#f2cfae"},root),hR=S("circle",{r:15,fill:"#f2cfae"},root);
  const mug=S("g",{opacity:0},root);
  S("rect",{x:-14,y:-30,width:28,height:30,rx:6,fill:"#fff",stroke:"#c3cae8","stroke-width":2},mug);S("path",{d:"M14 -22 q12 0 12 10 q0 9 -12 9",fill:"none",stroke:"#c3cae8","stroke-width":4},mug);
  const arm=(p,h,sx,sy,hx,hy,dir,bend)=>{const mx=(sx+hx)/2+dir*bend,my=(sy+hy)/2+bend*.5;A(p,{d:`M${sx} ${sy} Q${mx.toFixed(1)} ${my.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}`});A(h,{cx:hx.toFixed(1),cy:hy.toFixed(1)})};
  return{root,legs,mug,
    set(p){
      const sc=p.sc||1,sh=p.shake||0,tt=p.t||0;
      setX(root,`translate(${(p.x+Math.sin(tt*41)*sh*3).toFixed(1)} ${(p.y+Math.cos(tt*33)*sh*2).toFixed(1)}) scale(${sc})`);
      setA(legs,"display",p.legs?"inline":"none");
      const m=clamp(p.mood,-1,1),w=Math.max(0,-m),up=Math.max(0,m);
      const sl=p.slump||0;
      setX(upper,`translate(0 ${(sl*34).toFixed(1)})`);
      setX(head,`translate(${(Math.sin(tt*23)*sh*3).toFixed(1)} ${(sl*44+Math.sin(tt*7)*sh*2).toFixed(1)}) rotate(${(sl*22+(p.tilt||0)+Math.sin(tt*17)*sh*3).toFixed(1)} 0 -20)`);
      A(mouth,{d:`M-20 -44 Q0 ${(-44+m*24).toFixed(1)} 20 -44`});
      A(bL,{d:`M-40 ${(-104+w*5).toFixed(1)} L-12 ${(-106-w*11-up*3).toFixed(1)}`});A(bR,{d:`M12 ${(-106-w*11-up*3).toFixed(1)} L40 ${(-104+w*5).toFixed(1)}`});
      const blink=(tt%3.7)<.12?.1:1,ry=Math.max(.3,8*(p.ey==null?1:p.ey)*(1-.3*w)*blink);
      const lx=(p.look?p.look[0]:0)*4,ly=(p.look?p.look[1]:0)*3;
      A(eL,{ry:ry.toFixed(2),cx:-24+lx,cy:-80+ly});A(eR,{ry:ry.toFixed(2),cx:24+lx,cy:-80+ly});
      setO(bagsL,p.bags||0);setO(bagsR,p.bags||0);
      setO(cheekL,up*.6);setO(cheekR,up*.6);
      tufts.forEach(t=>setO(t,p.messy||0));
      setO(sweat,(p.sweat||0)*(.6+.4*Math.sin(tt*9)));
      arm(armL,hL,-52,6+sl*34,p.hl[0],p.hl[1]+sl*34*(p.hl[1]>40?0:1),-1,18);
      arm(armR,hR,52,6+sl*34,p.hr[0],p.hr[1]+sl*34*(p.hr[1]>40?0:1),1,18);
      setO(mug,p.mug||0);setX(mug,`translate(${p.hr[0]} ${p.hr[1]})`);
    }};
};

/* ───────── robot agents ───────── */
ST.mkRobot=function(parent,glyph){
  const root=S("g",{},parent);
  const shadow=S("ellipse",{cx:0,cy:3,rx:34,ry:8,fill:"rgba(0,0,0,.25)"},root);
  const inner=S("g",{},root);
  const legs=[-14,14].map(x=>S("rect",{x:x-8,y:-22,width:16,height:22,rx:6,fill:"#313a63"},inner));
  const body=S("rect",{x:-28,y:-70,width:56,height:50,rx:16},inner);
  const plate=S("rect",{x:-18,y:-62,width:36,height:30,rx:9},inner);
  const gly=S("text",{x:0,y:-40,"text-anchor":"middle","font-size":glyph.length>2?15:19,"font-weight":800,fill:"#0b1020","font-family":"ui-monospace,Consolas,monospace"},inner);gly.textContent=glyph;
  const aL=S("line",{"stroke-width":10,"stroke-linecap":"round"},inner),aR=S("line",{"stroke-width":10,"stroke-linecap":"round"},inner);
  const head=S("g",{},inner);
  const hd=S("rect",{x:-34,y:-130,width:68,height:58,rx:20},head);
  S("rect",{x:-26,y:-122,width:52,height:36,rx:13,fill:"#0b0e1a"},head);
  const eL=S("ellipse",{cx:-12,cy:-104,rx:6,ry:7,fill:"#67e8f9"},head),eR=S("ellipse",{cx:12,cy:-104,rx:6,ry:7,fill:"#67e8f9"},head);
  const xs=[-12,12].map(x=>S("path",{d:`M${x-6} -110 L${x+6} -98 M${x+6} -110 L${x-6} -98`,stroke:"#f87171","stroke-width":3.2,"stroke-linecap":"round",fill:"none",opacity:0},head));
  const hs=[-12,12].map(x=>S("path",{d:`M${x-6} -99 Q${x} -112 ${x+6} -99`,stroke:"#67e8f9","stroke-width":3.6,"stroke-linecap":"round",fill:"none",opacity:0},head));
  const mouth=S("path",{fill:"none",stroke:"#67e8f9","stroke-width":3,"stroke-linecap":"round"},head);
  S("line",{x1:0,y1:-130,x2:0,y2:-146,stroke:"#586078","stroke-width":4},head);
  const bulb=S("circle",{cx:0,cy:-150,r:6},head);
  const ring=S("circle",{cx:0,cy:-176,r:12,fill:"none","stroke-width":4,"stroke-linecap":"round",transform:"rotate(-90 0 -176)",opacity:0},root);
  return{root,glyph:gly,
    set(s){
      setX(root,`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${(s.tilt||0).toFixed(1)}) scale(${(s.sc*(1-(s.sq||0)*.5)).toFixed(3)} ${(s.sc*(1+(s.sq||0))).toFixed(3)})`);
      setO(root,s.op==null?1:s.op);
      setX(inner,`translate(0 ${(-(s.bob||0)).toFixed(1)})`);
      const c=s.col,dark=mixc(c,"#0b1020",.35),lite=mixc(c,"#ffffff",.38),arm=mixc(c,"#0b1020",.15);
      setA(hd,"fill",c);setA(body,"fill",dark);setA(plate,"fill",lite);setA(aL,"stroke",arm);setA(aR,"stroke",arm);
      const ang=a=>{const r=a*Math.PI/180;return[Math.sin(r)*32,Math.cos(r)*32]};
      const l=ang(s.aL||0),r=ang(s.aR||0);
      A(aL,{x1:-28,y1:-56,x2:(-28-l[0]).toFixed(1),y2:(-56+l[1]).toFixed(1)});A(aR,{x1:28,y1:-56,x2:(28+r[0]).toFixed(1),y2:(-56+r[1]).toFixed(1)});
      const sl=s.slump||0;
      setX(head,`translate(${(sl*2).toFixed(1)} ${(sl*16).toFixed(1)}) rotate(${(sl*26).toFixed(1)} 0 -72)`);
      const e=s.eye||0,lk=(s.look||0)*3,blink=((s.t||0)+(s.id||0)*1.3)%4.1<.1?.15:1;
      const worry=e===3;
      A(eL,{cx:-12+lk,ry:(worry?4.5:7*blink).toFixed(2)});A(eR,{cx:12+lk,ry:(worry?4.5:7*blink).toFixed(2)});
      setO(eL,e===0||worry?1:0);setO(eR,e===0||worry?1:0);
      xs.forEach(x=>setO(x,e===1?1:0));hs.forEach(x=>setO(x,e===2?1:0));
      const md=e===1?"M-8 -90 H8":e===3?"M-8 -88 Q0 -95 8 -88":e===2?"M-10 -90 Q0 -78 10 -90":"M-8 -90 Q0 -85 8 -90";
      setA(mouth,"d",md);
      setA(bulb,"fill",s.bulb||"#34d399");setO(bulb,s.bulbOp==null?1:s.bulbOp);
      if(s.ring!=null){const C=2*Math.PI*12;A(ring,{stroke:s.ringCol||"#fff","stroke-dasharray":`${(C*s.ring).toFixed(1)} ${C.toFixed(1)}`});setO(ring,1)}else setO(ring,0);
      setA(root,"data-y",Math.round(s.y));
    }};
};
})();
