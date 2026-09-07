const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {loadBattle}=require('./headless-battle.cjs');
const html=fs.readFileSync('armada-war-tribute-new.html','utf8'),b=loadBattle(),ctx=vm.createContext({console,postMessage(){}});
vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__'))+b.run('fractureMesh.toString()+WORKER_MAIN'),ctx);
const run=source=>vm.runInContext(source,ctx,{timeout:30000});
test('all 23 fleets: seeded craft, capital bands and heroes retain connected assemblies',()=>{
 let reviewed=0,repaired=0,maxAdded=0;const classes=new Set();
 for(let race=0;race<23;race++)for(const [seed,hulls,hero] of [...Array.from({length:16},(_,i)=>[42+i*2654435761>>>0,0,false]),...[10,25,50].flatMap(h=>[42,73,1234,98765].map(seed=>[seed,h,false])),[42,0,true]]){
  const r=run(`(()=>{const s=raceBuild(${race},${seed},${hulls},${hero});armShip(s,${race},${hulls});const old=s.parts.length;seatShipAssemblies(s,${race});const g=attachmentGroups(s.parts),m=shipMeshQ(s,.12);return {klass:s.meta.klass,groups:g.groups.length,added:s.parts.length-old,finite:Array.from(m.t).every(Number.isFinite),roots:s.parts.filter(p=>p.attachmentRoot).every(p=>p.structural&&p.refitPart)};})()`);
  assert.equal(r.groups,1,`fleet ${race} seed ${seed} ${r.klass}: ${r.groups} components`);assert.ok(r.finite&&r.roots);reviewed++;repaired+=r.added>0;maxAdded=Math.max(maxAdded,r.added);classes.add(r.klass);
 }
 console.log(`${reviewed} ships / ${classes.size} class names / ${repaired} repaired assemblies; max ${maxAdded} roots per hull`);
});
test('a small bearing survives low detail while an isolated decorative speck is omitted',()=>{
 const r=run(`(()=>{const box=(x,y,z,r)=>({k:'box',c:[x,y,z],u:[r,0,0],v:[0,r,0],w:[0,0,r]});const s={parts:[box(-5,0,0,4),box(0,0,0,1),box(5,0,0,4)],bb:[[-9,-4,-4],[9,4,4]],meta:{length:18}};seatShipAssemblies(s,5);return {bearing:s.parts[1].structural,low:shipMeshQ({parts:[s.parts[1]],bb:[[-100,-100,-100],[100,100,100]]},.12).tris,detail:shipMeshQ({parts:[box(0,0,0,1)],bb:[[-100,-100,-100],[100,100,100]]},.12).tris};})()`);
 assert.ok(r.bearing);assert.equal(r.low,12);assert.equal(r.detail,0);
});
test('repairs are deterministic, idempotent and never move original ship geometry',()=>{
 assert.ok(run(`(()=>{const s=raceBuild(22,73,0),n=s.parts.length;armShip(s,22,0);const before=JSON.stringify(s.parts);seatShipAssemblies(s,22);const clean=p=>{const q={...p};delete q.structural;return q;};const stable=JSON.stringify(s.parts.slice(0,JSON.parse(before).length).map(clean))===JSON.stringify(JSON.parse(before).map(clean));const after=JSON.stringify(s);seatShipAssemblies(s,22);return stable&&after===JSON.stringify(s);})()`));
});
