# Tribute War behaviour: story metrics

Every claim that a war got more interesting has to show up here as a number. The numbers come from `scripts/story-metrics.cjs`, which runs the page's real simulation headless (no rendering, CPU only) through `tests/tribute-new/headless-battle.cjs`.

## How it is measured

**The war set.** Five matchups, each at 60 and 300 a side, each with seeds 1101, 2202 and 3303: 30 wars.

| matchup | fleets |
|---|---|
| Empire vs Rebels | race 5 vs 6 |
| Borg vs Federation | 12 vs 10 |
| Shadows vs Minbari | 8 vs 7 |
| Random 1 | Federation vs Minbari (drawn by seed 2026) |
| Random 2 | Engineers vs USCM (drawn by seed 2026) |

Each war is capped at 180 simulated seconds at 60 a side and 120 at 300 a side (300 a side costs about 4 s of CPU per simulated second). A war still running at the cap is reported as undecided.

**What each column means.**

- **Decisions** (retreat, regroup, evade, flank, escort): how many times the minds chose that action, from `battleAI.stats.actions`. Every re-decision counts, so these are big numbers.
- **Fled & lived**: ships that were ever retreating or routing and were alive, or had left the battle alive, at the end.
- **Cohesion**: mean distance (m) of live squadron members from their squadron's centroid, sampled once a simulated second. Lower is tighter.
- **Broke / reformed**: a squadron is *formed* under 300 m, *broken* when it goes over 700 m, *reformed* when it comes back under 300 m.
- **Named moments**: routs, last stands, rams, rescues (outcomes only: saved or lost), ace promotions and vendettas, counted from the event log.
- **Lead changes**: flips of who leads on the momentum model's share, with a dead band of 47 to 53%.
- **Event types**: distinct event types in the war's log.
- **Uniqueness**: compares the three seeds of the same matchup and size, pair by pair, 0 (identical) to 100 (nothing in common). It is the mean of two parts, both shown:
  - *timeline*: cosine distance between the wars' notable-event histograms, binned by event type and 15-second window (plain kills are excluded, since every war has hundreds);
  - *shape*: mean absolute difference between the momentum share curves, doubled so two curves 0.5 apart everywhere score 100.

The shape part matters most for honesty: new event types raise the timeline part just by existing. The shape part only moves if the war itself plays out differently.

**Harness note.** The story work loads `armada-systems-new.js` into the headless harness so seeded terrain exists headless, as it does in the browser. I checked that this alone changes nothing on the baseline: the three-battle state trace from `scripts/sim-bench.cjs --trace` is byte-identical with and without it (`16ea5e01…`).

## Baseline (before this pass)

Commit `57ed33c` (main). Full data: `bench/story/before.json`. Values are means over three seeds.

| war | size | dur s (decided) | retreat | regroup | evade | flank | escort | fled & lived | cohesion m | broke / reformed | routs | last stands | rams | rescues | aces | vendettas | lead changes | event types | uniqueness (timeline / shape) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Borg vs Federation | 60 | 114 (3/3) | 136 | 0 | 5527 | 198.3 | 588.7 | 8.3 | 730.7 | 3.7 / 2.3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 33 (51 / 14) |
| Borg vs Federation | 300 | 120 (0/3) | 508.7 | 0 | 6510.7 | 656.3 | 2068 | 29.7 | 789 | 3 / 1.3 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 5.7 | 18 (34 / 3) |
| Empire vs Rebels | 60 | 180 (0/3) | 289 | 4.3 | 5664.7 | 482 | 498.7 | 9 | 344 | 8.3 / 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0.3 | 5.3 | 23 (34 / 13) |
| Empire vs Rebels | 300 | 120 (0/3) | 1408.7 | 56.3 | 5780.7 | 1874.7 | 2849 | 45.7 | 569.3 | 42.7 / 14.7 | 0 | 0 | 0 | 0 | 0 | 0 | 0.7 | 5.3 | 28 (51 / 4) |
| Random 1: Federation vs Minbari | 60 | 180 (0/3) | 232 | 2.7 | 5745.3 | 724 | 922.7 | 4 | 761.3 | 3.3 / 2 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 5.7 | 17 (28 / 6) |
| Random 1: Federation vs Minbari | 300 | 120 (0/3) | 1371.7 | 28.3 | 3681 | 2875 | 2039 | 64.3 | 1209.7 | 19 / 6.7 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 5.3 | 20 (35 / 4) |
| Random 2: Engineers vs USCM | 60 | 175.1 (1/3) | 133.7 | 0 | 8740.7 | 452.3 | 365 | 1.7 | 422.3 | 1.3 / 0.7 | 0 | 0 | 0 | 0 | 0 | 0 | 1.3 | 6.3 | 26 (39 / 14) |
| Random 2: Engineers vs USCM | 300 | 120 (0/3) | 1640.7 | 0.7 | 2705.3 | 2543 | 3016 | 75.3 | 588.3 | 21 / 8.7 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 5.7 | 22 (38 / 6) |
| Shadows vs Minbari | 60 | 180 (0/3) | 109 | 0.7 | 14397.3 | 494.7 | 149.7 | 3.3 | 1077 | 4.3 / 2.3 | 0 | 0 | 0 | 0 | 0 | 0 | 2.3 | 5 | 12 (14 / 10) |
| Shadows vs Minbari | 300 | 120 (0/3) | 201.7 | 2.7 | 7517.7 | 1727.7 | 260 | 5 | 1094.7 | 9.3 / 3.3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5.3 | 14 (21 / 7) |

What the baseline says:

- **The minds are busy, the story is flat.** Thousands of evasions and hundreds of retreats per war, but the log holds only 5 to 7 event types (kills, ion charges and strikes, capital and hero kills, a hero duel, reinforcements).
- **Wars don't end.** 26 of 30 wars were still running at the cap. A 60-a-side Empire vs Rebels war spent its last 100 seconds as 3 Imperial ships against 20 Rebels.
- **Seeds of one matchup look alike.** The shape part of uniqueness is 3 to 14: the momentum curves of three seeds nearly overlap. Lead changes average 0 to 2.3.
- **Fleeing rarely ends in living.** A retreating ship has nowhere to go but back to the fight: 2 to 75 ships per war fled and lived, and nobody ever left the field.

## After (this pass)

Same 30 wars, same caps, same script, on the final code. Full data: `bench/story/after.json`. Values are means over three seeds.

| war | size | dur s (decided) | retreat | regroup | evade | flank | escort | fled & lived | cohesion m | broke / reformed | routs | last stands | rams | rescues | aces | vendettas | lead changes | event types | uniqueness (timeline / shape) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Borg vs Federation (THE BORG COLLECTIVE vs THE FEDERATION) | 60 | 122 (2/3) | 15.7 | 0 | 1911.3 | 61.7 | 132.7 | 17 | 547.3 | 2.3 / 0 | 3.7 | 4.7 | 0.3 | 3.7 | 0.3 | 1.7 | 0 | 18.3 | 40 (67 / 12) |
| Borg vs Federation (THE BORG COLLECTIVE vs THE FEDERATION) | 300 | 98.7 (1/3) | 38.7 | 0 | 1831.3 | 413.3 | 381.7 | 62 | 556.7 | 5 / 0.3 | 7.7 | 6 | 0.3 | 4.3 | 0.7 | 1.3 | 0.7 | 17 | 39 (72 / 6) |
| Empire vs Rebels (THE IMPERIAL STARFLEET vs THE REBEL ALLIANCE) | 60 | 117.3 (2/3) | 179.7 | 5 | 4001.3 | 165.3 | 291.7 | 59.3 | 413 | 5.7 / 1.3 | 8 | 2 | 0 | 1 | 1 | 2.3 | 0 | 18.7 | 38 (66 / 10) |
| Empire vs Rebels (THE IMPERIAL STARFLEET vs THE REBEL ALLIANCE) | 300 | 96 (2/3) | 419.7 | 36 | 3037.7 | 754.3 | 724 | 361 | 451 | 20 / 2.7 | 42 | 0.7 | 0 | 0.7 | 1.3 | 2.3 | 0.7 | 18.3 | 31 (52 / 10) |
| Random 1 (THE FEDERATION vs THE MINBARI FEDERATION) | 60 | 159.3 (1/3) | 111.3 | 1.3 | 4934 | 505.7 | 492.7 | 26.7 | 729 | 3 / 1.3 | 4.3 | 7.3 | 1 | 5 | 0.3 | 2 | 0.3 | 20.7 | 32 (59 / 5) |
| Random 1 (THE FEDERATION vs THE MINBARI FEDERATION) | 300 | 120 (0/3) | 397.3 | 9 | 8379.3 | 2499.3 | 1190.7 | 120 | 1036 | 19 / 1 | 17 | 12 | 1.7 | 4 | 2 | 2 | 1 | 20 | 18 (31 / 6) |
| Random 2 (THE ENGINEERS vs THE USCM TASK FORCE) | 60 | 99.4 (2/3) | 103 | 0 | 4785.7 | 213.7 | 171.3 | 32.3 | 567 | 0.7 / 0.3 | 2.3 | 1.3 | 0 | 0.7 | 0 | 1.3 | 1.3 | 13.7 | 35 (65 / 5) |
| Random 2 (THE ENGINEERS vs THE USCM TASK FORCE) | 300 | 84.3 (2/3) | 433.7 | 0.7 | 1155 | 1404 | 815 | 270.3 | 574.7 | 9.3 / 1.7 | 29 | 0 | 0 | 0 | 0.7 | 1.3 | 0.7 | 12.7 | 36 (67 / 5) |
| Shadows vs Minbari (THE SHADOWS vs THE MINBARI FEDERATION) | 60 | 167.6 (1/3) | 104 | 0.3 | 10991 | 304.3 | 171.7 | 10.7 | 1297.7 | 2.3 / 0.7 | 2.3 | 6 | 0.3 | 3.7 | 1.3 | 3.3 | 0.7 | 19.7 | 43 (65 / 22) |
| Shadows vs Minbari (THE SHADOWS vs THE MINBARI FEDERATION) | 300 | 111.4 (1/3) | 168.7 | 4.7 | 2185 | 1100 | 235.7 | 44.7 | 842 | 5 / 0.7 | 15.7 | 3 | 0.3 | 1 | 3.3 | 4.7 | 0 | 22 | 30 (50 / 11) |

### Before → after

| war | size | uniqueness | lead changes | event types | routs | rescues | aces | fled & lived | cohesion m | dur s |
|---|---|---|---|---|---|---|---|---|---|---|
| Borg vs Federation | 60 | 33 → 40 | 0 → 0 | 7 → 18.3 | 0 → 3.7 | 0 → 3.7 | 0 → 0.3 | 8.3 → 17 | 730.7 → 547.3 | 114 → 122 |
| Borg vs Federation | 300 | 18 → 39 | 1 → 0.7 | 5.7 → 17 | 0 → 7.7 | 0 → 4.3 | 0 → 0.7 | 29.7 → 62 | 789 → 556.7 | 120 → 98.7 |
| Empire vs Rebels | 60 | 23 → 38 | 0.3 → 0 | 5.3 → 18.7 | 0 → 8 | 0 → 1 | 0 → 1 | 9 → 59.3 | 344 → 413 | 180 → 117.3 |
| Empire vs Rebels | 300 | 28 → 31 | 0.7 → 0.7 | 5.3 → 18.3 | 0 → 42 | 0 → 0.7 | 0 → 1.3 | 45.7 → 361 | 569.3 → 451 | 120 → 96 |
| Random 1 | 60 | 17 → 32 | 1 → 0.3 | 5.7 → 20.7 | 0 → 4.3 | 0 → 5 | 0 → 0.3 | 4 → 26.7 | 761.3 → 729 | 180 → 159.3 |
| Random 1 | 300 | 20 → 18 | 1 → 1 | 5.3 → 20 | 0 → 17 | 0 → 4 | 0 → 2 | 64.3 → 120 | 1209.7 → 1036 | 120 → 120 |
| Random 2 | 60 | 26 → 35 | 1.3 → 1.3 | 6.3 → 13.7 | 0 → 2.3 | 0 → 0.7 | 0 → 0 | 1.7 → 32.3 | 422.3 → 567 | 175.1 → 99.4 |
| Random 2 | 300 | 22 → 36 | 1 → 0.7 | 5.7 → 12.7 | 0 → 29 | 0 → 0 | 0 → 0.7 | 75.3 → 270.3 | 588.3 → 574.7 | 120 → 84.3 |
| Shadows vs Minbari | 60 | 12 → 43 | 2.3 → 0.7 | 5 → 19.7 | 0 → 2.3 | 0 → 3.7 | 0 → 1.3 | 3.3 → 10.7 | 1077 → 1297.7 | 180 → 167.6 |
| Shadows vs Minbari | 300 | 14 → 30 | 0 → 0 | 5.3 → 22 | 0 → 15.7 | 0 → 1 | 0 → 3.3 | 5 → 44.7 | 1094.7 → 842 | 120 → 111.4 |

What the numbers say:

- **More wars end.** 14 of 30 reach a result inside the cap, against 4 of 30. But 13 of those 14 had a convoy or station objective. A war of annihilation still usually runs to the cap (1 of 10 ended), and neither flagship war ended inside it.
- **The log tells a story.** Distinct event types went from 5–7 to 12.7–22 (means over seeds). Across the 30 wars the log holds 396 routs, 27 rallies, 129 last stands, 12 rams, 72 rescue outcomes, 33 aces, 67 vendettas, 5 flagship losses with 4 successions, 47 plan switches and 33 abandon-ship launches. Before, every one of those was 0.
- **Running away now means living.** Ships that fled and survived: 1.7–75 per war before, 10.7–361 after.
- **Seeds of a matchup differ more, mostly.** Uniqueness rose in 9 of 10 cells (12–33 → 18–43). It fell in one: Random 1 at 300 a side, 20 → 18.
- **Honest caveat on uniqueness.** The rise comes mostly from the timeline part, and new event types raise that part just by existing. The shape part (how differently the momentum curves run) is mixed: up in 5 cells, down in 5 (for example Shadows vs Minbari at 60 a side 10 → 22, Random 2 at 60 a side 14 → 5). Wars that end sooner and more decisively have less room to run differently.
- **Lead changes did not rise** (0–2.3 before, 0–1.3 after). Morale that cascades makes wars decisive: once a side starts to break, contagion and routs finish it. I've left that as it is and say so here, rather than adding a comeback mechanic the brief didn't ask for.
- **Squadrons hold together while command lives.** Cohesion is tighter in 7 of 10 cells, for example Borg vs Federation 731 → 547 m. It loosened in three (Empire vs Rebels, Random 2 and Shadows vs Minbari at 60 a side), where routs scatter squadrons across the field.
- **Aces are rare but present** (0–3.3 per war). The first full run had aces in only 3 of 30 wars; see DECISIONS.md, "Characters".

### Plans change the shape of the war, not just the label

`node scripts/story-metrics.cjs --plans`: Empire vs Rebels, 60 a side, seeds 1101/2202/3303, objective forced to annihilation, side 1 forced to HOLD, side 0 forced to each plan in turn, capped at 150 s. Data: `bench/story/plans.json`.

| plan (side 0) | first blood s | a side 25% lost s | losses at 60 s (0 / 1) | losses at 120 s (0 / 1) | fight centre x m | fight spread abs z m | lead changes | winner 0 / 1 / none |
|---|---|---|---|---|---|---|---|---|
| PINCER | 37.3 | 59.2 | 16 / 4 | 41 / 19.3 | 1372.7 | 1078.7 | 0.3 | 0 / 0 / 3 |
| AMBUSH | 33.7 | 65.9 | 11 / 3.7 | 36.7 / 22 | 1577.3 | 1018 | 0 | 0 / 0 / 3 |
| HOLD | 70.7 | 97.5 | 0 / 0 | 23.3 / 17 | -1492 | 1241 | 0.7 | 0 / 0 / 3 |
| RAID | 31.9 | 81.4 | 4.3 / 2.7 | 38.3 / 21.3 | 1618.7 | 838 | 0 | 0 / 0 / 3 |
| DECAPITATE | 33.1 | 50.5 | 18.7 / 8.3 | 30.3 / 23 | 1610.7 | 825 | 0 | 0 / 0 / 3 |
| SIEGE | 56.1 | 105.3 | 1.3 / 0.3 | 20 / 19 | -215 | 1272.3 | 0 | 0 / 0 / 3 |

- **Hold and siege delay first blood** to 71 and 56 s, against 32–37 s for the attacking plans.
- **Where the fight happens moves with the plan.** Hold fights on its own side of the field (fight centre x −1,492 m) and siege in the middle (−215 m). Pincer, ambush, raid and decapitation carry the fight to the enemy (+1,373 to +1,619 m).
- **A raid fights narrow** (spread 838 m) and a siege wide (1,272 m).
- **Decapitation trades fastest:** it loses a quarter of its side by 50.5 s, while siege takes until 105 s.

### Three seeds of one matchup, side by side

Empire vs Rebels, 60 a side, notable events per 15-second window (plain kills are counted elsewhere, not listed). ▲ is the Empire, ◆ the Rebels.

**After:**

| window | seed 1101: pincer vs pincer, convoy, ◆ wins at 75.7 s | seed 2202: hold vs ambush, annihilate, undecided at 180 s | seed 3303: siege vs pincer, station, ◆ wins at 96.3 s |
|---|---|---|---|
| 0–15 s | · | · | ◆ station taken |
| 15–30 s | ▲ first shots | ◆ first shots | ▲ first shots |
| 30–45 s | ▲ hero duel, ◆ raid jump ×2, ◆ ion strike, ▲ vendetta, ▲ HERO DOWN, ▲ vendetta ends, ◆ rout ×2 | · | ◆ rout ×2 |
| 45–60 s | ▲ rout, ▲ ion strike, ◆ jump-out ×2, ◆ PLAN SWITCH, ◆ wreck strike ×3, ▲ jump-out, ▲ PLAN SWITCH, ◆ convoy through | ◆ rout ×3, ◆ ion strike, ▲ PLAN SWITCH, ◆ jump-out, ▲ rout | ◆ rout, ◆ jump-out ×3, ◆ ion strike |
| 60–75 s | ▲ rout ×4, ▲ ace, ◆ plan works, ▲ ace duel, ▲ jump-out ×2, ▲ vendetta | ◆ plan works, ◆ jump-out ×2, ◆ vendetta, ▲ hero duel, ▲ vendetta, ◆ ace, ▲ jump-out, ◆ last stand, ▲ rout | · |
| 75–90 s | ▲ jump-out, ◆ VICTORY, ◆ convoy through | ◆ rout ×2, ◆ HERO DOWN, ◆ vendetta ends, ▲ ion strike, ▲ jump-out, ◆ jump-out, ▲ rout | ◆ PLAN SWITCH, ▲ vendetta |
| 90–105 s |  | ◆ ion strike, ◆ jump-out, ▲ ace, ▲ HERO DOWN, ▲ vendetta ends, ◆ rout ×2, ▲ jump-out, ▲ screen | ◆ rout, ◆ HERO DOWN, ◆ vendetta, ◆ vendetta ends, ▲ vendetta, ▲ rout, ◆ VICTORY |
| 105–120 s |  | ▲ rout, ◆ jump-out ×2, ▲ last stand, ◆ capital down, ▲ jump-out |  |
| 120–135 s |  | ◆ screen, ◆ last stand, ▲ rescue, ▲ ion strike, ▲ rout |  |
| 135–150 s |  | ▲ capital down ×2, ▲ screen ×2, ◆ ion strike, ▲ pods, ▲ last stand, ◆ rescue, ▲ rescue, ◆ capital down, ▲ jump-out |  |
| 150–165 s |  | ▲ last stand, ◆ pods, ◆ last stand, ◆ pods fired on ×3, ◆ capital down, ◆ FLAGSHIP DOWN, ◆ panic, ▲ wreck strike |  |
| 165–180 s |  | ◆ successor, ◆ pods fired on ×4, ▲ wreck strike |  |

**Before** (30-second windows; the same three seeds):

| window | seed 1101: no plans (baseline), undecided at 180 s | seed 2202: no plans (baseline), undecided at 180 s | seed 3303: no plans (baseline), undecided at 180 s |
|---|---|---|---|
| 0–30 s | ▲ hero duel | ▲ HERO DOWN | · |
| 30–60 s | ◆ ion strike, ▲ hero duel, ◆ HERO DOWN | · | ▲ HERO DOWN |
| 60–90 s | ▲ ion strike | ◆ ion strike | ◆ ion strike, ▲ ion strike |
| 90–120 s | ◆ ion strike, ▲ HERO DOWN | ▲ capital down ×2, ▲ ion strike | ▲ capital down |
| 120–150 s | ▲ ion strike, ▲ capital down ×2, ◆ ion strike, ◆ capital down | ◆ ion strike, ▲ capital down ×2 | ◆ ion strike, ▲ ion strike, ▲ capital down |
| 150–180 s | ▲ ion strike, ▲ capital down | ◆ ion strike | ◆ ion strike |

Before, the three wars are the same war: hero duels, ion strikes and capital kills, undecided at 180 s. After, they read differently:
- seed 1101 is a Rebel convoy run won at 75.7 s through a rout-heavy middle;
- seed 2202 is a long hold-versus-ambush grind that ends with the Rebel flagship falling and pods fired on;
- seed 3303 is a fight for the station, won by the Rebels at 96.3 s.

### Watching whole wars

`node scripts/watch-log.cjs` runs the real page headless through its own `frame()` at 30 fps, so the director, captions and replays run as in the browser (CPU only, no pixels). Logs: `bench/story/watch/`. "Big deaths" are capital and hero deaths; "seen / replayed / missed" says whether each was on screen when it happened, shown in an automatic replay, or neither.

| war | camera | duration s | cuts | median shot s | shortest s | cuts under 4 s | big deaths | seen / replayed / missed | 15 s with nothing notable | median caption s |
|---|---|---|---|---|---|---|---|---|---|---|
| The Imperial Starfleet vs The Rebel Alliance, seed 1101 | broadcast | 81.7 | 8 | 9.6 | 7.07 | 0 | 1 | 1 / 0 / 0 | 0–16.3 | 4.8 |
| The Imperial Starfleet vs The Rebel Alliance, seed 1101 | action | 81.7 | 10 | 8 | 3.94 | 1 | 1 | 1 / 0 / 0 | 0–16.3 | 4.8 |
| The Borg Collective vs The Federation, seed 2202 | broadcast | 213.9 | 21 | 9.6 | 4.8 | 0 | 14 | 10 / 4 / 0 | none | 3.7 |
| The Borg Collective vs The Federation, seed 2202 | action | 213.9 | 25 | 8.47 | 3.87 | 1 | 14 | 9 / 0 / 5 | none | 4.4 |
| The Shadows vs The Minbari Federation, seed 3303 | broadcast | 148.9 | 16 | 9 | 5.33 | 0 | 5 | 5 / 0 / 0 | none | 3.7 |
| The Shadows vs The Minbari Federation, seed 3303 | action | 148.9 | 19 | 8.03 | 3.66 | 2 | 5 | 3 / 0 / 2 | none | 4.1 |

- **Broadcast** holds a median shot of 9.0–9.6 s and misses no capital or hero death: 16 of 20 were on screen live and the other 4 were replayed.
- **Action**, the default camera, rides one subject at a time and has no replays. Its median is 8.0–8.5 s. It saw 13 of the 20 big deaths live and missed 7 (5 of them in the Borg vs Federation war, which loses capitals in bursts). B switches to Broadcast.
- **The only dead stretch** is the 16 s approach before first contact in the convoy war.
