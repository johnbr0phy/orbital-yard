// Generates design/tribute-new/style.html from the live code values: node design/tribute-new/style-gen.cjs
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '../..') + '/';
const src = fs.readFileSync(ROOT + 'armada-war-tribute-new.html', 'utf8');
const PX = require(ROOT + 'armada-post-new.js');

// ---- extract data from code ----
const a = src.indexOf('const RACE_DEFS=['), hx = src.indexOf('const FLEET_BEAM_HEX', a), b = src.indexOf('const battleAI=', a);
let RACE_DEFS; eval(src.slice(a, hx).replace('const RACE_DEFS', 'RACE_DEFS'));
const LITERAL = RACE_DEFS.map(r => ({beam: r.beam.slice(), ion: r.ion.slice()}));
eval(src.slice(a, b).replace('const RACE_DEFS', 'RACE_DEFS'));
const f0 = src.indexOf('const families=['), f1 = src.indexOf('];', f0);
let families; eval(src.slice(f0, f1 + 2).replace('const families', 'families'));
const fw0 = src.indexOf('const FO_WEAPONS=['), fw1 = src.indexOf('];', fw0);
let FO_WEAPONS; eval(src.slice(fw0, fw1 + 2).replace('const FO_WEAPONS', 'FO_WEAPONS'));
const dek = src.match(/function deathEffectKind\(race\)\{return ([^;]+);\}/)[1];
const deathEffectKind = new Function('race', 'return ' + dek);
if (RACE_DEFS.length !== 23 || families.length !== 23) throw new Error('unexpected counts');

// ---- helpers mirroring the code ----
const clamp01 = v => Math.max(0, Math.min(1, v));
const hex = c => '#' + c.map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
const muted = (rgb, k) => { const g = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; return rgb.map(v => g + (v - g) * k); };
// hullFinish at nominal tone (1.0) and zero warm shift.
const paintHull = c => muted(c, .62).map(v => Math.max(.02, Math.min(.94, v)));
const paintTrim = c => muted(c, .55);
const paintAcc = c => muted(c, .75);
const normalise = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
const luminanceTo = (c, t) => { const l = c[0] * .2126 + c[1] * .7152 + c[2] * .0722 || 1; return c.map(v => v * t / l); };
const f2 = v => (+v).toFixed(2).replace(/^0\./, '.').replace(/^-0\./, '-.');
const f3 = v => (+v).toFixed(3).replace(/^0\./, '.');
const rgbTxt = c => '[' + c.map(f2).join(', ') + ']';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sw = (c, label, sub) => `<div class="sw"><span class="chip" style="background:${hex(c)}"></span><span class="swl">${label}</span><code>${hex(c)}</code>${sub ? `<span class="swsub">${sub}</span>` : ''}</div>`;
const chip = (c, t) => `<span class="mini" style="background:${hex(c)}" title="${t || hex(c)}"></span>`;

// ---- fleet metadata written for this sheet ----
const SHORT = ['Yard', 'Shoal', 'Lattice', 'Drift', 'Choir', 'Imperial', 'Rebel', 'Minbari', 'Shadows', 'EarthForce', 'Federation', 'Klingon', 'Borg', 'Mondoshawan', 'USCM', 'Engineers', 'Yautja', 'First Ones', 'Romulan', 'Dominion', 'Space Marines', 'Tyranids', 'Tesla'];
const PATTERN = {
  0: 'plain panel cells (hash panels only)', 1: 'lateral hull stripe', 2: 'flowing wave bands', 3: 'mottled patches',
  4: 'concentric ring bands', 5: 'TIE: dark solar-panel wings outside the cockpit', 6: 'stripe plus nose band (Rebel livery)',
  7: 'panels with dark aft/ventral field', 8: 'panels, stripe and hazard chevrons', 9: 'checker stripe (taxi)',
  10: 'Optimus visor / joints', 11: 'Roadster tyres / cabin', 12: 'Falcon interstage band', 13: 'Starship upper field',
  14: 'dorsal carapace field', 15: 'chapter enamel, graphite machinery, launch decks'
};
const SURFACE = {0: 'standard painted plate', 1: 'Shadow chitin: dark cells, wet rim', 2: 'weathered ribbed metal (biomech)', 3: 'bronze collar, patina seams', 4: 'wave plating (Minbari/Vorlon)', 5: 'Borg machinery recesses, green power points'};
// Metalness is a design intention: the ship shader is not PBR.
const METAL = {
  0: ['ceramic', '.2'], 1: ['organic chitin', '0'], 2: ['ceramic / crystal', '.1'], 3: ['salvaged metal', '.7'], 4: ['pearl ceramic', '.15'],
  5: ['metal', '.7'], 6: ['metal', '.6'], 7: ['crystalline', '.15'], 8: ['organic chitin', '0'], 9: ['metal', '.7'], 10: ['metal', '.65'],
  11: ['metal', '.7'], 12: ['metal (machinery)', '.8'], 13: ['bronze', '.75'], 14: ['metal', '.7'], 15: ['biomech bone-metal', '.35'],
  16: ['metal', '.6'], 17: ['varies per ancient', '.2-.5'], 18: ['metal', '.6'], 19: ['metal', '.6'], 20: ['metal', '.75'],
  21: ['organic chitin', '0'], 22: ['metal', '.8']
};
const ENGINE_RACES = [5, 6, 9, 14]; // enginePorts(): if(![5,6,9,14].includes(race))return [];
const ENGINE_COL = [.25, .48, 1], ENGINE_CORE = [.88, .96, 1];
const OVERRIDES = {
  5: [['TIE', {color: [.61, .69, .77], trim: [.045, .07, .095], accent: [.85, .17, .13]}, 'pattern 5']],
  6: [['X-wing / T-65 / YT-1300', {trim: [.60, .17, .13]}, 'pattern 6'], ['Y-wing', {trim: [.82, .59, .16]}, 'pattern 1'],
      ['A-wing', {color: [.73, .24, .18], trim: [.85, .82, .69]}, 'pattern 6'],
      ['Nebulon-B', {color: [.64, .65, .63], trim: [.43, .45, .44], accent: [.38, .72, .86]}, 'pattern 3, gloss .24'],
      ['Mon Cal / MC-', {color: [.67, .66, .58], trim: [.45, .39, .28]}, 'pattern 3']],
  9: [['White Star', {color: [.68, .62, .82], trim: [.26, .40, .52], accent: [.42, .80, .77]}, 'surface 4, pattern 2, gloss .8'],
      ['Starfury / Thunderbolt', {color: [.69, .72, .72], trim: [.71, .38, .12]}, 'pattern 1']],
  10: [['Defiant', {trim: [.39, .43, .48]}, 'pattern 1']],
  13: [['Taxi / cab', {color: [.97, .68, .10], trim: [.10, .11, .12], accent: [.90, .82, .53]}, 'pattern 9, surface 0'],
       ['Police', {color: [.78, .83, .87], trim: [.10, .19, .35], accent: [.20, .44, 1]}, 'pattern 1'],
       ['Fhloston', {color: [.74, .83, .84], trim: [.28, .54, .64], accent: [.95, .75, .36]}, 'pattern 7'],
       ['other convoy craft', {color: [.54, .56, .48], trim: [.39, .19, .12], accent: [.78, .37, .15]}, 'pattern 3']],
  14: [['Cheyenne / dropship', {color: [.39, .46, .29], trim: [.18, .23, .14]}, 'pattern 8'],
       ['Nostromo / Narcissus', {color: [.76, .73, .62], trim: [.36, .36, .30]}, '']],
  17: [['Vorlon', {color: [.78, .63, .29], trim: [.33, .43, .23], accent: [.36, .82, .64]}, 'surface 3'],
       ['Thought', {color: [.40, .58, .69], trim: [.18, .31, .47], accent: [.53, .90, .98]}, ''],
       ['Triumviron', {color: [.67, .30, .22], trim: [.29, .11, .13], accent: [.98, .53, .26]}, ''],
       ['First Born / Lorien', {color: [.59, .46, .29], trim: [.30, .38, .22], accent: [.74, .88, .39]}, '']],
  20: [['chapter 0 (Gloriana)', {color: [.33, .36, .40]}, ''], ['chapter 1', {color: [.39, .34, .33]}, ''],
       ['chapter 2', {color: [.34, .38, .35]}, ''], ['chapter 3', {color: [.36, .37, .38]}, '']],
  21: [['brood 0', {color: [.65, .61, .51], trim: [.27, .22, .32]}, ''], ['brood 1', {color: [.61, .55, .43], trim: [.37, .19, .17]}, ''],
       ['brood 2', {color: [.48, .51, .42], trim: [.19, .27, .24]}, '']],
  22: [['Roadster', {color: [.78, .075, .065], trim: [.08, .10, .12]}, 'pattern 11, gloss .95'], ['Optimus', {}, 'pattern 10'],
       ['Falcon', {}, 'pattern 12'], ['Starship', {color: [.66, .70, .74]}, 'pattern 13, gloss .95']]
};
// Race-wide replacements in hullFinish (not class-specific).
const RACE_WIDE = {
  17: 'Whole fleet replaced: hull from 8 ancientColors by First One index, trim = hull × .62, accent = that ancient\'s FO_WEAPONS colour, pattern 2, surface 0, gloss .48.',
  20: 'Whole fleet replaced: chapter hull by liverySeed % 4 (Gloriana = 0), trim [.25,.26,.275], accent [.52,.48,.39], pattern 15, gloss .10.',
  21: 'Whole fleet replaced: one of three brood hull/trim pairs by liverySeed % 3, accent [.48,.58,.25], gloss .22, surface 0.'
};
const RACE_WIDE_VALUES = {
  20: {trim: [.25, .26, .275], accent: [.52, .48, .39], pattern: 15, gloss: .10},
  21: {accent: [.48, .58, .25], gloss: .22, surface: 0, color: [.65, .61, .51], trim: [.27, .22, .32]},
  17: {pattern: 2, surface: 0, gloss: .48}
};
const ANCIENT = [[.25, .30, .34], [.51, .43, .29], [.36, .32, .31], [.48, .35, .29], [.24, .27, .28], [.62, .61, .48], [.48, .42, .27], [.49, .55, .60]];

const BOOM = {
  cookoff: 'Chain of up to 7 hot flashes marching along the keel, then a 1.1× final bloom (verse 0); or one bloom with a 5-flash cluster; or a small flash then a 1.5× secondary.',
  burst: 'A living thing ruptures: one bloom, two dust bursts, 6-flash cluster. Mist, not magazines.',
  shatter: 'Crystal failing along its grain: bloom, 22 long sparks, a 14-spoke ring.',
  flash: 'She simply becomes light: one 1.9× bloom and a tight 4-flash cluster.',
  tie: 'Cockpit blooms off-centre, 6 sparks; the panels just fall off.',
  crystal: 'One clean 1.8× annihilation, then 18 bone-shard sparks.',
  dissolve: 'No fire: a dark .55× bloom, two dust bursts, a faint cluster.',
  warp: 'Core goes first: a 14-spoke white ring, a .5× flash, then a 1.6× flash .28 s later.',
  cleave: 'Comes apart on the lattice: sparks along 4 axes, cube-cornered flashes.',
  bronze: 'A muted gold 1.2× bloom, 3-flash cluster, no shrapnel.',
  fossil: 'Calcifies first: 8 slow flashes over .9 s, then cracks with a 1.15× bloom.',
  cloakpop: 'The shimmer fails (16 sparks), then the hunter burns .12 s later.'
};
const KIND = {
  10: {name: 'thermal ember', cool: [.95, .23, .045]},
  11: {name: 'reactor blue', cool: [.16, .48, 1.0]},
  12: {name: 'dark violet dissipation', cool: [.32, .10, .46]},
  13: {name: 'Borg green, square-cornered', cool: [.18, .78, .22]},
  14: {name: 'cold flash', cool: [.28, .62, .90]}
};
const FIRE = {
  bolt: ['bolt', 'Travelling bolt, 1400 u/s'], laser: ['bolt', 'Travelling bolt (fighter guns 800 u/s)'],
  turbo: ['turbo', 'Heavy twin-skin bolt with inner core; hulls under 38 m fire as "laser"'],
  disruptor: ['bolt', 'Travelling bolt, 1000 u/s'], pulse: ['pulse', 'Short pulses, 850 u/s (Defiant-class also pulses)'],
  phaser: ['ribbon', 'Coherent held beam, .48 s'], song: ['ribbon', 'Coherent emission, .65 s'],
  neutron: ['ribbon', 'Coherent neutron beam, .75 s, under 280 u'], slicer: ['lance', 'Held slicing lance, 2.4 s'],
  cutter: ['lance', 'Fat held cutting lance, 1.4 s'], shard: ['rail', 'Rail spear: white core, fleet colour bleed, 380 u'],
  junk: ['kinetic', 'Staggered kinetic burst, 3-7 rounds, 650 u/s'], smart: ['kinetic', 'Staggered kinetic burst, 3-11 rounds, 650 u/s'],
  bio: ['plasma', 'Plasma blob, 240 splash'], caster: ['plasma', 'Plasma bolt, 380 splash']
};

// ---- SVG weapon sketches (viewBox 0 0 160 40) ----
function sketch(kind, c) {
  const C = hex(c), W = '#ffffff', id = 'g' + Math.random().toString(36).slice(2, 8);
  const glow = `<defs><filter id="${id}" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>`;
  const wrap = inner => `<svg class="wsk" viewBox="0 0 160 40" role="img" aria-label="${kind} sketch">${glow}${inner}</svg>`;
  switch (kind) {
    case 'bolt': return wrap(`<line x1="18" y1="20" x2="70" y2="20" stroke="${C}" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>
      <rect x="62" y="15" width="64" height="10" rx="5" fill="${C}" filter="url(#${id})"/><rect x="64" y="16" width="60" height="8" rx="4" fill="${C}"/><rect x="70" y="18.5" width="50" height="3" rx="1.5" fill="${W}"/>`);
    case 'turbo': return wrap(`<g filter="url(#${id})"><rect x="40" y="11" width="80" height="18" rx="9" fill="${C}"/></g><rect x="42" y="12" width="76" height="16" rx="8" fill="${C}"/><rect x="48" y="17" width="66" height="6" rx="3" fill="${W}"/>`);
    case 'pulse': return wrap([14, 58, 102].map((x, i) => `<rect x="${x}" y="15" width="${36 - i * 2}" height="10" rx="5" fill="${C}" opacity="${.5 + i * .25}" filter="url(#${id})"/><rect x="${x + 2}" y="18.5" width="${30 - i * 2}" height="3" rx="1.5" fill="${W}"/>`).join(''));
    case 'ribbon': return wrap(`<path d="M8 20 L152 20" stroke="${C}" stroke-width="12" stroke-linecap="round" opacity=".45" filter="url(#${id})"/><path d="M8 20 L152 20" stroke="${C}" stroke-width="6" stroke-linecap="round"/><path d="M8 20 L152 20" stroke="${W}" stroke-width="2" stroke-linecap="round"/><circle cx="8" cy="20" r="6" fill="${W}" opacity=".9"/>`);
    case 'lance': return wrap(`<path d="M8 20 L152 20" stroke="${C}" stroke-width="20" stroke-linecap="round" opacity=".45" filter="url(#${id})"/><path d="M8 20 L152 20" stroke="${C}" stroke-width="12" stroke-linecap="round"/><path d="M8 20 L152 20" stroke="${W}" stroke-width="3.5" stroke-linecap="round"/>`);
    case 'rail': return wrap(`<path d="M8 18 L150 20 L8 22 Z" fill="${C}" filter="url(#${id})"/><path d="M8 19.2 L152 20 L8 20.8 Z" fill="${W}"/><line x1="8" y1="21.8" x2="140" y2="20.4" stroke="${C}" stroke-width="1"/>`);
    case 'kinetic': return wrap([[16, 14], [36, 24], [58, 17], [80, 22], [100, 15], [122, 21], [142, 18]].map(([x, y], i) => `<line x1="${x - 10}" y1="${y}" x2="${x}" y2="${y}" stroke="${C}" stroke-width="2.2" stroke-linecap="round" opacity="${.45 + i * .08}"/><circle cx="${x}" cy="${y}" r="1.8" fill="${W}"/>`).join(''));
    case 'plasma': return wrap(`<path d="M10 20 Q60 12 96 20 Q60 28 10 20Z" fill="${C}" opacity=".35"/><circle cx="112" cy="20" r="15" fill="${C}" opacity=".55" filter="url(#${id})"/><circle cx="112" cy="20" r="10" fill="${C}"/><circle cx="114" cy="19" r="4.5" fill="${W}"/>`);
    case 'ion': return wrap(`<circle cx="22" cy="20" r="14" fill="${C}" opacity=".5" filter="url(#${id})"/><circle cx="22" cy="20" r="7" fill="${W}"/>
      <path d="M30 20 L156 20" stroke="${C}" stroke-width="16" opacity=".35"/><path d="M30 20 L156 20" stroke="${hex(c.map(v => (v + 1) / 2))}" stroke-width="7"/><path d="M30 20 L156 20" stroke="${W}" stroke-width="2.5"/>`);
    case 'arc': return wrap(`<path d="M8 20 L28 10 L46 27 L66 12 L86 28 L104 9 L124 25 L140 14 L154 20" fill="none" stroke="${C}" stroke-width="7" opacity=".5" filter="url(#${id})" stroke-linejoin="round"/><path d="M8 20 L28 10 L46 27 L66 12 L86 28 L104 9 L124 25 L140 14 L154 20" fill="none" stroke="${C}" stroke-width="3.5" stroke-linejoin="round"/><path d="M8 20 L28 10 L46 27 L66 12 L86 28 L104 9 L124 25 L140 14 L154 20" fill="none" stroke="${W}" stroke-width="1.2" stroke-linejoin="round"/>`);
  }
}

// ---- section 2: star systems ----
const SYS_NAMES = ['Giant sun', 'Five worlds', 'Ringed kingdom', 'Binary dawn', 'Ocean frontier', 'Ice giant moons', 'Eclipse', 'Ember worlds'];
const STARS = [[1, .38, .08], [1, .72, .28], [.55, .72, 1], [1, .2, .13]];
const DEFAULT_SUN = [1, .95, .86];
const HAS_STAR = [true, false, true, true, false, false, true, true];
const PAL_PAIRS = [[[.40, .35, .29], [.55, .50, .42]], [[.29, .36, .40], [.43, .49, .52]], [[.37, .33, .35], [.49, .45, .46]], [[.34, .37, .31], [.47, .49, .42]], [[.38, .36, .32], [.52, .49, .43]]];
const BODY = {
  gas: ['Gas giant / rocky (shared palette pick)', PAL_PAIRS.map(p => p[0])],
  ocean: ['Ocean world', [[.10, .19, .25], [.10, .225, .295]]],
  ice: ['Ice world', [[.37, .43, .46], [.57, .62, .64]]],
  volc: ['Volcanic world', [[.11, .065, .05], [.65, .24, .09], [.65, .34, .09]]]
};
const SYS_BODIES = [
  'Large star (r 1.38), rocky world, volcanic world',
  'No star. Ocean, ringed gas giant, rocky, ice, volcanic in a row',
  'Ringed gas giant with 5 moons, small distant star',
  'Two stars, ocean world with 2 moons',
  'No star. Large ocean world, 3 moons, ringed gas giant',
  'No star. Ice world (60% ringed) with 7 moons',
  'Star with a rocky world 0.035 rad off its face, 2 moons',
  'Volcanic main world, star, small volcanic world, 3 moons'
];
const SYS_KINDS = [['gas', 'volc'], ['ocean', 'gas', 'ice', 'volc'], ['gas', 'ice'], ['ocean'], ['ocean', 'gas'], ['ice'], ['gas'], ['volc', 'gas']];
const sunCol = base => luminanceTo(base.map(v => .9 + .1 * v), 1.03);
function sysCard(i) {
  const G = PX.GRADES[i];
  const neb = G.nebB.map((v, k) => v + G.nebA[k] * .5);
  const fill = luminanceTo(normalise(neb).map((v, k) => [.9, .94, 1][k] * .9 + .1 * v * 1.73), .9);
  const liftH = G.lift.map(x => x * .5), gainH = G.gain.map(x => 1 + (x - 1) * .5);
  const stars = HAS_STAR[i]
    ? `<div class="row">${STARS.map(s => `<div class="star"><span class="dot" style="background:${hex(s)}"></span><code>${hex(s)}</code><span class="arrow">key</span><span class="dot" style="background:${hex(sunCol(s))}"></span><code>${rgbTxt(sunCol(s))}</code></div>`).join('')}</div><p class="note">Any of the four star colours can be picked by the seed. The key light is the star pulled 90% toward white at luminance 1.03.</p>`
    : `<div class="row"><div class="star"><span class="dot" style="background:${hex(DEFAULT_SUN)}"></span><code>${hex(DEFAULT_SUN)}</code><span class="arrow">key</span><span class="dot" style="background:${hex(sunCol(DEFAULT_SUN))}"></span><code>${rgbTxt(sunCol(DEFAULT_SUN))}</code></div></div><p class="note">No star body in this style: the fallback base [1, .95, .86] lights the fleet.</p>`;
  const kinds = SYS_KINDS[i].map(k => `<div class="pl"><span class="pln">${BODY[k][0]}</span><span class="minis">${BODY[k][1].map(c => chip(c)).join('')}</span></div>`).join('');
  const gradient = `radial-gradient(120% 90% at 78% 22%, ${hex(G.nebA.map(v => v * 2.2))} 0%, transparent 55%), radial-gradient(110% 100% at 15% 90%, ${hex(G.nebB.map(v => v * 2.2))} 0%, transparent 60%), #05070a`;
  return `<article class="card sys">
  <div class="sky" style="background:${gradient}"><span class="sysno">style ${i}</span><h3>${G.name}</h3></div>
  <div class="body">
    <div class="swrow">${sw(G.nebA, 'nebula A')}${sw(G.nebB, 'nebula B')}${sw(fill, 'derived fill', 'hull fill light')}</div>
    <table class="kv"><tr><th>lift</th><td>[${G.lift.map(f3).join(', ')}] <span class="dim">→ [${liftH.map(f3).join(', ')}] applied</span></td></tr>
    <tr><th>gain</th><td>${rgbTxt(G.gain)} <span class="dim">→ ${rgbTxt(gainH)} applied</span></td></tr>
    <tr><th>saturation</th><td>${G.sat}</td></tr><tr><th>contrast</th><td>${G.con}</td></tr><tr><th>nebula k</th><td>${G.neb}</td></tr></table>
    <h4>Star and key light</h4>${stars}
    <h4>Worlds</h4><p class="small">${SYS_BODIES[i]}.</p>
    <div class="pls">${kinds}</div>
  </div></article>`;
}

// ---- section 3: fleets ----
function fleetCard(r) {
  const R = RACE_DEFS[r], [color, trim, accent, pattern, surface, gloss] = families[r];
  const wide = RACE_WIDE_VALUES[r] || {};
  const pat = wide.pattern ?? pattern, surf = wide.surface ?? surface, gl = wide.gloss ?? gloss;
  let hull = color, tr = trim, ac = accent;
  if (r === 20) { hull = [.33, .36, .40]; tr = wide.trim; ac = wide.accent; }
  if (r === 21) { hull = wide.color; tr = wide.trim; ac = wide.accent; }
  if (r === 17) { hull = ANCIENT[0]; tr = hull.map(x => x * .62); ac = FO_WEAPONS[0][1]; }
  const glLo = gl * .68, glHi = gl * .84;
  const metal = METAL[r];
  const engine = ENGINE_RACES.includes(r)
    ? `<div class="eng"><span class="chip sm" style="background:linear-gradient(90deg,${hex(ENGINE_COL)},${hex(ENGINE_CORE)})"></span><span>Authored drive outlets: shared kind-20 plume ${hex(ENGINE_COL)} → ${hex(ENGINE_CORE)} core, grows with throttle.</span></div>`
    : `<div class="eng"><span class="chip sm" style="background:${hex(R.beam)}"></span><span>No plume in code${[1, 8, 15, 21].includes(r) ? ' (organic ships get no rocket exhaust)' : ''}. Drive glow uses the beam colour ${hex(R.beam)} <em class="tag">intention</em></span></div>`;
  const ov = (OVERRIDES[r] || []).map(([name, o, extra]) => {
    const cs = [o.color && chip(paintHull(o.color), 'hull'), o.trim && chip(paintTrim(o.trim), 'trim'), o.accent && chip(paintAcc(o.accent), 'accent')].filter(Boolean).join('');
    return `<li><span class="minis">${cs || '<span class="dim">same colours</span>'}</span><span><b>${esc(name)}</b>${extra ? ` <span class="dim">${extra}</span>` : ''}</span></li>`;
  }).join('');
  const kind = deathEffectKind(r);
  return `<article class="card fleet" id="fleet-${r}">
  <header><span class="idx">${String(r).padStart(2, '0')}</span><div><h3>${esc(SHORT[r])}</h3><p class="fr">${esc(R.name)} · ${esc(R.fr)}</p></div></header>
  <div class="hullbar" style="--h:${hex(paintHull(hull))};--t:${hex(paintTrim(tr))};--a:${hex(paintAcc(ac))}"><span></span><span></span><span></span></div>
  <div class="swrow">${sw(paintHull(hull), 'hull', `raw ${hex(hull)}`)}${sw(paintTrim(tr), 'trim', `raw ${hex(tr)}`)}${sw(paintAcc(ac), 'accent', `raw ${hex(ac)}`)}</div>
  ${RACE_WIDE[r] ? `<p class="note">${RACE_WIDE[r]}${r === 17 ? ' Swatch shows ancient 0.' : r === 20 ? ' Swatch shows chapter 0.' : ' Swatch shows brood 0.'}</p>` : ''}
  <table class="kv">
    <tr><th>pattern</th><td><code>${pat}</code> ${PATTERN[pat]}</td></tr>
    <tr><th>surface</th><td><code>${surf}</code> ${SURFACE[surf]}</td></tr>
    <tr><th>gloss</th><td><code>${gl}</code> → ${f2(glLo)}-${f2(glHi)} per vessel · roughness ≈ ${f2(1 - glHi)}-${f2(1 - glLo)}</td></tr>
    <tr><th>material</th><td>${metal[0]} · metalness ≈ ${metal[1]} <em class="tag">intention</em></td></tr>
  </table>
  ${engine}
  ${ov ? `<details open><summary>Class overrides</summary><ul class="ov">${ov}</ul></details>` : ''}
  <p class="small dim">Dies as <b>${R.boom}</b>, flash kind ${kind} (${KIND[kind].name}).</p>
</article>`;
}

// ---- section 4: weapons ----
function weaponRow(r) {
  const R = RACE_DEFS[r], F = FIRE[R.fire], L = LITERAL[r];
  const changed = hex(L.beam) !== hex(R.beam);
  const extra = r === 17 ? `<div class="wcell"><span class="wlab">First One arc (ancient 6, Living lightning)</span>${sketch('arc', FO_WEAPONS[6][1])}</div>` : '';
  return `<article class="wrow">
  <div class="whead"><b>${esc(SHORT[r])}</b><span class="dim">${esc(R.fr)}</span><code class="fire">${R.fire}</code></div>
  <div class="wsw">${sw(R.beam, 'beam')}${sw(R.ion, 'ion')}</div>
  <div class="wcell"><span class="wlab">${F[1]}</span>${sketch(F[0], R.beam)}</div>
  <div class="wcell"><span class="wlab">Ion lance: charge glow, then collapsing column</span>${sketch('ion', R.ion)}</div>
  ${extra}
  ${changed ? `<p class="note mono">literal in RACE_DEFS: ${hex(L.beam)} / ${hex(L.ion)} (unused)</p>` : ''}
</article>`;
}

// ---- explosion SVGs ----
function lobed(cx, cy, r, lobes, seed, fill, op = 1) {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const k = .72 + .28 * Math.sin(a * lobes + seed * 43) + .14 * Math.sin(a * (lobes + 4) - seed * 17);
    pts.push([cx + Math.cos(a) * r * Math.max(.3, k), cy + Math.sin(a) * r * Math.max(.3, k)]);
  }
  return `<path d="M${pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L')}Z" fill="${fill}" opacity="${op}"/>`;
}
function spikes(cx, cy, r, n, col, w = 1.6) {
  let s = '';
  for (let i = 0; i < n; i++) { const a = i / n * 6.283 + .3 * Math.sin(i * 7.1), L = r * (.7 + .4 * Math.abs(Math.sin(i * 3.3))); s += `<line x1="${cx + Math.cos(a) * r * .35}" y1="${cy + Math.sin(a) * r * .35}" x2="${(cx + Math.cos(a) * L).toFixed(1)}" y2="${(cy + Math.sin(a) * L).toFixed(1)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; }
  return s;
}
const EMBER = hex([.95, .23, .045]), HOT = hex([1, .97, .88]), ORANGE = hex([1, .45, .16]);
const gradDefs = `<defs>
<radialGradient id="heat"><stop offset="0" stop-color="${HOT}"/><stop offset=".35" stop-color="#ffd7a0"/><stop offset=".7" stop-color="${ORANGE}"/><stop offset="1" stop-color="${EMBER}" stop-opacity="0"/></radialGradient>
<radialGradient id="teal"><stop offset="0" stop-color="#e0fffa"/><stop offset=".5" stop-color="${hex([.12, .92, .72])}"/><stop offset="1" stop-color="${hex([.12, .92, .72])}" stop-opacity="0"/></radialGradient>
<radialGradient id="nova"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="${hex([.35, .82, 1])}" stop-opacity=".7"/><stop offset="1" stop-color="${hex([.35, .82, 1])}" stop-opacity="0"/></radialGradient>
<filter id="soft"><feGaussianBlur stdDeviation="2"/></filter><filter id="soft6"><feGaussianBlur stdDeviation="6"/></filter></defs>`;
const boomSvg = {
  fighter: `<svg viewBox="0 0 200 140" class="bsvg" role="img" aria-label="fighter explosion">${gradDefs}${spikes(100, 70, 34, 6, ORANGE, 1.4)}${lobed(100, 70, 22, 4, .37, 'url(#heat)')}<circle cx="100" cy="70" r="5" fill="#fff"/></svg>`,
  frigate: `<svg viewBox="0 0 200 140" class="bsvg" role="img" aria-label="frigate explosion">${gradDefs}<g filter="url(#soft)">${lobed(72, 76, 20, 5, .11, 'url(#heat)', .8)}${lobed(128, 62, 18, 3, .63, 'url(#heat)', .75)}</g>${spikes(100, 70, 58, 10, ORANGE, 1.3)}${lobed(100, 70, 38, 5, .81, 'url(#heat)')}${lobed(84, 58, 12, 4, .22, 'url(#heat)', .9)}<circle cx="100" cy="70" r="7" fill="#fff"/></svg>`,
  capital: `<svg viewBox="0 0 200 140" class="bsvg" role="img" aria-label="capital explosion">${gradDefs}<rect x="18" y="66" width="164" height="8" rx="3" fill="#1a2028"/>${[0, 1, 2, 3, 4, 5, 6].map(i => lobed(26 + i * 24.6, 70 + (i % 2 ? -3 : 3), 8 + i * 1.6, 3 + (i % 3), i * .13, 'url(#heat)', .45 + i * .07)).join('')}<g filter="url(#soft6)">${lobed(100, 70, 60, 4, .52, 'url(#heat)', .7)}</g>${spikes(100, 70, 68, 14, ORANGE, 1.2)}${lobed(100, 70, 40, 6, .91, 'url(#heat)')}<circle cx="100" cy="70" r="9" fill="#fff"/></svg>`,
  first: `<svg viewBox="0 0 200 140" class="bsvg" role="img" aria-label="First One weapon flash">${gradDefs}<circle cx="100" cy="70" r="66" fill="url(#nova)" opacity=".55"/><circle cx="100" cy="70" r="62" fill="none" stroke="${hex([.35, .82, 1])}" stroke-width="3" opacity=".55"/>${(() => { let s = ''; for (let i = 0; i < 2; i++) { const pts = []; for (let j = 0; j < 96; j++) { const a = j / 96 * 6.283, k = .78 + .22 * Math.sin(a * 2 + i * 1.7); pts.push([100 + Math.cos(a) * 52 * k * (i ? .6 : 1), 70 + Math.sin(a) * 52 * k * (i ? .6 : 1)]); } s += `<path d="M${pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join('L')}Z" fill="url(#teal)" opacity="${i ? 1 : .8}"/>`; } return s; })()}${spikes(100, 70, 70, 18, hex([.12, .92, .72]), 1)}<circle cx="100" cy="70" r="12" fill="#fff"/></svg>`
};

// ---- page ----
const fleetCards = RACE_DEFS.map((_, r) => fleetCard(r)).join('\n');
const weaponRows = RACE_DEFS.map((_, r) => weaponRow(r)).join('\n');
const sysCards = PX.GRADES.map((_, i) => sysCard(i)).join('\n');
const tierRows = PX.ORDER.map(k => { const T = PX.TIERS[k]; return `<tr><th>${T.name}</th><td>${T.bloomLevels}</td><td>${T.msaa}×</td><td>${T.nebula}</td><td>${T.grain ? 'yes' : 'no'}</td><td>${T.dprCap}</td><td>${T.minScale}</td><td>${T.fleet}</td></tr>`; }).join('');
const deathTable = Object.entries(KIND).map(([k, v]) => {
  const races = RACE_DEFS.map((_, r) => r).filter(r => deathEffectKind(r) === +k).map(r => SHORT[r]).join(', ');
  return `<tr><td><code>${k}</code></td><td><span class="grad" style="background:radial-gradient(circle,#fffff5 0 18%,${hex(v.cool)} 55%,transparent 72%)"></span></td><td>${v.name}<br><code class="dim">${rgbTxt(v.cool)}</code></td><td>${races}</td></tr>`;
}).join('');
const boomTable = Object.entries(BOOM).map(([k, v]) => `<tr><td><code>${k}</code></td><td>${RACE_DEFS.map((R, r) => R.boom === k ? SHORT[r] : null).filter(Boolean).join(', ')}</td><td>${v}</td></tr>`).join('');
const foKinds = [[4, 'ion nova', [1, 1, 1], [.35, .82, 1], 'echo .22 s after every First One release (.65 × radius); also ion blasts and stun hits'],
  [5, 'gold lightning', [1, 1, .82], [1, .68, .12], 'defined in shader (Traveller, Lordship); not emitted by current code'],
  [6, 'teal flower', [.88, 1, .98], [.12, .92, .72], 'First One weapon 6 (Living lightning)'],
  [7, 'gold-green ending', [1, 1, .82], [.32, 1, .28], 'defined in shader (Lorien, Dark Knife); not emitted by current code'],
  [8, 'red claw', [1, .95, .88], [1, .22, .08], 'every other First One weapon release (1.3 × radius)'],
  [9, 'ice bloom', [1, 1, 1], [.55, .82, 1], 'defined in shader (Thoughtforce, the Hand); not emitted by current code']]
  .map(([k, n, a, b2, note]) => `<tr><td><code>${k}</code></td><td><span class="grad" style="background:radial-gradient(circle,${hex(a)} 0 22%,${hex(b2)} 58%,transparent 72%)"></span></td><td>${n}</td><td class="small">${note}</td></tr>`).join('');
const foList = FO_WEAPONS.map((w, i) => `<span class="fo">${chip(w[1])}${esc(w[0])} <span class="dim">r ${w[4]}</span></span>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tribute War Style Sheet</title>
<meta name="description" content="Visual style sheet for The Tribute War: one lighting and colour language for 23 fleets. Values are taken from armada-war-tribute-new.html, armada-post-new.js and armada-systems-new.js.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{--bg:#0b0f14;--panel:#111821;--panel2:#0e141c;--line:#1f2a36;--ink:#e6edf3;--dim:#8b9aab;--faint:#5d6b7b;--accent:#7cc4ff;--warn:#ffb86b;--bad:#ff7a7a;--good:#7fe0a8;
--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;--sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 var(--sans);overflow-x:hidden}
a{color:var(--accent)}
code,.mono{font-family:var(--mono);font-size:.86em}
.wrap{max-width:1240px;margin:0 auto;padding:0 16px}
header.top{padding:48px 0 28px;border-bottom:1px solid var(--line);background:radial-gradient(80% 120% at 85% 0%,#2a1a10 0%,transparent 55%),radial-gradient(70% 120% at 0% 100%,#101c2e 0%,transparent 60%)}
header.top h1{font-size:clamp(28px,5vw,46px);line-height:1.05;margin:0 0 10px;letter-spacing:-.01em}
header.top .lede{font-size:clamp(16px,2.2vw,20px);color:#c9d4df;max-width:760px;margin:0 0 16px}
.meta{color:var(--dim);font-size:13px;max-width:820px}
nav.toc{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:18px;font-size:13px}
nav.toc a{color:var(--dim);text-decoration:none;border-bottom:1px dotted var(--faint)}
nav.toc a:hover{color:var(--ink)}
section{padding:40px 0 8px}
section>h2{font-size:24px;margin:0 0 6px;display:flex;gap:10px;align-items:baseline}
section>h2 .n{font-family:var(--mono);color:var(--faint);font-size:15px}
section>p.intro{color:#c3cdd8;max-width:860px;margin:0 0 18px}
h3{margin:0;font-size:17px}
h4{margin:14px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}
.small{font-size:13px}.dim{color:var(--dim)}
.note{font-size:12.5px;color:var(--dim);margin:6px 0 0}
em.tag{font-style:normal;font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--warn);border:1px solid #5a4020;border-radius:3px;padding:0 4px;white-space:nowrap}
.legend{font-size:13px;color:var(--dim);margin:0 0 18px}
.grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;min-width:0}
.card .body{padding:12px 14px 14px}
/* principles */
.prin{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr))}
.prin .card{padding:16px}
.prin h3{margin-bottom:6px}
.prin ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;color:#c9d4df}
.prin li{margin:3px 0}
.formula{font-family:var(--mono);font-size:12px;background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:8px 10px;margin-top:10px;overflow-x:auto;white-space:pre-wrap;color:#bcd}
.rig{display:block;width:100%;height:auto;margin-top:10px}
/* swatches */
.swrow{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
.wsw{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.sw{display:flex;flex-direction:column;gap:2px;min-width:0}
.sw .chip{display:block;height:34px;border-radius:6px;border:1px solid rgba(255,255,255,.08)}
.chip.sm{display:inline-block;width:28px;height:14px;border-radius:3px;flex:none}
.swl{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--dim)}
.sw code{font-size:12px}
.swsub{font-family:var(--mono);font-size:10.5px;color:var(--faint)}
.mini{display:inline-block;width:16px;height:16px;border-radius:3px;border:1px solid rgba(255,255,255,.1);margin-right:3px;vertical-align:middle}
.minis{display:inline-flex;flex-wrap:wrap;gap:0;flex:none}
table.kv{width:100%;border-collapse:collapse;font-size:12.5px}
table.kv th{text-align:left;font-weight:500;color:var(--dim);padding:3px 8px 3px 0;vertical-align:top;white-space:nowrap;width:1%}
table.kv td{padding:3px 0;font-family:var(--mono);font-size:11.5px;word-break:break-word}
table.kv td code{color:var(--accent)}
/* systems */
.sys .sky{height:92px;padding:12px 14px;display:flex;flex-direction:column;justify-content:flex-end;position:relative}
.sys .sysno{position:absolute;top:10px;right:12px;font-family:var(--mono);font-size:11px;color:rgba(255,255,255,.55)}
.sys h3{font-size:19px;text-shadow:0 1px 8px #000}
.star{display:flex;align-items:center;gap:6px;font-size:11px;flex-wrap:wrap}
.star .dot{width:14px;height:14px;border-radius:50%;box-shadow:0 0 8px currentColor;flex:none}
.star .arrow{color:var(--faint);font-size:10px;text-transform:uppercase}
.sys .row{display:grid;gap:4px}
.pls{display:grid;gap:4px;margin-top:6px}
.pl{display:flex;justify-content:space-between;gap:8px;font-size:12px;align-items:center;flex-wrap:wrap}
.pln{color:var(--dim)}
/* fleets */
.fleet{padding:14px}
.fleet header{display:flex;gap:10px;align-items:flex-start}
.fleet .idx{font-family:var(--mono);color:var(--faint);font-size:13px;padding-top:2px}
.fleet .fr{margin:1px 0 0;font-size:11.5px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
.hullbar{display:grid;grid-template-columns:6fr 3fr 1fr;height:10px;border-radius:5px;overflow:hidden;margin-top:12px}
.hullbar span:nth-child(1){background:var(--h)}.hullbar span:nth-child(2){background:var(--t)}.hullbar span:nth-child(3){background:var(--a)}
.eng{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;margin-top:10px;color:#c9d4df}
.eng .chip{margin-top:3px}
details{margin-top:10px;font-size:12.5px}
summary{cursor:pointer;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.07em}
ul.ov{list-style:none;padding:0;margin:6px 0 0;display:grid;gap:4px}
ul.ov li{display:flex;gap:8px;align-items:center}
/* weapons */
.wgrid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(min(100%,370px),1fr))}
.wrow{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:grid;gap:8px;min-width:0}
.whead{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.whead .fire{margin-left:auto;background:#17212c;border:1px solid var(--line);padding:1px 6px;border-radius:4px;color:var(--accent)}
.wcell{background:#05080c;border:1px solid #16202b;border-radius:6px;padding:6px 8px}
.wlab{display:block;font-size:11.5px;color:var(--dim);margin-bottom:2px}
svg.wsk{display:block;width:100%;height:auto;max-height:52px}
.fo{display:inline-flex;align-items:center;gap:4px;font-size:12px;margin:2px 12px 2px 0}
/* explosions */
.tiers{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr))}
.tier{padding:14px}
.tier .stage{background:#030507;border-radius:8px;border:1px solid #141c26;margin:10px 0}
svg.bsvg{display:block;width:100%;height:auto}
.tier dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:12.5px}
.tier dt{color:var(--dim)}.tier dd{margin:0;font-family:var(--mono);font-size:11.5px}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel);margin-top:14px}
table.dt{width:100%;border-collapse:collapse;font-size:13px;min-width:0}
table.dt th,table.dt td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
table.dt th{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--dim);font-weight:500}
table.dt tr:last-child td{border-bottom:0}
.grad{display:inline-block;width:40px;height:40px;border-radius:50%}
/* don'ts */
.donts{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,360px),1fr))}
.dont{padding:0}
.dont .demo{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line)}
.dont .demo>div{position:relative;min-height:110px}
.dont .demo span.lbl{position:absolute;z-index:2;left:8px;top:6px;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;padding:1px 5px;border-radius:3px;background:rgba(0,0,0,.55)}
.dont .no .lbl{color:var(--bad)}.dont .yes .lbl{color:var(--good)}
.dont .txt{padding:12px 14px}
.dont .txt p{margin:4px 0;font-size:13.5px}
.dont .txt b.why{color:var(--bad)}.dont .txt b.fix{color:var(--good)}
.demo svg{display:block;width:100%;height:100%;position:absolute;inset:0}
footer{border-top:1px solid var(--line);margin-top:40px;padding:22px 0 40px;color:var(--dim);font-size:12.5px}
@media (max-width:480px){
  body{font-size:14.5px}
  header.top{padding:32px 0 20px}
  .swrow{gap:6px}
  .sw .chip{height:28px}
  .sw code{font-size:11px}
  .swsub{font-size:9.5px}
  table.dt th,table.dt td{padding:7px 6px}
  table.tiers-t{font-size:11px}
  table.tiers-t th,table.tiers-t td{padding:6px 4px;font-size:10.5px}
}
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <p class="meta mono">design/tribute-new · style sheet · for developers</p>
  <h1>Every fleet we grew up with,<br>lit by the same sun</h1>
  <p class="lede">The Tribute War puts 23 fleets in one sky. Each one must be recognisable from its silhouette alone, while all of them share one light, one grade and one idea of what energy looks like.</p>
  <p class="meta">Swatches and numbers are read out of the code (<code>hullFinish()</code>, <code>RACE_DEFS</code> + <code>FLEET_BEAM_HEX</code>, the flash shader, <code>setupWarLight()</code>, <code>GRADES</code>, <code>TIERS</code>, <code>ArmadaSystems.generate</code>). Anything marked <em class="tag">intention</em> is design guidance with no code behind it yet. This is a fan tribute: no logos, no copied artwork, only colour and shape language.</p>
  <nav class="toc"><a href="#principles">1 Principles</a><a href="#systems">2 Star systems</a><a href="#paint">3 Paint and material</a><a href="#weapons">4 Weapon signatures</a><a href="#explosions">5 Explosion tiers</a><a href="#donts">6 Do not do this</a></nav>
</div></header>

<main class="wrap">
<section id="principles">
  <h2><span class="n">01</span>Principles</h2>
  <p class="intro">Three rules. Everything else on this page follows from them.</p>
  <div class="prin">
    <article class="card"><h3>One sun per system</h3>
      <p class="small">Every hull in the battle is lit by the same rig, built once per system in <code>setupWarLight()</code>. A red dwarf warms the whole fleet a little; it never repaints it.</p>
      <ul>
        <li><b>Key</b>: direction of the system's star body; colour is the star pulled 90% toward white at luminance 1.03. Planets take its direction without the tint.</li>
        <li><b>Fill</b>: from the side opposite the sun, raised 0.25. Its colour comes from the nebula (<code>nebB + ½·nebA</code>) mixed 10% into a cool white <code>[.9,.94,1]</code>, at luminance 0.9.</li>
        <li><b>Rim</b>: a cool Fresnel rim tinted by the fill, <code>(.10 + .24·dark)</code>, so it is strongest on dark hulls. Shadow chitin and Borg get an extra grazing-angle lift.</li>
        <li><b>Eclipse</b>: the four worlds nearest the battle can shadow the sun. <b>One</b> explosion point light: the brightest death flash of the last 0.9 s.</li>
      </ul>
      <svg class="rig" viewBox="0 0 340 120" role="img" aria-label="Lighting rig diagram">
        <circle cx="40" cy="30" r="14" fill="#ffd9a0"/><text x="40" y="60" fill="#8b9aab" font-size="10" text-anchor="middle" font-family="IBM Plex Mono,monospace">key (star)</text>
        <line x1="56" y1="36" x2="140" y2="62" stroke="#ffd9a0" stroke-width="2" stroke-dasharray="4 3"/>
        <path d="M130 70 L210 58 L250 70 L210 82 Z" fill="#6b7682"/><path d="M130 70 L210 58 L250 70" fill="none" stroke="#ffe7c2" stroke-width="2"/><path d="M130 70 L210 82 L250 70" fill="none" stroke="#9cc3ff" stroke-width="1.6" opacity=".9"/>
        <circle cx="306" cy="98" r="10" fill="#9cb8e8" opacity=".75"/><text x="300" y="120" fill="#8b9aab" font-size="10" text-anchor="middle" font-family="IBM Plex Mono,monospace">fill (nebula)</text>
        <line x1="294" y1="94" x2="240" y2="78" stroke="#9cb8e8" stroke-width="2" stroke-dasharray="4 3"/>
        <text x="190" y="106" fill="#9cc3ff" font-size="10" text-anchor="middle" font-family="IBM Plex Mono,monospace">cool rim on the shadow edge</text>
      </svg>
      <div class="formula">shade = (.19 + .62·key + .26·fill + .10·sky) × tone
col  *= mix(fillCol, sunCol, key × 1.6)
col  += fillCol·[.55,.65,.85]·(1−N·V)^2.5·(.10+.24·dark)</div>
    </article>
    <article class="card"><h3>Energy drives bloom, not brightness</h3>
      <p class="small">The scene renders to a half-float target. Hulls are authored at display values and stay near them after tone mapping; only light stacked above white blooms.</p>
      <ul>
        <li>Bloom prefilter passes only luminance above <b>1.5</b> (soft knee 0.5), after decoding to linear.</li>
        <li>Up-chain levels are weighted <b>0.62</b> each: a tight glow, not fog. Low tier uses 3 levels, High and Ultra 5.</li>
        <li>Tone curve: Khronos Neutral shoulder, identity below 0.8, so painted hulls keep their values.</li>
        <li>Auto-exposure only darkens (factor clamped .32 to 1): a capital's death blooms, then the eye recovers over about 2.5 s.</li>
        <li>Weapon cores, explosions, engines, windows carry energy above white. Brighter beam colours get ×1.35 gain.</li>
      </ul>
      <div class="tw" style="margin-top:12px"><table class="dt tiers-t"><tr><th>Tier</th><th>bloom lv</th><th>MSAA</th><th>nebula oct</th><th>grain</th><th>DPR cap</th><th>min scale</th><th>fleet</th></tr>${tierRows}</table></div>
    </article>
    <article class="card"><h3>Silhouettes first</h3>
      <p class="small">A franchise is recognised by its outline long before its colour. Paint supports the shape; it never replaces it.</p>
      <ul>
        <li>Paint is procedural in the ship shader: panel cells, stripes, waves, rings. No textures, no extra meshes, no draw calls.</li>
        <li>Hull colour saturation is muted to 62% (trim 55%, accent 75%), so no fleet shouts over the others.</li>
        <li>Dark hulls (Shadows, Borg, TIE panels) get rim and fill lift so their outline stays readable against black.</li>
        <li>Hulls under about 5 projected pixels become batched coloured silhouettes; heroes and selected ships keep full meshes.</li>
        <li>Recognisable, never copied: proportions and colour language are the tribute; logos and markings stay out. <em class="tag">intention</em></li>
      </ul>
    </article>
  </div>
</section>

<section id="systems">
  <h2><span class="n">02</span>Palette per star system</h2>
  <p class="intro">Eight system styles from <code>armada-systems-new.js</code>, each with a grade from <code>GRADES</code> in <code>armada-post-new.js</code>. The composite applies grades at <b>half strength</b>: the applied lift is <code>lift × .5</code> and the applied gain is <code>1 + (gain − 1) × .5</code>. The "derived fill" swatch is the hull fill colour computed with the <code>setupWarLight()</code> formula. Besides the worlds listed on each card, every system adds one world behind the opposing fleet and one below the battle.</p>
  <div class="grid">${sysCards}</div>
</section>

<section id="paint">
  <h2><span class="n">03</span>Paint and material sheet</h2>
  <p class="intro"><code>hullFinish(s)</code> gives each fleet a family row <code>[hull, trim, accent, pattern, surface, gloss]</code>, then applies class overrides. Before the shader sees them, colours are muted: hull saturation × <b>.62</b> (then clamped .02 to .94), trim × <b>.55</b>, accent × <b>.75</b>. Each vessel also gets a stable tone of <b>.92 to 1.05</b>, a warm/cool shift of up to ±.0125 on red and blue, and gloss × .68 to .84.</p>
  <p class="legend">Big swatches show the colour after muting at tone 1.0; the small "raw" value is the literal in the code. Accent is the colour of windows, seams and running lights (energy above white). The ship shader has no PBR roughness or metalness inputs, so "roughness ≈ 1 − gloss" and the metalness numbers are guidance for anyone porting to a PBR material. <em class="tag">intention</em></p>
  <div class="grid">${fleetCards}</div>
</section>

<section id="weapons">
  <h2><span class="n">04</span>Weapon signatures side by side</h2>
  <p class="intro">Beam colours come from <code>FLEET_BEAM_HEX</code>, which overwrites the <code>beam</code> and <code>ion</code> literals in <code>RACE_DEFS</code> at load (the old literals are listed small under each row, for anyone reading RACE_DEFS and wondering). Every fleet's ion colour is derived as <code>beam × .82 + .18</code>. The <code>fire</code> type picks the shape. Size sets width and traverse speed; the fleet sets colour and projectile speed. Every sketch uses the fleet colour for the sheath and white for the core, as the renderer does.</p>
  <p class="legend">Note: <code>WEAPONS-NEW.md</code> still says "Imperial fighters fire green and Rebels red". Current code gives Imperial <code>#ff3829</code> (red) and Rebel <code>#66ff73</code> (green), and the comment "TIEs spit red, the wall spits green" beside the turbo→laser swap is out of date. Only the shape changes for hulls under 38 m.</p>
  <div class="wgrid">${weaponRows}</div>
  <h4 style="margin-top:22px">First One weapons (<code>FO_WEAPONS</code>)</h4>
  <p class="small">${foList}</p>
  <p class="note">The ion charge-up is a muzzle glow (flash kind 21) in a fixed cyan: <code>${hex([.18, .55, .76])}</code> → <code>${hex([.84, .96, 1])}</code> core, energy rising with charge progress. The lance that follows uses the fleet's ion colour: an outer sheath, a mid layer halfway to white, a white core, and a short early bloom. First Ones use each ancient's own colour.</p>
</section>

<section id="explosions">
  <h2><span class="n">05</span>Explosion scale tiers</h2>
  <p class="intro">Every death flash goes through <code>deathFlash()</code>, which limits the flash to <code>max(30, 1.1 × slen)</code>. The recipe's base size is <code>big = max(46, slen × (capital ? 3 : 2))</code>. Death kinds (10 and above) live 1.35 s and are capped at <b>240 px</b>. Heat and First One kinds (3 to 9) live 2.15 s and are capped at <b>640 px</b>. Explosions are heat that cools in vacuum: uneven lobes seeded per flash, and no persistent fireball ring.</p>
  <div class="tiers">
    <article class="card tier"><h3>Fighter</h3><div class="stage">${boomSvg.fighter}</div>
      <dl><dt>threshold</dt><dd>small craft, slen under ~40 (TIE turbo→laser swap at 38)</dd><dt>flash size</dt><dd>30 (floor wins for slen ≤ 27)</dd><dt>shape</dt><dd>one lobed puff, few sparks</dd><dt>debris</dt><dd>≤ 6 fragments</dd></dl></article>
    <article class="card tier"><h3>Frigate</h3><div class="stage">${boomSvg.frigate}</div>
      <dl><dt>threshold</dt><dd>slen ≈ 40-180</dd><dt>flash size</dt><dd>44-198 (1.1 × slen)</dd><dt>shape</dt><dd>main bloom + offset cluster, sparks</dd><dt>debris</dt><dd>breakup or disabled hulk</dd></dl></article>
    <article class="card tier"><h3>Capital</h3><div class="stage">${boomSvg.capital}</div>
      <dl><dt>threshold</dt><dd>hulls ≥ 10 or slen ≥ 180 (isCapital)</dd><dt>flash size</dt><dd>≥ 198, screen cap 240 px</dd><dt>shape</dt><dd>cook-off chain along the keel, then 1.1× final</dd><dt>debris</dt><dd>≤ 32 fragments, hulks ≤ 180 s</dd></dl></article>
    <article class="card tier"><h3>First One</h3><div class="stage">${boomSvg.first}</div>
      <dl><dt>source</dt><dd>foRelease(): weapon impact</dd><dt>flash size</dt><dd>radius × 1.3 = 312-845, echo × .65</dd><dt>shape</dt><dd>two-petal spiked flower (kind 6/8) + ion-nova ring (kind 4)</dd><dt>cap</dt><dd>640 px, 2.15 s life</dd></dl></article>
  </div>
  <p class="note">First One hulls die with the Choir's <code>flash</code> recipe in thermal kind 10. The flower shapes above are their weapons landing, which is the largest light in the game.</p>
  <h4 style="margin-top:22px">Death kinds (<code>deathEffectKind(race)</code>)</h4>
  <div class="tw"><table class="dt"><tr><th>kind</th><th></th><th>look / cooled colour</th><th>fleets</th></tr>${deathTable}</table></div>
  <p class="note">All death kinds share a white-hot core <code>${hex([1, .97, .9])}</code> that fades fast (exp(−12·age)), then cool to the colour shown. Kind 12 cuts the core to 15% so Shadows go out dark. Kind 13 squares its lobes.</p>
  <h4 style="margin-top:22px">First One and heat kinds (flash shader)</h4>
  <div class="tw"><table class="dt"><tr><th>kind</th><th></th><th>name</th><th>used by</th></tr>
    <tr><td><code>2-3</code></td><td><span class="grad" style="background:radial-gradient(circle,${HOT} 0 22%,${ORANGE} 58%,transparent 72%)"></span></td><td>heat: white → ember</td><td class="small">hits, missiles, mines, sub-flashes. "An explosion is heat, not a team colour."</td></tr>${foKinds}</table></div>
  <h4 style="margin-top:22px">Per-fleet death recipes (<code>boom</code>)</h4>
  <div class="tw"><table class="dt"><tr><th>boom</th><th>fleets</th><th>sequence</th></tr>${boomTable}</table></div>
</section>

<section id="donts">
  <h2><span class="n">06</span>Do not do this</h2>
  <p class="intro">Five ways a space battle turns to mush, and the mechanism in the code that prevents each one.</p>
  <div class="donts">
    ${dont('Blown-out bloom', `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#3a3f48"/><circle cx="50" cy="30" r="40" fill="#fff" opacity=".55" filter="url(#b8)"/><circle cx="50" cy="30" r="18" fill="#fff"/><defs><filter id="b8"><feGaussianBlur stdDeviation="8"/></filter></defs></svg>`,
      `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#06080b"/><path d="M20 34 L60 28 L78 34 L60 40Z" fill="#5d6874"/><circle cx="50" cy="30" r="9" fill="#ff9a40" opacity=".35" filter="url(#b2)"/><circle cx="50" cy="30" r="3" fill="#fff"/><defs><filter id="b2"><feGaussianBlur stdDeviation="2.5"/></filter></defs></svg>`,
      'A glow over everything flattens depth, hides silhouettes, and makes every shot look the same size.',
      'Bloom only takes energy above 1.5× white (soft knee 0.5). Coarse levels are weighted 0.62, and exposure can only darken, so a flash blooms tightly and then settles.')}
    ${dont('Rainbow soup', `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#140a22"/>${['#f0f', '#0ff', '#ff0', '#f40', '#0f4', '#48f'].map((c, i) => `<line x1="${i * 16}" y1="${5 + i * 9}" x2="${100 - i * 10}" y2="${55 - i * 7}" stroke="${c}" stroke-width="3"/>`).join('')}</svg>`,
      `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#07090d"/><line x1="8" y1="18" x2="60" y2="26" stroke="${hex(RACE_DEFS[10].beam)}" stroke-width="3"/><line x1="8" y1="18" x2="60" y2="26" stroke="#fff" stroke-width="1"/><line x1="92" y1="46" x2="44" y2="36" stroke="${hex(RACE_DEFS[11].beam)}" stroke-width="3"/><line x1="92" y1="46" x2="44" y2="36" stroke="#fff" stroke-width="1"/></svg>`,
      'When every beam, grade and nebula is saturated, no single fleet reads and the eye has nowhere to rest.',
      'One signature colour per fleet (FLEET_BEAM_HEX) with a white core. Hull paint is muted to 62% saturation. Grades apply at half strength (lift × .5, gain halfway to 1) with saturation between .86 and 1.05.')}
    ${dont('Lens flares on everything', `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#0a0d14"/><line x1="0" y1="30" x2="100" y2="30" stroke="#8cf" stroke-width="1.5" opacity=".8"/>${[[20, 6], [38, 4], [60, 9], [78, 5]].map(([x, r]) => `<circle cx="${x}" cy="${30 + (x - 50) * .3}" r="${r}" fill="none" stroke="#8cf" opacity=".6"/>`).join('')}<circle cx="50" cy="30" r="4" fill="#fff"/></svg>`,
      `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#07090d"/><circle cx="80" cy="14" r="7" fill="#ffd9a0" opacity=".25" filter="url(#b3)"/><circle cx="80" cy="14" r="3" fill="#fff3dc"/><path d="M18 38 L52 32 L66 38 L52 44Z" fill="#6b7682"/><path d="M18 38 L52 32 L66 38" fill="none" stroke="#ffe7c2" stroke-width="1"/><defs><filter id="b3"><feGaussianBlur stdDeviation="3"/></filter></defs></svg>`,
      'Flares are an artefact of camera glass. On every light they read as a filter, and they cover the silhouettes we are trying to show.',
      'There are no lens flares at all. The sun is a soft falloff in the sky shader (pow 48 and pow 6). Light shows up on the hull as key tint and specular.')}
    ${dont('Identical grey explosions', `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#0a0c10"/>${[20, 50, 80].map(x => `<circle cx="${x}" cy="30" r="12" fill="#9aa0a8" opacity=".8"/>`).join('')}</svg>`,
      `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#06080b"/>${[[20, KIND[10].cool], [50, KIND[11].cool], [80, KIND[13].cool]].map(([x, c]) => `<circle cx="${x}" cy="30" r="12" fill="${hex(c)}" opacity=".85"/><circle cx="${x}" cy="30" r="4" fill="#fff"/>`).join('')}</svg>`,
      'If every ship dies the same way, a kill tells you nothing: you cannot tell whose ship went or how big it was.',
      'Per-fleet death recipes (12 boom styles) and deathEffectKind: ember, reactor blue, dark violet, square Borg green, cold Minbari/Engineer. Size follows slen, and lobes are seeded per flash.')}
    ${dont('Hulls that read as flat plastic', `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#07090d"/><path d="M14 30 L60 20 L86 30 L60 40Z" fill="#7a8490"/></svg>`,
      `<svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMid slice"><rect width="100" height="60" fill="#07090d"/><path d="M14 30 L60 20 L86 30 Z" fill="#8a929c"/><path d="M14 30 L60 40 L86 30 Z" fill="#434b56"/><path d="M14 30 L60 40 L86 30" fill="none" stroke="#8fb4e8" stroke-width="1.2"/><path d="M14 30 L60 20 L86 30" fill="none" stroke="#ffe7c2" stroke-width="1"/>${[[34, 27], [46, 25], [58, 24], [42, 33]].map(([x, y]) => `<rect x="${x}" y="${y}" width="6" height="2" fill="#5f6873"/>`).join('')}<circle cx="70" cy="28" r=".9" fill="#7fe8ff"/><circle cx="52" cy="26" r=".9" fill="#7fe8ff"/></svg>`,
      'Uniform colour with one flat light gives no scale and no material. A Star Destroyer then looks like a toy.',
      'Key plus nebula fill plus a cool Fresnel rim (stronger on dark hulls), procedural panel cells and stripes scaled by hull length, gloss-driven specular, sparse lit windows in accent colour, and per-vessel tone.')}
  </div>
</section>
</main>
<footer><div class="wrap">
  <p>Generated from source on ${new Date().toISOString().slice(0, 10)}. Sources: <code>armada-war-tribute-new.html</code> (hullFinish, RACE_DEFS, FLEET_BEAM_HEX, FO_WEAPONS, flash and ship shaders, boom, deathEffectKind, setupWarLight), <code>armada-post-new.js</code> (GRADES, TIERS, bloom and composite), <code>armada-systems-new.js</code>, <code>WEAPONS-NEW.md</code>, <code>PAINT-FIRE-NEW.md</code>, <code>DEBRIS-NEW.md</code>. If the code changes, this page does not update itself.</p>
  <p>The Tribute War is a non-commercial fan tribute. Franchise names identify the fleets being honoured and belong to their owners.</p>
</div></footer>
</body>
</html>
`;
function dont(title, noSvg, yesSvg, why, fix) {
  return `<article class="card dont"><div class="demo"><div class="no"><span class="lbl">don't</span>${noSvg}</div><div class="yes"><span class="lbl">do</span>${yesSvg}</div></div>
  <div class="txt"><h3>${title}</h3><p><b class="why">Why not.</b> ${why}</p><p><b class="fix">What we do.</b> ${fix}</p></div></article>`;
}
fs.writeFileSync(ROOT + 'design/tribute-new/style.html', html);
console.log('wrote', html.length);
