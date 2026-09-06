const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
test('Shadow shell stays anchored while tentacle tips flex smoothly with bounded displacement',()=>{
 const b=loadBattle();
 assert.ok(b.run(`(()=>{for(let t=0;t<20;t+=.1){const p=shadowFlex([10,4,2],100,1,t);if(p[0]!==10||p[1]!==4||p[2]!==2)return false;}return true;})()`));
 assert.ok(b.run(`(()=>{const g=[-40,0,35],a=shadowFlex(g,100,1,0),c=shadowFlex(g,100,1,2);return Math.hypot(...a.map((v,i)=>v-c[i]))>.5&&Array.from({length:200},(_,i)=>shadowFlex(g,100,1,i*.1)).every(p=>Math.hypot(...p.map((v,j)=>v-g[j]))<3.1);})()`));
});
test('Shadow muzzle follows its moving tentacle through yaw; other fleets stay rigid',()=>{
 const b=loadBattle();
 assert.ok(b.run(`(()=>{const g=[-40,0,35],s={race:8,slen:100,wf:1,x:10,y:20,z:30,yaw:Math.PI/2},p=shadowFlex(g,100,1,2),w=gunWorld(s,g,2);return Math.abs(w[0]-(10-p[2]))<1e-8&&Math.abs(w[1]-(20+p[1]))<1e-8&&Math.abs(w[2]-(30+p[0]))<1e-8;})()`));
 assert.ok(b.run(`(()=>{const s={race:15,slen:100,x:0,y:0,z:0,yaw:0};return gunWorld(s,[40,0,35],2).every((v,i)=>v===[40,0,35][i]);})()`));
});

test('Shadows emit directly from their native aperture without added cannons',()=>{
 const b=loadBattle();
 assert.ok(b.run(`(()=>{const s={race:8,slen:180,wf:1,x:0,y:0,z:0,yaw:0,meta:{klass:'SHADOW BATTLECRAB'},guns:[[12,0,0]],barrelMounts:[[12,0,0]]};const f=barrelFrame(s,s.guns[0],2);return shipBarrels(s).length===0&&f.length===0&&f.tip.every((v,i)=>v===f.pivot[i]);})()`));
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
 const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8');const ctx=vm.createContext({console});
 vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__')),ctx,{timeout:2000});
 assert.ok(vm.runInContext(`[buildShadow(42),buildShadowMega(42,25),buildShadowHero()].every(s=>{s=applyFleetRefit(s,8,42);const before=JSON.stringify(s.parts);armShip(s,8,25);return JSON.stringify(s.parts)===before&&s.muzzles.length===1&&s.parts.some(p=>p.k==='disc'&&p.c.every((v,i)=>v===s.muzzles[0][i]));})`,ctx,{timeout:2000}));
});
