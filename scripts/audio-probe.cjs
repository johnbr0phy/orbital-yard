#!/usr/bin/env node
/* Records a seeded war's ship trajectories and events so audio scenes can be
   scripted around real moments (a close pass, a capital overhead, a death).
   node scripts/audio-probe.cjs --matchup 5,6 --seed 77 --size 50 --seconds 60 --out bench/audio/probe-5-6.json
   Each sample: [id, x, y, z, yaw, pitch, fired in the last 0.1 s, hull fraction].
   Positions are sampled every 0.1 s of battle time. The war is stepped exactly as
   scripts/audio-scenes.cjs steps it, so a scene replays the same trajectories. */
const fs = require('node:fs'), path = require('node:path');
const S = require('./audio-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
(async () => {
  const [a, b] = arg('matchup', '5,6').split(',').map(Number);
  const cfg = {matchup: [a, b], seed: +arg('seed', 77), size: +arg('size', 50)};
  const seconds = +arg('seconds', 60), out = path.resolve(arg('out', `bench/audio/probe-${a}-${b}-${cfg.seed}.json`));
  const {browser, page, server} = await S.openPage({video: false});
  await S.startWar(page, cfg);
  const data = await page.evaluate(seconds => {
    const frames = [], events = [], seen = new Set();
    for (let i = 0; i < seconds * 30; i++) {
      window.__sceneStep();
      if (i % 3 === 0) frames.push({t: +(battleTime - warT0).toFixed(3), s: ships.filter(s => !s.dead && s.arr).map(s => [s.id, +s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1), +(s.yaw || 0).toFixed(3), +(s.pitch || 0).toFixed(3), battleTime - (s.lastFire ?? -9) < .11 ? 1 : 0, +(s.hp / s.hpMax).toFixed(2)])});
      for (const e of bc.log.events) if (!seen.has(e)) { seen.add(e); events.push({t: +(e.t - warT0).toFixed(2), type: e.type, ship: e.ship, race: e.race, size: e.size, x: e.x, y: e.y, z: e.z}); }
    }
    const meta = ships.map(s => ({id: s.id, side: s.side, race: s.race, slen: +s.slen.toFixed(1), hulls: s.hulls || 0, klass: s.meta?.klass || '', spd: s.spdMax || s.spd || 0}));
    return {frames, events, meta};
  }, seconds);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, JSON.stringify({cfg, ...data}));
  console.log(out, data.frames.length, 'frames', data.events.length, 'events', data.meta.length, 'ships');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
