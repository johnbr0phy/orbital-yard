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
