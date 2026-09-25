/* Tribute War image pipeline and quality tiers.

   Scene → RGBA16F target (MSAA renderbuffer when the tier allows, resolved
   by blit) → dual-filter bloom fed only by energy above display white →
   slow auto-exposure that only ever darkens (a capital's death flash blooms
   and settles; empty space is never pumped up) → ACES filmic curve → per
   star-system grade, vignette and grain → FXAA to the canvas.

   The battle's shaders were authored for display values. They still are:
   the composite decodes them with a 2.2 power into linear light, so a hull
   that used to read 0.5 still reads close to 0.5 after the curve, while
   stacked additive light (explosions, beam cores, engines) keeps its excess
   energy instead of clipping, and that excess is what blooms.

   Also exports the pure quality/LOD helpers used by tests. */
(function (root) {
  'use strict';

  /* --------------------------- quality tiers --------------------------- */
  const TIERS = {
    low:    {name: 'Low',    msaa: 0, fxaa: true,  bloomLevels: 3, nebula: 0, grain: false, vignette: true,  dprCap: 1,    minScale: .6,  fleet: 100, eclipse: true,  dust: 0},
    medium: {name: 'Medium', msaa: 2, fxaa: true,  bloomLevels: 4, nebula: 2, grain: true,  vignette: true,  dprCap: 1.25, minScale: .65, fleet: 300, eclipse: true,  dust: 1},
    high:   {name: 'High',   msaa: 4, fxaa: true,  bloomLevels: 5, nebula: 3, grain: true,  vignette: true,  dprCap: 1.5,  minScale: .7,  fleet: 300, eclipse: true,  dust: 1},
    ultra:  {name: 'Ultra',  msaa: 4, fxaa: true,  bloomLevels: 5, nebula: 4, grain: true,  vignette: true,  dprCap: 2,    minScale: .75, fleet: 600, eclipse: true,  dust: 1}
  };
  const ORDER = ['low', 'medium', 'high', 'ultra'];

  // First guess before the probe: phones and small touch screens start Low,
  // weak integrated or mobile GPUs Medium, everything else High.
  function guessTier({coarse = false, width = 1280, cores = 4, renderer = '', memory = 8} = {}) {
    const r = String(renderer).toLowerCase();
    if (/swiftshader|llvmpipe|software/.test(r)) return 'low';
    if (coarse && width < 900) return 'low';
    if (/mali|adreno|powervr|apple gpu|videocore/.test(r) || coarse) return 'medium';
    if (/intel|uhd|iris|radeon\(tm\) graphics|vega [0-9] /.test(r) || cores <= 4 || memory <= 4) return 'medium';
    return 'high';
  }
  // Two-second probe verdict from measured frame times (ms): step down while
  // the p75 misses the tier's budget, step up only on a large margin.
  function probeVerdict(tier, frameMs, target = 1000 / 58) {
    if (!frameMs.length) return tier;
    const s = [...frameMs].sort((a, b) => a - b), p75 = s[Math.floor(s.length * .75)];
    let i = ORDER.indexOf(tier);
    if (p75 > target * 1.9) i -= 2; else if (p75 > target * 1.15) i -= 1; else if (p75 < target * .55 && i < 2) i += 1;
    return ORDER[Math.max(0, Math.min(ORDER.length - 1, i))];
  }

  // Detail choice for a hull from its projected size in pixels. Hysteresis:
  // a coarse hull must grow 15% past the threshold to get its full mesh, and a
  // full hull must shrink 15% below it to lose it, so a ship hovering at the
  // boundary never flickers. Levels: 0 full mesh, 1 shared instanced coarse
  // mesh (the forge's .12-facet cut, three representatives per class).
  function lodLevel(pixels, previous, dense) {
    const up = dense ? 48 : 28, coarse = previous == null ? 1 : previous;
    return pixels >= up * (coarse >= 1 ? 1.15 : .85) ? 0 : 1;
  }
  // Crossfade weight when a hull changes level: 0 → 1 over `fade` seconds.
  function lodFade(changedAt, now, fade = .35) { return Math.max(0, Math.min(1, (now - changedAt) / fade)); }

  // Dynamic resolution, called about once a second: drop 5% when the frame
  // interval misses the budget by 12%; raise 5% only when frames are on
  // budget (a vsync-locked display never reports faster than its refresh)
  // and the caller has not recently dropped from the level above.
  function nextScale(scale, frameMs, budgetMs, minScale, canRaise = true) {
    if (frameMs > budgetMs * 1.12) scale -= .05; else if (canRaise && frameMs < budgetMs * 1.05) scale += .05;
    return Math.round(Math.max(minScale, Math.min(1, scale)) * 20) / 20;
  }

  // Per star-system grade (index = ArmadaSystems style).
  // lift / gain tints, saturation, contrast, nebula colours A/B, nebula strength.
  const GRADES = [
    {name: 'Giant sun',       lift: [.010, .006, .002], gain: [1.04, .99, .92], sat: 1.02, con: 1.04, nebA: [.26, .15, .09], nebB: [.08, .06, .12], neb: .5},
    {name: 'Five worlds',     lift: [.004, .006, .010], gain: [.99, 1.0, 1.02], sat: 1.0,  con: 1.03, nebA: [.10, .16, .26], nebB: [.20, .10, .22], neb: .45},
    {name: 'Ringed kingdom',  lift: [.004, .008, .008], gain: [1.03, 1.0, .95], sat: 1.04, con: 1.05, nebA: [.24, .19, .12], nebB: [.06, .13, .16], neb: .45},
    {name: 'Binary dawn',     lift: [.010, .004, .008], gain: [1.05, .97, .96], sat: 1.05, con: 1.04, nebA: [.28, .13, .18], nebB: [.18, .14, .08], neb: .5},
    {name: 'Ocean frontier',  lift: [.002, .007, .012], gain: [.95, 1.0, 1.05], sat: 1.02, con: 1.03, nebA: [.05, .20, .30], nebB: [.08, .08, .22], neb: .5},
    {name: 'Ice giant moons', lift: [.004, .008, .014], gain: [.94, .99, 1.07], sat: .94,  con: 1.04, nebA: [.12, .22, .36], nebB: [.18, .20, .28], neb: .45},
    {name: 'Eclipse',         lift: [.000, .000, .004], gain: [1.0, .98, .98],  sat: .86,  con: 1.12, nebA: [.16, .12, .20], nebB: [.06, .06, .08], neb: .3},
    {name: 'Ember worlds',    lift: [.012, .004, .000], gain: [1.06, .96, .88], sat: 1.04, con: 1.06, nebA: [.28, .11, .07], nebB: [.10, .05, .10], neb: .5}
  ];

  /* ------------------------------- shaders ------------------------------- */
  const FS_VERT = `#version 300 es
out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
  const DOWN = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uSrc;uniform vec2 uTexel;uniform float uPrefilter;out vec4 o;
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 lin(vec3 c){return pow(max(c,0.0),vec3(2.2));}
void main(){
  vec2 h=uTexel*.5;
  vec4 a=texture(uSrc,vUv),b=texture(uSrc,vUv+vec2(-h.x,-h.y)*2.0),c=texture(uSrc,vUv+vec2(h.x,-h.y)*2.0),d=texture(uSrc,vUv+vec2(-h.x,h.y)*2.0),e=texture(uSrc,vUv+vec2(h.x,h.y)*2.0);
  if(uPrefilter>.5){
    // First level: decode to linear, keep average luminance in alpha for
    // exposure, pass on only the energy above white (soft knee) for bloom.
    vec3 s=(lin(a.rgb)*4.0+lin(b.rgb)+lin(c.rgb)+lin(d.rgb)+lin(e.rgb))/8.0;
    float th=1.5,l=luma(s),knee=.5,x=clamp(l-th+knee,0.0,2.0*knee);float soft=x*x/(4.0*knee+1e-4);
    float w=max(soft,l-th)/max(l,1e-4);
    o=vec4(min(s*w,vec3(64.0)),log2(l+1e-3));return;
  }
  o=(a*4.0+b+c+d+e)/8.0;
}`;
  const UP = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uSrc;uniform vec2 uTexel;uniform float uRadius,uWeight;out vec4 o;
void main(){vec2 h=uTexel*uRadius;
  vec3 s=texture(uSrc,vUv+vec2(-h.x*2.0,0)).rgb+texture(uSrc,vUv+vec2(h.x*2.0,0)).rgb+texture(uSrc,vUv+vec2(0,-h.y*2.0)).rgb+texture(uSrc,vUv+vec2(0,h.y*2.0)).rgb
   +(texture(uSrc,vUv+vec2(-h.x,-h.y)).rgb+texture(uSrc,vUv+vec2(h.x,-h.y)).rgb+texture(uSrc,vUv+vec2(-h.x,h.y)).rgb+texture(uSrc,vUv+vec2(h.x,h.y)).rgb)*2.0;
  o=vec4(s/12.0*uWeight,0.0);}`;
  const ADAPT = `#version 300 es
precision highp float;uniform sampler2D uSmall,uPrev;uniform float uUp,uDown;out vec4 o;
void main(){ivec2 sz=textureSize(uSmall,0);float s=0.0;for(int y=0;y<4;y++)for(int x=0;x<4;x++){s+=texelFetch(uSmall,ivec2((float(x)+.5)/4.0*float(sz.x),(float(y)+.5)/4.0*float(sz.y)),0).a;}
  float avg=exp2(s/16.0),prev=texelFetch(uPrev,ivec2(0),0).r;if(prev<=0.0||prev!=prev)prev=avg;o=vec4(mix(prev,avg,avg>prev?uUp:uDown),0,0,1);}`;
  const COMPOSITE = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uScene,uBloom,uLum;
uniform float uExposure,uBloomK,uVignette,uGrain,uTime,uSat,uCon,uKey,uToScreen,uCurve;uniform vec3 uLift,uGain;uniform vec2 uRes;out vec4 o;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}
// Shoulder of Khronos PBR Neutral without its toe: identity below 0.8 so
// the authored hulls, rings and dust keep their values; energy above white
// rolls off smoothly and desaturates toward white like film.
vec3 neutral(vec3 c){float peak=max(c.r,max(c.g,c.b));
  if(peak<.8)return c;float d=.2,np=1.0-d*d/(peak+d-.8);c*=np/peak;float g=1.0-1.0/(.15*(peak-np)+1.0);return mix(c,vec3(np),g);}
void main(){
  vec3 c=pow(max(texture(uScene,vUv).rgb,0.0),vec3(2.2));
  c+=texture(uBloom,vUv).rgb*uBloomK;
  // Auto-exposure only darkens: normal space reads at the base exposure,
  // a sky full of fire is pulled down and recovers slowly.
  float avg=texelFetch(uLum,ivec2(0),0).r,adapt=clamp(uKey/max(avg,1e-4),.32,1.0);
  c*=uExposure*adapt;
  c=uCurve>.5?aces(c):neutral(c);
  c=pow(c,vec3(1.0/2.2));
  // Grade: lift/gain, contrast about mid grey, saturation.
  c=uLift+c*(uGain-uLift);
  c=max((c-.3)*uCon+.3,c*min(1.0,uCon)); // contrast pivots low; never crushes black
  float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,uSat);
  vec2 q=vUv-.5;c*=1.0-uVignette*smoothstep(.25,.85,dot(q,q)*2.2);
  float n=fract(sin(dot(gl_FragCoord.xy+fract(uTime*7.13)*97.0,vec2(12.9898,78.233)))*43758.5453);
  c+=(n-.5)*uGrain;
  c=clamp(c,0.0,1.0);
  o=vec4(c,uToScreen>.5?1.0:dot(c,vec3(.299,.587,.114)));
}`;
  // FXAA (after Lottes' console variant), luma in alpha from the composite.
  const FXAA = `#version 300 es
precision highp float;in vec2 vUv;uniform sampler2D uSrc;uniform vec2 uTexel;out vec4 o;
void main(){
  vec4 m=texture(uSrc,vUv);float lm=m.a;
  float nw=texture(uSrc,vUv+vec2(-1,-1)*uTexel).a,ne=texture(uSrc,vUv+vec2(1,-1)*uTexel).a,sw=texture(uSrc,vUv+vec2(-1,1)*uTexel).a,se=texture(uSrc,vUv+vec2(1,1)*uTexel).a;
  float lo=min(lm,min(min(nw,ne),min(sw,se))),hi=max(lm,max(max(nw,ne),max(sw,se)));
  if(hi-lo<max(.0312,hi*.125)){o=vec4(m.rgb,1.0);return;}
  vec2 dir=vec2(-((nw+ne)-(sw+se)),((nw+sw)-(ne+se)));
  float red=max((nw+ne+sw+se)*.03125,1.0/128.0),inv=1.0/(min(abs(dir.x),abs(dir.y))+red);
  dir=clamp(dir*inv,vec2(-8.0),vec2(8.0))*uTexel;
  vec3 a=.5*(texture(uSrc,vUv+dir*(1.0/3.0-.5)).rgb+texture(uSrc,vUv+dir*(2.0/3.0-.5)).rgb);
  vec3 b=a*.5+.25*(texture(uSrc,vUv-dir*.5).rgb+texture(uSrc,vUv+dir*.5).rgb);
  float lb=dot(b,vec3(.299,.587,.114));
  o=vec4((lb<lo||lb>hi)?a:b,1.0);
}`;
  // Procedural nebula and galactic band behind everything, per system.
  const SKY = `#version 300 es
precision highp float;in vec2 vUv;uniform mat4 uInv;uniform vec3 uA,uB,uSun,uSunCol;uniform float uK,uOct,uSeed;out vec4 o;
float h(vec3 p){p=fract(p*.3183099+vec3(.71,.113,.419)+uSeed);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.0,a=.5;for(int i=0;i<4;i++){if(float(i)>=uOct)break;s+=a*n(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
void main(){
  vec4 w=uInv*vec4(vUv*2.0-1.0,1.0,1.0);vec3 d=normalize(w.xyz/w.w);
  float band=exp(-pow(d.y*2.3+.35*sin(d.x*2.1+uSeed*6.0),2.0)*3.0);
  float f=fbm(d*2.6),g=fbm(d*5.3+f*1.7);
  float cloud=smoothstep(.42,.95,f*.65+g*.55)*(.35+.65*band);
  vec3 c=mix(uB,uA,smoothstep(.3,.8,g))*cloud*uK+vec3(.55,.60,.72)*band*.05*uK;
  float sun=max(dot(d,uSun),0.0);c+=uSunCol*(pow(sun,48.0)*.10+pow(sun,6.0)*.028)*uK;
  // Dither the gradient so 8-bit output never bands.
  c+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5)-.5)/255.0;
  o=vec4(max(c,0.0),1.0);
}`;

  function compile(gl, vs, fs) {
    const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return {p, u};
  }

  /* ------------------------------ pipeline ------------------------------ */
  function create(gl, canvas) {
    const floatOk = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    const hdrFormat = floatOk ? gl.RGBA16F : gl.RGBA8, hdrType = floatOk ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    const maxSamples = floatOk ? gl.getParameter(gl.MAX_SAMPLES) : 0;
    const P = {
      down: compile(gl, FS_VERT, DOWN), up: compile(gl, FS_VERT, UP), adapt: compile(gl, FS_VERT, ADAPT),
      comp: compile(gl, FS_VERT, COMPOSITE), fxaa: compile(gl, FS_VERT, FXAA), sky: compile(gl, FS_VERT, SKY)
    };
    const vao = gl.createVertexArray();
    const S = {w: 0, h: 0, samples: 0, levels: 0, tex: [], fbo: []};
    const tex = (w, h, fmt, type, filter) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    const fbo = (t) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };
    const lum = [tex(1, 1, hdrFormat, hdrType, gl.NEAREST), tex(1, 1, hdrFormat, hdrType, gl.NEAREST)], lumF = lum.map(fbo);
    let lumI = 0;
    const free = () => {
      for (const t of S.tex) gl.deleteTexture(t); for (const f of S.fbo) gl.deleteFramebuffer(f);
      for (const r of S.rbs || []) gl.deleteRenderbuffer(r);
      S.tex = []; S.fbo = []; S.rbs = [];
    };
    const api = {
      floatOk, maxSamples, width: 0, height: 0, scale: 1, error: null,
      settings: {tier: 'high', exposure: 1, bloom: .32, grain: .018, vignette: .28, key: .16, curve: 'neutral'},
      grade: GRADES[1], sky: {a: [0, 0, 0], b: [0, 0, 0], k: 0, sun: [0, 1, 0], sunCol: [1, 1, 1], seed: 0},
      // Allocate targets at scale × canvas size.
      resize(scale, tier) {
        const T = TIERS[tier] || TIERS.high, w = Math.max(16, Math.round(canvas.width * scale)), h = Math.max(16, Math.round(canvas.height * scale));
        const samples = Math.min(T.msaa, maxSamples || 0);
        if (w === S.w && h === S.h && samples === S.samples && T.bloomLevels === S.levels) return;
        free(); S.w = w; S.h = h; S.samples = samples; S.levels = T.bloomLevels; api.width = w; api.height = h; api.scale = scale;
        S.color = tex(w, h, hdrFormat, hdrType, gl.LINEAR); S.tex.push(S.color);
        S.resolve = fbo(S.color); S.fbo.push(S.resolve);
        const depth = gl.createRenderbuffer(); S.rbs.push(depth);
        if (samples) {
          S.msaa = gl.createFramebuffer(); S.fbo.push(S.msaa);
          const rb = gl.createRenderbuffer(); S.rbs.push(rb);
          gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, hdrFormat, w, h);
          gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
          gl.bindFramebuffer(gl.FRAMEBUFFER, S.msaa);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { S.samples = 0; S.msaa = null; }
        } else S.msaa = null;
        if (!S.msaa) {
          gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
          gl.bindFramebuffer(gl.FRAMEBUFFER, S.resolve); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
        }
        S.bloom = [];
        let bw = w, bh = h;
        for (let i = 0; i < T.bloomLevels; i++) {
          bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1);
          const t = tex(bw, bh, hdrFormat, hdrType, gl.LINEAR); S.tex.push(t); const f = fbo(t); S.fbo.push(f); S.bloom.push({t, f, w: bw, h: bh});
        }
        S.ldr = tex(canvas.width, canvas.height, gl.RGBA8, gl.UNSIGNED_BYTE, gl.LINEAR); S.tex.push(S.ldr);
        S.ldrF = fbo(S.ldr); S.fbo.push(S.ldrF);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      },
      begin() {
        gl.bindFramebuffer(gl.FRAMEBUFFER, S.msaa || S.resolve);
        gl.viewport(0, 0, S.w, S.h);
      },
      // Fullscreen nebula; call right after clearing, before stars.
      drawSky(invVP) {
        const k = api.sky.k * (TIERS[api.settings.tier] || TIERS.high).nebula;
        if (k <= 0) return;
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        const p = P.sky; gl.useProgram(p.p); gl.bindVertexArray(vao);
        gl.uniformMatrix4fv(p.u.uInv, false, invVP); gl.uniform3fv(p.u.uA, api.sky.a); gl.uniform3fv(p.u.uB, api.sky.b);
        gl.uniform3fv(p.u.uSun, api.sky.sun); gl.uniform3fv(p.u.uSunCol, api.sky.sunCol);
        gl.uniform1f(p.u.uK, api.sky.k); gl.uniform1f(p.u.uOct, (TIERS[api.settings.tier] || TIERS.high).nebula); gl.uniform1f(p.u.uSeed, api.sky.seed);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.bindVertexArray(null);
      },
      end(wallDt, time, extra = {}) {
        const T = TIERS[api.settings.tier] || TIERS.high;
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(vao);
        if (S.msaa) {
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, S.msaa); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, S.resolve);
          gl.blitFramebuffer(0, 0, S.w, S.h, 0, 0, S.w, S.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
        }
        // Bloom down chain (first level prefilters and carries log-luminance).
        let src = S.color, sw = S.w, sh = S.h;
        gl.useProgram(P.down.p);
        for (let i = 0; i < S.bloom.length; i++) {
          const L = S.bloom[i]; gl.bindFramebuffer(gl.FRAMEBUFFER, L.f); gl.viewport(0, 0, L.w, L.h);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(P.down.u.uSrc, 0);
          gl.uniform2f(P.down.u.uTexel, 1 / sw, 1 / sh); gl.uniform1f(P.down.u.uPrefilter, i === 0 ? 1 : 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3); src = L.t; sw = L.w; sh = L.h;
        }
        // Exposure adaptation into a 1×1 ping-pong target.
        const small = S.bloom[S.bloom.length - 1];
        gl.useProgram(P.adapt.p); gl.bindFramebuffer(gl.FRAMEBUFFER, lumF[1 - lumI]); gl.viewport(0, 0, 1, 1);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, small.t); gl.uniform1i(P.adapt.u.uSmall, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lum[lumI]); gl.uniform1i(P.adapt.u.uPrev, 1);
        // A flash is met within ~0.3 s; the eye recovers over ~2.5 s.
        const dt = Math.max(0, Math.min(.25, wallDt));
        gl.uniform1f(P.adapt.u.uUp, 1 - Math.exp(-dt / .3)); gl.uniform1f(P.adapt.u.uDown, 1 - Math.exp(-dt / 1.2));
        gl.drawArrays(gl.TRIANGLES, 0, 3); lumI = 1 - lumI;
        // Up chain, additive.
        gl.useProgram(P.up.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        for (let i = S.bloom.length - 1; i > 0; i--) {
          const from = S.bloom[i], to = S.bloom[i - 1];
          gl.bindFramebuffer(gl.FRAMEBUFFER, to.f); gl.viewport(0, 0, to.w, to.h);
          gl.colorMask(true, true, true, false);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, from.t); gl.uniform1i(P.up.u.uSrc, 0);
          gl.uniform2f(P.up.u.uTexel, 1 / from.w, 1 / from.h); gl.uniform1f(P.up.u.uRadius, 1); gl.uniform1f(P.up.u.uWeight, .62); // coarse levels add less: a tight glow, not fog
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.colorMask(true, true, true, true); gl.disable(gl.BLEND);
        // Composite.
        // Grades are deliberately gentle: half-strength tints around neutral.
        const G = api.grade, c = P.comp, half = v => v.map(x => 1 + (x - 1) * .5);
        gl.bindFramebuffer(gl.FRAMEBUFFER, T.fxaa ? S.ldrF : null); gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(c.p);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.color); gl.uniform1i(c.u.uScene, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, S.bloom[0].t); gl.uniform1i(c.u.uBloom, 1);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, lum[lumI]); gl.uniform1i(c.u.uLum, 2);
        gl.uniform1f(c.u.uExposure, api.settings.curve === 'aces' ? api.settings.exposure * .8 : api.settings.exposure); gl.uniform1f(c.u.uCurve, api.settings.curve === 'aces' ? 1 : 0); gl.uniform1f(c.u.uBloomK, api.settings.bloom);
        gl.uniform1f(c.u.uKey, api.settings.key);
        gl.uniform1f(c.u.uVignette, T.vignette ? api.settings.vignette : 0);
        gl.uniform1f(c.u.uGrain, T.grain && !extra.reduced ? api.settings.grain : 0);
        gl.uniform1f(c.u.uTime, time); gl.uniform1f(c.u.uSat, G.sat); gl.uniform1f(c.u.uCon, G.con);
        gl.uniform3fv(c.u.uLift, G.lift.map(x => x * .5)); gl.uniform3fv(c.u.uGain, half(G.gain)); gl.uniform2f(c.u.uRes, canvas.width, canvas.height); gl.uniform1f(c.u.uToScreen, T.fxaa ? 0 : 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (T.fxaa) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(P.fxaa.p);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.ldr); gl.uniform1i(P.fxaa.u.uSrc, 0);
          gl.uniform2f(P.fxaa.u.uTexel, 1 / canvas.width, 1 / canvas.height);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
        gl.enable(gl.DEPTH_TEST); gl.bindVertexArray(null);
      },
      setSystem(style, sunDir, sunCol, seed) {
        const G = GRADES[style] || GRADES[1];
        api.grade = G; api.sky = {a: G.nebA, b: G.nebB, k: G.neb, sun: sunDir, sunCol, seed: (seed % 997) / 997};
      },
      // Diagnostics: current adapted scene luminance (for tests and ?perf=1).
      readLuminance() {
        const out = new Float32Array(4); gl.bindFramebuffer(gl.FRAMEBUFFER, lumF[lumI]);
        try { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, out); } catch (e) { return NaN; }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); return out[0];
      },
      dispose() { free(); }
    };
    return api;
  }

  const API = {TIERS, ORDER, GRADES, guessTier, probeVerdict, lodLevel, lodFade, nextScale, create};
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ArmadaPost = API;
})(typeof self !== 'undefined' ? self : this);
