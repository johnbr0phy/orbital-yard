# Tribute New: ship classes and individual refits

The common EarthForce capital slot previously always selected a Warlock. It now draws from Hyperion, Omega, Avenger and Warlock hulls; the larger slot mixes Omega, Nova, Warlock and Poseidon. Existing corvette, missile-cruiser and fighter choices remain. Rebel common capitals mix Nebulon-B, Pelta, MC80 Liberty, MC75 and MC80A forms. Federation common capitals mix Ambassador, Nebula, Excelsior and Akira, with Galaxy/Nebula/Excelsior in the next slot.

These are procedural interpretations of existing class models, not new screen-accurate replicas. Avenger, Poseidon and Sagittarius belong to the broader Babylon 5 gaming/model reference tradition; their inclusion does not assert an on-screen appearance. Model lengths and seeded size variations are game representations rather than authoritative specifications.

## Research and design decisions

- EarthForce needs different structural layouts before it needs more surface clutter. Terry Miesle's first-hand [Hyperion miniature review](https://www.starshipmodeler.com/b5/b5minis3b.htm) documents its engine cluster and dish/pylon fittings. His [Nova and Olympus review](https://www.starshipmodeler.com/b5/b5minis3c.htm) provides the heavy gun-studded Nova and the smaller electronic-warfare Olympus as distinct visual/role references. These support using separate class silhouettes and coherent sensor/armor equipment; they do not establish our generated refits as canon.
- The official [Nebulon-B description](https://www.starwars.com/databank/nebulon-b-frigate) identifies escort and medical service. That supports the idea of a shared class adapted to different work. Our carrier, survey and support versions are invented visual configurations, not claims about documented Nebulon-B variants.
- The official [Mon Calamari cruiser description](https://www.starwars.com/databank/mon-calamari-star-cruiser) emphasizes flowing, rounded surfaces with equipment distributed over them. Its fleet gets tapered housings and individual panel patterns; it retains the separate Liberty, Profundity and Home One body plans. The low-polygon models still simplify those curves.
- The official [Hammerhead corvette entry](https://www.starwars.com/databank/hammerhead-corvette) supplies another recognizable Rebel hull family. The study now lets you compare its sister ships directly alongside CR90s, Peltas and Nebulon-Bs.

## What makes sister ships different

A stable hull seed chooses one of six configurations, size and surface treatment. Larger hulls vary from 82–118% of their class model size, with smaller craft kept to 96–104%. Seeded panel patterns and subtle finish variation distinguish individual ships without changing fleet colors. Former randomly scattered `fleetKit` decorations are removed from refitted ships.

| Fleets | Configuration vocabulary |
| --- | --- |
| Yard, Drift, Imperial, Rebel, EarthForce, Klingon, USCM, Yautja | Tapered long-range housings, paired hangar housings, supported sensor platforms, low armor overlays, repeated support modules |
| Federation | Same mission families, with a supported dorsal mission pod for command/survey ships |
| Shoal, Minbari, Shadows, Mondoshawan, Engineers, First Ones | Sympathetic tapered lobes, sensory crests, layered carapaces and support growths; no metal-box fittings |
| Lattice, Choir | Angular fin/rib configurations, with different spread, height and repetition |
| Borg | Rectilinear extensions, with different length, height and repetition |

The labels describe appearance. They do not add healing, sensors, carrier launches or other new combat abilities. Some combinations are speculative even where the underlying class is established. Small craft receive size/finish variation and occasional compact patrol fittings rather than capital-sized modules. All 18 named heroes and Babylon 5 preserve their reference geometry.

Attachments use the original hull's triangle surface for placement; stations over a gap snap to a real face. Added equipment is excluded from weapon harvesting and turret seating. Hull size changes update geometry, bounds, muzzle positions and rotation dimensions together. Refits are baked into existing meshes during forging, not animated or constructed per frame.

## Review and validation

Open [Ship study](https://johnbr0phy.github.io/orbital-yard/tribute-new-models.html). Pick an EarthForce or Rebel **sisters** entry, select a refit, then use **Next hull** to compare individual ships of the same class. **Original class** shows the untouched generator output; **Line service** shows the cleaned and size-varied base. The study renders only on a control change or drag.

Validated all 18 families for deterministic, finite meshes and bounded fitting counts. The six Hyperion configurations are geometrically distinct and add 48–144 triangles at review tessellation. Hero geometry remains byte-identical. Class-pool tests cover the common EarthForce, Rebel and Federation slots. Static WebGL review covered a Hyperion command ship, Rebel carrier conversion Minbari armored morph and seeded Nebulon-B support ship; a CPU contact sheet compared six EarthForce classes.

The existing weapon, debris, paint, rendering and scaling checks pass. A bounded 26-ship Imperial/Rebel simulation produced 322 emissions in 40 simulated seconds, with 19 survivors and finite positions. This is a physics/combat regression check, not an FPS benchmark. The prior single-worker, prefracture, distant-ship and pixel-budget performance limits remain. Large-battle frame rate and balance across every new class combination have not been measured.

## Structural propulsion variants

A second pass replaces propulsion assemblies on three classes rather than adding more surface equipment:

| Class | Original model layout | Speculative alternatives |
| --- | --- | --- |
| Olympus | Two nacelles | Four stacked nacelles on vertical cradles; four widely spaced nacelles on a transverse spar |
| Hyperion | Four engine bells | Three larger, longer bells; six bells in two rows |
| CR90 | Eleven bells | Six heavy bells; fifteen smaller bells |

These alternatives are invented, not documented canonical modifications. The underlying class's forward hull and weapons remain; the tagged original drive assembly is removed before its replacement is built. Olympus changes its overall height or beam, with structural connections between its engines and existing aft hull. The seeded propulsion choice is independent of equipment refit, and appears in the battle ship card. Other classes retain their current propulsion layouts in this pass.

The study defaults to Olympus sisters. Choose **Propulsion** to hold a layout fixed, or **Assigned layout** to let the hull seed choose. **Rear / engines** exposes the engine bank. **Original class** bypasses both equipment and propulsion modifications. Named heroes remain protected. These are visual alternatives, with updated geometric bounds but no new thrust or speed ability.

Four additional tests verify actual engine counts, replacement rather than accumulation, unchanged forward geometry, deterministic choices and bounded mesh cost. At review quality the Olympus twin, stacked quad and wide quad models contain 624, 832 and 756 triangles respectively with line-service equipment. Static WebGL review checked stacked and wide Olympus layouts and the CR90 heavy bank. All previous regression checks pass; the updated bounded combat fixture produced 333 emissions and 17 survivors after 40 simulated seconds. No large-battle FPS claim is made.

## Nebulon-B silhouette rebuild

The user-supplied visual reference exposed a problem in the previous base model: both the forward blade and the aft engine housing were oversized rectangular masses. The replacement uses a flattened rounded upper bow, a narrow swept descending keel, separated irregular pod tiers, a high exposed boom, a compact tapered machinery stern, seven bells and ventral skegs. Its finish is muted gray. This is a low-polygon interpretation of the supplied image; model proportions are not authoritative dimensions.

Nebulon-B refits now rebuild assemblies rather than adding the generic deck housings. The six selectable configurations are escort keel, extended boom, hangar keel, split keel, armored keel and medical pod banks. The alternative assemblies are speculative visual designs, not assertions of documented canonical variants or new combat abilities. The study starts on Nebulon-B sisters and labels its Refit choices accordingly. These same assemblies are used by the battle forge.

Three tests verify six distinct finite meshes, the thin exposed boom/deep blade/compact seven-engine stern, and replacement of generic refit fittings. All previous regression checks pass. Static WebGL inspection covered the gray base silhouette; CPU contact sheets compared all six configurations. Each configuration remains below 6,000 triangles at study quality. The existing forge-worker and distant-rendering limits remain; large-battle FPS has not been remeasured.


## Rebel fleet expansion

The battle muster and ship study now include MC30c, Assault Frigate Mk II, Dreadnaught, Assault Frigate Mk I and Marauder. Liberty has a broad winged hull; MC75 has a deep body and suspended command tower. U-wing shoulders now carry four engines. New heavy hull refits rebuild their assembly: extended drives, broader carrier shoulders, command structures, armor and support pods. These are procedural interpretations and invented refits, not claims of exact canon geometry or statistics.

Visual references: [Liberty](https://www.fantasyflightgames.com/en/news/2016/6/29/the-liberty/), [MC30](https://www.fantasyflightgames.com/en/news/2015/9/23/race-into-battle/), [Assault Frigate II](https://www.fantasyflightgames.com/edge_news.asp?eidn=5348), [Profundity](https://www.starwars.com/databank/profundity), and the user's Empire at War comparison chart. Dreadnaught, Assault Frigate I and Marauder interpretations follow the chart's Legends/game fleet mix. Nominal dimensions and crew are game model metadata.

Validation: 42 new heavy-hull/refit combinations produce finite meshes below 4,500 triangles at review quality; all five new classes are reachable by battle selection. A bounded 26-ship CPU combat check passes. No large-fleet GPU frame-rate claim is made. Existing forge and rendering performance limits remain in place.

## Fleet variety pass (VARIETY.md)

The refits above made individual ships different; they did not make a fleet read as a navy of different jobs. A clay contact sheet of main showed most tribute fleets as one shape at several sizes, and sister ships as clones (median sister distance 0.000 to 0.011, scale jitter only). This pass works at three levels, each measured by `scripts/variety-report.cjs` and defined in VARIETY.md: which classes a band deals (pools), how sisters of one class differ (variant kits), and which lengths a class may fly at (role lock).

### Band pools

Every fleet with named classes deals each muster band from its own pool. The table is read from the page's pool tables by `scripts/variety-pools.cjs`, so it cannot drift from what the forge deals; `tests/tribute-new/variety.test.cjs` checks that every entry is really dealt in its band. The originals (Yard, Shoal, Lattice, Drift, Choir) forge one-off designs and have no pools; Rebel and Tyranid pools are unchanged.

<!-- POOL-TABLE -->
| fleet | band | pool (share of the band's jobs) | why |
|---|---|---|---|
| Imperial | small | Tie/Ln Starfighter 30%, Tie/In Interceptor 20%, Tie/Sa Bomber 16%, Tie Advanced X1 6%, Tie/D Defender 10%, Lambda-Class Shuttle 18% | TIEs stay the screen, but no single mark over a third, and the Lambda flies with them, so the screen reads as several jobs. |
| Imperial | escort | Gozanti-Class Cruiser 34%, Raider-Class Corvette 33%, Arquitens-Class Cruiser 33% | Three distinct escort hulls in near-equal shares; the Arquitens' longer dagger is the largest share because it is the line's picket. |
| Imperial | capital | Victory-Class Destroyer 36%, Immobilizer 418 Interdictor 22%, Carrack-Class Light Cruiser 22%, Quasar Fire-Class Carrier 20% | The Victory's dagger is the largest share, but the Carrack and Quasar Fire put non-dagger capitals in every line. |
| Minbari | small | Nial-Class Heavy Fighter 45%, Tishat-Class Medium Fighter 30%, Minbari Flyer 25% | The Nial remains the Minbari fighter; the reshaped Tishat and the Flyer give the screen three plans instead of one. |
| Minbari | escort | Torotha-Class Assault Frigate 40%, Tinashi-Class War Frigate 35%, Leshath-Class Heavy Scout 25% | Torotha and Tinashi carry most of the line; the slim Leshath scout breaks up the three-fin silhouette. |
| Minbari | capital | Tigara-Class Attack Cruiser 40%, Morshin-Class Carrier 35%, Sharlin-Class War Cruiser 25% | The Sharlin is now dealt as a normal capital (the old roll's r<.94?4:5 cutoff never reached it). |
| Shadows | small | Shadow Fighter 45%, Shadow Scout 30%, Drakh Light Raider 25% | Shadow fighters outnumber scouts, as the vessels carry them; Drakh raiders are the servants' screen. |
| Shadows | escort | Shadow Hunter 60%, Drakh Heavy Raider 40% | The hunter is the Shadows' own frigate; heavy raiders give the line a second, non-crab plan. |
| Shadows | capital | Shadow Vessel 50%, Shadow Hybrid 22%, Drakh Cruiser 28% | The battlecrab stays half the line; hybrid and Drakh cruiser keep it from being one crab at every size. |
| EarthForce | small | Sa-23e Aurora Starfury 40%, Sa-32a Thunderbolt Starfury 28%, Earth Alliance Shuttle 32% | The Aurora stays the most common; the Thunderbolt and the shuttle keep it under half. |
| EarthForce | escort | Olympus-Class Corvette 50%, Sagittarius-Class Missile Cruiser 50% | Olympus and Sagittarius in equal shares; the Olympus drive layouts add plans inside the class. |
| EarthForce | capital | Hyperion-Class Heavy Cruiser 26%, Omega-Class Destroyer 24%, Avenger-Class Heavy Carrier 14%, Nova-Class Dreadnought 20%, Poseidon-Class Supercarrier 16% | Five capital plans; Hyperion and Omega lead as the war's workhorses, Nova and Poseidon add the heavy line. |
| Federation | small | Peregrine-Class Fighter 30%, Danube-Class Runabout 24%, Type-6 Shuttlecraft 24%, Type-9 Shuttlecraft 22% | Fighter, runabout and shuttle: three small-craft jobs. |
| Federation | escort | Oberth-Class Science Vessel 21%, Defiant-Class Escort 12%, Miranda-Class Cruiser 24%, Intrepid-Class Explorer 22%, Steamrunner-Class Cruiser 21% | Five escort classes in near-equal shares, as the old roll had them. |
| Federation | capital | Constitution-Class Heavy Cruiser 25%, Nebula-Class Explorer 25%, Akira-Class Heavy Cruiser 25%, Excelsior-Class Cruiser 25% | Four heavy classes in equal shares. |
| Klingon | small | D'ktagh-Class Shuttlecraft 35%, Hegh'gogh-Class Heavy Fighter 35%, To'duj-Class Fighter 30% | Shuttle, heavy fighter and To'Duj in near-equal shares. |
| Klingon | escort | F5-Class Frigate 25%, D6s-Class Scout Cruiser 25%, K'vort-Class Heavy Bird-Of-Prey 25%, D7-Class Battlecruiser 25% | The D7 flies here only, so the capital band is not D7s beside the K't'inga they grew into. |
| Klingon | capital | K't'inga-Class Battlecruiser 30%, B'rel-Class Bird-Of-Prey 25%, F15-Class Destroyer 20%, Vor'cha-Class Attack Cruiser 25% | K't'inga, B'rel, F15 and Vor'cha: four silhouettes, none over a third. |
| Borg | small | Borg Scout Ship 40%, Assimilated Shuttle 30%, Long-Range Probe 30% | The small band was 95% probes on main; the scout and assimilated shuttle give it three plans. |
| Borg | escort | Long-Range Probe 36%, Assimilated Vessel (Ring-Pattern) 30%, Tactical Diamond 34% | Probe, assimilated vessel and diamond in near-equal shares. |
| Borg | capital | Sphere 33%, Tactical Cube 36%, Tactical Diamond 31% | The sphere and diamond are joined by the tactical cube (under the crown threshold), so no capital plan is half the line. |
| Mondoshawan | small | Zfx200 Mercenary Fighter 30%, Mangalore Raider Gunship 25%, Ny Flying Cab 15%, Ny Police Cruiser 15%, Angel-Wing Executive Yacht 15% | Five small classes; the cab and police cruiser are now different bodies. |
| Mondoshawan | escort | Mondoshawan Ship 28%, Angel-Wing Executive Yacht 22%, Mangalore Assault Ship 26%, Fhloston Spaceliner 24% | The Mondoshawan ship was 71% of the escort band; the yacht and the Mangalore assault ship now share it. |
| Mondoshawan | capital | Earth Federal Battle Cruiser 34%, Fhloston-Class Pleasure Liner 30%, Mangalore Warship 36% | Main had no normal capital-band class at all (0% reach); the battle cruiser and liner come from the fleet's own library. |
| USCM | small | Ud-4l Cheyenne Dropship 44%, Type 337 Eev Escape Pod 8%, Narcissus-Class Shuttle 20%, Covenant Lander 28% | The Cheyenne stays the largest share; the lander, shuttle and EEV keep it under half. |
| USCM | escort | Conestoga-Class Troop Transport 30%, Cm-88b Bison Star Freighter 25%, Heliades-Class Exploration Vessel 25%, Betty-Class Tramp Freighter 20% | The escort band was 98% Conestoga transports; the Bison star freighter now shares it. |
| USCM | capital | Tientsin-Class Assault Ship 34%, Heliades-Class Exploration Vessel 33%, Conestoga-Class Medical Frigate 33% | Three capital classes in near-equal shares, as before. |
| Engineers | small | Engineer Eva Skiff 35%, Pilot-Chair Gunship 35%, Ampule Dart 30% | Main's screen was one horseshoe; skiff, chair gunship and ampule dart share it. |
| Engineers | escort | Sentinel-Class Patrol Croissant 40%, Orrery Seed Vessel 30%, Ampule Carrier 30% | Main's line was the same horseshoe; Sentinel, orrery and ampule carrier share it. |
| Engineers | capital | Juggernaut-Class Voidwright 66%, Temple Ship 34% | The Juggernaut stays two thirds of the capital line, in four structural variants; the temple ship is the rest. |
| Yautja | small | Yautja Scout Ship 34%, Single-Pilot Drop Pod 22%, Enforcer-Caste Cruiser 24%, Feral Hunter's Ship 20% | The scout ship was 59% of the screen; pod, Enforcer and Prey ship share it. |
| Yautja | escort | Lost Tribe Sewer-Ship 40%, Wolf-Class Militant Scout 35%, Enforcer-Caste Cruiser 25% | Sewer-ship, Wolf and Enforcer. |
| Yautja | capital | Elder Horseshoe Trophy Barge 34%, Golden Clan Ship 33%, Yautja Mothership 33% | Capital jobs used to fall back to Wolf scouts (41% reach); the barge and clan ship are real capitals. |
| Romulans | small | Reman Scorpion Fighter 40%, Romulan Shuttle 30%, Romulan Drone Ship 30% | Main's small band was only the shuttle; the Scorpion and drone ship join it. |
| Romulans | escort | Romulan Scout 35%, Romulan Bird-Of-Prey 35%, Tos Bird-Of-Prey 30% | The scout was a half-size bird-of-prey on main; it and the TOS bird-of-prey now have their own plans. |
| Romulans | capital | D’deridex Warbird 35%, Valdore Warbird 35%, Reman Scimitar Warbird 30% | D'deridex and Valdore as before, with the Scimitar. |
| Dominion | small | Jem'hadar Attack Ship 30%, Cardassian Hideki Corvette 26%, Jem'hadar Shuttle 22%, Breen Raider 22% | The attack ship stays the largest share; Hideki and shuttle (never in the old pool) share the rest. |
| Dominion | escort | Jem'hadar Heavy Escort 35%, Cardassian Galor Warship 65% | The heavy escort was the attack ship at twice the size; it now has its own plan, and the Galor/Keldon is the Cardassian line. |
| Dominion | capital | Jem'hadar Battlecruiser 27%, Jem'hadar Battleship 22%, Breen Warship 27%, Cardassian Keldon Cruiser 24% | Battlecruiser, battleship (now in the normal pool) and Breen warship in near-equal shares. |
| Space Marines | small | Thunderhawk Gunship 25%, Storm Eagle 20%, Xiphon Interceptor 20%, Caestus Assault Ram 17%, Drop Pod 18% | Five small craft, none over a quarter. The boarding torpedo is modelled but out of the pool: in clay it read as the Yard's small craft. |
| Space Marines | escort | Hunter Destroyer 26%, Gladius Frigate 26%, Nova Frigate 26%, Stormbird Gunship 22% | Hunter, Gladius and Nova were one armoured spine on main; each has its own plan now, with the Stormbird. |
| Space Marines | capital | Strike Cruiser 34%, Vanguard Light Cruiser 26%, Battle Barge 22%, Space Hulk 18% | Strike cruiser leads; the leaner Vanguard, the barge and the space hulk share the rest. |
| Tesla | small | Optimus Blaster 28%, Optimus Heavy 12%, Starlink Swarmsat 20%, Cargo Dragon 20%, Cybertruck Gunship 20% | Optimus robots were 75% of the screen; Starlink, Dragon and Cybertruck share it. |
| Tesla | escort | Falcon 9 55%, Falcon Heavy 45% | Falcon 9 and Falcon Heavy, each with its configurations (payload, fairing open or closed, Heavy at booster separation). |
| Tesla | capital | Starship 40%, Starship / Super Heavy 35%, Gigafactory Carrier 25% | Starship and the stack with the Gigafactory carrier. |
<!-- /POOL-TABLE -->

### Variant kits

A sister must differ from her sisters by something a builder would change, and stay closer to them than to any other class of her fleet (VARIETY.md, sister spread). The kits:

- **Proportions, per class.** For the classes that were clones on main (Imperial, Rebel, EarthForce, Federation, Klingon, Borg, Mondoshawan, USCM, Yautja) and the tribute navies' own classes, each hull stretches its length, beam and height by a few percent from its seed. The amplitude is set per class (`VY_SISTER_K`) so the class clears the clone floor with a margin and no more: thin sail and blade classes (TIE, bird-of-prey) need far less than a compact pod does. For the classes whose sisters crowded another fleet's silhouettes, the direction is set as well (`VY_SISTER_AXIS`): a Defiant's sisters are only ever flatter, a GR-75's sisters vary in length only, a Yautja scout only grows. Each direction was chosen by measuring how many of the original fleets' hulls a class's sisters would crowd (VARIETY.md, "Recognition"). Weapon and engine sockets move with the parts.
- **Structure, where the canon has it.** Gozanti walker carriers (a fifth of the class); tactical cubes with a sphere docked in the bow face (a fifth); Shadow Vessels in four plans (long-legged, swept, grasping, juvenile) and a battle scar; the Engineers' Juggernaut intact, with a broken horn, a closed ring or fused horns; the orrery's four arms; Falcons (legs always out) with a Dragon, a closed fairing or the fairing open on a Starlink stack, and a third of Falcon Heavies at booster separation; a quarter of Starships as the HLS lander; super-heavy stacks with or without the hot-staging ring; Galor or Keldon; Cargo Dragon with the nose open; the Miranda with or without her roll bar; the Tyranid spore drone's tendril reach and bladder, the boarding worm's coil.
- **The Sharlin** flies with half the Minbari refit stretch, so she still reads as the Sharlin at 1.6 km and 1.2 km.
- **Originals.** No sister classes: every hull is its own design. Their capital jobs forge the fleet's own long designs (MODELS-NEW.md).

### Role lock

The ship minds read length, not shape: the band cuts, the gunboat line (80 m), fighter attack runs (under 120 m), spool steps (60 m and 180 m), the Shadow crown line (180 m) and capitals (300 m). Every class declares its role and the length range its hulls fly at, measured over both musters of every fleet by `scripts/variety-roles.cjs`. `tests/tribute-new/variety.test.cjs` fails when a hull leaves its declared range or crosses a threshold its class does not declare.

<!-- ROLE-TABLE -->
| Fleet | Class | Role | Length range | Thresholds crossed |
| --- | --- | --- | --- | --- |
| Imperial | CARRACK-CLASS LIGHT CRUISER | gunboat, capital | 249-398 m | 300 |
| Imperial | IMMOBILIZER 418 INTERDICTOR | gunboat, capital | 522-752 m | none |
| Imperial | VICTORY-CLASS DESTROYER | gunboat, capital | 765-1189 m | none |
| Imperial | QUASAR FIRE-CLASS CARRIER | gunboat, capital | 317-463 m | none |
| Imperial | GOZANTI-CLASS CRUISER | attack runs | 42-62 m | 60 |
| Imperial | RAIDER-CLASS CORVETTE | attack runs | 55-80 m | 60 |
| Imperial | ARQUITENS-CLASS CRUISER | gunboat, attack runs | 66-95 m | 80 |
| Imperial | TIE/LN STARFIGHTER | screen, attack runs | 7-8 m | none |
| Imperial | TIE/SA BOMBER | screen, attack runs | 7-9 m | none |
| Imperial | TIE/IN INTERCEPTOR | screen, attack runs | 9-11 m | none |
| Imperial | LAMBDA-CLASS SHUTTLE | screen, attack runs | 18-22 m | none |
| Imperial | TIE ADVANCED X1 | screen, attack runs | 8-10 m | none |
| Imperial | TIE/D DEFENDER | screen, attack runs | 10-12 m | none |
| Rebel | CR90-CLASS CORVETTE | gunboat | 123-186 m | 180 |
| Rebel | NEBULON-B ESCORT FRIGATE | gunboat, capital | 243-360 m | 300 |
| Rebel | PELTA-CLASS FRIGATE | gunboat | 95-137 m | 120 |
| Rebel | GR-75 MEDIUM TRANSPORT | gunboat, attack runs | 74-116 m | 80, 95 |
| Rebel | DP20 CORELLIAN GUNSHIP | gunboat, attack runs | 67-104 m | 80, 95 |
| Rebel | SPHYRNA-CLASS HAMMERHEAD CORVETTE | gunboat, attack runs | 65-95 m | 80 |
| Rebel | BTL-A4 Y-WING | screen, attack runs | 15-18 m | none |
| Rebel | A/SF-01 B-WING | screen, attack runs | 3-3 m | none |
| Rebel | T-65 X-WING | screen, attack runs | 12-15 m | none |
| Rebel | RZ-1 A-WING | screen, attack runs | 6-8 m | none |
| Rebel | UT-60D U-WING | screen, attack runs | 25-31 m | none |
| Minbari | TIGARA-CLASS ATTACK CRUISER | gunboat, capital | 660-1058 m | none |
| Minbari | MORSHIN-CLASS CARRIER | gunboat, capital | 1026-1458 m | none |
| Minbari | SHARLIN-CLASS WAR CRUISER | gunboat, capital | 1296-1998 m | none |
| Minbari | LESHATH-CLASS HEAVY SCOUT | gunboat, capital | 259-416 m | 300 |
| Minbari | TINASHI-CLASS WAR FRIGATE | gunboat, capital | 439-650 m | none |
| Minbari | TOROTHA-CLASS ASSAULT FRIGATE | gunboat, capital | 224-351 m | 300 |
| Minbari | MINBARI FLYER | screen, attack runs | 23-30 m | none |
| Minbari | NIAL-CLASS HEAVY FIGHTER | screen, attack runs | 19-25 m | none |
| Minbari | TISHAT-CLASS MEDIUM FIGHTER | screen, attack runs | 14-19 m | none |
| Shadows | SHADOW HYBRID | capital | 349-655 m | none |
| Shadows | SHADOW VESSEL | capital | 1010-2045 m | none |
| Shadows | DRAKH CRUISER | capital | 210-478 m | 300 |
| Shadows | SHADOW HUNTER | attack runs | 57-95 m | 60, 80 |
| Shadows | DRAKH HEAVY RAIDER | attack runs | 44-86 m | 60, 80 |
| Shadows | SHADOW FIGHTER | screen, attack runs | 16-23 m | none |
| Shadows | SHADOW SCOUT | screen, attack runs | 33-41 m | none |
| Shadows | DRAKH LIGHT RAIDER | screen, attack runs | 26-36 m | none |
| EarthForce | OMEGA-CLASS DESTROYER | gunboat, capital | 879-1381 m | none |
| EarthForce | NOVA-CLASS DREADNOUGHT | gunboat, capital | 935-1443 m | none |
| EarthForce | AVENGER-CLASS HEAVY CARRIER | gunboat | 106-149 m | 120 |
| EarthForce | POSEIDON-CLASS SUPERCARRIER | gunboat, capital | 992-1495 m | none |
| EarthForce | HYPERION-CLASS HEAVY CRUISER | gunboat, capital | 839-1296 m | none |
| EarthForce | SAGITTARIUS-CLASS MISSILE CRUISER | attack runs | 49-77 m | 60 |
| EarthForce | OLYMPUS-CLASS CORVETTE | attack runs | 42-58 m | none |
| EarthForce | SA-23E AURORA STARFURY | screen, attack runs | 8-11 m | none |
| EarthForce | EARTH ALLIANCE SHUTTLE | screen, attack runs | 14-21 m | none |
| EarthForce | SA-32A THUNDERBOLT STARFURY | screen, attack runs | 17-21 m | none |
| Federation | AKIRA-CLASS HEAVY CRUISER | gunboat | 95-145 m | 120 |
| Federation | CONSTITUTION-CLASS HEAVY CRUISER | gunboat, capital | 240-371 m | 300 |
| Federation | NEBULA-CLASS EXPLORER | gunboat | 95-133 m | 120 |
| Federation | EXCELSIOR-CLASS CRUISER | gunboat, capital | 374-554 m | none |
| Federation | MIRANDA-CLASS CRUISER | attack runs | 49-76 m | 60 |
| Federation | INTREPID-CLASS EXPLORER | gunboat, attack runs | 68-95 m | 80 |
| Federation | STEAMRUNNER-CLASS CRUISER | gunboat, attack runs | 77-95 m | 80 |
| Federation | OBERTH-CLASS SCIENCE VESSEL | attack runs | 42-54 m | none |
| Federation | DEFIANT-CLASS ESCORT | attack runs | 42-64 m | 60 |
| Federation | PEREGRINE-CLASS FIGHTER | screen, attack runs | 11-13 m | none |
| Federation | TYPE-6 SHUTTLECRAFT | screen, attack runs | 9-12 m | none |
| Federation | TYPE-9 SHUTTLECRAFT | screen, attack runs | 10-13 m | none |
| Federation | DANUBE-CLASS RUNABOUT | screen, attack runs | 20-24 m | none |
| Klingon | K'T'INGA-CLASS BATTLECRUISER | gunboat | 165-258 m | 180 |
| Klingon | F15-CLASS DESTROYER | gunboat | 105-154 m | 120 |
| Klingon | B'REL-CLASS BIRD-OF-PREY | gunboat | 99-135 m | 120 |
| Klingon | VOR'CHA-CLASS ATTACK CRUISER | gunboat | 137-234 m | 180 |
| Klingon | D6S-CLASS SCOUT CRUISER | attack runs | 51-80 m | 60 |
| Klingon | K'VORT-CLASS HEAVY BIRD-OF-PREY | gunboat, attack runs | 64-95 m | 80 |
| Klingon | F5-CLASS FRIGATE | attack runs | 42-62 m | 60 |
| Klingon | D7-CLASS BATTLECRUISER | gunboat, attack runs | 84-95 m | none |
| Klingon | D'KTAGH-CLASS SHUTTLECRAFT | screen, attack runs | 11-14 m | none |
| Klingon | HEGH'GOGH-CLASS HEAVY FIGHTER | screen, attack runs | 20-24 m | none |
| Klingon | TO'DUJ-CLASS FIGHTER | screen, attack runs | 13-19 m | none |
| Borg | TACTICAL CUBE | gunboat | 172-285 m | 180 |
| Borg | TACTICAL DIAMOND | gunboat | 71-163 m | 80, 95, 120 |
| Borg | SPHERE | gunboat, capital | 468-733 m | none |
| Borg | ASSIMILATED VESSEL (RAPTOR-PATTERN) | attack runs | 51-77 m | 60 |
| Borg | LONG-RANGE PROBE | attack runs | 31-58 m | 42 |
| Borg | ASSIMILATED VESSEL (RING-PATTERN) | attack runs | 51-78 m | 60 |
| Borg | ASSIMILATED SHUTTLE | screen, attack runs | 17-21 m | none |
| Borg | BORG SCOUT SHIP | screen, attack runs | 27-34 m | none |
| Mondoshawan | FHLOSTON-CLASS PLEASURE LINER | gunboat | 184-300 m | none |
| Mondoshawan | EARTH FEDERAL BATTLE CRUISER | gunboat | 180-300 m | none |
| Mondoshawan | MANGALORE WARSHIP | gunboat, capital | 186-314 m | 300 |
| Mondoshawan | FHLOSTON SPACELINER | gunboat, attack runs | 60-95 m | 80 |
| Mondoshawan | MONDOSHAWAN SHIP | attack runs | 42-63 m | 60 |
| Mondoshawan | MANGALORE ASSAULT SHIP | gunboat, attack runs | 64-95 m | 80 |
| Mondoshawan | ANGEL-WING EXECUTIVE YACHT | attack runs | 37-55 m | 42 |
| Mondoshawan | NY FLYING CAB | screen, attack runs | 8-10 m | none |
| Mondoshawan | MANGALORE RAIDER GUNSHIP | screen, attack runs | 34-40 m | none |
| Mondoshawan | ZFX200 MERCENARY FIGHTER | screen, attack runs | 17-20 m | none |
| Mondoshawan | NY POLICE CRUISER | screen, attack runs | 11-12 m | none |
| USCM | CONESTOGA-CLASS MEDICAL FRIGATE | gunboat | 97-144 m | 120 |
| USCM | TIENTSIN-CLASS ASSAULT SHIP | gunboat | 101-158 m | 120 |
| USCM | HELIADES-CLASS EXPLORATION VESSEL | gunboat | 63-152 m | 80, 95, 120 |
| USCM | CONESTOGA-CLASS TROOP TRANSPORT | gunboat, attack runs | 65-95 m | 80 |
| USCM | BETTY-CLASS TRAMP FREIGHTER | gunboat, attack runs | 50-91 m | 60, 80 |
| USCM | CM-88B BISON STAR FREIGHTER | gunboat, attack runs | 66-95 m | 80 |
| USCM | UD-4L CHEYENNE DROPSHIP | screen, attack runs | 23-28 m | none |
| USCM | NARCISSUS-CLASS SHUTTLE | screen, attack runs | 16-20 m | none |
| USCM | COVENANT LANDER | screen, attack runs | 25-35 m | none |
| USCM | TYPE 337 EEV ESCAPE POD | screen, attack runs | 12-14 m | none |
| Engineers | JUGGERNAUT-CLASS VOIDWRIGHT | gunboat | 138-213 m | 180 |
| Engineers | TEMPLE SHIP | gunboat | 164-300 m | 180 |
| Engineers | SENTINEL-CLASS PATROL CROISSANT | gunboat, attack runs | 56-86 m | 60, 80 |
| Engineers | ORRERY SEED VESSEL | gunboat, attack runs | 49-95 m | 60, 80 |
| Engineers | AMPULE CARRIER | gunboat, attack runs | 54-95 m | 60, 80 |
| Engineers | PILOT-CHAIR GUNSHIP | screen, attack runs | 19-28 m | none |
| Engineers | ENGINEER EVA SKIFF | screen, attack runs | 14-18 m | none |
| Engineers | AMPULE DART | screen, attack runs | 23-35 m | none |
| Yautja | YAUTJA MOTHERSHIP | gunboat, capital | 224-338 m | 300 |
| Yautja | GOLDEN CLAN SHIP | gunboat | 190-300 m | none |
| Yautja | ELDER HORSESHOE TROPHY BARGE | gunboat | 173-266 m | 180 |
| Yautja | WOLF-CLASS MILITANT SCOUT | gunboat, attack runs | 66-95 m | 80 |
| Yautja | LOST TRIBE SEWER-SHIP | attack runs | 44-71 m | 60 |
| Yautja | ENFORCER-CASTE CRUISER | attack runs | 35-46 m | 42 |
| Yautja | FERAL HUNTER'S SHIP | screen, attack runs | 18-27 m | none |
| Yautja | YAUTJA SCOUT SHIP | screen, attack runs | 23-29 m | none |
| Yautja | SINGLE-PILOT DROP POD | screen, attack runs | 9-10 m | none |
| First Ones | WALKERS OF SIGMA 957 | gunboat, capital | 2522-2678 m | none |
| First Ones | KIRISHIAC LORDSHIP | gunboat, capital | 2134-2266 m | none |
| First Ones | MINDRIDER THOUGHTFORCE | gunboat, capital | 1940-2060 m | none |
| First Ones | TRIAD TRIUMVIRON | gunboat, capital | 2037-2163 m | none |
| First Ones | TORVALUS DARK KNIFE | gunboat, capital | 3298-3502 m | none |
| First Ones | THE FIRST BORN | gunboat, capital | 1552-1648 m | none |
| First Ones | VORLON TRANSPORT | gunboat, capital | 1746-1854 m | none |
| First Ones | HAND SERVITOR VESSEL | gunboat, capital | 1843-1957 m | none |
| Romulans | REMAN SCIMITAR WARBIRD | gunboat, capital | 751-888 m | none |
| Romulans | VALDORE WARBIRD | gunboat, capital | 594-709 m | none |
| Romulans | D’DERIDEX WARBIRD | gunboat, capital | 1009-1166 m | none |
| Romulans | TOS BIRD-OF-PREY | gunboat | 137-164 m | none |
| Romulans | ROMULAN BIRD-OF-PREY | gunboat | 192-229 m | none |
| Romulans | ROMULAN SCOUT | gunboat, attack runs | 91-109 m | none |
| Romulans | REMAN SCORPION FIGHTER | screen, attack runs | 15-17 m | none |
| Romulans | ROMULAN SHUTTLE | screen, attack runs | 22-26 m | none |
| Romulans | ROMULAN DRONE SHIP | screen, attack runs | 27-33 m | none |
| Dominion | BREEN WARSHIP | gunboat, capital | 438-523 m | none |
| Dominion | CARDASSIAN KELDON CRUISER | gunboat, capital | 310-371 m | none |
| Dominion | JEM'HADAR BATTLECRUISER | gunboat, capital | 568-675 m | none |
| Dominion | JEM'HADAR BATTLESHIP | gunboat, capital | 1168-1358 m | none |
| Dominion | JEM'HADAR HEAVY ESCORT | gunboat | 211-250 m | none |
| Dominion | CARDASSIAN GALOR WARSHIP | gunboat | 219-262 m | none |
| Dominion | CARDASSIAN HIDEKI CORVETTE | screen, gunboat, attack runs | 92-109 m | none |
| Dominion | JEM'HADAR ATTACK SHIP | screen, gunboat, attack runs | 100-120 m | none |
| Dominion | BREEN RAIDER | screen, attack runs | 57-68 m | 60 |
| Dominion | JEM'HADAR SHUTTLE | screen, attack runs | 26-31 m | none |
| Space Marines | BATTLE BARGE | gunboat, capital | 1368-1632 m | none |
| Space Marines | VANGUARD LIGHT CRUISER | gunboat, capital | 394-467 m | none |
| Space Marines | STRIKE CRUISER | gunboat, capital | 714-848 m | none |
| Space Marines | SPACE HULK | gunboat, capital | 1066-1251 m | none |
| Space Marines | HUNTER DESTROYER | gunboat | 120-142 m | none |
| Space Marines | GLADIUS FRIGATE | gunboat | 173-207 m | 180 |
| Space Marines | NOVA FRIGATE | gunboat | 220-262 m | none |
| Space Marines | STORMBIRD GUNSHIP | attack runs | 66-79 m | none |
| Space Marines | STORM EAGLE | screen, attack runs | 31-37 m | none |
| Space Marines | CAESTUS ASSAULT RAM | screen, attack runs | 23-27 m | none |
| Space Marines | XIPHON INTERCEPTOR | screen, attack runs | 19-23 m | none |
| Space Marines | THUNDERHAWK GUNSHIP | screen, attack runs | 26-32 m | none |
| Space Marines | DROP POD | screen, attack runs | 11-13 m | none |
| Tyranids | HIVE SHIP | gunboat, capital | 1189-1419 m | none |
| Tyranids | RAZORFIEND CRUISER | gunboat, capital | 593-706 m | none |
| Tyranids | VOID PROWLER | gunboat, capital | 385-456 m | none |
| Tyranids | DEVOURER CRUISER | gunboat, capital | 840-1002 m | none |
| Tyranids | VANGUARD DRONE SHIP | gunboat | 219-262 m | none |
| Tyranids | ESCORT DRONE | gunboat | 192-229 m | none |
| Tyranids | KRAKEN BIO-SHIP | gunboat | 137-164 m | none |
| Tyranids | SPORE DRONE | screen, attack runs | 17-21 m | none |
| Tyranids | BOARDING WORM | screen, attack runs | 32-38 m | none |
| Tyranids | ATTACK ORGANISM | screen, attack runs | 30-36 m | none |
| Tesla | STARSHIP | gunboat | 111-130 m | 120 |
| Tesla | GIGAFACTORY CARRIER | gunboat | 213-250 m | none |
| Tesla | STARSHIP / SUPER HEAVY | gunboat | 192-228 m | none |
| Tesla | FALCON 9 | attack runs | 64-76 m | none |
| Tesla | FALCON HEAVY | attack runs | 66-79 m | none |
| Tesla | OPTIMUS HEAVY | screen, attack runs | 7-9 m | none |
| Tesla | OPTIMUS BLASTER | screen, attack runs | 5-7 m | none |
| Tesla | CYBERTRUCK GUNSHIP | screen, attack runs | 13-15 m | none |
| Tesla | STARLINK SWARMSAT | screen, attack runs | 11-13 m | none |
| Tesla | CARGO DRAGON | screen, attack runs | 8-10 m | none |
<!-- /ROLE-TABLE -->
