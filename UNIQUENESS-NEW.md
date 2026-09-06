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
