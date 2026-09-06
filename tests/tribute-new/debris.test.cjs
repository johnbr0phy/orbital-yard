const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
function scene(){const b=loadBattle();b.run(`battleTime=4;warT0=0;intro=null;ships=[];wrecks=[];debrisQueue=[];counts=[5,5];winner=null;
var pilot={id:0,seed:12,race:5,side:0,slen:20,rad:6,exL:10,exY:3,exZ:5,hp:100,hpMax:100,x:0,y:0,z:0,yaw:0,v:60,vy:0,spd:60,spdMax:90,turn:1,vao:{},arr:true,grace:false,dead:false,guns:[[10,0,0]],meta:{klass:'TIE FIGHTER'}};
ships=[pilot];battleAI.reset(42);battleAI.equip(pilot);
var rock={uid:7,src:99,x:150,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,rad:16,extents:[10,8,8],ax:[0,1,0],ang:0,spin:.2,t0:0,integ:2,vao:{},life:60};wrecks=[rock];`);return b;}
test('rotation integrates identically across rates and never manufactures translational speed',()=>{
 const b=scene();const states=[];
 for(const fps of [20,30,120])states.push(b.run(`(()=>{const w={rad:2000,spin:3,ang:0,x:0,y:0,z:0,vx:0,vy:0,vz:0};for(let i=0;i<${fps*30};i++)integrateDebris(w,1/${fps});return [w.ang,w.spin,w.x,w.y,w.z];})()`));
 for(const s of states)assert.ok(s.every((v,i)=>Math.abs(v-states[0][i])<1e-10));assert.ok(states[0][1]<.005);assert.equal(states[0][2],0);
});
test('contacts transfer mass-weighted momentum without exponential spin',()=>{
 const b=scene();b.run('pilot.x=136;pilot.v=50;rock.rad=2000;rock.extents=[10,8,8];rock.spin=.003;var before=debrisMass(pilot)*pilot.v+debrisMass(rock)*rock.vx;shipWreckContact(pilot,rock,4);var after=debrisMass(pilot)*pilot.v+debrisMass(rock)*rock.vx;');
 assert.ok(b.run('Math.abs(before-after)<1e-7'));assert.ok(b.run('Math.abs(rock.spin)<=debrisSpinLimit(rock)'));
 b.run('var hp=pilot.hp;pilot.v=-20;rock.vx=0;pilot.x=136;shipWreckContact(pilot,rock,5)');assert.equal(b.run('pilot.hp'),b.run('hp'));
});
test('lookahead detects debris before contact, including distant-center large hulks',()=>{
 const b=scene();b.run('debrisPilot(pilot,4)');assert.ok(b.run('!!pilot.debrisGoal&&pilot.debrisBrake<1&&Math.abs(pilot.debrisGoal[2])>50'));assert.equal(b.run('pilot.debrisTarget'),7);
 b.run('rock.x=2200;rock.rad=2300;rock.extents=[2100,50,50];rock.disabled=true;pilot.debrisScan=0;debrisPilot(pilot,5)');assert.ok(b.run('!!pilot.debrisGoal'));
 b.run('rock.x=-500;rock.rad=10;rock.extents=[10,10,10];pilot.debrisScan=0;debrisPilot(pilot,6)');assert.equal(b.run('pilot.debrisGoal'),null);
});
test('clearing bolts use actual forward barrels and damage only on swept impact',()=>{
 const b=scene();b.run('debrisPilot(pilot,4)');assert.ok(b.run('fireAtDebris(pilot,4)'));
 assert.equal(b.run('rock.integ'),2);assert.ok(b.run('tracers[0].x===10&&tracers[0].vz===0&&tracers[0].col[1]===1'));
 b.run('pilot.dead=true;pilot.vao=null;var hp=rock.integ;simStep(4.25,.25)');assert.ok(b.run('rock.integ<hp'));assert.equal(b.run('tracers.length'),0);
});
test('fixed clearing rejects off-axis debris and living blockers',()=>{
 const b=scene();b.run('pilot.debrisTarget=7;rock.z=100');assert.equal(b.run('fireAtDebris(pilot,4)'),false);
 b.run('rock.z=0;ships.push({...pilot,id:1,x:70,side:0})');assert.equal(b.run('fireAtDebris(pilot,5)'),false);assert.equal(b.run('tracers.length'),0);
});
test('beam clearing follows rotating muzzle and chips the blocking object',()=>{
 const b=scene();b.run("pilot.race=10;pilot.slen=250;pilot.exL=125;pilot.guns=[[20,0,0]];pilot.debrisTarget=7;rock.x=300;");
 assert.ok(b.run('fireAtDebris(pilot,4)'));assert.ok(b.run('rock.integ<2'));b.run('pilot.x=3;pinBeams(4.1)');assert.ok(b.run('beams[0].a.every((v,i)=>Math.abs(v-barrelFrame(pilot,[20,0,0],4.1).tip[i])<1e-9)'));
});
test('disabled capital reuses whole hull, stops combat, drifts and can break up later',()=>{
 const b=scene();b.start(5,6,915,12,[-1,-1]);b.run(`endIntro();var cap=ships.find(s=>s.hulls);cap.destroyMode='disabled';cap.v=0;cap.vy=0;cap.yawV=.4;var old=cap.vao;kill(cap,4);var hulk=wrecks.find(w=>w.src===cap.id);`);
 assert.ok(b.run('cap.dead&&cap.disabled&&!cap.vao&&hulk.disabled&&hulk.vao===old'));assert.equal(b.run('hulk.vx'),0);assert.ok(b.run('Math.abs(hulk.spin)<=debrisSpinLimit(hulk)'));
 b.run('damageDebris(hulk,200,5,[hulk.x,hulk.y,hulk.z])');assert.ok(b.run('hulk.shatter&&debrisQueue.length>0&&debrisQueue.length<=32'));
});
test('prefractured catastrophic breakup retains count/upload/lifetime bounds',()=>{
 const b=scene();b.start(5,6,915,12,[-1,-1]);b.run(`endIntro();var cap=ships.find(s=>s.hulls);var groups=cap.fragData.length;cap.destroyMode='catastrophic';kill(cap,4);var generated=debrisQueue.length;var before= wrecks.length;uploadDebris(4);`);
 assert.ok(b.run('cap.fragReady&&generated===Math.min(groups,32)&&generated>12'));assert.ok(b.run('wrecks.length-before<=4'));assert.ok(b.run('debrisQueue.every(w=>w.v.every(Number.isFinite)&&Math.abs(w.spin)<=debrisSpinLimit(w))'));
 b.run('for(let i=0;i<30;i++){cap.fragData=[{v:new Float32Array([0,0,0,20,0,0,0,20,0]),i:new Uint32Array([0,1,2]),ox:0,oy:0,oz:0}];spawnBreakup(cap,4)}');assert.ok(b.run('debrisQueue.length<=64&&wrecks.length+debrisQueue.length<=192'));
 b.run('var w=wrecks[0];w.life=1;stepBattleWrecks(10,1/30)');assert.ok(b.run('!!w.dustT'));
});
test('actual destroyer triangles fracture into bounded finite pieces',()=>{
 const b=loadBattle();const result=b.run(`(()=>{const s=buildImperialMega(42,10),m=shipMeshQ(s,.32),parts=fractureMesh([{v:m.t,i:Uint32Array.from({length:m.t.length/3},(_,i)=>i),ox:0,oy:0,oz:0}],32);return {sourceParts:s.parts.length,count:parts.length,triangles:parts.reduce((n,p)=>n+p.i.length/3,0),finite:parts.every(p=>p.v.every(Number.isFinite)&&Number.isFinite(p.r)&&p.extents.every(v=>v>0))};})()`);
 console.log('Real destroyer fracture:',result);assert.equal(result.count,32);assert.ok(result.finite&&result.triangles<=8192);
});
test('ordinary weapons hit intervening wreckage before the enemy',()=>{
 const b=scene();b.run("pilot.race=10;pilot.slen=250;pilot.exL=125;pilot.guns=[[20,0,0]];var enemy={...pilot,id:1,side:1,x:300,hp:100};ships.push(enemy);battleAI.equip(enemy);battleAI.index(ships,4);battleAI.scan(pilot,4);");
 assert.ok(b.run('fireBeam(pilot,enemy,4,0,0,0,1,false)'));assert.equal(b.run('enemy.hp'),100);assert.ok(b.run('rock.integ<2&&beams[0].debrisUid===7'));
});
test('queued fragment pose matches continuous integration at upload time',()=>{
 const b=scene();b.run('var w={...rock,t0:1,v:new Float32Array([0,0,0]),i:new Uint32Array([0]),vx:2},expected={...w};debrisQueue=[w];integrateDebris(expected,3);stepBattleWrecks(4,1/30)');assert.ok(b.run('Math.abs(w.x-expected.x)<1e-9&&Math.abs(w.ang-expected.ang)<1e-9'));
});
