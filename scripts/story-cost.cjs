#!/usr/bin/env node
/* The story layer's own CPU, inside a real war. Headless, CPU only.
   node scripts/story-cost.cjs [--matchup 5,6] [--size 300] [--seed 1234] [--from 30] [--to 90]
   Wraps the page's storyStep (story engine step, event drain, pods, tows)
   and times it with process.hrtime against the whole simStep, over the
   same window scripts/sim-bench.cjs uses. The order checks inside the
   pilots' think() are not separable and are counted as simulation. */
const {loadBattle} = require('../tests/tribute-new/headless-battle.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const [a, c] = arg('matchup', '5,6').split(',').map(Number), size = +arg('size', 300), seed = +arg('seed', 1234), from = +arg('from', 30), to = +arg('to', 90);
const b = loadBattle({cores: 1});
b.start(a, c, seed, size);
b.context.__hr = () => { const t = process.hrtime(); return t[0] * 1e3 + t[1] / 1e6; };
b.run(`globalThis.__cost={story:0,sim:0,on:false};
  (()=>{const st=storyStep;storyStep=function(n,d){const t=__hr();st(n,d);if(__cost.on)__cost.story+=__hr()-t;};
        const ss=simStep;simStep=function(n,d){const t=__hr();ss(n,d);if(__cost.on)__cost.sim+=__hr()-t;};})()`);
while (b.run('battleTime-warT0') < from) b.step(1 / 30);
b.run('__cost.on=true');
while (b.run('battleTime-warT0') < to && b.run('winner==null')) b.step(1 / 30);
const r = b.run('__cost'), sim = to - from;
console.log(JSON.stringify({matchup: [a, c], size, seed, window: [from, to], simMsPerSimSecond: Math.round(r.sim / sim), storyMsPerSimSecond: +(r.story / sim).toFixed(1), storyShare: +(r.story / r.sim * 100).toFixed(2) + '%'}));
