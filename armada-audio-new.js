// Procedural Web Audio engine for the tribute battle. Every sound is synthesized from oscillators,
// two shared noise buffers (white and brown), filters and envelopes: no samples and no borrowed themes.
// Mix: every bus feeds a generated-impulse hall reverb, then a gentle compressor and a soft clipper.
(function(root){
 'use strict';
 const KEY='tributeAudio',DEFAULTS={master:.8,music:.5,sfx:.8};
 const clamp=(v,a,b)=>v<a?a:v>b?b:v,num=(v,d)=>Number.isFinite(+v)?+v:d;
 const WEAPONS=['laser','phaser','pulse','kinetic','plasma','organic','ion-charge','ion-fire','arc','rail','beam'];
 const TIER={dur:[.9,2.2,4,7.5],gain:[.42,.7,1,1.2],sub:[0,64,46,34],tone:[1,.8,.65,.5]};
 // Original moody progression (semitones above A): i, bVI, iv, v-ish voicings, glided rather than struck.
 const CHORDS=[[0,7,15],[-4,3,12],[5,12,20],[-5,2,10],[0,7,15],[-2,5,10],[-4,3,12],[-5,2,14]];
 const TEMPO=76,STEP=60/TEMPO/2,CHORD_STEPS=32,AHEAD=.3;
 const PULSE=[1,0,0,1,0,0,1,0],TOM=[1,0,0,0,1,0,1,1];
 const storage=()=>{try{return typeof localStorage!=='undefined'&&localStorage?localStorage:null;}catch(e){return null;}};
 const P=(n,k)=>n?n[k]:null;// a param of a node that may not exist
 const jit=(v,s)=>v*(1+(Math.random()*2-1)*s);// small random variation so repeats never sound identical

 function create(options){
  const opt=options||{},maxVoices=Math.max(1,Math.floor(num(opt.maxVoices,24)));
  let ctx=opt.context||null,unlocked=false,graph=null,noise=null,brown=null,slow=false,lastStinger=-1e9;
  const vol={...DEFAULTS},voices=[],recent={},stats={dropped:0,played:0,peak:0};
  const L={x:0,y:0,z:0,fx:0,fy:0,fz:-1};
  const M={ready:false,next:0,step:0,chord:0,level:0,target:0,pads:[],bass:null,thumpAt:0};
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
  function noiseSrc(t,end,rate=1,buf=noise){
   if(!buf)return null;const s=mk('createBufferSource');if(!s)return null;
   try{s.buffer=buf;s.loop=true;}catch(e){}set(s.playbackRate,rate,t);
   try{s.start(t,Math.random()*1.2);}catch(e){try{s.start(t);}catch(_){}}if(end!=null)stop(s,end);return s;
  }
  const rumble=(t,end,rate=1)=>noiseSrc(t,end,rate,brown||noise);
  // attack then exponential-style decay; starts and ends at zero (no clicks)
  function env(g,t,a,peak,dur){if(!g)return g;const p=g.gain;set(p,0,t);ramp(p,peak,t+a);aim(p,0,t+a,Math.max(.005,(dur-a)/5));ramp(p,0,t+dur);return g;}

  function buildGraph(){
   if(graph)return;
   const master=gain(vol.master),comp=mk('createDynamicsCompressor'),music=gain(vol.music),sfx=gain(vol.sfx),sfxLP=filter('lowpass',20000),duck=gain(1);
   const musicTrim=gain(.7),verb=mk('createConvolver'),verbIn=filter('highpass',180,.5),verbOut=gain(.9),sfxSend=gain(.16),musicSend=gain(.55),clip=mk('createWaveShaper');
   if(comp){const t=now();set(comp.threshold,-16,t);set(comp.knee,12,t);set(comp.ratio,3,t);set(comp.attack,.012,t);set(comp.release,.3,t);}
   // Soft clipper after the compressor: transients round off instead of splattering.
   if(clip)try{const n=1024,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(x*1.4)/Math.tanh(1.4);}clip.curve=c;}catch(e){}
   const hp=filter('highpass',38,.6);// brown noise carries energy below hearing; it only eats headroom
   link(master,hp,comp,clip,ctx.destination);
   link(duck,musicTrim,music,master);link(sfxLP,sfx,master);
   if(verb){link(sfx,sfxSend,verbIn);link(music,musicSend,verbIn);link(verbIn,verb,verbOut,master);}
   graph={master,comp,music,sfx,sfxLP,duck,sfxIn:sfxLP||sfx,verb};
   const sr=num(ctx.sampleRate,44100);
   try{const n=Math.floor(sr*1.5);noise=ctx.createBuffer(1,n,sr);const d=noise.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}catch(e){noise=null;}
   // Brown noise: the body of booms and the distant battle rumble (white noise reads as static).
   try{const n=Math.floor(sr*2);brown=ctx.createBuffer(1,n,sr);const d=brown.getChannelData(0);let v=0,peak=1e-6;
    for(let i=0;i<n;i++){v=(v+.02*(Math.random()*2-1))/1.02;d[i]=v;peak=Math.max(peak,Math.abs(v));}for(let i=0;i<n;i++)d[i]/=peak;}catch(e){brown=null;}
   // A generated hall: two decorrelated channels of decaying, darkening noise.
   if(verb)try{const len=Math.floor(sr*2.6),ir=ctx.createBuffer(2,len,sr);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);let lp=0;for(let i=0;i<len;i++){const t=i/sr,k=.35+.6*Math.min(1,t/1.8);lp+=(Math.random()*2-1-lp)*(1-k);d[i]=lp*Math.exp(-t*2.6)*(t<.012?t/.012:1);}}
    verb.buffer=ir;}catch(e){}
  }

  function unlock(){
   if(!ctx){const C=root&&(root.AudioContext||root.webkitAudioContext);if(!C)return false;try{ctx=new C();}catch(e){return false;}}
   try{const r=ctx.resume&&ctx.resume();if(r&&r.catch)r.catch(()=>{});}catch(e){}
   if(!unlocked){buildGraph();unlocked=true;musicInit();bedInit();}
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
   const pan=rl>1e-6&&d>1e-6?clamp((dx*rx+dz*rz)/rl/d,-1,1)*.7:0;
   return {d,pan,cutoff:clamp(18000*Math.pow(300/18000,Math.min(1,d/40000)),300,18000)};
  }
  // Distance mostly darkens a sound (the lowpass above) and only partly quietens it: a camera
  // pulled back to frame a capital should still hear the war, just further away.
  const loudness=d=>.3+.7/(1+d/6000);

  // ---- voices ----
  function prune(t=now()){for(let i=voices.length-1;i>=0;i--)if(voices[i].end<=t){try{voices[i].out.disconnect();}catch(e){}voices.splice(i,1);}}
  function kill(v,t=now()){
   const p=v.out.gain;call(p,'cancelScheduledValues',t);aim(p,0,t,.012);ramp(p,0,t+.05);
   v.src.forEach(s=>stop(s,t+.05));v.end=t+.05;v.killed=true;
  }
  // Admission control: prune, rate-limit identical styles, enforce the cap by priority.
  function admit(style,prio,limit){
   const t=now(),c=clock();prune(t);
   if(limit){const r=(recent[style]||[]).filter(x=>c-x<.025);recent[style]=r;if(r.length>=2){stats.dropped++;return false;}r.push(c);}
   const live=voices.filter(v=>!v.killed);
   if(live.length>=maxVoices){
    let low=live[0];for(const v of live)if(v.prio<low.prio)low=v;
    if(!(prio>low.prio)){stats.dropped++;return false;}
    kill(low,t);voices.splice(voices.indexOf(low),1);// released immediately; its 50ms tail is not counted
   }
   return true;
  }
  // Creates out gain -> distance lowpass -> panner -> sfx bus, lets build() fill it, registers the voice.
  function voice(style,prio,pos,g,cutoff,build,limit=true){
   if(!unlocked||!graph)return false;
   if(!admit(style,prio,limit))return false;
   const t=now(),out=gain(0);if(!out){stats.dropped++;return false;}
   set(out.gain,g,t);
   const lp=filter('lowpass',cutoff,.5),pan=mk('createStereoPanner');if(pan)set(pan.pan,pos.pan,t);
   link(out,lp,pan,graph.sfxIn);
   const r=build(t,out)||{},v={style,prio,out,src:(r.src||[]).filter(Boolean),end:t+num(r.dur,.5)+.05,killed:false};
   voices.push(v);stats.played++;stats.peak=Math.max(stats.peak,voices.filter(x=>!x.killed).length);
   return v;
  }
  const closeness=d=>1/(1+d/3000);

  // ---- weapon recipes: each returns {src,dur}; everything routes through `out` ----
  // Short, soft-edged and slightly varied: dozens play a minute, so none may be shrill.
  const R={
   laser(t,o){const f=jit(1050,.12),a=osc('sine',f,t,t+.16),b=osc('triangle',f*.5,t,t+.16),g=env(gain(),t,.003,.32,.14),lp=filter('lowpass',3000,.6);
    expo(P(a,'frequency'),f*.22,t+.13);expo(P(b,'frequency'),f*.14,t+.13);link(a,g);link(b,g);link(g,lp,o);return{src:[a,b],dur:.16};},
   phaser(t,o){const f=jit(170,.06),a=osc('sawtooth',f,t,t+.42),b=osc('sawtooth',f*1.007,t,t+.42),c=osc('sine',f*2,t,t+.42),g=gain(),bp=filter('bandpass',800,1.4),lp=filter('lowpass',2200,.5);
    set(P(g,'gain'),0,t);ramp(P(g,'gain'),.16,t+.05);ramp(P(g,'gain'),.12,t+.3);ramp(P(g,'gain'),0,t+.4);ramp(P(bp,'frequency'),1100,t+.35);
    link(a,g);link(b,g);link(c,g);link(g,bp,lp,o);return{src:[a,b,c],dur:.42};},
   pulse(t,o){const th=osc('sine',jit(120,.08),t,t+.26),z=osc('triangle',jit(820,.1),t+.01,t+.2),g1=env(gain(),t,.004,.5,.22),g2=env(gain(),t+.01,.004,.12,.16);
    expo(P(th,'frequency'),40,t+.16);expo(P(z,'frequency'),220,t+.15);link(th,g1,o);link(z,g2,filter('lowpass',2400),o);return{src:[th,z],dur:.26};},
   // autocannon: a few dull thuds, not clicks
   kinetic(t,o){const n=2+Math.floor(Math.random()*3),src=[],bp=filter('bandpass',jit(900,.15),1.1);link(bp,o);
    for(let i=0;i<n;i++){const s=t+i*(.06+Math.random()*.025),ns=noiseSrc(s,s+.05,1),g=env(gain(),s,.002,.55,.045),th=osc('sine',150,s,s+.07),tg=env(gain(),s,.002,.22,.06);
     expo(P(th,'frequency'),60,s+.06);link(ns,g,bp);link(th,tg,o);src.push(ns,th);}
    return{src,dur:n*.085+.06};},
   plasma(t,o){const f=jit(200,.1),a=osc('sawtooth',f,t,t+.4),b=osc('sawtooth',f*.503,t,t+.4),lp=filter('lowpass',300,4),g=env(gain(),t,.02,.26,.36);
    if(lp){ramp(lp.frequency,1200,t+.08);expo(lp.frequency,200,t+.34);}expo(P(a,'frequency'),f*.55,t+.34);link(a,lp);link(b,lp);link(lp,g,o);return{src:[a,b],dur:.4};},
   organic(t,o){const ns=rumble(t,t+.34,1.4),bp=filter('bandpass',380,3),g=env(gain(),t,.02,.9,.32),w=osc('sine',jit(90,.1),t,t+.3),wg=env(gain(),t,.01,.25,.2);
    if(bp){expo(bp.frequency,1600,t+.1);expo(bp.frequency,420,t+.3);}link(ns,bp,g,o);link(w,wg,o);return{src:[ns,w],dur:.34};},
   // a gathering hum, not a siren: rises an octave and a half, stays under 2 kHz
   'ion-charge'(t,o){const a=osc('triangle',110,t,t+4.6),b=osc('sine',55,t,t+4.6),lp=filter('lowpass',300,1.5),g=gain(),trem=osc('sine',5,t,t+4.6),tg=gain(.25);
    expo(P(a,'frequency'),330,t+4.4);expo(P(b,'frequency'),165,t+4.4);if(lp)expo(lp.frequency,1800,t+4.4);expo(P(trem,'frequency'),14,t+4.4);
    set(P(g,'gain'),0,t);ramp(P(g,'gain'),.05,t+.6);ramp(P(g,'gain'),.2,t+4.2);ramp(P(g,'gain'),0,t+4.55);
    const vca=gain(.75);link(trem,tg,P(vca,'gain'));link(a,lp);link(b,lp);link(lp,vca,g,o);return{src:[a,b,trem],dur:4.6};},
   'ion-fire'(t,o){const ns=noiseSrc(t,t+.4,1),bp=filter('bandpass',1800,.8),cg=env(gain(),t,.002,.45,.25),sub=osc('sine',62,t,t+1.8),sg=env(gain(),t,.01,.9,1.7),
    body=rumble(t,t+1.4,1),bl=filter('lowpass',900,.7),bg=env(gain(),t,.005,.8,1.3);
    expo(P(sub,'frequency'),26,t+1.5);if(bl)expo(bl.frequency,90,t+1.2);link(ns,bp,cg,o);link(sub,sg,o);link(body,bl,bg,o);return{src:[ns,sub,body],dur:1.8};},
   arc(t,o){const ns=noiseSrc(t,t+.3,1),bp=filter('bandpass',2400,.9),g=gain(),z=osc('sawtooth',60,t,t+.3),zl=filter('lowpass',500),zg=env(gain(),t,.005,.1,.28);
    set(P(g,'gain'),0,t);for(let s=.015;s<.27;s+=.015)ramp(P(g,'gain'),Math.random()<.45?.3*Math.random()+.05:0,t+s);ramp(P(g,'gain'),0,t+.29);
    link(ns,bp,g,o);link(z,zl,zg,o);return{src:[ns,z],dur:.3};},
   rail(t,o){const ns=noiseSrc(t,t+.03,1),bp=filter('bandpass',3000,.8),tg=env(gain(),t,.001,.5,.025),a=osc('sine',jit(1800,.05),t,t+.6),b=osc('sine',2710,t,t+.6),rg=env(gain(),t,.002,.08,.55),
    th=osc('sine',140,t,t+.2),thg=env(gain(),t,.002,.4,.18);expo(P(th,'frequency'),50,t+.18);
    link(ns,bp,tg,o);link(a,rg);link(b,rg);link(rg,o);link(th,thg,o);return{src:[ns,a,b,th],dur:.6};},
   beam(t,o){const f=jit(96,.04),a=osc('sawtooth',f,t,t+.58),b=osc('sawtooth',f*1.993,t,t+.58),c=osc('sine',f*6,t,t+.58),lp=filter('lowpass',850,.8),g=gain();
    set(P(g,'gain'),0,t);ramp(P(g,'gain'),.17,t+.06);ramp(P(g,'gain'),.14,t+.46);ramp(P(g,'gain'),0,t+.56);link(a,lp);link(b,lp);link(c,lp);link(lp,g,o);return{src:[a,b,c],dur:.58};}
  };

  function weapon(style,x,y,z,g=1){
   if(!unlocked)return false;
   style=R[style]?style:'laser';
   const pos=place(x,y,z);if(pos.d>20000){stats.dropped++;return false;}
   const big=style==='ion-fire',base=big?3:1,prio=base+closeness(pos.d)*.9;
   const v=voice(style,prio,pos,clamp(num(g,1),0,2)*(big?1:.8)*loudness(pos.d/.85),pos.cutoff,R[style]);
   if(!v)return false;
   if(style!=='ion-charge')return true;
   return {cancel(){if(!v.killed&&v.end>now())kill(v);},get active(){return !v.killed&&v.end>now();}};
  }

  // A boom: a short crack (near only), a brown-noise body that darkens as it fades, a sub drop.
  function explosion(tier,x,y,z){
   if(!unlocked)return false;
   tier=clamp(Math.round(num(tier,0)),0,3);
   const pos=place(x,y,z),d=pos.d,delay=Math.min(1.6,d/12000),cutoff=pos.cutoff*TIER.tone[tier],g=TIER.gain[tier]*loudness(d);
   const prio=(tier>=2?3:2)+closeness(d)*.9,dur=TIER.dur[tier];
   const v=voice('explosion'+tier,prio,pos,g,cutoff,(t0,o)=>{
    const t=t0+delay,src=[],near=clamp(cutoff/9000,0,1);
    if(near>.15){const c=noiseSrc(t,t+.08,1),cf=filter('bandpass',Math.min(cutoff,2600),.7),cg=env(gain(),t,.001,.35*near,.07);link(c,cf,cg,o);src.push(c);}
    const body=rumble(t,t+dur,.8+Math.random()*.4),lp=filter('lowpass',Math.min(cutoff,1400+tier*400),.6),bg=gain();
    set(P(bg,'gain'),0,t);ramp(P(bg,'gain'),1,t+.008+tier*.01);aim(P(bg,'gain'),0,t+.04+tier*.06,dur*.24);ramp(P(bg,'gain'),0,t+dur);
    if(lp)expo(lp.frequency,70,t+dur*.85);link(body,lp,bg,o);src.push(body);
    const f0=TIER.sub[tier]||90,s=osc('sine',f0*1.7,t,t+dur),sg=gain();set(P(sg,'gain'),0,t);ramp(P(sg,'gain'),tier?.55:.28,t+.012);aim(P(sg,'gain'),0,t+.06,dur*(tier?.22:.12));ramp(P(sg,'gain'),0,t+dur);
    expo(P(s,'frequency'),f0*.5,t+Math.min(dur*.6,.9));link(s,sg,o);src.push(s);
    if(tier>=2){// secondary detonations roll after the first
     for(const k of [.32,.7]){const tt=t+k*(.8+Math.random()*.4),n2=rumble(tt,tt+1.2,.7),l2=filter('lowpass',600,.7),g2=env(gain(),tt,.01,.45,1.1);link(n2,l2,g2,o);src.push(n2);}}
    if(tier===3){// end of an age: a slow, detuned glassy swell riding over the collapse
     for(const f of [311,317.5,466]){const s2=osc('sine',f,t+.4,t+dur),g2=gain();set(P(g2,'gain'),0,t+.4);ramp(P(g2,'gain'),.05,t+2.4);ramp(P(g2,'gain'),0,t+dur);expo(P(s2,'frequency'),f*.5,t+dur);link(s2,g2,o);src.push(s2);}
     const r=rumble(t+1,t+dur,.3),rl=filter('lowpass',160),rg=gain();set(P(rg,'gain'),0,t+1);ramp(P(rg,'gain'),.7,t+2.5);ramp(P(rg,'gain'),0,t+dur);link(r,rl,rg,o);src.push(r);}
    return{src,dur:delay+dur};
   },false);
   return v?{delay,cutoff,gain:g,tier,distance:d}:false;
  }

  // ---- the war far away: a rumble bed and distant thumps that follow the fighting ----
  const B={g:null};
  function bedInit(){
   if(!graph||B.g)return;const t=now(),n=rumble(t,null,.7),lp=filter('lowpass',240,.6),g=gain(0);
   link(n,lp,g,graph.sfxIn);Object.assign(B,{g,n});
  }
  function bedThump(t){
   const pan=mk('createStereoPanner'),o=gain(.05+Math.random()*.08),n=rumble(t,t+1.3,.8),lp=filter('lowpass',300+Math.random()*200,.6),g=env(gain(),t,.015,1,1.2),
    s=osc('sine',62,t,t+.9),sg=env(gain(),t,.01,.18,.8);
   if(pan)set(pan.pan,Math.random()*1.4-.7,t);expo(P(s,'frequency'),30,t+.7);link(n,lp,g,o);link(s,sg,o);link(o,pan,graph.sfxIn);
  }

  // ---- dedicated engine drone for the followed ship (outside the voice cap) ----
  function droneBuild(style,speed){
   const t=now(),out=gain(0),lp=filter('lowpass',600,.8),src=[],sp=clamp(num(speed,.5),0,1);
   if(!out)return null;link(lp,out,graph.sfxIn);
   const d={out,lp,src,style,oscs:[],noise:null,ng:null};
   const add=(type,f,g)=>{const o=osc(type,f,t),og=gain(g);link(o,og,lp);if(o){src.push(o);d.oscs.push({o,f});}};
   const nz=(g,type,f,q)=>{const n=rumble(t,null,1),bf=filter(type,f,q),ng=gain(g);link(n,bf,ng,lp);if(n)src.push(n);d.noise=bf;d.ng=ng;};
   if(style==='turbine'){add('triangle',80,.25);add('sine',160,.15);nz(.3,'bandpass',900,1.5);}
   else if(style==='organic'){add('triangle',52,.4);add('triangle',52.8,.35);nz(.25,'lowpass',400,1);const l=osc('sine',.35,t),lg=gain(220);link(l,lg,P(lp,'frequency'));if(l)src.push(l);}
   else if(style==='roar'){add('sawtooth',42,.2);nz(.8,'lowpass',320,.7);}
   else {d.style='hum';add('sine',58,.45);add('triangle',116.5,.15);add('sine',174,.08);}
   aim(out.gain,.1,t,.3);droneSpeed(d,sp);return d;
  }
  function droneSpeed(d,sp){
   const k=d.style==='turbine'?1+sp*1.2:d.style==='roar'?1+sp*.6:1+sp*.35;
   d.oscs.forEach(({o,f})=>glide(o.frequency,f*k,.3));
   if(d.lp)glide(d.lp.frequency,400+sp*(d.style==='turbine'?1800:1000),.3);
   if(d.noise&&d.style==='turbine')glide(d.noise.frequency,700+sp*1600,.3);
   if(d.ng)glide(d.ng.gain,(d.style==='roar'?.5:.18)+sp*.3,.3);
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
   const t=now(),g=gain(.8),o=[];link(g,graph.sfxIn);
   const tone=(type,f,f2,at,dur,peak)=>{const s=osc(type,f,t+at,t+at+dur+.02),e=env(gain(),t+at,.004,peak,dur);if(f2)expo(P(s,'frequency'),f2,t+at+dur);link(s,e,g);o.push(s);};
   if(kind==='open')tone('triangle',480,900,0,.12,.25);
   else if(kind==='close')tone('triangle',900,460,0,.12,.25);
   else if(kind==='confirm'){tone('sine',660,0,0,.09,.25);tone('sine',990,0,.08,.14,.22);}
   else if(kind==='tick')tone('sine',2400,0,0,.012,.08);
   else tone('sine',1400,1200,0,.025,.16);
   return true;
  }

  // ---- adaptive music: a warm string-like pad, a bass, a soft pluck and low drums ----
  const hz=s=>110*Math.pow(2,s/12);
  function musicInit(){
   if(M.ready||!graph)return;M.ready=true;
   const t=now(),padLP=filter('lowpass',520,.5),pad=gain(0),pulse=gain(0),tom=gain(0),bassG=gain(0);
   link(pad,padLP,graph.duck);link(pulse,filter('lowpass',1400,.5),graph.duck);link(tom,graph.duck);link(bassG,filter('lowpass',220,.5),graph.duck);
   Object.assign(M,{padLP,pad,pulse,tom,bassG,next:t+.1,step:0,chord:0});
   const lfo=osc('sine',.06,t),lg=gain(180);link(lfo,lg,P(padLP,'frequency'));
   // Each chord tone: two sawtooths detuned by ~7 cents under a low lowpass (strings, not organ).
   CHORDS[0].forEach((s,i)=>{const f=hz(s),a=osc('sawtooth',f*.996,t),b=osc('sawtooth',f*1.004,t),g=gain(i?.07:.09);link(a,g,pad);link(b,g);M.pads.push([a,b]);});
   M.bass=osc('triangle',hz(CHORDS[0][0]-12),t);link(M.bass,bassG);
   aim(P(pad,'gain'),.3,t,3);aim(P(bassG,'gain'),.12,t,3);
  }
  function setIntensity(v){M.target=clamp(num(v,0),0,1);if(!M.ready)return;const i=M.target,t=now();
   aim(P(M.pad,'gain'),.3+.12*i,t,2.5);aim(P(M.pulse,'gain'),Math.max(0,(i-.3)/.7)*.35,t,2.5);aim(P(M.tom,'gain'),Math.max(0,(i-.55)/.45)*.4,t,2.5);
   aim(P(M.padLP,'frequency'),420+i*700,t,2.5);aim(P(M.bassG,'gain'),.1+.06*i,t,2.5);
   if(B.g)aim(B.g.gain,.03+.13*i,t,1.5);}
  function musicStep(t){
   const s=M.step++,chord=CHORDS[M.chord];
   if(s%CHORD_STEPS===0&&s>0){M.chord=(M.chord+1)%CHORDS.length;const c=CHORDS[M.chord];
    c.forEach((st,i)=>{const p=M.pads[i];if(p){aim(P(p[0],'frequency'),hz(st)*.996,t,1.2);aim(P(p[1],'frequency'),hz(st)*1.004,t,1.2);}});
    aim(P(M.bass,'frequency'),hz(c[0]-12),t,.4);}
   const lv=M.level;
   if(lv>.3&&PULSE[s%8]){const f=hz(chord[(s>>3)%chord.length])*2,a=osc('triangle',f,t,t+.5),g=env(gain(),t,.008,.2,.45);link(a,g,M.pulse);}
   if(lv>.55&&TOM[s%8]){const a=osc('sine',s%8===0?88:74,t,t+.5),g=env(gain(),t,.004,.55,.45);expo(P(a,'frequency'),42,t+.35);link(a,g,M.tom);
    const n=rumble(t,t+.12,1),ng=env(gain(),t,.002,.25,.1);link(n,filter('lowpass',500),ng,M.tom);}
  }
  // A capital falls: a low brass swell over a timpani hit, not a buzz.
  function stinger(){
   if(!unlocked||!graph)return false;const c=clock();if(c-lastStinger<6)return false;lastStinger=c;
   const t=now(),lp=filter('lowpass',220,.8),g=gain(0),src=[];link(lp,g,graph.duck);
   for(const [s,det] of [[-24,1],[-12,.997],[-12,1.003],[-5,1],[0,.998],[3,1.002]]){const o=osc('sawtooth',hz(s)*det,t,t+3.2);link(o,lp);src.push(o);}
   if(lp){expo(lp.frequency,1100,t+1);expo(lp.frequency,300,t+3);}
   set(P(g,'gain'),0,t);ramp(P(g,'gain'),.13,t+.6);ramp(P(g,'gain'),.1,t+1.8);ramp(P(g,'gain'),0,t+3.1);
   const k=osc('sine',75,t,t+1.4),kg=env(gain(),t,.004,.5,1.3);expo(P(k,'frequency'),40,t+1);link(k,kg,graph.duck);
   return true;
  }
  function setSlowMo(on){slow=!!on;if(!graph)return;glide(graph.duck.gain,slow?.06:1,.25);glide(P(graph.sfxLP,'frequency'),slow?900:20000,.2);}

  function update(dt){
   if(!unlocked)return;const t=now();prune(t);
   const k=1-Math.exp(-Math.max(0,num(dt,0))/2);M.level+=(M.target-M.level)*k;
   // distant thumps: roughly one every 3 s in a lull, three a second at full tilt
   if(graph&&M.target>.05&&t>=M.thumpAt){if(M.thumpAt)bedThump(t+.02);M.thumpAt=t+(.3+Math.random()*.6)/Math.max(.1,M.level*1.2+.1);}
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
