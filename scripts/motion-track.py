#!/usr/bin/env python3
"""Track close-up for debugging: python3 scripts/motion-track.py <label> <scene> <id,id,...> [t0] [t1] [out.png]
Draws the chosen ships from above with time ticks every second, their headings and speeds."""
import gzip, json, os, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
label, scene, ids = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(',')]
t0 = float(sys.argv[4]) if len(sys.argv) > 4 else -1e9
t1 = float(sys.argv[5]) if len(sys.argv) > 5 else 1e9
out = sys.argv[6] if len(sys.argv) > 6 else os.path.join(ROOT, 'bench/motion', label, f'track-{scene}.png')
with gzip.open(os.path.join(ROOT, 'bench/motion', label, 'logs', scene + '.json.gz')) as fh:
    log = json.load(fh)
dt = log['dt']; modes = log['modes']
fig, (a, b, c) = plt.subplots(1, 3, figsize=(16, 5.5), gridspec_kw={'width_ratios': [1.4, 1, 1]})
for j, sid in enumerate(ids):
    s = next(x for x in log['ships'] if x['id'] == sid)
    t = (np.arange(len(s['x'])) + s['first']) * dt + log['t0']
    m = (t >= t0) & (t <= t1)
    x = np.array([np.nan if v is None else v for v in s['x']], float); z = np.array([np.nan if v is None else v for v in s['z']], float)
    yaw = np.array([np.nan if v is None else v for v in s['yaw']], float); v = np.array([np.nan if v is None else v for v in s['v']], float)
    col = SERIES[j % 8]
    a.plot(x[m], z[m], color=col, lw=1.2, label=f"{sid} {s['cls']} {round(s['slen'])}m")
    idx = np.where(m)[0]
    for k in idx[::int(round(1 / dt))]:
        a.plot(x[k], z[k], '.', color=col, ms=4)
        a.text(x[k], z[k], f"{t[k]:.0f}", fontsize=6, color=col)
    if len(idx): a.plot(x[idx[-1]], z[idx[-1]], '>', color=col)
    b.plot(t[m], np.degrees(np.unwrap(np.nan_to_num(yaw[m]))), color=col)
    c.plot(t[m], v[m], color=col)
    ms = [modes[int(q)] if q is not None else '' for q in s['m']]
    ch = [(t[k], ms[k]) for k in idx if k == idx[0] or ms[k] != ms[k - 1]]
    print(sid, ' '.join(f'{tt:.1f}:{mm}' for tt, mm in ch))
a.set_aspect('equal', adjustable='datalim'); a.legend(fontsize=7); a.set_title('x, z (labels: war time s)')
b.set_title('heading (deg, unwrapped)'); c.set_title('speed (m/s)')
fig.tight_layout(); fig.savefig(out, dpi=85); print(out)
