// Web Audio engine for the tribute battle: an object-based spatial mix.
//
// Sound sources, not sound events. Every ship near the camera is an emitter with an engine
// voice; every shot, beam, hit, whizz-by and damaged hull is a short-lived emitter. The page
// hands the engine its emitters every frame; the engine keeps them all as a virtual list and
// gives real voices only to the most audible ones, per budget (engines, weapons, impacts),
// crossfading 150-300 ms whenever a voice changes hands. Voices sit in 3D: PannerNodes (HRTF
// for the nearest few, equal-power for the rest) under a listener that is the camera, with
// custom distance rolloff from each source's hearing radius, a lowpass for air absorption, a
// cone behind every engine's nozzles and Doppler from the real radial velocity.
//
// One-shots (explosions, arrivals, the stinger, ion fire) are admitted to a separate pool by
// priority, as before. Recordings come from audio/manifest.json (streamed by need); anything
// without a recording falls back to the synth below, which is also all you hear from file://.
//
// Mix: buses (music, weapons, engines, impacts, explosions, ambience, ui) with ducking, a
// generated hall and a darker, longer hall for far sources, a gentle compressor and a
// lookahead true-peak limiter (an AudioWorklet; a soft clipper where worklets are missing).
(function(root){
 'use strict';
 const KEY='tributeAudio',KEY_MIX='tributeAudioMix',DEFAULTS={master:.8,music:.5,sfx:.8},MIX_DEFAULTS={engines:.8};
 const clamp=(v,a,b)=>v<a?a:v>b?b:v,num=(v,d)=>Number.isFinite(+v)?+v:d;
 const WEAPONS=['laser','phaser','pulse','kinetic','plasma','organic','ion-charge','ion-fire','arc','rail','beam'];
 const TIER={dur:[.9,2.2,4,7.5],gain:[.42,.7,1,1.2],sub:[0,64,46,34],tone:[1,.8,.65,.5]};
 // Original moody progression (semitones above A): i, bVI, iv, v-ish voicings, glided rather than struck.
 const CHORDS=[[0,7,15],[-4,3,12],[5,12,20],[-5,2,10],[0,7,15],[-2,5,10],[-4,3,12],[-5,2,14]];
 const TEMPO=76,STEP=60/TEMPO/2,CHORD_STEPS=32,AHEAD=.3;
 const PULSE=[1,0,0,1,0,0,1,0];
 // Voice budgets per quality tier (Medium sits between the two the brief names).
 // `rumble` is the share of the engine voices kept for capital hulls and nozzles, so a sky full of
 // destroyers can never starve a fighter screaming past (it counts inside `engines`).
 const BUDGETS={Low:{engines:4,rumble:1,weapons:8,impacts:6,hrtf:2},Medium:{engines:6,rumble:2,weapons:12,impacts:9,hrtf:4},High:{engines:8,rumble:3,weapons:16,impacts:12,hrtf:6},Ultra:{engines:8,rumble:3,weapons:16,impacts:12,hrtf:6}};
 const XFADE_IN=.15,XFADE_OUT=.25;       // handoffs: a voice fades in over 150 ms and out over 250 ms
 const HYSTERESIS=1.41;                  // a voiced emitter keeps its voice until a rival is 3 dB more audible
 // Doppler: a virtual speed of sound of 1,200 units/s. Fighters fly at 130-250 units/s, so a pass
 // drops 4 to 6 semitones across the closest approach (drama: a real jet at that Mach number is subtler).
 // Clamped to 0.78-1.25 so a camera cut or a bolt at 2,000 units/s never chipmunks. (900 units/s and
 // 0.72-1.32 measured a 9.5-semitone drop on a 207 units/s pass: too much.)
 const SOUND_SPEED=1200,DOP_LO=.78,DOP_HI=1.25;
 const storage=()=>{try{return typeof localStorage!=='undefined'&&localStorage?localStorage:null;}catch(e){return null;}};
 const P=(n,k)=>n?n[k]:null;// a param of a node that may not exist
 const jit=(v,s)=>v*(1+(Math.random()*2-1)*s);// small random variation so repeats never sound identical (never the sim's dice)
 const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a),0,1);return u*u*(3-2*u);};

 // Doppler factor for a source at relative position r (source minus listener) with relative
 // velocity v (source minus listener): f'/f = c/(c + v_r), v_r > 0 receding. Pure, exported for tests.
 function doppler(rx,ry,rz,vx,vy,vz,c=SOUND_SPEED){
  const d=Math.hypot(rx,ry,rz);if(!(d>1e-6))return 1;
  const vr=(rx*vx+ry*vy+rz*vz)/d;return clamp(c/Math.max(1e-6,c+vr),DOP_LO,DOP_HI);
 }
 // The virtual microphone for wide shots: when the camera is far from the subject it frames,
 // the ear moves part of the way to the subject so a wide shot still hears its moment, while
 // the rest of the war recedes into the bed. Below 1,200 units the ear is the camera; from
 // 1,200 to 6,000 it slides smoothly up to 80% of the way. Orientation stays the camera's.
 function micBlend(cx,cy,cz,sx,sy,sz){
  if(sx==null||!Number.isFinite(+sx))return {x:cx,y:cy,z:cz,k:0};
  const d=Math.hypot(sx-cx,sy-cy,sz-cz),k=.8*smooth(1200,6000,d);
  return {x:cx+(sx-cx)*k,y:cy+(sy-cy)*k,z:cz+(sz-cz)*k,k};
 }
 // Distance gain inside a hearing radius R: full within R/10, then inverse-distance-like under a
 // smooth window that reaches exactly zero at R. u is the normalized distance.
 function distGain(d,R){
  const ref=R*.1,u=clamp((d-ref)/Math.max(1e-6,R-ref),0,1),w=1-u*u;
  return {u,g:d<R?w*w/(1+2*u):0};
 }
 // Emitters: inverse distance from a reference distance set by the source's size (an engine is at
 // full level within about one and a half ship lengths), under a window that reaches exactly zero at
 // the hearing radius R. A fighter at 30 units is ~20 dB above the same fighter at 300; that step is
 // what makes a pass rise and fall and lets near things stand in front of far ones.
 function emitGain(d,R,ref){
  const u=clamp(d/Math.max(1e-6,R),0,1),w=1-u*u;
  return {u,g:d<R?w*w*Math.min(1,ref/Math.max(1e-6,d)):0};
 }
 // The lookahead true-peak limiter, as an AudioWorklet (loaded from a Blob, so no extra file).
 // Peaks are detected on the samples and on three Catmull-Rom points between each pair (4x),
 // the required gain takes a running minimum over the 3 ms lookahead and is box-smoothed over
 // the same span, which guarantees the delayed sample is scaled below the ceiling. Release 150 ms.
 const LIMITER_SRC=`class TributeLimiter extends AudioWorkletProcessor{
  constructor(o){super();const p=(o&&o.processorOptions)||{};this.ceil=p.ceil||.84;this.L=Math.max(8,Math.round(sampleRate*(p.look||.003)));
   this.rel=1-Math.exp(-1/(sampleRate*(p.release||.15)));this.buf=[new Float32Array(this.L+4),new Float32Array(this.L+4)];this.w=0;
   this.req=new Float32Array(this.L+1);this.dq=new Int32Array(this.L+2);this.dh=0;this.dt=0;this.n=0;this.box=new Float32Array(this.L);this.bsum=this.L;this.bi=0;this.box.fill(1);
   this.h=1;this.hist=[new Float32Array(4),new Float32Array(4)];this.gr=1;this.port.onmessage=()=>{};}
  process(ins,outs){const i=ins[0],o=outs[0];if(!o||!o.length)return true;const N=o[0].length,ch=Math.min(2,o.length),L=this.L,c=this.ceil;
   for(let k=0;k<N;k++){let pk=0;
    for(let q=0;q<ch;q++){const x=i&&i[q]?i[q][k]:(i&&i[0]?i[0][k]:0),h=this.hist[q];h[0]=h[1];h[1]=h[2];h[2]=h[3];h[3]=x;
     const a=Math.abs(h[2]);if(a>pk)pk=a;const p0=h[0],p1=h[1],p2=h[2],p3=h[3];
     for(let s=1;s<4;s++){const t=s/4,v=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t);const av=Math.abs(v);if(av>pk)pk=av;}}
    const g=pk>c?c/pk:1,idx=this.n;this.req[idx%(L+1)]=g;
    while(this.dt>this.dh&&this.req[this.dq[(this.dt-1)%(L+2)]%(L+1)]>=g)this.dt--;this.dq[this.dt%(L+2)]=idx;this.dt++;
    while(this.dq[this.dh%(L+2)]<=idx-L-1)this.dh++;
    let m=this.req[this.dq[this.dh%(L+2)]%(L+1)];
    this.h=Math.min(m,this.h+(1-this.h)*this.rel);
    this.bsum+=this.h-this.box[this.bi];this.box[this.bi]=this.h;this.bi=(this.bi+1)%L;const gg=Math.min(1,this.bsum/L);
    if(gg<this.gr)this.gr=gg;
    for(let q=0;q<o.length;q++){const b=this.buf[q%2],src=i&&(i[q]||i[0]),x=src?src[k]:0,dly=b[this.w%(L+4)];b[(this.w+L)%(L+4)]=x;o[q][k]=dly*gg;}
    this.w++;this.n++;}
   return true;}}
 registerProcessor('tribute-limiter',TributeLimiter);`;

 function create(options){
  const opt=options||{},maxVoices=Math.max(1,Math.floor(num(opt.maxVoices,24)));
  let ctx=opt.context||null,unlocked=false,graph=null,noise=null,slow=false,lastStinger=-1e9;
  const vol={...DEFAULTS},mixVol={...MIX_DEFAULTS},voices=[],recent={},stats={dropped:0,culled:0,played:0,peak:0,handoffs:0,modelSwaps:0,whizz:0,hits:0,shields:0,arrivals:0,beams:0,dips:0};
  const L={x:0,y:0,z:0,fx:0,fy:0,fz:-1,ux:0,uy:1,uz:0,vx:0,vy:0,vz:0,px:null,py:0,pz:0};
  const M={ready:false,next:0,step:0,chord:0,level:0,target:0,pads:[]};
  let budget=opt.budgets||BUDGETS[opt.quality]||BUDGETS.High,drone=null;
  const perf={hrtf:opt.hrtf!==false,farHall:opt.farHall!==false,limiter:opt.limiter!==false};// switches for measuring render cost
  // Headphones (HRTF for the nearest few) or speakers (equal-power everywhere: HRTF narrows the image on speakers).
  try{const s=storage(),v=s&&s.getItem(KEY+'Hrtf');if(v==='0')perf.hrtf=false;}catch(e){}
  try{const s=storage(),saved=s&&JSON.parse(s.getItem(KEY)||'null');if(saved)for(const k in DEFAULTS)if(Number.isFinite(saved[k]))vol[k]=clamp(saved[k],0,1);}catch(e){}
  try{const s=storage(),saved=s&&JSON.parse(s.getItem(KEY_MIX)||'null');if(saved)for(const k in MIX_DEFAULTS)if(Number.isFinite(saved[k]))mixVol[k]=clamp(saved[k],0,1);}catch(e){}

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
  // A generated hall: decorrelated channels of decaying, darkening noise. `dark` darkens faster.
  function hall(seconds,decay,dark){
   const sr=num(ctx.sampleRate,44100),len=Math.floor(sr*seconds),ir=mk('createBuffer',2,len,sr);if(!ir||!ir.getChannelData)return null;
   for(let c=0;c<2;c++){const d=ir.getChannelData(c);let lp=0;for(let i=0;i<len;i++){const t=i/sr,k=Math.min(.97,(dark?.55:.35)+.6*Math.min(1,t/1.8));lp+=(Math.random()*2-1-lp)*(1-k);d[i]=lp*Math.exp(-t*decay)*(t<.012?t/.012:1);}}
   return ir;
  }

  function buildGraph(){
   if(graph)return;
   const t=now(),master=gain(vol.master),comp=mk('createDynamicsCompressor'),pre=gain(1),hp=filter('highpass',28,.6);
   if(comp){set(comp.threshold,-20,t);set(comp.knee,10,t);set(comp.ratio,2.5,t);set(comp.attack,.015,t);set(comp.release,.25,t);}
   const makeup=gain(1.25),out=gain(1),clip=mk('createWaveShaper');
   // Soft clipper: the fallback limiter where AudioWorklet is missing (file://, old browsers).
   if(clip)try{const n=2048,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(x*1.2)/Math.tanh(1.2)*.89;}clip.curve=c;clip.oversample='4x';}catch(e){}
   link(pre,hp,master,comp,makeup,out);link(out,clip,ctx.destination);
   // buses
   const B={};for(const k of ['music','weapons','engines','impacts','explosions','ambience','ui'])B[k]=gain(1);
   const D={};for(const k of ['music','weapons','engines','impacts','ambience','explosions'])D[k]=gain(1);// duck stages
   const music=gain(vol.music),musicTrim=gain(.7),sfxVol=gain(vol.sfx),engVol=gain(mixVol.engines);
   const outsideLP=filter('lowpass',20000,.5),outsideG=gain(1),sfxLP=filter('lowpass',20000),insideSfx=gain(vol.sfx),insideEng=gain(mixVol.engines),inside=gain(0);
   // focus stages: a fighter screaming past pulls the score, the bed and capital rumble back (allocate())
   const F={music:gain(1),ambience:gain(1)};B.rumble=gain(1);
   // capital rumble and explosions keep their weight but not their mud: low shelves under 100 Hz
   // (the bass harmonics built into the recordings carry them on small speakers)
   const rumbleShelf=filter('lowshelf',100,.7),exShelf=filter('lowshelf',90,.7);if(rumbleShelf)set(rumbleShelf.gain,-6,t);if(exShelf)set(exShelf.gain,-3,t);
   link(B.rumble,rumbleShelf,B.engines);
   link(B.music,D.music,F.music,musicTrim,music,pre);
   // slow motion dulls the world (sfxLP) but not the death that caused it: explosions bypass it
   const exVol=gain(vol.sfx),wAuto=gain(1);
   link(B.weapons,D.weapons,wAuto,sfxVol);link(B.impacts,D.impacts,sfxVol);link(B.explosions,D.explosions,exShelf,exVol,outsideLP);
   link(B.engines,D.engines,engVol);link(B.ambience,D.ambience,F.ambience,engVol);
   link(sfxVol,sfxLP,outsideLP);link(engVol,sfxLP);link(outsideLP,outsideG,pre);
   link(B.ui,pre);link(inside,pre);link(insideSfx,inside);link(insideEng,inside);
   // halls: a near hall fed by per-bus sends, and a darker, longer one fed per voice by distance
   const verb=mk('createConvolver'),verbIn=filter('highpass',180,.5),verbOut=gain(.9),far=mk('createConvolver'),farIn=filter('lowpass',2400,.5),farOut=gain(.8);
   // Both halls take a mono sum: a stereo input makes a stereo impulse response four convolutions, not two.
   for(const n of [verbIn,farIn])if(n)try{n.channelCount=1;n.channelCountMode='explicit';}catch(e){}
   const sends={};
   if(verb){try{verb.buffer=hall(2.6,2.6,false);}catch(e){}link(verbIn,verb,verbOut,pre);
    for(const [k,v] of [['weapons',.1],['impacts',.1],['explosions',.2],['engines',.05],['ambience',.1]]){sends[k]=gain(v);link(k==='explosions'?B.explosions:D[k],sends[k],verbIn);}
    const ms=gain(.55);link(music,ms,verbIn);sends.music=ms;}
   if(far&&perf.farHall){try{far.buffer=hall(4.6,1.5,true);}catch(e){}link(farIn,far,farOut,outsideLP);}
   // Bus meters for measurement (scripts/capture-audio.cjs --opts '{"meters":true}'): RMS of each bus, post-duck.
   const meters={};if(opt.meters)for(const [k,n] of [['music',D.music],['weapons',D.weapons],['engines',D.engines],['impacts',D.impacts],['explosions',B.explosions],['ambience',D.ambience],['master',pre]]){
    const sp=mk('createChannelSplitter',2);if(!sp)continue;link(n,sp);for(const c of [0,1]){const a=mk('createAnalyser');if(a){a.fftSize=2048;try{sp.connect(a,c);}catch(e){}meters[k+(c?'R':'L')]=a;}}}
   graph={F,exVol,wAuto,meters,master,comp,music,sfx:sfxVol,sfxLP,duck:D.music,sfxIn:B.weapons,verb,B,D,pre,out,clip,outsideLP,outsideG,inside,insideSfx,insideEng,engVol,farIn:far&&perf.farHall?farIn:null,sends,limiter:null};
   const sr=num(ctx.sampleRate,44100);
   try{const n=Math.floor(sr*1.5);noise=ctx.createBuffer(1,n,sr);const d=noise.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;}catch(e){noise=null;}
   if(opt.solo!=null)for(const n of [F.music,F.ambience,B.ui])set(n.gain,0,t);// measurement: one ship alone
   for(const k of opt.mute||[]){const n=k==='music'?music:k==='ambience'?F.ambience:k==='explosions'?exVol:k==='weapons'?D.weapons:B[k];if(n)set(n.gain,0,t);}// measurement: a bus's share of the mix
   loadLimiter();
  }
  // Swap the soft clipper for the worklet limiter once it has loaded (ceiling -1.5 dBFS on 4x peaks).
  let limiterP=null;
  function loadLimiter(){
   if(limiterP)return limiterP;
   const w=perf.limiter&&ctx&&ctx.audioWorklet,U=root&&root.URL,Bl=root&&root.Blob;
   if(!w||typeof w.addModule!=='function'||!U||!Bl||typeof root.AudioWorkletNode!=='function')return limiterP=Promise.resolve(false);
   let url=null;try{url=U.createObjectURL(new Bl([LIMITER_SRC],{type:'application/javascript'}));}catch(e){return limiterP=Promise.resolve(false);}
   limiterP=w.addModule(url).then(()=>{
    const n=new root.AudioWorkletNode(ctx,'tribute-limiter',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{ceil:Math.pow(10,-1.5/20),look:.003,release:.15}});
    try{graph.out.disconnect();}catch(e){}link(graph.out,n,ctx.destination);graph.limiter=n;return true;
   }).catch(()=>false);
   return limiterP;
  }

  function unlock(){
   if(!ctx){const C=root&&(root.AudioContext||root.webkitAudioContext);if(!C)return false;try{ctx=new C();}catch(e){return false;}}
   try{const r=ctx.resume&&ctx.resume();if(r&&r.catch)r.catch(()=>{});}catch(e){}
   if(!unlocked){buildGraph();unlocked=true;musicInit();startBeds();}
   return true;
  }

  // ---- volumes: master, music and effects (volumes()), plus Engines/Ambience (mix()) ----
  function setVolume(bus,v){
   if(bus==='engines'){mixVol.engines=clamp(num(v,mixVol.engines),0,1);if(graph){glide(graph.engVol.gain,mixVol.engines,.05);glide(graph.insideEng.gain,mixVol.engines,.05);}
    try{const s=storage();if(s)s.setItem(KEY_MIX,JSON.stringify(mixVol));}catch(e){}return true;}
   if(!(bus in vol))return false;vol[bus]=clamp(num(v,vol[bus]),0,1);
   if(graph&&graph[bus])glide(graph[bus].gain,vol[bus],.05);
   if(graph&&bus==='sfx'){glide(graph.insideSfx.gain,vol.sfx,.05);glide(graph.exVol.gain,vol.sfx,.05);}
   try{const s=storage();if(s)s.setItem(KEY,JSON.stringify(vol));}catch(e){}
   return true;
  }

  // ---- listener: the camera (or the blended microphone), with forward and up ----
  function setListener(x,y,z,fx,fy,fz,ux,uy,uz){
   const f=Math.hypot(fx,fy,fz)||1;Object.assign(L,{x:num(x,0),y:num(y,0),z:num(z,0),fx:num(fx,0)/f,fy:num(fy,0)/f,fz:num(fz,-1)/f});
   if(ux!=null){const u=Math.hypot(ux,uy,uz)||1;L.ux=num(ux,0)/u;L.uy=num(uy,1)/u;L.uz=num(uz,0)/u;}
   else{// up from forward: world up with the forward component removed
    let a=-L.fy*L.fx,b=1-L.fy*L.fy,c=-L.fy*L.fz;const n=Math.hypot(a,b,c);if(n>1e-6){L.ux=a/n;L.uy=b/n;L.uz=c/n;}}
   // The Web Audio listener never moves: it sits at the origin facing -Z. Each panner is given its
   // source's direction in camera space instead (localDir), and only when that direction turns by a
   // degree or so. Moving panners every frame put Chrome on its per-sample panning path and tripled
   // their cost (measured: 26 voices from 3.3% to 9.8% of real time on the render thread).
  }
  function listenerVelocity(dt){
   if(!(dt>0))return;
   if(L.px==null){L.px=L.x;L.py=L.y;L.pz=L.z;return;}
   const dx=L.x-L.px,dy=L.y-L.py,dz=L.z-L.pz,step=Math.hypot(dx,dy,dz);L.px=L.x;L.py=L.y;L.pz=L.z;
   if(step>Math.max(400,4000*dt)){L.vx=L.vy=L.vz=0;return;}// a camera cut is not motion
   const k=1-Math.exp(-dt/.12);L.vx+=(dx/dt-L.vx)*k;L.vy+=(dy/dt-L.vy)*k;L.vz+=(dz/dt-L.vz)*k;
  }

  // ---- hearing ----
  // Every sound has a hearing radius set by what makes it: a fighter's gun carries ~1.3k units,
  // a dreadnought's battery ~4k, a capital's death ~9k, a First One's death the whole sky.
  // `drive` is the per-ship engine emitter: a fighter is heard to ~470 units, a 1-km destroyer to ~5.4k.
  const HEAR={gun:[900,110],beam:[1100,120],engine:[250,0,4],drive:[420,0,5,1200],flyby:[400,0,2.5],ion:[12000,0],hit:[500,40],whizz:[360,0],debris:[420,0,.5],boom:[2200,4000,9000,60000]};
  function range(kind,size){
   const sz=Math.max(1,num(size,30));
   if(kind==='explosion')return HEAR.boom[clamp(Math.round(num(size,0)),0,3)];
   const h=HEAR[kind]||HEAR.gun;if(h[3]&&sz>h[3])return h[0]+h[2]*h[3]+20*Math.sqrt(sz-h[3]);// giant hulls: square-root growth past the cap
   return h[0]+h[1]*Math.sqrt(sz)+(h[2]||0)*sz;
  }
  // Stereo placement for the one-shot pool where no PannerNode exists (and the legacy numbers).
  function place(x,y,z,R=range('gun')){
   const dx=num(x,L.x)-L.x,dy=num(y,L.y)-L.y,dz=num(z,L.z)-L.z,d=Math.hypot(dx,dy,dz);
   let rx=-L.fz,rz=L.fx;const rl=Math.hypot(rx,rz);// right = forward x up(0,1,0)
   const pan=rl>1e-6&&d>1e-6?clamp((dx*rx+dz*rz)/rl/d,-1,1)*.7:0;
   const {u,g}=distGain(d,R);
   return {d,pan,R,u,heard:d<R,gain:g,cutoff:18000*Math.pow(400/18000,u),x:num(x,L.x),y:num(y,L.y),z:num(z,L.z)};
  }
  // A 3D panner (HRTF or equal-power) with no distance attenuation of its own; falls back to stereo.
  function panner(model,pos){
   const p=mk('createPanner');
   if(!p){const s=mk('createStereoPanner');if(s)set(s.pan,pos?pos.pan||0:0,now());return s;}
   try{p.panningModel=model;p.distanceModel='inverse';p.refDistance=1;p.maxDistance=1e9;p.rolloffFactor=0;}catch(e){}
   if(pos)placePanner(p,pos.x,pos.y,pos.z,true);return p;
  }
  function localDir(x,y,z){
   const rx=x-L.x,ry=y-L.y,rz=z-L.z,Rx=L.fy*L.uz-L.fz*L.uy,Ry=L.fz*L.ux-L.fx*L.uz,Rz=L.fx*L.uy-L.fy*L.ux;// right = forward x up
   const lx=rx*Rx+ry*Ry+rz*Rz,ly=rx*L.ux+ry*L.uy+rz*L.uz,lz=-(rx*L.fx+ry*L.fy+rz*L.fz),n=Math.hypot(lx,ly,lz);
   return n>1e-9?[lx/n,ly/n,lz/n]:[0,0,-1];
  }
  const toLocal=(ox,oy,oz)=>{const Rx=L.fy*L.uz-L.fz*L.uy,Ry=L.fz*L.ux-L.fx*L.uz,Rz=L.fx*L.uy-L.fy*L.ux;return [ox*Rx+oy*Ry+oz*Rz,ox*L.ux+oy*L.uy+oz*L.uz,-(ox*L.fx+oy*L.fy+oz*L.fz)];};
  // Moves a panner to (x,y,z) (world) only when its direction from the ear has turned by more than
  // ~1.5 degrees (0.75 for HRTF voices), or always when `jump`.
  function placePanner(p,x,y,z,jump){
   if(!p)return;const d=localDir(x,y,z);
   if(p.pan&&!p.positionX){// stereo fallback: pan from the local x
    const v=clamp(d[0],-1,1)*.8;if(jump)set(p.pan,v,now());else if(Math.abs(v-(p.__pan??9))>.02){p.__pan=v;aim(p.pan,v,now(),.03);}return;}
   const o=p.__dir,lim=p.panningModel==='HRTF'?.999914:.99966;
   if(!jump&&o&&o[0]*d[0]+o[1]*d[1]+o[2]*d[2]>lim)return;
   p.__dir=d;
   try{if(p.positionX){p.positionX.value=d[0];p.positionY.value=d[1];p.positionZ.value=d[2];}else if(p.setPosition)p.setPosition(d[0],d[1],d[2]);}catch(e){}
  }

  // ---- one-shot pool (explosions, events, legacy weapon calls): admitted by priority ----
  function prune(t=now()){for(let i=voices.length-1;i>=0;i--)if(voices[i].end<=t){try{voices[i].out.disconnect();}catch(e){}voices.splice(i,1);}}
  function kill(v,t=now()){
   const p=v.out.gain;call(p,'cancelScheduledValues',t);aim(p,0,t,.012);ramp(p,0,t+.05);
   v.src.forEach(s=>stop(s,t+.05));v.end=t+.05;v.killed=true;
  }
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
  // out gain -> distance lowpass -> panner -> bus (+ a far-hall send growing with distance)
  function voice(style,prio,pos,g,cutoff,build,limit=true,bus='weapons'){
   if(!unlocked||!graph||opt.solo!=null)return false;// solo (measurement): no one-shots
   if(!admit(style,prio,limit))return false;
   const t=now(),out=gain(0);if(!out){stats.dropped++;return false;}
   const model=pos.d<600&&pos.u<.35?'HRTF':'equalpower';set(out.gain,g*trimOf(model),t);
   const lp=filter('lowpass',cutoff,.5),pan=panner(model,pos);
   link(out,lp,pan,graph.B[bus]||graph.sfxIn);
   if(graph.farIn&&pos.u>.25){const fs=gain(.35*smooth(.25,.9,pos.u));link(lp,fs,graph.farIn);}
   const r=build(t,out)||{},v={style,prio,out,src:(r.src||[]).filter(Boolean),end:t+num(r.dur,.5)+.05,killed:false};
   voices.push(v);stats.played++;stats.peak=Math.max(stats.peak,voices.filter(x=>!x.killed).length);
   return v;
  }

  // ---- weapon recipes (the synth fallback): each returns {src,dur}; everything routes through `out` ----
  // Rule: nothing tonal below ~150 Hz and no falling low tones. A low sine sliding down
  // over noise reads as a raspberry, not a gun. Weight comes from noise, not from pitch.
  const R={
   laser(t,o){const f=jit(1150,.1),a=osc('sine',f,t,t+.14),b=osc('sine',f*1.5,t,t+.14),g=env(gain(),t,.002,.24,.12),g2=env(gain(),t,.002,.07,.08);
    expo(P(a,'frequency'),f*.36,t+.11);expo(P(b,'frequency'),f*.5,t+.1);link(a,g,o);link(b,g2,o);return{src:[a,b],dur:.14};},
   phaser(t,o){const f=jit(620,.05),a=osc('sine',f,t,t+.46),b=osc('sine',f*1.01,t,t+.46),c=osc('triangle',f*2,t,t+.46),vib=osc('sine',7,t,t+.46),vg=gain(f*.012),g=gain(),lp=filter('lowpass',3200,.5);
    link(vib,vg,P(a,'frequency'));set(P(g,'gain'),0,t);ramp(P(g,'gain'),.13,t+.05);ramp(P(g,'gain'),.1,t+.34);ramp(P(g,'gain'),0,t+.44);
    const cg=gain(.25);link(a,g);link(b,g);link(c,cg,g);link(g,lp,o);return{src:[a,b,c,vib],dur:.46};},
   pulse(t,o){const z=osc('triangle',jit(900,.08),t,t+.16),zg=env(gain(),t,.002,.22,.14),ns=noiseSrc(t,t+.04,1),hp=filter('highpass',1500,.7),ng=env(gain(),t,.001,.25,.03);
    expo(P(z,'frequency'),420,t+.13);link(z,zg,o);link(ns,hp,ng,o);return{src:[z,ns],dur:.16};},
   kinetic(t,o){const n=2+Math.floor(Math.random()*3),src=[],bp=filter('bandpass',jit(2200,.15),1);link(bp,o);
    for(let i=0;i<n;i++){const s=t+i*(.055+Math.random()*.02),ns=noiseSrc(s,s+.025,1),g=env(gain(),s,.001,.6,.02);link(ns,g,bp);src.push(ns);}
    return{src,dur:n*.075+.03};},
   plasma(t,o){const ns=noiseSrc(t,t+.34,1),bp=filter('bandpass',1400,2),ng=env(gain(),t,.01,.5,.32),a=osc('triangle',jit(560,.08),t,t+.3),ag=env(gain(),t,.01,.12,.26);
    if(bp)expo(bp.frequency,650,t+.3);expo(P(a,'frequency'),360,t+.26);link(ns,bp,ng,o);link(a,ag,o);return{src:[ns,a],dur:.34};},
   organic(t,o){const ns=noiseSrc(t,t+.32,1),bp=filter('bandpass',900,4),g=env(gain(),t,.02,.7,.3);
    if(bp){expo(bp.frequency,2400,t+.1);expo(bp.frequency,1200,t+.3);}link(ns,bp,g,o);return{src:[ns],dur:.32};},
   'ion-charge'(t,o){const a=osc('triangle',220,t,t+4.6),b=osc('sine',440,t,t+4.6),lp=filter('lowpass',600,1),g=gain(),trem=osc('sine',5,t,t+4.6),tg=gain(.25);
    expo(P(a,'frequency'),660,t+4.4);expo(P(b,'frequency'),1320,t+4.4);if(lp)expo(lp.frequency,3000,t+4.4);expo(P(trem,'frequency'),16,t+4.4);
    set(P(g,'gain'),0,t);ramp(P(g,'gain'),.04,t+.6);ramp(P(g,'gain'),.14,t+4.2);ramp(P(g,'gain'),0,t+4.55);
    const vca=gain(.75);link(trem,tg,P(vca,'gain'));link(a,lp);link(b,lp);link(lp,vca,g,o);return{src:[a,b,trem],dur:4.6};},
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

  // ---- recorded samples ----
  // audio/manifest.json maps roles to files. Loops carry their loop points (the build pads each
  // loop with its own wrap-around, so any MP3 decoder delay still loops seamlessly). Groups say
  // what loads when: `core` at the first gesture, `fleet[N]` when fleet N is in the war, and
  // everything else on first use.
  const SMP={},LAZY={},LOOPS=new WeakMap(),pick=a=>a[Math.floor(Math.random()*a.length)];let loadFile=null,manifest=null,loopFiles={};
  const bytes={loaded:0};
  function want(role){
   const l=LAZY[role];if(!l||l.p||!loadFile)return l&&l.p;
   l.p=Promise.all(l.files.map(loadFile)).then(b=>{b=b.filter(Boolean);if(b.length)SMP[role]=b;if(unlocked)startBeds();return b.length;});
   return l.p;
  }
  const B={music:null,musicG:null,amb:null,ambG:null};
  function useSamples(map){
   for(const k in map||{}){const a=[].concat(map[k]).filter(Boolean);if(a.length)SMP[k]=a;}
   if(unlocked)startBeds();return Object.keys(SMP);
  }
  function loopPoints(b){return LOOPS.get(b)||null;}
  async function loadSamples(url){
   if(!ctx||typeof fetch!=='function'||typeof ctx.decodeAudioData!=='function')return[];
   try{
    const r=await fetch(url);if(!r.ok)return[];
    const man=await r.json(),base=url.replace(/[^/]*$/,''),out={},cache={};manifest=man;loopFiles=man.loops||{};
    const load=loadFile=f=>cache[f]||(cache[f]=fetch(base+f).then(x=>x.arrayBuffer()).then(b=>{bytes.loaded+=b.byteLength;return ctx.decodeAudioData(b);})
     .then(buf=>{const lp=loopFiles[f];if(buf&&lp)LOOPS.set(buf,lp);return buf;}).catch(()=>null));
    const groups=man.groups,core=groups?new Set(groups.core||[]):null;
    await Promise.all(Object.entries(man.roles||{}).map(async([role,files])=>{
     files=[].concat(files);
     if(core?!core.has(role):/^engine-/.test(role)){LAZY[role]={files};return;}
     out[role]=(await Promise.all(files.map(load))).filter(Boolean);}));
    const got=useSamples(out);
    if(pendingFleets)prepare(pendingFleets);
    await limiterP;
    return got;
   }catch(e){return[];}
  }
  // Stream what a war needs: its fleets' guns, beams, engines and death styles.
  let pendingFleets=null;
  function prepare(fleets){
   pendingFleets=[].concat(fleets||[]).filter(f=>f!=null&&f>=0);
   if(!manifest||!manifest.groups)return Promise.resolve(0);
   const roles=new Set();for(const f of pendingFleets)for(const r of (manifest.groups.fleet||{})[f]||[])roles.add(r);
   for(const r of manifest.groups.soon||[])roles.add(r);
   return Promise.all([...roles].map(want));
  }
  function has(role){if(SMP[role])return true;want(role);return false;}
  function sample(role,t,o,rate=1,g=1,loop=false,buf=null,offset=0,direct=false){
   const b=buf||SMP[role]&&pick(SMP[role]),s=b&&mk('createBufferSource');if(!s)return null;
   const lp=loop&&LOOPS.get(b);
   try{s.buffer=b;s.loop=loop;if(lp){s.loopStart=lp[0];s.loopEnd=lp[1];}}catch(e){}set(s.playbackRate,rate,t);const sg=direct?null:gain(g);if(sg)link(s,sg,o);else link(s,o);
   let off=offset;if(lp){const len=lp[1]-lp[0];off=lp[0]+((offset%len)+len)%len;}
   try{s.start(t,Math.max(0,off));}catch(e){try{s.start(t);}catch(_){}}return{src:s,dur:num(b.duration,1)/rate,g:sg,buf:b};
  }

  // ---- beds: the score (stems, or the single legacy loop) and the distant battle ----
  // Stems share one key and tempo (D minor, 96 BPM; every loop is a whole number of 2.5 s bars),
  // so started together they stay on the same bar and can be crossfaded at any moment.
  const STEMS=['score-calm','score-tension','score-battle'];
  const S={on:false,g:{},src:{},t0:0,coda:null,level:[1,0,0]};
  function startBeds(){
   if(!graph)return;const t=now();
   if(SMP['score-calm']&&opt.music!==false&&!S.on&&!B.music){
    S.on=true;S.t0=t+.1;M.sampled=true;if(M.pad)aim(P(M.pad,'gain'),0,t,.5);
   }
   if(S.on&&!S.coda)for(const k of STEMS)if(SMP[k]&&!S.src[k]){// late stems join on the bar grid
    const bar=2.5,at=Math.max(t+.05,S.t0+Math.ceil((t+.05-S.t0)/bar)*bar),r=sample(k,at,graph.B.music,1,0,true,null,at-S.t0);
    if(r){S.src[k]=r.src;S.g[k]=r.g;}}
   if(!S.on&&SMP.music&&!B.music){const r=sample('music',t+.05,graph.duck,1,0,true);if(r){B.music=r.src;B.musicG=r.g;aim(P(r.g,'gain'),.5,t,2);M.sampled=true;if(M.pad)aim(P(M.pad,'gain'),0,t,.5);}}
   if(SMP.ambience&&!B.amb){const r=sample('ambience',t+.05,graph.B.ambience,1,0,true);if(r){B.amb=r.src;B.ambG=r.g;aim(P(r.g,'gain'),.05+.6*distant,t,2);}}
   if(S.on)mixStems(2);
  }
  // Calm below intensity 0.25, tension around 0.5, full battle above 0.7; momentum (who is
  // winning, -1..1) swings a little weight from tension to battle when the fight is turning.
  let momentum=0;
  function mixStems(tc=2.5){
   if(!S.on||S.coda)return;const i=M.target,t=now();
   const battle=smooth(.55,.85,i),calm=1-smooth(.12,.42,i),tension=clamp(1-calm-battle,0,1)*(1-.3*Math.abs(momentum)*battle);
   const lv={'score-calm':calm,'score-tension':tension,'score-battle':battle+.3*Math.abs(momentum)*(1-calm-battle)};
   for(const k of STEMS)if(S.g[k])aim(P(S.g[k],'gain'),.62*Math.sqrt(clamp(lv[k],0,1)),t,tc);// equal-power
  }
  // The war is over: the loops fade on the next bar and the coda plays from it.
  function coda(kind){
   if(!unlocked||!graph||!S.on||S.coda)return false;
   const role=kind==='defeat'?'score-defeat':'score-victory';if(!SMP[role]){want(role);return false;}
   const t=now(),bar=2.5,at=S.t0+Math.ceil((t+.3-S.t0)/bar)*bar;S.coda=role;
   for(const k of STEMS)if(S.g[k]){call(P(S.g[k],'gain'),'cancelScheduledValues',t);aim(P(S.g[k],'gain'),0,at-.4,.5);stop(S.src[k],at+4);}
   sample(role,at,graph.B.music,1,.7);return {at,role};
  }
  // Ducking: big hits push buses down for a moment, the way a film mix makes room for them.
  function duck(buses,depth,hold,release=.6,t0=now()){
   if(!graph)return;
   for(const b of buses){const p=P(graph.D[b],'gain');if(!p)continue;call(p,'cancelScheduledValues',t0);aim(p,depth,t0,.03);aim(p,1,t0+hold,release);}
  }
  function duckFor(t,depth,hold){if(!graph||slow)return;duck(['music'],depth,hold,.6,t);}

  // ---- emitters and virtual voices ----
  // em: {id,bus,role,buf,loop,x,y,z,vx,vy,vz,ox,oy,oz,cone,R,level,prio,t0,dur,rate,gain,seen,voice,lp,air,phase}
  const EM=new Map();let frame=0;
  // Chrome's HRTF comes out ~3 dB louder than equal-power at the same gain (measured: +3.1..3.3 dB front
  // and side, +1.25 behind), so a voice handed between the two models would jump; HRTF voices are trimmed.
  const HRTF_TRIM=.708,trimOf=m=>m==='HRTF'?HRTF_TRIM:1;
  const groupOf=(b,e)=>b==='engines'?(e&&e.rumble?'rumble':'engines'):b==='impacts'?'impacts':'weapons';
  // rumble is a ceiling for capitals, not a reservation: fighters get whatever engine voices capitals don't use
  let rumbleUsed=0;const capOf=g=>g==='engines'?budget.engines-rumbleUsed:g==='rumble'?Math.min(budget.rumble||0,budget.engines):budget[g]||0;
  function emitter(id,o){let e=EM.get(id);if(!e){e={id,voice:null,old:[],t0:now(),seen:frame,rate:1,gain:1,level:1,prio:0,phase:0,air:true,...o};EM.set(id,e);}else Object.assign(e,o);e.seen=frame;return e;}
  // One voice for one emitter: source -> gain -> air lowpass -> panner -> bus, plus a far-hall send.
  // Voice chains are pooled per group (gain -> air lowpass -> panner -> bus, plus a far-hall send):
  // a new shot creates only its buffer source. Building and tearing down four nodes for every one
  // of ~30 shots a second cost the render thread more than all the voices themselves (measured).
  const POOL={engines:[],rumble:[],weapons:[],impacts:[]};
  function acquire(group,model,e){
   const t=now(),pool=POOL[group];let slot=null;
   for(const s of pool)if(!s.busy&&t>=s.freeAt&&(!slot||s.model===model&&slot.model!==model))slot=s;
   if(!slot&&pool.length<Math.ceil((group==='engines'?budget.engines:capOf(group))*1.6)+2){
    const g=gain(0),lp=filter('lowpass',18000,.5),pn=panner(model,e);link(g,lp,pn,graph.B[group]);
    let fs=null;if(graph.farIn){fs=gain(0);link(lp,fs,graph.farIn);}
    slot={g,lp,pn,fs,model,busy:false,freeAt:0,cut:0};pool.push(slot);
   }
   if(!slot)return null;
   slot.busy=true;
   if(slot.model!==model&&slot.pn&&'panningModel' in slot.pn){try{slot.pn.panningModel=model;}catch(er){}slot.model=model;}
   if(slot.pn&&'coneInnerAngle' in slot.pn){const c=e.cone||[360,360,1];try{slot.pn.coneInnerAngle=c[0];slot.pn.coneOuterAngle=c[1];slot.pn.coneOuterGain=c[2];}catch(er){}}
   call(slot.g.gain,'cancelScheduledValues',t);set(slot.g.gain,0,t);if(slot.fs){call(slot.fs.gain,'cancelScheduledValues',t);set(slot.fs.gain,0,t);}
   return slot;
  }
  function startVoice(e,model,fade,offset){
   const t=now(),b=e.buf||(SMP[e.role]&&pick(SMP[e.role]));if(!b)return null;e.buf=b;
   let slot=null,g,lp,pn,fs=null;
   if(e.inside){// the pilot's own guns and beams: dry, centred, not pooled (rare)
    g=gain(0);lp=filter('lowpass',e.cut||18000,.5);pn=null;link(g,lp,e.bus==='engines'?graph.insideEng:graph.insideSfx);
   }else{slot=acquire(groupOf(e.bus,e),model,e);if(!slot)return null;({g,lp,pn,fs}=slot);}
   const r=sample(null,t,g,e.rate*(e.dop||1),1,!!e.loop,b,offset,true);if(!r){if(slot)slot.busy=false;return null;}
   const v={src:r.src,g,lp,pn,fs,slot,model,t,cut:slot?slot.cut:0,end:e.loop?Infinity:t+Math.max(.05,(num(b.duration,1)-offset)/Math.max(.1,e.rate)),dying:false};
   const target=(e.cur||0)*trimOf(model);
   if(fade>0){set(g.gain,0,t);aim(g.gain,target,t,fade/3);}else set(g.gain,target,t);
   if(e.cone)orient(pn,e);
   stats.played++;return v;
  }
  function releaseVoice(v,fade=XFADE_OUT){
   if(!v||v.dying)return;v.dying=true;const t=now();
   call(v.g.gain,'cancelScheduledValues',t);aim(v.g.gain,0,t,fade/4);stop(v.src,t+fade+.05);v.end=Math.min(v.end,t+fade+.05);
   if(v.fs){call(v.fs.gain,'cancelScheduledValues',t);aim(v.fs.gain,0,t,fade/4);}
   freeSlot(v,v.end+.02);
  }
  function freeSlot(v,at){if(v.slot&&v.slot.busy){v.slot.busy=false;v.slot.freeAt=at;}if(v.slot)v.slot.cut=v.cut||v.slot.cut;}
  function orient(pn,e){if(!pn||!pn.orientationX)return;const o=toLocal(e.ox,e.oy,e.oz),q=pn.__or;if(q&&o[0]*q[0]+o[1]*q[1]+o[2]*q[2]>.9986)return;pn.__or=o;try{pn.orientationX.value=o[0];pn.orientationY.value=o[1];pn.orientationZ.value=o[2];}catch(er){}}
  // Loudness at the listener: what the voice budget ranks by.
  function audibility(e){
   const dx=e.x-L.x,dy=e.y-L.y,dz=e.z-L.z,d=Math.hypot(dx,dy,dz),ref=e.ref||e.R*.1,{u,g}=emitGain(d,e.R,ref);
   e.d=d;e.u=u;e.dg=g;
   // cone: behind the nozzles a ship is louder (the panner applies it; the ranking estimates it)
   let cone=1;if(e.cone&&d>1e-6){const c=(dx*e.ox+dy*e.oy+dz*e.oz)/d;cone=c<0?1:1-(1-e.cone[2])*c;}// c<0: listener is behind (in the exhaust)
   // ranked by the louder of now and 0.5 s ahead along its radial velocity: an incoming fighter
   // earns its voice before it arrives, not at the moment it passes
   let ahead=g;if(d>1e-6&&(e.vx||e.vy||e.vz)){const vr=(dx*((e.vx||0)-L.vx)+dy*((e.vy||0)-L.vy)+dz*((e.vz||0)-L.vz))/d;if(vr<0)ahead=emitGain(Math.max(0,d+vr*.5),e.R,ref).g;}
   e.aud=e.level*Math.max(g,ahead)*cone*(1+e.prio);return e.aud;
  }
  function voiceParams(e,v,jump){
   if(!v||v.dying)return;const t=now();
   placePanner(v.pn,e.x,e.y,e.z,jump);if(e.cone)orient(v.pn,e);
   const dop=e.inside||e.noDoppler?1:doppler(e.x-L.x,e.y-L.y,e.z-L.z,(e.vx||0)-L.vx,(e.vy||0)-L.vy,(e.vz||0)-L.vz);e.dop=dop;
   // every write below happens only when the value has moved enough to hear (0.1% pitch, 0.25 dB, 0.5 dB send)
   const rate=clamp(e.rate*dop,.25,4);if(jump||!(Math.abs(rate-(v.rate||0))<.001*rate)){v.rate=rate;aim(v.src.playbackRate,rate,t,jump?.001:.05);}
   // air absorption: 18 kHz close, closing to ~1.2 kHz at the edge of hearing
   const cut=e.inside?e.cut||18000:Math.min(e.cut||18000,18000*Math.pow(1200/18000,e.u||0));
   // a plain value (an automated biquad frequency recomputes its coefficients every sample), only when it moves
   if(v.lp&&!(Math.abs(cut-(v.cut||0))<.03*cut)){v.cut=cut;if(v.slot)v.slot.cut=cut;try{v.lp.frequency.value=cut;}catch(er){}}
   // a fighter or frigate passing within three reference distances is lifted by up to 6 dB: the hero pass
   const lift=e.pass&&e.d>0?1+clamp(((e.ref||1)*3/e.d-1)/2,0,1):1;
   e.cur=e.gain*lift*(e.inside?1:e.dg)*(opt.mute&&opt.mute.includes(groupOf(e.bus,e))?0:1);
   const gv=e.cur*trimOf(v.model);if((!v.fading||t>v.t+XFADE_IN)&&!(Math.abs(gv-(v.gv??-1))<.029*Math.max(gv,1e-4))){v.gv=gv;aim(v.g.gain,gv,t,.04);}
   const fsv=.5*smooth(.15,.85,e.u||0)*e.gain;if(v.fs&&!(Math.abs(fsv-(v.fsv??-1))<.06*Math.max(fsv,1e-3))){v.fsv=fsv;aim(v.fs.gain,fsv,t,.1);}
  }
  // Every frame: rank each group's emitters, voice the top of each budget, hand off the rest.
  function allocate(){
   const t=now(),groups={engines:[],rumble:[],weapons:[],impacts:[]};
   for(const e of EM.values()){
    const gone=e.list?e.seen!==frame:(!e.loop&&t>e.t0+e.dur+.05)||(e.until!=null&&t>e.until);
    if(gone||e.dead){if(e.voice)releaseVoice(e.voice,e.release||XFADE_OUT);for(const o of e.old)releaseVoice(o);EM.delete(e.id);continue;}
    audibility(e);if(opt.solo!=null&&e.ship!==opt.solo)e.aud=0;
    if(e.voice&&e.voice.end<=t){freeSlot(e.voice,t);e.voice=null;if(!e.loop){e.dead=true;continue;}}
    groups[groupOf(e.bus,e)].push(e);
   }
   let hrtfLeft=budget.hrtf;const voiced=[];rumbleUsed=0;
   for(const k of ['rumble','engines','weapons','impacts']){
    const list=groups[k],cap=capOf(k);
    list.sort((a,b)=>(b.aud*(b.voice?HYSTERESIS:1))-(a.aud*(a.voice?HYSTERESIS:1)));
    for(let i=0;i<list.length;i++){
     const e=list[i],keep=i<cap&&e.aud>1e-4;
     if(!keep){if(e.voice){releaseVoice(e.voice,XFADE_OUT);e.voice=null;stats.handoffs++;}
      // a one-shot that missed its start stays virtual; loops wait for a voice
      continue;}
     voiced.push(e);if(k==='rumble')rumbleUsed++;
    }
   }
   // HRTF for the nearest few, equal-power for the rest; a model change is a crossfade.
   voiced.sort((a,b)=>a.d-b.d);
   for(const e of voiced){
    // HRTF for the nearest few that are not sweeping fast: Chrome's HRTF crossfades between azimuths
    // over tens of ms, so a fighter crossing 20 degrees a frame lagged ~100 ms behind its picture
    // (measured); equal-power follows every render quantum.
    const rx=e.x-L.x,ry=e.y-L.y,rz=e.z-L.z,wx=(e.vx||0)-L.vx,wy=(e.vy||0)-L.vy,wz=(e.vz||0)-L.vz,d2=Math.max(1,rx*rx+ry*ry+rz*rz);
    const omega=Math.hypot(ry*wz-rz*wy,rz*wx-rx*wz,rx*wy-ry*wx)/d2;e.omega=omega;
    const hold=e.voice&&e.voice.model==='HRTF'?3:2.4;// hysteresis, rad/s
    const want=perf.hrtf&&hrtfLeft>0&&!e.inside&&e.d<Math.max(300,e.R*.35)&&omega<hold?'HRTF':'equalpower';if(want==='HRTF')hrtfLeft--;
    if(!e.voice){
     if(t<e.t0-.02)continue;// a whizz waits for its moment
     const age=t-e.t0,late=!e.loop&&age>.06;if(late){if(!e.list)e.dead=true;continue;}// never start a gun halfway through
     e.cur=e.gain*(e.inside?1:e.dg);audibility(e);
     const fade=e.loop?(e.attack??XFADE_IN):0,off=e.loop?(t-e.t0)*e.rate+(e.phase||0):0;
     e.voice=startVoice(e,want,fade,off);if(e.voice){e.voice.fading=fade>0;voiceParams(e,e.voice,true);}continue;}
    if(e.voice.model!==want&&t-e.voice.t>.5&&e.loop){
     const old=e.voice,off=(t-e.t0)*e.rate+(e.phase||0);e.voice=startVoice(e,want,XFADE_IN,off);
     if(e.voice){e.voice.fading=true;voiceParams(e,e.voice,true);releaseVoice(old,XFADE_OUT);e.old.push(old);stats.modelSwaps++;}else e.voice=old;}
    voiceParams(e,e.voice,false);
   }
   for(const e of EM.values())e.old=e.old.filter(v=>v.end>t);
   // Density: many guns at once each get a little quieter (16 voices: -4.8 dB), so a broadside is
   // a mass of fire rather than a wall.
   let wn=0;for(const e of voiced)if(groupOf(e.bus,e)==='weapons')wn++;const wg=1/Math.sqrt(1+Math.max(0,wn-4)/6);
   if(Math.abs(wg-(focus.w??1))>.02){focus.w=wg;aim(P(graph.wAuto,'gain'),wg,t,.25);}
   // Focus: a fighter passing within a few of its reference distances takes the foreground; the score,
   // the bed and the capital rumble dip by up to 6 dB (0.15 s in, 0.6 s out), as a film mix would.
   let near=0;for(const e of voiced)if(e.bus==='engines'&&!e.rumble&&!e.inside&&e.d>0)near=Math.max(near,clamp(((e.ref||1)*3/e.d-1)/2,0,1));
   const fg=Math.pow(10,-6*near/20);
   if(Math.abs(fg-focus.v)>.02){const tc=fg<focus.v?.05:.2;focus.v=fg;for(const n of [graph.F.music,graph.F.ambience,graph.B.rumble])aim(P(n,'gain'),opt.solo!=null&&n!==graph.B.rumble?0:fg,t,tc);}
  }
  const focus={v:1};
  function groupStats(){
   const t=now(),c={engines:0,rumble:0,weapons:0,impacts:0,hrtf:0,fading:0};
   for(const e of EM.values()){if(e.voice&&!e.voice.dying){const g=groupOf(e.bus,e);c[g]++;if(g==='rumble')c.engines++;if(e.voice.model==='HRTF')c.hrtf++;}for(const o of e.old)if(o.end>t)c.fading++;}
   return c;
  }

  // ---- ships: engines (and, for capitals, the hull) ----
  // list: [{id,x,y,z,vx,vy,vz,fx,fy,fz,len,fleet,cls:'f'|'m'|'c',speed}] for ships near the ear.
  // A fighter's engine sits at its tail with a cone out of the nozzles. A capital is too big to
  // be a point: its nozzles are one emitter at the stern, and its hull a second one that rides
  // along the keel to the point nearest the ear, so a destroyer overhead is a wall that moves on.
  function engineRole(fleet,cls){
   for(const c of [cls,cls==='m'?'c':'m',cls==='f'?'m':'f'])if(c&&(SMP[`eng-${c}-${fleet}`]||LAZY[`eng-${c}-${fleet}`]))return has(`eng-${c}-${fleet}`)?`eng-${c}-${fleet}`:null;
   return has('engine-'+fleet)?'engine-'+fleet:null;
  }
  function ships(list){
   if(!unlocked||!graph)return 0;let n=0;
   for(const s of list||[]){
    const role=engineRole(s.fleet,s.cls);if(!role)continue;
    const len=Math.max(1,num(s.len,20)),R=range('drive',len),sp=clamp(num(s.speed,.5),0,1),f=[num(s.fx,1),num(s.fy,0),num(s.fz,0)];
    const cls=s.cls||'f',lvl=cls==='c'?1.15:cls==='m'?.85:1,rate=cls==='f'?.92+.2*sp:.96+.08*sp;
    const tail=len*(cls==='c'?.45:.4),nx=s.x-f[0]*tail,ny=s.y-f[1]*tail,nz=s.z-f[2]*tail;
    emitter('n'+s.id,{ship:s.id,list:true,bus:'engines',role,loop:true,x:nx,y:ny,z:nz,vx:s.vx,vy:s.vy,vz:s.vz,ox:-f[0],oy:-f[1],oz:-f[2],cone:[110,250,cls==='c'?.45:.55],
     R,ref:cls==='c'?Math.min(len,1200)*.3:Math.max(12,len*3),level:lvl,gain:(cls==='f'?1:.6)*(.75+.25*sp),pass:cls!=='c',rate,prio:0,rumble:cls==='c',phase:(s.id*1.37)%7,cut:cls==='c'?9000:16000});n++;
    if(cls==='c'){// the hull: two decorrelated rumbles either side of the keel point nearest the ear, so a
     // destroyer overhead is wide as well as deep; darker than the nozzles and with no cone
     const ax=L.x-s.x,ay=L.y-s.y,az=L.z-s.z,k=clamp(ax*f[0]+ay*f[1]+az*f[2],-len*.5,len*.5),sx=-f[2],sz=f[0],sl=Math.hypot(sx,sz)||1,w=Math.min(len,1200)*.16;
     for(const [side,id] of [[-1,'h'],[1,'g']])emitter(id+s.id,{ship:s.id,list:true,bus:'engines',role,loop:true,x:s.x+f[0]*k+side*w*sx/sl,y:s.y+f[1]*k,z:s.z+f[2]*k+side*w*sz/sl,vx:s.vx,vy:s.vy,vz:s.vz,
      R:R*.8,ref:Math.min(len,1200)*.25,level:1,gain:.35,rate:rate*(side<0?.84:.8),prio:0,rumble:true,phase:(s.id*2.71)%7+(side<0?3.1:5.3),cut:3000});n+=2;}
   }
   return n;
  }

  // ---- weapons ----
  // A shot is a short-lived emitter at the muzzle. Near (inside 35% of its hearing radius) it
  // plays the crisp recording; further out, the thumpier far one. Takes are picked at random with
  // a little pitch and gain variation, so no two shots are identical.
  function shot(style,x,y,z,fleet,size,g=1,o={}){
   if(!unlocked||!graph)return false;
   const kind=style==='beam'||style==='phaser'?'beam':/^(arc|rail|ion-)/.test(style)?null:'shot';
   const near=kind==='beam'?'beam-'+fleet:'shot-'+fleet,farR=kind==='beam'?'beamfar-'+fleet:'shotfar-'+fleet;
   const R=range(kind==='beam'?'beam':'gun',size),dx=x-L.x,dy=y-L.y,dz=z-L.z,d=Math.hypot(dx,dy,dz);
   if(!o.own&&d>=R){stats.culled++;return false;}
   const u=d/R,role=kind==null?(SMP[style]?style:null):u>.35&&has(farR)?farR:has(near)?near:(SMP[style]?style:null);
   if(!role)return weapon(style,x,y,z,g,fleet,size);// no recording: the synth, in the one-shot pool
   const c=clock(),key=role;const r=(recent[key]||[]).filter(t=>c-t<.03);recent[key]=r;if(r.length>=3){stats.dropped++;return false;}r.push(c);
   const big=num(size,20)>=180;
   emitter('w'+(++seq),{bus:'weapons',role,x,y,z,vx:0,vy:0,vz:0,R,ref:40+6*Math.sqrt(Math.max(1,num(size,20))),level:1+(big?.6:0),prio:big?.5:0,gain:clamp(num(g,1),0,2)*(o.own?.6:2)*jit(1,.12),rate:jit(1,.05),dur:2,inside:!!o.own,cut:o.own?4000:18000});
   return true;
  }
  let seq=0;
  // Beams hold: while the page keeps a beam in the list it sounds; its attack is the fleet's beam
  // recording, its body the sustained loop, and when it leaves the list the loop releases over 0.35 s.
  // list: [{key,ax,ay,az,bx,by,bz,fleet,len}] (the emitter sits at the point of the beam nearest the ear)
  function beams(list){
   if(!unlocked||!graph)return 0;let n=0;
   for(const b of list||[]){
    const id='b'+b.key,loop=has('beamloop-'+b.fleet)?'beamloop-'+b.fleet:null;if(!loop)continue;
    const ex=b.bx-b.ax,ey=b.by-b.ay,ez=b.bz-b.az,l2=ex*ex+ey*ey+ez*ez||1,k=clamp(((L.x-b.ax)*ex+(L.y-b.ay)*ey+(L.z-b.az)*ez)/l2,0,1);
    const x=b.ax+ex*k,y=b.ay+ey*k,z=b.az+ez*k,R=range('beam',b.len)*1.1,fresh=!EM.has(id);if(fresh)stats.beams++;
    emitter(id,{list:true,bus:'weapons',role:loop,loop:true,x,y,z,vx:0,vy:0,vz:0,R,ref:30+5*Math.sqrt(Math.max(1,num(b.len,20))),level:1.1,gain:.4,prio:num(b.len,20)>=180?.5:.1,attack:.06,release:.35,phase:Math.random()*2});n++;
    if(fresh&&Math.hypot(x-L.x,y-L.y,z-L.z)<R&&has('beam-'+b.fleet))emitter('a'+(++seq),{bus:'weapons',role:'beam-'+b.fleet,x:b.ax,y:b.ay,z:b.az,vx:0,vy:0,vz:0,R,ref:30+5*Math.sqrt(Math.max(1,num(b.len,20))),level:1.2,prio:.1,gain:.7,rate:jit(1,.04),dur:2});
   }
   return n;
  }

  // ---- impacts, whizz-bys, damage, debris ----
  // kind: 'hull' (light), 'heavy', 'shield-ring' (deflectors ring), 'shield-hum', 'shield-crackle'
  // (a machine barrier crackles), 'sparks', 'debris', 'groan'. Heard only near the ear.
  const IMPACT_ROLE={hull:'hit-light',heavy:'hit-heavy','shield-ring':'shield-ring','shield-hum':'shield-hum','shield-crackle':'shield-crackle',sparks:'sparks',debris:'debris',groan:'groan'};
  function impact(kind,x,y,z,size=20,g=1){
   if(!unlocked||!graph)return false;
   const role=IMPACT_ROLE[kind];if(!role||!has(role))return false;
   const R=kind==='groan'?range('drive',size)*.7:kind==='debris'?range('debris',size):range('hit',size)*(kind==='heavy'?1.6:1),d=Math.hypot(x-L.x,y-L.y,z-L.z);
   if(d>=R){stats.culled++;return false;}
   const c=clock(),r=(recent[role]||[]).filter(t=>c-t<.06);recent[role]=r;if(r.length>=2){stats.dropped++;return false;}r.push(c);
   emitter('i'+(++seq),{bus:'impacts',role,x,y,z,vx:0,vy:0,vz:0,R,ref:40+.2*Math.max(1,num(size,20)),level:kind==='heavy'||kind==='groan'?1.4:1,prio:kind==='groan'?.4:0,gain:clamp(g,0,2)*(kind==='groan'?.8:1)*jit(1,.12),rate:jit(1,.06),dur:6});
   stats.hits++;if(/^shield/.test(kind))stats.shields++;
   return true;
  }
  // A bolt that passes close by: a moving emitter along its path, lined up so the whizz peaks
  // at its closest approach (tca seconds from now), with its own Doppler.
  const PEAK=new WeakMap();
  function peakAt(b){
   if(!b)return 0;if(PEAK.has(b))return PEAK.get(b);let at=num(b.duration,1)*.4;
   try{const d=b.getChannelData(0),sr=num(b.sampleRate,44100),w=Math.max(1,Math.floor(sr*.05));let best=-1;
    for(let i=0;i+w<=d.length;i+=w){let e=0;for(let j=i;j<i+w;j++)e+=d[j]*d[j];if(e>best){best=e;at=(i+w/2)/sr;}}}catch(e){}
   PEAK.set(b,at);return at;
  }
  const WH=new Map();
  function whizz(x,y,z,vx,vy,vz,tca,kinetic){
   if(!unlocked||!graph)return false;const role=kinetic&&has('whizz-k')?'whizz-k':has('whizz-e')?'whizz-e':null;if(!role)return false;
   const buf=pick(SMP[role]),pk=peakAt(buf),t=now(),lead=Math.max(0,num(tca,0)-pk);
   const e=emitter('z'+(++seq),{bus:'impacts',role,buf,x,y,z,vx,vy,vz,R:range('whizz'),ref:30,level:1.3,prio:.2,gain:.65*jit(1,.1),rate:jit(1,.05),dur:num(buf.duration,1)+lead});
   e.t0=t+lead;e.moving={x,y,z,vx,vy,vz,t0:t};stats.whizz++;return true;
  }
  // Damaged ships near the ear hiss and spark. list: [{id,x,y,z,len,hull(0..1)}]
  function damage(list){
   if(!unlocked||!graph)return 0;let n=0;const c=clock();
   for(const s of list||[]){
    const hurt=1-clamp(num(s.hull,1),0,1);if(hurt<.35)continue;
    if(has('vent')){emitter('v'+s.id,{list:true,bus:'impacts',role:'vent',loop:true,x:s.x,y:s.y,z:s.z,vx:0,vy:0,vz:0,R:range('hit',s.len),ref:Math.max(15,s.len*.5),level:.5+hurt*.4,gain:.18+.25*hurt,phase:(s.id*.73)%3});n++;}
    const k='sp'+s.id;if(!(recent[k]>c)){recent[k]=c+.6+Math.random()*2.2*(1.2-hurt);impact('sparks',s.x+(Math.random()-.5)*s.len*.4,s.y,s.z+(Math.random()-.5)*s.len*.4,s.len,.35+.5*hurt);}
   }
   return n;
  }
  function moveEmitters(){
   const t=now();for(const e of EM.values())if(e.moving){const m=e.moving,k=t-m.t0;e.x=m.x+m.vx*k;e.y=m.y+m.vy*k;e.z=m.z+m.vz*k;}
  }

  // ---- legacy one-shot weapon (the synth path, and shared hardware without a per-shot emitter) ----
  function weapon(style,x,y,z,g=1,fleet,size){
   if(!unlocked)return false;
   style=R[style]?style:'laser';
   const kind=style==='beam'||style==='phaser'?'beam':/^(arc|rail|ion-)/.test(style)?null:'shot';
   const own=fleet!=null&&kind?kind+'-'+fleet:null,role=own&&SMP[own]?own:SMP[style]?style:null;
   const ion=/^ion-/.test(style),pos=place(x,y,z,range(ion?'ion':kind==='beam'?'beam':'gun',size));
   if(!pos.heard){stats.culled++;return false;}
   const big=style==='ion-fire',base=big?3:1,prio=base+(1-pos.u)*.9;
   const build=role?(t,o)=>{const r=sample(role,t,o,jit(1,.06),jit(1,.12));return r?{src:[r.src],dur:r.dur}:R[style](t,o);}:R[style];
   const v=voice(style,prio,pos,clamp(num(g,1),0,2)*(big?1:.8)*pos.gain,pos.cutoff,build);
   if(!v)return false;
   if(big&&pos.u<.6)duck(['weapons','music','engines'],.35+.4*pos.u,.9,.8);// an ion strike clears the air
   if(style!=='ion-charge')return true;
   return {cancel(){if(!v.killed&&v.end>now())kill(v);},get active(){return !v.killed&&v.end>now();}};
  }

  // ---- explosions, layered by design ----
  // crack (near only) + body (explosion0-3) + a recorded sub thump + a debris tail + a hall tail.
  // Capitals add a staged break-up that follows the visual one (secondaries, groans, the core);
  // First Ones the end of an age. A capital heard close is followed by a deliberate dip: the war
  // drops away for a breath under a ringing tone, then comes back. The synth recipe below stays
  // for when there are no recordings; it has no pitched sub drop.
  function explosion(tier,x,y,z,boom){
   if(!unlocked)return false;
   tier=clamp(Math.round(num(tier,0)),0,3);
   const pos=place(x,y,z,range('explosion',tier)),d=pos.d,delay=Math.min(1.6,d/12000);
   if(!pos.heard)return farThunder(tier,pos,delay);
   const cutoff=pos.cutoff*TIER.tone[tier],g=TIER.gain[tier]*pos.gain;
   const prio=(tier>=2?3:2)+(1-pos.u)*.9,dur=TIER.dur[tier];
   const rec=SMP['explosion'+tier];
   const sig=boom&&SMP['boom-'+boom]?'boom-'+boom:null;
   const lay=(role,t,o,rate,gg)=>SMP[role]?sample(role,t,o,rate,gg):null;
   const base=rec?(t0,o)=>{
    const t=t0+delay,r=sample('explosion'+tier,t,o,jit(tier>=2?.94:1,.05),1),src=r?[r.src]:[];let end=r?r.dur:1;
    if(tier>=2&&SMP.explosion1)for(const k of [.35,.8]){const r2=sample('explosion1',t+k*(.8+Math.random()*.4),o,jit(.9,.08),.45);if(r2)src.push(r2.src);}
    const add=(r3,at=0)=>{if(r3){src.push(r3.src);end=Math.max(end,at+r3.dur);}};
    if(pos.u<.45)add(lay('xcrack',t,o,jit(1,.05),.55*(1-pos.u)));
    if(tier>=1)add(lay('xsub',t+.01,o,jit(1,.04),.5+.15*tier));
    if(tier>=1&&pos.u<.5)add(lay('xdebris',t+.35,o,jit(1,.06),.3+.1*tier),.35);
    if(tier>=2)add(lay('xtail',t+.6,o,jit(1,.04),.45),.6);
    if(tier===2)add(lay('capital-break',t+.25,o,jit(1,.03),.6),.25);
    if(tier===3)add(lay('age-end',t,o,1,.8));
    if(tier>=2&&pos.u<.35)add(lay('groan',t+1.4,o,jit(.9,.05),.5),1.4);
    if(tier>=2)duckFor(t,.35,1.2);
    return{src,dur:delay+end+(tier>=2?1.2:0)};
   }:(t0,o)=>{
    const t=t0+delay,src=[],near=clamp(cutoff/9000,0,1);
    if(near>.15){const c=noiseSrc(t,t+.07,1),hp=filter('bandpass',1200,.8),cg=env(gain(),t,.001,.5*near,.05);link(c,hp,cg,o);src.push(c);}
    const body=noiseSrc(t,t+dur,1),lp=filter('lowpass',Math.min(cutoff,2200+tier*350),.5),bg=gain();
    set(P(bg,'gain'),0,t);ramp(P(bg,'gain'),.9,t+.004+tier*.006);aim(P(bg,'gain'),0,t+.03+tier*.05,dur*.22);ramp(P(bg,'gain'),0,t+dur);
    if(lp)expo(lp.frequency,Math.max(180,cutoff*.03),t+dur*.8);link(body,lp,bg,o);src.push(body);
    if(tier>=1){const w=noiseSrc(t,t+dur*.6,1),wl=filter('lowpass',160,.5),wg=env(gain(),t,.006,.9+tier*.2,dur*.5);link(w,wl,wg,o);src.push(w);}
    if(tier>=2){for(const k of [.3,.65,1.1]){const tt=t+k*(.8+Math.random()*.4),n2=noiseSrc(tt,tt+1,1),l2=filter('lowpass',2400,.5),g2=env(gain(),tt,.004,.4,.9);if(l2)expo(l2.frequency,250,tt+.8);link(n2,l2,g2,o);src.push(n2);}}
    if(tier===3){
     for(const f of [311,317.5,466]){const s2=osc('sine',f,t+.4,t+dur),g2=gain();set(P(g2,'gain'),0,t+.4);ramp(P(g2,'gain'),.05,t+2.4);ramp(P(g2,'gain'),0,t+dur);link(s2,g2,o);src.push(s2);}
     const r=noiseSrc(t+1,t+dur,1),rl=filter('lowpass',700,.5),rg=gain();set(P(rg,'gain'),0,t+1);ramp(P(rg,'gain'),.35,t+2.5);ramp(P(rg,'gain'),0,t+dur);link(r,rl,rg,o);src.push(r);}
    return{src,dur:delay+dur};
   };
   const v=voice('explosion'+tier,prio,pos,g,cutoff,sig?(t0,o)=>{
    const r=base(t0,o),s2=sample(sig,t0+delay,o,jit(1,.05),[.55,.7,.85,.9][tier]);
    if(s2){r.src.push(s2.src);r.dur=Math.max(r.dur,delay+s2.dur);}return r;
   }:base,false,'explosions');
   const dip=!!(v&&tier>=2&&pos.u<.4&&silenceAfter(now()+delay,tier,pos.u));
   return v?{delay,cutoff,gain:g,tier,distance:d,far:false,dip}:false;
  }
  // The dip: the blast lands (0.9 s), then everything, the explosion's own long tail included, falls
  // ~20 dB for 1.6 s (2.4 s for a First One) under a ringing tone, then the war returns over 2.5 s
  // with the break-up's secondaries. The hall send is taken before the duck, so its tail rolls on.
  let lastDip=-1e9;
  function silenceAfter(t,tier,u){
   if(!graph||t-lastDip<6)return false;lastDip=t;stats.dips++;
   const depth=.1+.3*smooth(0,.4,u),hold=tier===3?2.4:1.6;
   duck(['weapons','engines','impacts','ambience','music','explosions'],depth,hold,2.5/3,t+.9);
   if(SMP.ringing){const r=sample('ringing',t+.8,graph.B.ui,1,.22*(1-u));if(r)voices.push({style:'ring',prio:0,out:r.g,src:[r.src],end:t+.8+r.dur,killed:false});}
   return true;
  }
  function farThunder(tier,pos,delay){
   const k=1-(pos.d-pos.R)/(1.5*pos.R);
   const role=SMP['xtail']&&tier>=2?'xtail':'explosion'+tier;
   if(tier<1||k<=0||!SMP['explosion'+tier]){stats.culled++;return false;}
   const g=TIER.gain[tier]*.18*k*k,cutoff=450;
   const v=voice('thunder',1+k*.5,{...pos,u:1},g,cutoff,(t0,o)=>{const r=sample(role,t0+delay,o,jit(.8,.05),1);return r?{src:[r.src],dur:delay+r.dur}:{src:[],dur:0};},true,'explosions');
   return v?{delay,cutoff,gain:g,tier,distance:pos.d,far:true}:false;
  }

  // ---- arrivals and exits ----
  // style: hyper (lightspeed snap), jump (vortex swell), warp (flash), conduit (transwarp tear),
  // rift (hive squelch), rocket (burn). Exits play the build's reversed takes.
  function arrival(style,x,y,z,size,exit){
   if(!unlocked||!graph)return false;
   const role=(exit?'exit-':'arrive-')+style;if(!has(role))return false;
   const pos=place(x,y,z,range('gun',size)*1.6);if(!pos.heard){stats.culled++;return false;}
   const big=num(size,20)>=180;stats.arrivals++;
   return !!voice(role,1.5+(1-pos.u)+(big?1:0),pos,(big?.9:.6)*pos.gain,pos.cutoff,(t,o)=>{const r=sample(role,t,o,jit(big?.9:1.05,.05),1);return r?{src:[r.src],dur:r.dur}:{src:[],dur:0};},true,'explosions');
  }

  // ---- fly-bys ----
  // With emitters the passing ship's own engine already swells, pans and drops in pitch; the
  // page's predicted pass adds only the whoosh (opts.layer). Called without it, as before, it
  // plays the fleet engine with a Doppler drop too (no per-ship emitters: file://, tests).
  function flyby(x,y,z,vx,vy,vz,fleet,size,tca,opts){
   if(!unlocked||!graph)return false;
   const layer=!!(opts&&opts.layer);
   // As a layer (the ship's own engine is already an emitter), the whoosh is a moving emitter on the
   // ship's path: panned in 3D and Doppler-shifted like everything else, its loudest moment on the
   // closest approach. Velocities from the page are relative to the camera; the ear's own velocity
   // is added back so the emitter moves through the world.
   if(layer){
    if(opt.flybyLayer===false)return false;
    const big=num(size,30)>150,wh=has('whoosh-'+(big?1:0))?'whoosh-'+(big?1:0):null;if(!wh)return false;
    const Rr=range('flyby',size),pc=place(num(x,0)+num(vx,0)*tca,num(y,0)+num(vy,0)*tca,num(z,0)+num(vz,0)*tca,Rr);if(!pc.heard){stats.culled++;return false;}
    const buf=pick(SMP[wh]),t=now(),lead=Math.max(0,clamp(num(tca,.5),0,2)-peakAt(buf)),wx=num(vx,0)+L.vx,wy=num(vy,0)+L.vy,wz=num(vz,0)+L.vz;
    const e=emitter('f'+(++seq),{ship:opts.ship,bus:'engines',role:wh,buf,x,y,z,vx:wx,vy:wy,vz:wz,R:Rr,ref:Math.max(20,num(size,20)*2),level:1.3,prio:.8,gain:big?.4:.2,rate:jit(1,.04),noDoppler:true,dur:num(buf.duration,1)+lead});// the recording has its own Doppler
    e.t0=t+lead;e.moving={x:num(x,0),y:num(y,0),z:num(z,0),vx:wx,vy:wy,vz:wz,t0:t};return {tca,gain:pc.gain,distance:pc.d};
   }
   const Rr=range('flyby',size),at=k=>[num(x,0)+num(vx,0)*k,num(y,0)+num(vy,0)*k,num(z,0)+num(vz,0)*k];
   tca=clamp(num(tca,.5),0,2);
   const pc=place(...at(tca),Rr);if(!pc.heard){stats.culled++;return false;}
   const p0=place(x,y,z,Rr*4),p1=place(...at(tca+1.2),Rr*4);
   const eng=!layer&&fleet!=null?'engine-'+fleet:null;if(eng&&!SMP[eng])want(eng);
   const big=num(size,30)>150,wh=SMP['whoosh-'+(big?1:0)]?'whoosh-'+(big?1:0):null;
   if(!(eng&&SMP[eng])&&!wh)return false;
   const sp=Math.hypot(num(vx,0),num(vy,0),num(vz,0)),dop=clamp(sp/5000,.04,.2),out=tca+1.3;
   const v=voice('flyby',2.4+(1-pc.u)*.9,{...pc,pan:0},pc.gain*(big?1.1:.9)*(layer?.8:1),Math.max(3000,pc.cutoff),(t,o)=>{
    const src=[],pan=mk('createStereoPanner');if(pan){const pp=P(pan,'pan');set(pp,p0.pan,t);ramp(pp,pc.pan,t+tca);ramp(pp,p1.pan,t+out);}
    const bus=pan||o;if(pan)link(pan,o);
    if(eng&&SMP[eng]){
     const e=gain(0);link(e,bus);const ep=P(e,'gain');set(ep,0,t);ramp(ep,.9,t+tca);ramp(ep,0,t+out);
     const r=sample(eng,t,e,1+dop,1,true);if(r){const pr=P(r.src,'playbackRate');set(pr,1+dop,t+Math.max(0,tca-.2));ramp(pr,1-dop,t+tca+.25);stop(r.src,t+out+.05);src.push(r.src);}
    }
    if(wh){const b=pick(SMP[wh]),st=t+Math.max(0,tca-peakAt(b)),r=sample(wh,st,bus,1,.8,false,b);if(r)src.push(r.src);}
    return{src,dur:out};
   },true,'engines');
   return v?{tca,gain:pc.gain,distance:pc.d}:false;
  }

  // ---- the synth engine drone (legacy: the followed ship when there are no recordings) ----
  function droneBuild(style,speed){
   const t=now(),out=gain(0),lp=filter('lowpass',900,.5),src=[],sp=clamp(num(speed,.5),0,1);
   if(!out)return null;link(lp,out,graph.B.engines);
   const d={out,lp,src,style,oscs:[],noise:null,ng:null};
   const add=(type,f,g)=>{const o=osc(type,f,t),og=gain(g);link(o,og,lp);if(o){src.push(o);d.oscs.push({o,f});}};
   const nz=(g,type,f,q)=>{const n=noiseSrc(t,null,1),bf=filter(type,f,q),ng=gain(g);link(n,bf,ng,lp);if(n)src.push(n);d.noise=bf;d.ng=ng;};
   if(style==='turbine'){add('sine',220,.2);add('sine',330,.08);nz(.12,'bandpass',1200,1.2);}
   else if(style==='organic'){add('triangle',180,.2);add('triangle',181.5,.18);nz(.1,'bandpass',700,1.5);}
   else if(style==='roar'){add('triangle',160,.15);nz(.2,'bandpass',600,.8);}
   else {d.style='hum';add('sine',174,.2);add('sine',261,.08);}
   d.base=.06;d.aud=1;aim(out.gain,.06,t,.3);droneSpeed(d,sp);return d;
  }
  function droneSample(role,sp){
   const t=now(),out=gain(0),lp=filter('lowpass',2000,.5);
   if(!out)return null;link(lp,out,graph.B.engines);
   const r=sample(role,t,lp,1,1,true);if(!r)return null;
   const d={out,lp,src:[r.src],style:role,oscs:[],smp:r.src,noise:null,ng:null,base:.1,aud:1};
   droneSpeed(d,sp);return d;
  }
  function droneSpeed(d,sp){
   if(d.smp){glide(P(d.smp,'playbackRate'),.88+sp*.3,.4);if(d.lp)glide(d.lp.frequency,(1400+sp*7000)*Math.max(.15,d.aud),.3);d.base=.1+sp*.08;glide(d.out.gain,d.base*d.aud,.3);return;}
   const k=d.style==='turbine'?1+sp*.6:d.style==='roar'?1+sp*.4:1+sp*.25;
   d.oscs.forEach(({o,f})=>glide(o.frequency,f*k,.3));
   if(d.lp)glide(d.lp.frequency,700+sp*(d.style==='turbine'?1800:900),.3);
   if(d.noise&&d.style==='turbine')glide(d.noise.frequency,1000+sp*1600,.3);
   if(d.ng)glide(d.ng.gain,(d.style==='roar'?.2:.1)+sp*.12,.3);
   glide(d.out.gain,d.base*d.aud,.3);
  }
  function engineDrone(key,style,speed01,fleet,x,y,z,size){
   if(!unlocked||!graph)return false;
   const aud=x==null?1:place(x,y,z,range('engine',size)).gain;
   const own=fleet!=null?'engine-'+fleet:null;if(own&&!SMP[own])want(own);
   const kind=own&&SMP[own]?own:style;
   if(drone&&key!=null&&drone.key===key&&drone.kind===kind){drone.aud=aud;droneSpeed(drone,clamp(num(speed01,.5),0,1));return true;}
   if(drone){const d=drone,t=now();call(d.out.gain,'cancelScheduledValues',t);aim(d.out.gain,0,t,.15);ramp(d.out.gain,0,t+.6);d.src.forEach(s=>stop(s,t+.65));drone=null;}
   if(key==null)return true;
   const d=kind===own?droneSample(own,clamp(num(speed01,.5),0,1)):droneBuild(style,speed01);if(!d)return false;
   d.key=key;d.kind=kind;if(!d.smp)d.style=style;d.aud=aud;droneSpeed(d,clamp(num(speed01,.5),0,1));drone=d;return true;
  }

  // ---- cockpit: Take control and Crew views ----
  // Inside: the ship's own engine as a low, filtered rumble through the hull, the cabin bed, the
  // pilot's own guns dry and centred, and the outside world muffled. Leaving crossfades back.
  const CK={on:false,key:null,eng:null,bed:null,engLP:null};
  function cockpit(state){
   if(!unlocked||!graph)return false;const t=now();
   const on=!!state,key=on?`${state.fleet}:${state.cls}`:null;
   if(on!==CK.on){CK.on=on;glide(graph.outsideLP.frequency,on?1100:20000,.25);glide(graph.outsideG.gain,on?.55:1,.25);glide(graph.inside.gain,on?1:0,.25);}
   if(key!==CK.key){
    for(const k of ['eng','bed'])if(CK[k]){const r=CK[k];call(r.g.gain,'cancelScheduledValues',t);aim(r.g.gain,0,t,.2);stop(r.src,t+1);CK[k]=null;}
    CK.key=key;
    if(on){
     const role=engineRole(state.fleet,state.cls||'f'),lp=filter('lowpass',state.cls==='f'?420:300,.9);link(lp,graph.insideEng);CK.engLP=lp;
     if(role){const r=sample(role,t,lp,state.cls==='f'?.8:.7,0,true,null,Math.random()*3);if(r){CK.eng=r;aim(r.g.gain,.9,t,.3);}}
     const bed=state.cls==='f'?'cockpit-f':'cockpit-c';
     if(has(bed)){const r=sample(bed,t,graph.insideEng,1,0,true,null,Math.random()*3);if(r){CK.bed=r;aim(r.g.gain,.45,t,.3);}}
    }
   }
   if(on&&CK.eng){const sp=clamp(num(state.speed,.5),0,1);aim(CK.eng.src.playbackRate,(state.cls==='f'?.75:.66)+.2*sp,t,.2);if(CK.engLP)aim(CK.engLP.frequency,300+500*sp,t,.2);}
   return true;
  }

  // ---- UI blips (not spatial, not capped) ----
  function ui(kind){
   if(!unlocked||!graph)return false;
   const t=now(),g=gain(.8),o=[];link(g,graph.B.ui);
   const tone=(type,f,f2,at,dur,peak)=>{const s=osc(type,f,t+at,t+at+dur+.02),e=env(gain(),t+at,.004,peak,dur);if(f2)expo(P(s,'frequency'),f2,t+at+dur);link(s,e,g);o.push(s);};
   if(kind==='open')tone('triangle',480,900,0,.12,.25);
   else if(kind==='close')tone('triangle',900,460,0,.12,.25);
   else if(kind==='confirm'){tone('sine',660,0,0,.09,.25);tone('sine',990,0,.08,.14,.22);}
   else if(kind==='tick')tone('sine',2400,0,0,.012,.08);
   else tone('sine',1400,1200,0,.025,.16);
   return true;
  }

  // ---- adaptive synth music (fallback): a warm string-like pad and a soft pluck ----
  const hz=s=>220*Math.pow(2,s/12);// pad sits from A3 up; nothing droning in the bass
  function musicInit(){
   if(M.ready||!graph)return;M.ready=true;
   const t=now(),padLP=filter('lowpass',900,.5),pad=gain(0),pulse=gain(0);
   link(pad,padLP,graph.duck);link(pulse,filter('lowpass',2400,.5),graph.duck);
   Object.assign(M,{padLP,pad,pulse,next:t+.1,step:0,chord:0});
   const lfo=osc('sine',.06,t),lg=gain(250);link(lfo,lg,P(padLP,'frequency'));
   CHORDS[0].forEach((s,i)=>{const f=hz(s),a=osc('sawtooth',f*.996,t),b=osc('sawtooth',f*1.004,t),g=gain(.05);link(a,g,pad);link(b,g);M.pads.push([a,b]);});
   aim(P(pad,'gain'),.3,t,3);
  }
  // The distant bed follows how much of the war is beyond hearing: pull the camera back and the
  // single shots fall away while the far battle swells; fly into a furball and it recedes.
  let distant=0;
  function setDistant(v){distant=clamp(num(v,0),0,1);if(B.ambG)aim(P(B.ambG,'gain'),.05+.6*distant,now(),1.2);}
  function setIntensity(v,mom){M.target=clamp(num(v,0),0,1);if(mom!=null)momentum=clamp(num(mom,0),-1,1);if(!M.ready)return;const i=M.target,t=now();
   if(S.on){mixStems();return;}
   if(B.musicG)aim(P(B.musicG,'gain'),.4+.25*i,t,2.5);
   if(M.sampled)return;
   aim(P(M.pad,'gain'),.28+.1*i,t,2.5);aim(P(M.pulse,'gain'),Math.max(0,(i-.3)/.7)*.3,t,2.5);aim(P(M.padLP,'frequency'),800+i*900,t,2.5);}
  function musicStep(t){
   const s=M.step++,chord=CHORDS[M.chord];
   if(s%CHORD_STEPS===0&&s>0){M.chord=(M.chord+1)%CHORDS.length;const c=CHORDS[M.chord];
    c.forEach((st,i)=>{const p=M.pads[i];if(p){aim(P(p[0],'frequency'),hz(st)*.996,t,1.2);aim(P(p[1],'frequency'),hz(st)*1.004,t,1.2);}});}
   if(M.level>.3&&PULSE[s%8]){const f=hz(chord[(s>>3)%chord.length])*2,a=osc('triangle',f,t,t+.5),g=env(gain(),t,.006,.18,.45);link(a,g,M.pulse);}
  }
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
   listenerVelocity(num(dt,0));moveEmitters();allocate();frame++;
   const k=1-Math.exp(-Math.max(0,num(dt,0))/2);M.level+=(M.target-M.level)*k;
   if(!M.ready||M.sampled)return;if(M.next<t)M.next=t+.05;
   for(let n=0;M.next<t+AHEAD&&n<8;n++){musicStep(M.next);M.next+=STEP;}
  }
  // List emitters (ships(), beams(), damage()) are declared each frame before update(); one that is
  // not declared again before the next update() has left the list and its voice is released.

  const api={
   unlock,setVolume,setListener,weapon,explosion,flyby,range,setDistant,loadSamples,useSamples,prepare,engine:engineDrone,ui,setIntensity,setSlowMo,stinger,update,
   ships,beams,shot,impact,whizz,damage,arrival,cockpit,coda,
   get unlocked(){return unlocked;},
   get hasSamples(){return Object.keys(SMP).length>0;},
   set quality(q){budget=BUDGETS[q]||BUDGETS.High;},
   get headphones(){return perf.hrtf;},
   set headphones(v){perf.hrtf=!!v;try{const s=storage();if(s)s.setItem(KEY+'Hrtf',v?'1':'0');}catch(e){}},
   get budgets(){return {...budget};},
   volumes:all=>all?{...vol,...mixVol}:{...vol},
   stats(){prune();const g=groupStats();return{voices:voices.filter(v=>!v.killed).length,maxVoices,dropped:stats.dropped,culled:stats.culled,played:stats.played,peak:stats.peak,
    engines:g.engines,weapons:g.weapons,impacts:g.impacts,hrtf:g.hrtf,fading:g.fading,emitters:EM.size,handoffs:stats.handoffs,modelSwaps:stats.modelSwaps,bytes:bytes.loaded,limiter:!!(graph&&graph.limiter),whizz:stats.whizz,hits:stats.hits,shields:stats.shields,arrivals:stats.arrivals,beams:stats.beams,dips:stats.dips,cockpit:CK.on,focus:+(focus.v||1).toFixed(2)};},
   suspend(){try{const r=ctx&&ctx.suspend&&ctx.suspend();if(r&&r.catch)r.catch(()=>{});}catch(e){}},
   resume(){try{const r=ctx&&unlocked&&ctx.resume&&ctx.resume();if(r&&r.catch)r.catch(()=>{});}catch(e){}},
   styles:WEAPONS.slice(),
   _debug:{EM,L,S,meters(){const o={},buf=new Float32Array(2048);if(!graph)return o;const e={};for(const k in graph.meters){graph.meters[k].getFloatTimeDomainData(buf);let s2=0;for(let i=0;i<buf.length;i++)s2+=buf[i]*buf[i];e[k]=s2/buf.length;}
    for(const k in e)if(k.endsWith('L')){const b=k.slice(0,-1),l=e[k],r=e[b+'R'];o[b]=+(10*Math.log10((l+r)/2+1e-12)).toFixed(1);o[b+'Pan']=l+r>1e-12?+((r-l)/(r+l)).toFixed(2):0;}return o;}}
  };
  return api;
 }
 const API={create,doppler,micBlend,distGain,BUDGETS,SOUND_SPEED,DOP_LO,DOP_HI};
 if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.ArmadaAudio=API;
})(typeof window==='object'?window:globalThis);
