#!/usr/bin/env node
/* Builds the motion watch page: design/tribute-new/review/motion/index.html.
   For every scene: the before and after clips side by side (WebM, recorded by
   scripts/motion-capture.cjs), the track plots before and after
   (scripts/motion-plot.py), and the scene's numbers from the headless reports
   (bench/motion/baseline and bench/motion/final). Static and relative, so it
   works on GitHub Pages and from file://.

   node scripts/motion-watch.cjs [--before baseline] [--after final] */
const fs = require('node:fs'), path = require('node:path');
const SC = require('./motion-scenes.cjs');
const root = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const before = arg('before', 'baseline'), after = arg('after', 'final');
const out = path.join(root, 'design/tribute-new/review/motion');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const sB = read(path.join(root, 'bench/motion', before, 'summary.json')), sA = read(path.join(root, 'bench/motion', after, 'summary.json'));
if (!sB || !sA) throw new Error('need both summaries');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
fs.mkdirSync(path.join(out, 'plots'), {recursive: true});
// Copy the plots next to the page so the page stands alone.
const plot = (label, name) => {
  const src = path.join(root, 'bench/motion', label, 'plots', name);
  if (!fs.existsSync(src)) return null;
  const dst = `plots/${label === before ? 'before' : 'after'}-${name}`;
  fs.copyFileSync(src, path.join(out, dst));
  return dst;
};
const clip = (label, id) => { const f = `${label}/${id}.webm`; return fs.existsSync(path.join(out, f)) ? f : null; };
const poster = (label, id) => { const d = path.join(out, label, 'stills'); if (!fs.existsSync(d)) return null; const f = fs.readdirSync(d).filter(x => x.startsWith(id + '-')).sort()[1] || fs.readdirSync(d).filter(x => x.startsWith(id + '-')).sort()[0]; return f ? `${label}/stills/${f}` : null; };
const run = (s, id) => s.perRun.find(r => r.id === id);
const pct = x => x == null ? '-' : (x * 100).toFixed(1) + '%';
const num = (x, d = 3) => x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(d);
const row = (label, b, a) => `<tr><td>${esc(label)}</td><td>${b}</td><td>${a}</td></tr>`;
function sceneNumbers(id) {
  const b = run(sB, id), a = run(sA, id);
  if (!b || !a) return '';
  const cap = (s, lab) => { const m = read(path.join(out, lab, id + '.json')); return m && m.metrics && m.metrics.focus ? m.metrics.focus : null; };
  const fb = cap(sB, 'before'), fa = cap(sA, 'after');
  return `<table><thead><tr><th>headless, whole scene</th><th>before</th><th>after</th></tr></thead><tbody>
    ${row('reversals per ship-minute (all ships)', num(b.all.perMin), num(a.all.perMin))}
    ${row('gunboat + capital reversals per ship-minute', num((b.frigate || {}).strictPerMin), num((a.frigate || {}).strictPerMin))}
    ${row('worst shuttle share, any ship', pct(b.all.shuttleMax), pct(a.all.shuttleMax))}
    ${row('p95 angular jerk, all ships (rad/s³)', num(b.all.angP95, 2), num(a.all.angP95, 2))}
    ${row('p95 angular jerk, frigates', num((b.frigate || {}).angP95, 2), num((a.frigate || {}).angP95, 2))}
    ${row('speed holds of 5 s+', pct(b.all.hold), pct(a.all.hold))}
    ${row('spins in place, hulls 80 m+', b.all.spins, a.all.spins)}
    ${row('squad-time in the cohesion band', pct(b.cohesion), pct(a.cohesion))}
    ${row('smallest squadmate signature distance', num(b.individualityMin), num(a.individualityMin))}
    ${fb && fa ? row('clip (browser): focus ships reversals / worst shuttle', `${fb.reversals} / ${pct(fb.shuttleMax)}`, `${fa.reversals} / ${pct(fa.shuttleMax)}`) : ''}
  </tbody></table>`;
}
const scenes = SC.scenes.filter(s => !s.id.startsWith('02-') || (run(sA, s.id) && run(sA, s.id).hasFrigates));
const crit = (s, id) => (s.criteria.find(c => c.id === id) || {});
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion review</title>
<style>
:root{--bg:#0b1016;--panel:#121a22;--ink:#dfe7ec;--ink2:#9fb0bc;--line:#243240;--pass:#5ccf8a;--fail:#ff7a6b}
body{margin:0;padding:16px;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,sans-serif}
h1{font-size:21px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 4px}p.m{margin:0 0 10px;color:var(--ink2);max-width:980px}
.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:10px}
figure{margin:0;background:var(--panel);border-radius:6px;padding:6px}figcaption{font-size:12px;color:var(--ink2);margin:4px 2px}
video,img{width:100%;height:auto;display:block;border-radius:4px;background:#000}
table{border-collapse:collapse;margin:8px 0;font-size:13px;width:100%;max-width:980px}td,th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:left;vertical-align:top}
th{color:var(--ink2);font-weight:600}.pass{color:var(--pass)}.fail{color:var(--fail)}
details{margin:6px 0}summary{cursor:pointer;color:var(--ink2)}
.wrap{overflow-x:auto}
</style></head><body>
<h1>Tribute War: how the ships fly, before and after</h1>
<p class="m">Each scene is a fixed seed and matchup. Left: main before this pass. Right: after. The clips are rendered in software (SwiftShader) in Chromium at 640×360, 30 fps, with the camera following the scene's focus ships. The numbers under each scene come from the headless motion report, <code>scripts/motion-report.cjs</code>. The last row of each table comes from the clip's own browser run, and that war can drift from the headless one over time. Full definitions are in MOTION.md.</p>
<h2>Pass criteria</h2><div class="wrap"><table><thead><tr><th>criterion</th><th>target</th><th>before</th><th>after</th><th>result</th></tr></thead><tbody>
${sA.criteria.map(c => { const b = crit(sB, c.id); return `<tr><td>${esc(c.text)}</td><td>${esc(c.target)}</td><td>${esc(b.value || '-')}</td><td>${esc(c.value)}</td><td class="${c.pass ? 'pass' : c.pass === false ? 'fail' : ''}">${c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : 'n/a'}</td></tr>`; }).join('\n')}
</tbody></table></div>
<p class="m">The build, test, determinism and performance criteria are checked outside the motion report. See MOTION.md.</p>
`;
for (const s of scenes) {
  const cb = clip('before', s.id), ca = clip('after', s.id), pb = plot(before, `scene-${s.id}.png`), pa = plot(after, `scene-${s.id}.png`);
  html += `<section id="s${s.id}"><h2>${esc(s.id)} · ${esc(s.name)}</h2><p class="m">${esc(SC.FLEETS[s.matchup[0]])} v ${esc(SC.FLEETS[s.matchup[1]])}, seed ${s.seed}, ${s.size} a side, ${s.seconds} s.${s.note ? ' ' + esc(s.note) : ''}${s.script ? ' Scripted: the orders in this scene are issued at fixed times by the scene script.' : ''}</p>
  <div class="pair">
    <figure>${cb ? `<video controls preload="none" muted loop playsinline ${poster('before', s.id) ? `poster="${poster('before', s.id)}"` : ''} src="${cb}"></video>` : '<p class="m">no clip</p>'}<figcaption>before (main)</figcaption></figure>
    <figure>${ca ? `<video controls preload="none" muted loop playsinline ${poster('after', s.id) ? `poster="${poster('after', s.id)}"` : ''} src="${ca}"></video>` : '<p class="m">no clip</p>'}<figcaption>after</figcaption></figure>
  </div>
  ${sceneNumbers(s.id)}
  <details><summary>Track plots: from above, from the side, heading and speed over time</summary><div class="pair">
    <figure>${pb ? `<img loading="lazy" src="${pb}" alt="tracks before, scene ${s.id}">` : ''}<figcaption>before</figcaption></figure>
    <figure>${pa ? `<img loading="lazy" src="${pa}" alt="tracks after, scene ${s.id}">` : ''}<figcaption>after</figcaption></figure>
  </div></details></section>\n`;
}
const whole = ['reversals.png', 'cohesion.png', 'signature-fighter.png', 'signature-frigate.png'];
html += `<h2>The whole run set</h2><p class="m">All scenes and the 24-war sweep over all 23 fleets.</p>`;
for (const w of whole) { const b = plot(before, w), a = plot(after, w); if (!b && !a) continue; html += `<div class="pair"><figure>${b ? `<img loading="lazy" src="${b}" alt="${w} before">` : ''}<figcaption>before: ${w}</figcaption></figure><figure>${a ? `<img loading="lazy" src="${a}" alt="${w} after">` : ''}<figcaption>after: ${w}</figcaption></figure></div>`; }
html += `</body></html>\n`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('wrote', path.relative(root, path.join(out, 'index.html')), scenes.length, 'scenes');
