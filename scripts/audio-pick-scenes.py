#!/usr/bin/env python3
"""Writes bench/audio/scenes.json: the ten audio scenes, scripted around real moments.

python3 scripts/audio-pick-scenes.py PROBE_5_6_77.json PROBE_10_11_21.json

Probes come from scripts/audio-probe.cjs (Empire v Rebels seed 77 size 50, 110 s;
Federation v Klingons seed 21 size 40, 90 s). Each camera is computed from the
probed trajectories, so a fighter really passes where the camera waits. Times are
battle seconds since the war began. Ship-locked cameras are paths with a key
every 0.25 s, interpolated linearly.
"""
import json, sys, collections, numpy as np

UP = np.array([0., 1., 0.])
norm = lambda v: v / (np.linalg.norm(v) or 1)

def load(p):
    d = json.load(open(p)); meta = {m['id']: m for m in d['meta']}
    tr = collections.defaultdict(dict)
    for f in d['frames']:
        for r in f['s']: tr[r[0]][round(f['t'], 1)] = r[1:]
    return d, meta, tr

def pos(tr, i, t):
    """Ship position at battle time t, interpolated between 0.1 s samples."""
    a = round(np.floor(t * 10) / 10, 1); b = round(a + .1, 1); u = (t - a) / .1
    pa = np.array(tr[i][a][:3]); pb = np.array(tr[i].get(b, tr[i][a])[:3])
    return pa + (pb - pa) * u

def vel(tr, i, t, h=.2): return (pos(tr, i, t + h) - pos(tr, i, t - h)) / (2 * h)
def heading(tr, i, t):
    r = tr[i][round(t, 1)]; y, p = r[3], r[4]
    return np.array([np.cos(y) * np.cos(p), np.sin(p), np.sin(y) * np.cos(p)])
L = lambda v: [round(float(x), 1) for x in v]

def closest(tr, i, eye, t0, t1):
    ts = np.arange(t0, t1, .05); d = [np.linalg.norm(pos(tr, i, t) - eye) for t in ts]
    k = int(np.argmin(d)); return round(float(ts[k]), 2), round(float(d[k]), 1)

def locked(tr, i, t0, t1, rel, step=.25, until=None):
    """A path that rides with ship i: rel(t, p, f) -> (eye, look). After `until` (a death) it holds."""
    keys = []
    for t in np.arange(t0, t1 + 1e-6, step):
        tt = min(t, until - .1) if until else t
        p = pos(tr, i, tt); f = heading(tr, i, round(np.floor(tt * 10) / 10, 1))
        e, l = rel(tt, p, f); keys.append({'t': round(float(t), 2), 'eye': L(e), 'look': L(l)})
    return {'type': 'path', 'keys': keys}

def main(p56, p1011):
    d, meta, tr = load(p56); d2, meta2, tr2 = load(p1011)
    E = {'matchup': [5, 6], 'seed': 77, 'size': 50}; T = {'matchup': [10, 11], 'seed': 21, 'size': 40}
    ev = lambda d, typ: [e for e in d['events'] if e['type'] == typ]
    scenes = []

    # 1. Parked camera, an A-wing passes 30 units away, left to right, at 206 units/s in its straightest 3 s.
    #    (The first pick, a TIE at 51.2 s, flew in a flight of eight and a hero died beside the camera 3 s
    #    before it passed: the capture measured the explosion, not the pass. This one has no death within
    #    1.5 km or 3.5 s.)
    fid, tc = 70, 21.1
    v = vel(tr, fid, tc); f = norm(np.cross(UP, norm(v * [1, 0, 1]))); p = pos(tr, fid, tc)
    eye = p - f * 30 - UP * 6; look = p - UP * 6
    t_ca, d_ca = closest(tr, fid, eye, tc - 3, tc + 3)
    scenes.append({'id': 1, 'name': 'Fighter pass, parked camera', **E, 't0': round(t_ca - 3.5, 1), 'seconds': 7, 'subject': fid,
                   'camera': {'type': 'parked', 'eye': L(eye), 'look': L(look)},
                   'expect': {'closest': t_ca, 'distance': d_ca, 'speed': round(float(np.linalg.norm(v)))}})

    # 2. A Victory-class destroyer (1,005 long) slides overhead: the camera travels under her keel, bow to stern,
    #    gaze up and forward, so the hull slides over and away. Her engines are at the stern; the pass ends in their wash.
    #    The camera carries on past the stern (14 s, bow + 0.75 L to stern - 0.55 L) so she moves on.
    cid = 4; Lc = meta[cid]['slen']; t0 = 22.0
    def rel2(t, p, f):
        side = norm(np.cross(f, UP)); u = (t - t0) / 14
        e = p + f * Lc * (0.75 - 1.8 * u) - UP * Lc * .22 + side * Lc * .05
        return e, e + f * Lc * .45 + UP * Lc * .5
    scenes.append({'id': 2, 'name': 'Capital overhead', **E, 't0': t0, 'seconds': 14, 'subject': cid, 'camera': locked(tr, cid, t0, t0 + 14, rel2)})

    # 3. Riding along with an X-wing in the furball: the ship that stays alive longest with enemies within 400 units.
    best = None
    for i, m in meta.items():
        if m['side'] != 1 or m['slen'] > 40: continue
        for t0 in np.arange(24, 80, 1.0):
            ts = [round(t0 + k * .5, 1) for k in range(24)]
            if not all(t in tr[i] for t in ts): continue
            near = sum(sum(1 for j in tr if meta[j]['side'] == 0 and t in tr[j] and np.linalg.norm(np.array(tr[j][t][:3]) - np.array(tr[i][t][:3])) < 400) for t in ts)
            if best is None or near > best[0]: best = (near, i, float(t0))
    _, rid, rt0 = best
    sl = meta[rid]['slen']
    scenes.append({'id': 3, 'name': 'Riding along in a dogfight', **E, 't0': rt0, 'seconds': 12, 'subject': rid,
                   'camera': {'type': 'ride', 'ship': rid, 'back': round(sl * 4.5, 1), 'up': round(sl * 1.2, 1), 'ahead': round(sl * 25, 1)}})

    # 4. Beside the Sovereign-class flagship (798 long) while she fights: camera off her beam, a third of a length out.
    sid = 0; Ls = meta2[sid]['slen']; t0 = 40.0
    def rel4(t, p, f):
        side = norm(np.cross(f, UP)); e = p + side * Ls * .38 + UP * Ls * .08 - f * Ls * .05
        return e, p + f * Ls * .1
    scenes.append({'id': 4, 'name': 'Beside a capital firing a broadside', **T, 't0': t0, 'seconds': 10, 'subject': sid, 'camera': locked(tr2, sid, t0, t0 + 10, rel4)})

    # 5. A flight of TIEs (ten, around a TIE Advanced) screams overhead: parked camera 60 below their path, looking up at them coming.
    lead, tc = 50, 53.6
    mem = [j for j in tr if meta[j]['side'] == 0 and meta[j]['slen'] < 40 and round(tc, 1) in tr[j]
           and np.linalg.norm(pos(tr, j, tc) - pos(tr, lead, tc)) < 160 and np.linalg.norm(vel(tr, j, tc) - vel(tr, lead, tc)) < 40]
    c = np.mean([pos(tr, j, tc) for j in mem], axis=0); v = np.mean([vel(tr, j, tc) for j in mem], axis=0); vh = norm(v * [1, 0, 1])
    eye = c - UP * 60; look = eye - vh * 100 + UP * 70
    t_ca, d_ca = closest(tr, lead, eye, tc - 3, tc + 3)
    scenes.append({'id': 5, 'name': 'Squadron overhead', **E, 't0': round(tc - 3.5, 1), 'seconds': 7, 'subject': lead, 'members': mem,
                   'camera': {'type': 'parked', 'eye': L(eye), 'look': L(look)}, 'expect': {'closest': t_ca, 'distance': d_ca, 'members': len(mem)}})

    # 6. The same Victory-class destroyer dies at close range: camera off her quarter, 0.8 lengths, held after the kill.
    kill = [e for e in ev(d, 'capitalKill') if e['ship'] == cid][0]; tk = kill['t']
    def rel6(t, p, f):
        side = norm(np.cross(f, UP)); e = p - side * Lc * .8 + UP * Lc * .18 - f * Lc * .25
        return e, p
    scenes.append({'id': 6, 'name': 'Capital death at close range', **E, 't0': round(tk - 4, 1), 'seconds': 16, 'subject': cid,
                   'camera': locked(tr, cid, tk - 4, tk + 12, rel6, until=tk), 'expect': {'kill': tk}})

    # 7. An ion strike lands near the camera: parked 320 units off the strike point, looking at it, from the charge on.
    ch = [e for e in ev(d, 'ionCharge') if e['t'] < 40][0]; st = [e for e in ev(d, 'ionStrike') if e['t'] < 45][0]
    gun = np.array([ch['x'], ch['y'], ch['z']]); pt = np.array([st['x'], st['y'], st['z']])
    beam = norm(pt - gun); side = norm(np.cross(beam, UP)); eye = pt + side * 320 + UP * 60 - beam * 120
    scenes.append({'id': 7, 'name': 'Ion strike near the camera', **E, 't0': round(ch['t'] - .5, 1), 'seconds': 11, 'subject': ch['ship'],
                   'camera': {'type': 'parked', 'eye': L(eye), 'look': L(pt)}, 'expect': {'charge': ch['t'], 'strike': st['t'], 'distance': 330}})

    # 8. A wide Broadcast shot pulls back from a skirmish: from 60 units off a fighter in the furball to 4,000 units in 12 s.
    wid, t0 = rid, rt0 + 12
    if not all(round(t0 + k * .5, 1) in tr[wid] for k in range(25)): t0 = rt0
    def rel8(t, p, f):
        u = (t - t0) / 12; k = u * u * (3 - 2 * u); dist = 60 + k * 3940
        dirn = norm(np.array([-.55, .35, -.76])); return p + dirn * dist, p
    scenes.append({'id': 8, 'name': 'Wide Broadcast pull-back', **E, 't0': t0, 'seconds': 12, 'subject': wid, 'focus': wid,
                   'camera': locked(tr, wid, t0, t0 + 12, rel8)})

    # 9. Take control of the hero freighter: throttle up, fire in bursts, a turn. (The first pick, an X-wing,
    #    was shot down 5.3 s into the scene with the player flying it straight into the furball.)
    pid = [i for i, m in meta.items() if 'YT-1300' in m['klass']][0]; t0 = rt0 + 2
    keys = [{'t': round(t0 + .1, 2), 'down': ['w']}, {'t': round(t0 + 1.5, 2), 'down': [' ']}, {'t': round(t0 + 3.5, 2), 'up': [' ']},
            {'t': round(t0 + 4.5, 2), 'down': ['a']}, {'t': round(t0 + 6, 2), 'up': ['a']}, {'t': round(t0 + 6.5, 2), 'down': [' ']},
            {'t': round(t0 + 9, 2), 'up': [' ', 'w']}, {'t': round(t0 + 10, 2), 'down': [' ']}, {'t': round(t0 + 11.5, 2), 'up': [' ']}]
    scenes.append({'id': 9, 'name': 'Cockpit, Take control', **E, 't0': t0, 'seconds': 12, 'subject': pid, 'camera': {'type': 'pilot', 'ship': pid, 'keys': keys}})

    # 10. The war in Broadcast, 90 s from first contact (includes the Victory's death and two ion strikes).
    scenes.append({'id': 10, 'name': 'A 90-second war in Broadcast', **E, 't0': 10, 'seconds': 90, 'camera': {'type': 'broadcast'}})
    json.dump(scenes, open('bench/audio/scenes.json', 'w'), indent=1)
    for s in scenes: print(s['id'], s['name'], s['t0'], s['seconds'], s.get('subject'), s.get('expect', ''))

if __name__ == '__main__':
    main(*sys.argv[1:3])
