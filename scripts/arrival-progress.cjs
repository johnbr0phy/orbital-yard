#!/usr/bin/env node
/* Deterministic arrival progress audit, using the real forge and simulation.
   node scripts/arrival-progress.cjs <race 0..22> [size=150] [seconds=60] [seed=42] [--normal] [--three]
   Default: Rebels v Empire at time 30; two Rebel survivors call the selected ally.
   --normal keeps the selected fleet's opening muster instead of launching relief.
   Outputs measurements every 15/30/60/90/120 seconds, plus per-ship diagnostics.
   lastFire counts firing activity, including an ion charge; it is not a shot count.
   No renderer/GPU is exercised. Pipe JSON to a file for before/after comparisons. */
const {loadBattle}=require(process.argv.includes('--three')?'../tests/three/engine-harness.cjs':'../tests/tribute-new/headless-battle.cjs');
const {FLEETS}=require('./motion-scenes.cjs');
const race=Number(process.argv[2]||0),size=Number(process.argv[3]||150),seconds=Number(process.argv[4]||60),seed=Number(process.argv[5]||42),normal=process.argv.includes('--normal');
if(!Number.isInteger(race)||race<0||race>=FLEETS.length||!Number.isFinite(size)||size<1||!Number.isFinite(seconds)||seconds<1||!Number.isFinite(seed))throw Error('Invalid race, size, duration or seed');
const b=loadBattle({modules:true});
b.start(normal?race:6,normal&&race===5?6:5,seed,normal?size:24,normal?[-1,-1]:[race,-1]);
b.run(`endIntro();battleTime=30;warT0=0;perFleet=${size};
  for(const s of ships){s.arr=true;s.grace=false;s.delay=-1;}
  ${normal?'':`for(const s of ships.filter(s=>s.side===0).slice(0,-2)){s.dead=true;counts[0]--;}maybeCallAlly(30);`}`);
if(!normal){b.flush();b.run(`for(let i=0;i<500&&reliefBatches[0].phase!=='launched';i++)advanceReliefPlans(30+i/30);`);}
b.run(`var watched=${normal?'ships.filter(s=>s.side===0).map(s=>s.id)':'reliefBatches[0].ids.slice()'},track=new Map();
  function sample(){for(const id of watched){const s=ships[id];if(!s.arr||s.dead)continue;
    let r=track.get(id);if(!r){r={start:[s.x,s.y,s.z],p:[s.x,s.y,s.z],t:battleTime,path:0,slow:0,maxSlow:0,braking:0,seconds:0};track.set(id,r);}
    const p=[s.x,s.y,s.z];r.path+=V.len(V.sub(p,r.p));r.p=p;r.seconds++;
    r.slow=Math.hypot(s.v,s.vy)<1?r.slow+1:0;r.maxSlow=Math.max(r.maxSlow,r.slow);if((s.avBrake||1)<.7)r.braking++;
  }}
  function report(){const rows=watched.map(id=>{const s=ships[id],r=track.get(id),foes=ships.filter(t=>t.side!==s.side&&t.arr&&!t.dead&&!t.grace),gap=foes.length?Math.min(...foes.map(t=>gapTo(s,t))):null;
    return {id,klass:s.meta.klass,cap:fightsAsCrown(s),L:Math.round(s.slen),arr:s.arr,dead:s.dead,age:r?battleTime-r.t:0,path:r?Math.round(r.path):0,net:r?Math.round(V.len(V.sub([s.x,s.y,s.z],r.start))):0,slow:r?.slow||0,maxSlow:r?.maxSlow||0,traffic:r?Math.round(r.braking/r.seconds*100):0,v:+s.v.toFixed(2),vy:+(s.vy||0).toFixed(2),cruise:+s.spd.toFixed(2),dash:+s.spdMax.toFixed(2),gap:gap==null?null:Math.round(gap),fired:s.lastFire>30,relief:!!s.reliefGoal,mode:s.ai.plan?.mode,reason:s.ai.reason,order:s.ai.order?.kind,slot:!!s.ai.plan?.slot,goalDistance:s.ai.plan?Math.round(V.len(V.sub(s.ai.plan.goal,[s.x,s.y,s.z]))):null,rock:nowRock(s),trafficKey:s.trafficKey,p:[s.x,s.y,s.z].map(Math.round)};});
    const alive=rows.filter(s=>s.arr&&!s.dead),sorted=alive.map(s=>s.path).sort((a,b)=>a-b);
    return {time:battleTime,total:rows.length,arrived:rows.filter(s=>s.arr).length,alive:alive.length,fired:rows.filter(s=>s.fired).length,stationary:alive.filter(s=>s.slow>=10).length,delayed:alive.filter(s=>s.maxSlow>=10).length,medianPath:sorted[Math.floor(sorted.length/2)],rows};
  }
  function nowRock(s){return battleTime<(s.rockUntil||0);}
  sample();`);
const reports=[];
for(let i=1;i<=seconds;i++){b.step(1);b.run('sample()');if([15,30,60,90,120].includes(i)||i===seconds)reports.push(b.run('report()'));}
console.log(JSON.stringify({race,name:FLEETS[race],seed,size,seconds,normal,reports}));
