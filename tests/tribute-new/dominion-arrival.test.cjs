const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
test('Dominion has a light attack screen, few heavy ships and clear jump corridors',()=>{
 const b=loadBattle();
 for(const seed of [42,71,2026]){
  b.start(19,6,seed,600);
  const r=b.run(`(()=>{const a=ships.filter(s=>s.race===19);let overlaps=0;const radius=s=>Math.hypot(s.exY||5,s.exZ||5)+(s.exL||10)*.15+24;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(Math.hypot(a[i].y-a[j].y,a[i].z-a[j].z)+.001<radius(a[i])+radius(a[j]))overlaps++;return {count:a.length,heavy:a.filter(s=>s.slen>400).length,screen:a.filter(s=>s.band===0&&!s.hulls).every(s=>s.meta.klass==="JEM'HADAR ATTACK SHIP"),hero:a.find(s=>s.hero).slen,overlaps};})()`);
  assert.equal(r.count,193);assert.ok(r.heavy<=16,JSON.stringify(r));assert.ok(r.screen);assert.ok(r.hero<150);assert.equal(r.overlaps,0);
 }
});
