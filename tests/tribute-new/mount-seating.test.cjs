const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {loadBattle}=require('./headless-battle.cjs');
test('forge mounting sites lie on exact surviving hull vertices across six fleets',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8'),b=loadBattle();let result;const ctx=vm.createContext({console,postMessage:r=>result=r});vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__'))+b.run('fractureMesh.toString()+WORKER_MAIN'),ctx,{timeout:2000});
 for(const f of [0,5,6,9,10,12]){
  vm.runInContext(`onmessage({data:{kind:'batch',genId:1,jobs:[{id:0,f:${f},seed:42,hulls:25}]}})`,ctx,{timeout:2000});const s=result.out[0];assert.ok(s.mountSites.length>0&&s.mountSites.length<=64);
  const vertices=new Set();for(let i=0;i<s.mesh.v.length;i+=3)vertices.add(Array.from(s.mesh.v.subarray(i,i+3)).join(','));
  for(const p of s.mountSites)assert.ok(vertices.has(p.join(',')),`fleet ${f}: detached mounting site`);
 }
});
test('estimated turret and lance positions are replaced with hull anchors',()=>{
 const b=loadBattle();assert.ok(b.run(`(()=>{const s={race:12,hulls:25,slen:100,meta:{klass:'CUBE'},mountSites:[[10,20,30]],guns:[[50,50,50]],turrets:[{lx:-20,ly:40,lz:20}],lances:[{lx:15,ly:99,lz:2}]};seatBattleMounts(s);return shipBarrels(s).length===1&&s.turrets[0].ly===20&&s.lances[0].ly===20;})()`));
});
test('rotating ring mounts remain attached to the animated ring',()=>{
 const b=loadBattle();assert.ok(b.run(`(()=>{const s={race:9,slen:100,ringX:0,ringW:5};const p=animatedMount(s,[0,10,0],Math.PI/.55/2);return Math.abs(p[1])<1e-8&&Math.abs(p[2]-10)<1e-8;})()`));
});
