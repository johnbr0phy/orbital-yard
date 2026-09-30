/* Fleet variety (VARIETY.md). Forges real musters through the forge worker's
   own job handler (breakup fragments skipped: they do not change a hull's
   shape) and checks the pass criteria on a sample: silhouette distinctness per
   band, sister spread, band reach, pool reachability, sockets on the new
   classes, triangle budgets, role lock, deterministic generation and hero
   geometry. scripts/variety-report.cjs measures the same criteria on full
   musters for VARIETY.md; this is the regression guard. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const L = require('../../scripts/variety-lib.cjs');
const ROOT = path.join(__dirname, '../..');
const T = L.T;
const ROLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'variety-roles.json'), 'utf8'));
const HEROES = JSON.parse(fs.readFileSync(path.join(__dirname, 'variety-heroes.json'), 'utf8'));
const EXEMPT = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/variety-exemptions.json'), 'utf8'));

const F = L.loadForge(ROOT, {fast: true});
// Per band, 40 hulls from each of the report's two wars: the report's own band
// sample size (it tops thin bands up to 40 a war), so clusters count alike.
const PER_BAND = 40, WARS = [101, 202];
const sample = {};   // race -> hulls
function forgeRace(race) {
  if (sample[race]) return sample[race];
  const out = [];
  const take = (list, n) => { const o = []; for (let k = 0; k < Math.min(n, list.length); k++) o.push(list[Math.floor(k * list.length / Math.min(n, list.length))]); return o; };
  const pick = [];
  for (const war of WARS) {
    const jobs = F.muster(race, war, 600);
    if (race === 17) { if (war === WARS[0]) pick.push(...jobs.filter(j => j.hulls)); continue; }
    for (const b of [0, 1, 2]) {
      const band = jobs.filter(j => !j.hero && !j.hulls && j.band === b), got = take(band, PER_BAND);
      // a band this war musters thinly is topped up from later wars, as the report does
      for (let w = war + 1000; got.length < PER_BAND && got.length && w < war + 1040; w++) got.push(...F.muster(race, w, 600).filter(j => !j.hero && !j.hulls && j.band === b).slice(0, PER_BAND - got.length));
      pick.push(...got);
    }
  }
  for (const j of pick) {
    const {out: s, study} = F.forge(j);
    out.push({race, band: j.band, jobSeed: j.seed, seed: s.seed >>> 0, klass: s.meta.klass, key: L.classKey(race, s.meta.klass), length: s.meta.length,
      study, tris: s.mesh.tris, guns: s.guns.length, hash: L.meshHash(s.mesh), sig: L.bits(L.signature(s.mesh)), finalBand: F.wrun(`fleetBandOf(${s.meta.length},${race})`)});
  }
  return (sample[race] = out);
}
const RACES = L.NAMES.map((_, i) => i).filter(r => r !== 17);
const groupBy = (xs, f) => { const o = {}; for (const x of xs) (o[f(x)] = o[f(x)] || []).push(x); return o; };

/* The band, sister and reach criteria are measured exactly as the report
   measures them: the report's own forge (both full musters of every fleet,
   thin bands topped up) and its own analysis code, so the test and VARIETY.md
   cannot disagree on sampling. Forged in parallel worker processes. */
const REPORT = require('../../scripts/variety-report.cjs');
let reportSum = null;
async function reportSummary() {
  if (reportSum) return reportSum;
  const os = require('node:os'), {spawn} = require('node:child_process');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'variety-test-')), script = path.join(ROOT, 'scripts/variety-report.cjs');
  const todo = L.NAMES.map((_, i) => i); let next = 0;
  await Promise.all(Array.from({length: Math.max(2, Math.min(4, os.cpus().length))}, async () => {
    while (next < todo.length) {
      const race = todo[next++];
      await new Promise((res, rej) => spawn(process.execPath, [script, '--worker', '--race', race, '--root', ROOT, '--out', out, '--fast', '--no-recog'], {stdio: 'inherit'}).on('exit', c => c ? rej(new Error('forge ' + race)) : res()));
    }
  }));
  const all = todo.flatMap(r => JSON.parse(fs.readFileSync(path.join(out, `hulls-${r}.json`), 'utf8')));
  fs.rmSync(out, {recursive: true, force: true});
  const sum = REPORT.analyse(all, {noRecognition: true});
  sum.exemptions = EXEMPT;
  sum.verdict = REPORT.verdict(sum, null);
  return (reportSum = sum);
}
const failing = (sum, prefixes) => sum.verdict.rows.filter(r => !r.ok && prefixes.some(p => r.id.startsWith(p))).map(r => r.id + ': ' + r.detail);

test('every band holds several silhouettes, none over half the band, classes are not one shape at two scales', {timeout: 3600000}, async () => {
  assert.deepEqual(failing(await reportSummary(), ['shapes ', 'dominant ', 'classSep ']), []);
});

test('sisters differ (no clones, no identical meshes) and still read as their class', {timeout: 3600000}, async () => {
  assert.deepEqual(failing(await reportSummary(), ['sisters ', 'identical ']), []);
});

test('capital-band jobs are filled by capital-band hulls in every fleet', {timeout: 3600000}, async () => {
  assert.deepEqual(failing(await reportSummary(), ['reach ']), []);
});

test('every class in every band pool is actually dealt in its band, including the Sharlin and the Jem\'Hadar shuttle', {timeout: 900000}, () => {
  const want = expectedClasses(), missing = [];
  for (const [race, bands] of Object.entries(want)) for (const [band, set] of Object.entries(bands)) {
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const b = band === 'any' ? i % 3 : +band, x = F.wrun(`(()=>{const s=raceBuild(${race},${(Math.imul(i + 1, 2654435761) + b * 97) >>> 0},0,false,${b});return [s.meta.klass,fleetBandOf(s.meta.length,${race})]})()`);
      if (band === 'any' || x[1] === b) seen.add(L.classKey(+race, x[0]));
    }
    for (const k of set) if (!seen.has(k)) missing.push(`${L.NAMES[race]}/${band}: ${k}`);
  }
  assert.deepEqual(missing, []);
  assert.ok([...want[7][2]].includes('SHARLIN-CLASS WAR CRUISER'));
  assert.ok([...want[19][0]].includes("JEM'HADAR SHUTTLE"));
});

test('new classes fire from their own modelled apertures', {timeout: 900000}, () => {
  const bad = [];
  for (const [race, kinds] of Object.entries(ROLES.newKinds)) for (const [fn, kind] of kinds) for (const seed of [11, 202, 3003]) {
    // every socket sits on one of the hull's own modelled parts (within that part's
    // extent: a barrel end, an aperture's centre, a loft station), and nothing is bolted on
    const r = F.wrun(`(()=>{const s=${fn}(${seed},${JSON.stringify(kind)});const before=s.parts.length;armShip(s,${race},0);const L=s.meta.length;
      const ext=s.parts.slice(0,before).flatMap(p=>partExtents(p));
      const far=(s.muzzles||[]).map(m=>Math.min(...ext.map(([q,r])=>Math.max(0,Math.hypot(q[0]-m[0],q[1]-m[1],q[2]-m[2])-r*1.1)))/L);
      if(s.parts.length!==before)return {n:0,added:s.parts.length-before,klass:s.meta.klass};
      const inside=(s.muzzles||[]).every(m=>m.every((v,i)=>v>=s.bb[0][i]-L*.02&&v<=s.bb[1][i]+L*.02));
      return {n:(s.muzzles||[]).length,far:Math.max(0,...far),inside,klass:s.meta.klass};})()`);
    if (!(r.n > 0 && r.far < 0.02 && r.inside)) bad.push(`${r.klass} (${seed}): ${JSON.stringify(r)}`);
  }
  assert.deepEqual(bad, []);
});

test('every hull is under 6,000 triangles at study quality, and the budget counts exactly what the tessellator cuts', {timeout: 900000}, () => {
  const over = [];
  for (const race of RACES) for (const h of forgeRace(race)) if (h.study >= T.studyTris) over.push(`${h.klass} ${h.study}`);
  assert.deepEqual(over, []);
  for (const race of [0, 1, 8, 15, 22]) for (let i = 1; i < 12; i++) {
    const r = F.wrun(`(()=>{const s=raceBuild(${race},${i * 7919},0);armShip(s,${race},0);s.triK=1;return [shipMeshQ(s,.65).tris,vyTriCount(s,.65,1),shipMeshQ(s,.32).tris,vyTriCount(s,.32,1)]})()`);
    assert.equal(r[0], r[1]); assert.equal(r[2], r[3]);
  }
});

test('no mustered hull leaves the length range, and so the flight roles, its class declared', {timeout: 900000}, () => {
  const bad = [];
  for (const race of [...RACES, 17]) for (const h of forgeRace(race)) {
    const d = ROLES.classes[race + '|' + h.key];
    if (!d) { bad.push(`${L.NAMES[race]}/${h.key}: undeclared`); continue; }
    if (h.length < d.range[0] || h.length > d.range[1]) bad.push(`${L.NAMES[race]}/${h.key}: ${h.length.toFixed(1)} m outside ${d.range}`);
  }
  assert.deepEqual(bad, []);
});

test('hull generation is deterministic and independent of what else was forged', () => {
  const html = fs.readFileSync(path.join(ROOT, 'armada-war-tribute-new.html'), 'utf8');
  const prefix = html.slice(html.indexOf('\n<script>\n') + 10, html.indexOf('//__ARMADA_WORKER_CUT__'));
  const fresh = () => { const c = vm.createContext({console}); vm.runInContext(prefix, c); return c; };
  const a = fresh(), b = fresh();
  vm.runInContext('for(let i=0;i<50;i++){buildShadow(i*31,i%3);buildEngineer(i*17,i%3);buildExtra(20,i*13,0,false,i%3);}', b);   // b forges other hulls first
  for (const [call] of [['buildShadow(4242,0)'], ['buildShadow(4242,2)'], ['buildEngineer(99,2)'], ['buildExtra(18,77,0,false,2)'], ['buildExtra(19,77,0,false,1)'], ['buildExtra(20,5,0,false,1)'], ['buildExtra(22,5,0,false,0)'], ['buildMinbari(8,2)'], ['buildImperial(8,2)'], ['buildBorg(8,0)'], ['buildMondo(8,2)'], ['buildYautja(8,2)']]) {
    const x = vm.runInContext(`JSON.stringify(${call})`, a), y = vm.runInContext(`JSON.stringify(${call})`, b), z = vm.runInContext(`JSON.stringify(${call})`, a);
    assert.equal(x, y, call); assert.equal(x, z, call);
  }
});

test('named heroes keep byte-identical geometry', () => {
  const html = fs.readFileSync(path.join(ROOT, 'armada-war-tribute-new.html'), 'utf8');
  const c = vm.createContext({console}); vm.runInContext(html.slice(html.indexOf('\n<script>\n') + 10, html.indexOf('//__ARMADA_WORKER_CUT__')), c);
  for (const [key, hash] of Object.entries(HEROES)) {
    const [race, seed] = key.split(':');
    const t = vm.runInContext(`Array.from(shipMeshQ(buildHero(${race},${seed}),.65).t)`, c);
    assert.equal(crypto.createHash('sha256').update(Float32Array.from(t)).digest('hex').slice(0, 16), hash, `hero ${L.NAMES[race]} seed ${seed}`);
  }
});
