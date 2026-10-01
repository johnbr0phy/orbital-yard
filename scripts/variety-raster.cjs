/* Clay renderer for contact sheets: a small CPU z-buffer rasteriser with
   flat Lambert shading, orthographic cameras and a PNG writer. No GPU, no
   dependencies, so sheets render the same headless as in CI. */
const zlib = require('node:zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy ? rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3) : raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1); }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, {level: 6})), chunk('IEND', Buffer.alloc(0))]);
}

class Canvas {
  constructor(w, h, bg = [22, 27, 34]) { this.w = w; this.h = h; this.rgb = Buffer.alloc(w * h * 3); for (let i = 0; i < w * h; i++) this.rgb.set(bg, i * 3); }
  fill(x0, y0, w, h, c) { for (let y = Math.max(0, y0); y < Math.min(this.h, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(this.w, x0 + w); x++) this.rgb.set(c, (y * this.w + x) * 3); }
  png() { return png(this.w, this.h, this.rgb); }
}

/* Views: yaw/pitch of an orthographic camera looking at the hull. The hull
   frame is +x prow, +y up, +z starboard. */
const VIEWS = {
  oblique: {yaw: .65, pitch: .48},
  top: {yaw: 0, pitch: Math.PI / 2 - 1e-4},
  side: {yaw: 0, pitch: 0},
  front: {yaw: Math.PI / 2, pitch: 0},
};
function basisFor(view) {
  const {yaw, pitch} = VIEWS[view] || view;
  const eye = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const n = v => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const right = n(cross([0, 1, 0], eye)), up = cross(eye, right);
  return {eye, right, up};
}
/* Draw a mesh {v,i} into a cell of the canvas. `scale` is metres per cell
   width (matched per row); the hull is centred on its bounding box. */
function drawMesh(cv, mesh, cell, view, scale, clay = [196, 200, 206]) {
  const {eye, right, up} = basisFor(view);
  const v = mesh.v, idx = mesh.i, SS = 2;
  const W = cell.w * SS, H = cell.h * SS;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < v.length; k += 3) for (let d = 0; d < 3; d++) { lo[d] = Math.min(lo[d], v[k + d]); hi[d] = Math.max(hi[d], v[k + d]); }
  const c = lo.map((l, d) => (l + hi[d]) / 2);
  const px = W / scale;
  const P = new Float32Array(v.length);
  for (let k = 0; k < v.length; k += 3) {
    const x = v[k] - c[0], y = v[k + 1] - c[1], z = v[k + 2] - c[2];
    P[k] = W / 2 + (x * right[0] + y * right[1] + z * right[2]) * px;
    P[k + 1] = H / 2 - (x * up[0] + y * up[1] + z * up[2]) * px;
    P[k + 2] = x * eye[0] + y * eye[1] + z * eye[2];
  }
  const zb = new Float32Array(W * H).fill(-Infinity), col = new Float32Array(W * H).fill(-1);
  const light = (() => { const l = [.45, .8, .35], m = Math.hypot(...l); return l.map(x => x / m); })();
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, d = idx[t + 2] * 3;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2], wx = v[d] - v[a], wy = v[d + 1] - v[a + 1], wz = v[d + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    // double-sided: face the camera
    if (nx * eye[0] + ny * eye[1] + nz * eye[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const shade = .30 + .62 * Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]) + .08 * ny;
    const x0 = P[a], y0 = P[a + 1], z0 = P[a + 2], x1 = P[b], y1 = P[b + 1], z1 = P[b + 2], x2 = P[d], y2 = P[d + 1], z2 = P[d + 2];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-12) continue;
    const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const miny = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const qx = x + .5, qy = y + .5;
      const w0 = ((x1 - qx) * (y2 - qy) - (x2 - qx) * (y1 - qy)) / area, w1 = ((x2 - qx) * (y0 - qy) - (x0 - qx) * (y2 - qy)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * z0 + w1 * z1 + w2 * z2, o = y * W + x;
      if (z > zb[o]) { zb[o] = z; col[o] = shade; }
    }
  }
  for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) {
    let s = 0, n = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) { const q = col[(y * SS + dy) * W + x * SS + dx]; if (q >= 0) { s += q; n++; } }
    if (!n) continue;
    const o = ((cell.y + y) * cv.w + cell.x + x) * 3, k = n / (SS * SS), sh = s / n;
    for (let ch = 0; ch < 3; ch++) cv.rgb[o + ch] = Math.round(cv.rgb[o + ch] * (1 - k) + Math.min(255, clay[ch] * sh) * k);
  }
}
/* 3x5 pixel font for labels (digits, capitals and a few marks). */
const FONT = {'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001','8':'111101111101111','9':'111101111001111',
 A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',Z:'111001010100111',
 ' ':'000000000000000','-':'000000111000000','/':'001001010100100','.':'000000000000010',"'":'010010000000000','(':'010100100100010',')':'010001001001010',':':'000010000010000','%':'101001010100101','x':'000101010101000','m':'000000110111101',"’":'010010000000000','&':'010101010101011'};
function text(cv, x, y, s, c = [170, 184, 201], k = 1) {
  s = String(s).toUpperCase();
  for (let i = 0; i < s.length; i++) { const g = FONT[s[i]] || FONT[' ']; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') cv.fill(x + (i * 4 + q) * k, y + r * k, k, k, c); }
}
module.exports = {Canvas, drawMesh, text, png};
