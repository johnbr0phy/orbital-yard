# The Tribute War, as stories: a writeup

This pass had one job: make every war a story. Before it, the minds were busy but the story was flat:
- thousands of evasions per war, but only 5 to 7 kinds of event in the log;
- 26 of 30 test wars still running at the cap;
- three seeds of the same matchup were nearly the same war.

The first thing I built was a way to measure that (`scripts/story-metrics.cjs`, BEHAVIOUR.md). Everything below is checked against it, or against a watch log, a screenshot or a recording.

## What changed

**The fleets have nerves.**
- Every fleet has a doctrine row: when it breaks, whether it runs, how fear spreads through it, what it does when its flagship dies, whether it hunts the broken, whether it rescues. The table and the reasoning for each fleet are in DECISIONS.md, written as game rules. They're my readings, not canon.
- Fear is contagious and weighted by what a pilot saw die and how outnumbered it is. Squadron stress builds into routs.
- Routed ships leave through their own arrival effect in reverse, or run off the edge, and count as withdrawn, not dead. Some rally.
- A flagship's death silences command until a successor takes over, and the HUD's flag moves with it.
- Doomed capitals make a last stand: a ram that resolves through the real collision solver, a full volley, or abandon ship with pods that get picked up or shot.

**There are characters.**
- Small craft that score become aces with callsigns, a ✦ marker and a small edge, and they hunt each other.
- An ace or hero who loses a wingman remembers the killer. That chase is a story shot and a caption until it's settled, or until the hunter dies, at which point the caption is withdrawn.
- Escorts screen crippled capitals, and shuttles and tugs drag disabled hulls home.

**Every war has a shape.**
- Seeded battle plans: pincer, ambush, hold, raid, decapitation, siege. They're on the title card and change mid-war when they fail.
- Seeded terrain from the system generator: rocks and moons block shots and give cover, and a nebula hides cloaks.
- Objectives besides annihilation (flagship, convoy, station) sit on the title card, the HUD, the momentum bar and the end card.

**You can see the minds.**
- A war opens on the Action camera, with Broadcast one key away (B).
- Broadcast holds story shots of 10 to 25 s and comes back to them after interruptions.
- Captions say what the minds are doing and why, straight from their state, one at a time, withdrawn the moment they stop being true.
- Fracture edges glow and cool, dust saturates instead of blowing out, and a fighter that clips a real wreck dies.

**Battle size comes from a measured speed probe, not the GPU tier.** The honest part: on this Xeon the default is 50 a side. 600 a side is always available, and its button says how fast it will run here (about 0.1× real time). Real time at 600 a side would need a CPU about 10× this one on a single thread. DECISIONS.md has the thresholds.

## Two wars back to back

The brief's question: if someone watches two wars back to back, could they describe how the second one was different, and would they want to watch a third?

**Could they tell them apart? Yes, and in plain words.** Take Empire vs Rebels at 60 a side, seeds 1101 and 2202, the first two columns of the side-by-side table in BEHAVIOUR.md.
- **The first** is a convoy run. The title card says the Rebels will run a convoy to a jump point; the Empire tries a pincer and the Rebels raid. First shots and a hero duel come before 30 s. By 45 s two Rebel squadrons have raided and jumped out and the first Imperial squadron has broken. Then an ace duel, vendettas on both sides, an Imperial plan switch and an Imperial hero dead. The convoy gets through and the Rebels win at 134.6 s.
- **The second** has nothing to escort. The Empire holds its line and the Rebels lay an ambush, so nobody fires for the first 15 s. It becomes a three-minute grind: waves of routs on both sides, a Rebel ace, vendettas, a Rebel ram, rescues as escorts screen crippled capitals, and escape pods picked up. It is still undecided at 180 s.

Before this pass those two seeds, and the third, were the same war: hero duels, ion strikes and capital kills, undecided at 180 s. That's the before table right below the after one.

The numbers agree, with caveats I'd rather state than bury:
- Uniqueness between seeds rose in 9 of 10 matchup/size cells.
- The part of uniqueness that only moves if the war itself plays out differently (the shape of the momentum curve) rose in 5 cells, fell in 4 and held in 1.
- Lead changes didn't rise at all.

Morale that cascades makes wars decisive rather than see-saw. What tells two wars apart is what happened and where, not who was ahead when. The controlled plan experiment shows the plan alone moves:
- first blood, from 36 s to 75 s;
- where the fight happens, from 1.1 km on one side of the field to 1.9 km on the other.

**Would they want a third? I think yes, for a while, and I can say why.** Each war now asks a question on its title card and answers it on its end card. The camera holds on a subject long enough to follow it (median shot 9.6 to 10.7 s in Broadcast, 8.0 to 9.0 s in Action). In the watched wars Broadcast showed 19 of the 20 capital and hero deaths: 13 live, 6 replayed; the one it missed died 6 s before the war ended. The only 15-second stretch with nothing notable was a convoy war's approach.

What would stop someone at the fourth war:
- **Wars of annihilation still run long.** Only 2 of 10 ended inside the 180 s cap; the objective wars are the ones that finish.
- **The default Action camera misses some deaths.** It saw 13 of 20 live and doesn't replay, so a viewer who stays on Action sees less of the story than Broadcast shows.
- **Flagship deaths are uncommon** (9 in 30 wars), so the succession story, which is one of the best moments, is uncommon.

Those are my next three things to fix.

## What it cost

- **CPU: the story layer takes 0.8 to 0.9% of the simulation** (22 ms per simulated second at 300 a side), bucketed by ship id.
- **The whole war costs about the same per ship.** 2,955 to 3,067 ms per simulated second over war seconds 30 to 90 at 300 a side, against 2,769 to 2,785 before. The story war keeps 48% more ships alive in that window, and per live ship it costs less (6.2 against 8.4 ms).
- **Software browser frame times didn't move** (7.58 → 7.63 FPS at 192 ships, 6.15 → 6.26 at 572; SwiftShader, not a GPU).
- **One behaviour-neutral refactor** (spatial-index keys) was checked byte-identical against the recorded trace. The story itself changes the war on purpose, so the new trace is recorded separately. PERFORMANCE.md has all of it.

## Verification log (what worked, what didn't)

- **Plans did nothing at first.** A two-argument distance helper returned NaN, which silently disabled pincer wings, raids, postures and convoy exits. The first two plan experiments were invalid because of it. The fix was one default parameter. After it, the plan experiment showed the shapes above.
- **The speed probe hung the headless harness.** It looped against a frozen clock. It is now bounded by cycles and guards against a clock that doesn't move.
- **Routs went from everywhere to nowhere.**
  - A fear threshold broke half the field at first contact.
  - Raising it meant nothing ever broke.
  - Squadron stress that builds and decays fixed both.
  - Encirclement then over-routed (0.20 fear at 3 contacts), so it's 0.10 at 4.
- **Plans flip-flopped every few seconds** because failure counted losses since the war began. It now counts since the plan began, waits 18 s, and a fleet switches at most twice.
- **Wreck strikes emptied the dogfights.** Every brush with a fragment was lethal. Only real wrecks at real speed kill now.
- **Rams almost never landed.** Rammers died on approach. A reach limit, an emergency burn and 40% damage while committed fixed that; about one ram lands every two or three wars.
- **Losses always read zero.** The command step prunes dead ships from squadron lists, so losses are measured from each squadron's starting size.
- **The median shot was under 8 s in Broadcast.** Two changes fixed it:
  - a settled rule: climax and reaction shots hold 7 s and story shots 6 s before an ordinary interrupt;
  - missed deaths queue for replay instead of being dropped.
- **Action was at 7.0 to 8.0 s.** Wide views were 4 to 5.5 s and a death payoff only 2.4 s. Longer holds broke the variety of shots: every kind saturated its "not seen lately" bonus. A higher cap fixed that. Action is now 8.0 to 8.5 s.
- **Looking at the gallery found real bugs, not just framing:**
  - a Borg hold let a convoy walk out at 0:59 with one loss a side, so the side hunting a convoy can no longer hold or siege;
  - an end-card line reported a momentum swing in the first second;
  - a vendetta caption stayed up after the hunter died (now withdrawn, with a test that fails without the fix);
  - a successor's caption was dropped behind a pods caption;
  - captions started with a lowercase "the";
  - rout captions said "the edge" for fleets that jump;
  - a rout was invisible from any distance, so a breaking squadron now gets a HUD tag.
- **Aces almost never happened.** The first full metrics run had aces in 3 of 30 wars: fighters rarely get credited kills. A side's first ace now needs 2 kills and each later one a kill more.
- **The audio got harsh without the audio changing.** The new cameras sit 100 m to 2 km from the fight, where the old one heard everything from 22 km.
  - Muting one group at a time put it on close explosions: 34% of their energy sat at 2 to 8 kHz.
  - After softening the crack and body and lowering the laser: 9.1% harsh overall, against 21%.
  - I only found this because I compared recordings. My first fix, the laser, alone changed nothing, and the split showed why.
- **The debris screenshot showed an intact hull** with embers, because it caught a disabled capital. The debris shots now wait for a hull that breaks apart. They show the fracture edges orange-hot at 1.5 s and dark, readable chunks at 9 s.
- **Tows were scored as saved without towing anything.** When I wrote a test that a tug saves a disabled capital (`tests/tribute-new/story-guarantees.test.cjs`), the tug latched and then flew home at 85 m/s. The hull could follow at only 28 m/s, so after 28 s it was scored "saved" with the hull 2 km behind. An attached tug now crawls, the hull keeps pace, and a save needs the hull on the line.
- **The same file pins the no-regressions list to tests:**
  - the ion lance keeps its 22 px floor, white-tinted core and 0.3 s flare;
  - the dust and ember MAX blend and the lance's overlap dimming stay in place;
  - replays still borrow a disabled capital's wreck mesh;
  - fragments of a shattered capital show no single-tick positional snap (largest measured: 1.4e-12 units over 8 s).

  It also covers screens and tows that save, probe-based sizes, fracture-edge glow, and convoy and station wins.
- **Browser against headless.** The Node harness forges box meshes, so its wars differ from the browser's; that was already true on main. The browser against itself is identical across frame rate, time scale, camera, slow motion and forge-worker count (`scripts/determinism-browser.cjs`).


## After you watched it

You watched and saw four things my metrics hadn't caught. Each was real, and each is measured before and after in DECISIONS.md.

- **"They all seem to go at the same speed."**
  - The numbers said speeds varied (each ship's speed swings by about 60% over a war), so I measured what a viewer sees instead: time spent on 5-second plateaus. Fighters sat on one speed 22–42% of the time, and mid-size ships up to 49%. The wanted speed was a step function of mood, and it snapped into place in under a second.
  - Now the throttle answers the fight: chasing, turning, damage, formation and a pilot's own hand. Engines spool by size. Plateaus fell to 6–10%.
- **"The asteroids look like giant floating potatoes."**
  - They did. The shader lit them as perfect spheres, so no bump ever caught the light, and the mesh was a smooth squashed ball.
  - They're now fractured, elongated, cratered, tumbling rocks lit by their real facets, in four tones.
- **"The scoreboard should name the reinforcements."**
  - Reinforcements now get their own line in their colour, with arrived and inbound counts. Their ships no longer inflate the main fleet's number.
- **"The First Ones jump in, sit still and do nothing."**
  - Measured, it was worse than that. They arrived over 86 s, my own battle plans parked them on a hold line, only one ancient in the battle could fire at a time, and they fired 4 times in two minutes.
  - Now the host is present by 17 s. Each ancient fires on its own cycle at whatever cluster its blast will unmake, and the camera cuts to the charge and follows the beam to the shockwave.
  - The same war that used to crawl ends in 60 s: 61 ships unmade by 10 strikes, none of the ancients lost.
  - Their simulated odds in the picker went from 1,795 to 2,137 Elo, top of the table. That is the point.

The lesson I'm taking: my story metrics measured what the minds decided, not what the eye sees. Plateau time and "does the camera see the blast" are now measured and tested.

## Where to look

- **Story gallery:** `design/tribute-new/review/story/index.html`. Every moment in it came from the simulation; only the camera was placed. It includes a top-down plot of each plan.
- **Highlight clip:** `design/tribute-new/review/story/highlights-story.webm`. It's 89.4 s, from one war (Rebels vs Empire, seed 1101, both sides told to decapitate), made by `scripts/capture-clip.cjs --types flagshipDown,rout,ace --reel 80 --clips 6`. In time order it shows an ace promotion ("Kestrel"), capital kills, the Imperial flagship dying, a squadron breaking, and then the successor flagship dying too.
  - It's rendered in software, frame by frame at exact 1/30 s steps, so it plays at true speed.
  - Two honest weaknesses: the ace clip doesn't single out the ace (the reel frames the event's neighbourhood and there is no ✦ tag in replays), and the rout it picked is a squadron already down to one ship.
  - My first attempt missed the rout and the ace entirely: a 30-clip reel sorted by score had evicted them behind 20-odd capital kills.
- **Numbers:**
  - BEHAVIOUR.md: story metrics, the plan experiment, side-by-side seeds and watch logs;
  - PERFORMANCE.md;
  - DECISIONS.md: doctrine table, battle-size thresholds and every call I made;
  - `bench/story/audio-report.md`.
- **Tools:**
  - `scripts/story-metrics.cjs`;
  - `scripts/watch-log.cjs`;
  - `scripts/story-timelines.cjs`;
  - `scripts/capture-story.cjs`;
  - `scripts/story-cost.cjs`;
  - `scripts/determinism-browser.cjs`.

## Earlier: the polish pass

I spent this pass on the thing the brief cared about most: someone who has never heard of this page opens a link and wants to watch a war. So the page no longer starts on a menu. It opens straight into a live matchup picked for spectacle, with two buttons over it, and the camera is a broadcast director.

### What changed

**Watching.**
- Broadcast is the default camera. It follows shot grammar (establish, build, climax, reaction) and scores events by importance: capital kill > hero duel > ion strike > squadron wipe > dogfight.
- It forecasts deaths (a capital or hero low on hull and still taking fire), so it's usually there when they go. In a full Empire vs Rebels review, all seven capital and hero deaths happened on screen.
- When it misses one, it says "let's see that again" and replays it from a new angle.
- Big kills it can see slow time to 0.25× and ease back.
- The HUD reads like a sports broadcast: a tug-of-war strength bar with shape-coded sides (▲ / ◆), a kill feed that folds fighters into "TIE/LN ×14 lost", a ticker for the big moments, a momentum graph, and the pilots' thoughts as captions.
- The captions use the page's older flavour lines ("they cannot hurt us. we do not need to hurry."), which the AI telemetry had quietly made unreachable.
- Time runs from pause to 4×. R replays the last big moment.
- When the war ends you get a card with losses, an MVP with their captain portrait and service record, a five-line story written only from the event log, highlights from a 20-second snapshot ring, a PNG card and a WebM clip.
- Sound is synthesized: weapon voices per fleet, explosions that arrive late and low from far away, an adaptive score and a capital-kill stinger, with a hard voice cap.

**Looking.**
- The scene renders to a half-float target with MSAA, then bloom fed only by energy above white, an auto-exposure that only ever darkens, a tone curve, a gentle per-system grade, vignette, grain and FXAA.
- Every fleet is now lit by its system's actual star, with a cool fill and a rim so the Borg and the Shadows don't vanish into space.
- Planets eclipse ships, and the biggest explosion on screen lights nearby hulls.
- Destruction has tiers (fighter shockwave; frigate secondaries; capital double ring and core flash; First One end of an age). Capitals below 35% hull visibly start dying first.
- Arrivals are per franchise: hyperspace streaks, jump-point vortices, warp flashes, a transwarp conduit, a hive rift, a rocket burn.
- Trek hulls ripple their shields and the Borg shimmer. Rebel and EarthForce engines burn their own colours.

**Running.**
- The prediction broad phase padded every query by the fastest speed on the field times a 16-second horizon, so it scanned every hull for every ship. I replaced it with a swept-box index that provably returns the same threat. Recorded battle traces are byte-identical, and the simulation is 30% cheaper.
- The forge is a worker pool now, streams capitals first, and its hot mesh functions are 3.4× faster with byte-identical output.
- Rendering interpolates between the 30 Hz simulation steps, so 60 Hz and slow motion are smooth.
- Quality tiers auto-detect and remember, dynamic resolution holds the budget, and `?perf=1` shows where every frame goes.

### What it cost

- **The High tier's image pipeline isn't free.** In software rendering it halves the frame rate. Low keeps most of the look and beats the original page at every size even in software (+7% to +27% FPS, p95 down by up to two-thirds). I never saw a real GPU in this environment, so every browser number in PERFORMANCE.md is software and labelled that way.
- **The simulation is the real ceiling.** After my changes it still costs about 1 s of CPU per simulated second at 190 ships in combat on this Xeon. A 600-ship war can't run in real time at 60 FPS here, and I didn't pretend otherwise: default sizes now follow the quality tier.
- **Some brief items I chose not to build:**
  - moving the sim into a worker
  - a structure-of-arrays rewrite
  - a shadow map
  - PBR materials with baked AO
  - an IndexedDB mesh cache
  - picture-in-picture
  - live turning hero ships on the picker cards

  DECISIONS.md says why for each.

### What I'd do next

1. **Take the simulation off the main thread.** The measured work is spread thinly across AI, weapons, prediction and collision, so the next big win is structural. The sim owns plain data, sends transforms back as a transferable buffer, and the renderer interpolates as it already does. That buys a smooth 60 FPS camera even when the battle itself runs below real time.
2. **Give the AI a deterministic level of detail.** Think less when no enemy is within twice sensor range, bucketed by id. It would be a documented behaviour change, measured against the fleet ratings.
3. **Get one real-GPU benchmark** from a 2020 laptop and a mid-range phone with `--headed`, then retune the tier boundaries from data instead of guesses.
4. **A hero-capital shadow map on Ultra**, so fighters can pass through a Star Destroyer's shadow.
5. **Proper per-ship staged deaths** that delay the breakup visually without touching combat: the pieces exist at death, only their reveal would be staged.

### Verification log (what worked, what didn't)

- **ACES on display-referred shaders.** Didn't work: crushed blacks and washed the hull mid-tones (measured). Replaced with a shoulder-only curve.
- **Key light at full star colour.** Didn't work: a red star painted the Imperial fleet pink while the planets stayed neutral. Now 10%.
- **Full-strength grades.** Didn't work: they turned grey hulls mauve. Now half strength, with contrast pivoting low.
- **First bloom setting.** Didn't work: capital death clusters became white blobs. The threshold went up, the HDR flash gain down, and coarse levels are weighted down.
- **Pixels, not assumptions.** The pipeline looked like it darkened hulls by 40%. The measurement showed the `?post=0` comparison had never applied the star light, so there was no pipeline bug.
- **Replay determinism test.** It failed 3 of 4 runs on flash and spark counts, which are cosmetic `Math.random`, not simulation. The test now compares only simulation state.
- **The first Broadcast director** showed 13 establishing shots in one war and missed the Millennium Falcon's death. Death forecasts and the wide-shot limit fixed both; all 7 capital and hero deaths were on screen in the re-run.
- **An `xPose` memo cache.** Measured no gain, so I reverted it rather than keep complexity that doesn't pay.
- **The swept broad phase.** Worked: 3.6× cheaper prediction, byte-identical battle traces.
- **Mistakes I made along the way:**
  - My flash-kind branch for engines silently capped the new arrival rings at 72 px until a screenshot showed it.
  - The top HUD bar rebuilt its buttons 8 times a second.
  - Highlight clips first included the victory event.
  - During replays the HUD showed present-day counts.
  - A capital's death flash was silently dropped whenever the 320-flash budget was full of hit sparks, which is exactly when the money shot matters. Big flashes now evict the smallest queued one, and there's a test for it.
  - Capital explosions read as flat white discs. They now cool to ember in the first instants and break up with grain.
  - The clip still showed white discs. I dumped the live flash kinds in the replay and found they were stacked weapon-hit sparks (a dozen fighters on one hull), not explosions. Hit sparks now stay at display energy and draw lighter.
  - The clip still showed soft white discs. I first blamed engine glows and fire, and changed both, and the discs didn't move. Skipping one GL draw call at a time on the same frame found the real cause: a dead capital speckles into up to 1,800 dust motes around one spot, drawn additively. The old 8-bit target clamped that to a grey smudge; the HDR target summed it far above white and bloomed it into discs. Dust now uses over-blending. The engine and fire changes stayed, since they looked better anyway.
  - The same bisection found the ion lance: its 44 skin lines collapse into a few pixels and summed to about 30× white, making two flat white bars. My first fix scaled the lines down by projected density, which killed the shot entirely: from broadcast distance it became a faint 1-pixel line. The owner said it used to be a "what was that" moment and now you can't tell it fired. The lance is now a column of soft faction-coloured glow sprites around the white-hot line core, never thinner than 22 px, flaring to three times its width in the first 0.3 s, with brightness divided by on-screen overlap so it can't blow out. A faction-tinted screen flash marks each shot (off under reduced motion).
  - The Super Star Destroyer's highlight showed empty space. Two causes: the replay camera stood 3.2 lengths off a 19 km hull, and a disabled capital hands its mesh to its drifting wreck, so the replay had no hull to draw before the death. Huge hulls are now framed closer, the replay borrows the wreck's mesh, and corpses that dissolve after their clip was captured keep the clip's pin (with a test).

  All fixed.
- **`tests/three/browser-smoke.cjs`** runs its control and regeneration checks, then fails its final "no console errors" assertion. The only errors are the Google Fonts certificate through this sandbox's proxy and a favicon 404, and the committed page does the same here.

### Where to look

- **Before/after gallery:** `design/tribute-new/review/index.html`
- **Captured highlight clip:** `design/tribute-new/review/highlights.webm` (software-rendered frame by frame at exact 1/30 s steps, so it plays at true speed)
- **Style sheet:** `design/tribute-new/style.html` (regenerated from code by `design/tribute-new/style-gen.cjs`)
- **Benchmarks:** `scripts/bench-tribute.cjs`
- **Fleet ratings:** `scripts/fleet-ratings.cjs`

### The last question

Would someone who has never seen this page watch a whole war without touching anything, then hit replay and send it to a friend? I think the first half is now yes: it opens live, it explains itself, it cuts to what matters and slows down for it. The second half depends on how it runs on their machine. A phone gets a small, smooth war; a laptop gets a medium one. Seeing a 600-ship war move at full speed still needs the simulation rewrite above.
