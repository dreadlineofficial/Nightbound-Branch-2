// Springtrap (fan-made crossover, Five Nights at Freddy's).
//  - Model: "Springtrap" (a Dead by Daylight rip shared on Sketchfab), and the Yellow Rabbit outfit
//    ("Dead by daylight yellow rabbit", the movie suit). Both use the same game skeleton; the files
//    carry only an idle, so he is animated by hand here: every joint is posed procedurally (a heavy,
//    broken-animatronic walk with a limp and twitches, an overhead axe chop, the axe throw, the
//    Phantom Scare lunge, carry, stun and execution).
// The GLBs are made from the USDZ uploads by tools/springtrap/skel2glb.py (joints renamed by
// tools/springtrap/*.names.json).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { auraSkinMat } from './foremanGlb.js';

const FILES = { springtrap: 'springtrap', rabbit: 'springtrap_rabbit' };
const HEAD_H = 1.86; // the top of the neck joint sits this high: he is a head taller than everyone
const M = {}, loading = {}, waiters = [];
export const springtrapReady = (sk = {}) => !!M[sk.rabbit ? 'rabbit' : 'springtrap'];
export function onSpringtrapReady(cb) { if (M.springtrap) cb(); else waiters.push(cb); }

async function bytes(name) {
  const el = document.getElementById('nb-' + name + '-glb');
  if (el && el.textContent.trim()) { const s = atob(el.textContent.trim()), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }
  const dev = !!document.querySelector('script[type=importmap]'); let last;
  for (const url of dev ? [`models/${name}.glb`, `public/models/${name}.glb`] : [`public/models/${name}.glb`, `models/${name}.glb`]) {
    try { const r = await fetch(url); if (r.ok) return await r.arrayBuffer(); last = new Error(url + ' ' + r.status); } catch (e) { last = e; }
  }
  throw last;
}
function boneMap(root) { const b = {}; root.traverse(o => { if (o.isBone && !(o.name in b)) b[o.name] = o; }); return b; }

function load(kind) {
  if (loading[kind]) return loading[kind];
  loading[kind] = bytes(FILES[kind]).then(buf => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej))).then(g => {
    g.animations = [];
    g.scene.updateMatrixWorld(true); // (the file rests in its bind pose)
    const b = boneMap(g.scene), q = {}, p = {};
    for (const n in b) { q[n] = b[n].getWorldQuaternion(new THREE.Quaternion()); p[n] = b[n].getWorldPosition(new THREE.Vector3()); }
    const s = HEAD_H / Math.max(1e-6, p.Neck.y);
    // how far the arms hang out from the sides in the bind pose (an A-pose): lowered to the sides
    const arm = side => { const a = p['Arm' + side], c = p['Fore' + side]; return a && c ? Math.atan2(Math.abs(c.x - a.x), a.y - c.y) : 0.6; };
    M[kind] = { g, fit: { s, x: -p.Hips.x * s, y: 0, z: -p.Hips.z * s }, rest: { q, p }, armL: arm('L'), armR: arm('R') };
    if (kind === 'springtrap') for (const cb of waiters.splice(0)) { try { cb(); } catch (e) { console.error(e); } }
    return M[kind];
  }).catch(e => { console.warn(kind + ' model unavailable:', e); return null; });
  return loading[kind];
}
export const loadSpringtrap = () => Promise.all([load('springtrap'), load('rabbit')]).then(() => M.springtrap);

// joints driven by the pose, parent first. Each gets a rotation in the body frame (x: his left,
// y: up, z: forward), composed down the chain like a puppet's joints.
const CHAIN = [
  ['Hips', null, 'hips'], ['Spine', 'Hips', 'spine'], ['Spine1', 'Spine', 'spine2'], ['Chest', 'Spine1', 'chest'],
  ['Neck', 'Chest', 'neck'], ['Head', 'Neck', 'head'],
  ['ClavL', 'Chest', 'clL'], ['ArmL', 'ClavL', 'shL'], ['ForeL', 'ArmL', 'elL'], ['HandL', 'ForeL', 'wrL'],
  ['ClavR', 'Chest', 'clR'], ['ArmR', 'ClavR', 'shR'], ['ForeR', 'ArmR', 'elR'], ['HandR', 'ForeR', 'wrR'],
  ['ThighL', 'Hips', 'lgL'], ['CalfL', 'ThighL', 'knL'], ['FootL', 'CalfL', 'anL'],
  ['ThighR', 'Hips', 'lgR'], ['CalfR', 'ThighR', 'knR'], ['FootR', 'CalfR', 'anR'],
];
const E = new THREE.Euler(), Q = () => new THREE.Quaternion();
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class SpringtrapRig {
  constructor(sk, lite) {
    const kind = sk.rabbit ? 'rabbit' : 'springtrap', D = M[kind];
    this.D = D; this.kind = 'killer'; this.killer = 'springtrap'; this.glb = true; this.springtrap = true; this.rabbit = !!sk.rabbit;
    this.root = new THREE.Group(); this.aura = []; this.meshes = []; this.t = Math.random() * 10;
    const model = cloneSkinned(D.g.scene);
    model.scale.setScalar(D.fit.s); model.position.set(D.fit.x, D.fit.y, D.fit.z);
    this.root.add(model); this.model = model;
    const mats = new Map(), skinned = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      if (!mats.has(o.material)) {
        const src = o.material;
        const m = lite ? new THREE.MeshLambertMaterial({ color: src.color, map: src.map || null, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side, emissive: src.emissive, emissiveMap: src.emissiveMap || null }) : src.clone();
        if (sk.tint != null) m.color = new THREE.Color(m.color).lerp(new THREE.Color(sk.tint), sk.tintK ?? 0.5);
        if (sk.glow != null && 'emissive' in m && !m.emissiveMap) { m.emissive = new THREE.Color(sk.glow); m.emissiveIntensity = sk.glowK ?? 0.4; }
        if (m.emissiveMap) m.emissiveIntensity = 2.2; // his eyes glow in the dark
        mats.set(src, m);
      }
      o.material = mats.get(o.material); this.meshes.push(o); if (o.isSkinnedMesh) skinned.push(o);
    });
    for (const m of skinned) {
      const a = new THREE.SkinnedMesh(m.geometry, auraSkinMat(0xffffff)); a.bind(m.skeleton, m.bindMatrix);
      a.position.copy(m.position); a.quaternion.copy(m.quaternion); a.scale.copy(m.scale); a.visible = false; a.renderOrder = 10; a.frustumCulled = false; m.parent.add(a); this.aura.push(a);
    }
    this.sb = boneMap(model);
    this.cur = {};
  }
  rot(a) { return Q().setFromEuler(E.set(a[0] || 0, a[1] || 0, a[2] || 0, 'YXZ')); }
  drive() {
    const S = this.D.rest, ws = this.model.getWorldQuaternion(Q()), G = {}, P = this.cur;
    for (const [bone, parent, j] of CHAIN) {
      const b = this.sb[bone]; if (!b || !S.q[bone]) continue;
      G[bone] = (parent && G[parent] ? G[parent].clone() : Q()).multiply(this.rot(P[j] || [0, 0, 0]));
      const target = ws.clone().multiply(G[bone]).multiply(S.q[bone]);
      b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert().multiply(target));
      b.updateMatrixWorld(true);
    }
    // hip height (crouch, the bob and limp of the walk): the legs and the spine hang off the root
    const off = new THREE.Vector3(0, P.hipY ? P.hipY[0] / this.D.fit.s : 0, P.hipZ ? P.hipZ[0] / this.D.fit.s : 0);
    for (const n of ['Hips', 'Spine']) {
      const b = this.sb[n]; if (!b || !S.p[n]) continue;
      b.position.copy(b.parent.worldToLocal(this.model.localToWorld(S.p[n].clone().add(off))));
    }
  }
  setAura(color) { for (const a of this.aura) { if (color == null) a.visible = false; else { a.visible = true; a.material = auraSkinMat(color); } } }
  setOpacity(o) {
    for (const m of this.meshes) {
      if (!m.userData.baseMat) m.userData.baseMat = m.material;
      if (o >= 0.999) { m.material = m.userData.baseMat; m.castShadow = true; continue; }
      if (!m.userData.fadeMat) { m.userData.fadeMat = m.userData.baseMat.clone(); m.userData.fadeMat.transparent = true; m.userData.fadeMat.depthWrite = false; }
      m.userData.fadeMat.opacity = o; m.material = m.userData.fadeMat; m.castShadow = o > 0.5;
    }
  }
}

export function makeSpringtrap(sk = {}, lite = false) {
  if (!M[sk.rabbit ? 'rabbit' : 'springtrap']) return null;
  return new SpringtrapRig(sk, lite);
}

// Springtrap's own animation: a rotting animatronic. Poses are angles per joint, blended smoothly.
export function animateSpringtrap(R, s, dt) {
  R.t += dt;
  const t = R.t, sp = s.speed || 0, P = {}, aL = R.D.armL, aR = R.D.armR;
  // arms hang heavy at his sides (the model's bind pose holds them out)
  P.shL = [0.05, 0, -aL + 0.12]; P.shR = [0.1, 0, aR - 0.14]; P.elL = [-0.2, 0, 0]; P.elR = [-0.3, 0, 0];
  P.hipY = [0]; P.hipZ = [0];
  // a hunched, slow breath and the twitch of a broken servo every few seconds
  const tw = Math.max(0, Math.sin(t * 0.9) * Math.sin(t * 2.3) - 0.85) * 4;
  P.spine = [0.08, 0, 0]; P.chest = [0.06 + Math.sin(t * 1.3) * 0.02, 0, 0];
  P.neck = [0.1, 0, 0]; P.head = [0.05 + Math.sin(t * 0.6) * 0.04, Math.sin(t * 0.4) * 0.2 + tw * 0.5, tw * 0.3 + Math.sin(t * 0.7) * 0.04];
  let fast = false;
  const chop = f => {
    // an overhead axe chop: raise (0..0.42), strike (0.42..0.7), follow through
    const up = sm(0, 0.42, f), down = sm(0.4, 0.68, f), back = sm(0.78, 1, f), raise = up * (1 - down);
    P.shR = [-2.6 * raise - 0.95 * down * (1 - back) + 0.1, 0, aR - 0.14 - 0.3 * raise];
    P.elR = [-1.2 * raise - 0.15 * down, 0, 0];
    P.wrR = [-0.4 * raise + 0.5 * down * (1 - back), 0, 0];
    P.spine = [-0.15 * raise + 0.32 * down * (1 - back), -0.3 * raise + 0.25 * down, 0];
    P.chest = [-0.1 * raise + 0.2 * down * (1 - back), -0.18 * raise + 0.12 * down, 0];
    P.shL = [-0.6 * raise, 0, -aL + 0.4]; P.elL = [-0.6 * raise, 0, 0];
    P.head = [0.12 * down, 0, 0];
  };
  const throwPose = f => {
    // the axe cocked back over the shoulder (f 0..1: wind-up)
    P.shR = [-2.3 * f, 0, aR - 0.14 - 0.5 * f]; P.elR = [-1.6 * f, 0, 0]; P.wrR = [-0.5 * f, 0, 0];
    P.spine = [-0.08 * f, -0.45 * f, 0]; P.chest = [-0.05 * f, -0.25 * f, 0];
    P.shL = [-1.1 * f, 0, -aL + 0.25]; P.elL = [-0.3, 0, 0];
  };
  if (s.exec && s.exec.role === 'killer') {
    // execution: grabs them, then the axe, twice
    const f = s.exec.f || 0;
    if (f < 0.3) { P.shL = [-1.4, 0, -aL + 0.3]; P.elL = [-0.5, 0, 0]; throwPose(sm(0.05, 0.3, f)); }
    else chop(((f - 0.3) * 2.6) % 1);
    P.hipY = [-0.06]; P.lgL = [-0.35, 0, 0]; P.knL = [0.6, 0, 0]; P.lgR = [0.15, 0, 0]; P.knR = [0.3, 0, 0];
    fast = true;
  } else if (s.stun) {
    // stunned: the springlocks jam. He seizes, twitching
    const j = Math.sin(t * 31) * 0.12;
    P.spine = [0.45 + j, Math.sin(t * 6) * 0.3, 0]; P.head = [0.7 + j * 2, Math.sin(t * 11) * 0.5, Math.sin(t * 7) * 0.4];
    P.shL = [0.3 + j, 0, -aL + 0.5]; P.shR = [0.2 - j, 0, aR - 0.5]; P.elL = [-0.4, 0, 0]; P.elR = [-0.2, 0, 0];
    P.knL = [0.5, 0, 0]; P.knR = [0.4, 0, 0]; P.hipY = [-0.08]; fast = true;
  } else if (s.scare != null) {
    // Phantom Scare: lurches forward, arms wide, jaw toward their face
    const f = sm(0, 0.25, s.scare) * (1 - sm(0.7, 1, s.scare));
    P.spine = [0.35 * f, 0, 0]; P.chest = [0.2 * f, 0, 0]; P.neck = [-0.2 * f, 0, 0]; P.head = [-0.35 * f + Math.sin(t * 40) * 0.05 * f, 0, 0];
    P.shL = [-1.3 * f, 0, -aL + 0.12 + 0.9 * f]; P.shR = [-1.2 * f, 0, aR - 0.14 - 0.9 * f]; P.elL = P.elR = [-0.3, 0, 0];
    P.hipZ = [0.12 * f]; fast = true;
  } else if (s.aim) { throwPose(1); fast = true; }
  else if (s.atk === 1) { chop(Math.min(1, (s.atkF || 0)) * 0.7); fast = true; }
  else if (s.atk === 2 && !s.atkHit) chop(0.7 + (s.recF || 0) * 0.3);
  else if (s.atk === 2) { chop(0.7); P.spine[0] += 0.1; }
  else if (s.carry) {
    // a survivor over his left shoulder, the axe low in his right hand
    P.shL = [-2.4, 0, -aL + 0.5]; P.elL = [-1.6, 0, 0]; P.spine = [0.15, 0, 0];
  } else if (s.act) {
    // bending over (picking up, hooking, breaking things)
    P.spine = [0.55, 0, 0]; P.chest = [0.25, 0, 0]; P.hipY = [-0.06]; P.knL = P.knR = [0.45, 0, 0]; P.lgL = P.lgR = [-0.3, 0, 0];
    P.shL = [-1.0 + Math.sin(t * 6) * 0.2, 0, -aL + 0.2]; P.shR = [-0.8, 0, aR - 0.2]; P.elL = P.elR = [-0.4, 0, 0];
  } else if (s.tele) {
    // stepping into a Security Door: still, head down, fading
    P.head = [0.5, 0, 0]; P.spine = [0.2, 0, 0];
  }
  if (!(s.exec || s.stun || s.scare != null || s.aim || s.act || s.tele)) {
    // walking and running: heavy steps, a limp on the right leg, the right arm dragging the axe
    const moving = sp > 0.3, run = sp > 2.6, ph = t * (run ? 8.2 : 5.4) * Math.max(0.7, Math.min(1.6, sp / (run ? 4.4 : 1.6)));
    const amp = moving ? (run ? 0.75 : 0.45) : 0, sw = Math.sin(ph);
    P.lgL = [-sw * amp, 0, 0.03]; P.lgR = [sw * amp * 0.8, 0, -0.03];
    P.knL = [Math.max(0, Math.sin(ph + 1.6)) * amp * (run ? 1.5 : 1.0), 0, 0]; P.knR = [Math.max(0, Math.sin(ph + 1.6 + Math.PI)) * amp * (run ? 1.2 : 0.7), 0, 0];
    P.anL = [-P.knL[0] * 0.3, 0, 0]; P.anR = [-P.knR[0] * 0.3, 0, 0];
    // the limp: he sinks onto the bad right leg
    P.hipY = [moving ? -Math.abs(Math.cos(ph)) * (run ? 0.04 : 0.025) - Math.max(0, -sw) * 0.02 - (run ? 0.03 : 0) : 0];
    if (!s.atk && !s.carry) {
      P.shL = [sw * amp * 0.7 + 0.05, 0, -aL + 0.14]; P.elL = [-0.25 - (run ? 0.7 : 0.1), 0, 0];
      P.shR = [-sw * amp * 0.35 + 0.1 - (run ? 0.3 : 0), 0, aR - 0.16]; P.elR = [-0.35 - (run ? 0.5 : 0.1), 0, 0];
    }
    if (moving) {
      P.spine = [(P.spine ? P.spine[0] : 0) + (run ? 0.22 : 0.08), Math.sin(ph) * 0.07, Math.sin(ph) * 0.04];
      P.head = [P.head[0] - (run ? 0.12 : 0), P.head[1] * 0.3, P.head[2] + Math.sin(ph) * 0.05];
    }
  }
  // blend toward the new pose
  const k = 1 - Math.exp(-dt * (fast ? 22 : 9));
  for (const j in P) { const c = R.cur[j] || [0, 0, 0], v = P[j]; R.cur[j] = [c[0] + ((v[0] || 0) - c[0]) * k, c[1] + ((v[1] || 0) - c[1]) * k, c[2] + ((v[2] || 0) - c[2]) * k]; }
  for (const j in R.cur) if (!(j in P)) { const c = R.cur[j]; R.cur[j] = [c[0] * (1 - k), c[1] * (1 - k), c[2] * (1 - k)]; }
  R.drive();
}
