const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
function setup(race=6){const b=loadBattle();b.start(race,5,42,12);b.run(`var gunner=ships.find(s=>s.side===0&&!s.hulls&&!s.hero);gunner.arr=true;gunner.grace=false;gunner.yaw=0;gunner.pitch=.3;gunner.x=gunner.y=gunner.z=0;gunner.pilotThrottle=0;gunner.v=0;gunner.guns=[[gunner.nose||10,0,3]];gunner.fireL=null;gunner.weaponTracks=new Map();gunner.meta.klass='X-WING';select(gunner.id,false);setWatchView('fly');foeCache[1]=[];tracers=[];beams=[];`);return b;}
test('Space fires with no target and follows the cockpit pitch; holding obeys cooldown',()=>{
 const b=setup();const r=b.run(`(()=>{keys.add(' ');pilotStep(gunner,2,1/30);const tr=tracers[0],n=tracers.length;pilotStep(gunner,2.01,1/30);const held=tracers.length===n;pilotStep(gunner,2.2,1/30);return {n,held,again:tracers.length>n,pitch:Math.atan2(tr.vy,Math.hypot(tr.vx,tr.vz)),fire:gunner.lastFire};})()`);
 assert.equal(r.n,1);assert.ok(r.held&&r.again);assert.ok(Math.abs(r.pitch-.3)<.001);
});
test('a selected enemy behind the cockpit cannot block manual fire',()=>{
 const b=setup();assert.ok(b.run(`(()=>{const t=ships.find(s=>s.side===1);t.arr=true;t.grace=false;t.x=-500;t.y=t.z=0;foeCache[1]=[t];gunner.pilotTarget=t.id;return pilotFire(gunner,2)&&tracers.length===1&&tracers[0].vx>0;})()`));
});
test('beam ships emit a visible untargeted beam that survives beam pinning',()=>{
 const b=setup(10);assert.ok(b.run(`(()=>{gunner.pitch=0;gunner.meta.klass='DEEP SPACE FRIGATE';gunner.slen=200;gunner.hulls=1;let fired=false;for(let i=0;i<100&&!fired;i++)fired=pilotFire(gunner,2+i/30);const beam=beams.find(b=>b.manual);if(!beam)return false;const start=beam.t0;pinBeams(start+.1);return fired&&beam.coherent&&beam.t0===start&&beam.b[0]>beam.a[0];})()`));
});
test('manual beams damage only the first intersected enemy, without a target lock',()=>{
 const b=setup(10);const r=b.run(`(()=>{gunner.pitch=0;gunner.guns=[[10,0,0]];gunner.meta.klass='SCOUT';const ts=ships.filter(s=>s.side===1).slice(0,2);ts.forEach((t,i)=>{t.arr=true;t.grace=false;t.x=100+i*150;t.y=t.z=0;t.hp=t.hpMax=100;t.exL=t.exY=t.exZ=20;});foeCache[1]=ts;pilotFire(gunner,2);return ts.map(t=>t.hp);})()`);assert.ok(r[0]<100);assert.equal(r[1],100);
});
test('physical Space key is normalized and focus loss clears firing input',()=>{
 const b=setup();let prevented=false;
 b.dispatch('keydown',{code:'Space',key:'Spacebar',target:{tagName:'BUTTON'},preventDefault(){prevented=true;}});
 b.run('pilotStep(gunner,2,1/30)');assert.ok(prevented);assert.equal(b.run('tracers.length'),1);
 b.dispatch('keyup',{code:'Space',key:'Spacebar'});assert.equal(b.run("keys.has(' ')"),false);
 b.dispatch('keydown',{code:'Space',key:' ',target:{tagName:'BUTTON'},preventDefault(){}});
 b.dispatch('blur');assert.equal(b.run("keys.has(' ')"),false);
});

test('capital-ship aiming extends beyond the bow rather than aiming inside its own hull',()=>{
 const b=setup();assert.ok(b.run(`(()=>{gunner.meta.klass='SUPER STAR DESTROYER';gunner.slen=24000;gunner.nose=12000;gunner.exL=12000;gunner.hulls=100;gunner.guns=[[12000,0,0]];gunner.pitch=0;return pilotFire(gunner,2)&&tracers[0].vx>0;})()`));
});
