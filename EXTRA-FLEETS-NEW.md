# Five more Tribute New fleets

Adds race IDs 18–22 without changing the existing IDs. All five appear in Curate War, random battles, reinforcements, the ship study and captain study. Each has a named hero. Tesla is the requested fictional combined Tesla/SpaceX army, not a claim about real military equipment.

| Fleet | Class roster | Battle identity |
| --- | --- | --- |
| Romulan Star Empire | Shuttle, scout, Bird-of-Prey, Valdore, D'deridex | Green disruptors, ambush AI, cloaking including capital hulls. The D'deridex has separated upper/lower wings and an empty central volume. |
| Dominion | Shuttle, attack ship, heavy escort, battlecruiser, battleship | Violet beam weapons and aggressive, disciplined pack attacks. Curved shoulders and swept outboard drives distinguish it from Starfleet saucers. |
| Space Marines | Thunderhawk, Hunter, Gladius, Nova, Vanguard, strike cruiser, battle barge, Xiphon, Caestus, Storm Eagle, Gloriana hero | Heavy armour, broadside AI, kinetic bursts and missiles. Hunter torpedo shoulders, Gladius wings and Nova lance/drive outriggers distinguish escorts. |
| Tyranids | Spore drone, attack organism, Kraken, Vanguard drone, Razorfiend, hive ship, Void Prowler, Devourer, boarding worm, escort drone | Swarm AI, biological plasma and organic destruction. Overlapping carapaces, ribs, jaws, hooked limbs and aft tendrils. |
| Tesla | Optimus Blaster, Optimus Heavy, Falcon 9, Falcon Heavy, Starship, Starship/Super Heavy, Roadster/Starman | Robot-heavy muster, rapid blue pulses, fast skirmishing and rocket exhaust. Roadster hero has an open cockpit, driver, windscreen frame and four wheels. |

## Interpretation and references

These are low-poly procedural interpretations. Lengths are compressed for the game's formations, rather than a canonical scale chart. Seeded configurations vary proportions, wing spans, armour banks, carapace counts, limb reach and drive layouts. New hulls bypass generic random block refits and preserve their authored weapon sockets.

- [StarTrek.com: The Starships of the Dominion War](https://www.startrek.com/news/the-starships-of-the-dominion-war): Romulan and Dominion vessel families and tactical context.
- [StarTrek.com: Inside the Romulan Warbird Valdore](https://www.startrek.com/news/inside-the-romulan-warbird-valdore): Valdore reference.
- [StarTrek.com: The Dominion](https://www.startrek.com/news/star-trek-101-the-dominion): Jem'Hadar and Dominion context.
- [Battlefleet Gothic Remastered: Space Marines](https://battlefleet-game.org/fleet-lists/space-marines/): barge, cruiser and escort roster. This is a community presentation of the tabletop fleet, not a new GW release.
- [Battlefleet Gothic Remastered: Tyranids](https://battlefleet-game.org/fleet-lists/tyranids/) and [archived Fanatic Tyranid tactics](https://www.specialist-arms.com/fanatic/07tt.pdf): hive, cruiser, Kraken and Vanguard distinctions.
- [SpaceX Falcon user's guide](https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf), [Starship user's guide](https://www.spacex.com/media/starship_users_guide_v1.pdf): rocket structure and silhouette references.
- [SpaceX: Falcon Heavy & Starman](https://www.youtube.com/watch?v=A0FZIwabctw): the original Roadster payload, not the newer Roadster concept.
- [Tesla AI & Robotics](https://www.tesla.com/AI): Optimus body reference.

Dominion heavy escort and the two small Tyranid organism labels are game adaptations, not claims of canonical named ship classes. Tesla weapons, flight-capable Optimus and alternative Starship drive configurations are fictional. Hero names other than the Roadster/Starman are original fleet flavour. Captains are seeded Romulans, Jem'Hadar, helmeted Astartes, Tyranid synapse organisms, Optimus or Starman; no external portrait requests.

## Validation and cost

`extra-fleets.test.cjs` checks all 29 classes for finite, bounded geometry and deterministic generation; real worker output in all three muster bands; native guns; fleet composition, heroes, AI/weapon coverage and cloaking; and new crew anatomy. Each class stays below 4,000 triangles at gallery quality. The battle retains its lower mesh quality, one forge worker, existing culling/distant-ship batching, engine/effect buffers and debris limits. No per-frame ship mesh generation or new render passes.

Also checked existing traffic, weapons, paint, crew, pilot firing, rendering and debris tests. Reviewed the actual WebGL ship previews and 3D crew contact sheet, plus a bounded small Tesla/Tyranid battle. This is not a full-fleet FPS benchmark.

## Marine model revision

Based on the [Space Marine Fleet](https://wh40k.lexicanum.com/wiki/Space_Marine_Fleet), [Battle Barge](https://wh40k.lexicanum.com/wiki/Battle_Barge) and [Strike Cruiser](https://wh40k.lexicanum.com/wiki/Strike_Cruiser) references: reinforced prows, recessed launch galleries, connected broadside batteries, tiered citadels and broad aft barge shoulders. Assault craft have separate authored silhouettes; the hero is Macragge’s Honour, a Gloriana interpretation. Seeded variants alter beam and engine banks. Four muted chapter-inspired finishes replace generic stripes; graphite machinery, restrained ivory markings and matte armour use the existing shader pass. Captain armour follows the ship’s livery seed. These are game-scale procedural interpretations rather than exact canon models.

## Tyranid organism revision

The [Lexicanum Tyranid Fleet roster](https://wh40k.lexicanum.com/wiki/Tyranid_Fleet) distinguishes hive ships, Devourer, Razorfiend, Void Prowler, Kraken, Vanguard and escort drones, and boarding organisms. The game now uses ten separate organism configurations: spherical spore bladders, winged attack organisms, claw-heavy escorts, long feeding tendrils, segmented boarding worms, acid sacs and swollen brood carriers. Forms are procedural interpretations; the roster mixes tabletop and video-game-derived categories as the reference does. Lengths remain compressed game scales.

Overlapping arched chitin, ventral ribs, dorsal horns and open mandibles replace the shared small-cruiser body. Seeded shell counts, girth and claw reach accompany three muted bone/chitin palettes. No mechanical engine exhaust or window lights. A dedicated vertex-shader deformation gently moves exposed tendrils while anchoring the core; weapon sockets use the same mathematical deformation. This adds no draw calls or per-frame mesh rebuilds. Ship-study previews include the new motion and stop automatically after 20 seconds. Capital steering retains the battle-flow pitch smoothing.

Checks cover 60 generated hulls under 4,000 triangles at study detail, ten distinct silhouette ratios, finite meshes, native weapon sockets, no exhaust, bounded anchored movement, rigid dead hulls, subdued finishes and capital attitude stability.

## Variety pass: new classes and provenance

The variety pass (VARIETY.md) added classes so that no band of these navies is one shape at several sizes. Everything below is a low-poly procedural interpretation at a compressed battle length. **Canon** means the class appears on screen or in the franchise's own publications; **licensed game** means an officially licensed game; **invented** means an original design in the fleet's language with no claim to canon. No mesh was imported.

| Fleet | Class | Band | Reference and status | What the model is |
| --- | --- | --- | --- | --- |
| Romulans | Reman Scorpion fighter | small | Canon: *Star Trek Nemesis* (2002), the Scimitar's attack fighters | Bat-like fighter, wings swept forward with drooping blade tips |
| Romulans | Romulan drone ship | small | Canon: *Star Trek: Enterprise*, "Babel One" (2005) | Unmanned bird form, raked wings, no cockpit; compressed to a small craft |
| Romulans | TOS bird-of-prey | escort | Canon: *Star Trek*, "Balance of Terror" (1966) | Saucer hull with two outboard nacelles on short pylons |
| Romulans | Reman Scimitar warbird | capital | Canon: *Star Trek Nemesis* (2002) | Broad bat-wing warbird; sisters fly cruise or attack wings (the film shows the wings unfolding) |
| Romulans | Romulan scout (reshaped) | escort | Canon class (TNG); form invented | Flat arrowhead with a single drive; it was a half-size bird-of-prey on main |
| Romulans | Romulan shuttle (reshaped) | small | Canon class; form invented | Boxy lifting-body wedge with canted fins; it was a miniature warbird on main |
| Dominion | Cardassian Hideki corvette | small | Canon: *Star Trek: Deep Space Nine* | Small flat broad-sterned patrol ship with a short neck and rounded head |
| Dominion | Cardassian Galor warship, Keldon configuration | escort | Canon: DS9 (Galor; the Keldon is the uprated Galor) | Cobra neck and head over a broad flat aft wing; a quarter fly as Keldons with a dorsal module and second aft wing |
| Dominion | Breen warship | capital | Canon: DS9 season 7; proportions interpreted | Bulbous stern, long spine, forked claw bow, down-swept wings |
| Dominion | Jem'Hadar battleship (reshaped, now in the normal pool) | capital | Canon: DS9, "Tacking into the Wind" | Longer and heavier than the battlecruiser: three shoulder pairs and a dorsal spine |
| Dominion | Jem'Hadar heavy escort (reshaped) | escort | Licensed game: the heavy raiders of *Star Trek Online* | Twin-pronged raider on the attack ship's line; it was the attack ship at twice the size |
| Dominion | Jem'Hadar shuttle (reshaped, now in the pool) | small | Form invented | Blunt short pod with swept stub fins |
| Space Marines | Stormbird gunship | escort | Games Workshop / Forge World | Heavy gunship: broad straight wings, twin engine nacelles each side, dorsal turret |
| Space Marines | Drop pod | small | Games Workshop (canon) | Armoured cylinder, petal doors, nose cone, one storm bolter |
| Space Marines | Boarding torpedo | small (ship study only) | *Battlefleet Gothic* (Games Workshop, 1999) | Squat armoured drum behind a wide melta-cutter claw crown. Modelled but out of the normal pool: in clay it read as the Yard's small craft and cost that fleet recognition (VARIETY.md) |
| Space Marines | Space hulk | capital | Warhammer 40,000; *Space Hulk* | Rock core with the hulls of dead ships jutting out of it at their own angles |
| Space Marines | Hunter, Gladius, Nova, Vanguard (new body plans) | escort, capital | *Battlefleet Gothic* rosters | Hunter: slim torpedo boat with a tall tower aft. Gladius: broad battery ship. Nova: lance spear with swept stern fins. Vanguard: lean cruiser with a ram and engine outriggers. On main all four were one armoured spine |
| Tesla | Starlink swarmsat | small | SpaceX Starlink; weapons fictional | Flat bus with one long solar array on a boom; laser links as guns |
| Tesla | Crew Dragon | small | SpaceX Crew Dragon; weapons fictional | Capsule and nosecone over a finned trunk; SuperDraco pods as guns |
| Tesla | Cybertruck gunship | small | Invented from the Tesla Cybertruck | Stainless wedge hover gunship, wheel wells as lift fans, bed turret |
| Tesla | Gigafactory carrier | capital | Invented | Long faceted prism under a solar ridge, two photovoltaic wings on booms |
| Tesla | Falcon and Starship configurations | escort, capital | SpaceX Falcon and Starship user's guides (above); HLS from the NASA Artemis lander | Falcons fly legs out or folded, with a Dragon or a fairing; a quarter of Starships are the HLS lander on four legs; stacks fly with or without the hot-staging ring |
| Tyranids | Spore drone and boarding worm sister kits | small | As above | Tendril reach and bladder size; worm coil |

Every new class above has native weapon and engine sockets on modelled barrels, apertures and drive bells (checked by `tests/tribute-new/variety.test.cjs`), stays under 4,000 triangles at study quality (the extra-fleets test), and appears in the ship study.
