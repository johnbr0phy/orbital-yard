(function(root){
 function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
 function generate(seed){
  const R=random(seed),pick=a=>a[Math.floor(R()*a.length)],style=Math.floor(R()*8),angle=.65+(R()-.5)*.3,el=-.28+(R()-.5)*.18;
  const names=['Giant sun','Five worlds','Ringed kingdom','Binary dawn','Ocean frontier','Ice giant moons','Eclipse','Ember worlds'];
  const palette=[[[.64,.38,.18],[.92,.75,.49]],[[.2,.38,.52],[.66,.81,.88]],[[.48,.28,.43],[.83,.62,.73]],[[.32,.43,.28],[.71,.75,.51]],[[.42,.35,.26],[.78,.72,.58]]];
  const bodies=[],point=(az,e,d)=>[Math.cos(az)*Math.cos(e)*d,Math.sin(e)*d,Math.sin(az)*Math.cos(e)*d];
  function body(kind,az,e,r,d=5,extra={}){const colors=pick(palette),b={kind,p:point(az,e,d),radius:r,base:colors[0],accent:colors[1],phase:R()*6.283,bands:3+Math.floor(R()*8),tilt:(R()-.5)*1.1,...extra};
   if(kind===2){b.base=[.035,.17+R()*.12,.32+R()*.18];b.accent=[.23+R()*.2,.43+R()*.22,.23];}
   if(kind===3){b.base=[.24,.40,.52];b.accent=[.77,.88,.93];}
   if(kind===4){b.base=[.11,.065,.05];b.accent=[1,.18+R()*.2,.025];}
   if(kind===5){b.base=pick([[1,.38,.08],[1,.72,.28],[.55,.72,1],[1,.2,.13]]);b.accent=[1,.94,.76];}
   bodies.push(b);return b;
  }
  function moons(parent,n){for(let i=0;i<n;i++){const t=(i/n)*6.283+R()*.4,spread=parent.radius*(1.6+R()*1.7),b=body(R()<.3?3:1,angle,el,parent.radius*(.10+R()*.13),5,{moon:true});b.p=parent.p.map((v,j)=>v+(j===0?-Math.sin(angle)*Math.cos(t):j===1?Math.sin(t)*.65:Math.cos(angle)*Math.cos(t))*spread);b.p[0]-=Math.cos(angle)*parent.radius*.5;b.p[2]-=Math.sin(angle)*parent.radius*.5;}}
  let main;
  if(style===0){main=body(5,angle-.22,el+.12,1.38);body(1,angle+.5,el-.14,.56);body(4,angle-.65,el-.35,.30);}
  if(style===1){for(let i=0;i<5;i++)body([2,0,1,3,4][i],angle+(i-2)*.27,el+Math.sin(i)*.16,.42+R()*.30,5.2+i*.16,{rings:i===1});}
  if(style===2){main=body(0,angle+.18,el,1.14,5,{rings:true});moons(main,5);body(5,angle-.55,el+.3,.32,6.2);}
  if(style===3){body(5,angle-.27,el+.12,.82,5.6);body(5,angle+.12,el+.20,.57,5.9);main=body(2,angle+.55,el-.26,.68);moons(main,2);}
  if(style===4){main=body(2,angle,el,1.27);moons(main,3);body(0,angle-.68,el+.14,.45,6,{rings:true});}
  if(style===5){main=body(3,angle+.1,el,1.1,5,{rings:R()<.6});moons(main,7);}
  if(style===6){body(5,angle,el,1.12,5.8);main=body(1,angle+.035,el-.018,.82,4.4);moons(main,2);}
  if(style===7){main=body(4,angle+.15,el,.98);body(5,angle-.48,el+.2,.62,6);body(4,angle+.6,el-.27,.37);moons(main,3);}
  // Secondary worlds give the opposite fleet and the tactical overhead camera a sky too.
  body(pick([0,1,2,3]),angle+Math.PI,el+.12,.72+R()*.30,5.5,{rings:R()<.35});
  body(pick([0,1,3]),angle,-1.05,.65+R()*.32,5.4);
  const sun=bodies.find(b=>b.kind===5),light=sun?sun.p:[-3,5,1];
  return {seed:seed>>>0,style,name:names[style],bodies,light,starCount:1800+Math.floor(R()*1200),starTint:pick([[.76,.84,1],[1,.89,.74],[.84,.92,1]])};
 }
 const api={generate};if(typeof module==='object')module.exports=api;else root.ArmadaSystems=api;
})(typeof window==='object'?window:globalThis);
