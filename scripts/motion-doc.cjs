#!/usr/bin/env node
/* Writes the criteria table and the per-scene table into MOTION.md from measured files, so
   every number there comes from a file in bench/motion/ and nothing is typed by hand.
     bench/motion/<before>/summary.json, bench/motion/<after>/summary.json  (motion-report)
     bench/motion/checks.json  (tests, determinism, performance, balance, story: written by
                                the commands listed in MOTION.md, see "How to re-run")
   node scripts/motion-doc.cjs [--before baseline] [--after final] */
const fs = require('node:fs'), path = require('node:path');
const SC = require('./motion-scenes.cjs');
const root = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const before = arg('before', 'baseline'), after = arg('after', 'final');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const B = read(`bench/motion/${before}/summary.json`), A = read(`bench/motion/${after}/summary.json`);
const checks = fs.existsSync(path.join(root, 'bench/motion/checks.json')) ? read('bench/motion/checks.json') : {};
const esc = s => String(s).replace(/\|/g, '\\|');
const res = p => p === true ? '**PASS**' : p === false ? '**FAIL**' : 'n/a';
let t = '| # | criterion | target | baseline (main) | final | result |\n|---|---|---|---|---|---|\n';
let n = 0;
for (const c of A.criteria) { const b = B.criteria.find(x => x.id === c.id) || {}; t += `| ${++n} | ${esc(c.text)} | ${esc(c.target)} | ${esc(b.value || '-')} | ${esc(c.value)} | ${res(c.pass)} |\n`; }
for (const c of checks.rows || []) t += `| ${++n} | ${esc(c.text)} | ${esc(c.target)} | ${esc(c.before || '-')} | ${esc(c.value)} | ${res(c.pass)} |\n`;
t += `\nMeasured by \`scripts/motion-report.cjs\` over ${A.runs} runs (${SC.scenes.length} scenes and the 24-war sweep), baseline on main 7f82d45, final on this branch. Rows ${A.criteria.length + 1} onward are measured outside the motion report; see "How to re-run".\n`;
// Per-scene table.
let s = '| scene | reversals /min (before → after) | gunboat + capital reversals /min | worst shuttle | frigate p95 angular jerk | cohesion in band | smallest squadmate distance |\n|---|---|---|---|---|---|---|\n';
const pr = x => x == null ? '-' : x;
for (const sc of SC.scenes) {
  const b = B.perRun.find(r => r.id === sc.id), a = A.perRun.find(r => r.id === sc.id);
  if (!b || !a) continue;
  if (sc.id.startsWith('02-') && !a.hasFrigates) continue;
  const f = (o, k, d) => o && o[k] != null ? (+o[k]).toFixed(d) : '-';
  s += `| ${sc.id} ${esc(sc.name)} | ${b.all.perMin.toFixed(3)} → ${a.all.perMin.toFixed(3)} | ${f(b.frigate, 'strictPerMin', 3)} / ${f(b.capital, 'strictPerMin', 3)} → ${f(a.frigate, 'strictPerMin', 3)} / ${f(a.capital, 'strictPerMin', 3)} | ${(b.all.shuttleMax * 100).toFixed(0)}% → ${(a.all.shuttleMax * 100).toFixed(0)}% | ${f(b.frigate, 'angP95', 2)} → ${f(a.frigate, 'angP95', 2)} | ${b.cohesion == null ? '-' : (b.cohesion * 100).toFixed(0) + '%'} → ${a.cohesion == null ? '-' : (a.cohesion * 100).toFixed(0) + '%'} | ${pr(b.individualityMin)} → ${pr(a.individualityMin)} |\n`;
}
let md = fs.readFileSync(path.join(root, 'MOTION.md'), 'utf8');
const put = (tag, body) => {
  const open = `<!-- ${tag} -->`, close = `<!-- /${tag} -->`;
  if (md.includes(close)) md = md.replace(new RegExp(`${open}[\\s\\S]*?${close}`), `${open}\n${body}${close}`);
  else md = md.replace(open, `${open}\n${body}${close}`);
};
put('CRITERIA-TABLE', t);
if (md.includes('<!-- SCENE-TABLE -->')) put('SCENE-TABLE', s);
fs.writeFileSync(path.join(root, 'MOTION.md'), md);
console.log('MOTION.md updated:', A.criteria.filter(c => c.pass === true).length, 'of', A.criteria.length, 'motion criteria pass;', (checks.rows || []).filter(c => c.pass === true).length, 'of', (checks.rows || []).length, 'other checks pass');
