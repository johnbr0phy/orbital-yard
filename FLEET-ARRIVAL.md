# Arrival movement across all fleets

This follows John's report that arrival problems affect every race, after PR #19
was merged. The previous changes were shared by all fleets, but their detailed
arrival regression focused on Tyranids. This pass measures all 23 fleets.

## Shared causes and changes

- Heavy capitals used a multiple of their deliberately slow combat cruise for
  transit. A real opening-muster Executor covered only 542 m in 60 seconds. Transit
  now also responds to the distance remaining, up to 180 m/s or the hull's normal
  dash if faster. Large ships still take their full 8–30 second spool to accelerate.
  The active drive remains available for smooth braking when the approach ends.
  Class cruise, combat dash, turn and pitch limits are unchanged.
- Traffic avoidance treated a ship's width as vertical height. Two wide, flat
  hulls were sent to passing altitudes of ±1,075 m when ±95 m was sufficient.
  Clearance now uses each oriented hull's actual vertical projection, including
  pitch and bank, plus the existing margin. Collision prediction, opposing passing
  directions, lane commitment and the contact solver remain in place.

Both are shared movement rules. There are no race-specific overrides in this fix.
The traffic change is identical in the native and Three engines.

## Controlled full-wave comparison

Baseline: main at 574b6ee, after #19 and #17. Each run starts Rebels versus Empire,
seed 42, 24 original ships per side. At time 30, two surviving Rebels request the
selected ally with a muster setting of 150. Each wave runs for another 60 seconds.
All 2,536 generated reinforcements arrive in both versions.

The activity count is ships with `lastFire > 30`, including ion charges. It counts
ships, not shots. One seed is not a fleet-balance average, and a lower count may
reflect different casualties or targets. Both decreases are retained below.

| Fleet | Arrivals | Fire activity before | Fire activity after |
| --- | ---: | ---: | ---: |
| Yard | 151 | 65 | 98 |
| Shoal | 151 | 72 | 89 |
| Lattice | 144 | 45 | 101 |
| Drift | 151 | 57 | 99 |
| Choir | 129 | 55 | 101 |
| Empire | 151 | 66 | 99 |
| Rebels | 136 | 76 | 99 |
| Minbari | 129 | 56 | 72 |
| Shadows | 33 | 28 | 29 |
| EarthForce | 144 | 63 | 83 |
| Federation | 69 | 46 | 57 |
| Klingons | 121 | 61 | 85 |
| Borg | 49 | 34 | 30 |
| Mondoshawan | 114 | 10 | 56 |
| USCM | 136 | 80 | 92 |
| Engineers | 121 | 52 | 84 |
| Yautja | 136 | 62 | 83 |
| First Ones | 8 | 4 | 4 |
| Romulans | 73 | 34 | 43 |
| Dominion | 49 | 25 | 23 |
| Space Marines | 84 | 14 | 29 |
| Tyranids | 121 | 47 | 50 |
| Tesla | 136 | 92 | 107 |
| Total | 2,536 | 1,144 | 1,613 |

The baseline did not reproduce a completely frozen fleet in this seed. It did
show slow heavy-ship progress and excessive traffic detours. The opening-muster
Executor now covers 3,283 m in the same 60 seconds, versus 542 m before. Its combat
cruise and dash remain 3.92 and 4.23 m/s; the extra speed is an approach burn.

## Reproduction and limits

`scripts/arrival-progress.cjs` runs the real forge, minds, movement, collision and
weapon simulation with inert DOM/WebGL calls. For example:

```sh
node scripts/arrival-progress.cjs 5 150 60 42
node scripts/arrival-progress.cjs 5 48 60 42 --normal
node scripts/arrival-progress.cjs 21 150 60 42 --three
```

Run the first command for race IDs 0 through 22 for the relief sweep. The JSON
contains sampled per-ship movement, traffic, goals and firing activity. Summary
results are committed in `bench/arrival-progress/all-fleets.json`. `--normal`
measures the selected fleet's opening muster rather than requesting relief.

The new `all-fleet-motion.test.cjs` exercises a real capital from every fleet in
both engines: approach progress, thrust limits, smooth braking and unchanged combat
engines. It also covers wide flat hulls and vertical clearance when banked. All
50 new checks pass. The old code fails the Empire and Space Marine approach tests
and the flat-hull passing test in both engines.

Another 76 regression tests pass across battle AI, battle spectacle, destroyer
motion, throttle feedback, motion, reinforcements, relief movement, traffic,
Tyranid behaviour and Three parity: 126 tests total. This includes seeded
determinism, 30/120 render-rate parity, hull contact, 600-ship arrival clearance,
and the existing turning, acceleration, jerk and shuttling checks. Changed
JavaScript parses and `git diff --check` passes.

The longer renderer comparison exposed a test-harness mismatch: Three treated
its simplified box meshes as solid self-obstructions, while the native harness
already excluded those artificial gun barriers. Three now uses the same optional
modules and box-mesh policy. Actual hull-ray geometry remains covered separately.
After aligning the harnesses, the entire 60-second Empire relief audit matches
exactly between native and Three engines, including every sampled ship state.
The 28 affected Three checks were rerun and pass.

Browser/GPU visuals have not been verified. This is not an exact replay of the
reported battle, a full fleet-balance matrix, or a claim that every motion issue
has been eliminated. These shared movement changes can alter battle outcomes.
