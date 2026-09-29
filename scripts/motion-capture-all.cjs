#!/usr/bin/env node
/* Records every motion scene's clip, a few in parallel.
   node scripts/motion-capture-all.cjs --label before --dir ../orbital-yard-main [--jobs 2] [--only 01,03] [--skip-heavy]
   node scripts/motion-capture-all.cjs --label after [--jobs 2]
   Scenes whose headless run has no frigates are skipped for scene 2
   (a gunboat screen needs gunboats). Logs to design/tribute-new/review/motion/<label>/capture.log. */
const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
const SC = require('./motion-scenes.cjs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const label = arg('label', 'after'), dir = arg('dir'), jobs = +arg('jobs', 2), root = path.resolve(__dirname, '..');
const summary = JSON.parse(fs.readFileSync(path.join(root, 'bench/motion', label === 'before' ? 'baseline' : 'final', 'summary.json'), 'utf8'));
let list = SC.scenes.filter(s => !s.id.startsWith('02-') || (summary.perRun.find(r => r.id === s.id) || {}).hasFrigates);
if (arg('only')) { const ids = arg('only').split(','); list = list.filter(s => ids.some(i => s.id === i || s.id.startsWith(i + '-'))); }
if (process.argv.includes('--skip-heavy')) list = list.filter(s => !s.heavy);
if (process.argv.includes('--heavy-only')) list = list.filter(s => s.heavy);
const outDir = path.join(root, 'design/tribute-new/review/motion', label);
fs.mkdirSync(outDir, {recursive: true});
const log = fs.createWriteStream(path.join(outDir, 'capture.log'), {flags: 'a'});
let next = 0, done = 0;
const env = {...process.env, NODE_PATH: process.env.NODE_PATH || '/opt/node22/lib/node_modules'};
function launch() {
  if (next >= list.length) return;
  const s = list[next++], args = [path.join(__dirname, 'motion-capture.cjs'), '--scene', s.id, '--label', label];
  if (dir) args.push('--dir', dir);
  const t0 = Date.now(), p = spawn(process.execPath, args, {env, stdio: ['ignore', 'pipe', 'pipe']});
  p.stdout.on('data', d => log.write(d)); p.stderr.on('data', d => log.write(d));
  p.on('close', code => { done++; const line = `[${done}/${list.length}] ${s.id} ${code ? 'FAILED ' + code : 'ok'} ${Math.round((Date.now() - t0) / 1000)} s\n`; log.write(line); process.stdout.write(line); launch(); });
}
for (let i = 0; i < Math.min(jobs, list.length); i++) launch();
