const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
test('ten Tyranid organisms have distinct bounded geometry and no mechanical exhaust',()=>{
 const b=loadBattle();const r=b.run(`(()=>{const shapes=new Set();let max=0;for(let type=0;type<10;type++)for(const seed of [40,41,42,43,44,45]){const s=buildExtraClass(21,seed,type),m=shipMeshQ(s,.65);max=Math.max(max,m.tris);if(!Array.from(m.t).every(Number.isFinite)||s.exhaust.length||!s.muzzles.length)return {ok:false,type};if(seed===42)shapes.add((s.meta.beam/s.meta.length).toFixed(2)+':'+(s.meta.height/s.meta.length).toFixed(2));}return {ok:true,max,shapes:shapes.size};})()`);
 assert.ok(r.ok);assert.ok(r.max<4000,JSON.stringify(r));assert.ok(r.shapes>=8);
});
test('organic motion is bounded, anchored at the core and leaves dead hulls rigid',()=>{
 const b=loadBattle();assert.ok(b.run(`(()=>{const s={race:21,slen:100,wf:1},root=[0,0,0],tip=[-45,0,22];for(let t=0;t<20;t+=.25){const a=animatedMount(s,root,t),p=animatedMount(s,tip,t);if(a.some(Math.abs)||Math.hypot(...p.map((x,i)=>x-tip[i]))>1.5)return false;}const a=animatedMount(s,tip,0),c=animatedMount(s,tip,2);s.dead=true;return a.some((x,i)=>x!==c[i])&&animatedMount(s,tip,4)===tip&&RACE_DEFS[21].anim===5;})()`));
});
test('Tyranids retain smooth capital motion and three subdued biological finishes',()=>{
 const b=loadBattle();b.start(21,20,42,12);assert.ok(b.run(`(()=>{const s=ships.find(s=>s.race===21&&fightsAsCrown(s));s.v=.001;s.vy=50;s.pitch=0;battleAI.destination=()=>({goal:[s.x+1000,s.y+900,s.z],boost:1,mode:'ATTACK',target:-1});for(let i=0;i<60;i++)battleAI.moveCapital(s,i/30,1/30);const palettes=new Set();for(let seed=40;seed<43;seed++){const p=hullFinish({race:21,seed});if(p.gloss>.25||p.pattern!==14)return false;palettes.add(p.trim.join());}return Math.abs(s.pitch)<=.055&&palettes.size===3;})()`));
});
