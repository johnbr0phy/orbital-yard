# Variety brief: Tribute War fleet silhouette pass

This is the owner's full brief for the fleet variety pass. The `/goal` condition points here; this file is the spec.

## Goal condition

Every pass criterion in VARIETY.md shows PASS on the final commit, measured by scripts/variety-report.cjs across all 23 fleets and every muster band; all existing tests plus the new variety tests pass; determinism tests pass; the motion pass criteria in MOTION.md still pass; and a pull request is open (not merged) on a new branch off main.

## The ask

I want you to do a complete end-to-end pass on what the Tribute War's fleets look like, on your own, and make them look amazing. Not "good for procedural". Amazing, like a fleet shot from a film's VFX team, where the eye can read the order of battle: the screen, the line, the flagship, the odd ship that's been in one fight too many.

I won't be around to answer questions. When something is unclear, make a reasonable call, write it down in DECISIONS.md, and keep going. Run until the /goal condition is true. If a criterion cannot be met, record exactly why with evidence in VARIETY.md and keep improving everything else. Never weaken a criterion to make it pass.

Here's the experience I want. When I look at a fleet, I see a navy, not wallpaper. Fighters, escorts and capitals read as different jobs at a glance, by shape, not just by size. Within a class, sister ships are clearly sisters but not clones: a different refit, a scar, a drive bank, a stretched hull. Every fleet still looks unmistakably like itself. A Shadow fleet is not one crab at nine sizes. An Engineer fleet is not one horseshoe at three sizes. A Dominion fleet is not one beetle at two sizes. A Romulan fleet is not one winged pod with the span changed. Today several fleets are exactly that, and it ruins the aesthetic. That must be gone, and the same failure must be impossible for every other fleet.

## Before you start

Start only after the motion pass (branch claude/motion-pass, MOTION-BRIEF.md) has merged to main. Both passes edit armada-three-engine.js, and this pass must be measured against the motion pass's flight code. If it has not merged, stop and say so.

## Where it stands today. Read this before you change anything.

* The files. The page is armada-war-tribute-new.html, the hulls live in armada-three-engine.js, and the single-ship study is tribute-new-models.html. Read MODELS-NEW.md, UNIQUENESS-NEW.md, EXTRA-FLEETS-NEW.md, MINBARI-NEW.md, EARTHFORCE-NEW.md, DISTANT-HULLS-NEW.md, PERFORMANCE-NEW.md and PAINT-FIRE-NEW.md first, plus the model and refit sections of DECISIONS.md.
* How muster works (don't rebuild it, build on it):
   * `baseRaceBuild` dispatches per race to `buildX(seed)` for normal hulls and `buildXMega(seed,hulls)` for crown capitals. Races 18 to 22 go through `buildExtra` and `buildExtraClass` with class pools.
   * The forge re-rolls seeds until a hull's length lands in the requested band (`fleetBandOf`: small ≤42 m, escort ≤95 m, otherwise capital; wider bands for Minbari and races 18 to 21).
   * `applyFleetRefit` then rescales hulls over 42 m by 0.82 to 1.18 and adds one of six seeded mission fittings. Minbari get axis stretches instead. Small craft get ±4% and nothing else.
   * Named heroes are protected and byte-identical. The Olympus, Hyperion, CR90 and Nebulon-B already have seeded structural variants (drive layouts and keel assemblies). That is the model to follow.
* Audit of every fleet (read-only scan, before this pass). Score is 1 (one shape repeated) to 5 (very varied):

| Score | Fleet | Main cause of sameness |
|---|---|---|
| 1 | Shadows | Every hull, fighter to capital, is `shdCrab` at a different length |
| 1 | Engineers | Every class calls `enJuggernaut`, ±2% jitter |
| 1 | Dominion | Pool [1,1,1,2,3]; attack ship and heavy escort are the same mesh at two scales; shuttle never picked |
| 1-2 | Romulans | Four of five classes are the same pod and swept wings, only span changes |
| 2 | Imperial | TIEs fill the 86% fighter share; every big ship is a dagger wedge |
| 2 | Minbari | 68% small craft, all `minNial`; Tinashi, Tigara and Sharlin share the three-fin plan |
| 2 | Tesla | Every non-robot hull is the same `rocket()` tube |
| 2 | Space Marines | Every big class shares one armoured spine; every sub-50 capital is a Strike Cruiser |
| 3 | Klingon | `kliD7Fam` builds about 45% of hulls, including most capitals |
| 3 | Federation | Shared saucer and nacelle kit; builders ignore the seed |
| 3 | Borg | Probes are 40% of rolls and fill the small band |
| 3 | Tyranids | 8 of 10 types share one carapace body (well varied on top) |
| 3 | Mondoshawan | Ark is the Transport at 55 m; no normal class reaches the capital band |
| 3 | USCM, Yautja | Varied classes, but sister ships are clones (builders never draw from R) |
| 4 | EarthForce, Rebel, Shoal, Lattice, Choir, Drift | Sound; the largest band repeats one plan |
| 5 | Yard, First Ones | Very varied |

* Why it isn't amazing yet:
   * Class variety is often size, not shape.
   * Sister variation is mostly ±1.5 to 4% jitter. Many builders take R and never use it.
   * Small-craft shares of 55 to 88% mean the most numerous ship sets the fleet's look.
   * Several fleets have no normal class long enough for the capital band, so capital slots quietly fall back to smaller hulls.
   * Nothing measures silhouette variety. There is no metric for how alike two hulls look, how many distinct shapes a band holds, or whether a fleet is still recognisable.
* Suspected bugs, unconfirmed. Find the cause with evidence before changing anything:
   * Minbari: the normal roll's `r<.94?4:5` cutoff appears to make the Sharlin (type 6) unreachable.
   * Dominion: the shuttle (type 0) is never in the pool.
   * Yautja, Mondoshawan and Drift: capital-band jobs fall back to the nearest band.
* Past work worth respecting. Keep it fixed:
   * Screen-reference silhouettes from MODELS-NEW.md (joined Shadow carapace, open Borg diamond, broad Engineer horseshoe, Nebulon-B rebuild, D'deridex empty centre).
   * Authored weapon and engine sockets. Refit equipment is excluded from weapon harvesting and turret seating.
   * Hero geometry byte-identical. Named heroes protected from refits.
   * Distant-hull instancing batches class members. More unique meshes must not blow up draw calls.
   * Tyranid vertex deformation anchored at the core, rigid when dead.

Record a baseline before you touch a line. Build the variety tooling below first, run it on today's main, and write the numbers and contact sheets into a new VARIETY.md.

## Variety tooling (build this first)

* scripts/variety-report.cjs forges the real hulls headless, as extra-fleets.test.cjs and the model-review tests do, for every fleet, every band and a fixed seed set (at least 200 hulls per fleet across bands, in the proportions a 600-a-side muster produces). For each hull it records class, band, length, beam, height, triangle count and a silhouette signature. It computes, per class, per band and per fleet:
   * Silhouette signature: normalised top, side and front occupancy masks (for example 32x32) of the actual mesh, fitted to bounds. Distance between two hulls is 1 minus the IoU averaged over the three views.
   * Distinct shapes per band: the number of clusters at a fixed distance threshold, weighted by how often each appears in a real muster.
   * Dominant share: the largest share of a band held by one silhouette cluster.
   * Class separation: the median silhouette distance between different classes in the same band, after normalising for scale. Two classes that only differ in scale score near zero.
   * Sister spread: the median silhouette distance between sister hulls of one class. It must be neither zero (clones) nor so large that sisters stop reading as one class.
   * Fleet recognition: a classifier's held-out accuracy at naming the fleet from silhouette signatures alone, colour hidden.
   * Band reach: the share of capital-band jobs filled by a hull that really is in the capital band, not a fallback.
   * Cost: triangles per hull, unique meshes per fleet per battle, and forge time per hull.
* scripts/variety-sheet.cjs renders contact sheets: per fleet, one row per band, 12 real mustered hulls each, in clay (no paint) from a fixed three-quarter view and a top view, at matched scale per row. Before and after, side by side.
* A scene set, scripted with fixed seeds and camera paths, each recorded with capture-clip.cjs as a WebM and a still:
   1. A Shadow fleet arriving.
   2. An Engineer fleet in its crescent formation.
   3. Dominion against Romulans.
   4. Space Marines in their wall.
   5. Imperial against Rebels, wide shot of both lines.
   6. Minbari, with a Sharlin in frame.
   7. Tesla against Tyranids.
   8. Every fleet's muster in the ship study, one band at a time.
   9. A full 90-second war in Broadcast at 600 a side, Ultra.

## Pass criteria, stated before you start

Put them at the top of VARIETY.md with baseline and final values:

* Distinct shapes: every fleet's small, escort and capital band holds at least 3 silhouette clusters in real musters, or the fleet's canon genuinely has fewer; any exception is justified in VARIETY.md with a reference.
* Dominant share: no single silhouette cluster fills more than 50% of any fleet's band.
* Class separation: no two classes in the same fleet and band are the same shape at a different scale. Scale-normalised class distance is above a threshold you define and justify from the Yard and First Ones.
* Sister spread: every class with more than one hull per battle has sister spread above a floor and below a ceiling you define and justify. No two sisters in a muster produce an identical mesh.
* Fleet recognition: a held-out classifier names the fleet from silhouette alone at 5x chance or better, and not below baseline for any fleet.
* Band reach: at least 95% of capital-band jobs are filled by true capital-band hulls, in every fleet.
* The Sharlin, the Dominion shuttle and every other listed class can actually appear, or its absence is deliberate and documented.
* Heroes: byte-identical unless you change one on purpose, document why, and re-record its test.
* Cost: every hull under 6,000 triangles at study quality; unique meshes per battle and forge time per ship within 10% of baseline; per-frame render cost at 600 a side within 5% of baseline, measured with scripts/sim-bench.cjs and scripts/bench-tribute.cjs.
* Every existing test passes, including massacre, story-guarantees, determinism, weapons, mount seating, self-obstruction, distant hulls and the motion tests. Balance winners in fleet-balance.cjs are unchanged, or the change is documented and justified (hull size changes mass and collision envelopes).

## Architecture: navies, not wallpaper

* A variety kit per fleet, following the Olympus, Hyperion and Nebulon-B precedent: seeded structural variants (drive banks, keels, wing counts, prows, carapace plans) that replace assemblies, never pile fittings on. Each fleet's kit uses its own design language. No metal boxes on organic hulls.
* Every builder draws from R. Sister variation comes from proportions and assemblies, not only scale. Keep sisters recognisably one class.
* New classes where a fleet's canon or a documented reference supports them. Candidates from the planning scan, verify each before building:
   * Romulans: TOS Bird-of-Prey, Mogai, Reman Scimitar (hero or capital), Narada (landmark), Shrike or T'Liss scout.
   * Dominion: Cardassian Galor and Keldon, Breen warship (both Dominion members).
   * Shadows: Shadow fighters and the Shadow-Omega hybrid.
   * Engineers: pilot-chair gunship, Giger pyramid or temple ship, ampule carrier, orrery seed vessel, and Juggernaut variants (broken horn, closed ring, fused pair).
   * Space Marines: The Rock, the Phalanx, a Space Hulk, Stormbird, drop pods and boarding torpedoes, chapter variants.
   * Imperial: TIE Bomber, TIE Defender, Interdictor, Carrack, Quasar Fire.
   * Minbari: Flyer and cruiser variants.
   * Tesla: Starlink swarm, Dragon capsule, Cybertruck gunship.
* Rebalance class pools so the most numerous band isn't one shape. Weights are game rules, not claims about canon; write a table with a reason for each row in UNIQUENESS-NEW.md.
* Fix band reach so every fleet has real capital-band normal hulls.
* Authored sockets. Every new class and variant places its own weapon and engine sockets on modelled apertures. No harvested guns from refit parts.
* Determinism. Hull generation is simulation input: every new draw comes from a stream seeded per hull that can't shift anyone else's. Re-record the determinism trace on purpose and say so. scripts/determinism-browser.cjs must pass.

## Constraints

* The ethos: no build step, works from file:// and from GitHub Pages. No external meshes or textures. Procedural only.
* Don't regress the motion pass: re-run scripts/motion-report.cjs. Hull size and shape feed turn radius, mass and avoidance.
* Role lock. The ship minds read length, beam and height, not shape. On the motion branch, length alone decides the muster band (42 m, 95 m), gunboat (80 m and up: patrol lines, no dogfighting, turn capped by length), fighter attack runs (under 120 m), capital (300 m and up, Shadows over 180 m), spool time (60 m and 180 m steps) and goal dwell. Beam and height set rad, exY and exZ for avoidance and contact. Every new or changed class declares its intended role and a length range in UNIQUENESS-NEW.md. A test fails if any mustered hull, after refit scaling, crosses a flight threshold its class did not declare. Sister spread must stay inside the declared range.
* Flight check per fleet. After changing a fleet, re-run scripts/motion-report.cjs on at least one war with that fleet and record its numbers in VARIETY.md. Every MOTION.md criterion must still pass for it.
* Don't regress the story: routs, last stands, aces, rescues, plans and objectives still happen at the rates in BEHAVIOUR.md, or better. Re-measure with scripts/story-metrics.cjs.
* Don't touch the audio engine's behaviour.
* Provenance: every new class cites the reference it was built from in the relevant NEW.md, with the same honesty as MODELS-NEW.md about what is canon, what is licensed, and what is invented.
* Tests: all existing tests keep passing, with new tests for silhouette distinctness per band, sister spread, band reach, pool reachability, socket placement on new classes, triangle budgets and deterministic generation.

## Verification loops. Don't skip them.

The owner judges by eye, so give him everything he needs to judge.

* Look at every contact sheet and clip yourself. When something looks wrong, find the cause with evidence first. Don't stack guesses.
* A watch page at design/tribute-new/review/variety/index.html shows each fleet's before and after contact sheets and clips side by side, with its numbers. It must work on GitHub Pages.
* Add every new class and variant to tribute-new-models.html so each can be inspected in isolation.
* Keep a log in VARIETY.md of what worked and what didn't, including approaches you tried and rejected, and why.

## Deliverables

* The new classes, variant kits, pool changes and fixes, tooling and tests, committed in small steps and pushed to a new branch off main, with a pull request open when everything is done. Don't merge it.
* UNIQUENESS-NEW.md updated with the pool table and each fleet's variant kit. MODELS-NEW.md and EXTRA-FLEETS-NEW.md updated with provenance for every new class.
* VARIETY.md with baseline and final numbers for every criterion, fleet and band.
* The contact sheets and before/after watch page.
* DECISIONS.md and WRITEUP.md updated, in your own voice: what changed, what didn't work, and what you'd do next.

You're a concept artist, a procedural modeller and a technical artist all at once. Spend effort where the eye will feel it: fleets that read as navies, classes that read as jobs, sisters with their own history, and races you can recognise from silhouette alone. Measure everything, and don't claim a number you didn't measure.

Ask one final question at the end: if someone hides the colours and shows only clay silhouettes, can they tell which fleet is which, which ships are the screen, the line and the flagship, and that no fleet is one shape repeated? Answer it in VARIETY.md with evidence.

Make no mistakes.
