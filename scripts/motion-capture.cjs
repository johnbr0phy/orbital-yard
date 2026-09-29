#!/usr/bin/env node
/* Records a motion scene in Chromium: a WebM of the scene's camera path and,
   from the same war, a motion log and its metrics. The recorder is the same
   one scripts/motion-report.cjs uses headless (scripts/motion-lib.cjs,
   injected by source), so the numbers beside a clip describe that clip.

   node scripts/motion-capture.cjs --scene 01 --label after [--dir ../orbital-yard-main] [--size 640x360]
        [--from 20] [--to 60] [--quality high]

   --dir serves another checkout (a worktree of main for the "before" clips).
   The war is seeded and stepped at exactly 1/30 s (scripts/audio-scenes.cjs:
   virtual clock, seeded Math.random, the page's own war clock), so a scene
   replays identically. Frames before --from are simulated without pictures.
   Output: design/tribute-new/review/motion/<label>/<scene>.webm, .json (metrics), .log.json.gz,
   and a still every 5 s in stills/ (posters for the watch page). */
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib'), {spawn} = require('node:child_process');
const S = require('./audio-scenes.cjs');
const SC = require('./motion-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ffmpeg = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const libSource = fs.readFileSync(path.join(__dirname, 'motion-lib.cjs'), 'utf8');

(async () => {
  const id = arg('scene'), label = arg('label', 'after');
  const scene = SC.scenes.find(s => s.id === id); if (!scene) throw new Error('no scene ' + id);
  const clip = scene.clip || [scene.pick, scene.seconds];
  const from = +arg('from', clip[0]), to = +arg('to', clip[1]);
  const dir = path.resolve(arg('dir', S.root));
  const outDir = path.join(S.root, 'design/tribute-new/review/motion', label);
  fs.mkdirSync(outDir, {recursive: true});
  const [w, h] = arg('size', '640x360').split('x').map(Number);
  const {browser, page, server} = await S.openPage({video: true, width: w, height: h, quality: arg('quality', scene.quality || 'high'), dir});
  await page.evaluate(src => { const module = {exports: {}}; (new Function('module', 'require', src))(module, () => ({})); window.MotionLib = module.exports; }, libSource);
  if (scene.force) await page.evaluate(f => { storyForce = f; }, scene.force);
  await S.startWar(page, {matchup: scene.matchup, seed: scene.seed, size: scene.size});
  const steps = Math.ceil(scene.seconds * 30) + 4;
  await page.evaluate(({steps, scene}) => {
    const L = window.MotionLib;
    window.__mo = L.installMotionRecorder({F: L.F, cap: steps, modes: L.MODES, flag: L.FLAG});
    window.__focus = []; window.__picked = false; window.__scene = {};
    const script = (scene.script || []).map(s => ({...s}));
    // Record every simulation step, whether driven by fast-forward or by the war clock.
    const orig = simStep;
    simStep = function (now, dt) {
      orig(now, dt);
      const T = battleTime - warT0;
      if (!window.__picked && T >= scene.pick) { window.__picked = true; try { window.__focus = (0, eval)(scene.focus); } catch (e) { window.__focus = []; } }
      for (const s of script) if (!s.done && T >= s.t) { s.done = true; (0, eval)(s.code); }
      window.__mo.sample();
    };
  }, {steps, scene: {pick: scene.pick, focus: scene.focus, script: scene.script}});
  // Fast-forward to the clip without rendering.
  await page.evaluate(t => { while (battleTime - warT0 < t) window.__sceneStep(); }, from);
  // Camera: the page's Broadcast director, or a smooth chase of the focus group's centroid.
  if (scene.camera.type === 'broadcast') await S.installCamera(page, {type: 'broadcast'});
  else await page.evaluate(cfg => {
    let eye = null, at = null, hd = null;
    window.__sceneCamera = () => {
      camKick = 0;
      const live = (window.__focus || []).map(i => ships[i]).filter(s => s && !s.dead && s.arr);
      if (!live.length) return;
      let x = 0, y = 0, z = 0, c = 0, sn = 0;
      for (const s of live) { x += s.x; y += s.y; z += s.z; c += Math.cos(s.yaw); sn += Math.sin(s.yaw); }
      x /= live.length; y /= live.length; z /= live.length;
      let spread = 0; for (const s of live) spread = Math.max(spread, Math.hypot(s.x - x, s.z - z));
      const want = Math.atan2(sn, c);
      hd = hd == null ? want : hd + Math.atan2(Math.sin(want - hd), Math.cos(want - hd)) * .01;
      const k = Math.max(1, (spread * 1.6) / Math.max(1, cfg.back)), fx = Math.cos(hd), fz = Math.sin(hd);
      const e = [x - fx * cfg.back * k - fz * cfg.side * k, y + cfg.up * k, z - fz * cfg.back * k + fx * cfg.side * k];
      eye = eye ? eye.map((v, i) => v + (e[i] - v) * .04) : e; at = at ? at.map((v, i) => v + ([x, y, z][i] - v) * .08) : [x, y, z];
      cam.ex = eye[0]; cam.ey = eye[1]; cam.ez = eye[2];
      const d = [at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]]; cam.yaw = Math.atan2(d[2], d[0]); cam.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    };
    for (let i = 0; i < 90; i++) window.__sceneCamera();
  }, scene.camera);
  await page.evaluate(() => {
    // A clean picture: the page's own hide-all-UI mode, without its 'Show UI' hint.
    document.body.classList.add('idle', 'noui');
    const st = document.createElement('style'); st.textContent = '#uiBack{display:none!important}'; document.head.appendChild(st);
    window.__sceneRender = () => {
      const adv = warClock.advance; warClock.advance = () => 0; battleAccumulator = 1 / 30 * .999;
      try { frame(window.__t += 1000 / 30); } finally { warClock.advance = adv; battleAccumulator = 0; }
      if (replayState) endReplay();
    };
  });
  const outFile = path.join(outDir, `${id}.webm`);
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '1400k', '-crf', '14', '-auto-alt-ref', '0', outFile], {stdio: ['pipe', 'ignore', 'inherit']});
  let frames = 0; const t0 = Date.now();
  while (true) {
    const T = await page.evaluate(() => { window.__sceneStep(); window.__sceneCamera(); window.__sceneRender(); return battleTime - warT0; });
    const jpg = await page.screenshot({type: 'jpeg', quality: 82});
    if (!enc.stdin.write(jpg)) await new Promise(r => enc.stdin.once('drain', r));
    if (frames % 150 === 0) { fs.mkdirSync(path.join(outDir, 'stills'), {recursive: true}); fs.writeFileSync(path.join(outDir, 'stills', `${id}-${String(frames / 30).padStart(3, '0')}s.jpg`), jpg); }
    frames++;
    if (frames % 150 === 0) console.error(id, label, 'frames', frames, 'T', T.toFixed(1), ((Date.now() - t0) / frames).toFixed(0) + ' ms/frame');
    if (T >= to) break;
  }
  enc.stdin.end(); await new Promise(r => enc.on('close', r));
  // Finish the scene's measured span without pictures, then analyse in the page.
  await page.evaluate(t => { while (battleTime - warT0 < t) window.__sceneStep(); }, scene.seconds);
  const result = await page.evaluate(({heavy, from, to}) => {
    const L = window.MotionLib, rec = window.__mo, A = L.analyse(rec), g = L.finalize(L.groupStats(A.ships));
    const log = L.compactLog(rec, heavy ? 6 : 3); log.focus = window.__focus; log.clip = [from, to];
    const pick = x => x && {perMin: x.perMin, strictPerMin: x.strictPerMin, shuttleMax: x.shuttleMax, angP95: x.angJerk.p95, hold: x.holdShare, spins: x.spinsBig, minutes: x.minutes};
    const focusSet = new Set(window.__focus);
    const focusShips = A.ships.filter(s => focusSet.has(s.id));
    return {metrics: {all: pick(g.all), classes: Object.fromEntries(Object.entries(g).filter(([k]) => k.startsWith('class:')).map(([k, v]) => [k.slice(6), pick(v)])),
      focus: {ships: focusShips.length, reversals: focusShips.reduce((t, s) => t + s.reversals.length + (s.reversalsStrict ? s.reversalsStrict.length : 0), 0),
        shuttleMax: Math.max(0, ...focusShips.map(s => s.shuttleWorst.share)), spins: focusShips.reduce((t, s) => t + s.spins.length, 0)},
      cohesion: A.cohesion.seconds ? A.cohesion.inBand / A.cohesion.seconds : null, individualityMin: A.individuality.length ? Math.min(...A.individuality.map(x => x.min)) : null},
      log: JSON.stringify(log)};
  }, {heavy: !!scene.heavy, from, to});
  fs.writeFileSync(path.join(outDir, `${id}.log.json.gz`), zlib.gzipSync(result.log));
  const meta = {scene: id, name: scene.name, label, clip: [from, to], frames, seconds: +(frames / 30).toFixed(1), msPerFrame: Math.round((Date.now() - t0) / frames), metrics: result.metrics, errors: page.__errors};
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify({...meta, metrics: undefined}));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
