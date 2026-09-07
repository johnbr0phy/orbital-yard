const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadBattle } = require('./headless-battle.cjs');

function call(ally = 20, size = 150, original = 6) {
  const b = loadBattle();
  b.start(original, 5, 42, 24, [ally, -1]);
  b.run(`
    battleTime=30; perFleet=${size};
    for(const s of ships){s.arr=true;s.grace=false;s.delay=-1;}
    var oldCount=ships.length;
    const own=ships.filter(s=>s.side===0);
    for(const s of own.slice(0,-2)){s.dead=true;counts[0]--;}
    var originalPositions=JSON.stringify(ships.map(s=>[s.x,s.y,s.z,s.yaw]));
    maybeCallAlly(battleTime);
  `);
  assert.equal(b.run('reliefBatches.length'), 1);
  return b;
}
function place(b) {
  b.flush();
  b.run(`for(let i=0;i<300&&reliefBatches[0].phase!=='launched';i++)advanceReliefPlans(30+i/30);`);
  assert.equal(b.run('reliefBatches[0].phase'), 'launched');
}

test('only a weakened, losing side calls; opted-out allies remain absent', () => {
  const b = loadBattle(); b.start(6, 5, 42, 24, [20, -1]);
  b.run(`battleTime=30;for(const s of ships){s.arr=true;s.grace=false;s.delay=-1;}maybeCallAlly(30);`);
  assert.equal(b.run('reliefBatches.length'), 0);
  b.run(`for(const s of ships.filter(s=>s.side===1).slice(0,-1)){s.dead=true;counts[1]--;}maybeCallAlly(31);`);
  assert.equal(b.run('reliefBatches.length'), 0);
  const losing = call();
  losing.run('maybeCallAlly(31);maybeCallAlly(32);');
  assert.equal(losing.run('reliefBatches.length'), 1);
});

test('unforged recruits cannot arrive or become action-camera subjects', () => {
  const b = call();
  const r = b.run(`(()=>{
    const incoming=ships.slice(oldCount);
    for(const s of incoming.slice(0,3))s.vao={}; // one worker finishes first
    for(let i=0;i<3;i++)simStep(40+i/30,1/30);
    updateActionCamera(40,.1);
    return {waiting:incoming.every(s=>!s.arr&&s.grace&&s.delay===Infinity),
      noCamera:actionCamera==null||actionCamera.subject<oldCount};
  })()`);
  assert.ok(r.waiting && r.noCamera, JSON.stringify(r));
});

test('commander covers the outmatched wing and responds to a rear breakthrough using fresh reports', () => {
  const b=loadBattle();
  b.run(`
    ships=[];warT0=0;
    for(let i=0;i<4;i++)ships.push({id:i,side:0,x:0,y:0,z:i<2?-900:900,
      hp:i<2?25:8,hpMax:25,slen:50,vao:{},delay:0,ai:{contacts:new Map()}});
    for(let i=4;i<8;i++)ships.push({id:i,side:1,x:600,y:0,z:i===4?-900:900,
      hp:25,hpMax:25,slen:50,hulls:i===4?0:10,vao:{},delay:0});
    for(const s of ships.slice(0,4))for(const t of ships.slice(4))s.ai.contacts.set(t.id,battleAI.snapshot(t,30));
  `);
  const wing=b.run(`(()=>{const p=reliefPicture(0,30);return {priority:p.priority,z:p.orders.relief.p[2],flank:p.orders.flank.p[2],goal:p.orders.relief.goal[2]};})()`);
  assert.equal(wing.priority, 'relief'); assert.ok(wing.z>0&&wing.goal>0&&wing.flank<0,JSON.stringify(wing));
  const rear=b.run(`(()=>{const t={id:8,side:1,x:-900,y:0,z:900,hp:100,hpMax:100,slen:300,hulls:10,vao:{},delay:0};ships.push(t);for(const s of ships.slice(0,4))s.ai.contacts.set(t.id,battleAI.snapshot(t,31));const p=reliefPicture(0,31);return {priority:p.priority,target:p.orders.intercept.target,goal:p.orders.intercept.goal[0],stale:reliefPicture(0,50).foes.length};})()`);
  assert.equal(rear.priority,'intercept');assert.equal(rear.target,8);assert.equal(rear.goal,-900);assert.equal(rear.stale,0);
});

for (const [ally, size, original] of [[20,150,6],[5,600,6],[19,600,6],[12,150,12],[17,24,6]]) {
  test(`fleet ${ally}: true hulls and jump corridors do not overlap at scale ${size}`, () => {
    const b=call(ally,size,original);place(b);
    const r=b.run(`(()=>{
      const batch=reliefBatches[0],fresh=batch.ids.map(id=>ships[id]);let overlaps=0;
      const obstacles=reliefObstacles(batch,40);
      for(let i=0;i<batch.reserved.length;i++){
        const a=batch.reserved[i];
        if(!reliefWorldClear(a)||obstacles.some(o=>reliefOverlap(a,o)))overlaps++;
        for(let j=i+1;j<batch.reserved.length;j++)if(reliefOverlap(a,batch.reserved[j]))overlaps++;
      }
      return {overlaps,real:fresh.some(s=>s.slen>300)&&fresh.every(s=>s.ai?.equipped&&!s.reliefPending&&Number.isFinite(s.delay)),
        unchanged:originalPositions===JSON.stringify(ships.slice(0,oldCount).map(s=>[s.x,s.y,s.z,s.yaw])),
        roles:[...new Set(fresh.map(s=>s.reliefRole))],spread:Math.max(...fresh.map(s=>s.delay))-Math.min(...fresh.map(s=>s.delay))};
    })()`);
    assert.equal(r.overlaps,0,JSON.stringify(r));assert.ok(r.real&&r.unchanged,JSON.stringify(r));
    assert.ok(r.roles.length>=2&&r.spread>.5,JSON.stringify(r));
  });
}

test('planet obstruction moves the entry corridor, not the planet or battle fleet', () => {
  const b=call(20,48);
  b.run(`const p=reliefPicture(0,30).orders.relief.p;worldBodies=[{center:p.slice(),radius:2400}];`);
  place(b);
  assert.ok(b.run(`reliefBatches[0].reserved.every(reliefWorldClear)`));
});

test('traffic entering a booked corridor delays the jump and chooses a new clear berth', () => {
  const b=call(20,48);place(b);
  const r=b.run(`(()=>{
    const batch=reliefBatches[0],s=batch.ids.map(id=>ships[id]).find(s=>s.slen<100),t=ships.find(s=>s.side===1&&!s.dead);
    const old=[s.x,s.y,s.z];[t.x,t.y,t.z]=old;t.grace=false;t.arr=true;t.v=0;
    prepareTraffic(40);const blocked=!clearReliefEntry(s,40)&&!s.arr&&s.delay>40-warT0;
    clearReliefEntry(s,40.5);clearReliefEntry(s,41);
    return {blocked,moved:V.len(V.sub(old,[s.x,s.y,s.z]))>1,clear:clearReliefEntry(s,41.5),
      untouched:JSON.stringify(old)===JSON.stringify([t.x,t.y,t.z])};
  })()`);
  assert.ok(r.blocked&&r.moved&&r.clear&&r.untouched,JSON.stringify(r));
});

test('restart discards pending reinforcements and both renderers share the same rules', () => {
  const b=call();b.start(6,5,71,24);
  assert.equal(b.run('reliefBatches.length'),0);
  const block=file=>{const s=fs.readFileSync(file,'utf8');return s.slice(s.indexOf('/* ===================== tactical reinforcements'),s.indexOf('function simStep(now,dt){'));};
  assert.equal(block('armada-war-tribute-new.html'),block('armada-three-engine.js'));
});

test('placement reads the updated battle after forging, retaining the last order if the caller dies', () => {
  const b=call(20,48);
  const before=b.run('reliefBatches[0].callPicture.orders.relief.p.slice()');
  b.run('for(const s of ships.slice(0,oldCount))if(s.side===0&&!s.dead)s.z+=6000;');
  place(b);
  assert.ok(b.run('reliefBatches[0].picture.orders.relief.p[2]')>before[2]+5000);
  const lost=call(20,48);
  const requested=lost.run('JSON.stringify(reliefBatches[0].callPicture.orders)');
  lost.run('for(const s of ships.slice(0,oldCount))if(s.side===0)s.dead=true;');
  place(lost);
  assert.equal(lost.run('JSON.stringify(reliefBatches[0].picture.orders)'),requested);
});
