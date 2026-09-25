const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');

// Pause, slow motion and fast forward only change how many fixed 1/30 s steps
// a frame takes. Compare every step count both runs reached at a frame end.
function run(schedule){
  const b=loadBattle({modules:true});b.start(5,6,917,24);b.run('endIntro();lastT=1;globalThis.__h=new Map();');
  let t=1000;
  for(const [rate,seconds,slow] of schedule){
    b.run(`warClock.setRate(${rate});${slow?'warClock.slowMo(1.6);':''}for(let i=1;i<=${Math.round(seconds*60)};i++){frame(${t}+i*1000/60);__h.set(Math.round(battleTime*30),JSON.stringify(ships.map(s=>[s.x,s.y,s.z,s.hp,s.dead,s.ai&&s.ai.action])));}`);
    t+=seconds*1000;
  }
  return new Map(b.run('[...__h]'));
}
test('pause, 0.25x, 4x and slow motion reproduce the 1x war step for step',()=>{
  const base=run([[1,40]]);
  const varied=run([[.25,6],[0,2],[4,5,false],[1,4,true],[2,6],[.5,4]]);
  const shared=[...varied.keys()].filter(k=>base.has(k));
  assert.ok(shared.length>150,'compared '+shared.length+' step counts');
  assert.ok(Math.max(...shared)>=600,'reaches 20 s of battle');
  for(const k of shared)assert.equal(varied.get(k),base.get(k),'step '+k);
});
