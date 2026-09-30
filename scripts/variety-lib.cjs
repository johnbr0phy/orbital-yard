/* Fleet variety measurement (VARIETY.md). Forges the page's real hulls
   headless, through the forge worker's own job handler, and reduces each
   hull to a silhouette signature: top, side and front occupancy masks of
   the actual battle mesh. Reads the page only; draws no random numbers the
   page would see. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const NAMES = ['Yard','Shoal','Lattice','Drift','Choir','Imperial','Rebel','Minbari','Shadows','EarthForce','Federation','Klingon','Borg','Mondoshawan','USCM','Engineers','Yautja','First Ones','Romulans','Dominion','Space Marines','Tyranids','Tesla'];
const BANDS = ['small','escort','capital'];
const N = 32;             // mask resolution per view
const SUB = 2;            // supersampling per mask cell

/* The page's normal hulls in the originals carry a generated ship name
   before the class ("PHAGE-BROOD MEDUSA"); the class is the type after it.
   Named refits of one class (the Klingon F5) are one class with variants. */
function classKey(race, klass) {
  let k = String(klass || '');
  if (race <= 4) k = k.replace(/^\S+-(CLASS|BROOD|GROWTH|LASH|VOICE)\s+/, '');
  k = k.replace(/\s*\((CARGO|BATTLE|SCIENCE)[^)]*REFIT\)\s*$/, '');
  return k;
}

function loadForge(root) {
  const html = fs.readFileSync(path.join(root, 'armada-war-tribute-new.html'), 'utf8');
  const {loadBattle} = require(path.join(root, 'tests/tribute-new/headless-battle.cjs'));
  const page = loadBattle();
  const prefix = html.slice(html.indexOf('\n<script>\n') + 10, html.indexOf('//__ARMADA_WORKER_CUT__'));
  let result = null;
  const worker = vm.createContext({console, postMessage: r => { result = r; }});
  vm.runInContext(prefix + page.run('fractureMesh.toString()+WORKER_MAIN'), worker);
  page.run('postForgeJobs=j=>{globalThis.__varietyJobs=j};');
  const wrun = s => vm.runInContext(s, worker);
  // The real muster: every job the page deals one side of a war.
  function muster(race, warSeed, size) {
    const other = race === 0 ? 1 : 0;
    page.run(`pickMain=[${race},${other}];pickAlly=[-1,-1];perFleet=${size};warSeed=${warSeed};startWar(false);`);
    return JSON.parse(page.run('JSON.stringify(__varietyJobs.filter(j=>ships[j.id].side===0).map(j=>({id:j.id,seed:j.seed,f:j.f,hulls:j.hulls,band:j.band,hero:!!j.hero})))'));
  }
  let gen = 1;
  // One job through the forge worker's own handler (band re-cuts, refit, arm, pack).
  function forge(job) {
    result = null;
    const t0 = process.hrtime.bigint();
    worker.__job = job;
    vm.runInContext(`onmessage({data:{kind:'batch',genId:${gen++},jobs:[__job]}})`, worker);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const s = result.out[0];
    // Study quality (the ship study and model review use q=.65).
    // the same hull the forge dealt: its seed after band re-cuts, and its band
    const study = wrun(`(()=>{const s=raceBuild(${job.f},${s.seed >>> 0},${job.hulls || 0},${!!job.hero},${job.band == null ? 'undefined' : job.band});armShip(s,${job.f},${job.hulls || 0});seatShipAssemblies(s,${job.f});return shipMeshQ(s,.65).tris;})()`);
    return {out: s, ms, study};
  }
  return {muster, forge, page, worker, wrun, html};
}

/* ---------------- silhouette signature ---------------- */
function rasterView(v, idx, a, b, lo, S, grid) {
  const R = N * SUB, fine = new Uint8Array(R * R);
  const cu = lo[a], cv = lo[b];
  const px = x => (x - cu) / S * R, py = y => (y - cv) / S * R;
  for (let t = 0; t < idx.length; t += 3) {
    const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
    const x0 = px(v[i0 + a]), y0 = py(v[i0 + b]), x1 = px(v[i1 + a]), y1 = py(v[i1 + b]), x2 = px(v[i2 + a]), y2 = py(v[i2 + b]);
    // vertices always mark their cell, so slivers and spars still register
    for (const [x, y] of [[x0, y0], [x1, y1], [x2, y2]]) {
      const cx = Math.min(R - 1, Math.max(0, x | 0)), cy = Math.min(R - 1, Math.max(0, y | 0)); fine[cy * R + cx] = 1;
    }
    const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(R - 1, Math.ceil(Math.max(x0, x1, x2)));
    const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(R - 1, Math.ceil(Math.max(y0, y1, y2)));
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const qx = x + .5, qy = y + .5;
      const w0 = (x1 - qx) * (y2 - qy) - (x2 - qx) * (y1 - qy);
      const w1 = (x2 - qx) * (y0 - qy) - (x0 - qx) * (y2 - qy);
      const w2 = (x0 - qx) * (y1 - qy) - (x1 - qx) * (y0 - qy);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) fine[y * R + x] = 1;
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let on = 0;
    for (let dy = 0; dy < SUB; dy++) for (let dx = 0; dx < SUB; dx++) on |= fine[(y * SUB + dy) * R + x * SUB + dx];
    grid[y * N + x] = on;
  }
}
/* Three orthographic views, all fitted isotropically to the hull's largest
   extent and centred: scale drops out, proportion and plan stay in. */
function signature(mesh) {
  const v = mesh.v, idx = mesh.i;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) for (let d = 0; d < 3; d++) { if (v[i + d] < lo[d]) lo[d] = v[i + d]; if (v[i + d] > hi[d]) hi[d] = v[i + d]; }
  const ext = hi.map((h, d) => h - lo[d]), S = Math.max(...ext) * 1.0001 || 1;
  const org = lo.map((l, d) => l + ext[d] / 2 - S / 2);
  const sig = new Uint8Array(3 * N * N);
  rasterView(v, idx, 0, 2, org, S, sig.subarray(0, N * N));          // top: length x beam
  rasterView(v, idx, 0, 1, org, S, sig.subarray(N * N, 2 * N * N));  // side: length x height
  rasterView(v, idx, 2, 1, org, S, sig.subarray(2 * N * N));         // front: beam x height
  return sig;
}
const pack = sig => Buffer.from(sig).toString('base64');
/* Signatures are compared bit-packed: 3 views x 32 words of 32 cells. */
const W = N * N / 32;
function bits(u8) {
  const out = new Uint32Array(3 * W);
  for (let i = 0; i < u8.length; i++) if (u8[i]) out[i >>> 5] |= 1 << (i & 31);
  return out;
}
const unpack = s => bits(new Uint8Array(Buffer.from(s, 'base64')));
const pop = v => { v = v - ((v >>> 1) & 0x55555555); v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
// 1 - IoU, averaged over the three views. Takes packed (unpack/bits) or raw signatures.
function distance(a, b) {
  if (!(a instanceof Uint32Array)) a = bits(a);
  if (!(b instanceof Uint32Array)) b = bits(b);
  let d = 0;
  for (let view = 0; view < 3; view++) {
    let inter = 0, uni = 0;
    for (let i = view * W, e = i + W; i < e; i++) { const x = a[i], y = b[i]; inter += pop(x & y); uni += pop(x | y); }
    d += uni ? 1 - inter / uni : 0;
  }
  return d / 3;
}
function meshHash(mesh) {
  let h = 2166136261 >>> 0;
  const mix = x => { h ^= x; h = Math.imul(h, 16777619) >>> 0; };
  const f = new Uint32Array(mesh.v.buffer, mesh.v.byteOffset, mesh.v.length);
  for (let i = 0; i < f.length; i++) mix(f[i]);
  for (let i = 0; i < mesh.i.length; i++) mix(mesh.i[i]);
  return h.toString(16).padStart(8, '0') + ':' + mesh.v.length + ':' + mesh.i.length;
}

/* ---------------- statistics ---------------- */
const median = xs => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (xs, q) => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

/* Complete-linkage agglomerative clustering at a fixed distance: every
   member of a cluster is within `cut` of every other member, so a cluster
   is one silhouette in the strict sense. Deterministic (ties by index). */
function clusters(sigs, cut) {
  const n = sigs.length; if (!n) return [];
  const D = new Float32Array(n * n);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) D[i * n + j] = D[j * n + i] = distance(sigs[i], sigs[j]);
  const alive = new Uint8Array(n).fill(1), members = Array.from({length: n}, (_, i) => [i]);
  // nearest-neighbour cache per active cluster
  const nn = new Int32Array(n), nd = new Float32Array(n);
  const refresh = i => { let b = -1, bd = Infinity; for (let j = 0; j < n; j++) if (j !== i && alive[j] && D[i * n + j] < bd) { bd = D[i * n + j]; b = j; } nn[i] = b; nd[i] = bd; };
  for (let i = 0; i < n; i++) refresh(i);
  for (;;) {
    let a = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (alive[i] && nd[i] < best) { best = nd[i]; a = i; }
    if (a < 0 || best > cut) break;
    const b = nn[a];
    // merge b into a: complete linkage keeps the farthest distance
    for (let j = 0; j < n; j++) if (alive[j] && j !== a && j !== b) { const d = Math.max(D[a * n + j], D[b * n + j]); D[a * n + j] = D[j * n + a] = d; }
    alive[b] = 0; members[a] = members[a].concat(members[b]); members[b] = null;
    for (let i = 0; i < n; i++) if (alive[i] && (i === a || nn[i] === a || nn[i] === b)) refresh(i);
  }
  return members.filter(Boolean);
}

module.exports = {NAMES, BANDS, N, classKey, loadForge, signature, pack, unpack, bits, distance, meshHash, median, quantile, clusters};
