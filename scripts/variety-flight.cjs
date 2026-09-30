#!/usr/bin/env node
/* Flight check per fleet (VARIETY-BRIEF.md): every fleet's numbers from a
   motion-report run, main beside this branch. Reversals (gunboats and
   capitals, and all classes), worst shuttle share, spins of hulls of 80 m or
   more, and how often the motion-only classifier names the fleet.

   node scripts/variety-flight.cjs --main bench/motion/final --after bench/motion/variety [--out bench/variety/flight.json] */
const fs = require('node:fs'), path = require('node:path');
const M = require('./motion-lib.cjs'), L = require('./variety-lib.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '..');
function perFleet(dir) {
  const runs = fs.readdirSync(path.join(dir, 'runs')).map(f => JSON.parse(fs.readFileSync(path.join(dir, 'runs', f), 'utf8')));
  const o = {};
  for (const r of runs) for (const s of r.ships) {
    const f = o[s.race] = o[s.race] || {min: 0, rev: 0, bigMin: 0, bigRev: 0, shuttle: 0, spins: 0, ok: 0, n: 0};
    const big = s.cls === 'frigate' || s.cls === 'capital' || s.cls === 'leviathan';
    f.min += s.seconds / 60; f.rev += s.reversals.length; if (big) { f.bigMin += s.seconds / 60; f.bigRev += s.reversals.length; }
    f.shuttle = Math.max(f.shuttle, s.shuttle ? s.shuttle.share : 0); if (s.slen >= 80) f.spins += s.spins.length;
  }
  const sweep = runs.filter(r => r.spec.sweep), folds = [...new Set(sweep.map(r => r.spec.fold))];
  for (const fd of folds) {
    const rows = side => sweep.filter(r => (r.spec.fold === fd) === side).flatMap(r => r.features);
    const res = M.classify(rows(false), rows(true));
    for (const conf of Object.values(res.confusion)) for (const [k, n] of Object.entries(conf)) { const [a, b] = k.split('>'); const f = o[a]; if (!f) continue; f.n += n; if (a === b) f.ok += n; }
  }
  return o;
}
const A = perFleet(path.resolve(root, arg('main', 'bench/motion/final'))), B = perFleet(path.resolve(root, arg('after', 'bench/motion/variety')));
const rows = Object.keys(B).map(Number).sort((a, b) => a - b).map(r => {
  const a = A[r] || {}, b = B[r], pm = (x, m) => m ? (x / m).toFixed(3) : '-', pc = x => (x * 100).toFixed(0) + '%';
  const ok = !b.bigRev && pm(b.rev, b.min) < .2 && b.shuttle <= .05 && !b.spins;
  return {race: r, name: L.NAMES[r], ok, line: `| ${L.NAMES[r]} | ${a.min ? a.min.toFixed(0) : '-'} → ${b.min.toFixed(0)} | ${a.bigRev ?? '-'} → ${b.bigRev} | ${pm(a.rev, a.min)} → ${pm(b.rev, b.min)} | ${pc(a.shuttle || 0)} → ${pc(b.shuttle)} | ${a.spins ?? '-'} → ${b.spins} | ${a.n ? pc(a.ok / a.n) : '-'} → ${b.n ? pc(b.ok / b.n) : '-'} | ${ok ? 'PASS' : 'FAIL'} |`};
});
const table = '| fleet | ship-minutes | reversals, gunboats and capitals | reversals per minute, all | worst shuttle | spins (80 m+) | named from motion | flight |\n|---|---|---|---|---|---|---|---|\n' + rows.map(r => r.line).join('\n');
if (arg('out')) fs.writeFileSync(path.resolve(root, arg('out')), JSON.stringify({rows: rows.map(({line, ...x}) => x)}, null, 1) + '\n');
console.log(table);
