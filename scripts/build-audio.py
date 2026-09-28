#!/usr/bin/env python3
"""Turn raw recordings into the page's sound set: audio/*.mp3 and audio/manifest.json.

python3 scripts/build-audio.py [--roles eng-c-5,score-battle] [--src audio/src] [--out audio]

audio/src/roles.json maps each role to source files (paths relative to audio/src), optionally
with a window in seconds: {"file": "fal/score-1.mp3", "start": 17.81, "end": 52.81, "xfade": 2.5}.
Raw generations (audio/src/fal/) are not committed. A role whose sources are missing keeps the
files already in audio/, so the build is incremental: nothing shipped is lost when it runs.

Families (see SOUND-DESIGN-NEW.md for every prompt and take):
  one-shots   guns (shot-N), beams (beam-N), impacts, whizz-bys, arrivals, explosion layers:
              trimmed, faded, zero-phase high-passed for their family and matched by loudness.
  derived     shotfar-N / beamfar-N: the fleet's own takes made distant (see far());
              exit-X: the arrival takes reversed.
  loops       engines by class (eng-f/m/c-N), sustained beams (beamloop-N), cockpit beds, venting,
              the battle bed and the score stems. The tail is folded into the head with an
              equal-power crossfade, the seam is measured, and the loop is written padded with
              its own wrap-around (0.25 s each side) so that any MP3 decoder delay still lands
              inside periodic audio; manifest.json "loops" gives each file's loop start and end.
  stems       score-calm/tension/battle loops are cut on whole 2.5 s bars (96 BPM) and folded
              with the bar before them; score-victory/defeat are one-shot codas.

Takes are measured (length that sounds, level steadiness, clipping, sub share) and a take that
fails is left out of the manifest and listed in audio/build-report.json with the reason.
manifest.json "groups" says what the page loads when: core at the first gesture, fleet[N] when
fleet N is in the war, soon right after. Needs numpy and ffmpeg.
"""
import json, struct, sys, argparse, pathlib, shutil, subprocess, math
import numpy as np

RATE, MUSIC_RATE, PAD = 32000, 44100, .25
RACE_BOOM = {1: 'burst', 2: 'shatter', 4: 'flash', 5: 'tie', 7: 'crystal', 8: 'dissolve', 10: 'warp', 12: 'cleave', 13: 'bronze', 15: 'fossil', 16: 'cloakpop', 17: 'flash', 18: 'warp', 19: 'warp', 21: 'burst'}
RACE_SHIELD = {10: 'shield-ring', 19: 'shield-ring', 11: 'shield-hum', 18: 'shield-hum', 12: 'shield-crackle'}
RACE_ARRIVAL = {5: 'hyper', 6: 'hyper', 7: 'jump', 8: 'rift', 9: 'jump', 10: 'warp', 11: 'warp', 12: 'conduit', 18: 'warp', 19: 'warp', 21: 'rift', 22: 'rocket'}
DROP = lambda r: r == 'music' or r.startswith('engine-')  # replaced by score stems and per-class engine loops

def family(role):
    if role.startswith('score-'): return 'stem'
    if role.startswith(('eng-', 'beamloop-', 'cockpit-')) or role in ('vent', 'ambience'): return 'loop'
    return 'oneshot'
is_loop = lambda role: family(role) in ('loop', 'stem') and role not in ('score-victory', 'score-defeat')
stereo = lambda role: role.startswith('score-') or role == 'ambience'

# (high-pass Hz, level target, kind) per role: kind 'rms' matches loudness of the sounding part, 'peak' normalizes the peak.
def spec(role):
    r = role
    if r.startswith('eng-f-'): return 90, -20, 'rms'
    if r.startswith('eng-m-'): return 55, -21, 'rms'
    if r.startswith('eng-c-'): return 32, -20, 'rms'
    if r.startswith('beamloop-'): return 120, -19, 'rms'
    if r.startswith('cockpit-'): return 40, -22, 'rms'
    if r == 'vent': return 200, -24, 'rms'
    if r == 'ambience': return 80, -24, 'rms'
    if r == 'score-calm': return 30, -24, 'rms'
    if r == 'score-tension': return 30, -21, 'rms'
    if r in ('score-battle', 'score-victory'): return 30, -18, 'rms'
    if r == 'score-defeat': return 30, -22, 'rms'
    if r.startswith(('shot-', 'beam-')) or r in ('arc', 'rail', 'ion-charge'): return 120, -17, 'rms'
    if r == 'hit-light': return 80, -16, 'rms'
    if r == 'hit-heavy': return 50, -15, 'rms'
    if r.startswith('shield-'): return 150, -17, 'rms'
    if r.startswith('whizz-'): return 150, -16, 'rms'
    if r == 'debris': return 150, -19, 'rms'
    if r == 'groan': return 40, -20, 'rms'
    if r == 'sparks': return 300, -20, 'rms'
    if r.startswith('arrive-'): return 45, -2, 'peak'
    if r == 'xcrack': return 150, -1, 'peak'
    if r == 'xsub': return 25, -2, 'peak'
    if r == 'xdebris': return 150, -20, 'rms'
    if r == 'xtail': return 40, -4, 'peak'
    if r in ('capital-break', 'age-end'): return 30, -1, 'peak'
    if r == 'ringing': return 800, -10, 'peak'
    if r.startswith('whoosh-'): return 80, -2, 'peak'
    if r.startswith('explosion') or r in ('ion-fire', 'stinger'): return 45, -1, 'peak'
    if r.startswith('boom-'): return 70, -2, 'peak'
    return 80, -4, 'peak'
MAXLEN = {'xcrack': 1.0, 'xsub': 3.0, 'whizz-e': 1.5, 'whizz-k': 1.5, 'hit-light': 1.0, 'hit-heavy': 2.0}

def read_wav(path):
    b = pathlib.Path(path).read_bytes()
    if b[:4] != b'RIFF' or b[8:12] != b'WAVE': raise ValueError(f'{path}: not a WAV file')
    i, fmt, data = 12, None, None
    while i + 8 <= len(b):
        cid, n = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]
        body = b[i + 8:i + 8 + n]
        if cid == b'fmt ': fmt = body
        elif cid == b'data': data = body
        i += 8 + n + (n & 1)
    tag, ch, rate = struct.unpack('<HHI', fmt[:8]); bits = struct.unpack('<H', fmt[14:16])[0]
    if tag == 0xFFFE: tag = struct.unpack('<H', fmt[24:26])[0]
    width = bits // 8; frames = len(data) // (width * ch); data = data[:frames * width * ch]
    if tag == 3 and bits == 32: x = np.frombuffer(data, '<f4').astype(np.float64)
    elif bits == 16: x = np.frombuffer(data, '<i2') / 32768.0
    elif bits == 24:
        a = np.frombuffer(data, np.uint8).reshape(-1, 3).astype(np.int32)
        v = a[:, 0] | (a[:, 1] << 8) | (a[:, 2] << 16); v[v >= 1 << 23] -= 1 << 24; x = v / float(1 << 23)
    elif bits == 32: x = np.frombuffer(data, '<i4') / 2147483648.0
    else: raise ValueError(f'{path}: unsupported {bits}-bit format {tag}')
    return x.reshape(-1, ch), rate

def read_any(path, rate=44100):
    if path.suffix.lower() == '.wav': return read_wav(path)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(rate), '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, '<f4').astype(np.float64).reshape(-1, 2), rate

def resample(x, rate, to):
    if rate == to: return x
    n = int(round(len(x) * to / rate))
    X = np.fft.rfft(x, axis=0); m = n // 2 + 1
    Y = np.zeros((m, x.shape[1]), complex); k = min(m, X.shape[0]); Y[:k] = X[:k]
    return np.fft.irfft(Y, n, axis=0) * (n / len(x))

def zero_phase(x, rate, hp=None, lp=None, order=2):
    """Butterworth-magnitude high/low-pass applied in the frequency domain: no phase shift, no smeared transients."""
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / rate); f[0] = 1e-3; H = np.ones_like(f)
    if hp: H = H / np.sqrt(1 + (hp / f) ** (2 * order))
    if lp: H = H / np.sqrt(1 + (f / lp) ** (2 * order))
    return np.fft.irfft(X * H[:, None], len(x), axis=0)

def frames_rms(x, rate, win=.05):
    n = max(1, int(win * rate)); m = len(x) // n
    if not m: return np.array([np.sqrt((x ** 2).mean())])
    f = x[:m * n].reshape(m, n * x.shape[1]); return np.sqrt((f ** 2).mean(axis=1))

def level(x, rate, target, kind):
    if kind == 'peak':
        p = np.abs(x).max(); return x * (10 ** (target / 20) / p) if p > 0 else x
    r = frames_rms(x, rate); act = r[r > r.max() * 10 ** (-40 / 20)]
    if len(act): x = x * 10 ** ((target - 20 * np.log10(np.sqrt((act ** 2).mean()))) / 20)
    p = np.abs(x).max()
    if p > 10 ** (-1 / 20): x = x * (10 ** (-1 / 20) / p)
    return x

def fold(x, rate, xfade, tail=None):
    """Seamless loop: the tail (after the loop's end) is laid over the head with an equal-power crossfade."""
    X = int(xfade * rate)
    if tail is None:  # generated loop: the last X samples become the tail
        body, tail = x[:-X], x[-X:]
    else: body = x
    X = min(X, len(tail), len(body) // 3)
    t = np.linspace(0, np.pi / 2, X)[:, None]
    y = body.copy(); y[:X] = body[:X] * np.sin(t) + tail[:X] * np.cos(t)
    return y

def seam(y, rate):
    """How audible the wrap is: [level step across it in 100 ms windows (dB), the 95th percentile of the same
    step between neighbouring windows inside the loop (dB), the sample jump at the wrap over the mean step]."""
    n = int(.1 * rate); r = lambda z: 20 * np.log10(np.sqrt((z ** 2).mean()) + 1e-9)
    step = r(y[:n]) - r(y[-n:])
    w = [r(y[i:i + n]) for i in range(0, len(y) - n, n)]; inner = np.percentile(np.abs(np.diff(w)), 95) if len(w) > 2 else 0
    d = np.abs(np.diff(y, axis=0)).mean() + 1e-12; jump = float(np.abs(y[0] - y[-1]).max() / d)
    return [round(float(step), 2), round(float(inner), 2), round(jump, 1)]

def bass_harmonics(x, rate):
    """Makes a rumble read on small speakers: the sub band (under 110 Hz) is lowered 4 dB and its soft-saturated
    copy, band-limited to 120-500 Hz, is mixed back at -12 dB. Only harmonics are added; no tone is synthesized."""
    sub = zero_phase(x, rate, lp=110, order=4); rest = x - sub
    drive = sub / (np.abs(sub).max() + 1e-9) * 4; h = zero_phase(np.tanh(drive), rate, hp=120, lp=500, order=4)
    h *= np.sqrt((sub ** 2).mean()) / (np.sqrt((h ** 2).mean()) + 1e-12) * 10 ** (-12 / 20)
    return rest + sub * 10 ** (-4 / 20) + h

def far(x, rate):
    """A gun heard from far off: darker (low-pass 2.2 kHz), a little lower and slower (x0.86), its attack
    softened and a short dark room behind it (0.4 s of decaying low-passed noise, 40% wet), so the
    distant shot is a thump rather than a small copy of the near one."""
    y = resample(x, rate, int(rate / .86)); y = zero_phase(y, rate, hp=90, lp=2200)
    n = int(.4 * rate); rng = np.random.default_rng(7); ir = rng.standard_normal(n) * np.exp(-np.arange(n) / rate * 9)
    ir = zero_phase(ir[:, None], rate, lp=1500)[:, 0]; ir /= np.sqrt((ir ** 2).sum())
    wet = np.stack([np.convolve(y[:, c], ir)[:len(y) + n // 2] for c in range(y.shape[1])], 1)
    dry = np.pad(y, ((0, n // 2), (0, 0)))
    att = np.minimum(1, np.arange(len(dry)) / (.012 * rate))[:, None]
    return dry * att * .75 + wet * .4

def falling(x, rate, lo=60, hi=700):
    """The low-tone slide that reads as a raspberry (the lesson of Version 2): the longest run of a
    prominent spectral peak (60-700 Hz, 12 dB over the band's median) gliding down, as
    (octaves dropped, seconds, start Hz, end Hz)."""
    x = x.mean(axis=1) if x.ndim > 1 else x
    n = 4096; hop = int(.02 * rate); win = np.hanning(n); f = np.fft.rfftfreq(n, 1 / rate); band = (f >= lo) & (f <= hi); fb = f[band]
    pk, pr = [], []
    for i in range(0, len(x) - n, hop):
        s = 20 * np.log10(np.abs(np.fft.rfft(x[i:i + n] * win))[band] + 1e-9); j = int(np.argmax(s)); pk.append(fb[j]); pr.append(s[j] - np.median(s))
    best, start = (0.0, 0.0, 0, 0), 0
    for k in range(1, len(pk) + 1):
        ok = k < len(pk) and pr[k] > 12 and pr[k - 1] > 12 and .85 < pk[k] / pk[k - 1] <= 1.03
        if not ok:
            if k - start >= 2:
                drop = float(np.log2(pk[start] / pk[k - 1])); dur = (k - 1 - start) * hop / rate
                if drop > best[0] and dur >= .25: best = (round(drop, 2), round(dur, 2), int(pk[start]), int(pk[k - 1]))
            start = k
    return best

def measure(x, rate, role, want):
    r = frames_rms(x, rate, .05); db = 20 * np.log10(r + 1e-9); top = db.max()
    sounding = (db > top - 30).sum() * .05
    X = np.abs(np.fft.rfft(x.mean(axis=1))) ** 2; f = np.fft.rfftfreq(len(x), 1 / rate); tot = X.sum() + 1e-12
    m = {'seconds': round(len(x) / rate, 2), 'sounding_s': round(float(sounding), 2), 'sub_lt120': round(float(X[f < 120].sum() / tot), 3),
         'centroid_hz': int((f * X).sum() / tot), 'clip': int((np.abs(x) > .995).sum())}
    if is_loop(role):
        body = db[db > top - 40]; m['steady_db'] = round(float(np.percentile(body, 90) - np.percentile(body, 10)), 1) if len(body) else 99
    why = []
    if want and sounding < .3 * min(want, len(x) / rate) and not role.startswith(('xcrack', 'hit-', 'sparks', 'shot', 'whizz')): why.append(f'mostly silent ({sounding:.1f} s sounding)')
    if is_loop(role) and not role.startswith('score-') and m['steady_db'] > 14: why.append(f"not steady ({m['steady_db']} dB swing)")
    if m['clip'] > .001 * len(x) * x.shape[1]: why.append(f"clipped ({m['clip']} samples)")
    if role.startswith(('eng-f-', 'whizz-', 'shield-', 'sparks')) and m['sub_lt120'] > .5: why.append(f"sub-heavy ({m['sub_lt120']:.0%} under 120 Hz)")
    fl = falling(x, rate); m['falling'] = fl
    if fl[0] >= .5 and fl[3] < 150: why.append(f'falling low tone ({fl[0]} octaves to {fl[3]} Hz in {fl[1]} s)')
    return m, why

def process(x, rate, role, e):
    out_rate = MUSIC_RATE if stereo(role) else RATE
    if e.get('start') is not None or e.get('end') is not None:
        a = int((e.get('start') or 0) * rate); b = int(e['end'] * rate) if e.get('end') is not None else len(x)
        xf = e.get('xfade', 0); tail = x[b:b + int(xf * rate)] if xf and role.startswith('score-') and is_loop(role) else None
        x = x[a:b]
    else: tail = None
    x = x.mean(axis=1, keepdims=True) if not stereo(role) else (x if x.shape[1] == 2 else np.repeat(x[:, :1], 2, axis=1))
    if tail is not None: tail = tail.mean(axis=1, keepdims=True) if not stereo(role) else tail
    x = resample(x, rate, out_rate)
    if tail is not None: tail = resample(tail, rate, out_rate)
    hp, tgt, kind = spec(role)
    x = zero_phase(x, out_rate, hp=hp, lp=400 if role == 'xsub' else None)
    if tail is not None: tail = zero_phase(tail, out_rate, hp=hp)
    if role.startswith(('eng-c-', 'eng-m-')) or role == 'cockpit-c':
        x = bass_harmonics(x, out_rate)
        if tail is not None: tail = bass_harmonics(tail, out_rate)
    info = {}
    if is_loop(role):
        info['seam_raw'] = seam(x, out_rate)
        x = fold(x, out_rate, e.get('xfade', .6 if not role.startswith('score-') else 2.5), tail)
        x = x - x.mean(axis=0)
        info['seam'] = seam(x, out_rate)
    else:
        env = np.abs(x).max(axis=1); thr = env.max() * 10 ** (-50 / 20); idx = np.nonzero(env > thr)[0]
        if len(idx): x = x[max(0, idx[0] - int(.002 * out_rate)): idx[-1] + 1]
        ml = MAXLEN.get(role) or (1.5 if role.startswith(('shot-', 'beam-')) else None)
        if ml and len(x) > ml * out_rate: x = x[:int(ml * out_rate)]
        fo = min(len(x) // 4, int((1.0 if role.startswith('score-') else .03) * out_rate))
        if fo: x[-fo:] *= np.linspace(1, 0, fo)[:, None]
        fi = min(len(x) // 8, int(.002 * out_rate))
        if fi: x[:fi] *= np.linspace(0, 1, fi)[:, None]
        x = x - x.mean(axis=0)
    return level(x, out_rate, tgt, kind), out_rate, info

def write_wav(path, x, rate):
    y = np.clip(np.round(x * 32767), -32768, 32767).astype('<i2'); ch = x.shape[1]; data = y.tobytes()
    hdr = b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, ch, rate, rate * ch * 2, ch * 2, 16) + b'data' + struct.pack('<I', len(data))
    pathlib.Path(path).write_bytes(hdr + data)

def encode(x, rate, out, name, role, loops):
    """MP3 (a tenth of WAV). A loop is written with PAD seconds of its own wrap-around on each side."""
    if is_loop(role):
        p = int(PAD * rate); x = np.concatenate([x[-p:], x, x[:p]]); loops[name] = [round(PAD, 6), round(PAD + (len(x) - 2 * p) / rate, 6)]
    wav = out / (name[:-4] + '.wav'); write_wav(wav, x, rate)
    br = '160k' if stereo(role) else '112k' if role.startswith(('eng-', 'beamloop-', 'cockpit-')) or role == 'vent' else '128k'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', br, str(out / name)], check=True)
    wav.unlink()

def decode_out(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, '<f4').astype(np.float64).reshape(-1, 1), RATE

def groups(roles):
    fleet = {}
    for n in range(23):
        rs = [f'shot-{n}', f'shotfar-{n}', f'beam-{n}', f'beamfar-{n}', f'beamloop-{n}'] + [f'eng-{c}-{n}' for c in 'fmc']
        if n in RACE_BOOM: rs.append('boom-' + RACE_BOOM[n])
        if n in RACE_ARRIVAL: rs += ['arrive-' + RACE_ARRIVAL[n], 'exit-' + RACE_ARRIVAL[n]]
        if n in RACE_SHIELD: rs.append(RACE_SHIELD[n])
        if n == 17: rs += ['age-end', 'explosion3']  # only a First One dies like that
        fleet[n] = [r for r in rs if r in roles]
    per = {r for rs in fleet.values() for r in rs}
    # Streamed right after the first gesture: the rest of the score, and what a capital death or an
    # ion strike needs (neither happens in a war's first seconds).
    soon = [r for r in ('score-tension', 'score-battle', 'score-victory', 'score-defeat', 'cockpit-f', 'cockpit-c', 'capital-break', 'xtail', 'groan',
                        'ringing', 'whoosh-1', 'stinger', 'ion-charge', 'ion-fire') if r in roles]
    core = [r for r in roles if r not in per and r not in soon]
    return {'core': core, 'soon': soon, 'fleet': fleet}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--src', default='audio/src'); ap.add_argument('--out', default='audio'); ap.add_argument('--roles', default='')
    a = ap.parse_args(); src, out = pathlib.Path(a.src), pathlib.Path(a.out)
    roles_src = json.loads((src / 'roles.json').read_text())
    old = json.loads((out / 'manifest.json').read_text()) if (out / 'manifest.json').exists() else {'roles': {}}
    man = {'roles': {k: v for k, v in old['roles'].items() if not DROP(k)}, 'loops': old.get('loops', {})}
    report = json.loads((out / 'build-report.json').read_text()) if (out / 'build-report.json').exists() else {}
    only = set(r for r in a.roles.split(',') if r)
    want_len = {}
    try:
        g = {'__file__': str(pathlib.Path(__file__).parent / 'gen-sfx-fal.py'), '__name__': 'lib'}
        exec((pathlib.Path(__file__).parent / 'gen-sfx-fal.py').read_text(), g); want_len = {k: v[1] for k, v in g['ROLES'].items()}
    except Exception: pass
    for role, entries in roles_src.items():
        if DROP(role) or (only and role not in only): continue
        entries = [({'file': e} if isinstance(e, str) else e) for e in (entries if isinstance(entries, list) else [entries])]
        if not any((src / e['file']).exists() or e.get('unused') for e in entries):
            continue  # sources gone (raw generations are not committed): keep what is shipped
        shipped, files, rep = man['roles'].get(role, []), [], []
        for n, e in enumerate(entries):
            if e.get('unused'):  # generated and paid for, kept out of the set (the reason goes in the report)
                for f in shipped:
                    if f.rsplit('.', 1)[0] == f'{role}-{n + 1}': (out / f).unlink(missing_ok=True)
                rep.append({'take': f'{role}-{n + 1}.mp3', 'rejected': ['unused: ' + e['unused']]}); continue
            if not (src / e['file']).exists():  # an earlier take whose raw file is gone: keep the shipped one
                keep = [f for f in shipped if f.rsplit('.', 1)[0] == f'{role}-{n + 1}']
                if keep:
                    fl = falling(*decode_out(out / keep[0]))
                    if fl[0] >= .5 and fl[3] < 150: rep.append({'take': keep[0], 'rejected': [f'falling low tone ({fl[0]} octaves to {fl[3]} Hz in {fl[1]} s)'], 'kept': False}); continue
                    files.append(keep[0]); rep.append({'take': keep[0], 'kept': 'shipped; raw not in the repo', 'falling': fl})
                continue
            x, rate = read_any(src / e['file'])
            y, r, info = process(x, rate, role, e)
            m, why = measure(y, r, role, want_len.get(role)); m.update(info); m['source'] = e['file']
            name = f'{role}-{n + 1}.mp3'
            if why: rep.append({'take': name, 'rejected': why, **m}); man['loops'].pop(name, None); continue
            encode(y, r, out, name, role, man['loops']); files.append(name); rep.append({'take': name, **m, 'kb': (out / name).stat().st_size // 1024})
        report[role] = rep
        if files: man['roles'][role] = files
        else: man['roles'].pop(role, None)
        print(f"{role:16s} {len(files)} kept {sum(1 for t in rep if 'rejected' in t)} rejected " + ' '.join(f"{t['take'].split('-')[-1][:-4]}:{t.get('seam', '')}" for t in rep if 'rejected' not in t))
    # Roles shipped by earlier passes whose raw files are gone were not measured above: check their
    # takes for the falling low tone too, keeping at least the best one of each role.
    built = {r for r in roles_src if any((src / (e if isinstance(e, str) else e['file'])).exists() for e in (roles_src[r] if isinstance(roles_src[r], list) else [roles_src[r]]))}
    for role in list(man['roles']):
        if role in built or role.startswith(('shotfar-', 'beamfar-', 'exit-')) or is_loop(role): continue
        fl = {f: falling(*decode_out(out / f)) for f in man['roles'][role]}
        bad = [f for f, v in fl.items() if v[0] >= .5 and v[3] < 150]
        if len(bad) == len(fl): bad.remove(min(bad, key=lambda f: fl[f][0]))
        if bad:
            man['roles'][role] = [f for f in man['roles'][role] if f not in bad]
            report.setdefault(role, [])
            report[role] = [t for t in report[role] if t.get('take') not in bad] + [{'take': f, 'rejected': [f'falling low tone ({fl[f][0]} octaves to {fl[f][3]} Hz in {fl[f][1]} s)'], 'kept': False} for f in bad]
            print(f'{role:16s} dropped {bad} (falling low tone)')
    # Derived: distant guns and beams from every take of the fleet's own; exits from arrivals, reversed.
    for n in range(23):
        for kind in ('shot', 'beam'):
            role = f'{kind}far-{n}'
            if only and role not in only and f'{kind}-{n}' not in only: continue
            srcs = man['roles'].get(f'{kind}-{n}', [])
            if not srcs: continue
            for f in man['roles'].get(role, []): (out / f).unlink(missing_ok=True)
            files = []
            for i, f in enumerate(srcs):
                x, r = decode_out(out / f); y = level(far(x, r), r, -19, 'rms'); name = f'{role}-{i + 1}.mp3'
                encode(y, r, out, name, role, man['loops']); files.append(name)
            man['roles'][role] = files
    for style in sorted(set(RACE_ARRIVAL.values())):
        role, srcr = f'exit-{style}', f'arrive-{style}'
        if srcr not in man['roles'] or (only and srcr not in only and role not in only): continue
        for f in man['roles'].get(role, []): (out / f).unlink(missing_ok=True)
        files = []
        for i, f in enumerate(man['roles'][srcr]):
            x, r = decode_out(out / f); y = x[::-1].copy(); k = int(.01 * r); y[:k] *= np.linspace(0, 1, k)[:, None]; y[-k:] *= np.linspace(1, 0, k)[:, None]
            name = f'{role}-{i + 1}.mp3'; encode(y, r, out, name, role, man['loops']); files.append(name)
        man['roles'][role] = files
    # Anything in audio/ the manifest no longer names (rejected takes, the old engine WAVs and score) goes.
    used = {f for rs in man['roles'].values() for f in rs}
    for f in list(out.glob('*.mp3')) + list(out.glob('*.wav')):
        if f.name not in used: f.unlink()
    for f in list(man['loops']):
        if f not in used: man['loops'].pop(f)
    man['groups'] = groups(man['roles'])
    size = lambda rs: sum((out / f).stat().st_size for r in rs for f in man['roles'].get(r, []))
    g = man['groups']; fl = {n: size(rs) for n, rs in g['fleet'].items()}
    man['sizes'] = {'core_mb': round(size(g['core']) / 1048576, 2), 'soon_mb': round(size(g['soon']) / 1048576, 2),
                    'fleet_mb': {n: round(v / 1048576, 2) for n, v in fl.items()}, 'total_mb': round(sum((out / f).stat().st_size for rs in man['roles'].values() for f in rs) / 1048576, 2)}
    (out / 'manifest.json').write_text(json.dumps(man, indent=1) + '\n')
    (out / 'build-report.json').write_text(json.dumps(report, indent=1) + '\n')
    s = man['sizes']; two = sorted(fl.values())[-2:]
    print(f"{sum(len(v) for v in man['roles'].values())} files, {s['total_mb']} MB; first gesture: core {s['core_mb']} MB + two fleets up to {sum(two) / 1048576:.2f} MB; then {s['soon_mb']} MB streamed")

if __name__ == '__main__':
    main()
