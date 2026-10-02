import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../assets/three/three.module.js';
import {createHulls} from '../../armada-three-hulls.js';

test('Three wreckage carries fracture edges and cools while live ships stay unheated',()=>{
  const scene=new THREE.Scene();
  const mesh={v:new Float32Array([0,0,0,10,0,0,0,10,0]),i:new Uint32Array([0,1,2]),version:1};
  const runtime={geometry:()=>mesh,xPose:()=>({ax:[0,1,0],ang:0}),shipBarrels:()=>[],
    hullFinish:()=>({color:[.5,.5,.5],trim:[.4,.4,.4],gloss:0,seed:0,pattern:0})};
  const hulls=createHulls(THREE,scene,runtime);
  const wreck={vao:{},x:0,y:0,z:0,t0:10,slen:20,e:new Float32Array([1,0,1])};
  const ship={id:0,vao:{},x:0,y:0,z:0,slen:20,arr:true};
  const state={genId:1,ships:[ship],wrecks:[wreck],now:10,warT0:0,cam:{ex:0,ey:0,ez:1000}};
  hulls.update(state);
  const meshes=scene.getObjectByName('fleets').children;
  const broken=meshes.find(m=>m.name==='wreck'),living=meshes.find(m=>m.name==='ship');
  assert.deepEqual([...broken.geometry.getAttribute('fractureEdge').array],[1,0,1]);
  assert.equal(broken.material.uniforms.uHeat.value,1);
  assert.equal(living.material.uniforms.uHeat.value,0);
  hulls.update({...state,now:13.2});
  assert.ok(Math.abs(broken.material.uniforms.uHeat.value-Math.exp(-1))<1e-9);
  hulls.dispose();
});
