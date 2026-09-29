#!/usr/bin/env node
/* Headless simulation cost and state trace. CPU only: no rendering, no GPU.
   Usage:
     node scripts/sim-bench.cjs [--matchup 5,6] [--size 300] [--seed 1234] [--from 38] [--to 48] [--profile]
     node scripts/sim-bench.cjs --trace [--out trace.txt]
   Cost mode reports ms of CPU per simulated second over [from, to] of war time.
   Trace mode runs three fixed battles and prints a SHA-256 of every ship's
   state once a simulated second: byte-identical traces mean identical wars. */
const {loadBattle} = require('../tests/tribute-new/headless-battle.cjs');
const crypto = require('node:crypto');
const fs = require('node:fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);

function warTime(b) { return b.run('battleTime-warT0'); }
function stepTo(b, t) { while (warTime(b) < t && b.run('winner==null')) b.step(1 / 30); }

function cost() {
  const [a, c] = arg('matchup', '5,6').split(',').map(Number);
  const size = +arg('size', 300), seed = +arg('seed', 1234), from = +arg('from', 38), to = +arg('to', 48);
  const b = loadBattle({cores: 1});
  const n = b.start(a, c, seed, size);
  stepTo(b, from);
  const alive0 = b.run('ships.filter(s=>!s.dead).length');
  // --profile: also time the minds and the helm (AI decisions, destinations, formations, capital
  // movement, traffic and the throttle), so the flight code's own cost is visible beside the total.
  // The harness's performance.now is frozen (determinism); the profile reads the real clock.
  if (has('profile')) b.context.__realNow = require('node:perf_hooks').performance.now.bind(require('node:perf_hooks').performance);
  if (has('profile')) b.run(`globalThis.__prof={ms:0,calls:0,depth:0};(function(){
    // Only the outermost call is timed, so a destination() inside moveCapital() is not counted twice.
    const timed=f=>function(){if(__prof.depth++)try{return f.apply(this,arguments);}finally{__prof.depth--;}const t=__realNow();try{return f.apply(this,arguments);}finally{__prof.depth--;__prof.ms+=__realNow()-t;__prof.calls++;}};
    const P=Object.getPrototypeOf(battleAI);for(const k of ['destination','moveCapital','command','helmTurn','helmBank','helmClimb','helmSpeed','helmStation','helmDelay','avoidBlend','leadCap','rhythm'])if(P[k])battleAI[k]=timed(P[k]);
    for(const k of ['trafficPilot','throttle','craftWant','fighterPassGoal'])if(typeof globalThis[k]==='function')globalThis[k]=timed(globalThis[k]);
  })();`);
  const c0 = process.cpuUsage(), w0 = Date.now(), t0 = warTime(b);
  // Mean live ships over the window, sampled each simulated second (the
  // sampling costs a few ms, not counted separately), so wars that engage
  // at different times can be compared per ship.
  let aliveSum = 0, samples = 0;
  for (let t = Math.floor(from) + 1; t <= to; t++) { stepTo(b, t); aliveSum += b.run('ships.filter(s=>!s.dead&&!s.jumped).length'); samples++; }
  const cpu = process.cpuUsage(c0), sim = warTime(b) - t0;
  const out = {matchup: [a, c], size, seed, ships: n, aliveAtStart: alive0, window: [from, to], simSeconds: +sim.toFixed(2),
    msCpuPerSimSecond: Math.round((cpu.user + cpu.system) / 1000 / Math.max(.001, sim)),
    meanAlive: Math.round(aliveSum / Math.max(1, samples)), goneAtEnd: n - b.run('ships.filter(s=>!s.dead).length'), wallMs: Date.now() - w0};
  if (has('profile')) { const p = b.run('__prof'); out.flightMsPerSimSecond = Math.round(p.ms / Math.max(.001, sim)); out.flightCalls = p.calls; }
  console.log(JSON.stringify(out));
  return out;
}

function trace() {
  const battles = [[5, 6, 150, 101], [12, 10, 80, 202], [8, 7, 60, 303]];
  const lines = [];
  for (const [a, c, size, seed] of battles) {
    const b = loadBattle({cores: 1});
    b.start(a, c, seed, size);
    for (let t = 1; t <= 40; t++) {
      stepTo(b, t);
      const state = b.run(`JSON.stringify(ships.map(s=>[s.id,s.dead?1:0,+s.x.toFixed(3),+s.y.toFixed(3),+s.z.toFixed(3),+(s.yaw||0).toFixed(4),+(s.hp||0).toFixed(3)]))`);
      lines.push(`${a}v${c}@${t} ${crypto.createHash('sha256').update(state).digest('hex').slice(0, 16)}`);
    }
  }
  const text = lines.join('\n') + '\n';
  if (arg('out')) fs.writeFileSync(arg('out'), text);
  console.log(crypto.createHash('sha256').update(text).digest('hex'));
}

if (has('trace')) trace(); else cost();
