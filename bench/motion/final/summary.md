# Motion summary: final

56 runs. 2026-09-29T22:22:03.122Z

| criterion | target | measured | result |
|---|---|---|---|
| Reversals, gunboats and capitals (every fleet), per ship-minute | 0 | 0 in 2032 ship-min; worst none | PASS |
| Reversals, any class in any fleet, per ship-minute | < 0.2 | worst Tesla fighter 0.021; overall 0.000 | PASS |
| Shuttle: worst share of any 10 s window, any ship | <= 5% | 4.0%; 0 ships over 5% | PASS |
| p95 angular jerk per class (rad/s^3), at or below baseline | <= baseline | leviathan 0.38 -> 0.08; capital 0.32 -> 0.06; light 9.02 -> 2.72; fighter 11.89 -> 5.82; hero 11.89 -> 5.56; frigate 10.84 -> 0.39; mid 13.03 -> 1.88 | PASS |
| p95 angular jerk, frigates | <= 50% of baseline | 10.84 -> 0.39 (4%) | PASS |
| Spinning in place, hulls of 80 m or longer (events) | 0 | 0 (0.0 s) | PASS |
| Speed holds of 5 s or more, small and mid-size craft | <= 10% | fighter 0.6%; light 1.4%; mid 1.0%; frigate 1.7%; hero 1.2% | PASS |
| Capitals: max turn rate, acceleration and braking against the hull's limits; reversals | <= 1.05x each; 0 reversals | turn 1.00x, accel 1.00x, brake 1.00x; 0 reversals | PASS |
| Squadron cohesion inside the band, share of squad-time outside dogfights and routs | >= 80% overall and in every fleet | 69.1% overall; worst Minbari 24.0% (parade 0%, dissolved 67%) | FAIL |
| Squadmates' motion signatures: smallest pairwise distance in any squad (feature sd units) | >= 0.25 in every squad | min 0.087, median squad min 0.389; 169 of 915 squads below | FAIL |
| Fleet from motion alone: held-out accuracy (per-class models, ship identity hidden) | >= 3x chance and >= baseline +15 points and 1.5x baseline | 40.2% vs chance 5.6% (7.19x); baseline 24.6% | PASS |

| class | ships | ship-min | reversals/min | strict/min | shuttle max | ang jerk p50 / p95 | lin jerk/L p95 | holds | spins >=80 m | bank~rate r | overshoot p50/p90 deg | settle p50 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fighter | 4074 | 4162.56 | 0.000 | 0.000 | 4.0% | 0.52 / 5.82 | 19.275 | 0.6% | 0 | -0.81 | 31.1 / 89.4 | 5.7 |
| light | 1039 | 1210.38 | 0.000 | 0.000 | 0.0% | 0.20 / 2.72 | 1.603 | 1.4% | 0 | -0.80 | 6.4 / 89.3 | 4.8 |
| mid | 40 | 44.46 | 0.000 | 0.000 | 0.0% | 0.14 / 1.88 | 1.603 | 1.0% | 0 | -0.45 | 16.5 / 89.8 | 3.4 |
| frigate | 796 | 1250.62 | 0.000 | 0.000 | 0.0% | 0.02 / 0.39 | 0.335 | 1.7% | 0 | -0.83 | 1.1 / 61.7 | 6.9 |
| hero | 105 | 111.33 | 0.000 | 0.000 | 0.0% | 0.48 / 5.56 | 9.016 | 1.2% | 0 | -0.70 | 4.2 / 87.4 | 5.6 |
| capital | 490 | 640.93 | 0.000 | 0.000 | 0.0% | 0.01 / 0.06 | 0.050 | 35.2% | 0 | -0.64 | 1.8 / 81.8 | 6.1 |
| leviathan | 112 | 144.84 | 0.000 | 0.000 | 0.0% | 0.01 / 0.08 | 0.038 | 30.0% | 0 | -0.62 | 1.4 / 80.0 | 9.3 |
