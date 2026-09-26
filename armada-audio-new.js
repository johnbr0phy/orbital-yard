// Procedural Web Audio engine for the tribute battle. Every sound is synthesized from oscillators,
// one shared white-noise buffer, filters and envelopes: no samples and no borrowed themes.
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
 const PULSE=[1,0,0,1,0,0,1,0];
 const storage=()=>{try{return typeof localStorage!=='undefined'&&localStorage?localStorage:null;}catch(e){return null;}};
 const P=(n,k)=>n?n[k]:null;// a param of a node that may not exist
 const jit=(v,s)=>v*(1+(Math.random()*2-1)*s);// small random variation so repeats never sound identical

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
  function noiseSrc(t,end,rate=1,buf=noise){
   if(!buf)return null;const s=mk('createBufferSource');if(!s)return null;
   try{s.buffer=buf;s.loop=true;}catch(e){}set(s.playbackRate,rate,t);
   try{s.start(t,Math.random()*1.2);}catch(e){try{s.start(t);}catch(_){}}if(end!=null)stop(s,end);return s;
  }
  // attack then exponential-style decay; starts and ends at zero (no clicks)
  function env(g,t,a,peak,dur){if(!g)return g;const p=g.gain;set(p,0,t);ramp(p,peak,t+a);aim(p,0,t+a,Math.max(.005,(dur-a)/5));ramp(p,0,t+dur);return g;}

  function buildGraph(){
   if(graph)return;
   const master=gain(vol.master),comp=mk('createDynamicsCompressor'),music=gain(vol.music),sfx=gain(vol.sfx),sfxLP=filter('lowpass',20000),duck=gain(1);
   const musicTrim=gain(.7),verb=mk('createConvolver'),verbIn=filter('highpass',180,.5),verbOut=gain(.9),sfxSend=gain(.16),musicSend=gain(.55),clip=mk('createWaveShaper');
   if(comp){const t=now();set(comp.threshold,-16,t);set(comp.knee,12,t);set(comp.ratio,3,t);set(comp.attack,.012,t);set(comp.release,.3,t);}
   // Soft clipper after the compressor: transients round off instead of splattering.
   if(clip)try{const n=1024,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(x*1.4)/Math.tanh(1.4);}clip.curve=c;}catch(e){}
   const hp=filter('highpass',60,.6);// nothing useful lives below 60 Hz on the speakers people use
   const makeup=gain(1.8);// the noise-built mix is leaner than the old sub-heavy one
   link(master,hp,makeup,comp,clip,ctx.destination);
   link(duck,musicTrim,music,master);link(sfxLP,sfx,master);
   if(verb){link(sfx,sfxSend,verbIn);link(music,musicSend,verbIn);link(verbIn,verb,verbOut,master);}
   graph={master,comp,music,sfx,sfxLP,duck,sfxIn:sfxLP||sfx,verb};
   const sr=num(ctx.sampleRate,44100);
   try{const n=Math.floor(sr*1.5);noise=ctx.createBuffer(1,n,sr);const d=noise.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}catch(e){noise=null;}
   // A generated hall: two decorrelated channels of decaying, darkening noise.
   if(verb)try{const len=Math.floor(sr*2.6),ir=ctx.createBuffer(2,len,sr);
    for(let c=0;c<2;c++){const d=ir.getChannelData(c);let lp=0;for(let i=0;i<len;i++){const t=i/sr,k=.35+.6*Math.min(1,t/1.8);lp+=(Math.random()*2-1-lp)*(1-k);d[i]=lp*Math.exp(-t*2.6)*(t<.012?t/.012:1);}}
    verb.buffer=ir;}catch(e){}
  }

  function unlock(){
   if(!ctx){const C=root&&(root.AudioContext||root.webkitAudioContext);if(!C)return false;try{ctx=new C();}catch(e){return false;}}
   try{const r=ctx.resume&&ctx.resume();if(r&&r.catch)r.catch(()=>{});}catch(e){}
   if(!unlocked){buildGraph();unlocked=true;musicInit();startBeds();}
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
  // Rule: nothing tonal below ~150 Hz and no falling low tones. A low sine sliding down
  // over noise reads as a raspberry, not a gun. Weight comes from noise, not from pitch.
  const R={
   laser(t,o){const f=jit(1700,.1),a=osc('sine',f,t,t+.14),b=osc('sine',f*1.5,t,t+.14),g=env(gain(),t,.002,.24,.12),g2=env(gain(),t,.002,.07,.08);
    expo(P(a,'frequency'),f*.36,t+.11);expo(P(b,'frequency'),f*.5,t+.1);link(a,g,o);link(b,g2,o);return{src:[a,b],dur:.14};},
   phaser(t,o){const f=jit(620,.05),a=osc('sine',f,t,t+.46),b=osc('sine',f*1.01,t,t+.46),c=osc('triangle',f*2,t,t+.46),vib=osc('sine',7,t,t+.46),vg=gain(f*.012),g=gain(),lp=filter('lowpass',3200,.5);
    link(vib,vg,P(a,'frequency'));set(P(g,'gain'),0,t);ramp(P(g,'gain'),.13,t+.05);ramp(P(g,'gain'),.1,t+.34);ramp(P(g,'gain'),0,t+.44);
    const cg=gain(.25);link(a,g);link(b,g);link(c,cg,g);link(g,lp,o);return{src:[a,b,c,vib],dur:.46};},
   pulse(t,o){const z=osc('triangle',jit(900,.08),t,t+.16),zg=env(gain(),t,.002,.22,.14),ns=noiseSrc(t,t+.04,1),hp=filter('highpass',1500,.7),ng=env(gain(),t,.001,.25,.03);
    expo(P(z,'frequency'),420,t+.13);link(z,zg,o);link(ns,hp,ng,o);return{src:[z,ns],dur:.16};},
   // autocannon: a few dry ticks
   kinetic(t,o){const n=2+Math.floor(Math.random()*3),src=[],bp=filter('bandpass',jit(2200,.15),1);link(bp,o);
    for(let i=0;i<n;i++){const s=t+i*(.055+Math.random()*.02),ns=noiseSrc(s,s+.025,1),g=env(gain(),s,.001,.6,.02);link(ns,g,bp);src.push(ns);}
    return{src,dur:n*.075+.03};},
   plasma(t,o){const ns=noiseSrc(t,t+.34,1),bp=filter('bandpass',1400,2),ng=env(gain(),t,.01,.5,.32),a=osc('triangle',jit(560,.08),t,t+.3),ag=env(gain(),t,.01,.12,.26);
    if(bp)expo(bp.frequency,650,t+.3);expo(P(a,'frequency'),360,t+.26);link(ns,bp,ng,o);link(a,ag,o);return{src:[ns,a],dur:.34};},
   organic(t,o){const ns=noiseSrc(t,t+.32,1),bp=filter('bandpass',900,4),g=env(gain(),t,.02,.7,.3);
    if(bp){expo(bp.frequency,2400,t+.1);expo(bp.frequency,1200,t+.3);}link(ns,bp,g,o);return{src:[ns],dur:.32};},
   // a gathering hum that rises: never below 220 Hz
   'ion-charge'(t,o){const a=osc('triangle',220,t,t+4.6),b=osc('sine',440,t,t+4.6),lp=filter('lowpass',600,1),g=gain(),trem=osc('sine',5,t,t+4.6),tg=gain(.25);
    expo(P(a,'frequency'),660,t+4.4);expo(P(b,'frequency'),1320,t+4.4);if(lp)expo(lp.frequency,3000,t+4.4);expo(P(trem,'frequency'),16,t+4.4);
    set(P(g,'gain'),0,t);ramp(P(g,'gain'),.04,t+.6);ramp(P(g,'gain'),.14,t+4.2);ramp(P(g,'gain'),0,t+4.55);
    const vca=gain(.75);link(trem,tg,P(vca,'gain'));link(a,lp);link(b,lp);link(lp,vca,g,o);return{src:[a,b,trem],dur:4.6};},
   // discharge: a crack, then a long noise wash that darkens
   'ion-fire'(t,o){const c=noiseSrc(t,t+.08,1),cg=env(gain(),t,.001,.6,.06),body=noiseSrc(t,t+1.6,1),lp=filter('lowpass',7000,.5),bg=env(gain(),t,.004,.7,1.5),
    ring=osc('sine',1250,t,t+.9),rg=env(gain(),t,.003,.06,.8);
    if(lp)expo(lp.frequency,300,t+1.4);link(c,cg,o);link(body,lp,bg,o);link(ring,rg,o);return{src:[c,body,ring],dur:1.6};},
   arc(t,o){const ns=noiseSrc(t,t+.3,1),bp=filter('bandpass',2400,.9),g=gain();
    set(P(g,'gain'),0,t);for(let s=.015;s<.27;s+=.015)ramp(P(g,'gain'),Math.random()<.45?.3*Math.random()+.05:0,t+s);ramp(P(g,'gain'),0,t+.29);
    link(ns,bp,g,o);return{src:[ns],dur:.3};},
   rail(t,o){const ns=noiseSrc(t,t+.03,1),hp=filter('highpass',1200,.7),tg=env(gain(),t,.001,.6,.025),a=osc('sine',jit(1800,.05),t,t+.6),b=osc('sine',2710,t,t+.6),rg=env(gain(),t,.002,.08,.55);
    link(ns,hp,tg,o);link(a,rg);link(b,rg);link(rg,o);return{src:[ns,a,b],dur:.6};},
   beam(t,o){const f=jit(440,.04),a=osc('sine',f,t,t+.56),b=osc('sine',f*1.5,t,t+.56),c=osc('triangle',f*2,t,t+.56),trem=osc('sine',11,t,t+.56),tg=gain(.3),vca=gain(.7),g=gain(),lp=filter('lowpass',2600,.5);
    link(trem,tg,P(vca,'gain'));set(P(g,'gain'),0,t);ramp(P(g,'gain'),.11,t+.06);ramp(P(g,'gain'),.09,t+.44);ramp(P(g,'gain'),0,t+.54);
    const cg=gain(.3);link(a,vca);link(b,vca);link(c,cg,vca);link(vca,g,lp,o);return{src:[a,b,c,trem],dur:.56};}
  };

  // ---- recorded samples (optional) ----
  // audio/manifest.json maps roles (weapon styles, explosion0-3, stinger, music, ambience) to
  // one or more files; a role with recordings plays them, anything else uses the synth above.
  const SMP={},pick=a=>a[Math.floor(Math.random()*a.length)];
  const B={music:null,musicG:null,amb:null,ambG:null};
  function useSamples(map){
   for(const k in map||{}){const a=[].concat(map[k]).filter(Boolean);if(a.length)SMP[k]=a;}
   if(unlocked)startBeds();return Object.keys(SMP);
  }
  async function loadSamples(url){
   if(!ctx||typeof fetch!=='function'||typeof ctx.decodeAudioData!=='function')return[];
   try{
    const r=await fetch(url);if(!r.ok)return[];
    const man=await r.json(),base=url.replace(/[^/]*$/,''),out={},cache={};
    const load=f=>cache[f]||(cache[f]=fetch(base+f).then(x=>x.arrayBuffer()).then(b=>ctx.decodeAudioData(b)).catch(()=>null));
    await Promise.all(Object.entries(man.roles||{}).map(async([role,files])=>{out[role]=(await Promise.all([].concat(files).map(load))).filter(Boolean);}));
    return useSamples(out);
   }catch(e){return[];}
  }
  function sample(role,t,o,rate=1,g=1,loop=false){
   const b=SMP[role]&&pick(SMP[role]),s=b&&mk('createBufferSource');if(!s)return null;
   try{s.buffer=b;s.loop=loop;}catch(e){}set(s.playbackRate,rate,t);const sg=gain(g);link(s,sg,o);
   try{s.start(t);}catch(e){}return{src:s,dur:num(b.duration,1)/rate,g:sg};
  }
  // Music and ambience loops replace the synth pad and live under the intensity control.
  function startBeds(){
   if(!graph)return;const t=now();
   if(SMP.music&&!B.music){const r=sample('music',t+.05,graph.duck,1,0,true);if(r){B.music=r.src;B.musicG=r.g;aim(P(r.g,'gain'),.5,t,2);M.sampled=true;if(M.pad)aim(P(M.pad,'gain'),0,t,.5);}}
   if(SMP.ambience&&!B.amb){const r=sample('ambience',t+.05,graph.sfxIn,1,0,true);if(r){B.amb=r.src;B.ambG=r.g;aim(P(r.g,'gain'),.05,t,2);}}
  }
  // Big hits push the score down for a moment, the way a film mix makes room for them.
  function duckFor(t,depth,hold){if(!graph||slow)return;const p=graph.duck.gain;call(p,'cancelScheduledValues',t);aim(p,depth,t,.03);aim(p,1,t+hold,.6);}

  function weapon(style,x,y,z,g=1){
   if(!unlocked)return false;
   style=R[style]?style:'laser';
   const pos=place(x,y,z);if(pos.d>20000){stats.dropped++;return false;}
   const big=style==='ion-fire',base=big?3:1,prio=base+closeness(pos.d)*.9;
   const build=SMP[style]?(t,o)=>{const r=sample(style,t,o,jit(1,.06),jit(1,.12));return r?{src:[r.src],dur:r.dur}:R[style](t,o);}:R[style];
   const v=voice(style,prio,pos,clamp(num(g,1),0,2)*(big?1:.8)*loudness(pos.d/.85),pos.cutoff,build);
   if(!v)return false;
   if(style!=='ion-charge')return true;
   return {cancel(){if(!v.killed&&v.end>now())kill(v);},get active(){return !v.killed&&v.end>now();}};
  }

  // An explosion is shaped noise: a crack (near only), then a body whose lowpass closes as it
  // fades ("kssshh"), and rolling secondary bursts for big hulls. No pitched sub drop.
  function explosion(tier,x,y,z){
   if(!unlocked)return false;
   tier=clamp(Math.round(num(tier,0)),0,3);
   const pos=place(x,y,z),d=pos.d,delay=Math.min(1.6,d/12000),cutoff=pos.cutoff*TIER.tone[tier],g=TIER.gain[tier]*loudness(d);
   const prio=(tier>=2?3:2)+closeness(d)*.9,dur=TIER.dur[tier];
   const rec=SMP['explosion'+tier];
   const v=voice('explosion'+tier,prio,pos,g,cutoff,rec?(t0,o)=>{
    const t=t0+delay,r=sample('explosion'+tier,t,o,jit(tier>=2?.94:1,.05),1),src=r?[r.src]:[];
    if(tier>=2&&SMP.explosion1)for(const k of [.35,.8]){const r2=sample('explosion1',t+k*(.8+Math.random()*.4),o,jit(.9,.08),.45);if(r2)src.push(r2.src);}
    if(tier>=2)duckFor(t,.35,1.2);
    return{src,dur:delay+(r?r.dur:1)+(tier>=2?1.2:0)};
   }:(t0,o)=>{
    const t=t0+delay,src=[],near=clamp(cutoff/9000,0,1);
    if(near>.15){const c=noiseSrc(t,t+.07,1),hp=filter('highpass',700,.6),cg=env(gain(),t,.001,.45*near,.05);link(c,hp,cg,o);src.push(c);}
    const body=noiseSrc(t,t+dur,1),lp=filter('lowpass',Math.min(cutoff,4500+tier*800),.5),bg=gain();
    set(P(bg,'gain'),0,t);ramp(P(bg,'gain'),.9,t+.004+tier*.006);aim(P(bg,'gain'),0,t+.03+tier*.05,dur*.22);ramp(P(bg,'gain'),0,t+dur);
    if(lp)expo(lp.frequency,Math.max(180,cutoff*.03),t+dur*.8);link(body,lp,bg,o);src.push(body);
    if(tier>=1){// weight without pitch: the low band of the same noise, briefly
     const w=noiseSrc(t,t+dur*.6,1),wl=filter('lowpass',160,.5),wg=env(gain(),t,.006,.9+tier*.2,dur*.5);link(w,wl,wg,o);src.push(w);}
    if(tier>=2){// secondary detonations roll after the first
     for(const k of [.3,.65,1.1]){const tt=t+k*(.8+Math.random()*.4),n2=noiseSrc(tt,tt+1,1),l2=filter('lowpass',2400,.5),g2=env(gain(),tt,.004,.4,.9);if(l2)expo(l2.frequency,250,tt+.8);link(n2,l2,g2,o);src.push(n2);}}
    if(tier===3){// end of an age: a slow, detuned glassy swell riding over the collapse
     for(const f of [311,317.5,466]){const s2=osc('sine',f,t+.4,t+dur),g2=gain();set(P(g2,'gain'),0,t+.4);ramp(P(g2,'gain'),.05,t+2.4);ramp(P(g2,'gain'),0,t+dur);link(s2,g2,o);src.push(s2);}
     const r=noiseSrc(t+1,t+dur,1),rl=filter('lowpass',700,.5),rg=gain();set(P(rg,'gain'),0,t+1);ramp(P(rg,'gain'),.35,t+2.5);ramp(P(rg,'gain'),0,t+dur);link(r,rl,rg,o);src.push(r);}
    return{src,dur:delay+dur};
   },false);
   return v?{delay,cutoff,gain:g,tier,distance:d}:false;
  }

  // ---- dedicated engine drone for the followed ship (outside the voice cap) ----
  // A quiet mid-register hum under filtered air; no sub-bass buzz.
  function droneBuild(style,speed){
   const t=now(),out=gain(0),lp=filter('lowpass',900,.5),src=[],sp=clamp(num(speed,.5),0,1);
   if(!out)return null;link(lp,out,graph.sfxIn);
   const d={out,lp,src,style,oscs:[],noise:null,ng:null};
   const add=(type,f,g)=>{const o=osc(type,f,t),og=gain(g);link(o,og,lp);if(o){src.push(o);d.oscs.push({o,f});}};
   const nz=(g,type,f,q)=>{const n=noiseSrc(t,null,1),bf=filter(type,f,q),ng=gain(g);link(n,bf,ng,lp);if(n)src.push(n);d.noise=bf;d.ng=ng;};
   if(style==='turbine'){add('sine',220,.2);add('sine',330,.08);nz(.12,'bandpass',1200,1.2);}
   else if(style==='organic'){add('triangle',180,.2);add('triangle',181.5,.18);nz(.1,'bandpass',700,1.5);}
   else if(style==='roar'){add('triangle',160,.15);nz(.2,'bandpass',600,.8);}
   else {d.style='hum';add('sine',174,.2);add('sine',261,.08);}
   aim(out.gain,.06,t,.3);droneSpeed(d,sp);return d;
  }
  function droneSpeed(d,sp){
   const k=d.style==='turbine'?1+sp*.6:d.style==='roar'?1+sp*.4:1+sp*.25;
   d.oscs.forEach(({o,f})=>glide(o.frequency,f*k,.3));
   if(d.lp)glide(d.lp.frequency,700+sp*(d.style==='turbine'?1800:900),.3);
   if(d.noise&&d.style==='turbine')glide(d.noise.frequency,1000+sp*1600,.3);
   if(d.ng)glide(d.ng.gain,(d.style==='roar'?.2:.1)+sp*.12,.3);
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

  // ---- adaptive music: a warm string-like pad and a soft pluck that joins as the fight grows ----
  const hz=s=>220*Math.pow(2,s/12);// pad sits from A3 up; nothing droning in the bass
  function musicInit(){
   if(M.ready||!graph)return;M.ready=true;
   const t=now(),padLP=filter('lowpass',900,.5),pad=gain(0),pulse=gain(0);
   link(pad,padLP,graph.duck);link(pulse,filter('lowpass',2400,.5),graph.duck);
   Object.assign(M,{padLP,pad,pulse,next:t+.1,step:0,chord:0});
   const lfo=osc('sine',.06,t),lg=gain(250);link(lfo,lg,P(padLP,'frequency'));
   // Each chord tone: two sawtooths detuned by ~7 cents under a lowpass (strings, not organ).
   CHORDS[0].forEach((s,i)=>{const f=hz(s),a=osc('sawtooth',f*.996,t),b=osc('sawtooth',f*1.004,t),g=gain(.05);link(a,g,pad);link(b,g);M.pads.push([a,b]);});
   aim(P(pad,'gain'),.3,t,3);
  }
  function setIntensity(v){M.target=clamp(num(v,0),0,1);if(!M.ready)return;const i=M.target,t=now();
   if(B.musicG)aim(P(B.musicG,'gain'),.4+.25*i,t,2.5);if(B.ambG)aim(P(B.ambG,'gain'),.04+.3*i,t,2);
   if(M.sampled)return;
   aim(P(M.pad,'gain'),.28+.1*i,t,2.5);aim(P(M.pulse,'gain'),Math.max(0,(i-.3)/.7)*.3,t,2.5);aim(P(M.padLP,'frequency'),800+i*900,t,2.5);}
  function musicStep(t){
   const s=M.step++,chord=CHORDS[M.chord];
   if(s%CHORD_STEPS===0&&s>0){M.chord=(M.chord+1)%CHORDS.length;const c=CHORDS[M.chord];
    c.forEach((st,i)=>{const p=M.pads[i];if(p){aim(P(p[0],'frequency'),hz(st)*.996,t,1.2);aim(P(p[1],'frequency'),hz(st)*1.004,t,1.2);}});}
   if(M.level>.3&&PULSE[s%8]){const f=hz(chord[(s>>3)%chord.length])*2,a=osc('triangle',f,t,t+.5),g=env(gain(),t,.006,.18,.45);link(a,g,M.pulse);}
  }
  // A capital falls: a brass-like swell (filtered sawtooths opening and closing), no drum drop.
  function stinger(){
   if(!unlocked||!graph)return false;const c=clock();if(c-lastStinger<6)return false;lastStinger=c;
   if(SMP.stinger){sample('stinger',now(),graph.duck,1,.8);return true;}
   const t=now(),lp=filter('lowpass',400,.7),g=gain(0);link(lp,g,graph.duck);
   for(const [s,det] of [[0,.998],[0,1.002],[7,1],[12,.997],[15,1.003],[19,1]]){const o=osc('sawtooth',hz(s)*det,t,t+3.2);link(o,lp);}
   if(lp){expo(lp.frequency,2200,t+.9);expo(lp.frequency,600,t+3);}
   set(P(g,'gain'),0,t);ramp(P(g,'gain'),.09,t+.5);ramp(P(g,'gain'),.07,t+1.8);ramp(P(g,'gain'),0,t+3.1);
   return true;
  }
  function setSlowMo(on){slow=!!on;if(!graph)return;glide(graph.duck.gain,slow?.06:1,.25);glide(P(graph.sfxLP,'frequency'),slow?900:20000,.2);}

  function update(dt){
   if(!unlocked)return;const t=now();prune(t);
   const k=1-Math.exp(-Math.max(0,num(dt,0))/2);M.level+=(M.target-M.level)*k;
   if(!M.ready||M.sampled)return;if(M.next<t)M.next=t+.05;
   for(let n=0;M.next<t+AHEAD&&n<8;n++){musicStep(M.next);M.next+=STEP;}
  }

  const api={
   unlock,setVolume,setListener,weapon,explosion,loadSamples,useSamples,engine:engineDrone,ui,setIntensity,setSlowMo,stinger,update,
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
