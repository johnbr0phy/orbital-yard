const test=require('node:test'),assert=require('node:assert/strict');
const {loadBattle}=require('./headless-battle.cjs');
test('packed reusable laser geometry matches the original ribbon',()=>{
 const b=loadBattle();
 for(const pair of [[[0,0,0],[100,3,20]],[[4,6,8],[4,90,8]],[[0,0,0],[0,0,0]]]){
 const r=b.run(`(()=>{const [a,z]=${JSON.stringify(pair)},out=new Float32Array(18);writeWeaponRibbon(out,0,a,z,2);return {packed:Array.from(out),reference:weaponRibbon(a,z,2)};})()`);
 assert.ok(r.packed.every((v,i)=>Number.isFinite(v)&&Math.abs(v-r.reference[i])<1e-4));
 }
});
test('laser buffers are reused across frames after capacity is established',()=>{
 const b=loadBattle();b.run(`beams=[];tracers=[{energy:true,x:20,y:0,z:0,vx:800,vy:0,vz:0,t0:0,width:1,col:[0,1,0]}];drawCoherentWeapons(1);var first=coherentGroups.get('0,1,0').outer;drawCoherentWeapons(1.1);`);
 assert.ok(b.run("coherentGroups.get('0,1,0').outer===first&&coherentGroups.get('0,1,0').count===18"));
});
test('high-density and large screens stay within the render pixel budget',()=>{
 const b=loadBattle();for(const [w,h,ratio] of [[1440,900,2],[2560,1440,2],[3840,2160,2],[800,600,1]]){const d=b.run(`renderPixelRatio(${w},${h},${ratio})`);assert.ok(w*h*d*d<=2400001&&d<=ratio&&d<=1.5);}
});
