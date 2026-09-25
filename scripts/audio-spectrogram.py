#!/usr/bin/env python3
"""Spectrogram PNG (log frequency, 40 Hz to 12 kHz) for a WAV: python3 scripts/audio-spectrogram.py in.wav out.png"""
import sys, wave, numpy as np
from PIL import Image
w = wave.open(sys.argv[1]); rate = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64).reshape(-1, w.getnchannels()).mean(1) / 32768
n, hop = 4096, 441
win = np.hanning(n)
cols = [np.abs(np.fft.rfft(x[i:i + n] * win)) for i in range(0, len(x) - n, hop)]
S = 20 * np.log10(np.array(cols).T + 1e-9)
f = np.fft.rfftfreq(n, 1 / rate)
H = 360
edges = np.geomspace(40, 12000, H + 1)
rows = [S[(f >= edges[i]) & (f < edges[i + 1])].max(0) if ((f >= edges[i]) & (f < edges[i + 1])).any() else S[np.argmin(abs(f - edges[i]))] for i in range(H)]
img = np.clip((np.array(rows[::-1]) + 20) / 70, 0, 1)
rgb = (np.stack([img ** .6, img ** 1.2, img ** 3], -1) * 255).astype(np.uint8)
Image.fromarray(rgb).resize((min(2400, rgb.shape[1]), H * 2)).save(sys.argv[2])
