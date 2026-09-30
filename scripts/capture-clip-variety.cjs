#!/usr/bin/env node
/* Variety scene mode of capture-clip.cjs:
     node scripts/capture-clip.cjs --variety v1 --label after [--dir ../orbital-yard-main] [--size 960x540]
   Records one scene of scripts/variety-scenes.cjs as a WebM (30 fps, frame by
   frame, exact 1/30 s steps) and a still, into
   design/tribute-new/review/variety/<label>/<id>.webm and <id>.jpg.
   --dir serves another checkout (a worktree of main for "before").
   Scene v8 records the ship study instead: every fleet's classes grouped by
   muster band, in clay, stepping through sisters. */
const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
const S = require('./audio-scenes.cjs');
const SC = require('./variety-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ffmpeg = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';

function encoder(file) {
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '1600k', '-crf', '14', '-auto-alt-ref', '0', file], {stdio: ['pipe', 'ignore', 'inherit']});
  return {write: async jpg => { if (!enc.stdin.write(jpg)) await new Promise(r => enc.stdin.once('drain', r)); }, end: async () => { enc.stdin.end(); await new Promise(r => enc.on('close', r)); }};
}

async function study(scene, outDir, dir, w, h) {
  const server = await S.serve(dir);
  const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const browser = await chromium.launch({headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: w, height: h + 260}});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${server.address().port}/tribute-new-models.html`);
  await page.waitForFunction(() => document.getElementById('status').textContent && !/Loading/.test(document.getElementById('status').textContent), null, {timeout: 120000});
  // Entries grouped by fleet, then by the band their length lands in (small, escort, capital).
  const order = await page.evaluate(() => {
    const sel = document.getElementById('model'), out = [];
    for (const o of sel.options) if (/sisters|working fleet hull|featured ship/.test(o.textContent) && !/capital \d/.test(o.textContent)) out.push({v: o.value, label: o.textContent});
    return out;
  });
  const file = path.join(outDir, `${scene.id}.webm`), enc = encoder(file);
  await page.selectOption('#finish', 'clay');
  let frames = 0, still = null;
  const rows = [];
  for (const e of order) {
    await page.selectOption('#model', e.v);
    const info = await page.evaluate(() => document.getElementById('status').textContent);
    rows.push({label: e.label, info});
  }
  const band = s => { const m = /· (\d+) m model length/.exec(s); const L = m ? +m[1] : 0; return L <= 42 ? 0 : L <= 95 ? 1 : 2; };
  const fleets = [...new Set(order.map(e => e.label.split(' · ')[0]))];
  for (const fleet of fleets) for (const b of [0, 1, 2]) for (let i = 0; i < order.length; i++) {
    if (order[i].label.split(' · ')[0] !== fleet || band(rows[i].info) !== b) continue;
    await page.selectOption('#model', order[i].v);
    for (let k = 0; k < 3; k++) {
      if (k) await page.click('#nextHull');
      const jpg = await page.locator('canvas').screenshot({type: 'jpeg', quality: 82});
      for (let r = 0; r < 6; r++) { await enc.write(jpg); frames++; }
      if (!still) still = jpg;
    }
  }
  await enc.end();
  if (still) fs.writeFileSync(path.join(outDir, `${scene.id}.jpg`), still);
  fs.writeFileSync(path.join(outDir, `${scene.id}.json`), JSON.stringify({scene: scene.id, name: scene.name, frames, seconds: +(frames / 30).toFixed(1), entries: order.length, errors}, null, 1));
  await browser.close(); server.close();
  console.log(scene.id, 'frames', frames, 'errors', errors.length);
}

(async () => {
  const id = arg('variety'), label = arg('label', 'after');
  const scene = SC.scenes.find(s => s.id === id); if (!scene) throw new Error('no variety scene ' + id);
  const dir = path.resolve(arg('dir', S.root));
  const outDir = path.join(S.root, 'design/tribute-new/review/variety', label);
  fs.mkdirSync(outDir, {recursive: true});
  const [w, h] = arg('size', '960x540').split('x').map(Number);
  if (scene.study) return study(scene, outDir, dir, w, h);
  const {browser, page, server} = await S.openPage({video: true, width: w, height: h, quality: arg('quality', scene.quality || 'high'), dir});
  await S.startWar(page, {matchup: scene.matchup, seed: scene.seed, size: scene.size});
  await page.evaluate(t => { while (battleTime - warT0 < t) window.__sceneStep(); }, scene.from);
  if (scene.camera.type === 'broadcast') await S.installCamera(page, {type: 'broadcast'});
  else await page.evaluate(({cam: cfg, focus}) => {
    const pick = () => focus === 'all' ? ships.map(s => s.id) : focus === 'side0' ? ships.filter(s => s.side === 0).map(s => s.id) : focus === 'side1' ? ships.filter(s => s.side === 1).map(s => s.id) : (0, eval)(focus);
    let ids = pick(), eye = null, at = null, ang = cfg.start;
    window.__sceneCamera = () => {
      camKick = 0;
      const live = ids.map(i => ships[i]).filter(s => s && !s.dead && s.arr && s.vao);
      if (!live.length) { ids = pick(); return; }
      let x = 0, y = 0, z = 0; for (const s of live) { x += s.x; y += s.y; z += s.z; } x /= live.length; y /= live.length; z /= live.length;
      const d = live.map(s => Math.hypot(s.x - x, s.z - z)).sort((a, b) => a - b), spread = Math.max(400, d[Math.floor(d.length * .85)] || 400);
      ang += cfg.speed / 30;
      const R = spread * 2 * cfg.dist, e = [x + Math.cos(ang) * R, y + R * cfg.up, z + Math.sin(ang) * R];
      eye = eye ? eye.map((v, i) => v + (e[i] - v) * .05) : e; at = at ? at.map((v, i) => v + ([x, y, z][i] - v) * .08) : [x, y, z];
      cam.ex = eye[0]; cam.ey = eye[1]; cam.ez = eye[2];
      const q = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]]; cam.yaw = Math.atan2(q[2], q[0]); cam.pitch = Math.atan2(q[1], Math.hypot(q[0], q[2]));
    };
    for (let i = 0; i < 60; i++) window.__sceneCamera();
  }, {cam: scene.camera, focus: scene.focus});
  await page.evaluate(() => {
    document.body.classList.add('idle', 'noui');
    const st = document.createElement('style'); st.textContent = '#uiBack{display:none!important}'; document.head.appendChild(st);
    window.__sceneRender = () => {
      const adv = warClock.advance; warClock.advance = () => 0; battleAccumulator = 1 / 30 * .999;
      try { frame(window.__t += 1000 / 30); } finally { warClock.advance = adv; battleAccumulator = 0; }
      if (replayState) endReplay();
    };
  });
  const file = path.join(outDir, `${id}.webm`), enc = encoder(file);
  let frames = 0; const t0 = Date.now(), mid = Math.round((scene.to - scene.from) * 15);
  while (true) {
    const T = await page.evaluate(() => { window.__sceneStep(); window.__sceneCamera(); window.__sceneRender(); return battleTime - warT0; });
    const jpg = await page.screenshot({type: 'jpeg', quality: 82});
    await enc.write(jpg);
    if (frames === mid) fs.writeFileSync(path.join(outDir, `${id}.jpg`), jpg);
    frames++;
    if (frames % 150 === 0) console.error(id, label, 'frames', frames, 'T', T.toFixed(1), ((Date.now() - t0) / frames).toFixed(0) + ' ms/frame');
    if (T >= scene.to) break;
  }
  await enc.end();
  const meta = {scene: id, name: scene.name, label, clip: [scene.from, scene.to], frames, seconds: +(frames / 30).toFixed(1), msPerFrame: Math.round((Date.now() - t0) / frames), ships: await page.evaluate(() => ships.length), errors: page.__errors};
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
