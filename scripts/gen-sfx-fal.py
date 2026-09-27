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
only. Cost: $0.002 per generated second.

Prompts describe sounds, never name a franchise: the aim is each fleet's
character, recorded fresh, not a copy of anyone's library.
"""
import json, os, sys, argparse, pathlib, urllib.request, concurrent.futures as cf

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
      'high-voltage electric pulse gun, sharp crackling tesla-coil snap',
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
TAKES = {'ambience': 1, 'stinger': 2}
def takes(role, default):
    if role.startswith('engine-'): return 1
    if role.startswith('beam-'): return 2
    return TAKES.get(role, default)

def gen(role, take, key, out):
    prompt, secs, loop = ROLES[role]
    body = {'text': f'{prompt}. {STYLE}', 'duration_seconds': secs, 'prompt_influence': 0.55,
            'output_format': 'pcm_44100', 'loop': loop}
    req = urllib.request.Request(ENDPOINT, json.dumps(body).encode(), method='POST',
        headers={'Authorization': f'Key {key}', 'Content-Type': 'application/json'})
    last = None
    for _ in range(3):
        try:
            url = json.load(urllib.request.urlopen(req, timeout=180))['audio']['url']
            path = out / f'{role}-{take}.wav'
            path.write_bytes(urllib.request.urlopen(url, timeout=120).read())
            return role, path
        except Exception as e: last = e
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
    print(f'\nEvery prompt ends with: "{STYLE}".')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--roles', default=','.join(ROLES))
    ap.add_argument('--takes', type=int, default=3)
    ap.add_argument('--src', default='audio/src')
    ap.add_argument('--doc', action='store_true')
    a = ap.parse_args()
    if a.doc: return doc()
    key = os.environ.get('FAL_KEY')
    if not key: sys.exit('FAL_KEY is not set')
    src = pathlib.Path(a.src); out = src / 'fal'; out.mkdir(parents=True, exist_ok=True)
    roles = [r for r in a.roles.split(',') if r]
    jobs = [(r, i) for r in roles for i in range(1, takes(r, a.takes) + 1)]
    print(f'{len(jobs)} generations, ~${sum(ROLES[r][1] for r, _ in jobs) * 0.002:.2f}')
    done = {}
    with cf.ThreadPoolExecutor(6) as ex:
        for f in cf.as_completed([ex.submit(gen, r, i, key, out) for r, i in jobs]):
            try: role, path = f.result(); done.setdefault(role, []).append(path)
            except Exception as e: print('FAIL', e)
    rj = src / 'roles.json'
    roles_map = json.loads(rj.read_text()) if rj.exists() else {}
    for role, paths in done.items(): roles_map[role] = sorted(str(p.relative_to(src)) for p in paths)
    rj.write_text(json.dumps(roles_map, indent=1) + '\n')
    print(f'{sum(map(len, done.values()))} files written')

if __name__ == '__main__':
    main()
