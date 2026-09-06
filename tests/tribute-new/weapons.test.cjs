const test=require('node:test');
const assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
function scene(){
 const b=loadBattle();
 b.run(`battleTime=2;beams=[];tracers=[];
 var fighter={id:0,seed:12,race:5,side:0,slen:20,exL:10,exY:3,exZ:5,hp:100,hpMax:100,x:0,y:0,z:0,yaw:0,v:0,vy:0,spd:60,spdMax:90,turn:1,vao:{},arr:true,grace:false,dead:false,guns:[[10,0,-2],[10,0,2]],meta:{klass:'TIE FIGHTER'}};
 var enemy={...fighter,id:1,seed:23,side:1,race:6,x:150,guns:[[10,0,0]],meta:{klass:'X-WING'}};
 ships=[fighter,enemy];battleAI.reset(42);battleAI.equip(fighter);battleAI.equip(enemy);battleAI.index(ships,2);battleAI.scan(fighter,2);`);
 return b;
}
test('fixed fighter barrels refuse side and rear targets, and launch exactly forward',()=>{
 const b=scene();
 assert.ok(b.run('!!weaponSolution(fighter,enemy,2)'));
 b.run('enemy.z=150');assert.equal(b.run('weaponSolution(fighter,enemy,2)'),null);
 b.run('enemy.z=0;enemy.x=-150');assert.equal(b.run('weaponSolution(fighter,enemy,2)'),null);
 b.run('enemy.x=150;var shot=weaponSolution(fighter,enemy,2)');
 assert.equal(b.run('shot.direction[0]'),1);assert.equal(b.run('shot.direction[2]'),0);
});
test('mount transform follows roll, pitch and yaw, and inverse restores local coordinates',()=>{
 const b=scene();
 b.run('fighter.yaw=.7;fighter.roll=.4;fighter.pitch=-.2;var local=[10,2,-3];var back=weaponLocal(fighter,gunWorld(fighter,local,2),2)');
 assert.ok(b.run('back.every((v,i)=>Math.abs(v-local[i])<1e-10)'));
});
test('turrets cover their exposed side and reject firing through the opposite hull',()=>{
 const b=scene();
 b.run('fighter.slen=500;fighter.exL=250;fighter.exY=50;fighter.exZ=80;fighter.guns=[[0,0,80],[0,0,-80]];enemy.x=0;enemy.z=300');
 assert.ok(b.run('mountFaces(fighter,enemy,[0,0,80],2)'));
 assert.equal(b.run('mountFaces(fighter,enemy,[0,0,-80],2)'),false);
 assert.equal(b.run('weaponMount(fighter,enemy,2)[2]'),80);
});
test('a fast round hits a thin hull between frames without a length-sized false hit',()=>{
 const b=scene();
 b.run('enemy.x=0;enemy.slen=1000;enemy.exL=500;enemy.exY=10;enemy.exZ=20');
 assert.ok(b.run('weaponSegmentHit([0,0,-100],[0,0,100],enemy,2)')>0);
 assert.equal(b.run('weaponSegmentHit([0,80,-100],[0,80,100],enemy,2)'),null);
 b.run('fighter.x=0;fighter.z=-500;var aim=aimSkin(fighter,enemy)');
 assert.ok(b.run('Math.abs(aim[2])<21'),'beam reaches the narrow hull instead of stopping on a 500m sphere');
});
test('one sustained emitter stays coherent and follows both hulls without multiplying',()=>{
 const b=scene();
 b.run(`fighter.race=10;fighter.slen=200;fighter.guns=[[10,0,0]];
 for(let i=0;i<30;i++)pushFork(fighter,[10,0,0],[10,0,0],[140,0,0],{t0:2,target:1,hold:true,cut:true});`);
 assert.equal(b.run('beams.length'),1);
 b.run('fighter.x=5;enemy.x=180;pinBeams(2)');
 assert.equal(b.run('beams[0].a[0]'),b.run('barrelFrame(fighter,[10,0,0],2).tip[0]'));assert.ok(b.run('beams[0].b[0]>165'));
 b.run('fighter.dead=true;pinBeams(2)');assert.equal(b.run('beams[0].t0'),-Infinity);
});
test('laser bolts detach and deal no instantaneous hitscan damage',()=>{
 const b=scene();const hp=b.run('enemy.hp');
 assert.ok(b.run('fireBeam(fighter,enemy,2,0,0,0,1,false)'));
 assert.equal(b.run('enemy.hp'),hp);assert.equal(b.run('tracers.length'),1);
 assert.equal(b.run('beams.length'),0);
 b.run('var before=JSON.stringify(tracers[0]);fighter.x=100;fighter.yaw=1;pinBeams(2.1)');
 assert.ok(b.run('before===JSON.stringify(tracers[0])'));
});
test('kinetic bursts are sequenced rather than overlapping at one timestamp',()=>{
 const b=scene();b.run('tracerBurst(fighter,enemy,2,weaponSolution(fighter,enemy,2),4,650)');
 assert.ok(b.run('tracers.every((t,i)=>i===0||t.t0>tracers[i-1].t0)'));
});
test('beam ribbons form two complete triangles and remain finite end-on',()=>{
 const b=scene();b.run('cam.ex=10;cam.ey=0;cam.ez=0;var ribbon=weaponRibbon([0,0,0],[20,0,0],2)');
 assert.equal(b.run('ribbon.length'),18);assert.ok(b.run('ribbon.every(Number.isFinite)'));
});
test('fleet and class hardware distinguishes beams, bolts and fixed mounts',()=>{
 const b=scene();
 for(let race=0;race<18;race++){
  b.run(`fighter.race=${race};var p=weaponProfile(fighter)`);
  assert.ok(b.run('p.width>0&&p.speed>0&&p.duration>0'));
 }
 b.run("fighter.race=10;fighter.meta.klass='DEFIANT';");assert.equal(b.run('weaponProfile(fighter).mode'),'bolt');
 b.run("fighter.meta.klass='ENTERPRISE';fighter.slen=600;");assert.equal(b.run('weaponProfile(fighter).mode'),'beam');
 assert.equal(b.run('weaponProfile(fighter).fixed'),false);
});
test('turrets take time to traverse instead of snapping to a new firing direction',()=>{
 const b=scene();b.run('fighter.slen=500;fighter.exL=250;fighter.exY=50;fighter.exZ=80');
 assert.equal(b.run('turretTrack(fighter,[0,0,80],[300,0,250],2)'),false);
 assert.ok(b.run('(()=>{let ready=false;for(let i=1;i<=90;i++)ready=turretTrack(fighter,[0,0,80],[300,0,250],2+i/30);return ready;})()'));
 assert.equal(b.run('turretTrack(fighter,[0,0,80],[-300,0,250],5.01)'),false);
});
test('capital sensors reach beyond the bow of an Executor-sized hull',()=>{
 const b=scene();
 b.run('fighter.slen=19600;fighter.exL=9800;fighter.hulls=50;enemy.x=10600;battleAI.index(ships,3);battleAI.scan(fighter,3)');
 assert.ok(b.run('battleAI.fireable(fighter,enemy,3)'));
});
test('all shared barrel styles end at the common bore axis and have bounded geometry',()=>{
 const b=scene();
 for(const style of ['naval','emitter','organic']){
  b.run(`var geometry=barrelGeometry('${style}')`);
  assert.ok(b.run('geometry.length<2000&&geometry.every(Number.isFinite)'));
  assert.ok(b.run('Array.from(geometry).some((v,i)=>i%4===0&&v===1&&geometry[i+1]===0&&geometry[i+2]===0)'));
 }
});
test('visible barrel tips and emitted turret bolts share an origin and axis',()=>{
 const b=scene();
 b.run(`fighter.slen=250;fighter.exL=125;fighter.guns=[[10,0,0]];
 for(let i=0;i<90;i++)turretTrack(fighter,[10,0,0],[150,0,0],2+i/30,1);
 var solution=weaponSolution(fighter,enemy,5,[10,0,0]);var frame=barrelFrame(fighter,[10,0,0],5);`);
 assert.ok(b.run('!!solution&&solution.o.every((v,i)=>Math.abs(v-frame.tip[i])<1e-9)'));
 assert.ok(b.run('solution.direction.every((v,i)=>Math.abs(v-frame.dir[i])<1e-9)'));
 assert.ok(b.run('frame.tip[0]>frame.pivot[0]'));
});
test('fixed fighter mounts get no rotating extension and turret instances deduplicate mounts',()=>{
 const b=scene();assert.equal(b.run('shipBarrels(fighter).length'),0);
 assert.ok(b.run('weaponMuzzle(fighter,[10,0,0],2).every((v,i)=>v===gunWorld(fighter,[10,0,0],2)[i])'));
 b.run('fighter.slen=250;fighter.guns=[[10,0,0]];fighter.lances=[{lx:10,ly:0,lz:0}];fighter.turrets=[{lx:10,ly:0,lz:0}]');
 assert.equal(b.run('shipBarrels(fighter).length'),1);
});
test('ion barrel retains its discharge direction until the visible shot ends',()=>{
 const b=scene();
 b.run(`fighter.slen=250;fighter.guns=[[10,0,0]];
 turretTrack(fighter,[10,0,0],[150,0,0],2,1);
 fireIonFrom(fighter,0,2,{point:[150,0,0],radius:100,muz:[10,0,0]});`);
 assert.equal(b.run('weaponSolution(fighter,enemy,2.2,[10,0,0])'),null);
 assert.equal(b.run("fighter.weaponTracks.get('10,0,0').holdUntil"),3.55);
 assert.ok(b.run('beams[0].a.every((v,i)=>v===barrelFrame(fighter,[10,0,0],2).tip[i])'));
});
test('Imperial and Rebel fighters launch their green and red physical bolts',()=>{
 const b=scene();
 b.run('raceFire(fighter,enemy,2,0,0,0)');
 assert.ok(b.run('tracers[0].col[1]>tracers[0].col[0]&&Math.abs(tracers[0].damage-.084)<1e-10'));
 b.run('fighter.race=6;fighter.meta.klass="T-65 X-WING";raceFire(fighter,enemy,2.5,0,0,0)');
 assert.ok(b.run('tracers[1].col[0]>tracers[1].col[1]&&tracers[1].vx===800'));
});
test('a close fighter pass extends then reacquires without an instantaneous turn',()=>{
 const b=scene();b.run('enemy.x=40;var yawBefore=fighter.yaw;var exitGoal=fighterPassGoal(fighter,enemy,2);enemy.x=200;enemy.z=100;');
 assert.equal(b.run('fighter.yaw'),b.run('yawBefore'));
 assert.ok(b.run('fighterPassGoal(fighter,enemy,3)===exitGoal'));
 assert.ok(b.run('fighterPassGoal(fighter,enemy,5)!==exitGoal'));
});
test('debris separation is harmless and grazing damage is below a hard ram',()=>{
 const b=scene(),hp=b.run('fighter.hp');b.run('debrisStrike(fighter,true,-20,2)');
 assert.equal(b.run('fighter.hp'),hp);
 b.run('debrisStrike(fighter,true,10,3);var afterGraze=fighter.hp;debrisStrike(fighter,true,60,4)');
 assert.ok(b.run('afterGraze>98&&fighter.hp<afterGraze-10&&!fighter.dead'));
});
