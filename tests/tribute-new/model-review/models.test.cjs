const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../../../armada-war-tribute-new.html'),'utf8');
const ctx=vm.createContext({console});vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__')),ctx,{timeout:2000});
const defs=html.indexOf('const RACE_DEFS=[');vm.runInContext(html.slice(defs,html.indexOf('];',defs)+2),ctx);
const run=s=>vm.runInContext(s,ctx,{timeout:1500});
test('all 18 featured hulls and 39 capital selections have finite bounded meshes',()=>{
 const calls=Array.from({length:18},(_,i)=>`buildHero(${i},42)`);
 for(const n of ['Imperial','Rebel','Minbari','Shadow','Earthforce','Fed','Klingon','Borg','Mondo','USCM','Engineer','Yautja','Firstones'])for(const z of [10,25,50])calls.push(`build${n}Mega(42,${z})`);
 let max=0;
 for(const call of calls){const r=run(`(()=>{const s=${call},m=shipMeshQ(s,.65);return {finite:Array.from(m.t).every(Number.isFinite),n:m.t.length/9,length:s.meta.length,bb:s.bb};})()`);
  assert.ok(r.finite&&r.n>0&&r.n<18000,`${call}: ${r.n} triangles`);assert.ok(r.length>0);assert.ok(r.bb[0].every((v,i)=>Number.isFinite(v)&&r.bb[1][i]>v));max=Math.max(max,r.n);
 }
 console.log(`57 isolated meshes; maximum ${max} triangles at review quality.`);
});
test('changed hero apertures track actual final geometry',()=>{
 assert.ok(run(`(()=>{const s=buildHero(8,42);return s.muzzles.every(p=>s.parts.some(q=>q.k==='disc'&&q.c.every((v,i)=>Math.abs(v-p[i])<1e-7)));})()`));
 assert.ok(run(`(()=>{const s=buildHero(7,42);return s.muzzles.length===3&&s.muzzles.every(p=>s.parts.some(q=>q.k==='disc'&&q.c.every((v,i)=>Math.abs(v-p[i])<1e-7)));})()`));
 assert.ok(run(`(()=>{const s=buildHero(9,42);return Math.abs(s.meta.length-258)<1e-6&&s.muzzles.every(p=>p.every((v,i)=>v>=s.bb[0][i]-1&&v<=s.bb[1][i]+1));})()`));
});
test('Borg diamond is open, Engineer horseshoe is broad, Engineer hulls stay rigid and Shadows flex their tips',()=>{
 assert.ok(run(`(()=>{const s=buildHero(12,42);return !s.parts.some(p=>p.k==='loft')&&s.parts.some(p=>p.k==='sphere');})()`));
 assert.ok(run(`(()=>{const s=buildHero(15,42);return (s.bb[1][2]-s.bb[0][2])/(s.bb[1][0]-s.bb[0][0])>.65;})()`));
 assert.equal(run('RACE_DEFS[8].anim'),4);assert.equal(run('RACE_DEFS[15].anim'),0);
});
