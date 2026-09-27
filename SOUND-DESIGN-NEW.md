# Tribute New sound design

## Hearing

You hear the fight the camera is in. Each sound has a hearing radius set by its source: a gun
reaches 900 + 110·√(ship length) units, deaths reach 2.2k, 4k, 9k or the whole sky by size, an
engine 250 + 4·length and a fly-by 400 + 2.5·length. Level and brightness fall to silence at the
radius. Beyond it, fire feeds the distant battle bed, and big deaths arrive as late, low thunder.
Ships passing close to the camera get a fly-by: their own engine with a Doppler drop, plus a whoosh.
Details and measurements are in `DECISIONS.md`, under Audio.

Generated with ElevenLabs Sound Effects v2 on fal.ai by `scripts/gen-sfx-fal.py`,
built by `scripts/build-audio.py`. A role with samples plays them; anything else falls
back to the synth in `armada-audio-new.js`. Prompts describe sounds and never name a franchise.

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
| 22 | Tesla | high-voltage electric pulse gun, sharp crackling tesla-coil snap | sustained high-voltage lightning beam, buzzing crackling electrical arc | electric starship drive, smooth high-tech electric motor whine with a clean futuristic hum |

## Death styles (boom-X, layered over the explosion)

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

## Shared

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

Every prompt ends with: "Hollywood blockbuster sci-fi sound design, cinematic, high fidelity, punchy, no music, no speech".
