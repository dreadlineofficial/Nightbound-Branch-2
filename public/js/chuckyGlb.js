// Chucky's rigged model (Child's Play, fan-made crossover). Model: "Real-Time Chucky" by
// Leopoldo Rojas (sketchfab.com/HushDamacy), Sketchfab Standard licence. Loaded once from the
// embedded GLB (single-file build) or models/chucky.glb, normalised to doll size (~0.95m), then
// cloned per use. Its own clips drive the skeleton: idle, walk, run, two knife attacks, a laugh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { auraSkinMat } from './foremanGlb.js';

let gltf = null, loading = null, fit = null;
const waiters = [];
export const HEIGHT = 0.95;    // a Good Guy doll is about two and a half feet tall
const FACE_YAW = 0.53;         // the export is turned ~30°: face +Z like the other rigs

export const chuckyReady = () => !!gltf;
export function onChuckyReady(cb) { if (gltf) cb(); else waiters.push(cb); }

async function bytes() {
  const el = document.getElementById('nb-chucky-glb');
  if (el && el.textContent.trim()) {
    const s = atob(el.textContent.trim()), b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b.buffer;
  }
  let last;
  const dev = !!document.querySelector('script[type=importmap]');
  for (const url of dev ? ['models/chucky.glb', 'public/models/chucky.glb'] : ['public/models/chucky.glb', 'models/chucky.glb']) {
    try { const r = await fetch(url); if (r.ok) return await r.arrayBuffer(); last = new Error(url + ' ' + r.status); } catch (e) { last = e; }
  }
  throw last;
}

export function loadChucky() {
  if (loading) return loading;
  loading = bytes()
    .then(buf => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej)))
    .then(g => {
      // short clip names: IDLE_01, WALK_FORWARD, RUN_FORWARD, ATTACK-KNIFE-01, ...
      for (const c of g.animations) c.name = c.name.replace(/^.*\|(Chucky_)?/, '');
      g.animations = g.animations.filter(c => !/WorldAction|T_POSE|IDLE_02/.test(c.name));
      g.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g.scene), h = box.max.y - box.min.y;
      fit = { s: HEIGHT / h, y: -box.min.y * HEIGHT / h, x: -(box.min.x + box.max.x) / 2 * HEIGHT / h, z: -(box.min.z + box.max.z) / 2 * HEIGHT / h };
      gltf = g;
      for (const cb of waiters.splice(0)) { try { cb(); } catch (e) { console.error(e); } }
      return g;
    })
    .catch(e => { console.warn('Chucky model unavailable, using the built-in one:', e); });
  return loading;
}

class ChuckyRig {
  constructor(sk, lite) {
    this.kind = 'killer'; this.killer = 'chucky'; this.glb = true; this.chucky = true;
    this.root = new THREE.Group(); this.aura = []; this.meshes = []; this.t = Math.random() * 10;
    const holder = new THREE.Group(); holder.rotation.y = FACE_YAW; this.root.add(holder);
    const model = cloneSkinned(gltf.scene);
    model.scale.setScalar(fit.s); model.position.set(fit.x, fit.y, fit.z);
    holder.add(model); this.model = model;
    const bones = {}, mats = new Map(), skinned = [];
    model.traverse(o => {
      if (o.isBone) bones[o.name.replace(/_\d+$/, '')] = o;
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
      if (!mats.has(o.material)) mats.set(o.material, this.material(o.material, sk, lite));
      o.material = mats.get(o.material);
      this.meshes.push(o);
      if (o.isSkinnedMesh) skinned.push(o);
    });
    for (const m of skinned) {
      const a = new THREE.SkinnedMesh(m.geometry, auraSkinMat(0xffffff));
      a.bind(m.skeleton, m.bindMatrix);
      a.position.copy(m.position); a.quaternion.copy(m.quaternion); a.scale.copy(m.scale);
      a.visible = false; a.renderOrder = 10; a.frustumCulled = false;
      m.parent.add(a); this.aura.push(a);
    }
    this.bones = bones;
    this.mixer = new THREE.AnimationMixer(model);
    this.acts = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      a.enabled = true; a.setEffectiveWeight(0); a.play();
      this.acts[clip.name] = a;
    }
    this.w = Object.fromEntries(Object.keys(this.acts).map(k => [k, 0]));
    if (this.acts.IDLE_01) { this.w.IDLE_01 = 1; this.acts.IDLE_01.setEffectiveWeight(1); }
  }
  material(src, sk, lite) {
    let m = lite ? new THREE.MeshLambertMaterial({ color: src.color, map: src.map || null, side: src.side, transparent: src.transparent, alphaTest: src.alphaTest }) : src.clone();
    // outfit tints (Burnt Out, Voodoo)
    if (sk.tint != null) { m.color = new THREE.Color(src.color).lerp(new THREE.Color(sk.tint), sk.tintK ?? 0.5); }
    if (sk.glow != null && 'emissive' in m) { m.emissive = new THREE.Color(sk.glow); m.emissiveIntensity = sk.glowK ?? 0.4; }
    return m;
  }
  setAura(color) {
    for (const a of this.aura) { if (color == null) a.visible = false; else { a.visible = true; a.material = auraSkinMat(color); } }
  }
  setOpacity(o) {
    for (const m of this.meshes) {
      if (!m.userData.baseMat) m.userData.baseMat = m.material;
      if (o >= 0.999) { m.material = m.userData.baseMat; m.castShadow = true; continue; }
      if (!m.userData.fadeMat) { m.userData.fadeMat = m.userData.baseMat.clone(); m.userData.fadeMat.transparent = true; m.userData.fadeMat.depthWrite = false; }
      m.userData.fadeMat.opacity = o; m.material = m.userData.fadeMat; m.castShadow = o > 0.5;
    }
  }
}

export function makeChuckyGlb(sk = {}, lite = false) {
  if (!gltf) return null;
  const R = new ChuckyRig(sk, lite);
  if (sk.outfit) dressOutfit(R, sk.outfit, lite);
  return R;
}

// ---------------- outfits made from static models ----------------
// "Scarred Chucky" ("Chucky DBD" by Meeppeep, sketchfab.com/Meeppeep) and "Chucky DBD" ("Chucky Good
// Guy Dead By Daylight" by riccodayz3d, sketchfab.com/riccodayz3d), both CC BY 4.0, are unrigged. Each
// is skinned to Chucky's skeleton here: the skeleton is posed like the model (arms down), the model is
// scaled and lined up with it, and every vertex is weighted to its nearest bones (arms and legs only to
// their own side), so the outfit plays all of Chucky's animations, knife included.
const OUTFITS = { chucky_scarred: { yaw: 2.1, arm: 1.32 }, chucky_dbd: { yaw: 1.5, arm: 1.32 } };
const outfitGltf = {}, outfitLoading = {}, outfitPrep = {};
async function outfitBytes(name) {
  const el = document.getElementById('nb-' + name + '-glb');
  if (el && el.textContent.trim()) { const s = atob(el.textContent.trim()), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }
  const dev = !!document.querySelector('script[type=importmap]');
  for (const url of dev ? [`models/${name}.glb`, `public/models/${name}.glb`] : [`public/models/${name}.glb`, `models/${name}.glb`]) { try { const r = await fetch(url); if (r.ok) return await r.arrayBuffer(); } catch (_) {} }
  throw new Error(name + '.glb unavailable');
}
export function loadChuckyOutfit(name) {
  if (outfitLoading[name]) return outfitLoading[name];
  outfitLoading[name] = outfitBytes(name).then(buf => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej)))
    .then(g => { outfitGltf[name] = g; return g; }).catch(e => { console.warn('Chucky outfit unavailable:', name, e); return null; });
  return outfitLoading[name];
}
export const chuckyOutfitReady = name => !!(outfitGltf[name] && gltf);
const OB = ['def_hips', 'def_spine', 'def_chest', 'def_upperchest', 'def_neck', 'def_head',
  'def_armL', 'def_forearmL', 'def_handL', 'def_armR', 'def_forearmR', 'def_handR',
  'def_legL', 'def_shinL', 'def_footL', 'def_legR', 'def_shinR', 'def_footR'];
function prepareOutfit(name, adj = 0, depth = 0) {
  if ((outfitPrep[name] && !depth) || !outfitGltf[name] || !gltf) return outfitPrep[name];
  const O = OUTFITS[name];
  // Chucky in the model's own space, facing +Z (as in the rig: holder turned by FACE_YAW)
  const holder = new THREE.Group(); holder.rotation.y = FACE_YAW;
  const model = cloneSkinned(gltf.scene); holder.add(model); holder.updateMatrixWorld(true);
  const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name.replace(/_\d+$/, '')] = o; });
  const fbox = new THREE.Box3(); model.traverse(o => { if (o.isSkinnedMesh) fbox.union(new THREE.Box3().setFromObject(o)); });
  const W = n => bones[n].getWorldPosition(new THREE.Vector3());
  const Hf = fbox.max.y - fbox.min.y, hips = W('def_hips');
  // the arms come down from the T-pose, about the forward axis
  // (whichever way round brings the hand down)
  for (const sd of ['L', 'R']) {
    const b = bones['def_arm' + sd], q0 = b.quaternion.clone();
    const tryA = ang => { b.quaternion.copy(q0); holder.updateMatrixWorld(true); const pw = b.parent.getWorldQuaternion(new THREE.Quaternion()), bw = b.getWorldQuaternion(new THREE.Quaternion()); b.quaternion.copy(pw.invert().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang).multiply(bw))); holder.updateMatrixWorld(true); return W('def_hand' + sd).y; };
    if (tryA(O.arm) < tryA(-O.arm)) tryA(O.arm); else tryA(-O.arm);
  }
  holder.updateMatrixWorld(true);
  const lSide = Math.sign(W('def_armL').x - hips.x) || 1; // which side of the body Chucky's "L" arm is on
  if (typeof window !== 'undefined' && window.__nbOutfitDbg) window.__nbOutfitBones = ['def_hips', 'def_armL', 'def_forearmL', 'def_handL', 'def_armR', 'def_forearmR', 'def_handR', 'def_legL', 'def_legR'].map(n => n + ' ' + W(n).toArray().map(x => x.toFixed(0)).join(','));
  // the outfit's meshes, turned to face +Z, scaled to Chucky's height, feet on his feet
  const src = outfitGltf[name].scene; src.updateMatrixWorld(true);
  const turn = new THREE.Matrix4().makeRotationY(O.yaw + adj), parts = [], bb = new THREE.Box3();
  src.traverse(o => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.applyMatrix4(turn); g.computeBoundingBox(); bb.union(g.boundingBox); parts.push({ g, mat: o.material }); } });
  // centre on the torso (a knife held out to one side would pull a bounding-box centre off)
  const tx = [], tz = [], Hb = bb.max.y - bb.min.y;
  for (const { g } of parts) { const P = g.attributes.position; for (let i = 0; i < P.count; i += 3) { const h = (P.getY(i) - bb.min.y) / Hb; if (h > 0.35 && h < 0.55) { tx.push(P.getX(i)); tz.push(P.getZ(i)); } } }
  const med = a => { a.sort((x, y) => x - y); return a.length ? a[a.length >> 1] : 0; };
  const k = Hf / Hb, cx = tx.length ? med(tx) : (bb.min.x + bb.max.x) / 2, cz = tz.length ? med(tz) : (bb.min.z + bb.max.z) / 2;
  const toModel = model.matrixWorld.clone().invert();
  // bone segments (posed), in the same facing space
  const seg = {}, S2 = (n, a, b) => { seg[n] = [a, b]; };
  const up = new THREE.Vector3(0, 1, 0);
  S2('def_hips', W('def_hips'), W('def_spine')); S2('def_spine', W('def_spine'), W('def_chest')); S2('def_chest', W('def_chest'), W('def_upperchest'));
  S2('def_upperchest', W('def_upperchest'), W('def_neck')); S2('def_neck', W('def_neck'), W('def_head')); S2('def_head', W('def_head'), W('def_head').addScaledVector(up, Hf * 0.3));
  for (const sd of ['L', 'R']) {
    S2('def_arm' + sd, W('def_arm' + sd), W('def_forearm' + sd)); S2('def_forearm' + sd, W('def_forearm' + sd), W('def_hand' + sd));
    const h = W('def_hand' + sd), f = W('def_forearm' + sd); S2('def_hand' + sd, h, h.clone().add(h.clone().sub(f).normalize().multiplyScalar(Hf * 0.07)));
    S2('def_leg' + sd, W('def_leg' + sd), W('def_shin' + sd)); S2('def_shin' + sd, W('def_shin' + sd), W('def_foot' + sd)); S2('def_foot' + sd, W('def_foot' + sd), W('def_toe' + sd));
  }
  const segDist = (p, [a, b]) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  const hipY = (W('def_legL').y + W('def_legR').y) / 2, shY = W('def_armL').y;
  const v = new THREE.Vector3(), out = [];
  const place = p => p.set((p.x - cx) * k + hips.x, (p.y - bb.min.y) * k + fbox.min.y, (p.z - cz) * k + hips.z);
  const TORSO = ['def_hips', 'def_spine', 'def_chest', 'def_upperchest', 'def_neck', 'def_head'];
  const ARM = sd => ['def_arm' + sd, 'def_forearm' + sd, 'def_hand' + sd], LEG = sd => ['def_leg' + sd, 'def_shin' + sd, 'def_foot' + sd];
  const nearest = (p, list) => { let near = null, nd = 1e9; for (const n of list) { const d = segDist(p, seg[n]); if (d < nd) { nd = d; near = n; } } return near; };
  // 1) every mesh: its pieces (weld by position, join by triangles) and how each piece votes
  const info = parts.map(({ g }) => {
    const P = g.attributes.position, N = P.count;
    const pos = []; for (let i = 0; i < N; i++) { v.fromBufferAttribute(P, i); place(v); pos.push(v.clone()); }
    const keyOf = new Map(), weld = new Int32Array(N);
    for (let i = 0; i < N; i++) { const q = pos[i], key = Math.round(q.x * 2e3) + ',' + Math.round(q.y * 2e3) + ',' + Math.round(q.z * 2e3); let w = keyOf.get(key); if (w === undefined) keyOf.set(key, w = i); weld[i] = w; }
    const par = new Int32Array(N).map((_, i) => i), find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    const join = (a, b) => { a = find(weld[a]); b = find(weld[b]); if (a !== b) par[a] = b; };
    const ix = g.index, T = ix ? ix.count : N;
    for (let t = 0; t + 2 < T; t += 3) { const a = ix ? ix.getX(t) : t, b2 = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2; join(a, b2); join(b2, c); }
    const side = pos.map(q => Math.sign(q.x - hips.x) === lSide ? 'L' : 'R');
    const piece = pos.map((_, i) => find(weld[i]));
    const votes = new Map();
    for (let i = 0; i < N; i++) {
      // (legs don't vote: a hand hangs right beside the thigh)
      const first = nearest(pos[i], [...TORSO, ...ARM(side[i])]);
      let o = votes.get(piece[i]); if (!o) votes.set(piece[i], o = { L: 0, R: 0, n: 0, top: -1e9, bot: 1e9, sy: 0, pts: [] });
      o.n++; o.top = Math.max(o.top, pos[i].y); o.bot = Math.min(o.bot, pos[i].y); o.sy += pos[i].y; o.pts.push(i);
      if (ARM('L').includes(first)) o.L++; if (ARM('R').includes(first)) o.R++;
    }
    const strands = votes.size > 60; // a mesh of many loose strands is hair: it stays with the head
    for (const o of votes.values()) {
      o.side = !strands && o.L > o.n * 0.5 ? 'L' : !strands && o.R > o.n * 0.5 ? 'R' : null;
      if (o.top < hipY) o.side = null;                                             // decided below, by touch
      if (o.top > shY + Hf * 0.1 || o.sy / o.n > shY - Hf * 0.02) o.side = null; // hair and the head never go with an arm
    }
    return { pos, side, piece, votes };
  });
  // 2) a piece below the hips (a hanging hand, a knife in the fist) goes with an arm it touches
  const armPts = { L: [], R: [] };
  for (const I of info) for (const o of I.votes.values()) if (o.side) for (let k2 = 0; k2 < o.pts.length; k2 += 2) armPts[o.side].push(I.pos[o.pts[k2]]);
  const touch = Hf * 0.03;
  for (let pass = 0; pass < 3; pass++) for (const I of info) for (const o of I.votes.values()) {
    if (o.side || o.top >= hipY || o.n < 8 || I.votes.size > 60 || o.bot < hipY - Hf * 0.2) continue; // (not a trouser leg or a shoe)
    for (const sd of ['L', 'R']) {
      let hit = false;
      for (let k2 = 0; k2 < o.pts.length && !hit; k2 += 2) { const q = I.pos[o.pts[k2]]; for (const a of armPts[sd]) if (Math.abs(a.x - q.x) < touch && Math.abs(a.y - q.y) < touch && Math.abs(a.z - q.z) < touch) { hit = true; break; } }
      if (hit) { o.side = sd; for (let k2 = 0; k2 < o.pts.length; k2 += 2) armPts[sd].push(I.pos[o.pts[k2]]); break; }
    }
  }
  if (typeof window !== 'undefined' && window.__nbOutfitDbg) info.forEach((I, pi) => { for (const o of I.votes.values()) if (o.side && o.n > 30) { const ps = o.pts.map(k2 => I.pos[k2]); const mn = ps.reduce((m, q) => m.min(q), ps[0].clone()), mx = ps.reduce((m, q) => m.max(q), ps[0].clone()); (window.__nbPieces ||= []).push(name + ' adj' + adj.toFixed(2) + ' part' + pi + ' ' + (parts[pi].mat.name || '').slice(0, 30) + ' n' + o.n + ' side' + o.side + ' min ' + mn.toArray().map(x => x.toFixed(0)) + ' max ' + mx.toArray().map(x => x.toFixed(0))); } });
  // the outfit's arms should hang at its sides: if one sits further back than the other, the model is
  // turned a little; turn it to line them up and start again (once or twice)
  if (depth < 2) {
    const c = { L: new THREE.Vector3(), R: new THREE.Vector3() }, n = { L: 0, R: 0 };
    for (const I of info) for (const o of I.votes.values()) if (o.side && o.top >= hipY) for (const k2 of o.pts) { c[o.side].add(I.pos[k2]); n[o.side]++; }
    if (n.L > 50 && n.R > 50) {
      c.L.multiplyScalar(1 / n.L); c.R.multiplyScalar(1 / n.R);
      const d = c.L.clone().sub(c.R).multiplyScalar(lSide), err = Math.atan2(d.z, d.x);
      if (Math.abs(err) > 0.06) return (outfitPrep[name] = prepareOutfit(name, adj + err, depth + 1));
    }
  }
  // 3) weights: within the limb each piece belongs to
  parts.forEach(({ g, mat }, pi) => {
    const P = g.attributes.position, N = P.count, idx = new Uint16Array(N * 4), wt = new Float32Array(N * 4);
    const { pos, side, piece, votes } = info[pi];
    for (let i = 0; i < N; i++) {
      const q = pos[i], o = votes.get(piece[i]);
      const armSide = o.side;
      let cand;
      if (armSide) { const near = nearest(q, ARM(armSide)); cand = near === 'def_arm' + armSide ? [...ARM(armSide), 'def_upperchest'] : ARM(armSide); }
      else if (q.y < hipY - Hf * 0.02) cand = [...LEG(side[i]), 'def_hips'];
      else cand = TORSO;
      if (typeof window !== 'undefined' && window.__nbOutfitDbg) (g.userData.grp ||= []).push(armSide ? (armSide === 'L' ? 1 : 2) : q.y < hipY - Hf * 0.02 ? 3 : 0);
      const ds = cand.map(n => [n, segDist(q, seg[n])]).sort((a, b) => a[1] - b[1]).slice(0, 3);
      let tot = 0; const ws = ds.map(([n, d]) => { const w = 1 / Math.pow(d + Hf * 0.012, 4); tot += w; return [n, w]; });
      ws.forEach(([n, w2], j) => { idx[i * 4 + j] = OB.indexOf(n); wt[i * 4 + j] = w2 / tot; });
      v.copy(q).applyMatrix4(toModel); P.setXYZ(i, v.x, v.y, v.z);
    }
    P.needsUpdate = true; g.computeVertexNormals();
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    out.push({ g, mat });
  });
  // bind inverses in model space, in the arms-down pose
  model.updateMatrixWorld(true);
  const inv = OB.map(n => bones[n].matrixWorld.clone().premultiply(toModel).invert());
  outfitPrep[name] = { parts: out, inv };
  return outfitPrep[name];
}
function dressOutfit(R, name, lite) {
  const P = prepareOutfit(name); if (!P) return false;
  for (const m of R.meshes) m.visible = false;
  for (const a of R.aura) a.userData.off = true;
  const model = R.model, skel = () => new THREE.Skeleton(OB.map(n => R.bones[n]), P.inv.map(m => m.clone()));
  const meshes = [], aura = [];
  for (const { g, mat } of P.parts) {
    const m = new THREE.SkinnedMesh(g, R.material(mat, {}, lite)); m.castShadow = true; m.frustumCulled = false;
    model.add(m); m.bind(skel(), new THREE.Matrix4()); meshes.push(m);
    const a = new THREE.SkinnedMesh(g, auraSkinMat(0xffffff)); a.visible = false; a.renderOrder = 10; a.frustumCulled = false;
    model.add(a); a.bind(m.skeleton, new THREE.Matrix4()); aura.push(a);
  }
  R.meshes = meshes; R.aura = aura; R.outfit = name;
  return true;
}

// pick a clip for the game state, blend toward it, and scrub one-shot clips
export function animateChucky(R, s, dt) {
  R.t += dt;
  const A = R.acts, sp = s.speed || 0;
  let want = 'IDLE_01', rate = 1, scrub = null, fast = false;
  if (s.exec && s.exec.role === 'killer') { want = 'ATTACK-KNIFE-02'; rate = 2.2; fast = true; }
  else if (s.stun) { want = 'IDLE_01'; rate = 0.35; }
  else if (s.leap != null) { want = 'ATTACK-KNIFE-02'; scrub = 0.15 + s.leap * 0.7; fast = true; }
  else if (s.aim) { want = 'ATTACK-KNIFE-02'; scrub = 0.08; fast = true; }
  else if (s.atk === 1) { want = 'ATTACK-KNIFE-01'; scrub = Math.min(1, (s.atkF || 0) * 0.6); fast = true; }
  else if (s.atk === 2 && !s.atkHit) { want = 'ATTACK-KNIFE-01'; scrub = 0.6 + (s.recF || 0) * 0.4; }
  else if (s.act) { want = 'IDLE_01'; rate = 1.6; }
  else if (sp > 2.6) { want = 'RUN_FORWARD'; rate = Math.min(1.5, Math.max(0.7, sp / 3.6)); }
  else if (sp > 0.3) { want = 'WALK_FORWARD'; rate = Math.min(2.4, Math.max(0.7, sp / 0.9)); }
  if (!A[want]) want = 'IDLE_01';
  const laughing = s.laughF != null && s.laughF < 1;
  const k = 1 - Math.exp(-dt * (fast ? 22 : 9));
  for (const n in A) {
    const a = A[n];
    const target = n === want ? 1 : n === 'FACE_LAUGH_1' && laughing ? 1 : 0;
    R.w[n] += (target - R.w[n]) * k;
    if (R.w[n] < 0.002 && !target) R.w[n] = 0;
    a.setEffectiveWeight(R.w[n]);
    if (n === want) {
      if (scrub != null) { a.paused = true; a.time = scrub * a.getClip().duration; }
      else { a.paused = false; a.timeScale = rate; }
    } else if (n === 'FACE_LAUGH_1' && laughing) { a.paused = false; a.timeScale = 1; if (s.laughF < 0.05) a.time = 0; }
    else if (R.w[n] === 0) a.paused = true;
  }
  R.mixer.update(dt);
  // stunned: wobble like a toy that got knocked over
  R.root.children[0].rotation.z = s.stun ? Math.sin(R.t * 9) * 0.18 : 0;
}
