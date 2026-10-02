const test = require('node:test');
const assert = require('node:assert/strict');
const {loadBattle} = require('./headless-battle.cjs');

function ionScene() {
  const b = loadBattle();
  b.run(`
    battleTime=2;warT0=0;intro=null;winner=null;counts=[10,10];
    ships=[];beams=[];wrecks=[];debrisQueue=[];flashes=[];
    function craft(id,side,x,z=0){
      const fr=()=>({v:new Float32Array([0,0,0,10,0,0,0,10,0]),i:new Uint32Array([0,1,2]),ox:0,oy:0,oz:0,r:10,extents:[10,10,2]});
      const s={id,side,race:5,seed:id+10,x,y:0,z,yaw:0,v:0,vy:0,spd:60,spdMax:90,
        slen:20,exL:10,exY:5,exZ:5,rad:12,hp:20,hpMax:20,turn:1,vao:{},arr:true,grace:false,
        meta:{klass:'TIE FIGHTER',desig:'TEST '+id},guns:[[10,0,0]],fragReady:true,fragData:[fr(),fr()]};
      ships.push(s);battleAI.equip(s);return s;
    }
    var gun=craft(0,0,0),friend=craft(1,0,160),enemy=craft(2,1,300),target=craft(3,1,500);
    var clear=craft(4,1,250,100),behind=craft(5,0,-100),beyond=craft(6,1,800);
    var lock={point:[500,0,0],target:3,radius:45,muz:[10,0,0]};
  `);
  return b;
}

test('ion column destroys intersecting friends and enemies, but not off-axis or out-of-segment ships', () => {
  const b=ionScene();
  b.run('fireIonFrom(gun,0,2,lock)');
  assert.ok(b.run('[friend,enemy,target].every(s=>s.dead&&s.destruction==="catastrophic")'));
  assert.ok(b.run('[gun,clear,behind,beyond].every(s=>!s.dead&&s.hp===s.hpMax)'));
  assert.equal(b.run('gun.kills'),2,'friendly fire does not earn an ace kill');
  assert.ok(b.run('[friend,enemy,target].every(s=>debrisQueue.some(w=>w.src===s.id))'));
  b.run('stepIonLances(2.1)');
  assert.equal(b.run('gun.kills'),2,'a sustained beam cannot count the same kill twice');
});

test('a ship entering an active ion column is hit; an expired column is harmless', () => {
  const b=ionScene();b.run('fireIonFrom(gun,0,2,lock);clear.z=0;stepIonLances(2.7)');
  assert.ok(b.run('clear.dead'));
  b.run('beyond.x=250;stepIonLances(3.6)');
  assert.equal(b.run('beyond.dead'),undefined);
});

test('ion source stays lit and attached to its muzzle throughout the discharge', () => {
  const b=ionScene();b.run('fireIonFrom(gun,0,2,lock);gun.x=15;stepIonLances(2.4);var n=appendIonCharges(2.4,0)');
  assert.equal(b.run('n'),1);
  assert.ok(b.run('beams[0].a.every((v,i)=>Math.abs(v-weaponMuzzle(gun,lock.muz,2.4)[i])<1e-9)'));
  assert.equal(b.run('appendIonCharges(4,0)'),0);
});

test('combat deaths always split into orange-edged hull pieces without circular death flashes', () => {
  const b=loadBattle();b.start(5,6,915,12);
  b.run(`endIntro();var cap=ships.find(s=>s.hulls);cap.hp=0;flashes=[];kill(cap,4);`);
  assert.ok(b.run('cap.destruction==="catastrophic"&&!cap.disabled&&debrisQueue.some(w=>w.src===cap.id)'));
  assert.ok(b.run('flashes.every(f=>f.c!==30)'));
  assert.ok(b.run('debrisQueue.every(w=>w.e&&w.e.length*3===w.v.length)'));
});

test('a saturated debris pool still gives a new death hull fragments within the existing limits', () => {
  const b=ionScene();
  b.run(`for(let i=0;i<64;i++)debrisQueue.push({x:0,y:0,z:0,vx:0,vy:0,vz:0,src:99});
    kill(friend,2);`);
  assert.ok(b.run('debrisQueue.filter(w=>w.src===friend.id).length>=2'));
  assert.ok(b.run('debrisQueue.length<=64&&debrisQueue.length+wrecks.length<=DEBRIS_LIMIT'));
});

test('objective results do not order a mass withdrawal and combatants cannot leave', () => {
  const b=ionScene();
  b.run('declareWinner(0,"station",2)');
  assert.ok(b.run('ships.every(s=>!s.leaveAt&&!s.routing&&!s.jumped)'));
  assert.equal(b.run('leaveBattle(enemy,3,"jump")'),false);
  assert.equal(b.run('leaveBattle(enemy,3,"edge")'),false);
});

test('a raid gives a flight destination without teleporting or hiding the ship', () => {
  const b=ionScene();
  assert.equal(b.run('flankRaid(friend,2,[1000,100,1000],10)'),true);
  assert.ok(b.run('friend.arr&&friend.x===160&&friend.y===0&&friend.z===0&&!friend.jumped&&friend.ai.order.kind==="MANEUVER"'));
});

test('relief ignores holding orders and formation slots until it reaches weapons range', () => {
  const b=ionScene();
  b.run(`gun.reliefGoal=[4000,0,0];gun.reliefReach=750;
    for(const s of ships)if(s.side===1)s.x+=4000;
    battleAI.index(ships,2,[],[]);battleAI.scan(gun,2);
    gun.ai.order={kind:'HOLD',point:[0,0,0],until:30};
    var p=battleAI.destination(gun,2,false);`);
  assert.ok(b.run('p.goal[0]>1000&&!p.station&&!p.slot&&p.boost>1'));
  b.run(`enemy.x=600;gun.ai.order=null;gun.ai.nextThink=0;gun.ai.target=enemy.id;
    gun.ai.contacts.set(enemy.id,battleAI.snapshot(enemy,3));
    battleAI.destination(gun,3,false);`);
  assert.equal(b.run('gun.reliefGoal'),null);
});

test('a real relief wave reaches the fight and fires within 45 seconds', () => {
  const b=loadBattle({modules:true});b.start(6,5,42,24,[6,-1]);
  b.run(`endIntro();battleTime=30;warT0=0;
    for(const s of ships){s.arr=true;s.grace=false;s.delay=-1;}
    for(const s of ships.filter(s=>s.side===0).slice(0,-2)){s.dead=true;counts[0]--;}
    maybeCallAlly(30);`);
  b.flush();
  b.run(`for(let i=0;i<300&&reliefBatches[0].phase!=='launched';i++)advanceReliefPlans(30+i/30);`);
  b.step(45);
  const n=b.run('reliefBatches[0].ids.filter(id=>ships[id].lastFire>30).length');
  assert.ok(n>=5,`${n} relief ships fired; the previous controller left all 25 holding`);
  assert.equal(b.run('ships.filter(s=>s.jumped).length'),0);
});
