const test=require('node:test'),assert=require('node:assert/strict');
const crew=require('../../armada-crew-new.js');
function canvas(width,height){let calls=0;const context=new Proxy({},{get:(_,k)=>{if(['fillStyle','font','strokeStyle','lineWidth'].includes(k))return '';return (...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),`${k}: ${v}`);calls++;};},set:()=>true});return {clientWidth:width,clientHeight:height,getContext:()=>context,get calls(){return calls;}};}
test('all 23 races render animated captain and cockpit geometry at desktop and portrait sizes',()=>{
 for(const [w,h] of [[1440,900],[390,844]]){const c=canvas(w,h);for(let race=0;race<23;race++)for(const mode of ['captain','cockpit']){const p=crew.profile(42,race);crew.drawInterior(c,p,{fear:.8,hull:.4,turn:.2,speed:150,firing:true},12,mode);crew.drawInterior(c,p,{fear:.4,hull:.4},12.1,mode);}assert.ok(c.calls>1000);assert.ok(c.width<=1100);assert.ok(Math.abs(c.height/c.width-h/w)<.003);}
});
