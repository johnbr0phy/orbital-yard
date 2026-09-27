#!/usr/bin/env python3
"""Turn raw recordings into the page's sound set.

python3 scripts/build-audio.py [--src audio/src] [--out audio]

audio/src/roles.json maps each role to source files (paths relative to
audio/src), optionally with a start/end window in seconds:

  {"laser": ["Blaster Shot 01.wav", {"file": "Blaster Shot 02.wav", "start": 0.1, "end": 0.9}],
   "explosion3": ["Huge Explosion.wav"], "ambience": ["Distant Battle Loop.wav"]}

Roles: laser phaser pulse kinetic plasma organic ion-charge ion-fire arc rail
beam, explosion0-3, stinger, music, ambience, plus per-fleet shot-N, beam-N and
engine-N (N = race index; engine-N are loops). Each file is decoded (PCM
16/24/32-bit or float), windowed, silence-trimmed, faded, resampled to
32 kHz, peak-normalized for its role and written as 16-bit WAV (mono for
effects, stereo for music and ambience), then audio/manifest.json is written.
Needs only numpy.
"""
import json, struct, sys, argparse, pathlib, shutil, subprocess
import numpy as np

RATE = 32000
LOOPS = {'music', 'ambience'}
is_loop = lambda role: role in LOOPS or role.startswith('engine-')
# peak targets (dBFS) and maximum lengths (s) per role family
def spec(role):
    if is_loop(role): return -3.0, None
    if role.startswith('explosion') or role in ('ion-fire', 'stinger'): return -1.0, 8.0
    if role == 'ion-charge': return -4.0, 5.0
    if role.startswith('boom-'): return -2.0, 3.5
    return -4.0, 1.5

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
    if fmt is None or data is None: raise ValueError(f'{path}: missing fmt or data chunk')
    tag, ch, rate = struct.unpack('<HHI', fmt[:8]); bits = struct.unpack('<H', fmt[14:16])[0]
    if tag == 0xFFFE: tag = struct.unpack('<H', fmt[24:26])[0]  # WAVE_FORMAT_EXTENSIBLE
    width = bits // 8; frames = len(data) // (width * ch); data = data[:frames * width * ch]
    if tag == 3 and bits == 32: x = np.frombuffer(data, '<f4').astype(np.float64)
    elif tag == 3 and bits == 64: x = np.frombuffer(data, '<f8')
    elif bits == 16: x = np.frombuffer(data, '<i2') / 32768.0
    elif bits == 24:
        a = np.frombuffer(data, np.uint8).reshape(-1, 3).astype(np.int32)
        v = a[:, 0] | (a[:, 1] << 8) | (a[:, 2] << 16); v[v >= 1 << 23] -= 1 << 24; x = v / float(1 << 23)
    elif bits == 32: x = np.frombuffer(data, '<i4') / 2147483648.0
    elif bits == 8: x = (np.frombuffer(data, np.uint8) - 128) / 128.0
    else: raise ValueError(f'{path}: unsupported {bits}-bit format {tag}')
    return x.reshape(-1, ch), rate

def resample(x, rate):
    if rate == RATE: return x
    n = int(round(len(x) * RATE / rate))
    X = np.fft.rfft(x, axis=0); m = n // 2 + 1
    Y = np.zeros((m, x.shape[1]), complex); k = min(m, X.shape[0]); Y[:k] = X[:k]
    return np.fft.irfft(Y, n, axis=0) * (n / len(x))

def process(x, rate, role, start=None, end=None):
    if start is not None or end is not None:
        x = x[int((start or 0) * rate): int(end * rate) if end is not None else None]
    x = x.mean(axis=1, keepdims=True) if role not in LOOPS else (x if x.shape[1] == 2 else np.repeat(x[:, :1], 2, axis=1))
    x = resample(x, rate)
    peak_db, max_len = spec(role)
    # Zero-phase high-pass (2nd-order Butterworth magnitude). Guns and beams lose everything
    # under 120 Hz: stacked, their sub made a 25 s Minbari v Shadows capture 61% sub-120 Hz,
    # the mud the synth was rebuilt to escape. Explosions, engines and beds keep their weight.
    fc = 120 if role.startswith(('shot-', 'beam')) or role in ('arc', 'rail', 'ion-charge') else 45
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / RATE); f[0] = 1e-3
    x = np.fft.irfft(X / np.sqrt(1 + (fc / f) ** 4)[:, None], len(x), axis=0)
    if not is_loop(role):
        env = np.abs(x).max(axis=1); thr = env.max() * 10 ** (-50 / 20)
        idx = np.nonzero(env > thr)[0]
        if len(idx): x = x[max(0, idx[0] - int(.002 * RATE)): idx[-1] + 1]
        if max_len and len(x) > max_len * RATE: x = x[:int(max_len * RATE)]
        fade = min(len(x) // 4, int(.03 * RATE))
        if fade: x[-fade:] *= np.linspace(1, 0, fade)[:, None]
        fi = min(len(x) // 8, int(.002 * RATE))
        if fi: x[:fi] *= np.linspace(0, 1, fi)[:, None]
    else:  # loops: equal-power crossfade the tail into the head so the seam is silent
        cf = min(len(x) // 4, int(1.5 * RATE))
        if cf:
            t = np.linspace(0, np.pi / 2, cf)[:, None]
            head = x[:cf] * np.sin(t) + x[-cf:] * np.cos(t)
            x = np.concatenate([head, x[cf:-cf]])
    x = x - x.mean(axis=0)
    p = np.abs(x).max()
    if p > 0: x = x * (10 ** (peak_db / 20) / p)
    # Weapons play side by side, so match them by loudness, not by peak: RMS over the
    # sounding part (frames within 40 dB of the loudest) aims at -17 dBFS, peaks capped at -1.
    if not is_loop(role) and not role.startswith(('explosion', 'boom-')) and role != 'stinger':
        f = x[:len(x) // 320 * 320].reshape(-1, 320 * x.shape[1]); r = np.sqrt((f ** 2).mean(axis=1))
        act = r[r > r.max() * 10 ** (-40 / 20)]
        if len(act):
            x = x * 10 ** ((-17 - 20 * np.log10(np.sqrt((act ** 2).mean()))) / 20)
            p = np.abs(x).max()
            if p > 10 ** (-1 / 20): x = x * (10 ** (-1 / 20) / p)
    return x

def write_wav(path, x):
    y = np.clip(np.round(x * 32767), -32768, 32767).astype('<i2')
    ch = x.shape[1]; data = y.tobytes()
    hdr = b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, ch, RATE, RATE * ch * 2, ch * 2, 16) + b'data' + struct.pack('<I', len(data))
    pathlib.Path(path).write_bytes(hdr + data)

# Everything but the engine loops ships as MP3 (a tenth of the size). Engine loops stay WAV:
# they sit alone under the camera, where an MP3 loop seam would be heard. Needs ffmpeg for MP3.
def encode(wav, role):
    if role.startswith('engine-') or not shutil.which('ffmpeg'): return wav
    mp3 = wav.with_suffix('.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-c:a', 'libmp3lame', '-b:a', '192k' if role in LOOPS else '160k', str(mp3)], check=True)
    wav.unlink(); return mp3

def read_any(path):
    if path.suffix.lower() == '.wav': return read_wav(path)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', '44100', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, '<f4').astype(np.float64).reshape(-1, 2), 44100

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--src', default='audio/src'); ap.add_argument('--out', default='audio')
    a = ap.parse_args(); src, out = pathlib.Path(a.src), pathlib.Path(a.out)
    for old in list(out.glob('*.wav')) + list(out.glob('*.mp3')): old.unlink()
    roles = json.loads((src / 'roles.json').read_text())
    manifest, total = {'roles': {}}, 0
    for role, entries in roles.items():
        files = []
        for n, e in enumerate(entries if isinstance(entries, list) else [entries]):
            e = {'file': e} if isinstance(e, str) else e
            x, rate = read_any(src / e['file'])
            y = process(x, rate, role, e.get('start'), e.get('end'))
            wav = out / f'{role}-{n + 1}.wav'; write_wav(wav, y); name = encode(wav, role).name; files.append(name)
            size = (out / name).stat().st_size; total += size
            print(f'{role:12s} {name:20s} {len(y) / RATE:5.2f}s {size / 1024:7.0f} KB  <- {e["file"]}')
        manifest['roles'][role] = files
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
    print(f'{sum(len(v) for v in manifest["roles"].values())} files, {total / 1048576:.1f} MB, manifest written')

if __name__ == '__main__':
    main()
