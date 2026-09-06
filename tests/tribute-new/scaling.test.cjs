const test=require('node:test'),assert=require('node:assert/strict');const {loadBattle}=require('./headless-battle.cjs');
test('800 synthetic hulls: index preserves exhaustive hits while rejecting distant candidates',()=>{
 const b=loadBattle();const r=b.run(`(()=>{const ships=Array.from({length:800},(_,id)=>({id,x:(id%40)*200,y:0,z:Math.floor(id/40)*200,yaw:.3,slen:30,exL:15,exY:5,exZ:7}));ships.push({id:800,x:2000,y:0,z:2000,yaw:1,slen:4000,exL:2000,exY:100,exZ:100});const index=new WeaponSpatialIndex();index.build(ships);let candidates=0,missing=0;for(let i=0;i<40;i++){const t=ships[i*19],a=[t.x-40,0,t.z],z=[t.x+40,0,t.z],got=index.query(a,z,2);candidates+=got.length;for(const s of ships)if(weaponSegmentHit(a,z,s,0,2)!==null&&!got.includes(s))missing++;}return {missing,candidates,exhaustive:ships.length*40};})()`);
 assert.equal(r.missing,0);assert.ok(r.candidates<r.exhaustive*.05);console.log(JSON.stringify(r));
});
test('loaded ship destruction does not split triangles on the main thread',()=>{
 const b=loadBattle();b.start(12,9,915,12,[-1,-1]);b.run(`endIntro();var cap=ships.find(s=>s.hulls);cap.destroyMode='catastrophic';fractureMesh=()=>{throw Error('unexpected live fracture')};kill(cap,4);`);assert.ok(b.run('cap.dead&&debrisQueue.length>0'));
});
test('slow simulation frame is bounded to one tick with limited catch-up debt',()=>{
 const b=loadBattle();b.run(`warT0=0;ships=[];var ticks=0,clock=0;simStep=()=>ticks++;performance.now=()=>clock+=11;lastT=1;battleAccumulator=.1;frame(1100);`);
 assert.equal(b.run('ticks'),1);assert.ok(b.run('battleAccumulator<=1/30'));
});
