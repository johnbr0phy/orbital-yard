/* Scene mode of scripts/capture-audio.cjs: renders one scene's audio offline. */
const fs = require('node:fs'), path = require('node:path');
const S = require('./audio-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

(async () => {
  const id = arg('scene'), scenes = S.loadScenes(), scene = scenes.find(s => String(s.id) === String(id));
  if (!scene) throw new Error('no scene ' + id);
  const dir = path.resolve(arg('dir', S.root)), outFile = path.resolve(arg('out', `bench/audio/scenes/after/${String(id).padStart(2, '0')}.wav`));
  const rate = +arg('rate', 48000);
  const {browser, page, server} = await S.openPage({dir, quality: scene.quality || 'high'});
  await S.startWar(page, scene);
  await S.installCamera(page, scene.camera);
  const opts = JSON.parse(arg('opts', '{}'));
  const res = await page.evaluate(async ({scene, rate, opts}) => {
    const seconds = scene.seconds, N = Math.floor(seconds * 30);
    const off = new OfflineAudioContext(2, Math.round(rate * seconds), rate);
    // Every fetch and decode is tracked; each tick waits for them, so streamed sounds
    // arrive on the same tick on every run (as if the network were instant).
    const inflight = new Set(), track = p => { inflight.add(p); p.then(() => inflight.delete(p), () => inflight.delete(p)); return p; };
    const dec = off.decodeAudioData.bind(off); off.decodeAudioData = (...a) => track(dec(...a));
    const f0 = window.fetch.bind(window); window.fetch = (...a) => track(f0(...a));
    const settle = async () => { for (let i = 0; i < 50 && inflight.size; i++) await Promise.allSettled([...inflight]); };
    bc.audio = ArmadaAudio.create({context: off, maxVoices: quality.name === 'Low' ? 12 : 24, quality: quality.name, ...opts});
    const A = bc.audio; A.unlock(); syncAudioSliders?.();
    if (scene.focus != null) audioFocusId = scene.focus;  // the subject a wide shot frames (the page's listener blend)
    const roles = await A.loadSamples?.('audio/manifest.json'); await settle();
    const subj = scene.subject != null ? ships[scene.subject] : null, log = [], seenEv = new Set(bc.log.events);
    let renderMs = 0, resumedAt = 0, jsMs = 0;
    const q = t => Math.round(t * rate / 128) * 128 / rate;
    const tick = k => {
      window.__sceneCamera(); window.__sceneTick();
      if (['broadcast', 'pilot'].includes(scene.camera.type)) updateWatchCamera(battleTime, 1 / 30);
      const t0 = window.__realNow(); updateAudio(window.__vt / 1000, 1 / 30); const js = window.__realNow() - t0; jsMs += js;
      const st = A.stats(), row = {t: +(k / 30).toFixed(3), bt: +(battleTime - warT0).toFixed(3), cam: [cam.ex, cam.ey, cam.ez].map(v => Math.round(v)), yaw: +cam.yaw.toFixed(3), pitch: +cam.pitch.toFixed(3), js: +js.toFixed(3), voices: st.voices};
      if (A._debug && opts.meters) row.bus = A._debug.meters();
      if (st.engines != null) Object.assign(row, {engines: st.engines, weapons: st.weapons, impacts: st.impacts, emitters: st.emitters, hrtf: st.hrtf, cockpit: st.cockpit, focus: st.focus, blend: +(bc.earBlend || 0).toFixed(3)});
      if (subj) {
        const d = [subj.x - cam.ex, subj.y - cam.ey, subj.z - cam.ez], r = Math.hypot(...d);
        row.subj = {d: Math.round(r), dead: !!subj.dead, p: [subj.x, subj.y, subj.z].map(v => Math.round(v))};
        const em = A._debug && A._debug.EM.get('n' + subj.id);
        if (A._debug && k % 15 === 0) row.top = [...A._debug.EM.values()].filter(e => e.bus === 'engines').sort((a, b) => b.aud - a.aud).slice(0, 10).map(e => [e.id, e.role, Math.round(e.d), +e.aud.toFixed(3), !!(e.voice && !e.voice.dying)]);
        if (em) row.subj.em = {voiced: !!(em.voice && !em.voice.dying), g: +(em.cur || 0).toFixed(4), aud: +(em.aud || 0).toFixed(4), dop: +(em.dop || 1).toFixed(3), model: em.voice ? em.voice.model : null, role: em.role, dir: em.voice && em.voice.pn && em.voice.pn.__dir ? em.voice.pn.__dir.map(v => +v.toFixed(2)) : null, ex: [em.x, em.y, em.z].map(Math.round), L: [A._debug.L.x, A._debug.L.y, A._debug.L.z].map(Math.round)};
      }
      if (scene.members && A._debug) row.members = scene.members.map(id => { const e = A._debug.EM.get('n' + id); return e ? [id, e.voice && !e.voice.dying ? 1 : 0, +(e.dop || 1).toFixed(3), e.voice && e.voice.pn && e.voice.pn.__dir ? e.voice.pn.__dir.map(v => +v.toFixed(2)) : null, Math.round(e.d || 0)] : [id, 0]; });
      if (A._debug) {  // where the fight is: the gain-weighted left/right of every sounding gun and hit
        let w = 0, x = 0; for (const e of A._debug.EM.values()) if (e.voice && !e.voice.dying && e.voice.pn && e.voice.pn.__dir && (e.bus === 'weapons' || e.bus === 'impacts')) { const g = e.cur || 0; w += g; x += g * e.voice.pn.__dir[0]; }
        row.fight = [w > 0 ? +(x / w).toFixed(3) : null, +w.toFixed(4)];
      }
      for (const ev of bc.log.events) if (!seenEv.has(ev)) { seenEv.add(ev); if (/capitalKill|heroKill|firstOneKill/.test(ev.type)) (row.kills ??= []).push([ev.type, ev.name, Math.round(Math.hypot(ev.x - cam.ex, ev.y - cam.ey, ev.z - cam.ez))]); }
      if (opts.solo != null && A._debug) row.solo = [...A._debug.EM.values()].filter(e => e.ship === opts.solo).map(e => [e.id, e.role, e.voice && !e.voice.dying ? 1 : 0, +(e.cur || 0).toFixed(4), Math.round(e.d || 0)]);
      log.push(row);
    };
    for (let k = 0; k < N; k++) off.suspend(q(k / 30)).then(async () => {
      if (k) renderMs += window.__realNow() - resumedAt;
      tick(k); await settle(); resumedAt = window.__realNow(); off.resume();
    });
    const buf = await off.startRendering();
    renderMs += window.__realNow() - resumedAt;
    const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    // float32 interleaved, base64: keeps the true peak above 0 dBFS measurable
    const f = new Float32Array(n * 2); for (let i = 0; i < n; i++) { f[2 * i] = L[i]; f[2 * i + 1] = R[i]; }
    const u8 = new Uint8Array(f.buffer); let b64 = ''; for (let i = 0; i < u8.length; i += 0x8000) b64 += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return {pcm: btoa(b64), log, roles: roles && roles.length, renderMs, jsMs, seconds, final: A.stats(), end: {bt: battleTime - warT0, alive: ships.filter(s => !s.dead).length}};
  }, {scene, rate, opts});
  const f = new Float32Array(Buffer.from(res.pcm, 'base64').buffer.slice(0));
  fs.mkdirSync(path.dirname(outFile), {recursive: true});
  fs.writeFileSync(outFile, wavF32(f, rate));
  const meta = {scene: scene.id, name: scene.name, rate, seconds: res.seconds, roles: res.roles,
    renderMs: Math.round(res.renderMs), renderShare: +(res.renderMs / 1000 / res.seconds).toFixed(4),
    jsMsPerFrame: +(res.jsMs / res.log.length).toFixed(3), final: res.final, end: res.end, errors: page.__errors, log: res.log};
  fs.writeFileSync(outFile.replace(/\.wav$/, '.json'), JSON.stringify(meta));
  console.log(JSON.stringify({file: path.relative(process.cwd(), outFile), seconds: res.seconds, renderShare: meta.renderShare, jsMsPerFrame: meta.jsMsPerFrame, final: res.final, end: res.end, errors: page.__errors}));
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });

// 32-bit float stereo WAV (format 3): nothing is clipped on the way to the report.
function wavF32(f, rate) {
  const n = f.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 8, 28);
  buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  Buffer.from(f.buffer, f.byteOffset, n * 4).copy(buf, 44);
  return buf;
}
