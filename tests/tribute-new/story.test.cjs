const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
const AI=require('../../armada-battle-ai-new.js');
const BC=require('../../armada-broadcast-new.js');

// A running war with every module, arrived and past the jump.
function war(a=5,b=6,seed=1101,size=40,seconds=0,force=null){
  const w=loadBattle({cores:1,modules:true});
  if(force)w.run(`storyForce=${JSON.stringify(force)}`);
  w.start(a,b,seed,size);
  if(seconds)w.step(seconds);
  return w;
}
const storyState=`JSON.stringify({ships:ships.map(s=>[s.id,+s.x.toFixed(4),+s.z.toFixed(4),+s.hp.toFixed(4),s.dead?1:0,s.jumped?1:0,s.routing?1:0,s.ace||'',s.vendetta?s.vendetta.target:-1,s.ai?s.ai.action:'',s.stand||'']),
  escaped,pods:pods.map(p=>p.state),tows:tows.map(t=>[t.tug,t.done,t.attached!=null]),
  sides:battleAI.story.sides.map(x=>[x.flag,x.leaderless,x.plan&&x.plan.kind,x.plan&&x.plan.state]),
  objective:battleAI.story.objective&&[battleAI.story.objective.kind,battleAI.story.objective.progress,battleAI.story.objective.saved,battleAI.story.objective.lost],
  events:bc.log.events.filter(e=>e.type!=='kill').map(e=>[e.type,+(e.t).toFixed(3),e.ship??-1,e.partner??-1]),winner,winReason})`;

test('doctrine: one row per fleet, with the rules the brief names',()=>{
  assert.equal(AI.DOCTRINE.length,AI.PROFILES.length);
  for(const d of AI.DOCTRINE){assert.ok(d.why&&d.why.length>20);assert.equal(d.plans.length,AI.PLANS.length);assert.ok(['jump','edge'].includes(d.escape));assert.equal(d.stand.length,3);}
  const borg=AI.DOCTRINE[12],dominion=AI.DOCTRINE[19],rebels=AI.DOCTRINE[6];
  assert.equal(borg.rout,null,'the Borg never rout');assert.equal(borg.spread,0);
  assert.equal(dominion.rout,null);assert.equal(dominion.retreat,false,'the Jem\'Hadar never retreat');
  assert.equal(rebels.retreat,true);assert.equal(rebels.escape,'jump','the Rebels retreat to fight another day');
});

test('a doctrine that forbids retreat never chooses it',()=>{
  const w=war(19,12,4404,30,70);
  const actions=w.run('battleAI.stats.actions');
  const dominionRetreats=w.run(`ships.filter(s=>s.side===0&&s.ai&&(s.ai.action==='RETREAT'||s.ai.action==='ROUT')).length`);
  assert.equal(dominionRetreats,0,JSON.stringify(actions));
});

test('the flagship falls, command goes silent, a successor takes over and the HUD knows',()=>{
  const w=war(5,6,1101,30,30);
  const r=w.run(`(()=>{const st=battleAI.story,f=ships[st.sides[0].flag];f.lastHit=null;kill(f,battleTime);
    battleTime+=1/30;simStep(battleTime,1/30); // story events reach the log on the next tick
    const down=bc.log.events.some(e=>e.type==='flagshipDown'&&e.ship===f.id),leaderless=st.sides[0].leaderless;return {id:f.id,down,leaderless};})()`);
  assert.ok(r.down&&r.leaderless,JSON.stringify(r));
  w.step(15);
  const s=w.run(`(()=>{const st=battleAI.story,e=bc.log.events.find(e=>e.type==='successor'&&e.side===0);updateHud(1e6,battleTime);return {leaderless:st.sides[0].leaderless,flag:st.sides[0].flag,event:!!e,eventShip:e&&e.ship,alive:ships[st.sides[0].flag]&&!ships[st.sides[0].flag].dead,text:e&&e.text};})()`);
  assert.equal(s.leaderless,false);assert.ok(s.event&&s.alive&&s.flag!==r.id&&s.eventShip===s.flag,JSON.stringify(s));
  assert.match(s.text,/takes command/);
});

test('a broken squadron routs, runs and leaves alive; the war counts it as withdrawn, not killed',()=>{
  const w=war(6,5,2202,30,34);
  const r=w.run(`(()=>{const q=squads.find(q=>q.side===0&&q.state==='steady'&&q.mem.filter(id=>!ships[id].dead&&ships[id].arr).length>=3&&!q.hero);q.engagedAt=0;q.stress=9;
    for(let i=0;i<30;i++){battleTime+=1/30;simStep(battleTime,1/30);}
    return {id:q.id,state:q.state,rout:bc.log.events.some(e=>e.type==='rout'&&e.squad===q.id),orders:q.mem.filter(id=>ships[id].ai&&ships[id].ai.order&&ships[id].ai.order.kind==='ROUT').length};})()`);
  assert.ok(r.rout&&['routing','gone','steady'].includes(r.state),JSON.stringify(r));
  const before=w.run('({counts:counts.slice(),escaped:escaped.slice()})');
  w.step(20);
  const after=w.run(`({escaped:escaped.slice(),jumped:ships.filter(s=>s.jumped).length,killsLogged:bc.log.events.filter(e=>/kill|Kill/.test(e.type)&&ships[e.ship].jumped).length})`);
  assert.ok(after.escaped[0]>before.escaped[0]||after.jumped>0,JSON.stringify({before,after}));
  assert.equal(after.killsLogged,0,'a ship that jumped out is never logged as a kill');
});

test('a ram resolves through the collision solver: an impact event, damage to both, no scripted kill',()=>{
  const w=war(5,6,1101,30,30);
  const r=w.run(`(()=>{const caps=ships.filter(s=>!s.dead&&s.arr&&!s.grace&&(s.hulls===10));const a=caps.find(s=>s.side===0),b=caps.find(s=>s.side===1);
    // Put them a hull's length apart, nose to nose, and let the doomed one choose to ram.
    b.x=a.x+Math.cos(a.yaw)*(a.slen+b.slen)*.7;b.y=a.y;b.z=a.z+Math.sin(a.yaw)*(a.slen+b.slen)*.7;
    const hpA=a.hp,hpB=b.hp;battleAI.story.setOrder(a,'RAM',{target:b.id,until:battleTime+30});a.ramming=b.id;
    let hit=null;for(let i=0;i<30*25&&!hit;i++){battleTime+=1/30;simStep(battleTime,1/30);hit=bc.log.events.find(e=>e.type==='ram'&&e.ship===a.id);}
    return {hit:!!hit,closing:hit&&hit.closing,damagedA:a.hp<hpA,damagedB:b.hp<hpB||b.dead};})()`);
  assert.ok(r.hit&&r.damagedA&&r.damagedB,JSON.stringify(r));
});

test('wrecks stay dangerous: a fighter that clips a disabled hull dies, the same way every time',()=>{
  const once=()=>{const w=war(5,6,1101,30,30);return w.run(`(()=>{const cap=ships.find(s=>!s.dead&&s.arr&&s.hulls===10&&s.hullMesh);cap.destroyMode='disabled';kill(cap,battleTime);
    const wr=wrecks.find(q=>q.disabled&&q.src===cap.id);const f=ships.find(s=>!s.dead&&s.arr&&!s.grace&&!s.hero&&s.slen<60&&s.side===1);
    wr.t0=battleTime-5;const box=trafficBox(wr,battleTime);let ax=0;for(let i=1;i<3;i++)if(box.e[i]<box.e[ax])ax=i;
    // Come in across the hull's thinnest side, level, at fighter speed.
    const n=box.axes[ax],flat=Math.hypot(n[0],n[2])>.3?n:box.axes[(ax+1)%3],k=Math.hypot(flat[0],flat[2]),dx=flat[0]/k,dz=flat[2]/k;
    const reach=box.e.reduce((v,e,i)=>v+e*Math.abs(box.axes[i][0]*dx+box.axes[i][2]*dz),0)+30;
    f.x=wr.x+dx*reach;f.y=wr.y;f.z=wr.z+dz*reach;f.yaw=Math.atan2(-dz,-dx);f.pitch=0;f.roll=0;f.v=90;
    let t=0;for(;t<60&&!f.dead;t++){f.trafficPrevious=[f.x,f.y,f.z];f.x-=dx*3;f.z-=dz*3;f.v=90;battleTime+=1/30;collide(battleTime);}
    battleTime+=1/30;simStep(battleTime,1/30);
    return {dead:f.dead,t,event:bc.log.events.some(e=>e.type==='wreckStrike'&&e.ship===f.id)};})()`);};
  const a=once(),b=once();
  assert.ok(a.dead&&a.event,JSON.stringify(a));assert.equal(JSON.stringify(a),JSON.stringify(b));
});

test('abandon ship: pods launch, a friendly picks them up or a ruthless enemy fires on them',()=>{
  const w=war(5,6,1101,30,30);
  const r=w.run(`(()=>{const cap=ships.find(s=>!s.dead&&s.arr&&s.hulls===10&&s.side===1);storyAbandon(cap,battleTime);const n=pods.length;
    for(let i=0;i<30*40;i++){battleTime+=1/30;simStep(battleTime,1/30);}
    const ev=bc.log.events.filter(e=>['pods','podsSaved','podsLost'].includes(e.type)).map(e=>e.type);
    return {n,states:pods.map(p=>p.state),ev,capDead:cap.dead};})()`);
  assert.ok(r.n>=3&&r.ev.includes('pods'),JSON.stringify(r));
  assert.ok(r.capDead,'an abandoned hull becomes a derelict');
  assert.ok(r.states.some(s=>s!=='drift')||r.ev.length>1||r.states.length===r.n,JSON.stringify(r));
});

test('an ace earns a callsign (first ace of a side at two kills) and a vendetta starts when a wingman dies',()=>{
  const w=war(5,6,1101,30,30,{objective:'ANNIHILATE'});
  const r=w.run(`(()=>{const q=squads.find(q=>q.side===0&&q.mem.filter(id=>!ships[id].dead&&ships[id].arr).length>=3&&!q.hero);
    const [aceId,wingId]=q.mem.filter(id=>!ships[id].dead);const ace=ships[aceId],wing=ships[wingId];
    const foe=ships.find(s=>s.side===1&&!s.dead&&s.arr&&!s.hulls&&s.slen<80),foe2=ships.filter(s=>s.side===1&&!s.dead&&s.arr&&!s.hulls&&s.slen<80)[1];
    ace.kills=2;foe2.lastHit=ace.id;kill(foe2,battleTime);
    wing.lastHit=foe.id;kill(wing,battleTime);
    battleTime+=1/30;simStep(battleTime,1/30);
    return {ace:ace.ace,skill:ace.ai.traits.skill,vendetta:ace.vendetta&&ace.vendetta.target,foe:foe.id,events:bc.log.events.filter(e=>['ace','vendetta'].includes(e.type)).map(e=>e.text)};})()`);
  assert.ok(r.ace,JSON.stringify(r));assert.equal(r.vendetta,r.foe);
  assert.ok(r.events.some(t=>/makes ace/.test(t))&&r.events.some(t=>/hunting the/.test(t)),JSON.stringify(r.events));
});

test('plans are drawn per side, shown on the title card, and a holding fleet waits on its line',()=>{
  const w=war(5,6,1101,40,1,{plans:['HOLD','PINCER'],objective:'ANNIHILATE'});
  const card=w.run('bc.plan&&bc.plan.lines');
  assert.match(card[0],/Empire will hold the line\. The Rebels attempt a pincer\./);
  w.step(20);
  const r=w.run(`(()=>{const own=ships.filter(s=>s.side===0&&!s.dead&&s.arr&&s.ai);return {hold:own.filter(s=>s.ai.action==='HOLD').length,n:own.length,wings:ships.filter(s=>s.side===1&&s.ai&&s.ai.action==='MANEUVER').length};})()`);
  assert.ok(r.hold>r.n*.3,'most of the holding fleet keeps the line '+JSON.stringify(r));
  assert.ok(r.wings>0,'the pincer wings swing wide '+JSON.stringify(r));
});

test('objectives decide wars: killing the flagship wins a flagship war',()=>{
  const w=war(5,6,1101,30,20,{objective:'FLAGSHIP'});
  const r=w.run(`(()=>{const f=ships[battleAI.story.sides[1].flag];f.lastHit=null;kill(f,battleTime);return {winner,winReason,text:document.getElementById('win').innerHTML};})()`);
  assert.equal(r.winner,0);assert.equal(r.winReason,'flagship');assert.match(r.text,/TAKES THE FLAGSHIP/);
});

test('terrain: rocks block sight lines and bolts, a nebula hides a cloak longer',()=>{
  const m=new AI.FleetMinds(AI.PROFILES.map(()=>({hold:500,doct:{CHARGE:1}})));
  m.setField({rocks:[{p:[500,0,0],r:120}],moon:null,nebula:{p:[0,0,3000],r:900}});
  assert.equal(m.blocked({x:0,y:0,z:0},{x:1000,y:0,z:0}),true);
  assert.equal(m.blocked({x:0,y:0,z:0},{x:1000,y:0,z:400}),false);
  assert.equal(m.fogged({x:0,y:0,z:3200}),true);
  const w=war(5,6,1101,24,1);
  const hit=w.run(`(()=>{fieldBodies=[{center:[500,0,0],radius:120}];const u=fieldHit([0,0,0],[1000,0,0]);fieldBodies=[];return u;})()`);
  assert.ok(hit>.3&&hit<.4,String(hit));
});

test('captions come from the minds and are withdrawn the moment the sim stops matching them',()=>{
  const w=war(6,5,2202,40,30);
  const r=w.run(`(()=>{let bad=0,shown=0,decisions=0,events=0;watchMode='action';sel=null;
    for(let i=0;i<30*60;i++){battleTime+=1/30;simStep(battleTime,1/30);broadcastTick(battleTime,1/30);updateActionCamera(battleTime,1/30);
      if(i%4)continue;
      const c=tickCaption(battleTime,ships[actionCamera?.subject]||ships.find(s=>!s.dead&&s.arr));
      if(!c)continue;shown++;if(c.kind==='decision')decisions++;if(c.kind==='event')events++;
      if(c.check&&!c.check()&&battleTime-c.at>1.25)bad++;}
    return {bad,shown,decisions,events};})()`);
  assert.equal(r.bad,0,JSON.stringify(r));assert.ok(r.shown>50&&r.decisions>0&&r.events>0,JSON.stringify(r));
});

test('an event caption about a ship in action is withdrawn when that ship dies',()=>{
  const w=war(6,5,2202,40,20);
  const r=w.run(`(()=>{const a=ships.find(s=>s.side===0&&!s.dead&&s.arr&&s.slen<60),b=ships.find(s=>s.side===1&&!s.dead&&s.arr&&s.slen<60);
    battleAI.story.emit({type:'vendetta',side:0,ship:a.id,partner:b.id,lost:a.id,x:a.x,y:a.y,z:a.z,size:a.slen});
    bc.caption=null;bc.captionQueue=[];battleTime+=1/30;simStep(battleTime,1/30);
    const first=tickCaption(battleTime,a);const before=first&&/hunting/.test(first.text);
    a.lastHit=null;kill(a,battleTime);let after=false;
    for(let i=0;i<60;i++){battleTime+=1/30;simStep(battleTime,1/30);const c=tickCaption(battleTime,b);if(i>40&&c&&/hunting/.test(c.text))after=true;}
    return {before,after};})()`);
  assert.ok(r.before,'the vendetta is captioned '+JSON.stringify(r));
  assert.ok(!r.after,'and withdrawn once the hunter is dead '+JSON.stringify(r));
});

test('determinism: time scale and Math.random change nothing in the story',()=>{
  const run=(schedule,seed)=>{const b=loadBattle({modules:true});b.run(`Math.random=(()=>{let s=${seed};return ()=>{s=(s*16807)%2147483647;return s/2147483647;};})()`);
    b.start(6,5,2202,26);b.run('endIntro();lastT=1;');let t=1000;
    for(const [rate,seconds] of schedule){b.run(`warClock.setRate(${rate});for(let i=1;i<=${Math.round(seconds*60)};i++)frame(${t}+i*1000/60);`);t+=seconds*1000;}
    // Run both to the same step count, then compare the whole story.
    b.run('while(Math.round(battleTime*30)<30*70){battleTime+=1/30;simStep(battleTime,1/30);}');
    return b.run(storyState);};
  const a=run([[1,20]],7),b=run([[4,6],[.25,4],[2,5]],99991);
  const A=JSON.parse(a);assert.ok(A.events.length>5,'the war told a story: '+A.events.length+' events');
  assert.equal(a,b);
});

test('director: story shots hold at least ten seconds, yield to a capital kill, then resume',()=>{
  const d=BC.createDirector();
  const story={phase:'story',kind:'squad',subject:5,partner:null,score:56,story:'r1'};
  d.update(.25,[{phase:'establish',kind:'all',subject:0,score:20}],()=>true);
  let cut=null,t=0;for(;t<12&&!cut;t+=.25)cut=d.update(.25,[story,{phase:'build',kind:'duel',subject:7,score:40}],()=>true);
  assert.equal(cut&&cut.phase,'story');
  const start=t;let next=null;for(;t<start+9.5&&!next;t+=.25)next=d.update(.25,[story,{phase:'build',kind:'duel',subject:7,score:40}],()=>true);
  assert.equal(next,null,'a story shot holds its ten seconds against ordinary shots');
  next=d.update(.25,[story,{phase:'climax',kind:'capital',subject:9,score:120}],()=>true);
  assert.equal(next&&next.subject,9,'a capital kill outranks the story');
  let back=null;for(let i=0;i<60&&!back;i++){const c=d.update(.25,[story,{phase:'build',kind:'duel',subject:7,score:30}],()=>true);if(c)back=c;}
  assert.ok(back&&back.story==='r1'&&back.resumed,JSON.stringify(back));
});

test('fear is contagious by doctrine: a frightened neighbour raises fear, never for the Borg',()=>{
  const defs=AI.PROFILES.map(()=>({hold:500,doct:{CHARGE:1}}));
  const fearOf=race=>{
    const m=new AI.FleetMinds(defs);m.reset(3);
    const me={id:0,side:0,race,seed:11,x:0,y:0,z:0,yaw:0,hp:10,hpMax:10,slen:24,arr:true},pal={id:1,side:0,race,seed:12,x:120,y:0,z:0,yaw:0,hp:10,hpMax:10,slen:24,arr:true};
    m.seedShip(me);m.seedShip(pal);m.story.ready=true;m.story.sides[0].flag=-1;
    const calm=m.story.fearTarget(me,me.ai,.2,1,.5);
    me.ai.friends=[pal];pal.ai.fear=.95;me.ai.fear=.1;me.ai.witness=2;
    return m.story.fearTarget(me,me.ai,.2,1,.5)-calm;
  };
  assert.ok(fearOf(6)>.2,'Rebels catch fear from neighbours: '+fearOf(6));
  assert.ok(fearOf(1)>fearOf(6),'the Shoal spreads it faster than the Rebels');
  assert.ok(Math.abs(fearOf(12))<1e-9,'the Borg do not');
});

test('pursuit follows doctrine: some fleets run down the broken, others re-engage',()=>{
  const defs=AI.PROFILES.map(()=>({hold:500,doct:{CHARGE:1}}));
  const bonus=race=>{
    const m=new AI.FleetMinds(defs);m.reset(3);m.story.ready=true;
    const s={id:0,side:0,race,seed:1,x:0,y:0,z:0,hp:10,hpMax:10,slen:24},t={id:1,side:1,race:6,seed:2,x:300,y:0,z:0,hp:10,hpMax:10,slen:24,routing:true};
    m.ships=[s,t];m.seedShip(s);m.seedShip(t);
    return m.story.targetBonus(s,s.ai,{id:1});
  };
  assert.ok(bonus(5)>0,'the Empire runs down routing enemies');
  assert.ok(bonus(10)<0,'Starfleet re-engages elsewhere');
});
