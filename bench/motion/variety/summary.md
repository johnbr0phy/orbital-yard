# Motion summary: variety

56 runs. 2026-09-30T20:55:05.656Z

| criterion | target | measured | result |
|---|---|---|---|
| Reversals, gunboats and capitals (every fleet), per ship-minute | 0 | 0 in 2123 ship-min; worst none | PASS |
| Reversals, any class in any fleet, per ship-minute | < 0.2 | worst Shadows fighter 0.024; overall 0.001 | PASS |
| Shuttle: worst share of any 10 s window, any ship | <= 5% | 4.0%; 0 ships over 5% | PASS |
| p95 angular jerk per class (rad/s^3), at or below baseline | <= baseline | leviathan 0.38 -> 0.07; capital 0.32 -> 0.07; light 9.02 -> 2.85; frigate 10.84 -> 0.37; fighter 11.89 -> 5.82; hero 11.89 -> 4.95; mid 13.03 -> 1.36 | PASS |
| p95 angular jerk, frigates | <= 50% of baseline | 10.84 -> 0.37 (3%) | PASS |
| Spinning in place, hulls of 80 m or longer (events) | 0 | 0 (0.0 s) | PASS |
| Speed holds of 5 s or more, small and mid-size craft | <= 10% | fighter 0.6%; light 1.1%; mid 1.7%; frigate 2.2%; hero 1.3% | PASS |
| Capitals: max turn rate, acceleration and braking against the hull's limits; reversals | <= 1.05x each; 0 reversals | turn 1.00x, accel 1.00x, brake 1.00x; 0 reversals | PASS |
| Squadron cohesion inside the band, share of squad-time outside dogfights and routs | >= 80% overall and in every fleet | 70.5% overall; worst Minbari 21.7% (parade 0%, dissolved 72%) | FAIL |
| Squadmates' motion signatures: smallest pairwise distance in any squad (feature sd units) | >= 0.25 in every squad | min 0.087, median squad min 0.391; 153 of 915 squads below | FAIL |
| Fleet from motion alone: held-out accuracy (per-class models, ship identity hidden) | >= 3x chance and >= baseline +15 points and 1.5x baseline | 40.0% vs chance 5.4% (7.38x); baseline 24.6% | PASS |

| class | ships | ship-min | reversals/min | strict/min | shuttle max | ang jerk p50 / p95 | lin jerk/L p95 | holds | spins >=80 m | bank~rate r | overshoot p50/p90 deg | settle p50 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fighter | 4063 | 4195.54 | 0.001 | 0.000 | 4.0% | 0.51 / 5.82 | 18.836 | 0.6% | 0 | -0.81 | 30.8 / 89.5 | 5.6 |
| light | 991 | 1170.47 | 0.000 | 0.000 | 0.0% | 0.21 / 2.85 | 1.641 | 1.1% | 0 | -0.81 | 1.9 / 89.0 | 5.4 |
| mid | 46 | 54.65 | 0.000 | 0.000 | 0.0% | 0.05 / 1.36 | 1.531 | 1.7% | 0 | -0.40 | 19.9 / 89.7 | 3.9 |
| frigate | 829 | 1322.93 | 0.000 | 0.000 | 0.0% | 0.02 / 0.37 | 0.305 | 2.2% | 0 | -0.82 | 0.7 / 66.5 | 6.5 |
| hero | 105 | 110.64 | 0.000 | 0.000 | 0.0% | 0.48 / 4.95 | 7.852 | 1.3% | 0 | -0.70 | 0.0 / 66.7 | 8.9 |
| capital | 510 | 659.3 | 0.000 | 0.000 | 0.0% | 0.01 / 0.07 | 0.051 | 35.3% | 0 | -0.69 | 2.2 / 88.5 | 5.9 |
| leviathan | 112 | 148.25 | 0.000 | 0.000 | 0.0% | 0.01 / 0.07 | 0.040 | 27.3% | 0 | -0.62 | 2.6 / 90.0 | 7.3 |
