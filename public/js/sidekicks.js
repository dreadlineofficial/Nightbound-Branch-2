// Sidekicks: cosmetic companions that follow their owner around, react to what happens to them,
// and can't hurt or be hurt. Each client runs its own copy (only the owner's choice is synced).
//  - Ted: rigged model "Ted" by diegolitooliva36 (sketchfab.com/diegooliva), CC BY 4.0. The model
//    has no animations, so every pose here is built by turning its bones in code.
//  - Rosy: a little rose-coloured dog, built from primitives.
// When the owner dies, Ted pulls out a camping chair next to the body with a beer and his bong;
// Rosy lies down beside them.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { moveCircle } from './map.js';

let ted = null, tedLoading = null;
const TED_H = 0.62; // a teddy bear's height in metres

async function bytes(name) {
  const el = document.getElementById('nb-' + name + '-glb');
  if (el && el.textContent.trim()) { const s = atob(el.textContent.trim()), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; }
  const dev = !!document.querySelector('script[type=importmap]');
  let last;
  for (const url of dev ? [`models/${name}.glb`, `public/models/${name}.glb`] : [`public/models/${name}.glb`, `models/${name}.glb`]) {
    try { const r = await fetch(url); if (r.ok) return await r.arrayBuffer(); last = new Error(url + ' ' + r.status); } catch (e) { last = e; }
  }
  throw last;
}
export function loadTed() {
  if (tedLoading) return tedLoading;
  tedLoading = bytes('ted').then(buf => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej))).then(g => {
    const scene = g.scene;
    // the file also holds a phone, a beer bottle and a bong: keep the bottle and the bong as props
    const props = {};
    scene.traverse(o => { if (o.name === 'Object_126') props.bottle = o; if (/^Object_1(28|30|32)$/.test(o.name)) (props.bong ||= []).push(o); });
    const drop = [];
    scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) drop.push(o); });
    scene.updateMatrixWorld(true);
    const grab = list => { const grp = new THREE.Group(); for (const o of list) { const m = o.clone(); o.matrixWorld.decompose(m.position, m.quaternion, m.scale); grp.add(m); } return grp; };
    const bottle = props.bottle ? grab([props.bottle]) : null, bong = props.bong ? grab(props.bong) : null;
    for (const o of drop) o.parent && o.parent.remove(o);
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene), h = box.max.y - box.min.y;
    const fit = { s: TED_H / h, y: -box.min.y * TED_H / h, x: -(box.min.x + box.max.x) / 2 * TED_H / h, z: -(box.min.z + box.max.z) / 2 * TED_H / h };
    // props: normalise each to a height
    const norm = (grp, height) => { if (!grp) return null; const b = new THREE.Box3().setFromObject(grp), c = b.getCenter(new THREE.Vector3()); const k = height / (b.max.y - b.min.y); const o = new THREE.Group(); grp.position.sub(new THREE.Vector3(c.x, b.min.y, c.z)); o.add(grp); o.scale.setScalar(k); return o; };
    ted = { scene, fit, bottle: norm(bottle, 0.16), bong: norm(bong, 0.3) };
    return ted;
  }).catch(e => { console.warn('Ted model unavailable:', e); return null; });
  return tedLoading;
}
export const tedReady = () => !!ted;

// rotation of a bone "by R in model space at rest": q = q_rest * (q_worldRest^-1 * R * q_worldRest)
function boneDriver(bone) {
  const rest = bone.quaternion.clone(), wr = bone.getWorldQuaternion(new THREE.Quaternion()), wri = wr.clone().invert();
  const tmp = new THREE.Quaternion();
  return R => { tmp.copy(wri).multiply(R).multiply(wr); bone.quaternion.copy(rest).multiply(tmp); };
}
const qa = (x, y, z, a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z), a);

// ---------------- Ted ----------------
// (raw model faces +X, right hand toward +Z; a holder turns him to face +Z like everyone else)
const TED_BONES = { pelvis: 'Bone_55', spine: 'Bone001_54', chest: 'Bone002_53', neck: 'Bone004_39', head: 'Bone005_30', armL: 'Bone013_45', foreL: 'Bone015_43', armR: 'Bone008_51', foreR: 'Bone010_49', thighR: 'Bone019_58', shinR: 'Bone020_57', thighL: 'Bone022_62', shinL: 'Bone023_61' };
function makeTedRig() {
  const root = new THREE.Group(), holder = new THREE.Group(); root.add(holder);
  const model = cloneSkinned(ted.scene);
  model.scale.setScalar(ted.fit.s); model.position.set(ted.fit.x, ted.fit.y, ted.fit.z);
  holder.add(model);
  model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  const bones = {}; model.traverse(o => { if (o.isBone) bones[o.name] = o; });
  // bone frames are captured in the model's own orientation (facing +X), then he is turned around
  const drv = {}; for (const [k, n] of Object.entries(TED_BONES)) if (bones[n]) drv[k] = boneDriver(bones[n]);
  holder.rotation.y = -Math.PI / 2;
  const bottle = ted.bottle.clone(), hand = bones[TED_BONES.foreR];
  return { kind: 'ted', root, holder, model, drv, bottle, hand, bong: ted.bong.clone() };
}
// pose: { walk (0..1 phase speed), t, sit, drink, cheer, panic, dance }
function poseTed(R, s) {
  const d = R.drv, t = s.t;
  const sw = s.walk ? Math.sin(t * 11) * 0.55 * s.walk : 0, bob = s.walk ? Math.abs(Math.sin(t * 11)) * 0.02 * s.walk : Math.sin(t * 2) * 0.004;
  let armR = qa(1, 0, 0, 1.25), armL = qa(1, 0, 0, -1.25); // arms down from the T-pose
  if (s.cheer) { const w = Math.sin(t * 14) * 0.25; armR = qa(1, 0, 0, -0.6 + w); armL = qa(1, 0, 0, 0.6 - w); }
  else if (s.panic) { armR = qa(1, 0, 0, -0.2 + Math.sin(t * 20) * 0.5); armL = qa(1, 0, 0, 0.2 - Math.sin(t * 20 + 1) * 0.5); }
  else if (s.dance) { const k = Math.sin(t * 6); armR = qa(0, 0, 1, 1.0 * k).multiply(qa(1, 0, 0, 0.4)); armL = qa(0, 0, 1, -1.0 * k).multiply(qa(1, 0, 0, -0.4)); }
  else if (s.drink != null) { const lift = Math.max(0, Math.sin(s.drink * Math.PI)); armR = qa(0, 0, 1, 1.3 * lift + 0.6).multiply(qa(1, 0, 0, 1.25 - 0.7 * lift)); armL = qa(1, 0, 0, -1.1); }
  else { armR = qa(0, 0, 1, -sw * 0.8).multiply(armR); armL = qa(0, 0, 1, sw * 0.8).multiply(armL); }
  d.armR && d.armR(armR); d.armL && d.armL(armL);
  if (s.sit) {
    d.thighR && d.thighR(qa(0, 0, 1, 1.45)); d.thighL && d.thighL(qa(0, 0, 1, 1.45));
    d.shinR && d.shinR(qa(0, 0, 1, -1.35)); d.shinL && d.shinL(qa(0, 0, 1, -1.35));
    d.chest && d.chest(qa(0, 0, 1, -0.12));
  } else {
    d.thighR && d.thighR(qa(0, 0, 1, sw)); d.thighL && d.thighL(qa(0, 0, 1, -sw));
    d.shinR && d.shinR(qa(0, 0, 1, -Math.max(0, -sw) * 0.9)); d.shinL && d.shinL(qa(0, 0, 1, -Math.max(0, sw) * 0.9));
    d.chest && d.chest(qa(0, 0, 1, s.walk ? 0.12 * s.walk : 0).multiply(qa(1, 0, 0, s.dance ? Math.sin(t * 6) * 0.15 : 0)));
  }
  d.head && d.head(qa(0, 0, 1, s.drink != null ? -0.35 * Math.max(0, Math.sin(s.drink * Math.PI)) : Math.sin(t * 1.3) * 0.06).multiply(qa(0, 1, 0, s.look || 0)));
  R.holder.position.y = bob + (s.sit ? 0.09 : 0) + (s.hop || 0);
}

// ---------------- Rosy (a little dog) ----------------
function makeRosy() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const fur = new THREE.MeshStandardMaterial({ color: 0xd99a7e, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x5a3426, roughness: 0.8 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe0507a, roughness: 0.5 }), black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
  const add = (parent, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
  const sph = new THREE.SphereGeometry(1, 16, 12), cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  add(body, sph, fur, 0, 0.26, 0, 0.13, 0.12, 0.24);
  const head = new THREE.Group(); head.position.set(0, 0.36, 0.2); body.add(head);
  add(head, sph, fur, 0, 0, 0, 0.11, 0.1, 0.11); add(head, sph, fur, 0, -0.025, 0.09, 0.06, 0.05, 0.07); add(head, sph, black, 0, -0.01, 0.155, 0.02, 0.016, 0.014);
  for (const s of [-1, 1]) { add(head, sph, black, s * 0.045, 0.03, 0.09, 0.016, 0.018, 0.012); const ear = add(head, sph, dark, s * 0.08, 0.06, -0.01, 0.035, 0.07, 0.02); ear.rotation.z = s * 0.5; }
  add(head, cyl, pink, 0, -0.09, -0.02, 0.085, 0.022, 0.085); // collar
  const legs = []; for (const [x, z] of [[-0.07, 0.14], [0.07, 0.14], [-0.07, -0.14], [0.07, -0.14]]) { const g = new THREE.Group(); g.position.set(x, 0.2, z); body.add(g); add(g, cyl, fur, 0, -0.1, 0, 0.032, 0.2, 0.032); add(g, sph, dark, 0, -0.2, 0.01, 0.036, 0.02, 0.045); legs.push(g); }
  const tail = new THREE.Group(); tail.position.set(0, 0.32, -0.22); body.add(tail); add(tail, cyl, fur, 0, 0.06, -0.02, 0.022, 0.14, 0.022).rotation.x = -0.5;
  return { kind: 'rosy', root, body, head, legs, tail };
}
function poseRosy(R, s) {
  const t = s.t, sw = s.walk ? Math.sin(t * 14) * 0.6 * s.walk : 0;
  R.legs.forEach((g, i) => { g.rotation.x = s.lie ? (i < 2 ? -1.3 : 1.3) : (i === 0 || i === 3 ? sw : -sw); });
  R.tail.rotation.y = Math.sin(t * (s.cheer || s.dance ? 26 : s.lie ? 3 : 12)) * (s.lie ? 0.25 : 0.7);
  R.tail.rotation.x = s.panic ? 0.9 : 0;
  R.body.position.y = s.lie ? -0.15 : (s.walk ? Math.abs(Math.sin(t * 14)) * 0.025 * s.walk : 0) + (s.hop || 0) + (s.dance ? Math.abs(Math.sin(t * 6)) * 0.08 : 0);
  R.body.rotation.z = s.dance ? Math.sin(t * 6) * 0.25 : 0;
  R.head.rotation.x = s.lie ? 0.35 : s.cheer ? -0.4 : Math.sin(t * 1.7) * 0.08;
  R.head.rotation.y = s.look || 0;
}

// ---------------- props ----------------
function makeChair() {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 }), cloth = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 0.9, side: THREE.DoubleSide });
  const leg = new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6);
  for (const [x, z, rx] of [[-0.14, 0.12, 0.35], [0.14, 0.12, 0.35], [-0.14, -0.12, -0.35], [0.14, -0.12, -0.35]]) { const m = new THREE.Mesh(leg, frame); m.position.set(x, 0.16, z); m.rotation.x = rx; g.add(m); }
  const seat = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.26), cloth); seat.rotation.x = -Math.PI / 2 + 0.08; seat.position.y = 0.3; g.add(seat);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), cloth); back.position.set(0, 0.46, -0.14); back.rotation.x = -0.2; g.add(back);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------- the sidekick ----------------
export class Sidekick {
  constructor(scene, M, kind, ownerId) {
    this.scene = scene; this.M = M; this.kind = kind; this.ownerId = ownerId;
    this.rig = kind === 'ted' && ted ? makeTedRig() : makeRosy();
    this.real = this.rig.kind === kind;
    this.x = 0; this.z = 0; this.yaw = 0; this.t = Math.random() * 10; this.placed = false;
    this.mood = null; this.moodT = 0; this.drinkT = 0; this.stuck = 0; this.side = Math.random() < 0.5 ? -1 : 1;
    scene.add(this.rig.root);
  }
  dispose() { this.scene.remove(this.rig.root); if (this.camp) this.scene.remove(this.camp); }
  react(mood, time = 1.6) { this.mood = mood; this.moodT = time; }
  // owner: the player (or null); env.smoke(x, y, z) for Ted's puffs
  update(dt, owner, env) {
    this.t += dt;
    if (this.kind === 'ted' && !this.real && ted) { this.dispose(); this.rig = makeTedRig(); this.real = true; this.scene.add(this.rig.root); }
    const R = this.rig;
    if (!owner) { R.root.visible = false; return; }
    if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) this.mood = null; }
    const dead = owner.st === 'dead', gone = owner.st === 'out' || owner.st === 'ghost';
    // Ted sets up camp (chair, beer, bong) by a dead owner, and also while they repair a generator
    // or sit in a cage; Rosy lies down beside them
    const campMode = dead ? 'dead' : owner.st === 'caged' ? 'cage' : (owner.act && owner.act.k === 'repair') ? 'repair' : null;
    if (this.campMode !== campMode) { this.campMode = campMode; this.deadAt = null; }
    R.root.visible = !gone && env.visible !== false;
    if (!this.placed) { this.x = owner.x + 1; this.z = owner.z - 0.6; this.placed = true; }
    const pose = { t: this.t };
    if (campMode) {
      // sit by the owner: Ted with a chair, a beer and his bong, Rosy lying down
      if (!this.deadAt) {
        const off = campMode === 'cage' ? 1.4 : 1.1, a = (owner.yaw || 0) + (campMode === 'repair' ? Math.PI * 0.75 : 0);
        const x = owner.x + Math.cos(a) * off, z = owner.z - Math.sin(a) * off;
        this.deadAt = { x, z, yaw: Math.atan2(owner.x - x, owner.z - z) };
      }
      const D = this.deadAt;
      this.x += (D.x - this.x) * Math.min(1, dt * 3); this.z += (D.z - this.z) * Math.min(1, dt * 3); this.yaw = D.yaw;
      if (R.kind === 'ted') {
        if (!this.camp) {
          this.camp = new THREE.Group(); const chair = makeChair(); this.camp.add(chair);
          R.bong.position.set(0.24, 0, 0.12); this.camp.add(R.bong);
          this.scene.add(this.camp);
          R.hand.add(R.bottle); R.bottle.position.set(0, 0, 0); R.bottle.scale.setScalar(R.bottle.scale.x / (R.hand.getWorldScale(new THREE.Vector3()).x || 1));
        }
        this.camp.position.set(D.x, 0, D.z); this.camp.rotation.y = D.yaw;
        pose.sit = true;
        this.drinkT += dt;
        const cyc = this.drinkT % 7;
        if (cyc < 1.4) pose.drink = cyc / 1.4;
        if (cyc > 4 && cyc < 4 + dt * 1.01) env.smoke && env.smoke(D.x + Math.sin(D.yaw) * 0.1, 0.62, D.z + Math.cos(D.yaw) * 0.1);
        R.root.position.set(this.x, 0.13, this.z);
      } else { pose.lie = true; R.root.position.set(this.x, 0, this.z); }
      R.root.rotation.y = this.yaw;
      R.kind === 'ted' ? poseTed(R, pose) : poseRosy(R, pose);
      return;
    }
    if (this.camp) { this.scene.remove(this.camp); this.camp = null; R.hand && R.hand.remove(R.bottle); this.deadAt = null; }
    this.deadAt = null;
    // follow: a spot just behind and beside the owner; run to keep up, teleport if lost
    const ox = owner.x, oz = owner.z, oy = owner.yaw || 0;
    const tx = ox - Math.sin(oy) * 1.1 + Math.cos(oy) * 0.7 * this.side, tz = oz - Math.cos(oy) * 1.1 - Math.sin(oy) * 0.7 * this.side;
    const dx = tx - this.x, dz = tz - this.z, dist = Math.hypot(dx, dz);
    if (dist > 14 || owner.st === 'carried' || owner.st === 'caged') {
      if (dist > 14) { this.x = tx; this.z = tz; }
    }
    let speed = 0;
    if (this.mood === 'panic') { // run circles around the owner
      const a = this.t * 4; const px = ox + Math.cos(a) * 1.3, pz = oz + Math.sin(a) * 1.3;
      speed = 4.5; this.stepTo(px, pz, speed, dt);
    } else if (dist > 0.35) {
      speed = Math.min(6.5, dist * 2.4 + (owner.mv === 2 ? 2 : 0));
      this.stepTo(tx, tz, speed, dt);
    } else this.yaw += Math.atan2(Math.sin(oy - this.yaw), Math.cos(oy - this.yaw)) * Math.min(1, dt * 3);
    pose.walk = Math.min(1, speed / 3.5);
    pose.cheer = this.mood === 'cheer'; pose.panic = this.mood === 'panic'; pose.dance = this.mood === 'dance' || owner.emote === 1;
    pose.hop = this.mood === 'jump' ? Math.abs(Math.sin(this.moodT * 7)) * 0.18 : pose.cheer ? Math.abs(Math.sin(this.t * 9)) * 0.08 : 0;
    if (owner.emote && owner.emote !== 1) pose.cheer = true;
    R.root.position.set(this.x, 0, this.z); R.root.rotation.y = this.yaw;
    R.kind === 'ted' ? poseTed(R, pose) : poseRosy(R, pose);
  }
  stepTo(x, z, speed, dt) {
    const dx = x - this.x, dz = z - this.z, d = Math.hypot(dx, dz) || 1, step = Math.min(d, speed * dt);
    const r = moveCircle(this.M, null, this.x, this.z, dx / d * step, dz / d * step, 0.18, 1.0);
    const moved = Math.hypot(r.x - this.x, r.z - this.z);
    this.stuck = moved < step * 0.2 ? this.stuck + dt : 0;
    if (this.stuck > 1.2) { this.x = x; this.z = z; this.stuck = 0; } else { this.x = r.x; this.z = r.z; }
    if (moved > 1e-3) this.yaw += Math.atan2(Math.sin(Math.atan2(dx, dz) - this.yaw), Math.cos(Math.atan2(dx, dz) - this.yaw)) * Math.min(1, dt * 10);
  }
}

// for menus: a sidekick standing in the showroom
export function makeSidekickModel(kind) {
  const R = kind === 'ted' && ted ? makeTedRig() : makeRosy();
  const pose = { t: 0 };
  R.pose = t => { pose.t = t; R.kind === 'ted' ? poseTed(R, pose) : poseRosy(R, pose); };
  R.pose(0);
  return R;
}
// (exposed for the pose-test page)
export const __poseTed = poseTed, __poseRosy = poseRosy;
