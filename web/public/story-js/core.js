/* AgentBoard story animation — core helpers + i18n. Shared via window.ST */
(()=>{
"use strict";
const ST=window.ST={W:1920,H:1080,TOTAL:76};
const NS="http://www.w3.org/2000/svg";
ST.$=s=>document.querySelector(s);
ST.S=(tag,a,p)=>{const e=document.createElementNS(NS,tag);if(a)for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e};
ST.A=(e,o)=>{for(const k in o)e.setAttribute(k,o[k])};
const clamp=ST.clamp=(x,a=0,b=1)=>x<a?a:x>b?b:x;
const lerp=ST.lerp=(a,b,t)=>a+(b-a)*t;
ST.seg=(t,a,b)=>clamp((t-a)/(b-a));
ST.E={
  out:x=>1-Math.pow(1-x,3),
  in:x=>x*x*x,
  io:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2,
  pop:x=>{const c=1.9;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)}
};
ST.rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
ST.mixc=(a,b,t)=>{const x=hex(a),y=hex(b);t=clamp(t);return"#"+x.map((v,i)=>Math.round(lerp(v,y[i],t)).toString(16).padStart(2,"0")).join("")};
/* cached attribute setters (avoid redundant DOM writes) */
ST.setA=(e,k,v)=>{const c=e._c||(e._c={});if(c[k]!==v){c[k]=v;e.setAttribute(k,v)}};
ST.setO=(e,v)=>{v=Math.round(clamp(v)*1000)/1000;ST.setA(e,"opacity",v)};
ST.setX=(e,s)=>ST.setA(e,"transform",s);
ST.setT=(e,s)=>{if(e._s!==s){e._s=s;e.textContent=s}};
ST.show=(e,on)=>ST.setA(e,"display",on?"inline":"none");
/* smooth interpolation through keyframes [[t,v],...] (Hermite with finite-difference tangents) */
ST.sp=(a,t)=>{
  const n=a.length;if(t<=a[0][0])return a[0][1];if(t>=a[n-1][0])return a[n-1][1];
  let i=0;while(t>=a[i+1][0])i++;
  const t0=a[i][0],t1=a[i+1][0],v0=a[i][1],v1=a[i+1][1],h=t1-t0,u=(t-t0)/h;
  const m0=i>0?(v1-a[i-1][1])/(t1-a[i-1][0]):(v1-v0)/h;
  const m1=i<n-2?(a[i+2][1]-v0)/(a[i+2][0]-t0):(v1-v0)/h;
  const u2=u*u,u3=u2*u;
  return(2*u3-3*u2+1)*v0+(u3-2*u2+u)*h*m0+(-2*u3+3*u2)*v1+(u3-u2)*h*m1;
};
/* ease-in-out keyframes (stops at every key) */
ST.kf=(a,t)=>{
  if(t<=a[0][0])return a[0][1];
  for(let i=0;i<a.length-1;i++){const[t0,v0]=a[i],[t1,v1]=a[i+1];if(t<t1)return lerp(v0,v1,ST.E.io(ST.seg(t,t0,t1)))}
  return a[a.length-1][1];
};

/* ───────── i18n ───────── */
ST.lang=(navigator.language||"zh").toLowerCase().startsWith("zh")?"zh":"en";
{const q=new URLSearchParams(location.search).get("lang");if(q==="en"||q==="zh")ST.lang=q}
const D=ST.D={
  s0:["深夜,一个人,一个念头。","Late at night: one person, one idea."],
  s1:["他决定,开一家自己的公司。","He decides to start a company of his own."],
  s2:["于是,他雇来一群 Agent。","So he hires a swarm of agents."],
  s3:["写代码、做调研、跑客服……个个都能干。","Code, research, support… every one of them capable."],
  s4:["可是,每个 Agent 都在等他拍板。","But every agent is waiting on him."],
  s5:["确认、报错、请示……一个接着一个。","Approvals, errors, questions, one after another."],
  s6:["人的精力,是有限的。","A person's attention is finite."],
  s7:["三个月后,公司倒闭了。","Three months later, the company is gone."],
  s8:["直到有一天,一个指挥中心亮了起来。","Until one day, a command center lights up."],
  s9:["他只需要立下目标。","He only has to set the goal."],
  s10:["目标被拆解,分发到各个部门。","The goal is broken down and routed to departments."],
  s11:["每个 Agent 都被盯着,异常自动处理。","Every agent is watched, and problems fix themselves."],
  s12:["关键的事,才会来找他,并附上决策建议。","Only key matters reach him, with advice attached."],
  s13:["他把精力,放回宏观。","He puts his energy back on the big picture."],
  s14:["效益,一路向上。","Results climb."],
  c1:["夜","Night"],c2:["招兵买马","Hiring"],c3:["焦头烂额","Overwhelmed"],c4:["打烊","Closed"],
  c5:["黎明","Dawn"],c6:["各就各位","In place"],c7:["蒸蒸日上","Thriving"],
  plate:["我的一人公司","My solo company"],closed:["已停业","CLOSED"],
  day:["第 {n} 天","Day {n}"],chartT:["月营收","Monthly revenue"],
  goal:["本季度营收 ×3","Triple revenue this quarter"],
  card:["新定价页:先灰度?","New pricing: pilot first?"],
  illus:["示意数据","Illustrative data"],
  end1:["你只管方向。","You set the direction."],
  end2:["其余,交给 AgentBoard。","AgentBoard runs the rest."],
  cta1:["进入控制台","Open the console"],cta2:["重新播放","Replay"],
  skip:["进入控制台 →","Open the console →"],
  verA:["看板版","Dashboard"],verB:["故事版","Story"],
  ro0:["写代码","Code"],ro1:["测试","QA"],ro2:["写文案","Copy"],ro3:["投放","Ads"],
  ro4:["做调研","Research"],ro5:["做报表","Reports"],ro6:["做产品","Product"],ro7:["做规划","Planning"],
  ro8:["客服","Support"],ro9:["运维","Ops"],ro10:["财务","Finance"],ro11:["法务","Legal"],
  dn0:["研发部","Engineering"],dn1:["市场部","Marketing"],dn2:["研究部","Research"],
  dn3:["产品与战略部","Strategy"],dn4:["运营部","Operations"],dn5:["财务部","Finance"]
};
ST.tr=k=>D[k]?D[k][ST.lang==="zh"?0:1]:k;
})();
