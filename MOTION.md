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
