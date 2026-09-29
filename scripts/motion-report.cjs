#!/usr/bin/env node
/* Motion report for the Tribute War. Headless and CPU only (no rendering).

   Runs the real page simulation (tests/tribute-new/headless-battle.cjs),
   records every ship's position, velocity, heading, attitude, throttle,
   AI mode and reason, and squadron at every 1/30 s step, and measures how
   the ships fly: reversals, shuttling, jerk, spinning in place, speed holds,
   turn physics, capital limits, squadron cohesion, squadmate individuality
   and whether a classifier can tell the fleets apart from motion alone.

   Usage:
     node scripts/motion-report.cjs --label baseline [--only 01,03] [--scenes] [--sweep] [--jobs 4]
                                    [--compare bench/motion/baseline/summary.json]
   With neither --scenes nor --sweep, runs both (the full set).
   Writes bench/motion/<label>/runs/<id>.json (per run), logs/<id>.json.gz
   (10 Hz tracks of each scene, for plots and the watch page) and
   summary.json + summary.md (criteria with PASS / FAIL).

   Worker mode (internal): --worker <id> --label <label>. */
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), os = require('node:os');
const {spawn} = require('node:child_process');
const M = require('./motion-lib.cjs');
const SC = require('./motion-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes('--' + k);
const root = path.resolve(__dirname, '..');

function specs() { return [...SC.scenes, ...SC.sweep()]; }

/* ------------------------------- one run -------------------------------- */
function runOne(spec, outDir) {
  const {loadBattle} = require('../tests/tribute-new/headless-battle.cjs');
  const b = loadBattle({cores: 1, modules: true});
  if (spec.force) b.run(`storyForce=${JSON.stringify(spec.force)}`);
  const t0 = Date.now();
  b.start(spec.matchup[0], spec.matchup[1], spec.seed, spec.size);
  const steps = Math.ceil(spec.seconds * 30) + 2;
  b.run(`globalThis.__mo=(${M.installMotionRecorder.toString()})(${JSON.stringify({F: M.F, cap: steps, modes: M.MODES, flag: M.FLAG})});
    globalThis.__scene={};globalThis.__focus=[];globalThis.__picked=false;globalThis.__script=${JSON.stringify(spec.script || [])};
    globalThis.__stepOnce=function(){
      battleTime+=1/30;simStep(battleTime,1/30);introStep(battleTime,1/30);
      const T=battleTime-warT0;
      if(!__picked&&T>=${spec.pick || 0}){__picked=true;try{__focus=${spec.focus || '[]'};}catch(e){__focus=[];}}
      for(const s of __script)if(!s.done&&T>=s.t){s.done=true;(0,eval)(s.code);}
      __mo.sample();
      return T;
    };`);
  let T = b.run('battleTime-warT0');
  while (T < spec.seconds) { T = b.run('__stepOnce()'); b.flush(); }
  const rec = b.run('__mo');
  const focus = b.run('__focus.slice()');
  const events = b.run('(bc&&bc.log?bc.log.events:[]).filter(e=>e.type!=="kill").map(e=>({type:e.type,t:+(e.t-warT0).toFixed(2),side:e.side,ship:e.ship}))');
  const simMs = Date.now() - t0;
  const A = M.analyse(rec);
  const groups = M.groupStats(A.ships);
  const reason = k => rec.reasonList[k] || '';
  const shipOut = A.ships.map(s => {
    const S = A.series[s.id], at = k => ({t: +rec.t[k].toFixed(2), x: Math.round(S.get(k, 0)), y: Math.round(S.get(k, 1)), z: Math.round(S.get(k, 2)), mode: M.MODES[S.get(k, 12)], reason: reason(S.get(k, 13))});
    return {id: s.id, side: s.side, race: s.race, cls: s.cls, slen: Math.round(s.slen), squad: s.squad, seconds: +s.seconds.toFixed(1),
      reversals: s.reversals.map(r => ({...at(r.k), span: +r.span.toFixed(2)})), reversalsStrict: s.reversalsStrict ? s.reversalsStrict.map(r => ({...at(r.k), span: +r.span.toFixed(2)})) : null,
      secondsStrict: +s.secondsStrict.toFixed(1), shuttle: {share: +s.shuttleWorst.share.toFixed(3), ...(s.shuttleWorst.k >= 0 ? at(s.shuttleWorst.k) : {})},
      spins: s.spins.map(x => ({...at(x.k), seconds: +x.seconds.toFixed(2)})), hold: {held: +s.hold.held.toFixed(1), flying: +s.hold.flying.toFixed(1)}, limits: s.limits};
  });
  const out = {spec: {...spec, script: undefined, focus: undefined}, steps: rec.n, simMs, focus, events, groups, ships: shipOut,
    cohesion: A.cohesion, individuality: A.individuality, features: A.features.map(r => ({...r, f: r.f.map(x => +x.toPrecision(5))}))};
  fs.mkdirSync(path.join(outDir, 'runs'), {recursive: true});
  fs.writeFileSync(path.join(outDir, 'runs', spec.id + '.json'), JSON.stringify(out));
  if (!spec.sweep) {
    const every = spec.heavy ? 6 : 3;
    const log = M.compactLog(rec, every);
    log.id = spec.id; log.name = spec.name; log.focus = focus; log.events = events; log.reasons = rec.reasonList;
    log.squads = [...A.squadFrames.entries()].map(([id, fr]) => ({id, c: fr.filter((_, k) => k % every === 0).map(c => c ? [Math.round(c.x), Math.round(c.z), +c.h.toFixed(3), c.n] : null)}));
    fs.mkdirSync(path.join(outDir, 'logs'), {recursive: true});
    fs.writeFileSync(path.join(outDir, 'logs', spec.id + '.json.gz'), zlib.gzipSync(JSON.stringify(log)));
  }
  return out;
}

/* ------------------------------- criteria ------------------------------- */
const SMALL_MID = ['fighter', 'light', 'mid', 'frigate', 'hero'];
function criteria(final, runs, cls, base) {
  const rows = [];
  const fleetClass = Object.entries(final).filter(([k]) => /^fleet:\d+:/.test(k)).map(([k, v]) => ({race: +k.split(':')[1], cls: k.split(':')[2], ...v}));
  const name = r => SC.FLEETS[r];
  // 1a. gunboats and capitals: no reversals at all outside ion evasion, contact and rams.
  const big = fleetClass.filter(g => ['frigate', 'capital', 'leviathan'].includes(g.cls) && g.strictMinutes > 0);
  const badA = big.filter(g => g.strictReversals > 0);
  rows.push({id: 'reversals-big', text: 'Reversals, gunboats and capitals (every fleet), per ship-minute', target: '0',
    value: `${big.reduce((t, g) => t + g.strictReversals, 0)} in ${big.reduce((t, g) => t + g.strictMinutes, 0).toFixed(0)} ship-min; worst ${badA.length ? badA.sort((a, b) => b.strictPerMin - a.strictPerMin).slice(0, 3).map(g => `${name(g.race)} ${g.cls} ${g.strictPerMin.toFixed(3)}`).join(', ') : 'none'}`,
    pass: badA.length === 0});
  // 1b. every class in every fleet under 0.2.
  const badB = fleetClass.filter(g => g.minutes > 0 && g.perMin >= .2);
  const worstB = fleetClass.filter(g => g.minutes > 0).sort((a, b) => b.perMin - a.perMin)[0];
  rows.push({id: 'reversals-all', text: 'Reversals, any class in any fleet, per ship-minute', target: '< 0.2',
    value: `worst ${worstB ? `${name(worstB.race)} ${worstB.cls} ${worstB.perMin.toFixed(3)}` : '-'}; overall ${final.all.perMin.toFixed(3)}${badB.length ? `; ${badB.length} fleet-classes at or over 0.2` : ''}`, pass: badB.length === 0});
  // 2. shuttling.
  rows.push({id: 'shuttle', text: 'Shuttle: worst share of any 10 s window, any ship', target: '<= 5%', value: `${(final.all.shuttleMax * 100).toFixed(1)}%; ${final.all.shuttleShips} ships over 5%`, pass: final.all.shuttleMax <= .05});
  // 3. jerk.
  const classes = Object.keys(final).filter(k => k.startsWith('class:')).map(k => k.slice(6));
  if (base) {
    const worse = [], lines = [];
    for (const c of classes) {
      const now = final['class:' + c].angJerk.p95, was = base['class:' + c] && base['class:' + c].angJerk.p95;
      if (!Number.isFinite(was)) continue;
      lines.push(`${c} ${was.toFixed(2)} -> ${now.toFixed(2)}`);
      if (now > was * 1.0001) worse.push(c);
    }
    const fw = base['class:frigate'] && base['class:frigate'].angJerk.p95, fn = final['class:frigate'] && final['class:frigate'].angJerk.p95;
    rows.push({id: 'jerk', text: 'p95 angular jerk per class (rad/s^3), at or below baseline', target: '<= baseline', value: lines.join('; '), pass: !worse.length});
    rows.push({id: 'jerk-frigate', text: 'p95 angular jerk, frigates', target: '<= 50% of baseline', value: `${fw.toFixed(2)} -> ${fn.toFixed(2)} (${(fn / fw * 100).toFixed(0)}%)`, pass: fn <= fw * .5});
  } else {
    rows.push({id: 'jerk', text: 'p95 angular jerk per class (rad/s^3)', target: 'baseline', value: classes.map(c => `${c} ${final['class:' + c].angJerk.p95.toFixed(2)}`).join('; '), pass: null});
  }
  // 4. spin.
  rows.push({id: 'spin', text: 'Spinning in place, hulls of 80 m or longer (events)', target: '0', value: `${final.all.spinsBig} (${final.all.spinSecondsBig.toFixed(1)} s)`, pass: final.all.spinsBig === 0});
  // 5. speed holds.
  const holds = SMALL_MID.filter(c => final['class:' + c]).map(c => [c, final['class:' + c].holdShare]);
  rows.push({id: 'holds', text: 'Speed holds of 5 s or more, small and mid-size craft', target: '<= 10%', value: holds.map(([c, v]) => `${c} ${(v * 100).toFixed(1)}%`).join('; '), pass: holds.every(([, v]) => v <= .10)});
  // 6. capital limits.
  const cap = ['capital', 'leviathan'].map(c => final['class:' + c]).filter(Boolean);
  const tr = Math.max(...cap.map(g => g.turnRatioMax || 0)), ar = Math.max(...cap.map(g => g.accRatioMax || 0)), dr = Math.max(...cap.map(g => g.decRatioMax || 0));
  const capRev = cap.reduce((t, g) => t + g.strictReversals, 0);
  rows.push({id: 'capital-limits', text: 'Capitals: max turn rate, acceleration and braking against the hull\'s limits; reversals', target: '<= 1.05x each; 0 reversals',
    value: `turn ${tr.toFixed(2)}x, accel ${ar.toFixed(2)}x, brake ${dr.toFixed(2)}x; ${capRev} reversals`, pass: tr <= 1.05 && ar <= 1.05 && dr <= 1.05 && capRev === 0});
  // 7. cohesion.
  let sec = 0, inb = 0; const perFleet = {};
  for (const r of runs) for (const q of r.cohesion.perSquad) { sec += q.seconds; inb += q.inBand; const f = perFleet[q.race] || (perFleet[q.race] = {sec: 0, inb: 0, par: 0, dis: 0}); f.sec += q.seconds; f.inb += q.inBand; f.par += q.parade; f.dis += q.dissolved; }
  const fleetsCoh = Object.entries(perFleet).filter(([, f]) => f.sec >= 60).map(([r, f]) => [+r, f.inb / f.sec, f]);
  const worstC = fleetsCoh.sort((a, b) => a[1] - b[1])[0];
  rows.push({id: 'cohesion', text: 'Squadron cohesion inside the band, share of squad-time outside dogfights and routs', target: '>= 80% overall and in every fleet',
    value: `${(inb / Math.max(1, sec) * 100).toFixed(1)}% overall; worst ${worstC ? `${name(worstC[0])} ${(worstC[1] * 100).toFixed(1)}% (parade ${(worstC[2].par / worstC[2].sec * 100).toFixed(0)}%, dissolved ${(worstC[2].dis / worstC[2].sec * 100).toFixed(0)}%)` : '-'}`,
    pass: sec > 0 && inb / sec >= .8 && fleetsCoh.every(([, v]) => v >= .8)});
  // 8. individuality.
  const IND = .25;
  const sq = runs.flatMap(r => r.individuality);
  const minInd = sq.length ? Math.min(...sq.map(x => x.min)) : NaN, below = sq.filter(x => x.min < IND).length;
  rows.push({id: 'individuality', text: `Squadmates' motion signatures: smallest pairwise distance in any squad (feature sd units)`, target: `>= ${IND} in every squad`,
    value: `min ${minInd.toFixed(3)}, median squad min ${M.q(sq.map(x => x.min), .5).toFixed(3)}; ${below} of ${sq.length} squads below`, pass: sq.length > 0 && below === 0});
  // 9. fleet signature.
  if (cls) {
    const ok3 = cls.accuracy >= 3 * cls.chance;
    const okBase = !base || !base.__classifier || (cls.accuracy >= base.__classifier.accuracy + .15 && cls.accuracy >= base.__classifier.accuracy * 1.5);
    rows.push({id: 'signature', text: 'Fleet from motion alone: held-out accuracy (per-class models, ship identity hidden)', target: '>= 3x chance and >= baseline +15 points and 1.5x baseline',
      value: `${(cls.accuracy * 100).toFixed(1)}% vs chance ${(cls.chance * 100).toFixed(1)}% (${(cls.accuracy / cls.chance).toFixed(2)}x)${base && base.__classifier ? `; baseline ${(base.__classifier.accuracy * 100).toFixed(1)}%` : ''}`,
      pass: ok3 && (base ? okBase : null)});
  }
  return rows;
}

function classifyRuns(runs) {
  // Two-fold across the sweep's seeds: train on one seed's wars, score on the other's.
  const sweep = runs.filter(r => r.spec.sweep);
  const folds = [...new Set(sweep.map(r => r.spec.fold))];
  if (folds.length < 2) return null;
  let correct = 0, total = 0, chance = 0; const per = [];
  for (const f of folds) {
    const rows = side => sweep.filter(r => (r.spec.fold === f) === side).flatMap(r => r.features);
    const res = M.classify(rows(false), rows(true));
    correct += res.accuracy * res.total; total += res.total; chance += res.chance * res.total; per.push({testFold: f, ...res});
  }
  return {accuracy: correct / total, chance: chance / total, total, folds: per};
}

function summarise(label, runs, compare) {
  const merged = M.mergeGroups(runs.map(r => r.groups));
  const final = M.finalize(merged);
  const cls = classifyRuns(runs);
  const base = compare ? JSON.parse(fs.readFileSync(compare, 'utf8')) : null;
  const baseFinal = base ? {...base.final, __classifier: base.classifier} : null;
  const rows = criteria(final, runs, cls, baseFinal);
  const perRun = runs.map(r => {
    const g = M.finalize(r.groups);
    return {id: r.spec.id, name: r.spec.name, ships: r.ships.length, simMs: r.simMs, all: pick(g.all), frigate: g['class:frigate'] ? pick(g['class:frigate']) : null,
      capital: g['class:capital'] ? pick(g['class:capital']) : null, cohesion: r.cohesion.seconds ? +(r.cohesion.inBand / r.cohesion.seconds).toFixed(3) : null,
      individualityMin: r.individuality.length ? +Math.min(...r.individuality.map(x => x.min)).toFixed(3) : null, hasFrigates: r.ships.some(s => s.cls === 'frigate')};
  });
  function pick(g) { return {perMin: +g.perMin.toFixed(3), strictPerMin: +g.strictPerMin.toFixed(3), shuttleMax: +g.shuttleMax.toFixed(3), angP95: +g.angJerk.p95.toFixed(2), hold: +g.holdShare.toFixed(3), spins: g.spinsBig}; }
  const summary = {label, date: new Date().toISOString(), runs: runs.length, criteria: rows, final, classifier: cls, perRun,
    worstShuttle: runs.flatMap(r => r.ships.map(s => ({run: r.spec.id, id: s.id, race: SC.FLEETS[s.race], cls: s.cls, ...s.shuttle}))).sort((a, b) => b.share - a.share).slice(0, 25),
    reversalReasons: tally(runs.flatMap(r => r.ships.flatMap(s => s.reversals.map(x => `${s.cls} | ${x.mode} | ${x.reason}`)))),
    strictReversalReasons: tally(runs.flatMap(r => r.ships.flatMap(s => (s.reversalsStrict || []).map(x => `${s.cls} | ${x.mode} | ${x.reason}`))))};
  return summary;
}
function tally(list) { const m = new Map(); for (const x of list) m.set(x, (m.get(x) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40); }

function markdown(s) {
  const lines = [`# Motion summary: ${s.label}`, '', `${s.runs} runs. ${s.date}`, '', '| criterion | target | measured | result |', '|---|---|---|---|'];
  for (const r of s.criteria) lines.push(`| ${r.text} | ${r.target} | ${r.value} | ${r.pass === true ? 'PASS' : r.pass === false ? 'FAIL' : 'n/a'} |`);
  lines.push('', '| class | ships | ship-min | reversals/min | strict/min | shuttle max | ang jerk p50 / p95 | lin jerk/L p95 | holds | spins >=80 m | bank~rate r | overshoot p50/p90 deg | settle p50 s |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of M.CLASSES) { const g = s.final['class:' + c]; if (!g) continue;
    lines.push(`| ${c} | ${g.ships} | ${g.minutes} | ${g.perMin.toFixed(3)} | ${g.strictPerMin.toFixed(3)} | ${(g.shuttleMax * 100).toFixed(1)}% | ${g.angJerk.p50.toFixed(2)} / ${g.angJerk.p95.toFixed(2)} | ${g.linJerk.p95.toFixed(3)} | ${(g.holdShare * 100).toFixed(1)}% | ${g.spinsBig} | ${g.bankRate == null ? '-' : g.bankRate.toFixed(2)} | ${g.overshootP50.toFixed(1)} / ${g.overshootP90.toFixed(1)} | ${Number.isFinite(g.settleP50) ? g.settleP50.toFixed(1) : '-'} |`); }
  return lines.join('\n') + '\n';
}

/* --------------------------------- main ---------------------------------- */
async function main() {
  const label = arg('label', 'current'), outDir = path.join(root, 'bench/motion', label);
  if (has('worker')) { const id = arg('worker'); const spec = specs().find(s => s.id === id); runOne(spec, outDir); return; }
  if (has('summarise')) { const runs = fs.readdirSync(path.join(outDir, 'runs')).map(f => JSON.parse(fs.readFileSync(path.join(outDir, 'runs', f), 'utf8'))); write(label, outDir, runs); return; }
  let list = specs();
  const only = arg('only'); if (only) { const ids = only.split(','); list = list.filter(s => ids.some(id => s.id === id || s.id.startsWith(id + '-') || s.id.startsWith(id))); }
  else if (has('scenes') && !has('sweep')) list = list.filter(s => !s.sweep);
  else if (has('sweep') && !has('scenes')) list = list.filter(s => s.sweep);
  if (has('skip-heavy')) list = list.filter(s => !s.heavy);
  const jobs = +arg('jobs', Math.max(1, os.cpus().length));
  // Heavy runs first so they don't finish last alone.
  list.sort((a, b) => (b.heavy ? 1 : 0) - (a.heavy ? 1 : 0) || b.size * b.seconds - a.size * a.seconds);
  let next = 0, done = 0; const failed = [];
  await new Promise(resolve => {
    const launch = () => {
      if (next >= list.length) { if (done === list.length) resolve(); return; }
      const spec = list[next++];
      const p = spawn(process.execPath, ['--max-old-space-size=6144', __filename, '--worker', spec.id, '--label', label], {stdio: ['ignore', 'inherit', 'inherit']});
      p.on('close', code => { done++; if (code) failed.push(spec.id); console.error(`[${done}/${list.length}] ${spec.id} ${code ? 'FAILED' : 'ok'}`); launch(); if (done === list.length) resolve(); });
    };
    for (let i = 0; i < Math.min(jobs, list.length); i++) launch();
  });
  if (failed.length) console.error('failed:', failed.join(','));
  const runs = fs.readdirSync(path.join(outDir, 'runs')).map(f => JSON.parse(fs.readFileSync(path.join(outDir, 'runs', f), 'utf8')));
  write(label, outDir, runs);
}
function write(label, outDir, runs) {
  const s = summarise(label, runs, arg('compare'));
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(s, null, 1));
  fs.writeFileSync(path.join(outDir, 'summary.md'), markdown(s));
  console.log(markdown(s));
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = {runOne, summarise, criteria};
