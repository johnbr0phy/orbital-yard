const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');

// The forge pool size follows the machine. A seed must still deal the same
// hulls and fight the same war with one worker or four.
test('one and four forge workers produce identical hulls and combat',()=>{
  const states=[];
  for(const cores of [2,5]){
    const b=loadBattle({cores});b.start(5,6,4242,40);
    assert.equal(b.run('workers.length'),cores-1);
    b.step(12);
    states.push(b.run('JSON.stringify(ships.map(s=>[s.seed,s.meta&&s.meta.klass,s.slen,Math.round(s.x*1000),Math.round(s.z*1000),s.hp,s.dead]))'));
  }
  assert.equal(states[0],states[1]);
});

test('capitals and heroes are forged before small craft',()=>{
  const b=loadBattle({cores:3});
  // Inspect the ordering function directly on a synthetic job list.
  const sorted=b.run(`JSON.stringify([{id:5,band:0},{id:1,band:2},{id:2,hulls:10},{id:3,hero:true,band:0},{id:4,band:1}].sort((a,b)=>forgeRank(a)-forgeRank(b)||a.id-b.id).map(j=>j.id))`);
  assert.equal(sorted,'[2,3,1,4,5]');
});
