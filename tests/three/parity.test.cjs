const test=require('node:test'),assert=require('node:assert/strict');
const old=require('../tribute-new/headless-battle.cjs'),port=require('./engine-harness.cjs');
const snapshot=b=>JSON.parse(JSON.stringify(b.run('ships.map(s=>({id:s.id,seed:s.seed,race:s.race,klass:s.meta.klass,hp:s.hp,x:s.x,y:s.y,z:s.z,spd:s.spd,wpn:s.wpn}))')));
test('Three runtime preserves native muster, hardware and seeded first six seconds',()=>{const a=old.loadBattle(),b=port.loadBattle();a.start(22,6,42,24);b.start(22,6,42,24);assert.deepEqual(snapshot(b),snapshot(a));a.step(6);b.step(6);assert.deepEqual(snapshot(b),snapshot(a));});
test('all 23 fleets forge in the isolated Three runtime',()=>{const b=port.loadBattle();for(let race=0;race<23;race++){b.start(race,(race+1)%23,71,6);assert.ok(b.run('ships.length>0&&ships.every(s=>s.vao&&s.meta&&Number.isFinite(s.slen))'),'race '+race)}});
