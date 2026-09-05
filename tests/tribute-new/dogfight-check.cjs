const assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
const b=loadBattle();b.start(5,6,915,12,[-1,-1]);
b.run(`endIntro();battleTime=2;
var pair=[ships.find(s=>s.race===5&&weaponProfile(s).fixed),ships.find(s=>s.race===6&&weaponProfile(s).fixed)];
if(pair.some(s=>!s))throw Error('missing fighter');
for(const s of ships)s.dead=!pair.includes(s);
for(let i=0;i<2;i++){const s=pair[i];Object.assign(s,{x:i*350,y:i*40,z:0,yaw:i*Math.PI,v:60,vy:0,pitch:0,roll:0,yawV:0,arr:true,grace:false,hp:100,hpMax:100,delay:-20,shed:0,hero:false,cool:0,msl:false,mines:false});}
var launch=[0,0],attempt=[0,0],closest=Infinity;
var originalFire=fireBeam;fireBeam=function(s,...args){let j=pair.indexOf(s);if(j>=0)attempt[j]++;const out=originalFire(s,...args);if(out&&j>=0)launch[j]++;return out;};
var originalDestination=battleAI.destination.bind(battleAI);battleAI.destination=function(s,now,cap){const i=pair.indexOf(s);if(i<0)return originalDestination(s,now,cap);const t=pair[1-i];return {goal:[t.x,t.y,t.z],target:t.id,mode:'ATTACK',boost:1};};`);
b.step(18);
console.log(JSON.stringify(b.run('({launch,attempt,positions:pair.map(s=>[s.x,s.y,s.z]),hp:pair.map(s=>s.hp),finite:pair.every(s=>[s.x,s.y,s.z,s.yaw].every(Number.isFinite))})')));

assert.ok(b.run('launch.every(n=>n>=4)'), 'both fighters fire repeatedly across attack passes');
assert.ok(b.run('pair.every(s=>[s.x,s.y,s.z].every(Number.isFinite))'));
