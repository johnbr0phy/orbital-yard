# Motion brief: Tribute War flight and pilot pass

I want you to do a complete end-to-end pass on how the Tribute War's ships fly and think, on your own, and make it look amazing. Not "good for a sim". Amazing, like watching a space battle choreographed by a film's VFX team, where every ship is flown by someone.

I won't be around to answer questions. When something is unclear, make a reasonable call, write it down in DECISIONS.md, and keep going. Run until the /goal condition is true. If a criterion cannot be met, record exactly why with evidence in MOTION.md and keep improving everything else. Never weaken a criterion to make it pass.

Here's the experience I want. When I follow a ship, I can tell who is flying it. An Imperial pilot flies with drilled, aggressive precision. A Rebel flies creatively and loose, breaking formation to help a friend. A Borg vessel moves with cold, unhurried certainty. A Klingon pouncer commits and does not look back. A Minbari hull is composed and exact. Every ship is its own pilot, yet a squadron still reads as a squadron: shared intent, shared heading, a recognisable shape, each member slightly different in timing, spacing and line. Ships move like spaceships: they carry momentum, bank into turns, overshoot and correct, burn to change direction, and never twitch. A frigate commits to a line and holds it. A capital is a slow, heavy thing that takes a long time to turn and a longer time to stop. Nothing rocks back and forth on the spot. Today some Rebel Alliance frigates shuttle back and forth like donkeys and it ruins the aesthetic. That must be gone, and the same failure must be impossible for every other fleet.

## Where it stands today. Read this before you change anything.

* The files. The page is armada-war-tribute-new.html and the fleet minds are armada-battle-ai-new.js. Read BATTLE-AI-NEW.md, BEHAVIOUR.md, WEAPONS-NEW.md, UNIQUENESS-NEW.md, the Doctrine, Morale, Characters, Plans and "Ships now speed up and slow down with the fight" sections of DECISIONS.md, and the descriptions of PRs #4, #5, #6, #10 and #11 first.
* What the minds already do (don't rebuild it, build on it):
   * Every pilot has a stable profile: skill, aggression, courage, discipline, cooperation, creativity, luck, and a weapons/armour/engines split. Fleet profiles are overlapping distributions, not rules.
   * Confidence, fear, contagious fear, shock from watching allies die, fight or flight, posture orders that break under fire, routs, rallies, last stands, rams, aces, vendettas, rescues and tows.
   * Sensors with range, view angle, memory and shared reports.
   * Doctrine per fleet, seeded battle plans that switch when they fail, terrain and objectives.
   * Throttle that answers the fight: chase at full burn, match speed in the pocket, spool time by size (1.5 s fighters up to 30 s leviathans), and a feathered hand on the throttle.
   * A capital controller (turn, climb, attack passes, transit burn), a gunboat role for frigates, corvettes and transports ("patrol and cover the screen, do not dogfight, do not nod"), angular inertia, a hand-weave on the stick, and staggered avoidance altitudes.
   * Station spreads with an independent depth axis. Crown bows cleared from their own screen.
* Why it isn't amazing yet:
   * Some frigates, notably Rebel ones, reverse back and forth instead of flying a line. Suspects, unconfirmed: the gunboat patrol turning around at its ends, throttle feathering with brakes 1.5x stronger than acceleration, a 0.3 s traffic-avoidance offset that flickers on and off, commit timers flipping goals, and patrol waypoints close to the hull's own turning radius. Find the real cause with evidence before changing anything.
   * Nothing measures motion quality. There is no metric for reversals, jerk, spinning in place, how alike squadmates are, or how recognisable a fleet's flying is.
   * Fleet personality mostly lives in decisions (what to do), not in handling (how it flies). Two fleets flying the same manoeuvre look alike.
   * Squadrons either lock too tightly (a parade) or dissolve completely. There's no middle ground of a living formation.
   * Known open issues: tests/tribute-new/fleet-balance.cjs fails "the Executor joins the firing line" on Yard/Shoal, on main too. First One blasts still erase anything smaller than a capital within 1 to 1.6 km.
* Past bugs worth respecting, each with a test or doc note. Keep them fixed:
   * The weave made frigates nod, so gunboats fly a clean track.
   * Small craft stacked in one plane and under the Executor's belly.
   * Squadrons parked on a diagonal X.
   * The Imperial line held while the First Ones picked it apart.
   * Ships held one speed for 5 s or more 22-49% of the time (now 6-10%).
   * The debris jerk, the ion lance floor and the blowout guards, from the no-regressions list.

Record a baseline before you touch a line. Build the motion tooling and scene set below first, run them on today's main, and write the numbers, plots and clips into a new MOTION.md.

## Motion tooling (build this first)

* scripts/motion-report.cjs runs the real page headless, like tests/tribute-new/headless-battle.cjs, logs every ship's position, velocity, heading, throttle, current AI reason and squadron every sim step, and computes per ship, per class, per fleet and per squadron:
   * Reversals: the heading or velocity direction flipping more than 120 degrees and back within 6 s while the ship is not dogfighting, evading an ion zone or colliding. Report them per ship-minute.
   * Shuttle score: the share of a 10 s window a ship spends travelling back and forth over the same ground, from the ratio of net to path displacement.
   * Jerk and angular jerk, as the p50, p95 and max per class and normalised by hull size.
   * Spin in place: yaw rate above a threshold while speed is below 15% of max.
   * Speed holds: time spent at one speed for 5 s or more, so the PR #5 gain stays.
   * Turn physics: bank angle against turn rate, overshoot and settle time after heading changes, and whether acceleration points along the hull (burns) or sideways (sliding).
   * Squadron cohesion: the spread of the members' headings, speeds and spacing against the squad centroid. It must be neither a rigid parade (near zero variance) nor dissolved.
   * Individuality: the pairwise distance between squadmates' motion signatures (turn rate, weave frequency, throttle rhythm, line offset).
   * Fleet signature: a classifier's accuracy at telling fleets apart from motion features alone, with the ships' identity hidden.
* scripts/motion-plot.py draws tracks from above and from the side, heading-over-time traces, per-fleet signature scatter plots and reversal heat maps.
* A scene set, scripted with fixed seeds and camera paths, each recorded with capture-clip.cjs as a WebM and as a motion log:
   1. A Rebel frigate screen, the reported donkey bug, in Empire v Rebels.
   2. A gunboat screen for every fleet that has gunboats.
   3. An Imperial squadron forming, attacking and re-forming.
   4. A Rebel squadron doing the same, to compare against scene 3.
   5. A Borg cube and its escorts closing.
   6. A capital broadside pass, a capital turning 180 degrees, and a capital stopping.
   7. A dogfight between two fighter-heavy fleets.
   8. A rout and a rally.
   9. A holding line breaking under First One fire (the PR #10 scenario).
   10. A full 90-second war in Broadcast at 600 a side, Ultra.
* Run all 23 fleets through a matchup sweep at least as wide as fleet-balance.cjs, so that every fleet's every class flies in at least one measured war.

## Pass criteria, stated before you start

Put them at the top of MOTION.md with baseline and final values:

* Reversals: 0 per ship-minute for gunboats and capitals outside combat manoeuvres, under 0.2 for any class overall, in every fleet.
* Shuttle score: no ship spends more than 5% of any 10 s window shuttling, whatever its fleet or class.
* Jerk: p95 angular jerk per class at or below baseline, and down at least 50% for frigates.
* No spinning in place for hulls of 80 m or longer.
* Speed holds of 5 s or more stay at 10% or less for small and mid-size craft.
* Capitals: turn, speed up and slow down within their spool and turn limits, with no instant reversals.
* Squadron cohesion stays inside a band you define and justify, for 80% of squad-time outside dogfights and routs.
* Squadmates' individuality is above a threshold you define. No two members of a squad share an identical motion signature.
* Fleet signature: a held-out classifier identifies the fleet from motion alone at least 3x chance, and well above baseline.
* Every existing test passes, including the massacre, story-guarantee and determinism tests. Balance winners in fleet-balance.cjs are unchanged, or the change is documented and justified.
* Performance: the per-step AI and movement cost at 600 a side is within 5% of baseline, measured with scripts/sim-bench.cjs.

## Architecture: pilots that fly, not scripts that steer

* Handling per race. Add a handling profile to each fleet in armada-battle-ai-new.js, beside the pilot profile: stick smoothness, bank eagerness, overshoot tolerance, throttle rhythm, preferred attack geometry, formation tightness, how willingly a pilot breaks formation, re-form speed, reaction delay and weave character. Profiles are distributions, and each pilot draws their own values from them. Write a table with a reason for each row in BATTLE-AI-NEW.md. These are game rules, not claims about canon.
* A layered controller for every ship, bottom to top:
   * Physics limits by hull: max thrust, turn rate, angular acceleration and spool, scaled by size and the engines allocation.
   * A pilot filter: reaction delay, smoothing, the hand's weave and bank-into-turn, all drawn from the handling profile.
   * Intent: the goal from the minds, with hysteresis so it can't flip-flop. A new goal must beat the current one by a margin and hold for a minimum time, scaled by hull size, unless an emergency override fires. Log every goal change and its reason.
* Gunboat and frigate lines. Replace any back-and-forth patrol with lines and arcs whose legs are many turning radii long and whose turns are flown as wide banked arcs, never a reversal on the spot. A frigate that must hold a position orbits it or slow-drifts, it doesn't shuttle.
* Living formations. Each squadron has a leader, a shape by doctrine (finger-four, wedge, line abreast, swarm, cluster) and slots with a per-pilot jitter in timing and spacing. Break, attack and re-form are explicit phases. Individuals may peel off for rescues and vendettas, and return.
* Avoidance without flicker. Traffic and debris avoidance must blend in and out over time, not toggle each step.
* Determinism. Motion changes are simulation changes: every new random draw comes from a stream seeded per ship that can't shift anyone else's. Cosmetic randomness never touches the combat stream. Re-record the determinism trace on purpose and say so. scripts/determinism-browser.cjs must pass.

## Constraints

* The ethos: no build step, works from file:// and from GitHub Pages.
* Don't regress the story: routs, last stands, aces, rescues, plans and objectives still happen at the rates in BEHAVIOUR.md, or better. Re-measure with scripts/story-metrics.cjs.
* Don't touch the audio engine's behaviour, beyond passing it the same events.
* Tests: all existing tests keep passing, with new tests for no reversals, no shuttling, jerk limits, goal hysteresis, avoidance blending, formation phases, per-race handling draws, squad individuality and the Rebel frigate donkey scene.

## Verification loops. Don't skip them.

The owner judges by eye, so give him everything he needs to judge.

* Look at every track plot and clip yourself. When something looks wrong, find the cause with evidence first. Don't stack guesses.
* A watch page at design/tribute-new/review/motion/index.html plays each scene's before and after clips side by side, with its track plots and numbers. It must work on GitHub Pages.
* Keep a log in MOTION.md of what worked and what didn't, including approaches you tried and rejected, and why.

## Deliverables

* The upgraded minds and controller, page changes, tooling and tests, committed in small steps and pushed to a new branch off main, with a pull request open when everything is done. Don't merge it.
* BATTLE-AI-NEW.md updated with the handling table and the controller layers.
* MOTION.md with baseline and final numbers for every criterion and scene.
* The scene set with its before/after watch page.
* DECISIONS.md, BEHAVIOUR.md and WRITEUP.md updated, in your own voice: what changed, what didn't work, and what you'd do next.

You're a flight-dynamics programmer, a game-AI designer and an animation director all at once. Spend effort where the eye will feel it: ships that commit to lines, squadrons that breathe, capitals with real weight, and races you can recognise from how they fly. Measure everything, and don't claim a number you didn't measure.

Ask one final question at the end: if someone hides the colours and the hulls and shows only the motion trails, can they tell which fleet is which, which ships fly together, and that no ship is ever lost or dithering? Answer it in MOTION.md with evidence.

Make no mistakes.
