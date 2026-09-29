# Tribute War: how the ships fly

This file measures motion quality: whether ships commit to lines, whether squadrons breathe, whether capitals have weight, and whether you can tell the fleets apart from motion alone. The brief is `MOTION-BRIEF.md`. The numbers come from `scripts/motion-report.cjs` (headless, the page's real simulation) unless a row says otherwise. Clips and their logs come from `scripts/motion-capture.cjs` (Chromium).

## Pass criteria

I wrote these before changing a line of the flight code. The brief set the targets. Where it asked me to define a band or a threshold, I fixed it here first and then measured the baseline against it.

<!-- CRITERIA-TABLE -->

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

1. **Baseline on main (7f82d45).** Nine of ten motion criteria fail. Rebel frigates reverse and shuttle on their hold points (see above); classifier 24.6%; frigate p95 angular jerk 10.84 rad/s³.
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
