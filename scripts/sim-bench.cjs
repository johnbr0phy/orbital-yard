#!/usr/bin/env node
/* Headless simulation cost and state trace. CPU only: no rendering, no GPU.
   Usage:
     node scripts/sim-bench.cjs [--matchup 5,6] [--size 300] [--seed 1234] [--from 38] [--to 48]
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
  const c0 = process.cpuUsage(), w0 = Date.now(), t0 = warTime(b);
  stepTo(b, to);
  const cpu = process.cpuUsage(c0), sim = warTime(b) - t0;
  const out = {matchup: [a, c], size, seed, ships: n, aliveAtStart: alive0, window: [from, to], simSeconds: +sim.toFixed(2),
    msCpuPerSimSecond: Math.round((cpu.user + cpu.system) / 1000 / Math.max(.001, sim)), wallMs: Date.now() - w0};
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
