const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
const ctx=vm.createContext({console});vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__')),ctx,{timeout:2000});
const run=s=>vm.runInContext(s,ctx,{timeout:2000});
const fixtures=[['buildEarthforceClass(42,0)',9,[2,4,4],'tube'],['buildEarthforceClass(42,2)',9,[4,3,6],'tube'],['buildRebelClass(42,5)',6,[11,6,15],'lathe']];
test('propulsion replaces complete banks and contains the advertised engine count',()=>{
 for(const [call,race,counts,kind] of fixtures)for(let mode=0;mode<3;mode++){
  const r=run(`(()=>{const s=applyFleetRefit(${call},${race},42,0,${mode}),m=shipMeshQ(s,.45);return {count:s.parts.filter(p=>p.driveGroup&&p.k==='${kind}').length,meta:s.meta.structure.engines,finite:Array.from(m.t).every(Number.isFinite),triangles:m.t.length/9};})()`);
  assert.equal(r.count,counts[mode]);assert.equal(r.meta,counts[mode]);assert.ok(r.finite&&r.triangles<6000);
 }
});
test('Olympus wide drive increases beam, stacked drive increases height, both keep the same guns',()=>{
 const values=run(`Array.from({length:3},(_,mode)=>{const s=applyFleetRefit(buildEarthforceClass(42,0),9,42,0,mode);return {beam:s.meta.beam,height:s.meta.height,guns:JSON.stringify(s.parts.filter(p=>!p.driveGroup)),triangles:shipMeshQ(s,.45).t.length/9};})`);
 assert.ok(values[1].height>values[0].height*1.2);assert.ok(values[2].beam>values[0].beam*1.4);
 assert.equal(values[0].guns,values[1].guns);assert.equal(values[0].guns,values[2].guns);
 assert.ok(values[1].triangles-values[0].triangles<300);
});
test('stock propulsion is unchanged and a seed selects a stable structural layout',()=>{
 for(const [call,race] of fixtures){
  assert.ok(run(`(()=>{const s=${call},before=JSON.stringify(s.parts);applyDriveLayout(s,42,0);return before===JSON.stringify(s.parts);})()`));
  assert.ok(run(`(()=>{const a=applyFleetRefit(${call},${race},42),b=applyFleetRefit(${call},${race},42);return JSON.stringify(a)===JSON.stringify(b);})()`));
 }
 assert.equal(run(`new Set(Array.from({length:24},(_,seed)=>applyFleetRefit(buildEarthforceClass(seed,0),9,seed).meta.structure.index)).size`),3);
});
test('new propulsion is excluded from weapon harvesting and its identity reaches the battle',()=>{
 assert.ok(run(`(()=>{const s=applyFleetRefit(buildEarthforceClass(42,0),9,42,0,1);return s.parts.filter(p=>p.driveGroup).every(p=>p.refitPart);})()`));
 assert.match(html,/structure:ship.meta.structure/);
});
