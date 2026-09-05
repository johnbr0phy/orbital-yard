// One moving fighter and one obstacle; six simulated seconds, no WebGL.
const assert=require('node:assert/strict'),{loadBattle}=require('./headless-battle.cjs');
const b=loadBattle();b.start(5,6,915,12,[-1,-1]);
b.run(`endIntro();battleTime=5;var pilot=ships.find(s=>s.side===0&&weaponProfile(s).fixed&&!s.hero),enemy=ships.find(s=>s.side===1&&weaponProfile(s).fixed&&!s.hero);
for(const s of ships){s.dead=s!==pilot&&s!==enemy;s.arr=true;s.grace=false;s.delay=0;s.shed=0;}
pilot.x=0;pilot.y=0;pilot.z=0;pilot.yaw=0;pilot.v=70;pilot.vy=0;pilot.roll=pilot.pitch=0;pilot.hp=pilot.hpMax=100;pilot.squad=-1;pilot.ai.charge=0;
enemy.x=1000;enemy.y=0;enemy.z=0;enemy.v=0;enemy.hp=enemy.hpMax=1000;
var obstacle={uid:700,src:999,x:180,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,rad:45,extents:[25,25,25],ax:[0,1,0],ang:0,spin:0,t0:0,integ:100,disabled:true,vao:{},life:180};wrecks=[obstacle];debrisQueue=[];
var nearest=Infinity,avoiding=0,braking=0;
for(let i=0;i<180;i++){battleTime+=1/30;simStep(battleTime,1/30);nearest=Math.min(nearest,Math.hypot(pilot.x-obstacle.x,pilot.y-obstacle.y,pilot.z-obstacle.z));if(pilot.debrisGoal)avoiding++;if(pilot.debrisBrake<1)braking++;}
`);
const result=b.run('({length:pilot.slen,obstacle:[obstacle.x,obstacle.z],nearest,avoiding,braking,alive:!pilot.dead,offset:pilot.z,position:[pilot.x,pilot.y,pilot.z]})');
console.log(JSON.stringify(result));assert.ok(result.alive&&result.avoiding>0&&result.braking>0&&Math.abs(result.offset)>15&&result.nearest>25);
