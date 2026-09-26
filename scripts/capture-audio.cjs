#!/usr/bin/env node
/* Records the page's synthesized battle audio to a WAV, in real time.
   node scripts/capture-audio.cjs [--matchup 5,6] [--seed 77] [--size 50] [--seconds 40] [--skip 20] [--out audio.wav]

   Headless Chromium plays the real Web Audio graph; the connection to the
   speakers is tapped by a ScriptProcessor that copies every sample out. The
   war is stepped directly at real time (no rendering, so software GL cannot
   slow the simulation), with the Broadcast camera driving the listener.
   --skip fast-forwards the war (silently) before recording starts. */
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '..');
const [a, b] = arg('matchup', '5,6').split(',').map(Number), seed = +arg('seed', 77), size = +arg('size', 50);
const seconds = +arg('seconds', 40), skip = +arg('skip', 20), outFile = path.resolve(arg('out', 'audio.wav'));

function wav(left, right, rate) {
  const n = left.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 4, 28);
  buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  return buf;
}

(async () => {
  const server = await new Promise(r => { const s = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'});
    fs.createReadStream(p).pipe(res);
  }); s.listen(0, () => r(s)); });
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
  const page = await browser.newPage({viewport: {width: 960, height: 540}});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, r => r.abort());
  await page.addInitScript(() => {
    // Tap anything that connects to the speakers.
    const orig = AudioNode.prototype.connect;
    window.__rec = {l: [], r: [], on: false, rate: 0};
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        const ctx = dest.context;
        if (!ctx.__tap) {
          const sp = ctx.createScriptProcessor(4096, 2, 2); ctx.__tap = sp; window.__rec.rate = ctx.sampleRate;
          sp.onaudioprocess = e => {
            const L = e.inputBuffer.getChannelData(0), R = e.inputBuffer.getChannelData(1);
            e.outputBuffer.getChannelData(0).set(L); e.outputBuffer.getChannelData(1).set(R);
            if (window.__rec.on) { window.__rec.l.push(Array.from(L)); window.__rec.r.push(Array.from(R)); }
          };
          orig.call(sp, dest);
        }
        return orig.call(this, ctx.__tap, ...rest);
      }
      return orig.call(this, dest, ...rest);
    };
  });
  await page.goto(`http://localhost:${server.address().port}/armada-war-tribute-new.html?autostart=0&quality=low`);
  await page.waitForFunction(() => typeof startWar === 'function');
  await page.evaluate(({a, b, seed, size}) => {
    window.requestAnimationFrame = () => 0;
    pickMain = [a, b]; pickAlly = [-1, -1]; perFleet = size; warSeed = seed;
    document.getElementById('warMenu').hidden = true; document.body.classList.remove('menu-start');
    startWar(false); window.__t = 1000; lastT = 0;
  }, {a, b, seed, size});
  await page.waitForFunction(() => { frame(window.__t += 33.333); return Number.isFinite(warT0); }, null, {timeout: 300000, polling: 50});
  await page.evaluate(skip => {
    if (typeof endIntro === 'function' && intro && !intro.done) endIntro();
    watchMode = 'broadcast';
    const step = () => { capturePrevious(); battleTime += 1 / 30; simStep(battleTime, 1 / 30); introStep(battleTime, 1 / 30); broadcastTick(battleTime, 1 / 30); if (replayState) endReplay(); };
    while (battleTime - warT0 < skip) step();
    window.__step = step;
  }, skip);
  const started = await page.evaluate(async () => { const A = audio(); A.unlock(); syncAudioSliders?.(); window.__roles = await A.loadSamples?.("audio/manifest.json"); return A.unlocked; });
  if (!started) throw new Error('audio did not unlock');
  // Real-time loop in the page: one sim step per 1/30 s of wall time, camera and audio updated as in frame().
  await page.evaluate(seconds => new Promise(done => {
    window.__rec.on = true;
    const t0 = performance.now(); let steps = 0, last = t0;
    const tick = () => {
      const now = performance.now(), want = Math.floor((now - t0) / (1000 / 30));
      while (steps < want) { window.__step(); steps++; }
      try { updateWatchCamera(battleTime, (now - last) / 1000); } catch (e) {}
      updateAudio(now / 1000, (now - last) / 1000); last = now;
      if (now - t0 < seconds * 1000) setTimeout(tick, 16); else { window.__rec.on = false; done(); }
    };
    tick();
  }), seconds);
  const {l, r, rate, stats, lag, roles} = await page.evaluate(() => ({l: window.__rec.l.flat(), r: window.__rec.r.flat(), rate: window.__rec.rate, stats: audio().stats(), lag: battleTime - warT0, roles: window.__roles}));
  fs.writeFileSync(outFile, wav(l, r, rate));
  console.log(JSON.stringify({file: path.relative(process.cwd(), outFile), seconds: +(l.length / rate).toFixed(1), rate, battleSeconds: +lag.toFixed(1), samples: roles, stats, errors}));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
