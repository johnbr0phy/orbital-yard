/* The motion scene set and the fleet sweep. Shared by scripts/motion-report.cjs
   (headless, measured) and scripts/motion-capture.cjs (browser, WebM + log).

   Each scene is a fixed seed and matchup. Where a scene needs a moment the
   minds might not produce on their own (a capital turning about, a rout
   and rally), a script issues the story orders at fixed times, so the
   scene is the same situation before and after the flight changes.

   clip: [from, to] war seconds recorded as video (the whole scene is still measured).
   focus: page-side expression, evaluated once when the scene's clock
   reaches `pick`, returning the ids of the ships the scene is about (the
   camera follows their centroid, the plots highlight them). */
const FLEETS = ['Yard', 'Shoal', 'Lattice', 'Drift', 'Choir', 'Empire', 'Rebels', 'Minbari', 'Shadows', 'EarthForce', 'Federation', 'Klingons',
  'Borg', 'Mondoshawan', 'USCM', 'Engineers', 'Yautja', 'First Ones', 'Romulans', 'Dominion', 'Space Marines', 'Tyranids', 'Tesla'];

// Page-side helpers for focus expressions.
const FOCUS = {
  frigates: side => `ships.filter(s=>s.side===${side}&&!s.dead&&isGunboat(s)).map(s=>s.id)`,
  squadOf: (side, band) => `(()=>{const q=squads.find(q=>q.side===${side}&&!q.hero&&q.mem.length>=3&&ships[q.mem[0]].band===${band}&&q.mem.every(id=>!ships[id].dead));return q?q.mem.slice():[];})()`,
  capitals: side => `ships.filter(s=>s.side===${side}&&!s.dead&&fightsAsCrown(s)).map(s=>s.id)`,
  crownAndEscorts: side => `(()=>{const c=ships.filter(s=>s.side===${side}&&!s.dead&&(s.hulls||0)>=10).sort((a,b)=>b.slen-a.slen)[0];if(!c)return [];return [c.id,...ships.filter(s=>s.side===${side}&&!s.dead&&s!==c&&Math.hypot(s.x-c.x,s.z-c.z)<c.slen*1.5+1500).slice(0,12).map(s=>s.id)];})()`,
  fighters: side => `ships.filter(s=>s.side===${side}&&!s.dead&&s.slen<80&&!isGunboat(s)&&!fightsAsCrown(s)).slice(0,24).map(s=>s.id)`,
  all: () => `ships.filter(s=>!s.dead).map(s=>s.id)`
};

const scenes = [
  {id: '01', name: 'Rebel frigate screen', note: 'The reported donkey bug: Rebel frigates, corvettes and transports in Empire v Rebels.',
    matchup: [5, 6], seed: 2202, size: 60, seconds: 75, pick: 8, clip: [18, 48], focus: FOCUS.frigates(1), camera: {type: 'group', back: 900, up: 520, side: 700}},
  // 02: one per fleet that has gunboats (filled below).
  {id: '03', name: 'Imperial squadron: form, attack, re-form', matchup: [5, 6], seed: 1101, size: 60, seconds: 80, pick: 6, clip: [4, 48],
    focus: FOCUS.squadOf(0, 0), camera: {type: 'group', back: 420, up: 180, side: 260}},
  {id: '04', name: 'Rebel squadron: form, attack, re-form', matchup: [5, 6], seed: 1101, size: 60, seconds: 80, pick: 6, clip: [4, 48],
    focus: FOCUS.squadOf(1, 0), camera: {type: 'group', back: 420, up: 180, side: 260}},
  {id: '05', name: 'Borg cube and escorts closing', matchup: [12, 10], seed: 1101, size: 60, seconds: 70, pick: 4, clip: [4, 40],
    focus: FOCUS.crownAndEscorts(0), camera: {type: 'group', back: 5200, up: 1800, side: 2600}},
  {id: '06', name: 'Capital handling: broadside pass, 180 degree turn, stop', matchup: [9, 10], seed: 4242, size: 30, seconds: 120, pick: 3, clip: [12, 84],
    focus: `(()=>{const c=ships.filter(s=>s.side===0&&!s.dead&&fightsAsCrown(s)&&!(s.hulls>=50)).sort((a,b)=>b.slen-a.slen)[0];return c?[c.id]:[];})()`,
    // t=15: a waypoint 4 km astern (turn about); t=70: hold where it is (stop).
    script: [{t: 15, code: `(()=>{const s=ships[__focus[0]];if(!s||s.dead)return;const p=[s.x-Math.cos(s.yaw)*4000,s.y,s.z-Math.sin(s.yaw)*4000];__scene.p=p;battleAI.story.setOrder(s,'HOLD',{point:p,until:battleTime+54,scripted:true});})()`},
      {t: 70, code: `(()=>{const s=ships[__focus[0]];if(!s||s.dead)return;battleAI.story.setOrder(s,'HOLD',{point:[s.x+Math.cos(s.yaw)*300,s.y,s.z+Math.sin(s.yaw)*300],until:battleTime+60,scripted:true});})()`}],
    camera: {type: 'group', back: 2600, up: 1400, side: 1600}},
  {id: '07', name: 'Dogfight: Empire v Shoal', matchup: [5, 1], seed: 1101, size: 60, seconds: 75, pick: 10, clip: [20, 50], focus: FOCUS.fighters(0), camera: {type: 'group', back: 700, up: 300, side: 400}},
  {id: '08', name: 'A rout and a rally', matchup: [9, 11], seed: 2202, size: 60, seconds: 90, pick: 30, clip: [28, 62], focus: FOCUS.squadOf(0, 0),
    // t=32: the squadron breaks (the same path squadMorale takes); t=52: it rallies.
    script: [{t: 32, code: `(()=>{const q=squads[ships[__focus[0]]?.squad];if(!q)return;q.state='routing';q.routAt=battleTime;q.escapeAt=battleTime+1e9;q.rallyTried=true;for(const id of q.mem){const s=ships[id];if(s&&!s.dead){battleAI.story.setOrder(s,'ROUT',{until:battleTime+40});s.routing=true;}}battleAI.story.emit({type:'rout',side:q.side,squad:q.id,ship:q.mem[0],name:q.name,n:q.mem.length,x:ships[q.mem[0]].x,y:0,z:ships[q.mem[0]].z,size:20});})()`},
      {t: 52, code: `(()=>{const q=squads[ships[__focus[0]]?.squad];if(!q)return;q.state='steady';for(const id of q.mem){const s=ships[id];if(s&&s.ai){if(s.ai.order&&s.ai.order.kind==='ROUT')s.ai.order=null;s.routing=false;s.ai.fear*=.5;}}battleAI.story.emit({type:'rally',side:q.side,squad:q.id,ship:q.mem[0],name:q.name,n:q.mem.length,x:ships[q.mem[0]].x,y:0,z:ships[q.mem[0]].z,size:20});})()`}],
    camera: {type: 'group', back: 700, up: 320, side: 420}},
  {id: '09', name: 'A holding line breaks under First One fire', matchup: [5, 17], seed: 42, size: 60, seconds: 70, pick: 12, clip: [22, 54], force: {plans: ['HOLD', null]},
    focus: FOCUS.fighters(0), camera: {type: 'group', back: 1400, up: 700, side: 900}},
  {id: '10', name: 'A full war, Broadcast, 600 a side', matchup: [5, 6], seed: 2202, size: 600, seconds: 90, pick: 5, clip: [0, 90], focus: FOCUS.all(), camera: {type: 'broadcast'}, quality: 'ultra', heavy: true}
];
// Scene 2: a gunboat screen for every fleet that has gunboats. Opponent: a
// fixed neighbour so each is a real fight. Fleets without gunboats are
// dropped when the scene runs (the report says which).
const gunboatScenes = FLEETS.map((name, race) => ({id: '02-' + String(race).padStart(2, '0'), name: `Gunboat screen: ${name}`, group: '02',
  matchup: [race, race === 5 ? 6 : 5], seed: 3303, size: 60, seconds: 60, pick: 8, clip: [14, 26], focus: FOCUS.frigates(0), camera: {type: 'group', back: 900, up: 520, side: 700}}));
const allScenes = [scenes[0], ...gunboatScenes, ...scenes.slice(1)];

/* The fleet sweep: every fleet in a measured war, twice (two seeds), so a
   classifier can be trained on one seed's wars and scored on the other's.
   12 pairings (fleet-balance.cjs runs 9) cover all 23 fleets. */
function sweep() {
  const pairs = []; for (let r = 0; r < 22; r += 2) pairs.push([r, r + 1]); pairs.push([22, 0]);
  const out = [];
  for (const seed of [20260905, 20260929]) for (const [a, b] of pairs) out.push({id: `sweep-${a}v${b}-${seed % 100}`, name: `${FLEETS[a]} v ${FLEETS[b]}`, matchup: [a, b], seed: seed + a, size: 48, seconds: 150, fold: seed % 100, sweep: true});
  return out;
}

module.exports = {FLEETS, FOCUS, scenes: allScenes, sweep};
