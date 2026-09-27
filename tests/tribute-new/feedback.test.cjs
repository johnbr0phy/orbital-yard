// Owner feedback after the story pass: ship speeds that answer the fight,
// asteroids that are not potatoes, a scoreboard that names reinforcements.
// (The First Ones' annihilation is covered in first-ones.test.cjs.)
const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
const J=(b,code)=>JSON.parse(b.run(`JSON.stringify(${code})`));

test('throttle: a chaser closes fast from far off and settles to its target\'s speed in the pocket',()=>{
  const b=loadBattle();b.start(5,6,1101,10);
  const r=J(b,`(()=>{const s=ships.find(q=>q.slen<60&&q.side===0),t=ships.find(q=>q.slen<60&&q.side===1);s.hp=s.hpMax;s.yawV=0;t.v=40;
    const at=g=>{t.x=s.x+g+skinOf(t)*.88;t.y=s.y;t.z=s.z;return throttle(s,0,s.spd,t.id,'ATTACK');};
    return {far:at(4000),mid:at(300),pocket:at(160),dash:s.spdMax||s.spd*1.3,cruise:s.spd};})()`);
  assert.ok(r.far>r.mid&&r.mid>r.pocket,JSON.stringify(r));
  assert.ok(r.far>=r.dash*.84,'full burn from far off');
  assert.ok(Math.abs(r.pocket-40)<r.cruise*.5+1,'near the target speed in the firing pocket '+JSON.stringify(r));
});

test('throttle: hard turns and engine damage cost speed; each pilot feathers differently',()=>{
  const b=loadBattle();b.start(5,6,1101,10);
  const r=J(b,`(()=>{const s=ships.find(q=>q.slen<60);s.hp=s.hpMax;s.yawV=0;const straight=throttle(s,0,s.spd,-1,'ESCORT');
    s.yawV=s.turn;const turning=throttle(s,0,s.spd,-1,'ESCORT');s.yawV=0;s.hp=s.hpMax*.1;const hurt=throttle(s,0,s.spdMax*2,-1,'ESCORT');s.hp=s.hpMax;const whole=throttle(s,0,s.spdMax*2,-1,'ESCORT');
    const a=ships.filter(q=>q.slen<60).slice(0,6).map(q=>{q.yawV=0;q.hp=q.hpMax;return throttle(q,7,q.spd,-1,'ESCORT')/q.spd;});
    return {straight,turning,hurt,whole,spread:Math.max(...a)-Math.min(...a)};})()`);
  assert.ok(r.turning<r.straight*.8,'a hard turn bleeds speed');
  assert.ok(r.hurt<r.whole*.75,'engine damage lowers the top end');
  assert.ok(r.spread>.02,'pilots do not hold the same number');
});

test('acceleration is limited by size: fighters spool in about 1.5 s, capitals take far longer',()=>{
  const b=loadBattle();b.start(5,6,1101,10);
  const r=J(b,`(()=>{const f=ships.find(q=>q.slen<60),c=ships.find(q=>q.slen>=400);
    const spool=(s)=>{s.v=0;const top=s.spdMax||s.spd*1.3;let t=0;while(s.v<top*.9&&t<120){s.v=approachSpeed(s,top,1/30);t+=1/30;}return t;};
    return {fighter:spool(f),capital:spool(c)};})()`);
  assert.ok(r.fighter>1&&r.fighter<3,JSON.stringify(r));assert.ok(r.capital>6,JSON.stringify(r));
});

test('in a real war ships rarely hold one speed: under 15% of 5-second windows are flat',()=>{
  const b=loadBattle({cores:1});b.start(5,6,1101,40);b.step(15);
  const r=J(b,`(()=>{const tr=new Map();for(let i=0;i<30*30;i++){battleTime+=1/30;simStep(battleTime,1/30);for(const s of ships){if(s.dead||!s.arr||s.slen>=180)continue;(tr.get(s.id)||tr.set(s.id,[]).get(s.id)).push(s.v);}}
    let flat=0,all=0;for(const v of tr.values())for(let i=0;i+150<=v.length;i+=30){const w=v.slice(i,i+150),mx=Math.max(...w),mn=Math.min(...w);all++;if(mx>3&&mx<=mn*1.04)flat++;}return flat/all;})()`);
  assert.ok(r<.15,'share of flat 5 s windows '+r);
});

test('asteroids: fractured, varied, and never larger than their collision radius',()=>{
  const b=loadBattle();
  const r=J(b,`[11,222,3333,44444,555555].map(seed=>{const m=rockMesh(300,seed),v=m.v;let far=0,ext=[0,0,0];for(let i=0;i<v.length;i+=3){far=Math.max(far,Math.hypot(v[i],v[i+1],v[i+2]));for(let a=0;a<3;a++)ext[a]=Math.max(ext[a],Math.abs(v[i+a]));}
    const e=ext.slice().sort((x,y)=>y-x);return {far,aspect:e[0]/e[2],verts:v.length/3};})`);
  for(const x of r)assert.ok(Math.abs(x.far-300)<1e-6,'farthest point is the collision radius');
  assert.ok(r.some(x=>x.aspect>1.4),'some rocks are long shards, not balls '+JSON.stringify(r.map(x=>x.aspect)));
  assert.ok(new Set(r.map(x=>x.aspect.toFixed(2))).size===r.length,'no two alike');
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
  assert.match(page,/else if\(uRock>\.5\)\{[\s\S]{0,200}N=normalize\(cross\(dFdx\(vW\),dFdy\(vW\)\)\)/,'rocks are lit by their real faceted surface, not a sphere');
});

test('scoreboard names the reinforcements and counts them apart from the main fleet',()=>{
  const b=loadBattle({modules:true});b.start(6,5,42,24,[10,-1]);
  b.run(`endIntro();battleTime=30;for(const s of ships){s.arr=true;s.grace=false;s.delay=-1;}
    const own=ships.filter(s=>s.side===0);for(const s of own.slice(0,-2)){s.dead=true;counts[0]--;}maybeCallAlly(battleTime);`);
  const before=J(b,'scoreCounts()');
  b.flush();b.run(`for(let i=0;i<600&&reliefBatches[0].phase!=='launched';i++)advanceReliefPlans(30+i/30);`);
  const inbound=J(b,'scoreCounts()');
  b.run(`for(const s of ships)if(s.race===10){s.arr=true;s.vao=s.vao||{};}`);
  const arrived=J(b,'scoreCounts()'),own=J(b,'ships.filter(s=>s.side===0&&s.race===6&&!s.dead&&s.vao).length');
  assert.equal(before.allyInbound[0]+before.allyAlive[0]>0||inbound.allyInbound[0]>0,true,'the called fleet is counted inbound');
  assert.equal(arrived.allyInbound[0],0);assert.ok(arrived.allyAlive[0]>0,JSON.stringify(arrived));
  assert.equal(arrived.alive[0],own,'the main fleet count excludes the reinforcements');
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
  assert.match(page,/"<span class=\\"bcAlly\\" style=\\"--c:"\+raceColour\(allyRace\[i\]\)\+"\\">\+ <b>"\+raceShort\(allyRace\[i\]\)/,'the top bar names the ally in its colour');
});

test('convoy ticker lines keep the count at the moment each ship fell',()=>{
  const b=loadBattle({modules:true});b.run("storyForce={plans:null,objective:'CONVOY'}");b.start(5,6,1101,24);b.step(15);
  const r=J(b,`(()=>{const o=battleAI.story.objective;const ids=o.ids.slice(0,2);for(const id of ids){ships[id].lastHit=null;kill(ships[id],battleTime);}battleTime+=1/30;simStep(battleTime,1/30);
    return bc.log.events.filter(e=>e.type==='convoyLost').map(e=>e.text);})()`);
  assert.deepEqual(r.map(t=>t.match(/(\d+) lost/)[1]),['1','2']);
});

test('one button hides all UI; U toggles it and Esc brings it back',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../armada-war-tribute-new.html'),'utf8');
  assert.match(page,/<button type="button" id="uiHide"[^>]*aria-label="Hide all UI"/);
  assert.match(page,/<button type="button" id="uiBack"/,'a way back when everything is hidden');
  // Everything but the canvas, the ion flash and the way back is hidden.
  assert.match(page,/body\.noui>:not\(#gl\):not\(#ionFlash\):not\(#uiBack\)\{visibility:hidden!important;pointer-events:none!important\}/);
  assert.match(page,/if\(k==="u"&&!e\.repeat\)setNoUi\(!document\.body\.classList\.contains\("noui"\)\)/);
  assert.match(page,/if\(document\.body\.classList\.contains\("noui"\)\)\{setNoUi\(false\);return;\}/,'Esc shows the UI first');
  assert.match(page,/function openPicker\(\)\{setNoUi\(false\);/,'menus never open invisible');
});

test('the swarm has guns: hive ships hunt instead of holding, and spit seeking volleys',()=>{
  const b=loadBattle();b.start(21,5,1101,40);
  const hook=`globalThis.__v={};(()=>{const rf=raceFire;raceFire=function(s,...r){const n=plasmas.length;rf(s,...r);const k=plasmas.length-n;
    if(s.race===21&&k>0){const c=s.slen>=180?'cap':s.slen>=60?'mid':'small';__v[c]=Math.max(__v[c]||0,k);__v.seek=(__v.seek||0)+plasmas.slice(n).filter(p=>p.seek!=null&&p.kind==='bio').length;__v.n=(__v.n||0)+k;}};})()`;
  b.run(hook);b.step(20);
  const held=J(b,`ships.filter(s=>s.race===21&&s.slen>=180&&s.ai&&!s.dead&&s.ai.order&&s.ai.order.kind==='HOLD').length`);
  assert.equal(J(b,'battleAI.story.objective&&battleAI.story.objective.kind'),'STATION','a station war, where capitals used to sit on the station');
  assert.equal(held,0,'no hive ship holds ground');
  // A brawl: the hive ships march in and reach their bio-cannons' 1,150 m by about 80 s.
  const w=loadBattle({cores:1,modules:true});w.start(21,5,3303,40);
  w.run(hook);w.step(100);
  const v=J(w,'__v');
  assert.equal(v.cap,7,'a hive ship spits seven spores '+JSON.stringify(v));
  assert.equal(v.small,2,JSON.stringify(v));
  assert.equal(v.seek,v.n,'every spore seeks');
  // A spore that starts off-line curves onto its prey.
  const c=J(b,`(()=>{const t=ships.find(q=>q.side===1&&!q.dead&&q.arr);t.v=0;plasmas=[{x:t.x-600,y:t.y,z:t.z+300,vx:300,vy:0,vz:0,t0:battleTime,life:8,side:0,race:21,ph:0,dead:false,kind:'bio',seek:t.id,from:ships.find(q=>q.side===0).id}];
    const pl=plasmas[0];for(let i=0;i<90&&!pl.dead;i++){battleTime+=1/30;simStep(battleTime,1/30);}
    return {hit:pl.dead};})()`);
  assert.ok(c.hit,'the spore reaches its prey');
});
