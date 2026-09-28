/* The audio scene set: shared by scripts/capture-audio.cjs (--scene, WAV) and
   scripts/capture-clip.cjs (--scene, WebM) so the picture and the sound of a
   scene come from the same war, stepped the same way, with the same camera.

   Determinism. The war is seeded and stepped at exactly 1/30 s per tick through
   the page's own war clock (slow motion included). performance.now() is a
   virtual clock advanced 1/30 s per tick, and Math.random is a seeded stream, so
   a scene replays identically, with or without rendering. The camera is set by
   the scene script before each tick; Broadcast and cockpit scenes use the page's
   own cameras. Replays are suppressed (a replay would stop the war clock).

   Audio. The page's audio engine is created on an OfflineAudioContext and the
   render is suspended at every tick, the page's per-frame audio update runs,
   pending sample decodes are awaited, and the render resumes. So audio is
   sample-accurate to the picture and independent of machine speed.

   Scenes live in bench/audio/scenes.json (written by scripts/audio-pick-scenes.cjs
   from probe runs). */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const SCENES = path.join(root, 'bench/audio/scenes.json');
const loadScenes = () => JSON.parse(fs.readFileSync(SCENES, 'utf8'));

function serve(dir) {
  return new Promise(r => { const s = http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    const type = p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    res.writeHead(200, {'content-type': type}); fs.createReadStream(p).pipe(res);
  }); s.listen(0, () => r(s)); });
}

// dir: the checkout to serve (a worktree of the old build for "before" captures).
async function openPage({video = false, width = 960, height = 540, quality = 'low', dir = root} = {}) {
  const server = await serve(dir);
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
  const page = await browser.newPage({viewport: {width, height}});
  page.__errors = []; page.on('pageerror', e => page.__errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, r => r.abort());
  await page.addInitScript(() => {
    // Seeded Math.random (mulberry32): look-only effects and audio variation replay identically.
    let s = 0x9e3779b9; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const real = performance.now.bind(performance); window.__realNow = real; window.__vt = null;
    performance.now = () => window.__vt != null ? window.__vt : real();
  });
  await page.goto(`http://localhost:${server.address().port}/armada-war-tribute-new.html?autostart=0&quality=${quality}`);
  await page.waitForFunction(() => typeof startWar === 'function');
  return {browser, page, server};
}

// Starts the war, fast-forwards to cfg.t0 (battle seconds) and installs window.__sceneStep.
async function startWar(page, cfg) {
  await page.evaluate(({matchup, seed, size}) => {
    window.requestAnimationFrame = () => 0;
    pickMain = matchup; pickAlly = [-1, -1]; perFleet = size; warSeed = seed;
    document.getElementById('warMenu').hidden = true; document.body.classList.remove('menu-start');
    startWar(false); window.__t = 1000; lastT = 0;
  }, cfg);
  await page.waitForFunction(() => { frame(window.__t += 33.333); return Number.isFinite(warT0); }, null, {timeout: 600000, polling: 50});
  await page.evaluate(() => {
    if (typeof endIntro === 'function' && intro && !intro.done) endIntro();
    window.__vt = 1e6; watchMode = 'scripted'; sel = null; orb = null;
    let acc = 0;
    // One tick = 1/30 s of wall time through the war clock, exactly as frame() steps it.
    window.__sceneTick = () => {
      window.__vt += 1000 / 30; bc.autoReplay = null;
      acc += warClock.advance(1 / 30); let n = 0;
      while (acc >= 1 / 30 && n < 2) { capturePrevious(); battleTime += 1 / 30; simStep(battleTime, 1 / 30); introStep(battleTime, 1 / 30); acc -= 1 / 30; n++; }
      acc = Math.min(acc, 1 / 30);
      if (n) broadcastTick(battleTime, n / 30);
      if (replayState) endReplay();
      return n;
    };
    // Plain stepping for fast-forward and probes (no war clock, no slow motion).
    window.__sceneStep = () => { capturePrevious(); battleTime += 1 / 30; simStep(battleTime, 1 / 30); introStep(battleTime, 1 / 30); broadcastTick(battleTime, 1 / 30); bc.autoReplay = null; if (replayState) endReplay(); };
  });
  if (cfg.t0) await page.evaluate(t0 => { while (battleTime - warT0 < t0) window.__sceneStep(); }, cfg.t0);
}

/* Camera scripts, run in the page before each tick (T = battle seconds since warT0):
   parked  {eye:[x,y,z], look:[x,y,z]}               a fixed camera and a fixed gaze
   ride    {ship, back, up, ahead}                    rides behind a ship (the chase framing)
   path    {keys:[{t,eye,look}...]}                  eye and gaze interpolated linearly through dense keys
   broadcast {}                                       the page's own Broadcast director
   pilot   {ship, keys:[{t,down:[...],up:[...]}]}     Take control of a ship; keys pressed by time */
function installCamera(page, camSpec) {
  return page.evaluate(spec => {
    const look = (e, l) => { cam.ex = e[0]; cam.ey = e[1]; cam.ez = e[2]; const d = [l[0] - e[0], l[1] - e[1], l[2] - e[2]]; cam.yaw = Math.atan2(d[2], d[0]); cam.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); };
    const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
    if (spec.type === 'broadcast') { watchMode = 'broadcast'; directorAt = 0; actionCamera = null; if (bc.director) bc.director.reset(); updateWatchCamera(battleTime, 1, true); }
    if (spec.type === 'pilot') { sel = spec.ship; setWatchView('fly'); }
    let prev = null;
    window.__sceneCamera = () => {
      const T = battleTime - warT0;
      camKick = 0;
      if (spec.type === 'parked') look(spec.eye, spec.look);
      else if (spec.type === 'path') {
        const k = spec.keys; let i = 0; while (i < k.length - 2 && T > k[i + 1].t) i++;
        const u = Math.max(0, Math.min(1, (T - k[i].t) / Math.max(1e-6, k[i + 1].t - k[i].t)));
        look(lerp(k[i].eye, k[i + 1].eye, u), lerp(k[i].look, k[i + 1].look, u));
      } else if (spec.type === 'ride') {
        const s = ships[spec.ship]; if (s && !s.dead) {
          const f = [Math.cos(s.yaw) * Math.cos(s.pitch || 0), Math.sin(s.pitch || 0), Math.sin(s.yaw) * Math.cos(s.pitch || 0)];
          const want = [s.x - f[0] * spec.back, s.y - f[1] * spec.back + spec.up, s.z - f[2] * spec.back];
          prev = prev ? prev.map((v, i) => v + (want[i] - v) * .25) : want;
          look(prev, [s.x + f[0] * spec.ahead, s.y + f[1] * spec.ahead, s.z + f[2] * spec.ahead]);
        }
      } else if (spec.type === 'pilot') {
        for (const k of spec.keys || []) if (Math.abs(T - k.t) < 1 / 60) { for (const d of k.down || []) keys.add(d); for (const d of k.up || []) keys.delete(d); }
      }
    };
    window.__sceneCamera();
  }, camSpec);
}

module.exports = {root, SCENES, loadScenes, serve, openPage, startWar, installCamera};
