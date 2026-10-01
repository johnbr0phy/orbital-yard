#!/usr/bin/env node
/* Role lock (VARIETY-BRIEF.md): every class declares its flight role and a
   length range. The ship minds read length, not shape: the muster band cuts,
   gunboat (80 m), fighter attack runs (under 120 m), spool steps (60 m and
   180 m), Shadow crowns (180 m) and capitals (300 m). This script writes the
   declarations from a full variety run (both musters of every fleet), widens
   each range by 3% for sampling, and never lets the widening carry a range
   across a threshold its hulls did not already cross.

   node scripts/variety-roles.cjs --from bench/variety/final
   -> tests/tribute-new/variety-roles.json and the ROLE-TABLE in UNIQUENESS-NEW.md */
const fs = require('node:fs');
const path = require('node:path');
const L = require('./variety-lib.cjs');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FROM = path.resolve(opt('from', path.join(__dirname, '../bench/variety/final')));

function thresholds(race) {
  const small = race === 19 ? 150 : 42, escort = race === 7 ? 650 : race >= 18 && race <= 21 ? 300 : 95;
  return [...new Set([small, 60, 80, escort, 120, 180, 300])].sort((a, b) => a - b);
}
function role(race, lo, hi) {
  const t = [];
  if (hi <= (race === 19 ? 150 : 42)) t.push('screen');
  if (hi >= 80 && race !== 8) t.push('gunboat');
  if (hi < 120) t.push('attack runs');
  if (hi >= 300 || (race === 8 && hi > 180)) t.push('capital');
  return t.join(', ') || 'escort';
}
const classes = {};
for (let race = 0; race < 23; race++) {
  const f = path.join(FROM, `hulls-${race}.json`); if (!fs.existsSync(f)) continue;
  const hs = JSON.parse(fs.readFileSync(f, 'utf8')).filter(h => !h.recogOnly);
  const by = {}; for (const h of hs) (by[h.key] = by[h.key] || []).push(h.length);
  for (const [key, ls] of Object.entries(by)) {
    const lo0 = Math.min(...ls), hi0 = Math.max(...ls), T = thresholds(race);
    let lo = lo0 * 0.97, hi = hi0 * 1.03;
    for (const t of T) { if (lo0 >= t && lo < t) lo = t; if (hi0 < t && hi >= t) hi = t - 0.01; }
    classes[race + '|' + key] = {fleet: L.NAMES[race], role: role(race, lo, hi), range: [+lo.toFixed(2), +hi.toFixed(2)], crosses: T.filter(t => lo < t && hi >= t), n: ls.length};
  }
}
const out = path.join(__dirname, '../tests/tribute-new/variety-roles.json');
const prev = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
fs.writeFileSync(out, JSON.stringify({...prev, classes}, null, 1));
console.log(`${Object.keys(classes).length} classes -> ${out}`);
// Markdown table for UNIQUENESS-NEW.md
const rows = Object.entries(classes).filter(([k]) => +k.split('|')[0] > 4).map(([k, d]) => `| ${d.fleet} | ${k.split('|')[1]} | ${d.role} | ${d.range[0].toFixed(0)}-${d.range[1].toFixed(0)} m | ${d.crosses.join(', ') || 'none'} |`);
fs.writeFileSync(path.join(FROM, 'roles-table.md'), '| Fleet | Class | Role | Length range | Thresholds crossed |\n| --- | --- | --- | --- | --- |\n' + rows.join('\n') + '\n');
{
  const table = '| Fleet | Class | Role | Length range | Thresholds crossed |\n| --- | --- | --- | --- | --- |\n' + rows.join('\n');
  const file = path.join(__dirname, '../UNIQUENESS-NEW.md');
  const md = fs.readFileSync(file, 'utf8');
  if (/<!-- ROLE-TABLE -->/.test(md)) fs.writeFileSync(file, md.replace(/<!-- ROLE-TABLE -->[\s\S]*?<!-- \/ROLE-TABLE -->/, `<!-- ROLE-TABLE -->\n${table}\n<!-- /ROLE-TABLE -->`));
}
