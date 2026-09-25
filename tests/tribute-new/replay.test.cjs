const test=require('node:test'),assert=require('node:assert/strict');
const RP=require('../../armada-replay-new.js');
const {loadBattle}=require('./headless-battle.cjs');

const fleet=n=>Array.from({length:n},(_,i)=>({id:i,x:i,y:0,z:0,yaw:0,roll:0,pitch:0,hp:10,hpMax:10,dead:false}));
function move(ships,t){for(const s of ships){s.x=s.id*10+t*(s.id+1);s.y=Math.sin(t+s.id);s.z=-t;s.yaw=(t*.3+s.id)%(2*Math.PI)-Math.PI;s.roll=t*.01;s.pitch=-t*.005;s.hp=10-t*.1;}}

test('ring round-trip: recorded snapshots sample back exactly, and interpolate between',()=>{
  const r=RP.createRing({seconds:5,hz:10,maxShips:8}),ships=fleet(5),out=new Float32Array(8),truth=new Map();
  for(let k=0;k<=40;k++){const t=k/10;move(ships,t);r.record(t,ships,s=>!s.dead,[]);truth.set(k,ships.map(s=>[s.x,s.y,s.z,s.yaw,s.roll,s.pitch]));}
  for(const k of [0,17,40])for(const s of ships){assert.ok(r.sample(k/10,s.id,out));const want=truth.get(k)[s.id];for(let i=0;i<6;i++)assert.ok(Math.abs(out[i]-Math.fround(want[i]))<1e-6,k+':'+i);assert.equal(out[6],1);}
  r.sample(1.05,2,out);const a=truth.get(10)[2],b=truth.get(11)[2];assert.ok(Math.abs(out[0]-(a[0]+b[0])/2)<1e-4);
});

test('ring keeps only its window, grows for reinforcements and reports liveness',()=>{
  const r=RP.createRing({seconds:2,hz:10,maxShips:2}),ships=fleet(2),out=new Float32Array(8);
  for(let k=0;k<100;k++){move(ships,k/10);if(k===60)ships.push(...fleet(6).slice(2));if(k===80)ships[3].dead=true;r.record(k/10,ships,s=>!s.dead,[]);}
  const [t0,t1]=r.range();assert.ok(Math.abs(t1-9.9)<1e-9&&t1-t0<=2.2,JSON.stringify([t0,t1]));
  assert.ok(r.maxShips>=6);
  r.sample(9.9,3,out);assert.equal(out[6],0,'dead ship not shown');
  r.sample(9.9,5,out);assert.equal(out[6],1);
});

test('clips copy a subset exactly and the reel keeps the five best',()=>{
  const r=RP.createRing({seconds:10,hz:10,maxShips:16}),ships=fleet(10),a=new Float32Array(8),b=new Float32Array(8);
  for(let k=0;k<80;k++){move(ships,k/10);r.record(k/10,ships,()=>true,[[k,0,0,k,1,0,5,0]]);}
  const c=r.clip(2,6,[1,4,7],{score:3});
  for(const t of [2,3.35,6])for(const id of [1,4,7]){r.sample(t,id,a);c.sample(t,id,b);assert.deepEqual(Array.from(a),Array.from(b));}
  assert.equal(c.sample(3,2,b),false,'ships outside the clip are absent');
  assert.equal(c.segmentsAt(4).data[0],40);
  const reel=RP.createReel(5),evicted=[];
  for(let i=0;i<8;i++){const e=reel.offer(r.clip(i*.5,i*.5+1,[0],{score:[5,1,9,3,7,2,8,4][i]}));if(e)evicted.push(e.meta.score);}
  assert.deepEqual(reel.clips.map(x=>x.meta.score),[9,8,7,5,4]);assert.deepEqual(evicted.sort(),[1,2,3]);
  assert.deepEqual(reel.chronological().map(x=>x.start),[0,1,2,3,3.5]);
});

function battle(){const b=loadBattle({modules:true});b.start(5,6,31,24);b.run('endIntro();lastT=1;');return b;}
const state=b=>b.run('JSON.stringify(ships.map(s=>[s.x,s.y,s.z,s.yaw,s.hp,s.dead,!!s.vao]).concat([battleTime,tracers.length,wrecks.map(w=>[w.x,w.ang,!!w.gone])]))'); // flash and spark counts are cosmetic (Math.random)

test('a replay changes nothing: the war continues exactly as if nobody watched',()=>{
  const A=battle(),B=battle();
  for(const b of [A,B])b.run('for(let i=1;i<=60*40;i++)frame(1000+i*1000/60);');
  assert.equal(state(A),state(B));
  const before=state(B);
  B.run('const r=bc.ring.range();startReplay({t0:r[1]-10,t1:r[1],focus:[0,0,0],slowAt:r[1]-4});');
  assert.ok(B.run('!!replayState'));
  // Every frame that ends still in replay leaves the simulation untouched.
  const frames=B.run(`(()=>{let n=0,bad=0;const t0=battleTime,s0=JSON.stringify(ships.map(s=>[s.x,s.hp]));while(replayState&&n<60*30){frame(5e5+n*1000/60);n++;if(replayState&&(battleTime!==t0||JSON.stringify(ships.map(s=>[s.x,s.hp]))!==s0))bad++;}return [n,bad];})()`);
  assert.ok(frames[0]>60*9,'replay played '+frames[0]+' frames');assert.equal(frames[1],0);
  // Afterwards both wars reach the same states at the same step counts.
  const trace=(b,t)=>new Map(b.run(`(()=>{const h=[];for(let i=1;i<=60*12;i++){frame(${t}+i*1000/60);h.push([Math.round(battleTime*30),JSON.stringify(ships.map(s=>[s.x,s.y,s.z,s.hp,s.dead]))]);}return h;})()`));
  const a=trace(A,1e6),c=trace(B,2e6),shared=[...c.keys()].filter(k=>a.has(k));
  assert.ok(shared.length>100);for(const k of shared)assert.equal(c.get(k),a.get(k),'step '+k);
});

test('dead hulls keep their mesh for the replay window only, unless a highlight pins them',()=>{
  const b=battle();
  b.run('for(let i=1;i<=60*90&&!bc.retired.length;i++)frame(1000+i*1000/60);');
  assert.ok(b.run('bc.retired.length')>0);
  b.run('const s=bc.retired[0];s.replayMesh.pins=1;window.__pinned=s.id;');
  const t=b.run('battleTime');
  b.run(`for(let i=1;i<=30*30;i++){battleTime+=1/30;simStep(battleTime,1/30);broadcastTick(battleTime,1/30);}`);
  assert.ok(b.run('bc.retired.every(s=>battleTime-s.replayMesh.t<=24||s.replayMesh.pins>0)'));
  assert.ok(b.run('!!ships[__pinned].replayMesh'),'pinned mesh kept');
  b.run('ships[__pinned].replayMesh.pins=0;broadcastTick(battleTime,1/30)');
  assert.equal(b.run('ships[__pinned].replayMesh'),null,'released once unpinned');
  assert.ok(b.run('battleTime')>t+29);
});

test('a corpse that dissolves after its highlight was captured keeps its mesh for that highlight',()=>{
  const b=battle();
  b.run('for(let i=1;i<=60*40;i++)frame(1000+i*1000/60);');
  // A live hull stands in for a drifting corpse: a clip names it, then it retires.
  const id=b.run('(()=>{const s=ships.find(q=>q&&q.vao&&!q.dead);const r=bc.ring.range();bc.reel.offer(bc.ring.clip(r[1]-4,r[1],[s.id],{score:999,ev:{type:"capitalKill",t:r[1]-1}}));retireMesh(s,battleTime);s.vao=null;return s.id;})()');
  assert.equal(b.run(`ships[${id}].replayMesh.pins`),1,'pinned by the clip it appears in');
  b.run(`for(let i=1;i<=30*30;i++){battleTime+=1/30;simStep(battleTime,1/30);broadcastTick(battleTime,1/30);}`);
  assert.ok(b.run(`!!ships[${id}].replayMesh`),'kept past the 24 s window while the clip holds it');
});
