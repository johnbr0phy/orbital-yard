/* Seeded crew studies: the same feature-by-feature principle as /faces,
   projected as shaded 3D geometry only for the visible captain. Original interpretations, with no portrait service. */
(function(root){
 const races=['Yard','Shoal','Lattice','Drift','Choir','Imperial','Rebel','Minbari','Shadow','Earthforce','Federation','Klingon','Borg','Mondoshawan','Colonial Marine','Engineer','Yautja','First One'];
 const colors=['#76b9c4','#80bca0','#c3a7eb','#deab73','#e9d495','#9db3d4','#d39975','#86cad6','#a184c7','#9bafd2','#dcb871','#c29b70','#8fca94','#cfb876','#abb78a','#b8ced1','#c5b187','#d7bde6'];
 function rng(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
 function profile(seed,race){
  const R=rng((seed^Math.imul(race+1,2654435761))>>>0),pick=a=>a[Math.floor(R()*a.length)];
  const syll=['Ka','Ve','Or','Tal','Ren','Sa','Mor','Li','Da','Tor','Esh','Na','Kel','Vo','Ar','Sen'];
  const name=pick(syll)+pick(syll).toLowerCase()+' '+pick(syll)+pick(syll).toLowerCase();
  return {seed:seed>>>0,race,name,role:race===12?'Command node':race===8?'Linked host':race===17?'Presence':'Captain',kind:races[race],color:colors[race],skin:pick(['#b98061','#dbb59a','#8e604d','#c5937a','#68483d']),jaw:.75+R()*.4,eyes:.7+R()*.7,nose:R(),hair:R(),age:R(),scar:R(),bridge:Math.floor(R()*4),uniform:R(),earSize:.65+R()*.9,earFlare:R(),eyeSpace:.72+R()*.55,eyeTilt:(R()-.5)*.35,iris:pick(["#77a8a2","#927148","#6d86b0","#766591"]),noseWidth:.65+R()*.95,noseLength:.6+R()*.95,noseBridge:.6+R()*.9,mouthWidth:.65+R()*.65,lip:.5+R(),forehead:.8+R()*.4,cheeks:.75+R()*.5,chin:.7+R()*.65,hairStyle:Math.floor(R()*5),beard:R(),brow:.6+R(),marks:Array.from({length:12},()=>R())};
 }

 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 function emotion(state={}){const fear=clamp(Math.max(state.fear||0,(1-(state.hull??1))*.85)),hurt=clamp(state.hit||0);return {fear,hurt,label:(state.hull??1)<=0?'Signal lost':hurt>.55?'Under fire':fear>.7?'Afraid':fear>.4?'Tense':state.firing?'Determined':'Focused'};}
 // Local 3D ellipsoids and wedges. Depth sorting and directional lighting give
 // noses, ears and cheeks actual depth as the head turns, without another GL context.
 function geometry(p,state={},time=0){
  const e=emotion(state),m=[],phase=p.marks[0]*6.28,blink=Math.pow(Math.max(0,Math.cos(time*1.7+phase)),40),human=[0,3,5,6,9,10,14].includes(p.race),skin=human?p.skin:p.color;
  const w=38*p.jaw,h=54*p.forehead;
  function ell(cx,cy,cz,rx,ry,rz,col,nu=12,nv=8){for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const pt=(a,b)=>{const u=a/nu*6.283,v=b/nv*Math.PI;return [cx+Math.sin(v)*Math.cos(u)*rx,cy+Math.cos(v)*ry,cz+Math.sin(v)*Math.sin(u)*rz];};const a=pt(i,j),b=pt(i+1,j),c=pt(i+1,j+1),d=pt(i,j+1);m.push({v:[a,b,c],col},{v:[a,c,d],col});}}
  ell(0,-99,0,90,49,32,p.uniform>.5?'#304454':'#4a4244',12,6);
  ell(0,-63,0,19,29,21,skin,10,6);
  ell(0,0,0,w,h,34,skin);
  ell(0,-40,10,27*p.chin,24,26,skin,10,6);
  for(const sign of [-1,1]){
   ell(sign*w,-2,-1,9*p.earSize,17*p.earSize,8+8*p.earFlare,skin,8,6);
   ell(sign*w,-2,7,4*p.earSize,10*p.earSize,3,'#775b57',8,4);
   ell(sign*w*.55,-19,16,11*p.cheeks,13,16,skin,8,6);
   const x=sign*17*p.eyeSpace,ey=7+p.eyeTilt*sign*8,open=(3.5+e.fear*3)*(1-blink)+.3;
   ell(x,ey,30,10*p.eyes,open,6,'#d9dcd4',10,6);
   ell(x+Math.sin(time*.7+phase)*1.2,ey,35.5,3.1,Math.min(4,open),1.4,p.iris,8,4);
   ell(x+Math.sin(time*.7+phase)*1.2,ey,36.7,1.4,Math.min(2.6,open),.6,'#162029',8,4);
   ell(x,ey+10+e.fear*4,30,12*p.eyes,2.4*p.brow,4,'#46372f',8,4);
  }
  const nx=(p.nose-.5)*5,nw=6*p.noseWidth,ny=-10*p.noseLength,nz=35+14*p.noseBridge;
  const nose=[[0,19,29],[-nw,ny,32],[nx,ny+3,nz],[nw,ny,32],[0,ny-5,35]];
  for(const ids of [[0,1,2],[0,2,3],[1,4,2],[2,4,3]])m.push({v:ids.map(i=>nose[i]),col:skin});
  const mouthY=-37-e.fear*2,opening=.7+e.fear*3+e.hurt*4;
  ell(0,mouthY,32,14*p.mouthWidth,opening,2.8,'#40272b',10,4);
  ell(0,mouthY-opening-1,32,13*p.mouthWidth,1.5*p.lip,3,'#ac7566',10,4);
  if(human&&p.hair>.14){const col=p.age>.7?'#9a9995':p.hair>.7?'#865c3c':'#302c2d';
   for(let i=0;i<7;i++){const a=(i/6)*Math.PI;ell(Math.cos(a)*w*.8,h*.79+Math.sin(a)*9,-1+(p.hairStyle%2)*14,15,11+p.hairStyle*2,24,col,8,4);}
   if(p.hairStyle===3)for(const sign of [-1,1])ell(sign*w,10,-9,10,47,19,col,8,6);
   if(p.beard>.7)ell(0,-51,23,25*p.chin,13,12,col,10,4);
  }
  if(p.race===7)for(let i=0;i<9;i++){const a=i/8*Math.PI;ell(Math.cos(a)*(w+7),Math.sin(a)*(h+10),-8,8,15,8,'#cccbb5',6,4);}
  if(p.race===11)for(let i=0;i<6;i++)ell(0,22+i*7,30-i*2,9-i*.6,4,7,'#70513d',6,4);
  if(p.race===12){ell(-20,9,36,16,18,6,'#404e52',6,4);ell(-20,9,43,5,5,2,'#ff554d',8,4);}
  if(p.race===8||p.race===16)for(let i=0;i<8;i++){const a=i/8*6.28;for(let j=0;j<4;j++)ell(Math.cos(a)*(w+8+j*6),Math.sin(a)*h-j*8,-12,6,13,6,p.race===8?'#43324f':'#343c35',6,4);}
  if([1,2,4,13,15,17].includes(p.race))for(let i=0;i<5;i++)ell((i-2)*15,h*.75+Math.sin(i)*9,8,7,15+p.marks[i]*18,9,p.race===13?'#9b8753':p.color,6,4);
  if(p.scar>.55)m.push({v:[[19,-9,35],[21,-10,35],[29,-31,31]],col:'#d4b5a2'});
  return m;
 }
 function draw(canvas,p,state={},time=0){
  const c=canvas.getContext('2d');if(!c)return;if(canvas.width!==520){canvas.width=520;canvas.height=300;}
  const e=emotion(state),R=rng(p.seed^712987);c.fillStyle='#0b131b';c.fillRect(0,0,520,300);
  c.strokeStyle=e.hurt>.3?'#cc6856':p.color;c.lineWidth=2;
  for(let j=0;j<3+p.bridge;j++)c.strokeRect(10+j*510/(3+p.bridge),14,490/(3+p.bridge),146);
  for(let i=0;i<35;i++){c.fillStyle='#91a7b7';c.fillRect(R()*520,24+R()*120,2,2);}
  c.fillStyle='#1d2b36';c.fillRect(0,236,520,64);for(let i=0;i<22;i++){c.fillStyle=i%4?p.color:'#cad8dc';c.fillRect(R()*520,247+R()*44,5+R()*15,2);}
  const yaw=Math.sin(time*.53+p.marks[1]*6.28)*(.13+e.fear*.1),pitch=Math.sin(time*.7)*.035-e.hurt*.12,cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
  const rot=v=>{const x=v[0]*cy+v[2]*sy,z=v[2]*cy-v[0]*sy;return [x,v[1]*cx-z*sx,v[1]*sx+z*cx];};
  const faces=geometry(p,state,time).map(f=>{const v=f.v.map(rot);return {...f,v,z:v.reduce((s,p)=>s+p[2],0)/3};}).sort((a,b)=>a.z-b.z);
  for(const f of faces){const [a,b,d]=f.v,u=b.map((x,i)=>x-a[i]),v=d.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;
   const light=.56+.44*Math.abs((n[0]*-.4+n[1]*.5+n[2]*.76)/len),rgb=f.col.match(/\w\w/g).map(x=>Math.min(255,Math.round(parseInt(x,16)*light)));
   c.fillStyle='rgb('+rgb.join(',')+')';c.beginPath();f.v.forEach((v,i)=>{const k=1+v[2]/450,x=280+v[0]*k*1.25,y=146-v[1]*k*1.25+Math.sin(time*1.7)*.8;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.closePath();c.fill();
  }
  c.fillStyle=e.fear>.7?'#ed9a84':p.color;c.font='13px monospace';c.fillText(e.label,16,205);c.fillStyle='#8397a6';c.font='10px monospace';c.fillText('BRIDGE / '+p.kind.toUpperCase(),16,222);
 }
 const api={profile,draw,geometry,emotion};if(typeof module==='object')module.exports=api;else root.ArmadaCrew=api;
})(typeof window==='object'?window:globalThis);
