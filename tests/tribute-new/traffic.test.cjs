const test=require('node:test'),assert=require('node:assert/strict');const {loadBattle}=require('./headless-battle.cjs');
function scene(){const b=loadBattle();b.run(`function testHull(id,x,y,z,yaw=0){return {id,x,y,z,yaw,pitch:0,roll:0,v:0,vy:0,vao:true,arr:true,grace:false,dead:false,hulls:50,slen:400,exL:200,exY:20,exZ:70,rad:215,race:5,side:id%2,hp:100,hpMax:100,turn:.1,spd:60};}ships=[testHull(0,0,0,0),testHull(1,250,0,0,Math.PI/2)];wrecks=[];`);return b;}
test('rotated destroyer hulls cannot occupy the same volume, including coincident centres',()=>{
 const b=scene();assert.ok(b.run(`(()=>{collide(4);const a=trafficBox(ships[0],4),b=trafficBox(ships[1],4);return !trafficContact(a,b)&&ships.every(s=>s.hp===100);})()`));
 assert.ok(b.run(`(()=>{ships[1].x=ships[0].x;ships[1].y=ships[0].y;ships[1].z=ships[0].z;collide(5);return ships.every(s=>[s.x,s.y,s.z].every(Number.isFinite))&&!trafficContact(trafficBox(ships[0],5),trafficBox(ships[1],5));})()`));
});
test('thin hulls in separate vertical lanes do not collide just because their bounding spheres overlap',()=>{
 const b=scene();assert.equal(b.run(`ships[1].x=0;ships[1].y=60;!!trafficContact(trafficBox(ships[0],4),trafficBox(ships[1],4))`),false);
});
test('swept collision stops a ship crossing completely through another between ticks',()=>{
 const b=scene();assert.ok(b.run(`(()=>{const a=ships[0],b=ships[1];a.exL=a.exY=a.exZ=10;a.slen=20;a.hulls=0;a.x=600;a.y=a.z=0;a.v=100;b.x=b.y=b.z=0;b.yaw=0;a.trafficPrevious=[-600,0,0];b.trafficPrevious=[0,0,0];collide(5);return a.x<b.x&&a.hp>0&&!trafficContact(trafficBox(a,5),trafficBox(b,5));})()`));
});
test('a hero embedded in a disabled hulk is released in one contact, without overlap damage',()=>{
 const b=scene();assert.ok(b.run(`(()=>{const s=ships[0];s.hero=true;s.hulls=0;s.exL=10;s.exY=4;s.exZ=8;s.x=s.y=s.z=0;const w={uid:7,x:0,y:0,z:0,yaw:0,extents:[300,60,100],rad:330,vx:0,vy:0,vz:0,t0:0,bax:[0,1,0],bang:0,ax:[0,1,0],ang:0};shipWreckContact(s,w,5);return s.hp===100&&!trafficContact(trafficBox(s,5),trafficBox(w,5));})()`));
});
test('pilots predict head-on traffic and fast debris arriving from outside the forward corridor',()=>{
 const b=scene();assert.ok(b.run(`(()=>{ships[1].x=1000;ships[1].yaw=Math.PI;ships[0].v=ships[1].v=70;prepareTraffic(4);trafficPilot(ships[0],4);trafficPilot(ships[1],4);return ships.every(s=>s.trafficGoal&&s.trafficBrake<1)&&ships[0].trafficHand!==ships[1].trafficHand;})()`));
 assert.ok(b.run(`(()=>{ships.length=1;const s=ships[0];s.hulls=0;s.exL=10;s.exY=s.exZ=5;s.v=60;s.trafficScan=0;s.trafficUntil=0;s.trafficGoal=null;wrecks=[{uid:7,x:120,y:0,z:300,yaw:0,extents:[10,10,10],rad:18,vx:0,vy:0,vz:-150,t0:0,bax:[0,1,0],bang:0,ax:[0,1,0],ang:0}];prepareTraffic(5);trafficPilot(s,5);return s.debrisTarget===7&&s.trafficGoal&&s.trafficBrake<1;})()`));
});
test('shooting debris creates smaller finite fragments with a bounded recursion depth',()=>{
 const b=scene();assert.ok(b.run(`(()=>{const v=new Float32Array([-20,-20,-20,20,-20,-20,20,20,-20,-20,20,-20,-20,-20,20,20,-20,20,20,20,20,-20,20,20]),i=new Uint32Array([0,1,2,0,2,3,4,6,5,4,7,6,0,4,5,0,5,1,2,6,7,2,7,3]);const w={uid:7,src:0,x:0,y:0,z:0,yaw:0,extents:[20,20,20],rad:35,vx:0,vy:0,vz:0,v,i,integ:1,t0:0,bax:[0,1,0],bang:0,ax:[0,1,0],ang:0,paint:hullFinish(ships[0])};damageDebris(w,2,5,[0,0,0]);const n=debrisQueue.length,ok=n===3&&debrisQueue.every(c=>c.splitDepth===1&&c.rad<w.rad&&Array.from(c.v).every(Number.isFinite));w.shatter=false;w.splitDepth=2;damageDebris(w,2,6,[0,0,0]);return ok&&debrisQueue.length===n;})()`));
});
test('capital AI brakes and changes altitude before contact on an otherwise head-on route',()=>{
 const b=loadBattle();b.start(5,6,42,12);const r=b.run(`(()=>{const pair=[ships.find(s=>s.side===0&&s.hulls&&!s.hero),ships.find(s=>s.side===1&&s.hulls&&!s.hero)];for(const s of ships)s.dead=!pair.includes(s);pair.forEach((s,i)=>{s.x=i?600:-600;s.y=s.z=0;s.yaw=i?Math.PI:0;s.v=s.spd=60;s.exL=200;s.exY=20;s.exZ=70;s.slen=400;s.rad=215;s.arr=true;s.grace=false;});battleAI.destination=s=>({goal:[-s.x,0,0],boost:1,mode:'ATTACK',target:pair[1-s.side].id});let contact=false,slow=60,climb=0;for(let i=0;i<600;i++){const now=i/30;prepareTraffic(now);for(const s of pair){trafficPilot(s,now);battleAI.moveCapital(s,now,1/30);slow=Math.min(slow,s.v);climb=Math.max(climb,Math.abs(s.y));}if(trafficContact(trafficBox(pair[0],now),trafficBox(pair[1],now)))contact=true;}return {contact,slow,climb};})()`);
 assert.equal(r.contact,false);assert.ok(r.slow<40);assert.ok(r.climb>40);
});
