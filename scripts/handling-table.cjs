#!/usr/bin/env node
/* Writes the per-fleet handling table in BATTLE-AI-NEW.md from armada-battle-ai-new.js's HANDLING rows
   (after the rank spread), so the document always shows the numbers the code flies.
   node scripts/handling-table.cjs */
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const {HANDLING} = require(path.join(root, 'armada-battle-ai-new.js'));
const FLEETS = require('./motion-scenes.cjs').FLEETS;
const f = x => +x.toFixed(2);
let t = '| Fleet | Formation | Attack | Stick smoothing | Bank | Overshoot | Throttle rhythm (Hz / depth) | Tightness | Breaks away | Re-forms | Reaction (s) | Weave (depth / Hz) | Commitment | Why |\n';
t += '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
HANDLING.forEach((h, i) => { t += `| ${FLEETS[i]} | ${h.shape} | ${h.geometry} | ${f(h.smooth)} | ${f(h.bank)} | ${f(h.overshoot)} | ${f(h.rhythmHz)} / ${+h.rhythm.toFixed(3)} | ${f(h.tight)} | ${f(h.breakaway)} | ${f(h.reform)} | ${f(h.react)} | ${f(h.weave)} / ${f(h.weaveHz)} | ${f(h.commit)} | ${h.why} |\n`; });
const file = path.join(root, 'BATTLE-AI-NEW.md');
let md = fs.readFileSync(file, 'utf8');
const start = md.indexOf('| Fleet | Formation | Attack |'), end = md.indexOf('\n\n', start);
if (start < 0) throw new Error('handling table not found');
md = md.slice(0, start) + t.trimEnd() + md.slice(end);
fs.writeFileSync(file, md);
console.log('handling table written:', HANDLING.length, 'fleets');
