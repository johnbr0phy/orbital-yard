#!/usr/bin/env node
/* Deterministic Tribute War benchmark.
   Usage: node scripts/bench-tribute.cjs [--sizes 200,600,1200] [--seconds 30]
          [--url http://localhost:8790/armada-war-tribute-new.html] [--out file.json]
          [--matchup 5,6] [--seed 1234] [--tier medium] [--label before]

   Fixed seed, fixed fleets (default Empire vs Rebels), battle size = total
   ships requested (perFleet = size/2, the report shows the real count), and a
   scripted camera path relative to the battle's own bounds. Frame times come
   from requestAnimationFrame deltas inside the page. Sim / AI / collision /
   traffic splits come from wrapping the page's global functions, so the same
   script measures the page before and after changes. Wrappers add a small
   overhead; splits are comparative, not absolute.

   Wall-clock phases: 0-10 s wide orbit, 10-20 s medium pass, 20+ s close
   hold on the largest live ship. Pass --headed on a machine with a real GPU.

   The GPU is whatever Chromium gets. In this repo's CI container that is
   SwiftShader (software). The report records the WebGL renderer string so a
   software run can never be mistaken for a GPU run. */
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const sizes = arg('sizes', '200,600,1200').split(',').map(Number);
const seconds = +arg('seconds', 30);
const matchup = arg('matchup', '5,6').split(',').map(Number);
const seed = +arg('seed', 1234);
const label = arg('label', 'run');
const tier = arg('tier', '');
const root = path.resolve(__dirname, '..');

function serve() {
  const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.mjs':'text/javascript'};
  const server = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store'});
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

const pct = (a, q) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

async function runOne(browser, base, size) {
    const [vw, vh] = arg('viewport', '1280x720').split('x').map(Number);
  const page = await browser.newPage({viewport: {width: vw, height: vh}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  // Fonts come from Google; a blocked network must not stall the page.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route(/goatcounter|gc\.zgo\.at/, r => r.abort());
  const q = new URLSearchParams({bench: '1', ...(tier ? {quality: tier} : {})});
  await page.goto(base + '?' + q.toString());
  await page.waitForFunction(() => typeof startWar === 'function' && typeof simStep === 'function');
  const info = await page.evaluate(({a, b, per, seed}) => {
    const gl = document.getElementById('gl').getContext('webgl2');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const B = window.__bench = {t0: performance.now(), frames: [], firstShip: null, playable: null, longTasks: [],
      split: {frameJs: 0, sim: 0, collide: 0, traffic: 0, ai: 0, worker: 0}, splitFrames: 0, heap: [], camPhase: ''};
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) B.longTasks.push({t: e.startTime - B.t0, d: e.duration}); }).observe({type: 'longtask', buffered: false}); } catch (e) {}
    const wrap = (name, key) => {
      const f = window[name]; if (typeof f !== 'function') return;
      window[name] = function () { const t = performance.now(); try { return f.apply(this, arguments); } finally { B.split[key] += performance.now() - t; } };
    };
    wrap('simStep', 'sim'); wrap('collide', 'collide'); wrap('trafficPilot', 'traffic'); wrap('prepareTraffic', 'traffic'); wrap('debrisPilot', 'traffic');
    wrap('squadThink', 'ai'); wrap('frame', 'frameJs'); wrap('onWorkerMsg', 'worker');
    if (typeof battleAI === 'object') for (const k of ['index', 'destination']) { const f = battleAI[k].bind(battleAI); battleAI[k] = function () { const t = performance.now(); try { return f.apply(null, arguments); } finally { B.split.ai += performance.now() - t; } }; }
    // Workers were created with onWorkerMsg captured; route through the wrapper.
    // Scripted camera: wide orbit, medium pass, close hold on the largest live ship.
    const camFn = (now) => {
      if (!Number.isFinite(warT0)) return;
      const bt = now - warT0, t = B.warStart != null ? (performance.now() - B.t0 - B.warStart) / 1000 : 0, live = ships.filter(s => !s.dead && s.vao && bt - s.delay >= 0);
      if (!live.length) return;
      let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const s of live) { const p = [s.x, s.y, s.z]; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); } }
      const c = lo.map((v, i) => (v + hi[i]) / 2), R = Math.max(800, Math.hypot(hi[0] - lo[0], hi[2] - lo[2]) / 2);
      let eye, look = c, phase;
      if (t < 10) { phase = 'wide'; const a = t * .05; eye = [c[0] + Math.cos(a) * R * 1.9, c[1] + R * .55, c[2] + Math.sin(a) * R * 1.9]; }
      else if (t < 20) { phase = 'medium'; const a = 1 + t * .08; eye = [c[0] + Math.cos(a) * R * .7, c[1] + R * .2, c[2] + Math.sin(a) * R * .7]; }
      else { phase = 'close'; const s = live.reduce((m, q) => q.slen > m.slen ? q : m, live[0]); const d = Math.max(60, s.slen * 2.4), a = t * .12; look = [s.x, s.y, s.z]; eye = [s.x + Math.cos(a) * d, s.y + d * .35, s.z + Math.sin(a) * d]; }
      B.camPhase = phase;
      cam.ex = eye[0]; cam.ey = eye[1]; cam.ez = eye[2];
      const dx = look[0] - eye[0], dy = look[1] - eye[1], dz = look[2] - eye[2];
      cam.yaw = Math.atan2(dz, dx); cam.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      watchGoal = {far: R * 6};
    };
    window.updateWatchCamera = (now) => camFn(now);
    if (typeof updateActionCamera === 'function') window.updateActionCamera = (now) => camFn(now);
    let last = 0;
    const tick = (ts) => {
      requestAnimationFrame(tick);
      if (last) B.frames.push({t: ts - B.t0, d: ts - last, phase: B.camPhase, live: Number.isFinite(warT0)});
      last = ts;
      if (B.firstShip == null && Number.isFinite(warT0) && ships.some(s => s.vao && !s.dead && battleTime - warT0 - s.delay >= 0)) B.firstShip = ts - B.t0;
      if (B.playable == null && Number.isFinite(warT0) && forged >= total) B.playable = ts - B.t0;
      if (performance.memory && B.frames.length % 30 === 0) B.heap.push(performance.memory.usedJSHeapSize);
    };
    requestAnimationFrame(tick);
    if (typeof endIntro === 'function') window.beginIntro = () => false;
    B.t0 = performance.now();
    pickMain = [a, b]; pickAlly = [-1, -1]; perFleet = per; warSeed = seed;
    document.getElementById('pick').classList.remove('on');
    startWar(false);
    return {renderer, timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'), dpr: devicePixelRatio, w: innerWidth, h: innerHeight};
  }, {a: matchup[0], b: matchup[1], per: Math.round(size / 2), seed});
  // Worker messages captured the original onWorkerMsg reference; re-point them.
  await page.evaluate(() => { for (const w of (window.workers || (typeof workers !== 'undefined' ? workers : []))) w.onmessage = e => onWorkerMsg(e); });
  await page.waitForFunction(() => Number.isFinite(warT0), null, {timeout: 600000, polling: 250});
  await page.evaluate(() => { const B = window.__bench; B.warStart = performance.now() - B.t0; B.split = {frameJs: 0, sim: 0, collide: 0, traffic: 0, ai: 0, worker: B.split.worker}; B.battleStartFrame = B.frames.length; B.bt0 = battleTime; });
  await page.waitForTimeout(seconds * 1000);
  const r = await page.evaluate(() => {
    const B = window.__bench, f = B.frames.slice(B.battleStartFrame);
    return {frames: f, split: B.split, firstShip: B.firstShip, playable: B.playable, warStart: B.warStart,
      longTasks: B.longTasks, heap: B.heap, ships: ships.length, alive: ships.filter(s => !s.dead).length,
      simSeconds: battleTime - B.bt0, stats: typeof perfStats === 'function' ? perfStats() : null};
  });
  await page.close();
  const d = r.frames.map(x => x.d), byPhase = {};
  for (const ph of ['wide', 'medium', 'close']) { const a = r.frames.filter(x => x.phase === ph).map(x => x.d); byPhase[ph] = {n: a.length, p50: pct(a, .5), p95: pct(a, .95), p99: pct(a, .99)}; }
  const wall = d.reduce((a, b) => a + b, 0);
  const arrivalsLong = r.longTasks.filter(x => x.t >= r.warStart && x.t < r.warStart + 15000);
  return {size, ships: r.ships, alive: r.alive, frames: d.length, fps: d.length / (wall / 1000),
    p50: pct(d, .5), p95: pct(d, .95), p99: pct(d, .99), byPhase,
    simSecondsPerWallSecond: r.simSeconds / (wall / 1000),
    splitMsPerFrame: Object.fromEntries(Object.entries(r.split).map(([k, v]) => [k, v / Math.max(1, d.length)])),
    firstShipMs: r.firstShip, playableMs: r.playable, warStartMs: r.warStart,
    longTasks: r.longTasks.length, longTasksDuringArrivals: arrivalsLong.length, maxLongTaskMs: Math.max(0, ...r.longTasks.map(x => x.d)),
    heapStartMB: r.heap.length ? r.heap[0] / 1048576 : null, heapEndMB: r.heap.length ? r.heap[r.heap.length - 1] / 1048576 : null,
    pageStats: r.stats, errors, viewport: arg('viewport', '1280x720')};
}

(async () => {
  const server = await serve();
  const base = arg('url', `http://localhost:${server.address().port}/armada-war-tribute-new.html`);
  const browser = await chromium.launch({headless: !process.argv.includes('--headed'), executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-precise-memory-info', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']});
  const out = {label, date: new Date().toISOString(), seed, matchup, seconds, runs: []};
  try {
    for (const size of sizes) {
      const r = await runOne(browser, base, size);
      out.runs.push(r);
      console.error(`[${label}] ${size}: ${r.ships} ships, ${r.fps.toFixed(1)} fps, p50 ${r.p50.toFixed(1)} p95 ${r.p95.toFixed(1)} p99 ${r.p99.toFixed(1)} ms, first ship ${Math.round(r.firstShipMs)} ms, errors ${r.errors.length}`);
    }
    const page = await browser.newPage();
    await page.goto(base);
    out.renderer = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const d = gl && gl.getExtension('WEBGL_debug_renderer_info'); return gl ? (d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) : 'none'; });
    out.software = /swiftshader|llvmpipe|software/i.test(out.renderer);
  } finally { await browser.close(); server.close(); }
  const file = arg('out', null);
  if (file) fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out.runs.map(({byPhase, errors, pageStats, ...r}) => ({...r, errors: errors.slice(0, 3)})), null, 1));
  console.log('renderer:', out.renderer, out.software ? '(SOFTWARE)' : '(GPU)');
})().catch(e => { console.error(e); process.exit(1); });
