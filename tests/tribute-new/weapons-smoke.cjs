// Deliberately bounded: one small forge, one capital and one target, six seconds.
const assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
const b=loadBattle();b.start(5,6,20260909,12,[-1,-1]);
b.run(`endIntro();battleTime=2;
 var capital=ships.find(s=>s.slen>19000),victim=ships.find(s=>s.side===1&&!s.hulls);
 if(!capital||!victim)throw Error('fixture requires Executor and target');
 for(const s of ships){s.dead=s!==capital&&s!==victim;s.arr=true;s.grace=false;}
 capital.yaw=0;capital.roll=0;capital.pitch=0;capital.x=capital.y=capital.z=0;
 var mount=capital.lances[0],pos=gunWorld(capital,[mount.lx+600,mount.ly+350,mount.lz+200],2);
 [victim.x,victim.y,victim.z]=pos;victim.v=0;victim.hp=victim.hpMax=1000;
 for(const l of capital.lances)l.cool=0;for(const t of capital.turrets)t.cool=0;
 for(let i=0;i<180;i++){battleTime+=1/30;battleAI.index(ships,battleTime,[]);megaStep(capital,battleTime,1/30);}
`);
assert.ok(b.run('capital.lastFire>2'),'Executor acquires, traverses and fires');
assert.ok(b.run('tracers.some(t=>t.energy&&t.from===capital.id)'),'Executor launches physical bolts');
assert.ok(b.run('tracers.every(t=>[t.x,t.y,t.z,t.vx,t.vy,t.vz].every(Number.isFinite))'));
console.log('PASS: Executor acquires a nearby target and fires with mount arcs and traversal enabled.');
const states=[];
for(const fps of [30,120]){
 b.start(5,6,915,12,[-1,-1]);
 b.run(`endIntro();lastT=1;for(let i=1;i<=${fps*6};i++)frame(1000+i*1000/${fps});`);
 states.push(b.run('JSON.stringify(ships.map(s=>[s.x,s.y,s.z,s.hp,s.ai.action]))'));
}
assert.equal(states[0],states[1],'small battle state is independent of render frame rate');
console.log('PASS: small battle has identical state at 30 and 120 render frames/s.');
