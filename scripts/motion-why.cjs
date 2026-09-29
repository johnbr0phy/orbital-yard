#!/usr/bin/env node
/* Lists the worst offenders in a motion report, with the AI mode and reason at the moment.
   node scripts/motion-why.cjs <label> [--n 20] */
const fs = require('node:fs'), path = require('node:path');
const label = process.argv[2], n = +(process.argv[process.argv.indexOf('--n') + 1] || 20);
const dir = path.join(__dirname, '..', 'bench/motion', label, 'runs');
const FLEETS = require('./motion-scenes.cjs').FLEETS;
const runs = fs.readdirSync(dir).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const rows = (fn) => runs.flatMap(r => r.ships.flatMap(s => fn(s).map(x => ({run: r.spec.id, id: s.id, fleet: FLEETS[s.race], cls: s.cls, L: s.slen, ...x}))));
const show = (title, list) => { console.log('\n## ' + title); for (const x of list.slice(0, n)) console.log(JSON.stringify(x)); };
show('shuttle', rows(s => s.shuttle.share > .05 ? [s.shuttle] : []).sort((a, b) => b.share - a.share));
show('reversals', rows(s => s.reversals));
show('strict reversals', rows(s => s.reversalsStrict || []));
show('spins', rows(s => s.spins));
show('capital limits', rows(s => s.limits && (s.limits.accRatio > 1.05 || s.limits.decRatio > 1.05 || s.limits.turnRatio > 1.05) ? [{acc: +s.limits.accRatio.toFixed(2), dec: +s.limits.decRatio.toFixed(2), turn: +s.limits.turnRatio.toFixed(2), accAt: s.limits.accAt, decAt: s.limits.decAt}] : []));
