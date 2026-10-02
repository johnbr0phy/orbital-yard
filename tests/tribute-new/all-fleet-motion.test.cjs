const test = require('node:test');
const assert = require('node:assert/strict');
const native = require('./headless-battle.cjs');
const three = require('../three/engine-harness.cjs');
const {FLEETS} = require('../../scripts/motion-scenes.cjs');

for (const [renderer, harness] of [['native', native], ['Three', three]]) {
  for (let race = 0; race < FLEETS.length; race++) {
    test(`${renderer}: ${FLEETS[race]} capitals close a distant approach without changing combat engines`, () => {
      const b = harness.loadBattle();b.start(race, race === 5 ? 6 : 5, 42, 12);
      const result = b.run(`(()=>{
        const s=ships.filter(s=>s.side===0&&fightsAsCrown(s)).sort((a,b)=>b.slen-a.slen)[0];
        const dash=s.spdMax,cruise=s.spd,spool=Math.min(30,8+s.slen/200);
        Object.assign(s,{x:0,y:0,z:0,yaw:0,yawV:0,yawA:0,v:0,vy:0,vA:0,pitch:0,roll:0,squad:-1,trafficScan:0,trafficGoal:null,avBrake:1,avW:0});
        battleAI.destination=()=>({goal:[6000,0,0],boost:1.3,mode:'SEARCH',target:-1,slot:null,station:false});
        let maxAcc=0,maxTurn=0;
        for(let i=0;i<1800;i++){const v=s.v;battleAI.moveCapital(s,i/30,1/30);maxAcc=Math.max(maxAcc,(s.v-v)*30/(s.fullBurn/spool));maxTurn=Math.max(maxTurn,Math.abs(s.yawV));}
        const progress=s.x,speed=s.v;
        battleAI.destination=()=>({goal:[s.x+500,0,s.z],boost:1,mode:'ATTACK',target:-1});
        battleAI.moveCapital(s,60,1/30);const firstBrake=s.v;
        for(let i=1;i<1200;i++)battleAI.moveCapital(s,60+i/30,1/30);
        return {progress,speed,firstBrake,combatSpeed:s.v,dash,cruise,finalDash:s.spdMax,finalCruise:s.spd,maxAcc,maxTurn,pitch:s.pitch};
      })()`);
      assert.ok(result.progress > 2500, JSON.stringify(result));
      assert.ok(result.maxAcc <= 1.001, JSON.stringify(result));
      assert.ok(result.firstBrake >= result.speed * .98, 'contact brakes through the spool');
      assert.ok(result.combatSpeed <= result.dash * 1.02, JSON.stringify(result));
      assert.equal(result.finalDash, result.dash);
      assert.equal(result.finalCruise, result.cruise);
      assert.ok(Math.abs(result.pitch) <= .055);
    });
  }

  test(`${renderer}: wide flat hulls pass vertically without climbing by their width`, () => {
    const b = harness.loadBattle();b.start(5,6,42,12);
    const result=b.run(`(()=>{
      const pair=[ships.find(s=>s.side===0&&s.hulls===10),ships.find(s=>s.side===1&&s.hulls===10)];
      for(const s of ships)s.dead=!pair.includes(s);
      pair.forEach((s,i)=>Object.assign(s,{x:i?600:-600,y:0,z:0,yaw:i?Math.PI:0,yawV:0,v:60,vy:0,spd:60,spdMax:80,exL:200,exY:20,exZ:1000,slen:400,arr:true,grace:false}));
      wrecks=[];prepareTraffic(4);pair.forEach(s=>trafficPilot(s,4));
      return pair.map(s=>({lane:s.trafficGoal[1],brake:s.trafficBrake}));
    })()`);
    assert.ok(result.every(s=>Math.abs(s.lane)<150&&s.brake<1), JSON.stringify(result));
    assert.ok(result[0].lane * result[1].lane < 0, 'opposing traffic takes opposite lanes');
  });

  test(`${renderer}: vertical passing clearance includes a banked hull's projected width`, () => {
    const b = harness.loadBattle();b.start(5,6,42,12);
    const result=b.run(`(()=>{
      const pair=[ships.find(s=>s.side===0&&s.hulls===10),ships.find(s=>s.side===1&&s.hulls===10)];
      for(const s of ships)s.dead=!pair.includes(s);
      pair.forEach((s,i)=>Object.assign(s,{x:i?600:-600,y:0,z:0,yaw:i?Math.PI:0,pitch:0,roll:i?0:Math.PI/3,yawV:0,v:60,vy:0,spd:60,exL:200,exY:20,exZ:400,slen:400,arr:true,grace:false}));
      wrecks=[];prepareTraffic(4);trafficPilot(pair[0],4);
      const support=trafficBodies.get(pair[0].id).e.reduce((v,e,i)=>v+e*Math.abs(trafficBodies.get(pair[0].id).axes[i][1]),0);
      return {lane:Math.abs(pair[0].trafficGoal[1]),need:support+20+55};
    })()`);
    assert.ok(result.lane >= result.need - .01, JSON.stringify(result));
  });
}
