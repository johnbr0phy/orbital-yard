const test=require('node:test');
const assert=require('node:assert/strict');
const AI=require('../../armada-battle-ai-new.js');
const {loadBattle}=require('./headless-battle.cjs');
const definitions=loadBattle().run('RACE_DEFS');
const ship=(id,side=0,race=0,extra={})=>({id,side,race,seed:10000+id,x:0,y:0,z:0,yaw:0,
  hp:10,hpMax:10,slen:30,rad:15,spd:60,spdMax:85,turn:1,v:40,vy:0,hulls:0,
  arr:true,grace:false,dead:false,vao:{},squad:-1,kills:0,...extra});

test('all 18 fleets generate reproducible, varied pilots and a conserved body budget',()=>{
  for(let race=0;race<18;race++){
    const b=new AI.FleetMinds(definitions),variants=new Set();
    for(let i=0;i<40;i++){
      const s=ship(i,0,race),copy=ship(i,0,race);
      b.equip(s);b.equip(copy);
      assert.deepEqual(s.ai.traits,copy.ai.traits);assert.deepEqual(s.ai.budget,copy.ai.budget);
      assert.equal(s.ai.budget.reduce((a,b)=>a+b),100);
      assert.ok(s.ai.budget.every(n=>n>0));assert.ok(s.spd>0&&s.hpMax>0);
      variants.add(s.ai.budget.join(','));
    }
    assert.ok(variants.size>30);
    const cap=ship(500,0,race,{slen:6000,hulls:50,hp:300,hpMax:300});
    b.equip(cap);assert.ok(cap.spd>15&&cap.spd<80);
  }
});

test('sensors respect range, rear blind spots, cloaking and stale positions',()=>{
  const b=new AI.FleetMinds(definitions),s=ship(1,0,16),front=ship(2,1,0,{x:400}),rear=ship(3,1,0,{x:-400});
  b.index([s,front,rear],1);b.scan(s,1);
  assert.ok(s.ai.contacts.has(2));assert.ok(!s.ai.contacts.has(3));
  assert.ok(b.fireable(s,front,1));
  front.x=9000;b.index([s,front,rear],2);b.scan(s,2);
  assert.equal(s.ai.contacts.get(2).x,400);assert.ok(!b.fireable(s,front,2));
  rear.x=300;rear.cloaked=true;b.scan(s,3);assert.ok(!s.ai.contacts.has(3));
  rear.x=100;b.scan(s,4);assert.ok(s.ai.contacts.has(3),'nearby cloaks have a counter');
  rear.x=10000;b.scan(s,25);assert.equal(s.ai.contacts.size,0);
});

test('allied reports expire instead of refreshing each other forever',()=>{
  const b=new AI.FleetMinds(definitions),a=ship(1,0,10),ally=ship(2,0,10,{z:100}),foe=ship(3,1,0,{x:300});
  b.index([a,ally,foe],1);b.scan(a,1);b.scan(ally,1);
  foe.x=9000;
  for(let now=2;now<=25;now++){b.index([a,ally,foe],now);b.scan(a,now);b.scan(ally,now);}
  assert.equal(a.ai.contacts.size,0);assert.equal(ally.ai.contacts.size,0);
});

test('fear responds to wounds, can overrule an ace and recovers with safety',()=>{
  const b=new AI.FleetMinds(definitions),s=ship(1,0,11,{hero:true,hp:1,hpMax:10,hurtT:1}),
    enemies=Array.from({length:6},(_,i)=>ship(i+2,1,12,{x:140+i*30,hp:300,hpMax:300,hulls:10}));
  b.index([s,...enemies],1);b.seedShip(s);s.ai.fear=.95;
  b.think(s,1);assert.equal(s.ai.action,'RETREAT');
  const before=s.ai.fear;s.hp=s.hpMax;
  for(let now=2;now<45;now++){b.index([s],now);b.think(s,now);}
  assert.ok(s.ai.fear<before*.25);
});

test('ion lock commits to a place, warns defenders and never erases a full hull',()=>{
  const b=loadBattle();b.start(0,1,71);
  b.run(`endIntro();for(const s of ships){s.arr=true;s.grace=false;s.x=20000+s.id*1000;}
    var gun=ships.find(s=>s.side===0&&s.hulls===50),victim=ships.find(s=>s.side===1&&!s.hulls);
    gun.x=0;gun.y=0;gun.z=0;gun.yaw=0;victim.x=400;victim.y=0;victim.z=0;victim.v=0;victim.yaw=Math.PI;
    battleAI.index(ships,2,squads,[]);var lock=battleAI.ionLock(gun,0,2);`);
  assert.ok(b.run('!!lock'));const point=b.run('JSON.stringify(lock.point)');
  b.run('battleAI.index(ships,2.1,squads,[lock]);battleAI.scan(victim,2.1);battleAI.think(victim,2.1);');
  assert.equal(b.run('victim.ai.action'),'EVADE');
  b.run('victim.x=3000;fireIonFrom(gun,0,lock.fire,lock);');
  assert.equal(b.run('JSON.stringify(lock.point)'),point);assert.ok(b.run('victim.hp===victim.hpMax'));
  b.run('victim.x=lock.point[0];victim.y=lock.point[1];victim.z=lock.point[2];fireIonFrom(gun,0,lock.fire,lock);');
  assert.ok(b.run('victim.hp>0&&victim.hp<victim.hpMax'));
  b.run('victim.hp=victim.hpMax=300;victim.hulls=50;fireIonFrom(gun,0,lock.fire,lock);');
  assert.ok(b.run('victim.hp>280'));
});

test('hero damage advantages are bounded and use the same armour calculation',()=>{
  const b=new AI.FleetMinds(definitions),normal=ship(1),hero=ship(2,0,0,{hero:true}),target=ship(3,1);
  for(const s of [normal,hero,target])b.equip(s);
  const ordinary=b.damage(target,1,normal,1),ace=b.damage(target,1,hero,1);
  assert.ok(ace/ordinary<1.6);assert.ok(b.damage(hero,1,normal,1)>.6);
});

test('reinforcement pilots receive the same minds, equipment and inspection controls',()=>{
  const b=loadBattle();b.start(0,1,55,48,[7,-1]);
  b.run(`endIntro();battleTime=25;var originalCount=ships.length;
    for(const s of ships.filter(s=>s.side===0).slice(0,32))kill(s,battleTime);
    battleAI.index(ships,battleTime,squads,[]);maybeCallAlly(battleTime);`);
  b.flush();b.step(5);
  assert.ok(b.run('ships.length>originalCount&&allyRace[0]===7'));
  assert.ok(b.run('ships.slice(originalCount).every(s=>s.ai&&s.ai.equipped&&s.ai.budget.reduce((a,b)=>a+b)===100&&Number.isFinite(s.x))'));
  b.run('card(originalCount)');
  assert.match(b.elements.get('card').innerHTML,/CONFIDENCE/);
  assert.match(b.elements.get('card').innerHTML,/LUCK/);
  b.elements.get('brainSensors').onclick();assert.equal(b.run('showSensors'),true);
});

test('real battle restarts reproduce hulls, decisions and damage',()=>{
  const b=loadBattle();
  const snapshot=()=>b.run('JSON.stringify(ships.map(s=>[s.seed,s.x,s.y,s.z,s.hp,s.kills,s.ai.action]))');
  b.start(0,1,123);b.step(35);const first=snapshot();
  b.start(0,1,123);b.step(35);assert.equal(snapshot(),first);
});

test('30 and 120 render frames per second produce the same combat state',()=>{
  const states=[];
  for(const fps of [30,120]){
    const b=loadBattle();b.start(0,1,917);
    b.run(`endIntro();lastT=1;for(let i=1;i<=${fps*35};i++)frame(1000+i*1000/${fps});`);
    states.push(b.run('JSON.stringify({time:Math.round(battleTime*30),ships:ships.map(s=>[s.x,s.y,s.z,s.hp,s.kills,s.ai.action])})'));
  }
  assert.equal(states[0],states[1]);
});
