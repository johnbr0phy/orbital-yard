#!/usr/bin/env node
/* Contact sheets in clay (VARIETY.md). Per fleet: one row per muster band,
   12 real mustered hulls (war seed 101, 600 a side, spread evenly over the
   band's jobs), each from a fixed three-quarter view above a top view, at
   one matched scale per row. Paint is off: silhouette and form only.

   node scripts/variety-sheet.cjs --label after [--root DIR] [--fleets 8,15] [--out DIR]
   node scripts/variety-sheet.cjs --expr "buildShadow(SEED)" --n 12 --out /tmp/x.png   (sisters of one builder)
*/
const fs = require('node:fs');
const path = require('node:path');
const L = require('./variety-lib.cjs');
const {Canvas, drawMesh, text} = require('./variety-raster.cjs');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const ROOT = path.resolve(opt('root', path.join(__dirname, '..')));
const CW = 150, CH = 96, PER = 12;

function meshOf(F, expr) {
  // Tessellate exactly as the forge worker does for battle (packMesh at .32).
  F.worker.__e = expr;
  return F.wrun(`(()=>{const s=eval(__e);const c=centre(s);const m=packMesh({parts:s.parts,bb:s.bb},c,.32);return {v:Array.from(m.v),i:Array.from(m.i),klass:s.meta.klass,length:s.meta.length};})()`);
}
function sheetRows(rows, title) {
  const labelW = 70, W = labelW + PER * CW, H = 18 + rows.length * (CH * 2 + 14);
  const cv = new Canvas(W, H);
  text(cv, 6, 5, title, [232, 233, 237], 2);
  rows.forEach((row, r) => {
    const y0 = 18 + r * (CH * 2 + 14);
    text(cv, 4, y0 + 6, row.label, [170, 184, 201], 1);
    const scale = Math.max(...row.hulls.map(h => h.length), 1) * 1.08;
    text(cv, 4, y0 + 16, Math.round(scale) + 'M', [110, 124, 141], 1);
    row.hulls.forEach((h, i) => {
      const x = labelW + i * CW;
      cv.fill(x + 1, y0, CW - 2, CH * 2, [28, 34, 43]);
      const mesh = {v: Float32Array.from(h.mesh.v), i: Uint32Array.from(h.mesh.i)};
      drawMesh(cv, mesh, {x: x + 1, y: y0, w: CW - 2, h: CH}, 'oblique', scale);
      drawMesh(cv, mesh, {x: x + 1, y: y0 + CH, w: CW - 2, h: CH}, 'top', scale);
      text(cv, x + 4, y0 + CH * 2 + 3, (h.klass || '').slice(0, 30), [150, 162, 178], 1);
    });
  });
  return cv;
}

function main() {
  const F = L.loadForge(ROOT);
  if (opt('expr')) {
    const n = +opt('n', PER), seed0 = +opt('seed', 1000), hulls = [];
    for (let k = 0; k < n; k++) hulls.push(meshOf(F, opt('expr').replace(/SEED/g, String((seed0 + k * 7919) >>> 0))).valueOf());
    const out = opt('out', '/tmp/sheet.png');
    const rows = []; for (let k = 0; k < hulls.length; k += PER) rows.push({label: '', hulls: hulls.slice(k, k + PER).map(h => ({mesh: h, klass: h.klass, length: h.length}))});
    fs.writeFileSync(out, sheetRows(rows, opt('expr')).png()); console.log(out); return;
  }
  const label = opt('label', 'after');
  const out = path.resolve(opt('out', path.join(__dirname, '../design/tribute-new/review/variety', label)));
  fs.mkdirSync(out, {recursive: true});
  const fleets = opt('fleets') ? opt('fleets').split(',').map(Number) : L.NAMES.map((_, i) => i);
  for (const race of fleets) {
    const jobs = F.muster(race, 101, 600), rows = [];
    const bands = race === 17 ? [null] : [0, 1, 2];
    for (const band of bands) {
      const pool = band == null ? jobs.filter(j => j.hulls) : jobs.filter(j => !j.hero && !j.hulls && j.band === band);
      if (!pool.length) continue;
      const pick = []; for (let k = 0; k < Math.min(PER, pool.length); k++) pick.push(pool[Math.floor(k * pool.length / Math.min(PER, pool.length))]);
      const hulls = pick.map(j => { const {out} = F.forge(j); return {mesh: {v: Array.from(out.mesh.v), i: Array.from(out.mesh.i)}, klass: out.meta.klass, length: out.meta.length}; });
      rows.push({label: band == null ? 'ANCIENTS' : L.BANDS[band], hulls});
    }
    const file = path.join(out, `${race}-${L.NAMES[race].toLowerCase().replace(/\s+/g, '-')}.png`);
    fs.writeFileSync(file, sheetRows(rows, `${L.NAMES[race]} - ${label}`).png());
    console.log(file);
  }
}
main();
