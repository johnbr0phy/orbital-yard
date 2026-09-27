#!/usr/bin/env node
/* Story screenshot gallery: design/tribute-new/review/story
   node scripts/capture-story.cjs [--only rout,ram] [--quality high] [--list]

   Each scenario starts a fixed seed (optionally with forced plans or an
   objective), runs the real simulation until the named moment happens,
   freezes time right there, frames the subject near, mid or far with the
   HUD visible (captions, tags, title card), and saves a JPEG (quality 85). The simulation
   decides when the moment happens; nothing is staged except the camera.
   Chromium here renders with SwiftShader (software): these are look checks,
   not performance numbers. */
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(__dirname, '..'), out = path.join(root, 'design/tribute-new/review/story');
const quality = arg('quality', 'high');

// until: event type to wait for (or a time in war seconds); frame: who to look at.
const SCENARIOS = [
  {id: 'rout', a: 6, b: 5, seed: 2202, size: 60, until: {event: 'rout'}, after: 4, frame: 'squad', views: ['near', 'mid', 'far']},
  {id: 'flagship-death', a: 6, b: 5, seed: 1101, seeds: [1101, 2202, 3303, 81, 82], size: 60, force: {plans: ['DECAPITATE', 'DECAPITATE'], objective: 'ANNIHILATE'}, until: {event: 'flagshipDown'}, after: .35, frame: 'kill', views: ['near', 'mid']},
  {id: 'successor', a: 6, b: 5, seed: 1101, seeds: [1101, 2202, 3303, 81, 82], size: 60, force: {plans: ['DECAPITATE', 'DECAPITATE'], objective: 'ANNIHILATE'}, until: {event: 'successor'}, after: 3, frame: 'ship', views: ['mid', 'far']},
  {id: 'ram-turn', a: 12, b: 10, seed: 1101, size: 60, until: {event: 'lastStand', kind: 'RAM'}, after: 1, frame: 'pair', views: ['mid', 'far']},
  {id: 'ram-impact', a: 12, b: 10, seed: 1101, size: 60, until: {event: 'ram'}, after: .3, frame: 'pair', views: ['near', 'mid']},
  {id: 'last-stand-volley', a: 12, b: 10, seed: 2202, seeds: [2202, 1101, 3303, 4404], size: 60, until: {event: 'lastStand', kind: 'VOLLEY'}, after: .6, frame: 'ship', views: ['mid']},
  {id: 'abandon-ship', a: 12, b: 10, seed: 3303, size: 60, until: {event: 'pods'}, after: 2.5, frame: 'ship', views: ['near', 'mid']},
  {id: 'ace', a: 6, b: 5, seed: 2202, size: 60, until: {event: 'ace'}, after: .5, frame: 'ship', views: ['near', 'mid']},
  {id: 'ace-duel', a: 5, b: 6, seed: 1101, seeds: [1101, 2202, 3303, 4404, 5505], size: 60, until: {event: 'aceDuel'}, after: .5, frame: 'pair', views: ['near', 'mid']},
  {id: 'vendetta-chase', a: 6, b: 5, seed: 2202, seeds: [2202, 1101, 3303], size: 60, until: {event: 'vendetta'}, after: 1, frame: 'pair', views: ['near', 'mid']},
  {id: 'rescue-screen', a: 10, b: 12, seed: 1101, size: 60, until: {event: 'rescueStart'}, after: 4, frame: 'squadAndShip', views: ['mid', 'far']},
  {id: 'rescue-outcome', a: 10, b: 12, seed: 1101, size: 60, until: {event: 'rescue'}, after: .5, frame: 'ship', views: ['mid']},
  // Each plan twice: the title card at 7.5 s, then the posture from above once the fleets move.
  {id: 'plan-pincer-card', a: 6, b: 5, seed: 1101, size: 60, force: {plans: ['PINCER', 'HOLD'], objective: 'ANNIHILATE'}, until: {time: 7.5}, frame: 'wide', views: ['far']},
  {id: 'plan-pincer', a: 6, b: 5, seed: 1101, size: 60, force: {plans: ['PINCER', 'HOLD'], objective: 'ANNIHILATE'}, until: {time: 22}, frame: 'wide', views: ['top']},
  {id: 'plan-ambush-card', a: 6, b: 5, seed: 3303, size: 60, force: {plans: ['AMBUSH', 'SIEGE'], objective: 'ANNIHILATE'}, until: {time: 7.5}, frame: 'wide', views: ['far']},
  {id: 'plan-ambush', a: 6, b: 5, seed: 3303, size: 60, force: {plans: ['AMBUSH', 'SIEGE'], objective: 'ANNIHILATE'}, until: {event: 'planWorked'}, after: 1.5, frame: 'wide', views: ['top']},
  {id: 'plan-hold-card', a: 5, b: 6, seed: 1101, size: 60, force: {plans: ['HOLD', 'RAID'], objective: 'ANNIHILATE'}, until: {time: 7.5}, frame: 'wide', views: ['far']},
  {id: 'plan-hold', a: 5, b: 6, seed: 1101, size: 60, force: {plans: ['HOLD', 'RAID'], objective: 'ANNIHILATE'}, until: {time: 24}, frame: 'wide', views: ['top']},
  {id: 'plan-raid', a: 6, b: 5, seed: 2202, size: 60, force: {plans: ['RAID', 'HOLD'], objective: 'ANNIHILATE'}, until: {event: 'raid'}, after: .4, frame: 'squad', views: ['mid', 'far']},
  {id: 'plan-decapitate-card', a: 6, b: 5, seed: 1101, size: 60, force: {plans: ['DECAPITATE', 'SIEGE'], objective: 'ANNIHILATE'}, until: {time: 7.5}, frame: 'wide', views: ['far']},
  {id: 'plan-decapitate', a: 6, b: 5, seed: 1101, size: 60, force: {plans: ['DECAPITATE', 'SIEGE'], objective: 'ANNIHILATE'}, until: {time: 24}, frame: 'wide', views: ['top']},
  {id: 'plan-siege-card', a: 12, b: 10, seed: 2202, size: 60, force: {plans: ['SIEGE', 'PINCER'], objective: 'ANNIHILATE'}, until: {time: 7.5}, frame: 'wide', views: ['far']},
  {id: 'plan-siege', a: 12, b: 10, seed: 2202, size: 60, force: {plans: ['SIEGE', 'PINCER'], objective: 'ANNIHILATE'}, until: {time: 24}, frame: 'wide', views: ['top']},
  {id: 'plan-switch', a: 5, b: 6, seed: 2202, size: 60, until: {event: 'planSwitch'}, after: .5, frame: 'wide', views: ['far']},
  {id: 'objective-station', a: 8, b: 7, seed: 1101, size: 60, force: {objective: 'STATION'}, until: {time: 40}, frame: 'station', views: ['far']},
  {id: 'objective-convoy', a: 5, b: 6, seed: 3303, size: 60, force: {objective: 'CONVOY'}, until: {time: 30}, frame: 'convoy', views: ['mid']},
  {id: 'terrain-rocks', a: 5, b: 6, seed: 1101, size: 60, terrain: 'asteroids', until: {time: 30}, frame: 'rocks', views: ['mid', 'far']},
  {id: 'terrain-nebula', a: 18, b: 10, seed: 1101, size: 60, terrain: 'nebula', until: {time: 32}, frame: 'nebula', views: ['mid', 'far']},
  {id: 'terrain-moon', a: 6, b: 5, seed: 1101, size: 60, terrain: 'moon', until: {time: 26}, frame: 'moon', views: ['far']},
  {id: 'ion-005', a: 5, b: 6, seed: 1101, size: 60, until: {event: 'ionStrike'}, after: .05, frame: 'ion', views: ['near', 'far']},
  {id: 'ion-080', a: 5, b: 6, seed: 1101, size: 60, until: {event: 'ionStrike'}, after: .8, frame: 'ion', views: ['near', 'far']},
  {id: 'debris', a: 5, b: 6, seed: 1101, seeds: [1101, 2202, 3303, 4404], size: 60, until: {event: 'capitalKill'}, after: 1.2, frame: 'kill', views: ['near', 'mid', 'far']}
];

function serve() {
  const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mjs': 'text/javascript'};
  return new Promise(r => { const s = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'});
    fs.createReadStream(p).pipe(res);
  }); s.listen(0, () => r(s)); });
}

// Seeds whose system has the requested terrain (system seed = warSeed ^ 0xC0FFEE).
function seedWithTerrain(kind, from) {
  const S = require('../armada-systems-new.js');
  for (let seed = from; seed < from + 5000; seed++) if (S.generate((seed ^ 0xC0FFEE) >>> 0).field.kinds.includes(kind)) return seed;
  return from;
}

async function capture(browser, base, sc) {
  // A moment that does not happen in one war is looked for in the next seed.
  if (sc.until.event && !sc.seeds) sc = {...sc, seeds: [sc.seed, 1101, 2202, 3303, 4404].filter((v, i, a) => a.indexOf(v) === i)};
  if (sc.seeds && !sc.tried) {
    for (const seed of sc.seeds) { const r = await capture(browser, base, {...sc, seed, tried: true}); if (!r.missing) return r; }
    return {id: sc.id, missing: sc.until.event, seeds: sc.seeds};
  }
  const seed = sc.terrain ? seedWithTerrain(sc.terrain, sc.seed) : sc.seed;
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|goatcounter|gc\.zgo\.at/, r => r.abort());
  await page.goto(`${base}/armada-war-tribute-new.html?autostart=0&quality=${quality}`);
  await page.waitForFunction(() => typeof startWar === 'function');
  await page.addStyleTag({content: '#warMenu,#card,#toast,#watchDock,#bcSpeed,#bcReplayChip{display:none!important}'});
  await page.evaluate(({a, b, size, force, seed}) => { storyForce = force || null; pickMain = [a, b]; pickAlly = [-1, -1]; perFleet = size; warSeed = seed; document.getElementById('pick').classList.remove('on'); document.body.classList.remove('menu-start'); startWar(false); }, {...sc, seed});
  await page.waitForFunction(() => Number.isFinite(warT0), null, {timeout: 300000});
  const found = await page.evaluate(({until, after}) => {
    if (typeof endIntro === 'function' && intro && !intro.done) endIntro();
    window.updateActionCamera = () => {}; window.updateBroadcastCamera = () => {}; sel = null; pilotId = null; watchMode = 'action';
    const step = () => { capturePrevious(); battleTime += 1 / 30; simStep(battleTime, 1 / 30); introStep(battleTime, 1 / 30); broadcastTick(battleTime, 1 / 30); };
    let ev = null;
    if (until.time != null) { while (battleTime - warT0 < until.time) step(); }
    else {
      const match = e => e.type === until.event && (!until.kind || e.kind === until.kind);
      while (battleTime - warT0 < 240 && !(ev = bc.log.events.find(match))) step();
      if (ev) { const t = ev.t + (after || 0); while (battleTime < t) step(); }
    }
    capturePrevious(); if (replayState) endReplay(); battleAccumulator = -1e9;
    return ev ? {type: ev.type, t: +(ev.t - warT0).toFixed(1), ship: ev.ship ?? null, partner: ev.partner ?? null, squad: ev.squad ?? null, text: ev.text || ev.name || '', x: ev.x, y: ev.y, z: ev.z} : null;
  }, sc);
  if (sc.until.event && !found) { await page.close(); return {id: sc.id, seed, missing: sc.until.event}; }
  const shots = [];
  for (const view of sc.views) {
    const info = await page.evaluate(({frame, view, found}) => {
      // Frame with the product's own cameras: the cinema director for a
      // subject, the "All ships" and "Top down" views for whole fleets.
      const T = battleTime - warT0, live = ships.filter(s => s && !s.dead && s.vao && !s.reliefPending && !s.cloaked && T - s.delay >= 0);
      const byId = id => id == null || !ships[id] || ships[id].dead ? null : ships[id];
      const story = battleAI.story, k = {near: .75, mid: 1.4, far: 3, top: 1}[view];
      let subject = byId(found.ship), partner = null, kind = null;
      if (frame === 'wide') {
        watchMode = view === 'top' ? 'top' : 'all'; actionCamera = null; updateWatchCamera(battleTime, 1, true);
        for (let i = 0; i < 3; i++) updateWatchCamera(battleTime, 1, true);
        return {distance: null, subject: null, camera: watchMode};
      }
      if (frame === 'squad' || frame === 'squadAndShip') { const q = squads[found.squad] ?? squads[ships[found.ship]?.squad]; subject = q ? byId(q.mem.find(id => byId(id))) : subject; partner = frame === 'squadAndShip' ? byId(found.ship) : null; kind = 'squad'; }
      else if (frame === 'pair') { partner = byId(found.partner); kind = partner ? 'duel' : null; }
      else if (frame === 'ship') kind = subject && subject.slen >= 180 ? 'capital' : 'chase';
      watchMode = 'action';
      if (kind && subject) {
        actionCamera = {clock: 0, until: 0, index: 0, subject: null, partner: null, kind: null, history: [], kindAt: {}, lastWide: 0, scanAt: 0};
        const L = cinemaStart(actionCamera, {kind, subject: subject.id, partner: partner ? partner.id : null}, live.includes(subject) ? live : live.concat([subject]), battleTime);
        const eye = L.focus.map((f, i) => f + (L.eye[i] - f) * k);
        cam.ex = eye[0]; cam.ey = eye[1]; cam.ez = eye[2];
        const dx = L.focus[0] - eye[0], dy = L.focus[1] - eye[1], dz = L.focus[2] - eye[2];
        cam.yaw = Math.atan2(dz, dx); cam.pitch = Math.atan2(dy, Math.hypot(dx, dz)); watchGoal = {far: L.far * k};
        return {distance: Math.round(Math.hypot(dx, dy, dz)), subject: shipLabel(subject), camera: kind};
      }
      // Places, not ships: a kill site, an ion lance, the terrain, the objective.
      const pts = [];
      if (frame === 'ion') { const b = beams.find(b => b.ion) || {a: [found.x, found.y, found.z], b: [found.x, found.y, found.z]}; pts.push([...b.a, 60], [...b.b, 200]); }
      if (frame === 'kill') pts.push([found.x, found.y, found.z, Math.max(120, (ships[found.ship]?.slen || 200) * .6)]);
      if (frame === 'station' || frame === 'convoy') { const o = story.objective; pts.push([...o.point, 1500]); if (frame === 'convoy') for (const id of o.ids) { const c = byId(id); if (c) pts.push([c.x, c.y, c.z, c.slen]); } }
      if (frame === 'rocks' || frame === 'nebula' || frame === 'moon') { const f = starSystem.field; if (frame === 'rocks') for (const r of f.rocks) pts.push([...r.p, r.r]); if (frame === 'nebula') pts.push([...f.nebula.p, f.nebula.r]); if (frame === 'moon') pts.push([...f.moon.p, f.moon.r]); }
      if (!pts.length && found.x != null) pts.push([found.x, found.y, found.z, 300]);
      const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (const p of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] - p[3]); hi[i] = Math.max(hi[i], p[i] + p[3]); }
      const look = lo.map((v, i) => (v + hi[i]) / 2), R = Math.max(60, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2);
      const d = R / Math.sin(.44) * .9 * {near: .8, mid: 1.5, far: 3.2, top: 1.5}[view], yaw = .65 + (view === 'far' ? .4 : 0), pitch = view === 'top' ? 1.35 : .3;
      const eye = [look[0] - Math.cos(yaw) * Math.cos(pitch) * d, look[1] + Math.sin(pitch) * d, look[2] - Math.sin(yaw) * Math.cos(pitch) * d];
      cam.ex = eye[0]; cam.ey = eye[1]; cam.ez = eye[2];
      const dx = look[0] - eye[0], dy = look[1] - eye[1], dz = look[2] - eye[2];
      cam.yaw = Math.atan2(dz, dx); cam.pitch = Math.atan2(dy, Math.hypot(dx, dz)); watchGoal = {far: Math.hypot(dx, dy, dz) * 30};
      actionCamera = {subject: subject ? subject.id : null, partner: null, kind: 'chase', clock: 0, index: 0, history: [], kindAt: {}};
      return {distance: Math.round(d), subject: subject ? shipLabel(subject) : null, camera: 'place'};
    }, {frame: sc.frame, view, found: found || {}});
    await page.waitForTimeout(2200);
    const hud = await page.evaluate(() => ({caption: document.getElementById('bcCaption').textContent, plan: document.getElementById('bcPlan').textContent, objective: document.getElementById('bcObjective').textContent, tags: [...document.querySelectorAll('.bcTag')].filter(e => !e.hidden).map(e => e.textContent)}));
    const name = `${sc.id}-${view}.jpg`;
    await page.screenshot({path: path.join(out, name), type: 'jpeg', quality: 85});
    shots.push({name, ...info, ...hud});
  }
  await page.close();
  return {id: sc.id, seed, event: found, shots, errors: errors.filter(e => !/fonts|favicon/.test(e))};
}

(async () => {
  if (process.argv.includes('--list')) { for (const s of SCENARIOS) console.log(s.id); return; }
  fs.mkdirSync(out, {recursive: true});
  const only = arg('only', ''), list = only ? SCENARIOS.filter(s => only.split(',').includes(s.id)) : SCENARIOS;
  const server = await serve(), base = `http://localhost:${server.address().port}`;
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const report = [];
  const file = path.join(out, 'report.json');
  const prior = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  for (const sc of list) {
    const t0 = Date.now();
    try { const r = await capture(browser, base, sc); report.push(r); console.log(sc.id, r.missing ? 'MISSING ' + r.missing : 'ok', r.event ? r.event.t + 's ' + r.event.text : '', ((Date.now() - t0) / 1000).toFixed(0) + 's'); }
    catch (e) { report.push({id: sc.id, error: e.message}); console.log(sc.id, 'ERROR', e.message); }
  }
  await browser.close(); server.close();
  const merged = prior.filter(p => !report.some(r => r.id === p.id)).concat(report);
  fs.writeFileSync(file, JSON.stringify(merged, null, 1));
})();
