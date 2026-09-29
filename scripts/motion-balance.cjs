#!/usr/bin/env node
/* Winners of tests/tribute-new/fleet-balance.cjs's nine pairings (same seeds, 48 a side,
   150 s), for a checkout, so a flight change can be checked for balance before and after.
   Winner: the side the page declared, else the side ahead on strength share at 150 s
   (the momentum model's hull-weighted share), with counts for context.
   node scripts/motion-balance.cjs [--root ../orbital-yard-main] [--out bench/motion/balance-main.json] [--jobs 3] */
const path = require('node:path'), fs = require('node:fs'), {spawn} = require('node:child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(arg('root', path.join(__dirname, '..')));
if (process.argv.includes('--one')) {
  const race = +arg('one');
  const {loadBattle} = require(path.join(root, 'tests/tribute-new/headless-battle.cjs'));
  const b = loadBattle();
  b.start(race, race + 1, 20260905 + race);
  b.step(150);
  const r = b.run(`({races:sideRace,counts:counts.slice(),spawned:spawned.slice(),winner,share:battleAI.story&&battleAI.story.ready?battleAI.story.shares():null,
    capitalsFired:ships.filter(s=>fightsAsCrown(s)&&!s.dead).map(s=>({L:Math.round(s.slen),fired:(s.lastFire||0)>0}))})`);
  const lead = r.winner != null ? r.winner : r.share ? (r.share[0] >= r.share[1] ? 0 : 1) : (r.counts[0] >= r.counts[1] ? 0 : 1);
  process.stdout.write(JSON.stringify({race, ...r, lead, how: r.winner != null ? 'declared' : 'share at 150 s'}) + '\n');
  return;
}
const races = []; for (let r = 0; r < 18; r += 2) races.push(r);
const jobs = +arg('jobs', 3), out = []; let next = 0, done = 0;
(async () => {
  await new Promise(res => {
    const go = () => {
      if (next >= races.length) { if (done === races.length) res(); return; }
      const race = races[next++]; let buf = '';
      const p = spawn(process.execPath, [__filename, '--one', String(race), '--root', root], {stdio: ['ignore', 'pipe', 'inherit']});
      p.stdout.on('data', d => buf += d);
      p.on('close', () => { try { out.push(JSON.parse(buf)); } catch (e) { out.push({race, error: buf}); } done++; go(); if (done === races.length) res(); });
    };
    for (let i = 0; i < jobs; i++) go();
  });
  out.sort((a, b) => a.race - b.race);
  const file = arg('out');
  if (file) fs.writeFileSync(file, JSON.stringify(out, null, 1));
  for (const r of out) console.log(r.race + 'v' + (r.race + 1), 'lead', r.lead, r.how, 'counts', (r.counts || []).join('/'), 'share', r.share ? r.share.map(x => x.toFixed(2)).join('/') : '-');
})();
