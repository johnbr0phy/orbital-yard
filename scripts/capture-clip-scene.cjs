/* Scene mode of scripts/capture-clip.cjs: records one scene's picture. */
const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
const S = require('./audio-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ffmpeg = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';

(async () => {
  const id = arg('scene'), scene = S.loadScenes().find(s => String(s.id) === String(id));
  if (!scene) throw new Error('no scene ' + id);
  const outFile = path.resolve(arg('out', `bench/audio/scenes/video/${String(id).padStart(2, '0')}.webm`));
  const [w, h] = arg('size', '960x540').split('x').map(Number);
  const {browser, page, server} = await S.openPage({video: true, width: w, height: h, quality: scene.quality || 'high'});
  await S.startWar(page, scene);
  await S.installCamera(page, scene.camera);
  await page.evaluate(() => {
    document.body.classList.add('idle');
    // Render the latest step without stepping: the war clock is held while frame() draws.
    window.__sceneRender = () => {
      const adv = warClock.advance; warClock.advance = () => 0; battleAccumulator = 1 / 30 * .999;
      try { frame(window.__t += 1000 / 30); } finally { warClock.advance = adv; battleAccumulator = 0; }
      if (replayState) endReplay();
    };
  });
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  const enc = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '1800k', '-crf', '12', '-auto-alt-ref', '0', outFile], {stdio: ['pipe', 'ignore', 'inherit']});
  const N = Math.floor(scene.seconds * 30), cams = [];
  for (let k = 0; k < N; k++) {
    const c = await page.evaluate(() => { window.__sceneCamera(); window.__sceneTick(); window.__sceneRender(); return [cam.ex, cam.ey, cam.ez].map(Math.round); });
    cams.push(c);
    const jpg = await page.screenshot({type: 'jpeg', quality: 86});
    if (!enc.stdin.write(jpg)) await new Promise(r => enc.stdin.once('drain', r));
    if (k % 150 === 0) console.error('frames', k, '/', N);
  }
  enc.stdin.end(); await new Promise(r => enc.on('close', r));
  const end = await page.evaluate(() => ({bt: battleTime - warT0, alive: ships.filter(s => !s.dead).length}));
  fs.writeFileSync(outFile.replace(/\.webm$/, '.cams.json'), JSON.stringify(cams));
  console.log(JSON.stringify({file: path.relative(S.root, outFile), frames: N, end, errors: page.__errors}));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
