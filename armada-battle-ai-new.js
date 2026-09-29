/* Fleet minds. No rendering or wall clock dependencies. Also loaded by the
   headless battle checks with Node. All randomness belongs to a battle or pilot. */
(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.ArmadaBattleAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const length = (x, y, z = 0) => Math.hypot(x, y, z);
  const distance = (a, b) => length(a.x - b.x, a.y - b.y, a.z - b.z);
  const angle = a => Math.atan2(Math.sin(a), Math.cos(a));
  function random(seed) {
    let n = seed >>> 0;
    return () => {
      n = (n + 0x6d2b79f5) | 0;
      let t = Math.imul(n ^ n >>> 15, 1 | n);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const TRAITS = ['skill', 'aggression', 'courage', 'discipline', 'cooperation', 'creativity'];
  /* Each existing fleet has its own prior, rather than a universal mood with
     a different paint colour. Columns: traits, sensor range / angle, capital
     style, and weapons / armour / engines. Individual pilots overlap. */
  const PROFILES = [
    ['Yard',       [.60,.48,.60,.80,.78,.45], 1050,250,'broadside', [34,35,31]],
    ['Shoal',      [.43,.80,.53,.28,.88,.72],  760,310,'swarm',     [32,23,45]],
    ['Lattice',    [.80,.45,.66,.94,.90,.28], 1350,340,'encircle',  [34,34,32]],
    ['Drift',      [.48,.38,.42,.38,.62,.86],  950,260,'skirmish',  [31,42,27]],
    ['Choir',      [.77,.34,.66,.83,.88,.60], 1450,280,'support',   [39,30,31]],
    ['Empire',     [.56,.73,.68,.88,.62,.30], 1100,230,'siege',     [43,35,22]],
    ['Rebels',     [.73,.58,.70,.55,.84,.86], 1150,270,'flank',     [33,24,43]],
    ['Minbari',    [.90,.47,.79,.88,.72,.67], 1750,250,'flank',     [42,26,32]],
    ['Shadows',    [.86,.90,.79,.40,.68,.88], 1450,210,'pounce',    [42,20,38]],
    ['EarthForce', [.61,.49,.65,.83,.84,.46], 1150,280,'broadside', [33,42,25]],
    ['Federation',[.83,.30,.64,.84,.94,.72], 1600,330,'support',   [32,37,31]],
    ['Klingons',   [.67,.91,.90,.54,.64,.57], 1050,220,'pounce',    [45,28,27]],
    ['Borg',       [.92,.66,.94,.99,.99,.20], 1700,360,'encircle',  [35,44,21]],
    ['Mondoshawan',[.66,.25,.80,.85,.95,.35], 1300,310,'support',   [27,49,24]],
    ['USCM',      [.76,.64,.65,.92,.87,.45], 1250,260,'broadside', [40,33,27]],
    ['Engineers', [.87,.44,.79,.66,.57,.84], 1550,300,'encircle',  [39,36,25]],
    ['Yautja',    [.90,.78,.76,.59,.36,.91], 1700,190,'ambush',    [42,20,38]],
    ['First Ones',[.94,.49,.90,.73,.45,.90], 2500,350,'ancient',   [43,31,26]],
    ['Romulans',[.85,.58,.70,.86,.75,.87], 1650,290,'ambush', [41,27,32]],
    ['Dominion',[.82,.86,.96,.95,.90,.38], 1450,300,'pounce', [43,29,28]],
    ['Space Marines',[.84,.78,.97,.94,.88,.42], 1400,280,'broadside', [42,42,16]],
    ['Tyranids',[.62,.94,.99,.72,.99,.33], 1200,340,'swarm', [40,25,35]],
    ['Tesla',[.68,.62,.81,.88,.92,.72], 1400,310,'skirmish', [30,22,48]]
  ].map((p, race) => ({ race, name:p[0], traits:p[1], range:p[2], fov:p[3], style:p[4], budget:p[5] }));
  const alive = s => !s.dead && s.arr !== false && !s.grace;
  const radius = s => Math.max(8, s.rad || 0, s.exL || (s.slen || 30) * .5);
  const capital = s => !!(s.steadyCapital || s.hulls || (!s.hero && ((s.slen || 0) >= 300 || (s.race === 8 && s.slen > 180))));
  const surface = (s, t) => Math.max(0, distance(s, t) - radius(t));
  const strength = s => Math.sqrt(Math.max(1, s.hpMax || 3)) * (s.hulls ? 1.4 : 1) * (.6 + .4 * clamp(s.hp / Math.max(1, s.hpMax)));
  function allocation(base, r) {
    const values=base.map(n=>Math.max(8,n+(r()+r()-1)*24));
    const sum=values.reduce((a,b)=>a+b,0);
    const out=values.map(n=>Math.round(n/sum*100));out[2]=100-out[0]-out[1];return out;
  }
  const MOODS={RETREAT:'FLEE',ROUT:'FLEE',PANIC:'FLEE',EVADE:'EVADE',ESCORT:'DEFEND',RESCUE:'DEFEND',RECOVER:'DEFEND',TOW:'DEFEND',FLANK:'FLANK',MANEUVER:'FLANK',REGROUP:'REGROUP',HIDE:'REGROUP',HOLD:'REGROUP',DRIFT:'REGROUP',SEARCH:'SEARCH',CONVOY:'SEARCH'};
  // Story orders override a pilot's own choice while they last.
  const ORDER_ACTION={ROUT:'ROUT',PANIC:'PANIC',BERSERK:'ATTACK',RAM:'RAM',RESCUE:'RESCUE',HIDE:'HIDE',MANEUVER:'MANEUVER',
    HOLD:'HOLD',GUARD:'ESCORT',STRIKE:'STRIKE',CONVOY:'CONVOY',RECOVER:'RECOVER',TOW:'TOW',DRIFT:'DRIFT'};
  // Posture orders a pilot drops once the killing starts. Nobody holds a parade line under fire.
  const SOFT_ORDERS=new Set(['HOLD','HIDE','MANEUVER','GUARD']);
  const ORDER_REASON={ROUT:'Squadron broken. Running for the edge',PANIC:'Command is gone. Scattering',BERSERK:'Command is gone. Charging',
    RAM:'Doomed. Turning to ram',RESCUE:'Screening a crippled capital',HIDE:'Holding in cover for the ambush',MANEUVER:'Swinging wide on the plan',
    HOLD:'Holding the line',GUARD:'Screening the capitals',STRIKE:'Striking for their flagship',CONVOY:'Running the convoy lane',
    RECOVER:'Recovering escape pods',TOW:'Towing a disabled hull clear',DRIFT:'Abandoned. Adrift'};
  class FleetMinds {
    constructor(definitions) { this.definitions=definitions;this.story=null;this.reset(1);this.story=new WarStory(this);this.story.reset(1); }
    reset(seed) {
      this.seed=seed;this.rng=random(seed ^ 0x615d37);this.ships=[];this.byId=new Map();
      this.grid=new Map();this.large=[];this.sectors=[[],[]];this.squads=[];this.locks=[];this.now=0;this.nextIndex=-1;
      this.stats={scans:0,decisions:0,actions:{},ionDodges:0};
      if(this.story)this.story.reset(seed);
    }
    seedShip(s) {
      if(s.ai)return s.ai;
      const profile=PROFILES[s.race] || PROFILES[0];
      const r=random((s.seed || 1) ^ Math.imul(s.race+1,0x45d9f3b));
      const traits={};TRAITS.forEach((key,i)=>traits[key]=clamp(profile.traits[i]+(r()+r()+r()-1.5)*.26,.06,.98));
      traits.luck=.30+r()*.40;
      if(s.hero){traits.skill=Math.max(.86,traits.skill);traits.courage=Math.max(.68,traits.courage);}
      s.ai={profile,traits,budget:allocation(profile.budget,r),rng:r,contacts:new Map(),friends:[],
        fear:.05,confidence:.55,action:'SEARCH',reason:'Scanning the approach',nextScan:r()*.35,
        nextThink:r()*.35,lastScan:0,lastThink:0,lastHp:s.hp,until:0,target:-1,orbit:r()<.5?-1:1,
        lane:(r()-.5)*2,vertical:(r()-.5)*2,preferredRange:.48+r()*.52,
        // Its own axis, hashed from the seed so no pilot's stream shifts. Station
        // spreads used lane for both x and z, which parked a squadron on a diagonal line.
        depth:((Math.imul((s.seed||1)^0x2c1b3c6d,0x297a2d39)>>>0)/4294967296-.5)*2,
        actionBias:{ATTACK:r()*.2,FLANK:r()*.2,ESCORT:r()*.2,REGROUP:r()*.2},
        killsSeen:0,plan:null,scanCount:0};
      return s.ai;
    }
    equip(s) {
      const a=this.seedShip(s);if(a.equipped)return;
      const [w,arm,e]=a.budget.map(n=>n/100);
      s.hpMax=Math.max(2,Math.round(s.hpMax*(.72+.84*arm)));s.hp=s.hpMax;
      s.damageK=.70+.90*w;s.armourK=.86+.42*arm;s.cycleK=1.12-.35*w;
      s.spd*=.67+e;s.spdMax*=.67+e;s.turn*=.80+.60*e;
      if(capital(s)&&!s.steadyCapital){
        const scale=clamp(Math.pow(900/Math.max(150,s.slen),.15),.66,1.4);
        const mobility=['pounce','flank','ambush'].includes(a.profile.style)?1.15:1;
        const base=s.hulls>=50?28:38;
        s.spd=base*scale*(.70+e)*mobility;
        s.spdMax=s.spd*(1.30+.35*e);
        s.turn=clamp(75/Math.max(300,s.slen),.035,.22)*(.8+.6*e);
      }
      if(s.steadyCapital)s.turn=Math.min(s.turn,.025);
      a.lastHp=s.hp;a.equipped=true;
    }
    senses(s) {
      const a=this.seedShip(s);
      if(a.sensor&&a.sensor.length===s.slen)return a.sensor;
      return a.sensor={length:s.slen,range:a.profile.range*(capital(s)?1:1.5)+(capital(s)?radius(s):Math.min(600,(s.slen||30)*.30)),
        fov:Math.min(360,a.profile.fov+(capital(s)?35:0)),
        interval:(.44+(1-a.traits.skill)*.50)*(s.hulls?.9:1)};
    }
    index(ships, now, squads, locks) {
      this.ships=ships;this.now=now;this.squads=squads||[];this.locks=(locks||[]).filter(Boolean);
      if(now<this.nextIndex)return;
      this.nextIndex=now+.10;this.grid.clear();this.byId.clear();this.large=[];
      const sectors=[new Map(),new Map()];
      for(const s of ships){
        if(alive(s)&&!s.cloaked){const key=[Math.floor(s.x/3000),Math.floor(s.y/3000),Math.floor(s.z/3000)].join(",");let q=sectors[s.side].get(key);if(!q)sectors[s.side].set(key,q={x:0,y:0,z:0,n:0});q.x+=s.x;q.y+=s.y;q.z+=s.z;q.n++;}
        this.byId.set(s.id,s);if(!alive(s))continue;
        if(radius(s)>500)this.large.push(s);
        const key=this.key(s.x,s.y,s.z);let cell=this.grid.get(key);
        if(!cell)this.grid.set(key,cell=[]);cell.push(s);
      }
      this.sectors=sectors.map(m=>Array.from(m.values(),q=>({x:q.x/q.n,y:q.y/q.n,z:q.z/q.n})));
    }
    // Fleet command supplies a coarse search sector, never a firing lock.
    searchPoint(s){
      let best=null,near=Infinity;for(const q of this.sectors[1-s.side]||[]){const d=distance(s,q);if(d<near){near=d;best=q;}}
      return best;
    }
    hash(x,y,z){return Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791);}
    key(x,y,z){return this.hash(Math.floor(x/640),Math.floor(y/640),Math.floor(z/640));}
    nearby(s, range) {
      const out=[],seen=new Set();
      const x=Math.floor(s.x/640),y=Math.floor(s.y/640),z=Math.floor(s.z/640),n=Math.ceil(range/640);
      // A city-sized sensor sphere can cover thousands of empty cells. In a
      // sparse battlefield a bounded pass over occupants is cheaper.
      if(Math.pow(2*n+1,3)>this.grid.size*6)
        return this.ships.filter(t=>t!==s&&alive(t)&&surface(s,t)<=range+110);
      for(let ix=-n;ix<=n;ix++)for(let iy=-n;iy<=n;iy++)for(let iz=-n;iz<=n;iz++){
        const cell=this.grid.get(this.hash(x+ix,y+iy,z+iz));
        if(cell)for(const t of cell)if(t!==s&&!seen.has(t.id)){seen.add(t.id);out.push(t);}
      }
      for(const t of this.large)if(t!==s&&!seen.has(t.id))out.push(t);
      return out;
    }
    // Terrain: rocks and moons block sight lines; a nebula shortens sensors
    // and hides cloaks longer; a ship lurking in cover is quiet until close.
    setField(field){
      const solids=[];
      if(field){for(const k of field.rocks||[])solids.push({x:k.p[0],y:k.p[1],z:k.p[2],r:k.r,rr:(k.r*.9)**2});
        if(field.moon)solids.push({x:field.moon.p[0],y:field.moon.p[1],z:field.moon.p[2],r:field.moon.r,rr:(field.moon.r*.97)**2});}
      this.field=field?{solids,nebula:field.nebula?{x:field.nebula.p[0],y:field.nebula.p[1],z:field.nebula.p[2],r:field.nebula.r}:null}:null;
      if(this.story)this.story.field=field;
    }
    blocked(s,t){
      const f=this.field;if(!f||!f.solids.length)return false;
      const dx=t.x-s.x,dy=t.y-s.y,dz=t.z-s.z,dd=dx*dx+dy*dy+dz*dz;if(dd<1)return false;
      for(const o of f.solids){
        const ox=o.x-s.x,oy=o.y-s.y,oz=o.z-s.z,u=(ox*dx+oy*dy+oz*dz)/dd;if(u<=0||u>=1)continue;
        const px=ox-dx*u,py=oy-dy*u,pz=oz-dz*u;if(px*px+py*py+pz*pz<o.rr)return true;
      }
      return false;
    }
    // The far side of the nearest rock or moon from the threat, if one is close.
    coverFor(s,c){
      const f=this.field;if(!f||!f.solids.length)return null;
      const foe=c||(this.story&&this.story.sides[1-s.side].center);if(!foe)return null;
      let best=null,bd=2200;
      for(const o of f.solids){if(o.r<90)continue;const d=length(o.x-s.x,o.y-s.y,o.z-s.z)-o.r;if(d<bd){bd=d;best=o;}}
      if(!best)return null;
      const dx=best.x-foe.x,dy=best.y-foe.y,dz=best.z-foe.z,n=length(dx,dy,dz)||1,k=best.r+radius(s)+60;
      return [best.x+dx/n*k,best.y+dy/n*k*.3,best.z+dz/n*k];
    }
    fogged(p){const n=this.field&&this.field.nebula;return !!n&&length(p.x-n.x,p.y-n.y,p.z-n.z)<n.r;}
    // Extra quiet range a target gets from terrain: nebula and lurking.
    hidden(s,t,gap){
      if(!this.field&&!t.lurk)return false;
      if(t.lurk&&gap>650)return true;
      if(this.field){
        if(this.field.nebula&&(this.fogged(t)||this.fogged(s))&&gap>(t.cloaked?60:this.senses(s).range*.42))return true;
        if(gap>40&&this.blocked(s,t))return true;
      }
      return false;
    }
    inView(s,t) {
      const sensor=this.senses(s),dx=t.x-s.x,dy=t.y-s.y,dz=t.z-s.z,d=length(dx,dy,dz);
      if(d-radius(t)>sensor.range)return false;
      if(t.cloaked && d-radius(t)>(this.field&&this.field.nebula&&this.fogged(t)?60:160))return false;
      if((this.field||t.lurk)&&this.hidden(s,t,d-radius(t)))return false;
      if(d<radius(t)+100 || sensor.fov>=359)return true;
      const pitch=s.pitch||0;
      const dot=(dx*Math.cos(s.yaw)*Math.cos(pitch)+dy*Math.sin(pitch)+dz*Math.sin(s.yaw)*Math.cos(pitch))/Math.max(1,d);
      // Sensor field is fixed hardware. Fear reduces attention and contact detail,
      // not the physical antenna's field of view.
      return dot>=Math.cos(sensor.fov*Math.PI/360);
    }
    snapshot(t, now, direct=true) {
      return {id:t.id,x:t.x,y:t.y,z:t.z,yaw:t.yaw||0,v:t.v||0,vy:t.vy||0,
        hp:t.hp,hpMax:t.hpMax,slen:t.slen,rad:radius(t),hulls:t.hulls,side:t.side,race:t.race,
        seen:now,reported:now,direct,confidence:direct?1:.72};
    }
    scan(s,now) {
      const a=this.seedShip(s);if(now<a.nextScan)return;
      const sensor=this.senses(s);a.nextScan=now+sensor.interval*(.9+a.rng()*.2);
      a.lastScan=now;a.scanCount++;this.stats.scans++;
      const nearby=this.nearby(s,sensor.range);a.friends=[];
      for(const c of a.contacts.values())c.direct=false;
      const spotted=[],allies=[];
      const pitch=s.pitch||0,fx=Math.cos(s.yaw)*Math.cos(pitch),fy=Math.sin(pitch),fz=Math.sin(s.yaw)*Math.cos(pitch);
      const cone=Math.cos(sensor.fov*Math.PI/360);
      for(const t of nearby){
        if(!alive(t))continue;
        const dx=t.x-s.x,dy=t.y-s.y,dz=t.z-s.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz),gap=d-radius(t);
        if(gap>sensor.range)continue;
        if(t.side===s.side){allies.push({t,d});continue;}
        if(t.cloaked&&gap>160)continue;
        if((this.field||t.lurk)&&this.hidden(s,t,gap))continue;
        if(gap<100||sensor.fov>=359||(dx*fx+dy*fy+dz*fz)/Math.max(1,d)>=cone)spotted.push({t,gap});
      }
      spotted.sort((l,r)=>l.gap-r.gap);
      const capacity=Math.round(12+a.traits.skill*16-a.fear*5);
      for(const {t} of spotted.slice(0,capacity))a.contacts.set(t.id,this.snapshot(t,now));
      // One-hop reports retain the original observation time. Reports cannot
      // endlessly refresh one another or disclose fresh coordinates off-screen.
      allies.sort((l,r)=>l.d-r.d);a.friends=allies.slice(0,20).map(o=>o.t);
      if(a.traits.cooperation>.2)for(const ally of a.friends.slice(0,4)){
        if(!ally.ai||distance(s,ally)>sensor.range*(.4+a.traits.cooperation*.4))continue;
        for(const c of ally.ai.contacts.values()){
          if(!c.direct||now-c.seen<.18||now-c.seen>1.8)continue;
          const prev=a.contacts.get(c.id);
          if(!prev||prev.seen<c.seen)a.contacts.set(c.id,{...c,direct:false,reported:now,confidence:.70});
        }
      }
      for(const [id,c] of a.contacts){
        c.confidence=clamp((c.direct?1:.72)-(now-c.seen)/(7+a.traits.skill*9));
        if(c.confidence<=0||now-c.seen>16)a.contacts.delete(id);
      }
      if(a.contacts.size>36){const keep=[...a.contacts.values()].sort((l,r)=>r.seen-l.seen).slice(0,36);a.contacts=new Map(keep.map(c=>[c.id,c]));}
    }
    contacts(s,now=this.now){this.scan(s,now);return [...s.ai.contacts.values()];}
    fireable(s,t,now=this.now) {
      if(!t||!alive(t)||t.side===s.side)return false;
      if(t.cloaked&&!this.inView(s,t))return false;
      const c=this.seedShip(s).contacts.get(t.id);
      if(!c||now-c.seen>1.15)return false;
      return c.direct?this.inView(s,t):now-c.reported<.9;
    }
    targets(s,now=this.now) {
      this.scan(s,now);const out=[];
      for(const c of s.ai.contacts.values()){const t=this.byId.get(c.id);if(this.fireable(s,t,now))out.push(t);}
      return out;
    }
    threat(s,now) {
      const a=s.ai;
      for(const lock of this.locks){
        if(lock.side===s.side||!lock.point||lock.fire<now)continue;
        if(!a.contacts.has(lock.gun))continue;
        const p={x:lock.point[0],y:lock.point[1],z:lock.point[2]};
        if(distance(s,p)<lock.radius+radius(s)*.55+(s.spdMax||40)*(lock.fire-now)*.4)return lock;
      }
      return null;
    }
    think(s,now) {
      const a=this.seedShip(s);this.scan(s,now);
      const warning=this.threat(s,now);
      const damaged=(a.lastHp-s.hp)/Math.max(1,s.hpMax);
      if(now<a.nextThink&&!warning&&damaged<.12)return a;
      const dt=clamp(now-a.lastThink,.05,1);a.lastThink=now;a.nextThink=now+.30+(1-a.traits.skill)*.40;
      const contacts=[...a.contacts.values()];
      const fresh=contacts.filter(c=>now-c.seen<2.5);
      const hp=clamp(s.hp/Math.max(1,s.hpMax));
      let enemy=0;for(const c of fresh)if(surface(s,c)<900)enemy+=strength(c)*c.confidence;
      let friends=strength(s);for(const f of a.friends.slice(0,8))if(surface(s,f)<900)friends+=strength(f)*.65;
      const pressure=enemy/Math.max(1,friends),isolation=a.friends.length?0:1;
      const hurt=now-(s.hurtT||-100)<2.8;
      const fearTarget=clamp((pressure-1)*.24+(1-hp)*.62+(hurt?.20:0)+isolation*.13-a.traits.courage*.23);
      const st=this.story&&this.story.ready?this.story:null;
      const fearGoal=st?st.fearTarget(s,a,fearTarget,pressure,dt):fearTarget;
      a.fear+=(fearGoal-a.fear)*Math.min(1,dt*(fearGoal>a.fear?1.8:.32+.65*a.traits.discipline));
      const confidenceTarget=clamp(.64+(1-pressure)*.20+(a.traits.aggression-.5)*.18+(s.kills||0)*.025-(1-hp)*.38);
      a.confidence+=(confidenceTarget-a.confidence)*Math.min(1,dt*.75);
      a.lastHp=s.hp;a.pressure=pressure;
      const known=contacts.filter(c=>c.confidence>.12);
      let target=null,best=-Infinity;
      for(const c of known){
        let score=2.2/(1+surface(s,c)/650)+(1-c.hp/Math.max(1,c.hpMax))*.48+c.confidence*.35;
        if(c.hulls)score+=s.hulls?.52:-.25;
        if(!capital(s)&&(s.slen||0)<120&&!c.hulls&&c.slen<120)score+=.65;
        const sq=this.squads[s.squad];if(sq&&sq.tgt===c.id)score+=a.traits.cooperation*.28;
        score+=((Math.imul(s.seed^c.id,2654435761)>>>0)%100)/500;
        if(c.id===a.target)score+=.18;
        if(st)score+=st.targetBonus(s,a,c);
        if(score>best){best=score;target=c;}
      }
      a.target=target?target.id:-1;
      const weak=a.friends.filter(f=>f.hp/f.hpMax<.58).sort((l,r)=>l.hp/l.hpMax-r.hp/r.hpMax)[0];
      let order=st?st.order(s,a,now):null;
      // Shock: allies dying around this pilot in the last few seconds. It fades fast.
      a.shock=(a.shock||0)*Math.exp(-dt/5);
      const shocked=a.shock>1.1;
      if(order&&SOFT_ORDERS.has(order.kind)&&(hurt||shocked||a.fear>.55)){
        a.order=null;order=null;a.breakUntil=now+12;a.until=0;
      }
      if(order&&!(warning&&!['RAM','ROUT','PANIC'].includes(order.kind))){
        const action=ORDER_ACTION[order.kind]||order.kind;
        if(a.action!==action||a.orderKind!==order.kind){this.stats.decisions++;this.stats.actions[action]=(this.stats.actions[action]||0)+1;}
        if(a.action!==action){this.logGoal(s,a,a.action,action,'order: '+order.kind,now);a.since=now;}a.action=action;a.orderKind=order.kind;a.reason=ORDER_REASON[order.kind]||a.reason;a.weak=weak;a.until=0;
        if(order.kind==='RAM'||order.kind==='STRIKE')a.target=order.target!=null?order.target:a.target;
        return a;
      }
      a.orderKind=null;
      const tr=a.traits;
      // Fight or flight: when the pilots around it are being unmade, a pilot either
      // throws everything at the killer or runs. Doctrine and nerve decide which.
      if(shocked&&!warning&&!capital(s)&&(!a.response||now>=a.responseUntil)){
        const d=st?st.doctrine(s):DOCTRINE[s.race]||DOCTRINE[0];
        const charge=tr.courage*.7+tr.aggression*.7+d.berserk;
        const flee=d.retreat?a.fear*.9+(1-tr.courage)*.7+d.panic+(1-hp)*.4:0;
        a.response=a.rng()*(charge+flee)<charge?'CHARGE':'FLEE';a.responseUntil=now+7+a.rng()*4;
        a.until=0;
      }
      if(a.response&&now>=a.responseUntil&&!shocked)a.response=null;
      if(a.response&&!warning){
        const dread=a.contacts.get(a.dread);
        const action=a.response==='CHARGE'?'ATTACK':'RETREAT';
        if(a.response==='CHARGE'&&dread)a.target=dread.id;
        if(a.action!==action){this.logGoal(s,a,a.action,action,'fight or flight: '+a.response,now);a.since=now;this.stats.decisions++;this.stats.actions[action]=(this.stats.actions[action]||0)+1;}
        a.action=action;a.weak=weak;a.until=a.responseUntil;
        a.reason=a.response==='CHARGE'?'Massacre. Throwing everything at the killer':'Massacre. Breaking formation and running';
        return a;
      }
      if(now<a.until&&!warning&&damaged<.12&&!(a.fear>.78&&a.action!=='RETREAT')&&target){a.weak=weak;return a;}
      let action='SEARCH',reason=target?'Reacquiring a lost contact':'Sweeping the approach';
      if(warning){action='EVADE';reason='Ion lock detected. Clearing the firing zone';this.stats.ionDodges++;}
      else if(fresh.length){
        const scores={
          ATTACK:.42+tr.aggression*.48+a.confidence*.33-a.fear*.65,
          FLANK:.29+tr.skill*.30+tr.creativity*.32-a.fear*.30,
          ESCORT:.08+tr.cooperation*.30+(weak?.53:0),
          REGROUP:isolation*.23+tr.cooperation*.15+a.fear*.45-tr.aggression*.20,
          RETREAT:st&&!st.doctrine(s).retreat?-Infinity:a.fear*.92+(1-hp)*.64+Math.max(0,pressure-2)*.10-tr.courage*.34,
          EVADE:(hurt?.54:.06)+tr.skill*.15+a.fear*.22
        };
        const sq=this.squads[s.squad],tac=sq&&sq.tac;
        const order={CHARGE:'ATTACK',SWARM:'ATTACK',HUNT:'FLANK',FLANK:'FLANK',ENVELOP:'FLANK',SCREEN:'ESCORT',FEIGN:'REGROUP',MINE:'FLANK'}[tac];
        if(order)scores[order]+=.28*tr.cooperation;
        let value=-Infinity;const vals={};
        for(const name of Object.keys(scores)){
          const v=scores[name]+(a.actionBias[name]||0)+(a.rng()-.5)*tr.creativity*.38;
          vals[name]=v;if(v>value){value=v;action=name;}
        }
        // Intent hysteresis: a new goal must beat the current one by a margin and
        // keep beating it for a dwell that grows with the hull, unless it is an emergency.
        const cur=a.action,emergency=damaged>=.12||a.fear>.78||hp<.3;
        if(action!==cur&&vals[cur]!=null&&vals[cur]>-Infinity&&!emergency){
          const h=this.hand(s),margin=.06+.14*h.commit;
          if(value<vals[cur]+margin){action=cur;a.challenger=null;}
          else if(a.challenger!==action){a.challenger=action;a.challengerAt=now;action=cur;}
          else if(now-a.challengerAt<this.dwell(s,h))action=cur;
          else a.why='beat '+cur+' by '+(value-vals[cur]).toFixed(2)+' for '+(now-a.challengerAt).toFixed(1)+' s';
        }else if(action!==cur)a.why=emergency?(damaged>=.12?'emergency: hit hard':a.fear>.78?'emergency: terror':'emergency: crippled'):'no current goal to hold';
        if(action===cur)a.challenger=a.challenger===cur?null:a.challenger;
        reason={ATTACK:'Local advantage. Committing to an attack run',FLANK:'Changing angle to split their attention',ESCORT:weak?'Covering a damaged ally':'Holding an escort position',REGROUP:'Rejoining the nearest friendly group',RETREAT:'Damage and local threat exceed acceptable risk',EVADE:'Incoming fire. Breaking the firing solution'}[action];
      }
      if(a.action!==action){this.logGoal(s,a,a.action,action,warning?'emergency: ion lock':fresh.length?a.why||'decision':'no contact',now);a.since=now;}
      a.why=null;a.action=action;a.reason=reason;a.weak=weak;
      a.until=now+(warning?1:1.3+tr.discipline*2.4+a.rng()*1.7)*(s.hulls?1.7:1);
      this.stats.decisions++;this.stats.actions[action]=(this.stats.actions[action]||0)+1;
      return a;
    }
    destination(s,now,capital=false) {
      const a=this.think(s,now),c=a.contacts.get(a.target),warning=this.threat(s,now);
      const sq=this.squads[s.squad];
      const speed=s.spdMax||s.spd||40;
      let goal,boost=1,mode=a.action,orbit=null;
      const order=a.order&&now<a.order.until?a.order:null,st=this.story&&this.story.ready?this.story:null;
      if(order&&a.orderKind===order.kind&&!warning){
        const kind=order.kind,dir=s.side?-1:1;
        if(kind==='ROUT'){goal=[-dir*9500,s.y+a.vertical*260,s.z*1.15+a.lane*500];boost=1.3;mode='ROUT';}
        else if(kind==='PANIC'){const t=order.dir||0;goal=[s.x+Math.cos(t)*900,s.y+a.vertical*300,s.z+Math.sin(t)*900];boost=1.3;mode='PANIC';}
        else if(kind==='DRIFT'){goal=[s.x+Math.cos(s.yaw)*200,s.y,s.z+Math.sin(s.yaw)*200];boost=.1;mode='DRIFT';}
        else if(kind==='RAM'){const t=this.byId.get(order.target);if(t&&alive(t)){const lead=Math.min(8,distance(s,t)/Math.max(20,speed*1.3));goal=[t.x+Math.cos(t.yaw)*(t.v||0)*lead,t.y+(t.vy||0)*lead,t.z+Math.sin(t.yaw)*(t.v||0)*lead];}else goal=[s.x+Math.cos(s.yaw)*500,s.y,s.z+Math.sin(s.yaw)*500];boost=1.6;mode='RAM';}
        else if(kind==='RESCUE'||kind==='GUARD'){
          const cap=this.byId.get(order.anchor);
          if(cap&&alive(cap)){
            const foe=st&&st.sides[1-s.side].center,threat=cap.lastHit!=null&&this.byId.get(cap.lastHit)&&alive(this.byId.get(cap.lastHit))?this.byId.get(cap.lastHit):foe;
            let ux=threat?threat.x-cap.x:dir,uz=threat?threat.z-cap.z:0;const n=Math.hypot(ux,uz)||1;ux/=n;uz/=n;
            const theta=(s.seed%628)/100+now*.25*a.orbit,berth=radius(cap)+(capital?330:170);
            goal=[cap.x+ux*berth+Math.cos(theta)*120,cap.y+a.vertical*berth*.25,cap.z+uz*berth+Math.sin(theta)*120];
            // The screen circles its capital just outside the hull, never inside it.
            orbit={x:cap.x,y:cap.y+a.vertical*berth*.25,z:cap.z,r:berth};
          }else goal=[s.x,s.y,s.z];
          boost=1.1;mode='ESCORT';
        }else if(order.point){goal=order.point.slice();if(order.spread){goal[0]+=a.lane*order.spread;goal[1]+=a.vertical*order.spread*.45;goal[2]+=a.depth*order.spread;}
          // A tug with a hull on the line crawls: a capital does not tow like a fighter.
          boost=kind==='HIDE'?.9:kind==='HOLD'?.8:kind==='CONVOY'?1:kind==='TOW'&&order.slow?.3:1.15;mode=kind==='CONVOY'?'SEARCH':kind;}
        else if(kind==='STRIKE'){const t=this.byId.get(order.target);goal=t&&alive(t)?[t.x,t.y+a.vertical*80,t.z]:[s.x,s.y,s.z];boost=1.2;mode='ATTACK';}
        else if(kind==='BERSERK'){mode='ATTACK';}
        if(kind==='BERSERK'&&c){const n=distance(s,c)||1;goal=[c.x+(s.x-c.x)/n*60,c.y,c.z+(s.z-c.z)/n*60];boost=1.35;}
        // A squadron keeps its shape on a posture order: the leader takes the point, the wingmen their slots.
        let slot=null;
        if(goal&&(!capital||sq)&&FORMATION_ORDERS.has(kind)&&this.formed(s,now)){slot=this.slotFor(s,sq,now);if(slot)goal=slot.goal;}
        if(goal){a.plan={goal:slot?goal:this.avoidField(s,goal),boost,mode,target:a.target,reason:a.reason,slot,orbit:slot?null:orbit,station:!slot&&kind!=='ROUT'&&kind!=='PANIC'&&kind!=='RAM'&&kind!=='STRIKE'&&kind!=='BERSERK'};return a.plan;}
      }
      if(warning){
        let dx=s.x-warning.point[0],dy=s.y-warning.point[1],dz=s.z-warning.point[2];
        if(length(dx,dy,dz)<5){dx=-Math.sin(s.yaw)*a.orbit;dy=a.vertical*.5;dz=Math.cos(s.yaw)*a.orbit;}
        const n=length(dx,dy,dz)||1,k=warning.radius+radius(s)+240;
        goal=[warning.point[0]+dx/n*k,warning.point[1]+dy/n*k+speed*1.5*a.vertical,warning.point[2]+dz/n*k];boost=1.45;
      }else if(a.response==='FLEE'&&mode==='RETREAT'){
        // Scatter away from the killer, each on its own line, so one blast cannot take the group.
        const d=a.contacts.get(a.dread)||c||(st&&st.sides[1-s.side].center);
        let ux=d?s.x-d.x:(s.side?1:-1),uz=d?s.z-d.z:0;const n=Math.hypot(ux,uz)||1;ux/=n;uz/=n;
        goal=[s.x+ux*1800-uz*a.lane*900,s.y+a.vertical*600,s.z+uz*1800+ux*a.lane*900];boost=1.35;
      }else if(mode==='RETREAT'||mode==='REGROUP'||mode==='ESCORT'){
        const friend=mode==='ESCORT'&&a.weak?a.weak:a.friends.find(f=>f.hulls)||a.friends[0];a.anchor=friend?friend.id:-1;
        // Terrain is cover: a pilot falling back puts a rock or the moon between itself and them.
        const cover=mode!=='ESCORT'&&!capital&&st&&!this.formed(s,now)?this.coverFor(s,c):null;
        if(cover){goal=cover;a.anchor=-2;boost=mode==='RETREAT'?1.2:.95;a.plan={goal:this.avoidField(s,goal),boost,mode,target:a.target,reason:a.reason='Falling back behind cover',station:true};return a.plan;}
        if(friend){
          const theta=(s.seed%628)/100+now*(capital?.022:.085)*a.orbit;
          const berth=radius(friend)+radius(s)+(capital?330:150);
          goal=[friend.x+Math.cos(theta)*berth,friend.y+a.vertical*berth*.4,friend.z+Math.sin(theta)*berth];
          orbit={x:friend.x,y:friend.y+a.vertical*berth*.4,z:friend.z,r:berth};
        }else if(c){const n=distance(s,c)||1;goal=[s.x+(s.x-c.x)/n*700,s.y+a.vertical*220,s.z+(s.z-c.z)/n*700];}
        else goal=[s.x+(s.side?1:-1)*500,s.y+a.vertical*160,s.z+a.orbit*250];
        boost=mode==='RETREAT'?1.25:.95;
      }else if(c){
        const age=Math.min(3,now-c.seen),tx=c.x+Math.cos(c.yaw)*c.v*age,ty=c.y+c.vy*age,tz=c.z+Math.sin(c.yaw)*c.v*age;
        const dx=s.x-tx,dz=s.z-tz,n=Math.hypot(dx,dz)||1;
        let range=capital?(this.definitions[s.race].hold||500)*a.preferredRange:55+a.preferredRange*75;
        if(capital&&['pounce','swarm'].includes(a.profile.style))range*=.48;
        if(capital&&['siege','support','ancient'].includes(a.profile.style))range*=1.35;
        if(capital&&st&&st.sides[s.side].plan&&st.sides[s.side].plan.kind==='SIEGE'&&st.sides[s.side].plan.state!=='done')range*=1.6;
        const berth=radius(c)+radius(s)*.65+range;
        const tangent=capital?berth*.62:45+speed*.7;
        const sweep=now*(capital?.055:.20)+(s.seed%97);
        const flank=mode==='FLANK'||(capital&&['flank','encircle','ambush','ancient'].includes(a.profile.style));
        if(flank){
          const theta=c.yaw+(capital?Math.PI*.55:Math.PI*.82)*a.orbit+Math.sin(sweep)*.35;
          goal=[tx+Math.cos(theta)*berth,ty+a.vertical*(capital?320:75),tz+Math.sin(theta)*berth];
        }else{
          const pass=surface(s,c)<range*1.3?1:.35;
          goal=[tx+dx/n*berth-dz/n*tangent*a.orbit*pass,ty+a.vertical*(capital?190:90),tz+dz/n*berth+dx/n*tangent*a.orbit*pass];
        }
        if(mode==='EVADE'){goal[0]+=-dz/n*speed*3*a.orbit;goal[1]+=speed*1.8*a.vertical;goal[2]+=dx/n*speed*3*a.orbit;boost=1.30;}
        else boost=a.response==='CHARGE'?1.35:capital?1.10:1.12;
        if(!capital&&mode!=='EVADE'){
          // The pilot's attack geometry: how it comes in, and the circle it works the target on.
          const h=this.hand(s),g=GEOMETRY[h.geometry]||GEOMETRY.slash,far=surface(s,c)>range*3;
          if(far&&g.climb)goal[1]+=g.climb*Math.min(600,surface(s,c)*.3);
          if(far&&h.geometry==='stalk'){goal=[tx-Math.cos(c.yaw)*berth*1.4,ty+a.vertical*60,tz-Math.sin(c.yaw)*berth*1.4];}
          if(far&&h.geometry==='swarm'){const th=Math.atan2(s.z-tz,s.x-tx)+a.lane*.7;goal=[tx+Math.cos(th)*berth,ty+a.vertical*90,tz+Math.sin(th)*berth];}
          orbit={x:tx,y:ty+a.vertical*(s.gunboat?40:90),z:tz,r:berth*g.r+(s.gunboat?radius(s)*.8:0)};
        }
      }else{
        const bearing=s.side?Math.PI:0,phase=now*.045+a.lane*2;
        const front=(s.side?-1:1)*Math.min(1400,250+now*7);
        const sector=this.searchPoint(s);
        goal=sector?[sector.x,sector.y+a.vertical*100,sector.z+a.lane*150]:sq&&sq.wp?sq.wp.slice():[front,Math.sin(phase)*280,Math.sin(phase*.8+a.orbit)*900];
        if(sector)a.reason='Closing on the enemy fleet sector';
        if(capital){goal[1]+=a.vertical*330;goal[2]+=a.lane*500;}
        if(distance(s,{x:goal[0],y:goal[1],z:goal[2]})<100)goal=[s.x+Math.cos(bearing+phase)*500,s.y+a.vertical*180,s.z+Math.sin(bearing+phase)*500];
        boost=.98;
      }
      // A formed squadron flies as one: wingmen hold their slots while the leader flies the squadron's
      // intent, until contact breaks it. A pilot with its own emergency, or one whose nature is to
      // break off for a friend, is free.
      let slot=null;
      if((!capital||sq)&&!warning&&!a.response&&this.formed(s,now)&&!(s.vendetta)&&!(a.order&&now<a.order.until&&SOLO_ORDERS.has(a.order.kind))&&!(mode==='ESCORT'&&a.weak&&this.hand(s).breakaway>.55)&&mode!=='EVADE'
        &&!(mode==='RETREAT'&&(s.hp/Math.max(1,s.hpMax)<.45||a.fear>.7))){
        slot=this.slotFor(s,sq,now);if(slot){goal=slot.goal;boost=1;orbit=null;}
      }
      // Command holds a squadron together; without it they spread.
      if(!slot&&st&&!capital&&sq&&sq.cx!=null&&['ATTACK','FLANK','SEARCH','EVADE'].includes(mode)){
        const side=st.sides[s.side],flag=side.flag>=0&&this.byId.get(side.flag);
        if(flag&&alive(flag)&&!side.leaderless){
          const dx=sq.cx-s.x,dy=sq.cy-s.y,dz=sq.cz-s.z,d=length(dx,dy,dz);
          if(d>260){const k=Math.min(.35,(d-260)/1400);goal=[goal[0]+(sq.cx-goal[0])*k,goal[1]+(sq.cy-goal[1])*k,goal[2]+(sq.cz-goal[2])*k];}
        }
      }
      a.plan={goal:slot?goal:this.avoidField(s,goal),boost,mode,target:a.target,reason:a.reason,slot,orbit,
        station:!slot&&!orbit&&(mode==='REGROUP'||mode==='ESCORT'||mode==='SEARCH')};
      return a.plan;
    }
    // A wingman's slot goal: a point ahead of the slot along the squadron's heading, so a pilot in
    // station flies parallel to the leader instead of chasing a dot, plus what the throttle needs.
    slotFor(s,sq,now){
      const p0=this.slotPoint(s,sq,now);if(!p0)return null;
      // The pilot sees where the slot is by their own reaction delay (timing differs by pilot);
      // the steering itself uses the ship's current position, so the delay never sits in the loop.
      const d=this.delayed(s,'slotBuf',p0),p=[d[0],d[1],d[2],p0[3]];
      const lead=this.byId.get(sq.fm.lead),fm=sq.fm,h=this.hand(s);
      // Formation keeping: fly the slot's own velocity (the leader's, plus the formation's turn
      // carrying the slot round its arc), corrected by the pilot toward the slot. The correction
      // along the heading is floored, so a wingman ahead of its slot eases off; it never turns round.
      // The slot moves along the leader's track at the leader's pace.
      const sv=lead.v||0,fx=p0[4],fz=p0[5],svx=fx*sv,svz=fz*sv;
      const rx=p[0]-s.x,rz=p[2]-s.z,along=rx*fx+rz*fz,side=-rx*fz+rz*fx,off=Math.hypot(rx,rz);
      const k=(.12+.18*h.reform)*(off>p[3]*1.5?1.6:1),spd=s.spd||20,top=s.spdMax||spd*1.3;
      // Far from the slot: fly an intercept on where it will be, at full pace, and ignore its turns.
      // Close: match its velocity. Hysteresis between the two, so the choice does not flicker.
      const farOn=Math.min(p[3]*3,p[3]+600),farOff=Math.min(p[3]*1.8,p[3]+300);
      // A wingman ahead of its slot never turns round for it, near or far: it eases off instead.
      s.slotFar=(s.slotFar?off>farOff:off>farOn)&&(along>-p[3]*1.5||sv<5);
      if(s.slotFar){
        const t=clamp(off/Math.max(10,top-sv*.5),0,8),ix=p[0]+svx*t,iz=p[2]+svz*t,dx=ix-s.x,dz=iz-s.z,dn=Math.hypot(dx,dz)||1;
        const reach=Math.max(60,(s.slen||20)*2,top*1.2);
        // Arrival: close at a pace that falls with the distance left, so the slot is met, not overflown.
        const want=clamp(sv+(.25+.25*h.reform)*off,spd*.35,top);
        return {goal:[s.x+dx/dn*reach,p[1],s.z+dz/dn*reach],point:p,along,off,want,spacing:p[3],reform:h.reform,far:true};
      }
      // Easing off to let the slot come back is for small corrections; a real rejoin is flown at pace, as an arc.
      // Ahead of its slot, a wingman drops right back and lets the formation come to it.
      // A big hull (80 m or more) turns only with way on, so it never eases off below four-fifths of the formation's pace.
      const big=(s.slen||20)>=80;
      const floor=along<0?Math.max(spd*(big?.45:.3),sv*(big?.8:.5)):off<p[3]*1.2?Math.max(spd*.35,sv*(big?.8:.55)):Math.max(spd*.6,sv*.8);
      // Sideways correction scales with forward pace: at a crawl a small error must not swing the nose.
      // Near the slot a pilot closes gently: never more than 30% off the formation's pace.
      const corr=off<p[3]*2?clamp(along*k,-.3*Math.max(sv,spd*.5),.3*Math.max(sv,spd*.5)):along*k;
      // A rejoin never runs at more than about half as fast again as the formation: a wingman sprinting at
      // three times a crawling squadron's pace reads as a ship that has left it.
      const va=clamp(sv+corr,floor,Math.min(top,Math.max(sv*1.45+spd*.1,spd*.5))),lmax=va*(off<p[3]*1.2?.35:.7),vl=clamp(side*k,-lmax,lmax);
      // Each pilot's own slow wander on the line: a squadron never flies as one autopilot.
      const wander=(.044+.061*(1-this.hand(lead).tight))*Math.sin(now*(.4+.5*h.breath)+h.ph[4]);
      const reach=Math.max(60,(s.slen||20)*2,va*1.2),ang=Math.atan2(vl,va)+wander;
      const gx=Math.cos(ang)*fx-Math.sin(ang)*fz,gz=Math.sin(ang)*fx+Math.cos(ang)*fz;
      return {goal:[s.x+gx*reach,p[1],s.z+gz*reach],point:p,along,off,want:Math.min(top,Math.hypot(va,vl)),spacing:p[3],reform:h.reform};
    }
    // Pass around rocks and moons: if the leg to the goal clips one, fly to a
    // point on its near flank first. Only the first obstruction ahead counts.
    avoidField(s,goal){
      const f=this.field;if(!f||!f.solids.length)return goal;
      const r0=radius(s),dx=goal[0]-s.x,dy=goal[1]-s.y,dz=goal[2]-s.z,len=length(dx,dy,dz);if(len<1)return goal;
      const reach=Math.min(len,2500),ux=dx/len,uy=dy/len,uz=dz/len;
      let best=null,bu=Infinity;
      for(const o of f.solids){
        const ox=o.x-s.x,oy=o.y-s.y,oz=o.z-s.z,u=ox*ux+oy*uy+oz*uz;
        if(u<-o.r||u>reach+o.r)continue;
        const clear=o.r+r0+70,px=ox-ux*u,py=oy-uy*u,pz=oz-uz*u,miss=length(px,py,pz);
        if(miss>=clear||u>=bu)continue;
        bu=u;best={o,px,py,pz,miss,clear};
      }
      if(!best)return goal;
      const {o,clear}=best;let {px,py,pz,miss}=best;
      if(miss<1){px=-uz;py=0;pz=ux;miss=1;} // dead centre: pass on a fixed side
      // (px,py,pz) runs from the path's closest point to the centre: pass on the path's own side.
      const k=(clear+40)/miss;
      return [o.x-px*k,o.y-py*k,o.z-pz*k];
    }
    moveCapital(s,now,dt) {
      const p=this.destination(s,now,true),a=s.ai;
      // Traffic only requests a passing altitude, and it blends in and out rather than toggling.
      const avoiding=!!(s.trafficGoal&&now<s.trafficUntil);
      if(avoiding)s.avY=s.trafficGoal[1];
      const aw=this.avoidBlend(s,avoiding,avoiding?s.trafficBrake:1,dt);
      const debris=s.debrisGoal&&now<s.debrisUntil;
      const goal=debris?s.debrisGoal:[p.goal[0],aw>0&&s.avY!=null?p.goal[1]+(s.avY-p.goal[1])*aw:p.goal[1],p.goal[2]];
      let dx=goal[0]-s.x,dy=goal[1]-s.y,dz=goal[2]-s.z;
      for(const other of (s.trafficScan!=null?[]:a.friends.slice(0,10))){
        const d=distance(s,other),safe=radius(s)+radius(other)+90;
        if(d>1&&d<safe){const k=(safe-d)/d;dx+=(s.x-other.x)*k*1.8;dy+=(s.y-other.y)*k;dz+=(s.z-other.z)*k*1.8;}
      }
      const dist=length(dx,dy,dz),turn=(s.turn||.07)*(p.mode==='RAM'?1.5:1);
      // Holding a point: a capital runs its way in, brakes, and stops. It does not circle or pivot.
      const holding=p.station&&(p.mode==='HOLD'||p.mode==='HIDE'||p.mode==='GUARD'||p.mode==='MANEUVER');
      const close=holding&&dist<Math.max(250,(s.slen||300)*.6);
      const err=close?0:angle(Math.atan2(dz,dx)-s.yaw);
      this.helmTurn(s,err,dt,now,{max:turn,clean:true,capital:true});
      const dash=s.spdMax||s.spd*1.3;
      let velocity=clamp(s.spd*p.boost,s.spd*.65,dash);
      // The muster parks a 19 km ship well behind its screen. A sustained transit burn
      // gets it into the fight; it builds over the spool like any burn, and sheds on contact.
      const transit=p.mode==='SEARCH'&&dist>1600&&!p.slot;
      const transitV=Math.min(180,s.spd*(2.4+a.budget[2]/40));
      if(transit){velocity=transitV;a.reason='Transit burn. Closing to sensor contact';}
      // An emergency burn: a doomed hull spends everything it has left on the ram.
      if(p.mode==='RAM'&&s.v!==0){velocity=Math.max(dash*1.25,Math.min(90,Math.max(40,(s.slen||300)*.06)));}
      if(p.mode==='DRIFT')velocity=0;
      // A cruiser in a squadron holds its station: the slot's pace, inside its own engines.
      if(p.slot)velocity=clamp(p.slot.want,s.spd*.35,dash);
      velocity=Math.min(velocity,this.leadCap(s,now));
      if(debris){velocity*=s.debrisBrake;a.reason="Avoiding debris corridor";}
      velocity*=s.avBrake??1;
      if(now<(s.trafficBrakeUntil||0))velocity*=.65;
      if(s.stunT&&now<s.stunT)velocity*=.62;
      // A capital answers the fight too: hard turns and engine damage cost speed,
      // and a big hull takes 8 to 30 s to reach full burn (a ram spends everything).
      if(p.mode!=='DRIFT'&&!transit&&p.mode!=='RAM'){
        const hp=clamp((s.hp||1)/Math.max(1,s.hpMax||1),0,1),turnUse=Math.min(1,Math.abs(s.yawV||0)/Math.max(.01,turn));
        velocity*=(1-.25*turnUse)*(.65+.35*hp);
      }
      const spool=p.mode==='RAM'?4:Math.min(30,8+(s.slen||300)/200);
      // The drive in use: the transit drive while burning or still above top speed after one.
      const onTransit=transit||(s.v||0)>Math.max(dash,s.spd)*1.02;
      const burn=onTransit?Math.max(transitV,dash):p.mode==='RAM'?Math.max(velocity,dash):Math.max(dash,s.spd);
      const acc=burn/spool,dec=burn/spool*1.5;
      if(holding)velocity=Math.min(velocity,Math.sqrt(2*dec*.55*Math.max(0,dist-(s.slen||300)*.2)));
      s.fullBurn=burn;
      {const v=s.v||0,dv=(velocity-v)*Math.min(1,dt*(p.mode==='RAM'?1.4:.65));
       // Braking from a transit burn is still braking: it takes the main drive's spool.
       const want=clamp(dv/dt,-dec,acc);
       const jerk=(acc+dec)/Math.max(.5,spool*.3);
       // The burn builds under a jerk limit, but never outside what the drive in use can give.
       s.vA=clamp((s.vA||0)+clamp(want-(s.vA||0),-jerk*dt,jerk*dt),-dec,acc);
       s.v=Math.max(0,v+s.vA*dt);if(velocity===0&&s.v<.05){s.v=0;s.vA=0;}}
      // A capital climbs no steeper than about 30 degrees to its own flight path: no hull bobs on the spot.
      const climbLim=Math.min(s.spd*.42,Math.max(2,Math.abs(s.v||0)*.6));
      s.vy=(s.vy||0)+(clamp(dy*.15,-climbLim,climbLim)-(s.vy||0))*Math.min(1,dt*.8);
      s.x+=Math.cos(s.yaw)*s.v*dt;s.z+=Math.sin(s.yaw)*s.v*dt;s.y+=s.vy*dt;
      if(s.steadyCapital){
        // A capital hull translates vertically without pitching like a fighter.
        // Never turn a collision-induced low forward speed into a steep attitude.
        s.roll=(s.roll||0)*Math.exp(-dt*2);
        const pitch=s.race===20?0:clamp(Math.atan2(s.vy,Math.max(20,s.spd,s.v))*.12,-.025,.025);
        s.pitch=(s.pitch||0)+(pitch-(s.pitch||0))*Math.min(1,dt*.35);
      }else{
        const h=this.hand(s),target=clamp(-s.yawV/Math.max(.01,turn)*.18*(.4+.8*h.bank),-.2,.2),wn=.9/(.5+.5*h.smooth);
        s.rollV=(s.rollV||0)+(wn*wn*(target-(s.roll||0))-2*wn*(s.rollV||0))*dt;s.roll=(s.roll||0)+s.rollV*dt;
        const pitch=clamp(Math.atan2(s.vy,Math.max(20,s.spd,s.v))*.18,-.055,.055);
        s.pitch=(s.pitch||0)+(pitch-(s.pitch||0))*Math.min(1,dt*.6);
      }
      s.mark=p.target;s.mood=MOODS[p.mode]||'ATTACK';
    }
    command(squads,now) {
      this.formations(squads,now);
      for(const sq of squads){
        sq.mem=sq.mem.filter(id=>this.byId.get(id)&&!this.byId.get(id).dead);if(!sq.mem.length)continue;
        if(sq.aiUntil&&sq.aiUntil>now)continue;
        const lead=this.byId.get(sq.mem[0]);if(!lead||!alive(lead))continue;
        const a=this.seedShip(lead),intel=new Map();
        for(const id of sq.mem){const member=this.byId.get(id);if(!member)continue;this.scan(member,now);for(const c of member.ai.contacts.values())if(now-c.seen<5)intel.set(c.id,c);}
        if(!intel.size){sq.tac='ADVANCE';sq.adv=true;const sector=this.searchPoint(lead);sq.wp=sector?[sector.x,sector.y+a.vertical*100,sector.z+a.lane*150]:[(sq.side?-1:1)*600,a.vertical*280,a.lane*700];sq.aiUntil=now+1;continue;}
        sq.adv=false;
        let tgt=null,score=-Infinity;
        for(const c of intel.values()){const v=1/(1+surface(lead,c)/900)+(1-c.hp/Math.max(1,c.hpMax))*.25+a.rng()*.18;if(v>score){score=v;tgt=c;}}
        // A living flagship shares its target with squadrons in command range.
        const st=this.story&&this.story.ready?this.story:null,side=st&&st.sides[sq.side],flag=side&&side.flag>=0&&!side.leaderless?this.byId.get(side.flag):null;
        if(flag&&alive(flag)&&flag.ai&&flag.ai.target>=0&&distance(flag,lead)<6000){const c=flag.ai.contacts.get(flag.ai.target)||intel.get(flag.ai.target);if(c&&a.rng()<.25+a.traits.discipline*.35){tgt=c;sq.shared=flag.id;}else sq.shared=-1;}
        const doctrine=this.definitions[lead.race].doct;
        const injured=sq.mem.some(id=>{const s=this.byId.get(id);return s.hp/s.hpMax<.45;});
        const deck=Object.keys(doctrine).filter(k=>doctrine[k]>0);
        let tactic='CHARGE',best=-Infinity;
        for(const key of deck){let weight=doctrine[key]*(.30+a.rng());if(key===sq.tac)weight*=.55;if(injured&&['SCREEN','FEIGN'].includes(key))weight*=1.7;if(tgt.hulls&&key==='HUNT')weight*=1.4;if(weight>best){best=weight;tactic=key;}}
        sq.tac=tactic;sq.phase=tactic==='SCREEN'?2:tactic==='FEIGN'?3:1;
        sq.tgt=tgt.id;sq.tgtSq=-1;sq.wp=null;
        const guard=a.friends.find(s=>s.hulls);sq.guard=guard?guard.id:-1;
        sq.aiUntil=now+8+a.rng()*12;sq.until=sq.aiUntil;
      }
    }
    ionLock(g,side,now) {
      const targets=this.targets(g,now);if(!targets.length)return null;
      const reachable=targets.filter(t=>surface(g,t)<Math.max(2200,Math.min(6000,g.slen*.6)));
      let target=null,best=-Infinity;
      for(const t of reachable){
        let score=t.hulls?2:1;
        for(const o of reachable)if(o!==t&&distance(t,o)<210)score+=o.hulls?.35:.5;
        score-=surface(g,t)/5000;if(score>best){best=score;target=t;}
      }
      if(!target)return null;
      const charge=4.2+g.ai.rng()*1.2;
      const lead=Math.min(1.4,charge*g.ai.traits.skill*.3);
      return {gun:g.id,side,target:target.id,point:[target.x+Math.cos(target.yaw)*(target.v||0)*lead,target.y+(target.vy||0)*lead,target.z+Math.sin(target.yaw)*(target.v||0)*lead],
        radius:clamp(150+g.slen*.012,150,270),fire:now+charge,last:0,started:now};
    }
    hitChance(s,t,range,now) {
      const a=this.seedShip(s),ta=this.seedShip(t),dodge=clamp((t.v||t.spd||0)/170);
      return clamp(.39+a.traits.skill*.42+(a.traits.luck-.5)*.12-a.fear*.16-dodge*.20-range*.00012+(capital(t)?.18:0)-(ta.action==='EVADE'?.14:0),.12,.94);
    }
    damage(t,raw,source,now) {
      let amount=raw;
      if(source){amount*=source.damageK||1;if(source.hero)amount*=1.12;}
      amount/=t.armourK||1;
      if(t.hero)amount*=.88;
      // A hull committed to a ram has diverted everything to its forward shields.
      if(t.ramming!=null)amount*=.4;
      if(source&&source.ai){const a=source.ai;a.confidence=clamp(a.confidence+.009);}
      const ai=t.ai;if(ai)ai.fear=clamp(ai.fear+Math.min(.18,amount/Math.max(1,t.hpMax)*.6));
      return amount;
    }
    describe(s) {
      const a=this.seedShip(s);
      return {traits:{...a.traits},budget:a.budget.slice(),fear:a.fear,confidence:a.confidence,
        action:a.action,reason:a.reason,contacts:a.contacts.size,visible:[...a.contacts.values()].filter(c=>c.direct).length,sensors:this.senses(s)};
    }
  }
  /* ------------------------------- doctrine -------------------------------
     How each fleet's nerve works. Design choices for drama, not canon; the
     last column is the rationale DECISIONS.md prints.
       rout        squadron mean fear that breaks it (null: never breaks)
       retreat     a single pilot may withdraw on its own
       spread      how strongly fear passes between neighbours (0: none)
       panic       share of pilots who scatter when the flagship falls
       berserk     share who charge instead
       succession  seconds without command before a successor takes over
       pursue      1 hunts routing enemies, 0 re-engages elsewhere
       escape      'jump' leaves by the fleet's arrival effect in reverse, 'edge' flies off
       rally       chance a routed squadron that gets clear turns back
       rescue      propensity to screen crippled capitals and pick up pods
       stand       last-stand weights [ram, volley, abandon ship]
       ruthless    fires on escape pods
       plans       weights for PINCER, AMBUSH, HOLD, RAID, DECAPITATE, SIEGE */
  const PLANS=['PINCER','AMBUSH','HOLD','RAID','DECAPITATE','SIEGE'];
  const D=(rout,retreat,spread,panic,berserk,succession,pursue,escape,rally,rescue,stand,ruthless,plans,why)=>({rout,retreat,spread,panic,berserk,succession,pursue,escape,rally,rescue,stand,ruthless,plans,why});
  const DOCTRINE=[
    D(.62,true,.8,.25,.10,8,.5,'jump',.35,.6,[.2,.4,.3],false,[2,1,3,1,1,2],'A drilled yard navy: breaks by the book and regroups by the book.'),
    D(.55,true,1.3,.45,.30,12,.9,'edge',.2,.3,[.5,.3,0],true,[3,2,0,2,1,0],'A social swarm: fear and fury both run through it like a current.'),
    D(.70,true,.5,.10,.05,3,.3,'jump',.5,.7,[.1,.6,.2],false,[3,0,2,0,1,3],'A coordinated lattice: a node falls, the next one holds the geometry.'),
    D(.45,true,1.0,.40,.10,10,.2,'jump',.4,.8,[.2,.2,.5],false,[1,3,0,3,1,0],'Salvagers: they run early, strike from cover and tow home what they can.'),
    D(.60,true,.6,.20,.05,6,.2,'jump',.6,.9,[0,.5,.4],false,[1,1,3,0,0,3],'A patient choir: holds its line, shelters the wounded, comes back.'),
    D(.72,true,.5,.15,.15,5,.9,'jump',.15,.3,[.35,.45,.1],true,[2,0,2,0,1,4],'Imperial officers fear their superiors more than the enemy. They siege, and they run down the broken.'),
    D(.50,true,.9,.30,.15,7,.3,'jump',.3,.9,[.4,.2,.4],false,[2,3,0,3,3,0],'The Rebellion retreats to fight another day, and never leaves a pilot in the void.'),
    D(.75,true,.4,.10,.20,4,.6,'jump',.5,.7,[.2,.6,.1],false,[3,1,2,0,2,2],'Composed and proud: slow to break, precise in pursuit.'),
    D(.80,true,.3,.30,.50,2,1,'jump',.2,0,[.6,.4,0],true,[2,3,0,3,2,0],'The Shadows are chaos with a purpose: leaderless, they get more dangerous, not less.'),
    D(.60,true,.7,.20,.15,6,.4,'jump',.5,.8,[.4,.4,.2],false,[2,1,3,1,1,2],'EarthForce holds the line and covers its wounded.'),
    D(.55,true,.7,.20,.05,5,.1,'jump',.5,1,[.3,.3,.4],false,[2,1,3,0,1,3],'Starfleet does not hunt a beaten enemy, and always beams out the crew.'),
    D(.90,true,.4,.05,.60,3,1,'jump',.3,.2,[.8,.2,0],true,[3,2,0,3,2,0],'Klingons almost never break; losing the flagship makes them charge.'),
    D(null,false,0,0,0,.5,.6,'jump',0,0,[.3,.7,0],false,[2,0,2,0,1,3],'The Collective has no nerve to break and no captain to lose.'),
    D(.60,true,.6,.20,.05,8,.1,'jump',.5,1,[.1,.3,.6],false,[0,0,4,0,0,3],'A protective convoy: it holds, shelters the wounded and abandons ships before lives.'),
    D(.70,true,.6,.20,.20,4,.6,'jump',.4,.9,[.3,.5,.3],false,[2,1,2,2,2,1],'Marines leave nobody behind and hold together under pressure.'),
    D(.80,true,.3,.10,.30,6,.8,'edge',.1,.1,[.5,.5,0],true,[1,2,1,0,2,3],'The Engineers are indifferent to loss and merciless to the fleeing.'),
    D(.85,true,.2,.05,.40,5,.8,'jump',.2,0,[.5,.5,0],false,[0,4,0,3,2,0],'Hunters: they ambush, they hunt the strongest, and they do not surrender a ship.'),
    D(.90,true,.1,0,0,1,.5,'jump',0,0,[0,1,0],true,[0,0,0,0,1,0],'The First Ones do not plan around anyone. They go where they please and unmake what they choose.'),
    D(.60,true,.6,.20,.10,5,.5,'jump',.4,.3,[.2,.3,.4],false,[1,4,0,3,2,0],'Romulans strike from the cloak and leave when the odds turn.'),
    D(null,false,.1,0,.50,3,1,'jump',0,0,[.9,.1,0],true,[3,1,0,1,3,0],'The Jem\'Hadar never retreat. Losing command only makes them charge.'),
    D(null,true,.1,0,.20,3,.7,'jump',.5,.6,[.5,.5,0],false,[1,0,3,1,3,1],'Space Marines do not break, though a lone ship may fall back to its brothers.'),
    D(null,false,0,.60,.40,10,1,'edge',0,0,[.8,.2,0],true,[3,2,0,1,1,0],'The swarm cannot rout; when the hive ship dies the broods lose synapse and go feral.'),
    D(.60,true,.8,.25,.10,4,.5,'jump',.5,.7,[.4,.2,.4],false,[2,1,1,3,2,1],'A startup fleet: fast, improvised, and willing to pull out and relaunch.')
  ];
  // The swarm never holds ground: its capitals go to the prey, even in a station war.
  DOCTRINE[21].hunts=true;
  const SQUAD_NAMES={5:['Black','Onyx','Obsidian','Sabre','Scimitar','Night','Storm','Ash','Void','Iron'],
    6:['Red','Gold','Blue','Green','Grey','Yellow','Tan','Silver','Orange','Purple'],
    7:['Flyer','Crest','Wave','Dawn','Light','Star','Shore','Chime'],8:['Umbra','Hush','Veil','Dusk','Shade','Thorn'],
    9:['Alpha','Beta','Zeta','Delta','Kappa','Omega','Sigma','Tango'],10:['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta'],
    11:['Blood','Fang','Talon','Blade','Fire','Claw','Spear','Storm'],12:['Nexus','Vinculum','Conduit','Adjunct','Tertiary','Subunit','Cortex','Relay'],
    19:['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth'],20:['Storm','Thunder','Iron','Blade','Hammer','Wrath'],
    21:['Brood','Maw','Spine','Claw','Sway','Hunger'],22:['Falcon','Merlin','Raptor','Dragon','Kestrel','Grasshopper']};
  const DEFAULT_SQUADS=['Alpha','Bravo','Cobalt','Delta','Echo','Falcon','Granite','Hammer','Jade','Kestrel','Lancer','Mercury'];
  const ACE_NAMES=['Vane','Kestrel','Hollow','Saint','Jackal','Ember','Rook','Tally','Spinner','Ghost','Nines','Brass','Lucky','Halo','Tinder','Mako','Dagger','Sparrow','Wick','Cinder','Quill','Slate','Morrow','Juno'];
  const ACE_KILLS=2;
  const OBJECTIVES=[['ANNIHILATE',4],['FLAGSHIP',2.5],['CONVOY',2],['STATION',1.5]];

  /* ------------------------------ war story ------------------------------
     Flagships and succession, squadron morale and routs, last stands, aces,
     vendettas, rescues, battle plans and objectives. Pure simulation: it
     reads and writes ship and squadron state and draws only from its own
     seeded stream and the pilots' streams. The page supplies a host with a
     few actions it cannot do itself (leaving the battle, pods, volleys,
     declaring a winner) and forwards the events to the broadcast. */
  const pickWeighted=(r,w)=>{let t=0;for(const x of w)t+=Math.max(0,x);let u=r()*t;for(let i=0;i<w.length;i++){u-=Math.max(0,w[i]);if(u<0)return i;}return w.length-1;};
  class WarStory {
    constructor(minds){this.minds=minds;this.host=null;this.reset(1);}
    reset(seed){
      this.seed=seed;this.rng=random((seed^0x57a3f1)>>>0);this.events=[];this.now=0;this.ready=false;
      this.sides=[0,1].map(side=>({side,race:0,flag:-1,flagHistory:[],leaderless:false,successorAt:0,plan:null,center:null,lostCaps:0,alive0:0}));
      this.objective=null;this.field=null;this.aceUsed=0;this.rescues=[];this.stands=0;this.nextSecond=0;this.start=null;this.duels=null;this.contact=false;
    }
    doctrine(s){return DOCTRINE[s&&s.race!=null?s.race:0]||DOCTRINE[0];}
    emit(ev){ev.t=ev.t==null?this.now:ev.t;this.events.push(ev);if(this.events.length>512)this.events.splice(0,this.events.length-512);return ev;}
    drain(){const out=this.events;this.events=[];return out;}
    ships(){return this.minds.ships;}
    ship(id){return id>=0?this.minds.ships[id]:null;}
    live(s){return !!s&&alive(s)&&!s.jumped;}
    // ---- setup, once the muster exists ----
    setup(env){
      // The same seed in a different matchup is a different war: mix in the fleets.
      this.rng=random((this.seed^0x57a3f1^Math.imul(env.sideRace[0]+1,0x9E3779B1)^Math.imul(env.sideRace[1]+7,0x85EBCA6B))>>>0);
      const ships=env.ships,squads=env.squads,r=this.rng;this.field=env.field||null;this.env=env;
      for(const side of [0,1]){
        const st=this.sides[side];st.race=env.sideRace[side];
        const own=ships.filter(s=>s.side===side);st.alive0=own.length;
        // The flagship is the fleet's crown hull; the First Ones' is their eldest.
        const crown=own.filter(s=>(s.hulls||0)>=50)[0]||own.filter(s=>(s.hulls||0)>=10)[0]||own[0];
        st.flag=crown?crown.id:-1;st.flagHistory=[st.flag];
        const names=(SQUAD_NAMES[st.race]||DEFAULT_SQUADS).slice(),used=new Set();
        let k=0;
        for(const sq of squads){
          if(sq.side!==side)continue;
          // Overflow squadrons get a Roman numeral: "Red II", never "Red 2 4".
          let name=names[k%names.length]+(k>=names.length?' '+['','II','III','IV','V','VI','VII','VIII','IX','X'][Math.min(9,Math.floor(k/names.length))]:'');k++;
          while(used.has(name))name+='′';used.add(name);
          sq.name=name;sq.size0=sq.mem.length;sq.state='steady';sq.role='main';sq.lost=0;
          sq.mem.forEach((id,i)=>{const s=ships[id];if(!s)return;s.callsign=s.hero?null:i===0?name+' Leader':name+' '+(i+1);});
        }
      }
      this.chooseObjective(env);
      for(const side of [0,1])this.choosePlan(side,env,true);
      this.ready=true;
      this.emit({type:'warPlan',side:0,plans:this.sides.map(s=>s.plan.kind),objective:this.objective.kind,objSide:this.objective.side,t:0});
    }
    chooseObjective(env){
      const r=this.rng,w=OBJECTIVES.map(o=>o[1]),ships=env.ships;
      const unique=env.sideRace.some(x=>DOCTRINE[x]===DOCTRINE[17]);
      if(unique)w[2]=w[3]=0; // the First Ones do not escort convoys or hold beacons
      let kind=OBJECTIVES[pickWeighted(r,w)][0];
      const forced=env.force&&env.force.objective;if(forced&&OBJECTIVES.some(o=>o[0]===forced))kind=forced;
      const o={kind,side:-1,ids:[],point:null,progress:[0,0],saved:0,lost:0,need:0,done:false};
      if(kind==='CONVOY'){
        const side=r()<.5?0:1,dir=side?-1:1;
        const pool=ships.filter(s=>s.side===side&&!s.hero&&!(s.hulls>0)&&s.band===1);
        const ids=[];for(let i=0;i<pool.length&&ids.length<4;i+=Math.max(1,Math.floor(pool.length/4)))ids.push(pool[i].id);
        if(ids.length<3){kind='ANNIHILATE';o.kind=kind;}
        else{o.side=side;o.ids=ids;o.need=Math.ceil(ids.length/2);o.point=[dir*2600,0,(r()<.5?-1:1)*(5200+r()*1400)];
          for(const id of ids){ships[id].convoy=true;}}
      }
      if(kind==='STATION')o.point=[(r()-.5)*900,(r()-.5)*300,(r()-.5)*2400];
      this.objective=o;
    }
    choosePlan(side,env,first,exclude){
      const st=this.sides[side],d=DOCTRINE[st.race]||DOCTRINE[0],r=this.rng;
      const squads=(env||this.env).squads.filter(q=>q.side===side&&q.mem.some(id=>this.live(this.ship(id))||first));
      const w=d.plans.slice();
      if(!squads.length){w.fill(0);w[5]=1;} // no squadrons: siege is the only plan
      if(exclude)for(const k of exclude)w[PLANS.indexOf(k)]=0;
      // Against a convoy run, waiting is losing: the side that must stop it cannot hold or siege.
      const hunter=this.objective&&this.objective.kind==='CONVOY'&&this.objective.side===1-side;
      if(hunter){w[2]=w[5]=0;}
      if(!first)w[1]=w[3]=0; // ambushes and raids are set before the fight, not mid-war
      if(w.every(x=>x<=0))w[hunter?0:2]=1;
      let kind=PLANS[pickWeighted(r,w)];
      const env2=env||this.env,forced=first&&env2&&env2.force&&env2.force.plans&&env2.force.plans[side];
      if(forced&&PLANS.includes(forced))kind=forced;
      st.plan={kind,state:'forming',since:this.now,roles:new Map(),cover:null,cycles:0,strikers:0,caps0:st.lostCaps,switches:(st.plan?st.plan.switches+1:0)};
      const all=(env||this.env).ships,fighters=squads.filter(q=>!q.hero&&all[q.mem[0]]&&all[q.mem[0]].band===0);
      for(const q of squads){q.role='main';}
      if(kind==='PINCER')fighters.forEach((q,i)=>q.role=i%2?'right':'left');
      if(kind==='AMBUSH'){
        const n=Math.max(1,Math.round(fighters.length/3));fighters.slice(-n).forEach(q=>q.role='ambush');
        st.plan.cover=this.coverPoint(side);
        if(!st.plan.cover&&first){
          // No terrain to hide behind: a hyperspace ambush that jumps in behind them.
          st.plan.hyper=true;const dir=side?-1:1;
          for(const q of fighters.slice(-n))for(const id of q.mem){const s=env.ships[id];if(!s)continue;s.x+=dir*9000+(r()-.5)*400;s.z+=(r()-.5)*1600;s.yaw=side?0:Math.PI;s.delay+=16+r()*4;}
        }
      }
      if(kind==='RAID')fighters.forEach((q,i)=>{if(i%2===0)q.role='raid';});
      if(kind==='DECAPITATE'){const strike=squads.filter(q=>q.hero).concat(fighters).slice(0,2);strike.forEach(q=>q.role='strike');}
      if(kind==='HOLD'||kind==='SIEGE')fighters.forEach((q,i)=>{if(i%2===0)q.role='screen';});
      for(const q of squads){q.roleSize=q.mem.length;q.roleLost=0;}
      return kind;
    }
    coverPoint(side){
      const f=this.field;if(!f)return null;
      const dir=side?-1:1,own={x:dir*-3000,y:0,z:0};
      const spots=[];
      if(f.moon)spots.push({x:f.moon.p[0],y:f.moon.p[1],z:f.moon.p[2],r:f.moon.r,kind:'moon'});
      if(f.nebula)spots.push({x:f.nebula.p[0],y:f.nebula.p[1],z:f.nebula.p[2],r:f.nebula.r*.4,kind:'nebula'});
      for(const k of f.rocks||[])if(k.r>=180)spots.push({x:k.p[0],y:k.p[1],z:k.p[2],r:k.r,kind:'rocks'});
      if(!spots.length)return null;
      spots.sort((a,b)=>distance(a,own)-distance(b,own));
      const c=spots[0];
      // Hide on the side of the cover facing home, out of the enemy's sight line.
      return {x:c.x-dir*(c.r+(c.kind==='nebula'?0:260)),y:c.y,z:c.z,kind:c.kind};
    }
    // ---- per ship, from think() ----
    fearTarget(s,a,base,pressure,dt){
      const d=this.doctrine(s);a.witness=(a.witness||0)*Math.exp(-dt/9);
      let spread=0,n=0;
      for(const f of a.friends){if(n>=8)break;if(!f.ai||f.dead)continue;n++;spread+=Math.max(0,f.ai.fear-a.fear);}
      spread=n?spread/n:0;
      const ratio=clamp(pressure,.5,2);
      let fear=base+d.spread*(spread*.45+a.witness*.07)*ratio;
      // Watching the pilots around you die is frightening at any range, even with no enemy on the scope.
      fear+=Math.min(.55,(a.shock||0)*.14)*(1.1-a.traits.courage*.5);
      // Encircled: enemies on opposite sides. A closed pincer or a sprung ambush
      // frightens through this, not through a scripted morale hit.
      let sx=0,sz=0,k=0;
      for(const c of a.contacts.values()){if(k>=10)break;if(!c.direct||this.now-c.seen>1.5)continue;const dx=c.x-s.x,dz=c.z-s.z,dd=Math.hypot(dx,dz);if(dd<60||dd>1600)continue;sx+=dx/dd;sz+=dz/dd;k++;}
      if(k>=4)fear+=.10*(1-Math.hypot(sx,sz)/k)*Math.min(1,d.spread+.3);
      const st=this.sides[s.side];
      if(st.leaderless)fear+=.10*(1-a.traits.courage)+.05;
      else if(st.flag>=0&&this.live(this.ship(st.flag)))fear-=.05;
      const sq=this.minds.squads[s.squad];
      if(sq&&sq.role==='line'&&st.plan&&st.plan.kind==='HOLD')fear-=.06;
      if(d.rout==null&&!d.retreat)fear*=.55; // fear exists, it just is not allowed to decide
      return clamp(fear);
    }
    targetBonus(s,a,c){
      let v=0;const t=this.ship(c.id);if(!t)return 0;
      if(s.vendetta&&s.vendetta.target===c.id)v+=2.4;
      if((s.ace||s.hero)&&(t.ace||t.hero))v+=.45;
      if(t.routing){const d=this.doctrine(s);v+=d.pursue*.55-(1-d.pursue)*.45;}
      const sq=this.minds.squads[s.squad],st=this.sides[s.side],foe=this.sides[1-s.side];
      if(sq&&sq.role==='strike'&&c.id===foe.flag)v+=2;
      const o=this.objective;
      if(o){
        if(o.kind==='FLAGSHIP'&&c.id===foe.flag)v+=.6;
        if(o.kind==='CONVOY'&&t.convoy)v+=.7;
        if(o.kind==='STATION'&&o.point&&length(t.x-o.point[0],t.y-o.point[1],t.z-o.point[2])<2600)v+=.35;
      }
      if(st.plan&&st.plan.kind==='DECAPITATE'&&c.id===foe.flag)v+=.25;
      return v;
    }
    order(s,a,now){
      const o=a.order;if(!o)return null;
      if(now>=o.until||(o.anchor!=null&&!this.live(this.ship(o.anchor))&&o.kind!=='TOW')){a.order=null;if(o.kind==='ROUT'){s.routing=false;}return null;}
      return o;
    }
    setOrder(s,kind,extra){const a=this.minds.seedShip(s);a.order={kind,until:this.now+10,...extra};a.until=0;a.nextThink=0;return a.order;}
    // ---- per step, from the page ----
    step(now,ships,squads){
      this.now=now;if(!this.ready)return;
      if(this.start==null&&ships.some(s=>s.arr))this.start=now;
      const frame=Math.round(now*30);
      // Side centres every half second: cheap and good enough for "away from them".
      if(frame%15===0)for(const side of [0,1]){let x=0,y=0,z=0,n=0;for(const s of ships)if(s.side===side&&this.live(s)){x+=s.x;y+=s.y;z+=s.z;n++;}this.sides[side].center=n?{x:x/n,y:y/n,z:z/n,n}:null;}
      // Squadron morale, bucketed by squadron id: each one thinks twice a second.
      for(const sq of squads)if((frame+sq.id)%15===0)this.squadMorale(sq,now);
      // Capital crises, bucketed by ship id.
      for(const s of ships)if(this.live(s)&&(s.hulls||s.slen>=180)&&(frame+s.id)%15===7)this.capitalCrisis(s,now);
      for(const side of [0,1]){
        const st=this.sides[side];
        if(st.leaderless&&now>=st.successorAt)this.succeed(side,now);
      }
      // First shots: the moment the war actually starts is a beat worth telling.
      if(!this.contact&&frame%15===3)for(const s of ships)if(this.live(s)&&s.arr&&s.lastFire!=null&&now-s.lastFire<.5&&this.minds.byId.get(s.mark)&&this.minds.byId.get(s.mark).side!==s.side){this.contact=true;this.emit({type:'contact',side:s.side,ship:s.id,partner:s.mark,x:s.x,y:s.y,z:s.z,size:s.slen});break;}
      if(now>=this.nextSecond){this.nextSecond=now+1;this.planStep(now,squads);this.planOrders(now,squads);this.objectiveStep(now);this.rescueStep(now);this.aceDuels(now,ships);}
    }
    squadMorale(sq,now){
      const members=sq.mem.map(id=>this.ship(id)).filter(s=>this.live(s)&&s.ai&&s.arr);
      if(!members.length){sq.cx=null;return;}
      let x=0,y=0,z=0,fear=0;for(const s of members){x+=s.x;y+=s.y;z+=s.z;fear+=s.ai.fear;}
      const n=members.length;sq.cx=x/n;sq.cy=y/n;sq.cz=z/n;sq.fear=fear/n;
      const lead=members[0],d=this.doctrine(lead),st=this.sides[sq.side];
      // command() prunes the dead from sq.mem, so losses are counted against the original size.
      const lost=Math.max(0,(sq.size0||n)-sq.mem.filter(id=>{const s=this.ship(id);return s&&!s.dead;}).length);
      sq.lost=lost;
      if(sq.state==='steady'){
        if(d.rout==null||sq.hero||sq.role==='ambush'&&st.plan&&st.plan.state==='forming')return;
        // A squadron remembers. Each loss adds stress at once, sustained fear adds
        // more, calm and a living flagship bleed it off. It breaks on stress, so
        // it breaks on losses actually taken, not on first sight of the enemy.
        const fresh=lost-(sq.lostSeen||0);sq.lostSeen=lost;
        if(sq.engagedAt==null){if(members.some(s=>now-(s.hurtT||-99)<2||now-(s.lastFire||-99)<2))sq.engagedAt=now;else return;}
        const flagNear=st.flag>=0&&this.live(this.ship(st.flag))&&!st.leaderless;
        sq.stress=Math.max(0,(sq.stress||0)+fresh/Math.max(1,sq.size0||n)*2.2+(sq.fear-.35)*.12-(flagNear?.01:0));
        const threshold=d.rout*1.9-(st.leaderless?.2:0);
        if(sq.stress>threshold&&n>=1){
          sq.state='routing';sq.routAt=now;sq.escapeAt=now+8+this.rng()*6;
          for(const s of members){this.setOrder(s,'ROUT',{until:now+40});s.routing=true;}
          this.emit({type:'rout',side:sq.side,squad:sq.id,ship:lead.id,name:sq.name,n,x:sq.cx,y:sq.cy,z:sq.cz,size:lead.slen});
          // A rout is contagious: neighbouring squadrons watched it happen.
          for(const q of this.minds.squads)if(q!==sq&&q.side===sq.side&&q.state==='steady'&&q.cx!=null&&length(q.cx-sq.cx,q.cy-sq.cy,q.cz-sq.cz)<1800)q.stress=(q.stress||0)+.18*(DOCTRINE[st.race]||DOCTRINE[0]).spread;
        }
        return;
      }
      if(sq.state==='routing'){
        const foe=this.sides[1-sq.side].center;
        const clear=!foe||length(sq.cx-foe.x,sq.cy-foe.y,sq.cz-foe.z)>2600;
        const flagAlive=st.flag>=0&&this.live(this.ship(st.flag));
        if(clear&&flagAlive&&sq.fear<.34&&now-sq.routAt>7&&!sq.rallyTried){
          sq.rallyTried=true;
          if(this.rng()<d.rally){
            sq.state='steady';for(const s of members){if(s.ai.order&&s.ai.order.kind==='ROUT')s.ai.order=null;s.routing=false;s.ai.fear*=.5;}
            this.emit({type:'rally',side:sq.side,squad:sq.id,ship:lead.id,name:sq.name,anchor:st.flag,n,x:sq.cx,y:sq.cy,z:sq.cz,size:lead.slen});
            return;
          }
        }
        if(now>=sq.escapeAt){
          const h=this.host;let gone=0;
          for(const s of members){if(h&&h.leave&&h.leave(s,now,d.escape))gone++;}
          if(gone&&!sq.escapeSaid){sq.escapeSaid=true;this.emit({type:'escape',side:sq.side,squad:sq.id,ship:lead.id,name:sq.name,n:gone,how:d.escape,x:sq.cx,y:sq.cy,z:sq.cz,size:lead.slen});}
          if(gone===members.length)sq.state='gone';
        }
      }
    }
    capitalCrisis(s,now){
      const frac=s.hp/Math.max(1,s.hpMax),a=s.ai;if(!a)return;
      // Last stand: a doomed capital chooses how to go.
      // Doomed: nearly gone, or badly hurt and outgunned where it stands.
      const doomed=frac<.30||(frac<.45&&(a.pressure||0)>1.6);
      if(doomed&&!s.stand&&now-(s.hurtT||-99)<3&&!(s.hulls>=50&&this.objective&&this.objective.kind==='FLAGSHIP')){
        s.stand='considered';const d=this.doctrine(s),w=d.stand.slice();
        const foes=this.ships().filter(t=>t.side!==s.side&&this.live(t)&&(t.hulls||t.slen>=180)&&surface(s,t)<1400+s.slen*.8);
        foes.sort((l,r)=>distance(s,l)-distance(s,r));
        if(!foes.length||s.v===0&&s.hulls>=50)w[0]=0;
        const total=w.reduce((x,y)=>x+y,0);
        // Most doomed ships simply die: a stand needs the nerve and a reason.
        if(total<=0||a.rng()>Math.min(.85,total)*(.45+a.traits.courage*.5))return;
        const kind=['RAM','VOLLEY','ABANDON'][pickWeighted(a.rng,w)];
        s.stand=kind;this.stands++;
        const target=foes[0];
        if(kind==='RAM'){this.setOrder(s,'RAM',{target:target.id,until:now+40});s.ramming=target.id;}
        if(kind==='VOLLEY'&&this.host&&this.host.volley)this.host.volley(s,now,target);
        if(kind==='ABANDON'&&this.host&&this.host.abandon)this.host.abandon(s,now);
        this.emit({type:'lastStand',side:s.side,ship:s.id,kind,partner:target?target.id:null,x:s.x,y:s.y,z:s.z,size:s.slen});
        return;
      }
      // A crippled capital under fire calls for a screen.
      if(frac<.38&&frac>0&&now-(s.hurtT||-99)<3&&!s.rescue&&!s.stand){
        const d=this.doctrine(s);if(d.rescue<=0)return;
        const pool=this.minds.squads.filter(q=>q.side===s.side&&q.state==='steady'&&!q.rescue&&!['strike','ambush','raid'].includes(q.role)&&q.cx!=null&&length(q.cx-s.x,q.cy-s.y,q.cz-s.z)<Math.max(3500,s.slen*2));
        if(!pool.length||this.rng()>d.rescue)return;
        pool.sort((l,r)=>length(l.cx-s.x,l.cy-s.y,l.cz-s.z)-length(r.cx-s.x,r.cy-s.y,r.cz-s.z));
        const q=pool[0];q.rescue={cap:s.id,until:now+22,t0:now};s.rescue={squad:q.id,t0:now};
        for(const id of q.mem){const m=this.ship(id);if(this.live(m))this.setOrder(m,'RESCUE',{anchor:s.id,until:now+22});}
        this.rescues.push({kind:'screen',cap:s.id,squad:q.id,t0:now,until:now+22,side:s.side});
        this.emit({type:'rescueStart',side:s.side,ship:s.id,squad:q.id,name:q.name,kind:'screen',x:s.x,y:s.y,z:s.z,size:s.slen});
      }
    }
    rescueStep(now){
      for(const r of this.rescues){
        if(r.done)continue;
        const cap=this.ship(r.cap);
        if(r.kind==='screen'){
          const q=this.minds.squads[r.squad];
          if(!this.live(cap)){r.done=true;if(q)q.rescue=null;this.emit({type:'rescue',side:r.side,ship:r.cap,squad:r.squad,kind:'screen',outcome:'lost',x:cap.x,y:cap.y,z:cap.z,size:cap.slen});}
          else if(now>=r.until){r.done=true;if(q)q.rescue=null;cap.rescue=null;cap.rescued=true;this.emit({type:'rescue',side:r.side,ship:r.cap,squad:r.squad,kind:'screen',outcome:'saved',x:cap.x,y:cap.y,z:cap.z,size:cap.slen});}
        }
      }
      if(this.rescues.length>40)this.rescues=this.rescues.filter(r=>!r.done);
    }
    succeed(side,now){
      const st=this.sides[side];st.leaderless=false;
      const pool=this.ships().filter(s=>s.side===side&&this.live(s)&&s.arr&&!s.routing);
      pool.sort((a,b)=>((b.hulls||0)*1e6+(b.hpMax||0)*(b.hp/Math.max(1,b.hpMax)))-((a.hulls||0)*1e6+(a.hpMax||0)*(a.hp/Math.max(1,a.hpMax)))||a.id-b.id);
      const next=pool[0];if(!next){st.flag=-1;return;}
      st.flag=next.id;st.flagHistory.push(next.id);
      for(const s of pool)if(s.ai){s.ai.fear*=.75;if(s.ai.order&&['PANIC','BERSERK'].includes(s.ai.order.kind))s.ai.order=null;}
      this.emit({type:'successor',side,ship:next.id,x:next.x,y:next.y,z:next.z,size:next.slen});
    }
    // ---- deaths, from kill() ----
    onDeath(t,killer,now){
      this.now=now;if(!this.ready)return;
      const st=this.sides[t.side];
      if(t.hulls||t.slen>=180)st.lostCaps++;
      // Witnesses: allies near the loss take it to heart, weighted by what was lost.
      const weight=t.hulls>=50?2.2:(t.hulls||t.slen>=180)?1.4:t.hero?1.2:.5;
      const hostile=killer&&killer.side!==t.side&&this.live(killer);
      if(killer&&killer.side!==t.side)st.lossAt=now;
      for(const s of this.minds.nearby(t,1400))if(s.side===t.side&&s.ai&&distance(s,t)<1400){
        s.ai.witness=Math.min(4,(s.ai.witness||0)+weight);
        s.ai.shock=Math.min(5,(s.ai.shock||0)+weight);
        // The shot that killed a wingman shows where it came from: a report, not a firing lock.
        if(hostile){s.ai.dread=killer.id;const c=s.ai.contacts.get(killer.id);if(!c||now-c.seen>.5)s.ai.contacts.set(killer.id,{...this.minds.snapshot(killer,now,false),confidence:.8});s.ai.nextThink=0;}
      }
      // The flagship.
      if(t.id===st.flag){
        st.flag=-1;
        this.emit({type:'flagshipDown',side:t.side,ship:t.id,by:killer?killer.id:null,x:t.x,y:t.y,z:t.z,size:t.slen});
        if(this.objective&&this.objective.kind==='FLAGSHIP'&&!this.objective.done){this.objective.done=true;this.declare(1-t.side,'flagship',now);}
        else{
          const d=DOCTRINE[st.race]||DOCTRINE[0];st.leaderless=true;st.successorAt=now+d.succession*(.8+this.rng()*.4);
          let panic=0,berserk=0;
          for(const s of this.ships()){
            if(s.side!==t.side||!this.live(s)||!s.ai||!s.arr||s.hulls>=10)continue;
            const a=s.ai,u=a.rng();
            if(u<d.panic*(1.15-a.traits.courage)){this.setOrder(s,'PANIC',{until:now+4+a.rng()*5,dir:a.rng()*6.283});panic++;}
            else if(u<d.panic*(1.15-a.traits.courage)+d.berserk*(.4+a.traits.aggression)){this.setOrder(s,'BERSERK',{until:now+8+a.rng()*6});berserk++;}
            a.fear=clamp(a.fear+.25*(d.spread>0?1:.3));
          }
          for(const q of this.minds.squads)if(q.side===t.side&&q.state==='steady')q.stress=(q.stress||0)+.3*Math.max(.3,d.spread);
          if(panic||berserk)this.emit({type:'shock',side:t.side,ship:t.id,panic,berserk,x:t.x,y:t.y,z:t.z,size:t.slen});
        }
      }
      if(killer&&killer.side!==t.side&&this.live(killer)){
        // Aces: a small craft that reaches the threshold earns a callsign.
        // The side's first ace needs ACE_KILLS, each later one a kill more, at most four.
        const ks=this.sides[killer.side];
        if(!killer.hero&&!killer.ace&&!(killer.hulls>0)&&(killer.band===0||killer.slen<60)&&(ks.aces||0)<4&&(killer.kills||0)>=ACE_KILLS+(ks.aces||0)){
          ks.aces=(ks.aces||0)+1;
          killer.ace=ACE_NAMES[this.aceUsed++%ACE_NAMES.length]+(this.aceUsed>ACE_NAMES.length?' '+Math.ceil(this.aceUsed/ACE_NAMES.length):'');
          const a=this.minds.seedShip(killer);a.traits.skill=Math.min(.98,a.traits.skill+.06);a.traits.courage=Math.min(.98,a.traits.courage+.05);
          this.emit({type:'ace',side:killer.side,ship:killer.id,name:killer.ace,kills:killer.kills,x:killer.x,y:killer.y,z:killer.z,size:killer.slen});
        }
        // Vendettas settled.
        if(killer.vendetta&&killer.vendetta.target===t.id){this.emit({type:'vendettaSettled',side:killer.side,ship:killer.id,partner:t.id,lost:killer.vendetta.lost,x:t.x,y:t.y,z:t.z,size:t.slen});killer.vendetta=null;}
      }
      // Vendettas begun: an ace (or hero) who loses a wingman remembers who did it.
      const sq=this.minds.squads[t.squad];
      if(sq&&killer&&this.live(killer)&&killer.side!==t.side)for(const id of sq.mem){
        const ace=this.ship(id);
        if(ace===t||!this.live(ace)||!(ace.ace||ace.hero)||ace.vendetta||distance(ace,t)>3000)continue;
        ace.vendetta={target:killer.id,lost:t.id,since:now};
        this.emit({type:'vendetta',side:ace.side,ship:ace.id,partner:killer.id,lost:t.id,x:ace.x,y:ace.y,z:ace.z,size:ace.slen});
        break;
      }
      for(const s of this.ships())if(s.vendetta&&(s.vendetta.target===t.id&&s.vendetta.lost!==undefined&&killer!==s)){s.vendetta=null;}
      if(t.vendetta){this.emit({type:'vendettaFailed',side:t.side,ship:t.id,partner:t.vendetta.target,x:t.x,y:t.y,z:t.z,size:t.slen});t.vendetta=null;}
      if(t.convoy&&this.objective&&this.objective.kind==='CONVOY'&&!this.objective.done){this.objective.lost++;this.emit({type:'convoyLost',side:t.side,ship:t.id,lost:this.objective.lost,x:t.x,y:t.y,z:t.z,size:t.slen});}
    }
    onLeave(s,now){
      if(s.convoy&&this.objective&&this.objective.kind==='CONVOY'&&!this.objective.done&&s.convoyHome){this.objective.saved++;this.emit({type:'convoySaved',side:s.side,ship:s.id,x:s.x,y:s.y,z:s.z,size:s.slen});}
      const st=this.sides[s.side];
      if(s.id===st.flag){st.flag=-1;st.leaderless=true;st.successorAt=now+2;}
    }
    declare(side,reason,now){if(this.host&&this.host.declare)this.host.declare(side,reason,now);}
    // ---- battle plans ----
    planStep(now,squads){
      for(const side of [0,1]){
        const st=this.sides[side],p=st.plan;if(!p||p.state==='done')continue;
        const foe=this.sides[1-side].center,own=st.center;if(!foe||!own)continue;
        const mine=squads.filter(q=>q.side===side);
        const roleLoss=role=>{let size=0,lost=0;for(const q of mine)if(q.role===role){const was=q.roleSize||q.mem.length;size+=was;lost+=Math.max(0,was-q.mem.filter(id=>{const s=this.ship(id);return s&&!s.dead;}).length);}return size?lost/size:0;};
        const dir=side?-1:1,age=now-p.since;
        // A plan gets a fair chance before it can fail, and a fleet changes plan at most twice.
        const fail=(why)=>{if(age<18)return;const from=p.kind;p.state='done';if(p.switches>=2){this.emit({type:'planSwitch',side,from,to:'CHARGE',why,x:own.x,y:own.y,z:own.z});for(const q of mine)q.role='main';return;}
          const to=this.choosePlan(side,null,false,[from]);this.emit({type:'planSwitch',side,from,to,why,x:own.x,y:own.y,z:own.z});this.applyPlan(side,now,squads);};
        const win=(what)=>{p.state='done';this.emit({type:'planWorked',side,plan:p.kind,what,x:foe.x,y:foe.y,z:foe.z});for(const q of mine)if(q.role!=='main'){q.role='main';}};
        if(p.kind==='PINCER'){
          if(p.state==='forming'){
            // A wing has closed when it sits on the enemy's flank, off their centre line and in range.
            let closed=0,wings=0;
            for(const q of mine){if(q.role!=='left'&&q.role!=='right'||q.cx==null)continue;wings++;
              const lat=(q.cz-foe.z)*(q.role==='left'?-1:1);if(lat>1100&&length(q.cx-foe.x,q.cz-foe.z)<3800)closed++;}
            if(wings&&closed>=Math.min(2,wings))win('closed');
            else if(roleLoss('left')>.5||roleLoss('right')>.5)fail('a wing was cut off');
            else if(age>70)fail('the wings never met');
          }
        }else if(p.kind==='AMBUSH'){
          if(p.state==='forming'){
            const hidden=mine.filter(q=>q.role==='ambush'&&q.cx!=null);
            const near=hidden.some(q=>length(q.cx-foe.x,q.cy-foe.y,q.cz-foe.z)<3200);
            const found=hidden.some(q=>q.mem.some(id=>{const s=this.ship(id);return s&&s.ai&&now-(s.hurtT||-99)<2;}));
            if(near||age>60){p.state='sprung';for(const q of hidden){q.role='main';q.tac='CHARGE';q.aiUntil=0;for(const id of q.mem){const s=this.ship(id);if(s&&s.ai&&s.ai.order&&s.ai.order.kind==='HIDE')s.ai.order=null;s&&(s.lurk=false);}}
              this.emit({type:'planWorked',side,plan:'AMBUSH',what:'sprung',x:hidden[0]?hidden[0].cx:own.x,y:hidden[0]?hidden[0].cy:own.y,z:hidden[0]?hidden[0].cz:own.z});}
            else if(found&&!p.hyper){for(const q of hidden){q.role='main';for(const id of q.mem){const s=this.ship(id);if(s){s.lurk=false;if(s.ai&&s.ai.order&&s.ai.order.kind==='HIDE')s.ai.order=null;}}}fail('the ambush was found');}
          }
        }else if(p.kind==='HOLD'||p.kind==='SIEGE'){
          if(p.released==='waited'&&!p.said){p.said=true;this.emit({type:'planSwitch',side,from:p.kind,to:'CHARGE',why:'they would not come to the line',x:own.x,y:own.y,z:own.z});p.state='done';for(const q of mine)q.role='main';continue;}
          const share=this.shares()[side];
          if(st.lostCaps-p.caps0>=Math.max(2,Math.ceil(this.capitals(side,true)*.4))||share<.36)fail(p.kind==='HOLD'?'the line broke':'the siege line was overrun');
          else if(share>.72&&age>40)win('held');
        }else if(p.kind==='RAID'){
          if(roleLoss('raid')>.55)fail('the raiders were caught');
          else if(p.cycles>=2&&p.state!=='done')win('raided');
          this.raidStep(side,now,mine,foe);
        }else if(p.kind==='DECAPITATE'){
          const target=this.ship(this.sides[1-side].flag);
          if(roleLoss('strike')>.6)fail('the strike was shot down');
          else if(age>80&&target&&target.hp/target.hpMax>.5)fail('the flagship held out');
        }
      }
    }
    // Orders that carry a plan or an objective, refreshed once a second so
    // they lapse on their own when the plan ends.
    planOrders(now,squads){
      const until=now+1.6,o=this.objective;
      for(const side of [0,1]){
        const st=this.sides[side],p=st.plan,foe=this.sides[1-side].center,own=st.center;if(!p||!foe||!own)continue;
        const dir=side?-1:1;
        for(const q of squads){
          if(q.side!==side||q.state!=='steady')continue;
          const members=q.mem.map(id=>this.ship(id)).filter(m=>this.live(m)&&m.arr&&m.ai&&!(m.ai.breakUntil>now)&&!(m.ai.order&&['RESCUE','RAM','PANIC','BERSERK','RECOVER','TOW'].includes(m.ai.order.kind)&&now<m.ai.order.until));
          if(!members.length)continue;
          if(p.state==='forming'&&(q.role==='left'||q.role==='right')){
            const lat=q.role==='left'?-1:1,point=[foe.x-dir*500,foe.y,foe.z+lat*3400];
            for(const m of members)if(length(m.x-point[0],m.z-point[2])>900)this.setOrder(m,'MANEUVER',{point,until,spread:220});
          }else if(p.kind==='AMBUSH'&&p.state==='forming'&&q.role==='ambush'&&p.cover){
            const point=[p.cover.x,p.cover.y,p.cover.z];
            for(const m of members){this.setOrder(m,'HIDE',{point,until,spread:160});m.lurk=true;}
          }else if((p.kind==='HOLD'||p.kind==='SIEGE')&&p.state!=='done'&&q.role==='screen'){
            let best=null,bd=Infinity;for(const c of this.ships())if(c.side===side&&this.live(c)&&(c.hulls||c.slen>=180)){const d=q.cx!=null?length(c.x-q.cx,c.z-q.cz):0;if(d<bd){bd=d;best=c;}}
            if(best)for(const m of members)this.setOrder(m,'GUARD',{anchor:best.id,until});
          }else if(q.role==='main'&&this.posture(side,p,now,foe,own)){
            // The rest of the fleet keeps the plan's posture: on the line, in reserve, or waiting for the wings.
            const point=this.posture(side,p,now,foe,own);
            for(const m of members)this.setOrder(m,'HOLD',{point,until,spread:420});
          }else if(p.kind==='DECAPITATE'&&p.state!=='done'&&q.role==='strike'){
            const flag=this.ship(this.sides[1-side].flag);
            if(this.live(flag))for(const m of members){const seen=m.ai.contacts.has(flag.id)&&distance(m,flag)<1600;if(!seen)this.setOrder(m,'STRIKE',{target:flag.id,until});}
          }
        }
        // Capitals: hold the line, or hold the station.
        const holdLine=(p.kind==='HOLD')&&p.state!=='done';
        if(holdLine&&!p.line)p.line=[own.x+dir*900,own.y,own.z];
        for(const c of this.ships()){
          if(c.side!==side||!this.live(c)||!c.arr||!c.ai||!(c.hulls||c.slen>=180)||(c.ai.order&&['RAM','DRIFT'].includes(c.ai.order.kind))||this.doctrine(c).hunts)continue;
          if(o&&o.kind==='STATION'&&!o.done&&(c.hulls||0)<50)this.setOrder(c,'HOLD',{point:o.point,until,spread:400});
          else if(holdLine&&(c.hulls||0)<50)this.setOrder(c,'HOLD',{point:p.line,until,spread:500});
        }
      }
      // The convoy waits for its escorts to reach the fight, then runs.
      if(o&&o.kind==='CONVOY'&&!o.done&&now-(this.start??now)>=12)for(const id of o.ids){
        const c=this.ship(id);if(!this.live(c)||!c.arr)continue;
        if(length(c.x-o.point[0],c.z-o.point[2])<700){c.convoyHome=true;if(this.host&&this.host.leave)this.host.leave(c,now,'jump');}
        else this.setOrder(c,'CONVOY',{point:o.point,until});
      }
    }
    // Where the main body waits under this plan, or null to fight freely.
    posture(side,p,now,foe,own){
      if(!p||p.state==='done')return null;
      const dir=side?-1:1,home=p.home||(p.home={x:own.x,y:own.y,z:own.z});
      const d=length(foe.x-home.x,foe.z-home.z),age=now-p.since;
      if(p.released)return null;
      const release=why=>{p.released=why;return null;};
      // Ships are dying: whatever the plan said about waiting, the fight is here.
      if(this.sides[side].lossAt!=null&&now-this.sides[side].lossAt<20)return release('under fire');
      if(p.kind==='HOLD'){if(d<3200)return release('contact');if(age>55)return release('waited');return [home.x+dir*1400,home.y,home.z];}
      if(p.kind==='SIEGE'){if(d<3600)return release('contact');if(age>60)return release('waited');return [home.x+dir*500,home.y,home.z];}
      if(p.kind==='PINCER'){if(p.state!=='forming'||d<2400)return release('closed');return [home.x+dir*1800,home.y,home.z];}
      if(p.kind==='RAID'){if(p.cycles>=1||d<2600||age>70)return release('raided');return [home.x+dir*900,home.y,home.z];}
      return null;
    }
    applyPlan(side,now,squads){for(const q of squads)if(q.side===side){q.aiUntil=0;for(const id of q.mem){const s=this.ship(id);if(s&&s.ai&&s.ai.order&&['HIDE','MANEUVER','HOLD'].includes(s.ai.order.kind))s.ai.order=null;}}}
    raidStep(side,now,mine,foe){
      const p=this.sides[side].plan;if(!this.host||!this.host.rejump)return;
      for(const q of mine){
        if(q.role!=='raid'||q.cx==null)continue;
        const engaged=length(q.cx-foe.x,q.cz-foe.z)<2200;
        if(engaged&&q.raidT==null)q.raidT=now;
        if(q.raidT!=null&&now-q.raidT>16&&(q.raids||0)<2){
          q.raids=(q.raids||0)+1;q.raidT=null;p.cycles=Math.max(p.cycles,q.raids);
          const dir=side?-1:1,z=(this.rng()-.5)*4000;
          let n=0;for(const id of q.mem){const s=this.ship(id);if(this.live(s)&&this.host.rejump(s,now,[foe.x+dir*3200,foe.y+(this.rng()-.5)*300,foe.z+z],9+this.rng()*3))n++;}
          if(n)this.emit({type:'raid',side,squad:q.id,name:q.name,n,x:q.cx,y:q.cy,z:q.cz});
        }
      }
    }
    capitals(side,initial){let n=0;for(const s of this.ships())if(s.side===side&&(s.hulls||s.slen>=180)&&(initial||this.live(s)))n++;return n;}
    shares(){let a=0,b=0;for(const s of this.ships())if(this.live(s)&&s.arr){const v=Math.pow(Math.max(1,s.hpMax||1),.8)*clamp(s.hp/Math.max(1,s.hpMax));if(s.side)b+=v;else a+=v;}const t=a+b||1;return [a/t,b/t];}
    // ---- objectives ----
    objectiveStep(now){
      const o=this.objective;if(!o||o.done)return;
      if(o.kind==='CONVOY'){
        if(o.saved>=o.need){o.done=true;this.declare(o.side,'convoy',now);}
        else if(o.lost>o.ids.length-o.need){o.done=true;this.declare(1-o.side,'convoy',now);}
      }else if(o.kind==='STATION'){
        let a=0,b=0;const R=2600;
        for(const s of this.ships())if(this.live(s)&&s.arr&&length(s.x-o.point[0],s.y-o.point[1],s.z-o.point[2])<R){const v=Math.pow(Math.max(1,s.hpMax||1),.6);if(s.side)b+=v;else a+=v;}
        const was=o.holder;
        if(a>b*1.5&&a>0){o.progress[0]=Math.min(90,o.progress[0]+1);o.progress[1]=Math.max(0,o.progress[1]-.5);o.holder=0;}
        else if(b>a*1.5&&b>0){o.progress[1]=Math.min(90,o.progress[1]+1);o.progress[0]=Math.max(0,o.progress[0]-.5);o.holder=1;}
        else o.holder=-1;
        if(o.holder!==was&&o.holder>=0)this.emit({type:'stationTaken',side:o.holder,x:o.point[0],y:o.point[1],z:o.point[2],progress:o.progress[o.holder]});
        for(const side of [0,1])if(o.progress[side]>=90){o.done=true;this.declare(side,'station',now);}
      }
    }
    // Share of the momentum bar: strength, blended with the objective's state.
    objectiveShare(share){
      const o=this.objective;if(!o)return share;
      // A quarter of the bar is the objective; the rest stays the fleets' strength.
      if(o.kind==='FLAGSHIP'){const f=[0,1].map(s=>{const t=this.ship(this.sides[s].flag);return t&&this.live(t)?clamp(t.hp/Math.max(1,t.hpMax)):0;});return share*.75+.25*clamp(.5+(f[0]-f[1])*.5);}
      if(o.kind==='CONVOY'){const n=o.ids.length||1,good=(o.saved-o.lost)/n;const k=clamp(.5+good*.5);return share*.75+.25*(o.side?1-k:k);}
      if(o.kind==='STATION'){const d=(o.progress[0]-o.progress[1])/90;return share*.75+.25*clamp(.5+d*.5);}
      return share;
    }
    aceDuels(now,ships){
      if(Math.round(now)%2)return;
      const aces=ships.filter(s=>this.live(s)&&(s.ace||s.hero)&&s.arr);
      for(const a of aces)for(const b of aces){
        if(a.side!==0||b.side!==1)continue;
        if(distance(a,b)>1100||!(a.ai&&(a.ai.target===b.id||(b.ai&&b.ai.target===a.id))))continue;
        const key=a.id+':'+b.id;this.duels=this.duels||new Map();
        if(now-(this.duels.get(key)??-99)<30)continue;this.duels.set(key,now);
        this.emit({type:'aceDuel',side:a.side,ship:a.id,partner:b.id,x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2,size:Math.max(a.slen,b.slen)});
      }
    }
    planNames(){return this.sides.map(s=>s.plan&&s.plan.kind);}
    objectiveName(){return this.objective&&this.objective.kind;}
  }

  /* ------------------------------- handling -------------------------------
     How each fleet flies, beside how it thinks. These are game rules, not claims
     about canon; the last column is the reason BATTLE-AI-NEW.md prints. Every
     pilot draws their own values around the row from a stream seeded by their
     own hull (hand()), which nothing else reads, so a squadron shares a style
     but never a stick.
       shape      formation: finger-four, wedge, line abreast, swarm, cluster
       geometry   preferred attack geometry: slash, joust, orbit, dive, stalk, swarm
       smooth     stick smoothing, 0 snappy to 1 silky (the yaw response time)
       bank       bank eagerness: how far a pilot rolls into a turn
       overshoot  tolerance for swinging past a heading (0: damping 1.05, 1: 0.70)
       rhythmHz   throttle rhythm frequency (Hz); rhythm is its depth (share of speed)
       tight      formation tightness, 0 loose to 1 close
       breakaway  willingness to leave the formation for a friend or a kill
       reform     how soon and how hard a squadron re-forms after a fight
       react      reaction delay (s) before a new heading demand reaches the stick
       weave      stick weave depth, 0 to 1, at weaveHz
       commit     how long a pilot sticks with a decision (hysteresis margin and dwell) */
  const HD=(shape,geometry,smooth,bank,overshoot,rhythmHz,rhythm,tight,breakaway,reform,react,weave,weaveHz,commit,why)=>
    ({shape,geometry,smooth,bank,overshoot,rhythmHz,rhythm,tight,breakaway,reform,react,weave,weaveHz,commit,why});
  const HANDLING=[
    HD('finger-four','slash', .60,.75,.30,.16,.055,.78,.30,.70,.34,.30,.50,.55,'A drilled yard navy flies the textbook: clean banked turns, fingers held, passes by the manual.'),
    HD('swarm','swarm',       .22,1.15,.80,.42,.10,.30,.75,.40,.20,.90,.95,.25,'A social swarm: quick hands, big swings past the mark, surging together like a current.'),
    HD('line abreast','orbit',.85,.45,.08,.10,.045,.95,.08,.95,.40,.10,.30,.80,'A coordinated lattice: exact rails, almost no weave, the line snaps back at once.'),
    HD('cluster','stalk',     .50,.80,.60,.30,.08,.50,.50,.50,.48,.60,.70,.40,'Salvagers: loose and wary, always ready to slide off the line and come back.'),
    HD('wedge','orbit',       .90,.60,.25,.07,.07,.75,.30,.60,.60,.35,.25,.60,'A patient choir: long slow swells on the throttle, silky turns.'),
    HD('wedge','joust',       .42,.78,.14,.20,.05,.90,.10,.90,.24,.14,.60,.70,'Drilled aggression: crisp and precise, tight wedges, straight in and re-formed fast.'),
    HD('finger-four','slash', .50,1.00,.62,.26,.08,.52,.78,.55,.30,.65,.80,.35,'Creative and loose: deep banks, wide fingers, quick to break off and help a friend.'),
    HD('wedge','slash',       .88,.55,.05,.09,.05,.85,.20,.80,.30,.08,.35,.75,'Composed and exact: no wasted motion, long clean passes, nothing swings past the mark.'),
    HD('swarm','dive',        .20,.30,.72,.45,.12,.35,.60,.50,.16,.80,1.10,.40,'Chaos with a purpose: sudden surges and swoops, little bank, predatory dives.'),
    HD('finger-four','slash', .60,.72,.30,.18,.055,.80,.35,.75,.34,.30,.55,.55,'EarthForce flies by the book and holds its fingers.'),
    HD('line abreast','orbit',.75,.60,.20,.12,.055,.75,.45,.70,.40,.25,.40,.55,'Measured and aware: wide orbits, a steady rhythm, peels off to cover a friend.'),
    HD('wedge','joust',       .35,.90,.50,.32,.09,.60,.50,.45,.20,.30,.65,.95,'They commit and do not look back: long dwell on a choice, hard banks, surging burns.'),
    HD('cluster','joust',    1.00,.00,.00,.05,.045,.95,.00,1.00,.70,.00,.20,.90,'Cold, unhurried certainty: no bank, no weave, no overshoot, a slow even pulse.'),
    HD('line abreast','orbit',.85,.50,.20,.08,.06,.80,.30,.70,.55,.20,.30,.60,'A protective convoy: slow, careful, wide turns.'),
    HD('finger-four','slash', .50,.80,.25,.22,.055,.80,.35,.80,.26,.30,.60,.60,'Marines: skilled and disciplined, sharp fingers, quick re-forms.'),
    HD('cluster','dive',      .80,.40,.30,.10,.07,.60,.30,.60,.45,.20,.30,.65,'Inventive and composed: slow deliberate dives, little bank.'),
    HD('swarm','stalk',       .50,.90,.40,.24,.07,.35,.80,.35,.20,.50,.70,.70,'Hunters: independent loose packs that stalk from behind and commit.'),
    HD('cluster','orbit',    1.00,.20,.00,.04,.04,.50,.50,.50,.50,.00,.20,.90,'Ancient and absolute: they move as if nothing can touch them.'),
    HD('wedge','stalk',       .65,.60,.28,.14,.06,.70,.30,.70,.30,.25,.45,.60,'Patient ambushers: smooth, controlled, quick to slip away.'),
    HD('line abreast','joust',.50,.70,.30,.20,.055,.85,.15,.80,.25,.20,.55,.80,'Relentless: straight lines in, no hesitation.'),
    HD('wedge','joust',       .40,.60,.20,.18,.05,.85,.20,.85,.28,.15,.50,.80,'Fearless and drilled: tight wedges, straight at the enemy.'),
    HD('swarm','swarm',       .30,.40,.90,.40,.12,.28,.55,.60,.25,1.00,.90,.30,'The swarm: organic weaving and wild overshoots; synapse pulls it back together.'),
    HD('finger-four','slash', .40,1.20,.45,.30,.08,.60,.50,.60,.22,.50,.85,.40,'A startup fleet: fast hands, eager banks, improvised lines.')
  ];
  // Attack geometry: orbit radius, extend after a pass, climb before a run.
  const GEOMETRY={slash:{r:1.25,extend:1.45,climb:0},joust:{r:.8,extend:1,climb:0},orbit:{r:1.4,extend:.8,climb:0},
    dive:{r:1,extend:1.25,climb:.6},stalk:{r:.9,extend:1.1,climb:0},swarm:{r:1.05,extend:1,climb:.2}};
  // Slot offsets in units of spacing: x forward, y up, z right. i is the wingman's rank (0 first).
  function slotOffset(shape,i,n){
    if(shape==='column'){const sd=i&1?1:-1;return [-(i+1),.08*sd,.14*sd];}
    if(shape==='wedge'){const r=(i>>1)+1,sd=i&1?1:-1;return [-r*.9,.14*r*sd,sd*r*.95];}
    if(shape==='line abreast'){const r=(i>>1)+1,sd=i&1?1:-1;return [-.16*r,.12*sd*r,sd*r*1.25];}
    if(shape==='swarm'){const a=i*2.399+.7,rr=.9+.5*Math.sqrt(i+1);return [-.45-rr*.75*Math.abs(Math.cos(a)),Math.sin(a*1.7)*.85,Math.sin(a)*rr*1.1];}
    if(shape==='cluster'){const N=n+1,k=i+1,z=1-2*(k+.5)/N,rad=Math.sqrt(Math.max(0,1-z*z)),phi=k*2.399;return [-(.7+Math.cos(phi)*rad*.8),z*.9,Math.sin(phi)*rad*1.15];}
    // finger-four: elements of four, the second element in trail on the other side
    const e=Math.floor((i+1)/4),j=(i+1)%4,base=[-e*2.6,e?.35*(e&1?1:-1):0,e?(e&1?1.7:-1.7):0];
    const off=j===0?[0,0,0]:j===1?[-.8,.12,-1.0]:j===2?[-.8,-.12,1.0]:[-1.6,.22,2.0];
    return [base[0]+off[0],base[1]+off[1],base[2]+off[2]];
  }
  /* Spacing by hull: fighters a few lengths apart, frigates 1.7 lengths, cruisers 1.4 lengths (L is the
     squadron's median hull). Then held to a squadron that reads as one: its radius (RMS distance of the
     hulls from their centre, for this shape with n wingmen) at least 1.9 to 2.6 mean hull lengths (Lm), so
     hulls never stack, and at most 560 m, so a column of big frigates is one squadron, not a kilometre-long
     string. When the two bounds cross (hulls over about 300 m), the hulls win. */
  function formationSpacing(shape,n,L,Lm,capital,tight){
    const d=capital?L*1.4:shape==='column'?Math.max(60,L*1.7)*(1.3-.5*tight):Math.max(42,L*3)*(1.55-.75*tight);
    if(!n)return d;
    const P=[[0,0,0]];for(let i=0;i<n;i++)P.push(slotOffset(shape,i,n));
    const c=[0,1,2].map(j=>P.reduce((a,p)=>a+p[j],0)/P.length);
    const r1=Math.sqrt(P.reduce((a,p)=>a+(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2,0)/P.length)||1;
    // Aim for the middle of that range, not its edge: a squadron loitering at a crawl draws in on itself.
    const lo=Math.max(1.9*Lm,Math.min(2.6*Lm,.75*Lm+350)),hi=Math.max(560,lo);
    return Math.max(lo/r1,Math.min(d,hi/r1));
  }
  // Orders a pilot carries out alone: they free that pilot from the formation, not the squadron.
  const SOLO_ORDERS=new Set(['ROUT','PANIC','BERSERK','RAM','TOW','RECOVER','DRIFT','CONVOY']);
  // Orders a squadron carries out together: the leader flies the order, the wingmen hold their slots.
  const FORMATION_ORDERS=new Set(['HOLD','HIDE','MANEUVER','GUARD','RESCUE','STRIKE']);
  Object.assign(FleetMinds.prototype,{
    // A pilot's own hands: drawn once from a stream seeded by the hull, never shared.
    hand(s){
      const a=this.seedShip(s);if(a.hand)return a.hand;
      const row=HANDLING[s.race]||HANDLING[0];
      const r=random(((s.seed||1)^0x6a09e667^Math.imul((s.race|0)+3,0x9E3779B1))>>>0);
      const u=(m,d,lo=0,hi=1)=>clamp(m+(r()+r()-1)*d,lo,hi),k=(m,lo,hi)=>m*(lo+(hi-lo)*r());
      a.hand={row,shape:row.shape,geometry:row.geometry,smooth:u(row.smooth,.12),bank:u(row.bank,.18,0,1.4),overshoot:u(row.overshoot,.15),
        rhythmHz:k(row.rhythmHz,.7,1.35),rhythm:k(row.rhythm,.75,1.3),tight:u(row.tight,.10),breakaway:u(row.breakaway,.20),reform:u(row.reform,.15),
        react:Math.min(.9,k(row.react,.6,1.4)),weave:u(row.weave,.15),weaveHz:k(row.weaveHz,.7,1.4),commit:u(row.commit,.12),
        ph:[r()*6.283,r()*6.283,r()*6.283,r()*6.283,r()*6.283],slot:[r()*2-1,r()*2-1,r()*2-1],breath:.08+r()*.12};
      return a.hand;
    },
    handling(race){return HANDLING[race]||HANDLING[0];},
    // Physics limits by hull, whoever flies: a frigate cannot pivot inside its own length.
    turnLimit(s){
      const w=s.turn||1,L=s.slen||20;
      if(s.gunboat)return Math.min(w,Math.max(.1,(s.spd||20)/(1.4*L)));
      if(s.midcraft)return Math.min(w,Math.max(.25,(s.spd||20)/(.9*L)));
      return w;
    },
    // How long a challenger must keep beating the current goal before it takes over.
    dwell(s,h){const L=s.slen||20;return (.5+Math.min(4.5,L/120))*(.6+.8*h.commit)*(s.hulls?1.4:1);},
    logGoal(s,a,from,to,why,now){
      this.stats.goalChanges=(this.stats.goalChanges||0)+1;
      const log=a.goalLog||(a.goalLog=[]);log.push({t:+now.toFixed(2),from,to,why});if(log.length>16)log.shift();
    },
    /* ----- living formations ----- */
    formations(squads,now){
      const frame=Math.round(now*30);
      for(const sq of squads){
        if((frame+sq.id)%15!==0)continue;
        const members=[];for(const id of sq.mem){const m=this.byId.get(id);if(m&&alive(m)&&m.arr)members.push(m);}
        const fm=sq.fm||(sq.fm={phase:'FORM',since:now,calm:now,lead:-1,hdg:null});
        if(!members.length){fm.lead=-1;continue;}
        // The leader is the first member not busy with an order of their own.
        const busy=m=>m.ai&&m.ai.order&&now<m.ai.order.until&&SOLO_ORDERS.has(m.ai.order.kind);
        // A mixed squadron (a crown and its fighters) is led from its largest kind: eight fighters are
        // not slotted behind a hull that crawls at a tenth of their pace.
        const kind=m=>capital(m)?2:m.gunboat?1:0,count=[0,0,0];for(const m of members)count[kind(m)]++;
        let major=kind(members[0]);for(let k=0;k<3;k++)if(count[k]>count[major])major=k;
        const cur=members.find(m=>m.id===fm.lead);
        if(!cur||busy(cur)||kind(cur)!==major){const next=members.find(m=>!busy(m)&&kind(m)===major)||members.find(m=>!busy(m))||members[0];if(next.id!==fm.lead){fm.lead=next.id;fm.trail=null;if(fm.phase==='CRUISE')fm.phase='FORM',fm.since=now;}}
        const lead=this.byId.get(fm.lead),h=this.hand(lead);
        // Shape and spacing: frigates fly a line-ahead column (they commit to a line and hold it);
        // everyone else flies their fleet's shape. Ranks follow the squadron's own order.
        // Spacing comes from the typical hull, not the biggest: a hero leading fighters must not spread them a kilometre apart.
        // Who holds a slot: members whose pace is within reach of the leader's. The rest fly free.
        const pace=m=>(m.spd||20)/Math.max(1,lead.spd||20),ranked=members.filter(m=>m===lead||pace(m)>=.55&&pace(m)<=2.5);
        let slow=Infinity;for(const m of ranked)slow=Math.min(slow,m.spd||20);
        const lens=ranked.map(m=>m.slen||20).sort((x,y)=>x-y),L=lens[lens.length>>1];
        // Frigates and cruisers fly a line-ahead column (a battle line); everyone else their fleet's shape.
        fm.shape=lead.gunboat||capital(lead)?'column':h.shape;
        fm.rank=new Map();let n=0;for(const m of ranked)if(m.id!==fm.lead)fm.rank.set(m.id,n++);fm.n=n;
        fm.d=formationSpacing(fm.shape,n,L,ranked.reduce((a,m)=>a+(m.slen||20),0)/ranked.length,capital(lead),h.tight);
        let lat=0,back=0;for(let i=0;i<n;i++){const o=slotOffset(fm.shape,i,n);lat=Math.max(lat,Math.abs(o[2])*fm.d);back=Math.max(back,-o[0]*fm.d);}
        fm.back=back;
        // How fast the formation may turn: the outside lane never needs more than 35% more speed.
        fm.turnCap=clamp(.35*slow*.9/Math.max(40,lat),.05,.35);
        // Only a fight at close quarters breaks a formation (or a rout): about half the squadron within
        // fighting range of its targets (the leader counts one and a half). Frigates fight as a line and do not break at all. A formation under long-range
        // fire keeps its shape; the pilot who is hit evades on their own and comes back.
        const routing=sq.state==='routing';let engaged=false;
        if(!lead.gunboat){
          const r=1000*GEOMETRY[h.geometry].r;let k=0;
          for(const m of members){const a=m.ai;if(!a)continue;const c=a.contacts.get(a.target);if(c&&now-c.seen<2&&surface(m,c)<r)k+=m===lead?1.5:1;}
          engaged=k>=Math.max(1,members.length/2);
        }
        if(routing||engaged){if(fm.phase!=='BREAK'){fm.phase='BREAK';fm.since=now;}fm.calm=now;continue;}
        if(fm.phase==='BREAK'&&now-fm.calm>1.5+4*(1-h.reform)){fm.phase='REFORM';fm.since=now;}
        if(fm.phase==='FORM'||fm.phase==='REFORM'){
          let near=0;for(const m of members){if(m.id===fm.lead)continue;const p=this.slotPoint(m,sq,now);if(p&&length(p[0]-m.x,p[1]-m.y,p[2]-m.z)<p[3]*1.2)near++;}
          if(n&&(near>=Math.ceil(n*.75)||now-fm.since>30)){fm.phase='CRUISE';fm.since=now;}
        }
      }
    },
    formed(s,now){
      const sq=this.squads[s.squad],fm=sq&&sq.fm;
      return !!(fm&&fm.phase!=='BREAK'&&fm.d&&fm.lead>=0&&fm.lead!==s.id&&fm.rank&&fm.rank.has(s.id)&&this.byId.get(fm.lead)&&alive(this.byId.get(fm.lead)));
    },
    // The leader's recent track, kept as breadcrumbs: slots are laid along it, not on a rigid plank.
    trail(fm,lead,now){
      if(fm.trailAt===now)return fm.trail;fm.trailAt=now;
      let T=fm.trail;const last=T&&T[T.length-1];
      if(!T||fm.trailLead!==lead.id){fm.trail=T=[[lead.x,lead.y,lead.z,0]];fm.trailLead=lead.id;return T;}
      const dd=length(lead.x-last[0],lead.y-last[1],lead.z-last[2]);
      if(dd>=4)T.push([lead.x,lead.y,lead.z,last[3]+dd]);
      const top=T[T.length-1][3],keep=(fm.back||0)+240;
      while(T.length>2&&top-T[1][3]>keep)T.shift();
      return T;
    },
    /* A wingman's slot: [x, y, z, spacing, tangent x, tangent z]. It sits on the leader's own track,
       set back by the slot's depth, and out to the side of the track's direction there, so in a turn
       the squadron flows round the curve like lanes on a road. With no track yet (just formed), it
       hangs off the leader's heading. */
    slotPoint(s,sq,now){
      const fm=sq.fm,lead=this.byId.get(fm.lead);if(!lead||!alive(lead)||!fm.d||!fm.rank||!fm.rank.has(s.id))return null;
      const h=this.hand(s),lh=this.hand(lead),d=fm.d*(1.08-.16*h.tight);
      if(fm.hdg==null)fm.hdg=lead.yaw;
      if(fm.hdgAt!==now){const dt=clamp(now-(fm.hdgAt??now),0,.1),cap=fm.turnCap||.35,turn=clamp(angle(lead.yaw-fm.hdg),-cap*dt,cap*dt);fm.hdg+=turn;fm.hdgAt=now;}
      const o=slotOffset(fm.shape,fm.rank.get(s.id),fm.n),loose=1.25-lh.tight;
      // A living slot: each pilot's own offset, breathing slowly.
      const br=Math.sin(now*(.21+.1*h.breath)+h.ph[3])*h.breath*loose;
      const back=Math.max(0,(-o[0]+h.slot[0]*.18*loose+br)*d),up=(o[1]+h.slot[1]*.16)*d,side=(o[2]+h.slot[2]*.22*loose-br*.5)*d;
      const T=this.trail(fm,lead,now),last=T[T.length-1];
      const head=length(lead.x-last[0],lead.y-last[1],lead.z-last[2]),want=last[3]+head-back;
      let px,py,pz,tx,tz;
      if(want>=T[0][3]&&T.length>1){
        let j=T.length-1;
        if(want>=last[3]){const u=head>1e-6?(want-last[3])/head:0;px=last[0]+(lead.x-last[0])*u;py=last[1]+(lead.y-last[1])*u;pz=last[2]+(lead.z-last[2])*u;tx=lead.x-last[0];tz=lead.z-last[2];}
        else{while(j>0&&T[j-1][3]>want)j--;const A=T[Math.max(0,j-1)],B=T[j],span=Math.max(1e-6,B[3]-A[3]),u=clamp((want-A[3])/span);px=A[0]+(B[0]-A[0])*u;py=A[1]+(B[1]-A[1])*u;pz=A[2]+(B[2]-A[2])*u;tx=B[0]-A[0];tz=B[2]-A[2];}
        const tn=Math.hypot(tx,tz);if(tn<1e-6){tx=Math.cos(fm.hdg);tz=Math.sin(fm.hdg);}else{tx/=tn;tz/=tn;}
        /* A slot far back in time (a slow squadron, a long column) comes off the leader's old track
           toward the straight line from the leader: the tail follows where the leader is going, not
           the heading it had two minutes ago. Up to 6 s behind, pure track; by 16 s, pure line. */
        const w=clamp((back/Math.max(2,Math.abs(lead.v||0))-6)/10);
        if(w>0){let cx=lead.x-px,cz=lead.z-pz;const cn=Math.hypot(cx,cz);
          if(cn>1){cx/=cn;cz/=cn;px+=(lead.x-cx*back-px)*w;pz+=(lead.z-cz*back-pz)*w;py+=(lead.y-py)*w*.5;tx+=(cx-tx)*w;tz+=(cz-tz)*w;const t2=Math.hypot(tx,tz)||1;tx/=t2;tz/=t2;}}
      }else{tx=Math.cos(fm.hdg);tz=Math.sin(fm.hdg);px=lead.x-tx*back;py=lead.y;pz=lead.z-tz*back;}
      return [px-tz*side,py+up,pz+tx*side,d,tx,tz];
    },
    /* ----- the helm: pilot filter and physics limits ----- */
    // Reaction delay: the stick sees the demanded point late, by the pilot's own delay. Only ever
    // applied to an intent (a point in the world), never to an aim computed from the ship's own position.
    helmDelay(s,goal,urgent){const d=this.delayed(s,'helmBuf',goal);return urgent?goal:d;},
    delayed(s,key,p){
      const h=this.hand(s);let b=s[key];
      if(!b){b=s[key]=new Float64Array(97);for(let i=0;i<32;i++){b[i*3]=p[0];b[i*3+1]=p[1];b[i*3+2]=p[2];}b[96]=0;}
      const i=b[96]=(b[96]+1)&31;b[i*3]=p[0];b[i*3+1]=p[1];b[i*3+2]=p[2];
      const lag=Math.min(31,Math.round(h.react*30)),j=((i-lag)&31)*3;
      return [b[j],b[j+1],b[j+2]];
    },
    /* Stations never shuttle. Near a point it must hold, a pilot loiters: a
       fighter orbits it, a frigate flies a racetrack whose legs are many turning
       circles long and whose ends are wide banked arcs. The direction is chosen
       from how the ship is already moving, so arriving is never a reversal. */
    helmStation(s,goal,o){
      const h=this.hand(s),L=s.slen||20,w=this.turnLimit(s);
      // Sized from the hull and the loiter pace, never the current speed: a ship braking out of a
      // jump must not shrink its own circle and fall out of it.
      const v=(s.spd||20)*.8,rt=v/Math.max(.05,w);
      let ax=goal[0],ay=goal[1],az=goal[2],R;
      // A loiter is a lazy circle, not a pirouette: no faster than half a radian a second, and a
      // formation leader's slow enough (0.18 rad/s) for the squadron to hold its slots round it.
      const lead=this.leadsFormation(s),wmax=lead?Math.min(.18,lead.turnCap*.8):.5;
      if(o.orbit){ax=o.orbit.x;ay=o.orbit.y;az=o.orbit.z;R=Math.max(o.orbit.r,rt*(s.gunboat?1.6:1.3),v*.8/wmax);}
      else R=s.gunboat?Math.max(rt*1.6,L*1.1):Math.max(rt*2,v*.8/wmax,40);
      if(lead)R=Math.max(R,lead.span);
      const dx=s.x-ax,dz=s.z-az,d=Math.hypot(dx,dz),st=s.helmLoiter;
      const enter=o.orbit?R*1.5:Math.max(R*2.2,rt*3),leave=enter*1.7;
      if(!st&&d>enter)return null;
      if(st&&(d>leave||Math.hypot(st.x-ax,st.z-az)>R*2.5)){s.helmLoiter=null;if(d>enter)return null;}
      let lo=s.helmLoiter;
      const vx=Math.cos(s.yaw),vz=Math.sin(s.yaw);
      if(!lo)lo=s.helmLoiter={dir:(dx*vz-dz*vx)>=0?1:-1,x:ax,z:az,u:null};
      lo.x=ax;lo.z=az;
      if(!s.gunboat||o.circle){
        const th=Math.atan2(dz,dx),lead=clamp(rt*1.5/Math.max(1,R),.35,1.1)*lo.dir;
        return {p:[ax+Math.cos(th+lead)*R,ay,az+Math.sin(th+lead)*R],R,loiter:true};
      }
      // Racetrack: long axis across the enemy's line (broadside to them), legs of several turning circles.
      let ux=o.axis?-o.axis[1]:Math.cos(s.yaw),uz=o.axis?o.axis[0]:Math.sin(s.yaw);const un=Math.hypot(ux,uz)||1;ux/=un;uz/=un;
      if(lo.u==null)lo.u=[ux,uz];else{const k=.02;lo.u=[lo.u[0]+(ux-lo.u[0])*k,lo.u[1]+(uz-lo.u[1])*k];const n2=Math.hypot(...lo.u)||1;lo.u=[lo.u[0]/n2,lo.u[1]/n2];}
      [ux,uz]=lo.u;
      const b=R,A=Math.max(rt*3,L*1.6,b*.9),P=4*A+2*Math.PI*b;
      // Local frame: x along the track's long axis, y across it.
      const lx=dx*ux+dz*uz,ly=-dx*uz+dz*ux;
      let t;
      if(Math.abs(lx)<=A)t=ly<0?lx+A:2*A+Math.PI*b+(A-lx);
      else if(lx>A)t=2*A+(Math.atan2(ly,lx-A)+Math.PI/2)*b;
      else{let ph=Math.atan2(ly,lx+A);if(ph<0)ph+=2*Math.PI;t=4*A+Math.PI*b+(ph-Math.PI/2)*b;}
      if(lo.dir0==null){ // run the track the way the ship already points
        const tp=this.trackPoint(t+1,A,b),tq=this.trackPoint(t,A,b),tx=(tp[0]-tq[0])*ux-(tp[1]-tq[1])*uz,tz=(tp[0]-tq[0])*uz+(tp[1]-tq[1])*ux;
        lo.dir0=tx*vx+tz*vz>=0?1:-1;
      }
      const look=Math.max(rt*1.4,L*.9,40),q=this.trackPoint(((t+lo.dir0*look)%P+P)%P,A,b);
      return {p:[ax+q[0]*ux-q[1]*uz,ay,az+q[0]*uz+q[1]*ux],R,loiter:true,track:true};
    },
    trackPoint(t,A,b){
      if(t<2*A)return [t-A,-b];t-=2*A;
      if(t<Math.PI*b){const ph=-Math.PI/2+t/b;return [A+Math.cos(ph)*b,Math.sin(ph)*b];}t-=Math.PI*b;
      if(t<2*A)return [A-t,b];t-=2*A;
      const ph=Math.PI/2+t/b;return [-A+Math.cos(ph)*b,Math.sin(ph)*b];
    },
    /* The stick: a heading error becomes a yaw rate through the pilot's own
       response time and damping, with the hull's angular acceleration and jerk
       limits, plus the pilot's weave. o.max is the rate the hull allows now. */
    helmTurn(s,err,dt,now,o){
      const h=this.hand(s),L=s.slen||20,w=this.turnLimit(s);
      /* Commitment: a pilot who has just swung through more than 100 degrees holds the new line for the
         rest of six seconds; they may correct by a few tens of degrees but never swing back within 75
         degrees of where they started. Swinging straight back is the donkey. Lining up a shot is exempt. */
      const hy=s.helmYaw||(s.helmYaw={u:s.yaw,last:s.yaw,buf:new Float64Array(25),t:new Float64Array(25).fill(-1e9),i:0,next:0});
      hy.u+=angle(s.yaw-hy.last);hy.last=s.yaw;
      if(now>=hy.next){hy.i=(hy.i+1)%25;hy.buf[hy.i]=hy.u;hy.t[hy.i]=now;hy.next=now+.25;}
      if(!o.lining){
        let swing=0,from=0;for(let j=0;j<25;j++)if(now-hy.t[j]<=6){const d=hy.u-hy.buf[j];if(Math.abs(d)>Math.abs(swing)){swing=d;from=hy.buf[j];}}
        if(swing>1.75)err=Math.max(err,from+1.3-hy.u);else if(swing<-1.75)err=Math.min(err,from-1.3-hy.u);
      }
      const tau=(.32+.5*h.smooth)*(1+Math.min(2.2,L/200))*(o.formed?1.1:1)*(o.lining?.75:1);
      const zeta=1.05-.35*h.overshoot,kp=1/(4*zeta*zeta*tau);
      let mx=Math.min(o.max,w*(o.boost||1));
      // A turning circle no tighter than the hull allows at any speed: a slow ship turns slowly
      // instead of pirouetting (0.8 of its length for light craft and heroes, 0.9 for slicer and
      // cutter craft, 1.4 for frigates). Fighters under 40 m are never held back by this.
      if(!o.capital&&L>=40)mx=Math.min(mx,Math.max(Math.abs(s.v||0),3)/((s.gunboat?1.4:s.midcraft?.9:.8)*L));
      // A formation leader turns the squadron as one wide arc.
      {const lf=this.leadsFormation(s);if(lf)mx=Math.min(mx,lf.turnCap);}
      if(L>=80){const vf=Math.abs(s.v||0)/Math.max(1,s.spdMax||s.spd||20);if(vf<.2)mx=Math.min(mx,Math.max(.02,.08*vf/.2));}
      let cmd=clamp(err*kp,-mx,mx);
      if(!o.clean){
        const k=h.weave*w*.06*(o.formed?.45:1)*(L>=80?.35:1);
        cmd+=k*(Math.sin(now*h.weaveHz*6.283+h.ph[0])+.4*Math.sin(now*h.weaveHz*14.4+h.ph[1]));
      }
      if(o.jink)cmd+=o.jink;
      const amax=Math.max(.02,w)/(tau*1.1),jmax=amax/(tau*1.4);
      const want=clamp((cmd-(s.yawV||0))/tau,-amax,amax);
      s.yawA=(s.yawA||0)+clamp(want-(s.yawA||0),-jmax*dt,jmax*dt);
      s.yawV=clamp((s.yawV||0)+s.yawA*dt,-Math.max(mx,Math.abs(cmd))*1.05,Math.max(mx,Math.abs(cmd))*1.05);
      s.yaw+=s.yawV*dt;
      return Math.min(1,Math.abs(s.yawV)/Math.max(.05,w));
    },
    // Banking into the turn: a critically damped roll toward the pilot's own bank for this rate.
    helmBank(s,dt,now,o){
      const h=this.hand(s),L=s.slen||20,w=this.turnLimit(s);
      const size=L>=80?.45:1;
      const target=clamp(-h.bank*.8*size*(s.yawV||0)/Math.max(.15,w)+(o.extra||0),-.95,.95);
      const wn=(L>=80?.55:1)/(.26+.4*h.smooth);
      s.rollV=(s.rollV||0)+(wn*wn*(target-(s.roll||0))-2*wn*(s.rollV||0))*dt;
      s.roll=(s.roll||0)+s.rollV*dt;
    },
    // Climb: vertical speed and pitch through a second-order hand, never a snap.
    helmClimb(s,wv,dt,o){
      // A ship does not climb much steeper than it flies (about 30 degrees), unless it must.
      if(!o.urgent){const lim=Math.max(3,Math.abs(s.v||0)*.6);wv=clamp(wv,-lim,lim);}
      const h=this.hand(s),L=s.slen||20,wn=(L>=80?.9:1.6)/(.4+.5*h.smooth)*(o.fast?1.6:1);
      s.vyA=(s.vyA||0)+(wn*wn*(wv-(s.vy||0))-2*wn*(s.vyA||0))*dt;
      s.vy=(s.vy||0)+s.vyA*dt;
      const pt=Math.atan2(s.vy,Math.max(18,Math.abs(s.v||0))),pn=wn*1.2;
      s.pitchV=(s.pitchV||0)+(pn*pn*(pt-(s.pitch||0))-2*pn*(s.pitchV||0))*dt;
      s.pitch=(s.pitch||0)+s.pitchV*dt;
    },
    // The throttle hand: each pilot's own rhythm, from the fleet's handling.
    rhythm(s,now){
      // The fleet's slow swell, plus a quicker touch of the hand (a 3-5 s beat of at least 8%), so no
      // pilot sits on one number: a live hand on a throttle is never perfectly still.
      const h=this.hand(s),f=h.rhythmHz*6.283,g=6.283/(3+2*h.breath/.2);
      return 1-h.rhythm*(.5+.5*Math.sin(now*f+h.ph[2]))-Math.max(.08,h.rhythm*.6)*(.5+.5*Math.sin(now*g+h.ph[4]));
    },
    // Engines: spool by size, braking a little quicker, and a burn that builds rather than snaps.
    helmSpeed(s,want,dt,k=1){
      const L=s.slen||20,dash=s.spdMax||(s.spd||20)*1.3,spool=L<60?1.5:L<180?4:Math.min(30,8+L/200);
      const acc=dash/spool*k,dec=acc*1.5,v=s.v||0;
      const wantA=clamp((want-v)*3,-dec,acc),jerk=(acc+dec)/Math.max(.2,spool*.3);
      s.vA=clamp((s.vA||0)+clamp(wantA-(s.vA||0),-jerk*dt,jerk*dt),-dec,acc);
      const nv=v+s.vA*dt;
      // Never burn through the demand: arriving at a speed ends the burn.
      if((s.vA>0&&nv>want&&v<=want)||(s.vA<0&&nv<want&&v>=want)){s.vA*=.5;return want;}
      return Math.max(0,nv);
    },
    // The formation this ship leads, if it is formed: its span for a loiter the wingmen can follow.
    leadsFormation(s){
      const sq=this.squads[s.squad],fm=sq&&sq.fm;
      if(!fm||fm.phase==='BREAK'||fm.lead!==s.id)return null;
      let n=0,L=0;for(const id of sq.mem){const m=this.byId.get(id);if(m&&alive(m)&&m.arr){n++;L=Math.max(L,m.slen||20);}}
      // The circle must be big enough that the squadron's depth wraps no more than 1.2 rad of it.
      return n>1?{n,span:Math.max(Math.max(42,L*3)*(1+.5*n),(fm.back||0)/1.2),turnCap:fm.turnCap||.35,lat:(fm.turnCap?.35*20/fm.turnCap:0)}:null;
    },
    // A formation leader flies slow enough for the slowest wingman to hold station.
    leadCap(s,now){
      const sq=this.squads[s.squad],fm=sq&&sq.fm;
      if(!fm||fm.phase==='BREAK'||fm.lead!==s.id)return Infinity;
      let slow=Infinity;for(const id of (fm.rank?fm.rank.keys():[])){const m=this.byId.get(id);if(m&&alive(m)&&m.arr)slow=Math.min(slow,m.spd||20);}
      return slow===Infinity?Infinity:slow*(fm.phase==='CRUISE'?.9:.55);
    },
    // How long a fixed-gun pilot extends past the target after a pass, by attack geometry.
    extendK(s){return (GEOMETRY[this.hand(s).geometry]||GEOMETRY.slash).extend;},
    // Avoidance blends in and out over time instead of switching each step.
    avoidBlend(s,active,brake,dt){
      // In over 0.35 s; out slowly (4 s), so a ship that climbed over traffic eases back, never hops.
      const w=s.avW||0,target=active?1:0,rate=active?1/.35:1/4;
      s.avW=w+clamp(target-w,-rate*dt,rate*dt);
      const bt=active?brake:1;s.avBrake=(s.avBrake??1)+(bt-(s.avBrake??1))*Math.min(1,dt/.3);
      return s.avW;
    }
  });

  /* ------------------------------ speed probe ------------------------------
     How fast this machine runs the minds: a short, seeded synthetic battle
     of 240 ships through the real index / scan / think / destination code.
     Returns cycles per millisecond. The page divides by the score measured
     on the reference machine to scale its measured simulation costs. */
  function probe(now,budgetMs=120){
    const defs=PROFILES.map(()=>({hold:500,doct:{CHARGE:3,FLANK:2,HUNT:1}}));
    const m=new FleetMinds(defs),r=random(0xC0FFEE),ships=[];
    for(let i=0;i<240;i++){const side=i&1;ships.push({id:i,side,race:side?6:5,seed:(r()*4294967296)>>>0,x:(side?1:-1)*(300+r()*900),y:(r()-.5)*400,z:(r()-.5)*2400,yaw:side?Math.PI:0,v:40,vy:0,pitch:0,hp:10,hpMax:10,slen:i%12?24:260,spd:40,spdMax:60,turn:1,squad:-1,arr:true,grace:false,dead:false});}
    m.reset(7);for(const s of ships)m.equip(s);
    const start=now();let cycles=0,t=0;
    // Bounded: a frozen or coarse clock (headless harness, privacy timers) cannot hang it.
    while(now()-start<budgetMs&&cycles<400&&!(cycles>=2&&now()===start)){
      t+=.11;m.index(ships,t,[],[]);
      for(const s of ships){m.destination(s,t,false);s.x+=Math.cos(s.yaw)*.4;s.yaw+=.01;}
      cycles++;
    }
    return cycles/Math.max(1,now()-start);
  }

  return {FleetMinds,WarStory,PROFILES,TRAITS,DOCTRINE,PLANS,HANDLING,GEOMETRY,slotOffset,formationSpacing,random,probe};
});
