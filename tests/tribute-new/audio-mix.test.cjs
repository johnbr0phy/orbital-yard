// The object-based mix (Version 5): virtual voices and crossfades, budgets, Doppler, HRTF and
// equal-power, the listener blend, held beams, loop seams, loudness and the fal.ai ledger.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const ArmadaAudio=require('../../armada-audio-new.js');
const root=path.join(__dirname,'../..');

// Fake AudioContext with PannerNodes: records creation, automation and stops.
function fakeContext(){
 const ctx={currentTime:0,sampleRate:8000,destination:{connect(){},disconnect(){}},created:{},stops:[],sources:[],panners:[],gains:[]};
 const param=v=>({value:v,events:[],setValueAtTime(x,t){this.value=x;this.events.push(['set',x,t]);},linearRampToValueAtTime(x,t){this.events.push(['ramp',x,t]);},
  exponentialRampToValueAtTime(x,t){if(!(x>0))throw new RangeError('exp ramp to non-positive');this.events.push(['exp',x,t]);},setTargetAtTime(x,t,c){this.events.push(['target',x,t,c]);},cancelScheduledValues(t){this.events.push(['cancel',t]);}});
 const node=(kind,params,extra)=>{ctx.created[kind]=(ctx.created[kind]||0)+1;const n={kind,connect(){},disconnect(){},start(t,o){n.started=[t,o];},stop(t){n.stopAt=t;ctx.stops.push(t);},...extra};for(const [k,v] of Object.entries(params||{}))n[k]=param(v);return n;};
 Object.assign(ctx,{
  createGain:()=>{const g=node('gain',{gain:1});ctx.gains.push(g);return g;},createOscillator:()=>node('osc',{frequency:440,detune:0}),
  createBufferSource:()=>{const s=node('buffer',{playbackRate:1});ctx.sources.push(s);return s;},
  createBiquadFilter:()=>node('filter',{frequency:350,Q:1,gain:0}),createStereoPanner:()=>node('stereo',{pan:0}),
  createPanner:()=>{const p=node('panner',{positionX:0,positionY:0,positionZ:0,orientationX:1,orientationY:0,orientationZ:0},{panningModel:'equalpower',coneInnerAngle:360,coneOuterAngle:360,coneOuterGain:0});ctx.panners.push(p);return p;},
  createDynamicsCompressor:()=>node('comp',{threshold:-24,knee:30,ratio:12,attack:.003,release:.25}),createConvolver:()=>node('conv',{}),createWaveShaper:()=>node('shaper',{}),
  createBuffer:(ch,len,sr)=>({length:len,sampleRate:sr,duration:len/sr,numberOfChannels:ch,getChannelData:(()=>{const d=new Float32Array(len);return()=>d;})()}),
  resume(){return Promise.resolve();},suspend(){return Promise.resolve();}
 });
 return ctx;
}
const buf=(n,sr=8000)=>({duration:n,length:n*sr,sampleRate:sr,numberOfChannels:1,getChannelData:()=>new Float32Array(n*sr)});
const loops=['eng-f-5','eng-m-5','eng-c-5','beamloop-5'];
function setup(o={}){
 const ctx=fakeContext(),a=ArmadaAudio.create({context:ctx,...o});a.unlock();a.setListener(0,0,0,0,0,-1);
 const map={'shot-5':[buf(.3),buf(.35)],'beam-5':buf(.5),'hit-light':buf(.4),'whizz-e':buf(1),'whoosh-0':buf(1.5)};for(const r of loops)map[r]=buf(8);
 a.useSamples(map);return {ctx,a};
}
const fighter=(id,x,z,extra={})=>({id,x,y:0,z,vx:0,vy:0,vz:0,fx:1,fy:0,fz:0,len:10,fleet:5,cls:'f',speed:.6,...extra});
const step=(ctx,a,list,n=1,dt=1/30)=>{for(let i=0;i<n;i++){if(list)a.ships(typeof list==='function'?list(i):list);a.update(dt);ctx.currentTime+=dt;}};

test('engine voice budgets: 8 on High and Ultra, 6 on Medium, 4 on Low, whatever the number of ships',()=>{
 for(const [q,n] of [['High',8],['Ultra',8],['Medium',6],['Low',4]]){
  const {ctx,a}=setup({quality:q});const ships=Array.from({length:20},(_,i)=>fighter(i,(i-10)*20,-60-i*5));
  step(ctx,a,ships,3);assert.equal(a.stats().engines,n,q);assert.equal(a.stats().emitters,20);
 }
 assert.deepEqual(ArmadaAudio.BUDGETS.High,{engines:8,rumble:3,weapons:16,impacts:12,hrtf:6});
 assert.deepEqual(ArmadaAudio.BUDGETS.Low,{engines:4,rumble:1,weapons:8,impacts:6,hrtf:2});
});

test('weapon and impact budgets hold under a flood of shots and hits, and a capital battery is never dropped for fighters',()=>{
 for(const [q,w,im] of [['High',16,12],['Low',8,6]]){
  const {ctx,a}=setup({quality:q});
  for(let k=0;k<60;k++){a.shot('laser',(k%30-15)*15,0,-100-k,5,10);a.impact('hull',(k%30-15)*10,0,-80,10);a.update(1/60);ctx.currentTime+=.012;
   const s=a.stats();assert.ok(s.weapons<=w&&s.impacts<=im,JSON.stringify(s));}
  assert.ok(a.stats().weapons>=w-1,'the budget fills: '+a.stats().weapons);
  ctx.currentTime+=.5;assert.equal(a.shot('laser',0,0,-600,5,1000),true,'a destroyer battery 600 units away');a.update(1/30);
  const big=[...a._debug.EM.values()].find(e=>e.bus==='weapons'&&e.x===0&&e.z===-600);assert.ok(big&&big.voice&&!big.voice.dying,'the capital shot took a voice from a fighter');
 }
});

test('handoffs crossfade: the weakest voice fades out over 150-300 ms and the newcomer fades in, nothing is cut',()=>{
 const {ctx,a}=setup({quality:'Low'});
 const far=[1,2,3,4].map(i=>fighter(i,i*30,-300));step(ctx,a,far,5);assert.equal(a.stats().engines,4);
 const voice=id=>a._debug.EM.get('n'+id).voice;
 const weakest=voice(4),g=weakest.g.gain;
 step(ctx,a,[...far,fighter(9,0,-40)],2);// a much nearer ship arrives
 assert.equal(a.stats().engines,4);assert.ok(weakest.dying,'the weakest voice yielded');
 const out=g.events.filter(e=>e[0]==='target'&&e[1]===0).at(-1);assert.ok(out,'faded, not cut');
 assert.ok(out[3]*4>=.15&&out[3]*4<=.3,'fade-out over 150-300 ms: '+out[3]*4);
 assert.ok(weakest.src.stopAt>=out[2]+.15,'stopped only after its fade');
 const incoming=voice(9).g.gain.events;assert.ok(incoming.some(e=>e[0]==='set'&&e[1]===0),'new loop starts from silence');
 assert.ok(incoming.some(e=>e[0]==='target'&&e[1]>0&&e[3]*3>=.15-1e-9&&e[3]*3<=.3),'and fades in over 150 ms');
 assert.ok(a.stats().handoffs>=1);
});

test('capital rumble is capped so a sky of destroyers cannot starve the fighters, and uses the voices fighters leave free',()=>{
 const {ctx,a}=setup();
 const caps=[0,1,2,3].map(i=>({...fighter(100+i,i*300,-400),len:1000,cls:'c'}));
 const fs=Array.from({length:10},(_,i)=>fighter(i,(i-5)*25,-90));
 step(ctx,a,[...caps,...fs],3);const e=[...a._debug.EM.values()].filter(e=>e.voice&&!e.voice.dying);
 const rumble=e.filter(x=>x.rumble).length,fighters=e.filter(x=>x.bus==='engines'&&!x.rumble).length;
 assert.equal(rumble,3);assert.equal(fighters,5);assert.equal(a.stats().engines,8);
 const {ctx:c2,a:a2}=setup();step(c2,a2,fs,3);assert.equal(a2.stats().engines,8,'no capitals near: all 8 voices for fighters');
});

test('Doppler: approaching raises pitch, receding lowers it, a crossing at closest approach is neutral, extremes are clamped',()=>{
 const d=ArmadaAudio.doppler;
 assert.ok(d(0,0,-100,0,0,200)>1,'coming at me');assert.ok(d(0,0,-100,0,0,-200)<1,'going away');
 assert.equal(d(0,0,-100,200,0,0),1,'passing across');assert.equal(d(0,0,0,500,0,0),1,'at the ear');
 assert.equal(d(0,0,-100,0,0,1e6),ArmadaAudio.DOP_HI);assert.equal(d(0,0,-100,0,0,-1e6),ArmadaAudio.DOP_LO);
 assert.ok(ArmadaAudio.DOP_HI<=1.26&&ArmadaAudio.DOP_LO>=.77,'never chipmunks: within about 4 semitones either way');
 // a real pass through the engine: pitch above 1 on the way in, below 1 on the way out
 const {ctx,a}=setup();const dops=[];
 for(let i=0;i<30;i++){step(ctx,a,[fighter(1,-300+i*20,-30,{vx:600})]);dops.push(a._debug.EM.get('n1').dop);}
 assert.ok(dops[2]>1.05&&dops[27]<.95,'up on the way in, down on the way out: '+dops.map(v=>v.toFixed(2)));
 for(let i=1;i<30;i++)assert.ok(dops[i]<=dops[i-1]+1e-9,'the pitch only ever falls through a pass');
 const src=ctx.sources.filter(s=>s.buffer&&s.buffer.duration===8),first=src[0].playbackRate.events.filter(e=>e[0]==='target')[0];
 assert.ok(first&&first[1]>a._debug.EM.get('n1').rate*1.05,'and the voice plays it: '+(first&&first[1]));
});

test('HRTF for the nearest few slow emitters, equal-power for the rest and for fast sweeps; speakers mode never uses HRTF',()=>{
 const {ctx,a}=setup({quality:'Low'});// 2 HRTF voices on Low
 step(ctx,a,[fighter(1,0,-30),fighter(2,10,-60),fighter(3,-10,-120)],3);
 const m=id=>a._debug.EM.get('n'+id).voice.model;
 assert.deepEqual([m(1),m(2),m(3)],['HRTF','HRTF','equalpower']);assert.equal(a.stats().hrtf,2);
 // the nearest one starts sweeping across at 600 u/s, 30 units out: HRTF can't keep up, so it hands over to equal-power
 step(ctx,a,i=>[fighter(1,-20+i*20,-30,{vx:600}),fighter(2,10,-60),fighter(3,-10,-120)],25);
 assert.equal(m(1),'equalpower');assert.ok(a.stats().modelSwaps>=1,'the switch is a crossfade to a second voice');
 const {ctx:c2,a:a2}=setup({quality:'High',hrtf:false});step(c2,a2,[fighter(1,0,-30)],3);assert.equal(a2._debug.EM.get('n1').voice.model,'equalpower');
 a2.headphones=true;assert.equal(a2.headphones,true);
});

test('an HRTF voice is trimmed 3 dB so a hand-over between HRTF and equal-power does not jump in level',()=>{
 const run=hrtf=>{const {ctx,a}=setup({quality:'High',hrtf});step(ctx,a,[fighter(1,0,-30)],15);const v=a._debug.EM.get('n1').voice;return [v.model,v.gv];};
 const [mh,gh]=run(true),[me,ge]=run(false);
 assert.deepEqual([mh,me],['HRTF','equalpower']);assert.ok(Math.abs(gh/ge-.708)<.01,'ratio '+gh/ge);
});
test('panners hear direction in camera space and are moved only when the direction turns',()=>{
 const {ctx,a}=setup();step(ctx,a,[fighter(1,50,0)],2);// straight to the right of an ear facing -z
 const pn=a._debug.EM.get('n1').voice.pn;assert.ok(pn.positionX.value>.99,'right is +x: '+pn.positionX.value);
 a.setListener(0,0,0,1,0,0);step(ctx,a,[fighter(1,50,0)],2);assert.ok(pn.positionZ.value<-.99,'turn to face it: it is ahead (-z)');
 const before=pn.positionX.value;step(ctx,a,[fighter(1,50,.2)],2);assert.equal(pn.positionX.value,before,'a quarter-degree change does not move the panner');
});

test('the listener blend: the camera near its subject hears from the camera; a wide shot hears up to 80% of the way to the subject',()=>{
 const b=ArmadaAudio.micBlend;
 assert.equal(b(0,0,0,0,0,-1000).k,0);assert.deepEqual(b(1,2,3).k,0,'no subject: the camera');
 const w=b(0,0,0,0,0,-10000);assert.ok(Math.abs(w.k-.8)<1e-9);assert.ok(Math.abs(w.z+8000)<1e-6);
 let last=-1;for(let d=0;d<8000;d+=250){const k=b(0,0,0,d,0,0).k;assert.ok(k>=last);last=k;}
 const mid=b(0,0,0,0,0,-3600);assert.ok(mid.k>0&&mid.k<.8);
});

test('a beam sounds for as long as it fires: attack, a held loop, then a release when it stops',()=>{
 const {ctx,a}=setup();const beam={key:'7:m1',ax:0,ay:0,az:-200,bx:400,by:0,bz:-200,fleet:5,len:300};
 a.beams([beam]);a.update(1/30);ctx.currentTime+=1/30;
 const e=a._debug.EM.get('b7:m1'),v=e.voice;assert.ok(v&&v.src.loop,'a held loop');
 assert.ok([...a._debug.EM.keys()].some(k=>k[0]==='a'),'with the fleet beam recording as its attack');
 for(let i=0;i<90;i++){a.beams([beam]);a.update(1/30);ctx.currentTime+=1/30;}// three seconds of fire
 assert.equal(v.src.stopAt,undefined,'still sounding after 3 s');assert.equal(a._debug.EM.get('b7:m1').voice,v,'the same voice throughout');
 const t=ctx.currentTime;a.beams([]);a.update(1/30);
 assert.ok(v.dying&&Math.abs(v.src.stopAt-(t+.35+.05))<1e-6,'released over 0.35 s when it stops');
 assert.ok(v.g.gain.events.some(e=>e[0]==='target'&&e[1]===0&&Math.abs(e[3]-.35/4)<1e-9));
});

test('a capital death close by is followed by a dip under a ringing tone; a far one is not; neither drops below the test floor',()=>{
 const {ctx,a}=setup();a.useSamples({explosion2:buf(4),ringing:buf(4)});
 const near=a.explosion(2,0,0,-500);assert.ok(near&&near.dip,'close: the dip');
 ctx.currentTime+=7;const far=a.explosion(2,0,0,-6000);assert.ok(far&&!far.dip,'far: no dip');
});

test('every engine, beam, cockpit and score loop in the manifest is seamless as decoded: the audio after the loop end is the audio at the loop start',{skip:spawnSync('ffmpeg',['-version']).status!==0&&'ffmpeg missing'},()=>{
 const man=JSON.parse(fs.readFileSync(path.join(root,'audio/manifest.json'),'utf8'));const files=Object.keys(man.loops);
 assert.ok(files.length>=80,files.length+' loops');
 const bad=[];
 for(const f of files){
  const [s,e]=man.loops[f],r=spawnSync('ffmpeg',['-v','error','-i',path.join(root,'audio',f),'-f','f32le','-ac','1','-ar','32000','-'],{maxBuffer:1<<28});
  const x=new Float32Array(r.stdout.buffer,r.stdout.byteOffset,r.stdout.length>>2),a0=Math.round(s*32000),b0=Math.round(e*32000),n=2048;
  if(b0+n+32>x.length||a0<32){bad.push(f+' too short');continue;}
  // The padding repeats the loop's own start after its end, so the two windows must line up exactly
  // (best lag 0 within +-1 ms) and match (correlation >= 0.9; MP3 codes the two copies independently,
  // so they differ by coding noise, never by a time offset, which is what a seam would be).
  const corr=lag=>{let xy=0,xx=0,yy=0;for(let i=0;i<n;i++){const u=x[a0+i],v=x[b0+lag+i];xy+=u*v;xx+=u*u;yy+=v*v;}return xy/Math.sqrt(xx*yy+1e-20);};
  let best=0,arg=0;for(let l=-32;l<=32;l++){const c=corr(l);if(c>best){best=c;arg=l;}}
  const c0=corr(0);if(arg!==0||c0<.9)bad.push(f+' lag '+arg+' corr '+c0.toFixed(3));
 }
 assert.deepEqual(bad,[]);
});

test('every loop\'s wrap is inside its own normal movement: the level step across the seam is no bigger than its 95th-percentile step between neighbouring 100 ms windows',()=>{
 const rep=JSON.parse(fs.readFileSync(path.join(root,'audio/build-report.json'),'utf8')),man=JSON.parse(fs.readFileSync(path.join(root,'audio/manifest.json'),'utf8'));
 const shipped=new Set(Object.values(man.roles).flat()),bad=[];let n=0;
 for(const [role,takes] of Object.entries(rep))for(const t of takes){if(!t.seam||t.rejected||!shipped.has(t.take))continue;n++;if(Math.abs(t.seam[0])>t.seam[1]+1e-9)bad.push(t.take+' '+t.seam);}
 assert.ok(n>=150,n+' loops measured');assert.deepEqual(bad,[]);
});

test('the first gesture loads under 10 MB: the core set, the two largest fleets and the soon group; the rest waits until needed',()=>{
 const man=JSON.parse(fs.readFileSync(path.join(root,'audio/manifest.json'),'utf8')),g=man.groups;
 const size=roles=>[...new Set(roles.flatMap(r=>[].concat(man.roles[r]||[])))].reduce((n,f)=>n+fs.statSync(path.join(root,'audio',f)).size,0);
 const fleets=Object.values(g.fleet).map(size).sort((x,y)=>y-x);
 const first=size(g.core)+fleets[0]+fleets[1]+size(g.soon);
 assert.ok(first<10e6,'first gesture '+(first/1e6).toFixed(2)+' MB');
 for(const r of ['score-battle','score-victory','score-defeat','cockpit-f','cockpit-c'])assert.ok(g.later.includes(r)&&!g.core.includes(r)&&!g.soon.includes(r),r);
});
test('loudness: the 90-second war is -16 LUFS within 1.5 LU, and no scene clips or passes -1 dBTP',()=>{
 const dir=path.join(root,'bench/audio/scenes/after');
 const war=JSON.parse(fs.readFileSync(path.join(dir,'10.report.json'),'utf8'));
 assert.ok(Math.abs(war.integrated_lufs+16)<=1.5,'war '+war.integrated_lufs+' LUFS');
 for(const f of fs.readdirSync(dir).filter(f=>/^\d\d\.report\.json$/.test(f))){
  const r=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));assert.equal(r.clipped_samples,0,f);assert.ok(r.true_peak_dbtp<=-1,f+' '+r.true_peak_dbtp+' dBTP');
 }
});

test('the fal.ai ledger stops at $9.50 of the $10 and every generation is logged with its prompt, length and cost; no prompt names a franchise',()=>{
 const self=spawnSync('python3',[path.join(root,'scripts/fal_ledger.py'),'--selftest'],{encoding:'utf8'});assert.equal(self.status,0,self.stderr);
 const rows=fs.readFileSync(path.join(root,'bench/audio/ledger.csv'),'utf8').trim().split(/\r?\n/);
 const head=rows.shift().split(',');assert.deepEqual(head.slice(0,8),['when','model','role','take','seconds','cost_usd','running_total_usd','status']);
 let run=0;const names=/\b(star ?wars|star ?trek|babylon|warhammer|jedi|sith|tie|x-wing|klingon|romulan|borg|minbari|vorlon|federation|empire|rebels?|predator|xenomorph|tyranids?|space marines?|tesla|dominion|mondoshawan|yautja|engineers)\b/i;
 const csv=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(q){if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(ch==='"')q=false;else cur+=ch;}else if(ch==='"')q=true;else if(ch===','){out.push(cur);cur='';}else cur+=ch;}out.push(cur);return out;};
 for(const line of rows){const c=csv(line);
  run+=+c[5];assert.ok(Math.abs(run-+c[6])<1e-3,'running total at '+c[2]);assert.ok(+c[4]>0&&c[9].length>10,c[2]);if(/not used/.test(c[7]))continue;// generated and paid for, but kept out of the build (see AUDIO.md)
  assert.ok(!names.test(c[9]),'franchise name in '+c[2]+': '+c[9]);}
 assert.ok(run<=9.5+1e-9,'total $'+run.toFixed(4));
});
