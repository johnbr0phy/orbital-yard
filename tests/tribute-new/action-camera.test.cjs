const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
function scene(){const b=loadBattle();b.run(`ships.length=0;for(let i=0;i<4;i++)ships.push({id:i,x:i*130,y:0,z:0,yaw:0,slen:35,side:i%2,arr:true,grace:false,dead:false,vao:{},lastFire:0,hurtT:-100});sel=null;pilotId=null;watchMode='action';actionCamera=null;cam.ex=450;cam.ey=150;cam.ez=450;cam.yaw=-2.4;cam.pitch=-.22;`);return b;}
test('action entry preserves the camera and holds a moving fight instead of chasing fresh firing events',()=>{
 const b=scene();assert.ok(b.run(`(()=>{const before=JSON.stringify(cam);updateWatchCamera(0,1,true);return before===JSON.stringify(cam);})()`));
 const result=b.run(`(()=>{const id=actionCamera.subject,start=cam.ex;for(let i=0;i<600;i++){ships[3].lastFire=i/60;ships[0].x+=.2;updateWatchCamera(i/60,1/60);}return {held:id===actionCamera.subject,moved:Math.abs(cam.ex-start),finite:Object.values(cam).every(Number.isFinite)};})()`);
 assert.ok(result.held);assert.ok(result.moved>20);assert.ok(result.finite);
});
test('destroyed subjects linger and retarget without a sudden pan or position jump',()=>{
 const b=scene();const r=b.run(`(()=>{updateActionCamera(0,0);for(let i=0;i<240;i++)updateActionCamera(i/60,1/60);const old=actionCamera.subject;ships[old].dead=true;for(let i=0;i<60;i++)updateActionCamera(4+i/60,1/60);const held=actionCamera.subject===old;let pan=0,accel=0,lastV=0;for(let i=0;i<360;i++){const yaw=cam.yaw,x=cam.ex;updateActionCamera(5+i/60,1/60);pan=Math.max(pan,Math.abs(cam.yaw-yaw));const v=(cam.ex-x)*60;if(i)accel=Math.max(accel,Math.abs(v-lastV));lastV=v;}return {held,changed:actionCamera.subject!==old,pan,accel};})()`);
 assert.ok(r.held&&r.changed);assert.ok(r.pan<.012,JSON.stringify(r));assert.ok(r.accel<20,JSON.stringify(r));
});
test('camera moves between simulation ticks and is consistent at 30 and 120 render frames per second',()=>{
 const samples=[30,120].map(hz=>{const b=scene();return b.run(`(()=>{for(let i=0;i<${hz*8};i++)updateActionCamera(0,1/${hz});return [cam.ex,cam.ey,cam.ez,cam.yaw];})()`);});
 for(let i=0;i<3;i++)assert.ok(Math.abs(samples[0][i]-samples[1][i])<2);
 assert.ok(Math.abs(samples[0][3]-samples[1][3])<.015);
});
test('scheduled shots change subjects and portrait framing stays finite',()=>{
 const b=scene();assert.ok(b.run(`(()=>{cvs.width=360;cvs.height=800;updateActionCamera(0,0);const first=actionCamera.subject;for(let i=0;i<1080;i++)updateActionCamera(i/60,1/60);return actionCamera.index>=2&&actionCamera.subject!==first&&Object.values(cam).every(Number.isFinite);})()`));
});
test('a travelling fighter remains inside the frame during a tracking shot',()=>{
 const b=scene();const error=b.run(`(()=>{ships.length=1;ships[0].v=80;ships[0].yaw=0;let error=0;for(let i=0;i<720;i++){ships[0].x+=80/60;updateActionCamera(i/60,1/60);if(i>300){const s=ships[0],d=Math.atan2(s.z-cam.ez,s.x-cam.ex)-cam.yaw;error=Math.max(error,Math.abs(Math.atan2(Math.sin(d),Math.cos(d))));}}return error;})()`);
 assert.ok(error<.3,'subject drifted outside central framing: '+error);
});
