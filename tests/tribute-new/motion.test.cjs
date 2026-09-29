/* Motion: how the ships fly. Handling draws per pilot, the helm's layers,
   goal hysteresis, avoidance blending, station loiters, formation phases,
   squadmate individuality, and the Rebel frigate screen that used to shuttle
   like a donkey. The war checks run the page's real simulation headless and
   measure it with the same recorder and metrics as scripts/motion-report.cjs. */
const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../../armada-battle-ai-new.js');
const M = require('../../scripts/motion-lib.cjs');
const {loadBattle} = require('./headless-battle.cjs');

const ship = (over = {}) => ({id: 0, side: 0, race: 5, seed: 12345, x: 0, y: 0, z: 0, yaw: 0, v: 40, vy: 0, pitch: 0, roll: 0,
  hp: 10, hpMax: 10, slen: 20, spd: 40, spdMax: 60, turn: 1.2, squad: -1, arr: true, grace: false, dead: false, ...over});
const minds = () => { const m = new AI.FleetMinds(AI.PROFILES.map(() => ({hold: 500, doct: {CHARGE: 3}}))); m.reset(7); return m; };

// Records a headless war with the motion recorder and analyses it.
function war(a, b, seed, size, seconds, setup) {
  const bt = loadBattle({cores: 1, modules: true});
  if (setup && setup.force) bt.run(`storyForce=${JSON.stringify(setup.force)}`);
  bt.start(a, b, seed, size);
  bt.run(`globalThis.__mo=(${M.installMotionRecorder.toString()})(${JSON.stringify({F: M.F, cap: seconds * 30 + 4, modes: M.MODES, flag: M.FLAG})})`);
  let T = bt.run('battleTime-warT0');
  const phases = new Set();
  while (T < seconds) {
    T = bt.run('battleTime+=1/30;simStep(battleTime,1/30);introStep(battleTime,1/30);__mo.sample();battleTime-warT0');
    bt.flush();
    if (Math.round(T * 30) % 15 === 0) for (const p of JSON.parse(bt.run('JSON.stringify(squads.map(q=>q.fm&&q.fm.phase))'))) if (p) phases.add(p);
  }
  const rec = bt.run('__mo');
  return {bt, rec, A: M.analyse(rec), phases};
}

test('every fleet has a handling row, and each pilot draws their own hands from their own stream', () => {
  assert.equal(AI.HANDLING.length, AI.PROFILES.length);
  for (const row of AI.HANDLING) {
    for (const k of ['smooth', 'bank', 'overshoot', 'rhythmHz', 'rhythm', 'tight', 'breakaway', 'reform', 'react', 'weave', 'weaveHz', 'commit']) assert.ok(Number.isFinite(row[k]), k);
    assert.ok(['finger-four', 'wedge', 'line abreast', 'swarm', 'cluster'].includes(row.shape));
    assert.ok(AI.GEOMETRY[row.geometry], row.geometry);
    assert.ok(row.why.length > 20);
  }
  const m = minds(), a = ship({seed: 111}), b = ship({seed: 222, id: 1});
  // Drawing the hands does not move the pilot's own decision stream.
  const probe = minds(), c = ship({seed: 111});
  probe.seedShip(c); const next = c.ai.rng();
  const h = m.hand(a), again = m.hand(a); assert.equal(h, again);
  assert.equal(a.ai.rng(), next, 'hand() must not draw from the pilot stream');
  const hb = m.hand(b);
  assert.notEqual(h.react, hb.react); assert.notEqual(h.weaveHz, hb.weaveHz); assert.notEqual(h.slot[0], hb.slot[0]);
  // Same seed, same hands, in a fresh mind.
  assert.deepEqual(minds().hand(ship({seed: 111})).ph, h.ph);
  // The fleet's row shapes the draw: Borg never bank or weave; Shoal pilots are twitchier than Minbari.
  const borg = minds().hand(ship({race: 12, seed: 5}));
  assert.ok(borg.bank <= .18 && borg.weave <= .15 && borg.overshoot <= .15);
  let shoal = 0, minbari = 0; for (let i = 0; i < 40; i++) { shoal += minds().hand(ship({race: 1, seed: 900 + i})).smooth; minbari += minds().hand(ship({race: 7, seed: 900 + i})).smooth; }
  assert.ok(minbari > shoal + 8, 'Minbari sticks are smoother than Shoal ones on average');
});

test('goal hysteresis: a challenger must beat the current goal and hold for the dwell; every change is logged with a reason', () => {
  const m = minds(), s = ship({slen: 150, seed: 77});
  const a = m.seedShip(s), h = m.hand(s);
  assert.ok(m.dwell(s, h) > m.dwell(ship({slen: 10, seed: 77}), h), 'dwell grows with the hull');
  // Drive think() with a scripted contact picture so ATTACK and ESCORT compete.
  m.index([s], 0, [], []);
  a.action = 'ATTACK'; a.until = 0; a.nextThink = 0;
  a.contacts.set(9, {id: 9, x: 400, y: 0, z: 0, yaw: 0, v: 0, vy: 0, hp: 10, hpMax: 10, slen: 20, rad: 10, side: 1, race: 6, seen: 0, reported: 0, direct: true, confidence: 1});
  let changes = 0, prev = a.action;
  for (let t = 0; t < 30; t += 1 / 30) { a.nextThink = Math.min(a.nextThink, t); m.think(s, t); a.contacts.get(9).seen = t; if (a.action !== prev) { changes++; prev = a.action; } }
  assert.ok(changes < 12, `a 150 m hull re-decided ${changes} times in 30 s`);
  assert.ok((a.goalLog || []).length > 0 || changes === 0);
  for (const g of a.goalLog || []) assert.ok(typeof g.why === 'string' && g.why.length > 3 && g.from !== g.to);
});

test('avoidance blends in and out over time instead of switching each step', () => {
  const m = minds(), s = ship();
  const w = []; for (let i = 0; i < 30; i++) w.push(m.avoidBlend(s, i < 15, .4, 1 / 30));
  assert.ok(w[0] > 0 && w[0] < .2, 'eases in');
  for (let i = 1; i < 30; i++) assert.ok(Math.abs(w[i] - w[i - 1]) <= 1 / .35 / 30 + 1e-9, 'never jumps');
  assert.ok(w[14] > .9 && w[29] < w[14] && w[29] > 0, 'eases out');
  assert.ok(s.avBrake < 1 && s.avBrake > .4, 'brake is smoothed too');
});

test('a frigate holding a point loiters: no reversal, no shuttling, a turning circle wider than its hull', () => {
  const m = minds(), s = ship({slen: 120, spd: 30, spdMax: 42, turn: .9, gunboat: true, x: -900, yaw: 0});
  m.seedShip(s);
  const rec = {F: M.F, n: 0, t: [], tracks: [new Float32Array(3600 * M.F)], meta: [{id: 0, side: 0, race: 5, slen: 120, cls: 'frigate', turn: s.turn, spd: 30, spdMax: 42, squad0: -1}], reasonList: [''], squadsAt: []};
  const goal = [0, 0, 0];
  let minR = Infinity;
  for (let k = 0; k < 3600; k++) {
    const now = k / 30, loiter = m.helmStation(s, goal, {axis: [1, 0]}), p = loiter ? loiter.p : goal;
    let err = Math.atan2(p[2] - s.z, p[0] - s.x) - s.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
    m.helmTurn(s, err, 1 / 30, now, {max: s.turn, clean: true});
    s.v = m.helmSpeed(s, loiter ? s.spd * .62 : s.spd, 1 / 30);
    s.x += Math.cos(s.yaw) * s.v / 30; s.z += Math.sin(s.yaw) * s.v / 30;
    if (Math.abs(s.yawV) > .01) minR = Math.min(minR, s.v / Math.abs(s.yawV));
    const o = k * M.F, tr = rec.tracks[0];
    tr[o] = s.x; tr[o + 1] = 0; tr[o + 2] = s.z; tr[o + 3] = s.yaw; tr[o + 4] = 0; tr[o + 5] = 0; tr[o + 6] = s.v; tr[o + 7] = 0; tr[o + 8] = NaN; tr[o + 9] = -1; tr[o + 10] = 42; tr[o + 11] = M.FLAG.flying; tr[o + 12] = 0; tr[o + 13] = 0; tr[o + 14] = -1; tr[o + 15] = 42;
    rec.t[k] = now; rec.n++;
  }
  const S = M.shipSeries(rec, 0);
  assert.equal(M.reversals(S, M.FLAG.contact).length, 0, 'no reversals');
  assert.ok(M.shuttle(S).worst.share <= .05, 'no shuttling: ' + M.shuttle(S).worst.share);
  assert.ok(minR >= 120 * 1.3, 'turning circle ' + minR.toFixed(0) + ' m for a 120 m hull');
  assert.ok(Math.hypot(s.x, s.z) < 1500, 'it stays on its station');
});

test('the Rebel frigate screen (scene 01) flies lines: no reversals or shuttling for any frigate, and they fly', {timeout: 600000}, () => {
  const {A} = war(5, 6, 2202, 60, 75);
  const frig = A.ships.filter(s => s.cls === 'frigate' && s.race === 6);
  assert.ok(frig.length >= 6, 'rebel frigates present');
  for (const s of frig) {
    assert.equal(s.reversals.length + (s.reversalsStrict || []).length, 0, `frigate ${s.id} reversed`);
    assert.ok(s.shuttleWorst.share <= .05, `frigate ${s.id} shuttled ${s.shuttleWorst.share}`);
    assert.equal(s.spins.length, 0);
  }
  const moved = frig.filter(s => s.hold.flying > 20);
  assert.ok(moved.length >= frig.length * .8);
});

test('a war flies clean: reversals, shuttling, spins, jerk and capital limits', {timeout: 600000}, () => {
  const {A, phases} = war(9, 10, 4242, 30, 90);
  const g = M.finalize(M.groupStats(A.ships));
  for (const [key, v] of Object.entries(g)) {
    if (!key.startsWith('class:')) continue;
    if (['class:frigate', 'class:capital', 'class:leviathan'].includes(key)) assert.equal(v.strictReversals, 0, key + ' reversed');
    if (v.minutes > 3) assert.ok(v.perMin < .2, `${key} reversals ${v.perMin}`);
  }
  assert.ok(g.all.shuttleMax <= .05, 'shuttle ' + g.all.shuttleMax);
  assert.equal(g.all.spinsBig, 0, 'no hull of 80 m or more spins in place');
  if (g['class:frigate']) assert.ok(g['class:frigate'].angJerk.p95 < 5.42, 'frigate angular jerk p95 ' + g['class:frigate'].angJerk.p95);
  for (const c of ['class:capital', 'class:leviathan']) if (g[c] && g[c].turnRatioMax != null) {
    assert.ok(g[c].turnRatioMax <= 1.05 && g[c].accRatioMax <= 1.05 && g[c].decRatioMax <= 1.05, `${c} limits ${g[c].turnRatioMax} ${g[c].accRatioMax} ${g[c].decRatioMax}`);
  }
  for (const p of ['FORM', 'CRUISE', 'BREAK']) assert.ok(phases.has(p), 'formation phase ' + p + ' happens');
  // Squadmates never share a motion signature.
  for (const q of A.individuality) assert.ok(q.min > 0, 'squad ' + q.squad + ' has twins');
});
