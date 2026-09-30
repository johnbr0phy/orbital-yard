#!/usr/bin/env node
/* The band pool table of UNIQUENESS-NEW.md, read from the page's own pool
   tables (the ones the pool-reachability test reads), with the reason for
   each pool from scripts/variety-pool-reasons.json. Writes it between the
   POOL-TABLE markers of UNIQUENESS-NEW.md.

   node scripts/variety-pools.cjs */
const fs = require('node:fs'), path = require('node:path');
const L = require('./variety-lib.cjs');
const root = path.resolve(__dirname, '..');
const F = L.loadForge(root, {fast: true});
const reasons = JSON.parse(fs.readFileSync(path.join(__dirname, 'variety-pool-reasons.json'), 'utf8'));
const BAND = ['small', 'escort', 'capital'];
const title = s => s.toLowerCase().replace(/(^|[\s\-/(])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/'([A-Z])/g, (m, a) => "'" + a.toLowerCase());
const NAMED = [[5, 'IMP_POOLS'], [8, 'SHD_POOLS'], [9, 'EF_POOLS'], [10, 'FED_POOLS'], [11, 'KLI_POOLS'], [12, 'BORG_POOLS'], [13, 'MO_POOLS'], [14, 'UM_POOLS'], [15, 'EN_POOLS'], [16, 'YJ_POOLS']];
const rows = [];
const put = (race, band, list) => {
  const tot = list.reduce((t, [, w]) => t + w, 0);
  const name = L.NAMES[race], why = reasons[`${name}|${BAND[band]}`] || '';
  rows.push({race, band, line: `| ${name} | ${BAND[band]} | ${list.map(([k, w]) => `${title(k)} ${Math.round(w / tot * 100)}%`).join(', ')} | ${why} |`});
};
for (const [race, table] of NAMED) F.wrun(table).forEach((list, band) => put(race, band, list.map(([kind, w]) => [F.wrun(`raceBuild(${race},1234,0,false,${JSON.stringify(kind)}).meta.klass`).replace(/\s*\((CARGO|BATTLE|SCIENCE|COMMAND)[^)]*REFIT\)\s*$/, ''), w])));
F.wrun('MIN_POOLS').forEach((list, band) => put(7, band, list.map(([type, w]) => [F.wrun(`buildMinbariClass(1234,${type}).meta.klass`), w])));
for (const [race, pools] of Object.entries(F.wrun('EXTRA_BAND_POOLS'))) pools.forEach((list, band) => put(+race, band, list.map(([type, w]) => [F.wrun(`EXTRA_CLASSES[${race - 18}][${type}]`), w])));
rows.sort((a, b) => a.race - b.race || a.band - b.band);
const table = '| fleet | band | pool (share of the band\'s jobs) | why |\n|---|---|---|---|\n' + rows.map(r => r.line).join('\n');
const file = path.join(root, 'UNIQUENESS-NEW.md');
let md = fs.readFileSync(file, 'utf8');
if (!/<!-- POOL-TABLE -->/.test(md)) throw new Error('UNIQUENESS-NEW.md has no POOL-TABLE markers');
md = md.replace(/<!-- POOL-TABLE -->[\s\S]*?<!-- \/POOL-TABLE -->/, `<!-- POOL-TABLE -->\n${table}\n<!-- /POOL-TABLE -->`);
fs.writeFileSync(file, md);
console.log(table);
