#!/usr/bin/env node
/* Story metrics for the Tribute War. Headless and CPU only (no rendering).

   Runs a fixed set of wars through the real page simulation
   (tests/tribute-new/headless-battle.cjs) and measures whether they tell
   different stories: the decisions the minds make, how squadrons hold
   together, the named moments, the shape of each war, and how different
   seeds of the same matchup are from each other.

   Usage:
     node scripts/story-metrics.cjs [--label after] [--quick] [--sizes 60,300] [--seeds 3]
                                    [--jobs 4] [--out bench/story/after.json]
     node scripts/story-metrics.cjs --compare bench/story/before.json bench/story/after.json

   --quick runs only 60 a side (for the loop between batches of changes).
   Every war is capped: 180 simulated seconds at 60 a side, 120 at 300.
   A war that has not ended by then is reported as undecided. */
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {spawn} = require('node:child_process');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);

// The named-moment event types the story layer logs. Zero until built.
const MOMENTS = {
  routs: ['rout'], rallies: ['rally'], lastStands: ['lastStand'], rams: ['ram'],
  rescues: ['rescue'], aces: ['ace'], vendettas: ['vendetta'], flagshipsLost: ['flagshipDown'],
  successions: ['successor'], planSwitches: ['planSwitch'], podsLaunched: ['pods']
};
const DECISIONS = ['RETREAT', 'REGROUP', 'EVADE', 'FLANK', 'ESCORT', 'ATTACK'];

/* ------------------------------ the war set ------------------------------ */
function warSet(sizes, seedCount) {
  const AI = require('../armada-battle-ai-new.js');
  // Two seeded random pairings, fixed forever by this seed.
  const r = AI.random(2026), pick = () => (r() * 23) | 0;
  const random = [];
  while (random.length < 2) {
    const a = pick(); let b = pick(); if (b === a) b = (b + 1) % 23;
    if (!random.some(p => p[0] === a && p[1] === b)) random.push([a, b]);
  }
  const matchups = [
    {name: 'Empire vs Rebels', a: 5, b: 6}, {name: 'Borg vs Federation', a: 12, b: 10},
    {name: 'Shadows vs Minbari', a: 8, b: 7},
    ...random.map(([a, b], i) => ({name: `Random ${i + 1}`, a, b}))
  ];
  // 1101, 2202, 3303, then 4404 ...; --seed-list runs just those (for a run split across processes).
  const seeds = arg('seed-list') ? arg('seed-list').split(',').map(Number) : Array.from({length: seedCount}, (_, i) => 1101 * (i + 1));
  const out = [];
  for (const m of matchups) for (const size of sizes) for (const seed of seeds) out.push({...m, size, seed, cap: size >= 200 ? 120 : 180});
  return out;
}

/* --------------------------------- one war -------------------------------- */
function runWar(w) {
  const {loadBattle} = require('../tests/tribute-new/headless-battle.cjs');
  const b = loadBattle({cores: 1, modules: true});
  if (w.force) b.run(`storyForce=${JSON.stringify(w.force)}`);
  const ships = b.start(w.a, w.b, w.seed, w.size);
  const names = b.run('SIDE_NAME.slice()');
  b.run(`globalThis.__sm={fled:new Set(),sq:new Map(),coh:[],broken:0,reformed:0,maxT:0};
  globalThis.__smTick=function(){
    for(const s of ships){if(s.dead||!s.ai||!s.arr)continue;const a=s.ai.action;if(a==='RETREAT'||a==='ROUT'||s.routing)__sm.fled.add(s.id);}
  };
  globalThis.__smSecond=function(T){
    let sum=0,n=0;
    for(const q of squads){
      const m=q.mem.map(i=>ships[i]).filter(s=>s&&!s.dead&&s.arr&&!s.grace);
      let st=__sm.sq.get(q.id);if(!st)__sm.sq.set(q.id,st={state:'loose'});
      if(m.length<2)continue;
      let x=0,y=0,z=0;for(const s of m){x+=s.x;y+=s.y;z+=s.z;}x/=m.length;y/=m.length;z/=m.length;
      let d=0;for(const s of m)d+=Math.hypot(s.x-x,s.y-y,s.z-z);d/=m.length;
      sum+=d;n++;
      // Hysteresis: formed under 300 m, broken over 700 m, reformed under 300 m again.
      if(st.state!=='formed'&&d<300){if(st.state==='broken')__sm.reformed++;st.state='formed';}
      else if(st.state==='formed'&&d>700){__sm.broken++;st.state='broken';}
    }
    if(n)__sm.coh.push([T,sum/n]);
  };`);
  const cpu0 = process.cpuUsage();
  let T = 0, next = 1;
  while (T < w.cap) {
    b.step(1 / 30);
    b.run('broadcastTick(battleTime,1/30);__smTick()');
    T = b.run('battleTime-warT0');
    if (T >= next) { b.run(`__smSecond(${next})`); next++; }
    if (b.run('winner') != null) break;
  }
  const cpu = process.cpuUsage(cpu0);
  const r = b.run(`(()=>{
    const alive=ships.filter(s=>!s.dead||s.jumped);
    const fledSurvived=[...__sm.fled].filter(id=>!ships[id].dead||ships[id].jumped).length;
    return {actions:{...battleAI.stats.actions},fled:__sm.fled.size,fledSurvived,
      coh:__sm.coh,broken:__sm.broken,reformed:__sm.reformed,winner,
      counts:counts.slice(),spawned:spawned.slice(),
      momentum:bc.momentum.samples.map(s=>[+s.t.toFixed(1),+s.share.toFixed(4)]),
      events:bc.log.events.filter(e=>e.type!=='kill').map(e=>[e.type,+(e.t-warT0).toFixed(2),e.side??-1]),
      kills:bc.log.events.filter(e=>e.type==='kill').length,
      deaths:bc.log.events.filter(e=>/kill|Kill/.test(e.type)).map(e=>[+(e.t-warT0).toFixed(1),e.side,Math.round(e.x),Math.round(e.z)]),
      plans:battleAI.story&&battleAI.story.planNames?battleAI.story.planNames():null,
      objective:battleAI.story&&battleAI.story.objectiveName?battleAI.story.objectiveName():null};
  })()`);
  const cohesion = thirds(r.coh.map(c => c[1]));
  const momentum = r.momentum;
  // Lead changes: who is ahead on the momentum model's share, with a small
  // dead band so noise at 50/50 does not count as a swing.
  let lead = 0, changes = 0;
  for (const [, s] of momentum) {
    const now = s > .53 ? 1 : s < .47 ? -1 : 0;
    if (now && lead && now !== lead) changes++;
    if (now) lead = now;
  }
  const moments = {};
  for (const [k, types] of Object.entries(MOMENTS)) moments[k] = r.events.filter(e => types.includes(e[0])).length;
  const decisions = {};
  for (const k of DECISIONS) decisions[k] = r.actions[k] || 0;
  return {
    ...w, ships, names, duration: +T.toFixed(1), decided: r.winner != null, winner: r.winner,
    losses: [r.spawned[0] - r.counts[0], r.spawned[1] - r.counts[1]], spawned: r.spawned,
    decisions, fled: r.fled, fledSurvived: r.fledSurvived,
    cohesion, squadsBroken: r.broken, squadsReformed: r.reformed,
    moments, leadChanges: changes, eventTypes: new Set(r.events.map(e => e[0]).concat(r.kills ? ['kill'] : [])).size,
    timeline: r.events, momentum, plans: r.plans, objective: r.objective, shape: warShape(r, T),
    msCpuPerSimSecond: Math.round((cpu.user + cpu.system) / 1000 / Math.max(1, T))
  };
}
// Where and when the war was fought: first blood, when a side had lost a
// quarter, losses by minute, how wide the fighting spread and where it sat.
function warShape(r, T) {
  const d = r.deaths, first = d.length ? d[0][0] : null;
  const lostBy = (side, t) => d.filter(x => x[1] === side && x[0] <= t).length;
  let t25 = null;
  for (const x of d) { const s = x[1]; if (lostBy(s, x[0]) >= r.spawned[s] * .25) { t25 = x[0]; break; } }
  const mean = a => a.length ? Math.round(a.reduce((p, q) => p + q, 0) / a.length) : null;
  return {firstBlood: first, quarterLost: t25,
    losses60: [lostBy(0, 60), lostBy(1, 60)], losses120: [lostBy(0, 120), lostBy(1, 120)],
    killX: mean(d.map(x => x[2])), killSpreadZ: mean(d.map(x => Math.abs(x[3]))), end: +T.toFixed(1)};
}
function thirds(values) {
  if (!values.length) return {mean: null, early: null, mid: null, late: null};
  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
  const n = values.length, k = Math.ceil(n / 3);
  return {mean: avg(values), early: avg(values.slice(0, k)), mid: avg(values.slice(k, 2 * k)), late: avg(values.slice(2 * k))};
}

/* ------------------------------- uniqueness ------------------------------- */
// Two parts, each 0 (identical) to 1 (nothing in common):
//  timeline: cosine distance between the wars' notable-event histograms,
//            binned by type and 15-second window (plain kills excluded);
//  shape:    mean absolute difference of the momentum share curves over
//            their common span, doubled (0.5 apart everywhere = 1).
// Uniqueness = 100 x the mean of both parts over every pair of seeds.
function histogram(timeline) {
  const h = new Map();
  for (const [type, t] of timeline) { const k = type + '@' + Math.floor(t / 15); h.set(k, (h.get(k) || 0) + 1); }
  for (const [k, v] of h) h.set(k, Math.log1p(v));
  return h;
}
function cosineDistance(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; if (b.has(k)) dot += v * b.get(k); }
  for (const v of b.values()) nb += v * v;
  if (!na && !nb) return 0;
  if (!na || !nb) return 1;
  return 1 - dot / Math.sqrt(na * nb);
}
function shapeDistance(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let d = 0; for (let i = 0; i < n; i++) d += Math.abs(a[i][1] - b[i][1]);
  return Math.min(1, 2 * d / n);
}
function uniqueness(wars) {
  let t = 0, s = 0, n = 0;
  for (let i = 0; i < wars.length; i++) for (let j = i + 1; j < wars.length; j++) {
    t += cosineDistance(histogram(wars[i].timeline), histogram(wars[j].timeline));
    s += shapeDistance(wars[i].momentum, wars[j].momentum); n++;
  }
  if (!n) return null;
  return {score: Math.round(100 * (t + s) / (2 * n)), timeline: Math.round(100 * t / n), shape: Math.round(100 * s / n)};
}

/* ------------------------------- reporting ------------------------------- */
function summarise(results) {
  const groups = new Map();
  for (const r of results) { const k = r.name + ' @' + r.size; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const out = [];
  for (const [key, wars] of groups) {
    const mean = f => +(wars.reduce((a, w) => a + f(w), 0) / wars.length).toFixed(1);
    out.push({key, name: wars[0].name, size: wars[0].size, fleets: wars[0].names.join(' vs '), seeds: wars.map(w => w.seed),
      uniqueness: uniqueness(wars),
      duration: mean(w => w.duration), decided: wars.filter(w => w.decided).length,
      decisions: Object.fromEntries(DECISIONS.map(k => [k, mean(w => w.decisions[k])])),
      fledSurvived: mean(w => w.fledSurvived),
      cohesion: mean(w => w.cohesion.mean || 0), squadsBroken: mean(w => w.squadsBroken), squadsReformed: mean(w => w.squadsReformed),
      moments: Object.fromEntries(Object.keys(MOMENTS).map(k => [k, mean(w => w.moments[k])])),
      leadChanges: mean(w => w.leadChanges), eventTypes: mean(w => w.eventTypes),
      msCpuPerSimSecond: mean(w => w.msCpuPerSimSecond)});
  }
  return out;
}
function table(summary) {
  const rows = ['| war | size | dur s (decided) | retreat | regroup | evade | flank | escort | fled & lived | cohesion m | broke / reformed | routs | last stands | rams | rescues | aces | vendettas | lead changes | event types | uniqueness (timeline / shape) |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const g of summary) {
    const d = g.decisions, m = g.moments, u = g.uniqueness;
    rows.push(`| ${g.name} (${g.fleets}) | ${g.size} | ${g.duration} (${g.decided}/${g.seeds.length}) | ${d.RETREAT} | ${d.REGROUP} | ${d.EVADE} | ${d.FLANK} | ${d.ESCORT} | ${g.fledSurvived} | ${g.cohesion} | ${g.squadsBroken} / ${g.squadsReformed} | ${m.routs} | ${m.lastStands} | ${m.rams} | ${m.rescues} | ${m.aces} | ${m.vendettas} | ${g.leadChanges} | ${g.eventTypes} | ${u ? `${u.score} (${u.timeline} / ${u.shape})` : '-'} |`);
  }
  return rows.join('\n');
}
function compare(beforeFile, afterFile) {
  const A = JSON.parse(fs.readFileSync(beforeFile, 'utf8')).summary, B = JSON.parse(fs.readFileSync(afterFile, 'utf8')).summary;
  const rows = ['| war | size | uniqueness | lead changes | event types | routs | rescues | aces | fled & lived | cohesion m | dur s |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const b of B) {
    const a = A.find(x => x.key === b.key); if (!a) continue;
    const f = (x, y) => `${x} → ${y}`;
    rows.push(`| ${b.name} | ${b.size} | ${f(a.uniqueness?.score, b.uniqueness?.score)} | ${f(a.leadChanges, b.leadChanges)} | ${f(a.eventTypes, b.eventTypes)} | ${f(a.moments.routs, b.moments.routs)} | ${f(a.moments.rescues, b.moments.rescues)} | ${f(a.moments.aces, b.moments.aces)} | ${f(a.fledSurvived, b.fledSurvived)} | ${f(a.cohesion, b.cohesion)} | ${f(a.duration, b.duration)} |`);
  }
  console.log(rows.join('\n'));
}

/* ---------------------------------- main ---------------------------------- */
async function main() {
  if (has('child')) { process.stdout.write(JSON.stringify(runWar(JSON.parse(arg('child'))))); return; }
  if (has('compare')) { const i = process.argv.indexOf('--compare'); return compare(process.argv[i + 1], process.argv[i + 2]); }
  if (has('plans')) return planExperiment();
  const sizes = has('quick') ? [60] : arg('sizes', '60,300').split(',').map(Number);
  const wars = warSet(sizes, +arg('seeds', 3));
  const only = arg('only'); const list = only ? wars.filter(w => w.name.startsWith(only)) : wars;
  // Big wars first so the pool finishes together.
  list.sort((x, y) => y.size - x.size);
  const jobs = +arg('jobs', Math.max(1, os.cpus().length));
  const results = [];
  let i = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({length: jobs}, async () => {
    while (i < list.length) {
      const w = list[i++];
      const text = await new Promise((res, rej) => {
        const p = spawn(process.execPath, ['--max-old-space-size=2048', __filename, '--child', JSON.stringify(w)], {stdio: ['ignore', 'pipe', 'inherit']});
        let o = ''; p.stdout.on('data', d => o += d); p.on('close', c => c ? rej(new Error(`war ${w.name} ${w.size} ${w.seed} exit ${c}`)) : res(o));
      });
      const r = JSON.parse(text); results.push(r); done++;
      process.stderr.write(`[${done}/${list.length}] ${r.name} @${r.size} seed ${r.seed}: ${r.duration}s ${r.decided ? 'decided' : 'undecided'} · ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
    }
  }));
  results.sort((x, y) => x.name.localeCompare(y.name) || x.size - y.size || x.seed - y.seed);
  const summary = summarise(results);
  const label = arg('label', 'run');
  const file = arg('out', path.join('bench', 'story', label + '.json'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify({label, date: new Date().toISOString(), summary, wars: results}, null, 1));
  console.log(table(summary));
  console.log(`\nwrote ${file}`);
}
/* Plans change the shape of a war, not just its label: the same matchup and
   seeds with side 0 forced to each plan in turn (side 1 holds the line, the
   objective is annihilation so only the plan differs). */
async function planExperiment() {
  const PLANS = ['PINCER', 'AMBUSH', 'HOLD', 'RAID', 'DECAPITATE', 'SIEGE'];
  const [a, b] = arg('matchup', '5,6').split(',').map(Number), size = +arg('size', 60);
  const list = [];
  for (const plan of PLANS) for (const seed of [1101, 2202, 3303]) list.push({name: plan, a, b, size, seed, cap: 150, force: {plans: [plan, 'HOLD'], objective: 'ANNIHILATE'}});
  const results = await pool(list, +arg('jobs', os.cpus().length));
  const rows = ['| plan (side 0) | first blood s | a side 25% lost s | losses at 60 s (0 / 1) | losses at 120 s (0 / 1) | fight centre x m | fight spread abs z m | lead changes | winner 0 / 1 / none |', '|---|---|---|---|---|---|---|---|---|'];
  const out = {};
  for (const plan of PLANS) {
    const w = results.filter(r => r.name === plan), m = f => { const v = w.map(f).filter(x => x != null); return v.length ? +(v.reduce((p, q) => p + q, 0) / v.length).toFixed(1) : '-'; };
    out[plan] = w;
    rows.push(`| ${plan} | ${m(x => x.shape.firstBlood)} | ${m(x => x.shape.quarterLost)} | ${m(x => x.shape.losses60[0])} / ${m(x => x.shape.losses60[1])} | ${m(x => x.shape.losses120[0])} / ${m(x => x.shape.losses120[1])} | ${m(x => x.shape.killX)} | ${m(x => x.shape.killSpreadZ)} | ${m(x => x.leadChanges)} | ${w.filter(x => x.winner === 0).length} / ${w.filter(x => x.winner === 1).length} / ${w.filter(x => x.winner == null).length} |`);
  }
  const file = arg('out', path.join('bench', 'story', 'plans.json'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, JSON.stringify({matchup: [a, b], size, rows, wars: results.map(r => ({plan: r.name, seed: r.seed, shape: r.shape, leadChanges: r.leadChanges, winner: r.winner, plans: r.plans, duration: r.duration}))}, null, 1));
  console.log(rows.join('\n'));
  console.log(`\nwrote ${file}`);
}
async function pool(list, jobs) {
  const results = [];let i = 0;
  await Promise.all(Array.from({length: jobs}, async () => {
    while (i < list.length) {
      const w = list[i++];
      const text = await new Promise((res, rej) => {
        const p = spawn(process.execPath, ['--max-old-space-size=2048', __filename, '--child', JSON.stringify(w)], {stdio: ['ignore', 'pipe', 'inherit']});
        let o = ''; p.stdout.on('data', d => o += d); p.on('close', c => c ? rej(new Error(`war ${w.name} exit ${c}`)) : res(o));
      });
      results.push(JSON.parse(text));
      process.stderr.write(`[${results.length}/${list.length}] ${w.name} ${w.seed}\n`);
    }
  }));
  return results;
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = {warSet, uniqueness, histogram, cosineDistance, shapeDistance};
