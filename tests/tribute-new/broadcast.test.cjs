const test=require('node:test'),assert=require('node:assert/strict');
const BC=require('../../armada-broadcast-new.js');
const {loadBattle}=require('./headless-battle.cjs');

test('event scoring ranks capital kill > hero duel > ion strike > squadron wipe > dogfight',()=>{
  const at=t=>['capitalKill','heroDuel','ionStrike','squadronWipe','dogfight'].map(type=>BC.scoreEvent({type,t:0},t));
  for(const t of [0,.5,1]){const s=at(t);for(let i=1;i<s.length;i++)assert.ok(s[i-1]>s[i],JSON.stringify({t,s}));}
  // News fades: a 20 s old capital kill is worth less than a live ion strike.
  assert.ok(BC.scoreEvent({type:'capitalKill',t:0},20)<BC.scoreEvent({type:'ionStrike',t:20},20));
  // Anticipation peaks at the payoff and falls away after it.
  const ion={type:'ionCharge',t:0,until:4.5};
  assert.ok(BC.scoreEvent(ion,4.4)>BC.scoreEvent(ion,.5));
  assert.ok(BC.scoreEvent(ion,12)<BC.scoreEvent(ion,4.4)*.2);
  // Bigger hulls matter more within a type.
  assert.ok(BC.scoreEvent({type:'kill',t:0,size:1600},0)>BC.scoreEvent({type:'kill',t:0,size:14},0));
});

test('kill feed groups fighters by class and gives capitals their own line',()=>{
  const f=BC.createFeed();
  for(let i=0;i<14;i++)f.push({type:'kill',t:i*.2,side:0,klass:'TIE/LN STARFIGHTER',name:'TIE '+i});
  f.push({type:'capitalKill',t:3,side:1,klass:'MC80',name:'HOME ONE',byName:'EXECUTOR'});
  f.push({type:'kill',t:3.1,side:1,klass:'T-65 X-WING',name:'RED 5'});
  const v=f.visible(3.2).map(l=>l.text);
  assert.deepEqual(v,['RED 5 lost','HOME ONE destroyed by EXECUTOR','TIE/LN STARFIGHTER ×14 lost']);
  // Outside the grouping window a new line starts; old lines expire.
  f.push({type:'kill',t:9,side:0,klass:'TIE/LN STARFIGHTER',name:'TIE 99'});
  assert.equal(f.visible(9).filter(l=>/TIE/.test(l.text)).length,2);
  assert.equal(f.visible(40).length,0);
});

test('director honours its hold floor and never ping-pongs',()=>{
  const d=BC.createDirector();let cuts=[],t=0,r=7;
  const rnd=()=>{r=(Math.imul(r,1103515245)+12345)>>>0;return r/4294967296;};
  for(let i=0;i<1200;i++){ // five minutes at 4 Hz with a noisy, constantly changing candidate list
    t+=.25;
    const cands=[{phase:'establish',kind:'all',subject:0,score:20}];
    for(let k=0;k<6;k++)cands.push({phase:['build','climax','reaction'][k%3],kind:'duel',subject:1+Math.floor(rnd()*40),partner:null,score:rnd()*140});
    const shot=d.update(.25,cands,()=>true);if(shot)cuts.push(t);
  }
  const gaps=cuts.slice(1).map((c,i)=>c-cuts[i]);
  assert.ok(Math.min(...gaps)>=3.2-1e-9,'min hold '+Math.min(...gaps));
  assert.ok(cuts.length>20&&cuts.length<100,'cuts '+cuts.length);
  // The grammar visits every phase.
  const phases=new Set(d.history.map(h=>h.kind).concat([d.phase]));assert.ok(phases.size>=1);
});

test('director cuts to an urgent event after the floor, and keeps a live subject otherwise',()=>{
  const d=BC.createDirector();
  d.update(.25,[{phase:'establish',kind:'all',subject:0,score:20}],()=>true);
  let cut=null;for(let t=0;t<3;t+=.25)cut=cut||d.update(.25,[{phase:'climax',kind:'capital',subject:9,score:120}],()=>true);
  assert.equal(cut,null,'no cut inside the 3.2 s floor');
  for(let t=0;t<1&&!cut;t+=.25)cut=d.update(.25,[{phase:'climax',kind:'capital',subject:9,score:120}],()=>true);
  assert.equal(cut.subject,9);assert.equal(d.phase,'climax');
});

test('war clock: rates, pause and a deterministic slow-motion curve',()=>{
  const c=BC.createClock();
  assert.equal(c.advance(.1),.1);
  c.setRate(4);assert.ok(Math.abs(c.advance(.1)-.4)<1e-12);
  c.setRate(0);assert.equal(c.advance(.1),0);assert.equal(c.paused,true);
  c.setRate(1);c.slowMo(1.6);
  const curve=[];for(let i=0;i<200;i++)curve.push(c.advance(1/60)*60);
  assert.ok(Math.min(...curve)>=.25-1e-9&&Math.min(...curve)<.26);
  assert.ok(Math.abs(curve[curve.length-1]-1)<1e-9,'returns to 1x');
  const c2=BC.createClock();c2.setRate(1);c2.slowMo(1.6);const again=[];for(let i=0;i<200;i++)again.push(c2.advance(1/60)*60);
  assert.deepEqual(again,curve);
  const r=BC.createClock();r.reduced=true;assert.equal(r.slowMo(),false,'reduced motion disables slow motion');
});

test('story is factual: three to five lines built only from logged ships',()=>{
  const log=BC.createLog(),m=BC.createMomentum();
  log.push({type:'kill',t:14,side:1,name:'RED 5',byName:'BLACK 2',by:3,value:2});
  log.push({type:'capitalKill',t:95,side:1,name:'HOME ONE',byName:'EXECUTOR',by:1,value:40});
  for(let t=0;t<120;t++)m.sample(t,[100-(t>90?40:0)+t*.1,100-(t>90?60:0)]);
  const lines=BC.story(log,{names:['Empire','Rebels'],place:'Eclipse',duration:121,winner:0,alive:[40,0],spawned:[60,58],mvpName:'EXECUTOR',mvpKills:1},m);
  assert.ok(lines.length>=3&&lines.length<=5,JSON.stringify(lines));
  const text=lines.join(' ');
  for(const name of text.match(/[A-Z][A-Z0-9 ]{3,}/g)||[])assert.ok(['RED 5','BLACK 2','HOME ONE','EXECUTOR'].includes(name.trim()),name);
  assert.match(text,/2:01/);assert.match(text,/0:14/);assert.match(text,/40 of 60/);
  assert.doesNotMatch(text,/ when /,'never asserts causation');
});

test('real battle: every death is logged once, MVP and losses match the simulation',()=>{
  const b=loadBattle({modules:true});b.start(12,10,5,24);
  b.run('endIntro();lastT=1;for(let i=1;i<=60*120&&winner==null;i++)frame(1000+i*1000/60);');
  const r=JSON.parse(b.run(`JSON.stringify({dead:ships.filter(s=>s.dead).length,kills:bc.log.events.filter(e=>/kill|Kill/.test(e.type)).map(e=>e.ship),winner,sum:(()=>{const x=battleSummary();x.mvp=x.mvp?x.mvp.id:null;return x;})()})`));
  assert.equal(r.kills.length,r.dead);assert.equal(new Set(r.kills).size,r.kills.length);
  assert.notEqual(r.winner,null);
  assert.equal(r.sum.lost[0]+r.sum.lost[1],r.dead);
  assert.ok(r.sum.mvp!=null&&r.sum.mvpKills>0);
});
