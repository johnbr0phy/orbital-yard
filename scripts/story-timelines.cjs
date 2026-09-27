#!/usr/bin/env node
/* Three seeds of one matchup, side by side, as a viewer would retell them.
   node scripts/story-timelines.cjs bench/story/after.json [--war "Empire vs Rebels"] [--size 60] [--window 20]

   Reads a story-metrics result and prints a markdown table: one column per
   seed, one row per time window, listing the notable events in it (kills
   are counted, not listed). Headers carry plans, objective and outcome. */
const fs = require('node:fs');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const file = process.argv[2], war = arg('war', 'Empire vs Rebels'), size = +arg('size', 60), win = +arg('window', 20);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const wars = data.wars.filter(w => w.name === war && w.size === size).sort((a, b) => a.seed - b.seed);
const SHORT = {rout: 'rout', rally: 'rally', escape: 'jump-out', lastStand: 'last stand', ram: 'RAM', flagshipDown: 'FLAGSHIP DOWN', successor: 'successor',
  shock: 'panic', ace: 'ace', aceDuel: 'ace duel', vendetta: 'vendetta', vendettaSettled: 'vendetta settled', vendettaFailed: 'vendetta ends',
  rescueStart: 'screen', rescue: 'rescue', pods: 'pods', podsSaved: 'pods saved', podsLost: 'pods fired on', planSwitch: 'PLAN SWITCH',
  planWorked: 'plan works', raid: 'raid jump', convoySaved: 'convoy through', convoyLost: 'convoy ship lost', stationTaken: 'station taken',
  wreckStrike: 'wreck strike', contact: 'first shots', capitalKill: 'capital down', heroKill: 'HERO DOWN', firstOneKill: 'FIRST ONE DOWN',
  ionStrike: 'ion strike', heroDuel: 'hero duel', reinforcements: 'reinforcements', squadronWipe: 'squadron wiped', victory: 'VICTORY'};
const SIDE = ['▲', '◆'];
const end = Math.max(...wars.map(w => w.duration));
const head = wars.map(w => `seed ${w.seed}: ${w.plans ? w.plans.map(p => p ? p.toLowerCase() : '-').join(' vs ') + ', ' + (w.objective || '-').toLowerCase() : 'no plans (baseline)'}, ${w.decided ? SIDE[w.winner] + ' wins at ' + w.duration + ' s' : 'undecided at ' + w.duration + ' s'}`);
const rows = [`| window | ${head.join(' | ')} |`, `|---|${wars.map(() => '---').join('|')}|`];
for (let t = 0; t < end; t += win) {
  const cells = wars.map(w => {
    const ev = w.timeline.filter(e => e[1] >= t && e[1] < t + win && SHORT[e[0]] && !['ionCharge', 'warPlan', 'cloakReveal', 'arrival'].includes(e[0]));
    const counts = new Map();
    for (const e of ev) { const k = (e[2] >= 0 ? SIDE[e[2]] + ' ' : '') + SHORT[e[0]]; counts.set(k, (counts.get(k) || 0) + 1); }
    const txt = [...counts].map(([k, n]) => n > 1 ? `${k} ×${n}` : k).join(', ');
    return t > w.duration ? '' : txt || '·';
  });
  rows.push(`| ${t}–${t + win} s | ${cells.join(' | ')} |`);
}
console.log(`**${war}, ${size} a side** (▲ ${wars[0].names[0]}, ◆ ${wars[0].names[1]})\n`);
console.log(rows.join('\n'));
