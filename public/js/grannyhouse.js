// "Granny's House" (Granny chapter map). The scenery is the Granny 3 house and grounds
// ("Granny 3 map", converted to GLB, see README credits): a three-storey house in the middle of a
// walled yard. Only the ground floor and the yard are played on; the floors above are scenery.
// Collision comes from the model itself (see grannygrid.js); generators, hooks, exit gates and a
// few pallet loops are laid out here.
import { rng, makeCtx, addGates, buildGrid, freePoint, cellOf } from './map.js';
import { GRANNY_BOXES } from './grannygrid.js';

export const GRANNY_HALF = 31.6;
// the house's footprint (no grass or lamp posts inside), the shed's too
export const GRANNY_INDOORS = [
  { x0: -12.4, x1: 14, z0: -12, z1: 16.8 },
  { x0: -17.6, x1: -13, z0: -21, z1: -14.6 },
];
const indoors = (x, z) => GRANNY_INDOORS.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);

export function buildGrannyHouse(seed) {
  const R = rng(seed * 17 + 11);
  const M = {
    seed, map: 'granny', mapId: 'granny', half: GRANNY_HALF, navR: 0.3, glbScene: 'granny_map', indoors: GRANNY_INDOORS,
    props: [], pools: [], lights: [], boxes: [], circles: [], windows: [], bars: [], gens: [], cages: [], gates: [],
    visual: [], trees: [], rocks: [], spawns: { survivors: [], killer: null },
  };
  // walls and furniture from the model (invisible: the model draws them)
  for (const [x, z, hx, hz] of GRANNY_BOXES) M.boxes.push({ x, z, hx, hz, h: 3.2, kind: 'mesh', style: 'none', nocast: true });
  // the outer wall's diagonal corners have gaps (one is the old bridge gate): seal them
  const seal = (x1, z1, x2, z2) => { const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / 0.6); for (let i = 0; i <= n; i++) M.circles.push({ x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r: 0.5, h: 4, kind: 'mesh', nocast: true }); };
  seal(-30.25, -21.5, -21.5, -29.9); seal(24.1, -29.9, 31, -23.4); seal(31, 21, 20.4, 31); seal(-30.25, 21, -20.9, 31);

  // ---------- exit gates, in the straight runs of the outer wall ----------
  addGates(M, [{ x: -4, z: -29.9, dir: -1 }, { x: 6, z: 30.75, dir: 1 }], 'brick');

  // ---------- loops in the yard: low walls, a woodshed, a garden fence with pallets and windows ----------
  const S = 'wood';
  const loops = [
    [6, -21, 0, C => { C.seg(-6, 0, -1, 0, 'brick', 2.4); C.barricade(0, 0, 'z', 0.85); C.windowWall(1, 0, 7, 0, 'brick', 0.55, 1.5, 2.4); }],
    [-24, -4, 1, C => { C.windowWall(-3.5, -2.5, 3.5, -2.5, S, 0.5, 1.5, 2.6); C.seg(3.5, -2.5, 3.5, 2.5, S, 2.6); C.doorWall(3.5, 2.5, -3.5, 2.5, S, 0.6, 1.8, false, 2.6); C.box(-5.5, 1.5, 0.8, 0.8, 1.5, 'crate', 'wood'); C.barricade(-5.5, -0.3, 'x', 0.85); }],
    [22, -16, 0, C => { C.box(-2.4, 0, 1.4, 0.5, 2.4, 'stone', 'stone'); C.box(2.4, 0, 1.4, 0.5, 2.2, 'stone', 'stone'); C.barricade(0, 0, 'z', 0.85); }],
    [-6, 24, 0, C => { C.windowWall(-6, -2, 2, -2, 'brick', 0.45, 1.5, 2.6); C.seg(2, -2, 2, 2.5, 'brick', 2.6); C.barricade(2, 4.2, 'x', 0.85); }],
    [24, 4, 1, C => { C.box(-1.8, 0, 0.8, 0.8, 1.6, 'crate', 'wood'); C.box(1.8, 0, 0.8, 0.8, 1.6, 'crate', 'wood'); C.barricade(0, 0, 'z', 0.9); }],
    [-22, 14, 0, C => { C.seg(-3, 0, 3, 0, S, 2.2); C.barricade(4.1, 0, 'z', 0.85); C.seg(5.2, 0, 7, 0, S, 2.2); }],
  ];
  for (const [x, z, rot, fn] of loops) fn(makeCtx(M, R, x, z, rot));

  // ---------- generators and hooks ----------
  // Each one needs open ground around it (so it never plugs a doorway or a gap between walls), and is
  // only kept if the map stays connected with it in place (checked on the bots' walking grid).
  const solidNear = (x, z, r) => M.boxes.some(b => Math.abs(x - b.x) < b.hx + r && Math.abs(z - b.z) < b.hz + r) || M.circles.some(c => Math.hypot(x - c.x, z - c.z) < c.r + r);
  const reach = () => {
    buildGrid(M);
    const g = M.grid, N = g.N, seen = new Uint8Array(N * N), q = [];
    const start = cellOf(M, 0, 24); seen[start] = 1; q.push(start);
    let n = 0;
    while (q.length) { const k = q.pop(); n++; const i = k % N, j = (k / N) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const nk = nj * N + ni; if (!seen[nk] && g.type[nk] !== 1) { seen[nk] = 1; q.push(nk); } } }
    return n;
  };
  let base = reach();
  const place = (list, n, minD, clear, add) => {
    const out = [];
    for (let d = minD; out.length < n && d >= 4; d -= 3)
      for (const [x0, z0] of R.shuffle(list.slice())) {
        if (out.length >= n) break;
        // nearest spot with enough room around it
        let p = null;
        for (let rad = 0; rad < 5 && !p; rad += 0.5) for (let a = 0; a < 12 && !p; a++) { const x = x0 + Math.cos(a / 12 * 6.283) * rad, z = z0 + Math.sin(a / 12 * 6.283) * rad; if (!solidNear(x, z, clear)) p = { x, z }; if (rad === 0) break; }
        if (!p || out.some(o => Math.hypot(o.x - p.x, o.z - p.z) < d) || [...M.gens, ...M.cages].some(o => Math.hypot(o.x - p.x, o.z - p.z) < 4)) continue;
        const undo = add(p);
        const now = reach();
        if (now < base - 30) { undo(); continue; } // it cut part of the map off
        base = now; out.push(p);
      }
    return out;
  };
  const addGen = p => { const g = { id: M.gens.length, x: p.x, z: p.z, rot: R.int(0, 3) * Math.PI / 2 }, b = { x: p.x, z: p.z, hx: 0.62, hz: 0.62, h: 1.25, kind: 'gen', style: 'metal', nocast: true }; M.gens.push(g); M.boxes.push(b); return () => { M.gens.pop(); M.boxes.splice(M.boxes.indexOf(b), 1); }; };
  const addHook = p => { const h = { id: M.cages.length, x: p.x, z: p.z }, c = { x: p.x, z: p.z, r: 0.75, h: 2.6, kind: 'cage', nocast: true }; M.cages.push(h); M.circles.push(c); return () => { M.cages.pop(); M.circles.splice(M.circles.indexOf(c), 1); }; };
  place([[-7.5, 1], [-7.5, 10], [2, -4], [9, -8], [-3, -8], [-7, -5]], 2, 8, 1.55, addGen);           // inside the house
  place([[0, -25], [-18, -24], [16, -24], [-26, 6], [27, -4], [26, 14], [-14, 26], [12, 25], [-24, -14], [18, 6], [-17, 20], [-2, 22]], 7 - M.gens.length, 13, 2.4, addGen);
  place([[-8, -24], [10, -26], [-27, -10], [28, 0], [-27, 12], [22, 26], [-2, 28], [16, -8], [-17, -2], [6, 20], [20, -22], [-20, 26]], 7, 12, 2.2, addHook);

  // ---------- spawns: survivors on one side of the yard, Granny on the other ----------
  const side = R() < 0.5 ? 1 : -1;
  const sx = side > 0 ? -26.5 : 27, sz = side > 0 ? 3 : -9.5, kx = 24 * side;
  for (let i = 0; i < 12; i++) M.spawns.survivors.push(freePoint(M, sx + (i % 2) * 1.6, sz + Math.floor(i / 2) * 1.6, 0.6));
  M.spawns.killer = freePoint(M, kx, 24, 0.8);
  M.spawns.killerYaw = Math.atan2(sx - kx, sz - 24);
  M.spawns.survivorYaw = side > 0 ? Math.PI / 2 : -Math.PI / 2;

  buildGrid(M);
  M.isIndoors = indoors;
  return M;
}
