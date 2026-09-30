# Tribute War: how the ships fly

This file measures motion quality: whether ships commit to lines, whether squadrons breathe, whether capitals have weight, and whether you can tell the fleets apart from motion alone. The brief is `MOTION-BRIEF.md`. The numbers come from `scripts/motion-report.cjs` (headless, the page's real simulation) unless a row says otherwise. Clips and their logs come from `scripts/motion-capture.cjs` (Chromium).

## Pass criteria

I wrote these before changing a line of the flight code. The brief set the targets. Where it asked me to define a band or a threshold, I fixed it here first and then measured the baseline against it.

**Status on the final commit: 9 of the 11 motion criteria pass (main passed none of the eight that can be scored on one build). Cohesion and individuality do not; "The criteria that did not pass" below gives the evidence. Of the other checks, tests, determinism and cost pass. The story is below BEHAVIOUR.md's rates, and two fleet-balance pairings shift in ways I can't yet explain (both below).**

<!-- CRITERIA-TABLE -->
| # | criterion | target | baseline (main) | final | result |
|---|---|---|---|---|---|
| 1 | Reversals, gunboats and capitals (every fleet), per ship-minute | 0 | 13 in 1972 ship-min; worst Yautja frigate 0.079, Federation frigate 0.036, Empire frigate 0.022 | 0 in 2032 ship-min; worst none | **PASS** |
| 2 | Reversals, any class in any fleet, per ship-minute | < 0.2 | worst Tesla hero 1.679; overall 0.212; 38 fleet-classes at or over 0.2 | worst Tesla fighter 0.021; overall 0.000 | **PASS** |
| 3 | Shuttle: worst share of any 10 s window, any ship | <= 5% | 88.0%; 324 ships over 5% | 4.0%; 0 ships over 5% | **PASS** |
| 4 | p95 angular jerk per class (rad/s^3), at or below baseline | <= baseline | leviathan 0.38; capital 0.32; light 9.02; fighter 11.89; hero 11.89; frigate 10.84; mid 13.03 | leviathan 0.38 -> 0.08; capital 0.32 -> 0.06; light 9.02 -> 2.72; fighter 11.89 -> 5.82; hero 11.89 -> 5.56; frigate 10.84 -> 0.39; mid 13.03 -> 1.88 | **PASS** |
| 5 | p95 angular jerk, frigates | <= 50% of baseline | - | 10.84 -> 0.39 (4%) | **PASS** |
| 6 | Spinning in place, hulls of 80 m or longer (events) | 0 | 64 (148.8 s) | 0 (0.0 s) | **PASS** |
| 7 | Speed holds of 5 s or more, small and mid-size craft | <= 10% | fighter 15.8%; light 23.2%; mid 10.7%; frigate 32.8%; hero 19.7% | fighter 0.6%; light 1.4%; mid 1.0%; frigate 1.7%; hero 1.2% | **PASS** |
| 8 | Capitals: max turn rate, acceleration and braking against the hull's limits; reversals | <= 1.05x each; 0 reversals | turn 1.00x, accel 18.26x, brake 465.73x; 0 reversals | turn 1.00x, accel 1.00x, brake 1.00x; 0 reversals | **PASS** |
| 9 | Squadron cohesion inside the band, share of squad-time outside dogfights and routs | >= 80% overall and in every fleet | 43.2% overall; worst Minbari 12.4% (parade 0%, dissolved 74%) | 69.1% overall; worst Minbari 24.0% (parade 0%, dissolved 67%) | **FAIL** |
| 10 | Squadmates' motion signatures: smallest pairwise distance in any squad (feature sd units) | >= 0.25 in every squad | min 0.032, median squad min 0.363; 202 of 915 squads below | min 0.087, median squad min 0.389; 169 of 915 squads below | **FAIL** |
| 11 | Fleet from motion alone: held-out accuracy (per-class models, ship identity hidden) | >= 3x chance and >= baseline +15 points and 1.5x baseline | 24.6% vs chance 5.6% (4.40x) | 40.2% vs chance 5.6% (7.19x); baseline 24.6% | **PASS** |
| 12 | All existing tests plus the new motion tests (tests/tribute-new) | 0 failures | main: 293 pass, 1 skipped | 299 pass, 0 fail, 1 skipped (300, incl. tests/tribute-new/motion.test.cjs) | **PASS** |
| 13 | Determinism: sim-bench trace recorded twice, and determinism-browser.cjs (same war however watched) | identical | trace 034d4243 | trace 28cdea4f identical twice; browser: same final hash and story events at 1x, 2x/0.5x, slow motion and 1 vs 3 forge workers | **PASS** |
| 14 | Simulation cost at 600 a side (sim-bench, Empire v Rebels, 38-48 s, median of 3, interleaved on one machine) | within 5% of main | 5394 ms CPU per sim s (median of 3, interleaved) | 3926 ms (27% cheaper) | **PASS** |
| 15 | Fleet-balance winners (the nine fleet-balance pairings, 48 a side, 150 s) | unchanged or justified | 5 seeds per pairing, bench/motion/balance-main-5.json | majority winner over 5 seeds unchanged in 5 of 9; 0v1 (3-2 to 2-3) and 14v15 (2-3 to 3-2) are near-even coin flips; Lattice v Drift (2-3 to 4-1) and Choir v Empire (1-4 to 5-0) shift and are not yet explained | **FAIL** |
| 16 | Story moments at BEHAVIOUR.md rates or better (story-metrics.cjs, 30 wars) | >= BEHAVIOUR.md | 60/300 a side: routs 61/312, last stands 72/76, rescues 48/29, aces 12/31 | routs 59/260, last stands 55/61, rescues 47/29, aces 17/24 (BEHAVIOUR.md, 'The motion pass') | **FAIL** |

Measured by `scripts/motion-report.cjs` over 56 runs (32 scenes and the 24-war sweep), baseline on main 7f82d45, final on this branch. Rows 12 onward are measured outside the motion report; see "How to re-run".
<!-- /CRITERIA-TABLE -->

### What each criterion measures

All measurements use the recorder in `scripts/motion-lib.cjs`. It samples every ship at every 1/30 s simulation step and reads state only: it draws no random numbers and changes nothing.

- **Flying.** The ship has arrived, is past its jump-shed window, and is alive and not jumped. The human pilot's ship doesn't count.
- **Contact.** The ship is inside the contact solver's 0.6–0.8 s brake window, after a real collision or a push out of a rock. Its displacement then is the solver's, not the pilot's.
- **Dogfighting.** A small craft (not a frigate, not a capital) that is attacking, flanking, striking or evading with its mark within 1,500 m.
- **Hull classes.** Fighter: under 42 m. Light: 42–80 m. Mid: 80 m or more but a slicer or cutter small craft (Shadow hunters, Borg spheres). Frigate: the page's gunboats (80 m or more, not a capital; frigates, corvettes, transports). Hero: the named hero ship. Capital: fights as a crown. Leviathan: a crown of 50 hulls or more (the Executor, the Borg cube).
- **Reversal.** The unwrapped heading moves more than 120° from where it was, then comes back within 60° of it, all inside 6 s. Every sample in between must be flying, not dogfighting, not evading an ion lock and not in contact. A full loop is not a reversal, because its unwrapped heading doesn't come back. Ships here always move along their hull axis (only the contact solver pushes them sideways), so a heading reversal is also a velocity reversal. The slide share in the turn-physics table checks that. Reported per ship-minute of eligible time.
- **Reversal, gunboats and capitals.** Frigates, capitals and leviathans don't dogfight, so the only exclusions are ion evasion, contact and a committed ram.
- **Shuttle share.** In every 10 s window (1 s stride, sampled at 5 Hz), the share of the window the ship spends on ground it crossed earlier in the same window: within max(20 m, half its length), at least 1 s earlier, flying the other way (more than 120° apart). An orbit or a loop never retraces ground in the opposite direction. Back-and-forth does. No state is excluded except contact.
- **Jerk.** Third differences of the flown kinematics at 30 Hz. Angular jerk is the norm over unwrapped yaw, pitch and roll, in rad/s³. Linear jerk is the flown velocity's second difference divided by hull length, in 1/s³. Samples in contact are excluded. Percentiles come from a log-histogram (1,000 bins over ten decades, within 2.3%).
- **Spin in place.** Yaw rate over 0.1 rad/s (smoothed over five samples) while speed is under 15% of the ship's top speed, for 0.5 s or more.
- **Speed hold.** Flying time inside a 5 s run whose speed stays within ±2% of one value. This is the PR #5 plateau definition.
- **Capital limits.** The largest yaw rate against the hull's turn rate, and the largest acceleration and braking against its spool. Acceleration is limited to full burn / spool and braking to 1.5× that, with spool = min(30, 8 + length / 200) s, the page's own figure. Full burn is the speed the drive in use spools toward: the transit speed during a transit burn, top speed otherwise. A spool is the time to reach full burn, so a transit burn must also take a spool to build. Contact and committed rams (the emergency burn) are excluded; transit burns are not.
- **Cohesion band.** Checked once a second for every squadron with three or more members flying, outside dogfights (half or more of the members dogfighting) and routs. The band:
  - heading spread (circular standard deviation) of 1.5° to 40°;
  - speed coefficient of variation of 0.01 to 0.35;
  - RMS distance to the centroid from 1.5 mean hull lengths up to 700 m.

  **Why this band.** Under 1.5° of heading and 1% of speed variation, eight pilots are flying one autopilot: that's a parade. Over 40° of heading spread they no longer share a heading. Over 700 m RMS radius the squadron has dissolved; 700 m is BEHAVIOUR.md's "broken" line, and 300 m is its "formed". Under 1.5 hull lengths from the centroid, the hulls are stacked on each other.
- **Individuality.** For each ship, a motion signature over its flying time: mean yaw rate, weave frequency and amplitude, throttle rhythm frequency and amplitude, mean line offset from its squadron's track, and mean bank. Distances are Euclidean in units of each feature's standard deviation across the run, divided by √7. The threshold is 0.25: two squadmates must differ by at least a quarter of a standard deviation on average across the seven features. Identical signatures score 0.
- **Fleet signature.** One row per ship per 20 s window of flying, with 15 motion features (speed, speed variation and rhythm, yaw rate, weave frequency, yaw acceleration, bank, bank per unit of yaw rate, climb, turn radius, distance and heading offset from its squadron, straightness, throttle steps). There is no race, length, id or colour. One multinomial logistic regression per hull class, so the classifier can't tell fleets apart by hull size. It is trained on one seed's sweep wars and scored on the other seed's wars (two folds). Chance is 1 over the number of fleets the model chooses between, weighted by test rows.
- **Well above baseline** means at least 15 points and at least 1.5× the baseline accuracy.

### The run set

- **Scenes** (fixed seeds, `scripts/motion-scenes.cjs`):
  1. the Rebel frigate screen (the donkey report);
  2. a gunboat screen for every fleet that has gunboats;
  3. an Imperial squadron forming, attacking and re-forming;
  4. a Rebel squadron doing the same;
  5. a Borg cube and its escorts closing;
  6. a capital's broadside pass, a 180° turn (a scripted waypoint astern) and a stop (a scripted hold);
  7. a dogfight between the two most fighter-heavy fleets (Empire v Shoal);
  8. a rout and a rally (scripted at fixed times, through the same state the morale code sets);
  9. an Imperial holding line under First One fire (PR #10's scenario);
  10. a full 90 s war at 600 a side.
- **Sweep.** Every fleet in a measured 150 s war at 48 a side, twice (two seeds). That's 12 pairings: (0,1), (2,3) … (20,21) and (22,0). `fleet-balance.cjs` runs 9.

<!-- SCENE-TABLE -->
| scene | reversals /min (before → after) | gunboat + capital reversals /min | worst shuttle | frigate p95 angular jerk | cohesion in band | smallest squadmate distance |
|---|---|---|---|---|---|---|
| 01 Rebel frigate screen | 0.179 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 40% → 0% | 9.44 → 0.32 | 48% → 84% | 0.074 → 0.132 |
| 02-00 Gunboat screen: Yard | 0.141 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 4% → 0% | 11.61 → 0.46 | 47% → 76% | 0.177 → 0.148 |
| 02-01 Gunboat screen: Shoal | 0.197 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 16% → 0% | 10.59 → 0.82 | 50% → 69% | 0.247 → 0.118 |
| 02-02 Gunboat screen: Lattice | 0.321 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 24% → 0% | 7.67 → 0.11 | 66% → 90% | 0.193 → 0.264 |
| 02-03 Gunboat screen: Drift | 0.140 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 36% → 0% | 9.23 → 0.43 | 50% → 81% | 0.213 → 0.218 |
| 02-04 Gunboat screen: Choir | 0.161 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 22% → 0% | 8.22 → 0.27 | 43% → 70% | 0.149 → 0.253 |
| 02-05 Gunboat screen: Empire | 0.185 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 0% → 0% | 2.16 → 0.33 | 59% → 85% | 0.086 → 0.186 |
| 02-06 Gunboat screen: Rebels | 0.332 → 0.000 | 0.064 / 0.000 → 0.000 / 0.000 | 32% → 0% | 8.61 → 0.43 | 50% → 72% | 0.195 → 0.167 |
| 02-07 Gunboat screen: Minbari | 0.149 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 10% → 0% | 5.43 → 0.07 | 39% → 69% | 0.168 → 0.143 |
| 02-09 Gunboat screen: EarthForce | 0.127 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 24% → 0% | 4.03 → 0.13 | 66% → 81% | 0.232 → 0.111 |
| 02-10 Gunboat screen: Federation | 0.047 → 0.000 | 0.076 / 0.000 → 0.000 / 0.000 | 2% → 0% | 9.23 → 0.07 | 54% → 80% | 0.225 → 0.173 |
| 02-11 Gunboat screen: Klingons | 0.232 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 82% → 0% | 6.10 → 0.29 | 58% → 89% | 0.098 → 0.114 |
| 02-12 Gunboat screen: Borg | 0.259 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 54% → 0% | 12.45 → 0.70 | 21% → 53% | 0.294 → 0.251 |
| 02-13 Gunboat screen: Mondoshawan | 0.265 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 70% → 0% | 5.31 → 0.20 | 49% → 70% | 0.133 → 0.23 |
| 02-14 Gunboat screen: USCM | 0.070 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 10% → 0% | 7.85 → 0.53 | 53% → 82% | 0.213 → 0.236 |
| 02-15 Gunboat screen: Engineers | 0.067 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 58% → 0% | 6.38 → 0.11 | 30% → 90% | 0.142 → 0.128 |
| 02-16 Gunboat screen: Yautja | 0.333 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 76% → 0% | 10.12 → 0.33 | 49% → 91% | 0.147 → 0.226 |
| 02-17 Gunboat screen: First Ones | 0.177 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 0% → 0% | 9.23 → 0.30 | 69% → 77% | 0.169 → 0.331 |
| 02-18 Gunboat screen: Romulans | 0.021 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 0% → 0% | 1.76 → 0.15 | 64% → 76% | 0.032 → 0.152 |
| 02-19 Gunboat screen: Dominion | 0.044 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 18% → 0% | 12.74 → 0.60 | 61% → 73% | 0.08 → 0.185 |
| 02-20 Gunboat screen: Space Marines | 0.020 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 0% → 0% | 19.28 → 0.10 | 34% → 76% | 0.074 → 0.122 |
| 02-21 Gunboat screen: Tyranids | 0.137 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 10% → 0% | 6.53 → 0.86 | 40% → 68% | 0.176 → 0.144 |
| 02-22 Gunboat screen: Tesla | 0.529 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 76% → 0% | 5.96 → 0.34 | 46% → 94% | 0.174 → 0.247 |
| 03 Imperial squadron: form, attack, re-form | 0.406 → 0.000 | 0.072 / 0.000 → 0.000 / 0.000 | 12% → 0% | 9.44 → 0.42 | 51% → 70% | 0.173 → 0.147 |
| 04 Rebel squadron: form, attack, re-form | 0.406 → 0.000 | 0.072 / 0.000 → 0.000 / 0.000 | 12% → 0% | 9.44 → 0.42 | 51% → 70% | 0.173 → 0.147 |
| 05 Borg cube and escorts closing | 0.391 → 0.000 | 0.041 / 0.000 → 0.000 / 0.000 | 12% → 0% | 14.96 → 0.20 | 35% → 61% | 0.189 → 0.329 |
| 06 Capital handling: broadside pass, 180 degree turn, stop | 0.123 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 48% → 0% | 14.29 → 0.18 | 54% → 62% | 0.379 → 0.221 |
| 07 Dogfight: Empire v Shoal | 0.186 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 28% → 0% | 14.96 → 0.88 | 72% → 85% | 0.253 → 0.2 |
| 08 A rout and a rally | 0.080 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 8% → 0% | 11.61 → 0.37 | 38% → 58% | 0.177 → 0.151 |
| 09 A holding line breaks under First One fire | 0.130 → 0.000 | 0.000 / 0.000 → 0.000 / 0.000 | 0% → 0% | 8.22 → 0.80 | 70% → 71% | 0.14 → 0.294 |
| 10 A full war, Broadcast, 600 a side | 0.099 → 0.000 | 0.008 / 0.000 → 0.000 / 0.000 | 20% → 0% | 7.00 → 0.41 | 43% → 75% | 0.115 → 0.087 |
<!-- /SCENE-TABLE -->

## The criteria that did not pass

The goal was every criterion green. Two motion criteria are not (cohesion and individuality), and neither is row 16, the story rates. I haven't touched any definitions. This is what they measure now, and why.

### Squadron cohesion (69.1% overall; worst fleet Minbari 24%)

Main measured 43.2%, worst fleet 12.4%. In-band share by formation phase now: CRUISE 74%, FORM 63%, REFORM 30%, BREAK 27%. By fleet in the sweep: Klingons 90%, Engineers and Yautja 87%, USCM 83%. Every other fleet is between 46% and 75%, except Borg (37%) and Minbari (20%).

- **Some squadrons have no band to be in.** The floor is 1.5 mean hull lengths and the ceiling is 700 m, so a squadron whose hulls average over 467 m is out of band whatever it does. In the final sweep that is 15% of Minbari squad-time (squadrons of four capitals of 300–636 m). Another 31% is in squadrons whose band is under 200 m wide (mean hull 333–466 m). With 15% out of reach, the Minbari can reach 85% only if every other squadron is in band every second. I won't stack capitals to pass a number.
- **Frigate squadrons in cruise are the biggest single loss:** 7.6% of all sweep squad-time is out of band in all-frigate squadrons (55% in band), and another 3.6% in mixed squadrons led by frigates. Frigates fly a line-ahead column with slots 360–570 m apart. They arrive by jump in a clump, top out at 11–17 m/s, and a hull of 80 m or more never slows below four-fifths of the formation's pace (so it can't pivot on the spot). So the tail of a four-ship column takes minutes to drop 1.3 km back to its slot. Meanwhile the clump is under the 1.5-hull-length floor, or its speeds spread over the 0.35 limit.
  - I tried letting a big hull that is well ahead of its slot, and on its line, slow to 45% of the pace.
  - Separately, I tried dealing slots by where the pilots are (nearest pilot to each slot, front to back) instead of roster order.
  - Neither moved cohesion on four test wars (49.7% → 49.8%), so neither is in.
- **Breaking and re-forming.** A squadron in a furball is exempt only while half or more of it is dogfighting. The seconds either side of that, when some pilots are on their passes and some are coming back, are counted, and they are mostly out of band on heading.
- **The story trade.** Holding wingmen in formation until they were inside 0.5–0.85 km of their marks put cohesion at 72.6% in the fleet sweep, but fixed-gun wingmen can't aim from a slot. Kills, routs and last stands fell 15–30%. Wingmen now leave their slot when their mark is within gun-pass range, which bought the story back and costs about 3 points of cohesion.
- **Speed spread in cruise** (`CRUISE.cvHigh`): fleets whose squadrons mix hulls with very different top speeds (Borg, Shadows, Romulans) run a coefficient of variation over 0.35 while stragglers catch up. Squadrons led by a capital with small craft in them are in band 4% of their cruise time.

### Individuality (169 of 915 squadrons below 0.25; median squadron minimum 0.39)

Main had 202 of 915 below and a median of 0.36.

The criterion is the smallest distance between any two squadmates. A squadron of 8 has 28 pairs, so it fails if any one pair is close. Failures by squadron size: 2 to 3 ships, 1 of 60; 4 to 5, 22 of 345 (6%); 6 or more, 146 of 510 (29%).

Pilots' hands are dealt from a golden-ratio sequence on the ship id, so their weave, rhythm and now bank differ by design. Spreading the bank the same way cut failures on six test wars from 22 to 15 of 83. In formation, though, eight pilots fly one track, and the flight itself pulls their signatures together.

Widening the weave and throttle-rhythm spreads as well made no further difference (15 of 83). An earlier, wider spread cost the fleet classifier 5 points (fleets blur into each other). The classifier is now at 40.2% against a 39.6% floor, so there is no room to widen further.

### Fleet balance (row 15)

With one seed per pairing, 4 of the 9 fleet-balance pairings kept main's leader. A single 48-a-side war is close to a coin flip when the fleets are even, so I ran five seeds per pairing on main and on this build (`node scripts/motion-balance.cjs --seeds 5`; `bench/motion/balance-main-5.json` and `balance-after-5.json`). Wins for the first fleet, main → motion:

| pairing | main | motion |
|---|---|---|
| Yard v Shoal | 3-2 | 2-3 |
| Lattice v Drift | 2-3 | 4-1 |
| Choir v Empire | 1-4 | 5-0 |
| Rebels v Minbari | 1-4 | 1-4 |
| Shadows v EarthForce | 5-0 | 4-1 |
| Federation v Klingons | 4-1 | 3-2 |
| Borg v Mondoshawan | 5-0 | 3-2 |
| USCM v Engineers | 2-3 | 3-2 |
| Yautja v First Ones | 0-5 | 0-5 |

Yard v Shoal and USCM v Engineers were 3-2 and 2-3 on main and are 2-3 and 3-2 now: coin flips either way. Lattice v Drift and Choir v Empire are real shifts. Choir v Empire went from Empire winning four in five to the Choir winning all five. I haven't found the mechanism, so I'm not calling them justified. Borg v Mondoshawan narrows from 5-0 to 3-2 but keeps its winner.

### Story rates (row 16)

See BEHAVIOUR.md, "The motion pass". Fewer ships die in the 120 s window, mostly because fewer fly into each other. Routs, rallies and last stands are driven by losses, so at 300 a side they fall below BEHAVIOUR.md's rates.

## The final question

*If someone hides the colours and the hulls and shows only the motion trails, can they tell which fleet is which, which ships fly together, and that no ship is ever lost or dithering?*

- **Which fleet is which: mostly, and measurably.** A classifier that sees only motion (15 features: speed, speed rhythm, yaw rate and weave, bank per unit of turn, climb, turn radius, distance and heading from the squadron, straightness, throttle steps), trained on one seed's wars and tested on the other's, names the fleet 42.3% of the time. Chance is 5.6% and main scores 24.6%. By hull class: frigates 44% of 19 fleets, capitals 44% of 23, fighters 42% of 20, light craft 41% of 17. So a trained eye would tell a Shoal swarm from a Borg cluster at a glance, and would still confuse the three "by the book" fleets (Yard, EarthForce, USCM) more often than not. `bench/motion/final/plots/signature-fighter.png` shows the clusters.
- **Which ships fly together: usually.** Squadrons are in the cohesion band 70% of the time they aren't dogfighting or routing, against 43.2% on main, where squadrons didn't fly formations at all (their members happened to share a direction). They fly on their leader's track, turn as one arc, and hold 1.9 to 2.6 hull lengths of spacing. Where they don't read as one is above: a squadron mid-break, and crown squadrons that are too big for the band.
- **Never lost or dithering: yes for gunboats and capitals, nearly for the rest.** There are no reversals at all for gunboats, capitals and leviathans over 2,046 ship-minutes (main: frigates reversing on their hold points). Across all classes there are 30 reversals in 7,678 ship-minutes, 0.004 a minute, and the worst fleet-class is 0.069. No hull of 80 m or more spins in place. Capitals stay inside their turn and spool limits (1.00×). Frigate p95 angular jerk is 0.39 rad/s³ against 10.84 on main (4%). The honest exception is the 17 fighters above whose gun passes cross their own earlier line.

## Why the Rebel frigates shuttled: the cause, with evidence

The brief listed five suspects. I measured before changing anything. `bench/motion/evidence/donkey-baseline-02-06.png` is the clearest case: two Rebel corvettes in the baseline's scene 02-06, which is the Rebels' gunboat screen.

- **The cause: a fixed point, and no way to arrive at it.** The story's plan posture gives every pilot a HOLD point, and ambushes give HIDE points: the plan's point plus the pilot's own lane, spread up to 420 m. Neither the page nor the minds had any way to *arrive* at a point. A ship steered straight at it, and within 26 m the page cut its speed to 78% for gunboats and 20–32% for others. Near the point the ship overshoots, turns round, overshoots again: a pendulum. Frigate 17 (93 m) reaches its hold point at t≈24 s, pivots 165° in 4 s, and pivots back when the order lapses at 28 s. Frigate 18 never turns but rocks on the spot, its speed pulsing between 10 and 25 m/s as the "within 26 m" cut switches on and off.
- **What made it a donkey rather than a lazy loop: Rebel gunboats pivot inside their own length.** Their turn rates are 0.53–1.03 rad/s at 23–47 m/s. That is a turning circle of 37–59 m for hulls 85–155 m long (measured from the forge, `ships.filter(isGunboat)`). An Imperial 576 m frigate turns at 0.12 rad/s and swings wide, so the same pendulum looks like an orbit. On a Rebel corvette it is a hull swinging back and forth on the spot.
- **Across the whole baseline**, frigates' shuttle windows over 5% came overwhelmingly from HOLD (12 of 35), then attack standoffs (the attack goal is a point `berth` metres short of the target on the ship's own side, which flips when the ship passes it), then fight or flight. Fighters and light craft show the same pattern in HOLD, HIDE and screening orbits.

The other suspects, checked:

- **The gunboat patrol turning at its ends:** not the cause. `gunboatGoal()` and `pickPatrol()` are dead code on main; nothing calls them. The racetrack in this pass replaces them.
- **Brakes 1.5× stronger than acceleration:** not a cause of reversals. It shortens a ship's stop, but ships here always move along their hull, so braking cannot reverse them. It did make the "within 26 m" cut bite hard, which is part of frigate 18's rocking.
- **The 0.3 s traffic-avoidance offset that flickers:** dead code. `s.avT` is read in two places and written nowhere. The avoidance that does run is the traffic pilot's passing altitude, held for 1.2 s and switched on and off with a brake of 0.4, 0.65 or 0.9. That switching is real, and it now blends.
- **Commit timers flipping goals:** real, but secondary. A pilot re-decides every 1.3–5.5 s. When ATTACK and FLANK aim at opposite sides of a target, the goal can swap sides mid-turn. There are now hysteresis and dwell times.
- **Patrol waypoints close to the turning radius:** the same thing as the first cause, in another form. Every point goal smaller than a few turning circles makes the hull turn round on it.

## Log

What I tried, in order, and what the numbers said. Rejected approaches stay here so nobody tries them again.

1. **Baseline on main (7f82d45).** All eight criteria that can be scored on a single build fail (jerk and the classifier are relative to main). Rebel frigates reverse and shuttle on their hold points (see above); classifier 24.6%; frigate p95 angular jerk 10.84 rad/s³.
2. **Handling rows and a layered helm** (per-fleet distributions, per-ship stream, second-order turn, bank and climb, jerk-limited speed inside the spool envelope, reaction delay on intents). Reversals for gunboats and capitals went to zero at once: arrival now has a shape (a loiter circle or a racetrack) instead of a point.
3. **Rejected: reaction delay inside the feedback loop.** Delaying the measured error as well as the intent made every pilot oscillate around its own track. The delay now applies to intents (goal and slot points) only.
4. **Rejected: rigid formation slots rotated with the leader's heading.** When a leader turned, the outer slots swept sideways faster than a wingman could fly and the wingman looped back to catch the slot. Slots now sit on the leader's own breadcrumb trail (path-relative), so a wingman flies the line the leader flew.
5. **Rejected: loiter radius from current speed.** A slowing ship shrank its circle, turned harder, slowed more. The radius now comes from cruise speed and the hull's turning circle.
6. **Rejected: wingmen turning back for a slot they overshot.** A wingman ahead of its slot now eases off (a speed floor) instead of turning round. This alone took most of the fighter shuttling.
7. **Throttle chase on slotted wingmen.** The page's throttle chased a mark's speed even in formation, dragging wingmen off their slots. Slotted ships skip the chase.
8. **Hero ships set the spacing.** Squad spacing from the mean hull length let one hero stretch a squadron of fighters to 900 m. Spacing now uses the median.
9. **Vertical hops.** Avoidance altitude switched in 0.3 s steps. Now: a climb limit, avoidance blends in over 0.35 s and out over 4 s, and goal height is smoothed over 1.5 s.
10. **Pirouettes.** Big small craft (Shadow hunters, Borg spheres) could turn inside their length at low speed. A turning-circle floor (radius at least 0.8 to 1.4 hull lengths by class) stopped them.
11. **Jerk regression.** The first helm cut reversals but raised fighter jerk. Longer turn time constants and a tighter jerk limit brought every class under baseline.
12. **Capital acceleration overrun.** Transit burns accelerated without limit. The helm's speed demand is now clamped to the drive's spool envelope, and capital limits pass.
13. **Escorts dispersed at muster.** Squads started scattered and spent a minute forming. `formTheSquadrons()` lays band-one squads out in formation around their leader at muster.
14. **Cruiser squads fly a column** (line-ahead at 1.4 hull lengths). See "Cohesion and big hulls" for why this is the closest honest formation.
15. **Speed holds.** Wingmen matching a leader at cruise sat inside ±2% for 5 s. Each pilot's throttle rhythm now carries a 3.8 to 5 s beat of at least 5%, from their own handling draw.
16. **Story regression, then a trade.** The full story metrics (BEHAVIOUR.md) showed 15–30% fewer routs, last stands and rescues than main. Three causes, all mine: slotted fixed-gun wingmen couldn't aim (0.08 shots a second against 0.42 free); my combat orbit overrode fighters' gun passes, so they circled just outside the pass trigger; and formations formed at 0.55 of cruise for up to 30 s. Fighters now fly gun passes, leave their slot once their mark is inside gun-pass range (1,250 m), and formations form at 0.8 of cruise for at most 12 s. That bought the kills back and cost cohesion (below).
17. **Rejected: letting formations cruise at 0.85 of full burn.** It closed the range faster, but wingmen had no speed in hand to hold slots, and ships pinned at the full-burn clamp sat in "speed holds" (mid-size craft 18%). Formations cruise at the slowest wingman's cruise.
18. **Rejected: a throttle rhythm that only subtracts.** It cost 10–15% of speed on average. Centred on the demand, it clipped against full burn instead (the same speed-hold plateau), so the demand is held under 0.88 of full burn before the rhythm is applied.
19. **The muster keeps jump lanes clear** (the Dominion arrival test). Laying a squadron out in formation put wingmen on their leader's jump lane; blocked wingmen stayed scattered, which cost 10 points of cohesion. They are now stepped up or down the stack until their lane is clear.
20. **Rank-spread handling rows** took the fleet classifier from 34–35% to 40–42%. Each widening of the spread was checked against jerk (fighters p95 7.0 against 11.9 on main).
21. **A pilot's own wake.** Most shuttling left after item 20 was gun passes coming back through the first pass (the report had 17 ships over 5%, worst 12%). Every pilot now keeps 10 s of its own track (a point every 0.2 s with its direction). If the next 0.5 to 2.5 s, flown along the arc it is turning on, would bring it within 1.8 tolerances of an old point, flying the other way, it passes that point 2.5 tolerances over or under. It passes on the side it would cross at, and holds that side while the rule is active. When the old track was steeper than 45°, it passes to the side instead. A traffic lane that would take it back through the wake gives way to the wake.
    - **Rejected: steering to a point beside the old track.** It pulled pilots across their own line and made things worse.
    - **Rejected: choosing over or under from the current climb rate.** It went straight through the track.
    - **Rejected: letting the rule re-pick its side on every trigger.** A fighter circling in a dogfight flipped between over and under and cleared neither.
22. **Rocks.** A ship brushing a rock was braked hard and could sit pinned against it (one hull 70 s at 2.6 m/s, all of it shuttle and spin). Hulls under 80 m now skid along the surface. Mid-size hulls slide at 0.92 of their speed. A pinned hull claws off along the tangent at up to 0.085 rad/s, under the spin threshold and inside the commitment rule. Wingmen's slots route round rocks.
23. **The commitment rule held too briefly.** It limited a pilot to 75° past any heading it had swung 100° away from, but it measured the swing from the current heading. A pilot easing back under 100° lost the limit and could finish the S-turn (the Tesla hero, 0.24 reversals a minute). The limit now holds until the heading it came from is 7 s old.
24. **Furball pirouettes.** A fighter slowed to 40 m/s in a knife fight circled on an 18 m radius, so every half-turn crossed its own path (8% shuttle). Small craft now circle no tighter than 30 m. That limit only binds at a crawl, because at combat speed it is above their turn rate. With 21 to 24, shuttle went from 17 ships over 5% to none (worst 4%).
25. **Bank per pilot** is dealt from the golden-ratio sequence like weave and rhythm (±0.25 about the fleet's row). Individuality went from 180 to 169 of 915 squadrons below 0.25. The classifier went from 41.9% to 40.2%, still over its 39.6% floor.
26. **Rejected for cohesion: slots dealt by position, and a lower speed floor for big hulls ahead of their slot.** Neither moved cohesion (see above).
27. **Rejected: re-choosing the golden-ratio multipliers.** Some multiplier choices put pilots whose ids are 5 or 8 apart close together on several features at once. I searched 20,000 multiplier sets for the one that maximises the smallest hand-space distance in squads of 8 to 10 consecutive ids. That raised the worst case in hand space from 0.17 to 0.27. In the sim it made no difference: 17 against 18 failing squads on the same six wars. The measured signatures are set by the shared flight more than by the dealt hands, so spacing the hands further apart doesn't separate them.

## How to re-run

```
node scripts/motion-report.cjs --label final --jobs 2 --compare bench/motion/baseline/summary.json   # all scenes and the sweep (--resume after an interruption)
python3 scripts/motion-plot.py final                  # track plots, reversal heatmap, signature scatter, cohesion
node scripts/motion-capture-all.cjs --label before --dir ../orbital-yard-main   # clips from a worktree of main
node scripts/motion-capture-all.cjs --label after
node scripts/motion-watch.cjs                         # design/tribute-new/review/motion/index.html
node scripts/motion-doc.cjs                           # the tables in this file, from bench/motion/*/summary.json and checks.json
node scripts/sim-bench.cjs --size 600 --matchup 5,6 --seed 1234 --from 38 --to 48   # cost (three runs, median)
node scripts/motion-balance.cjs --seeds 5 --out bench/motion/balance-after-5.json   # fleet-balance winners over 5 seeds (add --root ../orbital-yard-main for main)
node scripts/story-metrics.cjs --label after --out bench/motion/story/full-after.json
NODE_PATH=/opt/node22/lib/node_modules node scripts/determinism-browser.cjs
```

Keep jobs at 2 for the full motion report: scene 10 runs 600 a side, and four workers at once ran this 15 GB container out of memory twice.
