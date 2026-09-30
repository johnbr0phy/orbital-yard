#!/usr/bin/env node
/* Builds the variety watch page: design/tribute-new/review/variety/index.html.
   For every fleet: the before and after clay contact sheets side by side
   (scripts/variety-sheet.cjs), and its numbers per band from the variety
   reports (bench/variety/<before> and <after>). Then every scene of
   scripts/variety-scenes.cjs, before and after clips side by side
   (scripts/capture-clip.cjs --variety). Static and relative, so it works on
   GitHub Pages and from file://.

   node scripts/variety-watch.cjs [--before baseline] [--after final] */
const fs = require('node:fs'), path = require('node:path');
const L = require('./variety-lib.cjs');
const SC = require('./variety-scenes.cjs');
const root = path.resolve(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const before = arg('before', 'baseline'), after = arg('after', 'final');
const out = path.join(root, 'design/tribute-new/review/variety');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const sB = read(path.join(root, 'bench/variety', before, 'summary.json')), sA = read(path.join(root, 'bench/variety', after, 'summary.json'));
if (!sB || !sA) throw new Error('need both summaries');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const pct = x => x == null ? '-' : (x * 100).toFixed(0) + '%';
const num = (x, d = 2) => x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(d);
const slug = r => `${r}-${L.NAMES[r].toLowerCase().replace(/\s+/g, '-')}.png`;
const has = f => fs.existsSync(path.join(out, f));

function fleetTable(r) {
  const b = sB.fleets.find(f => f.race === r), a = sA.fleets.find(f => f.race === r);
  if (!a || a.unique) return '<p class="muted">The First Ones muster eight unique ancients, not bands.</p>';
  const rows = ['small', 'escort', 'capital'].map(bn => {
    const x = b && b.bands[bn] || {}, y = a.bands[bn] || {};
    return `<tr><th>${bn}</th><td>${num(x.shapes, 1)} → <b>${num(y.shapes, 1)}</b></td><td>${pct(x.dominant)} → <b>${pct(y.dominant)}</b></td><td>${num(x.classSep && x.classSep.min)} → <b>${num(y.classSep && y.classSep.min)}</b></td><td>${bn === 'capital' ? pct(x.reach) + ' → <b>' + pct(y.reach) + '</b>' : ''}</td></tr>`;
  }).join('');
  const rec = `${pct(sB.recognition.perFleet[r])} → <b>${pct(sA.recognition.perFleet[r])}</b>`;
  const sis = Object.values(a.sisters || {}).filter(s => s.perBattle > 1).map(s => s.spread);
  return `<table><thead><tr><th>band</th><th>distinct shapes</th><th>largest shape's share</th><th>closest two classes</th><th>band reach</th></tr></thead><tbody>${rows}</tbody></table>
  <p class="muted">Recognised from silhouette alone: ${rec}. Sister spread, median per class: ${sis.length ? num(Math.min(...sis)) + '–' + num(Math.max(...sis)) : 'one-off designs'}. Classes: ${Object.keys(a.sisters || {}).length || 'one-off designs'}.</p>`;
}
const fleets = L.NAMES.map((n, r) => `<section id="f${r}"><h2>${esc(n)}</h2>
  <div class="pair"><figure><figcaption>before (main)</figcaption>${has('before/' + slug(r)) ? `<a href="before/${slug(r)}"><img loading="lazy" src="before/${slug(r)}" alt="${esc(n)} before, clay contact sheet"></a>` : '<p class="muted">not rendered</p>'}</figure>
  <figure><figcaption>after</figcaption>${has('after/' + slug(r)) ? `<a href="after/${slug(r)}"><img loading="lazy" src="after/${slug(r)}" alt="${esc(n)} after, clay contact sheet"></a>` : '<p class="muted">not rendered</p>'}</figure></div>
  ${fleetTable(r)}</section>`).join('\n');
const clip = (lab, id) => has(`${lab}/${id}.webm`) ? `<video controls preload="none" ${has(`${lab}/${id}.jpg`) ? `poster="${lab}/${id}.jpg"` : ''} src="${lab}/${id}.webm"></video>` : '<p class="muted">not recorded</p>';
const scenes = SC.scenes.map(s => `<section id="${s.id}"><h2>${esc(s.name)}</h2>${s.matchup ? `<p class="muted">${esc(L.NAMES[s.matchup[0]])} v ${esc(L.NAMES[s.matchup[1]])}, seed ${s.seed}, ${s.size} a side, war time ${s.from}–${s.to} s.</p>` : ''}
  <div class="pair"><figure><figcaption>before (main)</figcaption>${clip('before', s.id)}</figure><figure><figcaption>after</figcaption>${clip('after', s.id)}</figure></div></section>`).join('\n');
const v = sA.verdict, fails = v.rows.filter(r => !r.ok);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fleet variety</title>
<style>:root{--bg:#141a22;--ink:#e8e9ed;--muted:#9aa8b8;--line:#344051;--card:#1b232e}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f4f5f7;--ink:#1a1f26;--muted:#5a6573;--line:#cfd5dd;--card:#fff}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui}main{max-width:1400px;margin:auto;padding:16px}
h1{font-size:26px;margin:8px 0}h2{font-size:19px;margin:28px 0 8px}a{color:#8fb8ef}.muted{color:var(--muted)}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:800px){.pair{grid-template-columns:1fr}}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px;min-width:0}figcaption{color:var(--muted);font-size:13px;margin-bottom:6px}
img,video{width:100%;height:auto;display:block;border-radius:4px}table{border-collapse:collapse;margin:10px 0;font-variant-numeric:tabular-nums;font-size:14px;display:block;overflow-x:auto}
th,td{border-bottom:1px solid var(--line);padding:4px 10px;text-align:left}nav{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:14px}</style></head>
<body><main><h1>Fleet variety: before and after</h1>
<p>Clay contact sheets (paint off) of real mustered hulls: one row per muster band, twelve hulls each, a three-quarter view above a top view, one scale per row. Numbers from <code>scripts/variety-report.cjs</code>: ${sA.meta.hulls} hulls on this build, ${sB.meta.hulls} on main. Criteria and method in <a href="https://github.com/johnbr0phy/orbital-yard/blob/claude/fleet-variety-pass/VARIETY.md">VARIETY.md</a>.</p>
<p><b>${v.rows.length - fails.length} of ${v.rows.length} criterion checks pass</b>${fails.length ? '; failing: ' + fails.map(f => esc(f.id)).join(', ') : ''}. Fleet recognition from silhouette alone: ${pct(sB.recognition.accuracy)} on main, ${pct(sA.recognition.accuracy)} now (chance ${pct(sA.recognition.chance)}).</p>
<nav>${L.NAMES.map((n, r) => `<a href="#f${r}">${esc(n)}</a>`).join('')}${SC.scenes.map(s => `<a href="#${s.id}">${s.id}</a>`).join('')}</nav>
${fleets}
<h1 style="margin-top:40px">Scenes</h1>
${scenes}
</main></body></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(path.join(out, 'index.html'));
