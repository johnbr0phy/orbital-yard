#!/usr/bin/env node
/* Fleet variety report (VARIETY.md, VARIETY-BRIEF.md).

   node scripts/variety-report.cjs --label final [--root DIR] [--jobs 3] [--fleets 0,8,15] [--analyse-only]
       [--compare bench/variety/baseline/summary.json]

   Forge phase: for every fleet, the page deals two real 600-a-side musters
   (war seeds 101 and 202, the two folds) and every normal job of side 0 goes
   through the forge worker's own handler. Escort and capital bands are topped
   up to at least 40 hulls per fold from further wars (303, 404, ...) so a
   band a fleet musters thinly still has a sample; top-ups count for band
   statistics only, never for "in a muster" checks. The First Ones muster no
   normal hulls: their eight unique ancients are forged instead.

   Analysis phase reads bench/variety/<label>/hulls-*.json and writes
   summary.json with every VARIETY.md criterion per fleet and band. */
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync, spawn} = require('node:child_process');
const L = require('./variety-lib.cjs');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const ROOT = path.resolve(opt('root', path.join(__dirname, '..')));
const LABEL = opt('label', 'run');
const OUT = path.resolve(opt('out', path.join(__dirname, '../bench/variety', LABEL)));
const FLEETS = opt('fleets', null) ? opt('fleets').split(',').map(Number) : L.NAMES.map((_, i) => i);
const FOLDS = [101, 202];
const SIZE = 600, TOPUP = 40;

/* ---------------- thresholds (see VARIETY.md, "Why these thresholds") ---------------- */
const T = {
  cluster: 0.20,      // complete-linkage cut: hulls closer than this are one shape (half the closest reference class pair, 0.401)
  minShapes: 3,       // effective number of clusters, exp(Shannon entropy of cluster shares)
  maxDominant: 0.50,
  classSep: 0.20,     // scale-normalised median distance between two classes, same cut as a shape
  sisterFloor: 0.04,  // sisters are not clones (scale-only sisters measure 0.000-0.011)
  sisterCeiling: 0.25,// sisters still read as one class; and closer to each other than to any other class
  recognitionX: 5,    // x chance
  recognitionSE: 2,   // per-fleet floor: baseline minus two binomial standard errors of the baseline estimate
  bandReach: 0.95,
  studyTris: 6000,
};
/* The original fleets (Yard, Shoal, Lattice, Drift, Choir) forge one-off
   designs: the "-CLASS" name is drawn from the seed's digits, independently
   of the design, so two hulls sharing a name are not sisters. Their class for
   separation is the role type the page prints after the name. */
const ONE_OFF = r => r <= 4;

function forgeFleet(race) {
  const F = L.loadForge(ROOT);
  const hulls = [];
  const budget = F.wrun(`typeof VY_DISTANT_REPS==='undefined'?3:VY_DISTANT_REPS[${race}]`);
  const take = (job, fold, war, topup) => {
    const {out, ms, study} = F.forge(job);
    hulls.push({race, fold, war, topup: !!topup, budget, jobBand: job.band, hulls: job.hulls || 0,
      klass: out.meta.klass, key: L.classKey(race, out.meta.klass), length: out.meta.length, beam: out.meta.beam, height: out.meta.height,
      band: F.wrun(`fleetBandOf(${out.meta.length},${race})`), tris: out.mesh.tris, study, ms,
      seed: out.seed >>> 0, hash: L.meshHash(out.mesh), refit: out.meta.refit ? out.meta.refit.role || out.meta.refit.name || 1 : null,
      structure: out.meta.structure ? out.meta.structure.name || null : null, sig: L.pack(L.signature(out.mesh))});
  };
  FOLDS.forEach((war, fold) => {
    const jobs = F.muster(race, war, SIZE);
    const normal = jobs.filter(j => !j.hero && !j.hulls && j.band != null);
    if (race === 17) { for (const j of jobs.filter(j => j.hulls)) take(j, fold, war, false); return; }
    for (const j of normal) take(j, fold, war, false);
    for (const band of [1, 2]) {
      let have = normal.filter(j => j.band === band).length, w = war + 1000;
      while (have < TOPUP && w < war + 1000 + 40) {
        for (const j of F.muster(race, w, SIZE).filter(j => !j.hero && !j.hulls && j.band === band)) { if (have >= TOPUP) break; take(j, fold, w, true); have++; }
        w++;
      }
    }
  });
  return hulls;
}

/* ---------------- analysis ---------------- */
function analyse(all) {
  const sigOf = new Map(); for (const h of all) sigOf.set(h, L.unpack(h.sig));
  const fleets = [];
  const allowNormal = h => h.race !== 17;
  for (const race of FLEETS) {
    const hs = all.filter(h => h.race === race);
    if (!hs.length) continue;
    const row = {race, name: L.NAMES[race], hulls: hs.length, bands: {}, classes: {}, sisters: {}};
    if (race === 17) {
      // eight unique ancients: class separation only (the reference set)
      const byKey = groupBy(hs.filter(h => h.fold === 0), h => h.key);
      row.unique = true; row.classSep = classSeparation(byKey, sigOf);
      fleets.push(row); continue;
    }
    for (let band = 0; band < 3; band++) {
      const bh = hs.filter(h => h.jobBand === band);
      if (!bh.length) { row.bands[L.BANDS[band]] = {n: 0}; continue; }
      const shares = L.clusters(bh.map(h => sigOf.get(h)), T.cluster).map(m => m.length / bh.length).sort((a, b) => b - a);
      const effective = Math.exp(-shares.reduce((s, p) => s + p * Math.log(p), 0));
      const byKey = groupBy(bh, h => h.key);
      const muster = bh.filter(h => !h.topup);
      const musterShare = muster.length / hs.filter(h => !h.topup).length;
      row.bands[L.BANDS[band]] = {
        n: bh.length, musterShare,
        shapes: effective, clusters: shares.length, over5: shares.filter(p => p >= .05).length,
        dominant: shares[0], topShares: shares.slice(0, 5),
        classes: Object.fromEntries(Object.entries(byKey).map(([k, v]) => [k, v.length / bh.length])),
        classSep: classSeparation(byKey, sigOf),
        reach: band === 2 ? bh.filter(h => h.band === 2).length / bh.length : null,
        fallback: band === 2 ? Object.entries(groupBy(bh.filter(h => h.band !== 2), h => h.key)).map(([k, v]) => k + ' x' + v.length) : null,
      };
    }
    // sister spread per class (whole muster, fold 0 and 1 separately, median of pairs within a fold)
    const byKey = groupBy(hs, h => h.key);
    const dupAll = []; for (const fold of [0, 1]) { const seen = new Map(); for (const h of hs.filter(h => h.fold === fold && !h.topup)) { if (seen.has(h.hash)) dupAll.push(h.key + ' ' + h.seed + '=' + seen.get(h.hash)); else seen.set(h.hash, h.seed); } }
    row.identicalMeshes = dupAll;
    const keys = Object.keys(byKey);
    const nearestOther = k => { let best = Infinity, who = null; const A = byKey[k].filter(h => !h.topup).slice(0, 25); for (const o of keys) if (o !== k) { const B = byKey[o].slice(0, 25), ds = []; for (const x of A) for (const y of B) ds.push(L.distance(sigOf.get(x), sigOf.get(y))); const m = L.median(ds); if (m < best) { best = m; who = o; } } return {d: best, who}; };
    for (const [k, v] of Object.entries(ONE_OFF(race) ? {} : byKey)) {
      const perBattle = v.filter(h => !h.topup && h.fold === 0).length;
      const ds = [];
      for (const fold of [0, 1]) { const f = v.filter(h => h.fold === fold).slice(0, 80); for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) ds.push(L.distance(sigOf.get(f[i]), sigOf.get(f[j]))); }
      const dup = []; for (const fold of [0, 1]) { const seen = new Map(); for (const h of v.filter(h => h.fold === fold && !h.topup)) { if (seen.has(h.hash)) dup.push(h.seed + '=' + seen.get(h.hash)); else seen.set(h.hash, h.seed); } }
      const near = nearestOther(k);
      row.sisters[k] = {n: v.length, perBattle, spread: L.median(ds), p90: L.quantile(ds, .9), identical: dup.length, nearest: near.who, nearestD: near.d,
        length: [Math.min(...v.map(h => h.length)), Math.max(...v.map(h => h.length))],
        bands: [...new Set(v.map(h => h.band))].sort()};
    }
    const mus = hs.filter(h => !h.topup);
    row.cost = {
      studyMax: Math.max(...hs.map(h => h.study)), studyMean: mean(hs.map(h => h.study)), battleMean: mean(hs.map(h => h.tris)),
      forgeMs: L.median(hs.map(h => h.ms)),
      // distant-hull groups: race|klass|seed%3, one per battle (fold 0), plus crowns and hero
      uniqueMeshes: distantGroups(mus.filter(h => h.fold === 0)),
    };
    fleets.push(row);
  }
  const recognition = recognise(all.filter(h => allowNormal(h) && !h.topup), sigOf);
  return {thresholds: T, fleets, recognition, reference: reference(fleets)};
}
/* The page's registerDistantHull rule: one group per class and seed modulo
   the fleet's representatives per class (VY_DISTANT_REPS; 3 on main).
   Crowns and the hero count as four more. */
function distantGroups(hs) {
  const reps = hs.length && hs[0].budget || 3;
  return new Set(hs.map(h => h.klass + '|' + (h.seed % reps))).size + 4;
}
function classSeparation(byKey, sigOf) {
  const keys = Object.keys(byKey).sort(), pairs = [];
  for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
    const A = byKey[keys[a]].slice(0, 30), B = byKey[keys[b]].slice(0, 30), ds = [];
    for (const x of A) for (const y of B) ds.push(L.distance(sigOf.get(x), sigOf.get(y)));
    pairs.push({a: keys[a], b: keys[b], d: L.median(ds)});
  }
  pairs.sort((p, q) => p.d - q.d);
  return {min: pairs.length ? pairs[0].d : null, pairs};
}
/* Fleet from silhouette alone: k-nearest neighbours (k=7, IoU distance)
   trained on one war's hulls and scored on the other war's (two folds).
   Every fleet's test rows are weighted equally, so chance is 1/fleets. */
function recognise(hs, sigOf) {
  const races = [...new Set(hs.map(h => h.race))].sort((a, b) => a - b);
  const per = Object.fromEntries(races.map(r => [r, {hit: 0, n: 0}]));
  const CAP = 150; // rows per fleet per fold, spread evenly over its muster
  const sample = fold => races.flatMap(r => { const v = hs.filter(h => h.race === r && h.fold === fold); const k = Math.max(1, v.length / CAP); const o = []; for (let i = 0; i < v.length && o.length < CAP; i += k) o.push(v[Math.floor(i)]); return o; });
  for (const [train, test] of [[0, 1], [1, 0]]) {
    const tr = sample(train), te = sample(test);
    for (const q of te) {
      const sq = sigOf.get(q);
      const nb = tr.map(h => [L.distance(sq, sigOf.get(h)), h.race]).sort((a, b) => a[0] - b[0]).slice(0, 7);
      const vote = {}; nb.forEach(([d, r], i) => { vote[r] = (vote[r] || 0) + 1 / (1 + i); });
      const guess = +Object.entries(vote).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
      per[q.race].n++; if (guess === q.race) per[q.race].hit++;
    }
  }
  const acc = Object.fromEntries(races.map(r => [r, per[r].hit / per[r].n]));
  const macro = mean(Object.values(acc));
  return {fleets: races.length, chance: 1 / races.length, accuracy: macro, xChance: macro * races.length, perFleet: acc, rows: Object.fromEntries(races.map(r => [r, per[r].n]))};
}
/* The reference fleets for thresholds: every class pair in Yard bands and
   among the First Ones, and sister spread of the seeded-variant classes. */
function reference(fleets) {
  const out = {};
  const yard = fleets.find(f => f.race === 0), fo = fleets.find(f => f.race === 17);
  if (yard) out.yardClassPairs = Object.values(yard.bands).flatMap(b => b.classSep ? b.classSep.pairs.map(p => p.d) : []);
  if (fo) out.firstOnesClassPairs = fo.classSep.pairs.map(p => p.d);
  const all = [...(out.yardClassPairs || []), ...(out.firstOnesClassPairs || [])];
  out.referencePairs = {n: all.length, min: Math.min(...all), p05: L.quantile(all, .05), p10: L.quantile(all, .10), median: L.median(all)};
  return out;
}
const groupBy = (xs, f) => { const o = {}; for (const x of xs) (o[f(x)] = o[f(x)] || []).push(x); return o; };
const mean = xs => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/* ---------------- criteria ---------------- */
function verdict(sum, base) {
  const rows = [];
  const fail = [];
  const push = (id, ok, detail) => { rows.push({id, ok, detail}); if (!ok) fail.push(id); };
  const exempt = sum.exemptions || {};
  // 1 distinct shapes, 2 dominant share
  for (const f of sum.fleets) if (!f.unique) for (const [bn, b] of Object.entries(f.bands)) if (b.n) {
    const ex = exempt[f.race + '/' + bn];
    push(`shapes ${f.name}/${bn}`, b.shapes >= T.minShapes || !!ex, `${b.shapes} shapes${ex ? ' (exempt: ' + ex + ')' : ''}`);
    push(`dominant ${f.name}/${bn}`, b.dominant <= T.maxDominant, `${(b.dominant * 100).toFixed(1)}%`);
    if (b.classSep.pairs.length) push(`classSep ${f.name}/${bn}`, b.classSep.min >= T.classSep, `min ${b.classSep.min.toFixed(3)} ${b.classSep.pairs[0].a} v ${b.classSep.pairs[0].b}`);
    if (bn === 'capital') push(`reach ${f.name}`, b.reach >= T.bandReach, `${(b.reach * 100).toFixed(1)}%`);
  }
  for (const f of sum.fleets) if (!f.unique) for (const [k, s] of Object.entries(f.sisters)) if (s.perBattle > 1) {
    push(`sisters ${f.name}/${k}`, s.spread >= T.sisterFloor && s.spread <= T.sisterCeiling && s.spread < s.nearestD && s.identical === 0, `spread ${s.spread.toFixed(3)}, nearest other class ${s.nearest} ${s.nearestD.toFixed(3)}, identical ${s.identical}`);
  }
  for (const f of sum.fleets) if (!f.unique) push(`identical ${f.name}`, !f.identicalMeshes.length, `${f.identicalMeshes.length} identical hull meshes in one muster ${f.identicalMeshes.slice(0, 3).join(', ')}`);
  const rec = sum.recognition;
  push('recognition overall', rec.xChance >= T.recognitionX, `${(rec.accuracy * 100).toFixed(1)}% = ${rec.xChance.toFixed(2)}x chance`);
  if (base) for (const [r, a] of Object.entries(rec.perFleet)) { const b = base.recognition.perFleet[r], n = base.recognition.rows[r]; if (b != null) { const floor = b - T.recognitionSE * Math.sqrt(b * (1 - b) / n); push(`recognition ${L.NAMES[r]}`, a >= floor - 1e-9, `${(a * 100).toFixed(1)}% (baseline ${(b * 100).toFixed(1)}%, floor ${(floor * 100).toFixed(1)}%)`); } }
  for (const f of sum.fleets) if (!f.unique) {
    push(`tris ${f.name}`, f.cost.studyMax < T.studyTris, `max ${f.cost.studyMax}`);
    if (base) { const b = base.fleets.find(x => x.race === f.race); if (b) {
      push(`uniqueMeshes ${f.name}`, f.cost.uniqueMeshes <= b.cost.uniqueMeshes * 1.10, `${f.cost.uniqueMeshes} (baseline ${b.cost.uniqueMeshes})`);
      push(`forgeMs ${f.name}`, f.cost.forgeMs <= b.cost.forgeMs * 1.10, `${f.cost.forgeMs.toFixed(1)} (baseline ${b.cost.forgeMs.toFixed(1)})`);
    } }
  }
  return {rows, fail};
}

async function main() {
  fs.mkdirSync(OUT, {recursive: true});
  if (flag('worker')) { const race = +opt('race'); fs.writeFileSync(path.join(OUT, `hulls-${race}.json`), JSON.stringify(forgeFleet(race))); return; }
  if (!flag('analyse-only')) {
    const todo = FLEETS.filter(r => flag('force') || !fs.existsSync(path.join(OUT, `hulls-${r}.json`)));
    const jobs = +opt('jobs', 3); let next = 0;
    await Promise.all(Array.from({length: jobs}, async () => {
      while (next < todo.length) {
        const race = todo[next++], t0 = Date.now();
        await new Promise((res, rej) => { const p = spawn(process.execPath, [__filename, '--worker', '--race', race, '--root', ROOT, '--out', OUT], {stdio: 'inherit'}); p.on('exit', c => c ? rej(new Error('fleet ' + race + ' exit ' + c)) : res()); });
        console.log(`forged ${L.NAMES[race]} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      }
    }));
  }
  const all = FLEETS.flatMap(r => { const f = path.join(OUT, `hulls-${r}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; });
  const sum = analyse(all);
  const exf = path.join(__dirname, 'variety-exemptions.json');
  sum.exemptions = fs.existsSync(exf) ? JSON.parse(fs.readFileSync(exf, 'utf8')) : {};
  const base = opt('compare') ? JSON.parse(fs.readFileSync(opt('compare'), 'utf8')) : null;
  sum.verdict = verdict(sum, base);
  sum.meta = {label: LABEL, root: ROOT, commit: (() => { try { return execFileSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD']).toString().trim(); } catch (e) { return null; } })(), folds: FOLDS, size: SIZE, hulls: all.length};
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(sum, null, 1));
  print(sum);
}
function print(sum) {
  const pc = x => x == null ? '-' : (x * 100).toFixed(0) + '%';
  console.log(`\n${sum.meta.hulls} hulls, commit ${sum.meta.commit}`);
  console.log('fleet'.padEnd(14) + ['small', 'escort', 'capital'].map(b => b.padEnd(34)).join('') + 'reach  studyMax forgeMs uniq');
  for (const f of sum.fleets) {
    if (f.unique) { console.log(f.name.padEnd(14) + `unique ancients; min class sep ${f.classSep.min.toFixed(3)}`); continue; }
    const cells = ['small', 'escort', 'capital'].map(b => { const x = f.bands[b]; return (x && x.n ? `n${x.n} s${x.shapes.toFixed(1)} dom${pc(x.dominant)} sep${x.classSep.min == null ? '-' : x.classSep.min.toFixed(2)}` : '-').padEnd(34); });
    console.log(f.name.padEnd(14) + cells.join('') + pc(f.bands.capital && f.bands.capital.reach).padEnd(7) + String(f.cost.studyMax).padEnd(9) + f.cost.forgeMs.toFixed(0).padEnd(8) + f.cost.uniqueMeshes);
  }
  console.log(`recognition ${pc(sum.recognition.accuracy)} (${sum.recognition.xChance.toFixed(2)}x chance of ${pc(sum.recognition.chance)}): ` + Object.entries(sum.recognition.perFleet).map(([r, a]) => L.NAMES[r] + ' ' + pc(a)).join(', '));
  console.log('reference class pairs (Yard + First Ones):', JSON.stringify(sum.reference.referencePairs));
  console.log(`\nverdict: ${sum.verdict.rows.length - sum.verdict.fail.length} pass, ${sum.verdict.fail.length} fail`);
  for (const r of sum.verdict.rows.filter(r => !r.ok)) console.log('  FAIL ' + r.id + ': ' + r.detail);
}
main().catch(e => { console.error(e); process.exit(1); });
