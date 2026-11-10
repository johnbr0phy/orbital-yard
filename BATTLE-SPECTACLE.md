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

## Make it a war (November 9)

John's ask: the ships do not act like ships and the battle is boring; it
should feel like a real war, with speed, explosions and tension. A headless
probe of Empire v Rebels (seed 77, 50 a side) showed why: 35 seconds before
the first shot, 5 to 25 bolts in the air across 100 ships, and a Star
Destroyer firing about one bolt a second.

- **Fleets start in gun range.** `MUSTER_GAP` is 2,400 m nose to nose (was
  4,800 m, and 5,400 m or more whenever a super-capital was present, because
  the gap scaled with the longest hull). First shots land at about 15 s
  instead of 35 s.
- **Secondary batteries.** Every hull of 60 m or more fires a rolling stream
  of light bolts from the mounts facing the enemy (`batteryFire`): 1.2 a
  second for a corvette up to 14 a second for a destroyer. Bolts are real
  projectiles with 0.04 damage and loose aim, so flak mostly misses fighters
  and capitals wear each other down faster. A shared 900-bolt budget bounds
  cost. Named main guns, turrets and lances are unchanged. Bolts in flight in
  the fixture went from about 20 to 60 to 85.
- **Linked fighter guns.** A fixed-gun fighter fires its barrel pair together
  and the two bolts share the old single bolt's damage.
- **Explosions.** Deaths get a hot lobed fireball sized to the hull, ember
  streaks, and for anything over 60 m a chain of secondary blasts along the
  keel for up to 2.6 s. The fire travels with the wreck. Hull breakup is
  unchanged and there is still no clean shockwave ring. Fireballs (flash
  kind 2) are brighter, last 1.25 s and may fill the frame.
- **Camera shake.** A blast shakes the view by how large it looks from the
  camera, in every mode including Action. It is applied to the view for the
  frame only and is off under reduced motion and in replays.
- **Brighter bolts, drive trails.** Bolts are wider and longer on screen.
  Small craft (60 m or less) drag about a second of pale exhaust ribbon.
- **Faster director.** Shots hold 5 to 8 s (were 8 to 13 s), a quiet shot is
  dropped after 3.5 s, wide resets come every 40 s and captain cutaways
  about once a minute.

The Three.js page was regenerated and its effects carry the same fireball,
bolt and trail changes.

Expect different outcomes for every seed: wars start sooner and finish
sooner (objective wars in the sample ended in 46 to 100 s, down from 70 to
180 s). Four fixtures were repinned for that: two objective seeds in
story-guarantees, the wreck-strike fixture (the wreck now stands clear of the
melee), the replay pin count (at least one) and the linked-bolt counts in
weapons. `massacre.test.cjs` test 3 already fails on main and still does.
Not rerun: `fleet-balance.cjs`, the MOTION.md acceptance sweep and the story
metrics. No real GPU was available; frames were checked in software-rendered
Chromium.

## Frigates and corvettes brawl (November 9, follow-up)

Mid-size ships (80 m and up, single hull: frigates, corvettes, gunships,
transports) used to patrol behind the fighters and hold a stand-off orbit.
They now fight in the melee.

- **Temper.** Their pilots weight ATTACK up and ESCORT / REGROUP down, and
  prefer marks of 60 m or more, capitals included.
- **The brawl pass** (`brawlPass` in `armada-battle-ai-new.js`). Instead of
  orbiting, the ship runs down its mark's flank, over or under the hull,
  carries through to open the range (at least 420 m or four hull lengths),
  then comes about on the helm's own turning circle and runs in from the
  other side. The line is fixed when the pass starts.
- **No waiting for a contact.** A brawler with nothing on its own sensors
  heads for the nearest enemy hull within 3.6 km instead of loitering on a
  search point. Posture and convoy orders still hold.
- **Columns break.** Inside 900 m of its mark a frigate leaves its column and
  fights its own fight.
- **Pace.** Single hulls between 95 m and 320 m cruise and dash 1.8 times
  faster, and a pass is flown at 92% of dash rather than matched to the
  mark's speed. Median speed on a pass in the fixture is 44 m/s.

In the Empire v Rebels fixture (seed 77, 50 a side) the share of mid-size
ships within 900 m of an enemy at 60 s went from 5 of 18 on the old patrol
to 14 of 16. Sampled at 2 Hz over 14.5 ship-minutes, no brawler swung more
than 120 degrees and back within 12 s.
