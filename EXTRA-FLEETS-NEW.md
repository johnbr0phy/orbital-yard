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
