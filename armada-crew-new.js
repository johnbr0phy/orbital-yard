/* Seeded crew studies: the same feature-by-feature principle as /faces,
   projected as shaded 3D geometry only for the visible captain. Original interpretations, with no portrait service. */
(function(root){
 const races=['Yard','Shoal','Lattice','Drift','Choir','Imperial','Rebel','Minbari','Shadow','Earthforce','Federation','Klingon','Borg','Mondoshawan','Colonial Marine','Engineer','Yautja','First One','Romulan','Dominion','Space Marine','Tyranid','Tesla'];
 const colors=['#76b9c4','#80bca0','#c3a7eb','#deab73','#e9d495','#9db3d4','#d39975','#86cad6','#a184c7','#9bafd2','#dcb871','#c29b70','#8fca94','#cfb876','#abb78a','#b8ced1','#c5b187','#d7bde6','#74aa83','#afa0cf','#8dabc8','#b09cb8','#b6cbd4'];
 function rng(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
 function profile(seed,race,klass=""){
  const R=rng((seed^Math.imul(race+1,2654435761))>>>0),pick=a=>a[Math.floor(R()*a.length)];
  const syll=['Ka','Ve','Or','Tal','Ren','Sa','Mor','Li','Da','Tor','Esh','Na','Kel','Vo','Ar','Sen'];
  const name=pick(syll)+pick(syll).toLowerCase()+' '+pick(syll)+pick(syll).toLowerCase();
  const p={seed:seed>>>0,race,name,role:race===12?'Command node':race===8?'Linked host':race===17?'Presence':'Captain',kind:races[race],color:colors[race],skin:pick(['#b98061','#dbb59a','#8e604d','#c5937a','#68483d']),jaw:.75+R()*.4,eyes:.7+R()*.7,nose:R(),hair:R(),age:R(),scar:R(),bridge:Math.floor(R()*4),uniform:R(),earSize:.65+R()*.9,earFlare:R(),eyeSpace:.72+R()*.55,eyeTilt:(R()-.5)*.35,iris:pick(["#77a8a2","#927148","#6d86b0","#766591"]),noseWidth:.65+R()*.95,noseLength:.6+R()*.95,noseBridge:.6+R()*.9,mouthWidth:.65+R()*.65,lip:.5+R(),forehead:.8+R()*.4,cheeks:.75+R()*.5,chin:.7+R()*.65,hairStyle:Math.floor(R()*5),beard:R(),brow:.6+R(),marks:Array.from({length:12},()=>R())};
  const S=rng(seed^0x71ca9),choose=a=>a[Math.floor(S()*a.length)];
  p.species=['Human','Shoal cephalopod','Lattice intelligence','Human','Choir radial','Human',
   choose(['Human','Mon Calamari','Sullustan',"Twi'lek"]),'Minbari','Shadow','Human',
   choose(['Human','Vulcan','Andorian']),'Klingon','Borg','Mondoshawan','Human','Engineer','Yautja','Ancient presence','Romulan',"Jem’Hadar",'Adeptus Astartes','Tyranid synapse beast','Optimus'][race];
  if(race===6&&/MC[378]|MON CAL|HOME ONE|LIBERTY/i.test(klass))p.species='Mon Calamari';
  if(race===13&&klass)p.species=/MANGALORE/i.test(klass)?'Mangalore':/MONDOSHAWAN/i.test(klass)?'Mondoshawan':'Human';
  if(race===17&&/VORLON|KOSH/i.test(klass))p.species='Vorlon encounter suit';
  if(race===17&&!klass)p.species=choose(['Vorlon encounter suit','Ancient presence']);
  if(race===22&&/ROADSTER|STARMAN/i.test(klass)){p.species='Starman';p.name='Starman';}
  if(race===21)p.role='Synapse';if(race===22)p.role='Autopilot';
  p.substrate=race===12?choose(['Human','Vulcan','Klingon']):p.species;
  p.crest=.75+S()*.5;p.tendril=.75+S()*.5;p.plate=.8+S()*.4;
  p.role=race===8?'Shadow presence':race===17?'Presence':race===12?'Command node':p.role;
  return p;

 }

 const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 function emotion(state={}){const fear=clamp(Math.max(state.fear||0,(1-(state.hull??1))*.85)),hurt=clamp(state.hit||0);return {fear,hurt,label:(state.hull??1)<=0?'Signal lost':hurt>.55?'Under fire':fear>.7?'Afraid':fear>.4?'Tense':state.firing?'Determined':'Focused'};}
 // Local 3D ellipsoids and wedges. Depth sorting and directional lighting give
 // noses, ears and cheeks actual depth as the head turns, without another GL context.
 function geometry(p,state={},time=0){
  const e=emotion(state),m=[],phase=p.marks[0]*6.28,blink=Math.pow(Math.max(0,Math.cos(time*1.7+phase)),40),human=p.species==='Human',skin=p.species==='Mangalore'?'#9b8874':p.species==='Engineer'?'#ccd0c9':p.species==='Minbari'?'#c5b4a3':p.species==='Andorian'?'#679bac':p.species==="Twi'lek"?['#81aa79','#a57e66','#7d9da9'][p.seed%3]:p.species==='Borg'?'#a2aaa1':p.species==='Klingon'?'#a47d60':p.species==='Jem’Hadar'?'#aaa59b':human||p.species==='Vulcan'||p.species==='Romulan'?p.skin:p.color;
  const w=38*p.jaw,h=54*p.forehead;
  function ell(cx,cy,cz,rx,ry,rz,col,nu=12,nv=8){for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const pt=(a,b)=>{const u=a/nu*6.283,v=b/nv*Math.PI;return [cx+Math.sin(v)*Math.cos(u)*rx,cy+Math.cos(v)*ry,cz+Math.sin(v)*Math.sin(u)*rz];};const a=pt(i,j),b=pt(i+1,j),c=pt(i+1,j+1),d=pt(i,j+1);m.push({v:[a,b,c],col},{v:[a,c,d],col});}}

  // Closed tapered tubes, not a chain of decorative balls: jointed limbs, lekku,
  // mandibles and ribbing are independent anatomical structures.
  function tube(points,radii,col,sides=7){
   const rings=points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],d=b.map((x,j)=>x-a[j]),l=Math.hypot(...d)||1,t=d.map(x=>x/l),ref=Math.abs(t[1])<.9?[0,1,0]:[1,0,0],u=[t[1]*ref[2]-t[2]*ref[1],t[2]*ref[0]-t[0]*ref[2],t[0]*ref[1]-t[1]*ref[0]],ul=Math.hypot(...u)||1;for(let j=0;j<3;j++)u[j]/=ul;const v=[t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0]];return Array.from({length:sides},(_,k)=>p.map((x,j)=>x+radii[i]*(u[j]*Math.cos(k/sides*6.283)+v[j]*Math.sin(k/sides*6.283))));});
   for(let i=1;i<rings.length;i++)for(let k=0;k<sides;k++){const j=(k+1)%sides;m.push({v:[rings[i-1][k],rings[i][k],rings[i][j]],col},{v:[rings[i-1][k],rings[i][j],rings[i-1][j]],col});}
   for(const i of [0,rings.length-1])for(let k=0;k<sides;k++)m.push({v:[points[i],rings[i][k],rings[i][(k+1)%sides]],col});
  }
  const pulse=Math.sin(time*1.3+phase),sp=p.species;
  if(sp==='Tyranid synapse beast'){
   const shell=['#62436f','#703638','#716444'][p.seed%3],bone='#bcb494';
   ell(0,-63,-4,61*p.jaw,44,36,shell,10,6);ell(0,13,-10,37*p.jaw,65*p.crest,34,shell,10,7);
   for(let i=0;i<4;i++)ell(0,38+i*10,-8-i*5,38-i*4,15,33,shell,10,5);
   ell(0,-11,25,27,31,22,bone,10,6);ell(0,-16,44,22,10+e.fear*3,4,'#241b25',10,5);
   for(const sign of [-1,1]){
    for(let i=0;i<3;i++){ell(sign*(17+i*5),18-i*7,32,4,2.5,3,'#dfba51',6,4);tube([[sign*(9+i*6),-10,44],[sign*(9+i*6),-22,44]],[2,0],bone);}
    tube([[sign*24,-20,23],[sign*43,-35,42],[sign*21,-50+e.fear*4,53]],[9,5,0],bone);
    tube([[sign*43,-60,0],[sign*80,-27,15],[sign*72,13,36]],[13,8,0],shell);
   }return m;
  }
  if(sp==='Adeptus Astartes'||sp==='Optimus'||sp==='Starman'){
   const marine=sp==='Adeptus Astartes',robot=sp==='Optimus',armor=marine?['#315987','#813b38','#435b45'][p.seed%3]:'#c7cdd0';
   ell(0,-73,-4,marine?68:49,45,32,armor,10,6);
   for(const sign of [-1,1])ell(sign*(marine?61:44),-61,1,marine?30:20,31,31,armor,10,6);
   ell(0,0,0,36*p.jaw,49*p.forehead,32,armor,12,8);
   if(robot){ell(0,5,26,29,35,11,'#11191f',12,7);ell(0,18,36,12,1.2,1,'#9dbdcc',8,4);}
   else if(marine){
    for(const sign of [-1,1]){ell(sign*16,12,30,12,4,4,e.hurt>.5?'#ffc785':'#d55242',8,4);tube([[sign*30,-8,16],[sign*27,-36,24],[sign*12,-43,30]],[7,6,5],'#303a42');}
    ell(0,-21,30,17,15,12,armor,8,5);for(let i=0;i<5;i++)tube([[(i-2)*5,-16,41],[(i-2)*5,-31,39]],[1.2,1.2],'#151d23');
    tube([[0,43,-15],[0,48,8],[0,31,29]],[5,5,4],'#c9b26b');
   }else ell(0,8,26,29,23,11,'#17252e',12,7);
   return m;
  }

  if(sp==='Shadow'){
   const chitin='#30323b',ridge='#53515c';
   ell(0,-31,-8,27*p.jaw,43,25,chitin,10,7);ell(0,10,4,19,33,21,chitin,10,6);
   for(const sign of [-1,1]){
    for(let i=0;i<3;i++){const sway=Math.sin(time*.8+i+phase)*(2+e.fear*3),x=sign*(65+i*16)*p.tendril;
     tube([[sign*17,-20-i*12,0],[x,14-i*14+sway,-4],[x+sign*14,-57-i*10,12],[x+sign*3,-100,27]],[8,5,3,1],chitin);}
    tube([[sign*17,18,8],[sign*(48+e.fear*8),33+pulse*2,22],[sign*41,3,42],[sign*29,12,49]],[7,5,3,.5],ridge);
   }
   // Broad triangular carapace, with the screen design's clustered pinpoint eyes.
   const head=[[-31,52,22],[31,52,22],[0,20,47],[0,67,-3]];
   for(const ids of [[0,1,2],[0,3,1],[0,2,3],[1,3,2]])m.push({v:ids.map(i=>head[i]),col:ridge});
   for(const sign of [-1,1])for(let row=0;row<2;row++)for(let j=0;j<3+row;j++)ell(sign*(5+j*5),45-row*7,35+row*6,1.5,1.3,1.8,e.hurt>.5?'#ff9471':'#bc6550',6,4);
   for(let i=0;i<5;i++)tube([[(i-2)*12,52,8],[(i-2)*18,74+p.marks[i]*10,0]],[5,0],chitin);
   return m;
  }
  if(sp==='Shoal cephalopod'||sp==='Choir radial'||sp==='Ancient presence'||sp==='Lattice intelligence'){
   const crystal=sp==='Lattice intelligence',radial=sp==='Choir radial'||sp==='Ancient presence';
   if(crystal){for(let i=0;i<7;i++){const a=i*6.283/7+time*.08,x=Math.cos(a)*36,y=Math.sin(a)*44;ell(x,y,10+Math.sin(a)*17,12*p.plate,32,26,p.color,4,2);}ell(0,0,20,20,28,30,'#e1d8f2',5,3);}
   else if(radial){ell(0,0,8,24,37,37,p.color,10,6);const n=sp==='Choir radial'?7:9;for(let i=0;i<n;i++){const a=i*6.283/n,spread=74+e.fear*10;const pts=Array.from({length:5},(_,j)=>{const d=23+j*spread/4,twist=a+j*.12+pulse*.025;return [Math.cos(twist)*d,Math.sin(twist)*d*.82,8+Math.sin(j*.8+time*.6)*12];});tube(pts,[9,8,5,3,.5],i%2?p.color:'#a8b6c0');}ell(0,1,44,9,13+e.hurt*3,5,'#f0e1b2',10,6);}
   else{ell(0,24,0,48*p.jaw,48,40,'#6a968c',12,8);for(const sign of [-1,1]){ell(sign*35,8,26,17,14,15,'#284547',10,6);ell(sign*37,9,40,7,9,4,'#d4bd75',8,6);}for(let i=0;i<8;i++){const x=(i-3.5)*11;const pts=Array.from({length:6},(_,j)=>[x+j*Math.sin(i+time*.7)*3,-14-j*17,12+Math.cos(j*.5+i)*18]);tube(pts,[11,10,8,6,3,1],'#6a968c');}}
   return m;
  }
  if(sp==='Vorlon encounter suit'){
   ell(0,-62,0,68,64,39,'#6b6650',12,7);ell(0,2,-2,38*p.plate,55,30,'#8c8262',10,7);
   for(const sign of [-1,1])tube([[sign*29,-43,22],[sign*48,-5,28],[sign*28,48,21],[sign*12,68,12]],[15,12,10,2],'#a6976c');
   ell(0,25,30,21,25,15,'#302f29',10,7);ell(0,26,45,8,10+pulse,3,'#a8d4be',10,6);
   for(let i=0;i<5;i++)tube([[-48,-40-i*12,24],[0,-32-i*12,43],[48,-40-i*12,24]],[3,4,3],'#ac9970');
   return m;
  }
  if(sp==='Mondoshawan'){
   const gold='#9b8552',dark='#514d35';ell(0,-62,-5,85*p.plate,66,40,gold,12,8);
   for(const sign of [-1,1]){ell(sign*65,-30,0,30,39,34,gold,10,6);tube([[sign*65,-32,9],[sign*84,-66,22],[sign*70,-95,40]],[17,14,10],dark);}
   ell(0,9,5,34*p.jaw,32,31,'#8b8d6b',12,8);ell(0,-5,28,23,15,22,'#9ca078',10,6);
   for(const sign of [-1,1]){ell(sign*24,16,24,9,6*(1-blink)+1,7,'#282b21',8,6);ell(sign*25,16,30,2,2,2,'#b9ab71',6,4);}
   tube([[-17,-11,47],[0,-14-e.fear*2,51],[17,-11,47]],[1.8,2,1.8],dark);
   for(let i=0;i<6;i++)tube([[-52,-29-i*12,26],[0,-23-i*12,42],[52,-29-i*12,26]],[3,3,3],dark);
   return m;
  }
  if(sp==='Yautja'){
   const hide=['#94825b','#867453','#a4936c'][p.seed%3];ell(0,-91,0,83,42,35,'#454b43',12,6);ell(0,-47,0,28,34,26,hide,10,6);
   ell(0,17,-3,48*p.jaw,45,36,hide,12,8);ell(0,-6,14,34,29,29,hide,10,7);
   for(const sign of [-1,1]){ell(sign*19,13,32,12,5*(1-blink)+1,7,'#2d2c22',8,6);ell(sign*20,13,38,3,3,2,'#c5b564',8,4);
    for(let i=0;i<7;i++){const x=sign*(33+i*4),y=33-i*5;const pts=[[x,y,-8],[x+sign*15,y-18,-8],[x+sign*18,-48-i*3,0],[x+sign*13,-78-i*3,12]];tube(pts,[6,6,4,1.5],'#363c35');}
    for(const upper of [true,false]){const spread=7+e.fear*11+e.hurt*7+pulse*1.4,yy=upper?-6:-36;const tip=[sign*(10+spread),upper?-16:-33,58];tube([[sign*25,yy,29],[sign*(31+spread),yy-8,43],tip],[10*p.plate,7,3],hide);tube([tip,[sign*(5+spread*.5),upper?-22:-25,61]],[3.5,0],'#d7cbaa');}
   }
   ell(0,-24,37,13,17+e.fear*2,8,'#342727',10,6);
   for(let i=0;i<11;i++)ell((p.marks[i]-.5)*67,30+p.marks[(i+1)%12]*18,29,2,3,2,'#514c35',6,4);
   return m;
  }
  if(sp==='Mon Calamari'||sp==='Sullustan'){
   const mon=sp==='Mon Calamari',col=mon?['#ab785a','#b09172','#987d6b'][p.seed%3]:p.skin;
   ell(0,-92,0,78,43,33,mon?'#b8b7a8':'#7e5141',12,6);ell(0,-53,2,24,30,24,col,10,6);
   ell(0,13,0,(mon?43:37)*p.jaw,mon?58:47,36,col,12,8);
   for(const sign of [-1,1]){
    if(!mon){ell(sign*43,5,0,20*p.earSize,27,14,col,10,6);ell(sign*45,5,12,12,18,4,'#815947',8,5);}
    const xx=sign*(mon?37:20)*p.eyeSpace;ell(xx,8,27,mon?20:14,mon?19:12,18,col,10,7);
    ell(xx,8,42,mon?14:10,(mon?13:8)*(1-blink)+1,8,mon?'#c8a66c':'#242323',10,7);
    ell(xx,8,49,mon?5:4,mon?10:6,3,'#1f2526',8,5);
   }
   ell(0,-24,27,mon?30:19,mon?19:11,mon?21:22,col,10,6);
   tube([[-22,-31,43],[0,-34-e.fear*3,49],[22,-31,43]],[2,2+e.hurt*2,2],'#594138');
   if(mon){for(let i=0;i<12;i++)ell((p.marks[i]-.5)*53,24+p.marks[(i+1)%12]*32,30,3,2,2,'#81644f',6,4);}
   else for(let i=0;i<3;i++)tube([[-27,-15-i*8,26],[0,-20-i*8,43],[27,-15-i*8,26]],[3,3,3],col);
   return m;
  }
  ell(0,-99,0,90,49,32,p.race===5?'#4e5553':p.race===9?'#303e58':p.race===14?'#525b43':p.uniform>.5?'#304454':'#4a4244',12,6);
  ell(0,-63,0,19,29,21,skin,10,6);
  ell(0,0,0,w,h,34,skin);
  ell(0,-40,10,27*p.chin,24,26,skin,10,6);
  for(const sign of [-1,1]){
   if(!['Minbari','Engineer'].includes(sp))ell(sign*w,-2,-1,9*p.earSize,17*p.earSize,8+8*p.earFlare,skin,8,6);
   if(!['Minbari','Engineer'].includes(sp))ell(sign*w,-2,7,4*p.earSize,10*p.earSize,3,'#775b57',8,4);
   ell(sign*w*.55,-19,16,11*p.cheeks,13,16,skin,8,6);
   const x=sign*17*p.eyeSpace,ey=7+p.eyeTilt*sign*8,open=(3.5+e.fear*3)*(1-blink)+.3;
   ell(x,ey,30,10*p.eyes,open,6,sp==='Engineer'?'#292e2c':'#d9dcd4',10,6);
   ell(x+Math.sin(time*.7+phase)*1.2,ey,35.5,3.1,Math.min(4,open),1.4,sp==='Engineer'?'#1a2221':p.iris,8,4);
   ell(x+Math.sin(time*.7+phase)*1.2,ey,36.7,1.4,Math.min(2.6,open),.6,'#162029',8,4);
   ell(x,ey+10+e.fear*4,30,12*p.eyes,2.4*p.brow,4,'#46372f',8,4);
  }
  const nx=(p.nose-.5)*5,nw=6*p.noseWidth,ny=-10*p.noseLength,nz=35+14*p.noseBridge;
  const nose=[[0,19,29],[-nw,ny,32],[nx,ny+3,nz],[nw,ny,32],[0,ny-5,35]];
  for(const ids of [[0,1,2],[0,2,3],[1,4,2],[2,4,3]])m.push({v:ids.map(i=>nose[i]),col:skin});
  const mouthY=-37-e.fear*2,opening=.7+e.fear*3+e.hurt*4;
  ell(0,mouthY,32,14*p.mouthWidth,opening,2.8,'#40272b',10,4);
  ell(0,mouthY-opening-1,32,13*p.mouthWidth,1.5*p.lip,3,'#ac7566',10,4);
  if((human||sp==='Vulcan'||sp==='Andorian'||sp==='Klingon')&&p.hair>.14){const col=sp==='Andorian'?'#d4dedc':p.age>.7?'#9a9995':p.hair>.7?'#865c3c':'#302c2d';
   for(let i=0;i<7;i++){const a=(i/6)*Math.PI;ell(Math.cos(a)*w*.8,h*.79+Math.sin(a)*9,-1+(p.hairStyle%2)*14,15,11+p.hairStyle*2,24,col,8,4);}
   if(p.hairStyle===3)for(const sign of [-1,1])ell(sign*w,10,-9,10,47,19,col,8,6);
   if(p.beard>.7)ell(0,-51,23,25*p.chin,13,12,col,10,4);
  }

  if(sp==='Minbari'){
   // Continuous bone fan around the back and temples; never a row of forehead horns.
   for(let i=0;i<20;i++){const a=i/20*(Math.PI+.5)-.25,b=(i+1)/20*(Math.PI+.5)-.25;
    const pt=(t,r,z)=>[Math.cos(t)*r,Math.sin(t)*r*.96+3,z];
    const ri=w*.91,ro=w+13+p.crest*7+(p.seed%2?Math.sin(i*2)*4:0);
    const v=[pt(a,ri,-9),pt(b,ri,-9),pt(b,ro,-14),pt(a,ro,-14)];
    m.push({v:[v[0],v[1],v[2]],col:'#b6ad96'},{v:[v[0],v[2],v[3]],col:i%2?'#b6ad96':'#c9bea5'});
   }
  }
  if(sp==='Klingon'||p.substrate==='Klingon')for(let i=0;i<6;i++){
   const y=21+i*6,z=32-i*2;tube([[-15+i,y-2,z-2],[0,y+3,z+5],[15-i,y-2,z-2]],[2,4*p.crest,2],'#795840');
  }
  if(sp==='Romulan'||sp==='Vulcan'||p.substrate==='Vulcan')for(const sign of [-1,1])tube([[sign*w,0,3],[sign*(w+11),26,0],[sign*(w+9),36,-2]],[8,4,0],skin);
  if(sp==='Romulan'){for(const sign of [-1,1])tube([[sign*25,35,21],[sign*9,24,33],[0,20,34]],[3,4,2],skin);ell(0,43,-3,37*p.jaw,16,29,'#272b2b',12,6);}
  if(sp==='Jem’Hadar'){for(const sign of [-1,1])for(let i=0;i<5;i++)tube([[sign*(22+i*2),28-i*11,20],[sign*(37+i*2),25-i*11,23]],[4,0],'#b9b3a5');tube([[0,37,19],[0,19,34],[0,1,40]],[5,6,3],'#b9b3a5');}
  if(sp==='Andorian')for(const sign of [-1,1]){const sway=Math.sin(time+sign)*2;tube([[sign*19,h*.8,0],[sign*24,h+12,8],[sign*(26+sway),h+25,14]],[5,3,2],skin);ell(sign*(26+sway),h+25,15,4,4,3,'#9fc4cc',8,4);}
  if(sp==="Twi'lek")for(const sign of [-1,1])tube([[sign*24,36,-15],[sign*44,8,-18],[sign*49,-39,0],[sign*(53+pulse*3),-84,12]],[17,16,11,2],skin);
  if(sp==='Borg'){
   ell(-20,9,34,17*p.plate,21,10,'#394347',6,4);ell(-20,9,44,7,8,4,'#697679',8,4);ell(-20,9,49,3,3,2,'#ce5347',8,4);
   tube([[-31,4,25],[-45,-16,15],[-41,-56,12],[-22,-76,32]],[4,4,4,4],'#313a3b');
   for(let i=0;i<3;i++)ell(14+i*7,35,27-i*4,4,13,8,'#566165',6,4);
  }
  if(sp==='Engineer'){ell(0,22,23,30,9,12,skin,10,5);for(let i=0;i<5;i++)tube([[-48,-65-i*9,21],[0,-59-i*9,35],[48,-65-i*9,21]],[3,3,3],'#687570');}
  if(sp==='Mangalore'){ell(0,-16,33,19,18,20,'#a18c77',10,6);for(const sign of [-1,1]){ell(sign*22,20,25,18,9,13,skin,8,5);ell(sign*25,-34,20,17,25,16,skin,8,5);}}
  if(p.scar>.55)m.push({v:[[19,-9,35],[21,-10,35],[29,-31,31]],col:'#d4b5a2'});
  return m;
 }
 function draw(canvas,p,state={},time=0){
  const c=canvas.getContext('2d');if(!c)return;if(canvas.width!==520){canvas.width=520;canvas.height=300;}
  const e=emotion(state),R=rng(p.seed^712987);c.fillStyle='#0b131b';c.fillRect(0,0,520,300);
  c.strokeStyle=e.hurt>.3?'#cc6856':p.color;c.lineWidth=2;
  const alienRoom=[1,2,4,8,15,17,21].includes(p.race);
  if(alienRoom){c.lineWidth=5;for(let j=0;j<7;j++){const x=25+j*78;c.beginPath();c.moveTo(x,260);c.bezierCurveTo(260+(x-260)*.4,130,x,40,260+(x-260)*.7,0);c.stroke();}c.lineWidth=2;}
  else for(let j=0;j<3+p.bridge;j++)c.strokeRect(10+j*510/(3+p.bridge),14,490/(3+p.bridge),146);
  for(let i=0;i<35;i++){c.fillStyle='#91a7b7';c.fillRect(R()*520,24+R()*120,2,2);}
  c.fillStyle=alienRoom?'#111c23':'#1d2b36';c.fillRect(0,236,520,64);for(let i=0;i<22;i++){c.fillStyle=i%4?p.color:'#cad8dc';c.fillRect(R()*520,247+R()*44,5+R()*15,2);}
  const yaw=Math.sin(time*.53+p.marks[1]*6.28)*(.13+e.fear*.1),pitch=Math.sin(time*.7)*.035-e.hurt*.12,cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
  const rot=v=>{const x=v[0]*cy+v[2]*sy,z=v[2]*cy-v[0]*sy;return [x,v[1]*cx-z*sx,v[1]*sx+z*cx];};
  const faces=geometry(p,state,time).map(f=>{const v=f.v.map(rot);return {...f,v,z:v.reduce((s,p)=>s+p[2],0)/3};}).sort((a,b)=>a.z-b.z);
  for(const f of faces){const [a,b,d]=f.v,u=b.map((x,i)=>x-a[i]),v=d.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;
   const light=.56+.44*Math.abs((n[0]*-.4+n[1]*.5+n[2]*.76)/len),rgb=f.col.match(/\w\w/g).map(x=>Math.min(255,Math.round(parseInt(x,16)*light)));
   c.fillStyle='rgb('+rgb.join(',')+')';c.beginPath();f.v.forEach((v,i)=>{const k=1+v[2]/450,x=280+v[0]*k*1.25,y=146-v[1]*k*1.25+Math.sin(time*1.7)*.8;if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.closePath();c.fill();
  }
  c.fillStyle=e.fear>.7?'#ed9a84':p.color;c.font='13px monospace';c.fillText(['Shadow','Ancient presence','Lattice intelligence','Choir radial','Borg','Vorlon encounter suit'].includes(p.species)?(e.hurt>.5?'Signal disrupted':e.fear>.4?'Elevated activity':'Linked'):e.label,16,205);c.fillStyle='#8397a6';c.font='10px monospace';c.fillText(p.species.toUpperCase(),16,222);
 }
 const api={profile,draw,geometry,emotion};if(typeof module==='object')module.exports=api;else root.ArmadaCrew=api;
})(typeof window==='object'?window:globalThis);
