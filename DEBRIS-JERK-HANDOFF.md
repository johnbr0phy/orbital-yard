# Debris jerk — handoff notes (2026-08-28)

**Status: ROOT CAUSE FOUND, FIX APPLIED (2026-08-28, later session) — awaiting
user confirmation in the browser.**

An adversarial Codex review found what every attempt below missed: the
wreck-wreck collision pass did **full positional depenetration in a single
tick** (`w.x+=dx*pen` with `pen=(rb-d)/d*0.5` moves the pair apart by the
entire overlap at once). Same-ship siblings are born overlapping, so the
moment the 2.4 s birth grace expired the whole cluster teleported —
**measured at up to 367 units in one tick at piece age 2.42 s** by a headless
A/B harness that runs the real `startWar/simStep/collide` in node and tracks
`|Δpos − v·dt|` per tick. Every earlier "proved smooth" number tracked only
per-tick |Δv|, which cannot see a direct x/y/z mutation — that was the blind
spot behind six failed fixes.

The fix (working tree, on top of `7b89fb0`):
1. Fragments carry `src:s.id`; wreck-wreck pairs from the same ship skip
   collision entirely (they were born overlapping and are already parting).
2. Depenetration is now 22% of half-overlap per pass, capped at 0.9 u, and
   scaled by a ramp easing in over 1.2 s after the 2.4 s grace.
3. Momentum blend 0.55 → 0.16·ramp; separation impulse 1.5 → 1.2·ramp; spin
   damping 0.85 → (1−0.05·ramp).
4. Wreck tumble accumulates `w.ang += w.spin*dt` on the clamped sim clock
   (render + settleWreck use `w.ang`), ending the wall-clock/sim-dt desync.

A second adversarial Codex pass over the applied patch found the same
hard-cliff class in two more places, now also fixed:
5. The wreck-wreck **chip/shatter** trigger fired un-ramped at grace expiry
   (`rel>22`) — the likely source of the "pieces disappear" reports. Now
   `rel*ramp>22`.
6. The **ship-vs-wreck ram** (1.8 s grace) had no ramp at all — a squadmate
   overlapping a fresh piece at expiry delivered a full impulse + spin kick
   + instant chip. Now eased by `ramW=min(1,(age-1.8)/1.0)` on impulse,
   spin, and chip threshold (raised 14→18, double-chip 30→34); fragments
   with r>10 get +1 integ so crown pieces survive traffic longer.
   Steady-state depenetration raised to 30% of half-overlap per pass
   (cap 0.9 u) so unrelated debris doesn't linger interpenetrated.

A third Codex pass verified those edits and flagged the last residuals,
also fixed:
7. Ram impulses were still discrete 0.3 s samples (a sizable one-frame
   velocity step at high closing speed). The shove is now **continuous** —
   a small kick every contact tick (`appr*0.12*ramW` at ~25 Hz ≈ the same
   momentum flow as the old `0.9` per 0.3 s), with the chip check keeping
   the 0.3 s throttle.
8. The ship's own bump damage/flash fired un-ramped at grace expiry — now
   gated on `ramW>0.3`.
9. The 600-piece budget converted ALL excess wrecks to dust in one frame
   during massacres — now staggered at ≤3 per frame.

Final measurements (0–6 s window, crown killed mid-traffic): max positional
snap **0.000** (pre-fix 367), max single-tick |Δv| **4.6 u/s** (pre-fix
50–100+, and below the 7.2 that once counted as "SMOOTH"), first crumble at
3.3 s as a momentum-carrying dust burst (pre-fix 2.46 s, half the cluster
by 4 s). The same fixes are in `armada-war-5.html` (the five-race page).

Housekeeping noted by the review, deliberately not touched: `settleWreck()`
is dead code, and the worker `kind:"wreck"` path + its `onWorkerMsg` receiver
are unreachable leftovers of the pre-`e1ee5e2` async carve — safe to delete
some day; nothing sets `src`/`ang` there because nothing runs it.

Everything below is the original record, kept for history.

## The symptom (user's words, across several reports)

- "when a frigate dies … they explode - break apart - disappear then reappear"
- "debris explode then stop dead"
- "the parts seem to jerk and not act correctly"
- **"pieces suddenly jerk after they have been broken up for about 0.5 seconds"**
- Final state: "it didn't work" — after all fixes below.

## Architecture as it now stands (all in `armada-war.html`)

- Every ship's breakup is **pre-carved at forge time**: the worker batch job
  (inside the `WORKER_MAIN` template string) slices `ship.parts` into 2–6
  fragments (12 for crowns), packs each mesh recentered on its own centroid,
  and ships them in the batch reply. Stored as `s.fragData`.
- `kill()` → `boom()` (visual) → `spawnBreakup(s,now)` → hull vao deleted
  same frame. `spawnBreakup` creates GPU buffers for each fragment and pushes
  records into `wrecks[]` with: position = death pose · offset (rotation-
  corrected via Rodrigues of `s.dax/s.dang`), velocity = ship linear velocity
  + tangential (ω×r from `s.yawV`) + gentle radial `outw` (~6–16 u/s)
  + small noise; orientation base `bax/bang` = death pose; own tumble axis
  biased to hull's, rate ~hull's.
- Wreck update+draw live in `frame()` (the wreck loop): no drag, speed floor
  1.2, `life` 32–48 s then `shatter` (→ `dustBurst` inheriting velocity),
  `integ` 2–3 chip counter.
- Collisions in `collide(now)` (called `if(simFrame&1)` = 25 Hz):
  - ship-vs-wreck: **birth grace `now-o.t0<1.8` skip**, then impulse-based
    ram (closing-velocity `appr`, ADDED to velocity, chip if `appr>14`).
  - wreck-vs-wreck (gated `(simFrame&3)===1` = 12.5 Hz): **birth grace 2.4 s**,
    then positional separation + momentum blend
    `v += (avg-v)*0.55` per contact-tick + chip if `rel>22`.
- Wrecks render with `uRot = xQAA(bax,bang, ax, spin*(now - w.t0))` — note
  **wall-clock** `now`, while positions integrate the **dt-clamped** sim.

## Everything tried, in order (commit hashes)

1. `8978f8f` — settle→boneyard gap: settling pieces froze invisible ≤3 s until
   the merged chunk baked. Fixed with frozen stand-ins until bake.
2. `85cfb23` — removed 90%-instant-stop collision damping and the whole
   settle/freeze path from live flow; chip/crumble (integ) model; pieces end
   as velocity-carrying dust, never statues.
3. `f449cee` — corpse continuity: dead hull kept drawing until fragments
   arrived from the (then-async) worker carve.
4. `a969e4d` — rigid-body-honest swap: fragment offsets rotated through the
   corpse's accumulated rotation; tangential ω×r velractically; gentle
   radial expansion instead of violent isotropic throw.
5. `e1ee5e2` — **architecture change**: fragments pre-carved at forge; death
   is a same-frame hull→pieces swap; no async, no corpse. dustFrac at death=0.
6. `7b89fb0` — the "0.5 s" lead: ship-vs-wreck ramming had no birth grace and
   ASSIGNED (overwrote) piece velocity. Now: 1.8 s grace + additive impulse.

## The measurement that said "smooth" — and its blind spot

Instrumented in-browser: killed a >90 m ship mid-traffic, then for **100 sim
ticks (2.0 s)** tracked max single-tick |Δv| across its pieces → **7.2 u/s**
("SMOOTH"; pre-fix overwrites were 50–100+).

**BLIND SPOT: the window ended at 2.0 s — before the wreck-wreck birth grace
expires at 2.4 s.** At 2.4 s, overlapping cluster pieces suddenly become
mutually collidable and the 0.55-per-contact-tick momentum blend fires at
12.5 Hz on pieces that are often still near each other → plausibly a visible
cluster-wide "clump snap" that the measurement never saw. **Measure 0–6 s.**

## Prioritized leads for the next attempt

1. **Grace-expiry snap (wreck-wreck)**: `v += (avg-v)*0.55` per contact-tick
   at 12.5 Hz is a huge step. Make it rate-based (`*dt*k`, k≈2–4), and/or ramp
   the grace off smoothly, and/or exempt same-ship siblings entirely (they
   were born overlapping; tag fragments with their ship id and never bang
   siblings — physically defensible, they're already separating).
2. **Wall-clock vs sim-dt desync in the tumble**: rotation uses
   `spin*(now-w.t0)` (real time) while position uses clamped `dt` sums. Any
   frame hitch (death frame does 2–6 synchronous GPU uploads + boom + dust
   allocations!) makes rotation lurch ahead of position → rotational jerk
   right after breakup. Fix: accumulate `w.ang += w.spin*dt` in the update
   loop instead of deriving from wall clock. Same pattern exists for corpse
   (gone) and boneyard drift (`b.dvx*(now-b.t0)`) — boneyard is dormant now.
3. **Measure the RENDERED motion, not sim velocity**: project piece positions
   to screen space on real rAF frames and diff per-frame screen deltas; the
   user sees pixels, not vx. (Sim-side smoothness has now been "proven" twice
   while the user still sees jerks — trust pixels.)
4. **Confirm the user is on the fresh build**: GH Pages CDN caches ~10 min and
   several "still broken" reports likely tested stale builds. Add a visible
   build stamp (e.g. commit short-hash in the stat line) so screenshots
   self-identify. Cache-bust with `?v=N` when testing.
5. Chips → `shatter` still convert pieces to dust on hard knocks (rel>22 /
   appr>14, integ 2–3). If the user's "disappear" persists, raise thresholds
   or make crumble a visible multi-stage (piece → 2 flashes + dust over 0.5 s).

## How to test (hard-won mechanics)

- `python3 -m http.server 8741` in the repo; open
  `http://localhost:8741/armada-war.html?v=N` (ALWAYS bump N — Chrome caches).
- The game pauses when the window is hidden (rAF). Drive synthetically via
  the js console in ≤300-tick chunks: `for(let i=0;i<300;i++)simStep(warT0+5.5+i*0.02,0.02)`
  then `frame(performance.now())` to force one render before a screenshot.
  Note: wreck POSITION updates happen in `frame()`, not `simStep()`.
- Jerk metric snippet (extend window to 300 ticks / 6 s!): kill a ship, snap
  `{vx,vy,vz}` per new wreck, run ticks, track max per-tick |Δv|. For lead 3,
  instead run real rAF frames and diff projected screen positions.
- Headless balance harness: `scratchpad/verify.js` pattern — slices the page
  at `//__ARMADA_WORKER_CUT__` + the `/* ==== the war ==== */`…`stars` section
  + the WORKER_MAIN mega text, evals with gl/document stubs (needs
  `makeCelestial(){}` stub), runs 4 wars ~35 s each.
- Repo state at handoff: clean, HEAD `7b89fb0`, deployed to GH Pages
  (johnbr0phy.github.io/orbital-yard/armada-war.html).
