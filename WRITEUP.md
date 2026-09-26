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

## Verification log (what worked, what didn't)

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

## Where to look

- **Before/after gallery:** `design/tribute-new/review/index.html`
- **Captured highlight clip:** `design/tribute-new/review/highlights.webm` (software-rendered frame by frame at exact 1/30 s steps, so it plays at true speed)
- **Style sheet:** `design/tribute-new/style.html` (regenerated from code by `design/tribute-new/style-gen.cjs`)
- **Benchmarks:** `scripts/bench-tribute.cjs`
- **Fleet ratings:** `scripts/fleet-ratings.cjs`

## The last question

Would someone who has never seen this page watch a whole war without touching anything, then hit replay and send it to a friend? I think the first half is now yes: it opens live, it explains itself, it cuts to what matters and slows down for it. The second half depends on how it runs on their machine. A phone gets a small, smooth war; a laptop gets a medium one. Seeing a 600-ship war move at full speed still needs the simulation rewrite above.
