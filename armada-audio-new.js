// Procedural Web Audio engine for the tribute battle. Every sound is synthesized from oscillators,
// one shared white-noise buffer, filters and envelopes: no samples and no borrowed themes.
(function(root){
 'use strict';
 const KEY='tributeAudio',DEFAULTS={master:.8,music:.5,sfx:.8};
 const clamp=(v,a,b)=>v<a?a:v>b?b:v,num=(v,d)=>Number.isFinite(+v)?+v:d;
 const WEAPONS=['laser','phaser','pulse','kinetic','plasma','organic','ion-charge','ion-fire','arc','rail','beam'];
 const TIER={dur:[.9,2,3.8,7.5],gain:[.55,.8,1,1.25],rate:[1,.7,.45,.3],sub:[0,70,48,34],tone:[1,.85,.7,.55]};
 // Original moody progression (semitones above A): i, bVI, iv, v-ish voicings, glided rather than struck.
 const CHORDS=[[0,7,15],[-4,3,12],[5,12,20],[-5,2,10],[0,7,15],[-2,5,10],[-4,3,12],[-5,2,14]];
 const TEMPO=76,STEP=60/TEMPO/2,CHORD_STEPS=32,AHEAD=.3;
 const PULSE=[1,0,0,1,0,0,1,0],TOM=[1,0,0,0,1,0,1,1];
 const storage=()=>{try{return typeof localStorage!=='undefined'&&localStorage?localStorage:null;}catch(e){return null;}};

 function create(options){
  const opt=options||{},maxVoices=Math.max(1,Math.floor(num(opt.maxVoices,24)));
  let ctx=opt.context||null,unlocked=false,graph=null,noise=null,slow=false,lastStinger=-1e9;
  const vol={...DEFAULTS},voices=[],recent={},stats={dropped:0,played:0,peak:0};
  const L={x:0,y:0,z:0,fx:0,fy:0,fz:-1};
  const M={ready:false,next:0,step:0,chord:0,level:0,target:0,pads:[]};
  let drone=null;
  try{const s=storage(),saved=s&&JSON.parse(s.getItem(KEY)||'null');if(saved)for(const k in DEFAULTS)if(Number.isFinite(saved[k]))vol[k]=clamp(saved[k],0,1);}catch(e){}

  // ---- guarded node / param helpers: a missing node type or param never throws ----
  const now=()=>ctx?num(ctx.currentTime,0):0,clock=()=>opt.now?num(opt.now(),now()):now();
  function mk(name,...a){try{return ctx&&typeof ctx[name]==='function'?ctx[name](...a):null;}catch(e){return null;}}
  function call(p,fn,...a){if(!p)return;try{if(typeof p[fn]==='function')p[fn](...a);else if(fn!=='cancelScheduledValues')p.value=a[0];}catch(e){try{p.value=a[0];}catch(_){}}}
  const set=(p,v,t)=>call(p,'setValueAtTime',v,t),ramp=(p,v,t)=>call(p,'linearRampToValueAtTime',v,t);
  const expo=(p,v,t)=>call(p,'exponentialRampToValueAtTime',Math.max(1e-4,v),t),aim=(p,v,t,tc)=>call(p,'setTargetAtTime',v,t,Math.max(.001,tc));
  const glide=(p,v,tc)=>{const t=now();call(p,'cancelScheduledValues',t);aim(p,v,t,tc);};
  function link(...n){n=n.filter(Boolean);for(let i=0;i<n.length-1;i++)try{n[i].connect(n[i+1]);}catch(e){}return n[n.length-1];}
  function stop(s,t){try{s.stop(t);}catch(e){}}
  function gain(v=0){const g=mk('createGain');if(g)set(g.gain,v,now());return g;}
  function filter(type,f,q=.7){const b=mk('createBiquadFilter');if(!b)return null;try{b.type=type;}catch(e){}set(b.frequency,f,now());set(b.Q,q,now());return b;}
  function osc(type,f,t,end){const o=mk('createOscillator');if(!o)return null;try{o.type=type;}catch(e){}set(o.frequency,f,t);try{o.start(t);}catch(e){}if(end!=null)stop(o,end);return o;}
  function noiseSrc(t,end,rate=1){
   if(!noise)return null;const s=mk('createBufferSource');if(!s)return null;
   try{s.buffer=noise;s.loop=true;}catch(e){}set(s.playbackRate,rate,t);
   try{s.start(t,Math.random()*1.2);}catch(e){try{s.start(t);}catch(_){}}if(end!=null)stop(s,end);return s;
  }
  // attack/decay envelope that starts and ends at zero (no clicks)
  function env(g,t,a,peak,dur){if(!g)return g;const p=g.gain;set(p,0,t);ramp(p,peak,t+a);aim(p,0,t+a,Math.max(.005,(dur-a)/5));ramp(p,0,t+dur);return g;}

  function buildGraph(){
   if(graph)return;
   const master=gain(vol.master),comp=mk('createDynamicsCompressor'),music=gain(vol.music),sfx=gain(vol.sfx),sfxLP=filter('lowpass',20000),duck=gain(1);
   if(comp){const t=now();set(comp.threshold,-14,t);set(comp.knee,10,t);set(comp.ratio,4,t);set(comp.attack,.004,t);set(comp.release,.25,t);}
   link(master,comp,ctx.destination);link(duck,music,master);link(sfxLP,sfx,master);
   graph={master,comp,music,sfx,sfxLP,duck,sfxIn:sfxLP||sfx};
   try{const sr=num(ctx.sampleRate,44100),n=Math.floor(sr*1.5);noise=ctx.createBuffer(1,n,sr);const d=noise.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}catch(e){noise=null;}
  }

  function unlock(){
   if(!ctx){const C=root&&(root.AudioContext||root.webkitAudioContext);if(!C)return false;try{ctx=new C();}catch(e){return false;}}
   try{const r=ctx.resume&&ctx.resume();if(r&&r.catch)r.catch(()=>{});}catch(e){}
   if(!unlocked){buildGraph();unlocked=true;musicInit();}
   return true;
  }

  // ---- volumes ----
  function setVolume(bus,v){
   if(!(bus in vol))return false;vol[bus]=clamp(num(v,vol[bus]),0,1);
   if(graph&&graph[bus])glide(graph[bus].gain,vol[bus],.05);
   try{const s=storage();if(s)s.setItem(KEY,JSON.stringify(vol));}catch(e){}
   return true;
  }

  // ---- spatial ----
  function setListener(x,y,z,fx,fy,fz){
   const f=Math.hypot(fx,fy,fz)||1;Object.assign(L,{x:num(x,0),y:num(y,0),z:num(z,0),fx:num(fx,0)/f,fy:num(fy,0)/f,fz:num(fz,-1)/f});
  }
  function place(x,y,z){
   const dx=num(x,L.x)-L.x,dy=num(y,L.y)-L.y,dz=num(z,L.z)-L.z,d=Math.hypot(dx,dy,dz);
   let rx=-L.fz,rz=L.fx;const rl=Math.hypot(rx,rz);// right = forward x up(0,1,0)
   const pan=rl>1e-6&&d>1e-6?clamp((dx*rx+dz*rz)/rl/d,-1,1)*.85:0;
   return {d,pan,cutoff:clamp(18000*Math.pow(300/18000,Math.min(1,d/40000)),300,18000)};
  }

  // ---- voices ----
  function prune(t=now()){for(let i=voices.length-1;i>=0;i--)if(voices[i].end<=t){try{voices[i].out.disconnect();}catch(e){}voices.splice(i,1);}}
  function kill(v,t=now()){
   const p=v.out.gain;call(p,'cancelScheduledValues',t);aim(p,0,t,.008);ramp(p,0,t+.03);
   v.src.forEach(s=>stop(s,t+.03));v.end=t+.03;v.killed=true;
  }
  // Admission control: prune, rate-limit identical styles, enforce the cap by priority.
  function admit(style,prio,limit){
   const t=now(),c=clock();prune(t);
   if(limit){const r=(recent[style]||[]).filter(x=>c-x<.025);recent[style]=r;if(r.length>=2){stats.dropped++;return false;}r.push(c);}
   const live=voices.filter(v=>!v.killed);
   if(live.length>=maxVoices){
    let low=live[0];for(const v of live)if(v.prio<low.prio)low=v;
    if(!(prio>low.prio)){stats.dropped++;return false;}
    kill(low,t);voices.splice(voices.indexOf(low),1);// released immediately; its 30ms tail is not counted
   }
   return true;
  }
  // Creates out gain -> distance lowpass -> panner -> sfx bus, lets build() fill it, registers the voice.
  function voice(style,prio,pos,g,cutoff,build,limit=true){
   if(!unlocked||!graph)return false;
   if(!admit(style,prio,limit))return false;
   const t=now(),out=gain(0);if(!out){stats.dropped++;return false;}
   set(out.gain,g,t);
   const lp=filter('lowpass',cutoff),pan=mk('createStereoPanner');if(pan)set(pan.pan,pos.pan,t);
   link(out,lp,pan,graph.sfxIn);
   const r=build(t,out)||{},v={style,prio,out,src:(r.src||[]).filter(Boolean),end:t+num(r.dur,.5)+.05,killed:false};
   voices.push(v);stats.played++;stats.peak=Math.max(stats.peak,voices.filter(x=>!x.killed).length);
   return v;
  }
  const closeness=d=>1/(1+d/3000);

  // ---- weapon recipes: each returns {src,dur}; everything routes through `out` ----
  const R={
   laser(t,o){const a=osc('square',1500+Math.random()*300,t,t+.2),b=osc('sine',760,t,t+.2),g=env(gain(),t,.004,.28,.18);
    expo(a&&a.frequency,180,t+.16);expo(b&&b.frequency,120,t+.16);link(a,g);link(b,g);link(g,filter('lowpass',4200),o);return{src:[a,b],dur:.2};},
   phaser(t,o){const f=170+Math.random()*25,a=osc('sawtooth',f,t,t+.4),b=osc('sawtooth',f*1.009,t,t+.4),c=osc('sine',f*2,t,t+.4),g=gain(),bp=filter('bandpass',950,2.5);
    set(g.gain,0,t);ramp(g.gain,.22,t+.03);ramp(g.gain,.18,t+.3);ramp(g.gain,0,t+.38);ramp(bp&&bp.frequency,1250,t+.35);
    link(a,g);link(b,g);link(c,g);link(g,bp,o);return{src:[a,b,c],dur:.4};},
   pulse(t,o){const th=osc('sine',130,t,t+.25),z=osc('square',950,t+.01,t+.2),g1=env(gain(),t,.003,.55,.2),g2=env(gain(),t+.01,.004,.16,.16);
    expo(th&&th.frequency,42,t+.14);expo(z&&z.frequency,260,t+.15);link(th,g1,o);link(z,g2,filter('lowpass',3000),o);return{src:[th,z],dur:.25};},
   kinetic(t,o){const n=3+Math.floor(Math.random()*3),src=[],hp=filter('highpass',1600,.9);link(hp,o);
    for(let i=0;i<n;i++){const s=t+i*(.045+Math.random()*.02),ns=noiseSrc(s,s+.03,1.4),g=env(gain(),s,.002,.5,.025);link(ns,g,hp);src.push(ns);}
    return{src,dur:n*.065+.04};},
   plasma(t,o){const f=200+Math.random()*40,a=osc('sawtooth',f,t,t+.4),b=osc('sawtooth',f*.503,t,t+.4),lp=filter('lowpass',300,9),g=env(gain(),t,.02,.35,.36);
    if(lp){ramp(lp.frequency,1400,t+.08);expo(lp.frequency,220,t+.34);}expo(a&&a.frequency,f*.55,t+.34);link(a,lp);link(b,lp);link(lp,g,o);return{src:[a,b],dur:.4};},
   organic(t,o){const ns=noiseSrc(t,t+.34,.8),bp=filter('bandpass',380,6),g=env(gain(),t,.015,.9,.32),w=osc('sine',90,t,t+.3),wg=env(gain(),t,.01,.25,.2);
    if(bp){expo(bp.frequency,2300,t+.1);expo(bp.frequency,520,t+.3);}link(ns,bp,g,o);link(w,wg,o);return{src:[ns,w],dur:.34};},
   'ion-charge'(t,o){const a=osc('sawtooth',70,t,t+4.6),b=osc('sine',140,t,t+4.6),lp=filter('lowpass',400,4),g=gain();
    expo(a&&a.frequency,1100,t+4.4);expo(b&&b.frequency,2200,t+4.4);if(lp)expo(lp.frequency,5200,t+4.4);
    set(g.gain,0,t);ramp(g.gain,.05,t+.4);expo(g.gain,.3,t+4.3);ramp(g.gain,0,t+4.55);link(a,lp);link(b,lp);link(lp,g,o);return{src:[a,b],dur:4.6};},
   'ion-fire'(t,o){const ns=noiseSrc(t,t+.5,1),hp=filter('highpass',900),cg=env(gain(),t,.002,1,.35),sub=osc('sine',62,t,t+1.6),sg=env(gain(),t,.01,.9,1.5),
    body=osc('sawtooth',120,t,t+.7),bl=filter('lowpass',700),bg=env(gain(),t,.005,.35,.6);
    expo(sub&&sub.frequency,26,t+1.4);expo(body&&body.frequency,45,t+.6);link(ns,hp,cg,o);link(sub,sg,o);link(body,bl,bg,o);return{src:[ns,sub,body],dur:1.6};},
   arc(t,o){const ns=noiseSrc(t,t+.34,1.2),hp=filter('highpass',2600),g=gain(),z=osc('square',60,t,t+.32),zg=env(gain(),t,.005,.06,.3);
    set(g.gain,0,t);for(let s=.012;s<.3;s+=.012)ramp(g.gain,Math.random()<.45?.7*Math.random()+.1:0,t+s);ramp(g.gain,0,t+.32);
    link(ns,hp,g,o);link(z,zg,o);return{src:[ns,z],dur:.34};},
   rail(t,o){const ns=noiseSrc(t,t+.03,2),hp=filter('highpass',4000),tg=env(gain(),t,.001,1,.02),a=osc('sine',2400,t,t+.6),b=osc('sine',3610,t,t+.6),rg=env(gain(),t,.002,.18,.55);
    link(ns,hp,tg,o);link(a,rg);link(b,rg);link(rg,o);return{src:[ns,a,b],dur:.6};},
   beam(t,o){const a=osc('sawtooth',96,t,t+.58),b=osc('sawtooth',191.3,t,t+.58),c=osc('sine',760,t,t+.58),lp=filter('lowpass',1300,3),g=gain();
    set(g.gain,0,t);ramp(g.gain,.24,t+.04);ramp(g.gain,.22,t+.48);ramp(g.gain,0,t+.56);link(a,lp);link(b,lp);link(c,lp);link(lp,g,o);return{src:[a,b,c],dur:.58};}
  };

  function weapon(style,x,y,z,g=1){
   if(!unlocked)return false;
   style=R[style]?style:'laser';
   const pos=place(x,y,z);if(pos.d>20000){stats.dropped++;return false;}
   const big=style==='ion-fire',base=big?3:1,prio=base+closeness(pos.d)*.9;
   const v=voice(style,prio,pos,clamp(num(g,1),0,2)*(big?1:.8)*closeness(pos.d/.85),pos.cutoff,R[style]);
   if(!v)return false;
   if(style!=='ion-charge')return true;
   return {cancel(){if(!v.killed&&v.end>now())kill(v);},get active(){return !v.killed&&v.end>now();}};
  }

  function explosion(tier,x,y,z){
   if(!unlocked)return false;
   tier=clamp(Math.round(num(tier,0)),0,3);
   const pos=place(x,y,z),d=pos.d,delay=Math.min(1.6,d/12000),cutoff=pos.cutoff*TIER.tone[tier],g=TIER.gain[tier]/(1+d/3000);
   const prio=(tier>=2?3:2)+closeness(d)*.9,dur=TIER.dur[tier];
   const v=voice('explosion'+tier,prio,pos,g,cutoff,(t0,o)=>{
    const t=t0+delay,src=[],ns=noiseSrc(t,t+dur,TIER.rate[tier]),lp=filter('lowpass',Math.min(cutoff,9000),1),ng=gain();
    set(ng.gain,0,t);ramp(ng.gain,1,t+.012);aim(ng.gain,0,t+.05+tier*.08,dur*.22);ramp(ng.gain,0,t+dur);
    if(lp)expo(lp.frequency,Math.max(60,cutoff*.08),t+dur*.8);link(ns,lp,ng,o);src.push(ns);
    if(TIER.sub[tier]){const s=osc('sine',TIER.sub[tier]*1.8,t,t+dur),sg=gain();set(sg.gain,0,t);ramp(sg.gain,.9,t+.02);aim(sg.gain,0,t+.1,dur*.25);ramp(sg.gain,0,t+dur);
     expo(s&&s.frequency,TIER.sub[tier]*.5,t+dur*.7);link(s,sg,o);src.push(s);}
    if(tier===0){const p=osc('triangle',420,t,t+.25),pg=env(gain(),t,.003,.25,.22);expo(p&&p.frequency,90,t+.2);link(p,pg,o);src.push(p);}
    if(tier===3){// end of an age: a slow, detuned glassy swell riding over the collapse
     for(const f of [311,317.5,466]){const s=osc('sine',f,t+.4,t+dur),sg=gain();set(sg.gain,0,t+.4);ramp(sg.gain,.07,t+2.4);ramp(sg.gain,0,t+dur);expo(s&&s.frequency,f*.5,t+dur);link(s,sg,o);src.push(s);}
     const r=noiseSrc(t+1,t+dur,.12),rl=filter('lowpass',180),rg=gain();set(rg.gain,0,t+1);ramp(rg.gain,.6,t+2.5);ramp(rg.gain,0,t+dur);link(r,rl,rg,o);src.push(r);}
    return{src,dur:delay+dur};
   },false);
   return v?{delay,cutoff,gain:g,tier,distance:d}:false;
  }

  // ---- dedicated engine drone for the followed ship (outside the voice cap) ----
  function droneBuild(style,speed){
   const t=now(),out=gain(0),lp=filter('lowpass',600,1.2),src=[],sp=clamp(num(speed,.5),0,1);
   if(!out)return null;link(lp,out,graph.sfxIn);
   const d={out,lp,src,style,oscs:[],noise:null,ng:null};
   const add=(type,f,g)=>{const o=osc(type,f,t),og=gain(g);link(o,og,lp);if(o){src.push(o);d.oscs.push({o,f});}};
   const nz=(g,type,f,q)=>{const n=noiseSrc(t,null,1),bf=filter(type,f,q),ng=gain(g);link(n,bf,ng,lp);if(n)src.push(n);d.noise=bf;d.ng=ng;};
   if(style==='turbine'){add('sawtooth',80,.25);add('sine',160,.2);nz(.35,'bandpass',2500,6);}
   else if(style==='organic'){add('triangle',52,.4);add('triangle',52.8,.35);nz(.25,'lowpass',400,2);const l=osc('sine',.35,t),lg=gain(220);link(l,lg,lp&&lp.frequency);if(l)src.push(l);}
   else if(style==='roar'){add('sawtooth',42,.3);nz(.8,'lowpass',320,1);}
   else {d.style='hum';add('sine',58,.45);add('triangle',116.5,.2);add('sine',174,.1);}
   aim(out.gain,.22,t,.2);droneSpeed(d,sp);return d;
  }
  function droneSpeed(d,sp){
   const k=d.style==='turbine'?1+sp*1.6:d.style==='roar'?1+sp*.6:1+sp*.35;
   d.oscs.forEach(({o,f})=>glide(o.frequency,f*k,.3));
   if(d.lp)glide(d.lp.frequency,400+sp*(d.style==='turbine'?3200:1400),.3);
   if(d.noise&&d.style==='turbine')glide(d.noise.frequency,1800+sp*3500,.3);
   if(d.ng)glide(d.ng.gain,(d.style==='roar'?.5:.18)+sp*.35,.3);
  }
  function engineDrone(key,style,speed01){
   if(!unlocked||!graph)return false;
   if(drone&&key!=null&&drone.key===key&&drone.style===style){droneSpeed(drone,clamp(num(speed01,.5),0,1));return true;}
   if(drone){const d=drone,t=now();call(d.out.gain,'cancelScheduledValues',t);aim(d.out.gain,0,t,.15);ramp(d.out.gain,0,t+.6);d.src.forEach(s=>stop(s,t+.65));drone=null;}
   if(key==null)return true;
   const d=droneBuild(style,speed01);if(!d)return false;d.key=key;d.style=style;drone=d;return true;
  }

  // ---- UI blips (not spatial, not capped) ----
  function ui(kind){
   if(!unlocked||!graph)return false;
   const t=now(),g=gain(1),o=[];link(g,graph.sfxIn);
   const tone=(type,f,f2,at,dur,peak)=>{const s=osc(type,f,t+at,t+at+dur+.02),e=env(gain(),t+at,.004,peak,dur);if(f2)expo(s&&s.frequency,f2,t+at+dur);link(s,e,g);o.push(s);};
   if(kind==='open')tone('triangle',480,900,0,.12,.3);
   else if(kind==='close')tone('triangle',900,460,0,.12,.3);
   else if(kind==='confirm'){tone('sine',660,0,0,.09,.3);tone('sine',990,0,.08,.14,.28);}
   else if(kind==='tick')tone('sine',3000,0,0,.012,.12);
   else tone('sine',1800,1500,0,.025,.22);
   return true;
  }

  // ---- adaptive music ----
  const hz=s=>110*Math.pow(2,s/12);
  function musicInit(){
   if(M.ready||!graph)return;M.ready=true;
   const t=now(),padLP=filter('lowpass',500,.8),pad=gain(0),pulse=gain(0),tom=gain(0);
   link(pad,padLP,graph.duck);link(pulse,filter('lowpass',1800,.7),graph.duck);link(tom,graph.duck);
   Object.assign(M,{padLP,pad,pulse,tom,next:t+.1,step:0,chord:0});
   const lfo=osc('sine',.045,t),lg=gain(260);link(lfo,lg,padLP&&padLP.frequency);
   CHORDS[0].forEach((s,i)=>{const f=hz(s),a=osc(i?'triangle':'sine',f,t),b=osc('sine',f*1.0035,t),g=gain(i?.1:.16);link(a,g,pad);link(b,g);M.pads.push([a,b]);});
   aim(pad.gain,.28,t,2.5);
  }
  function setIntensity(v){M.target=clamp(num(v,0),0,1);if(!M.ready)return;const i=M.target,t=now();
   aim(M.pad.gain,.28+.22*i,t,2);aim(M.pulse.gain,Math.max(0,(i-.3)/.7)*.5,t,2);aim(M.tom.gain,Math.max(0,(i-.6)/.4)*.7,t,2);aim(M.padLP&&M.padLP.frequency,450+i*1100,t,2);}
  function musicStep(t){
   const s=M.step++,chord=CHORDS[M.chord];
   if(s%CHORD_STEPS===0&&s>0){M.chord=(M.chord+1)%CHORDS.length;CHORDS[M.chord].forEach((st,i)=>{const p=M.pads[i];if(p){aim(p[0].frequency,hz(st),t,.9);aim(p[1].frequency,hz(st)*1.0035,t,.9);}});}
   const lv=M.level;
   if(lv>.3&&PULSE[s%8]){const f=hz(chord[(s>>3)%chord.length])*2,a=osc('triangle',f,t,t+.3),g=env(gain(),t,.006,.22,.26);link(a,g,M.pulse);}
   if(lv>.6&&TOM[s%8]){const a=osc('sine',s%8===0?96:80,t,t+.4),g=env(gain(),t,.004,.6,.35);expo(a&&a.frequency,44,t+.3);link(a,g,M.tom);
    const n=noiseSrc(t,t+.06,.5),ng=env(gain(),t,.002,.12,.05);link(n,filter('lowpass',600),ng,M.tom);}
  }
  function stinger(){
   if(!unlocked||!graph)return false;const c=clock();if(c-lastStinger<6)return false;lastStinger=c;
   const t=now(),lp=filter('lowpass',300,4),g=gain(0),src=[];link(lp,g,graph.duck);
   for(const [s,det] of [[-12,0],[-12,1.004],[-5,1],[0,.997],[3,1.003],[7,1]]){const o=osc('sawtooth',hz(s)*(det||1),t,t+2.6);link(o,lp);src.push(o);}
   if(lp){expo(lp.frequency,3600,t+.9);expo(lp.frequency,500,t+2.4);}
   set(g.gain,0,t);ramp(g.gain,.22,t+.25);ramp(g.gain,.18,t+1.4);ramp(g.gain,0,t+2.5);return true;
  }
  function setSlowMo(on){slow=!!on;if(!graph)return;glide(graph.duck.gain,slow?.04:1,.25);glide(graph.sfxLP&&graph.sfxLP.frequency,slow?800:20000,.2);}

  function update(dt){
   if(!unlocked)return;const t=now();prune(t);
   const k=1-Math.exp(-Math.max(0,num(dt,0))/2);M.level+=(M.target-M.level)*k;
   if(!M.ready)return;if(M.next<t)M.next=t+.05;
   for(let n=0;M.next<t+AHEAD&&n<8;n++){musicStep(M.next);M.next+=STEP;}
  }

  const api={
   unlock,setVolume,setListener,weapon,explosion,engine:engineDrone,ui,setIntensity,setSlowMo,stinger,update,
   get unlocked(){return unlocked;},
   volumes:()=>({...vol}),
   stats(){prune();return{voices:voices.filter(v=>!v.killed).length,maxVoices,dropped:stats.dropped,played:stats.played,peak:stats.peak};},
   suspend(){try{const r=ctx&&ctx.suspend&&ctx.suspend();if(r&&r.catch)r.catch(()=>{});}catch(e){}},
   resume(){try{const r=ctx&&unlocked&&ctx.resume&&ctx.resume();if(r&&r.catch)r.catch(()=>{});}catch(e){}},
   styles:WEAPONS.slice()
  };
  return api;
 }
 const API={create};
 if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.ArmadaAudio=API;
})(typeof window==='object'?window:globalThis);
