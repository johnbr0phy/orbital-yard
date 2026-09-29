# Motion summary: final

56 runs. 2026-09-29T14:50:12.383Z

| criterion | target | measured | result |
|---|---|---|---|
| Reversals, gunboats and capitals (every fleet), per ship-minute | 0 | 0 in 2046 ship-min; worst none | PASS |
| Reversals, any class in any fleet, per ship-minute | < 0.2 | worst Shadows fighter 0.069; overall 0.004 | PASS |
| Shuttle: worst share of any 10 s window, any ship | <= 5% | 12.0%; 17 ships over 5% | FAIL |
| p95 angular jerk per class (rad/s^3), at or below baseline | <= baseline | leviathan 0.38 -> 0.09; capital 0.32 -> 0.06; light 9.02 -> 2.79; fighter 11.89 -> 5.69; hero 11.89 -> 5.43; frigate 10.84 -> 0.39; mid 13.03 -> 1.33 | PASS |
| p95 angular jerk, frigates | <= 50% of baseline | 10.84 -> 0.39 (4%) | PASS |
| Spinning in place, hulls of 80 m or longer (events) | 0 | 0 (0.0 s) | PASS |
| Speed holds of 5 s or more, small and mid-size craft | <= 10% | fighter 0.7%; light 2.5%; mid 7.0%; frigate 1.6%; hero 1.9% | PASS |
| Capitals: max turn rate, acceleration and braking against the hull's limits; reversals | <= 1.05x each; 0 reversals | turn 1.00x, accel 1.00x, brake 1.00x; 0 reversals | PASS |
| Squadron cohesion inside the band, share of squad-time outside dogfights and routs | >= 80% overall and in every fleet | 70.0% overall; worst Minbari 24.4% (parade 0%, dissolved 64%) | FAIL |
| Squadmates' motion signatures: smallest pairwise distance in any squad (feature sd units) | >= 0.25 in every squad | min 0.084, median squad min 0.381; 159 of 915 squads below | FAIL |
| Fleet from motion alone: held-out accuracy (per-class models, ship identity hidden) | >= 3x chance and >= baseline +15 points and 1.5x baseline | 42.3% vs chance 5.6% (7.56x); baseline 24.6% | PASS |

| class | ships | ship-min | reversals/min | strict/min | shuttle max | ang jerk p50 / p95 | lin jerk/L p95 | holds | spins >=80 m | bank~rate r | overshoot p50/p90 deg | settle p50 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fighter | 4074 | 4224.36 | 0.007 | 0.000 | 12.0% | 0.53 / 5.69 | 18.836 | 0.7% | 0 | -0.81 | 27.1 / 89.5 | 5.6 |
| light | 1039 | 1234.95 | 0.001 | 0.000 | 12.0% | 0.20 / 2.79 | 1.531 | 2.5% | 0 | -0.80 | 3.9 / 88.8 | 4.9 |
| mid | 40 | 47.91 | 0.000 | 0.000 | 0.0% | 0.13 / 1.33 | 1.567 | 7.0% | 0 | -0.48 | 5.0 / 88.9 | 3.4 |
| frigate | 796 | 1254.18 | 0.000 | 0.000 | 0.0% | 0.02 / 0.39 | 0.327 | 1.6% | 0 | -0.84 | 0.4 / 60.5 | 7.4 |
| hero | 105 | 119.73 | 0.000 | 0.000 | 0.0% | 0.50 / 5.43 | 8.810 | 1.9% | 0 | -0.71 | 1.5 / 89.4 | 6.1 |
| capital | 490 | 648 | 0.000 | 0.000 | 8.0% | 0.01 / 0.06 | 0.051 | 33.3% | 0 | -0.64 | 1.9 / 83.8 | 6.5 |
| leviathan | 112 | 149.03 | 0.000 | 0.000 | 2.0% | 0.01 / 0.09 | 0.042 | 26.8% | 0 | -0.61 | 12.9 / 86.8 | 6.9 |
