const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
const ctx=vm.createContext({console});vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__')),ctx,{timeout:2000});
const run=s=>vm.runInContext(s,ctx,{timeout:2000});
test('new Rebel classes and six refits have finite bounded meshes and seated weapons',()=>{
 for(const type of [0,1,7,8,9,10,11])for(let role=0;role<6;role++){
  const r=run(`(()=>{const s=applyFleetRefit(buildRebelClass(42,${type}),6,42,${role});armShip(s,6,10);const m=shipMeshQ(s,.65);return {n:m.t.length/9,finite:Array.from(m.t).every(Number.isFinite),guns:s.muzzles.length,bb:s.bb};})()`);
  assert.ok(r.finite&&r.n>0&&r.n<4500,`${type}/${role}: ${r.n}`);assert.ok(r.guns>=2);assert.ok(r.bb[1].every((v,i)=>v>r.bb[0][i]));
 }
});
test('battle selection can muster every new class',()=>{
 const types=run(`Array.from({length:100},(_,seed)=>buildRebelMega(seed,10).meta.rebelHull)`);
 for(const type of [7,8,9,10,11])assert.ok(types.includes(type));
});
test('MC75 has a deep hanging tower and Liberty has broad wings',()=>{
 const r=run(`(()=>{const a=buildRebelClass(42,1),b=buildRebelClass(42,0);return {deep:a.meta.height/a.meta.length,wide:b.meta.beam/b.meta.length};})()`);
 assert.ok(r.deep>.35);assert.ok(r.wide>.45);
});
test('Rebel frigates use turret profiles irrespective of size',()=>{
 const start=html.indexOf('function weaponProfile('),end=html.indexOf('function weaponExtents(',start);
 vm.runInContext("const RACE_DEFS=Array.from({length:18},()=>({fire:'laser',beam:[1,0,0]}));"+html.slice(start,end),ctx);
 for(const klass of ['PELTA-CLASS FRIGATE','DP20 CORELLIAN GUNSHIP'])for(const slen of [80,140])assert.equal(run(`weaponProfile({race:6,slen:${slen},meta:{klass:'${klass}'}}).fixed`),false);
 assert.equal(run("weaponProfile({race:6,slen:14,meta:{klass:'T-65 X-WING'}}).fixed"),true);
});
