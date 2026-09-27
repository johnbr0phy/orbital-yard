#!/usr/bin/env node
/* Same seed, same war, in a real browser, however it is watched.
   node scripts/determinism-browser.cjs [--matchup 6,5] [--seed 2202] [--size 40] [--seconds 90]

   Runs the page twice in Chromium with everything a viewer can change set
   differently: run A steps the fixed 1/30 s simulation directly with the
   Action camera and 3 forge workers; run B drives the page's own frame() at
   45 fps with the war clock at 2x then 0.5x, the Broadcast director, a
   slow-motion burst, and 1 forge worker. It compares every ship's state at
   every whole simulated second and the full story event log. Exit code 1
   on the first divergence.

   (The Node harness is not a browser twin: it forges box meshes, so weapon
   obstruction by a ship's own hull differs by design.) */
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const [a, b] = arg('matchup', '6,5').split(',').map(Number), seed = +arg('seed', 2202), size = +arg('size', 40), seconds = +arg('seconds', 90);
const root = path.resolve(__dirname, '..');
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);

async function run(browser, base, variant) {
  const page = await browser.newPage({viewport: {width: 640, height: 360}});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  if (variant.workers) await page.addInitScript(n => Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => n}), variant.workers + 1);
  await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, r => r.abort());
  await page.goto(`${base}/armada-war-tribute-new.html?autostart=0&quality=low`);
  await page.waitForFunction(() => typeof startWar === 'function');
  await page.evaluate(({a, b, seed, size}) => { window.requestAnimationFrame = () => 0; pickMain = [a, b]; pickAlly = [-1, -1]; perFleet = size; warSeed = seed; startWar(false); window.__t = 1000; }, {a, b, seed, size});
  await page.waitForFunction(() => { frame(window.__t += 33.333); return Number.isFinite(warT0); }, null, {timeout: 300000, polling: 50});
  const out = await page.evaluate(({seconds, variant}) => {
    const snap = () => JSON.stringify(ships.map(s => [s.id, s.dead ? 1 : 0, s.jumped ? 1 : 0, s.x, s.y, s.z, s.hp, s.ai ? s.ai.action : '']));
    const states = {};
    const mark = () => { const k = Math.round((battleTime - warT0) * 30); if (k % 30 === 0 && k > 0 && !(k / 30 in states)) states[k / 30] = snap(); };
    if (variant.mode === 'direct') {
      endIntro(); setWatchView('action');
      while (battleTime - warT0 < seconds) { capturePrevious(); battleTime += 1 / 30; simStep(battleTime, 1 / 30); introStep(battleTime, 1 / 30); broadcastTick(battleTime, 1 / 30); mark(); }
    } else {
      setWatchView('broadcast'); lastT = 0; let i = 0;
      // Frame timestamps at 45 fps; the war clock changes rate; a slow-motion burst.
      const origStep = simStep;
      simStep = function (now, dt) { origStep(now, dt); mark(); };
      while (battleTime - warT0 < seconds) {
        if (i === 400) warClock.setRate(2); if (i === 900) warClock.slowMo(1.6); if (i === 1500) warClock.setRate(.5);
        frame(window.__t += 1000 / 45); i++;
        if (replayState) endReplay();
      }
      simStep = origStep;
    }
    return {states, events: JSON.stringify(bc.log.events.filter(e => e.type !== 'kill').map(e => [e.type, +(e.t - warT0).toFixed(4), e.ship ?? -1, e.partner ?? -1])), workers: workers.length};
  }, {seconds, variant});
  await page.close();
  return {...out, errors};
}

(async () => {
  const server = await new Promise(r => { const s = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': p.endsWith('.html') ? 'text/html' : p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'});
    fs.createReadStream(p).pipe(res);
  }); s.listen(0, () => r(s)); });
  const base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({headless: true, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const A = await run(browser, base, {mode: 'direct', workers: 3});
  const B = await run(browser, base, {mode: 'frames', workers: 1});
  await browser.close(); server.close();
  let first = null, compared = 0;
  for (let t = 1; t <= seconds; t++) { if (!(t in A.states) || !(t in B.states)) continue; compared++; if (A.states[t] !== B.states[t]) { first = t; break; } }
  const evSame = A.events === B.events;
  const report = {matchup: [a, b], seed, size, seconds, workers: [A.workers, B.workers], comparedSeconds: compared, firstDivergentSecond: first,
    eventsIdentical: evSame, storyEvents: JSON.parse(A.events).length, finalHash: [hash(A.states[seconds] || ''), hash(B.states[seconds] || '')], errors: A.errors.concat(B.errors)};
  console.log(JSON.stringify(report, null, 1));
  process.exit(first || !evSame || compared < seconds * .9 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
