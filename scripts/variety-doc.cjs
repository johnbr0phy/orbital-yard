#!/usr/bin/env node
/* Writes the measured tables into VARIETY.md between their markers, from
   bench/variety/<before>/summary.json and <after>/summary.json, the forge
   timing (bench/variety/forge-time.json) and the checks file
   (bench/variety/checks.json: tests, determinism, motion, cost, story, balance,
   filled in by hand from the named runs). No number is typed by hand here.

   node scripts/variety-doc.cjs [--before baseline] [--after final] */
const fs = require('node:fs'), path = require('node:path');
const L = require('./variety-lib.cjs');
const root = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const before = arg('before', 'baseline'), after = arg('after', 'final');
const read = f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch (e) { return null; } };
const B = read(`bench/variety/${before}/summary.json`), A = read(`bench/variety/${after}/summary.json`);
const FT = read('bench/variety/forge-time.json'), CK = read('bench/variety/checks.json') || {};
const T = L.T, pct = x => x == null ? '-' : (x * 100).toFixed(1) + '%', n2 = x => x == null ? '-' : (+x).toFixed(3);
const bands = s => s.fleets.filter(f => !f.unique).flatMap(f => Object.entries(f.bands).filter(([, b]) => b.n).map(([bn, b]) => ({f, bn, b})));
const worst = (xs, key, lo) => xs.slice().sort((p, q) => lo ? key(p) - key(q) : key(q) - key(p))[0];
const exempt = A.exemptions || {};
function row(id, crit, target, base, fin, ok) { return `| ${id} | ${crit} | ${target} | ${base} | ${fin} | ${ok ? '**PASS**' : '**FAIL**'} |`; }
const rows = [];
{ // 1 distinct shapes
  const f = s => bands(s).filter(x => x.b.shapes >= T.minShapes || exempt[x.f.race + '/' + x.bn]);
  const w = s => worst(bands(s), x => x.b.shapes, true);
  rows.push(row(1, 'Distinct shapes: effective silhouette clusters per fleet band', `>= ${T.minShapes} in every band (or a documented canon exception)`, `${f(B).length} of ${bands(B).length} bands; worst ${w(B).f.name} ${w(B).bn} ${w(B).b.shapes.toFixed(2)}`, `${f(A).length} of ${bands(A).length} bands; worst ${w(A).f.name} ${w(A).bn} ${w(A).b.shapes.toFixed(2)}`, f(A).length === bands(A).length));
}
{ // 2 dominant
  const f = s => bands(s).filter(x => x.b.dominant <= T.maxDominant), w = s => worst(bands(s), x => x.b.dominant);
  rows.push(row(2, "Dominant share: the largest silhouette cluster's share of a band", `<= ${pct(T.maxDominant)} in every band`, `${f(B).length} of ${bands(B).length}; worst ${w(B).f.name} ${w(B).bn} ${pct(w(B).b.dominant)}`, `${f(A).length} of ${bands(A).length}; worst ${w(A).f.name} ${w(A).bn} ${pct(w(A).b.dominant)}`, f(A).length === bands(A).length));
}
{ // 3 class separation
  const pairs = s => bands(s).filter(x => x.b.classSep.pairs.length), f = s => pairs(s).filter(x => x.b.classSep.min >= T.classSep), w = s => worst(pairs(s), x => x.b.classSep.min, true);
  const d = x => `${x.f.name} ${x.bn} ${x.b.classSep.pairs[0].a} v ${x.b.classSep.pairs[0].b} ${n2(x.b.classSep.min)}`;
  rows.push(row(3, 'Class separation: scale-normalised median distance between two classes in one band', `>= ${T.classSep} for every pair`, `${f(B).length} of ${pairs(B).length} bands; worst ${d(w(B))}`, `${f(A).length} of ${pairs(A).length} bands; worst ${d(w(A))}`, f(A).length === pairs(A).length));
}
{ // 4 sister spread
  const cls = s => s.fleets.filter(f => !f.unique).flatMap(f => Object.entries(f.sisters).filter(([, v]) => v.perBattle > 1).map(([k, v]) => ({f, k, v})));
  const ok = x => x.v.spread >= T.sisterFloor && x.v.spread <= T.sisterCeiling && x.v.spread < x.v.nearestD && !x.v.identical;
  const lo = s => worst(cls(s), x => x.v.spread, true), hi = s => worst(cls(s), x => x.v.spread);
  const ident = s => s.fleets.filter(f => !f.unique).reduce((t, f) => t + (f.identicalMeshes || []).length, 0);
  rows.push(row(4, 'Sister spread: median distance between sisters of a class; no identical meshes in a muster', `${T.sisterFloor}-${T.sisterCeiling}, below the distance to any other class; 0 identical`, `${cls(B).filter(ok).length} of ${cls(B).length} classes; lowest ${lo(B).k} ${n2(lo(B).v.spread)}; identical meshes ${ident(B)}`, `${cls(A).filter(ok).length} of ${cls(A).length} classes; range ${n2(lo(A).v.spread)}-${n2(hi(A).v.spread)}; identical meshes ${ident(A)}`, cls(A).every(ok) && !ident(A)));
}
{ // 5 recognition
  const r = s => s.recognition, fl = Object.entries(A.recognition.perFleet).filter(([k, a]) => { const b = B.recognition.perFleet[k], n = B.recognition.rows[k]; return a < b - T.recognitionSE * Math.sqrt(b * (1 - b) / n) - 1e-9; });
  rows.push(row(5, 'Fleet recognition from clay silhouettes (kNN, leave one war out, colour hidden)', `>= ${T.recognitionX}x chance; no fleet below its baseline (less 2 standard errors)`, `${pct(r(B).accuracy)} = ${r(B).xChance.toFixed(1)}x chance`, `${pct(r(A).accuracy)} = ${r(A).xChance.toFixed(1)}x chance; fleets below baseline: ${fl.length ? fl.map(([k]) => L.NAMES[k]).join(', ') : 'none'}`, r(A).xChance >= T.recognitionX && !fl.length));
}
{ // 6 band reach
  const caps = s => s.fleets.filter(f => !f.unique && f.bands.capital && f.bands.capital.n), f = s => caps(s).filter(x => x.bands.capital.reach >= T.bandReach), w = s => worst(caps(s), x => x.bands.capital.reach, true);
  rows.push(row(6, 'Band reach: capital-band jobs filled by a true capital-band hull', `>= ${pct(T.bandReach)} in every fleet`, `${f(B).length} of ${caps(B).length}; worst ${w(B).name} ${pct(w(B).bands.capital.reach)}`, `${f(A).length} of ${caps(A).length}; worst ${w(A).name} ${pct(w(A).bands.capital.reach)}`, f(A).length === caps(A).length));
}
for (const [id, key, crit, target] of [[7, 'reachability', 'Every listed class can appear (Sharlin, Jem\'Hadar shuttle, every pool entry)', 'dealt in its band in the pool test'], [8, 'heroes', 'Named heroes', 'byte-identical meshes (3 seeds each)']]) {
  const c = CK[key] || {}; rows.push(row(id, crit, target, c.base || '-', c.final || 'not yet run', !!c.ok));
}
{ // 9 cost
  const tris = s => Math.max(...s.fleets.filter(f => !f.unique).map(f => f.cost.studyMax));
  const um = A.fleets.filter(f => !f.unique).filter(f => { const b = B.fleets.find(x => x.race === f.race); return f.cost.uniqueMeshes > b.cost.uniqueMeshes * 1.1; });
  const ft = FT ? Object.values(FT.fleets).filter(x => x.ratio > 1.1) : null;
  const c = CK.render || {};
  rows.push(row('9a', 'Triangles per hull at study quality', '< 6,000 every hull', `max ${tris(B)}`, `max ${tris(A)}`, tris(A) < T.studyTris));
  rows.push(row('9b', 'Distant-hull groups (unique meshes) per fleet per battle', 'within 10% of main', 'per fleet, table below', um.length ? `over: ${um.map(f => f.name).join(', ')}` : 'every fleet within', !um.length));
  rows.push(row('9c', 'Forge time per hull (interleaved, one process)', 'within 10% of main, every fleet', FT ? 'per fleet, table below' : '-', FT ? (ft.length ? `over: ${ft.map(x => x.name + ' x' + x.ratio.toFixed(2)).join(', ')}` : `every fleet within; worst x${Math.max(...Object.values(FT.fleets).map(x => x.ratio)).toFixed(2)}`) : 'not yet run', !!FT && !ft.length));
  rows.push(row('9d', 'Per-frame cost at 600 a side (sim-bench, bench-tribute)', 'within 5% of main', c.base || '-', c.final || 'not yet run', !!c.ok));
}
for (const [id, key, crit, target] of [[10, 'tests', 'Every existing test plus the variety tests', '0 failures'], [11, 'determinism', 'Determinism (trace re-recorded; determinism-browser.cjs)', 'identical'], [12, 'motion', 'MOTION.md criteria that passed on main still pass', 'every one'], [13, 'balance', 'Fleet-balance winners', 'unchanged or explained'], [14, 'story', 'Story moments at BEHAVIOUR.md rates or better', 'as main or better']]) {
  const c = CK[key] || {}; rows.push(row(id, crit, target, c.base || '-', c.final || 'not yet run', !!c.ok));
}
const crit = `| # | criterion | target | baseline (main 471d650) | final (${A.meta.commit || after}) | result |\n|---|---|---|---|---|---|\n` + rows.join('\n');
const fleetRows = A.fleets.filter(f => !f.unique).map(f => {
  const b = B.fleets.find(x => x.race === f.race), cell = (x, y) => `${x.shapes.toFixed(1)} / ${pct(x.dominant)} → ${y.shapes.toFixed(1)} / ${pct(y.dominant)}`;
  const ft = FT && FT.fleets[f.race];
  return `| ${f.name} | ${cell(b.bands.small, f.bands.small)} | ${cell(b.bands.escort, f.bands.escort)} | ${cell(b.bands.capital, f.bands.capital)} | ${pct(b.bands.capital.reach)} → ${pct(f.bands.capital.reach)} | ${pct(B.recognition.perFleet[f.race])} → ${pct(A.recognition.perFleet[f.race])} | ${Object.keys(b.sisters).length} → ${Object.keys(f.sisters).length} | ${b.cost.uniqueMeshes} → ${f.cost.uniqueMeshes} | ${ft ? ft.main.toFixed(1) + ' → ' + ft.branch.toFixed(1) : '-'} |`;
});
const fleetTable = '| fleet | small: shapes / dominant | escort | capital | capital reach | recognised | classes | distant groups | forge ms/hull |\n|---|---|---|---|---|---|---|---|---|\n' + fleetRows.join('\n');
const file = path.join(root, 'VARIETY.md');
let md = fs.readFileSync(file, 'utf8');
const put = (tag, body) => { md = md.replace(new RegExp(`<!-- ${tag} -->[\\s\\S]*?<!-- /${tag} -->`), `<!-- ${tag} -->\n${body}\n<!-- /${tag} -->`); };
put('CRITERIA-TABLE', crit); put('FLEET-TABLE', fleetTable);
fs.writeFileSync(file, md);
console.log(crit.split('\n').filter(l => /FAIL/.test(l)).join('\n') || 'all rows PASS');
