// Normal small muster: no repositioning, invulnerability, forced targets or widened cones.
const assert=require('node:assert/strict'),{loadBattle}=require('./headless-battle.cjs');
const b=loadBattle(),n=b.start(5,6,915,12,[-1,-1]);assert.ok(n<=48);
b.run(`endIntro();var exchanges={ships:ships.length,attempts:0,shots:0,first:null,boltFrames:0,visible:0,peak:0,bySide:[0,0],byType:{}};var originalFire=fireBeam;fireBeam=function(s,...args){exchanges.attempts++;const fired=originalFire(s,...args);if(fired){exchanges.shots++;exchanges.bySide[s.side]++;exchanges.first??=battleTime;const k=weaponProfile(s).fixed?'fighter':'turret';exchanges.byType[k]=(exchanges.byType[k]||0)+1;}return fired;};`);
for(let j=0;j<40;j++){b.step(1);b.run('var active=tracers.filter(t=>t.energy&&!t.dead&&battleTime>=t.t0).length+beams.filter(b=>b.coherent&&battleTime>=b.t0&&battleTime-b.t0<b.life).length;exchanges.visible+=active;exchanges.peak=Math.max(exchanges.peak,active);if(active)exchanges.boltFrames++;');}
const result=b.run('({...exchanges,alive:ships.filter(s=>!s.dead).length,avgVisible:exchanges.visible/40,finite:ships.every(s=>[s.x,s.y,s.z].every(Number.isFinite))})');console.log(JSON.stringify(result));assert.ok(result.finite);

assert.ok(result.shots>150&&result.byType.fighter>30&&result.avgVisible>2,'normal muster must sustain readable exchanges');assert.ok(result.alive>15,'increased cadence must not wipe out the muster prematurely');
