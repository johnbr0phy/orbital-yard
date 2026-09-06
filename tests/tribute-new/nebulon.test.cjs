const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
const ctx=vm.createContext({console});vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__')),ctx,{timeout:2000});
const run=s=>vm.runInContext(s,ctx,{timeout:2000});
test('six Nebulon assemblies are distinct and stay inside a bounded finite mesh budget',()=>{
 const shapes=run(`Array.from({length:6},(_,i)=>{const s=applyFleetRefit(buildRebelClass(42,3),6,42,i),m=shipMeshQ(s,.65);return {name:s.meta.architecture,geometry:JSON.stringify(s.parts),n:m.t.length/9,finite:Array.from(m.t).every(Number.isFinite)};})`);
 assert.equal(new Set(shapes.map(s=>s.geometry)).size,6);assert.equal(new Set(shapes.map(s=>s.name)).size,6);
 for(const s of shapes)assert.ok(s.finite&&s.n>0&&s.n<6000,`${s.name}: ${s.n}`);
});
test('base has a thin exposed boom, descending blade and a compact seven-engine stern',()=>{
 const r=run(`(()=>{const s=buildRebelClass(42,3),at=hullDeckAt(s.parts,0,0,true),bb=efBB(s.parts),engines=s.parts.filter(p=>p.refitPart&&p.k==='lathe');return {boomTop:at.y,low:bb[0][1],high:bb[1][1],engines:engines.length,stern:efBB(s.parts.filter(p=>partExtents(p).every(e=>e[0][0]<-80)))};})()`);
 assert.ok(r.boomTop<25&&r.boomTop>10);assert.ok(r.low< -100&&r.high>80);assert.equal(r.engines,7);assert.ok(r.stern[1][1]-r.stern[0][1]<100);
});
test('Nebulon gets assembly layouts instead of generic deck housings',()=>{
 assert.ok(run(`Array.from({length:6},(_,i)=>applyFleetRefit(buildRebelClass(42,3),6,42,i)).every(s=>s.meta.architecture&&s.meta.refit.addedParts===0)`));
 assert.match(html,/architecture:ship.meta.architecture/);
});
