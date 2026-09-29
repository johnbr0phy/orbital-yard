#!/usr/bin/env python3
"""Motion plots for the Tribute War (reads bench/motion/<label>/).

  python3 scripts/motion-plot.py <label> [--out DIR] [--only 01,03]

For every scene log (logs/<id>.json.gz) it draws one figure:
  - tracks from above (x, z) and from the side (x, y): the scene's focus
    ships in colour (one colour per squadron, fixed order), everyone else
    faint grey, reversals marked with a ring, shuttle windows over 5% with
    a square;
  - heading over time (unwrapped, degrees) for the focus ships;
  - speed over time for the focus ships.
And for the label as a whole:
  - reversals.png: reversals per ship-minute by fleet and hull class (heat map);
  - signature.png: per-fleet small multiples of two motion features for
    fighters and frigates (each fleet highlighted against all others);
  - cohesion.png: squad-time in the cohesion band / parade / dissolved per fleet.
Plots are PNGs for MOTION.md and the watch page. Needs numpy + matplotlib.
"""
import gzip, json, math, os, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLEETS = ['Yard', 'Shoal', 'Lattice', 'Drift', 'Choir', 'Empire', 'Rebels', 'Minbari', 'Shadows', 'EarthForce', 'Federation', 'Klingons',
          'Borg', 'Mondoshawan', 'USCM', 'Engineers', 'Yautja', 'First Ones', 'Romulans', 'Dominion', 'Space Marines', 'Tyranids', 'Tesla']
SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
INK, INK2, MUTED, SURFACE, GRID = '#0b0b0b', '#52514e', '#9a9994', '#fcfcfb', '#e6e5e0'
FLYING, CONTACT = 1, 2

plt.rcParams.update({'font.size': 9, 'axes.edgecolor': MUTED, 'axes.labelcolor': INK2, 'xtick.color': INK2, 'ytick.color': INK2,
                     'axes.facecolor': SURFACE, 'figure.facecolor': SURFACE, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': .6,
                     'axes.titlesize': 10, 'axes.titleweight': 'bold', 'axes.titlecolor': INK, 'legend.frameon': False})


def load(label):
    base = os.path.join(ROOT, 'bench/motion', label)
    runs = {}
    for f in sorted(os.listdir(os.path.join(base, 'runs'))):
        with open(os.path.join(base, 'runs', f)) as fh:
            r = json.load(fh)
        runs[r['spec']['id']] = r
    return base, runs


def arr(col):
    return np.array([np.nan if v is None else v for v in col], dtype=float)


def scene_figure(base, run, out):
    path = os.path.join(base, 'logs', run['spec']['id'] + '.json.gz')
    if not os.path.exists(path):
        return None
    with gzip.open(path) as fh:
        log = json.load(fh)
    dt, focus = log['dt'], set(log['focus'] or [])
    ships = log['ships']
    fships = [s for s in ships if s['id'] in focus]
    squads = []
    for s in fships:
        if s['squad0'] not in squads:
            squads.append(s['squad0'])
    color = {}
    for s in fships:
        i = squads.index(s['squad0'])
        color[s['id']] = SERIES[i % len(SERIES)] if len(squads) > 1 else SERIES[fships.index(s) % len(SERIES)]
    fig = plt.figure(figsize=(13, 8.6))
    gs = fig.add_gridspec(3, 2, width_ratios=[1.35, 1], height_ratios=[1, 1, 1])
    top, side, head, speed = fig.add_subplot(gs[0:2, 0]), fig.add_subplot(gs[2, 0]), fig.add_subplot(gs[0:2, 1]), fig.add_subplot(gs[2, 1])
    many = len(ships) > 400
    for s in ships:
        x, y, z, f = arr(s['x']), arr(s['y']), arr(s['z']), arr(s['f'])
        fl = (np.nan_to_num(f).astype(int) & FLYING) > 0
        x = np.where(fl, x, np.nan); y = np.where(fl, y, np.nan); z = np.where(fl, z, np.nan)
        if s['id'] in focus and not many:
            continue
        top.plot(x, z, color=MUTED, lw=.4, alpha=.25 if not many else .12)
        side.plot(x, y, color=MUTED, lw=.4, alpha=.25 if not many else .12)
    rev = {}
    shut = {}
    for sh in run['ships']:
        rev[sh['id']] = sh['reversals'] + (sh['reversalsStrict'] or [])
        if sh['shuttle'].get('share', 0) > .05:
            shut[sh['id']] = sh['shuttle']
    if not many:
        for s in fships:
            x, y, z, f = arr(s['x']), arr(s['y']), arr(s['z']), arr(s['f'])
            fl = (np.nan_to_num(f).astype(int) & FLYING) > 0
            x = np.where(fl, x, np.nan); y = np.where(fl, y, np.nan); z = np.where(fl, z, np.nan)
            c = color[s['id']]
            top.plot(x, z, color=c, lw=1.1)
            side.plot(x, y, color=c, lw=1.1)
            t = (np.arange(len(x)) + s['first']) * dt
            yaw = np.degrees(np.unwrap(np.nan_to_num(arr(s['yaw']))))
            yaw = np.where(fl, yaw - (yaw[fl][0] if fl.any() else 0), np.nan)
            head.plot(t, yaw, color=c, lw=1)
            speed.plot(t, np.where(fl, arr(s['v']), np.nan), color=c, lw=1)
            last = np.where(fl)[0]
            if len(last):
                top.plot(x[last[-1]], z[last[-1]], marker='>', color=c, ms=4)
    for s in (fships if not many else []):
        for r in rev.get(s['id'], []):
            top.plot(r['x'], r['z'], marker='o', mfc='none', mec=INK, ms=9, mew=1.2)
            head.axvline(r['t'], color=INK, lw=.6, ls=':')
        if s['id'] in shut:
            p = shut[s['id']]
            top.plot(p['x'], p['z'], marker='s', mfc='none', mec=INK, ms=11, mew=1.2)
    if many:
        # a war-wide view: every reversal and shuttle window over 5%
        for sid, rs in rev.items():
            for r in rs:
                top.plot(r['x'], r['z'], marker='o', mfc='none', mec=INK, ms=5, mew=.8)
        for sid, p in shut.items():
            top.plot(p['x'], p['z'], marker='s', mfc='none', mec=INK, ms=6, mew=.8)
        head.set_visible(False); speed.set_visible(False)
    if fships and not many:
        xs = np.concatenate([arr(s['x']) for s in fships]); zs = np.concatenate([arr(s['z']) for s in fships]); ys = np.concatenate([arr(s['y']) for s in fships])
        if np.isfinite(xs).any():
            x0, x1, z0, z1 = np.nanmin(xs), np.nanmax(xs), np.nanmin(zs), np.nanmax(zs)
            m = max(200, .15 * max(x1 - x0, z1 - z0))
            top.set_xlim(x0 - m, x1 + m); top.set_ylim(z0 - m, z1 + m); side.set_xlim(x0 - m, x1 + m)
            y0, y1 = np.nanmin(ys), np.nanmax(ys); side.set_ylim(y0 - max(100, .2 * (y1 - y0)), y1 + max(100, .2 * (y1 - y0)))
    top.set_aspect('equal', adjustable='datalim')
    top.set_title('From above (x, z). Rings: reversals. Squares: shuttle over 5%', loc='left')
    top.set_xlabel('x (m)'); top.set_ylabel('z (m)')
    side.set_title('From the side (x, y)', loc='left'); side.set_xlabel('x (m)'); side.set_ylabel('y (m)')
    head.set_title('Heading (unwrapped, degrees from start)', loc='left'); head.set_xlabel('war time (s)')
    speed.set_title('Speed over time (m/s)', loc='left'); speed.set_xlabel('war time (s)')
    fig.suptitle(f"{run['spec']['id']} {run['spec']['name']}  ({os.path.basename(base)})", x=.01, ha='left', fontsize=12, fontweight='bold', color=INK)
    fig.tight_layout(rect=(0, 0, 1, .97))
    fig.savefig(out, dpi=90)
    plt.close(fig)
    return out


def summary_figures(base, runs, outdir):
    with open(os.path.join(base, 'summary.json')) as fh:
        summ = json.load(fh)
    final = summ['final']
    classes = ['fighter', 'light', 'mid', 'hero', 'frigate', 'capital', 'leviathan']
    M = np.full((len(FLEETS), len(classes)), np.nan)
    for r in range(len(FLEETS)):
        for j, c in enumerate(classes):
            g = final.get(f'fleet:{r}:{c}')
            if g and g['minutes'] > 0:
                M[r, j] = g['perMin'] + (g['strictPerMin'] if c in ('frigate', 'capital', 'leviathan') else 0)
    fig, ax = plt.subplots(figsize=(7.5, 8.5))
    im = ax.imshow(M, cmap='Blues', vmin=0, vmax=max(.4, np.nanmax(M) if np.isfinite(M).any() else .4), aspect='auto')
    ax.set_xticks(range(len(classes)), classes); ax.set_yticks(range(len(FLEETS)), FLEETS); ax.grid(False)
    for r in range(len(FLEETS)):
        for j in range(len(classes)):
            if np.isfinite(M[r, j]):
                ax.text(j, r, f'{M[r, j]:.2f}', ha='center', va='center', fontsize=7, color=INK if M[r, j] < .25 else 'white')
    ax.set_title('Reversals per ship-minute by fleet and hull class (all runs)', loc='left')
    fig.colorbar(im, ax=ax, shrink=.6)
    fig.tight_layout(); fig.savefig(os.path.join(outdir, 'reversals.png'), dpi=90); plt.close(fig)

    # signature small multiples: fighters and frigates, two features
    feats = ['speed', 'speedCv', 'speedHz', 'yawAbs', 'yawP90', 'yawHz', 'yawAccel', 'rollAbs', 'rollPerYaw', 'climb', 'radius', 'squadDist', 'squadHead', 'straight', 'throttleStep']
    for cls in ('fighter', 'frigate'):
        rows = [(f['race'], f['f']) for r in runs.values() for f in r['features'] if f['cls'] == cls]
        if not rows:
            continue
        races = sorted(set(r for r, _ in rows))
        X = np.array([f[feats.index('yawHz')] for _, f in rows]); Y = np.array([f[feats.index('squadDist')] for _, f in rows])
        Z = np.array([f[feats.index('yawAbs')] for _, f in rows]); W = np.array([f[feats.index('speedCv')] for _, f in rows])
        R = np.array([r for r, _ in rows])
        n = len(races); cols = 6; rws = math.ceil(n / cols)
        fig, axs = plt.subplots(rws, cols, figsize=(cols * 2.3, rws * 2.2), squeeze=False)
        for i, race in enumerate(races):
            ax = axs[i // cols][i % cols]
            ax.scatter(Z, W, s=3, color=MUTED, alpha=.25, lw=0)
            m = R == race
            ax.scatter(Z[m], W[m], s=6, color=SERIES[0], lw=0)
            ax.set_title(FLEETS[race], loc='left', fontsize=8)
            ax.tick_params(labelsize=6)
        for i in range(n, rws * cols):
            axs[i // cols][i % cols].set_visible(False)
        fig.suptitle(f'{cls}s: mean |yaw rate| (rad/s, x) against speed variation (CV, y), one 20 s window per dot', x=.01, ha='left', fontsize=10, fontweight='bold')
        fig.tight_layout(rect=(0, 0, 1, .95)); fig.savefig(os.path.join(outdir, f'signature-{cls}.png'), dpi=90); plt.close(fig)

    # cohesion by fleet
    agg = {}
    for r in runs.values():
        for q in r['cohesion']['perSquad']:
            a = agg.setdefault(q['race'], [0, 0, 0, 0])
            a[0] += q['seconds']; a[1] += q['inBand']; a[2] += q['parade']; a[3] += q['dissolved']
    races = sorted(r for r in agg if agg[r][0] > 0)
    fig, ax = plt.subplots(figsize=(9, 5.5))
    y = np.arange(len(races))
    inb = np.array([agg[r][1] / agg[r][0] for r in races]); par = np.array([agg[r][2] / agg[r][0] for r in races]); dis = np.array([agg[r][3] / agg[r][0] for r in races])
    oth = 1 - inb - par - dis
    ax.barh(y, inb, color=SERIES[0], label='in band', height=.7)
    ax.barh(y, par, left=inb, color=SERIES[3], label='parade (too rigid)', height=.7)
    ax.barh(y, dis, left=inb + par, color=SERIES[1], label='dissolved', height=.7)
    ax.barh(y, oth, left=inb + par + dis, color=GRID, label='other (spread or pace out of band)', height=.7)
    ax.axvline(.8, color=INK, lw=1, ls='--')
    ax.set_yticks(y, [FLEETS[r] for r in races]); ax.set_xlim(0, 1); ax.set_xlabel('share of squad-time outside dogfights and routs')
    ax.legend(loc='lower right', fontsize=8); ax.set_title('Squadron cohesion by fleet (dashed: the 80% target)', loc='left')
    fig.tight_layout(); fig.savefig(os.path.join(outdir, 'cohesion.png'), dpi=90); plt.close(fig)


def main():
    label = sys.argv[1]
    only = None
    if '--only' in sys.argv:
        only = sys.argv[sys.argv.index('--only') + 1].split(',')
    base, runs = load(label)
    outdir = os.path.join(base, 'plots')
    if '--out' in sys.argv:
        outdir = sys.argv[sys.argv.index('--out') + 1]
    os.makedirs(outdir, exist_ok=True)
    for rid, run in runs.items():
        if run['spec'].get('sweep'):
            continue
        if only and not any(rid.startswith(o) for o in only):
            continue
        if rid.startswith('02-') and not any(s['cls'] == 'frigate' for s in run['ships']):
            continue
        scene_figure(base, run, os.path.join(outdir, f'scene-{rid}.png'))
    if not only:
        summary_figures(base, runs, outdir)
    print('plots in', outdir)


if __name__ == '__main__':
    main()
