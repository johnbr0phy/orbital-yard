/* Seeded crew studies: the same feature-by-feature principle as /faces,
   drawn once on selection. Original interpretations, with no portrait service. */
(function(root){
 const races=['Yard','Shoal','Lattice','Drift','Choir','Imperial','Rebel','Minbari','Shadow','Earthforce','Federation','Klingon','Borg','Mondoshawan','Colonial Marine','Engineer','Yautja','First One'];
 const colors=['#76b9c4','#80bca0','#c3a7eb','#deab73','#e9d495','#9db3d4','#d39975','#86cad6','#a184c7','#9bafd2','#dcb871','#c29b70','#8fca94','#cfb876','#abb78a','#b8ced1','#c5b187','#d7bde6'];
 function rng(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
 function profile(seed,race){
  const R=rng((seed^Math.imul(race+1,2654435761))>>>0),pick=a=>a[Math.floor(R()*a.length)];
  const syll=['Ka','Ve','Or','Tal','Ren','Sa','Mor','Li','Da','Tor','Esh','Na','Kel','Vo','Ar','Sen'];
  const name=pick(syll)+pick(syll).toLowerCase()+' '+pick(syll)+pick(syll).toLowerCase();
  return {seed:seed>>>0,race,name,role:race===12?'Command node':race===8?'Linked host':race===17?'Presence':'Captain',kind:races[race],color:colors[race],skin:pick(['#b98061','#dbb59a','#8e604d','#c5937a','#68483d']),jaw:.75+R()*.4,eyes:.7+R()*.7,nose:R(),hair:R(),age:R(),scar:R(),bridge:Math.floor(R()*4),uniform:R(),marks:Array.from({length:12},()=>R())};
 }
 function draw(canvas,p){
  const c=canvas.getContext('2d');if(!c)return;canvas.width=520;canvas.height=300;
  c.fillStyle='#101820';c.fillRect(0,0,520,300);
  const R=rng(p.seed^712987),ellipse=(x,y,rx,ry,col)=>{c.fillStyle=col;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
  // Bridge windows and consoles have distinct seeded architecture.
  c.strokeStyle=p.color;c.lineWidth=3;
  for(let j=0;j<3+p.bridge;j++){const x=14+j*510/(3+p.bridge);c.strokeRect(x,18,500/(3+p.bridge),128);}
  for(let i=0;i<46;i++){c.fillStyle=i%7?'#8595a5':'#ecf3ff';c.fillRect(R()*520,24+R()*110,1+R()*2,1+R()*2);}
  c.fillStyle='#202e3b';c.beginPath();c.moveTo(0,216);c.lineTo(520,201);c.lineTo(520,300);c.lineTo(0,300);c.fill();
  for(let i=0;i<27;i++){c.fillStyle=i%3?p.color:'#d5dce1';c.globalAlpha=.3+R()*.5;c.fillRect(R()*520,229+R()*62,6+R()*19,3);}c.globalAlpha=1;
  const x=300,y=140,w=44*p.jaw,skin=[1,2,4,7,8,12,13,15,16,17].includes(p.race)?p.color:p.skin;
  ellipse(x,304,104,106,'#111b29');ellipse(x,234,29,44,skin);
  c.fillStyle=p.uniform>.5?'#304454':'#493e3e';c.beginPath();c.moveTo(x-110,300);c.lineTo(x-64,241);c.lineTo(x,262);c.lineTo(x+64,241);c.lineTo(x+110,300);c.fill();
  if(p.race===8){for(let i=0;i<7;i++){c.strokeStyle='#66537f';c.lineWidth=9-i*.6;c.beginPath();c.moveTo(x,200);c.bezierCurveTo(x-100+i*30,100,x-125+i*44,110,x-138+i*45,45+i%2*50);c.stroke();}ellipse(x,153,42,64,'#252131');}
  else if(p.race===2||p.race===17){c.fillStyle=skin;c.beginPath();c.moveTo(x,61);c.lineTo(x+w,127);c.lineTo(x+w*.65,196);c.lineTo(x,231);c.lineTo(x-w,174);c.lineTo(x-w*.7,99);c.fill();}
  else{ellipse(x-w,151,10,20,skin);ellipse(x+w,151,10,20,skin);ellipse(x,y,w,76,skin);}
  if(p.race===7){c.fillStyle='#d7d9c6';c.beginPath();c.moveTo(x-w-12,146);c.lineTo(x-w-18,60);c.lineTo(x,42);c.lineTo(x+w+15,67);c.lineTo(x+w+11,146);c.lineTo(x+w-5,89);c.lineTo(x,70);c.lineTo(x-w+5,89);c.fill();}
  if(p.race===11){for(let i=0;i<6;i++)ellipse(x,83+i*9,15-i,4,'#70513d');}
  if(p.race===13){for(let i=0;i<5;i++){c.strokeStyle='#6e623d';c.lineWidth=5;c.beginPath();c.moveTo(x-w,90+i*22);c.lineTo(x+w,90+i*22);c.stroke();}}
  if(p.race===16){for(const sign of [-1,1])for(let i=0;i<5;i++){c.strokeStyle='#393733';c.lineWidth=7;c.beginPath();c.moveTo(x+sign*w,91+i*13);c.lineTo(x+sign*(w+24+i*4),234);c.stroke();}}
  if(p.race===1){for(const sign of [-1,1]){ellipse(x+sign*w*.5,y-25,13,9,'#283e35');ellipse(x+sign*w*.5,y-25,4,7,'#c9e6a7');}for(let i=0;i<4;i++)ellipse(x,y+50+i*7,21-i*3,3,'#54776a');}
  if(p.race===4){ellipse(x,y,34,52,'#e0d9ba');c.strokeStyle='#847c5e';c.lineWidth=3;c.beginPath();c.moveTo(x,y-52);c.lineTo(x,y+51);c.stroke();}
  const human=[0,3,5,6,9,10,14].includes(p.race);
  if(human&&p.hair>.18){c.fillStyle=p.hair>.7?'#aaabac':'#322b2a';c.beginPath();c.ellipse(x,y-44,w+3,36,0,Math.PI,Math.PI*2);c.lineTo(x+w,y-28);c.lineTo(x-w,y-42);c.fill();}
  for(const sign of [-1,1]){ellipse(x+sign*w*.43,y,12*p.eyes,5,'#e2ded5');ellipse(x+sign*w*.43,y,3,5,p.race===8?'#d19ae8':'#202b32');c.strokeStyle='#514640';c.lineWidth=3;c.beginPath();c.moveTo(x+sign*w*.2,y-12);c.lineTo(x+sign*w*.68,y-15+p.age*7);c.stroke();}
  c.strokeStyle='#69534a';c.lineWidth=3;c.beginPath();c.moveTo(x,y+5);c.lineTo(x-5+p.nose*10,y+29);c.lineTo(x+7,y+31);c.stroke();
  c.beginPath();c.moveTo(x-17,y+49);c.quadraticCurveTo(x,y+45+p.age*9,x+18,y+47);c.stroke();
  if(p.race===12){c.fillStyle='#444e50';c.fillRect(x-38,y-14,29,34);ellipse(x-24,y,7,7,'#db4b43');c.strokeStyle='#677e6a';c.lineWidth=7;c.beginPath();c.moveTo(x-37,y+8);c.bezierCurveTo(x-90,y+20,x-85,240,x-58,269);c.stroke();}
  if(p.race===5||p.race===14){c.fillStyle=p.race===5?'#414957':'#606950';c.fillRect(x-w-8,80,w*2+16,24);}
  if(p.scar>.55){c.strokeStyle='#ddd0b9';c.lineWidth=1.5;c.beginPath();c.moveTo(x+23,y+6);c.lineTo(x+32,y+27);c.stroke();}
  c.fillStyle=p.color;for(let i=0;i<2+Math.floor(p.age*4);i++)c.fillRect(x+39+i*7,260,4,12);
 }
 const api={profile,draw};if(typeof module==='object')module.exports=api;else root.ArmadaCrew=api;
})(typeof window==='object'?window:globalThis);
