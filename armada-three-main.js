import * as THREE from './assets/three/three.module.js';
import {createGeometryStore} from './armada-three-geometry.js';
import {createHulls} from './armada-three-hulls.js';
import {createWorlds} from './armada-three-worlds.js';
import {createEffects} from './armada-three-effects.js';
const canvas=document.getElementById('gl'),status=document.getElementById('stat');
let renderer,systems=[],lastGen=-1,frames=0;
const app=window.ArmadaThree={geometryStore:createGeometryStore(),runtime:null,engineSource:'',render:()=>{}};
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(50.42028597,1,.6,1e7);
 const ambient=new THREE.HemisphereLight(0xc8d3df,0x242837,1.2),sun=new THREE.DirectionalLight(0xffeed7,2.2);sun.position.set(.45,.8,.35);scene.add(ambient,sun);
 const target=new THREE.Vector3(),size=new THREE.Vector2();
 app.render=state=>{
   if(!systems.length)return;
   renderer.getSize(size);if(size.x!==state.width||size.y!==state.height)renderer.setSize(state.width,state.height,false);
   camera.aspect=state.width/Math.max(1,state.height);camera.far=Math.max(state.sceneR*30,Math.hypot(state.cam.ex,state.cam.ey,state.cam.ez)+state.sceneR*20);camera.updateProjectionMatrix();
   const c=state.cam;camera.position.set(c.ex,c.ey,c.ez);const cp=Math.cos(c.pitch);target.set(c.ex+Math.cos(c.yaw)*cp,c.ey+Math.sin(c.pitch),c.ez+Math.sin(c.yaw)*cp);camera.lookAt(target);camera.updateMatrixWorld();
   state.camera=camera;state.renderer=renderer;
   for(const system of systems)system.update(state);
   renderer.render(scene,camera);frames++;lastGen=state.genId;
 };
 app.engineSource=await (await fetch('./armada-three-engine.js')).text();
 const script=document.createElement('script');script.textContent=app.engineSource;document.body.append(script);
 if(!app.runtime)throw Error('Battle runtime failed to initialize');
 systems=[createWorlds(THREE,scene,app.runtime),createHulls(THREE,scene,app.runtime),createEffects(THREE,scene,app.runtime)];
 app.diagnostics=()=>({renderer:'Three.js '+THREE.REVISION,frames,generation:lastGen,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,points:renderer.info.render.points,memory:{...renderer.info.memory},systems:systems.map(s=>s.stats?.()),state:{ships:app.runtime.state().ships.length,now:app.runtime.state().now}});
 addEventListener('pagehide',()=>{for(const s of systems)s.dispose();renderer.dispose()},{once:true});
}catch(error){console.error(error);status.textContent='THREE.JS COULD NOT START · '+error.message;const notice=document.createElement('div');notice.setAttribute('role','alert');notice.style.cssText='position:fixed;top:20px;left:20px;z-index:9999;padding:20px;background:#161c26;color:#f0d7c8;max-width:70vw';notice.textContent='The Three.js battle could not start. '+error.message;document.body.append(notice);}
