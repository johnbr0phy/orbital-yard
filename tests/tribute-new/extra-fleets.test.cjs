const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {loadBattle}=require('./headless-battle.cjs');
const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
const prefix=html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__'));
const ctx=vm.createContext({console});vm.runInContext(prefix,ctx,{timeout:2000});const run=s=>vm.runInContext(s,ctx,{timeout:2000});
test('all 29 classes have finite bounded meshes, native guns and repeatable structural variants',()=>{
 for(let race=18;race<23;race++)for(let type=0;type<run(`EXTRA_CLASSES[${race-18}].length`);type++){
  const r=run(`(()=>{const s=buildExtraClass(${race},42,${type}),before=s.parts.length;armShip(s,${race},0);const m=shipMeshQ(s,.65);return {meta:s.meta,finite:Array.from(m.t).every(Number.isFinite),tri:m.tris,guns:s.muzzles.length,parts:s.parts.length-before,repeat:JSON.stringify(s)===JSON.stringify(buildExtraClass(${race},42,${type}))};})()`);
  assert.ok(r.finite&&r.tri>20&&r.tri<4000,JSON.stringify(r));assert.ok(r.guns>0);assert.equal(r.parts,0);assert.ok(r.repeat);
 }
});
test('new fleets fill all three muster bands using real class geometry',()=>{
 const b=loadBattle();let result;const worker=vm.createContext({console,postMessage:r=>result=r});vm.runInContext(prefix+b.run('fractureMesh.toString()+WORKER_MAIN'),worker,{timeout:2000});
 for(let race=18;race<23;race++)for(let band=0;band<3;band++){
  vm.runInContext(`onmessage({data:{kind:'batch',genId:1,jobs:[{id:0,f:${race},seed:42,hulls:0,band:${band}}]}})`,worker,{timeout:2000});const s=result.out[0];assert.ok(s.meta);assert.equal(run(`fleetBandOf(${s.meta.length},${race})`),band,`${race}/${band}: ${s.meta.klass}`);assert.ok(s.guns.length>0);
 }
});
test('muster, heroes, weapon profiles and AI cover all five fleets',()=>{
 const b=loadBattle();for(const [a,c] of [[18,19],[20,21],[22,18]]){
  b.start(a,c,777,24);const rows=b.run(`ships.map(s=>({race:s.race,klass:s.meta.klass,hero:s.hero,profile:s.ai?.profile?.name,wpn:weaponProfile(s),hp:s.hpMax,cloak:s.canCloak}))`);
  assert.ok(rows.every(s=>s.profile&&s.wpn.color.every(Number.isFinite)&&s.hp>0));
  for(const r of [a,c])assert.equal(rows.filter(s=>s.hero&&s.race===r).length,1);
  if(a===22){assert.ok(rows.filter(s=>/OPTIMUS/.test(s.klass)).length>=8);assert.ok(rows.some(s=>s.hero&&/ROADSTER/.test(s.klass)));assert.ok(rows.some(s=>/STARSHIP/.test(s.klass)));}
  if(a===18)assert.ok(rows.filter(s=>s.race===18).every(s=>s.cloak));
 }
});
test('new captains have distinct anatomical identities and bounded geometry',()=>{
 const crew=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../armada-crew-new.js'),'utf8'),crew);
 const rows=vm.runInContext(`Array.from({length:5},(_,i)=>{const p=ArmadaCrew.profile(42,18+i),m=ArmadaCrew.geometry(p,{fear:.7},2);return {p,n:m.length,finite:m.every(t=>t.v.flat().every(Number.isFinite))}})`,crew);
 assert.equal(new Set(rows.map(r=>r.p.species)).size,5);for(const r of rows)assert.ok(r.finite&&r.n<3500&&r.p.color,r.p.species);
 assert.equal(vm.runInContext(`ArmadaCrew.profile(42,22,'ROADSTER / STARMAN').species`,crew),'Starman');
});
