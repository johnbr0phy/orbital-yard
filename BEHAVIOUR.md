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

Same 30 wars, same caps, same script, on the current code (re-measured after the owner-feedback round: throttle, asteroids, First Ones). Full data: `bench/story/after.json`. Values are means over three seeds.

| war | size | dur s (decided) | retreat | regroup | evade | flank | escort | fled & lived | cohesion m | broke / reformed | routs | last stands | rams | rescues | aces | vendettas | lead changes | event types | uniqueness (timeline / shape) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Borg vs Federation (THE BORG COLLECTIVE vs THE FEDERATION) | 60 | 137.9 (3/3) | 22.7 | 0 | 1949.7 | 116 | 127.7 | 14 | 456 | 3.3 / 0.3 | 3.3 | 7.3 | 0 | 5 | 0 | 1.3 | 0 | 23.3 | 35 (61 / 8) |
| Borg vs Federation (THE BORG COLLECTIVE vs THE FEDERATION) | 300 | 105.9 (1/3) | 51 | 0 | 3837.3 | 412 | 276.3 | 54.3 | 494.3 | 6.3 / 1.3 | 7.7 | 8.7 | 0 | 2.7 | 0.7 | 1.3 | 1 | 18 | 30 (53 / 7) |
| Empire vs Rebels (THE IMPERIAL STARFLEET vs THE REBEL ALLIANCE) | 60 | 137 (2/3) | 140.3 | 5.3 | 5939.3 | 196.3 | 275 | 46 | 377.3 | 3.7 / 1.3 | 7 | 2.3 | 0.3 | 1.3 | 1.3 | 2.7 | 0 | 18 | 40 (68 / 12) |
| Empire vs Rebels (THE IMPERIAL STARFLEET vs THE REBEL ALLIANCE) | 300 | 120 (0/3) | 411.3 | 26.3 | 4921.3 | 900 | 957.7 | 215.7 | 403.7 | 16 / 3.3 | 42 | 2.3 | 0 | 1.3 | 2.7 | 3.7 | 0.7 | 20 | 27 (45 / 10) |
| Random 1 (THE FEDERATION vs THE MINBARI FEDERATION) | 60 | 149.4 (1/3) | 99.3 | 1 | 3544.3 | 437.7 | 379.3 | 26.3 | 790.7 | 1.3 / 0.7 | 3.3 | 9 | 0.3 | 6 | 0.3 | 2.3 | 0.3 | 20.7 | 37 (67 / 6) |
| Random 1 (THE FEDERATION vs THE MINBARI FEDERATION) | 300 | 117.6 (1/3) | 172.7 | 2.7 | 573 | 1965.7 | 890 | 111 | 1005.7 | 8.3 / 1.3 | 20.7 | 10 | 0.3 | 3.7 | 1 | 2.3 | 1 | 20.7 | 30 (53 / 7) |
| Random 2 (THE ENGINEERS vs THE USCM TASK FORCE) | 60 | 105.3 (2/3) | 102 | 0 | 4437.7 | 224.3 | 194.3 | 32.3 | 541 | 0 / 0 | 4 | 0.7 | 0.3 | 0.3 | 0.7 | 1 | 1 | 14.3 | 37 (69 / 6) |
| Random 2 (THE ENGINEERS vs THE USCM TASK FORCE) | 300 | 83.6 (2/3) | 407.3 | 0.7 | 3036.7 | 1230.3 | 658.7 | 267.3 | 550 | 2.7 / 0.3 | 26 | 0 | 0 | 0 | 2.3 | 2.3 | 0.3 | 14.7 | 40 (75 / 5) |
| Shadows vs Minbari (THE SHADOWS vs THE MINBARI FEDERATION) | 60 | 151.8 (1/3) | 94.3 | 0 | 4543 | 232.3 | 107.7 | 10.3 | 1552 | 1.7 / 1 | 2.7 | 4.7 | 0 | 3.3 | 1.7 | 3.3 | 0.3 | 20.7 | 39 (60 / 18) |
| Shadows vs Minbari (THE SHADOWS vs THE MINBARI FEDERATION) | 300 | 111.1 (2/3) | 162.3 | 0.3 | 4049 | 1273.7 | 267.3 | 57.3 | 881 | 9.3 / 3 | 7.7 | 4.3 | 0.3 | 2 | 3.7 | 5 | 0 | 20 | 32 (53 / 11) |

### Before → after

| war | size | uniqueness | lead changes | event types | routs | rescues | aces | fled & lived | cohesion m | dur s |
|---|---|---|---|---|---|---|---|---|---|---|
| Borg vs Federation | 60 | 33 → 35 | 0 → 0 | 7 → 23.3 | 0 → 3.3 | 0 → 5 | 0 → 0 | 8.3 → 14 | 730.7 → 456 | 114 → 137.9 |
| Borg vs Federation | 300 | 18 → 30 | 1 → 1 | 5.7 → 18 | 0 → 7.7 | 0 → 2.7 | 0 → 0.7 | 29.7 → 54.3 | 789 → 494.3 | 120 → 105.9 |
| Empire vs Rebels | 60 | 23 → 40 | 0.3 → 0 | 5.3 → 18 | 0 → 7 | 0 → 1.3 | 0 → 1.3 | 9 → 46 | 344 → 377.3 | 180 → 137 |
| Empire vs Rebels | 300 | 28 → 27 | 0.7 → 0.7 | 5.3 → 20 | 0 → 42 | 0 → 1.3 | 0 → 2.7 | 45.7 → 215.7 | 569.3 → 403.7 | 120 → 120 |
| Random 1 | 60 | 17 → 37 | 1 → 0.3 | 5.7 → 20.7 | 0 → 3.3 | 0 → 6 | 0 → 0.3 | 4 → 26.3 | 761.3 → 790.7 | 180 → 149.4 |
| Random 1 | 300 | 20 → 30 | 1 → 1 | 5.3 → 20.7 | 0 → 20.7 | 0 → 3.7 | 0 → 1 | 64.3 → 111 | 1209.7 → 1005.7 | 120 → 117.6 |
| Random 2 | 60 | 26 → 37 | 1.3 → 1 | 6.3 → 14.3 | 0 → 4 | 0 → 0.3 | 0 → 0.7 | 1.7 → 32.3 | 422.3 → 541 | 175.1 → 105.3 |
| Random 2 | 300 | 22 → 40 | 1 → 0.3 | 5.7 → 14.7 | 0 → 26 | 0 → 0 | 0 → 2.3 | 75.3 → 267.3 | 588.3 → 550 | 120 → 83.6 |
| Shadows vs Minbari | 60 | 12 → 39 | 2.3 → 0.3 | 5 → 20.7 | 0 → 2.7 | 0 → 3.3 | 0 → 1.7 | 3.3 → 10.3 | 1077 → 1552 | 180 → 151.8 |
| Shadows vs Minbari | 300 | 14 → 32 | 0 → 0 | 5.3 → 20 | 0 → 7.7 | 0 → 2 | 0 → 3.7 | 5 → 57.3 | 1094.7 → 881 | 120 → 111.1 |

What the numbers say:

- **More wars end.** 15 of 30 reach a result inside the cap, against 4 of 30. But 13 of those 15 had a convoy or station objective. A war of annihilation still usually runs to the cap (2 of 10 ended), and neither flagship war ended inside it.
- **The log tells a story.** Distinct event types went from 5–7 to 14.3–23.3 (means over seeds). Across the 30 wars the log holds 373 routs, 41 rallies, 148 last stands, 5 rams, 77 rescue outcomes, 43 aces, 76 vendettas, 9 flagship losses with 7 successions, 59 plan switches and 27 abandon-ship launches. Before, every one of those was 0.
- **Running away now means living.** Ships that fled and survived: 1.7–75.3 per war before, 10.3–267.3 after.
- **Seeds of a matchup differ more, mostly.** Uniqueness rose in 9 of 10 cells (12–33 → 27–40). It fell by one point in one: Empire vs Rebels at 300 a side, 28 → 27.
- **Honest caveat on uniqueness.** The rise comes mostly from the timeline part, and new event types raise that part just by existing. The shape part (how differently the momentum curves run) is mixed: up in 5 cells, down in 4, level in 1 (for example Shadows vs Minbari at 60 a side 10 → 18, Random 2 at 60 a side 14 → 6). Wars that end sooner and more decisively have less room to run differently.
- **Lead changes did not rise** (0–2.3 before, 0–1 after). Morale that cascades makes wars decisive: once a side starts to break, contagion and routs finish it. I've left that as it is and say so here, rather than adding a comeback mechanic the brief didn't ask for.
- **Squadrons hold together while command lives.** Cohesion is tighter in 6 of 10 cells, for example Borg vs Federation at 60 a side 731 → 456 m. It loosened in four, all at 60 a side (Empire vs Rebels, Random 1, Random 2 and Shadows vs Minbari), where routs scatter squadrons across the field.
- **Aces are present in most wars** (0–3.7 per war, in 22 of 30 wars). The first full run had aces in only 3 of 30; see DECISIONS.md, "Characters".

### Plans change the shape of the war, not just the label

`node scripts/story-metrics.cjs --plans`: Empire vs Rebels, 60 a side, seeds 1101/2202/3303, objective forced to annihilation, side 1 forced to HOLD, side 0 forced to each plan in turn, capped at 150 s. Data: `bench/story/plans.json`.

| plan (side 0) | first blood s | a side 25% lost s | losses at 60 s (0 / 1) | losses at 120 s (0 / 1) | fight centre x m | fight spread abs z m | lead changes | winner 0 / 1 / none |
|---|---|---|---|---|---|---|---|---|
| PINCER | 44.9 | 65.2 | 11 / 2 | 35.3 / 19 | 1478.3 | 956.3 | 0 | 0 / 0 / 3 |
| AMBUSH | 40 | 63.5 | 13.3 / 3.7 | 31.7 / 24.3 | 1351.3 | 657.3 | 0 | 0 / 0 / 3 |
| HOLD | 74.7 | 98.2 | 0 / 0 | 26.7 / 14.3 | -1056.7 | 787 | 0.3 | 0 / 0 / 3 |
| RAID | 40.7 | 85.3 | 6.3 / 3 | 33.7 / 23 | 1933.3 | 725 | 0 | 0 / 0 / 3 |
| DECAPITATE | 36.3 | 58 | 17 / 6 | 27 / 21.7 | 1476 | 642.7 | 0 | 0 / 0 / 3 |
| SIEGE | 64.8 | 90 | 0 / 0 | 28 / 21.3 | -45.3 | 981 | 0.3 | 0 / 0 / 3 |

- **Hold and siege delay first blood** to 75 and 65 s, against 36–45 s for the attacking plans.
- **Where the fight happens moves with the plan.** Hold fights on its own side of the field (fight centre x −1,057 m) and siege in the middle (−45 m). Pincer, ambush, raid and decapitation carry the fight to the enemy (+1,351 to +1,933 m).
- **Attacks that pick a point fight narrow** (decapitation 643 m, ambush 657 m) and a siege wide (981 m).
- **Decapitation trades fastest:** it loses a quarter of its side by 58 s, while siege takes until 90 s and hold until 98 s.

### Three seeds of one matchup, side by side

Empire vs Rebels, 60 a side, notable events per 15-second window (plain kills are counted elsewhere, not listed). ▲ is the Empire, ◆ the Rebels.

**After:**

| window | seed 1101: pincer vs raid, convoy, ◆ wins at 134.6 s | seed 2202: hold vs ambush, annihilate, undecided at 180 s | seed 3303: siege vs pincer, station, ◆ wins at 96.3 s |
|---|---|---|---|
| 0–15 s | · | · | ◆ station taken |
| 15–30 s | ▲ first shots, ▲ hero duel | ▲ first shots | ◆ first shots |
| 30–45 s | ◆ raid jump ×2, ◆ ion strike, ▲ rout | ◆ ion strike, ◆ rout | ◆ rout ×2 |
| 45–60 s | ▲ rout, ▲ hero duel, ▲ vendetta, ▲ ace duel, ◆ rout ×2 | ◆ ace, ◆ vendetta, ▲ PLAN SWITCH, ◆ jump-out | ◆ rout, ◆ jump-out ×3 |
| 60–75 s | ▲ jump-out, ▲ PLAN SWITCH, ◆ ace, ◆ raid jump, ◆ plan works, ◆ vendetta, ◆ jump-out ×2, ▲ HERO DOWN, ▲ vendetta ends, ▲ plan works | ◆ plan works, ◆ last stand, ▲ rout, ▲ hero duel, ◆ rout | ▲ PLAN SWITCH, ▲ ace, ◆ rout |
| 75–90 s | ◆ vendetta, ▲ ion strike, ◆ last stand, ◆ vendetta ends, ▲ last stand, ◆ ion strike | ◆ HERO DOWN, ◆ vendetta ends, ▲ vendetta, ◆ jump-out | ◆ PLAN SWITCH, ◆ vendetta, ◆ jump-out |
| 90–105 s | ◆ capital down, ▲ rout ×2, ◆ convoy through | ▲ ace, ▲ rout ×2, ◆ ion strike, ◆ rout, ◆ pods, ◆ last stand, ▲ screen, ◆ capital down ×2, ◆ RAM, ▲ jump-out, ◆ screen, ▲ last stand | ◆ VICTORY |
| 105–120 s | ▲ jump-out ×2, ▲ pods, ▲ last stand, ▲ capital down | ◆ rout ×4, ◆ jump-out ×2, ◆ wreck strike, ▲ jump-out, ▲ rout, ▲ vendetta, ◆ pods saved |  |
| 120–135 s | ▲ capital down, ◆ VICTORY, ◆ convoy through | ▲ rescue, ◆ jump-out ×3, ◆ wreck strike, ▲ jump-out, ◆ rescue |  |
| 135–150 s |  | ◆ ion strike, ◆ pods saved, ▲ screen ×2, ▲ capital down |  |
| 150–165 s |  | ▲ last stand, ▲ rescue, ▲ vendetta, ◆ pods saved |  |
| 165–180 s |  | ▲ rescue, ◆ pods saved, ▲ HERO DOWN, ▲ vendetta ends |  |

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
- seed 1101 is a Rebel convoy run against an Imperial pincer, won at 134.6 s after an ace duel, vendettas on both sides and an Imperial plan switch;
- seed 2202 is a long hold-versus-ambush grind with rams, rescues and pods saved, still undecided at 180 s;
- seed 3303 is a fight for the station, taken in the first 15 s and won by the Rebels at 96.3 s.

### Watching whole wars

`node scripts/watch-log.cjs` runs the real page headless through its own `frame()` at 30 fps, so the director, captions and replays run as in the browser (CPU only, no pixels). Logs: `bench/story/watch/`. "Big deaths" are capital and hero deaths; "seen / replayed / missed" says whether each was on screen when it happened, shown in an automatic replay, or neither.

| war | camera | duration s | cuts | median shot s | shortest s | cuts under 4 s | big deaths | seen / replayed / missed | 15 s with nothing notable | median caption s |
|---|---|---|---|---|---|---|---|---|---|---|
| The Imperial Starfleet vs The Rebel Alliance, seed 1101 | broadcast | 140.6 | 14 | 9.6 | 7.23 | 0 | 4 | 3 / 1 / 0 | 0–18.4 | 4.6 |
| The Imperial Starfleet vs The Rebel Alliance, seed 1101 | action | 140.6 | 16 | 8.03 | 4.6 | 0 | 4 | 4 / 0 / 0 | 0–18.4 | 4.6 |
| The Borg Collective vs The Federation, seed 2202 | broadcast | 168.6 | 18 | 9.56 | 3.74 | 1 | 14 | 9 / 4 / 1 | none | 3.7 |
| The Borg Collective vs The Federation, seed 2202 | action | 168.6 | 20 | 8.37 | 3.57 | 2 | 14 | 9 / 0 / 5 | none | 3.7 |
| The Shadows vs The Minbari Federation, seed 3303 | broadcast | 101.3 | 9 | 10.67 | 8.03 | 0 | 2 | 1 / 1 / 0 | none | 3.9 |
| The Shadows vs The Minbari Federation, seed 3303 | action | 101.3 | 11 | 9 | 4.2 | 0 | 2 | 0 / 0 / 2 | none | 4.6 |

- **Broadcast** holds a median shot of 9.6–10.7 s and misses 1 of 20 capital and hero deaths: 13 were on screen live and 6 were replayed. The miss is a Borg capital that died 6 s before the war ended, so its replay never came.
- **Action**, the default camera, rides one subject at a time and has no replays. Its median is 8.0–9.0 s. It saw 13 of the 20 big deaths live and missed 7 (5 of them in the Borg vs Federation war, which loses capitals in bursts). B switches to Broadcast.
- **The only dead stretch** is the 18 s approach before first contact in the convoy war.
