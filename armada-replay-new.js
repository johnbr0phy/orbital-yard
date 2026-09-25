/* Tribute War instant replay: a ring buffer of compact simulation snapshots.

   Ten times a second the page records every ship's transform, pose and
   liveness into one preallocated Float32Array (no per-frame allocation for
   ships), plus a capped list of weapon segments. Sampling interpolates
   between the two nearest snapshots, so replays play back smoothly at any
   speed. Clips copy a window for a subset of ships so the best moments of a
   whole war survive after the ring has wrapped. Pure data; no DOM, no GL. */
(function (root) {
  'use strict';
  const STRIDE = 8; // x, y, z, yaw, roll, pitch, flags(alive=1), hp fraction

  function createRing({seconds = 20, hz = 10, maxShips = 256, maxSegments = 700} = {}) {
    const frames = Math.ceil(seconds * hz) + 2;
    const r = {
      hz, frames, maxShips, maxSegments, count: 0, head: 0, lastT: -Infinity,
      times: new Float64Array(frames), data: new Float32Array(frames * maxShips * STRIDE),
      shipsAt: new Int32Array(frames), segs: new Array(frames).fill(null), segN: new Int32Array(frames),

      // Grow capacity when reinforcements push the ship count past it.
      ensure(n) {
        if (n <= r.maxShips) return;
        const next = Math.max(n, Math.ceil(r.maxShips * 1.5)), d = new Float32Array(frames * next * STRIDE);
        for (let f = 0; f < frames; f++) d.set(r.data.subarray(f * r.maxShips * STRIDE, (f + 1) * r.maxShips * STRIDE), f * next * STRIDE);
        r.data = d; r.maxShips = next;
      },
      // ships: array indexed by id. alive(s) decides visibility at this time.
      record(t, ships, alive, segments) {
        if (t - r.lastT < 1 / hz - 1e-6 && t >= r.lastT) return false;
        if (t < r.lastT) r.clear();
        r.ensure(ships.length);
        const f = r.head, base = f * r.maxShips * STRIDE, D = r.data;
        for (let i = 0; i < ships.length; i++) {
          const s = ships[i], o = base + i * STRIDE;
          if (!s) { D[o + 6] = 0; continue; }
          D[o] = s.x; D[o + 1] = s.y; D[o + 2] = s.z; D[o + 3] = s.yaw || 0;
          D[o + 4] = s.roll || 0; D[o + 5] = s.pitch || 0; D[o + 6] = alive(s) ? 1 : 0;
          D[o + 7] = Math.max(0, Math.min(1, (s.hp ?? 1) / Math.max(1e-6, s.hpMax || 1)));
        }
        r.shipsAt[f] = ships.length; r.times[f] = t; r.lastT = t;
        // Weapon segments: [ax,ay,az,bx,by,bz,race,kind] reusing the slot's array.
        let seg = r.segs[f];
        if (!seg) seg = r.segs[f] = new Float32Array(maxSegments * 8);
        let n = 0;
        if (segments) for (const g of segments) { if (n >= maxSegments) break; seg.set(g, n * 8); n++; }
        r.segN[f] = n;
        r.head = (r.head + 1) % frames; r.count = Math.min(frames, r.count + 1);
        return true;
      },
      range() {
        if (!r.count) return null;
        const oldest = (r.head - r.count + frames) % frames, newest = (r.head - 1 + frames) % frames;
        return [r.times[oldest], r.times[newest]];
      },
      // Index of the snapshot at or before t, walking back from newest.
      locate(t) {
        if (!r.count) return -1;
        for (let k = 0; k < r.count; k++) { const f = (r.head - 1 - k + frames * 2) % frames; if (r.times[f] <= t) return f; }
        return (r.head - r.count + frames) % frames;
      },
      // Interpolated transform of ship id at time t into out[8]; false if absent.
      sample(t, id, out) {
        const f0 = r.locate(t); if (f0 < 0 || id >= r.shipsAt[f0]) return false;
        const newest = (r.head - 1 + frames) % frames, f1 = f0 === newest ? f0 : (f0 + 1) % frames;
        const t0 = r.times[f0], t1 = r.times[f1], u = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
        return lerpInto(r.data, f0 * r.maxShips * STRIDE + id * STRIDE, (id < r.shipsAt[f1] ? f1 : f0) * r.maxShips * STRIDE + id * STRIDE, u, out);
      },
      segmentsAt(t) { const f = r.locate(t); return f < 0 ? {data: null, n: 0} : {data: r.segs[f], n: r.segN[f]}; },
      // Copy [t0,t1] for the listed ship ids into a standalone clip.
      clip(t0, t1, ids, meta = {}) {
        const pick = [];
        for (let k = r.count - 1; k >= 0; k--) { const f = (r.head - 1 - k + frames * 2) % frames; if (r.times[f] >= t0 - 1e-6 && r.times[f] <= t1 + 1e-6) pick.push(f); }
        const n = pick.length, m = ids.length, data = new Float32Array(n * m * STRIDE), times = new Float64Array(n), segs = [];
        pick.forEach((f, j) => {
          times[j] = r.times[f];
          ids.forEach((id, i) => {
            const o = j * m * STRIDE + i * STRIDE;
            if (id < r.shipsAt[f]) data.set(r.data.subarray(f * r.maxShips * STRIDE + id * STRIDE, f * r.maxShips * STRIDE + id * STRIDE + STRIDE), o);
          });
          segs.push(r.segs[f] ? r.segs[f].slice(0, r.segN[f] * 8) : new Float32Array(0));
        });
        return createClip(times, ids, data, segs, meta);
      },
      clear() { r.count = 0; r.head = 0; r.lastT = -Infinity; },
      bytes() { return r.data.byteLength + r.segs.reduce((a, s) => a + (s ? s.byteLength : 0), 0); }
    };
    return r;
  }

  function lerpInto(D, a, b, u, out) {
    if (!D[a + 6] && !D[b + 6]) { out[6] = 0; return true; }
    for (let k = 0; k < 6; k++) out[k] = D[a + k] + (D[b + k] - D[a + k]) * u;
    // Shortest-arc yaw.
    let dy = D[b + 3] - D[a + 3]; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    out[3] = D[a + 3] + dy * u;
    // A ship is visible only while both neighbours agree it is alive, except
    // the frame it dies on, which keeps it until the later snapshot.
    out[6] = u < 1 ? D[a + 6] : D[b + 6];
    out[7] = D[a + 7] + (D[b + 7] - D[a + 7]) * u;
    return true;
  }

  function createClip(times, ids, data, segs, meta) {
    const index = new Map(ids.map((id, i) => [id, i])), m = ids.length;
    return {
      times, ids, data, segs, meta, start: times[0], end: times[times.length - 1],
      sample(t, id, out) {
        const i = index.get(id); if (i == null || !times.length) return false;
        let j = 0; while (j + 1 < times.length && times[j + 1] <= t) j++;
        const k = Math.min(times.length - 1, j + 1), u = times[k] > times[j] ? Math.max(0, Math.min(1, (t - times[j]) / (times[k] - times[j]))) : 0;
        return lerpInto(data, j * m * STRIDE + i * STRIDE, k * m * STRIDE + i * STRIDE, u, out);
      },
      segmentsAt(t) { let j = 0; while (j + 1 < times.length && times[j + 1] <= t) j++; return {data: segs[j], n: segs[j] ? segs[j].length / 8 : 0}; },
      bytes() { return data.byteLength + segs.reduce((a, s) => a + s.byteLength, 0); }
    };
  }

  // Keep the N most important clips; returns the evicted clip (to unpin meshes).
  function createReel(limit = 5) {
    const clips = [];
    return {
      clips,
      offer(clip) {
        clips.push(clip); clips.sort((a, b) => (b.meta.score || 0) - (a.meta.score || 0) || a.start - b.start);
        return clips.length > limit ? clips.pop() : null;
      },
      chronological() { return clips.slice().sort((a, b) => a.start - b.start); },
      clear() { const old = clips.splice(0); return old; }
    };
  }

  const API = {STRIDE, createRing, createClip, createReel};
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ArmadaReplay = API;
})(typeof self !== 'undefined' ? self : this);
