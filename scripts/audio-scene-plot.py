#!/usr/bin/env python3
"""One picture per scene capture: spectrogram (log frequency, 40 Hz-16 kHz), level,
pan and active voices over time, with the subject's closest approach marked.

python3 scripts/audio-scene-plot.py bench/audio/scenes/after/01.wav out.png [--title "..."]
Needs the .report.json from `scripts/audio-report.py --scene` beside the WAV.
"""
import sys, json, pathlib, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import importlib.util
spec = importlib.util.spec_from_file_location('rep', pathlib.Path(__file__).parent / 'audio-report.py'); rep = importlib.util.module_from_spec(spec); spec.loader.exec_module(rep)

def main(wav, out, title=''):
    x2, rate = rep.load_stereo(wav); x = x2.mean(axis=1)
    R = json.loads(pathlib.Path(wav.replace('.wav', '.report.json')).read_text()); C = R['curves']
    W, H = 1400, 300; n, hop = 4096, max(1, int(len(x) / W))
    win = np.hanning(n); cols = []
    for i in range(0, len(x) - n, hop): cols.append(np.abs(np.fft.rfft(x[i:i + n] * win)))
    S = 20 * np.log10(np.array(cols).T + 1e-9); f = np.fft.rfftfreq(n, 1 / rate)
    edges = np.geomspace(40, 16000, H + 1)
    rows = [S[(f >= edges[i]) & (f < edges[i + 1])].max(0) if ((f >= edges[i]) & (f < edges[i + 1])).any() else S[np.argmin(abs(f - edges[i]))] for i in range(H)]
    img = np.clip((np.array(rows[::-1]) + 10) / 75, 0, 1)
    rgb = (np.stack([img ** .6, img ** 1.2, img ** 3], -1) * 255).astype(np.uint8)
    spec_im = Image.fromarray(rgb).resize((W, H))
    strip = 90; total = H + strip * 3 + 40
    im = Image.new('RGB', (W + 70, total), (16, 18, 22)); im.paste(spec_im, (60, 30)); d = ImageDraw.Draw(im)
    d.text((6, 8), title, fill=(230, 230, 230))
    for fr in [100, 250, 1000, 4000, 10000]:
        y = 30 + H - int(np.log(fr / 40) / np.log(16000 / 40) * H); d.text((4, y - 6), f'{fr if fr < 1000 else str(fr // 1000) + "k"}', fill=(170, 170, 170)); d.line([(56, y), (60, y)], fill=(170, 170, 170))
    dur = R['seconds']; X = lambda t: 60 + int(t / dur * W)
    def plot(y0, label, ts, vs, lo, hi, color, zero=None):
        d.rectangle([60, y0, 60 + W, y0 + strip - 8], outline=(60, 64, 70)); d.text((4, y0 + 2), label, fill=(200, 200, 200))
        d.text((4, y0 + 16), str(hi), fill=(130, 130, 130)); d.text((4, y0 + strip - 22), str(lo), fill=(130, 130, 130))
        Y = lambda v: y0 + strip - 8 - int((min(hi, max(lo, v)) - lo) / (hi - lo) * (strip - 8))
        if zero is not None: d.line([(60, Y(zero)), (60 + W, Y(zero))], fill=(70, 70, 80))
        pts = [(X(t), Y(v)) for t, v in zip(ts, vs) if v is not None]
        if len(pts) > 1: d.line(pts, fill=color, width=2)
    y = 30 + H + 8
    plot(y, 'level dB', C['t'], C['level_db'], -60, 0, (120, 220, 140), zero=-20); y += strip
    plot(y, 'pan L..R', C['t'], C['pan'], -1, 1, (140, 180, 255), zero=0); y += strip
    vt = [i / 30 for i in range(len(C['voices']))]
    plot(y, 'voices', vt, C['voices'], 0, 32, (255, 190, 90))
    if C.get('engines'): plot(y, '', vt, C['engines'], 0, 32, (255, 110, 110))
    fb = R.get('flyby')
    if fb:
        xt = X(fb['tca']); d.line([(xt, 30), (xt, total - 10)], fill=(255, 255, 255), width=1)
        d.text((xt + 4, 32), f"closest {fb['distance']}u  rise {fb['rise_db']} dB  fall {fb['fall_db']} dB  pitch {fb['pitch_shift_semitones']} st  pan {fb['pan_before']}>{fb['pan_after']}", fill=(255, 255, 255))
    for s in range(0, int(dur) + 1, 1 if dur <= 20 else 10): d.text((X(s) - 3, total - 14), str(s), fill=(150, 150, 150))
    d.text((W - 380, 8), f"{R['integrated_lufs']} LUFS  TP {R['true_peak_dbtp']} dBTP  clipped {R['clipped_samples']}", fill=(230, 230, 230))
    im.save(out)

if __name__ == '__main__':
    a = sys.argv[1:]; t = a[a.index('--title') + 1] if '--title' in a else ''
    main(a[0], a[1], t)
