const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
const ctx=vm.createContext({console});vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__')),ctx,{timeout:2000});
const run=s=>vm.runInContext(s,ctx,{timeout:2500});
const regular=['buildShip(42,{fuse:.5,detail:.35,line:1},{topo:null,hulls:null,sym:null,nsec:null,fore:null,joint:null,aft:null,cockpit:null,wing:null,tail:null,booster:null,gear:null})',...['Xeno','Lattice','Drift','Choir','Imperial','Rebel','Minbari','Shadow','Earthforce','Fed','Klingon','Borg','Mondo','USCM','Engineer','Yautja','Firstones'].map(n=>`build${n}(42)`)];
test('all 18 fleets have deterministic, finite refits with bounded fitting counts',()=>{
 for(const [race,call] of regular.entries()){
  const result=run(`(()=>{const a=applyFleetRefit(${call},${race},42,2),b=applyFleetRefit(${call},${race},42,2),m=shipMeshQ(a,.45);return {same:JSON.stringify(a)===JSON.stringify(b),finite:Array.from(m.t).every(Number.isFinite),n:m.t.length/9,added:a.meta.refit.addedParts,length:a.meta.length};})()`);
  assert.ok(result.same&&result.finite,`fleet ${race}`);assert.ok(result.n>0&&result.n<18000);assert.ok(result.added<=12);if(result.length>46&&race!==7)assert.ok(result.added>0,`fleet ${race} has no carrier fittings`);
 }
});
test('same-class cruiser roles change geometry with a small fixed mesh cost',()=>{
 const values=run(`Array.from({length:6},(_,role)=>{const s=applyFleetRefit(buildEarthforceClass(42,2),9,42,role);return {parts:JSON.stringify(s.parts),n:shipMeshQ(s,.45).t.length/9,added:s.meta.refit.addedParts};})`);
 assert.equal(new Set(values.map(v=>v.parts)).size,6);
 for(const v of values.slice(1)){assert.ok(v.added>0&&v.added<=12);assert.ok(v.n-values[0].n<250);}
});
test('common capital slots offer multiple recognizable classes',()=>{
 for(const [name,min] of [['Earthforce',4],['Rebel',5],['Fed',4]])assert.ok(run(`new Set(Array.from({length:40},(_,i)=>build${name}Mega(i+1,10).meta.klass)).size`)>=min,name);
});
test('named heroes and Babylon 5 retain their exact reference geometry',()=>{
 for(let race=0;race<18;race++)assert.ok(run(`(()=>{const s=buildHero(${race},42),before=JSON.stringify(s);applyFleetRefit(s,${race},42,4);return before===JSON.stringify(s);})()`),`hero ${race}`);
 assert.ok(run(`(()=>{const s=buildEarthforceMega(42,50),before=JSON.stringify(s);applyFleetRefit(s,9,42,4);return before===JSON.stringify(s);})()`));
});
test('refit identity reaches the worker response and fittings cannot become harvested guns',()=>{
 assert.match(html,/raceBuild=\(f,seed,hulls,hero\)=>applyFleetRefit/);
 assert.match(html,/refit:ship.meta.refit/);
 assert.match(html.slice(html.indexOf('function armShip(')),/if\(p.refitPart\)continue;/);
});
