// Nightcraft Bedwars: the block world, the rules and the bots (no rendering here; see bedview.js).
// Teams live on floating islands. Each island has a bed and a forge (iron, gold). Buy blocks at the
// shop, bridge across the void, break the other teams' beds. A player whose bed is gone does not
// come back. The last team standing wins.
// Coordinates: 1 unit = 1 block = 1 metre. Cell (x, y, z) fills [x, x+1) x [y, y+1) x [z, z+1).
// Online, the host runs this world for everyone; players' own movement is reported by their game
// (p.remote) and everything else (blocks, damage, beds, generators, the shop) is decided here.

export const B = {
  AIR: 0, STONE: 1, GRASS: 2, DIRT: 3, LOG: 4, PLANKMAP: 5, GLOW: 6, OBSID: 7, BRICK: 8, SAND: 9, LEAVES: 11, SNOW: 12,
  IRONBLK: 13, GOLDBLK: 14, DIAMBLK: 15, EMBLK: 16, PLANK: 20, END: 21, WOOL: 40, BED: 50,
};
export const isWool = t => t >= B.WOOL && t < B.WOOL + 8;
export const isBed = t => t >= B.BED && t < B.BED + 8;
export const TEAM_DEFS = [
  { name: 'Red', color: 0xd8342a, css: '#ff5a4a' }, { name: 'Blue', color: 0x2a5ad8, css: '#5a8aff' },
  { name: 'Green', color: 0x2aa83a, css: '#4ade5a' }, { name: 'Yellow', color: 0xe0c020, css: '#ffe04a' },
  { name: 'Aqua', color: 0x20b8c8, css: '#4ae8f0' }, { name: 'White', color: 0xe8e8e8, css: '#ffffff' },
  { name: 'Pink', color: 0xe060a8, css: '#ff8ac8' }, { name: 'Gray', color: 0x6a6a70, css: '#b0b0b8' },
];
export const BW_MAPS = {
  skies: { name: 'Nightfall Skies', teams: 4, desc: 'Four grassy islands, diamonds on the diagonals, emeralds on the hill in the middle.' },
  peaks: { name: 'Eight Peaks', teams: 8, desc: 'Eight snowy peaks around a huge stone plaza. Big, and busy.' },
  keep: { name: 'Crimson Keep', teams: 4, desc: 'Desert islands far apart, and a walled castle in the middle with the emeralds inside.' },
  twin: { name: 'Twin Spires', teams: 2, desc: 'Two teams, one long chain of islands between them. Up to 8 a side.' },
};
export const TOP = 10;            // island surfaces: you stand at y = 10
export const VOID = -14;          // fall below this and you are gone
export const MAX_Y = 34;
const NX = 176, NY = 64, NZ = 176, OX = 88, OY = 16, OZ = 88;
export const CH = 16;             // render chunks: 16 x 16 columns
export const WORLD = { NX, NY, NZ, OX, OY, OZ };
export const HP = 20;
// sword damage: 1.8 hits harder per click and has no cooldown; 1.9 waits for the swing to recharge
export const SWORDS = [{ name: 'Wooden Sword', d18: 5, d19: 4 }, { name: 'Stone Sword', d18: 6, d19: 5 }, { name: 'Iron Sword', d18: 7, d19: 6 }, { name: 'Diamond Sword', d18: 8, d19: 7 }];
export const COOLDOWN19 = 0.625; // a sword recharges in 0.625s (1.6 attacks a second)
export const ARMOR = [{ name: 'No armour', red: 0 }, { name: 'Chainmail', red: 0.25 }, { name: 'Iron Armour', red: 0.42 }, { name: 'Diamond Armour', red: 0.6 }];
export const PICKS = [{ name: 'No pickaxe', mul: 1 }, { name: 'Iron Pickaxe', mul: 1.9 }, { name: 'Diamond Pickaxe', mul: 3.2 }];
const hardOf = t => isBed(t) ? 1.3 : isWool(t) ? 0.45 : t === B.PLANK ? 1.5 : t === B.END ? 2.8 : 1;
export const SHOP = [
  { id: 'wool', name: 'Wool ×16', cost: { iron: 4 }, give: p => { p.inv.wool += 16; } },
  { id: 'plank', name: 'Oak Planks ×16', cost: { gold: 4 }, give: p => { p.inv.plank += 16; } },
  { id: 'end', name: 'End Stone ×12', cost: { iron: 24 }, give: p => { p.inv.end += 12; } },
  { id: 'apple', name: 'Golden Apple', cost: { gold: 3 }, give: p => { p.inv.apple += 1; } },
  { id: 'sword1', name: 'Stone Sword', cost: { iron: 10 }, ok: p => p.sword < 1, give: p => { p.sword = 1; } },
  { id: 'sword2', name: 'Iron Sword', cost: { gold: 7 }, ok: p => p.sword < 2, give: p => { p.sword = 2; } },
  { id: 'sword3', name: 'Diamond Sword', cost: { emerald: 3 }, ok: p => p.sword < 3, give: p => { p.sword = 3; } },
  { id: 'armor1', name: 'Chainmail Armour', cost: { iron: 30 }, ok: p => p.armor < 1, give: p => { p.armor = 1; } },
  { id: 'armor2', name: 'Iron Armour', cost: { gold: 12 }, ok: p => p.armor < 2, give: p => { p.armor = 2; } },
  { id: 'armor3', name: 'Diamond Armour', cost: { emerald: 6 }, ok: p => p.armor < 3, give: p => { p.armor = 3; } },
  { id: 'pick1', name: 'Iron Pickaxe', cost: { iron: 12 }, ok: p => p.pick < 1, give: p => { p.pick = 1; } },
  { id: 'pick2', name: 'Diamond Pickaxe', cost: { gold: 6, diamond: 2 }, ok: p => p.pick < 2, give: p => { p.pick = 2; } },
];
export const RES = ['iron', 'gold', 'diamond', 'emerald'];
export const INV = ['iron', 'gold', 'diamond', 'emerald', 'wool', 'plank', 'end', 'apple'];
// everything that can sit in an inventory slot
export const ITEMS = {
  sword: { name: 'Sword' }, pick: { name: 'Pickaxe' }, wool: { name: 'Wool', block: true }, plank: { name: 'Oak Planks', block: true }, end: { name: 'End Stone', block: true },
  apple: { name: 'Golden Apple' }, iron: { name: 'Iron Ingot' }, gold: { name: 'Gold Ingot' }, diamond: { name: 'Diamond' }, emerald: { name: 'Emerald' },
};
export const itemCount = (p, k) => k === 'sword' ? 1 : k === 'pick' ? (p.pick ? 1 : 0) : p.inv[k] || 0;
export const itemName = (p, k) => k === 'sword' ? SWORDS[p.sword].name : k === 'pick' ? PICKS[p.pick].name : ITEMS[k] ? ITEMS[k].name : '';
export const PW = 0.3, PH = 1.8, EYE = 1.62, REACH = 5, HIT = 3.4;
const GRAV = 28, JUMP = 8.6, WALK = 4.3, SNEAK = 1.3, SPRINT = 5.6;
export const GEN = { iron: 1.1, gold: 7, diamond: 28, emerald: 50 };
const SUDDEN = 600; // after ten minutes every bed breaks
const LIMIT = 900;  // after fifteen, the team with the most players left (then kills) wins
const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// everyone on teams: humans spread out (or together), bots fill the rest
export function bwRoster(humans, cfg, pickBot) {
  const M = BW_MAPS[cfg.map] || BW_MAPS.skies, nt = M.teams;
  const size = Math.max(1, Math.min(cfg.size || 2, Math.floor(16 / nt), nt === 2 ? 8 : 4));
  const out = [], count = Array(nt).fill(0);
  humans.forEach((h, i) => {
    let t = cfg.together ? Math.floor(i / size) % nt : i % nt;
    for (let k = 0; k < nt && count[t] >= size; k++) t = (t + 1) % nt;
    count[t]++; out.push({ ...h, team: t, bot: false });
  });
  let n = 0;
  for (let t = 0; t < nt; t++) while (count[t] < size) { count[t]++; out.push({ id: 'b' + n, team: t, bot: true, ...pickBot(n++) }); }
  return out;
}

export class BedWorld {
  constructor(roster, opts = {}) {
    this.g = new Uint8Array(NX * NY * NZ);
    this.opts = opts; this.map = BW_MAPS[opts.map] ? opts.map : 'skies'; this.pvp = opts.pvp === '1.9' ? '1.9' : '1.8';
    this.t = 0; this.over = false; this.winner = -1; this.events = []; this.dirty = true; this.dirtyChunks = new Set(); this.diff = null;
    this.diffK = opts.difficulty === 'easy' ? 0.55 : opts.difficulty === 'hard' ? 1.2 : 0.85;
    this.teams = []; this.beds = []; this.gens = []; this.piles = [];
    this.build();
    this.players = [];
    for (const r of roster) {
      const p = { id: r.id, name: r.name, team: r.team, char: r.char, role: r.role, skin: r.skin, bot: !!r.bot, remote: !!r.remote, x: 0, y: TOP, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, tp: 0,
        hp: HP, alive: true, out: false, respawn: 0, ground: false, sneak: false, sprint: false, inv: { iron: 0, gold: 0, diamond: 0, emerald: 0, wool: 0, plank: 0, end: 0, apple: 0 },
        sword: 0, armor: 0, pick: 0, slot: 0, held: 'sword', atkCd: 0, atkT: 9, hurtT: 9, iframe: 0, inv0: 0, mine: null, kills: 0, finals: 0, bedsBroken: 0, deaths: 0, move: { f: 0, s: 0, jump: false }, lastHit: null };
      if (p.bot) this.makeBot(p);
      this.players.push(p);
      this.spawn(p);
    }
  }
  makeBot(p) { p.bot = true; p.remote = false; p.ai = { mode: 'gather', trail: [], think: rnd(0, 0.5), goal: null, wait: rnd(15, 35) / this.diffK, strafe: 1, stuck: 0, lx: 0, lz: 0, cps: 0 }; }
  ev(e) { this.events.push(e); }
  takeEvents() { const e = this.events; this.events = []; return e; }
  idx(x, y, z) { x += OX; y += OY; z += OZ; if (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ) return -1; return x + z * NX + y * NX * NZ; }
  get(x, y, z) { const i = this.idx(Math.floor(x), Math.floor(y), Math.floor(z)); return i < 0 ? 0 : this.g[i]; }
  set(x, y, z, t) {
    const i = this.idx(x, y, z); if (i < 0 || this.g[i] === t) return;
    this.g[i] = t; this.dirty = true;
    // the render chunk it's in, and the neighbour if it sits on the edge
    const cx = Math.floor((x + OX) / CH), cz = Math.floor((z + OZ) / CH), lx = (x + OX) % CH, lz = (z + OZ) % CH;
    this.dirtyChunks.add(cx + ',' + cz);
    if (lx === 0) this.dirtyChunks.add((cx - 1) + ',' + cz); if (lx === CH - 1) this.dirtyChunks.add((cx + 1) + ',' + cz);
    if (lz === 0) this.dirtyChunks.add(cx + ',' + (cz - 1)); if (lz === CH - 1) this.dirtyChunks.add(cx + ',' + (cz + 1));
    if (this.diff) this.diff.push(x, y, z, t);
  }
  solid(x, y, z) { return this.get(x, y, z) !== 0; }

  // ---------------- the maps (all built the same way on every machine: no randomness) ----------------
  build() {
    const S = this.set.bind(this), M = this.map;
    const hash = (x, z) => ((x * 73856093) ^ (z * 19349663)) >>> 0;
    const disc = (cx, cz, r, depth, top, under) => {
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
        if (x * x + z * z > r * r + r * 0.6) continue;
        for (let y = TOP - depth; y <= TOP - 1; y++) S(cx + x, y, cz + z, y === TOP - 1 ? top : under);
        // a rough rocky underside
        const d = Math.sqrt(x * x + z * z) / r, extra = Math.floor((1 - d) * (r * 0.8)) + (hash(cx + x, cz + z) & 1);
        for (let y = TOP - depth - 1; y >= TOP - depth - extra; y--) S(cx + x, y, cz + z, B.STONE);
      }
    };
    const tree = (x, z, h = 4) => {
      for (let y = TOP; y < TOP + h; y++) S(x, y, z, B.LOG);
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let y = TOP + h - 2; y < TOP + h + 2; y++) {
        const k = Math.abs(a) + Math.abs(b) + Math.max(0, y - (TOP + h - 1)) * 1.5;
        if (k < 3.6 && !(a === 0 && b === 0 && y < TOP + h)) S(x + a, y, z + b, B.LEAVES);
      }
    };
    const P = {
      skies: { R: 36, top: B.GRASS, under: B.DIRT, r: 7, dia: 25, diaR: 3, mid: 8, teams: 4 },
      peaks: { R: 60, top: B.SNOW, under: B.DIRT, r: 6, dia: 36, diaR: 3, mid: 11, teams: 8 },
      keep: { R: 52, top: B.SAND, under: B.SAND, r: 7, dia: 36, diaR: 4, mid: 13, teams: 4 },
      twin: { R: 58, top: B.GRASS, under: B.DIRT, r: 9, dia: 0, diaR: 4, mid: 7, teams: 2 },
    }[M];
    const nt = P.teams;
    for (let ti = 0; ti < nt; ti++) {
      const a = nt === 2 ? (ti === 0 ? Math.PI : 0) : nt === 4 ? [Math.PI * 1.5, Math.PI * 0.5, Math.PI, 0][ti] : ti / nt * Math.PI * 2 - Math.PI / 2;
      const T = { ...TEAM_DEFS[ti], x: Math.round(Math.cos(a) * P.R), z: Math.round(Math.sin(a) * P.R) };
      this.teams.push(T);
      disc(T.x, T.z, P.r, 3, P.top, P.under);
      // facing the middle along the main axis; the bed off to one side so the way out stays clear
      const dx = -T.x, dz = -T.z, ix = Math.abs(dx) >= Math.abs(dz) ? Math.sign(dx) : 0, iz = ix ? 0 : Math.sign(dz);
      const bx = T.x + iz * 3, bz = T.z + ix * 3;
      const cells = [[bx, TOP, bz], [bx + ix, TOP, bz + iz]];
      for (const c of cells) S(c[0], c[1], c[2], B.BED + ti);
      this.beds.push({ alive: true, cells, dir: [ix, iz] });
      // forge at the back edge, the spawn between, the shopkeeper on the other side
      const fx = T.x - ix * (P.r - 2), fz = T.z - iz * (P.r - 2);
      for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) S(fx + u, TOP - 1, fz + v, (u + v) & 1 ? B.GOLDBLK : B.IRONBLK);
      this.gens.push({ kind: 'forge', team: ti, x: fx + 0.5, y: TOP, z: fz + 0.5, t: 0, tg: 0 });
      T.spawn = { x: T.x + 0.5 - ix, z: T.z + 0.5 - iz, yaw: Math.atan2(ix, iz) };
      T.shop = { x: T.x + 0.5 - iz * 3, z: T.z + 0.5 - ix * 3 };
      T.dir = [ix, iz];
      S(Math.floor(T.shop.x), TOP - 1, Math.floor(T.shop.z), B.PLANKMAP);
      // a tree behind the island, out of the way
      if (M !== 'keep' && M !== 'twin') tree(T.x - ix * 3 + iz * 3, T.z - iz * 3 + ix * 3, M === 'peaks' ? 5 : 4);
      else for (let y = TOP; y < TOP + 3; y++) S(T.x - ix * 3 + iz * 3, y, T.z - iz * 3 + ix * 3, B.BRICK); // a sandstone-ish pillar
      if (M === 'twin') {
        // the spire: a tall tower behind the bed side
        const sx = T.x - ix * 4 + iz * 6, sz = T.z - iz * 4 + ix * 6;
        for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) for (let y = TOP; y < TOP + 12; y++) if (Math.abs(u) === 1 || Math.abs(v) === 1) S(sx + u, y, sz + v, B.BRICK);
        S(sx, TOP + 12, sz, B.GLOW);
      }
    }
    // diamond islands
    const dias = M === 'twin' ? [[-29, 0], [29, 0], [0, -24], [0, 24]] : M === 'peaks' ? [0, 1, 2, 3].map(k => { const a = (k + 0.5) / 4 * Math.PI * 2; return [Math.round(Math.cos(a) * P.dia), Math.round(Math.sin(a) * P.dia)]; })
      : [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [Math.round(a * P.dia / Math.SQRT2), Math.round(b * P.dia / Math.SQRT2)]);
    for (const [cx, cz] of dias) {
      disc(cx, cz, P.diaR, 2, P.top, P.under);
      S(cx, TOP - 1, cz, B.DIAMBLK);
      this.gens.push({ kind: 'diamond', x: cx + 0.5, y: TOP, z: cz + 0.5, t: 10 });
    }
    // the middle
    const emer = [];
    if (M === 'skies') {
      disc(0, 0, P.mid, 3, B.GRASS, B.DIRT);
      for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) + Math.abs(z) < 4) S(x, TOP, z, B.STONE);
      emer.push([0, TOP + 1, 0]); S(0, TOP, 0, B.EMBLK);
      tree(5, -5); tree(-5, 5);
    } else if (M === 'peaks') {
      disc(0, 0, P.mid, 3, B.BRICK, B.STONE);
      for (let x = -P.mid; x <= P.mid; x++) for (let z = -P.mid; z <= P.mid; z++) if (x * x + z * z <= 9) S(x, TOP - 1, z, B.GLOW);
      emer.push([4, TOP, 0], [-4, TOP, 0]); S(4, TOP - 1, 0, B.EMBLK); S(-4, TOP - 1, 0, B.EMBLK);
      for (const [a, b] of [[7, 7], [-7, 7], [7, -7], [-7, -7]]) for (let y = TOP; y < TOP + 4; y++) S(a, y, b, B.BRICK);
    } else if (M === 'keep') {
      disc(0, 0, P.mid, 4, B.BRICK, B.STONE);
      // walls with gates on the four axes, a tower in each corner
      const w = 9;
      for (let k = -w; k <= w; k++) for (let y = TOP; y < TOP + 3; y++) for (const [x, z] of [[k, -w], [k, w], [-w, k], [w, k]]) if (Math.abs(k) > 1) S(x, y, z, B.BRICK);
      for (const [a, b] of [[w, w], [-w, w], [w, -w], [-w, -w]]) for (let u = -1; u <= 1; u++) for (let v = -1; v <= 1; v++) for (let y = TOP; y < TOP + 6; y++) S(a + u, y, b + v, B.BRICK);
      for (const [a, b] of [[w, w], [-w, w], [w, -w], [-w, -w]]) S(a, TOP + 6, b, B.GLOW);
      emer.push([2, TOP, 2], [-2, TOP, -2]); S(2, TOP - 1, 2, B.EMBLK); S(-2, TOP - 1, -2, B.EMBLK);
    } else {
      disc(0, 0, P.mid, 3, B.GRASS, B.DIRT);
      emer.push([0, TOP, 0]); S(0, TOP - 1, 0, B.EMBLK);
      tree(0, 4); tree(0, -4);
    }
    for (const [x, y, z] of emer) this.gens.push({ kind: 'emerald', x: x + 0.5, y, z: z + 0.5, t: 20 });
    this.dirty = true;
  }

  spawn(p) {
    const T = this.teams[p.team], k = this.players.filter(o => o.team === p.team).indexOf(p);
    p.x = T.spawn.x + (k % 2) * 0.8 - 0.4; p.z = T.spawn.z + ((k >> 1) % 2) * 0.8; p.y = TOP + 0.01; p.vx = p.vy = p.vz = 0;
    p.yaw = T.spawn.yaw; p.pitch = 0; p.hp = HP; p.alive = true; p.respawn = 0; p.mine = null; p.inv0 = 1.5; p.lastHit = null; p.tp++;
  }

  // ---------------- physics ----------------
  hitsBox(x, y, z) {
    for (let cx = Math.floor(x - PW); cx <= Math.floor(x + PW - 1e-6); cx++)
      for (let cy = Math.floor(y); cy <= Math.floor(y + PH - 1e-6); cy++)
        for (let cz = Math.floor(z - PW); cz <= Math.floor(z + PW - 1e-6); cz++) if (this.solid(cx, cy, cz)) return true;
    return false;
  }
  supported(x, y, z) {
    for (let cx = Math.floor(x - PW); cx <= Math.floor(x + PW - 1e-6); cx++)
      for (let cz = Math.floor(z - PW); cz <= Math.floor(z + PW - 1e-6); cz++) if (this.solid(cx, Math.floor(y - 0.05), cz)) return true;
    return false;
  }
  physics(p, dt) {
    const m = p.move, sp = p.sneak ? SNEAK : p.sprint && m.f > 0 ? SPRINT : WALK;
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, r = { x: -Math.cos(p.yaw), z: Math.sin(p.yaw) };
    let wx = f.x * m.f + r.x * m.s, wz = f.z * m.f + r.z * m.s; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    // walking steers the velocity quickly on the ground, slowly in the air (knockback carries)
    const k = 1 - Math.exp(-dt * (p.ground ? 14 : 2.2));
    p.vx += (wx * sp - p.vx) * k; p.vz += (wz * sp - p.vz) * k;
    if (m.jump && p.ground) { p.vy = JUMP; p.ground = false; }
    p.vy -= GRAV * dt; if (p.vy < -40) p.vy = -40;
    const steps = Math.ceil(Math.max(Math.abs(p.vx), Math.abs(p.vy), Math.abs(p.vz)) * dt / 0.2) || 1, h = dt / steps;
    for (let i = 0; i < steps; i++) {
      // horizontal, one axis at a time; sneaking on the ground never walks you off an edge
      for (const ax of ['x', 'z']) {
        const v = ax === 'x' ? p.vx : p.vz; if (!v) continue;
        const nx = ax === 'x' ? p.x + v * h : p.x, nz = ax === 'z' ? p.z + v * h : p.z;
        if (this.hitsBox(nx, p.y, nz)) { if (ax === 'x') p.vx = 0; else p.vz = 0; continue; }
        if (p.sneak && p.ground && !this.supported(nx, p.y, nz)) { if (ax === 'x') p.vx = 0; else p.vz = 0; continue; }
        p.x = nx; p.z = nz;
      }
      const ny = p.y + p.vy * h;
      if (this.hitsBox(p.x, ny, p.z)) {
        if (p.vy < 0) { p.y = Math.floor(ny) + 1; p.ground = true; } else p.y = Math.ceil(ny + PH) - PH - 0.001;
        p.vy = 0;
      } else { p.y = ny; p.ground = false; }
    }
    if (!p.ground && p.vy === 0 && this.supported(p.x, p.y, p.z)) p.ground = true;
    if (p.ground && !this.supported(p.x, p.y, p.z)) p.ground = false;
  }
  // the timers a player's own game keeps (online, a client runs these for itself)
  tickTimers(p, dt) {
    p.atkCd = Math.max(0, p.atkCd - dt); p.atkT += dt; p.hurtT += dt; p.inv0 = Math.max(0, p.inv0 - dt); p.iframe = Math.max(0, p.iframe - dt);
  }

  // ---------------- rays ----------------
  // first solid cell along a ray (Amanatides-Woo): { x, y, z, t, px, py, pz } (p*: the empty cell before it)
  ray(ox, oy, oz, dx, dy, dz, max) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
    const tdx = sx ? Math.abs(1 / dx) : Infinity, tdy = sy ? Math.abs(1 / dy) : Infinity, tdz = sz ? Math.abs(1 / dz) : Infinity;
    let tx = sx ? ((sx > 0 ? x + 1 - ox : ox - x) * tdx) : Infinity, ty = sy ? ((sy > 0 ? y + 1 - oy : oy - y) * tdy) : Infinity, tz = sz ? ((sz > 0 ? z + 1 - oz : oz - z) * tdz) : Infinity;
    let px = x, py = y, pz = z, t = 0;
    for (let i = 0; i < 200 && t <= max; i++) {
      if (this.solid(x, y, z)) return { x, y, z, t, px, py, pz };
      px = x; py = y; pz = z;
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; } else if (ty < tz) { y += sy; t = ty; ty += tdy; } else { z += sz; t = tz; tz += tdz; }
    }
    return null;
  }
  look(p) { const cp = Math.cos(p.pitch); return { ox: p.x, oy: p.y + (p.sneak ? EYE - 0.2 : EYE), oz: p.z, dx: Math.sin(p.yaw) * cp, dy: Math.sin(p.pitch), dz: Math.cos(p.yaw) * cp }; }
  target(p) { const L = this.look(p); return this.ray(L.ox, L.oy, L.oz, L.dx, L.dy, L.dz, REACH); }
  breakable(t, team) { return isWool(t) || t === B.PLANK || t === B.END || (isBed(t) && t - B.BED !== team); }

  // ---------------- combat (1.8: click as fast as you like; 1.9: wait for the swing) ----------------
  meleeTarget(p) {
    const L = this.look(p); let best = null, bd = HIT;
    for (const o of this.players) {
      if (o === p || !o.alive || o.team === p.team) continue;
      const cx = o.x - L.ox, cy = o.y + 1 - L.oy, cz = o.z - L.oz, d = Math.hypot(cx, cy, cz);
      if (d > bd + 0.3) continue;
      const along = cx * L.dx + cy * L.dy + cz * L.dz; if (along < 0) continue;
      const off = Math.hypot(cx - L.dx * along, cy - L.dy * along, cz - L.dz * along);
      if (off > 0.75 + d * 0.06) continue;
      const blk = this.ray(L.ox, L.oy, L.oz, L.dx, L.dy, L.dz, along); if (blk && blk.t < along - 0.4) continue;
      bd = d; best = o;
    }
    return best;
  }
  charge(p) { return this.pvp === '1.9' ? Math.min(1, p.atkT / COOLDOWN19) : 1; }
  // a swing: at whoever is in front (or `forced`, already picked by a player's own game); false if nobody
  attack(p, forced) {
    if (!p.alive || p.atkCd > 0) return false;
    const charge = this.charge(p), o = forced !== undefined ? forced : this.meleeTarget(p);
    p.atkT = 0; p.atkCd = this.pvp === '1.8' ? 0.06 : 0.05;
    if (!o) return false;
    this.hit(p, o, charge);
    return true;
  }
  hit(p, o, charge) {
    if (!o.alive || o.team === p.team) return;
    if (o.iframe > 0 || o.inv0 > 0) return;
    const nine = this.pvp === '1.9', crit = !p.ground && p.vy < -0.5 && (!nine || charge > 0.9);
    const base = p.held === 'sword' ? (nine ? SWORDS[p.sword].d19 : SWORDS[p.sword].d18) : p.held === 'pick' && p.pick ? (nine ? 3 + p.pick : 3 + p.pick) : 1;
    const dmg = base * (nine ? 0.2 + charge * charge * 0.8 : 1) * (crit ? 1.5 : 1);
    this.damage(o, p, dmg); o.iframe = 0.5;
    if (crit) this.ev({ k: 'crit', id: o.id });
    // knockback: harder off a sprint; in 1.9 a weak swing barely pushes
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, kb = (p.sprint ? 1.55 : 1) * (nine ? 0.4 + 0.6 * charge : 1) * 5.4;
    this.knock(o, f.x * kb, 5.0, f.z * kb);
    if (p.sprint && !nine) p.sprint = false; // a sprint hit ends the sprint (you have to reset it)
    // 1.9 sweep: a full swing on the ground also clips anyone right next to them
    if (nine && charge > 0.95 && p.ground && !p.sprint) for (const q of this.players) {
      if (q === o || q === p || !q.alive || q.team === p.team || Math.hypot(q.x - o.x, q.z - o.z) > 1.6 || Math.hypot(q.x - p.x, q.z - p.z) > HIT) continue;
      if (q.iframe > 0) continue; this.damage(q, p, 1); q.iframe = 0.5; this.knock(q, f.x * 2.5, 3, f.z * 2.5); this.ev({ k: 'sweep', id: q.id });
    }
  }
  knock(o, ix, iy, iz) {
    o.vx += ix; o.vz += iz; o.vy = Math.max(o.vy, iy); o.ground = false;
    this.ev({ k: 'kb', id: o.id, ix: +ix.toFixed(2), iy: +iy.toFixed(2), iz: +iz.toFixed(2) });
  }
  damage(o, by, dmg) {
    if (!o.alive || o.inv0 > 0) return;
    o.hp -= dmg * (1 - ARMOR[o.armor].red); o.hurtT = 0; o.lastHit = by ? { id: by.id, t: this.t } : o.lastHit;
    this.ev({ k: 'hit', id: o.id, by: by && by.id, x: +o.x.toFixed(1), y: +o.y.toFixed(1), z: +o.z.toFixed(1) });
    if (o.hp <= 0) this.kill(o, by);
  }
  kill(o, by, why = 'killed') {
    if (!o.alive) return;
    if (!by && o.lastHit && this.t - o.lastHit.t < 8) { by = this.P(o.lastHit.id); why = 'knocked into the void'; }
    o.alive = false; o.hp = 0; o.deaths++; o.mine = null;
    const final = !this.beds[o.team].alive;
    if (by && by !== o) { by.kills++; if (final) by.finals++; for (const r of RES) by.inv[r] += o.inv[r]; }
    for (const r of RES) o.inv[r] = 0;
    if (final) o.out = true; else o.respawn = 5;
    this.ev({ k: 'death', id: o.id, by: by && by.id, why, final, x: +o.x.toFixed(1), y: +o.y.toFixed(1), z: +o.z.toFixed(1) });
    this.checkWin();
  }

  // ---------------- blocks ----------------
  // breaking: progress builds while you hold the button on the same block; done() is called at 100%
  mineTick(p, dt, holding, done) {
    if (!holding || !p.alive) { p.mine = null; return; }
    const h = this.target(p);
    if (!h) { p.mine = null; return; }
    const t = this.get(h.x, h.y, h.z);
    if (!this.breakable(t, p.team)) { p.mine = { x: h.x, y: h.y, z: h.z, f: 0, no: true }; return; }
    if (!p.mine || p.mine.x !== h.x || p.mine.y !== h.y || p.mine.z !== h.z) p.mine = { x: h.x, y: h.y, z: h.z, f: 0 };
    p.mine.f += dt / (hardOf(t) / (p.held === 'pick' ? PICKS[p.pick].mul : 1));
    if (p.mine.f >= 1) { (done || ((x, y, z) => this.breakBlock(p, x, y, z)))(h.x, h.y, h.z); p.mine = null; }
  }
  inReach(p, x, y, z, extra = 0) { const L = this.look(p); return Math.hypot(x + 0.5 - L.ox, y + 0.5 - L.oy, z + 0.5 - L.oz) <= REACH + 0.9 + extra; }
  breakBlock(p, x, y, z, extra = 0) {
    const t = this.get(x, y, z);
    if (!this.breakable(t, p.team) || !this.inReach(p, x, y, z, extra)) return false;
    if (isBed(t)) { this.breakBed(t - B.BED, p); return true; }
    this.set(x, y, z, 0);
    this.ev({ k: 'break', x, y, z, t });
    return true;
  }
  breakBed(team, by) {
    const bed = this.beds[team]; if (!bed || !bed.alive) return;
    bed.alive = false; for (const c of bed.cells) this.set(c[0], c[1], c[2], 0);
    if (by) by.bedsBroken++;
    this.ev({ k: 'bed', team, by: by && by.id });
    this.checkWin();
  }
  canPlace(x, y, z) {
    if (y > MAX_Y || y < VOID + 4 || this.solid(x, y, z) || this.idx(x, y, z) < 0) return false;
    for (const o of this.players) if (o.alive && x + 1 > o.x - PW && x < o.x + PW && z + 1 > o.z - PW && z < o.z + PW && y + 1 > o.y && y < o.y + PH) return false;
    // never right on top of a generator
    for (const gn of this.gens) if (Math.floor(gn.x) === x && Math.floor(gn.z) === z && (y === Math.floor(gn.y) || y === Math.floor(gn.y) + 1)) return false;
    return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => this.solid(x + a, y + b, z + c));
  }
  place(p, x, y, z, key = p.held, extra = 0) {
    const t = key === 'wool' ? B.WOOL : key === 'plank' ? B.PLANK : key === 'end' ? B.END : 0;
    if (!t || !p.alive || p.inv[key] <= 0 || !this.canPlace(x, y, z) || !this.inReach(p, x, y, z, extra)) return false;
    p.inv[key]--;
    this.set(x, y, z, t === B.WOOL ? B.WOOL + p.team : t);
    this.ev({ k: 'place', x, y, z });
    return true;
  }
  // where a click would put a block. Java: on the face you're aiming at. Bedrock also lets you place
  // in front of the block you stand on while looking down past its edge (no sneaking needed)
  placeSpot(p, bridge = 'java') {
    const h = this.target(p);
    if (h && this.canPlace(h.px, h.py, h.pz)) return [h.px, h.py, h.pz];
    if (bridge !== 'bedrock' || p.pitch > -0.25) return null;
    const by = Math.floor(p.y - 0.05), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const ax = Math.abs(fx) >= Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)];
    // the cell under you, then one step at a time in the direction you face
    let cx = Math.floor(p.x), cz = Math.floor(p.z);
    if (!this.solid(cx, by, cz)) { cx = Math.floor(p.x - fx * 0.35); cz = Math.floor(p.z - fz * 0.35); }
    for (let k = 1; k <= 2; k++) { const x = cx + ax[0] * k, z = cz + ax[1] * k; if (!this.solid(x, by, z)) return this.canPlace(x, by, z) ? [x, by, z] : null; }
    return null;
  }
  eat(p) {
    if (!p.alive || p.inv.apple <= 0 || p.hp >= HP) return false;
    p.inv.apple--; p.hp = Math.min(HP, p.hp + 8); this.ev({ k: 'eat', id: p.id }); return true;
  }
  atHome(p) { const T = this.teams[p.team]; return Math.hypot(p.x - T.x - 0.5, p.z - T.z - 0.5) < 10 && p.y > TOP - 2; }
  buy(p, id) {
    const it = SHOP.find(s => s.id === id); if (!it || !p.alive || !this.atHome(p)) return false;
    if (it.ok && !it.ok(p)) return false;
    for (const r in it.cost) if (p.inv[r] < it.cost[r]) return false;
    for (const r in it.cost) p.inv[r] -= it.cost[r];
    it.give(p); this.ev({ k: 'buy', id: p.id, item: id });
    return true;
  }
  checkWin() {
    if (this.over) return;
    const live = this.teams.map((_, ti) => this.players.some(p => p.team === ti && !p.out && (p.alive || this.beds[ti].alive)));
    if (live.filter(Boolean).length <= 1) { this.over = true; this.winner = live.indexOf(true); this.ev({ k: 'win', team: this.winner }); }
  }
  P(id) { return this.players.find(p => p.id === id) || null; }
  timeUp() {
    const score = ti => this.players.filter(p => p.team === ti && !p.out).length * 1000 + this.players.filter(p => p.team === ti).reduce((a, p) => a + p.kills, 0);
    let best = -1, bs = -1; this.teams.forEach((_, ti) => { const v = score(ti); if (v > bs) { bs = v; best = ti; } });
    this.over = true; this.winner = best; this.ev({ k: 'win', team: best, time: true });
  }

  // ---------------- the clock ----------------
  update(dt) {
    if (this.over) return;
    this.t += dt;
    if (this.t >= LIMIT) { this.timeUp(); return; }
    if (this.t >= SUDDEN && !this.sudden) { this.sudden = true; this.ev({ k: 'sudden' }); this.teams.forEach((_, ti) => this.breakBed(ti, null)); }
    for (const gn of this.gens) {
      gn.t -= dt;
      const pile = this.pileAt(gn);
      if (gn.kind === 'forge') {
        if (gn.t <= 0) { gn.t = GEN.iron; if (pile.iron < 48) pile.iron++; }
        gn.tg = (gn.tg || 0) - dt; if (gn.tg <= 0) { gn.tg = GEN.gold; if (pile.gold < 12) pile.gold++; }
      } else if (gn.kind === 'diamond' && gn.t <= 0) { gn.t = GEN.diamond; if (pile.diamond < 4) pile.diamond++; }
      else if (gn.kind === 'emerald' && gn.t <= 0) { gn.t = GEN.emerald; if (pile.emerald < 3) pile.emerald++; }
    }
    for (const p of this.players) {
      if (p.bot && p.alive) this.think(p, dt);
      if (!p.alive) {
        if (!p.out && p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) { this.spawn(p); this.ev({ k: 'respawn', id: p.id }); } }
        continue;
      }
      this.tickTimers(p, dt);
      if (p.hurtT > 4 && p.hp < HP) p.hp = Math.min(HP, p.hp + dt * 0.5); // slow natural regeneration
      if (!p.remote) this.physics(p, dt); // (online players move themselves and report where they are)
      if (p.y < VOID) { this.kill(p, null, 'fell into the void'); continue; }
      for (const pile of this.piles) {
        if (Math.hypot(pile.x - p.x, pile.z - p.z) > 1.4 || Math.abs(pile.y - p.y) > 1.6) continue;
        let got = false; for (const r of RES) if (pile[r]) { p.inv[r] += pile[r]; pile[r] = 0; got = true; }
        if (got) this.ev({ k: 'pickup', id: p.id });
      }
    }
  }
  pileAt(gn) { if (!gn.pile) { gn.pile = { x: gn.x, y: gn.y, z: gn.z, kind: gn.kind, iron: 0, gold: 0, diamond: 0, emerald: 0 }; this.piles.push(gn.pile); } return gn.pile; }

  // ---------------- bots ----------------
  enemiesNear(p, r) { return this.players.filter(o => o.alive && o.team !== p.team && Math.hypot(o.x - p.x, o.z - p.z) < r && Math.abs(o.y - p.y) < 4); }
  face(p, x, y, z, dt, rate = 10) {
    const want = Math.atan2(x - p.x, z - p.z); p.yaw += angDiff(p.yaw, want) * Math.min(1, dt * rate);
    const d = Math.hypot(x - p.x, z - p.z), wp = Math.atan2(y - (p.y + EYE), Math.max(0.01, d)); p.pitch += (wp - p.pitch) * Math.min(1, dt * rate);
  }
  buyWhatYouCan(p) {
    const order = [p.inv.wool < 32 && 'wool', 'sword1', 'armor1', 'sword2', 'armor2', 'pick1', p.inv.apple < 2 && 'apple', 'sword3', 'armor3', p.inv.wool < 64 && 'wool', p.inv.end < 12 && p.inv.iron > 40 && 'end'];
    for (const id of order) if (id && this.buy(p, id)) return true;
    return false;
  }
  bedCover(ti) {
    const out = [], cells = this.beds[ti].cells, has = (x, y, z) => cells.some(c => c[0] === x && c[1] === y && c[2] === z);
    for (const [x, y, z] of cells) for (const [a, b, c] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { const q = [x + a, y + b, z + c]; if (!has(...q) && !out.some(o => o[0] === q[0] && o[1] === q[1] && o[2] === q[2])) out.push(q); }
    return out;
  }
  // walk along a straight line toward (gx, gz) at island level, laying a bridge where the ground runs out
  travel(p, gx, gz, dt) {
    const d = Math.hypot(gx - p.x, gz - p.z);
    this.face(p, gx, p.y + EYE, gz, dt, 8);
    p.pitch = -0.75; // looking down at the edge, like a real bridger
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, ahead = { x: p.x + f.x * 0.75, z: p.z + f.z * 0.75 }, below = Math.floor(p.y - 0.05);
    p.move.f = d > 0.6 ? 1 : 0; p.move.s = 0; p.sneak = false; p.sprint = false; p.move.jump = false;
    if (p.ground && !this.supported(ahead.x, p.y, ahead.z)) {
      const cx = Math.floor(ahead.x), cz = Math.floor(ahead.z);
      p.sneak = true;
      const slot = p.inv.wool > 0 ? 'wool' : p.inv.plank > 0 ? 'plank' : p.inv.end > 0 ? 'end' : null;
      if (!slot) { p.move.f = 0; return 'noblocks'; }
      p.held = slot;
      if (!this.place(p, cx, below, cz, slot)) { const sx = Math.floor(p.x), sz = Math.floor(p.z); if (!this.place(p, cx, below, sz, slot)) this.place(p, sx, below, cz, slot); }
    }
    if (p.ground && this.hitsBox(ahead.x, p.y, ahead.z) && !this.hitsBox(ahead.x, p.y + 1.05, ahead.z)) p.move.jump = true;
    if (Math.hypot(p.x - p.ai.lx, p.z - p.ai.lz) < dt * 0.4 && p.move.f) p.ai.stuck += dt; else p.ai.stuck = 0;
    p.ai.lx = p.x; p.ai.lz = p.z;
    if (p.ai.stuck > 0.6) {
      p.pitch = 0; const h = this.target(p);
      if (h && this.breakable(this.get(h.x, h.y, h.z), p.team)) { p.move.f = 0; p.held = p.pick ? 'pick' : 'sword'; this.mineTick(p, dt, true); }
      else p.move.jump = true;
      if (p.ai.stuck > 4) { p.ai.mode = 'home'; p.ai.stuck = 0; p.ai.trail = []; }
    }
    return d < 1.2 ? 'there' : 'going';
  }
  think(p, dt) {
    const A = p.ai, T = this.teams[p.team], bed = this.beds[p.team];
    if (this.atHome(p)) A.trail = [];
    else if (p.ground) { const last = A.trail[A.trail.length - 1]; if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 1.5) A.trail.push({ x: p.x, z: p.z }); }
    A.think -= dt; A.wait -= dt;
    p.mine = p.mine && p.mine.bot ? p.mine : null;
    const foe = this.enemiesNear(p, 8).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (p.hp < 9 && p.inv.apple > 0 && Math.random() < dt * 2) this.eat(p);
    if (foe) {
      p.held = 'sword';
      const d = Math.hypot(foe.x - p.x, foe.z - p.z);
      this.face(p, foe.x + foe.vx * 0.1, foe.y + 1.2, foe.z + foe.vz * 0.1, dt, 9 * this.diffK);
      p.move.f = d > 2.2 ? 1 : 0.2; p.sprint = d > 2.6; p.sneak = false;
      if (Math.random() < dt * 0.6) A.strafe = -A.strafe;
      p.move.s = d < 4 ? A.strafe * 0.7 : 0;
      const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
      if (p.ground && !this.supported(p.x + f.x * 0.8, p.y, p.z + f.z * 0.8)) { p.move.f = 0; p.move.s = 0; p.sneak = true; }
      p.move.jump = p.ground && Math.random() < dt * 0.8;
      // 1.8: click away (about 7 a second at normal); 1.9: swing when the sword has recharged
      if (d < 3.2) {
        if (this.pvp === '1.8') { if (Math.random() < dt * 7 * this.diffK) this.attack(p); }
        else if (this.charge(p) >= 0.92 + Math.random() * 0.08 && Math.random() < dt * 10 * this.diffK) this.attack(p);
      }
      return;
    }
    p.sprint = false;
    if (bed.alive) {
      const raider = this.players.find(o => o.alive && o.team !== p.team && Math.hypot(o.x - bed.cells[0][0], o.z - bed.cells[0][2]) < 10);
      if (raider && this.atHome(p)) { this.travel(p, raider.x, raider.z, dt); return; }
    }
    if (A.think <= 0) {
      A.think = 0.5;
      if (this.atHome(p)) this.buyWhatYouCan(p);
      const blocks = p.inv.wool + p.inv.plank + p.inv.end;
      if (A.mode === 'home' && this.atHome(p)) A.mode = 'gather';
      if (A.mode === 'gather') {
        if (bed.alive && blocks >= 6 && this.bedCover(p.team).some(c => !this.solid(...c))) A.mode = 'cover';
        else if ((blocks >= 24 && A.wait <= 0) || (blocks >= 12 && this.t > 240) || (this.sudden && blocks >= 8)) {
          const beds = this.teams.map((_, ti) => ti).filter(ti => ti !== p.team && this.beds[ti].alive && this.players.some(o => o.team === ti && !o.out));
          const foesAlive = this.players.filter(o => o.alive && o.team !== p.team);
          const near = arr => arr.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
          if (Math.random() < 0.25 && p.sword < 3) { const g = near(this.gens.filter(x => x.kind === 'diamond'))[0]; A.goal = { x: g.x, z: g.z, kind: 'loot' }; }
          else if (beds.length) {
            // the nearest beds are the likeliest targets
            const byDist = beds.map(ti => ({ ti, d: Math.hypot(this.teams[ti].x - p.x, this.teams[ti].z - p.z) })).sort((a, b) => a.d - b.d);
            const ti = byDist[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * byDist.length)].ti, c2 = this.beds[ti].cells[1], dir = this.beds[ti].dir;
            A.goal = { x: c2[0] + 0.5 + dir[0] * 1.6, z: c2[2] + 0.5 + dir[1] * 1.6, kind: 'bed', team: ti };
          } else if (foesAlive.length) { const o = near(foesAlive)[0]; A.goal = { x: o.x, z: o.z, kind: 'hunt', id: o.id }; }
          if (A.goal) A.mode = 'raid';
        }
      }
    }
    if (A.mode === 'cover') {
      const todo = this.bedCover(p.team).filter(c => !this.solid(...c));
      if (!todo.length || p.inv.wool + p.inv.plank + p.inv.end === 0) { A.mode = 'gather'; return; }
      const c = todo[0], d = Math.hypot(c[0] + 0.5 - p.x, c[2] + 0.5 - p.z);
      if (d > 3.2) { this.travel(p, c[0] + 0.5 - this.beds[p.team].dir[1] * 1.5 + this.beds[p.team].dir[0] * 1.5, c[2] + 0.5 - this.beds[p.team].dir[0] * 1.5 + this.beds[p.team].dir[1] * 1.5, dt); return; }
      p.move.f = 0; p.move.s = 0;
      this.face(p, c[0] + 0.5, c[1] + 0.5, c[2] + 0.5, dt, 12);
      if (Math.random() < dt * 4) { const slot = p.inv.end > 0 && c[1] > TOP ? 'end' : p.inv.wool > 0 ? 'wool' : p.inv.plank > 0 ? 'plank' : 'end'; p.held = slot; this.place(p, c[0], c[1], c[2], slot); }
      return;
    }
    if (A.mode === 'raid' && A.goal) {
      if (A.goal.kind === 'hunt') { const o = this.P(A.goal.id); if (!o || !o.alive) { A.mode = 'home'; return; } A.goal.x = o.x; A.goal.z = o.z; }
      if (A.goal.kind === 'bed' && !this.beds[A.goal.team].alive) { A.mode = 'home'; A.goal = null; return; }
      if (A.goal.kind === 'bed') {
        const cs = this.beds[A.goal.team].cells, c = cs[Math.hypot(cs[0][0] - p.x, cs[0][2] - p.z) < Math.hypot(cs[1][0] - p.x, cs[1][2] - p.z) ? 0 : 1], d = Math.hypot(c[0] + 0.5 - p.x, c[2] + 0.5 - p.z);
        if (d >= 3.2) { if (this.travel(p, A.goal.x, A.goal.z, dt) === 'noblocks') A.mode = 'home'; return; }
        A.stuck = 0; A.lx = p.x; A.lz = p.z; p.sneak = false; p.move.s = 0; p.move.jump = false; p.move.f = 0;
        this.face(p, c[0] + 0.5, c[1] + 0.5, c[2] + 0.5, dt, 14);
        const h = this.target(p);
        if (h) { const t = this.get(h.x, h.y, h.z); if (this.breakable(t, p.team)) { p.held = p.pick ? 'pick' : 'sword'; this.mineTick(p, dt, true); if (p.mine) p.mine.bot = true; } else { p.move.jump = p.ground; p.move.f = 0.6; } }
        else p.move.f = 0.5;
        return;
      }
      const r = this.travel(p, A.goal.x, A.goal.z, dt);
      if (r === 'noblocks') { A.mode = 'home'; return; }
      if (r === 'there' && A.goal.kind === 'loot') { A.wait = rnd(4, 9); A.goal = { x: T.spawn.x, z: T.spawn.z, kind: 'back' }; }
      else if (r === 'there' && A.goal.kind === 'back') { A.mode = 'gather'; A.goal = null; A.wait = rnd(10, 25) / this.diffK; }
      return;
    }
    if (A.mode === 'home' || (A.mode === 'gather' && !this.atHome(p))) {
      if (A.trail.length) { const w = A.trail[A.trail.length - 1]; this.face(p, w.x, p.y + EYE, w.z, dt, 10); p.pitch = -0.3; p.move.f = 1; p.move.s = 0; p.sneak = false; p.move.jump = false; if (Math.hypot(w.x - p.x, w.z - p.z) < 0.7) A.trail.pop(); return; }
      const r = this.travel(p, T.spawn.x, T.spawn.z, dt); if (r === 'there' || this.atHome(p)) { A.mode = 'gather'; A.wait = rnd(10, 20) / this.diffK; } return;
    }
    const gn = this.gens.find(g => g.kind === 'forge' && g.team === p.team);
    if (Math.hypot(gn.x - p.x, gn.z - p.z) > 0.8) this.travel(p, gn.x, gn.z, dt); else { p.move.f = 0; p.move.s = 0; p.move.jump = false; p.yaw += dt * 0.3; }
  }

  // ---------------- online: what the host sends ----------------
  snapshot() {
    const r = v => Math.round(v * 100) / 100;
    return {
      t: r(this.t), sd: !!this.sudden, beds: this.beds.map(b => b.alive ? 1 : 0),
      piles: this.piles.map(q => [q.iron, q.gold, q.diamond, q.emerald]), gens: this.gens.map(g => r(g.t)),
      p: this.players.map(p => [p.id, r(p.x), r(p.y), r(p.z), r(p.yaw), r(p.pitch), r(p.vx), r(p.vz), r(p.hp), (p.alive ? 1 : 0) | (p.out ? 2 : 0) | (p.sneak ? 4 : 0) | (p.sprint ? 8 : 0) | (p.ground ? 16 : 0),
        Object.keys(ITEMS).indexOf(p.held), p.sword, p.armor, p.pick, p.tp, r(p.respawn), r(Math.min(9, p.atkT)), INV.map(k => p.inv[k]), p.kills, p.finals, p.bedsBroken, p.deaths]),
    };
  }
  applySnapshot(s, myId) {
    this.t = s.t; this.sudden = s.sd;
    s.beds.forEach((a, i) => { if (this.beds[i]) this.beds[i].alive = !!a; });
    this.gens.forEach((g, i) => { if (s.gens[i] != null) g.t = s.gens[i]; this.pileAt(g); });
    s.piles.forEach((a, i) => { const q = this.piles[i]; if (q) [q.iron, q.gold, q.diamond, q.emerald] = a; });
    for (const e of s.p) {
      const p = this.P(e[0]); if (!p) continue;
      const [, x, y, z, yaw, pitch, vx, vz, hp, fl, slot, sword, armor, pick, tp, respawn, atkT, inv, kills, finals, beds, deaths] = e;
      const wasAlive = p.alive;
      Object.assign(p, { hp, alive: !!(fl & 1), out: !!(fl & 2), sword, armor, pick, respawn, kills, finals, bedsBroken: beds, deaths });
      INV.forEach((k, i) => { p.inv[k] = inv[i]; });
      if (p.id === myId) {
        // our own position is ours, unless the host moved us (a respawn)
        if (tp !== p.tp || (!wasAlive && p.alive)) { p.tp = tp; p.x = x; p.y = y; p.z = z; p.vx = p.vy = p.vz = 0; p.yaw = yaw; p.pitch = 0; }
        continue;
      }
      p.tx = x; p.ty = y; p.tz = z; p.yaw = yaw; p.pitch = pitch; p.vx = vx; p.vz = vz; p.sneak = !!(fl & 4); p.sprint = !!(fl & 8); p.ground = !!(fl & 16); p.held = Object.keys(ITEMS)[slot] || 'sword'; p.atkT = atkT;
      if (p.tp !== tp || !wasAlive) { p.x = x; p.y = y; p.z = z; p.tp = tp; }
    }
  }
}
