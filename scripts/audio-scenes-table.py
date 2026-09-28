#!/usr/bin/env python3
"""Markdown tables of the scene measurements for AUDIO.md.

python3 scripts/audio-scenes-table.py before            one build
python3 scripts/audio-scenes-table.py before after      side by side, with pass/fail on the after build

Reads bench/audio/scenes/<build>/NN.report.json (scripts/audio-report.py --scene).
"""
import json, sys, pathlib
S = json.loads(pathlib.Path('bench/audio/scenes.json').read_text())
def rep(build, i):
    p = pathlib.Path(f'bench/audio/scenes/{build}/{i:02d}.report.json')
    return json.loads(p.read_text()) if p.exists() else None

def main(builds):
    print('| # | Scene | Build | LUFS (I) | True peak dBTP | Clipped | Level p10/p90 dB | <120 Hz | 120-500 | 500-2k | 2-8k | Voices mean/max |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|')
    for s in S:
        for b in builds:
            r = rep(b, s['id'])
            if not r: continue
            p = r['level_p10_p90_db'] or ['', '']
            print(f"| {s['id']} | {s['name']} | {b} | {r['integrated_lufs']} | {r['true_peak_dbtp']} | {r['clipped_samples']} | {p[0]} / {p[1]} | {r['energy_sub_lt120']:.0%} | {r['energy_low_120_500']:.0%} | {r['energy_mid_500_2k']:.0%} | {r['energy_harsh_2k_8k']:.0%} | {r['voices_mean']} / {r['voices_max']} |")
    print()
    print('Fly-bys (subject closest approach from the log; rise/fall = level at closest approach minus the 1.4 s window 1.8-3.2 s before/after; pan when the subject is 60 degrees either side of perpendicular; pitch = cross-correlated log spectra (400 Hz-8 kHz), 0.4 s either side starting half that time away):')
    print()
    print('| # | Build | Closest (u) at s | Rise dB | Fall dB | Max step dB/50 ms | Pan before > at > after | Pitch shift (semitones) | Pass |')
    print('|---|---|---|---|---|---|---|---|---|')
    for s in S:
        for b in builds:
            r = rep(b, s['id'])
            if not r or 'flyby' not in r: continue
            f = r['flyby']
            ok = [f['rise_db'] is not None and f['rise_db'] >= 12, f['fall_db'] is not None and f['fall_db'] >= 12,
                  f['pitch_shift_semitones'] is not None and f['pitch_shift_semitones'] < 0,
                  abs(f['pan_after'] - f['pan_before']) >= .5, f['max_step_db_per_50ms'] is not None and f['max_step_db_per_50ms'] <= 6]
            verdict = 'PASS' if all(ok) else 'FAIL (' + ', '.join(n for n, k in zip(['rise', 'fall', 'pitch', 'pan', 'smooth'], ok) if not k) + ')'
            print(f"| {s['id']} | {b} | {f['distance']} at {f['tca']} | {f['rise_db']} | {f['fall_db']} | {f['max_step_db_per_50ms']} | {f['pan_before']} > {f['pan_at']} > {f['pan_after']} | {f['pitch_shift_semitones']} | {verdict} |")

if __name__ == '__main__':
    main(sys.argv[1:] or ['before'])
