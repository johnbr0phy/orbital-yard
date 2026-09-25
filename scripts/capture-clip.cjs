#!/usr/bin/env node
/* Captures a highlight clip (WebM, VP8) from the real page, frame by frame.
   node scripts/capture-clip.cjs [--matchup 5,6] [--seed 77] [--size 60] [--clips 3] [--out design/tribute-new/review/highlights.webm]

   The page's own requestAnimationFrame loop is stopped and frame() is called
   with exact 1/30 s timestamps, so software rendering speed does not change
   the result: the video plays at true speed including the slow-motion
   parts. The war is fast-forwarded to its end, then the top highlight clips
   from the replay reel are played and recorded with the broadcast HUD.
   Frames are JPEG screenshots piped into Playwright's bundled ffmpeg. */
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), {spawn} = require('node:child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '..');
const [a, b] = arg('matchup', '5,6').split(',').map(Number), seed = +arg('seed', 77), size = +arg('size', 60), clips = +arg('clips', 3);
const outFile = path.resolve(root, arg('out', 'design/tribute-new/review/highlights.webm'));
const ffmpeg = process.env.FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';

(async () => {
  const server = await new Promise(r => { const s = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'});
    fs.createReadStream(p).pipe(res);
  }); s.listen(0, () => r(s)); });
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  const errors = [];page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, r => r.abort());
  await page.goto(`http://localhost:${server.address().port}/armada-war-tribute-new.html?autostart=0&quality=high`);
  await page.waitForFunction(() => typeof startWar === 'function');
  await page.evaluate(({a, b, seed, size}) => {
    window.requestAnimationFrame = () => 0; // the capture drives frame() itself
    pickMain = [a, b]; pickAlly = [-1, -1]; perFleet = size; warSeed = seed;
    document.getElementById('warMenu').hidden = true; document.body.classList.remove('menu-start');
    startWar(false); window.__t = 1000; lastT = 0;
  }, {a, b, seed, size});
  // Forging happens in workers; pump frames until the war starts.
  await page.waitForFunction(() => { frame(window.__t += 33.333); return Number.isFinite(warT0); }, null, {timeout: 300000, polling: 50});
  // Fast-forward the war to its end (coarse frames, no screenshots).
  const result = await page.evaluate(() => {
    if (typeof endIntro === 'function' && intro && !intro.done) endIntro();
    watchMode = 'broadcast';
    // Step the simulation directly (no rendering); the event log, replay
    // ring and highlight reel are all fed by broadcastTick.
    for (let i = 0; i < 30 * 600 && !(winner != null && battleTime - (bc.log.events.find(e => e.type === 'victory')?.t ?? 1e9) > 4); i++) {
      capturePrevious(); battleTime += 1 / 30; simStep(battleTime, 1 / 30); introStep(battleTime, 1 / 30); broadcastTick(battleTime, 1 / 30);
      if (replayState) endReplay();
    }
    lastT = 0;
    hideEndCard();
    return {winner, t: battleTime - warT0, clips: bc.reel.clips.map(c => [c.meta.ev.type, c.meta.ev.name, +(c.end - c.start).toFixed(1)])};
  });
  console.error('war over', JSON.stringify(result));
  // Keep the best N clips, play them in time order, record at 30 fps.
  const started = await page.evaluate(n => {
    // The victory itself is not a moment; keep the best kills.
    for (let i = bc.reel.clips.length - 1; i >= 0; i--) if (bc.reel.clips[i].meta.ev.type === 'victory') bc.reel.clips.splice(i, 1);
    bc.reel.clips.splice(n);
    document.body.classList.add('idle');
    return playHighlights(false);
  }, clips);
  if (!started) throw new Error('no highlights to record');
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  const enc = spawn(ffmpeg, ['-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '2500k', '-crf', '10', '-auto-alt-ref', '0', outFile], {stdio: ['pipe', 'ignore', 'inherit']});
  // Warm-up: let the HUD and replay bar settle before the first recorded frame.
  await page.evaluate(() => { for (let i = 0; i < 4; i++) frame(window.__t += 1000 / 30); });
  let frames = 0;
  while (frames < 30 * 70) {
    const live = await page.evaluate(() => { frame(window.__t += 1000 / 30); document.getElementById('bcEnd').hidden = true; return !!replayState; });
    if (!live) break;
    const jpg = await page.screenshot({type: 'jpeg', quality: 88});
    if (!enc.stdin.write(jpg)) await new Promise(r => enc.stdin.once('drain', r));
    frames++;
    if (frames % 150 === 0) console.error('frames', frames);
  }
  enc.stdin.end();
  await new Promise(r => enc.on('close', r));
  console.log(JSON.stringify({file: path.relative(root, outFile), frames, seconds: +(frames / 30).toFixed(1), errors}));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
