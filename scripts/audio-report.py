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
approach (dB), the pan when the subject is 60 degrees either side of the perpendicular (t60 =
distance x tan 60 / speed, from the log), and the pitch shift across the closest
approach: the log-frequency spectra of 0.4 s before and after, starting t60/2 away
(1/24 octave, 400 Hz to 8 kHz, above the score's sustained low lines) are cross-correlated and the best shift is
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

def itd_at(x2, rate, t0, span=.1):
    """Inter-channel time difference (ms) around t0: the lag (within +-1 ms) that best aligns L and R.
    Positive when the right channel leads (source on the right). HRTF places low sounds mostly by time,
    not level, so a level-only pan meter under-reads it."""
    a, b = int((t0 - span / 2) * rate), int((t0 + span / 2) * rate)
    if a < 0 or b > len(x2): return None
    L, R = x2[a:b, 0] - x2[a:b, 0].mean(), x2[a:b, 1] - x2[a:b, 1].mean(); m = int(.001 * rate)
    if np.sqrt((L ** 2).mean()) < 1e-5: return None
    c = [np.dot(L[m + k:len(L) - m + k], R[m:len(R) - m]) for k in range(-m, m + 1)]  # k > 0: L lags R
    return round(float((np.argmax(c) - m) / rate * 1000), 3)

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

def pitch_shift(x, rate, tca, span=.4, gap=.08, per_oct=24):
    # 400 Hz-8 kHz: where engines live and the score's sustained low lines don't pin the correlation at zero
    A = logspec(x, rate, tca - gap - span, tca - gap, lo=400, per_oct=per_oct); B = logspec(x, rate, tca + gap, tca + gap + span, lo=400, per_oct=per_oct)
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
                     # all real voices: the one-shot pool plus (Version 5) the engine, weapon and impact emitters
                     'voices': [r.get('voices', 0) + (r.get('engines') or 0) + (r.get('weapons') or 0) + (r.get('impacts') or 0) for r in log],
                     'engines': [r.get('engines') for r in log] if log and 'engines' in log[0] else None}
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
            p_at = lambda tt: float(np.mean(pan[(t > tt - .1) & (t < tt + .1)]))
            # the pass's own time scale: when the subject is 60 degrees off the perpendicular, from its
            # logged speed near closest approach (a 207 u/s pass at 31 u sweeps in +-0.26 s; 140 u/s at 46 u in +-0.57 s)
            ks = [i for i in range(len(subj)) if abs(subj[i]['t'] - tca) < .35 and subj[i].get('subj', {}).get('p')]
            P = np.array([subj[i]['subj']['p'] for i in ks]); T = np.array([subj[i]['t'] for i in ks])
            speed = float(np.linalg.norm(P[-1] - P[0]) / max(1e-6, T[-1] - T[0])) if len(ks) > 1 else 0
            t60 = float(np.clip(dmin * 1.732 / speed, .15, 1.5)) if speed > 1 else .5
            steps = np.abs(np.diff(sm[(t > tca - 3) & (t < tca + 3) & (t > t[0] + .15) & (t < t[-1] - .15)]))  # 'same' smoothing sags at the array ends
            out['flyby'] = {'tca': tca, 'distance': dmin,
                            'rise_db': round(float(peak - sm[pre].mean()), 1) if pre.any() else None,
                            'fall_db': round(float(peak - sm[post].mean()), 1) if post.any() else None,
                            'max_step_db_per_50ms': round(float(steps.max()), 1) if len(steps) else None,
                            'speed': round(speed), 't60': round(t60, 2),
                            'pan_before': round(p_at(tca - t60), 2), 'pan_at': round(p_at(tca), 2), 'pan_after': round(p_at(tca + t60), 2),
                            'itd_before_ms': itd_at(x2, rate, tca - t60), 'itd_after_ms': itd_at(x2, rate, tca + t60),
                            'pitch_shift_semitones': pitch_shift(x, rate, tca, gap=max(.08, .5 * t60))}
    # Eyes closed, where is the fight? The gain-weighted left/right of every sounding gun and hit (from the
    # engine) against the pan measured in the audio, per tick where guns are sounding.
    fx = [(r['t'], r['fight'][0]) for r in log if r.get('fight') and r['fight'][0] is not None and r['fight'][1] > .02]
    if len(fx) > 30:
        ft = np.array([a for a, _ in fx]); fv = np.array([b for _, b in fx]); pv = np.interp(ft + .05, t, pan)
        if fv.std() > 1e-6 and pv.std() > 1e-6: out['fight_vs_pan'] = {'ticks': len(fx), 'correlation': round(float(np.corrcoef(fv, pv)[0, 1]), 2)}
    # And when something big died: each capital, hero or First One death in the scene, the loudest 400 ms in the
    # 2.5 s after it against the scene's median level, and the quietest 400 ms after that against the 2 s before it.
    kills = [(r['t'], k) for r in log for k in r.get('kills', [])]
    if kills:
        lv = np.convolve(lev, np.ones(8) / 8, mode='same'); med = float(np.median(lev)); rows = []
        for tk, k in kills:
            post = (t >= tk) & (t < tk + 2.5); pre = (t >= tk - 2) & (t < tk)
            if not post.any(): continue
            tp = float(t[post][np.argmax(lv[post])]); after = (t > tp + .3) & (t < tp + 4)
            rows.append({'t': round(tk, 2), 'type': k[0], 'name': k[1], 'distance': k[2], 'peak_over_median_db': round(float(lv[post].max() - med), 1),
                         'dip_below_before_db': round(float(lv[pre].mean() - lv[after].min()), 1) if pre.any() and after.any() else None})
        out['big_deaths'] = rows
    # A squadron: how many members' engines were voiced around closest approach, where, and with what Doppler.
    mem = [r for r in log if r.get('members')]
    if mem and 'flyby' in out:
        tca = out['flyby']['tca']; near = [r for r in mem if abs(r['t'] - tca) <= .5]
        voiced = {m[0] for r in near for m in r['members'] if len(m) > 2 and m[1]}
        dops = [m[2] for r in near for m in r['members'] if len(m) > 2 and m[1]]
        dirs = [m[3] for r in near for m in r['members'] if len(m) > 3 and m[1] and m[3]]
        out['squadron'] = {'members': len(mem[0]['members']), 'engines_voiced_near_pass': len(voiced),
                           'doppler_range': [min(dops), max(dops)] if dops else None,
                           'direction_spread': {'left_right': [min(d[0] for d in dirs), max(d[0] for d in dirs)], 'front_back': [min(d[2] for d in dirs), max(d[2] for d in dirs)], 'up': [min(d[1] for d in dirs), max(d[1] for d in dirs)]} if dirs else None}
    # The Doppler the engine applied to the subject's own engine voice across its pass (from the log).
    em = [r for r in log if r.get('subj', {}).get('em')]
    if em and 'flyby' in out:
        tca = out['flyby']['tca']; b4 = [r['subj']['em']['dop'] for r in em if tca - .6 <= r['t'] <= tca - .2]; af = [r['subj']['em']['dop'] for r in em if tca + .2 <= r['t'] <= tca + .6]
        if b4 and af: out['flyby']['applied_doppler'] = [round(float(np.mean(b4)), 3), round(float(np.mean(af)), 3), round(float(12 * np.log2(np.mean(af) / np.mean(b4))), 2)]
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
