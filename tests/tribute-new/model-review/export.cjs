// Isolated CPU-only forge export; no workers, WebGL, timers or battle.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync((process.argv[4]||path.join(__dirname,'../../../armada-war-tribute-new.html')),'utf8');
const source=html.slice(html.indexOf('\n<script>\n')+10,html.indexOf('//__ARMADA_WORKER_CUT__'));
const ctx=vm.createContext({console});vm.runInContext(source,ctx,{timeout:2000});
vm.runInContext('const P={fuse:.5,detail:.35,line:1},NL={topo:null,hulls:null,sym:null,nsec:null,fore:null,joint:null,aft:null,cockpit:null,wing:null,tail:null,booster:null,gear:null};',ctx);
const calls=process.argv[3]?JSON.parse(process.argv[3]):Array.from({length:18},(_,i)=>`buildHero(${i},42)`);
const out=[];
for(const call of calls){
 const model=vm.runInContext(`(()=>{const s=${call},m=shipMeshQ(s,.45);return {meta:s.meta,bb:s.bb,parts:s.parts.length,t:Array.from(m.t)};})()`,ctx,{timeout:1500});
 out.push({call,...model});
}
fs.writeFileSync(process.argv[2],JSON.stringify(out));
console.log(out.map(s=>({call:s.call,klass:s.meta.klass,parts:s.parts,triangles:s.t.length/9})));
