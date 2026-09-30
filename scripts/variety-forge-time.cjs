#!/usr/bin/env node
/* Forge time per hull, main against this branch (VARIETY.md cost criterion).
   One process, nothing else running: for every fleet, the same jobs (the
   first war's muster, 90 normal jobs spread over its bands) are forged
   through each root's own forge worker handler, alternating main and branch
   in rounds so drift in machine speed hits both equally. Reports the median
   milliseconds per hull per fleet over all rounds.

   node scripts/variety-forge-time.cjs --main ../orbital-yard-main [--rounds 3] [--out bench/variety/forge-time.json] */
const fs = require('node:fs');
const path = require('node:path');
const L = require('./variety-lib.cjs');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MAIN = path.resolve(opt('main', path.join(__dirname, '../../orbital-yard-main')));
const BRANCH = path.resolve(opt('branch', path.join(__dirname, '..')));
const ROUNDS = +opt('rounds', 3), PER = 90;
const OUT = path.resolve(opt('out', path.join(__dirname, '../bench/variety/forge-time.json')));

const forges = {main: L.loadForge(MAIN), branch: L.loadForge(BRANCH)};
const result = {};
for (let race = 0; race < 23; race++) {
  if (race === 17) continue;
  // the same job list for both roots: main's muster deals the seeds and bands
  const all = forges.main.muster(race, 101, 600).filter(j => !j.hero && !j.hulls && j.band != null);
  const jobs = []; for (let k = 0; k < Math.min(PER, all.length); k++) jobs.push(all[Math.floor(k * all.length / Math.min(PER, all.length))]);
  const ms = {main: [], branch: []};
  for (let r = 0; r < ROUNDS; r++) for (const who of r % 2 ? ['branch', 'main'] : ['main', 'branch']) for (const j of jobs) ms[who].push(forges[who].forge(j).ms);
  result[race] = {name: L.NAMES[race], main: L.median(ms.main), branch: L.median(ms.branch), ratio: L.median(ms.branch) / L.median(ms.main), n: jobs.length * ROUNDS};
  console.log(`${L.NAMES[race].padEnd(14)} main ${result[race].main.toFixed(1)} ms  branch ${result[race].branch.toFixed(1)} ms  x${result[race].ratio.toFixed(2)}`);
}
fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify({rounds: ROUNDS, per: PER, main: MAIN, branch: BRANCH, fleets: result}, null, 1));
