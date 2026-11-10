/* The galaxy on screen: homeworlds with cities, suns, the spiral itself, and
   the controls for crossing it. Data comes from armada-universe-new.js.
   Everything here is drawn relative to the camera in float64, so a world
   sixty light-years from the battle is as sharp as the one under it. The war
   engine keeps its own coordinates: the battle is always at its origin, and
   this module knows where in the galaxy that origin is. */
window.ArmadaCosmos=(function(){
"use strict";
const U=window.ArmadaUniverse;
if(!U)return null;
const {add,sub,mul,dot,len,norm,cross}=U.v;
const TAN=Math.tan(.44),NR=150,NS=176;
let H=null,gl=null,G=null,ok=false,broken=false;
let site=0,origin=[0,0,0],pending=null,owners=U.freshOwners();
let burn=[],near=null,nearAlt=0,frameM=null,anim=null,speed=0,lastEye=null,warp=0,flash=0;
let galaxyView=false,chooser=false,panelKey="",uiAt=0,site0=null,resultFor=-1;
const P={},cityCache=new Map();
let grid=null,quad=null,dust=null,stars=null,sysSprites=null,box=null,fx=null;

/* ------------------------------ shaders ------------------------------ */
const NOISE=`
float hash3(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float hash2(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p,int n){float s=0.,a=.5;for(int i=0;i<6;i++){if(i>=n)break;s+=a*noise3(p);p=p*2.03+vec3(17.1,9.2,3.3);a*=.5;}return s;}
`;
/* Single scattering through a thin shell, in planet radii. Blue is removed
   from the light on its way in and on its way out, so the limb is blue, the
   terminator is red and the sky is whatever colour the world's air is. */
const ATMO=`
uniform vec3 uBeta,uSunI,uSunDir;uniform float uAtmoH;
vec3 scatter(vec3 ro,vec3 rd,float tmax,out vec3 T,int ns){
  T=vec3(1.);
  if(uAtmoH<=0.)return vec3(0.);
  float ra=1.+uAtmoH,b=dot(ro,rd),c=dot(ro,ro)-ra*ra,hh=b*b-c;if(hh<0.)return vec3(0.);hh=sqrt(hh);
  float t0=max(-b-hh,0.),t1=min(-b+hh,tmax);if(t1<=t0)return vec3(0.);
  float hs=uAtmoH*.22,dt=(t1-t0)/float(ns),tau=0.;vec3 sum=vec3(0.);
  float mu=dot(rd,uSunDir),phase=.55*(1.+mu*mu)+.8*pow(max(mu,0.),22.);
  for(int i=0;i<12;i++){if(i>=ns)break;
    vec3 p=ro+rd*(t0+(float(i)+.5)*dt);float r=length(p),rho=exp(-max(r-1.,0.)/hs);
    tau+=rho*dt;
    float bs=dot(p,uSunDir),cs=bs/r,perp=sqrt(max(r*r-bs*bs,0.));
    float sh=bs>0.?1.:smoothstep(.975,1.02,perp);
    float tauS=rho*hs/(max(cs,0.)+.10)*(1.+max(-cs,0.)*6.);
    sum+=exp(-uBeta*(tau+tauS))*rho*dt*sh;
  }
  T=exp(-uBeta*tau);
  return sum*uBeta*phase*uSunI;
}`;
/* A sphere drawn as a cap of rings centred under the camera: fine where you
   are, coarse at the horizon, and exactly on the sphere everywhere. */
const CAP_VS=`#version 300 es
layout(location=0) in vec2 aG;
uniform mat4 uVP;uniform vec3 uAxis,uT1,uT2,uSub;uniform float uR,uK,uA;
out vec3 vDir;out vec3 vRel;out vec3 vOff;
void main(){
  float th=uA*(exp(uK*aG.x)-1.),ph=aG.y*6.2831853,st=sin(th),hf=sin(th*.5);
  vec3 side=uT1*cos(ph)+uT2*sin(ph);
  vDir=uAxis*cos(th)+side*st;
  vOff=uR*(uAxis*(-2.*hf*hf)+side*st);
  vRel=uSub+vOff;
  gl_Position=uVP*vec4(vRel,1.);
}`;
const PLANET_FS=`#version 300 es
precision highp float;
in vec3 vDir;in vec3 vRel;in vec3 vOff;
uniform vec3 uSunCol,uSea,uL1,uL2,uL3,uIce,uCloudC,uGlow,uCityCol,uEyeR,uCE,uCN,uCityO;
uniform vec4 uP1,uP2,uP3,uCity[16];
uniform int uNC,uNear;uniform float uR,uOct;
out vec4 o;
${NOISE}${ATMO}
float ridged(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){float n=1.-abs(2.*noise3(p)-1.);s+=a*n*n;p=p*2.1+vec3(7.3,1.7,4.1);a*=.5;}return s;}
float line(vec2 p,float B,float w){
  vec2 g=abs(fract(p/B+.5)-.5)*B;float fw=max(length(fwidth(p)),1e-3),d=min(g.x,g.y);
  float sharp=clamp((w*.5-d)/fw+.5,0.,1.)*min(1.,2.*w/fw);
  return mix(sharp,min(1.,2.*w/B),smoothstep(.25,.6,fw/B));
}
void main(){
  vec3 q=normalize(vDir),L=uSunDir,col,emis=vec3(0.);float seed=uP2.w,mu=dot(q,L),altR=uP3.w;
  int oc=int(uOct);
  if(uP2.z>.5){
    float n=fbm(q*vec3(2.,7.,2.)+seed,4);
    float b=.5+.5*sin(q.y*(18.+seed*.2)+(n-.5)*5.),b2=.5+.5*sin(q.y*47.+n*9.+seed);
    col=mix(uSea,uL1,b);col=mix(col,uL2,b2*.45);col=mix(col,uL3,smoothstep(.55,.75,fbm(q*vec3(5.,16.,5.)+seed*2.,4))*.5);
    float storm=smoothstep(.2,.0,length((q-normalize(vec3(.6,-.35,.7)))*vec3(1.,2.2,1.)));col=mix(col,uL3*1.1,storm*.7);
    float day=smoothstep(-.12,.35,mu);col*=uSunCol*(.015+day*max(mu,0.)*1.05+day*.06);
  }else{
    float px=length(fwidth(q));
    float c0=fbm(q*1.7+seed,oc),rd=ridged(q*5.+seed*1.7);
    float sea=uP1.x,f1=1.-smoothstep(.2,.55,px*400.),f2=1.-smoothstep(.2,.55,px*3400.);
    float d1=f1>0.?(fbm(q*48.+seed,4)-.5)*f1:0.,d2=f2>0.?(fbm(q*420.+seed,4)-.5)*f2:0.;
    float h=c0*.84+(rd-.3)*.16*smoothstep(sea-.08,sea+.10,c0)+d1*.035+d2*.006;
    float urban=0.,reach=0.;int ci=-1;vec3 cd=vec3(0.,1.,0.);float cw=.03;
    for(int i=0;i<16;i++){if(i>=uNC)break;vec3 c=uCity[i].xyz;float d=length(q-c);
      float wob=1.+.5*(noise3(q*70.+float(i)*3.1)-.5),m=1.-smoothstep(uCity[i].w*.3,uCity[i].w,d*wob);
      if(d<uCity[i].w*2.6&&(ci<0||m>urban)){ci=i;cd=c;cw=uCity[i].w;reach=1.-smoothstep(uCity[i].w*.9,uCity[i].w*2.6,d);}
      urban=max(urban,m);}
    float landH=h+max(urban,reach*.5)*.07,land=smoothstep(sea-.004,sea+.004,landH);
    float sprawl=uP2.x*land*smoothstep(.42,.6,noise3(q*11.+seed*2.3)+uP2.x*.25),civ=max(urban,sprawl);
    float e=clamp((landH-sea)/max(1.-sea,.05),0.,1.);
    vec3 ground=mix(uL1,uL2,smoothstep(.02,.40,e+d1*.3));ground=mix(ground,uL3,clamp(smoothstep(.45,.8,e)+smoothstep(.45,.8,rd)*.45,0.,1.));
    ground*=.84+.32*fbm(q*3.3+seed*5.,3);
    float lat=abs(dot(q,vec3(.8,0.,.6)));
    float ice=clamp(smoothstep(1.-uP1.y*.42,1.07-uP1.y*.42,lat+(c0-.5)*.25)+smoothstep(.8,.95,e)*uP1.y,0.,1.)*(1.-urban);
    vec3 water=uSea*(.7+.6*smoothstep(sea-.22,sea,h));
    col=mix(water,ground,land);col=mix(col,uIce,ice);
    // the city plan: exact metres for the city the camera is over, good enough for the rest
    vec2 p2=vec2(0.);
    if(ci>=0){
      if(ci==uNear)p2=uCityO.xy+vec2(dot(uCE,vOff),dot(uCN,vOff));
      else{vec3 rf=abs(cd.y)>.9?vec3(1.,0.,0.):vec3(0.,1.,0.),E=normalize(cross(rf,cd)),Nn=cross(cd,E),dq=(q-cd)*uR;p2=vec2(dot(dq,E),dot(dq,Nn));}
    }
    float pf=max(length(fwidth(p2)),1e-3),pr=length(p2),cityR=cw*uR;
    float street=line(p2,500.,46.),avenue=line(p2,2500.,130.),highway=line(p2,10000.,280.);
    float spoke=abs(fract(atan(p2.y,p2.x)*.95493+.5)-.5)*pr*1.0472,ring=abs(fract(pr/7000.+.5)-.5)*7000.;
    float artery=max(max(avenue,highway),max(clamp((110.-spoke)/pf+.5,0.,1.)*min(1.,900./pf),clamp((100.-ring)/pf+.5,0.,1.)*min(1.,800./pf)));
    float roads=max(street*.8,artery);
    float lot=hash2(floor(p2/500.)),fine=hash2(floor(p2/125.)),near2=1.-smoothstep(60.,400.,pf);
    float dens=urban*(.22+.78*smoothstep(.25,.75,noise3(vec3(p2/2600.,seed))+exp(-pr/max(cityR,1.)*3.)*.6));
    vec3 urbanCol=mix(vec3(.30,.31,.33),uL3,.25)*(.7+.5*lot);
    col=mix(col,mix(urbanCol,vec3(.10,.10,.11),roads),urban*.92);
    col=mix(col,vec3(.13,.13,.14),artery*reach*(1.-urban)*land*.6);
    float vein=1.-abs(2.*noise3(q*95.+seed)-1.),block=noise3(q*330.+seed);
    col=mix(col,mix(uL2*(.55+.75*block),uL1*.45,smoothstep(.82,.97,vein)),sprawl*(1.-urban)*.85);
    // relief
    float bh=landH*land*uP1.w;vec3 dpx=dFdx(q),dpy=dFdy(q);float dhx=dFdx(bh),dhy=dFdy(bh);
    vec3 r1=cross(dpy,q),r2=cross(q,dpx);float det=dot(dpx,r1);
    vec3 N=normalize(abs(det)*q-.11*sign(det)*(dhx*r1+dhy*r2));
    // weather, gone once the camera is under it
    float cfade=smoothstep(.006,.05,altR),cl=0.,csh=0.;
    if(uP1.z>0.&&cfade>0.){
      vec3 cq=q*3.4+vec3(seed,uP3.z*.0015,0.);cq+=(noise3(cq*1.7+5.)-.5)*.7;
      float th=.78-uP1.z*.42;
      cl=smoothstep(th,th+.16,fbm(cq,oc))*cfade;csh=smoothstep(th,th+.16,fbm(cq+L*.03,3))*cfade;
    }
    float day=smoothstep(-.05,.2,mu),diff=(1.-exp(-2.6*max(dot(N,L),0.)))*day;
    vec3 amb=uBeta/max(uBeta.b+uBeta.r+uBeta.g,1e-3)*.22*day+.010;
    vec3 lit=col*(uSunCol*diff*(1.-csh*.55)*1.15+amb);
    vec3 E=normalize(-vRel);float spec=pow(max(dot(reflect(-L,N),E),0.),90.)*(1.-land)*(1.-ice)*day;
    lit+=uSunCol*spec*.9*(1.-cl);
    lit=mix(lit,uCloudC*(uSunCol*max(mu*.9+.1,0.)*day+amb*1.5),cl*.92);
    // the lights come on at dusk and own the night
    float nf=1.-smoothstep(-.1,.38,mu),tw=.7+.6*noise3(q*260.+3.);
    float cityL=dens*(street*.9+(1.-roads)*step(.3,lot)*mix(.34,.25+.75*fine,near2)*.55)*tw+max(urban,reach*land*.75)*artery*mix(.9,1.7,smoothstep(20.,200.,pf));
    float sA=1.-smoothstep(.2,.55,px*420.),sB=1.-smoothstep(.2,.55,px*1500.);
    float sprawlL=sprawl*(1.-urban)*(mix(.3,smoothstep(.45,.8,noise3(q*420.+seed)),sA)*mix(1.,.5+noise3(q*1500.),sB)*.8+smoothstep(.9,.985,vein)*.45);
    emis=uCityCol*(cityL*1.7+sprawlL*1.6)*nf;
    float seam=0.;
    if(uP2.y>0.){float gn=ridged(q*4.+seed*3.);seam=pow(smoothstep(.5,.82,gn),2.)*uP2.y*smoothstep(.35,.6,noise3(q*2.3+seed*7.))*(1.-urban)+(1.-land)*.16*uP2.y*step(.7,sea);}
    emis+=uGlow*seam*1.45;
    float bn=uP3.y;
    if(bn>0.){
      float fn=noise3(q*520.+seed*5.)*.6+noise3(q*130.+uP3.z*.05)*.4,th2=1.-bn*.75;
      float fire=civ*smoothstep(th2,th2+.12,fn),fl=.7+.6*noise3(q*900.+uP3.z*2.);
      emis=emis*(1.-bn*.7)+vec3(1.,.36,.07)*fire*fl*3.2;lit*=1.-fire*.5;
      lit*=1.-.45*bn*civ*smoothstep(.3,.7,noise3(q*60.+uP3.z*.02));
    }
    col=lit+emis*(1.-cl*.75);
  }
  vec3 T,ins=scatter(uEyeR,normalize(vRel),length(vRel)/uR,T,4);
  o=vec4(col*T+ins,1.);
}`;
const SUN_FS=`#version 300 es
precision highp float;
in vec3 vDir;in vec3 vRel;in vec3 vOff;uniform vec3 uCol;uniform float uT;out vec4 o;
${NOISE}
void main(){
  vec3 q=normalize(vDir),E=normalize(-vRel);
  float n=fbm(q*14.+uT*.02,4),g=noise3(q*90.+uT*.2),limb=pow(max(dot(q,E),0.),.45);
  vec3 c=uCol*(1.4+2.6*limb)*(.78+.4*n+.12*g);
  c*=1.-.5*smoothstep(.70,.78,fbm(q*5.+3.,3));
  o=vec4(c*2.1,1.);
}`;
const SKY_VS=`#version 300 es
out vec2 vUv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.-1.,1.,1.);}`;
const SKY_FS=`#version 300 es
precision highp float;
in vec2 vUv;uniform vec3 uF,uRt,uUp,uEyeR;out vec4 o;
${ATMO}
void main(){
  vec3 rd=normalize(uF+uRt*(vUv.x*2.-1.)+uUp*(vUv.y*2.-1.));
  float tmax=1e9,b=dot(uEyeR,rd),c=dot(uEyeR,uEyeR)-1.,h=b*b-c;
  if(h>0.&&-b-sqrt(h)>0.)tmax=-b-sqrt(h);
  vec3 T,ins=scatter(uEyeR,rd,tmax,T,10);
  o=vec4(ins,1.-dot(T,vec3(.3333)));
}`;
const SPRITE_VS=`#version 300 es
layout(location=0) in vec2 aC;layout(location=1) in vec3 aPos;layout(location=2) in vec4 aCol;layout(location=3) in vec2 aSz;
uniform mat4 uVP;uniform vec3 uEye,uRt,uUp;uniform float uPx;
out vec2 vC;out vec4 vCol;
void main(){
  vec3 rel=aPos-uEye;float d=length(rel),real=aSz.x*uPx/max(d,1.),rad=aSz.x,k=1.;
  if(aSz.y>0.){rad=max(aSz.x,aSz.y*d/uPx);k=mix(.5,1.,clamp(real/aSz.y,0.,1.));}
  else k=smoothstep(.5,2.4,d/aSz.x);
  vC=aC;vCol=vec4(aCol.rgb,aCol.a*k);
  gl_Position=uVP*vec4(rel+(uRt*aC.x+uUp*aC.y)*rad,1.);gl_Position.z=gl_Position.w*.9999998;
}`;
const SPRITE_FS=`#version 300 es
precision highp float;
in vec2 vC;in vec4 vCol;uniform float uKind;out vec4 o;
void main(){
  float r=length(vC);if(r>1.)discard;float a;
  if(uKind<.5)a=exp(-r*r*3.5)*(1.-r);
  else a=exp(-r*r*120.)*3.+exp(-r*8.)*.45+(exp(-abs(vC.x)*70.)+exp(-abs(vC.y)*70.))*exp(-r*5.5)*.5;
  o=vec4(vCol.rgb*vCol.a*a,1.);
}`;
const CITY_VS=`#version 300 es
layout(location=0) in vec3 aV;layout(location=1) in vec3 aNrm;layout(location=2) in vec2 aFace;
layout(location=3) in vec2 aPos;layout(location=4) in vec3 aSize;layout(location=5) in vec4 aMisc;
uniform mat4 uVP;uniform vec3 uCityRel,uE,uN,uU;uniform float uR,uLean;
out vec3 vN;out vec3 vRel;out vec2 vUV;out vec4 vI;
void main(){
  float taper=mix(1.,aMisc.y,aV.y),c=cos(aMisc.x),s=sin(aMisc.x);
  vec3 lp=vec3(aV.x*aSize.x*taper,aV.y*aSize.z,aV.z*aSize.y*taper);
  // grown things lean with the wind
  lp.x+=uLean*aSize.z*aV.y*aV.y*sin(aMisc.z);lp.z+=uLean*aSize.z*aV.y*aV.y*cos(aMisc.z);
  vec2 g=aPos+vec2(lp.x*c-lp.z*s,lp.x*s+lp.z*c);
  float r2=dot(g,g),drop=-r2/(2.*uR)-r2*r2/(8.*uR*uR*uR);
  vec3 up=normalize(uU+(uE*g.x+uN*g.y)/uR);
  vRel=uCityRel+uE*g.x+uN*g.y+uU*drop+up*(lp.y-10.);
  vec3 n=vec3(aNrm.x*c-aNrm.z*s,aNrm.y+(1.-aMisc.y)*.25*(1.-abs(aNrm.y)),aNrm.x*s+aNrm.z*c);
  vN=uE*n.x+uN*n.z+uU*n.y;
  float wdt=abs(aNrm.x)>.5?aSize.y:aSize.x;
  vUV=vec2(aFace.x*wdt*taper,aV.y*aSize.z);vI=vec4(aMisc.z,aSize.z,aMisc.w,aNrm.y);
  gl_Position=uVP*vec4(vRel,1.);
}`;
const CITY_FS=`#version 300 es
precision highp float;
in vec3 vN;in vec3 vRel;in vec2 vUV;in vec4 vI;
uniform vec3 uCol,uCityCol,uSunCol,uAmb,uEyeR;uniform float uStyle,uNight,uLit,uBurn,uT,uR;
out vec4 o;
float hash2(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
${ATMO}
void main(){
  vec3 N=normalize(vN),E=normalize(-vRel);float nl=max(dot(N,uSunDir),0.),seed=vI.x,top=step(.5,vI.w),hN=vUV.y/max(vI.y,1.);
  // every tower its own stone and glass: some warm, some cold, some nearly black
  float tone=hash2(vec2(seed,3.)),glass=step(.45,hash2(vec2(seed,5.)));
  vec3 base=uCol*(.55+.6*tone)*mix(vec3(1.06,1.,.92),vec3(.86,.96,1.12),hash2(vec2(seed,7.)));
  base=mix(base,base*.45+vec3(.02,.03,.05),glass*.7);
  vec2 cell=uStyle<.5?vec2(16.,11.):uStyle<1.5?vec2(9.,34.):uStyle<2.5?vec2(46.,15.):uStyle<3.5?vec2(64.,64.):uStyle<4.5?vec2(70.,90.):vec2(22.,60.);
  vec2 uv=vUV/cell,id=floor(uv),f=fract(uv);float fw=max(fwidth(uv.x),fwidth(uv.y));
  float win=smoothstep(.12,.2,f.x)*smoothstep(.88,.8,f.x)*smoothstep(.2,.3,f.y)*smoothstep(.85,.75,f.y);
  if(uStyle>2.5&&uStyle<3.5)win=max(step(.9,f.x),step(.9,f.y));          // the cube: seams, not windows
  if(uStyle>3.5&&uStyle<4.5)win=smoothstep(.35,.0,length(f-.5));          // grown: pores of light
  float on=step(1.-uLit,hash2(id+seed)),fade=1.-smoothstep(.35,1.2,fw);
  // whole floors and whole wings are lit or dark, so a far tower still twinkles in patches
  vec2 big=floor(vUV/vec2(90.,70.));float fwb=max(fwidth(vUV.x)/90.,fwidth(vUV.y)/70.);
  float wing=mix(uLit*.5,step(1.-uLit*.8,hash2(big+seed*1.3))*(.4+.6*hash2(big.yx+seed)),1.-smoothstep(.4,1.4,fwb));
  float w=mix(wing*.5,win*on,fade)*(1.-top);
  // belts where the plant floors are, and a dark plinth
  float belt=1.-.35*smoothstep(.42,.5,abs(fract(vUV.y/260.)-.5))*(1.-top);
  float ao=.38+.62*smoothstep(0.,520.,vUV.y);
  float spec=pow(max(dot(reflect(-uSunDir,N),E),0.),10.)*(.25+.75*glass)*(1.-top);
  float rim=pow(1.-max(dot(N,E),0.),3.)*.12;
  vec3 lit=(base*(uSunCol*nl*.95+uAmb)*belt+uSunCol*spec*.55+uAmb*rim)*ao*(1.-.3*win*fade*(1.-top));
  vec3 em=uCityCol*w*uNight*(vI.z>.5?3.2:2.4);
  em+=uCityCol*smoothstep(.985,1.,hN)*step(900.,vI.y)*3.*(1.-top);
  if(uBurn>0.){float hit=step(1.-uBurn*.6,hash2(vec2(seed,9.)));em=em*(1.-hit)+vec3(1.,.34,.06)*hit*(1.-hN)*(2.2+1.2*sin(uT*9.+seed));lit*=1.-.6*hit;}
  vec3 T,ins=scatter(uEyeR,normalize(vRel),length(vRel)/uR,T,3);
  o=vec4((lit+em)*T+ins,1.);
}`;

function program(vs,fs){
  const p=H.compile(vs,fs),u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(let i=0;i<n;i++){const name=gl.getActiveUniform(p,i).name.replace(/\[0\]$/,"");u[name]=gl.getUniformLocation(p,name);}
  return {p,u};
}
function build(){
  P.planet=program(CAP_VS,PLANET_FS);P.sun=program(CAP_VS,SUN_FS);P.sky=program(SKY_VS,SKY_FS);
  P.sprite=program(SPRITE_VS,SPRITE_FS);P.city=program(CITY_VS,CITY_FS);
  // the cap grid
  const v=new Float32Array((NR+1)*(NS+1)*2),ix=new Uint32Array(NR*NS*6);let k=0;
  for(let r=0;r<=NR;r++)for(let s=0;s<=NS;s++){v[k++]=r/NR;v[k++]=s/NS;}
  k=0;for(let r=0;r<NR;r++)for(let s=0;s<NS;s++){const a=r*(NS+1)+s,b=a+NS+1;ix[k++]=a;ix[k++]=b;ix[k++]=a+1;ix[k++]=a+1;ix[k++]=b;ix[k++]=b+1;}
  grid={vao:gl.createVertexArray(),n:ix.length};gl.bindVertexArray(grid.vao);
  let b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  b=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,ix,gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  dust=spriteSet(galaxyDust(),false);stars=spriteSet(fieldStars(),false);
  sysSprites=spriteSet(new Float32Array(G.systems.length*9),true);
  // one tapered box: four walls and a roof
  const bv=[],bi=[];
  const face=(nx,nz)=>{const o=bv.length/8,tx=-nz,tz=nx;
    for(const [u,y] of [[-.5,0],[.5,0],[.5,1],[-.5,1]])bv.push(nx*.5+tx*u,y,nz*.5+tz*u,nx,0,nz,u,y);
    bi.push(o,o+1,o+2,o,o+2,o+3);};
  face(1,0);face(-1,0);face(0,1);face(0,-1);
  {const o=bv.length/8;for(const [x,z] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]])bv.push(x,1,z,0,1,0,x,1);bi.push(o,o+1,o+2,o,o+2,o+3);}
  box={v:gl.createBuffer(),i:gl.createBuffer(),n:bi.length};
  gl.bindBuffer(gl.ARRAY_BUFFER,box.v);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(bv),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,box.i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(bi),gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER,null);
  ok=true;
}
// rows of nine: x y z, r g b a, radius, minimum pixels
function spriteSet(data,dynamic){
  const vao=gl.createVertexArray(),buf=gl.createBuffer();gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
  [[1,3,0],[2,4,12],[3,2,28]].forEach(([loc,size,off])=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,36,off);gl.vertexAttribDivisor(loc,1);});
  gl.bindVertexArray(null);
  return {vao,buf,n:data.length/9,data};
}
function galaxyDust(){
  const R=U.random(0xD057),S=U.SPAN,out=[],gauss=()=>(R()+R()+R()+R()-2)*.9;
  for(let i=0;i<4600;i++){
    const arm=i&1,t=Math.pow(R(),.8),ang=arm*Math.PI+t*3.3+.5+gauss()*(.16+.14*t),rad=S*(.10+t*1.02)*(1+gauss()*.05);
    const hot=R()<.13,c=hot?[1,.42,.55]:R()<.5?[.55,.68,1]:[.78,.82,1];
    out.push(Math.cos(ang)*rad,gauss()*S*.028*(1-.4*t),Math.sin(ang)*rad,c[0],c[1],c[2],(hot?.05:.026)*(.5+R()),S*(hot?.02:.03+R()*.05),0);
  }
  for(let i=0;i<900;i++){
    const r=Math.abs(gauss())*S*.16,a=R()*6.283;
    out.push(Math.cos(a)*r,gauss()*S*.05,Math.sin(a)*r,1,.82,.55,.045*(.5+R()),S*(.03+R()*.05),0);
  }
  return new Float32Array(out);
}
function fieldStars(){
  const R=U.random(0x57A125),S=U.SPAN,out=[],gauss=()=>(R()+R()+R()+R()-2)*.9;
  for(let i=0;i<5200;i++){
    const arm=i&1,t=Math.pow(R(),.7),ang=arm*Math.PI+t*3.3+.5+gauss()*.35,rad=S*(.04+t*1.1);
    const c=[[.7,.8,1],[1,.95,.85],[1,.75,.5],[.85,.9,1]][(R()*4)|0];
    out.push(Math.cos(ang)*rad,gauss()*S*.05,Math.sin(ang)*rad,c[0],c[1],c[2],.35+R()*.6,1e6,.8+R()*R()*1.9);
  }
  return new Float32Array(out);
}

/* ------------------------------ geometry ------------------------------ */
function eyeG(){return [origin[0]+H.cam.ex,origin[1]+H.cam.ey,origin[2]+H.cam.ez];}
function toEngine(g){return sub(g,origin);}
function rotation(n,w){
  // the smallest turn that lifts engine-up toward the local vertical
  const ang=Math.max(0,Math.acos(Math.max(-1,Math.min(1,n[1])))*w-.02);if(ang<=0)return null;
  const k=norm([n[2],0,-n[0]]),c=Math.cos(ang),s=Math.sin(ang),t=1-c,[x,y,z]=k;
  return [t*x*x+c,t*x*y-s*z,t*x*z+s*y,t*x*y+s*z,t*y*y+c,t*y*z-s*x,t*x*z-s*y,t*y*z+s*x,t*z*z+c];
}
const apply=(F,v)=>F?[F[0]*v[0]+F[1]*v[1]+F[2]*v[2],F[3]*v[0]+F[4]*v[1]+F[5]*v[2],F[6]*v[0]+F[7]*v[1]+F[8]*v[2]]:v;
const applyT=(F,v)=>F?[F[0]*v[0]+F[3]*v[1]+F[6]*v[2],F[1]*v[0]+F[4]*v[1]+F[7]*v[2],F[2]*v[0]+F[5]*v[1]+F[8]*v[2]]:v;
function lookAlong(dir){const l=applyT(frameM,norm(dir));H.cam.yaw=Math.atan2(l[2],l[0]);H.cam.pitch=Math.max(-1.45,Math.min(1.45,Math.asin(Math.max(-1,Math.min(1,l[1])))));}
function setEye(g){const e=toEngine(g);H.cam.ex=e[0];H.cam.ey=e[1];H.cam.ez=e[2];}
function locate(){
  const eye=eyeG();let best=null,bd=Infinity;
  for(const s of G.systems){const d=len(sub(eye,s.planet));if(d<bd){bd=d;best=s;}}
  near=best;nearAlt=bd-best.R;
  const st=H.state(),free=st.watchMode==="free"&&st.pilotId==null;
  const w=free?1-Math.min(1,Math.max(0,(nearAlt-.3*best.R)/(1.1*best.R))):0;
  frameM=w>0?rotation(norm(sub(eye,best.planet)),w*w*(3-2*w)):null;
  H.setFrame(frameM);
}
function surfaceDistance(eye){
  let d=Infinity;
  for(const s of G.systems){
    d=Math.min(d,len(sub(eye,s.planet))-s.R,len(sub(eye,s.pos))-s.sunR);
    for(const x of s.extras)d=Math.min(d,len(sub(eye,x.pos))-x.R);
  }
  return Math.max(0,d);
}

/* ------------------------------ travel ------------------------------ */
const ease=t=>t<0?0:t>1?1:t*t*(3-2*t);
function vantage(s){
  const sunH=norm([s.sunDir[0],0,s.sunDir[2]]),side=cross([0,1,0],sunH);
  const dir=norm(add(add([0,.5,0],mul(sunH,.72)),mul(side,.5)));
  return add(s.planet,mul(dir,s.R*3.3));
}
function jump(i,then){
  const s=G.systems[i];if(!s||anim)return;
  H.freeCam();galaxyView=false;chooser=false;
  const to=vantage(s);
  anim={kind:"jump",t:0,sys:s,to,from:eyeG(),dir:norm(sub(to,eyeG())),yaw0:H.cam.yaw,pitch0:H.cam.pitch,v:0,then};
  H.sound?.("jump");
}
function showGalaxy(){
  if(anim)return;H.freeCam();galaxyView=true;chooser=false;
  const to=[0,U.SPAN*2.5,U.SPAN*.7];
  anim={kind:"jump",t:0,sys:null,to,from:eyeG(),dir:norm(sub(to,eyeG())),yaw0:H.cam.yaw,pitch0:H.cam.pitch,v:0,look:[0,0,0]};
}
function descend(s,city){
  if(anim)return;H.freeCam();galaxyView=false;
  const centre=add(s.planet,mul(city.dir,s.R)),sunFlat=norm(sub(s.sunDir,mul(city.dir,dot(s.sunDir,city.dir))));
  const side=cross(city.dir,sunFlat),back=norm(add(mul(side,.8),mul(sunFlat,.6)));
  const to=add(add(centre,mul(city.dir,2600)),mul(back,city.capital?19000:10000));
  anim={kind:"fly",t:0,T:3.4,sys:s,from:eyeG(),to,look:add(centre,mul(city.dir,city.capital?2600:900)),label:city.name};
}
function orbit(s){if(anim)return;H.freeCam();anim={kind:"fly",t:0,T:2.6,sys:s,from:eyeG(),to:vantage(s),look:s.planet};}
function stepAnim(dt){
  const a=anim;a.t+=dt;
  if(a.kind==="fly"){
    // swing round the world, never through it: turn the direction, slide the height
    const C=a.sys.planet,u=ease(a.t/a.T),p0=sub(a.from,C),p1=sub(a.to,C),r0=len(p0),r1=len(p1);
    const d=norm(add(mul(norm(p0),1-u),mul(norm(p1),u))),r=Math.exp(Math.log(r0)*(1-u)+Math.log(r1)*u);
    const bump=Math.max(0,a.sys.R*1.02-Math.min(r0,r1))*Math.sin(Math.PI*u);
    setEye(add(C,mul(d,Math.max(r,a.sys.R+40)+bump)));locate();
    lookAlong(sub(a.look,eyeG()));
    if(a.t>=a.T){anim=null;if(a.label)H.toast(a.label.toUpperCase());}
    return;
  }
  const T1=.95,T2=1.5;
  if(a.t<T1){
    // spool up: turn onto the heading and run
    const u=ease(a.t/T1),l=applyT(frameM,a.dir),yaw=Math.atan2(l[2],l[0]),pitch=Math.asin(Math.max(-1,Math.min(1,l[1])));
    let dy=yaw-a.yaw0;while(dy>Math.PI)dy-=6.2832;while(dy<-Math.PI)dy+=6.2832;
    H.cam.yaw=a.yaw0+dy*u;H.cam.pitch=a.pitch0+(pitch-a.pitch0)*u;
    a.v=Math.max(2000,a.v)*Math.exp(dt*9);const e=eyeG(),f=apply(frameM,[Math.cos(H.cam.yaw)*Math.cos(H.cam.pitch),Math.sin(H.cam.pitch),Math.sin(H.cam.yaw)*Math.cos(H.cam.pitch)]);
    const stepped=add(e,mul(f,a.v*dt));if(surfaceDistance(stepped)>2000)setEye(stepped);
    warp=Math.max(warp,u);if(a.t>T1-.14)flash=1;
  }else{
    if(!a.cut){a.cut=true;flash=1;}
    const u=Math.min(1,(a.t-T1)/T2),k=Math.pow(1-u,4),far=len(sub(a.to,a.from))>1e7?Math.min(len(sub(a.to,a.from))*.5,(a.sys?a.sys.R:U.SPAN)*40):0;
    setEye(sub(a.to,mul(a.dir,far*k)));locate();
    lookAlong(sub(a.look||a.sys.planet,eyeG()));
    warp=Math.max(warp,k);
    if(u>=1){anim=null;if(a.sys)H.toast(a.sys.name.toUpperCase()+" · "+short(owners[a.sys.i]).toUpperCase());if(a.then)a.then();}
  }
}
function update(wall,dt){
  if(!H)return false;
  locate();
  if(anim)stepAnim(dt);
  const e=eyeG();
  if(lastEye&&dt>0){const v=len(sub(e,lastEye))/dt;speed+=(Math.min(v,1e12)-speed)*Math.min(1,dt*6);}
  lastEye=e;
  const want=anim?0:Math.max(0,Math.min(1,(Math.log10(Math.max(1,speed))-5.6)/2.4));
  warp+=((anim&&anim.kind==='jump'?warp:want)-warp)*Math.min(1,dt*5);if(!anim&&want===0&&warp<.01)warp=0;
  flash=Math.max(0,flash-dt*2.2);
  if(near&&H.skySun){const v=sub(near.pos,e),d=len(v),k=Math.min(1,6e8/d);H.skySun(mul(v,1/d),near.sunCol.map(c=>c*1.2*k));}
  if(wall-uiAt>.2){uiAt=wall;refreshUi();}
  drawFx(dt);
  return !!anim;
}
function flyStep(dt,boost){
  const st=H.state(),e=[H.cam.ex,H.cam.ey,H.cam.ez],fromBattle=st.ships&&st.ships.length?Math.hypot(e[0],e[1],e[2]):1e9;
  return U.flightSpeed(surfaceDistance(eyeG()),fromBattle,boost)*dt;
}
function wheelScale(){
  const st=H.state(),fromBattle=st.ships&&st.ships.length?Math.hypot(H.cam.ex,H.cam.ey,H.cam.ez):1e9;
  return Math.max(.02,U.flightSpeed(surfaceDistance(eyeG()),fromBattle,false)/3240);
}
// What the helm's cruise drive may do out here: nothing near ships, a great deal in the open.
function cruiseCap(s,normal,surface){
  const fromBattle=Math.hypot(s.x,s.y,s.z);
  return Math.max(normal,Math.min(surface*.6,Math.max(2400,(fromBattle-8000)*.8)));
}

/* ------------------------------ drawing ------------------------------ */
function basis(){
  const [f,r,u]=H.camBasis(),ar=H.cvs.width/H.cvs.height;
  return {f,r,u,ar,px:H.state().rtH/(2*TAN)};
}
function restore(){
  gl.bindVertexArray(null);gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.disable(gl.CULL_FACE);gl.disable(gl.SCISSOR_TEST);
}
function guard(fn){
  if(broken||!H)return;
  try{if(!ok)build();fn();}catch(err){broken=true;console.error("cosmos",err);}
  finally{try{restore();}catch(e){}}
}
function drawSky(m,wall){guard(()=>{
  const B=basis(),e=eyeG(),p=P.sprite;
  gl.useProgram(p.p);gl.uniformMatrix4fv(p.u.uVP,false,m);gl.uniform3fv(p.u.uRt,B.r);gl.uniform3fv(p.u.uUp,B.u);gl.uniform1f(p.u.uPx,B.px);
  gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  gl.uniform3f(p.u.uEye,e[0],e[1],e[2]);
  gl.uniform1f(p.u.uKind,0);gl.bindVertexArray(dust.vao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,dust.n);
  gl.uniform1f(p.u.uKind,1);gl.bindVertexArray(stars.vao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,stars.n);
  // every sun, as a star from afar and a glare up close
  const d=sysSprites.data;
  G.systems.forEach((s,i)=>{const rel=sub(s.pos,e),c=s.sunCol;d.set([rel[0],rel[1],rel[2],c[0],c[1],c[2],1.25,s.sunR*7,4.2],i*9);});
  gl.bindBuffer(gl.ARRAY_BUFFER,sysSprites.buf);gl.bufferSubData(gl.ARRAY_BUFFER,0,d);
  gl.uniform3f(p.u.uEye,0,0,0);gl.bindVertexArray(sysSprites.vao);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,sysSprites.n);
});}
function capUniforms(p,m,rel,R){
  const d=len(rel),axis=mul(rel,-1/d),[t1,t2]=U.tangent(axis),alt=Math.max(d-R,1);
  const thH=Math.acos(Math.min(1,R/d)),thMax=Math.min(Math.PI,thH*1.03+.03);
  const target=Math.min(1,Math.max(1e-9,.12*alt/R)*NR/thMax);
  let lo=1e-4,hi=30;for(let i=0;i<40;i++){const k=(lo+hi)/2;if(k/Math.expm1(k)>target)lo=k;else hi=k;}
  const k=(lo+hi)/2,subP=mul(rel,1-R/d);
  gl.uniformMatrix4fv(p.u.uVP,false,m);gl.uniform3fv(p.u.uAxis,axis);gl.uniform3fv(p.u.uT1,t1);gl.uniform3fv(p.u.uT2,t2);gl.uniform3fv(p.u.uSub,subP);
  gl.uniform1f(p.u.uR,R);gl.uniform1f(p.u.uK,k);gl.uniform1f(p.u.uA,thMax/Math.expm1(k));
  return {d,axis,alt};
}
function atmoUniforms(p,body,sunDir,sunCol){
  const b=body.biome,k=b.atmoK*26;
  gl.uniform3f(p.u.uBeta,b.atmo[0]*k,b.atmo[1]*k,b.atmo[2]*k);gl.uniform1f(p.u.uAtmoH,b.atmoK>0?U.ATMO:0);
  gl.uniform3fv(p.u.uSunDir,sunDir);gl.uniform3f(p.u.uSunI,sunCol[0]*1.7,sunCol[1]*1.7,sunCol[2]*1.7);
}
function cityLight(s){
  const o=owners[s.i];if(o===s.i)return s.def.light;
  const c=H.RACE_DEFS[o].beam;return s.def.light.map((v,i)=>v*.3+c[i]*.7);
}
function drawPlanet(m,body,s,rel,wall,centre){
  const p=P.planet,b=body.biome,sunDir=norm(sub(s.pos,centre));
  gl.useProgram(p.p);
  const c=capUniforms(p,m,rel,body.R);atmoUniforms(p,body,sunDir,s.sunCol);
  gl.uniform3fv(p.u.uSunCol,s.sunCol);gl.uniform3fv(p.u.uSea,b.sea);gl.uniform3fv(p.u.uL1,b.l1);gl.uniform3fv(p.u.uL2,b.l2);gl.uniform3fv(p.u.uL3,b.l3);
  gl.uniform3fv(p.u.uIce,b.ice);gl.uniform3fv(p.u.uCloudC,b.cloud);gl.uniform3fv(p.u.uGlow,b.glow);
  gl.uniform3fv(p.u.uEyeR,mul(rel,-1/body.R));
  gl.uniform4f(p.u.uP1,b.level,b.iceAmt,b.cloudAmt,b.rough);gl.uniform4f(p.u.uP2,b.sprawl,b.glowAmt,b.gas,body.seed);
  const home=body===s;
  gl.uniform4f(p.u.uP3,b.atmoK,home?burn[s.i]||0:0,wall,c.alt/body.R);
  gl.uniform1f(p.u.uOct,H.state().quality==="low"?4:5);
  let nearest=-1;
  if(home){
    gl.uniform3fv(p.u.uCityCol,cityLight(s));
    const flat=new Float32Array(64);let best=-2;
    s.cities.forEach((ct,i)=>{flat.set([ct.dir[0],ct.dir[1],ct.dir[2],ct.r],i*4);const dd=dot(c.axis,ct.dir);if(dd>best){best=dd;nearest=i;}});
    gl.uniform4fv(p.u.uCity,flat);gl.uniform1i(p.u.uNC,s.cities.length);
    const ct=s.cities[nearest],o=mul(sub(c.axis,ct.dir),body.R);
    if(len(o)<4e5){gl.uniform3fv(p.u.uCE,ct.e);gl.uniform3fv(p.u.uCN,ct.n);gl.uniform3f(p.u.uCityO,dot(o,ct.e),dot(o,ct.n),0);}else nearest=-1;
  }else{gl.uniform1i(p.u.uNC,0);gl.uniform3f(p.u.uCityCol,0,0,0);}
  gl.uniform1i(p.u.uNear,nearest);
  gl.bindVertexArray(grid.vao);gl.drawElements(gl.TRIANGLES,grid.n,gl.UNSIGNED_INT,0);
}
function drawSun(m,s,rel,wall){
  const p=P.sun;gl.useProgram(p.p);capUniforms(p,m,rel,s.sunR);gl.uniform3fv(p.u.uCol,s.sunCol);gl.uniform1f(p.u.uT,wall);
  gl.bindVertexArray(grid.vao);gl.drawElements(gl.TRIANGLES,grid.n,gl.UNSIGNED_INT,0);
}
function cityMesh(s,ci){
  const key=s.i+":"+ci;let c=cityCache.get(key);if(c){c.used=performance.now();return c;}
  const data=U.skyline(s.cities[ci],s.def.arch,H.state().quality==="low"?5000:12000),vao=gl.createVertexArray(),buf=gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER,box.v);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,32,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,32,12);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,2,gl.FLOAT,false,32,24);
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  [[3,2,0],[4,3,8],[5,4,20]].forEach(([loc,size,off])=>{gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,36,off);gl.vertexAttribDivisor(loc,1);});
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,box.i);gl.bindVertexArray(null);
  c={vao,buf,n:data.length/9,used:performance.now()};cityCache.set(key,c);
  if(cityCache.size>5){let old=null;for(const [k,v] of cityCache)if(k!==key&&(!old||v.used<cityCache.get(old).used))old=k;const o=cityCache.get(old);gl.deleteVertexArray(o.vao);gl.deleteBuffer(o.buf);cityCache.delete(old);}
  return c;
}
function drawCities(m,s,e,wall){
  const p=P.city,relC=sub(s.planet,e);let bound=false;
  s.cities.forEach((ct,ci)=>{
    const centre=add(relC,mul(ct.dir,s.R)),d=len(centre);if(d>s.R*.5)return;
    if(dot(centre,ct.dir)>0&&d>30000)return;                       // over the horizon, seen from below
    const mesh=cityMesh(s,ci),count=Math.max(1,Math.min(mesh.n,Math.round(mesh.n*Math.pow(Math.min(1,45000/d),1.4))));
    if(!bound){
      bound=true;gl.useProgram(p.p);gl.uniformMatrix4fv(p.u.uVP,false,m);atmoUniforms(p,s,s.sunDir,s.sunCol);
      gl.uniform3fv(p.u.uEyeR,mul(relC,-1/s.R));gl.uniform1f(p.u.uR,s.R);
      gl.uniform3fv(p.u.uCol,s.def.arch.col);gl.uniform3fv(p.u.uCityCol,cityLight(s));gl.uniform3fv(p.u.uSunCol,s.sunCol);
      gl.uniform1f(p.u.uStyle,s.def.arch.style);gl.uniform1f(p.u.uLean,s.def.arch.lean||0);gl.uniform1f(p.u.uBurn,burn[s.i]||0);gl.uniform1f(p.u.uT,wall);
    }
    const mu=dot(ct.dir,s.sunDir),t=Math.min(1,Math.max(0,(mu+.1)/.48)),nf=1-t*t*(3-2*t),day=Math.min(1,Math.max(0,(mu+.05)/.25));
    const a=s.biome.atmo,an=a[0]+a[1]+a[2]||1;
    gl.uniform3f(p.u.uAmb,a[0]/an*.5*day+.03,a[1]/an*.5*day+.03,a[2]/an*.5*day+.035);
    gl.uniform1f(p.u.uNight,.35+.65*nf);gl.uniform1f(p.u.uLit,.3+.4*nf);
    gl.uniform3fv(p.u.uCityRel,centre);gl.uniform3fv(p.u.uE,ct.e);gl.uniform3fv(p.u.uN,ct.n);gl.uniform3fv(p.u.uU,ct.dir);
    gl.bindVertexArray(mesh.vao);gl.drawElementsInstanced(gl.TRIANGLES,box.n,gl.UNSIGNED_SHORT,0,count);
  });
}
let visible=[];
function drawOpaque(m,wall){guard(()=>{
  const e=eyeG();visible=[];
  for(const s of G.systems){
    const add1=(kind,body,pos,R)=>{const rel=sub(pos,e),d=len(rel);if(R/d>.0016&&d>R)visible.push({kind,body,s,rel,d,R,c:pos});};
    add1("sun",s,s.pos,s.sunR);add1("planet",s,s.planet,s.R);for(const x of s.extras)add1("planet",x,x.pos,x.R);
  }
  visible.sort((a,b)=>b.d-a.d);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);
  for(const v of visible){if(v.kind==="sun")drawSun(m,v.s,v.rel,wall);else drawPlanet(m,v.body,v.s,v.rel,wall,v.c);}
  if(near&&nearAlt<near.R*.5)drawCities(m,near,e,wall);
  placeTags(m,e);
});}
function drawTransparent(m){guard(()=>{
  const B=basis(),p=P.sky;let bound=false;
  for(const v of visible){
    if(v.kind!=="planet"||!(v.body.biome.atmoK>0)||v.R/v.d<.02)continue;
    const Ra=v.R*(1+U.ATMO),inside=v.d<Ra*1.02,W=H.state().rtW,Hh=H.state().rtH;
    // only the pixels the air could touch
    if(!inside){
      const zc=dot(v.rel,B.f);if(zc<-Ra)continue;
      const ang=Math.asin(Math.min(1,Ra/v.d)),dirZ=zc/v.d;
      if(Math.acos(Math.max(-1,Math.min(1,dirZ)))-ang>1.2)continue;
      if(zc>Ra){
        const cx=dot(v.rel,B.r)/zc/(TAN*B.ar),cy=dot(v.rel,B.u)/zc/TAN,rr=Math.tan(Math.min(1.5,ang))/TAN*1.5/Math.max(.2,dirZ);
        const x0=Math.max(0,Math.floor((cx-rr/B.ar)*.5*W+.5*W)),x1=Math.min(W,Math.ceil((cx+rr/B.ar)*.5*W+.5*W)),y0=Math.max(0,Math.floor((cy-rr)*.5*Hh+.5*Hh)),y1=Math.min(Hh,Math.ceil((cy+rr)*.5*Hh+.5*Hh));
        if(x1<=x0||y1<=y0)continue;gl.enable(gl.SCISSOR_TEST);gl.scissor(x0,y0,x1-x0,y1-y0);
      }else gl.disable(gl.SCISSOR_TEST);
    }else gl.disable(gl.SCISSOR_TEST);
    if(!bound){bound=true;gl.useProgram(p.p);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(false);gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform3fv(p.u.uF,B.f);gl.uniform3fv(p.u.uRt,mul(B.r,TAN*B.ar));gl.uniform3fv(p.u.uUp,mul(B.u,TAN));}
    atmoUniforms(p,v.body,norm(sub(v.s.pos,v.c)),v.s.sunCol);
    gl.uniform3fv(p.u.uEyeR,mul(v.rel,-1/v.R));
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
});}

/* ------------------------------ the war ------------------------------ */
function load(){try{const o=JSON.parse(localStorage.getItem("tributeCosmos1")||"null");if(o&&Array.isArray(o.owners)&&o.owners.length===U.WORLDS.length&&o.owners.every(v=>v>=0&&v<U.WORLDS.length))owners=o.owners;}catch(e){}}
function save(){try{localStorage.setItem("tributeCosmos1",JSON.stringify({owners}));}catch(e){}}
// The engine asks where this war is. Every war is over somebody's homeworld.
function siteFor(attacker,defender){
  site=U.siteFor(owners,attacker,defender,pending);pending=null;
  origin=G.systems[site].site.slice();site0=site;resultFor=-1;anim=null;lastEye=null;galaxyView=false;chooser=false;panelKey="";
  return U.engineSystem(site,H.sceneR,window.ArmadaSystems&&window.ArmadaSystems.battlefield);
}
function invade(race,world){
  if(anim)return;
  if(owners[world]===race){H.toast(short(race).toUpperCase()+" ALREADY HOLD "+G.systems[world].name.toUpperCase());return;}
  chooser=false;flash=1;pending=world;
  H.toast(short(race).toUpperCase()+" JUMP FOR "+G.systems[world].name.toUpperCase());
  H.invade(race,owners[world]);
}
function onWinner(side){
  const st=H.state();if(site0==null||resultFor===site0)return;resultFor=site0;
  const s=G.systems[site0],attacker=st.sideRace[0];
  if(side===0){owners=U.conquer(owners,site0,attacker);save();burn[site0]=Math.max(burn[site0]||0,.8);
    setTimeout(()=>H.toast(s.name.toUpperCase()+" HAS FALLEN TO "+short(attacker).toUpperCase()),2600);}
  else setTimeout(()=>H.toast(s.name.toUpperCase()+" HOLDS"),2600);
  panelKey="";
}
function liberate(){owners=U.freshOwners();burn=[];save();panelKey="";H.toast("THE OLD BORDERS ARE RESTORED");}
function warState(){
  const st=H.state(),live=st.ships&&st.ships.length>0&&st.winner==null&&site0!=null;
  if(live&&st.spawned[1]>0)burn[site0]=Math.max(burn[site0]||0,Math.min(.85,(1-Math.max(0,st.counts[1])/st.spawned[1])*.9));
  return {st,live};
}

/* ------------------------------ interface ------------------------------ */
const short=i=>H.fleetTitle(H.RACE_DEFS[i].name).replace(/^The /,"");
const esc=t=>String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
const el=id=>document.getElementById(id);
const CSS=`
#uniDock{position:fixed;left:0;right:0;bottom:0;z-index:11;display:flex;align-items:center;gap:8px;height:48px;padding:0 10px calc(env(safe-area-inset-bottom));box-sizing:content-box;background:linear-gradient(#0b1219d9,#070b10f5);border-top:1px solid #3b4b59;font:12px system-ui;color:#dce5ec}
#uniDock button{font:600 12px system-ui;color:#e8edf2;background:#1d2b38;border:1px solid #4b6072;border-radius:6px;height:34px;padding:0 10px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:6px;flex:0 0 auto}
#uniDock button:hover{background:#31475a}#uniDock button.on{background:#c0d3e2;color:#172535;border-color:#c0d3e2}
#uniDock button.war{border-color:#ff8a5c;box-shadow:0 0 10px -2px #ff6a3c}
#uniDock button.taken{border-color:var(--oc)}#uniDock button.taken::after{content:"";width:7px;height:7px;border-radius:50%;background:var(--oc)}
#uniStatus{flex:0 0 auto;min-width:150px;max-width:260px;font:600 10.5px "IBM Plex Mono",monospace;letter-spacing:.06em;color:#9fb4c4;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#uniStatus b{display:block;color:#e8edf2;font-size:11.5px;overflow:hidden;text-overflow:ellipsis}
#uniChips{display:flex;gap:6px;overflow-x:auto;flex:1 1 auto;padding:6px 0;scrollbar-width:thin;scrollbar-color:#3b4b59 transparent}
#uniChips svg{flex:0 0 auto}
#uniPanel{position:fixed;left:16px;bottom:128px;z-index:10;width:min(330px,calc(100vw - 32px));max-height:calc(100dvh - 240px);overflow:auto;box-sizing:border-box;padding:14px 16px;background:#0e1820ee;border:1px solid #4b6072;border-radius:10px;color:#e3eaef;font:13px/1.5 system-ui;box-shadow:0 8px 40px #000a}
#uniPanel[hidden],#uniPrompt[hidden]{display:none}
#uniPanel h2{margin:2px 0 0;font:700 30px/1 "Saira Condensed",system-ui;letter-spacing:.07em;text-transform:uppercase}
#uniPanel .eyebrow{font:600 10px "IBM Plex Mono",monospace;letter-spacing:.2em;color:#9fb4c4;text-transform:uppercase}
#uniPanel .own{display:flex;align-items:center;gap:8px;margin:8px 0;font-weight:600}
#uniPanel .own.fallen{color:#ffb48a}
#uniPanel p{margin:6px 0;color:#c4d0d8}
#uniPanel dl{display:grid;grid-template-columns:auto 1fr;gap:1px 12px;margin:8px 0;font-size:12px}#uniPanel dt{color:#8fa3b2}#uniPanel dd{margin:0}
#uniPanel .row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#uniPanel button{font:600 12px system-ui;color:#e8edf2;background:#263747;border:1px solid #597084;border-radius:6px;min-height:34px;padding:5px 10px;cursor:pointer}
#uniPanel button:hover{background:#3a5165}
#uniPanel button.primary{background:#e2573a;border-color:#ff8a6a;color:#fff}#uniPanel button.primary:hover{background:#f06a4c}
#uniPanel .cities button{font-weight:500;min-height:28px;padding:3px 8px;font-size:11.5px}
#uniPanel .fleets{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}
#uniPanel .fleets button{display:flex;align-items:center;gap:6px;text-align:left;font-size:11px;padding:4px 6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#uniTags{position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden}
.uniTag{position:absolute;left:0;top:0;transform:translate(-50%,0);padding:3px 7px;text-align:center;color:var(--c);font:700 13px "Saira Condensed",system-ui;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 1px 3px #000,0 0 8px #000;white-space:nowrap;pointer-events:auto;cursor:pointer;will-change:transform;background:none;border:0}
.uniTag i{display:block;font:500 9.5px "IBM Plex Mono",monospace;letter-spacing:.06em;color:#c9d5dd;text-transform:none}
.uniTag::before{content:"";display:block;width:1px;height:14px;margin:0 auto 2px;background:currentColor;opacity:.7}
.uniTag:hover{color:#fff}
#uniFx{position:fixed;inset:0;width:100%;height:100%;z-index:4;pointer-events:none}
#uniFlash{position:fixed;inset:0;z-index:4;pointer-events:none;background:#dfeeff;opacity:0}
#uniPrompt{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:12;font:600 13px system-ui;color:#fff;background:#e2573a;border:1px solid #ff9a7c;border-radius:20px;padding:10px 18px;cursor:pointer;box-shadow:0 6px 24px #000a}
body.cosmos #watchDock{bottom:64px}body.cosmos #battleOptions{bottom:64px}body.cosmos #bcSpeed{bottom:118px}body.cosmos #card{bottom:172px}body.cosmos #bcCaption{bottom:166px}body.cosmos #bcReplayChip{bottom:122px}body.cosmos #uiBack{bottom:64px}
body.menu-start #uniDock,body.menu-start #uniPanel,body.menu-start #uniTags,body.menu-start #uniPrompt,body.piloting #uniDock,body.piloting #uniPanel,body.ending #uniPanel,body.replaying #uniPanel,body.replaying #uniTags,body.intro #uniPanel{display:none}
body.cosmos.away #bcTop,body.cosmos.away #bcFeed,body.cosmos.away #bcTicker,body.cosmos.away #bcCaption,body.cosmos.away #bcPlan,body.cosmos.away #bcObjective,body.cosmos.away #bcTags,body.cosmos.away #bcMomentum,body.cosmos.away #bcMomentumLabel,body.cosmos.away #watchDock,body.cosmos.away #bcSpeed,body.cosmos.away #bcReplayChip,body.cosmos.away #card{display:none!important}
body.noui>#uniFx:not(#a):not(#b):not(#c),body.noui>#uniFlash:not(#a):not(#b):not(#c){visibility:visible!important}
body.idle #uniDock{opacity:.25;transition:opacity 1.2s}#uniDock{transition:opacity .3s}
@media(max-width:820px){
 #uniStatus{display:none}#uniDock{gap:6px;padding-left:6px;padding-right:6px}#uniDock button{height:38px}
 body.cosmos #watchDock{bottom:calc(124px + env(safe-area-inset-bottom))}body.cosmos #battleOptions{bottom:calc(64px + env(safe-area-inset-bottom))}body.cosmos #bcSpeed{bottom:calc(202px + env(safe-area-inset-bottom))}
 #uniPanel{left:10px;bottom:calc(64px + env(safe-area-inset-bottom));max-height:46dvh;width:calc(100vw - 20px)}#uniPanel h2{font-size:24px}
}`;
function dom(){
  const style=document.createElement("style");style.textContent=CSS;document.head.appendChild(style);
  const mk=(tag,id,html)=>{const e=document.createElement(tag);e.id=id;if(html)e.innerHTML=html;document.body.appendChild(e);return e;};
  fx=mk("canvas","uniFx");fx.setAttribute("aria-hidden","true");mk("div","uniFlash").setAttribute("aria-hidden","true");
  const tags=mk("div","uniTags");
  G.systems.forEach(s=>{const b=document.createElement("button");b.className="uniTag";b.type="button";b.dataset.w=s.i;b.innerHTML="<span></span><i></i>";b.style.display="none";tags.appendChild(b);s.tag=b;});
  tags.addEventListener("click",e=>{const b=e.target.closest(".uniTag");if(b)jump(+b.dataset.w);});
  mk("aside","uniPanel").hidden=true;
  const prompt=mk("button","uniPrompt");prompt.type="button";prompt.hidden=true;
  prompt.addEventListener("click",()=>{if(prompt.dataset.race)invade(+prompt.dataset.race,+prompt.dataset.world);});
  const dock=mk("nav","uniDock","<button type=\"button\" id=\"uniGalaxy\" title=\"See the whole galaxy (Tab)\">◎ Galaxy</button><button type=\"button\" id=\"uniBattle\" title=\"Back to the battle\">⚔ Battle</button><div id=\"uniStatus\"></div><div id=\"uniChips\" role=\"group\" aria-label=\"Homeworlds\"></div>");
  dock.setAttribute("aria-label","The galaxy");
  el("uniGalaxy").addEventListener("click",showGalaxy);
  el("uniBattle").addEventListener("click",()=>{anim=null;galaxyView=false;H.watchBattle();});
  el("uniChips").addEventListener("click",e=>{const b=e.target.closest("[data-w]");if(b)jump(+b.dataset.w);});
  el("uniChips").addEventListener("wheel",e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){el("uniChips").scrollLeft+=e.deltaY;e.preventDefault();}},{passive:false});
  el("uniPanel").addEventListener("click",e=>{
    const b=e.target.closest("button");if(!b||!near)return;const a=b.dataset.act;
    if(a==="orbit")orbit(near);else if(a==="city")descend(near,near.cities[+b.dataset.c]);
    else if(a==="invade"){chooser=!chooser;panelKey="";refreshUi();}
    else if(a==="fleet")invade(+b.dataset.r,near.i);
    else if(a==="watch"){galaxyView=false;H.watchBattle();}
    else if(a==="restore")liberate();
  });
  document.body.classList.add("cosmos");
  chips();
}
function chips(){
  el("uniChips").innerHTML=G.systems.map(s=>{
    const o=owners[s.i],taken=o!==s.i,c=H.RACE_DEFS[o].beam.map(v=>Math.round(v*255)).join(",");
    return "<button type=\"button\" data-w=\""+s.i+"\" class=\""+(taken?"taken":"")+"\" style=\"--oc:rgb("+c+")\" title=\""+esc(s.name+" · homeworld of "+short(s.i)+(taken?" · held by "+short(o):""))+"\">"+H.fleetEmblem(s.i,20)+esc(s.name)+"</button>";
  }).join("");
}
function refreshUi(){
  if(!el("uniDock"))return;
  const {st,live}=warState(),e=eyeG(),away=Math.hypot(H.cam.ex,H.cam.ey,H.cam.ez)>60000||!st.ships||!st.ships.length;
  document.body.classList.toggle("away",away);
  // status line
  const inSys=near&&nearAlt<near.R*60;
  let where=inSys?near.name:galaxyView?"The galaxy":"Deep space",sub2;
  if(inSys)sub2=nearAlt<near.R*.02?"altitude "+U.fmtDist(nearAlt):U.fmtDist(nearAlt)+" up";
  else{let bd=Infinity,bs=null;for(const s of G.systems){const d=len(sub(e,s.pos));if(d<bd){bd=d;bs=s;}}sub2=bs.name+" "+U.fmtDist(bd);}
  el("uniStatus").innerHTML="<b>"+esc(where)+"</b>"+esc(sub2+(speed>4000?" · "+U.fmtSpeed(speed):""));
  // chips
  const key=owners.join(",")+"|"+(live?site0:-1);
  if(chips.key!==key){chips.key=key;chips();}
  for(const b of el("uniChips").children){const i=+b.dataset.w;b.classList.toggle("on",!!inSys&&near.i===i);b.classList.toggle("war",live&&site0===i);}
  el("uniBattle").style.display=st.ships&&st.ships.length?"":"none";
  el("uniGalaxy").classList.toggle("on",galaxyView&&!inSys);
  // the world panel
  const panel=el("uniPanel"),show=inSys&&st.pilotId==null&&(away||st.watchMode==="free")&&!anim;
  if(!show){panel.hidden=true;panelKey="";}
  else{
    const s=near,o=owners[s.i],battle=live&&site0===s.i,low=nearAlt<s.R*.03&&!chooser,k=[s.i,o,battle,chooser,low,st.sideRace.join()].join("|");
    if(k!==panelKey){
      panelKey=k;const taken=o!==s.i;
      let h;
      if(low)h="<div class=\"eyebrow\">"+esc(s.name)+" · "+esc(short(o))+"</div><div class=\"row cities\">"+s.cities.map((c,i)=>"<button data-act=\"city\" data-c=\""+i+"\">"+(c.capital?"★ ":"")+esc(c.name)+"</button>").join("")+"</div><div class=\"row\"><button data-act=\"orbit\">↑ Back to orbit</button><button data-act=\"invade\" class=\"primary\">⚔ Send a fleet</button></div>";
      else{
      h="<div class=\"eyebrow\">"+esc(s.star)+" system · homeworld of "+esc(short(s.i))+"</div><h2>"+esc(s.name)+"</h2>"+
        "<div class=\"own"+(taken?" fallen":"")+"\">"+H.fleetEmblem(o,26)+"<span>"+(taken?"Occupied by "+esc(short(o)):"Held by "+esc(short(o)))+"</span></div>"+
        "<p>"+esc(s.def.blurb)+"</p><dl><dt>Capital</dt><dd>"+esc(s.def.capital)+"</dd><dt>People</dt><dd>"+esc(s.def.pop)+"</dd><dt>Radius</dt><dd>"+U.fmtDist(s.R)+"</dd></dl>";
      if(battle)h+="<p><b>"+esc(short(st.sideRace[0]))+"</b> are attacking. The battle is "+U.fmtDist(s.R*U.ALT)+" above "+esc(s.def.capital)+".</p><div class=\"row\"><button data-act=\"watch\" class=\"primary\">⚔ Watch the battle</button><button data-act=\"orbit\">Orbit</button></div>";
      else h+="<div class=\"row\"><button data-act=\"invade\" class=\"primary\">"+(chooser?"Cancel":"⚔ Send a fleet")+"</button><button data-act=\"orbit\">Orbit</button></div>";
      if(chooser&&!battle)h+="<div class=\"eyebrow\" style=\"margin-top:10px\">Who jumps for "+esc(s.name)+"?</div><div class=\"fleets\">"+H.RACE_DEFS.map((r,i)=>i===o?"":"<button data-act=\"fleet\" data-r=\""+i+"\">"+H.fleetEmblem(i,20)+"<span>"+esc(short(i))+"</span></button>").join("")+"</div>";
      h+="<div class=\"eyebrow\" style=\"margin-top:12px\">Fly down to a city</div><div class=\"row cities\">"+s.cities.map((c,i)=>"<button data-act=\"city\" data-c=\""+i+"\">"+(c.capital?"★ ":"")+esc(c.name)+"</button>").join("")+"</div>";
      if(owners.some((v,i)=>v!==i))h+="<div class=\"row\"><button data-act=\"restore\" style=\"opacity:.7\">Restore the old borders</button></div>";
      }
      panel.innerHTML=h;
    }
    panel.hidden=false;
  }
  // at the helm over somebody else's world: the fleet is one word away
  const prompt=el("uniPrompt"),ship=st.pilotId!=null?st.ships[st.pilotId]:null;
  if(ship&&inSys&&!(live&&site0===near.i)&&owners[near.i]!==ship.race&&nearAlt<near.R*8){
    prompt.textContent="⚔ Call "+short(ship.race)+" to attack "+near.name+" · Enter";prompt.dataset.race=ship.race;prompt.dataset.world=near.i;prompt.hidden=false;
  }else{prompt.hidden=true;delete prompt.dataset.race;}
}
function placeTags(m,e){
  const st=H.state(),show=st.pilotId==null&&!document.body.classList.contains("menu-start")&&!document.body.classList.contains("noui")&&(st.watchMode==="free"||galaxyView||anim)&&(!near||nearAlt>near.R*.5);
  const w=innerWidth,h=innerHeight,placed=[];
  for(const s of G.systems){
    const t=s.tag;if(!t)continue;
    const rel=sub(s.planet,e),d=len(rel),cw=m[3]*rel[0]+m[7]*rel[1]+m[11]*rel[2];
    let hidden=!show||cw<=0||d<s.R*14;
    if(!hidden&&near&&near!==s){const pc=sub(near.planet,e),along=dot(pc,rel)/d;if(along>0&&dot(pc,pc)-along*along<near.R*near.R)hidden=true;}
    if(hidden){if(t.shown){t.style.display="none";t.shown=false;}continue;}
    const x=((m[0]*rel[0]+m[4]*rel[1]+m[8]*rel[2])/cw*.5+.5)*w,y=(.5-(m[1]*rel[0]+m[5]*rel[1]+m[9]*rel[2])/cw*.5)*h;
    if(x<-80||x>w+80||y<-40||y>h-50){if(t.shown){t.style.display="none";t.shown=false;}continue;}
    if(!t.shown){t.style.display="";t.shown=true;}
    const o=owners[s.i],label=s.name+"|"+o+"|"+U.fmtDist(d);
    if(t.label!==label){t.label=label;const c=H.RACE_DEFS[o].beam;t.style.setProperty("--c","rgb("+c.map(v=>Math.round(140+v*115)).join(",")+")");
      t.firstChild.textContent=s.name;t.lastChild.textContent=short(o)+" · "+U.fmtDist(d);}
    let ty=y+6;for(let pass=0;pass<4;pass++)for(const q of placed)if(Math.abs(q[0]-x)<150&&Math.abs(q[1]-ty)<34)ty=q[1]+34;
    placed.push([x,ty]);
    t.style.transform="translate("+Math.round(x)+"px,"+Math.round(ty)+"px) translate(-50%,0)";
    t.style.opacity=d>U.LY*.2?"1":".75";
  }
}
// hyperspace: stars drawn out into lines from the point you are heading for
let streaks=null;
function drawFx(dt){
  const f=el("uniFlash");if(f)f.style.opacity=flash>0?String(Math.min(.92,flash)):"0";
  if(!fx)return;
  if(warp<=.01){if(fx.on){fx.on=false;fx.getContext("2d").clearRect(0,0,fx.width,fx.height);}return;}
  const w=Math.round(innerWidth*.75),h=Math.round(innerHeight*.75);if(fx.width!==w||fx.height!==h){fx.width=w;fx.height=h;}
  const c=fx.getContext("2d");fx.on=true;c.clearRect(0,0,w,h);
  if(!streaks){const R=U.random(77);streaks=Array.from({length:110},()=>({a:R()*6.283,r:.2+R()*.8,s:.4+R()*1.2,hue:R()}));}
  const cx=w/2,cy=h/2,max=Math.hypot(w,h)/2;
  c.lineCap="round";
  for(const s of streaks){
    s.r+=dt*(.25+warp*2.2)*s.s*(.2+s.r);if(s.r>1.05)s.r=.16+Math.random()*.12;
    const r0=s.r*max,r1=r0*(1+warp*.55*s.s)+2,ca=Math.cos(s.a),sa=Math.sin(s.a);
    c.strokeStyle="rgba("+(s.hue<.3?"170,200,255":s.hue<.8?"235,242,255":"255,220,190")+","+(warp*.5*Math.min(1,(s.r-.14)*4)).toFixed(3)+")";
    c.lineWidth=.5+s.r*1.1*warp;c.beginPath();c.moveTo(cx+ca*r0,cy+sa*r0);c.lineTo(cx+ca*r1,cy+sa*r1);c.stroke();
  }
}
function key(k,e){
  if(!H||document.body.classList.contains("menu-start"))return false;
  if(k==="tab"){e.preventDefault();if(galaxyView&&!anim){galaxyView=false;H.watchBattle();}else showGalaxy();return true;}
  if(k==="enter"){const p=el("uniPrompt");if(p&&!p.hidden&&p.dataset.race){invade(+p.dataset.race,+p.dataset.world);return true;}}
  if((k==="pagedown"||k==="pageup"||k==="."||k===",")&&H.state().pilotId==null){
    const order=G.systems.map(s=>s.i),at=near?order.indexOf(near.i):0,next=order[(at+(k==="pagedown"||k==="."?1:order.length-1))%order.length];
    jump(next);return true;
  }
  if(k==="l"&&near&&nearAlt<near.R*60&&H.state().pilotId==null){descend(near,near.cities[0]);return true;}
  return false;
}
function init(host){
  H=host;gl=host.gl;G=U.galaxy();load();
  try{dom();}catch(err){console.error("cosmos ui",err);}
  return api;
}
const api={init,siteFor,update,flyStep,wheelScale,cruiseCap,drawSky,drawOpaque,drawTransparent,onWinner,key,jump,showGalaxy,invade,descend,
  get driving(){return !!anim;},get owners(){return owners.slice();},get site(){return site0;},get near(){return near;},
  finish(){for(let i=0;i<200&&anim;i++){locate();stepAnim(.1);}flash=0;warp=0;},
  debug(){return {near:near&&near.name,nearAlt,speed,warp,broken,ok,site:site0,origin,anim:anim&&anim.kind};}};
return api;
})();
