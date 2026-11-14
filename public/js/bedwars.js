// Nightcraft Bedwars: the block world, the rules and the bots (no rendering here; see bedview.js).
// Four teams on floating islands. Each island has a bed and a forge (iron, gold). Buy blocks at the
// shop, bridge across the void, break the other teams' beds. A player whose bed is gone does not
// come back. The last team standing wins.
// Coordinates: 1 unit = 1 block = 1 metre. Cell (x, y, z) fills [x, x+1) x [y, y+1) x [z, z+1).

export const B = { AIR: 0, STONE: 1, GRASS: 2, DIRT: 3, LOG: 4, PLANKMAP: 5, GLOW: 6, OBSID: 7, WOOL: 10, PLANK: 20, END: 21, BED: 30 };
export const TEAMS = [
  { name: 'Red', color: 0xd8342a, css: '#ff5a4a', x: 0, z: -30 },
  { name: 'Blue', color: 0x2a5ad8, css: '#5a8aff', x: 0, z: 30 },
  { name: 'Green', color: 0x2aa83a, css: '#4ade5a', x: -30, z: 0 },
  { name: 'Yellow', color: 0xe0c020, css: '#ffe04a', x: 30, z: 0 },
];
export const TOP = 10;            // island surfaces: you stand at y = 10
export const VOID = -14;          // fall below this and you are gone
export const MAX_Y = 30;
const NX = 128, NY = 64, NZ = 128, OX = 64, OY = 16, OZ = 64;
export const HP = 20;
export const SWORDS = [{ name: 'Wooden Sword', dmg: 4 }, { name: 'Stone Sword', dmg: 5 }, { name: 'Iron Sword', dmg: 6 }, { name: 'Diamond Sword', dmg: 7.5 }];
export const ARMOR = [{ name: 'No armour', red: 0 }, { name: 'Chainmail', red: 0.25 }, { name: 'Iron Armour', red: 0.42 }, { name: 'Diamond Armour', red: 0.6 }];
export const PICKS = [{ name: 'No pickaxe', mul: 1 }, { name: 'Iron Pickaxe', mul: 1.9 }, { name: 'Diamond Pickaxe', mul: 3.2 }];
export const HARD = { [B.WOOL]: 0.45, [B.PLANK]: 1.5, [B.END]: 2.8, [B.BED]: 1.3 };
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
export const HOTBAR = ['sword', 'wool', 'plank', 'end', 'apple'];
export const blockOfSlot = s => (s === 1 ? B.WOOL : s === 2 ? B.PLANK : s === 3 ? B.END : 0);
const PW = 0.3, PH = 1.8, EYE = 1.62, REACH = 5, HIT = 3.4, GRAV = 28, JUMP = 8.6, WALK = 4.3, SNEAK = 1.3, SPRINT = 5.6;
const SUDDEN = 600; // after ten minutes every bed breaks
const LIMIT = 900;  // after fifteen, the team with the most players left (then kills) wins
const rnd = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class BedWorld {
  constructor(roster, opts = {}) {
    this.g = new Uint8Array(NX * NY * NZ);
    this.t = 0; this.over = false; this.winner = -1; this.events = []; this.dirty = true; this.opts = opts;
    this.diff = opts.difficulty === 'easy' ? 0.55 : opts.difficulty === 'hard' ? 1.2 : 0.85;
    this.beds = TEAMS.map(() => ({ alive: true, cells: [] }));
    this.gens = []; this.piles = [];
    this.build();
    this.players = roster.map((r, i) => {
      const p = { id: r.id, name: r.name, team: r.team, char: r.char, role: r.role, skin: r.skin, bot: !!r.bot, x: 0, y: TOP, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0,
        hp: HP, alive: true, out: false, respawn: 0, ground: false, sneak: false, sprint: false, inv: { iron: 0, gold: 0, diamond: 0, emerald: 0, wool: 0, plank: 0, end: 0, apple: 0 },
        sword: 0, armor: 0, pick: 0, slot: 0, atkCd: 0, atkT: 9, hurtT: 9, inv0: 0, mine: null, kills: 0, finals: 0, bedsBroken: 0, deaths: 0, move: { f: 0, s: 0, jump: false }, lastHit: null };
      if (p.bot) p.ai = { mode: 'gather', trail: [], think: rnd(0, 0.5), goal: null, tgt: null, wait: rnd(15, 35) / this.diff, strafe: 1, stuck: 0, lx: 0, lz: 0 };
      this.spawn(p);
      return p;
    });
  }
  ev(e) { this.events.push(e); }
  takeEvents() { const e = this.events; this.events = []; return e; }
  idx(x, y, z) { x += OX; y += OY; z += OZ; if (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ) return -1; return x + z * NX + y * NX * NZ; }
  get(x, y, z) { const i = this.idx(Math.floor(x), Math.floor(y), Math.floor(z)); return i < 0 ? 0 : this.g[i]; }
  set(x, y, z, t) { const i = this.idx(x, y, z); if (i >= 0) { this.g[i] = t; this.dirty = true; } }
  solid(x, y, z) { return this.get(x, y, z) !== 0; }
  // every solid cell (for the renderer): [x, y, z, type]
  cells() { const out = []; for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) { const t = this.g[x + z * NX + y * NX * NZ]; if (t) out.push(x - OX, y - OY, z - OZ, t); } return out; }

  // ---------------- the map ----------------
  build() {
    const S = this.set.bind(this);
    const disc = (cx, cz, r, y0, y1, top, under) => {
      for (let x = -r; x <= r; x++) for (let z = -r; z <= r; z++) {
        if (x * x + z * z > r * r + r * 0.6) continue;
        for (let y = y0; y <= y1; y++) S(cx + x, y, cz + z, y === y1 ? top : under);
        // a rough rocky underside
        const d = Math.sqrt(x * x + z * z) / r, extra = Math.floor((1 - d) * (r * 0.7)) + ((x * 7 + z * 13) & 1);
        for (let y = y0 - 1; y >= y0 - extra; y--) S(cx + x, y, cz + z, B.STONE);
      }
    };
    TEAMS.forEach((T, ti) => {
      disc(T.x, T.z, 6, TOP - 3, TOP - 1, B.GRASS, B.DIRT);
      // the bed: two cells pointing toward the middle, off to one side (the way out stays clear)
      const ix = -Math.sign(T.x) || 0, iz = -Math.sign(T.z) || 0, bx = T.x + iz * 3, bz = T.z + ix * 3;
      const cells = [[bx, TOP, bz], [bx + ix, TOP, bz + iz]];
      for (const c of cells) S(c[0], c[1], c[2], B.BED + ti);
      this.beds[ti].cells = cells;
      // forge at the back edge (iron and gold), the spawn between, the shopkeeper beside
      const fx = T.x - ix * 4, fz = T.z - iz * 4;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) S(fx + a, TOP - 1, fz + b, B.OBSID);
      this.gens.push({ kind: 'forge', team: ti, x: fx + 0.5, y: TOP, z: fz + 0.5, t: 0, tg: 0 });
      T.spawn = { x: T.x + 0.5 - ix * 1, z: T.z + 0.5 - iz * 1, yaw: Math.atan2(ix, iz) };
      T.shop = { x: T.x + 0.5 - iz * 4, z: T.z + 0.5 - ix * 4 };
      S(Math.floor(T.shop.x), TOP - 1, Math.floor(T.shop.z), B.PLANKMAP);
    });
    // diamond islands on the diagonals
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const cx = sx * 21, cz = sz * 21;
      disc(cx, cz, 3, TOP - 2, TOP - 1, B.GRASS, B.DIRT);
      S(cx, TOP - 1, cz, B.GLOW);
      this.gens.push({ kind: 'diamond', x: cx + 0.5, y: TOP, z: cz + 0.5, t: 10 });
    }
    // the middle: emeralds, a little hill and a tree
    disc(0, 0, 7, TOP - 3, TOP - 1, B.GRASS, B.DIRT);
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) + Math.abs(z) < 4) S(x, TOP, z, B.STONE);
    S(0, TOP, 0, B.GLOW);
    this.gens.push({ kind: 'emerald', x: 0.5, y: TOP + 1, z: 0.5, t: 20 });
    for (let y = TOP; y < TOP + 4; y++) S(5, y, -4, B.LOG);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let y = TOP + 3; y < TOP + 6; y++) if (Math.abs(a) + Math.abs(b) + (y - TOP - 3) < 4 && !(a === 0 && b === 0 && y < TOP + 4)) S(5 + a, y, -4 + b, B.GRASS);
    this.dirty = true;
  }

  spawn(p) {
    const T = TEAMS[p.team], k = this.players ? this.players.filter(o => o.team === p.team).indexOf(p) : 0;
    p.x = T.spawn.x + (k % 2) * 0.8 - 0.4; p.z = T.spawn.z + (k > 1 ? 0.8 : 0); p.y = TOP + 0.01; p.vx = p.vy = p.vz = 0;
    p.yaw = T.spawn.yaw; p.pitch = 0; p.hp = HP; p.alive = true; p.respawn = 0; p.mine = null; p.inv0 = 1.5; p.lastHit = null;
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
  look(p) { const cp = Math.cos(p.pitch); return { ox: p.x, oy: p.y + EYE, oz: p.z, dx: Math.sin(p.yaw) * cp, dy: Math.sin(p.pitch), dz: Math.cos(p.yaw) * cp }; }
  target(p) { const L = this.look(p); return this.ray(L.ox, L.oy, L.oz, L.dx, L.dy, L.dz, REACH); }
  breakable(t, team) { return t === B.WOOL || (t >= B.WOOL && t < B.WOOL + 4) || t === B.PLANK || t === B.END || (t >= B.BED && t < B.BED + 4 && t - B.BED !== team); }

  // ---------------- actions ----------------
  // a player in front of p, within reach of their sword
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
  attack(p) {
    if (!p.alive || p.atkCd > 0) return false;
    const o = this.meleeTarget(p);
    p.atkT = 0;
    if (!o) return false;
    p.atkCd = 0.5;
    this.damage(o, p, SWORDS[p.sword].dmg * (p.vy < -1 && !p.ground ? 1.4 : 1));
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) }, kb = p.sprint ? 9 : 6.5;
    o.vx += f.x * kb; o.vz += f.z * kb; o.vy = Math.max(o.vy, 5.2); o.ground = false;
    return true;
  }
  damage(o, by, dmg) {
    if (!o.alive || o.inv0 > 0) return;
    const red = ARMOR[o.armor].red;
    o.hp -= dmg * (1 - red); o.hurtT = 0; o.lastHit = by ? { id: by.id, t: this.t } : o.lastHit;
    this.ev({ k: 'hit', id: o.id, by: by && by.id, x: o.x, y: o.y, z: o.z });
    if (o.hp <= 0) this.kill(o, by);
  }
  kill(o, by, why = 'killed') {
    if (!o.alive) return;
    if (!by && o.lastHit && this.t - o.lastHit.t < 8) { by = this.P(o.lastHit.id); why = 'knocked into the void'; }
    o.alive = false; o.hp = 0; o.deaths++; o.mine = null;
    const final = !this.beds[o.team].alive;
    if (by && by !== o) {
      by.kills++; if (final) by.finals++;
      for (const r of RES) { by.inv[r] += o.inv[r]; }
    }
    for (const r of RES) o.inv[r] = 0;
    if (final) o.out = true; else o.respawn = 5;
    this.ev({ k: 'death', id: o.id, by: by && by.id, why, final, x: o.x, y: o.y, z: o.z });
    this.checkWin();
  }
  mineTick(p, dt, holding) {
    if (!holding || !p.alive) { p.mine = null; return; }
    const h = this.target(p);
    if (!h) { p.mine = null; return; }
    const t = this.get(h.x, h.y, h.z);
    if (!this.breakable(t, p.team)) { p.mine = { x: h.x, y: h.y, z: h.z, f: 0, no: true }; return; }
    if (!p.mine || p.mine.x !== h.x || p.mine.y !== h.y || p.mine.z !== h.z) p.mine = { x: h.x, y: h.y, z: h.z, f: 0 };
    const base = t >= B.BED && t < B.BED + 4 ? HARD[B.BED] : t >= B.WOOL && t < B.WOOL + 4 ? HARD[B.WOOL] : HARD[t] || 1;
    p.mine.f += dt / (base / PICKS[p.pick].mul);
    if (p.mine.f >= 1) { this.breakBlock(p, h.x, h.y, h.z); p.mine = null; }
  }
  breakBlock(p, x, y, z) {
    const t = this.get(x, y, z);
    if (!this.breakable(t, p.team)) return;
    if (t >= B.BED && t < B.BED + 4) { this.breakBed(t - B.BED, p); return; }
    this.set(x, y, z, 0);
    this.ev({ k: 'break', x, y, z, t });
  }
  breakBed(team, by) {
    const bed = this.beds[team]; if (!bed.alive) return;
    bed.alive = false; for (const c of bed.cells) this.set(c[0], c[1], c[2], 0);
    if (by) by.bedsBroken++;
    this.ev({ k: 'bed', team, by: by && by.id });
    this.checkWin();
  }
  canPlace(x, y, z) {
    if (y > MAX_Y || y < VOID + 4 || this.solid(x, y, z)) return false;
    for (const o of this.players) if (o.alive && x + 1 > o.x - PW && x < o.x + PW && z + 1 > o.z - PW && z < o.z + PW && y + 1 > o.y && y < o.y + PH) return false;
    // never right on top of the shop spot or a generator
    for (const gn of this.gens) if (Math.floor(gn.x) === x && Math.floor(gn.z) === z && (y === Math.floor(gn.y) || y === Math.floor(gn.y) + 1)) return false;
    return true;
  }
  place(p, x, y, z, slot = p.slot) {
    const t = blockOfSlot(slot), key = HOTBAR[slot];
    if (!t || !p.alive || p.inv[key] <= 0 || !this.canPlace(x, y, z)) return false;
    const L = this.look(p); if (Math.hypot(x + 0.5 - L.ox, y + 0.5 - L.oy, z + 0.5 - L.oz) > REACH + 0.9) return false;
    // it has to touch something
    if (![[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => this.solid(x + a, y + b, z + c))) return false;
    p.inv[key]--;
    this.set(x, y, z, t === B.WOOL ? B.WOOL + p.team : t);
    this.ev({ k: 'place', x, y, z });
    return true;
  }
  placeAtLook(p) {
    const h = this.target(p); if (!h) return false;
    return this.place(p, h.px, h.py, h.pz);
  }
  eat(p) {
    if (!p.alive || p.inv.apple <= 0 || p.hp >= HP) return false;
    p.inv.apple--; p.hp = Math.min(HP, p.hp + 8); this.ev({ k: 'eat', id: p.id }); return true;
  }
  atHome(p) { const T = TEAMS[p.team]; return Math.hypot(p.x - T.x - 0.5, p.z - T.z - 0.5) < 8.5 && p.y > TOP - 2; }
  buy(p, id) {
    const it = SHOP.find(s => s.id === id); if (!it || !p.alive) return false;
    if (it.ok && !it.ok(p)) return false;
    for (const r in it.cost) if (p.inv[r] < it.cost[r]) return false;
    for (const r in it.cost) p.inv[r] -= it.cost[r];
    it.give(p); this.ev({ k: 'buy', id: p.id, item: id });
    return true;
  }
  checkWin() {
    if (this.over) return;
    const live = TEAMS.map((_, ti) => this.players.some(p => p.team === ti && !p.out && (p.alive || this.beds[ti].alive)));
    const n = live.filter(Boolean).length;
    if (n <= 1) { this.over = true; this.winner = live.indexOf(true); this.ev({ k: 'win', team: this.winner }); }
  }
  P(id) { return this.players.find(p => p.id === id) || null; }
  timeUp() {
    const score = ti => this.players.filter(p => p.team === ti && !p.out).length * 1000 + this.players.filter(p => p.team === ti).reduce((a, p) => a + p.kills, 0);
    let best = -1, bs = -1; TEAMS.forEach((_, ti) => { const v = score(ti); if (v > bs) { bs = v; best = ti; } });
    this.over = true; this.winner = best; this.ev({ k: 'win', team: best, time: true });
  }

  // ---------------- the clock ----------------
  update(dt) {
    if (this.over) return;
    this.t += dt;
    if (this.t >= LIMIT) { this.timeUp(); return; }
    if (this.t >= SUDDEN && !this.sudden) { this.sudden = true; this.ev({ k: 'sudden' }); TEAMS.forEach((_, ti) => this.breakBed(ti, null)); }
    // generators
    for (const gn of this.gens) {
      gn.t -= dt;
      const pile = this.pileAt(gn);
      if (gn.kind === 'forge') {
        if (gn.t <= 0) { gn.t = 1.1; if (pile.iron < 48) pile.iron++; }
        gn.tg = (gn.tg || 0) - dt; if (gn.tg <= 0) { gn.tg = 7; if (pile.gold < 12) pile.gold++; }
      } else if (gn.kind === 'diamond' && gn.t <= 0) { gn.t = 28; if (pile.diamond < 4) pile.diamond++; }
      else if (gn.kind === 'emerald' && gn.t <= 0) { gn.t = 50; if (pile.emerald < 3) pile.emerald++; }
    }
    for (const p of this.players) {
      if (p.bot && p.alive) this.think(p, dt);
      if (!p.alive) {
        if (!p.out && p.respawn > 0) { p.respawn -= dt; if (p.respawn <= 0) { this.spawn(p); this.ev({ k: 'respawn', id: p.id }); } }
        continue;
      }
      p.atkCd = Math.max(0, p.atkCd - dt); p.atkT += dt; p.hurtT += dt; p.inv0 = Math.max(0, p.inv0 - dt);
      if (p.hurtT > 4 && p.hp < HP) p.hp = Math.min(HP, p.hp + dt * 0.5); // slow natural regeneration
      this.physics(p, dt);
      if (p.y < VOID) { this.kill(p, null, 'fell into the void'); continue; }
      // walk over a pile to pick it up
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
  // the cells around a team's bed that should be covered with blocks
  bedCover(ti) {
    const out = [], cells = this.beds[ti].cells, has = (x, y, z) => cells.some(c => c[0] === x && c[1] === y && c[2] === z);
    for (const [x, y, z] of cells) for (const [a, b, c] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { const q = [x + a, y + b, z + c]; if (!has(...q) && !out.some(o => o[0] === q[0] && o[1] === q[1] && o[2] === q[2])) out.push(q); }
    return out;
  }
  // walk along a straight line toward (gx, gz) at island level, laying a bridge where the ground runs out
  travel(p, gx, gz, dt) {
    const d = Math.hypot(gx - p.x, gz - p.z);
    this.face(p, gx, p.y + EYE, gz, dt, 8);
    p.pitch = 0.75; // looking down at the edge, like a real bridger
    const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
    const ahead = { x: p.x + f.x * 0.75, z: p.z + f.z * 0.75 };
    const below = Math.floor(p.y - 0.05);
    p.move.f = d > 0.6 ? 1 : 0; p.move.s = 0; p.sneak = false; p.sprint = false; p.move.jump = false;
    if (p.ground && !this.supported(ahead.x, p.y, ahead.z)) {
      // the ground runs out: place a block under the next step (or stop at the edge)
      const cx = Math.floor(ahead.x), cz = Math.floor(ahead.z);
      p.sneak = true;
      const slot = p.inv.wool > 0 ? 1 : p.inv.plank > 0 ? 2 : p.inv.end > 0 ? 3 : -1;
      if (slot < 0) { p.move.f = 0; return 'noblocks'; }
      if (this.place(p, cx, below, cz, slot)) p.ai.placed = (p.ai.placed || 0) + 1;
      else {
        // diagonal: fill the side cell first so the bridge is connected
        const sx = Math.floor(p.x), sz = Math.floor(p.z);
        if (!this.place(p, cx, below, sz, slot)) this.place(p, sx, below, cz, slot);
      }
    }
    // a step up in the way: jump it
    if (p.ground && this.hitsBox(ahead.x, p.y, ahead.z) && !this.hitsBox(ahead.x, p.y + 1.05, ahead.z)) p.move.jump = true;
    // stuck against something: break it if we can, otherwise try jumping
    if (Math.hypot(p.x - p.ai.lx, p.z - p.ai.lz) < dt * 0.4 && p.move.f) p.ai.stuck += dt; else p.ai.stuck = 0;
    p.ai.lx = p.x; p.ai.lz = p.z;
    if (p.ai.stuck > 0.6) {
      p.pitch = 0; const h = this.target(p);
      if (h && this.breakable(this.get(h.x, h.y, h.z), p.team)) { p.move.f = 0; this.mineTick(p, dt, true); }
      else p.move.jump = true;
      if (p.ai.stuck > 4) { p.ai.mode = 'home'; p.ai.stuck = 0; p.ai.trail = []; }
    }
    return d < 1.2 ? 'there' : 'going';
  }
  think(p, dt) {
    const A = p.ai, T = TEAMS[p.team], bed = this.beds[p.team];
    // breadcrumbs: the way back home along the bridge we came out on
    if (this.atHome(p)) A.trail = [];
    else if (p.ground) { const last = A.trail[A.trail.length - 1]; if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 1.5) A.trail.push({ x: p.x, z: p.z }); }
    A.think -= dt; A.wait -= dt;
    p.mine = p.mine && p.mine.bot ? p.mine : null;
    // fight whoever is close
    const foes = this.enemiesNear(p, 8).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const foe = foes[0];
    if (p.hp < 9 && p.inv.apple > 0 && Math.random() < dt * 2) this.eat(p);
    if (foe) {
      const d = Math.hypot(foe.x - p.x, foe.z - p.z);
      this.face(p, foe.x + foe.vx * 0.1, foe.y + 1.2, foe.z + foe.vz * 0.1, dt, 9 * this.diff);
      p.move.f = d > 2.2 ? 1 : 0.2; p.sprint = d > 3; p.sneak = false;
      if (Math.random() < dt * 0.6) A.strafe = -A.strafe;
      p.move.s = d < 4 ? A.strafe * 0.7 : 0;
      // don't chase anyone off the edge
      const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
      if (p.ground && !this.supported(p.x + f.x * 0.8, p.y, p.z + f.z * 0.8)) { p.move.f = 0; p.move.s = 0; p.sneak = true; }
      p.move.jump = p.ground && Math.random() < dt * 0.8;
      if (d < 3.2 && Math.random() < dt * 3.2 * this.diff) this.attack(p);
      return;
    }
    p.sprint = false;
    // an enemy at our bed: go and defend it
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
          // pick a target: an enemy bed if any are left, else the nearest enemy, sometimes the diamonds
          const beds = TEAMS.map((_, ti) => ti).filter(ti => ti !== p.team && this.beds[ti].alive && this.players.some(o => o.team === ti && !o.out));
          const foesAlive = this.players.filter(o => o.alive && o.team !== p.team);
          if (Math.random() < 0.25 && p.sword < 3) { const g = this.gens.filter(x => x.kind === 'diamond').sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; A.goal = { x: g.x, z: g.z, kind: 'loot' }; }
          else if (beds.length) { const ti = beds[Math.floor(Math.random() * beds.length)], c = this.beds[ti].cells[0]; const c2 = this.beds[ti].cells[1]; A.goal = { x: c2[0] + 0.5 - Math.sign(TEAMS[ti].x) * 1.6, z: c2[2] + 0.5 - Math.sign(TEAMS[ti].z) * 1.6, kind: 'bed', team: ti }; }
          else if (foesAlive.length) { const o = foesAlive[0]; A.goal = { x: o.x, z: o.z, kind: 'hunt', id: o.id }; }
          if (A.goal) A.mode = 'raid';
        }
      }
    }
    if (A.mode === 'cover') {
      // cover the bed with blocks, one at a time
      const todo = this.bedCover(p.team).filter(c => !this.solid(...c));
      if (!todo.length || p.inv.wool + p.inv.plank + p.inv.end === 0) { A.mode = 'gather'; return; }
      const c = todo[0], d = Math.hypot(c[0] + 0.5 - p.x, c[2] + 0.5 - p.z);
      if (d > 3.2) { this.travel(p, c[0] + 0.5 + Math.sign(T.x) * 1.5, c[2] + 0.5 + Math.sign(T.z) * 1.5, dt); return; }
      p.move.f = 0; p.move.s = 0;
      this.face(p, c[0] + 0.5, c[1] + 0.5, c[2] + 0.5, dt, 12);
      if (Math.random() < dt * 4) { const slot = p.inv.end > 0 && c[1] > TOP ? 3 : p.inv.wool > 0 ? 1 : p.inv.plank > 0 ? 2 : 3; this.place(p, c[0], c[1], c[2], slot); }
      return;
    }
    if (A.mode === 'raid' && A.goal) {
      if (A.goal.kind === 'hunt') { const o = this.P(A.goal.id); if (!o || !o.alive) { A.mode = 'home'; return; } A.goal.x = o.x; A.goal.z = o.z; }
      if (A.goal.kind === 'bed' && !this.beds[A.goal.team].alive) { A.mode = 'home'; A.goal = null; return; }
      if (A.goal.kind === 'bed') {
        const cs = this.beds[A.goal.team].cells, c = cs[Math.hypot(cs[0][0] - p.x, cs[0][2] - p.z) < Math.hypot(cs[1][0] - p.x, cs[1][2] - p.z) ? 0 : 1], d = Math.hypot(c[0] + 0.5 - p.x, c[2] + 0.5 - p.z);
        if (d >= 3.2) { if (this.travel(p, A.goal.x, A.goal.z, dt) === 'noblocks') A.mode = 'home'; return; }
        {
          p.ai.stuck = 0; p.ai.lx = p.x; p.ai.lz = p.z; p.sneak = false; p.move.s = 0; p.move.jump = false;
          // dig in: break whatever is between us and the bed, then the bed
          p.move.f = 0; this.face(p, c[0] + 0.5, c[1] + 0.5, c[2] + 0.5, dt, 14);
          const h = this.target(p);
          if (h) { const t = this.get(h.x, h.y, h.z); if (this.breakable(t, p.team)) { this.mineTick(p, dt, true); if (p.mine) p.mine.bot = true; } else { p.move.jump = p.ground; p.move.f = 0.6; } }
          else p.move.f = 0.5;
        }
        return;
      }
      const r = this.travel(p, A.goal.x, A.goal.z, dt);
      if (r === 'noblocks') { A.mode = 'home'; return; }
      if (false) {
      } else if (r === 'there' && A.goal.kind === 'loot') { A.wait = rnd(4, 9); A.goal = { x: TEAMS[p.team].spawn.x, z: TEAMS[p.team].spawn.z, kind: 'back' }; }
      else if (r === 'there' && A.goal.kind === 'back') { A.mode = 'gather'; A.goal = null; A.wait = rnd(10, 25) / this.diff; }
      return;
    }
    if (A.mode === 'home' || (A.mode === 'gather' && !this.atHome(p))) {
      // retrace the trail (no blocks needed), else walk straight home bridging
      if (A.trail.length) { const w = A.trail[A.trail.length - 1]; this.face(p, w.x, p.y + EYE, w.z, dt, 10); p.pitch = 0.3; p.move.f = 1; p.move.s = 0; p.sneak = false; p.move.jump = false; if (Math.hypot(w.x - p.x, w.z - p.z) < 0.7) A.trail.pop(); return; }
      const r = this.travel(p, T.spawn.x, T.spawn.z, dt); if (r === 'there' || this.atHome(p)) { A.mode = 'gather'; A.wait = rnd(10, 20) / this.diff; } return;
    }
    // gather: stand on the forge, now and then wander a step
    const gn = this.gens.find(g => g.kind === 'forge' && g.team === p.team);
    const d = Math.hypot(gn.x - p.x, gn.z - p.z);
    if (d > 0.8) this.travel(p, gn.x, gn.z, dt); else { p.move.f = 0; p.move.s = 0; p.move.jump = false; p.yaw += dt * 0.3; }
  }
}
