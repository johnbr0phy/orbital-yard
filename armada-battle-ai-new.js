/* Fleet minds. No rendering or wall clock dependencies. Also loaded by the
   headless battle checks with Node. All randomness belongs to a battle or pilot. */
(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.ArmadaBattleAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const length = (x, y, z) => Math.hypot(x, y, z);
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
  const capital = s => !!(s.hulls || (!s.hero && ((s.slen || 0) >= 300 || (s.race === 8 && s.slen > 180))));
  const surface = (s, t) => Math.max(0, distance(s, t) - radius(t));
  const strength = s => Math.sqrt(Math.max(1, s.hpMax || 3)) * (s.hulls ? 1.4 : 1) * (.6 + .4 * clamp(s.hp / Math.max(1, s.hpMax)));
  function allocation(base, r) {
    const values=base.map(n=>Math.max(8,n+(r()+r()-1)*24));
    const sum=values.reduce((a,b)=>a+b,0);
    const out=values.map(n=>Math.round(n/sum*100));out[2]=100-out[0]-out[1];return out;
  }
  class FleetMinds {
    constructor(definitions) { this.definitions=definitions;this.reset(1); }
    reset(seed) {
      this.seed=seed;this.rng=random(seed ^ 0x615d37);this.ships=[];this.byId=new Map();
      this.grid=new Map();this.large=[];this.squads=[];this.locks=[];this.now=0;this.nextIndex=-1;
      this.stats={scans:0,decisions:0,actions:{},ionDodges:0};
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
      if(capital(s)){
        const scale=clamp(Math.pow(900/Math.max(150,s.slen),.15),.66,1.4);
        const mobility=['pounce','flank','ambush'].includes(a.profile.style)?1.15:1;
        const base=s.hulls>=50?28:38;
        s.spd=base*scale*(.70+e)*mobility;
        s.spdMax=s.spd*(1.30+.35*e);
        s.turn=clamp(75/Math.max(300,s.slen),.035,.22)*(.8+.6*e);
      }
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
      for(const s of ships){
        this.byId.set(s.id,s);if(!alive(s))continue;
        if(radius(s)>500)this.large.push(s);
        const key=this.key(s.x,s.y,s.z);let cell=this.grid.get(key);
        if(!cell)this.grid.set(key,cell=[]);cell.push(s);
      }
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
    inView(s,t) {
      const sensor=this.senses(s),dx=t.x-s.x,dy=t.y-s.y,dz=t.z-s.z,d=length(dx,dy,dz);
      if(d-radius(t)>sensor.range)return false;
      if(t.cloaked && d-radius(t)>160)return false;
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
      a.fear+=(fearTarget-a.fear)*Math.min(1,dt*(fearTarget>a.fear?1.8:.32+.65*a.traits.discipline));
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
        if(score>best){best=score;target=c;}
      }
      a.target=target?target.id:-1;
      const weak=a.friends.filter(f=>f.hp/f.hpMax<.58).sort((l,r)=>l.hp/l.hpMax-r.hp/r.hpMax)[0];
      if(now<a.until&&!warning&&damaged<.12&&!(a.fear>.78&&a.action!=='RETREAT')&&target){a.weak=weak;return a;}
      const tr=a.traits;
      let action='SEARCH',reason=target?'Reacquiring a lost contact':'Sweeping the approach';
      if(warning){action='EVADE';reason='Ion lock detected. Clearing the firing zone';this.stats.ionDodges++;}
      else if(fresh.length){
        const scores={
          ATTACK:.42+tr.aggression*.48+a.confidence*.33-a.fear*.65,
          FLANK:.29+tr.skill*.30+tr.creativity*.32-a.fear*.30,
          ESCORT:.08+tr.cooperation*.30+(weak?.53:0),
          REGROUP:isolation*.23+tr.cooperation*.15+a.fear*.45-tr.aggression*.20,
          RETREAT:a.fear*.92+(1-hp)*.64+Math.max(0,pressure-2)*.10-tr.courage*.34,
          EVADE:(hurt?.54:.06)+tr.skill*.15+a.fear*.22
        };
        const sq=this.squads[s.squad],tac=sq&&sq.tac;
        const order={CHARGE:'ATTACK',SWARM:'ATTACK',HUNT:'FLANK',FLANK:'FLANK',ENVELOP:'FLANK',SCREEN:'ESCORT',FEIGN:'REGROUP',MINE:'FLANK'}[tac];
        if(order)scores[order]+=.28*tr.cooperation;
        let value=-Infinity;
        for(const name of Object.keys(scores)){
          const v=scores[name]+(a.actionBias[name]||0)+(a.rng()-.5)*tr.creativity*.38;
          if(v>value){value=v;action=name;}
        }
        reason={ATTACK:'Local advantage. Committing to an attack run',FLANK:'Changing angle to split their attention',ESCORT:weak?'Covering a damaged ally':'Holding an escort position',REGROUP:'Rejoining the nearest friendly group',RETREAT:'Damage and local threat exceed acceptable risk',EVADE:'Incoming fire. Breaking the firing solution'}[action];
      }
      a.action=action;a.reason=reason;a.weak=weak;
      a.until=now+(warning?1:1.3+tr.discipline*2.4+a.rng()*1.7)*(s.hulls?1.7:1);
      this.stats.decisions++;this.stats.actions[action]=(this.stats.actions[action]||0)+1;
      return a;
    }
    destination(s,now,capital=false) {
      const a=this.think(s,now),c=a.contacts.get(a.target),warning=this.threat(s,now);
      const sq=this.squads[s.squad];
      const speed=s.spdMax||s.spd||40;
      let goal,boost=1,mode=a.action;
      if(warning){
        let dx=s.x-warning.point[0],dy=s.y-warning.point[1],dz=s.z-warning.point[2];
        if(length(dx,dy,dz)<5){dx=-Math.sin(s.yaw)*a.orbit;dy=a.vertical*.5;dz=Math.cos(s.yaw)*a.orbit;}
        const n=length(dx,dy,dz)||1,k=warning.radius+radius(s)+240;
        goal=[warning.point[0]+dx/n*k,warning.point[1]+dy/n*k+speed*1.5*a.vertical,warning.point[2]+dz/n*k];boost=1.45;
      }else if(mode==='RETREAT'||mode==='REGROUP'||mode==='ESCORT'){
        const friend=mode==='ESCORT'&&a.weak?a.weak:a.friends.find(f=>f.hulls)||a.friends[0];
        if(friend){
          const theta=(s.seed%628)/100+now*(capital?.022:.085)*a.orbit;
          const berth=radius(friend)+radius(s)+(capital?330:150);
          goal=[friend.x+Math.cos(theta)*berth,friend.y+a.vertical*berth*.4,friend.z+Math.sin(theta)*berth];
        }else if(c){const n=distance(s,c)||1;goal=[s.x+(s.x-c.x)/n*700,s.y+a.vertical*220,s.z+(s.z-c.z)/n*700];}
        else goal=[s.x+(s.side?1:-1)*500,s.y+a.vertical*160,s.z+a.orbit*250];
        boost=mode==='RETREAT'?1.25:.95;
      }else if(c){
        const age=Math.min(3,now-c.seen),tx=c.x+Math.cos(c.yaw)*c.v*age,ty=c.y+c.vy*age,tz=c.z+Math.sin(c.yaw)*c.v*age;
        const dx=s.x-tx,dz=s.z-tz,n=Math.hypot(dx,dz)||1;
        let range=capital?(this.definitions[s.race].hold||500)*a.preferredRange:55+a.preferredRange*75;
        if(capital&&['pounce','swarm'].includes(a.profile.style))range*=.48;
        if(capital&&['siege','support','ancient'].includes(a.profile.style))range*=1.35;
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
        else boost=capital?1.10:1.12;
      }else{
        const bearing=s.side?Math.PI:0,phase=now*.045+a.lane*2;
        const front=(s.side?-1:1)*Math.min(1400,250+now*7);
        goal=sq&&sq.wp?sq.wp.slice():[front,Math.sin(phase)*280,Math.sin(phase*.8+a.orbit)*900];
        if(capital){goal[1]+=a.vertical*330;goal[2]+=a.lane*500;}
        if(distance(s,{x:goal[0],y:goal[1],z:goal[2]})<100)goal=[s.x+Math.cos(bearing+phase)*500,s.y+a.vertical*180,s.z+Math.sin(bearing+phase)*500];
        boost=.98;
      }
      a.plan={goal,boost,mode,target:a.target,reason:a.reason};
      return a.plan;
    }
    moveCapital(s,now,dt) {
      const p=this.destination(s,now,true),a=s.ai;
      const goal=s.trafficGoal&&now<s.trafficUntil?s.trafficGoal:s.debrisGoal&&now<s.debrisUntil?s.debrisGoal:p.goal;
      let dx=goal[0]-s.x,dy=goal[1]-s.y,dz=goal[2]-s.z;
      for(const other of a.friends.slice(0,10)){
        const d=distance(s,other),safe=radius(s)+radius(other)+90;
        if(d>1&&d<safe){const k=(safe-d)/d;dx+=(s.x-other.x)*k*1.8;dy+=(s.y-other.y)*k;dz+=(s.z-other.z)*k*1.8;}
      }
      if(s.avT&&now-s.avT<.35){dx+=(s.avx||0)*2;dy+=s.avy||0;dz+=(s.avz||0)*2;}
      const delta=angle(Math.atan2(dz,dx)-s.yaw),turn=s.turn||.07;
      const desired=clamp(delta*.65,-turn,turn);
      s.yawV=(s.yawV||0)+(desired-(s.yawV||0))*Math.min(1,dt*1.4);s.yaw+=s.yawV*dt;
      const dash=s.spdMax||s.spd*1.3;
      let velocity=clamp(s.spd*p.boost,s.spd*.65,dash);
      // The muster parks a 19 km ship well behind its screen. A sustained
      // transit burn gets that ship into the fight before the screen is gone.
      // It sheds speed on contact and retains the same gradual turn response.
      const transit=p.mode==='SEARCH'&&length(dx,dy,dz)>2000;
      if(transit){velocity=s.spd*(2.4+a.budget[2]/40);a.reason='Transit burn. Closing to sensor contact';}
      if(s.debrisGoal&&now<s.debrisUntil){velocity*=s.debrisBrake;a.reason="Avoiding debris corridor";}
      if(s.trafficGoal&&now<s.trafficUntil)velocity*=s.trafficBrake;
      if(now<(s.trafficBrakeUntil||0))velocity*=.1;
      if(s.stunT&&now<s.stunT)velocity*=.62;
      s.v=(s.v||0)+(velocity-(s.v||0))*Math.min(1,dt*.65);
      s.vy=(s.vy||0)+(clamp(dy*.15,-s.spd*.42,s.spd*.42)-(s.vy||0))*Math.min(1,dt*.8);
      s.x+=Math.cos(s.yaw)*s.v*dt;s.z+=Math.sin(s.yaw)*s.v*dt;s.y+=s.vy*dt;
      s.roll=(s.roll||0)+(-s.yawV/turn*.18-(s.roll||0))*Math.min(1,dt);
      s.pitch=Math.atan2(s.vy,Math.max(1,s.v))*.5;
      s.mark=p.target;s.mood={RETREAT:'FLEE',EVADE:'EVADE',ESCORT:'DEFEND',FLANK:'FLANK',REGROUP:'REGROUP',SEARCH:'SEARCH'}[p.mode]||'ATTACK';
    }
    command(squads,now) {
      for(const sq of squads){
        sq.mem=sq.mem.filter(id=>this.byId.get(id)&&!this.byId.get(id).dead);if(!sq.mem.length)continue;
        if(sq.aiUntil&&sq.aiUntil>now)continue;
        const lead=this.byId.get(sq.mem[0]);if(!lead||!alive(lead))continue;
        const a=this.seedShip(lead),intel=new Map();
        for(const id of sq.mem){const member=this.byId.get(id);if(!member)continue;this.scan(member,now);for(const c of member.ai.contacts.values())if(now-c.seen<5)intel.set(c.id,c);}
        if(!intel.size){sq.tac='ADVANCE';sq.adv=true;sq.wp=[(sq.side?-1:1)*600,a.vertical*280,a.lane*700];sq.aiUntil=now+1;continue;}
        sq.adv=false;
        let tgt=null,score=-Infinity;
        for(const c of intel.values()){const v=1/(1+surface(lead,c)/900)+(1-c.hp/Math.max(1,c.hpMax))*.25+a.rng()*.18;if(v>score){score=v;tgt=c;}}
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
  return {FleetMinds,PROFILES,TRAITS,random};
});
