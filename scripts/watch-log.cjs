#!/usr/bin/env node
/* Watch a whole war the way a viewer would, and log it.
   node scripts/watch-log.cjs [--matchup 5,6] [--seed 1101] [--size 60] [--mode broadcast|action] [--max 240] [--out file.json]

   Runs the real page headless through its own frame() at 30 fps (so the
   camera director, captions and replays run exactly as in the browser, minus
   pixels) and records: every cut (time, shot kind, subject, phase, hold),
   every caption shown and for how long, dead stretches (15 s or more with no
   kill and no story event), fast cuts (under 4 s), subjects repeated within
   30 s, and for each capital or hero death whether it was on screen when it
   happened or shown in an automatic replay. CPU only: no GPU, no pixels. */
const {loadBattle} = require('../tests/tribute-new/headless-battle.cjs');
const fs = require('node:fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const [a, b] = arg('matchup', '5,6').split(',').map(Number), seed = +arg('seed', 1101), size = +arg('size', 60), mode = arg('mode', 'broadcast'), max = +arg('max', 240);

const w = loadBattle({cores: 1, modules: true});
w.start(a, b, seed, size);
w.run(`endIntro();lastT=1;globalThis.__w={t:1000,cuts:[],captions:[],deaths:[],replays:[],lastIdx:-1,lastCap:''};
  setWatchView('${mode}');
  // Track the director's cuts and every caption change.
  globalThis.__watch=function(){
    const a=actionCamera,T=battleTime-warT0;
    if(a&&a.index!==__w.lastIdx){__w.lastIdx=a.index;__w.cuts.push({t:+T.toFixed(2),kind:a.kind,subject:a.subject,partner:a.partner,phase:a.phase||null,label:document.getElementById('watchLabel').textContent});}
    const c=document.getElementById('bcCaption').textContent;
    if(c!==__w.lastCap){__w.lastCap=c;__w.captions.push({t:+T.toFixed(2),text:c,kind:bc.caption?bc.caption.kind:null});}
    if(replayState&&!__w.inReplay){__w.inReplay=true;__w.replays.push({t:+T.toFixed(2),label:replayState.label});}
    if(!replayState)__w.inReplay=false;
  };`);
// Deaths are checked the moment they happen: was the victim on screen?
w.run(`(()=>{const k=kill;kill=function(t,now){const big=(isCapital(t)||t.hero)&&!t.dead;const seen=big&&!replayState?onScreen(t):false;k(t,now);if(big)__w.deaths.push({t:+(now-warT0).toFixed(2),id:t.id,name:shipLabel(t),seen,capital:isCapital(t),hero:!!t.hero,mode:watchMode});};})()`);
const t0 = Date.now();
let over = null;
// Replays pause the war clock, so the frame budget allows for them.
for (let i = 0; i < 30 * (max + 150); i++) {
  w.run('frame(__w.t+=1000/30);__watch();');
  const s = w.run('[winner,battleTime-warT0]');
  if (s[1] > max && s[0] == null) break;
  if (s[0] != null && over == null) over = s[1];
  if (over != null && s[1] > over + 6) break;
}
const r = w.run(`JSON.stringify({autoReplays:bc.autoReplays||[],cuts:__w.cuts,captions:__w.captions,deaths:__w.deaths,replays:__w.replays,winner,winReason,T:battleTime-warT0,
  events:bc.log.events.filter(e=>e.type!=='kill').map(e=>({t:+(e.t-warT0).toFixed(1),type:e.type,text:e.text||e.name||''})),
  kills:bc.log.events.filter(e=>/kill|Kill/.test(e.type)).map(e=>+(e.t-warT0).toFixed(1)),plans:battleAI.story.planNames(),objective:battleAI.story.objectiveName(),names:SIDE_NAME})`);
const R = JSON.parse(r);
// Holds between cuts, after the scripted opening.
const cuts = R.cuts.filter(c => c.t >= 9);
const holds = cuts.slice(1).map((c, i) => +(c.t - cuts[i].t).toFixed(2));
const sorted = holds.slice().sort((x, y) => x - y), median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
// Dead stretches: 15 s or more with no kill and no story event.
const beats = R.kills.concat(R.events.filter(e => e.type !== 'warPlan').map(e => e.t)).sort((x, y) => x - y);
const dead = [];let prev = 0;
for (const t of beats.concat([R.T])) { if (t - prev >= 15) dead.push([+prev.toFixed(1), +t.toFixed(1)]); prev = t; }
const repeats = [];
for (let i = 1; i < cuts.length; i++) for (let j = i - 1; j >= 0 && cuts[i].t - cuts[j].t < 30; j--) if (cuts[j].subject === cuts[i].subject && cuts[i].kind === cuts[j].kind) { repeats.push([cuts[j].t, cuts[i].t, cuts[i].kind]); break; }
const deathsSeen = R.deaths.filter(d => d.seen).length;
// A death counts as replayed if the automatic replay queue showed that ship.
const replayedIds = new Set(R.autoReplays);
const replayed = R.deaths.filter(d => !d.seen && replayedIds.has(d.id)).length;
const capShown = R.captions.filter(c => c.text);
const capDur = capShown.map((c, i) => { const next = R.captions[R.captions.indexOf(c) + 1]; return next ? next.t - c.t : null; }).filter(x => x != null);
const summary = {matchup: R.names, seed, size, mode, plans: R.plans, objective: R.objective, winner: R.winner, reason: R.winReason, duration: +R.T.toFixed(1),
  cuts: cuts.length, medianHold: median, minHold: sorted[0] ?? null, fastCuts: holds.filter(h => h < 4).length,
  kinds: cuts.reduce((m, c) => (m[c.kind] = (m[c.kind] || 0) + 1, m), {}), phases: cuts.reduce((m, c) => (m[c.phase || '-'] = (m[c.phase || '-'] || 0) + 1, m), {}),
  deadStretches: dead, repeatedShots: repeats.length,
  bigDeaths: R.deaths.length, bigDeathsOnScreen: deathsSeen, bigDeathsReplayed: replayed, missed: R.deaths.filter(d => !d.seen && !replayedIds.has(d.id)).map(d => d.name + '@' + d.t),
  captions: capShown.length, decisionCaptions: capShown.filter(c => c.kind === 'decision').length, eventCaptions: capShown.filter(c => c.kind === 'event').length,
  captionMedianSeconds: capDur.length ? capDur.sort((x, y) => x - y)[Math.floor(capDur.length / 2)] : null, shortCaptions: capDur.filter(x => x < 2.5).length,
  wallSeconds: Math.round((Date.now() - t0) / 1000)};
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify({summary, ...R}, null, 1));
console.log(JSON.stringify(summary, null, 1));
