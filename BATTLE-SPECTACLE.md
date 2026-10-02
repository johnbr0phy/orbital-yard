# Keep the war fighting

This pass follows John's October 1, 2026 request: relief ships should join the
fight, losing fleets should stay on screen, guns should be busier, ion columns
should destroy intervening friendly and enemy ships, and deaths should show
fast orange hull breakup instead of circular explosion sprites.

## Changes

- Relief arrives in shallow flight rows and depth-separated waves. The existing
  world, hull and jump-corridor clearance checks still decide whether a berth is
  safe. Each arrival closes to weapons range before accepting formation slots or
  the original fleet's HOLD orders. Capital relief can use its transit burn.
- Routed squadrons fall back about 650 metres, then rally after 8 to 14 seconds.
  An 18-second recovery interval prevents immediately routing again. Objective
  results do not evacuate surviving combatants. Raiders fly their flank instead
  of disappearing and teleporting. Explicit convoy delivery still works.
- Normal energy fire cycles 30% faster in cooldown time, with per-shot damage
  multiplied by 0.7. Escort engagement ranges now reach their stand-off distance.
  Shared special-weapon cooldowns also advance faster, so this changes balance.
- Ion discharge tests the finite muzzle-to-impact segment against oriented hull
  envelopes. Every intersecting active hull breaks up, regardless of allegiance,
  armour or class. Ships entering the column during its 1.55-second discharge are
  also hit. Near misses receive stronger splash damage. Arrival grace remains.
  Friendly kills do not increase the shooter's kill count.
- The ion muzzle remains illuminated throughout discharge. The ticker names the
  firing ship and its intended target. The fixed impact point is not a homing shot.
- Combat deaths and abandoned hulls use catastrophic mesh breakup. Fragment
  separation speed is 2.5 times its former value. Small orange thermal ruptures
  replace the old fleet-dependent death blooms and circular shockwaves. The
  Three renderer now carries fracture-edge heat as well as the native renderer.
- Fresh deaths recycle old debris when necessary instead of becoming dust-only
  pops. The existing 64 queued / 192 total pieces and four uploads per simulation
  step remain. When fewer pieces fit, the full hull is repartitioned rather than
  truncating its panel list. Explicit disabled-hull fixtures remain supported.

These changes intentionally supersede the earlier escape and random disabled
hull defaults described in BATTLE-AI-NEW.md and DEBRIS-NEW.md. They are a focused
battle presentation pass, not a new pilot personality model.

## Measured comparison

The regression fixture in `tests/tribute-new/battle-spectacle.test.cjs` uses
Rebels versus Empire, seed 42, 24 per side and Rebel relief. At time 30 it reduces
the requesting side to two survivors, launches relief and runs another 45 seconds.

| Measurement | Main at 8233d9a | This change |
| --- | ---: | ---: |
| Relief ships arriving | 25 | 25 |
| Relief ships that fired within 45 seconds | 0 | 11 |
| Successful ordinary energy discharges across the fixture | 0 | 162 |
| Combatants jumping out | 0 | 0 |

This is a controlled regression scenario, not a fleet-balance or average battle
result. Enemy movement means distance to the original relief waypoint is not a
useful engagement score.

## Verification

101 distinct tests pass across the following suites, run serially within each
Node test invocation:

- 73: story, replay, weapons, debris, reinforcements, ion charge and Three parity.
- 11: battle AI, including repeated-seed determinism and 30/120 render-rate parity.
- 10: new spectacle regressions and Three fragment-edge/heat lifecycle.
- 7: motion and Three geometry storage.

Arrival checks include 600-ship muster settings. The motion suite covers its
existing reversal, shuttle, jerk and capital acceleration fixtures. The full
MOTION.md acceptance sweep and fleet-balance matrix were not rerun. All changed
JavaScript parses and `git diff --check` passes.

## Review still needed

No real browser/GPU visual verification was possible in this environment: the
browser binary was absent and its download failed. Open the proposed PR as a
draft for that reason. Review a relief arrival, an ion shot through both sides,
and a capital breakup in both renderers before merging. The tests establish simulation
behaviour and render data, not cinematic quality or sustained 600-a-side FPS.

Expect different battle outcomes from lethal ion paths, longer engagement ranges,
faster special cooldowns and the removal of combat withdrawals. Under heavy
destruction, older debris is recycled sooner to keep new deaths visible.

## Tyranid relief follow-up (October 2)

John reported a Tyranid wave arriving and appearing to stay parked. Two movement
problems remained after the original pass:

- Escort approach demand was still clamped to combat dash by the throttle, and
  acceleration still used the combat drive. Relief now carries its approach drive
  through both layers, using the destination's effective mode instead of an old
  HOLD action. The added burn is capped at 180 m/s (or the class's existing dash,
  if faster), decreases with the remaining approach, and uses the normal spool
  and jerk limits. Contact ends the approach and brakes back to combat pace.
- A capital touching a rock could be braked every tick until its speed-dependent
  turning limit prevented it from escaping. Capitals now use the existing bounded
  escape helm and steer out along the surface. Terrain contact still blocks entry,
  and capital pitch remains limited.

The native and Three engines share the escort fix. Class cruise/dash values are
unchanged; the extra escort drive is restricted to inbound relief.

The full-wave fixture uses Rebels versus Empire, seed 42, 24 original ships per
side and a 150-ship Tyranid relief muster. At time 30 it reduces the requesting
side to two survivors. All 121 generated relief ships arrive in both versions.

| Measurement after 60 seconds | Main at 86ca47b | Follow-up |
| --- | ---: | ---: |
| Relief ships that have fired | 25 | 47 |
| Non-hero escorts over 100 m that have fired | 0 of 31 | 15 of 31 |

By 90 seconds, 82 of 121 relief ships have fired, including 25 of 31 escorts.
The isolated escort approach covers 2,457 metres in 20 seconds in both engines,
up from 466 metres, then returns smoothly to its original combat pace.

An isolated bio-cruiser pressed against a rock moves 0.3 metres in 35 seconds on
the old code, versus 255 metres with the fix. By 45 seconds it has 110 metres of
clearance and is moving at 35 m/s. These are deterministic simulation fixtures,
not an exact replay of the reported image or an average fleet-balance result.

`tests/tribute-new/relief-motion.test.cjs` covers the escort approach in both
engines, smooth return to combat pace, capital terrain escape, and a real relief
wave continuing into firing range. Browser/GPU visual review is still needed.

Follow-up verification passes 68 tests across relief motion, reinforcements,
traffic, motion, throttle feedback, Tyranid fleet behaviour, battle spectacle,
battle AI and Three parity. This includes 600-ship arrival clearance, repeatable
battles, 30/120 render-rate parity and the existing capital motion limits.
Changed JavaScript parses and `git diff --check` passes.
