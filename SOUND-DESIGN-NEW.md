# Tribute New sound design

The sound bible for `armada-war-tribute-new.html`: what plays, how it was made, how it's processed and how the engine places it. The measurements are in `AUDIO.md`; decisions and their reasons are in `DECISIONS.md` under Audio.

## How the war sounds (Version 5: an object-based mix)

- **Sound sources, not events.** Every ship near the ear is an emitter:
  - Fighters and frigates get one engine voice at the tail, with a cone out of the nozzles.
  - Capitals get three: the nozzles at the stern, plus two hull rumbles either side of the keel point nearest the ear. So a destroyer overhead is wide as well as deep.
  - Every round, held beam, hit, whizz-by, damaged hull, arrival and explosion is a short-lived emitter.
- **Virtual voices.**
  - The page declares its emitters every frame. The engine ranks them by loudness at the ear: distance, source level and size, hearing radius, and the louder of now and 0.5 s ahead along the radial velocity.
  - It gives real voices to the top of each budget:

    | | High / Ultra | Medium | Low |
    |---|---|---|---|
    | Engines | 8 (capitals at most 3 of them) | 6 (2) | 4 (1) |
    | Weapons | 16 | 12 | 8 |
    | Impacts | 12 | 9 | 6 |
    | HRTF voices | 6 | 4 | 2 |

  - Handoffs crossfade: in over 150 ms, out over 250 ms. A voiced emitter keeps its voice until a rival is 3 dB louder.
  - A capital's battery, an ion strike or a death is never dropped for a fighter's gun.
  - One-shots (explosions, arrivals, ion fire, the stinger) go to a separate pool, admitted by priority.
- **Real 3D.**
  - The camera is the listener, forward and up included, so sounds can be above, below and behind.
  - Each voice is a pooled PannerNode given its direction in camera space. It's HRTF for the nearest few slow emitters (on headphones) and equal-power for the rest and for fast sweeps; HRTF lags a fighter crossing 20° a frame.
  - Settings has a Headphones/Speakers switch. Speakers is equal-power everywhere.
- **Distance and air.**
  - Each emitter plays at full level within a reference distance set by its size (two ship lengths for an engine). Beyond that it falls as inverse distance, under a window that reaches silence at its hearing radius.
  - A lowpass closes from 18 kHz to 1.2 kHz across the radius (air absorption).
  - Far sources send more to a darker, longer hall.
- **Doppler** comes from each emitter's real radial velocity relative to the moving ear, with a virtual speed of sound of 1,200 units/s. That's about 4 to 6 semitones across a fighter pass, clamped to 0.78-1.25x.
- **Near-field detail.**
  - Bolts that pass within three shooter lengths of the ear whizz by along their path.
  - Hits near the ear play at the hit point. Deflectors ring (Federation, Dominion), buzz (Klingon, Romulan) or crackle (Borg); plain hulls clang, and heavy fire tears.
  - Damaged hulls near the ear hiss and spark, and dying capitals groan. Debris clatters.
- **Hearing radii.**
  - A gun reaches 900 + 110·√length units.
  - An engine reaches 420 + 5·length units, and past 1,200 units of length it grows by the square root.
  - Beyond hearing, fire feeds the distant battle bed and big deaths arrive as late, low thunder.
- **The listener blend.** On a wide shot the ear moves part of the way from the camera toward the subject being framed. Nothing changes below 1,200 units; from 1,200 to 6,000 units it slides smoothly up to 80% of the way. So the moment on screen stays audible while the rest of the war recedes.
- **Mix.**
  - Buses: music, weapons, engines (with a rumble sub-bus), impacts, explosions, ambience and UI, each with a duck stage.
  - Many guns at once each get a little quieter: 16 voices come out 4.8 dB down.
  - A fighter passing within three reference distances pulls the score, the bed and the capital rumble down by up to 6 dB.
  - Ion strikes duck the weapons and the score. A capital heard close is followed by a dip: 0.9 s after the blast everything falls about 26 dB for 1.6 s under a ringing tone, then the war returns over 2.5 s. There's no stinger over that silence.
  - Slow motion dulls the world, but not the death that caused it.
  - Master: a gentle compressor into a lookahead true-peak limiter (an AudioWorklet), with a -1.5 dBFS ceiling on 4x-oversampled peaks. A soft clipper stands in where worklets are missing.
- **Cockpit.** In Take control and the Crew interiors you hear the ship's own engine from inside (its loop through a 300-420 Hz lowpass, pitched down), the cabin bed and your own guns dry and centred. The outside world is lowpassed to 1.1 kHz. Leaving crossfades back over a quarter second.
- **The score.**
  - Calm, tension and battle stems in D minor at 96 BPM, each a whole number of 2.5 s bars, started together so they share a bar grid.
  - They crossfade with the war's intensity (calm below 0.25, tension around 0.5, battle above 0.7), and momentum shifts weight toward battle when the fight is turning.
  - When the war ends, the loops fade on the next bar into a coda: victory, or defeat if you were piloting or following a ship on the losing side.
- **Streaming.**
  - At the first gesture the page fetches the core set (3.01 MB) and the fleets in the war (up to 1.77 MB each; the two largest together are 3.13 MB).
  - Right after, it streams the tension stem and the capital-death and ion layers (2.52 MB). That's 8.66 MB for the first gesture in the worst two-fleet war, under the 10 MB budget (a test checks it).
  - The battle stem, the codas and the cockpit beds (2.76 MB) load when the war heats up (intensity over 0.3), or 20 s in, whichever comes first. A late stem joins on the next bar; a cockpit bed joins when it arrives.
  - Everything else loads on first use. The whole set is 32.75 MB.
- **Fallback.** From `file://`, or for any role without a recording, the synth in `armada-audio-new.js` plays instead: the fighter drone, the synth weapons and explosions, and the pad score. No synthesized tone sits or slides below 150 Hz.

## Recordings

Generated with ElevenLabs Sound Effects v2 and ElevenLabs Music on fal.ai by `scripts/gen-sfx-fal.py` and `scripts/gen-music-fal.py`, and built by `scripts/build-audio.py`. Every generation is in `bench/audio/ledger.csv`. Prompts describe sounds and never name a franchise.

- **Version 4** (pull requests 7 and 8) made the per-fleet guns, beams and single engine loops, the death styles and the shared set.
- **Version 5** added:
  - Two more takes of every gun.
  - Engines by size class, and sustained beams.
  - Impacts, arrivals, explosion layers and interiors.
  - More takes of the whooshes and the bed.
  - The score stems.

## Prompts

### Version 4: per-fleet guns, beams and engine loops (engine-N is no longer shipped: engines by class replaced it)

| # | Fleet | Gun (shot-N) | Beam (beam-N) | Engine loop (engine-N) |
|---|---|---|---|---|
| 0 | The Yard Fleet | clean industrial energy bolt, crisp electric snap with a short metallic zing and a tight tail | steady industrial energy beam, clean electric hum with a soft crackle and a bright edge | workhorse starship fusion drive, steady low rumble with a smooth turbine whine |
| 1 | The Shoal | wet organic acid spit, gurgling squelch launching a sticky glob, creature-like | gurgling bioluminescent acid stream, wet sizzle and bubbling hiss | living swarm creature-ship, wet pulsing organic throb with faint insect chittering |
| 2 | The Lattice | crystalline shard launcher, glassy ping with a bright shattering tinkle | resonant crystal energy beam, singing glass harmonic with shimmering overtones | crystalline starship drive, glass-harmonica drone with slow shimmering resonance |
| 3 | The Drift | scrap-built junk cannon, clanking mechanical thump hurling jagged metal, rattling recoil | sputtering improvised cutting torch beam, unstable crackling arc and hiss | rattling scrap-built engine, sputtering rough rumble with loose metal clanks and knocks |
| 4 | The Choir | ethereal harmonic energy burst, a single pure angelic tone with a shimmering attack | sustained ethereal harmonic beam, wordless angelic chord with glistening shimmer | serene angelic harmonic drone, soft airy pad hum, peaceful and vast |
| 5 | The Imperial Starfleet | heavy turbolaser blast, thick punchy energy bolt with a descending metallic pew and springy twang | colossal red capital-ship energy beam, deep sustained thunderous roar | menacing screaming howl of a twin ion-engine fighter over the deep thrumming rumble of a giant warship |
| 6 | The Rebel Alliance | rapid starfighter laser cannon, bright snappy zap with a springy metallic twang | bright green energy beam, fierce buzzing sizzle | fast scrappy starfighter engine, howling roar with a rising turbine whine |
| 7 | The Minbari Federation | elegant alien energy pulse, clean crystalline tone with a smooth whoosh | brilliant neutron beam, piercing pure high-tech tone with a crystalline shimmer and a searing edge, clean and elegant | sleek elegant alien cruiser, smooth near-silent humming harmonic drone, graceful |
| 8 | The Shadows | terrifying alien slicer burst, piercing inhuman shriek with a tearing rip | ominous alien cutting beam, dissonant screaming shriek with a tearing, ripping texture | dark living alien vessel, eerie breathing organic drone with a distant unearthly scream |
| 9 | EarthForce | military pulse cannon, heavy gritty thump-zap, practical and hard-hitting | heavy particle beam cannon, crackling sustained blast over a low hum | military heavy cruiser, rumbling reaction thrusters with a mechanical hum and rotating-section groan |
| 10 | The Federation | torpedo launch, resonant electronic whoosh with a bright tonal burst | smooth sustained high electronic phaser whine, clean and iconic | starship warp-drive hum, deep smooth warm engine drone with a subtle slow pulse |
| 11 | The Klingon Empire | aggressive disruptor bolt, harsh crackling snarl with a buzzing electric bite | harsh disruptor beam, gritty distorted buzzing roar | brutal warship engine, gritty growling rumble with an aggressive throb |
| 12 | The Borg Collective | cold mechanical energy discharge, synthetic digital zap with a metallic servo click | relentless green cutting beam, droning electronic hum with mechanical grinding | vast cube-ship machine drone, cold mechanical hum with rhythmic industrial pulses and hissing vents |
| 13 | The Mondoshawan | warm alien energy bolt, soft rounded melodic zap | warm golden energy beam, bright resonant singing tone with a soft shimmer and gentle crackle | slow ancient alien vessel, deep warm resonant hum like a vast bell |
| 14 | The USCM Task Force | heavy military automatic rifle burst, rapid punchy gunfire with mechanical clatter and shell ejection | military plasma cutting beam, harsh buzzing hiss | heavy military dropship, loud roaring jet thrusters with a turbine whine |
| 15 | The Engineers | ancient alien biomechanical cannon, deep wet resonant thrum as it fires | ancient alien energy beam, deep otherworldly drone with a cold edge | colossal ancient alien derelict, deep cavernous organic hum with slow groaning |
| 16 | The Yautja Clans | shoulder plasma caster shot, sharp charged zap with a crackling discharge | searing red plasma beam, crackling hiss | stealthy hunter ship, low menacing growl with rhythmic electronic clicking |
| 17 | The First Ones | ancient god-like energy discharge, massive resonant tone with shimmering electrical arcs | overwhelming ancient energy beam, deep roaring resonant tone with celestial shimmer | vast ancient alien vessel, profound deep resonant drone with ethereal overtones |
| 18 | Romulan Star Empire | sleek disruptor bolt, sharp hissing zap with a bird-of-prey screech | green plasma disruptor beam, hissing sustained energy | predatory warbird engine, smooth hissing drone over a low menacing hum |
| 19 | The Dominion | polaron energy burst, sharp zap with a harsh metallic ring | polaron beam, harsh sustained electronic whine with metallic grit | alien warship engine, aggressive humming drone with a rhythmic pulse |
| 20 | Space Marines | gothic battleship macro-cannon, thunderous artillery boom with a metallic clang | lance battery, deafening crackling energy beam with a deep roar | enormous gothic cathedral battleship, deep roaring plasma drive with rumbling heavy machinery |
| 21 | Tyranids | alien bio-cannon, wet fleshy thump firing a spore sac, squelch | bio-plasma stream, gurgling acidic hiss | living hive-ship, deep organic heartbeat throb with wet chittering |
| 22 | Tesla | high-voltage electric pulse gun, sharp crackling high-voltage coil snap | sustained high-voltage lightning beam, buzzing crackling electrical arc | electric starship drive, smooth high-tech electric motor whine with a clean futuristic hum |

### Death styles (boom-X, layered over the explosion)

| Style | Fleets | Prompt |
|---|---|---|
| burst | The Shoal, Tyranids | living alien creature-ship bursting apart, wet visceral splatter with a gurgling hiss |
| shatter | The Lattice | huge crystal structure shattering, cascading glass shards raining down |
| flash | The Choir, The First Ones | blinding energy flash, bright shimmering whoosh fading into ethereal ringing |
| tie | The Imperial Starfleet | small fighter blowing apart with a sharp crack as its screaming engine cuts off |
| crystal | The Minbari Federation | crystalline hull fracturing, deep resonant chime and splitting glass crack |
| dissolve | The Shadows | dark alien organism dying, unearthly shriek fading into a hissing dissolve |
| warp | The Federation, Romulans, Dominion | warp core breach, rising energy whine then an implosive whoosh and a reverse-sucking boom |
| cleave | The Borg Collective | massive machine structure breaking apart, grinding metal and sparking electrical shorts |
| bronze | The Mondoshawan | ancient metal hull struck and ringing like a giant gong as it cracks |
| fossil | The Engineers | ancient hull of stone and bone cracking, deep groaning collapse |
| cloakpop | The Yautja Clans | cloaking field collapsing, electronic glitch crackle then a sharp detonation |

### Shared

| Role | Prompt | Length |
|---|---|---|
| arc | Sharp electrical arc discharge, crackling lightning strike, violent tesla snap, single hit | 0.6s |
| rail | Electromagnetic railgun firing, quick charge whine then a supersonic crack and a metallic ring | 1.0s |
| ion-charge | Massive warship ion cannon charging up, rising electrical hum and building energy whine to a crescendo | 4.5s |
| ion-fire | Gigantic ion cannon firing, huge thunderous energy blast with electric crackle and a long rolling tail | 3.5s |
| explosion0 | Small starfighter exploding, sharp punchy blast with scattering debris | 1.8s |
| explosion1 | Medium starship exploding, powerful blast with fire and tearing metal debris | 3.0s |
| explosion2 | Large warship exploding, massive deep explosion with rolling secondary detonations and groaning, collapsing metal | 5.5s |
| explosion3 | Colossal capital ship destroyed, enormous reactor detonation, earth-shaking blast, long rolling rumble and raining debris | 8.0s |
| stinger | Epic cinematic braam, deep brass hit swelling and decaying, dramatic trailer impact | 5.0s |
| whoosh-0 | Starfighter streaking past the camera very close, fast doppler whoosh with a screaming engine, one pass from left to right | 1.6s |
| whoosh-1 | Massive warship sliding past the camera close overhead, deep rumbling roar swelling and fading away, huge doppler pass-by | 3.5s |
| ambience | Distant space battle ambience, far-off muffled explosions and weapon fire over a low rumble | 20.0s |
| eng-f-0 | Starship engine, continuous and steady, heard from close by: small utility spacecraft, buzzing electric thruster whine with a light turbine hum | 8.0s |
| eng-m-0 | Starship engine, continuous and steady, heard from close by: mid-size workhorse starship fusion drive, steady mechanical hum with a turbine whine | 8.0s |
| eng-c-0 | Starship engine, continuous and steady, heard from close by: enormous industrial starship fusion drive, deep throbbing rumble with a heavy machinery groan | 8.0s |
| beamloop-0 | Continuous sustained energy beam, held steady: steady industrial energy beam, clean electric hum with a soft crackle and a bright edge | 3.0s |
| eng-f-1 | Starship engine, continuous and steady, heard from close by: small living swarm creature flying fast, rapid wet insect-wing buzz with chittering | 8.0s |
| eng-m-1 | Starship engine, continuous and steady, heard from close by: medium living creature-ship, wet pulsing organic throb with clicking | 8.0s |
| eng-c-1 | Starship engine, continuous and steady, heard from close by: gigantic living hive creature-ship, slow deep wet heartbeat throb and cavernous organic breathing | 8.0s |
| beamloop-1 | Continuous sustained energy beam, held steady: gurgling bioluminescent acid stream, wet sizzle and bubbling hiss | 3.0s |
| eng-f-2 | Starship engine, continuous and steady, heard from close by: small crystalline craft, high glassy shimmering whine | 8.0s |
| eng-m-2 | Starship engine, continuous and steady, heard from close by: crystalline starship drive, glass-harmonica drone with shimmering resonance | 8.0s |
| eng-c-2 | Starship engine, continuous and steady, heard from close by: vast crystal starship, deep resonant singing-glass drone with slow shimmering beats | 8.0s |
| beamloop-2 | Continuous sustained energy beam, held steady: resonant crystal energy beam, singing glass harmonic with shimmering overtones | 3.0s |
| eng-f-3 | Starship engine, continuous and steady, heard from close by: scrap-built small craft engine, rattling sputtering high-revving whine with loose metal | 8.0s |
| eng-m-3 | Starship engine, continuous and steady, heard from close by: scrap-built freighter engine, rough rumbling chug with metal clanks | 8.0s |
| eng-c-3 | Starship engine, continuous and steady, heard from close by: enormous scrap-built hauler, heavy rattling engine rumble with groaning chains and knocking | 8.0s |
| beamloop-3 | Continuous sustained energy beam, held steady: sputtering improvised cutting torch beam, unstable crackling arc and hiss | 3.0s |
| eng-f-4 | Starship engine, continuous and steady, heard from close by: small ethereal craft, airy shimmering whisper tone | 8.0s |
| eng-m-4 | Starship engine, continuous and steady, heard from close by: ethereal vessel, soft harmonic hum with breathy air | 8.0s |
| eng-c-4 | Starship engine, continuous and steady, heard from close by: vast serene vessel, deep calm harmonic drone with airy shimmer | 8.0s |
| beamloop-4 | Continuous sustained energy beam, held steady: sustained ethereal harmonic beam, wordless angelic chord with glistening shimmer | 3.0s |
| eng-f-5 | Starship engine, continuous and steady, heard from close by: twin ion engine starfighter, harsh screaming howl, aggressive and piercing | 8.0s |
| eng-m-5 | Starship engine, continuous and steady, heard from close by: military corvette, steady hard ion thruster roar with a mechanical hum | 8.0s |
| eng-c-5 | Starship engine, continuous and steady, heard from close by: colossal wedge-shaped warship engines, deep thrumming rumble with a low ion-drive roar, vast and menacing | 8.0s |
| beamloop-5 | Continuous sustained energy beam, held steady: colossal red capital-ship energy beam, deep sustained thunderous roar | 3.0s |
| eng-f-6 | Starship engine, continuous and steady, heard from close by: scrappy starfighter engine, howling turbine roar with a rising whine | 8.0s |
| eng-m-6 | Starship engine, continuous and steady, heard from close by: corvette with a bank of roaring ion thrusters, throaty hum | 8.0s |
| eng-c-6 | Starship engine, continuous and steady, heard from close by: large rounded star cruiser engines, deep smooth rumbling roar with a warm hum | 8.0s |
| beamloop-6 | Continuous sustained energy beam, held steady: bright green energy beam, fierce buzzing sizzle | 3.0s |
| eng-f-7 | Starship engine, continuous and steady, heard from close by: sleek alien fighter, smooth high humming whine, elegant | 8.0s |
| eng-c-7 | Starship engine, continuous and steady, heard from close by: sleek elegant alien war cruiser, near-silent smooth harmonic drone over a soft deep hum, graceful | 8.0s |
| beamloop-7 | Continuous sustained energy beam, held steady: brilliant neutron beam, piercing pure high-tech tone with a crystalline shimmer and a searing edge, clean and elegant | 3.0s |
| eng-f-8 | Starship engine, continuous and steady, heard from close by: dark living alien fighter, eerie breathy whisper with a thin high scream | 8.0s |
| eng-m-8 | Starship engine, continuous and steady, heard from close by: dark living alien hunter ship, eerie organic breathing drone with an unearthly scream | 8.0s |
| eng-c-8 | Starship engine, continuous and steady, heard from close by: enormous dark living alien vessel, deep unsettling organic drone with distant screaming and chittering | 8.0s |
| beamloop-8 | Continuous sustained energy beam, held steady: ominous alien cutting beam, dissonant screaming shriek with a tearing, ripping texture | 3.0s |
| eng-f-9 | Starship engine, continuous and steady, heard from close by: military space fighter, rough rocket thruster roar with bursts of reaction jets | 8.0s |
| eng-m-9 | Starship engine, continuous and steady, heard from close by: military missile cruiser, rumbling reaction thrusters with a mechanical hum | 8.0s |
| eng-c-9 | Starship engine, continuous and steady, heard from close by: heavy military destroyer, deep rumbling fusion thrusters with a slow rotating-section groan | 8.0s |
| beamloop-9 | Continuous sustained energy beam, held steady: heavy particle beam cannon, crackling sustained blast over a low hum | 3.0s |
| eng-f-10 | Starship engine, continuous and steady, heard from close by: small fast starship at speed, bright clean high-pitched humming whine with a smooth warm pulse, no low rumble | 8.0s |
| eng-m-10 | Starship engine, continuous and steady, heard from close by: starship at cruising speed, smooth warm engine hum with a gentle pulse | 8.0s |
| eng-c-10 | Starship engine, continuous and steady, heard from close by: large starship, deep smooth warm engine drone with a slow soft pulse | 8.0s |
| beamloop-10 | Continuous sustained energy beam, held steady: smooth sustained high electronic phaser whine, clean and iconic | 3.0s |
| eng-f-11 | Starship engine, continuous and steady, heard from close by: aggressive small warship, snarling gritty engine growl | 8.0s |
| eng-m-11 | Starship engine, continuous and steady, heard from close by: bird-shaped warship, gritty growling engine with an aggressive throb | 8.0s |
| eng-c-11 | Starship engine, continuous and steady, heard from close by: large brutal battlecruiser, deep gritty growling rumble with a heavy throb | 8.0s |
| beamloop-11 | Continuous sustained energy beam, held steady: harsh disruptor beam, gritty distorted buzzing roar | 3.0s |
| eng-f-12 | Starship engine, continuous and steady, heard from close by: small machine drone ship, cold digital servo whine with ticking | 8.0s |
| eng-m-12 | Starship engine, continuous and steady, heard from close by: machine warship, cold mechanical hum with rhythmic industrial pulses | 8.0s |
| eng-c-12 | Starship engine, continuous and steady, heard from close by: vast cube-shaped machine ship, colossal cold mechanical drone with rhythmic industrial pounding and hissing vents | 8.0s |
| beamloop-12 | Continuous sustained energy beam, held steady: relentless green cutting beam, droning electronic hum with mechanical grinding | 3.0s |
| eng-f-13 | Starship engine, continuous and steady, heard from close by: small retro-futuristic flying yacht, warm hovering turbine hum | 8.0s |
| eng-m-13 | Starship engine, continuous and steady, heard from close by: slow alien transport, warm resonant hum | 8.0s |
| eng-c-13 | Starship engine, continuous and steady, heard from close by: slow ancient alien vessel, deep warm resonant hum like a vast bell | 8.0s |
| beamloop-13 | Continuous sustained energy beam, held steady: warm golden energy beam, bright resonant singing tone with a soft shimmer and gentle crackle | 3.0s |
| eng-f-14 | Starship engine, continuous and steady, heard from close by: heavy military dropship, loud roaring jet thrusters with a turbine whine | 8.0s |
| eng-m-14 | Starship engine, continuous and steady, heard from close by: military troop transport, heavy rumbling thrusters with a ventilation hum | 8.0s |
| eng-c-14 | Starship engine, continuous and steady, heard from close by: huge military freighter, deep heavy rumbling thrusters with metal hull creaks | 8.0s |
| beamloop-14 | Continuous sustained energy beam, held steady: military plasma cutting beam, harsh buzzing hiss | 3.0s |
| eng-f-15 | Starship engine, continuous and steady, heard from close by: small ancient alien craft, low organic hum with a hollow whistle | 8.0s |
| eng-m-15 | Starship engine, continuous and steady, heard from close by: ancient alien biomechanical ship, deep hollow organic hum with slow groaning | 8.0s |
| eng-c-15 | Starship engine, continuous and steady, heard from close by: colossal ancient alien derelict, deep cavernous organic drone with slow groaning | 8.0s |
| beamloop-15 | Continuous sustained energy beam, held steady: ancient alien energy beam, deep otherworldly drone with a cold edge | 3.0s |
| eng-f-16 | Starship engine, continuous and steady, heard from close by: stealthy hunter drop craft, low menacing growl with electronic clicking | 8.0s |
| eng-m-16 | Starship engine, continuous and steady, heard from close by: hunter scout ship, menacing growling hum with rhythmic clicking | 8.0s |
| eng-c-16 | Starship engine, continuous and steady, heard from close by: hunter mothership, deep menacing growl with rhythmic clicking and hissing | 8.0s |
| beamloop-16 | Continuous sustained energy beam, held steady: searing red plasma beam, crackling hiss | 3.0s |
| eng-c-17 | Starship engine, continuous and steady, heard from close by: vast ancient god-like vessel, profound deep resonant drone with ethereal overtones and slow shimmering | 8.0s |
| beamloop-17 | Continuous sustained energy beam, held steady: overwhelming ancient energy beam, deep roaring resonant tone with celestial shimmer | 3.0s |
| eng-f-18 | Starship engine, continuous and steady, heard from close by: small shuttle, smooth hissing whine | 8.0s |
| eng-m-18 | Starship engine, continuous and steady, heard from close by: predatory scout ship, smooth hissing drone with a low hum | 8.0s |
| eng-c-18 | Starship engine, continuous and steady, heard from close by: huge predatory warbird, smooth hissing drone over a deep menacing hum | 8.0s |
| beamloop-18 | Continuous sustained energy beam, held steady: green plasma disruptor beam, hissing sustained energy | 3.0s |
| eng-m-19 | Starship engine, continuous and steady, heard from close by: fast alien attack ship, aggressive pulsing whine over a humming drone | 8.0s |
| eng-c-19 | Starship engine, continuous and steady, heard from close by: alien battleship, aggressive deep humming drone with a rhythmic pulse | 8.0s |
| beamloop-19 | Continuous sustained energy beam, held steady: polaron beam, harsh sustained electronic whine with metallic grit | 3.0s |
| eng-f-20 | Starship engine, continuous and steady, heard from close by: heavy armoured gunship, roaring jet engines with a heavy mechanical whine | 8.0s |
| eng-m-20 | Starship engine, continuous and steady, heard from close by: gothic warship, roaring plasma drive with rumbling machinery | 8.0s |
| eng-c-20 | Starship engine, continuous and steady, heard from close by: enormous gothic cathedral battleship, deep roaring plasma drive with rumbling heavy machinery and clanking | 8.0s |
| beamloop-20 | Continuous sustained energy beam, held steady: lance battery, deafening crackling energy beam with a deep roar | 3.0s |
| eng-f-21 | Starship engine, continuous and steady, heard from close by: swarming alien bio-organism flying, wet buzzing wings and screeching | 8.0s |
| eng-m-21 | Starship engine, continuous and steady, heard from close by: living bio-ship, wet organic throb with chittering | 8.0s |
| eng-c-21 | Starship engine, continuous and steady, heard from close by: enormous living hive-ship, deep organic heartbeat throb with wet chittering | 8.0s |
| beamloop-21 | Continuous sustained energy beam, held steady: bio-plasma stream, gurgling acidic hiss | 3.0s |
| eng-f-22 | Starship engine, continuous and steady, heard from close by: futuristic electric fighter drone, clean high electric motor whine | 8.0s |
| eng-m-22 | Starship engine, continuous and steady, heard from close by: large rocket in flight, roaring rocket engine thunder | 8.0s |
| eng-c-22 | Starship engine, continuous and steady, heard from close by: gigantic rocket booster in flight, massive roaring rocket engine thunder with crackle | 8.0s |
| beamloop-22 | Continuous sustained energy beam, held steady: sustained high-voltage lightning beam, buzzing crackling electrical arc | 3.0s |
| hit-light | Small energy bolt striking a starship metal hull, sharp metallic clang with sizzling sparks | 0.7s |
| hit-heavy | Heavy cannon blast slamming into armoured starship hull, deep metal impact, tearing plating and scattering debris | 1.5s |
| shield-ring | Energy deflector shield absorbing a weapon hit, resonant ringing electronic shimmer with a soft wobble, bright and tonal | 1.2s |
| shield-hum | Energy shield taking a hit, gritty buzzing electric flare with a humming wobble | 1.2s |
| shield-crackle | Cold green energy barrier absorbing a hit, harsh digital crackle and electric buzz | 1.2s |
| whizz-e | Energy bolt whizzing past very close to the ear, fast zip passing from one side to the other | 1.0s |
| whizz-k | Cannon round whizzing past very close, supersonic crack and a fast zip | 1.0s |
| debris | Metal debris tumbling and clattering, scattered small metal pieces bouncing off a hull | 1.8s |
| groan | Huge metal starship structure groaning and creaking under enormous stress, deep low metallic moans, about to break | 5.0s |
| sparks | Electrical sparks shorting out, crackling fizz and pops from damaged wiring | 1.2s |
| vent | Damaged starship venting gas, steady hissing leak with sputtering sparks | 4.0s |
| arrive-hyper | Starship dropping out of lightspeed, sharp sudden whooshing snap and a deep air-pressure thump | 2.5s |
| arrive-jump | Spinning vortex gateway opening in space, swelling rising electric whirl then a bright release as a ship emerges | 2.5s |
| arrive-warp | Starship dropping out of faster-than-light travel, bright flash with a stretched tonal whoosh collapsing into a low boom | 2.5s |
| arrive-conduit | Green energy tunnel tearing open in space, distorted rushing roar and a harsh electronic rip | 2.5s |
| arrive-rift | Organic rift opening in space, wet fleshy squelch and a deep gurgling rumble as a creature-ship pushes through | 2.5s |
| arrive-rocket | Rocket engine ignition, crackling roaring blast building quickly then settling into a thrust roar | 2.5s |
| xcrack | Sharp explosive crack, the first split second of a huge blast, a snap of pressure, close | 0.6s |
| xsub | Deep low explosion thump, massive low boom felt in the chest, short with a rumbling decay, no high frequencies | 2.5s |
| xdebris | Debris raining down after an explosion, scattered metal fragments and crackling fire, tumbling pieces | 4.0s |
| xtail | Distant rolling thunder tail of a huge explosion echoing across a vast space, long low rumbling decay | 6.0s |
| capital-break | Colossal warship breaking apart in stages: groaning metal, a chain of internal secondary explosions, a massive reactor blast and a long collapse | 9.0s |
| age-end | An impossibly vast ancient power dying: a deep rising resonant swell, a titanic detonation like a collapsing star, then a long shimmering ethereal decay | 12.0s |
| ringing | High-pitched ear ringing after a deafening blast, a thin steady tinnitus tone slowly fading over a faint muffled rumble | 5.0s |
| cockpit-f | Inside a small starfighter cockpit, muffled engine rumble through the hull, rattling panels and a low cabin hum | 8.0s |
| cockpit-c | Inside a large starship bridge, deep muffled engine hum through the deck, soft ventilation and distant machinery | 8.0s |

These Version 4 prompts end with: "Hollywood blockbuster sci-fi sound design, cinematic, high fidelity, punchy, no music, no speech".

### Version 5: engines by size class (eng-f/m/c-N, seamless 8 s loops)

Each prompt is prefixed "Starship engine, continuous and steady, heard from close by:" and ends with the loop style below. A dash marks a class the fleet does not field.

| # | Fleet | Fighter (under 50 units) | Frigate (50-180) | Capital (180 and up) |
|---|---|---|---|---|
| 0 | The Yard Fleet | small utility spacecraft, buzzing electric thruster whine with a light turbine hum | mid-size workhorse starship fusion drive, steady mechanical hum with a turbine whine | enormous industrial starship fusion drive, deep throbbing rumble with a heavy machinery groan |
| 1 | The Shoal | small living swarm creature flying fast, rapid wet insect-wing buzz with chittering | medium living creature-ship, wet pulsing organic throb with clicking | gigantic living hive creature-ship, slow deep wet heartbeat throb and cavernous organic breathing |
| 2 | The Lattice | small crystalline craft, high glassy shimmering whine | crystalline starship drive, glass-harmonica drone with shimmering resonance | vast crystal starship, deep resonant singing-glass drone with slow shimmering beats |
| 3 | The Drift | scrap-built small craft engine, rattling sputtering high-revving whine with loose metal | scrap-built freighter engine, rough rumbling chug with metal clanks | enormous scrap-built hauler, heavy rattling engine rumble with groaning chains and knocking |
| 4 | The Choir | small ethereal craft, airy shimmering whisper tone | ethereal vessel, soft harmonic hum with breathy air | vast serene vessel, deep calm harmonic drone with airy shimmer |
| 5 | The Imperial Starfleet | twin ion engine starfighter, harsh screaming howl, aggressive and piercing | military corvette, steady hard ion thruster roar with a mechanical hum | colossal wedge-shaped warship engines, deep thrumming rumble with a low ion-drive roar, vast and menacing |
| 6 | The Rebel Alliance | scrappy starfighter engine, howling turbine roar with a rising whine | corvette with a bank of roaring ion thrusters, throaty hum | large rounded star cruiser engines, deep smooth rumbling roar with a warm hum |
| 7 | The Minbari Federation | sleek alien fighter, smooth high humming whine, elegant | - | sleek elegant alien war cruiser, near-silent smooth harmonic drone over a soft deep hum, graceful |
| 8 | The Shadows | dark living alien fighter, eerie breathy whisper with a thin high scream | dark living alien hunter ship, eerie organic breathing drone with an unearthly scream | enormous dark living alien vessel, deep unsettling organic drone with distant screaming and chittering |
| 9 | EarthForce | military space fighter, rough rocket thruster roar with bursts of reaction jets | military missile cruiser, rumbling reaction thrusters with a mechanical hum | heavy military destroyer, deep rumbling fusion thrusters with a slow rotating-section groan |
| 10 | The Federation | small fast starship at speed, bright clean high-pitched humming whine with a smooth warm pulse, no low rumble | starship at cruising speed, smooth warm engine hum with a gentle pulse | large starship, deep smooth warm engine drone with a slow soft pulse |
| 11 | The Klingon Empire | aggressive small warship, snarling gritty engine growl | bird-shaped warship, gritty growling engine with an aggressive throb | large brutal battlecruiser, deep gritty growling rumble with a heavy throb |
| 12 | The Borg Collective | small machine drone ship, cold digital servo whine with ticking | machine warship, cold mechanical hum with rhythmic industrial pulses | vast cube-shaped machine ship, colossal cold mechanical drone with rhythmic industrial pounding and hissing vents |
| 13 | The Mondoshawan | small retro-futuristic flying yacht, warm hovering turbine hum | slow alien transport, warm resonant hum | slow ancient alien vessel, deep warm resonant hum like a vast bell |
| 14 | The USCM Task Force | heavy military dropship, loud roaring jet thrusters with a turbine whine | military troop transport, heavy rumbling thrusters with a ventilation hum | huge military freighter, deep heavy rumbling thrusters with metal hull creaks |
| 15 | The Engineers | small ancient alien craft, low organic hum with a hollow whistle | ancient alien biomechanical ship, deep hollow organic hum with slow groaning | colossal ancient alien derelict, deep cavernous organic drone with slow groaning |
| 16 | The Yautja Clans | stealthy hunter drop craft, low menacing growl with electronic clicking | hunter scout ship, menacing growling hum with rhythmic clicking | hunter mothership, deep menacing growl with rhythmic clicking and hissing |
| 17 | The First Ones | - | - | vast ancient god-like vessel, profound deep resonant drone with ethereal overtones and slow shimmering |
| 18 | Romulan Star Empire | small shuttle, smooth hissing whine | predatory scout ship, smooth hissing drone with a low hum | huge predatory warbird, smooth hissing drone over a deep menacing hum |
| 19 | The Dominion | - | fast alien attack ship, aggressive pulsing whine over a humming drone | alien battleship, aggressive deep humming drone with a rhythmic pulse |
| 20 | Space Marines | heavy armoured gunship, roaring jet engines with a heavy mechanical whine | gothic warship, roaring plasma drive with rumbling machinery | enormous gothic cathedral battleship, deep roaring plasma drive with rumbling heavy machinery and clanking |
| 21 | Tyranids | swarming alien bio-organism flying, wet buzzing wings and screeching | living bio-ship, wet organic throb with chittering | enormous living hive-ship, deep organic heartbeat throb with wet chittering |
| 22 | Tesla | futuristic electric fighter drone, clean high electric motor whine | large rocket in flight, roaring rocket engine thunder | gigantic rocket booster in flight, massive roaring rocket engine thunder with crackle |

Sustained beams (beamloop-N, 3 s loops) reuse each fleet's beam prompt above, prefixed "Continuous sustained energy beam, held steady:".

### Version 5: impacts, arrivals, explosion layers, interiors

| Role | Prompt | Length | Loop |
|---|---|---|---|
| hit-light | Small energy bolt striking a starship metal hull, sharp metallic clang with sizzling sparks | 0.7s |  |
| hit-heavy | Heavy cannon blast slamming into armoured starship hull, deep metal impact, tearing plating and scattering debris | 1.5s |  |
| shield-ring | Energy deflector shield absorbing a weapon hit, resonant ringing electronic shimmer with a soft wobble, bright and tonal | 1.2s |  |
| shield-hum | Energy shield taking a hit, gritty buzzing electric flare with a humming wobble | 1.2s |  |
| shield-crackle | Cold green energy barrier absorbing a hit, harsh digital crackle and electric buzz | 1.2s |  |
| whizz-e | Energy bolt whizzing past very close to the ear, fast zip passing from one side to the other | 1.0s |  |
| whizz-k | Cannon round whizzing past very close, supersonic crack and a fast zip | 1.0s |  |
| debris | Metal debris tumbling and clattering, scattered small metal pieces bouncing off a hull | 1.8s |  |
| groan | Huge metal starship structure groaning and creaking under enormous stress, deep low metallic moans, about to break | 5.0s |  |
| sparks | Electrical sparks shorting out, crackling fizz and pops from damaged wiring | 1.2s |  |
| vent | Damaged starship venting gas, steady hissing leak with sputtering sparks | 4.0s | yes |
| arrive-hyper | Starship dropping out of lightspeed, sharp sudden whooshing snap and a deep air-pressure thump | 2.5s |  |
| arrive-jump | Spinning vortex gateway opening in space, swelling rising electric whirl then a bright release as a ship emerges | 2.5s |  |
| arrive-warp | Starship dropping out of faster-than-light travel, bright flash with a stretched tonal whoosh collapsing into a low boom | 2.5s |  |
| arrive-conduit | Green energy tunnel tearing open in space, distorted rushing roar and a harsh electronic rip | 2.5s |  |
| arrive-rift | Organic rift opening in space, wet fleshy squelch and a deep gurgling rumble as a creature-ship pushes through | 2.5s |  |
| arrive-rocket | Rocket engine ignition, crackling roaring blast building quickly then settling into a thrust roar | 2.5s |  |
| xcrack | Sharp explosive crack, the first split second of a huge blast, a snap of pressure, close | 0.6s |  |
| xsub | Deep low explosion thump, massive low boom felt in the chest, short with a rumbling decay, no high frequencies | 2.5s |  |
| xdebris | Debris raining down after an explosion, scattered metal fragments and crackling fire, tumbling pieces | 4.0s |  |
| xtail | Distant rolling thunder tail of a huge explosion echoing across a vast space, long low rumbling decay | 6.0s |  |
| capital-break | Colossal warship breaking apart in stages: groaning metal, a chain of internal secondary explosions, a massive reactor blast and a long collapse | 9.0s |  |
| age-end | An impossibly vast ancient power dying: a deep rising resonant swell, a titanic detonation like a collapsing star, then a long shimmering ethereal decay | 12.0s |  |
| ringing | High-pitched ear ringing after a deafening blast, a thin steady tinnitus tone slowly fading over a faint muffled rumble | 5.0s |  |
| cockpit-f | Inside a small starfighter cockpit, muffled engine rumble through the hull, rattling panels and a low cabin hum | 8.0s | yes |
| cockpit-c | Inside a large starship bridge, deep muffled engine hum through the deck, soft ventilation and distant machinery | 8.0s | yes |

Style suffixes by family:

- loop: "Seamless steady loop, cinematic sci-fi sound design, high fidelity, no music, no speech" (prompt influence 0.6)
- impact: "Close-up, dry, cinematic sci-fi sound design, high fidelity, no music, no speech" (prompt influence 0.5)
- event: "Cinematic sci-fi sound design, big and clean, high fidelity, no music, no speech" (prompt influence 0.5)
- blast: "Cinematic blockbuster sound design, huge and clean, high fidelity, no music, no speech" (prompt influence 0.5)

## Score (Version 5)

| Stem | Source | Cut | Loop |
|---|---|---|---|
| score-calm | a prompt: calm, spacious orchestral film score in D minor at exactly 96 BPM, 4/4; sparse sustained strings and a soft solo horn quietly stating a five-note rising motif (D, F, A, up to D, falling to C); uneasy calm before a vast space battle; no percussion; instrumental (57.5 s, one minute billed) | 2.5-42.5 s | 16 bars, the next bar folded over the head |
| score-tension | one composition plan (six sections, 175 s, three minutes billed) | 17.81-52.81 s | 14 bars |
| score-battle | the same plan | 62.81-137.81 s | 30 bars, exactly 18 bars after the tension cut |
| score-victory | the same plan | 145.31-172.5 s | coda: the A-major climax resolving to D |
| score-defeat | the same plan | 157.81-172.5 s | coda: the quiet close on A and D |

The plan asked for:

- **Global styles:** original orchestral film score for a vast space battle, D minor, 96 BPM, 4/4, full symphony orchestra, the motif above, instrumental.
- **Global exclusions:** vocals, sung lyrics, dance beats, electric guitar, synth leads, lo-fi, and any change of tempo or key.
- **Sections:** intro 2 bars, calm 14, tension 16, battle 22, victory coda 8, defeat coda 8.

What came back:

- **In key and in time.** Measured at 96.00 BPM (onset autocorrelation) with the D-minor pitch set, and downbeats on a 0.31 s + 2.5 s grid.
- **Not on the section lengths.** The calm opening was 15 s rather than 40, so the calm stem was generated on its own, from the same key, tempo and motif.
- **The cuts.** They were placed on that measured grid, and the tension and battle loops are a whole number of bars apart in the original performance, so they stay on the same bar when crossfaded.

## Processing (`scripts/build-audio.py`)

- **Decode and resample.** Everything is decoded, resampled to 32 kHz (44.1 kHz stereo for the score and the bed), trimmed and faded.
- **Zero-phase high-pass per family.**
  - Guns, beams, arc, rail and ion charge: 120 Hz.
  - Fighter engines: 90 Hz. Frigate engines: 55 Hz. Capital engines: 32 Hz.
  - Impacts: 50-300 Hz.
  - The explosion sub layer is band-limited to 25-400 Hz.
- **Bass harmonics for capitals and frigates.** Their engines lose 4 dB under 110 Hz and gain their own soft-saturated harmonics at 120-500 Hz, -12 dB, so a rumble reads on laptop speakers. No tone is synthesized.
- **Matched by loudness.** The RMS of the sounding part is matched per family:
  - Guns and beams: -17 dBFS.
  - Engines: -20 to -21 dBFS.
  - Score: -18 to -24 dBFS.
  - Peaks for explosions and events.
- **Loops.**
  - The tail is folded over the head with an equal-power crossfade. For the score, the fold is the following bar (2.5 s).
  - For effects, the build tries two ends (the recording's own end, or the point in its last 2.5 s whose next half second best matches its start) at three crossfade lengths (0.4, 0.8 and 1.2 s). It keeps the variant with the least audible wrap.
    - A fixed 0.6 s fold left 14 of the loops stepping more at the seam than anywhere inside them. The worst was the hive ship's heartbeat, at 5.6 dB against 3.7 dB of normal movement.
  - The seam is measured as the level step across the wrap against the loop's own step between neighbouring 100 ms windows, as the 95th percentile. All 174 loops are inside their own normal movement, and a test holds them there.
  - Each loop is written as MP3 with 0.25 s of its own wrap-around on both sides, and the manifest gives its loop points. So whatever delay a browser's MP3 decoder adds, the loop plays inside periodic audio.
- **Distant guns and beams** (shotfar-N, beamfar-N) are the fleet's own takes processed: lowpass 2.2 kHz, pitched and slowed to 0.86, attack softened, a 0.4 s dark room at 40% wet, matched at -19 dBFS.
- **Exits** are the arrival takes reversed.
- **Take selection.** Every take is measured. One is rejected if it's:
  - Mostly silent.
  - A loop that swings more than 14 dB.
  - Clipped.
  - Sub-heavy where it shouldn't be (over 50% under 120 Hz for a fighter engine, whizz, shield or sparks).
  - Or it carries the falling low tone Version 2 was built on: a prominent 60-700 Hz peak gliding down at least half an octave to below 150 Hz.

  Takes shipped by earlier passes (no raw files) are measured for that too. Rejects are listed with reasons in `audio/build-report.json`, on the sound board and in `AUDIO.md`.

