#!/usr/bin/env node
/* Story moments per war-minute, main beside this branch, from story-metrics
   runs over the same wars and seeds (VARIETY.md, "Story").
   node scripts/variety-story.cjs [--main bench/variety/story/main-9.json] [--after bench/variety/story/after-9.json] */
const path = require('node:path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '..');
const M = require(path.resolve(root, arg('main', 'bench/variety/story/main-9.json'))).wars, A = require(path.resolve(root, arg('after', 'bench/variety/story/after-9.json'))).wars;
const KEYS = [['routs', 'routs'], ['lastStands', 'last stands'], ['rescues', 'rescues'], ['aces', 'aces'], ['planSwitches', 'plan switches'], ['rallies', 'rallies'], ['rams', 'rams'], ['vendettas', 'vendettas']];
const BRIEF = new Set(['routs', 'lastStands', 'rescues', 'aces', 'planSwitches']);
const stat = (w, k) => { const min = w.reduce((t, x) => t + x.duration, 0) / 60, n = w.reduce((t, x) => t + x.moments[k], 0); return {n, rate: n / min}; };
const rows = [], verdict = [];
for (const [k, label] of KEYS) {
  const cells = [60, 300].map(sz => { const m = stat(M.filter(x => x.size === sz), k), a = stat(A.filter(x => x.size === sz), k); if (BRIEF.has(k)) verdict.push(a.rate >= m.rate - 1e-9); return `${m.n} (${m.rate.toFixed(2)}) → ${a.n} (${a.rate.toFixed(2)})`; });
  rows.push(`| ${label}${BRIEF.has(k) ? '' : ' (not in the brief)'} | ${cells.join(' | ')} |`);
}
const sizes = [60, 300].map(sz => { const f = w => w.filter(x => x.size === sz); return `${f(M).length} wars, ${(f(M).reduce((t, x) => t + x.duration, 0) / 60).toFixed(0)} → ${(f(A).reduce((t, x) => t + x.duration, 0) / 60).toFixed(0)} war-minutes, decided ${f(M).filter(x => x.decided).length} → ${f(A).filter(x => x.decided).length}`; });
console.log(`| moment: count (per war-minute), main → branch | 60 a side | 300 a side |\n|---|---|---|\n| wars | ${sizes.join(' | ')} |\n${rows.join('\n')}`);
console.log(`\nbrief's moments at main's rate or better: ${verdict.every(Boolean) ? 'yes' : 'no'}`);
