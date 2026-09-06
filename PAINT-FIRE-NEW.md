# Fleet paint and sustained exchanges

All 18 factions now receive a hull, trim/panel and accent scheme in the default battle and every palette. Capital and fighter classes inherit their family, with explicit class exceptions. Palettes retain faction pigment and adjust contrast. Disabled hulls and fractured pieces retain the original paint coordinates and proportions with scorch/desaturation and extinguished accent lights.

| Fleet | Paint/material |
| --- | --- |
| Yard | Ceramic gray, navy stripes, cyan accents |
| Shoal | Jade and rose chitin |
| Lattice | Amethyst ceramic bands |
| Drift | Rust and petrol salvage panels |
| Choir | Pearl and gold bands |
| Imperial | Cool gray/slate hulls; black TIE solar panels |
| Rebels | Ivory/red; gold Y-wings, red A-wings, mottled Mon Calamari hulls |
| Minbari | Blue and teal flowing plating |
| Shadows | Dark violet chitin with restrained wet highlights |
| EarthForce | Gray/navy; orange fighter trim and violet/teal White Star |
| Federation | Ivory/slate with blue accents |
| Klingon | Olive and brown armor |
| Borg | Dark green machinery with sparse green emission |
| Mondoshawan convoy | Bronze Mondoshawan shells; yellow taxis, white/navy police, ivory/azure Fhloston |
| USCM | Industrial gray; olive Cheyenne and ivory Nostromo/Narcissus |
| Engineers | Olive bone and weathered ribbed metal |
| Yautja | Sage and copper panels |
| First Ones | Distinct muted violet, gold, blue, red and olive class finishes |

Dark chitin and Borg machinery receive a restrained grazing-angle highlight and fill lift so their silhouettes remain readable against the dark background.

Paint is procedural in the existing ship shader, adding no texture assets, meshes, draw calls or animation loops. The ship-study page uses that same shader. It remains a one-ship, event-driven viewer.

## Weapons

Fighters acquire contacts and line up earlier, prefer fighter-sized opponents, and use longer useful fixed-gun range. Cooldowns count real simulation seconds. Imperial/Rebel fighters and normal capital batteries fire more frequently with reduced damage per emission. Fixed gun cones, turret traversal, muzzle positions, swept hit testing and Imperial green/Rebel red remain in place. Bolt tails and a distance-aware optical halo make physical shots readable; collision width is unchanged.

## Bounded validation

A deterministic **normal 26-ship Imperial/Rebel muster**, seed 915, was run for 40 simulated seconds. Intro was skipped, with no repositioning, forced targets, invulnerability or wider firing cones. The headless harness runs real AI and motion with simplified mesh loading.

| Measure | Before | After |
| --- | ---: | ---: |
| Successful weapon emissions | 59 | 393 |
| Fighter emissions | 2 | 124 |
| Turret emissions | 57 | 269 |
| Average active effects, sampled each second | 0.825 | 6.575 |
| First emission, seconds | 26.1 | 24.9 |
| Ships surviving at 40 seconds | 23 | 22 |

18 weapon tests, 11 debris tests, 3 paint tests and the 57-model geometry check pass. The close fighter duel emits 34 shots in 18 seconds. The debris-avoidance smoke check remains finite, survives and clears the obstacle by 82.8 m. Actual WebGL screenshots cover all 18 featured ships without shader warnings/errors. These are small, serial checks; no full-fleet stress or long performance soak was run.

## Rendering follow-up

The drawing surface now starts within a 2.4-million-pixel budget and at most 1.5 device-pixel ratio. Slow frames can lower resolution at four-second intervals; it no longer repeatedly raises/lowers resolution every quarter-second. Window resizes avoid resetting unchanged canvas dimensions. This trades some high-DPI sharpness for lower fragment-shader cost and steadier frame delivery.

Laser ribbons reuse growing typed buffers instead of allocating vertex arrays for every shot each frame. The broad-phase projectile rejection also avoids temporary extent arrays. Cadence, paint and hit behavior are unchanged: the seeded small muster still produces 393 emissions and 22 survivors. Three rendering regression tests and all 18 weapon tests pass. One brief 24-setting preview (50 ships including heroes) showed 60 FPS without logged warnings/errors; large-fleet performance is not established by this small check.

## Large-battle scaling follow-up

A reported 795-ship battle at the 600 setting reached 7 FPS. The earlier 50-ship preview did not validate that load. This pass addresses work that grows with fleet and projectile counts:

- Projectile sweeps use a conservative spatial index before the unchanged rotating-hull hit test. An isolated 800-small-hull plus one giant-hull fixture reduced candidates from 32,040 exhaustive checks to 61, with no missed hits. This fixture measures candidate rejection, not real-battle FPS.
- Spatial debris subdivision/sorting is prepared in the single forge worker during loading. Loaded-ship deaths reuse those pieces; they do not split triangles on the animation thread. If the debris budget is full, only the available number of prepared pieces is emitted.
- Collision passes reuse hull dimensions and reject distant pairs before square roots. A short, compressed 141-ship CPU fixture identified destruction as a major part of collision time; it is a diagnostic fixture rather than a representative battle.
- Nonhero, unselected ships below five projected pixels use batched colored silhouettes. Nearby, selected and hero ships retain their complete painted meshes. Offscreen live ships skip material uploads.
- Fixed 30 Hz simulation steps now have a two-step maximum and a 10 ms catch-up check per rendered frame. Excess catch-up debt is discarded. Under overload the battle can run slower than wall time instead of processing five expensive steps in a single frame. A single expensive step can still exceed the budget.

18 weapon, 11 debris, 3 paint, 3 rendering and 3 scaling tests pass. The small deterministic combat check retains its 393 emissions and 22 survivors. No full 795-ship WebGL stress run was made, so the actual improvement on that battle remains unmeasured.
