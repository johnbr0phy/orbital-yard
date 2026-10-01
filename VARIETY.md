# Tribute War: what the fleets look like

This file measures fleet variety: whether a fleet reads as a navy of different jobs or as one shape at several sizes, whether sister ships are sisters rather than clones, and whether every fleet is still recognisable from its silhouette alone. The brief is `VARIETY-BRIEF.md`. Every number here comes from `scripts/variety-report.cjs` (headless, the page's own forge) unless a row names another script. The tables between markers are written by `scripts/variety-doc.cjs` from the saved summaries; none is typed by hand.

## Pass criteria

I fixed these, and the thresholds the brief left to me, before changing a hull; the baseline is main at 471d650, measured with the same tools. Where a threshold needed a number, the reasoning is under "Why these thresholds".

<!-- CRITERIA-TABLE -->
<!-- /CRITERIA-TABLE -->

## What each criterion measures

- **The sample.** For every fleet, the page deals two real 600-a-side musters (war seeds 101 and 202), and every normal job of the fleet's side goes through the forge worker's own job handler: the band re-cuts, the fleet refit, arming and packing. Escort and capital bands a fleet musters thinly are topped up to 40 hulls a war from further wars (1101, 1102, ...); top-ups count for band statistics only, never for "in a muster" checks. Two more wars (303, 404) are forged for the recognition classifier only. On this build that is about 40,000 hulls; heroes and crowns are not in the bands. The First Ones muster eight unique ancients and no bands, so they appear only as a reference.
- **Silhouette signature.** The battle mesh (the forge's own tessellation, q = 0.32), in three orthographic views (top, side, front), each rasterised to a 32×32 occupancy mask (2×2 supersampled, every vertex marks its cell so spars register). All three views are fitted to the hull's largest extent, centred: scale drops out, proportion stays in. Distance between two hulls is 1 − IoU, averaged over the three views.
- **A shape (cluster).** Complete-linkage clustering of a band's hulls at distance 0.20: every hull in a cluster is within 0.20 of every other. **Distinct shapes** is the effective number of clusters, exp(Shannon entropy) of their shares: the number of clusters, weighted by how often each appears in a real muster (the brief's definition). One shape repeated scores 1.0; three equal shapes score 3.0. **Dominant share** is the largest cluster's share of the band.
- **Class separation.** For every pair of classes in one band of one fleet, the median distance between their hulls. Scale is already out, so two classes that differ only in size score near zero (on main the Shadow Hunter and Vessel measured 0.010).
- **Sister spread.** For every class with more than one hull a battle, the median distance between sisters within one muster. A clone class scores near zero (main's scale-jittered sisters measure 0.000–0.011). Sisters must also sit closer to each other than to any other class of their fleet (the class still reads as one class). No two hulls of one muster may have an identical mesh.
- **Classes in the original fleets.** The Yard, Shoal, Lattice, Drift and Choir forge one-off designs: the "-CLASS" name is drawn from the seed's digits, independently of the design, so two hulls sharing a name are not sisters. They have no sister classes; for class separation their class is the role type the page prints after the name (SURVEY RING, MEDUSA, ...). The identical-mesh check applies to them as to everyone.
- **Fleet recognition.** A k-nearest-neighbour classifier (k = 7, rank-weighted votes, IoU distance) names the fleet of every hull of one war from the hulls of the other three (leave one war out, four wars). Every fleet's test rows count equally (macro accuracy), so chance is 1/22. Colour is never seen: masks only.
- **Band reach.** The share of capital-band jobs whose finished hull (after the refit) really lies in the capital band, rather than a nearest-band fallback.
- **Cost.** Triangles at study quality (q = 0.65, the ship study and model review); distant-hull groups per fleet per battle (the page's distant renderer draws one instanced group per class and representative, so this is its draw-call count); forge time per hull from `scripts/variety-forge-time.cjs` (one quiet process, main and branch interleaved on the same jobs); render and simulation cost at 600 a side from `scripts/sim-bench.cjs` and `scripts/bench-tribute.cjs`.

## Why these thresholds

- **0.20 for "the same shape".** The Yard and the First Ones are the reference for variety. Across every pair of their classes (226 pairs: the Yard's role types in each band and the eight ancients), the closest two measure 0.401 apart, the 5th percentile 0.55, the median 0.65. A pair closer than half the closest reference pair (0.20) is the same shape. The same cut defines a cluster, so "distinct shapes" and "class separation" use one idea of sameness.
- **Sister floor 0.04, ceiling 0.25.** Clones from scale jitter measure at most 0.011 on main; 0.04 is four times that, clearly measurable, and below what one real assembly change (a drive bank, a stretched hull) produces. The ceiling keeps sisters under the "same shape" cut plus a margin for the precedent variants the brief points to (the Olympus drive layouts measured 0.214 on main), and the nearest-class rule adds the relative test: sisters must be closer to each other than to anything else in the fleet.
- **Recognition floor.** The brief asks for 5× chance and no fleet below its baseline. "Below baseline" is judged against the baseline estimate less two binomial standard errors of that estimate (for a fleet at 100% on main, that is exactly 100%).
- **Band reach 95%, triangles 6,000, cost 10% and 5%.** From the brief.

<!-- FLEET-TABLE -->
<!-- /FLEET-TABLE -->

## The suspected bugs

- **The Sharlin never flew as a normal hull: confirmed.** `buildMinbari` rolled `r<.34?0:r<.46?1:r<.64?2:r<.82?3:r<.94?4:5`, so class 6 (the Sharlin) was unreachable; it appeared only as a crown (`buildMinbariMega`). On main no normal Minbari hull in either muster is a Sharlin. It is now in the capital pool.
- **The Dominion shuttle was never dealt: confirmed.** The pool was `[1,1,1,2,3]`: type 0 (the shuttle) and type 4 (the battleship, crown only) never appeared in a normal muster. Both are in the band pools now.
- **Capital jobs fell back to the nearest band: confirmed, and wider than suspected.** Band reach on main: Yautja 40.7%, Drift 38.8%, Mondoshawan 0%, and also the Yard 0%, the Lattice 3.5% and the Shoal 76.3%. The Mondoshawan and the Yard had no normal class that could reach the capital band at all.

## Recognition

This was the hardest criterion, and it shaped the whole pass. The classifier names a hull's fleet from its three clay masks by its seven nearest neighbours in the other wars. The Yard is a kit-bash generator: most of its designs are one-offs, far from every other hull, Yard or not (nearly half its hulls have no other Yard hull within 0.3). On main it was recognised because nobody else lived near it. Every silhouette the pass added elsewhere sits somewhere, and some of them sit near a Yard design.

What I measured, in order:

- **The triangle budget was reshaping the Yard.** Cutting facets at every quality turned the Yard's round parts into three-sided prisms and changed 788 of its 1,070 hulls' battle silhouettes. The budget is now a study-quality ceiling; the Yard's small and escort hulls are byte-for-byte main's.
- **Sister variation, not new classes, was the larger cost.** With the old classes put back to main's clones (every sister identical) and every new class kept, the Yard measured 94.1%; with every new class removed and the old classes' variation kept, 93.8%. Proportion variation from three independent draws spread each class into a cloud; one draw along one line gives the same sister spread with far less reach, and was worth about 0.3 points.
- **Tight clusters vote together.** A class whose sisters are near-identical in clay takes all seven neighbour slots of a Yard hull it lands near. Removing one such class hands the hull to the next nearest one, so thinning pools did little; changing the silhouette did. The cargo Dragon's solar wings, the Falcons' legs, the Betty's spine, the spaceliner's tail and the Borg scout's arms each moved a class out of the Yard's neighbourhood (scripts/variety-sister-axis.cjs measures this for sister directions; the same count guided the redesigns).
- **The Yard's capitals are neighbours too.** A capital job now builds the Yard's first frigate-length design from the forge's own seed walk and grows it; a line of random types cost the Yard's spinal-mount escorts their nearest Yard neighbours.

The Yard ends within a few hulls of its floor. That is the honest cost of a pass that adds some forty classes and gives every class sisters: the Yard's recognition rests on its designs being alone, and a richer universe is less empty around it.

## Flight

Hull length and proportion feed turn rate, speed, mass and avoidance, so the motion pass was re-run in full on the final build (`scripts/motion-report.cjs`, all 32 scenes and the 24-war sweep, `bench/motion/variety`) and compared with main's run of the same set (`bench/motion/final`; main re-measured at 471d650 gives the same 40.2% classifier). Every MOTION.md criterion that passes on main passes here. Cohesion and individuality fail on main and still fail, both a little better (70.5% against 69.1%; 153 against 169 squadrons below 0.25).

One fix came out of it. With the first final build the motion-only fleet classifier fell to 38.5%, under its 39.6% floor. Speed is the feature that tells fleets apart best, and it reads hull length; a sister's proportion line moved her length a few percent, so a class no longer flew at one speed. Sisters share their class's engines, so speed and helm now read the class's own length (`classLen()`), while bands, roles and hull strength read the hull as built. The classifier is back to 40.0%. A version that also took hull strength from the class length passed the classifier but let one Klingon hero cross its own path in 3 of 50 samples of one window (6%, limit 5%); I kept the narrower one.

Flight check per fleet (main → this branch; every fleet appears in the sweep, most in scenes too; `node scripts/variety-flight.cjs`):
for k in 1 2 3 4 5 6 7 8 9; do node scripts/story-metrics.cjs --seed-list $((1101*k)) --out bench/variety/story/after-$((1101*k)).json; done   # and the same on main; then
node scripts/variety-story.cjs
node scripts/motion-balance.cjs --seeds 5 --out bench/variety/balance-after-5.json   # and with --root ../orbital-yard-main

<!-- FLIGHT-TABLE -->
| fleet | ship-minutes | reversals, gunboats and capitals | reversals per minute, all | worst shuttle | spins (80 m+) | named from motion | flight |
|---|---|---|---|---|---|---|---|
| Yard | 288 → 306 | 0 → 0 | 0.000 → 0.003 | 0% → 0% | 0 → 0 | 27% → 26% | PASS |
| Shoal | 228 → 252 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 50% → 33% | PASS |
| Lattice | 187 → 183 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 34% → 41% | PASS |
| Drift | 148 → 147 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 17% → 15% | PASS |
| Choir | 217 → 204 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 20% → 24% | PASS |
| Imperial | 2300 → 2290 | 0 → 0 | 0.000 → 0.000 | 0% → 2% | 0 → 0 | 39% → 36% | PASS |
| Rebel | 1072 → 1100 | 0 → 0 | 0.000 → 0.000 | 4% → 0% | 0 → 0 | 16% → 21% | PASS |
| Minbari | 208 → 214 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 52% → 63% | PASS |
| Shadows | 114 → 112 | 0 → 0 | 0.000 → 0.009 | 0% → 0% | 0 → 0 | 61% → 60% | PASS |
| EarthForce | 294 → 285 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 22% → 22% | PASS |
| Federation | 286 → 300 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 24% → 29% | PASS |
| Klingon | 272 → 249 | 0 → 0 | 0.000 → 0.000 | 0% → 2% | 0 → 0 | 29% → 25% | PASS |
| Borg | 258 → 249 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 70% → 75% | PASS |
| Mondoshawan | 145 → 186 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 20% → 30% | PASS |
| USCM | 222 → 237 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 28% → 30% | PASS |
| Engineers | 202 → 222 | 0 → 0 | 0.000 → 0.000 | 2% → 0% | 0 → 0 | 59% → 58% | PASS |
| Yautja | 96 → 101 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 56% → 46% | PASS |
| First Ones | 48 → 48 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 79% → 75% | PASS |
| Romulans | 253 → 258 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 35% → 32% | PASS |
| Dominion | 83 → 73 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 38% → 29% | PASS |
| Space Marines | 243 → 239 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 66% → 59% | PASS |
| Tyranids | 243 → 249 | 0 → 0 | 0.000 → 0.000 | 0% → 0% | 0 → 0 | 64% → 59% | PASS |
| Tesla | 158 → 157 | 0 → 0 | 0.013 → 0.013 | 4% → 4% | 0 → 0 | 54% → 51% | PASS |
<!-- /FLIGHT-TABLE -->

## Fleet balance

The nine fleet-balance pairings (48 a side, 150 s), five seeds each, on main and on this branch (`node scripts/motion-balance.cjs --seeds 5`; `bench/variety/balance-main-5.json`, `balance-after-5.json`). Wins for the first fleet, main → branch: 0v1 2-3 → 4-1, 2v3 4-1 → 5-0, 4v5 5-0 → 4-1, 6v7 1-4 → 1-4, 8v9 4-1 → 3-2, 10v11 3-2 → 4-1, 12v13 3-2 → 3-2, 14v15 3-2 → 2-3, 16v17 0-5 → 0-5.

The majority winner is unchanged in seven of nine. The two that change are explained by hull size, which is what the brief expects to move balance:

- **Yard v Shoal (0v1).** The Yard's capital berths used to fall back to frigates (band reach 0%); they now fly the Yard's own designs at capital length. In the fleet-balance muster the Yard's hit points rise from 144 to 175 (+22%) and its largest hull from 75 m to 195 m; the Shoal's rise from 107 to 112. The Yard now wins four of five.
- **USCM v Engineers (14v15).** A near-even pairing on main (3-2). The Engineers' muster rises from 277 to 296 hit points (+7%), the USCM's from 158 to 159, and the Engineers take three of five.

## Story

The brief asks that routs, last stands, aces, rescues, plans and objectives still happen at BEHAVIOUR.md's rates or better. Main itself is below some of BEHAVIOUR.md's counts since the motion pass (MOTION.md row 16), so the criterion compares this branch with main, war for war: the same matchups, sizes and seeds, run with the same script on the same machine.

On story-metrics' default three seeds (30 wars a side) routs looked lower: 59 → 50 at 60 a side and 260 → 224 at 300, with everything else up. Per war the counts swing wildly (one Federation v Minbari war went from 31 routs to 2 because it was decided at 86 s instead of running to its cap), so three seeds can't tell a 7% difference from chance. I ran nine seeds on both builds instead (90 wars each; `bench/variety/story/main-9.json`, `after-9.json`) and judge rates per war-minute, since more wars are now decided early and a shorter war has less time to rout:

<!-- STORY-TABLE -->
| moment: count (per war-minute), main → branch | 60 a side | 300 a side |
|---|---|---|
| wars | 45 wars, 119 → 114 war-minutes, decided 13 → 18 | 45 wars, 86 → 83 war-minutes, decided 7 → 10 |
| routs | 179 (1.51) → 179 (1.58) | 825 (9.63) → 810 (9.71) |
| last stands | 187 (1.58) → 209 (1.84) | 180 (2.10) → 240 (2.88) |
| rescues | 130 (1.10) → 145 (1.28) | 87 (1.02) → 120 (1.44) |
| aces | 44 (0.37) → 53 (0.47) | 68 (0.79) → 80 (0.96) |
| plan switches | 71 (0.60) → 72 (0.63) | 54 (0.63) → 56 (0.67) |
| rallies (not in the brief) | 4 (0.03) → 5 (0.04) | 60 (0.70) → 65 (0.78) |
| rams (not in the brief) | 5 (0.04) → 13 (0.11) | 6 (0.07) → 9 (0.11) |
| vendettas (not in the brief) | 109 (0.92) → 112 (0.99) | 88 (1.03) → 78 (0.94) |
<!-- /STORY-TABLE -->

Every moment the brief names happens at main's rate or better. Objectives are dealt from the war seed and are identical on both builds (44 annihilation, 18 convoy, 16 flagship, 12 station). Vendettas, which the brief does not name, are a little rarer at 300 a side.

## What worked and what didn't

Worked:

- **Band pools per fleet** with the legacy class streams untouched (a pool picks the class, then sets the old selector to that class's midpoint). Every fleet deals each band from its own table; the reachability test proves each entry is dealt.
- **Capitals from each fleet's own library** at battle length, under the crown line. Band reach went from 0% to 100% for the Yard and the Mondoshawan.
- **Canon structural variants at a fifth to a third of a class** (Gozanti walker carriers, tactical cubes with a docked sphere, Mangalore trimarans, Falcon fairings, Keldons among the Galors): each adds a shape to its band while the class's median sister distance stays small.
- **Sisters along one line of proportions**, calibrated per class from the muster spreads, and a direction chosen per class where the default crowded another fleet.
- **A study-quality triangle ceiling** that leaves the battle meshes as they were.

Didn't work (tried, measured, dropped):

- **The crown generator for the originals' capitals.** Its cruisers read as other navies' (Yard recognition 90% to 81%).
- **Three independent proportion draws per sister.** Every class cleared the floor and the Yard, Shoal and Drift fell below theirs.
- **Tightening every class to just clear the floor.** Three bands lost their third shape; recognition barely moved.
- **Scattering tight clusters with twice the amplitude.** Worse.
- **Thinning a crowding class's share.** Its hulls went to the next nearest class.
- **A captain's yacht** for the Federation screen: a flat oval in clay is the Yard's survey rings. The Type-9 shuttle flies instead.
- **The Mondoshawan heavy transport** in the capital line: it is the Mondoshawan ship at 200 m, closer to it (0.043) than sisters are to each other.
- **The boarding torpedo** (in clay, a Yard pod), the **Warlock** line (0.175 from the Hyperion) and the **D7M** name (the same hull as the F15 with a pod; now the F15 command refit).
- **Stowed Falcon legs and closed Dragon noses:** bare cylinders and cones that read as the Drift's and the Yard's hulls.

## The clay question

*If someone hides the colours and shows only clay silhouettes, can they tell which fleet is which, which ships are the screen, the line and the flagship, and that no fleet is one shape repeated?*

- **Which fleet is which: yes, measurably, and no worse than main.** From clay masks alone the classifier names the fleet of 99.0% of hulls (21.8 times chance; main 99.1%). Every tribute fleet is at 100%. The originals are the hard ones and stay so: the Yard 94.1% (main 94.9%), the Shoal 92.6% (93.5%), the Lattice 93.1% (93.7%), the Drift 98.5% (98.8%), each within its floor. The Yard and the Shoal are generators, not navies with a design bureau, and some of their one-off designs will always look like someone else's ship; that is where the misses are.
- **No fleet is one shape repeated: yes.** On main 30 of the 66 fleet bands held fewer than three distinct silhouettes; now none does. The fewest is 3.3 (the Imperial escort line) and no single silhouette fills more than 49% of any band. Sisters are no longer clones (every class with more than one hull a battle sits between 0.04 and 0.25 from its sisters, and nearer to them than to any other class). The contact sheets show it at a glance.
- **Screen, line and flagship: mostly, and by more than size.** Within a band no two classes are the same shape at a different scale (every pair at least 0.20 apart), so the screen is not a shrunken line. Between bands the classifier was not asked, and I did not build one, so this part rests on the contact sheets, not a number: small craft read as fighters, pods, shuttles and gunships; escorts as frigates and transports; capitals as the fleet's long hulls and carriers. The weak spot is the originals, whose capitals are their frigate designs built large, which is the Yard's own language but means a Yard capital in clay can look like a Yard frigate. The crowns (named heroes and the fleet flagships) are unchanged.

## How to re-run

```
node scripts/variety-report.cjs --label baseline --root ../orbital-yard-main --jobs 3          # main (a worktree), then:
node scripts/variety-report.cjs --label final --jobs 3 --compare bench/variety/baseline/summary.json --forge-time bench/variety/forge-time.json
node scripts/variety-forge-time.cjs --main ../orbital-yard-main                                 # quiet machine, nothing else running
node scripts/variety-sheet.cjs --label before --root ../orbital-yard-main && node scripts/variety-sheet.cjs --label after
for s in v1 v2 v3 v4 v5 v6 v7 v8 v9; do node scripts/capture-clip.cjs --variety $s --label after; node scripts/capture-clip.cjs --variety $s --label before --dir ../orbital-yard-main; done
node scripts/variety-watch.cjs                                                                  # design/tribute-new/review/variety/index.html
node scripts/variety-roles.cjs --from bench/variety/final                                       # role declarations
node scripts/variety-doc.cjs                                                                    # the tables in this file
node scripts/motion-report.cjs --label variety --jobs 4 --compare bench/motion/baseline/summary.json   # the motion pass, in full
node scripts/variety-flight.cjs --main bench/motion/final --after bench/motion/variety --out bench/variety/flight.json
node --test tests/tribute-new/variety.test.cjs
```
