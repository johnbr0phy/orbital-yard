const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {loadBattle}=require('./headless-battle.cjs');
const results=[];
for(let race=0;race<18;race+=2){
  const b=loadBattle(),started=performance.now();
  b.start(race,race+1,20260905+race);
  b.run('for(const s of ships){s.testStart=[s.x,s.y,s.z];}');
  b.step(150);
  const result=b.run(`({races:sideRace,spawned,counts,actions:battleAI.stats.actions,
    fired:ships.filter(s=>s.lastFire>0).length,
    capitals:ships.filter(s=>fightsAsCrown(s)).map(s=>({race:s.race,L:Math.round(s.slen),dead:s.dead,
      distance:Math.round(Math.hypot(s.x-s.testStart[0],s.y-s.testStart[1],s.z-s.testStart[2])),kills:s.kills||0,lastFire:s.lastFire||0})),
    heroes:ships.filter(s=>s.hero).map(s=>({kills:s.kills||0,dead:s.dead,hp:s.hp,hpMax:s.hpMax})),
    invalid:ships.filter(s=>![s.x,s.y,s.z,s.hp,s.spd,s.turn].every(Number.isFinite)).map(s=>s.id)})`);
  result.cpuMs=Math.round(performance.now()-started);
  assert.equal(result.invalid.length,0,'finite state for races '+race+'/'+(race+1));
  assert.ok(result.fired>0,'fleets engage for races '+race+'/'+(race+1));
  assert.ok(result.capitals.every(s=>s.dead||s.distance>150),'live capitals manoeuvre');
  assert.ok(result.capitals.filter(s=>s.L>19000).every(s=>s.lastFire>0),'the Executor joins the firing line');
  assert.ok(Object.keys(result.actions).length>=3,'multiple decisions');
  results.push(result);console.log(JSON.stringify(result));
}
console.log('PASS: all 18 fleet profiles exercised through real combat.');
