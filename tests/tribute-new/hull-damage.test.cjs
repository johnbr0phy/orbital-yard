const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
test('damage slows ships progressively without compounding on repeated hits',()=>{
 const b=loadBattle();assert.ok(b.run(`(()=>{const s={hp:65,hpMax:100,spd:100,spdMax:150,v:120,damagePods:[]};updateHullDamage(s,1);updateHullDamage(s,2);if(s.spd!==85||s.spdMax!==127.5)return false;s.hp=30;updateHullDamage(s,3);return Math.abs(s.spd-65)<1e-8&&Math.abs(s.spdMax-97.5)<1e-8;})()`));
});
test('leaks are rate limited and respect the shared particle cap',()=>{
 const b=loadBattle();assert.ok(b.run(`(()=>{const s={race:6,x:0,y:0,z:0,yaw:0,slen:100,damageStage:2,v:20};for(let i=0;i<100;i++)leakHullDust(s,1);if(dusts.length!==1)return false;dusts=Array(480).fill({});leakHullDust(s,3);return dusts.length===480;})()`));
});
test('live fittings detach once and their exact triangle ranges disappear',()=>{
 const b=loadBattle();b.start(5,6,42,24);
 assert.ok(b.run(`(()=>{const s=ships.find(s=>s.damagePods?.length&&s.ibo);if(!s)return false;const f=s.damagePods[0],before=debrisQueue.length;s.hp=s.hpMax*.6;updateHullDamage(s,20);const once=debrisQueue.length;updateHullDamage(s,21);return s.damagePods[0]===null&&once===before+1&&debrisQueue.length===once&&s.damageIndices.subarray(f.start,f.start+f.count).every(i=>i===0);})()`));
});
test('real forge detachable triangles exactly match their original attached position',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
 const b=loadBattle(),prefix=html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__'));let output;
 const ctx=vm.createContext({console,postMessage:data=>output=data});vm.runInContext(prefix+b.run('fractureMesh.toString()+WORKER_MAIN'),ctx,{timeout:2000});
 vm.runInContext("onmessage({data:{kind:'batch',genId:1,jobs:[{id:0,f:6,seed:4,hulls:0}]}})",ctx,{timeout:2000});
 const s=output.out[0];assert.ok(s.damagePods.length>0);assert.ok(Array.from(s.mesh.v).every(Number.isFinite));
 for(const p of s.damagePods)for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++){
  const attached=s.mesh.v[s.mesh.i[p.start+i]*3+axis],detached=p.v[p.i[i]*3+axis]+[p.ox,p.oy,p.oz][axis];assert.ok(Math.abs(attached-detached)<.001);
 }
});
