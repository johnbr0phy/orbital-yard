/* The universe the Tribute War is fought in: one galaxy, one homeworld per
   fleet. Pure data and arithmetic, no drawing. Positions are galaxy metres in
   float64; the page draws everything relative to the camera, so the numbers
   can be as large as they like. armada-cosmos-new.js renders it. */
(function(root){
 const LY=1e9;                 // one displayed light-year, in galaxy metres
 const ALT=.14;                // a battle is fought this many planet radii above the capital
 const ATMO=.05;               // atmosphere depth, in planet radii
 function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
 const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l];};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

 /* Biomes: colours are display-space, like the rest of the page.
    sea/l1/l2/l3: water, lowland, upland, peaks. level: how much is sea.
    glow: light the ground makes by itself (lava, the Link, machine seams).
    sprawl: how much of the land is city even away from the named ones. */
 const BIOME={
  terra:{sea:[.02,.07,.17],l1:[.10,.19,.08],l2:[.27,.24,.14],l3:[.46,.44,.41],ice:[.86,.90,.95],iceAmt:.5,level:.52,cloud:[1,1,1],cloudAmt:.52,atmo:[.22,.46,1],atmoK:1,glow:[0,0,0],glowAmt:0,sprawl:.12,rough:1,gas:0},
  ocean:{sea:[.015,.09,.20],l1:[.12,.24,.12],l2:[.30,.30,.18],l3:[.5,.5,.46],ice:[.85,.92,.96],iceAmt:.3,level:.66,cloud:[1,1,1],cloudAmt:.62,atmo:[.2,.5,1],atmoK:1.1,glow:[0,0,0],glowAmt:0,sprawl:.05,rough:.8,gas:0},
  jungle:{sea:[.03,.10,.12],l1:[.05,.17,.05],l2:[.11,.23,.07],l3:[.30,.31,.20],ice:[.8,.86,.8],iceAmt:.05,level:.36,cloud:[.95,1,.95],cloudAmt:.6,atmo:[.25,.55,.85],atmoK:1.2,glow:[0,0,0],glowAmt:0,sprawl:.04,rough:1.1,gas:0},
  desert:{sea:[.20,.13,.07],l1:[.45,.31,.17],l2:[.58,.42,.24],l3:[.70,.58,.40],ice:[.9,.86,.78],iceAmt:.12,level:.30,cloud:[1,.93,.82],cloudAmt:.18,atmo:[.75,.5,.3],atmoK:.8,glow:[0,0,0],glowAmt:0,sprawl:.06,rough:1.3,gas:0},
  mars:{sea:[.22,.09,.05],l1:[.44,.20,.11],l2:[.56,.29,.16],l3:[.66,.44,.30],ice:[.92,.90,.88],iceAmt:.35,level:.24,cloud:[.95,.8,.7],cloudAmt:.12,atmo:[.85,.5,.32],atmoK:.55,glow:[0,0,0],glowAmt:0,sprawl:.05,rough:1.4,gas:0},
  ice:{sea:[.10,.20,.30],l1:[.50,.60,.68],l2:[.68,.76,.82],l3:[.9,.94,.97],ice:[.95,.97,1],iceAmt:.9,level:.34,cloud:[1,1,1],cloudAmt:.35,atmo:[.4,.62,1],atmoK:.9,glow:[.3,.7,1],glowAmt:.12,sprawl:.05,rough:1.2,gas:0},
  city:{sea:[.03,.04,.07],l1:[.13,.14,.17],l2:[.19,.20,.24],l3:[.28,.28,.33],ice:[.7,.72,.76],iceAmt:.08,level:.10,cloud:[.9,.92,1],cloudAmt:.32,atmo:[.32,.48,.95],atmoK:1,glow:[0,0,0],glowAmt:0,sprawl:1,rough:.6,gas:0},
  dead:{sea:[.035,.03,.035],l1:[.09,.08,.08],l2:[.15,.13,.12],l3:[.24,.21,.19],ice:[.3,.28,.3],iceAmt:.05,level:.22,cloud:[.3,.26,.3],cloudAmt:.38,atmo:[.42,.28,.5],atmoK:.7,glow:[.55,.2,.9],glowAmt:.22,sprawl:.02,rough:1.5,gas:0},
  lava:{sea:[.05,.03,.03],l1:[.12,.09,.08],l2:[.20,.15,.12],l3:[.32,.26,.22],ice:[.4,.36,.33],iceAmt:.03,level:.18,cloud:[.36,.30,.27],cloudAmt:.42,atmo:[.8,.4,.22],atmoK:1,glow:[1,.34,.06],glowAmt:.6,sprawl:.04,rough:1.6,gas:0},
  storm:{sea:[.07,.08,.09],l1:[.16,.17,.18],l2:[.24,.25,.26],l3:[.36,.37,.38],ice:[.6,.62,.64],iceAmt:.15,level:.20,cloud:[.55,.58,.62],cloudAmt:.85,atmo:[.45,.52,.62],atmoK:1.5,glow:[0,0,0],glowAmt:0,sprawl:.01,rough:1.5,gas:0},
  machine:{sea:[.015,.02,.02],l1:[.05,.065,.06],l2:[.085,.10,.095],l3:[.14,.16,.15],ice:[.2,.24,.22],iceAmt:.02,level:.06,cloud:[.2,.3,.24],cloudAmt:.12,atmo:[.2,.8,.4],atmoK:.5,glow:[.25,1,.35],glowAmt:.5,sprawl:1,rough:.5,gas:0},
  link:{sea:[.50,.33,.09],l1:[.26,.20,.13],l2:[.36,.29,.20],l3:[.5,.44,.34],ice:[.8,.74,.6],iceAmt:.04,level:.80,cloud:[1,.9,.7],cloudAmt:.3,atmo:[.9,.62,.3],atmoK:1,glow:[1,.7,.25],glowAmt:.3,sprawl:.02,rough:.7,gas:0},
  hive:{sea:[.10,.04,.09],l1:[.22,.10,.16],l2:[.32,.16,.20],l3:[.46,.30,.30],ice:[.6,.5,.55],iceAmt:.04,level:.34,cloud:[.6,.45,.55],cloudAmt:.5,atmo:[.7,.3,.6],atmoK:1.3,glow:[.7,1,.25],glowAmt:.35,sprawl:.3,rough:1.3,gas:0},
  gold:{sea:[.20,.16,.10],l1:[.44,.38,.24],l2:[.60,.53,.36],l3:[.8,.76,.62],ice:[.95,.93,.86],iceAmt:.2,level:.34,cloud:[1,.96,.86],cloudAmt:.66,atmo:[.9,.75,.5],atmoK:1.2,glow:[0,0,0],glowAmt:0,sprawl:.08,rough:.8,gas:0},
  forge:{sea:[.05,.05,.06],l1:[.20,.15,.12],l2:[.30,.22,.16],l3:[.42,.34,.28],ice:[.6,.58,.56],iceAmt:.1,level:.26,cloud:[.6,.55,.5],cloudAmt:.4,atmo:[.6,.5,.45],atmoK:1.1,glow:[1,.5,.15],glowAmt:.3,sprawl:.5,rough:1.2,gas:0},
  gasRed:{sea:[.42,.20,.10],l1:[.62,.34,.16],l2:[.78,.52,.28],l3:[.88,.72,.5],ice:[.8,.6,.4],iceAmt:0,level:0,cloud:[1,.8,.6],cloudAmt:0,atmo:[.9,.55,.3],atmoK:.8,glow:[0,0,0],glowAmt:0,sprawl:0,rough:0,gas:1},
  gasBlue:{sea:[.10,.20,.42],l1:[.18,.34,.60],l2:[.36,.55,.76],l3:[.7,.82,.92],ice:[.8,.9,1],iceAmt:0,level:0,cloud:[1,1,1],cloudAmt:0,atmo:[.3,.55,1],atmoK:.8,glow:[0,0,0],glowAmt:0,sprawl:0,rough:0,gas:1},
  moon:{sea:[.16,.16,.16],l1:[.28,.27,.26],l2:[.38,.37,.35],l3:[.5,.49,.47],ice:[.6,.6,.6],iceAmt:0,level:.2,cloud:[1,1,1],cloudAmt:0,atmo:[.5,.5,.5],atmoK:0,glow:[0,0,0],glowAmt:0,sprawl:0,rough:2,gas:0}
 };
 /* Architecture: style 0 glass towers, 1 spires, 2 ziggurats, 3 cubes,
    4 grown spines, 5 crystal. h scales height, col is the facade. */
 const A=(style,col,h=1,lean=0)=>({style,col,h,lean});
 // One entry per fleet, in RACE_DEFS order. Names are fan shorthand, like the fleets.
 const WORLDS=[
  {world:"The Yard",star:"Slipway",sun:[1,.86,.62],biome:"forge",R:9e5,light:[1,.74,.4],arch:A(0,[.34,.30,.27],1.1),capital:"Drydock One",cities:["Keel Row","Slag Harbour","Rivet","Gantry Nine","Plate Town","Ballast"],pop:"41 billion",blurb:"Every hull in the yard fleet was laid down here. The sky is scaffolding."},
  {world:"The Brine",star:"Lantern",sun:[.8,.92,1],biome:"ocean",R:1.25e6,light:[.3,1,.8],arch:A(4,[.14,.26,.26],.8,.25),capital:"Spawning Reef",cities:["The Trench","Kelp Spire","Tide Mother","Brood Shelf","Gill"],pop:"900 billion spawn",blurb:"A drowned world. The cities are reefs that learned to glow."},
  {world:"Tessera",star:"Vertex",sun:[.8,.8,1],biome:"ice",R:8e5,light:[.75,.6,1],arch:A(5,[.45,.42,.62],1.2),capital:"Prime Node",cities:["Facet","Lemma","Axiom","Tiling Seven","Edge"],pop:"6 billion minds",blurb:"Cut, not built. Every street is a proof."},
  {world:"Caravanserai",star:"Ember Road",sun:[1,.7,.4],biome:"desert",R:1.1e6,light:[1,.8,.45],arch:A(2,[.52,.40,.26],.7),capital:"The Long Market",cities:["Well of Nine","Dune Gate","Saltpan","Windbreak","Last Water","Tarp City"],pop:"12 billion, mostly passing through",blurb:"Nobody is from here. Everybody comes back."},
  {world:"Cantata",star:"The Tonic",sun:[1,.95,.8],biome:"gold",R:1.05e6,light:[1,.93,.7],arch:A(1,[.74,.68,.52],1.3),capital:"High Chancel",cities:["Antiphon","Vesper","Descant","Plainsong","Matins"],pop:"3 billion voices",blurb:"The towers are tuned. On a still day the whole city holds one note."},
  {world:"Coruscant",star:"Coruscant Prime",sun:[1,.95,.88],biome:"city",R:1.3e6,light:[1,.78,.42],arch:A(1,[.36,.37,.42],1.6),capital:"Imperial Center",cities:["The Works","Senate District","CoCo Town","Uscru","Level 1313","Fobosi","Sah'c Town","Monument Plaza"],pop:"1 trillion",blurb:"One city, the size of a planet, five thousand levels deep."},
  {world:"Yavin 4",star:"Yavin",sun:[1,.9,.7],biome:"jungle",R:7.5e5,light:[1,.85,.55],arch:A(2,[.36,.34,.28],.75),capital:"Great Temple",cities:["Massassi Station","Palace of the Woolamander","Temple of the Blueleaf","Wetyin's Colony","Base One Landing"],pop:"40 thousand, all of them wanted",blurb:"A jungle moon under a red giant. The temples were here first.",extras:[{name:"Yavin",biome:"gasRed",R:9e6,d:3.4e7,az:2.2,el:.22}]},
  {world:"Minbar",star:"Chi Draconis",sun:[.86,.92,1],biome:"ice",R:1e6,light:[.6,.85,1],arch:A(5,[.50,.62,.74],1.5),capital:"Yedor",cities:["Tuzanor","Shir'shen","Kor'alain","Drala Fi","Tredomo","Valen's Rest"],pop:"4 billion",blurb:"A quarter of the world is crystal. They carved the cities out of it."},
  {world:"Z'ha'dum",star:"Alpha Omega",sun:[.9,.5,.4],biome:"dead",R:9.5e5,light:[.7,.3,1],arch:A(4,[.07,.06,.09],1.4,.35),capital:"The Pit",cities:["Eye Chamber","Black Spine","The Sleepers","Silence","Thorn"],pop:"unknown",blurb:"If you go to Z'ha'dum, you will die."},
  {world:"Mars",star:"Sol",sun:[1,.95,.85],biome:"mars",R:7e5,light:[1,.7,.4],arch:A(0,[.42,.34,.30],.8),capital:"Mars Dome One",cities:["Syria Planum","New Vegas","Olympus Base","Xanthe Terra","Phobos Station Landing","Solis"],pop:"2 million",blurb:"EarthForce built its yards where nobody could hear them. Mars heard.",extras:[{name:"Phobos",biome:"moon",R:6e4,d:2.4e6,az:1.1,el:.35}]},
  {world:"Earth",star:"Sol",sun:[1,.96,.88],biome:"terra",R:1.2e6,light:[1,.85,.55],arch:A(0,[.50,.54,.60],1.2),capital:"San Francisco",cities:["Paris","Tokyo","New Berlin","Lagos","Mumbai","São Paulo","Sydney","Cairo"],pop:"9 billion",blurb:"Paradise, they keep saying. Starfleet Command, by the bay.",extras:[{name:"Luna",biome:"moon",R:3.2e5,d:9e6,az:.6,el:.3}]},
  {world:"Qo'noS",star:"Klingon",sun:[1,.8,.55],biome:"lava",R:1.1e6,light:[1,.42,.2],arch:A(2,[.26,.17,.14],1.2),capital:"First City",cities:["Quin'lat","Tong Vey","Ketha Lowlands","Krennla","Ty'Gokor Gate","Mekro'vak"],pop:"13 billion",blurb:"Green storms, red cities. Today is a good day to defend it.",extras:[{name:"Praxis",biome:"moon",R:2.4e5,d:6e6,az:4,el:.4}]},
  {world:"Unicomplex",star:"Grid 001",sun:[.6,1,.7],biome:"machine",R:1.15e6,light:[.3,1,.4],arch:A(3,[.07,.09,.08],1),capital:"Unimatrix 01",cities:["Trimatrix 2","Grid 986","Subjunction 12","Central Plexus","Unimatrix 325","Junction 9"],pop:"3 trillion drones",blurb:"Not a city. One machine, and it is listening."},
  {world:"Mondoshawa",star:"Mul",sun:[1,.85,.6],biome:"desert",R:1e6,light:[1,.7,.3],arch:A(2,[.52,.38,.20],1.1),capital:"The Bronze Temple",cities:["Keeper's Rest","Four Stones","Elder Vault","Sandwatch","Fifth Gate"],pop:"800 million, very patient",blurb:"They have guarded one secret for five thousand years, slowly."},
  {world:"LV-426",star:"Zeta² Reticuli",sun:[1,.9,.8],biome:"storm",R:6e5,light:[1,.8,.5],arch:A(0,[.30,.31,.31],.55),capital:"Hadley's Hope",cities:["Atmosphere Processor","Landing Field","Med Lab Annex","Derelict Site","Relay Tower"],pop:"158 colonists",blurb:"Acheron. One colony, one processor, and something in the vents.",extras:[{name:"Calpamos",biome:"gasBlue",R:8e6,d:3e7,az:5.2,el:.2}]},
  {world:"Paradise",star:"Origae",sun:[.9,.95,1],biome:"terra",R:1e6,light:[.7,.85,1],arch:A(2,[.34,.36,.36],1.5),capital:"The Citadel",cities:["Plaza of the Dead","Hall of Heads","Juggernaut Dock","Cathedral","Orrery"],pop:"none living",blurb:"The Engineers' garden. The plaza is still full of them."},
  {world:"Yautja Prime",star:"Twin Hunters",sun:[1,.72,.4],biome:"lava",R:1.2e6,light:[1,.5,.2],arch:A(2,[.30,.24,.18],1.3),capital:"Elder's Seat",cities:["Trophy Hall","Blooding Ground","Kehrite","Clan Forge","Hunt Moon Gate"],pop:"clans, not census",blurb:"Twin suns, hot jungle, and a pyramid for every skull worth keeping."},
  {world:"Sigma 957",star:"Sigma",sun:[.8,.7,1],biome:"gold",R:1.4e6,light:[.95,.85,1],arch:A(5,[.72,.66,.86],2.2),capital:"The Walkers' Gate",cities:["First Thought","The Long Quiet","Lorien's Step","Old Light"],pop:"a few. They are enough",blurb:"The First Ones do not live here. They merely have not left."},
  {world:"Romulus",star:"Eisn",sun:[1,.9,.75],biome:"terra",R:1.1e6,light:[.5,1,.6],arch:A(1,[.30,.36,.32],1.3),capital:"Ki Baratan",cities:["Dartha","Val'danadex","Krocton Segment","Mhiessan","Apnex Sea Port"],pop:"18 billion",blurb:"Green skies and a senate with long knives. Remus rises in the dusk.",extras:[{name:"Remus",biome:"dead",R:8e5,d:7e6,az:.9,el:.18}]},
  {world:"The Great Link",star:"Omarion",sun:[1,.8,.5],biome:"link",R:9e5,light:[1,.75,.3],arch:A(4,[.5,.38,.2],.9,.15),capital:"The Founders' Rock",cities:["Vorta Landing","Jem'Hadar Hatchery","Drop of the Ocean","Second Rock"],pop:"one, in many drops",blurb:"The drop becomes the ocean. The ocean has a navy."},
  {world:"Macragge",star:"Ultramar",sun:[1,.97,.9],biome:"terra",R:1.3e6,light:[1,.86,.5],arch:A(1,[.34,.40,.56],1.7),capital:"Magna Macragge Civitas",cities:["Fortress of Hera","Hera's Falls","Port Illyrium","Crown Mountains Keep","Laponis","Valley of Illyrium"],pop:"400 million, 1 Chapter",blurb:"Marble, mountains and a fortress you can see from orbit. Courage and honour."},
  {world:"Tyran",star:"Tyran Primus",sun:[.9,.7,1],biome:"hive",R:1e6,light:[.7,1,.3],arch:A(4,[.34,.14,.22],1.6,.45),capital:"The Digestion Pools",cities:["Capillary Tower Alpha","Spore Chimney","Brood Nest","Reclamation Pit","Norn Hollow"],pop:"biomass, rising",blurb:"The first world they ate. They kept it, to remember the taste."},
  {world:"Terafactory",star:"Coil",sun:[.7,.9,1],biome:"terra",R:9e5,light:[.35,.85,1],arch:A(0,[.56,.60,.64],1.4),capital:"Line One",cities:["Megapack Fields","Cell Works","Dojo","Stamping Hall","Supercharger Row","Launch Complex 4680"],pop:"11 million, 4 billion robots",blurb:"The whole night side is one charging light."}
 ];
 /* The planet shader's continent noise, ported: the same hash on the same
    lattice, so "is this land?" has one answer on the CPU and on the GPU.
    Cities are founded with it, on dry ground. */
 const fr=x=>x-Math.floor(x);
 function hash3(x,y,z){x=fr(x*.1031);y=fr(y*.1031);z=fr(z*.1031);const d=x*(y+33.33)+y*(z+33.33)+z*(x+33.33);x+=d;y+=d;z+=d;return fr((x+y)*z);}
 function noise3(x,y,z){const X=Math.floor(x),Y=Math.floor(y),Z=Math.floor(z);let u=x-X,v=y-Y,w=z-Z;u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);
  const L=(a,b,t)=>a+(b-a)*t;
  return L(L(L(hash3(X,Y,Z),hash3(X+1,Y,Z),u),L(hash3(X,Y+1,Z),hash3(X+1,Y+1,Z),u),v),L(L(hash3(X,Y,Z+1),hash3(X+1,Y,Z+1),u),L(hash3(X,Y+1,Z+1),hash3(X+1,Y+1,Z+1),u),v),w);}
 function continent(dir,seed){let x=dir[0]*1.7+seed,y=dir[1]*1.7+seed,z=dir[2]*1.7+seed,s=0,a=.5;for(let i=0;i<5;i++){s+=a*noise3(x,y,z);x=x*2.03+17.1;y=y*2.03+9.2;z=z*2.03+3.3;a*=.5;}return s;}
 const dry=(dir,seed,level)=>continent(dir,seed)*.84-level;
 /* Fleets that share a sky sit together along two spiral arms. */
 const ARM_ORDER=[5,6,10,11,18,19,12,9,7,8,17,14,15,16,13,20,21,22,0,1,2,3,4];
 const SPAN=6.2e10;            // galaxy radius
 function tangent(dir){const ref=Math.abs(dir[1])>.9?[1,0,0]:[0,1,0],e=norm(cross(ref,dir));return [e,cross(dir,e)];}

 let cached=null;
 function galaxy(){
  if(cached)return cached;
  const R=random(0x7B1B07E),systems=[];
  ARM_ORDER.forEach((race,k)=>{
   const arm=k%2,t=(k>>1)/11,ang=arm*Math.PI+t*3.3+.5+(R()-.5)*.35,rad=SPAN*(.20+t*.76)*(.92+R()*.16);
   systems[race]={race,pos:[Math.cos(ang)*rad,(R()-.5)*SPAN*.07,Math.sin(ang)*rad]};
  });
  // Nothing closer than seven light-years to anything else.
  for(let pass=0;pass<40;pass++)for(let i=0;i<systems.length;i++)for(let j=i+1;j<systems.length;j++){
   const a=systems[i],b=systems[j],v=sub(b.pos,a.pos),d=len(v),need=7*LY;
   if(d<need){const k=(need-d)/2/(d||1);a.pos=sub(a.pos,mul(v,k));b.pos=add(b.pos,mul(v,k));}
  }
  for(const s of systems){
   const def=WORLDS[s.race],Rr=random((s.race+1)*0x9E3779B1),biome={...BIOME[def.biome]};
   const az=Rr()*6.283,el=.12+Rr()*.10,sunDir=[Math.cos(az)*Math.cos(el),Math.sin(el),Math.sin(az)*Math.cos(el)];
   const orbit=4e8*(.85+Rr()*.4),sunR=orbit*.03;
   // Turn the world until the capital, on the pole, stands on dry lowland.
   let seed=Rr()*97,bestSeed=seed,bestFit=-9;
   for(let tries=0;tries<400;tries++){const m=dry([0,1,0],seed,biome.level),fit=m>.03&&m<.13?1:-Math.abs(m-.08);if(fit>bestFit){bestFit=fit;bestSeed=seed;}if(fit===1)break;seed=Rr()*97;}
   seed=bestSeed;
   Object.assign(s,{i:s.race,def,name:def.world,star:def.star,R:def.R,biome,sunDir,sunR,sunCol:def.sun,seed,
    planet:sub(s.pos,mul(sunDir,orbit))});
   s.site=add(s.planet,[0,def.R*(1+ALT),0]);
   // The capital sits under the battle, on the pole; the rest scatter over the day and night sides.
   const cities=[{name:def.capital,dir:[0,1,0],r:(30000+Rr()*12000)/def.R,core:21000,capital:true}];
   for(const name of def.cities)for(let tries=0;tries<240;tries++){
    const th=(cities.length<4?.10+Rr()*.26:.22+Rr()*1.6),ph=Rr()*6.283,dir=[Math.sin(th)*Math.cos(ph),Math.cos(th),Math.sin(th)*Math.sin(ph)];
    if(cities.some(c=>Math.acos(Math.min(1,dot(c.dir,dir)))<.11))continue;
    if(tries<200&&dry(dir,seed,biome.level)<.025)continue;
    cities.push({name,dir,r:(11000+Rr()*12000)/def.R,core:9000,capital:false});break;
   }
   for(const c of cities){const [e,n]=tangent(c.dir);c.e=e;c.n=n;c.seed=(Rr()*4294967296)>>>0;}
   s.cities=cities;
   s.extras=(def.extras||[]).map(x=>({name:x.name,R:x.R,biome:{...BIOME[x.biome]},seed:Rr()*97,
    pos:add(s.planet,mul([Math.cos(x.az)*Math.cos(x.el),Math.sin(x.el),Math.sin(x.az)*Math.cos(x.el)],x.d))}));
  }
  return cached={systems,span:SPAN,dust:null};
 }

 /* Every solid thing in the galaxy, placed relative to one battle site, in
    the shape the war engine already collides against. */
 function bodies(siteIndex,sceneR){
  const G=galaxy(),o=G.systems[siteIndex].site,out=[];
  for(const s of G.systems){
   const put=(center,radius,name,kind,base,role)=>{const c=sub(center,o);out.push({kind,center:c,radius,name,base,accent:base,p:c.map(v=>v/sceneR),phase:0,bands:4,cosmos:true,sys:s.i,role});};
   put(s.planet,s.R,s.name,2,s.biome.l1,"home");
   put(s.pos,s.sunR,s.star,5,s.sunCol,"sun");
   for(const x of s.extras)put(x.pos,x.R,x.name,x.biome.gas?0:1,x.biome.l1,"extra");
  }
  return out;
 }
 /* The star system the war engine is told it is fighting in. The engine draws
    none of these bodies itself; it lights hulls by the sun and eclipses them
    behind the world. */
 function engineSystem(siteIndex,sceneR,battlefield){
  const s=galaxy().systems[siteIndex],all=bodies(siteIndex,sceneR),here=all.filter(b=>b.sys===siteIndex);
  const sun=here.find(b=>b.role==="sun"),R=random((siteIndex+11)*0x51ED27);
  const style=siteIndex%8;
  return {seed:(siteIndex+1)*7919,style,name:s.name,bodies:here,light:sun.p.slice(),starCount:2400,starTint:[.84,.9,1],
   field:battlefield?battlefield(R,style):{rocks:[],nebula:null,moon:null,kinds:[]},worlds:all,site:siteIndex};
 }
 /* Free flight: slow among ships, slow near a surface, and faster and faster
    with nothing nearby, so a planet is a minute away and a star is too. */
 function flightSpeed(surface,fromBattle,boost,inBattle=9000,base=3240){
  const free=Math.max(0,fromBattle-inBattle),open=Math.min(surface,free);
  return Math.max(fromBattle<inBattle+3000?base:25,open*(boost?2.4:.9));
 }
 function fmtDist(m){
  if(m<1e4)return Math.round(m)+" m";
  if(m<1e6)return (m/1000).toFixed(m<1e5?1:0)+" km";
  if(m<LY*.05)return Math.round(m/1000).toLocaleString("en-US")+" km";
  return (m/LY).toFixed(m<LY*10?2:1)+" ly";
 }
 function fmtSpeed(v){return v<1e4?Math.round(v)+" m/s":v<3e8?Math.round(v/1000).toLocaleString("en-US")+" km/s":(v/2.998e8).toFixed(v<3e9?1:0)+" c";}
 /* Who holds what. owners[world]=race. A fleet fights for the world it was
    sent to, or else attacks a world its enemy holds. */
 function freshOwners(){return WORLDS.map((w,i)=>i);}
 function siteFor(owners,attacker,defender,pending=null){
  if(pending!=null&&pending>=0&&pending<WORLDS.length)return pending;
  if(owners[defender]===defender)return defender;
  const held=owners.findIndex(o=>o===defender);
  return held>=0?held:defender;
 }
 function conquer(owners,world,race){const next=owners.slice();next[world]=race;return next;}
 function holdings(owners){const n=WORLDS.map(()=>0);for(const o of owners)n[o]++;return n;}
 /* A city's skyline: megastructures on a street grid, tallest at the centre.
    Rows of nine floats (x, y, width, depth, height, turn, taper, seed, kind),
    tallest first so a far camera can draw only the giants. */
 function skyline(city,arch,max=16000){
  const R=random(city.seed),B=500,core=city.core,n=Math.ceil(core/B),list=[];
  const big=city.capital?1:.42,st=arch.style;
  const one=(x,y,w,d,h,kind)=>list.push([x,y,w,d,h,st===5||st===4?R()*6.283:(R()<.5?0:Math.PI/2),
    st===2?.05+R()*.35:st===1?.12+R()*.3:st===3?1:st===4?.02+R()*.2:st===5?R()*.25:.72+R()*.28,R()*100,kind]);
  /* A tower is a stack: each tier is a narrower, taller box on the same
     footing, so it shows as a setback where it clears the one below. */
  const tower=(x,y,w,d,h,kind)=>{
   if(st===2){one(x,y,w*1.9,d*1.9,h*.34,kind);one(x,y,w*1.35,d*1.35,h*.68,kind);one(x,y,w*.8,d*.8,h,kind);return;}
   if(st===3){one(x,y,w,d,h,kind);return;}
   if(st===4){one(x,y,w,d,h,kind);if(h>500){one(x+w*.5,y-d*.3,w*.5,d*.5,h*.6,kind);one(x-w*.4,y+d*.4,w*.4,d*.4,h*.4,kind);}return;}
   if(st===5){one(x,y,w,d,h,kind);if(h>400){one(x+w*.45,y,w*.55,d*.55,h*.62,kind);one(x-w*.3,y+d*.4,w*.45,d*.45,h*.4,kind);}return;}
   one(x,y,w,d,h>700?h*.72:h,kind);
   if(h>700)one(x,y,w*.66,d*.66,h*.92,kind);
   if(h>1500)one(x,y,w*.2,d*.2,h*1.14,kind);
  };
  // The seat of power: one tower you can see from orbit.
  {const w=st===3?2600:1500*big+500,h=(st===3?2600:9500*arch.h)*big+800;
   if(st!==3&&st!==2){one(B*.5,B*.5,w*2.1,w*2.1,h*.10,1);one(B*.5,B*.5,w*1.45,w*1.45,h*.42,1);}
   tower(B*.5,B*.5,w,w,h,1);}
  for(let bx=-n;bx<n;bx++)for(let by=-n;by<n;by++){
   const cx=(bx+.5)*B,cy=(by+.5)*B,rr=Math.hypot(cx,cy)/core;
   if(rr>1||(bx>=-3&&bx<=3&&by>=-3&&by<=3))continue;
   const u=R();if(u<.08+rr*rr*.5)continue;                        // plazas, parks, the thinning edge
   const tall=Math.exp(-rr*3.4),lots=rr<.3?1:R()<.6?2:1;
   for(let k=0;k<lots;k++){
    const w=st===3?150+R()*230:110+R()*230,d=st===3?w:110+R()*230,jit=lots>1?(k?-1:1)*110:0;
    let h=(240+R()*R()*5200*tall+R()*700*(1-rr))*arch.h*big;
    if(st===3)h=w*(R()<.2?2:1);
    if(st===2)h*=.6;
    tower(cx+jit+(R()-.5)*60,cy+(R()-.5)*120,w,d,Math.max(60,h),0);
   }
  }
  list.sort((a,b)=>b[4]-a[4]);if(list.length>max)list.length=max;
  const out=new Float32Array(list.length*9);list.forEach((r,i)=>out.set(r,i*9));
  return out;
 }
 const api={continent,dry,LY,ALT,ATMO,WORLDS,BIOME,SPAN,galaxy,bodies,engineSystem,flightSpeed,fmtDist,fmtSpeed,freshOwners,siteFor,conquer,holdings,skyline,tangent,random,
  v:{add,sub,mul,dot,len,norm,cross}};
 if(typeof module==='object')module.exports=api;else root.ArmadaUniverse=api;
})(typeof window==='object'?window:globalThis);
