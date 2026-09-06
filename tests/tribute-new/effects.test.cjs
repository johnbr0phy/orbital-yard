const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {loadBattle}=require('./headless-battle.cjs');
test('burst storms stay inside the fixed flash budget',()=>{
 const b=loadBattle();assert.equal(b.run('for(let i=0;i<3000;i++)flash(0,0,0,0,20,10);flashes.length'),224);
 assert.equal(b.run('new Set([5,8,10,12,15].map(deathEffectKind)).size'),5);
});
test('engine outlets follow authored bells and organic ships have no artificial burn',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../../armada-war-tribute-new.html'),'utf8'),ctx=vm.createContext({console});vm.runInContext(html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__')),ctx,{timeout:2000});
 assert.ok(vm.runInContext(`(()=>{const a=applyFleetRefit(buildRebelClass(42,0),6,42,1),ports=enginePorts(a,6);return ports.length>=4&&ports.length<=15&&ports.every(p=>p.every(Number.isFinite)&&a.parts.some(q=>q.enginePort&&q.c.every((v,i)=>v===p[i])))&&enginePorts(buildShadow(42),8).length===0;})()`,ctx,{timeout:2000}));
});
test('engine sprite work is capped and writes finite buffer values',()=>{
 const b=loadBattle();assert.ok(b.run(`(()=>{warT0=0;ships=Array.from({length:100},(_,i)=>({x:0,y:0,z:0,yaw:0,race:6,slen:100,v:20,spd:20,vao:true,arr:true,exhaust:[[-40,0,0,10]],delay:0}));sphereVis=()=>true;const n=appendEngineBurns(1,[],0);return n===192&&Array.from(flPool.subarray(0,n*7)).every(Number.isFinite);})()`));
});
