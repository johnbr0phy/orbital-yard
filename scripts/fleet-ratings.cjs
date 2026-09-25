#!/usr/bin/env node
/* Fleet strength ratings for the picker's odds bar.
   Runs the real headless battle (tests/tribute-new/headless-battle.cjs) for
   every pairing of the 23 fleets (sides alternate by pairing), at a small fixed
   size and seed, then fits Bradley-Terry ratings on an Elo scale.
   A battle still undecided at the time limit counts as a partial win by
   remaining strength share.

   node scripts/fleet-ratings.cjs [--size 24] [--seconds 150] [--shard 0/3] > part.json
   node scripts/fleet-ratings.cjs --merge part0.json part1.json ... > ratings.json

   These are diagnostic simulation results at one small fleet size, not a
   claim about canon or about every battle size. */
const path = require('node:path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = 23;

function merge(files) {
  const games = files.flatMap(f => require(path.resolve(f)).games);
  // Bradley-Terry by minorization-maximisation, then log-scale to Elo points.
  const w = Array(N).fill(0), strength = Array(N).fill(1);
  for (const g of games) { w[g.a] += g.score; w[g.b] += 1 - g.score; }
  for (let it = 0; it < 400; it++) {
    const next = strength.map((s, i) => {
      let denom = 0;
      for (const g of games) if (g.a === i || g.b === i) { const j = g.a === i ? g.b : g.a; denom += 1 / (s + strength[j]); }
      return Math.max(1e-3, (w[i] + .5) / Math.max(1e-9, denom + 1 / (s + 1))); // weak prior toward average
    });
    const mean = Math.exp(next.reduce((a, s) => a + Math.log(s), 0) / N);
    for (let i = 0; i < N; i++) strength[i] = next[i] / mean;
  }
  const elo = strength.map(s => Math.round(1500 + 400 * Math.log10(s)));
  return {size: games[0]?.size, seconds: games[0]?.seconds, games: games.length, elo};
}

if (process.argv.includes('--merge')) {
  const files = process.argv.slice(process.argv.indexOf('--merge') + 1);
  console.log(JSON.stringify(merge(files)));
  process.exit(0);
}

const {loadBattle} = require('../tests/tribute-new/headless-battle.cjs');
const size = +arg('size', 24), seconds = +arg('seconds', 150);
const [shard, shards] = arg('shard', '0/1').split('/').map(Number);
const pairs = [];
// One battle per pairing; which fleet takes the first side alternates.
for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) pairs.push((a + b) % 2 ? [a, b] : [b, a]);
const games = [];
pairs.forEach(([a, b], k) => {
  if (k % shards !== shard) return;
  const B = loadBattle();
  const seed = (Math.imul(a + 1, 7919) ^ Math.imul(b + 1, 104729)) >>> 0;
  B.start(a, b, seed, size);
  for (let t = 0; t < seconds && B.run('winner') == null; t += 5) B.step(5);
  const r = JSON.parse(B.run(`(()=>{const v=[0,0];for(const s of ships)if(!s.dead&&s.vao)v[s.side]+=Math.pow(Math.max(1,s.hpMax),.8)*Math.max(0,s.hp)/Math.max(1,s.hpMax);return JSON.stringify({winner,v,t:battleTime-warT0});})()`));
  const score = r.winner != null ? (r.winner === 0 ? 1 : 0) : r.v[0] / Math.max(1e-9, r.v[0] + r.v[1]);
  games.push({a, b, score, decided: r.winner != null, t: Math.round(r.t), size, seconds});
  process.stderr.write(`${a} v ${b}: ${score.toFixed(2)}${r.winner != null ? '' : ' (time)'}\n`);
});
console.log(JSON.stringify({games}));
