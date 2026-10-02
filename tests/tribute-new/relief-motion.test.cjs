const test = require('node:test');
const assert = require('node:assert/strict');
const native = require('./headless-battle.cjs');
const three = require('../three/engine-harness.cjs');

for (const [name, harness] of [['native', native], ['Three', three]]) {
  test(`${name}: a slow Tyranid escort burns toward combat despite an inherited HOLD`, t => {
    const b = harness.loadBattle();
    b.start(21, 5, 42, 48);
    b.run(`endIntro();battleTime=30;warT0=0;winner=null;
      var escort=ships.find(s=>s.race===21&&!s.hero&&!fightsAsCrown(s)&&s.slen>100);
      var foe=ships.find(s=>s.side===1&&s.slen<60);
      for(const s of ships)s.dead=s!==escort&&s!==foe;
      worldBodies=[];fieldBodies=[];battleAI.setField(null);battleAI.story.ready=false;
      ionNext=[Infinity,Infinity];
      for(const s of [escort,foe]){s.arr=true;s.grace=false;s.delay=-1;s.squad=-1;s.x=s.y=s.z=0;s.v=s.vy=s.vA=s.yaw=s.yawV=0;}
      foe.x=6000;foe.spd=foe.spdMax=.01;
      escort.reliefGoal=[6000,0,0];escort.reliefReach=650;
      escort.ai.order={kind:'HOLD',point:[0,0,0],until:100};
      var combatDash=escort.spdMax,start=[escort.x,escort.y,escort.z];`);
    b.step(20);
    const approach = b.run(`({travel:V.len(V.sub([escort.x,escort.y,escort.z],start)),speed:escort.v,dash:combatDash,mood:escort.mood})`);
    t.diagnostic(JSON.stringify(approach));
    assert.ok(approach.travel > 1500, JSON.stringify(approach));
    assert.ok(approach.speed > approach.dash * 2, JSON.stringify(approach));
    assert.equal(approach.mood, 'SEARCH');
    // Bringing a real contact into range ends the approach and sheds the burn
    // through the normal helm, without changing the class's combat engines.
    b.run(`foe.x=escort.x+450;foe.y=escort.y;foe.z=escort.z;
      escort.ai.target=foe.id;escort.ai.contacts.set(foe.id,battleAI.snapshot(foe,battleTime));
      escort.ai.nextThink=battleTime+1;var approachSpeedBefore=escort.v;`);
    b.step(1/30);
    assert.equal(b.run('escort.reliefGoal'), null);
    assert.ok(b.run('escort.v>approachSpeedBefore*.95'), 'no instantaneous braking at contact');
    b.step(12);
    assert.equal(b.run('escort.spdMax'), approach.dash);
    assert.ok(b.run('escort.v<=combatDash*1.1'), 'returns to combat pace');
  });
}

test('a Tyranid capital touching terrain clears the rock instead of braking forever', t => {
  const b = native.loadBattle();b.start(21, 5, 42, 12);
  const result = b.run(`(()=>{
    const s=ships.find(s=>s.race===21&&s.hulls===10);
    ships=[s];s.arr=true;s.grace=false;s.dead=false;s.squad=-1;s.x=s.y=s.z=0;s.v=s.vy=s.vA=s.yaw=s.yawV=0;
    const margin=Math.min(900,Math.max(6,Math.min(s.exY,s.exZ)*1.2,s.slen*.35)),radius=250+margin;
    s.x=-radius;s.trafficScan=0;s.trafficGoal=null;s.trafficBrake=1;
    fieldBodies=[{center:[0,0,0],radius:250}];battleAI.setField({rocks:[{p:[0,0,0],r:250}]});
    battleAI.destination=()=>({goal:battleAI.avoidField(s,[2000,0,0]),boost:1.3,mode:'SEARCH',target:-1});
    const start=[s.x,s.y,s.z];
    // A large hull needs time for a bounded quarter turn before it can accelerate.
    for(let i=0;i<1350;i++){battleTime=i/30;battleAI.moveCapital(s,battleTime,1/30);fieldContacts();}
    return {travel:V.len(V.sub([s.x,s.y,s.z],start)),clearance:Math.hypot(s.x,s.y,s.z)-radius,speed:s.v,pitch:s.pitch};
  })()`);
  t.diagnostic(JSON.stringify(result));
  assert.ok(result.travel > 250 && result.clearance > 80 && result.speed > 10, JSON.stringify(result));
  assert.ok(Math.abs(result.pitch) <= .055, 'escape retains capital attitude limits');
});

test('a full Tyranid relief wave brings its escort organisms into the fight', t => {
  const b = native.loadBattle({modules:true});b.start(6,5,42,24,[21,-1]);
  b.run(`endIntro();battleTime=30;warT0=0;perFleet=150;
    for(const s of ships){s.arr=true;s.grace=false;s.delay=-1;}
    for(const s of ships.filter(s=>s.side===0).slice(0,-2)){s.dead=true;counts[0]--;}
    maybeCallAlly(30);`);
  b.flush();b.run(`for(let i=0;i<300&&reliefBatches[0].phase!=='launched';i++)advanceReliefPlans(30+i/30);`);
  b.step(60);
  const score=()=>b.run(`(()=>{const wave=reliefBatches[0].ids.map(id=>ships[id]),escorts=wave.filter(s=>!s.hero&&!fightsAsCrown(s)&&s.slen>100);
    return {total:wave.length,arrived:wave.filter(s=>s.arr).length,fired:wave.filter(s=>s.lastFire>30).length,escorts:escorts.length,escortsFired:escorts.filter(s=>s.lastFire>30).length};})()`);
  t.diagnostic('60 seconds: '+JSON.stringify(score()));
  // Ships in later waves and behind capital traffic need longer to reach firing range.
  b.step(30);
  const result=score();
  t.diagnostic('90 seconds: '+JSON.stringify(result));
  assert.equal(result.arrived,result.total);
  assert.ok(result.fired >= result.total*.5, JSON.stringify(result));
  assert.ok(result.escortsFired >= result.escorts*.5, JSON.stringify(result));
});
