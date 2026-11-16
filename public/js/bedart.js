// Nightcraft Bedwars art: every block texture, item icon and 3D item model is drawn here in code as
// 16x16 pixel art (no image files), so it ships inside the single-file game.
import * as THREE from 'three';
import { B, isWool, TEAM_DEFS, WORLD, CH } from './bedwars.js';

// a small seeded random, so every machine draws the same pixels
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = c => '#' + c.toString(16).padStart(6, '0');
const mix = (a, b, k) => { const A = new THREE.Color(a), Bc = new THREE.Color(b); return A.lerp(Bc, k).getHex(); };
const dk = (c, k) => mix(c, 0x000000, k), lt = (c, k) => mix(c, 0xffffff, k);
function canvas(w = 16, h = 16) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
function painter(g) { return (x, y, c) => { if (c == null) return; g.fillStyle = hex(c); g.fillRect(x, y, 1, 1); }; }

// ---------------- block textures ----------------
const TILE_LIST = ['grass_top', 'grass_side', 'dirt', 'stone', 'log_side', 'log_top', 'plank', 'wool', 'end', 'obsidian', 'glow', 'brick', 'sand', 'leaves', 'snow_top', 'snow_side', 'iron_blk', 'gold_blk', 'dia_blk', 'em_blk', 'bed_top', 'bed_side', 'bed_pillow', 'shopwood'];
const TILE = Object.fromEntries(TILE_LIST.map((n, i) => [n, i]));
const COLS = 8, ROWS = Math.ceil(TILE_LIST.length / COLS);
function speckle(set, r, pal, w = [1]) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, pal[Math.floor(r() * pal.length)]); }
const PAINT = {
  grass_top(set, r) { speckle(set, r, [0x4f9a32, 0x5aa83a, 0x66b844, 0x48902c, 0x5aa83a]); },
  dirt(set, r) { speckle(set, r, [0x7a5432, 0x6a4628, 0x86603a, 0x5e3e22, 0x7a5432]); for (let i = 0; i < 6; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), 0x9a7a5a); },
  grass_side(set, r) { PAINT.dirt(set, r); for (let x = 0; x < 16; x++) { const d = 2 + Math.floor(r() * 3); for (let y = 0; y < d; y++) set(x, y, [0x4f9a32, 0x5aa83a, 0x66b844][Math.floor(r() * 3)]); } },
  stone(set, r) { speckle(set, r, [0x7d7d7d, 0x8a8a8a, 0x6e6e6e, 0x767676, 0x828282]); for (let i = 0; i < 5; i++) { const x = Math.floor(r() * 14), y = Math.floor(r() * 15); set(x, y, 0x5e5e5e); set(x + 1, y, 0x666666); } },
  log_side(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, x % 4 === 0 ? 0x4a3418 : [0x6b4f2a, 0x5c4322, 0x775a32][Math.floor(r() * 3)]); },
  log_top(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); set(x, y, d > 6.5 ? 0x5c4322 : Math.floor(d) % 2 ? 0xb89a62 : 0x9c7e4a); } },
  plank(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, seam = (row * 5 + 3) % 16; set(x, y, y % 4 === 3 ? 0x7a5a32 : x === seam ? 0x8a6a3c : [0xb8945a, 0xa8844e, 0xc29e64, 0xb08c54][Math.floor(r() * 4)]); } },
  shopwood(set, r) { PAINT.plank(set, r); for (const [x, y] of [[2, 1], [13, 1], [2, 9], [13, 9]]) set(x, y, 0x3a2a1a); },
  wool(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, ((x + y * 2) % 5 === 0) ? 0xd0d0d0 : [0xf2f2f2, 0xe6e6e6, 0xffffff, 0xeaeaea][Math.floor(r() * 4)]); },
  end(set, r) { speckle(set, r, [0xe8e4b0, 0xdcd8a0, 0xf0ecc0, 0xe2dea8]); for (let i = 0; i < 14; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), 0xbab47c); },
  obsidian(set, r) { speckle(set, r, [0x14101e, 0x1e1630, 0x281c40, 0x181226]); for (let i = 0; i < 8; i++) set(Math.floor(r() * 16), Math.floor(r() * 16), 0x5a3a8a); },
  glow(set, r) { speckle(set, r, [0xf8d878, 0xe8b850, 0xffe8a0, 0xc89038, 0xfff0b8]); },
  brick(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 3, off = row ? 4 : 0; set(x, y, y % 8 === 7 || (x + off) % 8 === 7 ? 0x5a5a5a : [0x8a8a8a, 0x7e7e7e, 0x949494, 0x868686][Math.floor(r() * 4)]); } },
  sand(set, r) { speckle(set, r, [0xe0d4a0, 0xd8cc94, 0xe8dcac, 0xd2c48a]); },
  leaves(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, r() < 0.14 ? 0x163a10 : [0x2e6a22, 0x3a7a2a, 0x24581a, 0x447e30][Math.floor(r() * 4)]); },
  snow_top(set, r) { speckle(set, r, [0xf4f8ff, 0xe8eef8, 0xffffff, 0xdfe8f4]); },
  snow_side(set, r) { PAINT.dirt(set, r); for (let x = 0; x < 16; x++) { const d = 3 + Math.floor(r() * 3); for (let y = 0; y < d; y++) set(x, y, [0xf4f8ff, 0xe8eef8, 0xffffff][Math.floor(r() * 3)]); } },
  bed_top(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, x === 0 || x === 15 ? 0xb8b8b8 : ((x + y) % 6 === 0 ? 0xe0e0e0 : 0xf2f2f2)); },
  bed_side(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, y > 10 ? (x < 3 || x > 12 ? 0x6a4a2a : null) : y > 8 ? 0x7a5a32 : 0xeeeeee); },
  bed_pillow(set, r) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, (x < 2 || x > 13 || y < 2 || y > 13) ? 0xd8d8d8 : 0xffffff); },
};
function metal(base) { return (set) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15, inner = x === 1 || y === 1; set(x, y, edge ? dk(base, 0.35) : inner ? lt(base, 0.45) : (x + y) % 7 === 0 ? lt(base, 0.25) : x > 12 || y > 12 ? dk(base, 0.15) : base); } }; }
PAINT.iron_blk = metal(0xd8d8d8); PAINT.gold_blk = metal(0xf2c830); PAINT.dia_blk = metal(0x4ad8d0); PAINT.em_blk = metal(0x38c860);
const tileCache = {};
export function tileCanvas(name) {
  if (tileCache[name]) return tileCache[name];
  const [c, g] = canvas(); PAINT[name](painter(g), rng(TILE[name] * 977 + 13)); return tileCache[name] = c;
}
let atlasTex = null;
export function atlas() {
  if (atlasTex) return atlasTex;
  const [c, g] = canvas(COLS * 16, ROWS * 16);
  TILE_LIST.forEach((n, i) => g.drawImage(tileCanvas(n), (i % COLS) * 16, Math.floor(i / COLS) * 16));
  atlasTex = new THREE.CanvasTexture(c); atlasTex.magFilter = THREE.NearestFilter; atlasTex.minFilter = THREE.NearestFilter; atlasTex.generateMipmaps = false; atlasTex.colorSpace = THREE.SRGBColorSpace;
  return atlasTex;
}
function tileUV(i) {
  const col = i % COLS, row = Math.floor(i / COLS), eu = 0.02 / COLS, ev = 0.02 / ROWS;
  return [col / COLS + eu, 1 - (row + 1) / ROWS + ev, (col + 1) / COLS - eu, 1 - row / ROWS - ev];
}
// face: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
export function faceTile(t, face) {
  if (t === B.GRASS) return face === 2 ? TILE.grass_top : face === 3 ? TILE.dirt : TILE.grass_side;
  if (t === B.SNOW) return face === 2 ? TILE.snow_top : face === 3 ? TILE.dirt : TILE.snow_side;
  if (t === B.LOG) return face === 2 || face === 3 ? TILE.log_top : TILE.log_side;
  if (isWool(t)) return TILE.wool;
  return TILE[{ [B.STONE]: 'stone', [B.DIRT]: 'dirt', [B.PLANKMAP]: 'shopwood', [B.PLANK]: 'plank', [B.GLOW]: 'glow', [B.OBSID]: 'obsidian', [B.BRICK]: 'brick', [B.SAND]: 'sand', [B.LEAVES]: 'leaves', [B.IRONBLK]: 'iron_blk', [B.GOLDBLK]: 'gold_blk', [B.DIAMBLK]: 'dia_blk', [B.EMBLK]: 'em_blk', [B.END]: 'end' }[t] || 'stone'];
}
const tintOf = t => isWool(t) ? new THREE.Color(TEAM_DEFS[t - B.WOOL].color).lerp(new THREE.Color(0xffffff), 0.1) : null;

// ---------------- chunk meshes: only the faces you can see, ambient occlusion in the corners ----------------
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.55 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.68 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.68 },
];
const AOK = [0.5, 0.68, 0.84, 1];
export function buildChunk(W, cx, cz, ao = true) {
  const { NX, NY, NZ, OX, OY, OZ } = WORLD, g = W.g;
  const at = (x, y, z) => { x += OX; y += OY; z += OZ; if (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ) return 0; const t = g[x + z * NX + y * NX * NZ]; return t >= B.BED && t < B.BED + 8 ? 0 : t; };
  const pos = [], uv = [], col = [], idx = [], nor = [];
  const x0 = cx * CH - OX, z0 = cz * CH - OZ;
  for (let y = -OY; y < NY - OY; y++) for (let z = z0; z < z0 + CH; z++) for (let x = x0; x < x0 + CH; x++) {
    const t = at(x, y, z); if (!t) continue;
    const tint = tintOf(t), glow = t === B.GLOW;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
      if (at(nx, ny, nz)) continue;
      const [u0, v0, u1, v1] = tileUV(faceTile(t, f)), base = pos.length / 3;
      const ax = F.n[0] ? [1, 2] : F.n[1] ? [0, 2] : [0, 1]; // the two axes along the face
      const shades = [];
      F.c.forEach((c, k) => {
        pos.push(x + c[0], y + c[1], z + c[2]); nor.push(F.n[0], F.n[1], F.n[2]);
        uv.push(k === 0 || k === 3 ? u0 : u1, k < 2 ? v0 : v1);
        let a = 3;
        if (ao && !glow) {
          const d = [0, 0, 0]; d[ax[0]] = c[ax[0]] ? 1 : -1; const e = [0, 0, 0]; e[ax[1]] = c[ax[1]] ? 1 : -1;
          const s1 = at(nx + d[0], ny + d[1], nz + d[2]) ? 1 : 0, s2 = at(nx + e[0], ny + e[1], nz + e[2]) ? 1 : 0, cc = at(nx + d[0] + e[0], ny + d[1] + e[1], nz + d[2] + e[2]) ? 1 : 0;
          a = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
        }
        const k2 = (glow ? 1.15 : F.s) * AOK[a]; shades.push(a);
        col.push((tint ? tint.r : 1) * k2, (tint ? tint.g : 1) * k2, (tint ? tint.b : 1) * k2);
      });
      // flip the quad's diagonal so the occlusion gradient doesn't crease the wrong way
      if (shades[0] + shades[2] < shades[1] + shades[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base); else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}
// one block as a mesh (held in your hand, dropped, in the HUD)
export function blockGeo(t, size = 1) {
  const pos = [], uv = [], col = [], idx = [], nor = [], tint = tintOf(t), h = size / 2;
  FACES.forEach((F, f) => {
    const [u0, v0, u1, v1] = tileUV(faceTile(t, f)), base = pos.length / 3;
    F.c.forEach((c, k) => { pos.push((c[0] - 0.5) * size, (c[1] - 0.5) * size, (c[2] - 0.5) * size); nor.push(...F.n); uv.push(k === 0 || k === 3 ? u0 : u1, k < 2 ? v0 : v1); const s = F.s; col.push((tint ? tint.r : 1) * s, (tint ? tint.g : 1) * s, (tint ? tint.b : 1) * s); });
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  void h;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setIndex(idx);
  return geo;
}

// ---------------- item icons ----------------
const TIER = [[0x6a4a26, 0x8a6a3a, 0xa8844e], [0x5a5a5a, 0x7a7a7a, 0x9e9e9e], [0x9a9a9a, 0xd8d8d8, 0xf6f6f6], [0x1a8a90, 0x30c8d0, 0x9af4f4]];
const ITEM_PAINT = {
  sword(set, tier = 0) {
    const [o, m, l] = TIER[tier];
    for (let i = 0; i < 10; i++) { const x = 5 + i, y = 10 - i; set(x, y, m); set(x + 1, y, l); set(x, y - 1, l); set(x + 1, y + 1, o); }
    set(15, 0, o); set(14, 1, l); set(15, 1, o);
    for (const [x, y] of [[2, 8], [3, 9], [4, 10], [5, 11], [6, 12], [7, 13]]) set(x, y, 0x3a2a14);
    for (const [x, y] of [[3, 8], [4, 9], [5, 10], [6, 11], [7, 12]]) set(x, y, 0x5a4020);
    for (const [x, y] of [[3, 12], [2, 13], [4, 11]]) set(x, y, 0x6a4a26);
    set(1, 14, 0x3a2a14); set(2, 14, 0x5a4020); set(1, 13, 0x5a4020);
  },
  pick(set, tier = 2) {
    const [o, m, l] = TIER[tier];
    for (let i = 0; i < 10; i++) { set(2 + i, 13 - i, 0x6a4a26); set(3 + i, 13 - i, 0x8a6a3a); }
    const arc = [[3, 3], [4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3], [11, 4], [12, 5], [12, 6], [13, 7], [13, 8], [13, 9], [13, 10], [13, 11]];
    for (const [x, y] of arc) { set(x, y, m); set(x - 1, y + 1, l); }
    set(2, 4, o); set(14, 12, o); set(3, 4, m);
  },
  ingot(set, c) {
    for (let x = 5; x <= 11; x++) set(x, 6, lt(c, 0.5));
    for (let y = 7; y <= 9; y++) for (let x = 4; x <= 12; x++) set(x, y, x === 4 ? lt(c, 0.2) : x === 12 ? dk(c, 0.15) : c);
    for (let x = 3; x <= 13; x++) set(x, 10, dk(c, 0.3));
    set(4, 6, dk(c, 0.4)); set(12, 6, dk(c, 0.4)); set(6, 7, lt(c, 0.6)); set(7, 7, lt(c, 0.6));
  },
  diamond(set) {
    const rows = [[6, 9], [5, 10], [4, 11], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]];
    rows.forEach(([a, b], i) => { for (let x = a; x <= b; x++) set(x, 4 + i, x === a || x === b ? 0x0e6a70 : i < 2 ? 0x9af4f4 : x < 7 ? 0x6ae8ec : 0x30c8d0); });
    set(6, 6, 0xffffff); set(7, 5, 0xffffff);
  },
  emerald(set) {
    for (let y = 2; y <= 13; y++) for (let x = 3; x <= 12; x++) { const d = Math.abs(x - 7.5) / 4.6 + Math.abs(y - 7.5) / 6; if (d <= 1) set(x, y, d > 0.82 ? 0x0e5a26 : x < 7 ? 0x6af08a : y > 9 ? 0x1a9a40 : 0x38c860); }
    set(6, 5, 0xffffff); set(6, 6, 0xd8ffe0);
  },
  apple(set) {
    for (let y = 4; y <= 14; y++) for (let x = 2; x <= 13; x++) { const d = Math.hypot(x - 7.5, (y - 9.5) * 1.1); if (d <= 5.4) set(x, y, d > 4.6 ? 0x8a5a00 : x < 6 && y < 9 ? 0xfff0a0 : y > 11 ? 0xc89000 : 0xf2c830); }
    set(8, 2, 0x5a3a1a); set(8, 3, 0x5a3a1a); set(9, 2, 0x3a8a2a); set(10, 2, 0x3a8a2a); set(10, 1, 0x3a8a2a);
  },
  chest(set, tier) {
    const c = [0x6a6a6a, 0x9a9a9a, 0xd8d8d8, 0x30c8d0][tier], o = dk(c, 0.5);
    for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) { const arm = y < 7 && (x < 5 || x > 10), body = x >= 4 && x <= 11, neck = y < 4 && x >= 6 && x <= 9; if ((arm || body) && !neck) set(x, y, x === 2 || x === 13 || y === 13 || (x === 4 && y >= 7) || (x === 11 && y >= 7) ? o : x < 7 ? lt(c, 0.25) : c); }
  },
  heart(set, k) {
    const shape = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    shape.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '#') return; const half = k === 1 && x > 3; set(x + 1, y + 2, k === 0 || half ? 0x2a1010 : (x === 1 && y === 1) ? 0xff9a9a : 0xe8282a); }));
  },
};
const iconCache = {};
export function itemCanvas(key, tier = 0, team = 0) {
  const id = key + ':' + tier + ':' + team;
  if (iconCache[id]) return iconCache[id];
  const [c, g] = canvas(), set = painter(g);
  if (key === 'sword') ITEM_PAINT.sword(set, tier);
  else if (key === 'pick') ITEM_PAINT.pick(set, Math.max(1, tier) + 1);
  else if (key === 'iron') ITEM_PAINT.ingot(set, 0xd8d8d8);
  else if (key === 'gold') ITEM_PAINT.ingot(set, 0xf2c830);
  else if (key === 'diamond') ITEM_PAINT.diamond(set);
  else if (key === 'emerald') ITEM_PAINT.emerald(set);
  else if (key === 'apple') ITEM_PAINT.apple(set);
  else if (key === 'armor') ITEM_PAINT.chest(set, tier);
  else if (key === 'heart') ITEM_PAINT.heart(set, tier);
  return iconCache[id] = c;
}
// a block drawn as a little 3D cube (for the hotbar)
export function blockIcon(t) {
  const id = 'blk:' + t; if (iconCache[id]) return iconCache[id];
  const [c, g] = canvas(32, 32);
  const tile = n => tileCanvas(TILE_LIST[faceTile(t, n)]);
  const tint = tintOf(t), shadeTile = (cv, k) => {
    const [o, og] = canvas(); og.drawImage(cv, 0, 0);
    if (tint) { og.globalCompositeOperation = 'multiply'; og.fillStyle = '#' + tint.getHexString(); og.fillRect(0, 0, 16, 16); og.globalCompositeOperation = 'destination-in'; og.drawImage(cv, 0, 0); og.globalCompositeOperation = 'source-over'; }
    if (k < 1) { og.fillStyle = `rgba(0,0,0,${1 - k})`; og.globalCompositeOperation = 'source-atop'; og.fillRect(0, 0, 16, 16); }
    return o;
  };
  g.setTransform(1, 0.5, -1, 0.5, 16, 1); g.drawImage(shadeTile(tile(2), 1), 0, 0, 16, 16);          // top
  g.setTransform(1, 0.5, 0, 1, 0, 9); g.drawImage(shadeTile(tile(4), 0.78), 0, 0, 16, 16);           // left
  g.setTransform(1, -0.5, 0, 1, 16, 17); g.drawImage(shadeTile(tile(0), 0.62), 0, 0, 16, 16);        // right
  return iconCache[id] = c;
}
export const dataURL = c => c.toDataURL();

// ---------------- 3D item models: the icon's pixels, given depth (like Minecraft's held items) ----------------
const modelCache = {};
export function itemGeo(key, tier = 0) {
  const id = key + ':' + tier; if (modelCache[id]) return modelCache[id];
  const cv = itemCanvas(key, tier), d = cv.getContext('2d').getImageData(0, 0, 16, 16).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && d[(y * 16 + x) * 4 + 3] > 0;
  const pos = [], col = [], idx = [], s = 1 / 16, th = s;
  const quad = (pts, c, k) => { const b = pos.length / 3; for (const p of pts) { pos.push(...p); col.push(c.r * k, c.g * k, c.b * k); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!on(x, y)) continue;
    const i = (y * 16 + x) * 4, c = new THREE.Color(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255).convertSRGBToLinear();
    const X0 = (x - 8) * s, X1 = X0 + s, Y1 = (8 - y) * s, Y0 = Y1 - s, Z0 = -th / 2, Z1 = th / 2;
    quad([[X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1]], c, 1);
    quad([[X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0]], c, 0.8);
    if (!on(x + 1, y)) quad([[X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1]], c, 0.7);
    if (!on(x - 1, y)) quad([[X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0]], c, 0.7);
    if (!on(x, y - 1)) quad([[X0, Y1, Z1], [X1, Y1, Z1], [X1, Y1, Z0], [X0, Y1, Z0]], c, 0.9);
    if (!on(x, y + 1)) quad([[X0, Y0, Z0], [X1, Y0, Z0], [X1, Y0, Z1], [X0, Y0, Z1]], c, 0.6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  geo.computeVertexNormals();
  return modelCache[id] = geo;
}
const itemMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const itemMatBasic = new THREE.MeshBasicMaterial({ vertexColors: true });
let blockMats = null;
export function itemMesh(key, tier = 0, team = 0, lite = false) {
  if (key === 'wool' || key === 'plank' || key === 'end') {
    const t = key === 'wool' ? B.WOOL + team : key === 'plank' ? B.PLANK : B.END;
    blockMats ||= { l: new THREE.MeshLambertMaterial({ map: atlas(), vertexColors: true }), b: new THREE.MeshBasicMaterial({ map: atlas(), vertexColors: true }) };
    return new THREE.Mesh(blockGeo(t, 0.5), lite ? blockMats.b : blockMats.l);
  }
  return new THREE.Mesh(itemGeo(key, tier), lite ? itemMatBasic : itemMat);
}

// the cracks that spread over a block as you break it (10 stages)
const crackCache = [];
export function crackTex(stage) {
  if (crackCache[stage]) return crackCache[stage];
  const [c, g] = canvas(), set = painter(g), r = rng(4242);
  const lines = [];
  for (let i = 0; i < 9; i++) { let x = 8, y = 8; const a = r() * 6.28, len = 3 + r() * 7, pts = []; for (let k = 0; k < len; k++) { x += Math.cos(a) + (r() - 0.5); y += Math.sin(a) + (r() - 0.5); pts.push([Math.round(x), Math.round(y)]); } lines.push(pts); }
  const n = Math.ceil((stage + 1) / 10 * lines.length);
  for (let i = 0; i < n; i++) for (const [x, y] of lines[i].slice(0, Math.ceil(lines[i].length * Math.min(1, (stage + 1) / 6)))) if (x >= 0 && y >= 0 && x < 16 && y < 16) set(x, y, 0x101010);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return crackCache[stage] = t;
}
export { TILE, tileUV };
