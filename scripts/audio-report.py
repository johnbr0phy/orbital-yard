#!/usr/bin/env python3
"""Objective listening report for a WAV from scripts/capture-audio.cjs.

python3 scripts/audio-report.py audio.wav

Reports loudness (RMS dBFS), peaks and clipping, how much energy sits in the
harsh 2-8 kHz band, spectral centroid, onsets per second (how "busy" it is)
and how steady the level is. Numbers only; they don't replace ears.
"""
import sys, wave, numpy as np

def load(p):
    w = wave.open(p)
    n, ch, rate = w.getnframes(), w.getnchannels(), w.getframerate()
    x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
    return x.reshape(-1, ch).mean(axis=1), rate

def db(v): return 20 * np.log10(max(v, 1e-9))

def report(p):
    x, rate = load(p)
    frame = int(rate * 0.05)
    frames = x[: len(x) // frame * frame].reshape(-1, frame)
    rms = np.sqrt((frames ** 2).mean(axis=1))
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    f = np.fft.rfftfreq(len(x), 1 / rate)
    tot = spec.sum()
    band = lambda a, b: spec[(f >= a) & (f < b)].sum() / tot
    # Onsets: 10 ms energy frames rising >6 dB above the previous 50 ms.
    hop = int(rate * 0.01)
    e = np.array([np.sqrt((x[i:i + hop] ** 2).mean()) for i in range(0, len(x) - hop, hop)])
    prev = np.array([e[max(0, i - 5):i].mean() if i else e[0] for i in range(len(e))])
    onsets = int(((e > prev * 2) & (e > 10 ** (-40 / 20))).sum())
    loud = rms[rms > 10 ** (-60 / 20)]
    out = {
        'seconds': round(len(x) / rate, 1),
        'rms_dbfs': round(db(np.sqrt((x ** 2).mean())), 1),
        'peak_dbfs': round(db(np.abs(x).max()), 1),
        'clipped_samples': int((np.abs(x) > 0.999).sum()),
        'level_p10_p90_db': [round(db(np.percentile(loud, 10)), 1), round(db(np.percentile(loud, 90)), 1)] if len(loud) else None,
        'energy_sub_lt120': round(band(0, 120), 3),
        'energy_low_120_500': round(band(120, 500), 3),
        'energy_mid_500_2k': round(band(500, 2000), 3),
        'energy_harsh_2k_8k': round(band(2000, 8000), 3),
        'energy_air_gt8k': round(band(8000, rate / 2), 3),
        'centroid_hz': int((f * spec).sum() / tot),
        'onsets_per_s': round(onsets / (len(x) / rate), 1),
    }
    return out

if __name__ == '__main__':
    import json
    for p in sys.argv[1:]:
        print(p, json.dumps(report(p)))
