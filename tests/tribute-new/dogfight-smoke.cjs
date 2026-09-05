// Bounded eight-fighter encounter: real AI, real hull health and swept bolts.
const assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
const b=loadBattle();b.start(5,6,915,12,[-1,-1]);
b.run(`endIntro();battleTime=2;ionNext=[Infinity,Infinity];
var fighters=[...ships.filter(s=>s.race===5&&weaponProfile(s).fixed).slice(0,4),...ships.filter(s=>s.race===6&&weaponProfile(s).fixed).slice(0,4)];
for(const s of ships)s.dead=!fighters.includes(s);
for(let i=0;i<fighters.length;i++){const s=fighters[i];Object.assign(s,{x:s.side?250:-250,y:(i%4)*18,z:(i%4)*70,yaw:s.side?Math.PI:0,v:s.spd,vy:0,pitch:0,roll:0,yawV:0,delay:-20,shed:0,hero:false,arr:true,grace:false,cool:0,msl:false,mines:false});}
var shotCounts=[0,0],modes={};var savedFire=fireBeam;fireBeam=function(s,...args){const out=savedFire(s,...args);if(out)shotCounts[s.side]++;return out;};`);
for(let i=0;i<20;i++){b.step(1);b.run('for(const s of fighters)if(!s.dead)modes[s.ai.action]=(modes[s.ai.action]||0)+1;');}
const result=b.run('({shots:shotCounts,alive:fighters.filter(s=>!s.dead).length,modes,finite:fighters.every(s=>[s.x,s.y,s.z,s.yaw].every(Number.isFinite))})');
console.log(JSON.stringify(result));assert.ok(result.finite);assert.ok(result.shots.every(n=>n>0),'both sides launch real bolts');
