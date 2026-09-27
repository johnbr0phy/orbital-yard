const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
function scene(w){const b=loadBattle();b.run(`ships.length=0;ships.push({id:0,race:17,fo:${w},side:0,x:0,y:0,z:0,yaw:0,pitch:0,slen:400,arr:true,hulls:10,hp:100,hpMax:100,meta:{desig:'Ancient',fo:${w}}},{id:1,race:6,side:1,x:1200,y:0,z:0,yaw:0,slen:100,arr:true,hulls:10,hp:100,hpMax:100});battleAI.targets=()=>ships.filter(s=>s.side===1&&!s.dead);wound=(t,d)=>{t.hp-=d};battleTime=0;`);return b;}
test('all eight charge before damage, release once and bound their geometry',()=>{for(let w=0;w<8;w++){const b=scene(w);const r=b.run(`(()=>{const s=ships[0];foSpeak(s,0,4);const charge=!!s.foCharge;foSpeak(s,1,.1);const before=ships[1].hp;foSpeak(s,6,.1);const after=ships[1].hp;foSpeak(s,6.1,.1);return {charge,before,after,final:ships[1].hp,count:beams.length,finite:beams.every(b=>[...b.a,...b.b,b.wid].every(Number.isFinite))};})()`);assert.ok(r.charge&&r.before===100&&r.after<100&&r.after===r.final&&r.count<60&&r.finite,JSON.stringify({w,...r}));}});
test('dead target cancels charge and off-range fleets are not struck',()=>{const b=scene(0);assert.ok(b.run(`(()=>{foSpeak(ships[0],0,4);ships[1].dead=true;foSpeak(ships[0],5,.1);return !ships[0].foCharge&&ships[1].hp===100;})()`));const c=scene(0);assert.ok(c.run(`ships[1].x=9000;foSpeak(ships[0],0,4);!ships[0].foCharge`));});
test('every ancient fires on its own cycle, but no more than two release in the same half-second',()=>{const b=scene(0);const r=b.run(`(()=>{const s=ships[0];
  // Another ancient charging does not stop this one.
  ships.push({...s,id:2,fo:1,foCharge:{at:0,target:1,drawAt:9}});foSpeak(s,0,4);const alongside=!!s.foCharge;s.foCharge=null;s.foCool=0;
  // Two releases in the last half-second hold a third back; a moment later it fires.
  ships.push({...s,id:3,fo:2,foCharge:null,foEvent:{at:.1,until:2.7}});ships[2].foCharge=null;ships[2].foEvent={at:.1,until:2.7};
  foSpeak(s,.3,.1);const held=!s.foCharge;foSpeak(s,.7,.1);return {alongside,held,later:!!s.foCharge};})()`);
  assert.deepEqual(JSON.parse(JSON.stringify(r)),{alongside:true,held:true,later:true});});
test('arrival name uses director caption and weapon captions take precedence',()=>{const b=scene(3);assert.ok(b.run(`(()=>{actionCamera={subject:0,kind:'capital'};ships[0].foArrivalAt=0;battleTime=1;const arrival=cinemaCaption();foSpeak(ships[0],1,4);return arrival==='Arriving · Ancient'&&cinemaCaption().includes('Convergence charging');})()`));});

test('a strike unmakes the small craft in its blast and guts a capital near the centre',()=>{
  const b=loadBattle();
  const r=JSON.parse(b.run(`JSON.stringify((()=>{ships.length=0;
    ships.push({id:0,race:17,fo:0,side:0,x:0,y:0,z:0,yaw:0,pitch:0,slen:2000,arr:true,hulls:10,hp:1e4,hpMax:1e4,meta:{desig:'Ancient',fo:0}});
    for(let i=0;i<12;i++)ships.push({id:1+i,race:5,side:1,x:4000+(i%4)*120,y:(i>>2)*80,z:0,yaw:0,slen:12,arr:true,hp:30,hpMax:30,dead:false});
    ships.push({id:13,race:5,side:1,x:4100,y:0,z:60,yaw:0,slen:1600,arr:true,hulls:10,hp:900,hpMax:900,dead:false});
    ships.push({id:14,race:5,side:1,x:9000,y:0,z:0,yaw:0,slen:12,arr:true,hp:30,hpMax:30,dead:false});
    const s=ships[0];s.foCharge={at:0,target:1,drawAt:9};foRelease(s,[4100,0,0],2,0);
    return {small:ships.slice(1,13).filter(t=>t.dead).length,cap:ships[13].hp/900,far:ships[14].hp};})())`));
  assert.equal(r.small,12,'every fighter in the blast is unmade');
  assert.ok(r.cap<.4,'the capital near the centre loses most of its hull '+r.cap);
  assert.equal(r.far,30,'nothing outside the blast is touched');
});

test('an ancient sees the whole field and aims where its blast unmakes the most',()=>{
  const b=loadBattle();
  const r=b.run(`(()=>{ships.length=0;battleAI.targets=()=>[];
    ships.push({id:0,race:17,fo:0,side:0,x:0,y:0,z:0,slen:2000,arr:true,hulls:10,hp:1e4,hpMax:1e4,meta:{fo:0}});
    ships.push({id:1,race:5,side:1,x:3000,y:0,z:0,slen:12,arr:true,hp:30,hpMax:30});
    for(let i=0;i<10;i++)ships.push({id:2+i,race:5,side:1,x:6000+i*40,y:0,z:2000,slen:12,arr:true,hp:30,hpMax:30});
    const t=foPick(ships[0],FO_REACH);return t?t.id:null;})()`);
  assert.ok(r>=2,'the cluster, not the lone nearer ship, and not limited to sensor contacts (picked '+r+')');
});

test('the First Ones arrive as a host and annihilate a fleet',()=>{
  const b=loadBattle({cores:1,modules:true});b.start(17,5,1101,20);
  const arrivals=JSON.parse(b.run('JSON.stringify(ships.filter(s=>s.race===17).map(s=>s.delay))'));
  assert.ok(Math.max(...arrivals)<18,'the whole host is present within about 17 s: '+arrivals);
  let t=0;while(t<120&&b.run('winner==null')){b.step(2);t+=2;}
  const r=JSON.parse(b.run('JSON.stringify({winner,T:battleTime-warT0,lost:ships.filter(s=>s.race===17&&s.dead).length})'));
  assert.equal(r.winner,0,JSON.stringify(r));assert.ok(r.T<90,'annihilation inside 90 s: '+r.T);assert.equal(r.lost,0);
});
