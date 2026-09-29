const test=require('node:test'),assert=require('node:assert/strict');
const AI=require('../../armada-battle-ai-new.js');
const {loadBattle}=require('./headless-battle.cjs');
const definitions=loadBattle().run('RACE_DEFS');

test('station spreads use independent axes, not one diagonal line',()=>{
  const b=new AI.FleetMinds(definitions);let sxz=0,sxx=0,szz=0;
  for(let i=0;i<400;i++){const a=b.seedShip({id:i,side:0,race:5,seed:7000+i*97});sxz+=a.lane*a.depth;sxx+=a.lane*a.lane;szz+=a.depth*a.depth;}
  assert.ok(Math.abs(sxz/Math.sqrt(sxx*szz))<.15,'lane and depth are uncorrelated');
});

test('the Empire screen is not mustered inside the Executor, and does not flatten under her belly',()=>{
  const b=loadBattle();b.start(5,17,42,48);
  const inside=b.run(`ships.filter(c=>c.side===0&&c.hulls>=50).flatMap(c=>{const h=Math.max(c.exL||0,c.slen*.5),cy=Math.cos(c.yaw),sy=Math.sin(c.yaw);
    return ships.filter(s=>s.side===0&&s.slen<120&&!s.hulls).filter(s=>{const dx=s.x-c.x,dz=s.z-c.z,along=dx*cy+dz*sy;
      return along>0&&along<h&&Math.abs(-dx*sy+dz*cy)<c.exZ&&Math.abs(s.y-c.y)<c.exY;}).map(s=>s.id);}).length`);
  assert.equal(inside,0);
  b.step(10);
  const sd=b.run(`(()=>{const f=ships.filter(s=>s.side===0&&!s.dead&&s.arr&&!s.hulls&&s.slen<120),m=f.reduce((a,s)=>a+s.y,0)/f.length;
    return Math.sqrt(f.reduce((a,s)=>a+(s.y-m)**2,0)/f.length);})()`);
  assert.ok(sd<300,'no screen stacked a kilometre under the crown: '+sd.toFixed(0));
});

test('when the First Ones start unmaking a holding line, it breaks: pilots charge or run',()=>{
  const b=loadBattle();b.start(5,17,42,48);b.step(29.5);
  const before=b.run(`ships.filter(s=>s.side===0&&!s.dead&&s.arr&&s.ai&&!s.hulls&&s.slen<120&&s.ai.action==='HOLD').length`);
  assert.ok(before>0,'the fixture holds a line before the first strike');
  // The motion pass: the First Ones' drives now spool (16-28 s for their hulls), so the first strike lands
  // a few seconds later than it used to (about 38 s, not 31). Wait for it, then give the line 4 s.
  for(let t=0;t<30&&!b.run('ships.some(s=>s.side===0&&s.dead)');t++)b.step(1);
  b.step(4);
  const r=b.run(`(()=>{const f=ships.filter(s=>s.side===0&&!s.dead&&s.arr&&s.ai&&!s.hulls&&s.slen<120);
    return {n:f.length,hold:f.filter(s=>s.ai.action==='HOLD').length,charge:f.filter(s=>s.ai.response==='CHARGE').length,
      flee:f.filter(s=>s.ai.response==='FLEE').length,lost:ships.filter(s=>s.side===0&&s.dead).length,released:battleAI.story.sides[0].lossAt!=null};})()`);
  assert.ok(r.lost>0,'the ancients struck');
  assert.ok(r.released,'the side registered it was under fire');
  assert.equal(r.hold,0,'nobody holds the parade line under fire: '+JSON.stringify(r));
  assert.ok(r.charge+r.flee>0,'survivors choose to charge or flee: '+JSON.stringify(r));
});

test('a doctrine that forbids retreat answers a massacre by charging',()=>{
  const b=new AI.FleetMinds(definitions);
  b.story.ready=true;b.story.sides[0].race=19;b.story.sides[1].race=17;
  const s={id:1,side:0,race:19,seed:4242,x:0,y:0,z:0,yaw:0,hp:10,hpMax:10,slen:30,rad:15,spd:60,spdMax:85,turn:1,v:40,vy:0,hulls:0,arr:true,grace:false,dead:false,squad:-1,kills:0};
  const foe={id:2,side:1,race:17,seed:99,x:5000,y:0,z:0,yaw:Math.PI,hp:900,hpMax:900,slen:1600,rad:800,spd:20,v:10,vy:0,hulls:0,arr:true,grace:false,dead:false,squad:-1};
  b.equip(s);b.index([s,foe],1);
  s.ai.shock=4;s.ai.dread=2;s.ai.contacts.set(2,{...b.snapshot(foe,1,false),confidence:.8});
  b.think(s,1);
  assert.equal(s.ai.response,'CHARGE');assert.equal(s.ai.action,'ATTACK');assert.equal(s.ai.target,2);
});
