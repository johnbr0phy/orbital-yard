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

(written with the final numbers)

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
node --test tests/tribute-new/variety.test.cjs
```
