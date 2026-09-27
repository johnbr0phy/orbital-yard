// What the story pass must not break, and the story features the main story
// tests only touch in passing: rescues and tows saved, probe-based battle size,
// glowing fracture edges, convoy and station wins, the ion lance, blowout,
// replays borrowing a disabled capital's wreck mesh, and debris jerk.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {loadBattle}=require('./headless-battle.cjs');
const page=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');

function war(a,b,seed,size,seconds=0,force=null){
  const w=loadBattle({cores:1,modules:true});
  // Results cross the vm boundary as JSON so arrays compare by value.
  const run=w.run;w.run=code=>{const v=run(`JSON.stringify(${code})`);return v===undefined?undefined:JSON.parse(v);};w.exec=run;
  if(force)w.run(`storyForce=${JSON.stringify(force)}`);
  w.start(a,b,seed,size);if(seconds)w.step(seconds);return w;
}
// Push one side far away so nothing can interfere with a rescue.
const clearEnemies=side=>`for(const s of ships)if(s.side!==${side}&&!s.dead){s.x+=(s.side?1:-1)*60000;s.ai&&(s.ai.target=null);}`;

test('a screen saves a crippled capital when it holds for 22 s, and says so',()=>{
  const w=war(12,10,1101,40,20);
  const r=w.run(`(()=>{const st=battleAI.story,cap=ships.find(s=>s.side===1&&!s.dead&&s.arr&&s.ai&&s.slen>=180&&!s.hero);
    cap.hp=cap.hpMax*.35;cap.hurtT=battleTime;cap.stand=null;cap.ai.pressure=0;st.capitalCrisis(cap,battleTime);
    const started=bc.log.events.some(e=>e.type==='rescueStart'&&e.ship===cap.id)||st.events.some(e=>e.type==='rescueStart'&&e.ship===cap.id);
    ${clearEnemies(1)}
    for(let i=0;i<30*24;i++){battleTime+=1/30;simStep(battleTime,1/30);cap.hp=Math.max(cap.hp,cap.hpMax*.35);}
    const ev=bc.log.events.filter(e=>e.type==='rescue'&&e.ship===cap.id);
    return {started,screen:!!cap.rescued,outcomes:ev.map(e=>e.outcome),text:ev.map(e=>e.text)};})()`);
  assert.ok(r.started,'the screen is called '+JSON.stringify(r));
  assert.deepEqual(r.outcomes,['saved'],JSON.stringify(r));
  assert.ok(r.screen);assert.match(r.text[0],/survives\. .* held\./);
});

test('a tug latches onto a disabled capital and tows it out alive',()=>{
  const w=war(12,10,1101,40,20);
  const r=w.run(`(()=>{const cap=ships.find(s=>s.side===1&&!s.dead&&s.arr&&s.slen>=180&&!s.hero&&!s.hulls);
    cap.destroyMode='disabled';cap.lastHit=null;${clearEnemies(1)}kill(cap,battleTime);
    const tow=tows.find(q=>q.cap===cap.id);if(!tow)return {tow:false};
    const tug=ships[tow.tug],wr=wrecks.find(x=>x.uid===tow.wreck);tug.x=wr.x+300;tug.y=wr.y;tug.z=wr.z;
    for(let i=0;i<30*60&&!tow.done;i++){battleTime+=1/30;simStep(battleTime,1/30);}
    const ev=bc.log.events.filter(e=>e.type==='rescue'&&e.kind==='tow'&&e.ship===cap.id);
    return {tow:true,attached:tow.attached!=null,outcome:ev.map(e=>e.outcome)};})()`);
  assert.ok(r.tow,'a tug is assigned');assert.ok(r.attached,JSON.stringify(r));
  assert.deepEqual(r.outcome,['saved'],JSON.stringify(r));
});

test('battle size follows measured simulation speed, never the GPU tier',()=>{
  const w=war(5,6,1101,20);
  const r=w.run(`(()=>{const sizes=[.5,1,1.3,3,5,8,11].map(f=>realtimeSize(f));
    const mono=[100,192,287,382,572,857,1142,2000].map(refCost).every((c,i,a)=>!i||c>a[i-1]);
    const f=measureSimSpeed();const before=perFleet;setQuality('ultra',false);setQuality('low',false);const after=perFleet;
    return {sizes,mono,f:Number.isFinite(f)&&f>0,same:before===after};})()`);
  // Reference machine = 1: 50 a side. 600 a side needs about 10.7x.
  assert.deepEqual(r.sizes,[50,50,100,200,300,450,600]);
  assert.ok(r.mono,'cost rises with ships');assert.ok(r.f,'the probe returns under a frozen clock');
  assert.ok(r.same,'quality tier does not change fleet size');
  assert.match(page,/const SIM_REF=\{probe:\.30,cost:\{100:419/,'reference numbers are the measured ones');
  assert.doesNotMatch(page,/PROVISIONAL/);
});

test('fracture edges glow where fragments were joined, and the glow cools',()=>{
  const w=war(5,6,1101,20);
  const r=w.run(`(()=>{const a={v:[0,0,0, 1,0,0, 0,1,0]},b={v:[1,0,0, 0,1,0, 1,1,0]},c={v:[5,5,5, 6,5,5, 5,6,5]};
    markFractureEdges([a,b,c]);return {a:Array.from(a.e),b:Array.from(b.e),c:Array.from(c.e)};})()`);
  assert.deepEqual(r.a,[0,1,1]);assert.deepEqual(r.b,[1,1,0]);assert.deepEqual(r.c,[0,0,0]);
  // Heat on wreckage decays exponentially from the break (3.2 s pieces, 6 s disabled hulls).
  assert.match(page,/gl\.uniform1f\(SU\.heat,w\.pending\?0:Math\.exp\(-Math\.max\(0,now-w\.t0\)\/\(w\.disabled\?6:3\.2\)\)\)/);
  assert.match(page,/vec3 hot=mix\(vec3\(\.42,\.05,\.01\),vec3\(1\.35,\.60,\.16\),uHeat\*uHeat\)/,'orange cooling to dark red');
});

test('objectives win wars: a convoy run and a held station decide them',()=>{
  const c=war(5,6,1101,30,0,{plans:null,objective:'CONVOY'});
  while(c.run('battleTime-warT0')<180&&c.run('winner==null'))c.step(1);
  assert.deepEqual(c.run('[winner,winReason]'),[1,'convoy']);
  assert.match(c.run(`document.getElementById('win').innerHTML`),/WINS THE CONVOY RUN/);
  const s=war(5,6,3303,30,0,{plans:null,objective:'STATION'});
  while(s.run('battleTime-warT0')<180&&s.run('winner==null'))s.step(1);
  assert.deepEqual(s.run('[winner,winReason]'),[1,'station']);
  assert.match(s.run(`document.getElementById('win').innerHTML`),/HOLDS THE STATION/);
});

test('no regression: the ion lance is at least 22 px, white-cored and flares for 0.3 s',()=>{
  assert.match(page,/if\(kind>36\.5&&kind<37\.5\)\{vA=1\.0;gl_PointSize=clamp\(aS\.x\*uPx\/max\(gl_Position\.w,1\.0\),22\.0,720\.0\);\}/);
  assert.match(page,/o=vec4\(mix\(lc,vec3\(1\.0\),mid\*\.55\)/,'the glow whitens toward its core');
  const w=war(5,6,1101,20);
  const r=w.run(`(()=>{cam.ex=0;cam.ey=0;cam.ez=-30000;const T=battleTime;
    beams=[{ion:true,a:[-2000,0,0],b:[2000,0,0],t0:T,race:5,wid:30}];
    const size=t=>{const n=appendIonLances(T+t,0);let s=0;for(let i=0;i<n;i++)s=Math.max(s,flPool[i*7+4]);return {n,s,k:flPool[5]};};
    return {early:size(.05),late:size(.8),after:size(.35)};})()`);
  assert.equal(r.early.k,37);assert.ok(r.early.n>=2&&r.late.n>=2);
  // At 0.05 s the sprites are about three times their settled width; by 0.3 s the flare is over.
  assert.ok(r.early.s/r.after.s>2.4,JSON.stringify(r));
});

test('no regression: blowout guards stay in place',()=>{
  // Dust and embers saturate (MAX blend) instead of summing past white.
  assert.match(page,/gl\.blendEquation\(gl\.MAX\);gl\.drawArrays\(gl\.POINTS,0,ne\);gl\.blendEquation\(gl\.FUNC_ADD\);/);
  // The lance divides its brightness by on-screen overlap: a lance seen end-on up close is dimmer per sprite.
  const w=war(5,6,1101,20);
  const r=w.run(`(()=>{const T=battleTime;beams=[{ion:true,a:[0,0,0],b:[8000,0,0],t0:T,race:5,wid:30}];
    const seed=(x,z)=>{cam.ex=x;cam.ey=0;cam.ez=z;appendIonLances(T+.5,0);return flPool[6];};
    return {near:seed(4000,-6000),far:seed(4000,-400000)};})()`);
  // From far away the sprites pile onto a few pixels: each is dimmed so the pile cannot pass white.
  assert.ok(r.far<r.near,JSON.stringify(r));
});

test("no regression: a replay borrows a disabled capital's wreck mesh to draw it before its death",()=>{
  const w=war(5,6,31,24);w.exec('endIntro();');
  const r=w.run(`(()=>{for(let i=0;i<30*12;i++){capturePrevious();battleTime+=1/30;simStep(battleTime,1/30);broadcastTick(battleTime,1/30);}
    const cap=ships.find(s=>!s.dead&&s.arr&&s.slen>=180&&!s.hulls);cap.destroyMode='disabled';cap.lastHit=null;kill(cap,battleTime);
    for(let i=0;i<30;i++){capturePrevious();battleTime+=1/30;simStep(battleTime,1/30);broadcastTick(battleTime,1/30);}
    const wreck=wrecks.find(w=>w.disabled&&w.src===cap.id&&w.vao);if(!wreck)return {wreck:false};
    if(!startReplay({t0:battleTime-6,t1:battleTime,label:'test'}))return {wreck:true,replay:false};
    replayApply();const drawn=cap.vao===wreck.vao&&cap.dead===false;replayRestore();endReplay();
    return {wreck:true,replay:true,drawn,after:cap.vao===null&&cap.dead};})()`);
  assert.deepEqual(r,{wreck:true,replay:true,drawn:true,after:true});
});

test('no regression: debris does not jerk (no single-tick positional snap) after a capital breaks up',()=>{
  const w=war(5,6,1101,30,25);
  const r=w.run(`(()=>{const t=ships.find(s=>!s.dead&&s.arr&&s.slen>=400&&s.fragData);t.destroyMode='catastrophic';t.lastHit=null;kill(t,battleTime);
    const prev=new Map(),dt=1/30;let snap=0,n=0;
    for(let i=0;i<30*8;i++){battleTime+=dt;simStep(battleTime,dt);
      for(const w of wrecks){if(w.src!==t.id||w.gone)continue;const p=prev.get(w.uid);
        if(p){snap=Math.max(snap,Math.hypot(w.x-p[0]-w.vx*dt,w.y-p[1]-w.vy*dt,w.z-p[2]-w.vz*dt));n++;}
        prev.set(w.uid,[w.x,w.y,w.z]);}}
    return {snap,n};})()`);
  assert.ok(r.n>1000,JSON.stringify(r));
  assert.ok(r.snap<.5,'largest single-tick positional snap '+r.snap);
});
