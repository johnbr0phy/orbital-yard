# Captain anatomy research and implementation

Reviewed 6 September 2026. These are original, stylized low-poly interpretations of the referenced species, not scans of actors or film assets. Fleet and species are now separate: a Rebel captain is not automatically human, and the Borg can retain different assimilated anatomies. Seeded identities retain their names; their anatomy is rebuilt.

| Fleet | Anatomy and reference |
|---|---|
| Yard | Original setting: varied human crews. |
| Shoal | Original setting: cephalopod mantle, lateral eyes and eight independently curved arms; no human shoulders or face. |
| Lattice | Original setting: floating crystalline intelligence; no biological face. |
| Drift | Original setting: varied human salvagers. |
| Choir | Original setting: radial sensory organism; no bilateral head. |
| Imperial | Human officers, restrained grey uniforms. [Wullf Yularen, official Databank](https://www.starwars.com/databank/wullf-yularen). |
| Rebel | Human, Mon Calamari, Sullustan and Twi'lek crews. Mon Calamari cruiser classes select Mon Calamari: domed head, wide protruding eyes and broad muzzle. Sullustans get large ears and facial folds; Twi'leks get paired tapered lekku. [Mon Calamari](https://www.starwars.com/databank/mon-calamari), [Sullustan reference](https://www.starwars.com/news/much-to-learn-you-still-have-7-things-you-might-not-know-about-sullustans), [Twi'lek anatomy](https://www.starwars.com/news/much-to-learn-you-still-have-7-things-you-might-not-know-about-twileks), all official. |
| Minbari | Bald humanoid with a continuous bone crest around the back and temples; smooth and jagged seeded edges. [Minbari physiology](https://babylon5.fandom.com/wiki/Minbari). |
| Shadow | A separate insectoid body with six jointed legs, two hooked forelimbs, triangular carapace and clustered eyes. Labelled “Shadow presence”: this is a view of the controlling species, not a claim that a Shadow replaces the vessel's integrated organic pilot. [Shadow reference](https://babylon5.fandom.com/wiki/Shadow). |
| Earthforce | Human officers in navy uniforms. [Earthforce personnel and recruitment](https://babylon5.fandom.com/wiki/Earthforce). |
| Federation | Human, Vulcan and Andorian captains. Vulcans have tapered ears; Andorians blue skin, pale hair and mobile antennae. [Official Vulcan design history](https://www.startrek.com/en-un/news/creating-star-treks-first-alien-mr-spock), [Andorian/Aenar reference](https://www.startrek.com/news/strange-new-worlds-101-the-aenar). |
| Klingon | Ridged forehead, heavier brow, natural skin tones and seeded hair/beard. [Official forehead-ridge reference](https://www.startrek.com/news/mark-lenard-an-appreciation). |
| Borg | Pallid assimilated Human, Vulcan or Klingon anatomy, asymmetric ocular hardware and implanted conduits. Command node rather than a conventional independent captain. [Official Borg overview](https://www.startrek.com/news/star-trek-101-the-borg). |
| Mondoshawan / Fifth Element | Mondoshawan vessels get compact turtle-like heads in broad ribbed bronze armour. Mangalore raiders get broad, heavy facial structures; civilian ships get humans. [Creature production reference](https://monsterlegacy.net/2013/03/10/mondoshawan-fifth-element/), [original Mondoshawan head prop](https://propstoreauction.com/lot-details/index/catalog/10/lot/1354/), [film overview and Mangalore affiliation](https://en.wikipedia.org/wiki/The_Fifth_Element). |
| Colonial Marines | Human military crew, olive uniforms. [USCM reference](https://avp.fandom.com/wiki/United_States_Colonial_Marine_Corps). |
| Engineer | Bald pale humanoid, black eyes, raised brow and biomechanical collar/ribbing. [Engineer physiology](https://avp.fandom.com/wiki/Engineer). |
| Yautja | Broad skull, recessed eyes, four articulated mandibles with tusks, no protruding human nose or ears, tapered dreadlocks and mottling. [Anatomy reference](https://www.avpcentral.com/yautja-anatomy). |
| First Ones | Vorlon ships show an encounter suit with a central aperture. Other ancient ships show a deliberately interpretive radial presence: their occupants' anatomy is not established by a ship silhouette. [Encounter suits](https://babylon5.fandom.com/wiki/Encounter_suit), [First Ones](https://babylon5.fandom.com/wiki/First_Ones). |

## Variation and motion

Independent seeded head proportions, plates, crest dimensions, tendril spread, facial features, skin and markings distinguish individuals. Species retain defining anatomy. Alien mandibles, antennae, limbs and sensory structures move; humanoid eyes, mouths and head pose react to stress. Nonhuman linked entities show activity/signal states rather than an indiscriminate human fear label. Generic alien chamber framing replaces human bridge windows for the original alien fleets, Shadows, Engineers and First Ones.

## Rendering and validation

Vertices remain actual local 3D geometry, rotated, lit and depth sorted into the existing Canvas portrait. The implementation does not add a WebGL context or modify ship meshes. Visible portraits retain their existing 10 Hz cap. Sampled species meshes stay below 3,500 triangles; no new fleet-wide geometry processing is introduced.

Tests cover all 18 fleets, mixed-species coverage, ship-class selection, deterministic individual anatomy, finite geometry, mesh budgets, reactions, Shadow limb spread and all four Yautja mandibles. Existing helm and watch integration checks also pass. Static browser contact sheets check the silhouettes without running a battle.
