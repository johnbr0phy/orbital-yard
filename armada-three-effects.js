/* Three.js visual projection of the existing combat state. No simulation rules
 * live here. Two reusable buffers render all weapons and particles, regardless
 * of fleet size; actual hulls and wreckage are handled by the hull renderer. */
export function createEffects(THREE, scene, runtime = {}) {
  const MAX_RIBBONS = 12000, MAX_POINTS = 4096;
  const ribbons = new THREE.BufferGeometry(), particles = new THREE.BufferGeometry();
  const pos = new Float32Array(MAX_RIBBONS * 18), rgb = new Float32Array(MAX_RIBBONS * 18);
  const alpha = new Float32Array(MAX_RIBBONS * 6);
  const ppos = new Float32Array(MAX_POINTS * 3), data = new Float32Array(MAX_POINTS * 4);
  const prgb = new Float32Array(MAX_POINTS * 3), seeds = new Float32Array(MAX_POINTS);
  function attr(g, name, values, size) { g.setAttribute(name, new THREE.BufferAttribute(values, size).setUsage(THREE.DynamicDrawUsage)); }
  attr(ribbons, 'position', pos, 3); attr(ribbons, 'color', rgb, 3); attr(ribbons, 'opacity', alpha, 1);
  attr(particles, 'position', ppos, 3); attr(particles, 'params', data, 4); attr(particles, 'color', prgb, 3); attr(particles, 'seed', seeds, 1);
  const beamMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec3 color;attribute float opacity;varying vec3 c;varying float a;
      void main(){c=color;a=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 c;varying float a;void main(){gl_FragColor=vec4(c,a);}`
  });
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {pixelScale: {value: 900}},
    vertexShader: `attribute vec4 params;attribute vec3 color;attribute float seed;uniform float pixelScale;
      varying vec4 p;varying vec3 c;varying float vSeed;void main(){p=params;c=color;vSeed=seed;vec4 v=modelViewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*v;gl_PointSize=clamp(params.x*pixelScale/max(1.,-v.z),1.,240.);
      if(v.z>0.)gl_PointSize=0.;}`,
    fragmentShader: `varying vec4 p;varying vec3 c;varying float vSeed;
      void main(){vec2 d=gl_PointCoord-.5;float r=length(d)*2.;float ang=atan(d.y,d.x);
      float k=p.z;float age=p.w;float a=p.y;vec3 col=c;
      if(k>=10.&&k<20.){
        float lobe=.84+.10*sin(ang*5.+vSeed*37.)+.06*sin(ang*9.-age*3.);r/=lobe;
        if(k>12.5&&k<13.5)r=mix(r,max(abs(d.x),abs(d.y))*2.,.55);
        float grain=.72+.28*sin(d.x*37.+vSeed*31.)*sin(d.y*29.-age*5.);
        float core=exp(-r*r*20.)*exp(-age*12.);float gas=exp(-r*r*4.)*grain*(1.-age);
        col=mix(c,vec3(1.,.97,.90),core);a*=core+gas*.65;
      }else if(k>=20.){
        float core=exp(-r*r*20.);col=mix(c,vec3(.92,.98,1.),core);
        a*=exp(-r*r*6.);
      }else if(k>1.5){
        r/=.8+.15*sin(ang*(3.+floor(vSeed*4.))+vSeed*43.);
        col=mix(vec3(1.,.97,.88),c,min(1.,age*1.4));a*=exp(-r*r*5.);
      }else a*=exp(-r*r*7.);
      if(r>1.||a<.005)discard;gl_FragColor=vec4(col,a);}`
  });
  const beamMesh = new THREE.Mesh(ribbons, beamMaterial), pointMesh = new THREE.Points(particles, particleMaterial);
  beamMesh.frustumCulled = pointMesh.frustumCulled = false;
  beamMesh.renderOrder = 20; pointMesh.renderOrder = 21;
  scene.add(beamMesh, pointMesh);
  let n = 0, pn = 0, dropped = 0, camera = null, viewport = 900;
  const scratchA = [0, 0, 0], scratchB = [0, 0, 0], scratchC = [0, 0, 0];
  const WHITE = [1, .97, .91], CYAN = [.23, .62, 1], EMBER = [1, .42, .12], DUST = [.32, .35, .39];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const life = kind => kind >= 10 ? 1.35 : kind > 2.5 ? 2.15 : .8;
  function point(x, y, z, size, color, opacity = 1, kind = 0, age = 0, seed = 0) {
    if (pn >= MAX_POINTS) { dropped++; return; }
    if (!(Number.isFinite(x + y + z + size + opacity)) || size <= 0 || opacity <= .003) return;
    seeds[pn] = seed;
    const at = pn * 3, dt = pn++ * 4;
    ppos[at] = x; ppos[at + 1] = y; ppos[at + 2] = z;
    prgb[at] = color[0]; prgb[at + 1] = color[1]; prgb[at + 2] = color[2];
    data[dt] = size; data[dt + 1] = opacity; data[dt + 2] = kind; data[dt + 3] = age;
  }
  function ribbon(a, b, width, color, opacity) {
    if (n >= MAX_RIBBONS) { dropped++; return; }
    let dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const cx = camera.ex - (a[0] + b[0]) * .5, cy = camera.ey - (a[1] + b[1]) * .5, cz = camera.ez - (a[2] + b[2]) * .5;
    let sx = dy * cz - dz * cy, sy = dz * cx - dx * cz, sz = dx * cy - dy * cx;
    let len = Math.hypot(sx, sy, sz);
    if (len < .001) { sx = -dz; sy = 0; sz = dx; len = Math.hypot(sx, sz); }
    if (len < .001) return;
    const scale = width / len;
    sx *= scale; sy *= scale; sz *= scale;
    const start = n * 18, ai = n++ * 6;
    // Two triangles facing the camera. A continuous world-space strip avoids
    // hardware line-width limits and keeps blasters readable during a chase.
    pos[start]=a[0]+sx;pos[start+1]=a[1]+sy;pos[start+2]=a[2]+sz;
    pos[start+3]=a[0]-sx;pos[start+4]=a[1]-sy;pos[start+5]=a[2]-sz;
    pos[start+6]=b[0]+sx;pos[start+7]=b[1]+sy;pos[start+8]=b[2]+sz;
    pos[start+9]=b[0]+sx;pos[start+10]=b[1]+sy;pos[start+11]=b[2]+sz;
    pos[start+12]=a[0]-sx;pos[start+13]=a[1]-sy;pos[start+14]=a[2]-sz;
    pos[start+15]=b[0]-sx;pos[start+16]=b[1]-sy;pos[start+17]=b[2]-sz;
    for (let j = 0; j < 18; j++) rgb[start+j] = color[j%3];
    alpha.fill(opacity, ai, ai + 6);
  }
  function beam(a, b, width, color, opacity = 1) {
    if (!a || !b || !Number.isFinite(a[0]+a[1]+a[2]+b[0]+b[1]+b[2])) return;
    const distance = Math.hypot(camera.ex-(a[0]+b[0])*.5,camera.ey-(a[1]+b[1])*.5,camera.ez-(a[2]+b[2])*.5);
    width = Math.max(width || 1, Math.min(24, distance / viewport * .7));
    ribbon(a,b,width,color,.35*opacity); ribbon(a,b,width*.28,WHITE,.95*opacity);
  }
  function finish(g, count) {
    g.setDrawRange(0,count);
    for (const a of Object.values(g.attributes)) { a.clearUpdateRanges(); a.addUpdateRange(0,count*a.itemSize); a.needsUpdate = true; }
  }
  function update(state) {
    n=0;pn=0;dropped=0;camera=state.cam||{ex:0,ey:0,ez:0};
    viewport=state.viewportHeight || (typeof window!=='undefined'?window.innerHeight:900);
    particleMaterial.uniforms.pixelScale.value=viewport*.9;
    const now=state.now, defs=state.RACE_DEFS||runtime.RACE_DEFS||[];
    const color=(race,ion=false)=>defs[race]?.[ion?'ion':'beam']||CYAN;
    for (const b of state.beams||[]) {
      const age=now-b.t0;if(age<0||age>(b.life||(b.fo?2.15:b.ion?1.55:b.spark?.42:.6)))continue;
      const col=b.col||color(b.race,b.ion||b.stun);
      if(b.spark){
        let a=b.a,tip=b.b;
        if(b.ejecta){const q=clamp(age/.42,0,1),tail=Math.max(0,q-.12);for(let j=0;j<3;j++){scratchA[j]=a[j]+(tip[j]-a[j])*tail;scratchB[j]=a[j]+(tip[j]-a[j])*q;}a=scratchA;tip=scratchB;}
        beam(a,tip,1,EMBER,.65);continue;
      }
      if(b.arc){
        const steps=b.fo?8:5,jitter=b.fo?110:9;
        let a=b.a;
        for(let j=1;j<=steps;j++){
          const q=j/steps;
          for(let k=0;k<3;k++)scratchC[k]=b.a[k]+(b.b[k]-b.a[k])*q+(j<steps?Math.sin((Math.floor(now*24)+j*13+k*71+b.t0)*1.74)*jitter*.5:0);
          beam(a,scratchC,b.fo?Math.max(10,(b.wid||22)*.5):1.3,col);
          for(let k=0;k<3;k++)scratchA[k]=scratchC[k];a=scratchA;
        }
      }else{
        const decay=b.ion||b.fo?Math.max(.03,1-age/(b.fo?2.15:1.55)):1;
        beam(b.a,b.b,(b.wid||(b.ion?36:b.heavy||b.turbo?8:b.cut?8:2.2))*decay,b.rail?WHITE:col,decay);
      }
    }
    for(const tr of state.tracers||[]){
      if(tr.dead||tr.launch||now<tr.t0)continue;
      const tail=Math.min(Math.max(0,now-tr.t0),tr.energy?.075:.035);
      scratchA[0]=tr.x-tr.vx*tail;scratchA[1]=tr.y-tr.vy*tail;scratchA[2]=tr.z-tr.vz*tail;
      scratchB[0]=tr.x;scratchB[1]=tr.y;scratchB[2]=tr.z;
      beam(scratchA,scratchB,tr.width||1.1,tr.col||color(tr.race));
    }
    for(const ms of state.missiles||[]){
      if(ms.dead||now<(ms.t0||0))continue;
      scratchA[0]=ms.x-ms.vx*.12;scratchA[1]=ms.y-ms.vy*.12;scratchA[2]=ms.z-ms.vz*.12;
      scratchB[0]=ms.x;scratchB[1]=ms.y;scratchB[2]=ms.z;
      beam(scratchA,scratchB,1.5,color(ms.race),.65);point(ms.x,ms.y,ms.z,9,color(ms.race),1,20);
    }
    for(const pl of state.plasmas||[])if(!pl.dead&&now>=pl.t0)point(pl.x,pl.y,pl.z,15+Math.sin(now*9+pl.ph)*3,color(pl.race),1,20);
    for(const mi of state.mines||[])if(!mi.dead)point(mi.x,mi.y,mi.z,6+Math.sin(now*4+(mi.ph||0))*2,color(mi.race),.85,20);
    // Keep explosion cleanup here because it belonged to the old render loop.
    let kept=0;
    for(const f of state.flashes||[]){
      const age=now-f.t0,lifeSpan=life(f.c);
      if(age>=lifeSpan)continue;
      state.flashes[kept++]=f;
      if(age<0)continue;
      const q=age/lifeSpan;
      const opacity=Math.exp(-age*(f.c>=10?3:f.c>2.5?1.8:5))*(1-clamp((q-.7)/.3,0,1));
      const col=f.c===13?[.18,.78,.22]:f.c===12?[.32,.10,.46]:f.c===11?CYAN:f.c>=14?[.28,.62,.9]:f.c>=10?EMBER:f.c===0?(state.BEAMCOL?.[0]||CYAN):f.c===1?(state.BEAMCOL?.[1]||EMBER):f.c===4?CYAN:EMBER;
      point(f.x,f.y,f.z,f.size*(f.c===12?1.1-.7*q:.25+2.6*q),col,opacity,f.c,q,f.seed||0);
    }
    if(state.flashes)state.flashes.length=kept;
    for(const lock of state.ionState||[]){
      if(!lock||now<lock.started)continue;
      const ship=state.ships[lock.gun];if(!ship||ship.dead||!runtime.weaponMuzzle)continue;
      const muzzle=lock.muz||ship.muzzles?.[0]||[0,0,0],p=runtime.weaponMuzzle(ship,muzzle,now);
      const q=clamp((now-lock.started)/Math.max(.001,lock.fire-lock.started),0,1);
      point(...p,clamp((ship.slen||20)*.012,4,42)*(.7+.3*q),CYAN,.18+.82*q,21,q);
    }
    // Engines use actual outlets, and a strict screen-space budget prioritizes
    // nearby ships. No engine work is done for subpixel ports or hidden ships.
    let engineCount=0;
    for(const s of state.ships||[]){
      if(s.dead||s.cloakAmt>.05)continue;
      const age=now-state.warT0-(s.delay||0);if(age<0)continue;
      if(age<1.6){
        const slide=(state.SLIDE||runtime.SLIDE||320)*Math.exp(-age*3.4),c=Math.cos(s.yaw),z=Math.sin(s.yaw);
        scratchA[0]=s.x-c*slide;scratchA[1]=s.y;scratchA[2]=s.z-z*slide;
        scratchB[0]=scratchA[0]-c*Math.min(2400,slide*.7);scratchB[1]=s.y;scratchB[2]=scratchA[2]-z*Math.min(2400,slide*.7);
        beam(scratchA,scratchB,Math.max(2,(s.slen||20)*.012),CYAN,Math.max(0,1-age/1.6)*.55);
      }
      if(engineCount>=320||!s.arr||s.grace||!s.exhaust?.length||!runtime.gunWorld)continue;
      const distance=Math.hypot(s.x-camera.ex,s.y-camera.ey,s.z-camera.ez);
      const throttle=clamp((s.v||0)/Math.max(1,s.spd||1),.18,1.4);
      for(const port of s.exhaust){
        if(engineCount>=320)break;
        if(port[3]*viewport/Math.max(1,distance)<1.2)continue;
        const p=runtime.gunWorld(s,port,now);
        point(...p,port[3]*3.8,CYAN,.8,20);engineCount++;
        scratchA[0]=port[0]-port[3]*(1+throttle)*1.6;scratchA[1]=port[1];scratchA[2]=port[2];
        const tail=runtime.gunWorld(s,scratchA,now);
        beam(p,tail,port[3]*.7,CYAN,.5);
      }
    }
    // Dust is deliberately last: saturated particle budgets never hide fire.
    for(const d of state.dusts||[]){
      const fade=1-(now-d.t0)/(d.leak?7:22);if(fade<=0)continue;
      point(d.x,d.y,d.z,Math.max(.4,2.4*fade),DUST,.45*fade);
    }
    finish(ribbons,n*6);finish(particles,pn);
    beamMesh.visible=n>0;pointMesh.visible=pn>0;
  }
  return {update,stats:()=>({ribbons:n,particles:pn,dropped,drawCalls:(n?1:0)+(pn?1:0)}),dispose(){
    scene.remove(beamMesh,pointMesh);ribbons.dispose();particles.dispose();beamMaterial.dispose();particleMaterial.dispose();
  }};
}
