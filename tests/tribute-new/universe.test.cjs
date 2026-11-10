const test=require('node:test'),assert=require('node:assert/strict');
const U=require('../../armada-universe-new.js');
const {len,sub,dot}=U.v;

test('the galaxy has one separated, deterministic homeworld system per fleet',()=>{
  const G=U.galaxy();assert.equal(G.systems.length,U.WORLDS.length);assert.equal(G.systems.length,23);
  assert.equal(G,U.galaxy());
  G.systems.forEach((s,i)=>{assert.equal(s.i,i);assert.equal(s.name,U.WORLDS[i].world);assert.ok(len(s.pos)<U.SPAN*1.2);});
  for(const a of G.systems)for(const b of G.systems)if(a!==b)assert.ok(len(sub(a.pos,b.pos))>=6.99*U.LY,a.name+' / '+b.name);
});

test('every world has a sun above the capital horizon and bodies that do not touch',()=>{
  for(const s of U.galaxy().systems){
    assert.ok(s.sunDir[1]>.1&&s.sunDir[1]<.25,s.name+' dusk light');
    const all=[{c:s.planet,r:s.R},{c:s.pos,r:s.sunR},...s.extras.map(x=>({c:x.pos,r:x.R}))];
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++)assert.ok(len(sub(all[i].c,all[j].c))>(all[i].r+all[j].r)*1.5,s.name+' bodies '+i+','+j);
    // the battle site is above the capital, clear of the air
    const alt=len(sub(s.site,s.planet))-s.R;assert.ok(alt>s.R*U.ATMO*2&&alt<s.R*.3);
  }
});

test('cities are named, apart, and founded on dry ground; the capital is on the pole',()=>{
  let wet=0,total=0;
  for(const s of U.galaxy().systems){
    assert.ok(s.cities.length>=4&&s.cities.length<=16,s.name);
    assert.deepEqual(s.cities[0].dir,[0,1,0]);assert.ok(s.cities[0].capital);assert.equal(s.cities[0].name,s.def.capital);
    for(const c of s.cities){
      assert.ok(Math.abs(len(c.dir)-1)<1e-9);assert.ok(Math.abs(dot(c.e,c.dir))<1e-9&&Math.abs(dot(c.n,c.dir))<1e-9&&Math.abs(dot(c.e,c.n))<1e-9);
      total++;if(U.dry(c.dir,s.seed,s.biome.level)<0)wet++;
    }
    for(let i=0;i<s.cities.length;i++)for(let j=i+1;j<s.cities.length;j++)assert.ok(Math.acos(Math.min(1,dot(s.cities[i].dir,s.cities[j].dir)))>=.11,s.name);
  }
  assert.ok(wet/total<.12,'cities in the sea: '+wet+' of '+total);
});

test('the engine is handed the right sky for a site',()=>{
  const sceneR=36000,sys=U.engineSystem(11,sceneR,null),G=U.galaxy(),s=G.systems[11];
  assert.equal(sys.name,"Qo'noS");assert.equal(sys.site,11);
  const home=sys.worlds.find(b=>b.sys===11&&b.role==='home'),sun=sys.bodies.find(b=>b.kind===5);
  // the world is straight down, its surface the battle altitude away
  assert.ok(Math.abs(home.center[0])<1e-3&&Math.abs(home.center[2])<1e-3);
  assert.ok(Math.abs(-home.center[1]-home.radius-s.R*U.ALT)<1);
  assert.ok(sun&&sun.base&&sys.bodies.every(b=>b.cosmos));
  assert.ok(dot(sys.light,s.sunDir)/len(sys.light)>.999);
  assert.equal(sys.worlds.filter(b=>b.role==='home').length,23);
  for(const b of sys.worlds)assert.ok(b.center.every(Number.isFinite)&&b.radius>0&&b.name);
});

test('free flight is slow in the battle and near the ground, and runs away in the open',()=>{
  assert.equal(U.flightSpeed(180000,500,false),3240);
  assert.ok(U.flightSpeed(900,5e8,false)<1000,'near the ground');
  assert.ok(U.flightSpeed(900,5e8,false)>=25);
  const far=U.flightSpeed(4e9,4e9,false);assert.ok(far>3e9);
  assert.ok(U.flightSpeed(4e9,4e9,true)>far*2);
  // leaving the battle never jumps: speed is continuous across the edge
  assert.ok(Math.abs(U.flightSpeed(1e9,11999,false)-U.flightSpeed(1e9,12001,false))<3300);
});

test('ownership: a war goes to the defender\'s world, and a conquest is recorded',()=>{
  let o=U.freshOwners();assert.equal(U.siteFor(o,5,11),11);assert.equal(U.siteFor(o,5,11,3),3);
  o=U.conquer(o,11,5);assert.equal(o[11],5);assert.equal(U.holdings(o)[5],2);assert.equal(U.holdings(o)[11],0);
  // the Klingons, homeless, defend nothing they hold: the fight returns to Qo'noS
  assert.equal(U.siteFor(o,6,11),11);
  // attacking the Empire still means Coruscant
  assert.equal(U.siteFor(o,6,5),5);
  assert.deepEqual(U.freshOwners(),U.WORLDS.map((w,i)=>i));
});

test('skylines are deterministic, tallest first, inside the city and within budget',()=>{
  for(const i of [0,5,11,12,21]){
    const s=U.galaxy().systems[i],a=U.skyline(s.cities[0],s.def.arch),b=U.skyline(s.cities[0],s.def.arch);
    assert.deepEqual(a,b);assert.ok(a.length/9>1500&&a.length/9<=16000,s.name+' '+a.length/9);
    for(let k=0;k<a.length;k+=9){
      assert.ok(Math.hypot(a[k],a[k+1])<s.cities[0].core+700);assert.ok(a[k+2]>0&&a[k+3]>0&&a[k+4]>=20);
      if(k)assert.ok(a[k+4]<=a[k-5]+1e-3);
    }
    assert.ok(a[4]>2000,'a seat of power you can see from orbit: '+a[4]);
    assert.ok(U.skyline(s.cities[1],s.def.arch).length<a.length);
  }
});

test('distances and speeds read naturally',()=>{
  assert.equal(U.fmtDist(950),'950 m');assert.equal(U.fmtDist(182000),'182 km');assert.equal(U.fmtDist(7*U.LY),'7.00 ly');
  assert.equal(U.fmtSpeed(300),'300 m/s');assert.match(U.fmtSpeed(5e6),/km\/s$/);assert.match(U.fmtSpeed(6e9),/ c$/);
});
