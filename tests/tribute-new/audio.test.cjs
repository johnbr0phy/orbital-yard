const test=require('node:test'),assert=require('node:assert/strict');
const ArmadaAudio=require('../../armada-audio-new.js');

// Minimal fake AudioContext: records node creation, start/stop calls and param automation.
function fakeContext(){
 const ctx={currentTime:0,sampleRate:8000,destination:{connect(){},disconnect(){}},created:{},stops:0,resumed:0};
 const param=v=>({value:v,events:[],setValueAtTime(x,t){this.value=x;this.events.push(['set',x,t]);},linearRampToValueAtTime(x,t){this.events.push(['ramp',x,t]);},
  exponentialRampToValueAtTime(x,t){if(!(x>0))throw new RangeError('exp ramp to non-positive');this.events.push(['exp',x,t]);},setTargetAtTime(x,t,c){this.events.push(['target',x,t,c]);},cancelScheduledValues(){}});
 const node=(kind,params)=>{ctx.created[kind]=(ctx.created[kind]||0)+1;const n={kind,connect(){},disconnect(){},start(){},stop(){ctx.stops++;}};for(const [k,v] of Object.entries(params||{}))n[k]=param(v);return n;};
 Object.assign(ctx,{
  createGain:()=>node('gain',{gain:1}),createOscillator:()=>node('osc',{frequency:440,detune:0}),createBufferSource:()=>node('buffer',{playbackRate:1}),
  createBiquadFilter:()=>node('filter',{frequency:350,Q:1,gain:0}),createStereoPanner:()=>node('panner',{pan:0}),
  createDynamicsCompressor:()=>node('comp',{threshold:-24,knee:30,ratio:12,attack:.003,release:.25}),createDelay:()=>node('delay',{delayTime:0}),
  createBuffer:(ch,len,sr)=>({length:len,sampleRate:sr,getChannelData:(()=>{const d=new Float32Array(len);return()=>d;})()}),
  resume(){ctx.resumed++;return Promise.resolve();},suspend(){return Promise.resolve();}
 });
 return ctx;
}
const setup=(o={})=>{const ctx=fakeContext(),a=ArmadaAudio.create({context:ctx,...o});return {ctx,a};};
const count=ctx=>Object.values(ctx.created).reduce((n,v)=>n+v,0);

test('module loads and every play call is a silent no-op before unlock',()=>{
 const {ctx,a}=setup();assert.equal(a.unlocked,false);
 assert.equal(a.weapon('laser',0,0,0),false);assert.equal(a.explosion(2,0,0,0),false);assert.equal(a.ui('click'),false);
 assert.equal(a.engine('s1','hum',.5),false);assert.equal(a.stinger(),false);a.update(.1);a.setIntensity(1);a.setSlowMo(true);
 assert.equal(count(ctx),0);assert.equal(a.stats().played,0);
 assert.equal(a.unlock(),true);assert.equal(a.unlock(),true);assert.equal(a.unlocked,true);
 assert.equal(ctx.created.comp,1,'graph built once');assert.equal(a.weapon('laser',0,0,-100),true);
});

test('voice cap is never exceeded under 500 rapid weapon calls',()=>{
 const {ctx,a}=setup({maxVoices:24});a.unlock();const styles=['laser','phaser','pulse','kinetic','plasma','organic','ion-fire','arc','rail','beam','bogus'];
 for(let i=0;i<500;i++){ctx.currentTime+=.003+(i%7)*.002;a.weapon(styles[i%styles.length],Math.sin(i)*8000,Math.cos(i*3)*500,-Math.abs(Math.cos(i))*9000);if(i%10===0)a.update(.016);
  const s=a.stats();assert.ok(s.voices<=24,`voices ${s.voices}`);}
 const s=a.stats();assert.ok(s.peak<=24&&s.peak>=20,JSON.stringify(s));assert.ok(s.dropped>0);assert.ok(s.played>24);
});

test('identical style is rate limited to two per 25ms and counts as dropped',()=>{
 const {a}=setup();a.unlock();const r=Array.from({length:10},()=>a.weapon('laser',0,0,-50));
 assert.deepEqual(r.filter(Boolean).length,2);assert.equal(a.stats().dropped,8);
});

test('high priority explosion replaces a weapon voice when full; low priority is dropped',()=>{
 const {ctx,a}=setup({maxVoices:4});a.unlock();
 for(const s of ['laser','pulse','rail','beam'])assert.equal(a.weapon(s,0,0,-500),true);
 assert.equal(a.stats().voices,4);const stops=ctx.stops;
 assert.equal(a.weapon('phaser',0,0,-500),false,'equal-priority weapon dropped');assert.equal(a.stats().dropped,1);
 const info=a.explosion(2,0,0,-800);assert.ok(info&&info.delay>=0);
 assert.equal(a.stats().voices,4);assert.ok(ctx.stops>stops,'evicted voice stopped');
 assert.equal(a.weapon('arc',0,0,-500),false);assert.equal(a.stats().dropped,2);
 assert.ok(a.explosion(3,0,0,-100),'end-of-age beats remaining weapons');assert.equal(a.stats().voices,4);
});

test('volumes default, clamp and persist',()=>{
 const store={};global.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}};
 try{
  const {a}=setup();assert.deepEqual(a.volumes(),{master:.8,music:.5,sfx:.8});
  a.setVolume('music',4);a.setVolume('sfx',-1);a.setVolume('bogus',.3);assert.deepEqual(a.volumes(),{master:.8,music:1,sfx:0});
  assert.deepEqual(JSON.parse(store.tributeAudio),{master:.8,music:1,sfx:0});
  assert.deepEqual(setup().a.volumes(),{master:.8,music:1,sfx:0},'saved volumes load on create');
  store.tributeAudio='{broken';assert.deepEqual(setup().a.volumes(),{master:.8,music:.5,sfx:.8});
 }finally{delete global.localStorage;}
});

test('explosion delay grows and lowpass cutoff and gain fall with distance',()=>{
 const {a}=setup({maxVoices:64});a.unlock();a.setListener(0,0,0,0,0,-1);
 const r=[0,2000,10000,20000,40000,80000].map(d=>a.explosion(2,0,0,-d));
 for(let i=1;i<r.length;i++){assert.ok(r[i].delay>=r[i-1].delay);assert.ok(r[i].cutoff<r[i-1].cutoff||r[i].cutoff===r[i-1].cutoff&&i===r.length-1);assert.ok(r[i].gain<r[i-1].gain);}
 assert.equal(r[0].delay,0);assert.equal(r[5].delay,1.6);assert.ok(r[4].cutoff<=300&&r[0].cutoff>=10000,JSON.stringify(r));
 const t0=a.explosion(0,0,0,-1000),t3=a.explosion(3,0,0,-1000);assert.ok(t3.gain>t0.gain&&t3.cutoff<t0.cutoff);
});

test('far weapons are dropped, near ones play, unknown style falls back to laser',()=>{
 const {a}=setup();a.unlock();a.setListener(100,0,100,1,0,0);
 assert.equal(a.weapon('laser',100,0,-25000),false);assert.equal(a.stats().dropped,1);
 assert.equal(a.weapon('no-such-gun',100,0,5000),true);
 const h=a.weapon('ion-charge',0,0,0);assert.equal(typeof h.cancel,'function');assert.equal(h.active,true);
 h.cancel();assert.equal(h.active,false);assert.equal(a.stats().voices,1);
});

test('engine drone switching crossfades without creating voices',()=>{
 const {ctx,a}=setup();a.unlock();
 for(const [k,s] of [['a','turbine'],['a','turbine'],['b','hum'],['c','organic'],['c','roar'],[null,null]])assert.equal(a.engine(k,s,.7),true);
 const st=a.stats();assert.equal(st.voices,0);assert.equal(st.played,0);assert.ok(ctx.stops>0,'old drones stopped');
});

test('stinger is rate limited to one per 6s',()=>{
 const {ctx,a}=setup();a.unlock();assert.equal(a.stinger(),true);ctx.currentTime=3;assert.equal(a.stinger(),false);ctx.currentTime=6.1;assert.equal(a.stinger(),true);
});

test('update prunes expired voices and schedules music ahead without throwing',()=>{
 const {ctx,a}=setup();a.unlock();a.setIntensity(1);
 for(const s of ['laser','kinetic','ion-fire'])a.weapon(s,0,0,-300);a.explosion(1,0,0,-5000);a.ui('confirm');
 assert.equal(a.stats().voices,4);const before=ctx.created.osc;
 for(let i=0;i<600;i++){ctx.currentTime+=1/60;a.update(1/60);}
 assert.equal(a.stats().voices,0);assert.ok(ctx.created.osc>before,'music notes scheduled');
 a.setSlowMo(true);a.setSlowMo(false);a.suspend();a.resume();
});

test('never throws when optional node types are missing',()=>{
 const ctx=fakeContext();delete ctx.createStereoPanner;delete ctx.createBiquadFilter;delete ctx.createDynamicsCompressor;delete ctx.createBuffer;
 const a=ArmadaAudio.create({context:ctx});a.unlock();
 for(const s of a.styles)a.weapon(s,0,0,-200);a.explosion(3,0,0,-100);a.engine('x','turbine',1);a.ui('open');a.stinger();a.update(.5);
 assert.ok(a.stats().played>0);
});

test('no audible tone sits or slides below 150 Hz (low falling tones read as raspberries)',()=>{
 const ctx=fakeContext(),oscs=[],make=ctx.createOscillator;ctx.createOscillator=()=>{const o=make();oscs.push(o);return o;};
 const a=ArmadaAudio.create({context:ctx,maxVoices:64});a.unlock();a.setIntensity(1);a.setListener(0,0,0,0,0,-1);
 for(const s of a.styles){ctx.currentTime+=.1;a.weapon(s,0,0,-400);}
 for(const tier of [0,1,2,3]){ctx.currentTime+=.1;a.explosion(tier,0,0,-500);}
 for(const e of ['turbine','organic','roar','hum']){a.engine(e,e,0);a.engine(e,e,1);}
 a.stinger();for(const k of ['open','close','confirm','tick','click'])a.ui(k);
 for(let i=0;i<60*40;i++){ctx.currentTime+=1/60;a.update(1/60);}
 // Modulators (LFOs) run below 20 Hz and are inaudible as tones; everything else must stay >= 150 Hz.
 const bad=[];for(const o of oscs){const f=o.frequency,vals=[f.value,...f.events.map(e=>e[1])];if(vals.some(v=>v>=20&&v<150))bad.push(vals.map(v=>+(+v).toFixed(1)));}
 assert.deepEqual(bad,[],'low tones: '+JSON.stringify(bad.slice(0,5)));
 assert.ok(oscs.length>40,'exercised '+oscs.length+' oscillators');
});

test('recorded samples replace the synth per role and fall back where a role has none',()=>{
 const ctx=fakeContext(),srcs=[],make=ctx.createBufferSource;ctx.createBufferSource=()=>{const s=make();srcs.push(s);return s;};
 const a=ArmadaAudio.create({context:ctx,maxVoices:64});a.unlock();
 const buf=n=>({duration:n,length:n*8000,sampleRate:8000});
 assert.deepEqual(a.useSamples({laser:[buf(.3),buf(.4)],explosion2:buf(2),explosion1:buf(1),stinger:buf(3),music:buf(60),ambience:buf(20),empty:[]}).sort(),
  ['ambience','explosion1','explosion2','laser','music','stinger']);
 const loops=srcs.filter(s=>s.loop&&s.buffer&&s.buffer.duration>=20);assert.equal(loops.length,2,'music and ambience loop');
 const before=srcs.length,osc0=ctx.created.osc;
 assert.equal(a.weapon('laser',0,0,-300),true);
 assert.equal(srcs.length,before+1,'laser plays one recording');assert.equal(ctx.created.osc,osc0,'no synth oscillators for a sampled laser');
 assert.ok([.3,.4].includes(srcs.at(-1).buffer.duration));
 assert.equal(a.weapon('phaser',0,0,-300),true);assert.ok(ctx.created.osc>osc0,'phaser has no recording: synth');
 const n=srcs.length,info=a.explosion(2,0,0,-500);assert.ok(info&&info.tier===2);
 assert.equal(srcs.length,n+3,'capital death: main recording plus two secondary blasts');
 assert.equal(a.stinger(),true);assert.equal(srcs.at(-1).buffer.duration,3);
 for(let i=0;i<120;i++){ctx.currentTime+=1/60;a.update(1/60);}
});
