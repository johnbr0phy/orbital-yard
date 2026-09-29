# Motion summary: baseline

56 runs. 2026-09-29T01:23:22.496Z

| criterion | target | measured | result |
|---|---|---|---|
| Reversals, gunboats and capitals (every fleet), per ship-minute | 0 | 13 in 1972 ship-min; worst Yautja frigate 0.079, Federation frigate 0.036, Empire frigate 0.022 | FAIL |
| Reversals, any class in any fleet, per ship-minute | < 0.2 | worst Tesla hero 1.679; overall 0.212; 38 fleet-classes at or over 0.2 | FAIL |
| Shuttle: worst share of any 10 s window, any ship | <= 5% | 88.0%; 324 ships over 5% | FAIL |
| p95 angular jerk per class (rad/s^3) | baseline | leviathan 0.38; capital 0.32; light 9.02; fighter 11.89; hero 11.89; frigate 10.84; mid 13.03 | n/a |
| Spinning in place, hulls of 80 m or longer (events) | 0 | 64 (148.8 s) | FAIL |
| Speed holds of 5 s or more, small and mid-size craft | <= 10% | fighter 15.8%; light 23.2%; mid 10.7%; frigate 32.8%; hero 19.7% | FAIL |
| Capitals: max turn rate, acceleration and braking against the hull's limits; reversals | <= 1.05x each; 0 reversals | turn 1.00x, accel 18.26x, brake 465.73x; 0 reversals | FAIL |
| Squadron cohesion inside the band, share of squad-time outside dogfights and routs | >= 80% overall and in every fleet | 43.2% overall; worst Minbari 12.4% (parade 0%, dissolved 74%) | FAIL |
| Squadmates' motion signatures: smallest pairwise distance in any squad (feature sd units) | >= 0.25 in every squad | min 0.032, median squad min 0.363; 202 of 915 squads below | FAIL |
| Fleet from motion alone: held-out accuracy (per-class models, ship identity hidden) | >= 3x chance and >= baseline +15 points and 1.5x baseline | 24.6% vs chance 5.6% (4.40x) | n/a |

| class | ships | ship-min | reversals/min | strict/min | shuttle max | ang jerk p50 / p95 | lin jerk/L p95 | holds | spins >=80 m | bank~rate r | overshoot p50/p90 deg | settle p50 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fighter | 4074 | 3280.37 | 0.313 | 0.000 | 88.0% | 0.40 / 11.89 | 28.510 | 15.8% | 0 | -0.91 | 15.1 / 89.4 | 3.3 |
| light | 1039 | 1111.65 | 0.239 | 0.000 | 76.0% | 0.27 / 9.02 | 2.600 | 23.2% | 0 | -0.94 | 6.7 / 89.2 | 3.3 |
| mid | 40 | 47.31 | 0.634 | 0.000 | 8.0% | 0.60 / 13.03 | 2.985 | 10.7% | 20 | -0.96 | 5.7 / 89.6 | 2.9 |
| frigate | 796 | 1204.53 | 0.011 | 0.011 | 58.0% | 0.11 / 10.84 | 0.292 | 32.8% | 10 | -0.94 | 0.0 / 81.7 | 4.4 |
| hero | 105 | 105.97 | 0.462 | 0.000 | 82.0% | 0.45 / 11.89 | 18.836 | 19.7% | 1 | -0.92 | 12.9 / 89.5 | 3.1 |
| capital | 490 | 620.63 | 0.000 | 0.000 | 10.0% | 0.01 / 0.32 | 0.064 | 32.8% | 32 | -0.65 | 4.6 / 85.6 | 6.4 |
| leviathan | 112 | 151.89 | 0.000 | 0.000 | 10.0% | 0.02 / 0.38 | 0.051 | 33.2% | 1 | -0.63 | 26.1 / 89.5 | 6.5 |
