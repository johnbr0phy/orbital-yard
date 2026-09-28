#!/usr/bin/env python3
"""Generate the tribute battle's sound set with ElevenLabs Sound Effects v2 on fal.ai.

FAL_KEY=... python3 scripts/gen-sfx-fal.py [--roles shot-5,explosion3] [--takes 3]
python3 scripts/gen-sfx-fal.py --doc > SOUND-DESIGN-NEW.md

Every fleet gets its own gun (shot-N), beam (beam-N) and engine loop (engine-N),
N being the race index the page uses. Shared roles cover hardware several fleets
carry (arc, rail, ion) plus explosions, the capital-kill stinger and the battle
bed. Each role gets several takes; the page picks one at random per shot, so
repeats never sound identical. Raw WAVs land in audio/src/fal/ and
audio/src/roles.json is updated; then run scripts/build-audio.py to trim,
normalize and write audio/manifest.json. The key comes from the environment
only. Cost: $0.002 per generated second, and every generation is reserved in
bench/audio/ledger.csv first (scripts/fal_ledger.py), which refuses anything
that would take this pass past $9.50.

Version 5 roles (the object-based mix): engine loops by size class
(eng-f-N fighter, eng-m-N frigate, eng-c-N capital), sustained beam loops
(beamloop-N), impacts, whizz-bys, arrivals, explosion layers, cockpit beds.
  python3 scripts/gen-sfx-fal.py --roles eng-c-5 --takes 2 --first 1

Prompts describe sounds, never name a franchise: the aim is each fleet's
character, recorded fresh, not a copy of anyone's library.
"""
import json, os, sys, argparse, pathlib, urllib.request, concurrent.futures as cf
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import fal_ledger as ledger

ENDPOINT = 'https://fal.run/fal-ai/elevenlabs/sound-effects/v2'
STYLE = 'Hollywood blockbuster sci-fi sound design, cinematic, high fidelity, punchy, no music, no speech'

# race index: (fleet, gun, beam, engine) -- the sound bible.
# gun: a single bolt / round, heard up to seven times a second, so tight and short.
# beam: a held emission (coherent beams, cutters); one burst of it.
# engine: the followed ship's drive, a seamless loop pitched up with speed.
FLEETS = {
 0:  ('The Yard Fleet',
      'clean industrial energy bolt, crisp electric snap with a short metallic zing and a tight tail',
      'steady industrial energy beam, clean electric hum with a soft crackle and a bright edge',
      'workhorse starship fusion drive, steady low rumble with a smooth turbine whine'),
 1:  ('The Shoal',
      'wet organic acid spit, gurgling squelch launching a sticky glob, creature-like',
      'gurgling bioluminescent acid stream, wet sizzle and bubbling hiss',
      'living swarm creature-ship, wet pulsing organic throb with faint insect chittering'),
 2:  ('The Lattice',
      'crystalline shard launcher, glassy ping with a bright shattering tinkle',
      'resonant crystal energy beam, singing glass harmonic with shimmering overtones',
      'crystalline starship drive, glass-harmonica drone with slow shimmering resonance'),
 3:  ('The Drift',
      'scrap-built junk cannon, clanking mechanical thump hurling jagged metal, rattling recoil',
      'sputtering improvised cutting torch beam, unstable crackling arc and hiss',
      'rattling scrap-built engine, sputtering rough rumble with loose metal clanks and knocks'),
 4:  ('The Choir',
      'ethereal harmonic energy burst, a single pure angelic tone with a shimmering attack',
      'sustained ethereal harmonic beam, wordless angelic chord with glistening shimmer',
      'serene angelic harmonic drone, soft airy pad hum, peaceful and vast'),
 5:  ('The Imperial Starfleet',
      'heavy turbolaser blast, thick punchy energy bolt with a descending metallic pew and springy twang',
      'colossal red capital-ship energy beam, deep sustained thunderous roar',
      'menacing screaming howl of a twin ion-engine fighter over the deep thrumming rumble of a giant warship'),
 6:  ('The Rebel Alliance',
      'rapid starfighter laser cannon, bright snappy zap with a springy metallic twang',
      'bright green energy beam, fierce buzzing sizzle',
      'fast scrappy starfighter engine, howling roar with a rising turbine whine'),
 7:  ('The Minbari Federation',
      'elegant alien energy pulse, clean crystalline tone with a smooth whoosh',
      'brilliant neutron beam, piercing pure high-tech tone with a crystalline shimmer and a searing edge, clean and elegant',
      'sleek elegant alien cruiser, smooth near-silent humming harmonic drone, graceful'),
 8:  ('The Shadows',
      'terrifying alien slicer burst, piercing inhuman shriek with a tearing rip',
      'ominous alien cutting beam, dissonant screaming shriek with a tearing, ripping texture',
      'dark living alien vessel, eerie breathing organic drone with a distant unearthly scream'),
 9:  ('EarthForce',
      'military pulse cannon, heavy gritty thump-zap, practical and hard-hitting',
      'heavy particle beam cannon, crackling sustained blast over a low hum',
      'military heavy cruiser, rumbling reaction thrusters with a mechanical hum and rotating-section groan'),
 10: ('The Federation',
      'torpedo launch, resonant electronic whoosh with a bright tonal burst',
      'smooth sustained high electronic phaser whine, clean and iconic',
      'starship warp-drive hum, deep smooth warm engine drone with a subtle slow pulse'),
 11: ('The Klingon Empire',
      'aggressive disruptor bolt, harsh crackling snarl with a buzzing electric bite',
      'harsh disruptor beam, gritty distorted buzzing roar',
      'brutal warship engine, gritty growling rumble with an aggressive throb'),
 12: ('The Borg Collective',
      'cold mechanical energy discharge, synthetic digital zap with a metallic servo click',
      'relentless green cutting beam, droning electronic hum with mechanical grinding',
      'vast cube-ship machine drone, cold mechanical hum with rhythmic industrial pulses and hissing vents'),
 13: ('The Mondoshawan',
      'warm alien energy bolt, soft rounded melodic zap',
      'warm golden energy beam, bright resonant singing tone with a soft shimmer and gentle crackle',
      'slow ancient alien vessel, deep warm resonant hum like a vast bell'),
 14: ('The USCM Task Force',
      'heavy military automatic rifle burst, rapid punchy gunfire with mechanical clatter and shell ejection',
      'military plasma cutting beam, harsh buzzing hiss',
      'heavy military dropship, loud roaring jet thrusters with a turbine whine'),
 15: ('The Engineers',
      'ancient alien biomechanical cannon, deep wet resonant thrum as it fires',
      'ancient alien energy beam, deep otherworldly drone with a cold edge',
      'colossal ancient alien derelict, deep cavernous organic hum with slow groaning'),
 16: ('The Yautja Clans',
      'shoulder plasma caster shot, sharp charged zap with a crackling discharge',
      'searing red plasma beam, crackling hiss',
      'stealthy hunter ship, low menacing growl with rhythmic electronic clicking'),
 17: ('The First Ones',
      'ancient god-like energy discharge, massive resonant tone with shimmering electrical arcs',
      'overwhelming ancient energy beam, deep roaring resonant tone with celestial shimmer',
      'vast ancient alien vessel, profound deep resonant drone with ethereal overtones'),
 18: ('Romulan Star Empire',
      'sleek disruptor bolt, sharp hissing zap with a bird-of-prey screech',
      'green plasma disruptor beam, hissing sustained energy',
      'predatory warbird engine, smooth hissing drone over a low menacing hum'),
 19: ('The Dominion',
      'polaron energy burst, sharp zap with a harsh metallic ring',
      'polaron beam, harsh sustained electronic whine with metallic grit',
      'alien warship engine, aggressive humming drone with a rhythmic pulse'),
 20: ('Space Marines',
      'gothic battleship macro-cannon, thunderous artillery boom with a metallic clang',
      'lance battery, deafening crackling energy beam with a deep roar',
      'enormous gothic cathedral battleship, deep roaring plasma drive with rumbling heavy machinery'),
 21: ('Tyranids',
      'alien bio-cannon, wet fleshy thump firing a spore sac, squelch',
      'bio-plasma stream, gurgling acidic hiss',
      'living hive-ship, deep organic heartbeat throb with wet chittering'),
 22: ('Tesla',
      'high-voltage electric pulse gun, sharp crackling high-voltage coil snap',  # was 'tesla-coil snap' (named after a brand): takes 4-5 unused
      'sustained high-voltage lightning beam, buzzing crackling electrical arc',
      'electric starship drive, smooth high-tech electric motor whine with a clean futuristic hum'),
}

# role: (prompt, seconds, loop)
ROLES = {
 'arc':        ('Sharp electrical arc discharge, crackling lightning strike, violent tesla snap, single hit', 0.6, False),
 'rail':       ('Electromagnetic railgun firing, quick charge whine then a supersonic crack and a metallic ring', 1.0, False),
 'ion-charge': ('Massive warship ion cannon charging up, rising electrical hum and building energy whine to a crescendo', 4.5, False),
 'ion-fire':   ('Gigantic ion cannon firing, huge thunderous energy blast with electric crackle and a long rolling tail', 3.5, False),
 'explosion0': ('Small starfighter exploding, sharp punchy blast with scattering debris', 1.8, False),
 'explosion1': ('Medium starship exploding, powerful blast with fire and tearing metal debris', 3.0, False),
 'explosion2': ('Large warship exploding, massive deep explosion with rolling secondary detonations and groaning, collapsing metal', 5.5, False),
 'explosion3': ('Colossal capital ship destroyed, enormous reactor detonation, earth-shaking blast, long rolling rumble and raining debris', 8.0, False),
 'stinger':    ('Epic cinematic braam, deep brass hit swelling and decaying, dramatic trailer impact', 5.0, False),
 'whoosh-0':   ('Starfighter streaking past the camera very close, fast doppler whoosh with a screaming engine, one pass from left to right', 1.6, False),
 'whoosh-1':   ('Massive warship sliding past the camera close overhead, deep rumbling roar swelling and fading away, huge doppler pass-by', 3.5, False),
 'ambience':   ('Distant space battle ambience, far-off muffled explosions and weapon fire over a low rumble', 20.0, True),
}
# Death styles (RACE_DEFS[].boom): a signature layer played over the generic explosion.
# 'cookoff' (ammunition and reactors going up) is the generic blast itself, so it has none.
BOOMS = {
 'burst':    ('living alien creature-ship bursting apart, wet visceral splatter with a gurgling hiss', 'The Shoal, Tyranids'),
 'shatter':  ('huge crystal structure shattering, cascading glass shards raining down', 'The Lattice'),
 'flash':    ('blinding energy flash, bright shimmering whoosh fading into ethereal ringing', 'The Choir, The First Ones'),
 'tie':      ('small fighter blowing apart with a sharp crack as its screaming engine cuts off', 'The Imperial Starfleet'),
 'crystal':  ('crystalline hull fracturing, deep resonant chime and splitting glass crack', 'The Minbari Federation'),
 'dissolve': ('dark alien organism dying, unearthly shriek fading into a hissing dissolve', 'The Shadows'),
 'warp':     ('warp core breach, rising energy whine then an implosive whoosh and a reverse-sucking boom', 'The Federation, Romulans, Dominion'),
 'cleave':   ('massive machine structure breaking apart, grinding metal and sparking electrical shorts', 'The Borg Collective'),
 'bronze':   ('ancient metal hull struck and ringing like a giant gong as it cracks', 'The Mondoshawan'),
 'fossil':   ('ancient hull of stone and bone cracking, deep groaning collapse', 'The Engineers'),
 'cloakpop': ('cloaking field collapsing, electronic glitch crackle then a sharp detonation', 'The Yautja Clans'),
}
for b, (prompt, _) in BOOMS.items():
    ROLES[f'boom-{b}'] = (f'Starship death: {prompt}', 3.0, False)
for n, (_, gun, beam, engine) in FLEETS.items():
    ROLES[f'shot-{n}'] = (f'Single shot: {gun}', 0.8, False)
    ROLES[f'beam-{n}'] = (f'One burst: {beam}', 1.2, False)
    ROLES[f'engine-{n}'] = (f'Starship engine loop, steady: {engine}', 8.0, True)

# ---- Version 5: the object-based mix ----
# Engine loops by size class. A fighter (under 50 units) screams and whines, a frigate
# (50-180) drones, a capital (180 and up, or 10+ hulls) rumbles and throbs. None marks a
# class the fleet doesn't field (measured from real wars): the Minbari have no frigates,
# the First Ones only capitals, the Dominion no fighters.
ENGINES = {
 0:  ('small utility spacecraft, buzzing electric thruster whine with a light turbine hum',
      'mid-size workhorse starship fusion drive, steady mechanical hum with a turbine whine',
      'enormous industrial starship fusion drive, deep throbbing rumble with a heavy machinery groan'),
 1:  ('small living swarm creature flying fast, rapid wet insect-wing buzz with chittering',
      'medium living creature-ship, wet pulsing organic throb with clicking',
      'gigantic living hive creature-ship, slow deep wet heartbeat throb and cavernous organic breathing'),
 2:  ('small crystalline craft, high glassy shimmering whine',
      'crystalline starship drive, glass-harmonica drone with shimmering resonance',
      'vast crystal starship, deep resonant singing-glass drone with slow shimmering beats'),
 3:  ('scrap-built small craft engine, rattling sputtering high-revving whine with loose metal',
      'scrap-built freighter engine, rough rumbling chug with metal clanks',
      'enormous scrap-built hauler, heavy rattling engine rumble with groaning chains and knocking'),
 4:  ('small ethereal craft, airy shimmering whisper tone',
      'ethereal vessel, soft harmonic hum with breathy air',
      'vast serene vessel, deep calm harmonic drone with airy shimmer'),
 5:  ('twin ion engine starfighter, harsh screaming howl, aggressive and piercing',
      'military corvette, steady hard ion thruster roar with a mechanical hum',
      'colossal wedge-shaped warship engines, deep thrumming rumble with a low ion-drive roar, vast and menacing'),
 6:  ('scrappy starfighter engine, howling turbine roar with a rising whine',
      'corvette with a bank of roaring ion thrusters, throaty hum',
      'large rounded star cruiser engines, deep smooth rumbling roar with a warm hum'),
 7:  ('sleek alien fighter, smooth high humming whine, elegant',
      None,
      'sleek elegant alien war cruiser, near-silent smooth harmonic drone over a soft deep hum, graceful'),
 8:  ('dark living alien fighter, eerie breathy whisper with a thin high scream',
      'dark living alien hunter ship, eerie organic breathing drone with an unearthly scream',
      'enormous dark living alien vessel, deep unsettling organic drone with distant screaming and chittering'),
 9:  ('military space fighter, rough rocket thruster roar with bursts of reaction jets',
      'military missile cruiser, rumbling reaction thrusters with a mechanical hum',
      'heavy military destroyer, deep rumbling fusion thrusters with a slow rotating-section groan'),
 10: ('small fast starship at speed, bright clean high-pitched humming whine with a smooth warm pulse, no low rumble',  # take 1-2 of 'clean humming whine with a warm pulse' came back as a 100 Hz hum
      'starship at cruising speed, smooth warm engine hum with a gentle pulse',
      'large starship, deep smooth warm engine drone with a slow soft pulse'),
 11: ('aggressive small warship, snarling gritty engine growl',
      'bird-shaped warship, gritty growling engine with an aggressive throb',
      'large brutal battlecruiser, deep gritty growling rumble with a heavy throb'),
 12: ('small machine drone ship, cold digital servo whine with ticking',
      'machine warship, cold mechanical hum with rhythmic industrial pulses',
      'vast cube-shaped machine ship, colossal cold mechanical drone with rhythmic industrial pounding and hissing vents'),
 13: ('small retro-futuristic flying yacht, warm hovering turbine hum',
      'slow alien transport, warm resonant hum',
      'slow ancient alien vessel, deep warm resonant hum like a vast bell'),
 14: ('heavy military dropship, loud roaring jet thrusters with a turbine whine',
      'military troop transport, heavy rumbling thrusters with a ventilation hum',
      'huge military freighter, deep heavy rumbling thrusters with metal hull creaks'),
 15: ('small ancient alien craft, low organic hum with a hollow whistle',
      'ancient alien biomechanical ship, deep hollow organic hum with slow groaning',
      'colossal ancient alien derelict, deep cavernous organic drone with slow groaning'),
 16: ('stealthy hunter drop craft, low menacing growl with electronic clicking',
      'hunter scout ship, menacing growling hum with rhythmic clicking',
      'hunter mothership, deep menacing growl with rhythmic clicking and hissing'),
 17: (None, None,
      'vast ancient god-like vessel, profound deep resonant drone with ethereal overtones and slow shimmering'),
 18: ('small shuttle, smooth hissing whine',
      'predatory scout ship, smooth hissing drone with a low hum',
      'huge predatory warbird, smooth hissing drone over a deep menacing hum'),
 19: (None,
      'fast alien attack ship, aggressive pulsing whine over a humming drone',
      'alien battleship, aggressive deep humming drone with a rhythmic pulse'),
 20: ('heavy armoured gunship, roaring jet engines with a heavy mechanical whine',
      'gothic warship, roaring plasma drive with rumbling machinery',
      'enormous gothic cathedral battleship, deep roaring plasma drive with rumbling heavy machinery and clanking'),
 21: ('swarming alien bio-organism flying, wet buzzing wings and screeching',
      'living bio-ship, wet organic throb with chittering',
      'enormous living hive-ship, deep organic heartbeat throb with wet chittering'),
 22: ('futuristic electric fighter drone, clean high electric motor whine',
      'large rocket in flight, roaring rocket engine thunder',
      'gigantic rocket booster in flight, massive roaring rocket engine thunder with crackle'),
}
CLASSES = ('f', 'm', 'c')
for n, trio in ENGINES.items():
    for k, prompt in zip(CLASSES, trio):
        if prompt: ROLES[f'eng-{k}-{n}'] = (f'Starship engine, continuous and steady, heard from close by: {prompt}', 8.0, True)
    # A beam that fires for 3 s sounds for 3 s: a sustained loop (the one-shot beam-N gives its attack).
    ROLES[f'beamloop-{n}'] = (f'Continuous sustained energy beam, held steady: {FLEETS[n][2]}', 3.0, True)

V5 = {
 # impacts
 'hit-light':      ('Small energy bolt striking a starship metal hull, sharp metallic clang with sizzling sparks', 0.7, False),
 'hit-heavy':      ('Heavy cannon blast slamming into armoured starship hull, deep metal impact, tearing plating and scattering debris', 1.5, False),
 'shield-ring':    ('Energy deflector shield absorbing a weapon hit, resonant ringing electronic shimmer with a soft wobble, bright and tonal', 1.2, False),
 'shield-hum':     ('Energy shield taking a hit, gritty buzzing electric flare with a humming wobble', 1.2, False),
 'shield-crackle': ('Cold green energy barrier absorbing a hit, harsh digital crackle and electric buzz', 1.2, False),
 'whizz-e':        ('Energy bolt whizzing past very close to the ear, fast zip passing from one side to the other', 1.0, False),
 'whizz-k':        ('Cannon round whizzing past very close, supersonic crack and a fast zip', 1.0, False),
 'debris':         ('Metal debris tumbling and clattering, scattered small metal pieces bouncing off a hull', 1.8, False),
 'groan':          ('Huge metal starship structure groaning and creaking under enormous stress, deep low metallic moans, about to break', 5.0, False),
 'sparks':         ('Electrical sparks shorting out, crackling fizz and pops from damaged wiring', 1.2, False),
 'vent':           ('Damaged starship venting gas, steady hissing leak with sputtering sparks', 4.0, True),
 # arrivals by franchise family (exits are these reversed, in the build)
 'arrive-hyper':   ('Starship dropping out of lightspeed, sharp sudden whooshing snap and a deep air-pressure thump', 2.5, False),
 'arrive-jump':    ('Spinning vortex gateway opening in space, swelling rising electric whirl then a bright release as a ship emerges', 2.5, False),
 'arrive-warp':    ('Starship dropping out of faster-than-light travel, bright flash with a stretched tonal whoosh collapsing into a low boom', 2.5, False),
 'arrive-conduit': ('Green energy tunnel tearing open in space, distorted rushing roar and a harsh electronic rip', 2.5, False),
 'arrive-rift':    ('Organic rift opening in space, wet fleshy squelch and a deep gurgling rumble as a creature-ship pushes through', 2.5, False),
 'arrive-rocket':  ('Rocket engine ignition, crackling roaring blast building quickly then settling into a thrust roar', 2.5, False),
 # explosion layers (the body is explosion0-3)
 'xcrack':         ('Sharp explosive crack, the first split second of a huge blast, a snap of pressure, close', 0.6, False),
 'xsub':           ('Deep low explosion thump, massive low boom felt in the chest, short with a rumbling decay, no high frequencies', 2.5, False),
 'xdebris':        ('Debris raining down after an explosion, scattered metal fragments and crackling fire, tumbling pieces', 4.0, False),
 'xtail':          ('Distant rolling thunder tail of a huge explosion echoing across a vast space, long low rumbling decay', 6.0, False),
 'capital-break':  ('Colossal warship breaking apart in stages: groaning metal, a chain of internal secondary explosions, a massive reactor blast and a long collapse', 9.0, False),
 'age-end':        ('An impossibly vast ancient power dying: a deep rising resonant swell, a titanic detonation like a collapsing star, then a long shimmering ethereal decay', 12.0, False),
 'ringing':        ('High-pitched ear ringing after a deafening blast, a thin steady tinnitus tone slowly fading over a faint muffled rumble', 5.0, False),
 # interiors
 'cockpit-f':      ('Inside a small starfighter cockpit, muffled engine rumble through the hull, rattling panels and a low cabin hum', 8.0, True),
 'cockpit-c':      ('Inside a large starship bridge, deep muffled engine hum through the deck, soft ventilation and distant machinery', 8.0, True),
}
ROLES.update(V5)
def family(role):
    r = role.split('-')[0]
    return {'eng': 'loop', 'beamloop': 'loop', 'cockpit': 'loop', 'vent': 'loop', 'ambience': 'loop',
            'hit': 'impact', 'shield': 'impact', 'whizz': 'impact', 'debris': 'impact', 'sparks': 'impact', 'groan': 'impact',
            'arrive': 'event', 'xcrack': 'blast', 'xsub': 'blast', 'xdebris': 'blast', 'xtail': 'blast', 'capital': 'blast', 'age': 'blast', 'ringing': 'blast'}.get(r, 'shot')
STYLE_FOR = {
 'loop':   'Seamless steady loop, cinematic sci-fi sound design, high fidelity, no music, no speech',
 'impact': 'Close-up, dry, cinematic sci-fi sound design, high fidelity, no music, no speech',
 'event':  'Cinematic sci-fi sound design, big and clean, high fidelity, no music, no speech',
 'blast':  'Cinematic blockbuster sound design, huge and clean, high fidelity, no music, no speech',
}
INFLUENCE = {'loop': 0.6, 'impact': 0.5, 'event': 0.5, 'blast': 0.5}

TAKES = {'ambience': 1, 'stinger': 2}
def takes(role, default, explicit=False):
    if explicit: return default
    if role.startswith('engine-'): return 1
    if role.startswith('beam-'): return 2
    return TAKES.get(role, default)

def text(role):
    prompt, _, loop = ROLES[role]
    return f'{prompt}. {STYLE_FOR.get(family(role), STYLE)}'

def gen(role, take, key, out):
    prompt, secs, loop = ROLES[role]
    body = {'text': text(role), 'duration_seconds': secs, 'prompt_influence': INFLUENCE.get(family(role), 0.55),
            'output_format': 'pcm_44100', 'loop': loop}
    req = urllib.request.Request(ENDPOINT, json.dumps(body).encode(), method='POST',
        headers={'Authorization': f'Key {key}', 'Content-Type': 'application/json'})
    last = None
    for _ in range(2):  # every attempt is reserved (and counted) before it is sent
        row = ledger.reserve(ledger.SFX, role, take, secs, body['text'])
        try:
            url = json.load(urllib.request.urlopen(req, timeout=180))['audio']['url']
            path = out / f'{role}-{take}.wav'
            path.write_bytes(urllib.request.urlopen(url, timeout=120).read())
            ledger.settle(row, 'ok', path.name)
            return role, path
        except Exception as e:
            last = e; ledger.settle(row, 'failed: ' + str(e)[:80])
    raise RuntimeError(f'{role}-{take}: {last}')

def doc():
    print('# Tribute New sound design\n')
    print('Generated with ElevenLabs Sound Effects v2 on fal.ai by `scripts/gen-sfx-fal.py`,')
    print('built by `scripts/build-audio.py`. A role with samples plays them; anything else falls')
    print('back to the synth in `armada-audio-new.js`. Prompts describe sounds and never name a franchise.\n')
    print('| # | Fleet | Gun (shot-N) | Beam (beam-N) | Engine loop (engine-N) |\n|---|---|---|---|---|')
    for n, (name, gun, beam, engine) in FLEETS.items(): print(f'| {n} | {name} | {gun} | {beam} | {engine} |')
    print('\n## Death styles (boom-X, layered over the explosion)\n\n| Style | Fleets | Prompt |\n|---|---|---|')
    for b, (prompt, who) in BOOMS.items(): print(f'| {b} | {who} | {prompt} |')
    print('\n## Shared\n\n| Role | Prompt | Length |\n|---|---|---|')
    for r, (p, s, _) in ROLES.items():
        if not r.split('-')[0] in ('shot', 'beam', 'engine', 'boom'): print(f'| {r} | {p} | {s}s |')
    print(f'\nThese Version 4 prompts end with: "{STYLE}".')
    print('\n## Version 5: engines by size class (eng-f/m/c-N, seamless 8 s loops)\n')
    print('Each prompt is prefixed "Starship engine, continuous and steady, heard from close by:" and ends with the loop style below. A dash marks a class the fleet does not field.\n')
    print('| # | Fleet | Fighter (under 50 units) | Frigate (50-180) | Capital (180 and up) |\n|---|---|---|---|---|')
    for n, trio in ENGINES.items(): print(f'| {n} | {FLEETS[n][0]} | ' + ' | '.join(t or '-' for t in trio) + ' |')
    print('\nSustained beams (beamloop-N, 3 s loops) reuse each fleet\'s beam prompt above, prefixed "Continuous sustained energy beam, held steady:".')
    print('\n## Version 5: impacts, arrivals, explosion layers, interiors\n\n| Role | Prompt | Length | Loop |\n|---|---|---|---|')
    for r, (pr, sec, lp) in V5.items(): print(f'| {r} | {pr} | {sec}s | {"yes" if lp else ""} |')
    print('\nStyle suffixes by family:\n')
    for k, v in STYLE_FOR.items(): print(f'- {k}: "{v}" (prompt influence {INFLUENCE[k]})')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--roles', default=','.join(ROLES))
    ap.add_argument('--takes', type=int, default=None)
    ap.add_argument('--first', type=int, default=1, help='number of the first new take (keeps earlier takes)')
    ap.add_argument('--dry', action='store_true', help='print the jobs and their cost, generate nothing')
    ap.add_argument('--src', default='audio/src')
    ap.add_argument('--doc', action='store_true')
    a = ap.parse_args()
    if a.doc: return doc()
    roles = [r for r in a.roles.split(',') if r]
    unknown = [r for r in roles if r not in ROLES]
    if unknown: sys.exit('unknown roles: ' + ','.join(unknown))
    jobs = [(r, i) for r in roles for i in range(a.first, a.first + takes(r, a.takes or 3, a.takes is not None))]
    cost = sum(ROLES[r][1] for r, _ in jobs) * 0.002
    print(f'{len(jobs)} generations, ${cost:.3f}; ledger ${ledger.total():.3f} -> ${ledger.total() + cost:.3f} (stop ${ledger.STOP:.2f})')
    if a.dry:
        for r, i in jobs: print(f'  {r}-{i} {ROLES[r][1]}s  {text(r)}')
        return
    key = os.environ.get('FAL_KEY')
    if not key: sys.exit('FAL_KEY is not set')
    src = pathlib.Path(a.src); out = src / 'fal'; out.mkdir(parents=True, exist_ok=True)
    done = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for f in cf.as_completed([ex.submit(gen, r, i, key, out) for r, i in jobs]):
            try: role, path = f.result(); done.setdefault(role, []).append(path)
            except ledger.OverBudget as e: print('STOPPED (budget)', e)
            except Exception as e: print('FAIL', e)
    rj = src / 'roles.json'
    roles_map = json.loads(rj.read_text()) if rj.exists() else {}
    for role, paths in done.items(): roles_map[role] = sorted(set(roles_map.get(role, []) if isinstance(roles_map.get(role), list) else []) | {str(p.relative_to(src)) for p in paths})
    rj.write_text(json.dumps(roles_map, indent=1) + '\n')
    print(f'{sum(map(len, done.values()))} files written')

if __name__ == '__main__':
    main()
