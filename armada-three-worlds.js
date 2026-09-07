/* Physical celestial scenery for the Three.js port. World centers/radii remain
   owned by ArmadaSystems so the renderer and swept planet collisions agree. */
const worldVertex = `
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vNormal;
  void main(){
    vLocal=position;
    vec4 world=modelMatrix*vec4(position,1.0);
    vWorld=world.xyz;
    vNormal=normalize(mat3(modelMatrix)*normal);
    gl_Position=projectionMatrix*viewMatrix*world;
  }`;
const noiseShader = `
  float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.17,.23));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float n=0.0,w=.55;for(int i=0;i<4;i++){n+=w*noise(p);p=p*2.04+vec3(7.3,3.1,5.7);w*=.48;}return n;}
`;
const worldFragment = `
  precision highp float;
  varying vec3 vLocal; varying vec3 vWorld; varying vec3 vNormal;
  uniform vec3 uBase,uAccent,uLight;
  uniform float uKind,uPhase,uBands,uTime;
  uniform sampler2D uTerrain;
  ${noiseShader}
  void main(){
    vec3 p=normalize(vLocal), n=normalize(vNormal);
    vec3 q=p*4.0+vec3(uPhase,0.0,uPhase*.7);
    vec2 terrainUV=vec2(atan(p.z,p.x)/6.28318530718+.5,acos(clamp(p.y,-1.0,1.0))/3.14159265359);
    vec4 detail=texture2D(uTerrain,terrainUV);
    float terrain=detail.r, fine=detail.g;
    vec3 color=mix(uBase,uAccent,smoothstep(.22,.72,terrain));
    if(uKind<.5){
      float band=sin(p.y*uBands*8.0+detail.b*4.0);
      color=mix(uBase,uAccent,.38+.17*band+.15*terrain);
    }else if(uKind>1.5 && uKind<2.5){
      float land=smoothstep(.46,.52,terrain);
      color=mix(uBase*(.82+.3*fine),uAccent*(.83+.22*fine),land);
      float clouds=smoothstep(.60,.76,detail.b);
      color=mix(color,vec3(.62,.66,.67),clouds*.62);
      float ice=smoothstep(.86,.99,abs(p.y)+terrain*.06);
      color=mix(color,vec3(.64,.68,.69),ice*.7);
    }else if(uKind>2.5 && uKind<3.5){
      color=mix(uBase,uAccent,.35+terrain*.48);
    }else if(uKind>3.5 && uKind<4.5){
      float seams=1.0-smoothstep(.014,.04,abs(terrain-.49));
      color=mix(uBase*(.76+terrain*.4),uAccent,seams*.5);
    }else if(uKind>4.5){
      float cell=detail.a;
      color=mix(uBase,uAccent,.45+cell*.5);
      float limb=pow(max(0.0,dot(n,normalize(cameraPosition-vWorld))),.25);
      gl_FragColor=vec4(color*(.7+.35*limb),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      return;
    }
    float lit=dot(n,normalize(uLight));
    float diffuse=smoothstep(-.08,.94,lit);
    color*=.035+.94*diffuse;
    if(uKind>3.5 && uKind<4.5){
      float lava=(1.0-smoothstep(.008,.023,abs(terrain-.49)))*.15;
      color+=uAccent*lava;
    }
    gl_FragColor=vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const atmosphereFragment = `
  varying vec3 vWorld; varying vec3 vNormal;
  uniform vec3 uColor,uLight;
  uniform float uStar;
  void main(){
    float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld))),3.2);
    float day=mix(.13,smoothstep(-.3,.5,dot(normalize(vNormal),normalize(uLight))),.87);
    float alpha=rim*mix(day*.22,.18,uStar);
    gl_FragColor=vec4(uColor,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const ringFragment = `
  varying vec3 vLocal; varying vec3 vWorld;
  uniform vec3 uColor,uLight,uCenter;
  uniform float uRadius,uOuter;
  void main(){
    float r=length(vLocal.xy);
    float band=.7+.12*sin(r*190.0)+.08*sin(r*73.0);
    float edge=smoothstep(1.22,1.27,r)*(1.0-smoothstep(uOuter-.08,uOuter,r));
    vec3 toWorld=vWorld-uCenter, light=normalize(uLight);
    float behind=dot(toWorld,light);
    float across=length(toWorld-light*behind);
    float shadow=behind<0.0?smoothstep(uRadius*.97,uRadius*1.025,across):1.0;
    gl_FragColor=vec4(uColor*(.12+.63*shadow),edge*band*.43);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
function seeded(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function createWorlds(THREE,scene,runtime){
  const group=new THREE.Group(), sky=new THREE.Group();
  group.name='Physical star system';sky.name='Distant stars and galactic dust';scene.add(group,sky);
  const sphere=new THREE.SphereGeometry(1,64,40);
  let generation=null, bodiesRef=null, scale=1, worlds=[], assets=[], disposed=false, counts={bodies:0,rings:0,stars:0,dust:0};
  function clean(){
    group.clear();sky.clear();for(const a of assets)a.dispose();assets=[];worlds=[];
  }
  function own(asset){assets.push(asset);return asset;}
  function material(fragment,uniforms,extra={}){return own(new THREE.ShaderMaterial({vertexShader:worldVertex,fragmentShader:fragment,uniforms,...extra}));}
  // Bake procedural detail once. Lighting and spherical world geometry remain live.
  function terrainMap(renderer,phase,kind){
    const target=own(new THREE.WebGLRenderTarget(512,256,{minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true,depthBuffer:false,stencilBuffer:false}));
    target.texture.wrapS=THREE.RepeatWrapping;
    const geometry=new THREE.PlaneGeometry(2,2),mat=new THREE.ShaderMaterial({toneMapped:false,
      uniforms:{uPhase:{value:phase},uKind:{value:kind}},
      vertexShader:'varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`varying vec2 vUV;uniform float uPhase,uKind;${noiseShader}
      void main(){float lon=(vUV.x-.5)*6.28318530718,lat=vUV.y*3.14159265359;
        vec3 p=vec3(cos(lon)*sin(lat),cos(lat),sin(lon)*sin(lat));
        if(uKind<0.){gl_FragColor=vec4(fbm(p*8.+uPhase));return;}
        vec3 q=p*4.+vec3(uPhase,0.,uPhase*.7);
        gl_FragColor=vec4(fbm(q),noise(q*12.),uKind<.5?fbm(q*1.7):fbm(q*1.65+vec3(0.,3.,0.)),fbm(q*3.));}`});
    const bake=new THREE.Scene();bake.add(new THREE.Mesh(geometry,mat));
    const previous=renderer.getRenderTarget();
    try{renderer.setRenderTarget(target);renderer.render(bake,new THREE.Camera());}finally{renderer.setRenderTarget(previous);geometry.dispose();mat.dispose();}
    return target.texture;
  }
  function rebuild(state){
    clean();generation=state.genId;bodiesRef=state.worldBodies;scale=Math.max(1,state.sceneR||1000);
    const system=state.starSystem||{}, bodies=state.worldBodies||[];
    const light=system.light||[-3,5,1];
    counts={bodies:bodies.length,rings:0,stars:0,dust:0};
    for(const body of bodies){
      const center=body.center||[0,0,0],radius=body.radius;
      if(!(radius>0))continue;
      const lightVector=new THREE.Vector3(...light).multiplyScalar(scale).sub(new THREE.Vector3(...center));
      if(lightVector.lengthSq()<1)lightVector.set(0,1,0);
      const common={uLight:{value:lightVector}};
      const m=material(worldFragment,{...common,uTerrain:{value:terrainMap(state.renderer,body.phase||0,body.kind||0)},uBase:{value:new THREE.Color(...(body.base||[.3,.34,.38]))},uAccent:{value:new THREE.Color(...(body.accent||[.45,.48,.5]))},uKind:{value:body.kind||0},uPhase:{value:body.phase||0},uBands:{value:body.bands||5},uTime:{value:0}});
      const mesh=new THREE.Mesh(sphere,m);mesh.position.fromArray(center);mesh.scale.setScalar(radius);mesh.rotation.z=body.tilt||0;mesh.name=body.name||'World';group.add(mesh);
      const atmosphere=material(atmosphereFragment,{...common,uColor:{value:new THREE.Color(...(body.kind===5?body.base:[.35,.49,.62]))},uStar:{value:body.kind===5?1:0}},{transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending});
      const halo=new THREE.Mesh(sphere,atmosphere);halo.position.copy(mesh.position);halo.scale.setScalar(radius*(body.kind===5?1.085:1.017));group.add(halo);
      worlds.push({mesh,material:m,phase:body.phase||0});
      if(body.rings){
        const outer=1.85+.22*Math.sin(body.phase||0),geometry=own(new THREE.RingGeometry(1.22,outer,128,1));
        const rm=material(ringFragment,{...common,uColor:{value:new THREE.Color(...(body.accent||[.45,.43,.4]))},uCenter:{value:mesh.position.clone()},uRadius:{value:radius},uOuter:{value:outer}},{transparent:true,depthWrite:false,side:THREE.DoubleSide});
        const ring=new THREE.Mesh(geometry,rm);ring.position.copy(mesh.position);ring.scale.setScalar(radius);ring.rotation.x=Math.PI/2+(body.tilt||0);ring.rotation.y=.45;group.add(ring);counts.rings++;
      }
    }
    const random=seeded((system.seed||1)^0x57A2), count=system.starCount||2400;
    const positions=new Float32Array(count*3),sizes=new Float32Array(count),colors=new Float32Array(count*3);
    const tint=system.starTint||[.8,.87,1];
    for(let i=0;i<count;i++){
      const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y),distance=scale*18;
      positions.set([Math.cos(a)*r*distance,y*distance,Math.sin(a)*r*distance],i*3);
      sizes[i]=random()<.075?2.0+random():.65+random()*1.1;
      const brightness=.35+random()*.5;colors.set(tint.map(c=>c*brightness),i*3);
    }
    const starsGeometry=own(new THREE.BufferGeometry());starsGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));starsGeometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));starsGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const starsMaterial=own(new THREE.ShaderMaterial({vertexColors:true,depthWrite:false,transparent:true,
      vertexShader:`attribute float aSize;varying vec3 vColor;void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize;}`,
      fragmentShader:`varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);float a=1.0-smoothstep(.05,.5,d);gl_FragColor=vec4(vColor,a);
      #include <colorspace_fragment>
      }`}));
    const stars=new THREE.Points(starsGeometry,starsMaterial);stars.frustumCulled=false;stars.renderOrder=-2;sky.add(stars);counts.stars=count;
    // One inexpensive sky dome replaces hundreds of overdraw-heavy dust sprites.
    if(random()<.42){
      const dust=own(new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
        uniforms:{uTerrain:{value:terrainMap(state.renderer,random()*6.28,-1)}},vertexShader:worldVertex,
        fragmentShader:`varying vec3 vLocal;uniform sampler2D uTerrain;
          void main(){vec3 p=normalize(vLocal);float latitude=p.y*.75+p.z*.43+p.x*.2;
          float lane=exp(-pow((abs(latitude)-.055)*17.0,2.0));float clouds=texture2D(uTerrain,vec2(atan(p.z,p.x)/6.28318530718+.5,acos(clamp(p.y,-1.,1.))/3.14159265359)).r;
          gl_FragColor=vec4(.31,.36,.44,lane*clouds*.065);}` }));
      const dome=new THREE.Mesh(sphere,dust);dome.scale.setScalar(scale*17);dome.renderOrder=-3;dome.frustumCulled=false;sky.add(dome);counts.dust=1;
    }
  }
  return {
    update(state){
      if(disposed)return;
      if(state.genId!==generation||state.worldBodies!==bodiesRef||Math.max(1,state.sceneR||1000)!==scale)rebuild(state);
      const now=state.now||0;
      for(const w of worlds){w.material.uniforms.uTime.value=now;w.mesh.rotation.y=now*.002+w.phase;}
      const cam=state.cam||{};sky.position.set(cam.ex||0,cam.ey||0,cam.ez||0);
    },
    dispose(){if(disposed)return;disposed=true;clean();sphere.dispose();scene.remove(group,sky);},
    stats(){return {...counts};}
  };
}
