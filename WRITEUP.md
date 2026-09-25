# The Tribute War, polished: a writeup

I spent this pass on the thing the brief cared about most: someone who has never heard of this page opens a link and wants to watch a war. So the page no longer starts on a menu. It opens straight into a live matchup picked for spectacle, with two buttons over it, and the camera is a broadcast director.

## What changed

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

## What it cost

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

## What I'd do next

1. **Take the simulation off the main thread.** The measured work is spread thinly across AI, weapons, prediction and collision, so the next big win is structural. The sim owns plain data, sends transforms back as a transferable buffer, and the renderer interpolates as it already does. That buys a smooth 60 FPS camera even when the battle itself runs below real time.
2. **Give the AI a deterministic level of detail.** Think less when no enemy is within twice sensor range, bucketed by id. It would be a documented behaviour change, measured against the fleet ratings.
3. **Get one real-GPU benchmark** from a 2020 laptop and a mid-range phone with `--headed`, then retune the tier boundaries from data instead of guesses.
4. **A hero-capital shadow map on Ultra**, so fighters can pass through a Star Destroyer's shadow.
5. **Proper per-ship staged deaths** that delay the breakup visually without touching combat: the pieces exist at death, only their reveal would be staged.

## The last question

Would someone who has never seen this page watch a whole war without touching anything, then hit replay and send it to a friend? I think the first half is now yes: it opens live, it explains itself, it cuts to what matters and slows down for it. The second half depends on how it runs on their machine. A phone gets a small, smooth war; a laptop gets a medium one. Seeing a 600-ship war move at full speed still needs the simulation rewrite above.
