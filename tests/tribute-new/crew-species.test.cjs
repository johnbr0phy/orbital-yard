const test=require('node:test'),assert=require('node:assert/strict'),crew=require('../../armada-crew-new.js');
test('mixed fleets use multiple species, while ship provenance selects appropriate crew',()=>{
 for(const [race,n] of [[6,4],[10,3]])assert.equal(new Set(Array.from({length:80},(_,seed)=>crew.profile(seed,race).species)).size,n);
 for(let seed=0;seed<20;seed++){
  assert.equal(crew.profile(seed,6,'MC80 HOME ONE').species,'Mon Calamari');
  assert.equal(crew.profile(seed,13,'MANGALORE RAIDER GUNSHIP').species,'Mangalore');
  assert.equal(crew.profile(seed,13,'NEW YORK TAXI').species,'Human');
  assert.equal(crew.profile(seed,17,'VORLON TRANSPORT').species,'Vorlon encounter suit');
  assert.equal(crew.profile(seed,9).species,'Human');
 }
 assert.equal(new Set(Array.from({length:80},(_,seed)=>crew.profile(seed,12).substrate)).size,3);
});
test('nonhuman silhouettes vary per identity, react and stay inside a bounded portrait mesh budget',()=>{
 const signatures=new Set();
 for(let race=0;race<18;race++){
  const meshes=[];
  for(let seed=0;seed<8;seed++){
   const p=crew.profile(seed,race),mesh=crew.geometry(p,{fear:.2},1);
   assert.ok(mesh.length<3500,`${race}: ${mesh.length}`);
   assert.ok(mesh.every(f=>/^#[0-9a-f]{6}$/i.test(f.col)&&f.v.length===3&&f.v.flat().every(Number.isFinite)));
   meshes.push(JSON.stringify(mesh));
   assert.deepEqual(p,crew.profile(seed,race));
  }
  assert.equal(new Set(meshes).size,8,'distinct anatomy for fleet '+race);signatures.add(meshes[0]);
 }
 assert.equal(signatures.size,18);
 for(const race of [1,2,4,8,13,16,17]){const p=crew.profile(42,race);assert.notDeepEqual(crew.geometry(p,{},0),crew.geometry(p,{fear:.9,hit:1},2));}
});
test('Shadow portrait has a full spread of articulated limbs, and Yautja has four forward mandibles',()=>{
 const shadow=crew.geometry(crew.profile(42,8)),vs=shadow.flatMap(f=>f.v);
 assert.ok(Math.min(...vs.map(v=>v[0]))< -100&&Math.max(...vs.map(v=>v[0]))>100);
 assert.ok(Math.min(...vs.map(v=>v[1]))<=-100);
 const y=crew.geometry(crew.profile(42,16)),front=y.flatMap(f=>f.v).filter(v=>v[2]>55);
 assert.ok(front.some(v=>v[0]<0&&v[1]>-25)&&front.some(v=>v[0]>0&&v[1]>-25));
 assert.ok(front.some(v=>v[0]<0&&v[1]<-25)&&front.some(v=>v[0]>0&&v[1]<-25));
});
