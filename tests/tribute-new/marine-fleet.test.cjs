const test=require('node:test'),assert=require('node:assert/strict');const {loadBattle}=require('./headless-battle.cjs');
test('Marine warships including the hero use steady capital handling; attack craft remain agile',()=>{
 const b=loadBattle();b.start(20,21,42,24);
 assert.ok(b.run(`(()=>{const caps=ships.filter(s=>s.race===20&&s.slen>=300),small=ships.filter(s=>s.race===20&&s.slen<42);return caps.some(s=>s.hero)&&caps.every(s=>s.steadyCapital&&fightsAsCrown(s)&&s.turn<=.025&&s.spdMax<16)&&small.length>=8&&small.every(s=>!s.steadyCapital);})()`));
 assert.ok(b.run(`(()=>{const s=ships.find(s=>s.race===20&&s.hero);s.arr=true;s.grace=false;s.v=.01;s.vy=4;s.pitch=s.roll=0;battleAI.destination=()=>({goal:[s.x+800,s.y+600,s.z+900],boost:1,mode:'EVADE',target:-1});for(let i=0;i<90;i++)battleAI.moveCapital(s,3+i/30,1/30);return s.pitch===0&&s.roll===0&&s.v<s.spdMax&&Number.isFinite(s.y);})()`));
});
test('Marine class silhouettes and matte chapter liveries vary without generic paint stripes',()=>{
 const b=loadBattle();assert.ok(b.run(`(()=>{const ratios=new Set();for(let t=0;t<11;t++){const s=buildExtraClass(20,42,t),m=shipMeshQ(s,.65);if(!Array.from(m.t).every(Number.isFinite)||m.tris>4000)return false;ratios.add((s.meta.beam/s.meta.length).toFixed(2)+':'+(s.meta.height/s.meta.length).toFixed(2));}const colors=new Set();for(let seed=40;seed<44;seed++){const s=buildExtraClass(20,seed,5),p=hullFinish({race:20,meta:s.meta});if(p.pattern!==15||p.gloss>.2)return false;colors.add(p.color.join());}return ratios.size>=8&&colors.size===4;})()`));
});
