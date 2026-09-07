/** Three.js fleet rendering. Simulation ownership stays in the battle engine. */
export function createHulls(THREE,scene,runtime){
  const root=new THREE.Group();root.name='fleets';scene.add(root);
  const geometryCache=new Map(),near=new Map(),batches=new Map(),debris=new Map();
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),axis=new THREE.Vector3(),quat=new THREE.Quaternion(),yawQ=new THREE.Quaternion(),direction=new THREE.Vector3(),color=new THREE.Color();
  const frustum=new THREE.Frustum(),viewProjection=new THREE.Matrix4(),bounds=new THREE.Sphere();
  let generation=null,counts={ships:0,individual:0,instanced:0,turrets:0,wrecks:0};
  const vertex=`uniform vec4 uAnim;uniform float uT;varying vec3 vLocal;varying vec3 vWorld;
void main(){vec3 p=position;vLocal=position;
  if(uAnim.x>4.5){
    float S=max(4.0,uAnim.z),t=uT*uAnim.w+uAnim.y;
    float w=max(smoothstep(.20,.48,-p.x/S),smoothstep(.14,.32,abs(p.z)/S));
    p.y+=sin(t+p.x/S*9.0+p.z/S*4.0)*w*w*S*.012;
    p.z+=cos(t*.8+p.x/S*7.0)*w*w*S*.008;
  }else if(uAnim.x>3.5){
    // Smoothly anchored roots, travelling bends toward each free tentacle tip.
    float S=max(4.0,uAnim.z),r=length(p)/S;
    float w=smoothstep(0.24,0.52,r);
    float t=uT*uAnim.w+uAnim.y;
    float phase=atan(p.z,p.x)*2.0+r*8.0;
    p.y+=sin(t+phase)*w*w*S*0.025;
    p.z+=cos(t*0.83+phase)*w*w*S*0.018;
  }else if(uAnim.x>2.5){
    /* earthforce spins her gravity ring: everything inside the band turns
       about the keel at one steady rate — the builder keeps the band clear
       of anything that is not ring or spoke, and the spine, being a body
       of revolution, turns without seeming to */
    float w2=abs(p.x-uAnim.y);
    if(w2<uAnim.z){
      float a=uT*uAnim.w;
      float c=cos(a),s3=sin(a);
      p=vec3(p.x,p.y*c-p.z*s3,p.y*s3+p.z*c);
    }
  }else if(uAnim.x>1.5){
    /* the choir luffs: no body-swim, no breathing — only a tip-weighted
       shimmer at double frequency, canvas in a light air */
    float S=uAnim.z;
    float t=uT*uAnim.w*2.0+uAnim.y;
    float ex=clamp(max(abs(p.z),abs(p.y))/S,0.0,1.6);
    p.y+=sin(t+p.x/S*2.4)*ex*ex*S*0.08;
    p.z+=cos(t*1.3+p.y/S*2.0)*ex*ex*S*0.04;
  }else if(uAnim.x>0.0){
    float S=uAnim.z;
    float t=uT*uAnim.w+uAnim.y;
    float zn=clamp(abs(p.z)/S,0.0,1.6);
    p.y+=sin(t)*zn*zn*S*0.20*uAnim.x;
    p.y+=sin(p.x/S*3.2-t*1.7)*S*0.05*uAnim.x;
    /* and the tentacles waggle: a serpentine wave that grows toward any
       extremity, so trailing arms whip as she swims */
    float rn=length(p)/S;
    float wag=max(0.0,rn-0.45);
    p.z+=sin(t*1.9+rn*7.0+p.x/S*2.0)*wag*wag*S*0.15*uAnim.x;
    p.y+=cos(t*1.6+rn*6.0)*wag*wag*S*0.09*uAnim.x;
    float br=1.0+0.045*uAnim.x*sin(t*0.9+p.x/S*2.2);
    p.y*=br;p.z*=br;
  }

vec4 world=modelMatrix*vec4(p,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
  const fragment=`precision highp float;uniform vec3 uInk,uTrim;uniform vec4 uPaint;uniform float uPattern,uLength,uOpacity,uHurt,uDead;uniform vec3 uOffset;varying vec3 vLocal;varying vec3 vWorld;
void main(){vec3 N=normalize(cross(dFdx(vWorld),dFdy(vWorld)));float shade=.40+.58*abs(dot(N,normalize(vec3(.45,.8,.35))));vec3 p=(vLocal+uOffset)/max(1.,uLength);
    vec3 q=p*vec3(19.0,29.0,23.0),cell=floor(q);
    float hash=fract(sin(dot(cell,vec3(17.13,31.7,73.9))+uPaint.y*19.0)*43758.5);
    float panel=smoothstep(.70,.76,hash),mask=panel*.22;
    float stripe=1.0-smoothstep(.009,.018,abs(abs(p.z)-max(.035,uPaint.z*.22)));
    float style=uPattern;
    if(style>0.5&&style<1.5)mask=max(mask,stripe*.85);
    else if(style<2.5&&style>1.5){float wave=sin(p.x*29.0+sin(p.z*21.0)*2.2+p.y*17.0);mask=smoothstep(-.1,.7,wave)*.60;}
    else if(style<3.5&&style>2.5)mask=smoothstep(.45,.55,hash)*.60;
    else if(style<4.5&&style>3.5)mask=smoothstep(.58,.70,fract(length(p.yz)*43.0+p.x*9.0))*.65;
    else if(style<5.5&&style>4.5)mask=smoothstep(uPaint.z*.20,uPaint.z*.26,abs(p.z))*.98;
    else if(style<6.5&&style>5.5)mask=max(stripe*.90,smoothstep(.30,.32,p.x)*(1.0-smoothstep(.06,.11,abs(p.z)))*.50);
    else if(style<7.5&&style>6.5)mask=max(panel*.3,smoothstep(.08,.15,abs(p.z))*(1.0-smoothstep(-.08,.04,p.x))*.65);
    else if(style<8.5&&style>7.5)mask=max(panel*.4,stripe*.8);
    else if(style<9.5&&style>8.5)mask=step(.5,fract(p.x*22.0)+fract(p.z*22.0))*stripe;
    // Tesla masks follow local anatomy: visor / joints, tyres / cabin,
    // rocket interstage. One material pass, no extra meshes or textures.
    if(style>9.5&&style<10.5)mask=max(step(.48,p.y)*step(-.17,p.x),max(step(p.y,-.20)*.85,step(.29,abs(p.z))*.8));
    if(style>10.5&&style<11.5)mask=max(step(abs(abs(p.x)-.28),.085)*step(p.y,-.07)*step(.14,abs(p.z)),step(.025,p.y)*step(abs(p.x),.20));
    if(style>11.5&&style<12.5)mask=max((1.0-smoothstep(.015,.023,abs(p.x-.18)))*.95,step(.47,-p.x));
    if(style>12.5&&style<13.5)mask=step(.01,p.y)*.94;
    if(style>13.5&&style<14.5)mask=smoothstep(-.005,.055,p.y)*.94;
    if(style>14.5&&style<15.5){
      // Chapter enamel on armour; graphite machinery and recessed launch decks.
      mask=max((1.0-smoothstep(-.20,-.13,p.y))*.65,(1.0-smoothstep(.02,.045,abs(p.y+.105)))*step(abs(p.x),.22)*step(.04,abs(p.z))*.6);
    }
    float paintStrength=(style>9.5&&style<14.5)||style==5.0?.72:.34;
    float registration=step(.16+uPaint.y*.12,p.x)*step(p.x,.25+uPaint.y*.12);
    if(style<9.5)mask*=mix(.55,1.0,registration);
    vec3 pigment=mix(uInk,uTrim,clamp(mask*paintStrength,0.0,.78));
    if(style>14.5&&style<15.5){
      float badge=step(.25,p.x)*step(p.x,.38)*step(-.025,p.y)*max(step(abs(p.z),.009),step(abs(p.x-.31),.012)*step(abs(p.z),.037));
      pigment=mix(pigment,vec3(.73,.71,.63),badge*.35);
    }
    if(style>10.5&&style<11.5&&p.y>.075&&abs(p.z)<.135&&p.x<.04) pigment=vec3(.82,.85,.86);

float grain=fract(sin(dot(floor(vLocal*1.4),vec3(12.9898,78.233,43.21)))*43758.5453);if(grain>uOpacity)discard;
vec3 lit=pigment*shade*(1.-uDead*.36);lit+=vec3(.9,.25,.07)*uHurt*.35;gl_FragColor=vec4(lit,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
  function geometry(vao,lit=false){
    const src=runtime.geometry(vao);if(!src||!src.v?.length)return null;
    let item=geometryCache.get(vao);if(item&&item.version===src.version){if(lit&&!item.geo.getAttribute('normal'))item.geo.computeVertexNormals();return item.geo;}
    if(item)item.geo.dispose();
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(src.v,3));
    if(src.i?.length)geo.setIndex(new THREE.BufferAttribute(src.i,1));
    if(lit)geo.computeVertexNormals();geo.computeBoundingSphere();
    geometryCache.set(vao,{geo,version:src.version});return geo;
  }
  function material(){return new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,side:THREE.DoubleSide,uniforms:{uAnim:{value:new THREE.Vector4()},uT:{value:0},uInk:{value:new THREE.Color()},uTrim:{value:new THREE.Color()},uPaint:{value:new THREE.Vector4()},uPattern:{value:0},uLength:{value:1},uOpacity:{value:1},uHurt:{value:0},uDead:{value:0},uOffset:{value:new THREE.Vector3()}}});}
  function finishMaterial(mat,s,state,dead=false){
    const f=s.paint||s.finish||(s.finish=runtime.hullFinish(s)),u=mat.uniforms,gain=[1,.72,1,.72,.68][state.palI||0];
    u.uInk.value.setRGB(...f.color).convertSRGBToLinear().multiplyScalar(gain);u.uTrim.value.setRGB(...f.trim).convertSRGBToLinear().multiplyScalar(gain);
    u.uPaint.value.set(f.gloss,f.seed,(s.meta?.beam||s.exZ*2||s.slen*.3)/(s.slen||1),(s.meta?.height||s.exY*2||s.slen*.2)/(s.slen||1));
    u.uPattern.value=f.pattern;u.uLength.value=s.paintLength||s.slen||s.rad*2||20;
    u.uOffset.value.fromArray(s.paintOffset||[0,0,0]);u.uT.value=state.now;
    u.uOpacity.value=Math.min(s.dustT?Math.max(0,1-(state.now-s.dustT)/(s.dustDur||4)):1,1-(s.cloakAmt||0)*.96);
    u.uHurt.value=Math.exp(-Math.max(0,state.now-(s.hurtT||-100))*7);u.uDead.value=dead?1:0;
    const am=dead?0:runtime.raceDefs?.[s.race]?.anim||0;
    u.uAnim.value.set(am,am===3?s.ringX||0:s.wf||0,am===3?s.ringW||0:Math.max(4,(s.slen||20)*(am>3?1:.35)),am===5?.65:am===4?.85:am===3?.55:Math.min(6,1.3+30/(s.slen||20)));
  }
  function transform(s,now,age,k=1,kind='ship'){
    let pose=runtime.xPose(s,now);
    if(kind==='wreck'){
      pose=s.pending?{ax:s.fAx||[0,1,0],ang:s.fAng||0}:runtime.xQAA?runtime.xQAA(s.bax||[0,1,0],s.bang||0,s.ax||[0,1,0],s.ang??(s.spin||0)*(now-s.t0)):{ax:s.ax||[0,1,0],ang:s.ang||0};
    }else if(s.dead)pose={ax:s.dax||[0,1,0],ang:(s.dang||0)+(now-(s.deadT||now))*(s.corpseSpin??.4)};
    axis.fromArray(pose.ax);quat.setFromAxisAngle(axis,pose.ang||0);yawQ.setFromAxisAngle(axis.set(0,1,0),-(s.yaw||0));quat.premultiply(yawQ);
    const slide=!s.dead&&kind==='ship'?(runtime.slide??320)*Math.exp(-Math.max(0,age)*3.4):0;
    position.set((s.x||0)-Math.cos(s.yaw||0)*slide,s.y||0,(s.z||0)-Math.sin(s.yaw||0)*slide);scale.setScalar(k);matrix.compose(position,quat,scale);return matrix;
  }
  function individual(map,key,s,state,age,kind='ship'){
    const geo=geometry(s.vao);if(!geo)return;
    let mesh=map.get(key);if(!mesh){mesh=new THREE.Mesh(geo,material());mesh.matrixAutoUpdate=false;mesh.name=kind;mesh.userData.shipId=s.id;root.add(mesh);map.set(key,mesh);}
    mesh.geometry=geo;mesh.visible=true;mesh.userData.seen=true;
    mesh.matrix.copy(transform(s,state.now,age,1,kind));mesh.matrixWorldNeedsUpdate=true;finishMaterial(mesh.material,s,state,kind!=='ship'||s.dead);
    if(kind==='ship'){mesh.material.uniforms.uOpacity.value*=s.dead?1:Math.min(1,age/.3);counts.individual++;}else counts.wrecks++;
  }
  function batch(s,state){
    const hull=s.farHull,geo=geometry(hull.vao,true);if(!geo)return false;
    let item=batches.get(hull.vao);
    if(!item){const mat=new THREE.MeshLambertMaterial({color:0xffffff,side:THREE.DoubleSide});item={mat,mesh:null,geo,members:[]};batches.set(hull.vao,item);}
    item.geo=geo;item.members.push(s);return true;
  }
  const turretGeo=new THREE.CylinderGeometry(1,1,1,6,1);turretGeo.rotateZ(-Math.PI/2);turretGeo.translate(.5,0,0);
  const turretMat=new THREE.MeshLambertMaterial({color:0x777d83});
  let turrets=null,turretCapacity=0;const turretRecords=[];
  function drawTurrets(state){
    const n=turretRecords.length;counts.turrets=n;if(!n){if(turrets)turrets.count=0;return;}
    if(n>turretCapacity){if(turrets){root.remove(turrets);turrets.dispose();}turretCapacity=2**Math.ceil(Math.log2(n));turrets=new THREE.InstancedMesh(turretGeo,turretMat,turretCapacity);turrets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);turrets.frustumCulled=false;root.add(turrets);}
    for(let i=0;i<n;i++){const f=turretRecords[i];position.fromArray(f.pivot);quat.setFromUnitVectors(axis.set(1,0,0),direction.fromArray(f.dir).normalize());scale.set(f.length,f.radius,f.radius);matrix.compose(position,quat,scale);turrets.setMatrixAt(i,matrix);}
    turrets.count=n;turrets.instanceMatrix.needsUpdate=true;
  }
  function reset(){
    for(const map of [near,debris]){for(const mesh of map.values()){root.remove(mesh);mesh.material.dispose();}map.clear();}
    for(const b of batches.values()){if(b.mesh){root.remove(b.mesh);b.mesh.dispose();}b.mat.dispose();}batches.clear();
    for(const {geo} of geometryCache.values())geo.dispose();geometryCache.clear();
    if(turrets)turrets.count=0;
  }
  function update(state){
    if(generation!==state.genId){reset();generation=state.genId;}
    counts={ships:0,individual:0,instanced:0,turrets:0,wrecks:0,culled:0};turretRecords.length=0;
    if(state.camera)frustum.setFromProjectionMatrix(viewProjection.multiplyMatrices(state.camera.projectionMatrix,state.camera.matrixWorldInverse));
    for(const map of [near,debris])for(const mesh of map.values()){mesh.visible=false;mesh.userData.seen=false;}
    for(const b of batches.values())b.members.length=0;
    const now=state.now,height=state.height||900,cam=state.cam;
    for(const s of state.ships){
      if(!s.vao||s.id===state.pilotId)continue;const age=now-state.warT0-(s.delay||0);
      if(!s.dead&&age<0)continue;if(s.dustT&&now-s.dustT>=(s.dustDur||4))continue;
      // Cull individual instances before filling shared batches. Three cannot
      // cull members of an InstancedMesh independently.
      const slide=s.dead?0:(runtime.slide??320)*Math.exp(-Math.max(0,age)*3.4);
      bounds.center.set(s.x-Math.cos(s.yaw||0)*slide,s.y,s.z-Math.sin(s.yaw||0)*slide);
      bounds.radius=Math.max(s.slen||20,Math.hypot(s.exL||0,s.exY||0,s.exZ||0)*1.3);
      if(state.camera&&!frustum.intersectsSphere(bounds)){counts.culled++;continue;}
      const distance=Math.hypot(s.x-cam.ex,s.y-cam.ey,s.z-cam.ez),pixels=(s.slen||20)*.55*height/Math.max(1,distance*.942);
      const threshold=state.ships.length>500?48:28;s.coarseHull=pixels<threshold*(s.coarseHull?1.15:.85);
      const coarse=!s.dead&&s.coarseHull&&s.farHull&&s.id!==state.selected&&!s.hero&&!s.damageStage&&(s.cloakAmt||0)<.04&&age>2;
      counts.ships++;if(coarse&&batch(s,state)){counts.instanced++;continue;}
      individual(near,s.id,s,state,age);
      if(!s.dead&&s.arr&&!s.grace&&age>1&&(s.cloakAmt||0)<.9&&pixels>20){for(const muz of runtime.shipBarrels(s)){if(turretRecords.length>=8192)break;const f=runtime.barrelFrame(s,muz,now);if(f.length>0)turretRecords.push(f);}}
    }
    for(const b of batches.values()){
      const n=b.members.length;if(!n){if(b.mesh)b.mesh.count=0;continue;}
      if(!b.mesh||b.mesh.instanceMatrix.count<n){if(b.mesh){root.remove(b.mesh);b.mesh.dispose();}b.mesh=new THREE.InstancedMesh(b.geo,b.mat,2**Math.ceil(Math.log2(n)));b.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);b.mesh.frustumCulled=false;root.add(b.mesh);}
      b.mesh.geometry=b.geo;b.mesh.count=n;
      for(let i=0;i<n;i++){const s=b.members[i],f=s.finish||(s.finish=runtime.hullFinish(s));b.mesh.setMatrixAt(i,transform(s,now,now-state.warT0-(s.delay||0),(s.slen||1)/(s.farHull.length||1)));color.setRGB(...f.color).convertSRGBToLinear().multiplyScalar([1,.72,1,.72,.68][state.palI||0]);b.mesh.setColorAt(i,color);}
      b.mesh.instanceMatrix.needsUpdate=true;if(b.mesh.instanceColor)b.mesh.instanceColor.needsUpdate=true;
    }
    for(const w of state.wrecks||[]){if(w.gone||!w.vao||(w.dustT&&now-w.dustT>=(w.dustDur||4)))continue;individual(debris,w,w,state,0,'wreck');}
    for(const b of state.boneyard||[]){if(!b.vao)continue;const geo=geometry(b.vao);if(!geo)continue;const t=now-(b.t0||now);individual(debris,b,{...b,x:(b.dvx||0)*t,y:(b.dvy||0)*t,z:(b.dvz||0)*t,race:0,dead:true},state,0,'boneyard');}
    const liveIds=new Set(state.ships.filter(s=>s.vao).map(s=>s.id));
    for(const [key,mesh] of near)if(!mesh.userData.seen&&!liveIds.has(key)){root.remove(mesh);mesh.material.dispose();near.delete(key);}
    for(const [key,mesh] of debris)if(!mesh.userData.seen){root.remove(mesh);mesh.material.dispose();debris.delete(key);}
    drawTurrets(state);
    // GPU resources follow native VAO disposal, including replaced damage meshes.
    const used=new Set();for(const s of state.ships){if(s.vao)used.add(s.vao);if(s.farHull?.vao)used.add(s.farHull.vao);}for(const s of [...state.wrecks||[],...state.boneyard||[]])if(s.vao)used.add(s.vao);
    for(const [key,value] of geometryCache)if(!used.has(key)){value.geo.dispose();geometryCache.delete(key);}
  }
  return {update,stats:()=>({...counts,geometries:geometryCache.size,batches:batches.size}),dispose(){reset();if(turrets){root.remove(turrets);turrets.dispose();}turretGeo.dispose();turretMat.dispose();scene.remove(root);}};
}
