const test=require('node:test'),assert=require('node:assert/strict');const {loadBattle}=require('./headless-battle.cjs');
test('ion charge is one barrel-attached glow that brightens without leaving explosion trails',()=>{
 const b=loadBattle();b.start(5,6,42,12);
 const r=b.run(`(()=>{const g=ships.find(s=>s.vao);g.arr=true;g.grace=false;ionState=[{gun:g.id,started:0,fire:5,muz:fireLocal(g)},null];const old=flashes.length;appendIonCharges(1,0);const start=flPool[6];g.x+=100;const count=appendIonCharges(4,0),end=flPool[6],m=weaponMuzzle(g,ionState[0].muz,4);return {count,start,end,error:Math.hypot(flPool[0]-m[0],flPool[1]-m[1],flPool[2]-m[2]),flashes:flashes.length-old,after:(ionState=[null,null],appendIonCharges(5,0))};})()`);
 assert.equal(r.count,1);assert.ok(r.end>r.start);assert.ok(r.error<.01);assert.equal(r.flashes,0);assert.equal(r.after,0);
});
