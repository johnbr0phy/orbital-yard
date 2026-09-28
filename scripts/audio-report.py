#!/usr/bin/env python3
"""Objective listening report for a WAV from scripts/capture-audio.cjs.

python3 scripts/audio-report.py audio.wav [more.wav ...]
python3 scripts/audio-report.py --scene bench/audio/scenes/after/01.wav   (uses the .json log beside it)

Reports loudness (RMS dBFS), peaks and clipping, energy by band, spectral
centroid, onsets per second and how steady the level is. Then the mastering
numbers:

  integrated_lufs   ITU-R BS.1770-4: K-weighting (the standard shelf and
                    high-pass, designed for the file's rate by the bilinear
                    transform), 400 ms blocks with 75% overlap, the -70 LUFS
                    absolute gate and the -10 LU relative gate.
  true_peak_dbtp    4x oversampled peak (polyphase FIR), per BS.1770 Annex 2.
  clipped_samples   samples at or beyond full scale (a float WAV keeps overs).

With --scene (a scene capture and its log) it also measures, over time:
  level_db          short-term level, 100 ms RMS every 50 ms (dBFS, both channels)
  pan               inter-channel level difference every 50 ms, as a pan
                    position (R^2-L^2)/(R^2+L^2), -1 left .. +1 right
  voices            active voices per tick, from the engine's own stats
and, when the scene has a subject that passes the camera (min distance in the
log), the fly-by: the rise and fall of level into and out of the closest
approach (dB), the pan at 1.5 s before and after, and the pitch shift across
the closest approach: the log-frequency spectra of 0.5 s before and after
(1/24 octave, 150 Hz to 8 kHz) are cross-correlated and the best shift is
reported in semitones (negative = a drop).

Numbers only; they don't replace ears.
"""
import sys, json, wave, struct, pathlib
import numpy as np

def load_stereo(p):
    b = pathlib.Path(p).read_bytes()
    i, fmt, data = 12, None, None
    while i + 8 <= len(b):
        cid, n = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]
        if cid == b'fmt ': fmt = b[i + 8:i + 8 + n]
        elif cid == b'data': data = b[i + 8:i + 8 + n]
        i += 8 + n + (n & 1)
    tag, ch, rate = struct.unpack('<HHI', fmt[:8]); bits = struct.unpack('<H', fmt[14:16])[0]
    if tag == 3: x = np.frombuffer(data, '<f4').astype(np.float64)
    elif bits == 16: x = np.frombuffer(data, '<i2') / 32768.0
    else: raise ValueError('unsupported wav')
    x = x[:len(x) // ch * ch].reshape(-1, ch)
    if ch == 1: x = np.repeat(x, 2, axis=1)
    return x[:, :2], rate

def load(p):
    x, rate = load_stereo(p); return x.mean(axis=1), rate

def db(v): return 20 * np.log10(max(v, 1e-9))

# ---- BS.1770 K-weighting ----
def biquad(x, b, a):
    from scipy.signal import lfilter
    return lfilter(b, a, x, axis=0)

def k_weight(x, rate):
    # Stage 1: high shelf (+4 dB above ~1.5 kHz); stage 2: RLB high-pass (~38 Hz). Coefficients from
    # the analogue prototypes (as in libebur128), so any sample rate is exact.
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = np.tan(np.pi * f0 / rate); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = np.tan(np.pi * f0 / rate); a0 = 1 + K / Q + K * K
    b2 = [1, -2, 1]; a2 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    return biquad(biquad(x, b1, a1), b2, a2)

def integrated_lufs(x2, rate):
    y = k_weight(x2, rate); blk, hop = int(.4 * rate), int(.1 * rate)
    if len(y) < blk: return None
    z = np.array([(y[i:i + blk] ** 2).mean(axis=0).sum() for i in range(0, len(y) - blk + 1, hop)])
    L = lambda m: -0.691 + 10 * np.log10(max(m, 1e-12))
    g = z[np.array([L(v) for v in z]) > -70]
    if not len(g): return None
    rel = L(g.mean()) - 10; g2 = g[np.array([L(v) for v in g]) > rel]
    return round(L(g2.mean()), 1) if len(g2) else None

def true_peak(x2):
    from scipy.signal import resample_poly
    return round(db(max(np.abs(resample_poly(x2[:, c], 4, 1)).max() for c in range(x2.shape[1]))), 2)

def report(p, x2=None, rate=None):
    if x2 is None: x2, rate = load_stereo(p)
    x = x2.mean(axis=1)
    frame = int(rate * 0.05)
    frames = x[: len(x) // frame * frame].reshape(-1, frame)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    f = np.fft.rfftfreq(len(x), 1 / rate)
    tot = spec.sum() or 1
    band = lambda a, b: spec[(f >= a) & (f < b)].sum() / tot
    hop = int(rate * 0.01)
    e = np.array([np.sqrt((x[i:i + hop] ** 2).mean()) for i in range(0, len(x) - hop, hop)])
    prev = np.array([e[max(0, i - 5):i].mean() if i else e[0] for i in range(len(e))])
    onsets = int(((e > prev * 2) & (e > 10 ** (-40 / 20))).sum())
    loud = rms[rms > 10 ** (-60 / 20)]
    return {
        'seconds': round(len(x) / rate, 1),
        'rms_dbfs': round(db(np.sqrt((x ** 2).mean())), 1),
        'peak_dbfs': round(db(np.abs(x2).max()), 1),
        'true_peak_dbtp': true_peak(x2),
        'integrated_lufs': integrated_lufs(x2, rate),
        'clipped_samples': int((np.abs(x2) >= 1.0).sum()),
        'level_p10_p90_db': [round(db(np.percentile(loud, 10)), 1), round(db(np.percentile(loud, 90)), 1)] if len(loud) else None,
        'energy_sub_lt120': round(band(0, 120), 3),
        'energy_low_120_500': round(band(120, 500), 3),
        'energy_mid_500_2k': round(band(500, 2000), 3),
        'energy_harsh_2k_8k': round(band(2000, 8000), 3),
        'energy_air_gt8k': round(band(8000, rate / 2), 3),
        'centroid_hz': int((f * spec).sum() / tot),
        'onsets_per_s': round(onsets / (len(x) / rate), 1),
    }

# ---- over time ----
def curves(x2, rate, step=.05, win=.1):
    h, w = int(step * rate), int(win * rate); t, lev, pan = [], [], []
    for i in range(0, len(x2) - w, h):
        seg = x2[i:i + w]; l2, r2 = (seg ** 2).mean(axis=0)
        t.append((i + w / 2) / rate); lev.append(10 * np.log10(max((l2 + r2) / 2, 1e-12)))
        pan.append((r2 - l2) / (r2 + l2) if l2 + r2 > 1e-10 else 0.0)
    return np.array(t), np.array(lev), np.array(pan)

def logspec(x, rate, t0, t1, lo=150, hi=8000, per_oct=24):
    a, b = max(0, int(t0 * rate)), min(len(x), int(t1 * rate))
    seg = x[a:b]
    if len(seg) < 2048: return None
    n = 4096; hop = 1024; win = np.hanning(n); S = 0
    for i in range(0, max(1, len(seg) - n), hop):
        c = seg[i:i + n]
        if len(c) < n: c = np.pad(c, (0, n - len(c)))
        S = S + np.abs(np.fft.rfft(c * win)) ** 2
    f = np.fft.rfftfreq(n, 1 / rate)
    edges = lo * 2 ** (np.arange(int(np.log2(hi / lo) * per_oct) + 2) / per_oct)
    v = np.array([S[(f >= edges[k]) & (f < edges[k + 1])].sum() for k in range(len(edges) - 1)])
    v = 10 * np.log10(v + 1e-12); return v - v.mean()

def pitch_shift(x, rate, tca, span=.5, gap=.08, per_oct=24):
    A = logspec(x, rate, tca - gap - span, tca - gap, per_oct=per_oct); B = logspec(x, rate, tca + gap, tca + gap + span, per_oct=per_oct)
    if A is None or B is None: return None
    best, arg = -1e9, 0
    for s in range(-per_oct, per_oct + 1):  # +-1 octave
        if s >= 0: c = np.dot(A[s:], B[:len(B) - s]) / (len(B) - s)
        else: c = np.dot(A[:s], B[-s:]) / (len(B) + s)
        if c > best: best, arg = c, s
    # B shifted by +arg matches A: B is |arg| steps lower when arg > 0
    return round(-arg * 12 / per_oct, 2)

def scene(p):
    x2, rate = load_stereo(p); x = x2.mean(axis=1)
    out = report(p, x2, rate)
    logp = pathlib.Path(str(p).replace('.wav', '.json'))
    meta = json.loads(logp.read_text()) if logp.exists() else {}
    log = meta.get('log', [])
    t, lev, pan = curves(x2, rate)
    out['curves'] = {'t': [round(v, 2) for v in t], 'level_db': [round(v, 1) for v in lev], 'pan': [round(v, 3) for v in pan],
                     'voices': [r.get('voices', 0) for r in log], 'engines': [r.get('engines') for r in log] if log and 'engines' in log[0] else None}
    out['voices_max'] = max(out['curves']['voices']) if log else None
    out['voices_mean'] = round(float(np.mean(out['curves']['voices'])), 1) if log else None
    out['render_share'] = meta.get('renderShare'); out['js_ms_per_frame'] = meta.get('jsMsPerFrame')
    subj = [r for r in log if r.get('subj')]
    if subj:
        k = min(range(len(subj)), key=lambda i: subj[i]['subj']['d'])
        tca, dmin = subj[k]['t'], subj[k]['subj']['d']
        if 1.0 < tca < out['seconds'] - 1.0 and subj[0]['subj']['d'] > 3 * dmin and subj[-1]['subj']['d'] > 3 * dmin:
            sm = np.convolve(lev, np.ones(5) / 5, mode='same')  # 250 ms smoothing for the envelope
            near = (t > tca - .6) & (t < tca + .6); pre = (t > tca - 3.2) & (t < tca - 1.8); post = (t > tca + 1.8) & (t < tca + 3.2)
            peak = sm[near].max()
            p_at = lambda tt: float(np.mean(pan[(t > tt - .25) & (t < tt + .25)]))
            steps = np.abs(np.diff(sm[(t > tca - 3) & (t < tca + 3)]))
            out['flyby'] = {'tca': tca, 'distance': dmin,
                            'rise_db': round(float(peak - sm[pre].mean()), 1) if pre.any() else None,
                            'fall_db': round(float(peak - sm[post].mean()), 1) if post.any() else None,
                            'max_step_db_per_50ms': round(float(steps.max()), 1) if len(steps) else None,
                            'pan_before': round(p_at(tca - 1.5), 2), 'pan_at': round(p_at(tca), 2), 'pan_after': round(p_at(tca + 1.5), 2),
                            'pitch_shift_semitones': pitch_shift(x, rate, tca)}
    return out

if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--scene':
        for p in args[1:]:
            r = scene(p); c = r.pop('curves')
            pathlib.Path(str(p).replace('.wav', '.report.json')).write_text(json.dumps({**r, 'curves': c}))
            print(p, json.dumps(r))
    else:
        for p in args: print(p, json.dumps(report(p)))
