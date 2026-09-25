#!/usr/bin/env node
/* Before/after screenshot gallery for design/tribute-new/review.
   node scripts/capture-gallery.cjs [--before 7d08976] [--quality high]

   Three seeded matchups, fixed simulation times, a scripted camera (a wide
   view of every arrived ship and a close orbit of the largest one), HUD
   hidden for the graphics comparison. The "before" page is the original
   commit's armada-war-tribute-new.html served beside the current scripts.
   The simulation is stepped directly, then frozen, so both pages show the
   same moment. Hull seeds can differ slightly where the forge changed
   (deterministic band probe), so compare looks, not ship-for-ship layouts.
   Chromium here renders with SwiftShader (software). */
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), {execSync} = require('node:child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '..'), out = path.join(root, 'design/tribute-new/review');
const before = arg('before', '7d08976'), quality = arg('quality', 'high');
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(root, '.gallery-before.html'), execSync(`git show ${before}:armada-war-tribute-new.html`, {cwd: root}));
const MATCHUPS = [
  {id: 'empire-rebels', a: 5, b: 6, seed: 77, size: 60},
  {id: 'borg-federation', a: 12, b: 10, seed: 5, size: 60},
  {id: 'shadows-minbari', a: 8, b: 7, seed: 99, size: 60}
];
const TIMES = [6, 35, 70];

function serve() {
  return new Promise(r => { const s = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'});
    fs.createReadStream(p).pipe(res);
  }); s.listen(0, () => r(s)); });
}

async function capture(browser, base, file, m, tag) {
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, r => r.abort());
  await page.goto(`${base}/${file}?autostart=0&quality=${quality}`);
  await page.waitForFunction(() => typeof startWar === 'function');
  await page.addStyleTag({content: '.hud,#watchDock,#battleOptions,#bcTop,#bcFeed,#bcTicker,#bcCaption,#bcMomentum,#bcMomentumLabel,#bcSpeed,#bcReplayChip,#warMenu,#card,#toast{display:none!important}'});
  await page.evaluate(({a, b, seed, size}) => { pickMain = [a, b]; pickAlly = [-1, -1]; perFleet = size; warSeed = seed; document.getElementById('pick').classList.remove('on'); startWar(false); }, m);
  await page.waitForFunction(() => Number.isFinite(warT0), null, {timeout: 300000});
  await page.evaluate(() => { if (typeof endIntro === 'function' && intro && !intro.done) endIntro(); window.updateWatchCamera = () => {}; window.updateActionCamera = () => {}; sel = null; pilotId = null; });
  const shots = [];
  let done = 0;
  for (const t of TIMES) {
    await page.evaluate(target => {
      while (battleTime - warT0 < target) { if (typeof capturePrevious === 'function') capturePrevious(); battleTime += 1 / 30; simStep(battleTime, 1 / 30); introStep(battleTime, 1 / 30); if (typeof broadcastTick === 'function') broadcastTick(battleTime, 1 / 30); }
      if (typeof capturePrevious === 'function') capturePrevious();
      battleAccumulator = -1e9; // frozen: frames render without stepping
    }, t);
    for (const view of ['wide', 'close']) {
      await page.evaluate(view => {
        const T = battleTime - warT0, live = ships.filter(s => !s.dead && s.vao && T - s.delay >= 0);
        let eye, look;
        if (view === 'wide') {
          const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
          for (const s of live) for (const [i, v] of [s.x, s.y, s.z].entries()) { lo[i] = Math.min(lo[i], v); hi[i] = Math.max(hi[i], v); }
          look = lo.map((v, i) => (v + hi[i]) / 2); const R = Math.max(600, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2), d = R / Math.sin(.44) * .9;
          eye = [look[0] - Math.cos(.65) * Math.cos(-.42) * d, look[1] + Math.sin(.42) * d, look[2] - Math.sin(.65) * Math.cos(-.42) * d];
        } else {
          const s = live.filter(q => !q.hero).sort((p, q) => q.slen - p.slen)[Math.min(2, live.length - 1)] || live[0];
          look = [s.x, s.y, s.z]; const d = Math.max(90, s.slen * 1.35);
          eye = [s.x + Math.cos(.9) * Math.cos(.32) * d, s.y + Math.sin(.32) * d, s.z + Math.sin(.9) * Math.cos(.32) * d];
        }
        cam.ex = eye[0]; cam.ey = eye[1]; cam.ez = eye[2];
        const dx = look[0] - eye[0], dy = look[1] - eye[1], dz = look[2] - eye[2];
        cam.yaw = Math.atan2(dz, dx); cam.pitch = Math.atan2(dy, Math.hypot(dx, dz)); watchGoal = {far: Math.hypot(dx, dy, dz) * 30};
      }, view);
      await page.waitForTimeout(1600);
      const name = `${m.id}-t${String(t).padStart(2, '0')}-${view}-${tag}.png`;
      await page.screenshot({path: path.join(out, name)});
      shots.push(name); done++;
    }
  }
  await page.close();
  return {shots, errors};
}

(async () => {
  const server = await serve(), base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const report = [];
  try {
    for (const m of MATCHUPS) for (const [file, tag] of [['.gallery-before.html', 'before'], ['armada-war-tribute-new.html', 'after']]) {
      const r = await capture(browser, base, file, m, tag);
      report.push({matchup: m.id, tag, ...r});
      console.error(m.id, tag, r.shots.length, 'shots', r.errors.length ? 'ERRORS ' + r.errors.join('; ') : '');
    }
  } finally { await browser.close(); server.close(); fs.rmSync(path.join(root, '.gallery-before.html'), {force: true}); }
  const rows = MATCHUPS.flatMap(m => TIMES.flatMap(t => ['wide', 'close'].map(v => `${m.id}-t${String(t).padStart(2, '0')}-${v}`)));
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tribute War review gallery</title>
<style>body{margin:0;background:#0b0f14;color:#dfe7ec;font:14px/1.5 system-ui;padding:16px}h1{font-size:22px}p{max-width:900px;color:#a9b6bf}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0}.row img{width:100%;border-radius:6px;display:block}h2{font-size:14px;margin:18px 0 0;color:#c8d4db}figcaption{font-size:12px;color:#8fa0aa}@media(max-width:700px){.row{grid-template-columns:1fr}}</style>
<h1>Tribute War: before and after</h1>
<p>Left: the original page (commit ${before}). Right: this pass (quality ${quality}). Same seeds, same simulation times, same scripted camera, HUD hidden. Both rendered by headless Chromium with SwiftShader (software), 1280×720. Hull seeds can differ slightly where the forge changed, so compare look rather than exact layout.</p>
${rows.map(r => `<h2>${r}</h2><div class="row"><figure><img loading="lazy" src="${r}-before.png" alt="${r} before"><figcaption>before</figcaption></figure><figure><img loading="lazy" src="${r}-after.png" alt="${r} after"><figcaption>after</figcaption></figure></div>`).join('\n')}
</html>`;
  fs.writeFileSync(path.join(out, 'index.html'), html);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
