#!/usr/bin/env python3
"""Generate the Tribute War score stems with ElevenLabs Music on fal.ai.

FAL_KEY=... python3 scripts/gen-music-fal.py [--take 1] [--dry]

One generation, one composition plan, so every stem shares a key (D minor), a tempo
(96 BPM, 4/4, a bar is exactly 2.5 s) and a theme. Sections are whole bars:

  intro    2 bars   5 s   lead-in (only used as the calm loop's pre-roll)
  calm    14 bars  35 s   ambient: sustained strings, the theme stated quietly
  tension 16 bars  40 s   ostinato strings, low brass, timpani pulse, theme in low horns
  battle  22 bars  55 s   full orchestra and percussion, the theme heroic in the brass
  victory  8 bars  20 s   coda: the theme resolved in major, final chord
  defeat   8 bars  20 s   coda: the theme as a slow lament, fading out

175 s bills as 3 minutes: $1.80 at $0.60 per minute (reserved in bench/audio/ledger.csv).
scripts/build-audio.py cuts the stems at the section boundaries and loops calm, tension
and battle on whole bars. Prompts name no franchise and no composer.
"""
import json, os, sys, argparse, pathlib, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import fal_ledger as ledger

ENDPOINT = 'https://fal.run/fal-ai/elevenlabs/music'
BPM, BAR = 96, 2.5
THEME = 'a five-note rising horn motif in D minor (D, F, A, then up to D and falling to C), heroic and tragic'
GLOBAL_POS = ['original orchestral film score for a vast space battle', 'D minor', '96 BPM', '4/4 time', 'full symphony orchestra',
              f'main theme: {THEME}', 'cinematic, wide, high production quality', 'instrumental']
GLOBAL_NEG = ['vocals', 'sung lyrics', 'electronic dance beat', 'electric guitar', 'synth lead', 'lo-fi', 'tempo changes', 'key changes']
SECTIONS = [
 ('intro',   2, ['soft sustained low strings on a D pedal', 'very quiet'], ['percussion', 'brass']),
 ('calm',   14, ['calm ambient', 'sparse sustained strings', 'a soft solo horn states the main theme quietly', 'spacious, suspended, uneasy'], ['drums', 'percussion', 'loud brass']),
 ('tension', 16, ['building tension', 'driving eighth-note string ostinato', 'low brass stabs', 'soft timpani pulse', 'the main theme in low horns'], ['full percussion climax']),
 ('battle', 22, ['full battle', 'driving taiko and snare percussion', 'full brass playing the main theme heroically', 'fast string runs', 'very intense and loud'], ['quiet passages']),
 ('victory', 8, ['victory coda', 'triumphant D major resolution of the main theme in the brass', 'a long sustained final chord'], ['percussion loop']),
 ('defeat',  8, ['defeat coda', 'slow sorrowful lament of the main theme on solo horn over strings', 'fading to silence'], ['percussion', 'triumphant brass']),
]

def plan():
    return {'positive_global_styles': GLOBAL_POS, 'negative_global_styles': GLOBAL_NEG,
            'sections': [{'section_name': n, 'positive_local_styles': p, 'negative_local_styles': q, 'duration_ms': int(b * BAR * 1000), 'lines': []}
                         for n, b, p, q in SECTIONS]}

# Take 1 of the plan came back in key and tempo (D minor centre, 95.7 BPM) but did not keep the
# section lengths: its calm opening is only 15 s. The calm stem is generated on its own, from a
# prompt that repeats the key, tempo and motif: 23 bars, 57.5 s, billed as one minute ($0.60).
STEMS = {'calm': (f'Calm, spacious orchestral film score in D minor at exactly 96 BPM, 4/4. Sparse sustained strings and a soft solo horn '
                  f'quietly stating {THEME}. The uneasy calm before a vast space battle: suspended, patient, dark. No percussion. '
                  f'Instrumental, cinematic, high production quality.', 57500)}

def stem(name, take, key):
    prompt, ms = STEMS[name]; secs = ms / 1000
    body = {'prompt': prompt, 'music_length_ms': ms, 'force_instrumental': True, 'output_format': 'mp3_44100_192'}
    row = ledger.reserve(ledger.MUSIC, 'score-' + name, take, secs, prompt)
    req = urllib.request.Request(ENDPOINT, json.dumps(body).encode(), method='POST', headers={'Authorization': f'Key {key}', 'Content-Type': 'application/json'})
    try:
        url = json.load(urllib.request.urlopen(req, timeout=600))['audio']['url']
        path = pathlib.Path('audio/src/fal') / f'score-{name}-{take}.mp3'; path.write_bytes(urllib.request.urlopen(url, timeout=300).read())
        ledger.settle(row, 'ok', path.name); print('wrote', path)
    except Exception as e:
        ledger.settle(row, 'failed: ' + str(e)[:80]); raise

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--take', type=int, default=1); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--stem', default=None, help='generate one stem from a prompt instead of the plan (calm)')
    a = ap.parse_args()
    if a.stem:
        print(f'{a.stem}: {STEMS[a.stem][1] / 1000:.1f} s, ${ledger.price(ledger.MUSIC, STEMS[a.stem][1] / 1000):.2f}; ledger ${ledger.total():.3f}')
        if a.dry: return print(STEMS[a.stem][0])
        key = os.environ.get('FAL_KEY')
        if not key: sys.exit('FAL_KEY is not set')
        return stem(a.stem, a.take, key)
    body = {'composition_plan': plan(), 'respect_sections_durations': True, 'output_format': 'mp3_44100_192'}
    secs = sum(b for _, b, _, _ in SECTIONS) * BAR
    print(f'{secs:.0f} s, ${ledger.price(ledger.MUSIC, secs):.2f}; ledger ${ledger.total():.3f}')
    if a.dry: print(json.dumps(body, indent=1)); return
    key = os.environ.get('FAL_KEY')
    if not key: sys.exit('FAL_KEY is not set')
    out = pathlib.Path('audio/src/fal'); out.mkdir(parents=True, exist_ok=True)
    row = ledger.reserve(ledger.MUSIC, 'score', a.take, secs, json.dumps(body['composition_plan']))
    req = urllib.request.Request(ENDPOINT, json.dumps(body).encode(), method='POST', headers={'Authorization': f'Key {key}', 'Content-Type': 'application/json'})
    try:
        url = json.load(urllib.request.urlopen(req, timeout=600))['audio']['url']
        path = out / f'score-{a.take}.mp3'; path.write_bytes(urllib.request.urlopen(url, timeout=300).read())
        ledger.settle(row, 'ok', path.name); print('wrote', path)
    except Exception as e:
        ledger.settle(row, 'failed: ' + str(e)[:80]); raise
    (out / f'score-{a.take}.plan.json').write_text(json.dumps({'bpm': BPM, 'bar': BAR, 'sections': [[n, b] for n, b, _, _ in SECTIONS]}))

if __name__ == '__main__':
    main()
