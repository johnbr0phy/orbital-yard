// Loaded only by the separate story page, into its same-origin battle frame.
(()=>{
 const style=document.createElement('style');style.textContent='#brand,#score,#bar,#watchDock,#win,#picker,#pick,#introCard{display:none!important} #card{max-height:65vh}';document.head.appendChild(style);
 let manualCamera=false;document.getElementById('gl').addEventListener('pointerdown',()=>{manualCamera=true;});
 let orders=null,active=false,identitySeed=0,retired=[],assigned=false;const identities=new Map();
 const originalProfile=window.ArmadaCrew?.profile;
 if(originalProfile)ArmadaCrew.profile=(seed,race,klass)=>originalProfile(identities.get(seed)??seed,race,klass);
 function assignIdentities(){if(assigned||!ships.length||forged<total)return;assigned=true;for(const race of [...new Set(ships.map(s=>s.race))]){const fleet=ships.filter(s=>s.race===race).sort((a,b)=>b.slen-a.slen),lead=fleet[0],wing=fleet.find(s=>s.hero&&s!==lead)||fleet.at(-1);[lead,wing].forEach((s,i)=>{if(s){let seed=(identitySeed^Math.imul(race+1,73471)^Math.imul(i+1,9137))>>>0;while(originalProfile&&retired.includes(originalProfile(seed,race,s.meta?.klass||'').name))seed=(seed+1)>>>0;identities.set(s.seed,seed);}});}}
 const step=simStep;simStep=function(now,dt){if(!active){battleTime=Math.max(0,battleTime-dt);return;}return step(now,dt);};
 const destination=battleAI.destination.bind(battleAI);
 battleAI.destination=function(s,now,capital){const p=destination(s,now,capital);if(!orders||s.side!==0||s.id===pilotId)return p;const lead=ships[orders.id];if(!lead||lead.dead)return p;if(orders.mode==='withdraw'&&s.id===lead.id)return {...p,goal:[-18000,lead.y,lead.z],boost:1.25,mode:'RETREAT'};if(orders.mode==='guard'&&s.id!==lead.id&&!s.hero)return {...p,goal:[lead.x+Math.cos(s.id)*350,lead.y,lead.z+Math.sin(s.id)*350],mode:'ESCORT'};return p;};
 window.StoryBridge={
 start(e){manualCamera=false;active=false;orders=null;assigned=false;identities.clear();identitySeed=e.castSeed;retired=e.retired||[];pickMain=[e.world,e.enemy];pickAlly=[e.ally,-1];perFleet=e.pressure||24;warSeed=e.seed;startWar(false);for(const el of document.querySelectorAll('[role="dialog"]'))el.style.display='none';document.getElementById('pick')?.classList.remove('on');},
 snapshot(){assignIdentities();return {manual:manualCamera,time:battleTime,ready:ships.length>0&&forged>=total,mode:watchMode,pilot:pilotId,selected:sel,winner,ships:ships.filter(s=>s.vao||s.dead).map(s=>({id:s.id,side:s.side,race:s.race,dead:!!s.dead,arr:!!s.arr&&!s.grace,hp:s.hp,max:s.hpMax,hero:!!s.hero,length:s.slen,ship:s.meta?.desig||'Unknown vessel',captain:window.ArmadaCrew?.profile(s.seed??s.id,s.race,s.meta?.klass||'')?.name||'Unknown captain',kind:window.ArmadaCrew?.profile(s.seed??s.id,s.race,s.meta?.klass||'')?.kind||'Crew',fear:s.ai?.fear||0,kills:s.kills||0}))};},
 begin(){active=true;if(intro&&!intro.done)endIntro();setWatchView('all');},
 view(mode){manualCamera=false;setWatchView(mode);},
 follow(id){if(ships[id]&&!ships[id].dead){select(id,false);return true;}return false;},
 fly(id){if(!ships[id]||ships[id].dead||!ships[id].arr||ships[id].grace)return false;select(id,false);setWatchView('fly');return pilotId===id;},
 crew(id){if(ships[id]&&!ships[id].dead){select(id,true);return true;}return false;},
 order(id,mode){orders={id,mode};},
 portrait(canvas,id,t){const s=ships[id];if(s&&window.ArmadaCrew){const p=ArmadaCrew.profile(s.seed??s.id,s.race,s.meta?.klass||'');ArmadaCrew.draw(canvas,p,{fear:s.ai?.fear||0,hull:s.hp/s.hpMax,talking:false},t);}}
 };
})();
