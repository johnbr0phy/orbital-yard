/* Motion quality: a recorder that runs inside the page (Node harness or
   Chromium) and the metrics computed from what it records.

   The recorder is plain page-side JavaScript (installMotionRecorder is
   injected by source), so the headless harness and a browser capture record
   the same fields the same way. It samples every ship once per 1/30 s
   simulation step.

   Nothing here touches the simulation: the recorder only reads state, and
   no random stream is drawn. The metrics are pure functions of the record.

   Definitions (MOTION.md states them for the reader):
   - flying: arrived, out of the jump-shed window, alive, not jumped, not the
     human pilot's ship.
   - contact: inside the contact solver's brake window (a real collision or
     a push out of a rock). The displacement is the solver's, not the pilot's.
   - dogfighting: a small craft (not a frigate or capital) attacking,
     flanking, striking or evading with its mark within 1,500 m.
   - reversal: the unwrapped heading moves more than 120 degrees from where
     it was and comes back within 60 degrees of it inside 6 s, with every
     sample in between flying, not dogfighting, not evading an ion lock and
     not in contact. A full loop is not a reversal (its unwrapped heading does
     not come back). Ships here always move along their hull (the contact
     solver aside), so a heading reversal is a velocity reversal.
   - shuttle share: in each 10 s window (1 s stride), the share of time the
     ship is on ground it already crossed earlier in the window (within
     max(20 m, half its length), at least 1 s earlier and after travelling at
     least that far in between) while flying the other way (more than 120
     degrees apart). Orbits and loops do not
     retrace ground in the opposite direction; back-and-forth does. */
'use strict';

const F = 16; // floats per ship per step
const FIELD = {x: 0, y: 1, z: 2, yaw: 3, pitch: 4, roll: 5, v: 6, vy: 7, goalYaw: 8, gap: 9, spdMax: 10, flags: 11, mode: 12, reason: 13, squad: 14, fullBurn: 15};
const FLAG = {flying: 1, contact: 2, ion: 4, traffic: 8, debris: 16, routing: 32, dogfight: 64, ram: 128, order: 256, transit: 512, formed: 1024};
const MODES = ['', 'ATTACK', 'FLANK', 'ESCORT', 'REGROUP', 'RETREAT', 'EVADE', 'SEARCH', 'ROUT', 'PANIC', 'DRIFT', 'RAM', 'HOLD', 'HIDE', 'MANEUVER', 'GUARD', 'STRIKE', 'CONVOY', 'RECOVER', 'TOW', 'RESCUE', 'PATROL', 'STATION', 'OTHER'];
const CLASSES = ['fighter', 'light', 'mid', 'frigate', 'hero', 'capital', 'leviathan'];
const SMALL = new Set(['fighter', 'light', 'mid', 'hero']);

/* ------------------------------ page side ------------------------------ */
// Injected by source. Uses the page's globals: ships, squads, battleTime,
// warT0, fightsAsCrown, isGunboat, pilotId, intro.
function installMotionRecorder(opts) {
  const F = opts.F, cap = opts.cap, MODES = opts.modes, FLAG = opts.flag;
  const modeIndex = new Map(MODES.map((m, i) => [m, i]));
  const reasons = new Map([['', 0]]), reasonList = [''];
  const rec = {F, cap, n: 0, t: new Float64Array(cap), tracks: [], meta: [], reasonList, squadsAt: [], events: []};
  const classOf = s => (s.hulls || 0) >= 50 ? 'leviathan' : fightsAsCrown(s) ? 'capital' : s.hero ? 'hero'
    : isGunboat(s) ? 'frigate' : (s.slen || 0) < 42 ? 'fighter' : (s.slen || 0) < 80 ? 'light' : 'mid';
  const SMALLC = {fighter: 1, light: 1, mid: 1, hero: 1};
  rec.sample = function () {
    const k = rec.n; if (k >= cap) return false;
    const now = battleTime, T = now - warT0; rec.t[k] = T;
    for (let i = 0; i < ships.length; i++) {
      const s = ships[i];
      let tr = rec.tracks[i];
      if (!tr) {
        if (!s || !s.vao) continue;
        tr = rec.tracks[i] = new Float32Array(cap * F).fill(NaN);
        rec.meta[i] = {id: s.id, side: s.side, race: s.race, slen: s.slen || 0, hero: !!s.hero, hulls: s.hulls || 0, band: s.band,
          cls: classOf(s), squad0: s.squad, turn: s.turn || 0, spd: s.spd || 0, spdMax: s.spdMax || 0, seed: s.seed >>> 0, from: k};
      }
      if (s.dead || !s.vao) { if (!rec.meta[i].death && s.dead) rec.meta[i].death = k; continue; }
      const a = s.ai, plan = a && a.plan, o = k * F;
      const age = T - (s.delay || 0);
      let flags = 0;
      const flying = s.arr && !s.grace && !s.jumped && age >= (s.shed || 1) && s.id !== pilotId && !(intro && !intro.done && s.id === intro.hero);
      if (flying) flags |= FLAG.flying;
      if (now < (s.trafficBrakeUntil || 0)) flags |= FLAG.contact;
      if (a && a.action === 'EVADE' && /^Ion/.test(a.reason || '')) flags |= FLAG.ion;
      if (s.trafficGoal && now < (s.trafficUntil || 0)) flags |= FLAG.traffic;
      if (s.debrisGoal && now < (s.debrisUntil || 0)) flags |= FLAG.debris;
      if (s.routing) flags |= FLAG.routing;
      if (s.ramming != null || (plan && plan.mode === 'RAM')) flags |= FLAG.ram;
      if (a && a.order && now < a.order.until) flags |= FLAG.order;
      if (a && /^Transit/.test(a.reason || '')) flags |= FLAG.transit;
      if (s.form) flags |= FLAG.formed;
      let gap = -1;
      const m = s.mark >= 0 ? ships[s.mark] : null;
      if (m && !m.dead) gap = Math.max(0, Math.hypot(m.x - s.x, m.y - s.y, m.z - s.z) - Math.max(m.rad || 8, m.exL || 0, (m.slen || 20) * .32));
      const mode = plan ? plan.mode : '';
      if (SMALLC[rec.meta[i].cls] && gap >= 0 && gap < 1500 && (mode === 'ATTACK' || mode === 'FLANK' || mode === 'EVADE' || mode === 'STRIKE')) flags |= FLAG.dogfight;
      let r = a ? a.reason || '' : '';
      let ri = reasons.get(r); if (ri == null) { ri = reasonList.length; reasons.set(r, ri); reasonList.push(r); }
      tr[o] = s.x; tr[o + 1] = s.y; tr[o + 2] = s.z; tr[o + 3] = s.yaw || 0; tr[o + 4] = s.pitch || 0; tr[o + 5] = s.roll || 0;
      tr[o + 6] = s.v || 0; tr[o + 7] = s.vy || 0;
      tr[o + 8] = plan && plan.goal ? Math.atan2(plan.goal[2] - s.z, plan.goal[0] - s.x) : NaN;
      tr[o + 9] = gap; tr[o + 10] = s.spdMax || 0; tr[o + 11] = flags;
      tr[o + 12] = modeIndex.has(mode) ? modeIndex.get(mode) : MODES.length - 1; tr[o + 13] = ri;
      tr[o + 14] = s.squad == null ? -1 : s.squad;
      // Full burn: the speed the engines are spooling toward at full throttle. During a
      // capital's transit burn that is the transit speed (the page's own formula), else top speed.
      tr[o + 15] = s.fullBurn != null ? s.fullBurn : (flags & FLAG.transit) && a ? Math.min(180, (s.spd || 0) * (2.4 + a.budget[2] / 40)) : (s.spdMax || 0);
    }
    // Squadron state once a second (routing / membership), cheap.
    if (k % 30 === 0) rec.squadsAt.push({k, sq: squads.map(q => [q.state === 'routing' ? 1 : 0, q.mem.length, q.phase || 0])});
    rec.n++;
    return true;
  };
  return rec;
}

/* ------------------------------ node side ------------------------------ */
const TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const q = (arr, p) => { if (!arr.length) return NaN; const s = Float64Array.from(arr).sort(); const i = Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1)))); return s[i]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const DT = 1 / 30;

// Per-ship view of a record: typed getters and derived series.
function shipSeries(rec, i) {
  const tr = rec.tracks[i], meta = rec.meta[i], n = rec.n, F = rec.F;
  const get = (k, f) => tr[k * F + f];
  const flags = new Uint16Array(n), U = new Float64Array(n);
  let prev = NaN, acc = 0;
  for (let k = 0; k < n; k++) {
    const f = tr[k * F + 11];
    flags[k] = Number.isNaN(f) ? 0 : f;
    const y = tr[k * F + 3];
    if (Number.isNaN(y)) { U[k] = NaN; prev = NaN; continue; }
    if (Number.isNaN(prev)) acc = y; else acc += wrap(y - prev);
    U[k] = acc; prev = y;
  }
  return {tr, meta, n, F, get, flags, U};
}
const fly = (S, k) => (S.flags[k] & FLAG.flying) !== 0;

// Reversals: see the header. exclude is a flag mask whose samples break a candidate.
function reversals(S, exclude) {
  const out = []; const {n, U, flags} = S; const W = 180;
  let i = 0;
  while (i < n) {
    if (!(flags[i] & FLAG.flying) || (flags[i] & exclude)) { i++; continue; }
    let far = -1, back = -1;
    for (let j = i + 1; j < Math.min(n, i + W + 1); j++) {
      if (!(flags[j] & FLAG.flying) || (flags[j] & exclude)) break;
      const d = Math.abs(U[j] - U[i]);
      if (far < 0) { if (d > 2.0944) far = j; }
      else if (d < 1.0472) { back = j; break; }
    }
    if (far >= 0 && back >= 0) { out.push({k: i, far, back, span: (back - i) * DT}); i = back; }
    else i += 3;
  }
  return out;
}
function eligibleSeconds(S, exclude) { let c = 0; for (let k = 0; k < S.n; k++) if ((S.flags[k] & FLAG.flying) && !(S.flags[k] & exclude)) c++; return c * DT; }

// Shuttle share per 10 s window (1 s stride), sampled at 5 Hz.
function shuttle(S) {
  const {n, get, meta} = S, step = 6, win = 300, tol = Math.max(20, meta.slen * .5), tol2 = tol * tol;
  const worst = {share: 0, k: -1}, windows = [];
  for (let w = 0; w + win <= n; w += 30) {
    const pts = [];
    for (let k = w; k < w + win; k += step) {
      if (!fly(S, k) || (S.flags[k] & FLAG.contact)) continue;
      const v = get(k, 6), yaw = get(k, 3), vy = get(k, 7);
      const sp = Math.hypot(v, vy); if (sp < .5) continue;
      pts.push([k, get(k, 0), get(k, 1), get(k, 2), Math.cos(yaw) * v / sp, vy / sp, Math.sin(yaw) * v / sp]);
    }
    if (pts.length < 25) continue;
    // Path travelled up to each point: a retrace only counts if the ship went away and came back
    // (at least the tolerance in between), so a hull easing a metre up and down is not shuttling.
    const path = [0]; for (let a = 1; a < pts.length; a++) path.push(path[a - 1] + Math.hypot(pts[a][1] - pts[a - 1][1], pts[a][2] - pts[a - 1][2], pts[a][3] - pts[a - 1][3]));
    let hit = 0, firstHit = -1;
    for (let a = 0; a < pts.length; a++) {
      const p = pts[a];
      for (let b = 0; b < a; b++) {
        const r = pts[b]; if (p[0] - r[0] < 30) break;
        if (path[a] - path[b] < tol) continue;
        const dx = p[1] - r[1], dy = p[2] - r[2], dz = p[3] - r[3];
        if (dx * dx + dy * dy + dz * dz > tol2) continue;
        if (p[4] * r[4] + p[5] * r[5] + p[6] * r[6] < -0.5) { hit++; if (firstHit < 0) firstHit = p[0]; break; }
      }
    }
    const share = hit / (win / step);
    windows.push(share);
    if (share > worst.share) { worst.share = share; worst.k = firstHit >= 0 ? firstHit : w; worst.w = w; }
  }
  // net / path over the same windows, for the record
  return {worst, windows};
}

// Third differences of the flown kinematics. Angular: yaw (unwrapped), pitch, roll.
function jerks(S) {
  const {n, get, U} = S, ang = [], lin = [], L = Math.max(10, S.meta.slen);
  for (let k = 3; k < n; k++) {
    let ok = true; for (let j = k - 3; j <= k; j++) if (!fly(S, j) || (S.flags[j] & FLAG.contact)) { ok = false; break; }
    if (!ok) continue;
    const d3 = (f) => (f(k) - 3 * f(k - 1) + 3 * f(k - 2) - f(k - 3)) / (DT * DT * DT);
    const jy = d3(j => U[j]), jp = d3(j => get(j, 4)), jr = d3(j => get(j, 5));
    ang.push(Math.hypot(jy, jp, jr));
    const vx = j => Math.cos(get(j, 3)) * get(j, 6), vz = j => Math.sin(get(j, 3)) * get(j, 6), vyf = j => get(j, 7);
    const d2 = f => (f(k) - 2 * f(k - 1) + f(k - 2)) / (DT * DT);
    lin.push(Math.hypot(d2(vx), d2(vyf), d2(vz)) / L);
  }
  return {ang, lin};
}

// Yaw rate smoothed over 5 samples.
function yawRate(S, k) { if (k < 2 || k + 2 >= S.n) return NaN; return (S.U[k + 2] - S.U[k - 2]) / (4 * DT); }

// Spin in place: |yaw rate| > 0.1 rad/s while speed < 15% of top speed, for 0.5 s or more.
function spins(S) {
  const out = []; let run = 0, start = -1;
  for (let k = 0; k < S.n; k++) {
    const ok = fly(S, k) && Math.abs(yawRate(S, k)) > .1 && Math.hypot(S.get(k, 6), S.get(k, 7)) < .15 * Math.max(1, S.get(k, 10));
    if (ok) { if (!run) start = k; run++; }
    else { if (run >= 15) out.push({k: start, seconds: run * DT}); run = 0; }
  }
  if (run >= 15) out.push({k: start, seconds: run * DT});
  return out;
}

// Speed holds: share of flying time inside a 5 s run whose speed stays within ±2% of one value.
function speedHolds(S) {
  const {n, get} = S, W = 150, cover = new Int32Array(n + 1);
  let flying = 0;
  for (let k = 0; k < n; k++) if (fly(S, k)) flying++;
  for (let k = 0; k + W <= n; k++) {
    let lo = Infinity, hi = -Infinity, ok = true;
    for (let j = k; j < k + W; j++) { if (!fly(S, j)) { ok = false; break; } const v = get(j, 6); if (v < lo) lo = v; if (v > hi) hi = v; if (hi > lo * 1.0408 + 1e-9) { ok = false; break; } }
    if (ok && lo > .5) { cover[k]++; cover[k + W]--; }
  }
  let c = 0, run = 0; for (let k = 0; k < n; k++) { run += cover[k]; if (run > 0 && fly(S, k)) c++; }
  return {held: c * DT, flying: flying * DT};
}

// Turn physics.
function turnPhysics(S) {
  const {n, get} = S; const bank = [], rate = [];
  let slide = 0, flown = 0, burn = 0, lat = 0;
  const dv = [], yr = [];
  for (let k = 2; k < n - 2; k++) {
    if (!fly(S, k) || !fly(S, k - 1) || (S.flags[k] & FLAG.contact)) continue;
    const r = yawRate(S, k); if (Number.isNaN(r)) continue;
    bank.push(get(k, 5)); rate.push(r); yr.push(Math.abs(r));
    const dx = get(k, 0) - get(k - 1, 0), dz = get(k, 2) - get(k - 1, 2), d = Math.hypot(dx, dz);
    if (d > .02) { flown++; const c = (dx * Math.cos(get(k, 3)) + dz * Math.sin(get(k, 3))) / d; if (c < Math.cos(10 * Math.PI / 180)) slide++; }
    const along = (get(k, 6) - get(k - 1, 6)) / DT, side = get(k, 6) * r;
    dv.push(along); burn += Math.abs(along); lat += Math.abs(side);
  }
  // Pearson correlation of roll against yaw rate (a banked turn has roll opposite in sign to yaw rate in this sim).
  let r = NaN;
  if (bank.length > 30) { const mb = mean(bank), mr = mean(rate); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < bank.length; i++) { const a = bank[i] - mb, b = rate[i] - mr; sxy += a * b; sxx += a * a; syy += b * b; } r = sxy / Math.sqrt(sxx * syy || 1); }
  // Overshoot / settle after a heading demand: the goal bearing jumps from within 10 degrees of the nose to 45-135 degrees off it.
  // Overshoot is how far the nose swings past the bearing (up to 90 degrees; beyond that the goal has moved, not the nose).
  const steps = [];
  for (let k = 1; k < n - 30; k++) {
    if (!fly(S, k) || !fly(S, k - 1)) continue;
    const e0 = wrap(get(k - 1, 8) - get(k - 1, 3)), e1 = wrap(get(k, 8) - get(k, 3));
    if (!(Math.abs(e0) < .1745 && Math.abs(e1) > .785 && Math.abs(e1) < 2.356)) continue;
    const sgn = Math.sign(e1); let over = 0, settle = NaN, crossed = false, calm = 0;
    for (let j = k; j < Math.min(n, k + 450); j++) {
      if (!fly(S, j)) break;
      const e = wrap(get(j, 8) - get(j, 3)) * sgn;
      if (e < 0 && e > -1.5708) { crossed = true; over = Math.max(over, -e); }
      if (Math.abs(e) < .0873) { calm++; if (calm >= 30) { settle = (j - 29 - k) * DT; break; } } else calm = 0;
    }
    steps.push({over: over * 180 / Math.PI, settle});
    k += 30;
  }
  return {bankRate: r, slideShare: flown ? slide / flown : NaN, burnShare: burn + lat ? burn / (burn + lat) : NaN, dv, yawRates: yr, steps};
}

// Capital limits: yaw rate against the hull's turn limit; speed change against its spool.
// Contact and a committed ram (the emergency burn) are excluded; a transit burn is not.
function capitalLimits(S) {
  const {n, get, meta} = S; let maxTurn = 0, maxAcc = 0, maxDec = 0, samples = 0;
  const L = meta.slen, spool = Math.min(30, 8 + L / 200);
  let accRatio = 0, decRatio = 0, accAt = -1, decAt = -1;
  for (let k = 3; k < n - 3; k++) {
    let ok = true; for (let j = k - 3; j <= k + 3; j++) if (!fly(S, j) || (S.flags[j] & (FLAG.contact | FLAG.ram))) { ok = false; break; }
    if (!ok) continue; samples++;
    const r = Math.abs(yawRate(S, k)); if (r > maxTurn) maxTurn = r;
    // The limit at this step: full burn (of the drive in use, at either end of the step) over the spool.
    const burn = Math.max(get(k, 15), get(k - 1, 15), get(k, 10), meta.spd), acc = burn / spool;
    const a = (get(k, 6) - get(k - 1, 6)) / DT;
    if (a > maxAcc) maxAcc = a; if (-a > maxDec) maxDec = -a;
    if (a / acc > accRatio) { accRatio = a / acc; accAt = k; }
    if (-a / (acc * 1.5) > decRatio) { decRatio = -a / (acc * 1.5); decAt = k; }
  }
  return {turnRatio: meta.turn ? maxTurn / meta.turn : NaN, accRatio, decRatio, accAt, decAt, samples, maxTurn, maxAcc, maxDec, limits: {turn: meta.turn, spool}};
}

// Motion signature of one ship over its flying time (outside contact).
function signature(S, sq) {
  const {n, get} = S; const yr = [], vv = [], lateral = [], rollA = [];
  for (let k = 2; k < n - 2; k++) {
    if (!fly(S, k) || (S.flags[k] & FLAG.contact)) continue;
    const r = yawRate(S, k); if (Number.isNaN(r)) continue;
    yr.push(r); vv.push(get(k, 6) / Math.max(1, get(k, 10))); rollA.push(Math.abs(get(k, 5)));
    if (sq && sq[k]) { const c = sq[k]; const dx = get(k, 0) - c.x, dz = get(k, 2) - c.z; lateral.push(-dx * Math.sin(c.h) + dz * Math.cos(c.h)); }
  }
  if (yr.length < 300) return null;
  const detrend = a => { const out = new Float64Array(a.length), W = 45; let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= W) s -= a[i - W]; out[i] = a[i] - s / Math.min(i + 1, W); } return out; };
  const zc = a => { let c = 0; for (let i = 1; i < a.length; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) c++; return c / (a.length * DT) / 2; };
  const dy = detrend(yr), dv = detrend(vv);
  const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
  return {turnRate: mean(yr.map(Math.abs)), weaveHz: zc(dy), weaveAmp: sd(Array.from(dy)), throttleHz: zc(dv), throttleAmp: sd(Array.from(dv)),
    lineOffset: lateral.length ? mean(lateral) : 0, bank: mean(rollA), seconds: yr.length * DT};
}

// Squadron frames: per step, centroid, mean heading and member stats.
function squadFrames(rec, series) {
  const bySq = new Map();
  for (const S of series) { if (!S) continue; const sq = S.meta.squad0; if (sq == null || sq < 0) continue; if (!bySq.has(sq)) bySq.set(sq, []); bySq.get(sq).push(S); }
  return bySq;
}
function circStd(angles) { let c = 0, s = 0; for (const a of angles) { c += Math.cos(a); s += Math.sin(a); } const R = Math.hypot(c, s) / angles.length; return Math.sqrt(Math.max(0, -2 * Math.log(Math.max(1e-9, R)))); }

/* Cohesion band (MOTION.md explains the numbers):
   heading spread (circular sd)  1.5 to 40 degrees
   speed spread (coefficient of variation)  0.01 to 0.35
   RMS distance to the centroid  from 1.5 mean hull lengths to 700 m */
const BAND = {head: [1.5, 40], cv: [.01, .35], radiusMax: 700, radiusMinHulls: 1.5};
function cohesion(rec, bySq) {
  const out = {seconds: 0, inBand: 0, parade: 0, dissolved: 0, other: 0, perSquad: [], frames: new Map()};
  for (const [id, members] of bySq) {
    let sec = 0, inb = 0, par = 0, dis = 0; const frames = [];
    for (let k = 0; k < rec.n; k++) {
      const live = members.filter(S => fly(S, k));
      if (live.length < 3) { frames.push(null); continue; }
      let x = 0, z = 0, y = 0, hc = 0, hs = 0; for (const S of live) { x += S.get(k, 0); y += S.get(k, 1); z += S.get(k, 2); hc += Math.cos(S.get(k, 3)); hs += Math.sin(S.get(k, 3)); }
      x /= live.length; y /= live.length; z /= live.length;
      frames.push({x, y, z, h: Math.atan2(hs, hc), n: live.length});
      if (k % 30) continue;
      const dog = live.filter(S => S.flags[k] & FLAG.dogfight).length * 2 >= live.length;
      const rout = live.some(S => S.flags[k] & FLAG.routing);
      if (dog || rout) continue;
      const hsd = circStd(live.map(S => S.get(k, 3))) * 180 / Math.PI;
      const vs = live.map(S => S.get(k, 6)), vm = mean(vs), cv = vm > .5 ? Math.sqrt(mean(vs.map(v => (v - vm) ** 2))) / vm : 0;
      const rad = Math.sqrt(mean(live.map(S => (S.get(k, 0) - x) ** 2 + (S.get(k, 1) - y) ** 2 + (S.get(k, 2) - z) ** 2)));
      const L = mean(live.map(S => S.meta.slen));
      sec++;
      const parade = hsd < BAND.head[0] && cv < BAND.cv[0];
      const dissolved = hsd > BAND.head[1] || rad > BAND.radiusMax;
      const band = hsd >= BAND.head[0] && hsd <= BAND.head[1] && cv >= BAND.cv[0] && cv <= BAND.cv[1] && rad <= BAND.radiusMax && rad >= BAND.radiusMinHulls * L;
      if (band) inb++; else if (parade) par++; else if (dissolved) dis++;
    }
    out.frames.set(id, frames);
    out.seconds += sec; out.inBand += inb; out.parade += par; out.dissolved += dis;
    out.perSquad.push({squad: id, race: members[0].meta.race, cls: members[0].meta.cls, seconds: sec, inBand: inb, parade: par, dissolved: dis});
  }
  out.other = out.seconds - out.inBand - out.parade - out.dissolved;
  return out;
}

const SIG_KEYS = ['turnRate', 'weaveHz', 'weaveAmp', 'throttleHz', 'throttleAmp', 'lineOffset', 'bank'];
function individuality(bySq, series, coh) {
  // Scale each signature feature by its spread across all signed ships of the run.
  const sigs = new Map();
  for (const [id, members] of bySq) for (const S of members) { const s = signature(S, coh.frames.get(id)); if (s) sigs.set(S.meta.id, s); }
  const all = [...sigs.values()], sd = {};
  for (const key of SIG_KEYS) { const m = mean(all.map(s => s[key])); sd[key] = Math.sqrt(mean(all.map(s => (s[key] - m) ** 2))) || 1; }
  const dist = (a, b) => Math.sqrt(SIG_KEYS.reduce((t, key) => t + ((a[key] - b[key]) / sd[key]) ** 2, 0) / SIG_KEYS.length);
  const perSquad = [];
  for (const [id, members] of bySq) {
    const got = members.map(S => [S.meta.id, sigs.get(S.meta.id)]).filter(x => x[1]);
    if (got.length < 2) continue;
    let min = Infinity, sum = 0, c = 0, pair = null;
    for (let i = 0; i < got.length; i++) for (let j = 0; j < i; j++) { const d = dist(got[i][1], got[j][1]); sum += d; c++; if (d < min) { min = d; pair = [got[i][0], got[j][0]]; } }
    perSquad.push({squad: id, race: members[0].meta.race, n: got.length, min, mean: sum / c, pair});
  }
  return {perSquad, sigs};
}

/* Fleet-signature features: one row per ship per 20 s window of flying.
   Motion only. No race, length, id or colour; speed is absolute (m/s)
   because how fast a pilot flies is part of how it flies. */
const FEATURES = ['speed', 'speedCv', 'speedHz', 'yawAbs', 'yawP90', 'yawHz', 'yawAccel', 'rollAbs', 'rollPerYaw', 'climb', 'radius', 'squadDist', 'squadHead', 'straight', 'throttleStep'];
function featureRows(S, sqFrames) {
  const rows = [], W = 600, {n, get} = S;
  for (let w = 0; w + W <= n; w += W) {
    const ks = []; for (let k = w + 2; k < w + W - 2; k++) if (fly(S, k) && !(S.flags[k] & FLAG.contact)) ks.push(k);
    if (ks.length < W * .8) continue;
    const v = ks.map(k => get(k, 6)), yr = ks.map(k => yawRate(S, k)), roll = ks.map(k => get(k, 5));
    const vm = mean(v), ya = yr.map(Math.abs);
    const zc = a => { let c = 0; const m = mean(a); for (let i = 1; i < a.length; i++) if ((a[i - 1] < m) !== (a[i] < m)) c++; return c / (a.length * DT) / 2; };
    const acc = []; for (let i = 1; i < yr.length; i++) acc.push(Math.abs(yr[i] - yr[i - 1]) / DT);
    const rp = ya.reduce((t, x, i) => t + Math.abs(roll[i]) * x, 0) / Math.max(1e-6, ya.reduce((t, x) => t + x * x, 0));
    const radii = ks.map((k, i) => Math.abs(yr[i]) > .02 ? get(k, 6) / Math.abs(yr[i]) : 5000).map(r => Math.min(5000, r));
    let sd = [], sh = [];
    if (sqFrames) for (const k of ks) { const c = sqFrames[k]; if (!c) continue; sd.push(Math.hypot(get(k, 0) - c.x, get(k, 2) - c.z)); sh.push(Math.abs(wrap(get(k, 3) - c.h))); }
    const net = Math.hypot(get(ks[ks.length - 1], 0) - get(ks[0], 0), get(ks[ks.length - 1], 2) - get(ks[0], 2));
    let path = 0; for (let i = 1; i < ks.length; i++) path += Math.hypot(get(ks[i], 0) - get(ks[i - 1], 0), get(ks[i], 2) - get(ks[i - 1], 2));
    const dv = []; for (let i = 1; i < v.length; i++) dv.push(Math.abs(v[i] - v[i - 1]));
    rows.push([vm, vm > .5 ? Math.sqrt(mean(v.map(x => (x - vm) ** 2))) / vm : 0, zc(v), mean(ya), q(ya, .9), zc(yr), mean(acc), mean(roll.map(Math.abs)), rp,
      mean(ks.map(k => Math.abs(get(k, 7)))), q(radii, .5), sd.length ? q(sd, .5) : 0, sh.length ? mean(sh) : 0, path ? net / path : 1, mean(dv) / DT]);
  }
  return rows;
}

/* Held-out classifier: multinomial logistic regression on standardised
   (log-scaled where skewed) features, trained on one set of wars and scored
   on wars it never saw. One model per hull class, so it cannot lean on hull
   size to tell fleets apart. */
function trainSoftmax(X, y, K, {epochs = 400, lr = .5, l2 = 1e-3} = {}) {
  const D = X[0].length, W = Array.from({length: K}, () => new Float64Array(D + 1));
  const p = new Float64Array(K);
  for (let e = 0; e < epochs; e++) {
    const G = Array.from({length: K}, () => new Float64Array(D + 1));
    for (let i = 0; i < X.length; i++) {
      let mx = -Infinity; for (let c = 0; c < K; c++) { let s = W[c][D]; for (let d = 0; d < D; d++) s += W[c][d] * X[i][d]; p[c] = s; if (s > mx) mx = s; }
      let z = 0; for (let c = 0; c < K; c++) { p[c] = Math.exp(p[c] - mx); z += p[c]; }
      for (let c = 0; c < K; c++) { const g = p[c] / z - (y[i] === c ? 1 : 0); for (let d = 0; d < D; d++) G[c][d] += g * X[i][d]; G[c][D] += g; }
    }
    for (let c = 0; c < K; c++) for (let d = 0; d <= D; d++) W[c][d] -= lr * (G[c][d] / X.length + (d < D ? l2 * W[c][d] : 0));
  }
  return x => { let best = 0, bs = -Infinity; for (let c = 0; c < K; c++) { let s = W[c][D]; for (let d = 0; d < D; d++) s += W[c][d] * x[d]; if (s > bs) { bs = s; best = c; } } return best; };
}
function prepFeatures(rows) { return rows.map(r => r.map(x => Math.sign(x) * Math.log1p(Math.abs(x) * 10))); }
function classify(train, test) {
  // train/test: [{cls, race, f:[...]}]
  const byCls = new Map();
  for (const r of train) { if (!byCls.has(r.cls)) byCls.set(r.cls, {train: [], test: []}); byCls.get(r.cls).train.push(r); }
  for (const r of test) { if (!byCls.has(r.cls)) byCls.set(r.cls, {train: [], test: []}); byCls.get(r.cls).test.push(r); }
  let correct = 0, total = 0, chanceSum = 0; const per = {}, confusion = {};
  for (const [cls, sets] of byCls) {
    const races = [...new Set(sets.train.map(r => r.race))].sort((a, b) => a - b);
    const test2 = sets.test.filter(r => races.includes(r.race));
    if (races.length < 2 || !test2.length) continue;
    const Xtr = prepFeatures(sets.train.map(r => r.f)), Xte = prepFeatures(test2.map(r => r.f));
    const D = Xtr[0].length, mu = new Array(D).fill(0), sd = new Array(D).fill(0);
    for (const x of Xtr) for (let d = 0; d < D; d++) mu[d] += x[d] / Xtr.length;
    for (const x of Xtr) for (let d = 0; d < D; d++) sd[d] += (x[d] - mu[d]) ** 2 / Xtr.length;
    for (let d = 0; d < D; d++) sd[d] = Math.sqrt(sd[d]) || 1;
    const z = X => X.map(x => x.map((v, d) => (v - mu[d]) / sd[d]));
    // Balance classes by weighting through resampling: repeat minority rows.
    const counts = races.map(r => sets.train.filter(x => x.race === r).length), maxc = Math.max(...counts);
    const Xb = [], yb = []; const Ztr = z(Xtr);
    sets.train.forEach((r, i) => { const c = races.indexOf(r.race), rep = Math.max(1, Math.round(maxc / counts[c])); for (let t = 0; t < rep; t++) { Xb.push(Ztr[i]); yb.push(c); } });
    const predict = trainSoftmax(Xb, yb, races.length);
    let ok = 0; const Zte = z(Xte);
    test2.forEach((r, i) => { const pr = races[predict(Zte[i])]; if (pr === r.race) ok++; const key = r.race + '>' + pr; confusion[cls] = confusion[cls] || {}; confusion[cls][key] = (confusion[cls][key] || 0) + 1; });
    per[cls] = {races: races.length, test: test2.length, accuracy: ok / test2.length, chance: 1 / races.length};
    correct += ok; total += test2.length; chanceSum += test2.length / races.length;
  }
  return {accuracy: total ? correct / total : NaN, chance: total ? chanceSum / total : NaN, per, total, confusion};
}

/* One run's full analysis. Returns summary numbers and per-ship detail. */
function analyse(rec, opts = {}) {
  const series = rec.tracks.map((tr, i) => tr ? shipSeries(rec, i) : null);
  const ships = [];
  const EX_R = FLAG.dogfight | FLAG.ion | FLAG.contact;
  const EX_STRICT = FLAG.ion | FLAG.contact | FLAG.ram;
  for (const S of series) {
    if (!S) continue;
    const m = S.meta, big = !SMALL.has(m.cls);
    const rev = reversals(S, EX_R), revStrict = big ? reversals(S, EX_STRICT) : null;
    const sec = eligibleSeconds(S, EX_R), secStrict = big ? eligibleSeconds(S, EX_STRICT) : 0;
    const sh = shuttle(S), jk = jerks(S), sp = spins(S), hold = speedHolds(S), tp = turnPhysics(S);
    const lim = (m.cls === 'capital' || m.cls === 'leviathan') ? capitalLimits(S) : null;
    ships.push({id: m.id, side: m.side, race: m.race, cls: m.cls, slen: m.slen, squad: m.squad0, seconds: sec, reversals: rev, secondsStrict: secStrict, reversalsStrict: revStrict,
      shuttleWorst: sh.worst, shuttleWindows: sh.windows, jerk: jk, spins: sp, hold, turn: tp, limits: lim});
  }
  const bySq = squadFrames(rec, series);
  const coh = cohesion(rec, bySq);
  const ind = individuality(bySq, series, coh);
  const features = [];
  for (const S of series) { if (!S) continue; const frames = coh.frames.get(S.meta.squad0); for (const f of featureRows(S, frames)) features.push({race: S.meta.race, cls: S.meta.cls, id: S.meta.id, f}); }
  return {ships, cohesion: {seconds: coh.seconds, inBand: coh.inBand, parade: coh.parade, dissolved: coh.dissolved, other: coh.other, perSquad: coh.perSquad},
    individuality: ind.perSquad, features, series, squadFrames: coh.frames};
}

/* Mergeable per-group statistics (groups: class, fleet, fleet:class).
   Jerk is kept as a log-spaced histogram (1,000 bins over ten decades, so
   quantiles are within 2.3%), which lets worker processes be merged. */
const HB = 1000, HLO = -4, HHI = 6;
const hbin = x => x <= 0 ? 0 : Math.max(0, Math.min(HB - 1, Math.floor((Math.log10(x) - HLO) / (HHI - HLO) * HB)));
const hval = b => Math.pow(10, HLO + (b + .5) / HB * (HHI - HLO));
function hq(h, p) { let n = 0; for (const c of h) n += c; if (!n) return NaN; let t = p * (n - 1), acc = 0; for (let b = 0; b < HB; b++) { acc += h[b]; if (acc > t) return hval(b); } return hval(HB - 1); }
function groupStats(ships) {
  const groups = {};
  const blank = () => ({ships: 0, sec: 0, rev: 0, secS: 0, revS: 0, ang: new Array(HB).fill(0), lin: new Array(HB).fill(0), angMax: 0, linMax: 0,
    held: 0, flying: 0, shuttleMax: 0, shuttleShips: 0, spinsBig: 0, spinSecondsBig: 0, turnRatioMax: null, accRatioMax: null, decRatioMax: null,
    bankSum: 0, bankN: 0, over: [], settle: [], slideSum: 0, slideN: 0, burnSum: 0, burnN: 0});
  const add = (key, s) => {
    const g = groups[key] || (groups[key] = blank());
    g.ships++; g.sec += s.seconds; g.rev += s.reversals.length; g.secS += s.secondsStrict; g.revS += s.reversalsStrict ? s.reversalsStrict.length : 0;
    for (const x of s.jerk.ang) { g.ang[hbin(x)]++; if (x > g.angMax) g.angMax = x; }
    for (const x of s.jerk.lin) { g.lin[hbin(x)]++; if (x > g.linMax) g.linMax = x; }
    g.held += s.hold.held; g.flying += s.hold.flying;
    g.shuttleMax = Math.max(g.shuttleMax, s.shuttleWorst.share); if (s.shuttleWorst.share > .05) g.shuttleShips++;
    if (s.slen >= 80) { g.spinsBig += s.spins.length; g.spinSecondsBig += s.spins.reduce((t, x) => t + x.seconds, 0); }
    if (s.limits && s.limits.samples > 30) for (const k of ['turnRatio', 'accRatio', 'decRatio']) g[k + 'Max'] = Math.max(g[k + 'Max'] ?? 0, s.limits[k]);
    if (Number.isFinite(s.turn.bankRate)) { g.bankSum += s.turn.bankRate; g.bankN++; }
    for (const st of s.turn.steps) { g.over.push(+st.over.toFixed(2)); if (Number.isFinite(st.settle)) g.settle.push(+st.settle.toFixed(2)); }
    if (Number.isFinite(s.turn.slideShare)) { g.slideSum += s.turn.slideShare; g.slideN++; }
    if (Number.isFinite(s.turn.burnShare)) { g.burnSum += s.turn.burnShare; g.burnN++; }
  };
  for (const s of ships) { add('class:' + s.cls, s); add('fleet:' + s.race + ':' + s.cls, s); add('fleet:' + s.race, s); add('all', s); }
  return groups;
}
function mergeGroups(list) {
  const out = {};
  for (const groups of list) for (const [key, g] of Object.entries(groups)) {
    const o = out[key];
    if (!o) { out[key] = JSON.parse(JSON.stringify(g)); continue; }
    for (const k of ['ships', 'sec', 'rev', 'secS', 'revS', 'held', 'flying', 'shuttleShips', 'spinsBig', 'spinSecondsBig', 'bankSum', 'bankN', 'slideSum', 'slideN', 'burnSum', 'burnN']) o[k] += g[k];
    for (let b = 0; b < HB; b++) { o.ang[b] += g.ang[b]; o.lin[b] += g.lin[b]; }
    for (const k of ['angMax', 'linMax', 'shuttleMax']) o[k] = Math.max(o[k], g[k]);
    for (const k of ['turnRatioMax', 'accRatioMax', 'decRatioMax']) if (g[k] != null) o[k] = Math.max(o[k] ?? 0, g[k]);
    o.over.push(...g.over); o.settle.push(...g.settle);
  }
  return out;
}
function finalize(groups) {
  const out = {};
  for (const [key, g] of Object.entries(groups)) out[key] = {ships: g.ships, minutes: +(g.sec / 60).toFixed(2), reversals: g.rev, perMin: g.sec ? g.rev / (g.sec / 60) : 0,
    strictMinutes: +(g.secS / 60).toFixed(2), strictReversals: g.revS, strictPerMin: g.secS ? g.revS / (g.secS / 60) : 0,
    shuttleMax: g.shuttleMax, shuttleShips: g.shuttleShips,
    angJerk: {p50: hq(g.ang, .5), p95: hq(g.ang, .95), max: g.angMax}, linJerk: {p50: hq(g.lin, .5), p95: hq(g.lin, .95), max: g.linMax},
    holdShare: g.flying ? g.held / g.flying : 0, flyingMinutes: +(g.flying / 60).toFixed(2), spinsBig: g.spinsBig, spinSecondsBig: g.spinSecondsBig,
    turnRatioMax: g.turnRatioMax, accRatioMax: g.accRatioMax, decRatioMax: g.decRatioMax,
    bankRate: g.bankN ? g.bankSum / g.bankN : null, overshootP50: q(g.over, .5), overshootP90: q(g.over, .9), settleP50: q(g.settle, .5),
    slideShare: g.slideN ? g.slideSum / g.slideN : null, burnShare: g.burnN ? g.burnSum / g.burnN : null};
  return out;
}

/* Compact 10 Hz log of a record for plotting and the watch page. */
function compactLog(rec, every = 3, opts = {}) {
  const ships = [];
  for (let i = 0; i < rec.tracks.length; i++) {
    const tr = rec.tracks[i]; if (!tr) continue; const m = rec.meta[i];
    if (opts.keep && !opts.keep(m)) continue;
    const cols = {x: [], y: [], z: [], yaw: [], v: [], roll: [], f: [], m: []};
    let first = -1;
    for (let k = 0; k < rec.n; k += every) {
      const o = k * rec.F;
      if (Number.isNaN(tr[o])) { if (first >= 0) { for (const c of Object.values(cols)) c.push(null); } continue; }
      if (first < 0) first = k;
      cols.x.push(Math.round(tr[o])); cols.y.push(Math.round(tr[o + 1])); cols.z.push(Math.round(tr[o + 2]));
      cols.yaw.push(+tr[o + 3].toFixed(3)); cols.v.push(+tr[o + 6].toFixed(1)); cols.roll.push(+tr[o + 5].toFixed(2));
      cols.f.push(tr[o + 11]); cols.m.push(tr[o + 12]);
    }
    if (first < 0) continue;
    ships.push({...m, first, ...cols});
  }
  return {dt: every / 30, n: Math.ceil(rec.n / every), t0: rec.t[0], ships, modes: MODES};
}

module.exports = {F, FIELD, FLAG, MODES, CLASSES, SMALL, BAND, SIG_KEYS, FEATURES, installMotionRecorder, shipSeries, reversals, shuttle, jerks, spins, speedHolds,
  turnPhysics, capitalLimits, signature, cohesion, individuality, featureRows, classify, analyse, groupStats, mergeGroups, finalize, compactLog, q, mean, wrap};
