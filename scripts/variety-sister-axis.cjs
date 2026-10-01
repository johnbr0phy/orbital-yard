#!/usr/bin/env node
/* Chooses how a class's sisters vary (VY_SISTER_AXIS in the page; VARIETY.md,
   "Recognition"). For each candidate line of proportions it finds the
   smallest amplitude that gives a median sister distance of at least the
   target, then counts how many of the original fleets' hulls (Yard, Shoal,
   Drift) a sample of the class's sisters would enter the seven nearest
   neighbours of, in a finished variety run. Fewer is better: those are the
   hulls the class would take from their own fleet in the recognition
   classifier. The line with the fewest crowded hulls is printed last, as a
   VY_SISTER_AXIS entry.

   node scripts/variety-sister-axis.cjs --class "6:1:GR-75 MEDIUM TRANSPORT" \
       [--dirs "0,0,0;1,0,0;0,0,-1"] [--target 0.046] [--n 50] [--from bench/variety/final]

   A direction is [length, beam, height]: +1 or -1 moves that axis one way
   along the line, 0 holds it; "0,0,0" is the default line (longer and
   slimmer, or shorter and fuller). */
const path = require('node:path');
const L = require('./variety-lib.cjs');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve(__dirname, '..');
const FROM = path.resolve(opt('from', path.join(root, 'bench/variety/final')));
const [race, band, key] = opt('class').split(':');
const dirs = opt('dirs', '0,0,0;1,0,0;-1,0,0;0,1,0;0,-1,0;0,0,1;0,0,-1;1,-1,-1;0,1,-1').split(';');
const target = +opt('target', .046), N = +opt('n', 50);

// the originals' hulls and their 7-nearest-neighbour radius in the finished run (other wars only)
const all = []; for (let r = 0; r < 23; r++) { if (r === 17) continue; all.push(...require(path.join(FROM, `hulls-${r}.json`)).filter(h => !h.topup)); }
const sig = all.map(h => L.unpack(h.sig));
const Q = all.map((h, i) => i).filter(i => [0, 1, 3].includes(all[i].race));
const rad = Q.map(q => { const d = []; for (let i = 0; i < all.length; i++) if (all[i].fold !== all[q].fold) d.push(L.distance(sig[q], sig[i])); d.sort((a, b) => a - b); return d[6]; });

const F = L.loadForge(root, {fast: true}), K = JSON.stringify(race + '|' + key);
const seeds = []; for (let k = 0; seeds.length < N && k < N * 80; k++) { const s = (991 + k * 2654435761) >>> 0; if (F.wrun(`raceBuild(${race},${s},0,false,${band}).meta.klass`).replace(/\s*\((CARGO|BATTLE|SCIENCE|COMMAND)[^)]*REFIT\)\s*$/, '') === key) seeds.push(s); }
const sisters = () => seeds.map(s => L.bits(L.signature(F.wrun(`(()=>{const s=raceBuild(${race},${s},0,false,${band});armShip(s,${race},0);seatShipAssemblies(s,${race});const c=centre(s);return packMesh({parts:s.parts,bb:s.bb,triK:s.triK},c,.32);})()`))));
const spread = S => { const d = []; for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) d.push(L.distance(S[i], S[j])); return L.median(d); };
const rows = [];
for (const d of dirs) {
  let best = null;
  for (const a of [.3, .5, .7, 1, 1.4, 2, 2.8, 4]) { F.wrun(`VY_SISTER_AXIS[${K}]=[${d},${a}]`); const S = sisters(), sp = spread(S); if (sp >= target) { best = {a, sp, S}; break; } }
  if (!best) { console.log(`${d.padEnd(10)} never reaches ${target}`); continue; }
  const crowd = {0: 0, 1: 0, 3: 0}; for (const s of best.S) Q.forEach((q, i) => { if (L.distance(s, sig[q]) < rad[i]) crowd[all[q].race]++; });
  const per = x => (x / best.S.length * 100).toFixed(0);
  rows.push({d, a: best.a, total: crowd[0] + crowd[1] + crowd[3]});
  console.log(`${d.padEnd(10)} amp ${String(best.a).padEnd(4)} spread ${best.sp.toFixed(3)}  crowded per 100 sisters: Yard ${per(crowd[0])} Shoal ${per(crowd[1])} Drift ${per(crowd[3])}`);
}
rows.sort((x, y) => x.total - y.total);
if (rows.length) console.log(`best: ${K}:[${rows[0].d},${rows[0].a}]`);
