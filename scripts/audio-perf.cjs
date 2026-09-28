#!/usr/bin/env node
/* What the audio costs in the running page, in real time.
   node scripts/audio-perf.cjs [--matchup 5,6] [--seed 77] [--size 50] [--seconds 30] [--quality high] [--audio 1]

   Runs the real page (its own requestAnimationFrame loop, rendering on) with a real
   AudioContext unlocked by a click, in Broadcast. Measures on the main thread the time
   spent in the page's audio code per frame (updateAudio, and the per-step shot offers
   inside broadcastTick) and the frame times, and on the audio render thread its CPU time,
   read per thread from /proc (Linux). --audio 0 runs the same war without unlocking audio,
   for the frame-time comparison. */
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path');
const S = require('./audio-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

function threadTicks() {  // {pid:tid:name: utime+stime} for every chromium renderer thread
  const out = {};
  for (const pid of fs.readdirSync('/proc').filter(p => /^\d+$/.test(p))) {
    let cmd = ''; try { cmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8'); } catch (e) { continue; }
    if (!/type=renderer/.test(cmd)) continue;
    for (const tid of fs.readdirSync(`/proc/${pid}/task`)) {
      try { const name = fs.readFileSync(`/proc/${pid}/task/${tid}/comm`, 'utf8').trim(), st = fs.readFileSync(`/proc/${pid}/task/${tid}/stat`, 'utf8').split(') ')[1].split(' ');
        out[`${pid}:${tid}:${name}`] = +st[11] + +st[12]; } catch (e) {}
    }
  }
  return out;
}

(async () => {
  const [a, b] = arg('matchup', '5,6').split(',').map(Number), seed = +arg('seed', 77), size = +arg('size', 50), seconds = +arg('seconds', 30), withAudio = arg('audio', '1') !== '0';
  const server = await S.serve(S.root);
  const browser = await chromium.launch({headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']});
  const page = await browser.newPage({viewport: {width: 960, height: 540}});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, r => r.abort());
  await page.goto(`http://localhost:${server.address().port}/armada-war-tribute-new.html?autostart=0&quality=${arg('quality', 'high')}`);
  await page.waitForFunction(() => typeof startWar === 'function');
  await page.evaluate(({a, b, seed, size}) => { pickMain = [a, b]; pickAlly = [-1, -1]; perFleet = size; warSeed = seed; document.getElementById('warMenu').hidden = true; document.body.classList.remove('menu-start'); startWar(false); }, {a, b, seed, size});
  await page.waitForFunction(() => Number.isFinite(warT0), null, {timeout: 600000});
  await page.evaluate(() => { if (typeof endIntro === 'function' && intro && !intro.done) endIntro(); setWatchView('broadcast'); });
  if (withAudio) { await page.mouse.click(480, 300); await page.waitForFunction(() => bc.audio && bc.audio.unlocked && bc.audio.hasSamples, null, {timeout: 60000}); }
  await page.evaluate(() => {
    const T = window.__perf = {audio: 0, frames: [], last: performance.now()};
    const ua = updateAudio; updateAudio = (w, d) => { const t = performance.now(); ua(w, d); T.audio += performance.now() - t; };
    const as = audioShots; audioShots = n => { const t = performance.now(); as(n); T.audio += performance.now() - t; };
    const loop = () => { const t = performance.now(); T.frames.push(t - T.last); T.last = t; requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  });
  const t0 = threadTicks(); const wall0 = Date.now();
  await new Promise(r => setTimeout(r, seconds * 1000));
  const t1 = threadTicks(), wall = (Date.now() - wall0) / 1000, hz = 100;
  const res = await page.evaluate(() => { const T = window.__perf, f = T.frames.slice(5).sort((x, y) => x - y); return {frames: f.length, audioMs: T.audio, medianFrame: f[f.length >> 1], p95Frame: f[Math.floor(f.length * .95)], stats: bc.audio && bc.audio.stats ? bc.audio.stats() : null}; });
  const threads = Object.entries(t1).map(([k, v]) => [k.split(':')[2], (v - (t0[k] || 0)) / hz / wall]).filter(([, v]) => v > .005).sort((x, y) => y[1] - x[1]).slice(0, 8);
  const audioThread = threads.filter(([n]) => /audio|Audio|WebAudio|RealtimeAud/i.test(n));
  console.log(JSON.stringify({withAudio, seconds: +wall.toFixed(1), frames: res.frames, audioMsPerFrame: +(res.audioMs / Math.max(1, res.frames)).toFixed(3), medianFrameMs: +res.medianFrame.toFixed(1), p95FrameMs: +res.p95Frame.toFixed(1),
    audioThreadCpu: audioThread.map(([n, v]) => [n, +(v * 100).toFixed(1) + '%']), busiestThreads: threads.map(([n, v]) => [n, +(v * 100).toFixed(1) + '%']), stats: res.stats, errors}));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
