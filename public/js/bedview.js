// Nightcraft Bedwars: the screen. Draws the block world, the players (Nightbound's own characters),
// the HUD, the inventory and the shop, and turns the keyboard and mouse into moves. The rules live
// in bedwars.js; online, the host's game runs them and everyone else mirrors it (see `net`).
import * as THREE from 'three';
import { BedWorld, B, isBed, TEAM_DEFS, BW_MAPS, TOP, VOID, HP, SWORDS, ARMOR, PICKS, SHOP, RES, INV, ITEMS, itemCount, itemName, COOLDOWN19, WORLD, CH, GEN, EYE, HIT } from './bedwars.js';
import { atlas, buildChunk, itemMesh, itemCanvas, blockIcon, crackTex, tileCanvas } from './bedart.js';
import { makeSurvivor, makeKiller, animate } from './models.js';
import { KILLERS, SURVIVORS, skinOf } from './config.js';
import { sound } from './audio.js';

const RESCOL = { iron: '#e8e8f0', gold: '#ffd040', diamond: '#5af0f0', emerald: '#4ae870' };
const KEYS = Object.keys(ITEMS);
const ICON = {}; // data URLs for the HUD
const iconURL = (key, p, team) => {
  const id = key === 'sword' ? 'sword' + p.sword : key === 'pick' ? 'pick' + p.pick : key === 'wool' ? 'wool' + team : key;
  if (ICON[id]) return ICON[id];
  const c = key === 'wool' ? blockIcon(B.WOOL + team) : key === 'plank' ? blockIcon(B.PLANK) : key === 'end' ? blockIcon(B.END) : itemCanvas(key, key === 'sword' ? p.sword : key === 'pick' ? p.pick : 0);
  return ICON[id] = c.toDataURL();
};
const CSS = `
#bw{position:fixed;inset:0;z-index:30;pointer-events:none;font-family:'Barlow','Segoe UI',sans-serif;color:#fff;user-select:none;--px:3px}
#bw img{image-rendering:pixelated}
#bw .cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px}
#bw .cross:before,#bw .cross:after{content:'';position:absolute;background:#fff;mix-blend-mode:difference}
#bw .cross:before{left:8px;top:0;width:2px;height:18px}#bw .cross:after{top:8px;left:0;height:2px;width:18px}
#bw .charge{position:absolute;left:50%;top:calc(50% + 14px);width:32px;height:4px;margin-left:-16px;background:rgba(0,0,0,.45);display:none}#bw .charge i{display:block;height:100%;background:#fff}
#bw .hot{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:flex;background:rgba(0,0,0,.35);border:3px solid #1c1c1c;box-shadow:inset 0 0 0 2px #8b8b8b}
#bw .slot{width:48px;height:48px;position:relative;display:flex;align-items:center;justify-content:center;border:2px solid #555;border-color:#373737 #fff #fff #373737;background:#8b8b8b33;margin:1px}
#bw .hot .slot{background:transparent;border-color:#5a5a5a}
#bw .hot .slot.on{outline:3px solid #fff;outline-offset:-1px;z-index:1}
#bw .slot img{width:34px;height:34px}
#bw .slot.dim img{opacity:.25}
#bw .slot b{position:absolute;right:3px;bottom:0;font-size:15px;font-family:monospace;font-weight:700;text-shadow:2px 2px 0 #3f3f3f}
#bw .slot i{position:absolute;left:3px;top:1px;font-style:normal;opacity:.45;font-size:10px}
#bw .bars{position:absolute;left:50%;bottom:72px;transform:translateX(-50%);width:494px;display:flex;justify-content:space-between;align-items:flex-end}
#bw .bars .row{display:flex;gap:1px}#bw .bars img{width:18px;height:18px}
#bw .iname{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);font-size:16px;font-weight:700;text-shadow:2px 2px 0 #3f3f3f;transition:opacity .4s}
#bw .res{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:3px;font-size:15px;font-weight:700;align-items:flex-end}
#bw .res span{display:flex;align-items:center;gap:6px;text-shadow:2px 2px 0 #222}#bw .res img{width:20px;height:20px}
#bw .side{position:absolute;right:10px;top:40%;transform:translateY(-50%);background:rgba(0,0,0,.4);padding:6px 10px 8px;font-size:14px;line-height:1.55;min-width:150px}
#bw .side h4{margin:0 0 4px;text-align:center;color:#ffd75a;font-size:14px;letter-spacing:.06em}
#bw .side .me{font-weight:800}#bw .side .t{opacity:.75;font-size:12px;margin-top:4px;text-align:center}
#bw .feed{position:absolute;left:8px;bottom:110px;font-size:14px;line-height:1.4;max-width:46vw}
#bw .feed div{background:rgba(0,0,0,.35);padding:1px 6px;margin-top:2px;text-shadow:1px 1px 0 #222}
#bw .big{position:absolute;left:0;right:0;top:24%;text-align:center;font-size:48px;font-weight:800;letter-spacing:.04em;text-shadow:4px 4px 0 #3f3f3f;transition:opacity .4s;opacity:0}
#bw .big small{display:block;font-size:20px;font-weight:600;margin-top:8px;text-shadow:2px 2px 0 #3f3f3f}
#bw .hint{position:absolute;left:50%;top:62%;transform:translateX(-50%);font-size:14px;opacity:.9;text-shadow:1px 1px 0 #000;white-space:nowrap}
#bw .hurt{position:absolute;inset:0;box-shadow:inset 0 0 140px rgba(200,0,0,.7);opacity:0;transition:opacity .25s}
#bw .net{position:absolute;left:10px;top:10px;font-size:12px;opacity:.7}
#bw .modal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#c6c6c6;color:#3f3f3f;border:3px solid #000;box-shadow:inset 3px 3px 0 #fff,inset -3px -3px 0 #555;padding:14px 16px 16px;pointer-events:auto;max-width:94vw;max-height:90vh;overflow:auto}
#bw .modal h2{margin:0 0 8px;font-size:18px;color:#3f3f3f}#bw .modal p{margin:0 0 10px;font-size:13px}
#bw .modal .grid9{display:grid;grid-template-columns:repeat(9,52px);gap:0}
#bw .modal .gap{height:12px}
#bw .modal .inv-top{display:flex;gap:14px;align-items:flex-start;margin-bottom:10px}
#bw .modal .gear{display:flex;flex-direction:column;gap:0}
#bw .modal .stats{font-size:13px;line-height:1.6}
#bw .modal .slot{cursor:pointer;pointer-events:auto}
#bw .modal .slot:hover{background:#ffffff55}
#bw .cursor{position:fixed;width:34px;height:34px;pointer-events:none;z-index:40;margin:-17px 0 0 -17px}
#bw .shop{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;min-width:min(640px,88vw)}
#bw .shop button{display:flex;gap:8px;align-items:center;background:#8b8b8b;border:2px solid #000;box-shadow:inset 2px 2px 0 #c6c6c6,inset -2px -2px 0 #555;color:#fff;padding:6px 8px;text-align:left;font:inherit;cursor:pointer;text-shadow:1px 1px 0 #3f3f3f}
#bw .shop button:hover:not(:disabled){background:#a0a0d0}#bw .shop button:disabled{opacity:.45;cursor:default}
#bw .shop button img{width:32px;height:32px}#bw .shop b{display:block;font-size:14px}#bw .shop span{font-size:12px}
#bw .row{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
#bw .mc{background:#8b8b8b;border:2px solid #000;box-shadow:inset 2px 2px 0 #c6c6c6,inset -2px -2px 0 #555;color:#fff;font:inherit;font-weight:600;padding:8px 18px;cursor:pointer;text-shadow:1px 1px 0 #3f3f3f;pointer-events:auto;min-width:200px}
#bw .mc:hover{background:#a0a0d0}
#bw table{width:100%;border-collapse:collapse;font-size:14px;margin-top:6px}#bw td,#bw th{padding:3px 8px;text-align:left}#bw th{opacity:.7}
@media (max-width:760px){#bw .slot{width:36px;height:36px}#bw .slot img{width:26px;height:26px}#bw .bars{width:380px;bottom:58px}#bw .modal .grid9{grid-template-columns:repeat(9,40px)}}
`;
function label(text, css, w = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = 56; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, 8, w, 40); g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillStyle = css; g.fillText(text.slice(0, 18), w / 2, 39);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true, transparent: true })); s.scale.set(w / 160, 0.35, 1);
  s.userData.redraw = (t2, css2) => { g.clearRect(0, 0, w, 56); g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, 8, w, 40); g.fillStyle = css2 || css; g.fillText(t2, w / 2, 39); s.material.map.needsUpdate = true; };
  return s;
}
const ease = t => 1 - (1 - t) * (1 - t);

export class BedwarsGame {
  // opts: { renderer, settings, roster (with teams), cfg { map, pvp, diff }, net, mode: 'offline'|'host'|'client', myId, prefs { bridge, low }, onExit }
  constructor(o) {
    this.r = o.renderer; this.settings = o.settings; this.onExit = o.onExit; this.myId = o.myId || 'me'; this.mode = o.mode || 'offline'; this.net = o.net || null;
    this.prefs = Object.assign({ bridge: 'java', low: false }, o.prefs || {}); this.cfg = o.cfg || {};
    const roster = o.roster.map(r => ({ ...r, remote: this.mode === 'host' && !r.bot && r.id !== this.myId }));
    this.W = new BedWorld(roster, { map: this.cfg.map, pvp: this.cfg.pvp, difficulty: this.cfg.diff });
    if (this.mode === 'host') this.W.diff = [];
    this.me = this.W.P(this.myId);
    this.keys = new Set(); this.mouse = { l: false, r: false }; this.rT = 0; this.third = false; this.feedRows = []; this.t = 0; this.sprintLatch = false; this.lastW = -9;
    this.eatT = 0; this.equipT = 1; this.swingT = 9; this.lastHeld = null; this.snapT = 0; this.posT = 0;
    this.layout = this.loadLayout();
    this.build();
  }
  // ---------------- inventory layout: which item sits in which of the 36 slots (9 hotbar + 27) ----------------
  loadLayout() {
    let L = null; try { L = JSON.parse(localStorage.getItem('nb_bw_layout')); } catch (_) {}
    if (!Array.isArray(L) || L.length !== 36) L = ['sword', 'wool', 'plank', 'end', 'apple', 'pick', null, null, null, 'iron', 'gold', 'diamond', 'emerald', ...Array(23).fill(null)];
    for (const k of KEYS) if (!L.includes(k)) L[L.indexOf(null)] = k;
    return L.map(k => (k && ITEMS[k] ? k : null));
  }
  saveLayout() { try { localStorage.setItem('nb_bw_layout', JSON.stringify(this.layout)); } catch (_) {} }
  heldKey() { const k = this.layout[this.me.slot]; return k && itemCount(this.me, k) > 0 ? k : 'hand'; }

  build() {
    const low = this.prefs.low, sc = this.scene = new THREE.Scene();
    this.prevPR = this.r.getPixelRatio(); this.r.setPixelRatio(low ? 0.6 : Math.min(devicePixelRatio || 1, 1.5));
    sc.background = new THREE.Color(0x0b1024); sc.fog = new THREE.Fog(0x0b1024, low ? 30 : 55, low ? 75 : 140);
    this.cam = new THREE.PerspectiveCamera(this.settings.fov || 75, innerWidth / innerHeight, 0.05, low ? 90 : 400);
    sc.add(new THREE.HemisphereLight(0x9aa8e0, 0x2a2018, 1.4));
    const moon = new THREE.DirectionalLight(0xd0daff, 1.5); moon.position.set(-30, 60, 20); sc.add(moon);
    sc.add(new THREE.AmbientLight(0x404858, 0.55));
    // the night sky: stars and a square moon
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < (low ? 250 : 900); i++) { const a = Math.random() * 6.28, e = Math.random() * 1.2 + 0.05, R = 250; sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.sky = new THREE.Group(); sc.add(this.sky);
    this.sky.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, fog: false })));
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.MeshBasicMaterial({ color: 0xf4f0d8, fog: false })); mm.position.set(-120, 150, 80); mm.lookAt(0, 0, 0); this.sky.add(mm);
    // the blocks, in 16x16 chunks
    this.chunkMat = low ? new THREE.MeshBasicMaterial({ map: atlas(), vertexColors: true }) : new THREE.MeshLambertMaterial({ map: atlas(), vertexColors: true });
    this.chunks = new Map();
    const { NX, NZ } = WORLD;
    for (let cx = 0; cx < NX / CH; cx++) for (let cz = 0; cz < NZ / CH; cz++) this.rebuildChunk(cx, cz);
    this.W.dirtyChunks.clear(); this.W.dirty = false;
    // generator lights (not on low-end machines)
    if (!low) for (const gn of this.W.gens) { const L = new THREE.PointLight(gn.kind === 'forge' ? 0xffb060 : gn.kind === 'diamond' ? 0x60e8ff : 0x60ff80, 7, 11); L.position.set(gn.x, gn.y + 1.4, gn.z); sc.add(L); }
    // generator holograms
    this.holo = this.W.gens.filter(g => g.kind !== 'forge').map(gn => { const l = label('', '#fff', 320); l.position.set(gn.x, gn.y + 2.6, gn.z); sc.add(l); return { gn, l, last: '' }; });
    // beds
    const bedMat = c => new THREE.MeshLambertMaterial({ color: c });
    this.bedMeshes = this.W.teams.map((T, ti) => {
      const g = new THREE.Group(), [a, b] = this.W.beds[ti].cells, along = a[0] !== b[0];
      const cx = (a[0] + b[0]) / 2 + 0.5, cz = (a[2] + b[2]) / 2 + 0.5;
      const sheet = new THREE.CanvasTexture(tileCanvas('wool')); sheet.magFilter = THREE.NearestFilter;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(along ? 2 : 1, 0.3, along ? 1 : 2), bedMat(0x6a4a2a)); frame.position.set(cx, TOP + 0.15, cz); g.add(frame);
      const blanket = new THREE.Mesh(new THREE.BoxGeometry(along ? 1.5 : 0.98, 0.26, along ? 0.98 : 1.5), new THREE.MeshLambertMaterial({ color: T.color, map: sheet }));
      blanket.position.set(a[0] + 0.5 + (b[0] - a[0]) * 0.25, TOP + 0.43, a[2] + 0.5 + (b[2] - a[2]) * 0.25); g.add(blanket);
      const pil = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.46 : 0.86, 0.24, along ? 0.86 : 0.46), new THREE.MeshLambertMaterial({ color: 0xffffff, map: sheet }));
      pil.position.set(b[0] + 0.5 + (b[0] - a[0]) * 0.22, TOP + 0.42, b[2] + 0.5 + (b[2] - a[2]) * 0.22); g.add(pil);
      for (const c of [a, b]) for (const [u, v] of [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 0.12), bedMat(0x4a3018)); leg.position.set(c[0] + u, TOP + 0.075, c[2] + v); }
      sc.add(g); return g;
    });
    // the shopkeepers
    this.keepers = [];
    for (const T of this.W.teams) {
      const R = makeSurvivor(SURVIVORS.june, {}); R.root.position.set(T.shop.x, TOP, T.shop.z); R.root.rotation.y = Math.atan2(T.x - T.shop.x + 0.01, T.z - T.shop.z); sc.add(R.root);
      animate(R, { anim: 'idle', speed: 0, t: 0 }, 0.1); this.keepers.push(R);
      const l = label('ITEM SHOP', '#ffd75a'); l.position.set(T.shop.x, TOP + 2.35, T.shop.z); sc.add(l);
      const l2 = label('Press B', '#ffffff', 200); l2.position.set(T.shop.x, TOP + 2.05, T.shop.z); l2.scale.multiplyScalar(0.7); sc.add(l2);
    }
    this.pileMeshes = new Map();
    // the block you're looking at, and the cracks as it breaks
    this.sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })); sc.add(this.sel);
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.008, 1.008, 1.008), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); sc.add(this.crack);
    // first person: your blocky arm and what's in your hand
    sc.add(this.cam);
    this.fp = new THREE.Group(); this.cam.add(this.fp);
    const def = this.me.role === 'killer' ? { shirt: KILLERS[this.me.char]?.color ?? 0x444444, skin: 0x8a7a6a } : SURVIVORS[this.me.char] || SURVIVORS.mara;
    this.arm = new THREE.Group(); this.fp.add(this.arm);
    // a blocky arm reaching in from the bottom right corner, like Minecraft's
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.34), new THREE.MeshLambertMaterial({ color: def.shirt ?? 0x444444 })); sleeve.position.z = 0.2; this.arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.096, 0.1), new THREE.MeshLambertMaterial({ color: def.skin ?? 0xc8a080 })); hand.position.z = -0.01; this.arm.add(hand);
    this.handSlot = new THREE.Group(); this.handSlot.position.set(0, 0.03, -0.05); this.arm.add(this.handSlot);
    this.heldMesh = null; this.heldId = '';
    // players
    this.rigs = new Map();
    for (const p of this.W.players) {
      let R = null;
      try { R = p.role === 'killer' ? makeKiller(p.char, skinOf(p.char, p.skin)) : makeSurvivor(SURVIVORS[p.char] || SURVIVORS.mara, skinOf(p.char, p.skin)); } catch (e) { R = makeSurvivor(SURVIVORS.mara, {}); }
      const h = new THREE.Box3().setFromObject(R.root).getSize(new THREE.Vector3()).y; if (h > 2.05) R.root.scale.multiplyScalar(1.9 / h);
      const g = new THREE.Group(); g.add(R.root); sc.add(g);
      const tag = label(p.name, this.W.teams[p.team].css); tag.position.y = 2.3; tag.visible = p.id !== this.myId; g.add(tag);
      this.rigs.set(p.id, { g, R, tag, item: null, itemId: '' });
    }
    // the HUD
    if (!document.getElementById('bw-css')) { const st = document.createElement('style'); st.id = 'bw-css'; st.textContent = CSS; document.head.appendChild(st); }
    const H = this.hud = document.createElement('div'); H.id = 'bw';
    H.innerHTML = `<div class="hurt"></div><div class="cross"></div><div class="charge"><i></i></div><div class="net"></div><div class="feed"></div><div class="side"></div><div class="big"></div><div class="hint"></div><div class="iname"></div><div class="res"></div><div class="bars"><div class="row hearts"></div><div class="row armor"></div></div><div class="hot"></div><div class="modalbox"></div><img class="cursor" style="display:none">`;
    document.body.appendChild(H);
    this.$ = s => H.querySelector(s);
  }
  rebuildChunk(cx, cz) {
    const k = cx + ',' + cz, old = this.chunks.get(k);
    if (old) { this.scene.remove(old); old.geometry.dispose(); this.chunks.delete(k); }
    const geo = buildChunk(this.W, cx, cz, !this.prefs.low); if (!geo) return;
    const m = new THREE.Mesh(geo, this.chunkMat); m.matrixAutoUpdate = false; m.updateMatrix(); this.scene.add(m); this.chunks.set(k, m);
  }

  // ---------------- input ----------------
  start() {
    const c = this.r.domElement;
    this.on = {
      kd: e => {
        if (this.dead) return;
        if (e.code === 'ControlLeft' || e.code === 'ControlRight') { e.preventDefault(); this.sprintLatch = true; }
        if (e.repeat) return;
        this.keys.add(e.code); sound.init();
        if (this.modal) {
          if (e.code === 'Escape' || (e.code === 'KeyE' && this.modal === 'inv') || (e.code === 'KeyB' && this.modal === 'shop')) this.closeModal();
          if (this.modal === 'inv' && /^Digit[1-9]$/.test(e.code) && this.hover != null) { const i = +e.code.slice(5) - 1; [this.layout[i], this.layout[this.hover]] = [this.layout[this.hover], this.layout[i]]; this.saveLayout(); this.renderInv(); }
          return;
        }
        if (e.code === 'KeyW') { if (this.t - this.lastW < 0.3) this.sprintLatch = true; this.lastW = this.t; }
        if (/^Digit[1-9]$/.test(e.code)) this.me.slot = +e.code.slice(5) - 1;
        if (e.code === 'KeyV' || e.code === 'F5') { this.third = !this.third; e.preventDefault(); }
        if (e.code === 'KeyE') this.openInv();
        if (e.code === 'KeyB') this.openShop();
        if (e.code === 'Tab') e.preventDefault();
      },
      ku: e => { this.keys.delete(e.code); if (e.code === 'KeyW') this.sprintLatch = false; },
      md: e => {
        if (this.dead || this.ended) return;
        if (this.modal) return;
        if (document.pointerLockElement !== c) { this.lock(); return; }
        if (e.button === 0) { this.mouse.l = true; this.click(); }
        if (e.button === 2) { this.mouse.r = true; this.rT = 0; this.use(); }
      },
      mu: e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) { this.mouse.r = false; this.eatT = 0; } },
      mm: e => {
        if (this.modal) { const cur = this.$('.cursor'); cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; return; }
        if (document.pointerLockElement !== c) return;
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
        const s = (this.settings.sens || 1) * 0.0022, inv = this.settings.invert ? -1 : 1;
        this.me.yaw -= e.movementX * s; this.me.pitch = Math.max(-1.55, Math.min(1.55, this.me.pitch - e.movementY * s * inv));
      },
      wh: e => { if (this.modal) return; this.me.slot = (this.me.slot + (e.deltaY > 0 ? 1 : 8)) % 9; },
      pl: () => { if (document.pointerLockElement !== c && !this.modal && !this.ended && !this.dead) this.openPause(); },
      rs: () => { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); this.r.setSize(innerWidth, innerHeight); },
      cm: e => e.preventDefault(),
      bu: e => { if (!this.ended) { e.preventDefault(); e.returnValue = ''; } }, // Ctrl+W by accident: ask first
    };
    addEventListener('keydown', this.on.kd); addEventListener('keyup', this.on.ku);
    c.addEventListener('mousedown', this.on.md); addEventListener('mouseup', this.on.mu); addEventListener('mousemove', this.on.mm);
    addEventListener('wheel', this.on.wh, { passive: true }); document.addEventListener('pointerlockchange', this.on.pl); addEventListener('resize', this.on.rs); c.addEventListener('contextmenu', this.on.cm);
    addEventListener('beforeunload', this.on.bu);
    this.on.rs();
    const T = this.W.teams[this.me.team];
    this.big(`<span style="color:${T.css}">${T.name} team</span>`, `${BW_MAPS[this.W.map].name} · ${this.W.pvp} PvP · protect your bed, break theirs`, 4);
    this.feed('Collect iron and gold at your forge, buy blocks at the shop (B), and bridge across.');
    this.last = performance.now();
    const loop = () => { if (this.dead) return; this.raf = requestAnimationFrame(loop); const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; try { this.frame(dt); } catch (e) { console.error(e); } };
    loop();
    // online, the game must keep running for everyone even if the host switches tabs
    if (this.mode === 'host') this.bgTimer = setInterval(() => { if (document.hidden && !this.dead) { const now = performance.now(), dt = Math.min(0.25, (now - this.last) / 1000); this.last = now; this.simStep(dt); } }, 50);
    this.lock();
  }
  lock() {
    const c = this.r.domElement;
    const plain = () => { try { const q = c.requestPointerLock(); if (q && q.catch) q.catch(() => {}); } catch (_) {} };
    try { const p = c.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(e => { if (e && e.name === 'NotSupportedError') plain(); }); } catch (_) { plain(); }
    // in fullscreen, Ctrl+W can't close the tab while sprinting
    try { if (navigator.keyboard && navigator.keyboard.lock && document.fullscreenElement) navigator.keyboard.lock(['KeyW', 'ControlLeft']); } catch (_) {}
  }
  // left click: hit whoever is in front of you, otherwise start breaking / swing at the air
  click() {
    const p = this.me; if (!p.alive) return;
    this.swingT = 0; p.held = this.heldKey();
    const o = this.W.meleeTarget(p);
    if (this.mode === 'client') {
      this.sendAct({ a: 'atk', id: o ? o.id : null });
      if (o) { sound.play('swing', p.x, p.z); if (this.W.pvp === '1.8') this.sprintLatch = false; }
      p.atkT = 0;
      return;
    }
    if (this.W.attack(p, o || null)) { sound.play('swing', p.x, p.z); if (this.W.pvp === '1.8') this.sprintLatch = false; }
  }
  use() {
    const p = this.me; if (!p.alive) return;
    const k = this.heldKey();
    if (k === 'apple') return; // eaten by holding (see frame)
    if (!ITEMS[k] || !ITEMS[k].block) return;
    p.held = k;
    const spot = this.W.placeSpot(p, this.prefs.bridge); if (!spot) return;
    const [x, y, z] = spot;
    if (this.W.place(p, x, y, z, k)) {
      this.swingT = 0; sound.play('thud', x, z);
      if (this.mode === 'client') { this.W.diff = null; this.sendAct({ a: 'place', x, y, z, k }); }
    }
  }
  sendAct(m) { if (this.net) this.net.send({ t: 'bwa', ...m }); }
  openPause() {
    this.modal = 'pause'; document.exitPointerLock && document.exitPointerLock();
    const box = this.$('.modalbox'), P = this.prefs;
    box.innerHTML = `<div class="modal" style="text-align:center"><h2>Game menu</h2>
      <div class="row" style="flex-direction:column;align-items:center">
      <button class="mc" data-k="resume">Back to game</button>
      <button class="mc" data-k="bridge">Bridging: ${P.bridge === 'bedrock' ? 'Bedrock' : 'Java'}</button>
      <button class="mc" data-k="low">Performance mode: ${P.low ? 'ON' : 'OFF'}${P.low !== this.lowAtStart() ? ' (next match)' : ''}</button>
      <button class="mc" data-k="view">View: ${this.third ? 'Third person' : 'First person'}</button>
      <button class="mc" data-k="leave">${this.mode === 'host' ? 'End match for everyone' : 'Leave match'}</button></div>
      <p style="margin-top:10px">Bridging: <b>Java</b> places on the face you aim at (sneak with Shift to bridge safely). <b>Bedrock</b> also places in front of the block you stand on when you look down past its edge.</p></div>`;
    box.querySelector('[data-k=resume]').onclick = () => this.closeModal();
    box.querySelector('[data-k=bridge]').onclick = () => { P.bridge = P.bridge === 'bedrock' ? 'java' : 'bedrock'; this.savePrefs(); this.openPause(); };
    box.querySelector('[data-k=low]').onclick = () => { P.low = !P.low; this.savePrefs(); this.openPause(); };
    box.querySelector('[data-k=view]').onclick = () => { this.third = !this.third; this.openPause(); };
    box.querySelector('[data-k=leave]').onclick = () => this.exit({ leave: true });
  }
  lowAtStart() { return this.chunkMat.isMeshBasicMaterial; }
  savePrefs() { try { localStorage.setItem('nb_bw_prefs', JSON.stringify(this.prefs)); } catch (_) {} if (this.onPrefs) this.onPrefs(this.prefs); }
  closeModal() { this.modal = null; this.held = null; this.$('.modalbox').innerHTML = ''; this.$('.cursor').style.display = 'none'; this.lock(); }

  // ---------------- inventory (E) ----------------
  openInv() {
    if (!this.me.alive || this.ended) return;
    this.modal = 'inv'; this.held = null; document.exitPointerLock && document.exitPointerLock(); this.renderInv();
  }
  slotHTML(i) {
    const k = this.layout[i], p = this.me, n = k ? itemCount(p, k) : 0;
    return `<div class="slot ${k && !n ? 'dim' : ''}" data-i="${i}" title="${k ? itemName(p, k) : ''}">${k ? `<img src="${iconURL(k, p, p.team)}">` : ''}${n > 1 ? `<b>${n}</b>` : ''}</div>`;
  }
  renderInv() {
    const p = this.me, box = this.$('.modalbox');
    const g = (a, b) => Array.from({ length: b - a }, (_, j) => this.slotHTML(a + j)).join('');
    box.innerHTML = `<div class="modal"><h2>Inventory</h2>
      <div class="inv-top"><div class="gear"><div class="slot" title="${ARMOR[p.armor].name}">${p.armor ? `<img src="${itemCanvas('armor', p.armor).toDataURL()}">` : ''}</div></div>
      <div class="stats"><b>${SWORDS[p.sword].name}</b> · ${ARMOR[p.armor].name} · ${PICKS[p.pick].name}<br>Kills ${p.kills} · Final kills ${p.finals} · Beds ${p.bedsBroken}<br><small>Click to pick up and put down · Shift-click to move between the hotbar and your bag · hover and press 1-9 to swap with the hotbar</small></div></div>
      <div class="grid9">${g(9, 36)}</div><div class="gap"></div><div class="grid9">${g(0, 9)}</div>
      <div class="row"><button class="mc" data-k="close">Done (E)</button></div></div>`;
    box.querySelector('[data-k=close]').onclick = () => this.closeModal();
    box.querySelectorAll('.slot[data-i]').forEach(el => {
      const i = +el.dataset.i;
      el.onmouseenter = () => { this.hover = i; }; el.onmouseleave = () => { if (this.hover === i) this.hover = null; };
      el.onmousedown = e => {
        e.preventDefault();
        const L = this.layout;
        if (e.shiftKey && L[i]) {
          // shift-click: to the other part of the inventory
          const range = i < 9 ? [9, 36] : [0, 9]; let j = -1; for (let k = range[0]; k < range[1]; k++) if (!L[k]) { j = k; break; }
          if (j >= 0) { L[j] = L[i]; L[i] = null; }
        } else if (this.held == null) { if (L[i]) { this.held = L[i]; L[i] = null; } }
        else { const t = L[i]; L[i] = this.held; this.held = t; }
        const cur = this.$('.cursor');
        if (this.held) { cur.src = iconURL(this.held, this.me, this.me.team); cur.style.display = 'block'; cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; } else cur.style.display = 'none';
        if (!this.held) this.saveLayout();
        sound.play('click'); this.renderInv();
      };
    });
  }
  // ---------------- shop (B) ----------------
  openShop() {
    const p = this.me; if (!p.alive || this.ended) return;
    if (!this.W.atHome(p)) { this.feed('The item shop is on your island.'); return; }
    this.modal = 'shop'; document.exitPointerLock && document.exitPointerLock(); this.renderShop();
  }
  renderShop() {
    const p = this.me, box = this.$('.modalbox');
    const icon = it => { const k = it.id.replace(/\d$/, ''), tier = +(it.id.match(/\d$/) || [0])[0]; return k === 'sword' ? itemCanvas('sword', tier).toDataURL() : k === 'pick' ? itemCanvas('pick', tier).toDataURL() : k === 'armor' ? itemCanvas('armor', tier).toDataURL() : iconURL(k, p, p.team); };
    const cost = c => Object.entries(c).map(([k, v]) => `<span style="color:${RESCOL[k]}">${v} ${k}</span>`).join(' + ');
    box.innerHTML = `<div class="modal"><h2>Item Shop</h2><p>${RES.map(r => `<img src="${iconURL(r, p, p.team)}" style="width:18px;vertical-align:middle"> ${p.inv[r]}`).join(' &nbsp; ')}</p><div class="shop">${SHOP.map(it => {
      const owned = it.ok && !it.ok(p), can = !owned && Object.entries(it.cost).every(([k, v]) => p.inv[k] >= v);
      return `<button data-b="${it.id}" ${can ? '' : 'disabled'}><img src="${icon(it)}"><div><b>${it.name}</b>${owned ? '<span>Owned</span>' : cost(it.cost)}</div></button>`; }).join('')}</div>
      <div class="row"><button class="mc" data-k="close">Close (B)</button></div></div>`;
    box.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
      if (this.mode === 'client') { this.sendAct({ a: 'buy', id: b.dataset.b }); sound.play('click'); setTimeout(() => this.modal === 'shop' && this.renderShop(), 250); return; }
      if (this.W.buy(p, b.dataset.b)) sound.play('click'); this.renderShop();
    });
    box.querySelector('[data-k=close]').onclick = () => this.closeModal();
  }

  // ---------------- every frame ----------------
  frame(dt) {
    const W = this.W, p = this.me; this.t += dt;
    const k = this.keys, busy = !!this.modal;
    p.move.f = busy ? 0 : (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    p.move.s = busy ? 0 : (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    p.move.jump = !busy && k.has('Space');
    p.sneak = !busy && (k.has('ShiftLeft') || k.has('ShiftRight'));
    if (p.sneak) this.sprintLatch = false; // (letting go of W ends a sprint too: see keyup)
    p.sprint = this.sprintLatch && p.move.f > 0 && !p.sneak;
    p.held = this.heldKey();
    if (p.held !== this.lastHeld) { this.equipT = 0; this.lastHeld = p.held; this.itemName(); }
    // holding left: keep hitting (1.8) or break blocks
    if (p.alive && this.mouse.l && !busy) {
      const o = W.meleeTarget(p);
      if (o) { if (W.pvp === '1.8' && p.atkCd <= 0) this.click(); p.mine = null; }
      else { if (this.swingT > 0.25) this.swingT = 0; W.mineTick(p, dt, true, (x, y, z) => this.breakAt(x, y, z)); }
    } else if (!p.mine || !p.mine.bot) p.mine = null;
    // holding right: bridge (repeats), or eat a golden apple
    if (this.mouse.r && !busy && p.alive) {
      if (p.held === 'apple') { this.eatT += dt; if (this.eatT > 1.1) { this.eatT = 0; if (this.mode === 'client') this.sendAct({ a: 'eat' }); else if (W.eat(p)) sound.play('heal'); } }
      else { this.rT += dt; if (this.rT > 0.2) { this.rT = 0.03; this.use(); } }
    }
    if (this.mode === 'client') this.clientStep(dt); else this.simStep(dt);
    this.draw(dt);
    this.updateHUD(dt);
    this.r.render(this.scene, this.cam);
  }
  breakAt(x, y, z) {
    const W = this.W, p = this.me, t = W.get(x, y, z);
    if (this.mode === 'client') { if (!isBed(t)) W.set(x, y, z, 0); this.sendAct({ a: 'brk', x, y, z }); sound.play('break', x, z); return; }
    W.breakBlock(p, x, y, z);
  }
  // offline and host: the world runs here
  simStep(dt) {
    const W = this.W;
    W.update(dt);
    const evs = W.takeEvents();
    for (const e of evs) this.onEvent(e);
    if (this.mode === 'host') {
      if (W.diff.length) { this.net.broadcast({ t: 'bwb', c: W.diff }); W.diff = []; }
      if (evs.length) this.net.broadcast({ t: 'bwe', e: evs });
      this.snapT -= dt; if (this.snapT <= 0) { this.snapT = 1 / 15; this.net.broadcast({ t: 'bws', s: W.snapshot() }, true); }
    }
    if (W.dirtyChunks.size) { for (const key of W.dirtyChunks) { const [a, b] = key.split(',').map(Number); this.rebuildChunk(a, b); } W.dirtyChunks.clear(); }
  }
  // online player: move ourselves, mirror everything else from the host
  clientStep(dt) {
    const W = this.W, p = this.me;
    if (p.alive) { W.tickTimers(p, dt); if (p.y > VOID - 20) W.physics(p, dt); }
    this.posT -= dt;
    if (this.posT <= 0 && p.alive) {
      this.posT = 1 / 20; const r = v => Math.round(v * 100) / 100;
      this.net.send({ t: 'bwp', x: r(p.x), y: r(p.y), z: r(p.z), vx: r(p.vx), vy: r(p.vy), vz: r(p.vz), yaw: r(p.yaw), pitch: r(p.pitch), f: (p.sneak ? 1 : 0) | (p.sprint ? 2 : 0) | (p.ground ? 4 : 0), h: KEYS.indexOf(p.held), tp: p.tp }, true);
    }
    // the others glide to where the host last saw them
    const k = Math.min(1, dt * 14);
    for (const o of W.players) if (o !== p && o.tx != null) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.z += (o.tz - o.z) * k; }
    if (W.dirtyChunks.size) { for (const key of W.dirtyChunks) { const [a, b] = key.split(',').map(Number); this.rebuildChunk(a, b); } W.dirtyChunks.clear(); }
  }
  // ---------------- online ----------------
  // the host: a message from a player
  remote(id, m) {
    const W = this.W, p = W.P(id);
    if (!p || !m || this.dead) return;
    if (m.t === 'bwp') {
      if (!p.remote || m.tp !== p.tp || !p.alive) return;
      const num = (v, d) => typeof v === 'number' && isFinite(v) ? v : d;
      const nx = num(m.x, p.x), ny = num(m.y, p.y), nz = num(m.z, p.z);
      if (Math.hypot(nx - p.x, nz - p.z) > 12) return; // nonsense: ignore
      Object.assign(p, { x: nx, y: ny, z: nz, vx: num(m.vx, 0), vy: num(m.vy, 0), vz: num(m.vz, 0), yaw: num(m.yaw, p.yaw), pitch: num(m.pitch, 0), sneak: !!(m.f & 1), sprint: !!(m.f & 2), ground: !!(m.f & 4), held: KEYS[m.h] || 'hand' });
      return;
    }
    if (m.t !== 'bwa' || !p.alive) return;
    const fix = (x, y, z) => this.net.send(id, { t: 'bwfix', c: [x, y, z, W.get(x, y, z)] });
    const n = v => Math.floor(+v || 0);
    switch (m.a) {
      case 'atk': { const o = m.id != null ? W.P(m.id) : null; W.attack(p, o && o.alive && Math.hypot(o.x - p.x, o.z - p.z) <= HIT + 1.8 && Math.abs(o.y - p.y) < 3.5 ? o : null); break; }
      case 'place': if (!W.place(p, n(m.x), n(m.y), n(m.z), String(m.k), 1.5)) fix(n(m.x), n(m.y), n(m.z)); break;
      case 'brk': if (!W.breakBlock(p, n(m.x), n(m.y), n(m.z), 1.5)) fix(n(m.x), n(m.y), n(m.z)); break;
      case 'buy': W.buy(p, String(m.id)); break;
      case 'eat': W.eat(p); break;
    }
  }
  playerLeft(id) { const p = this.W.P(id); if (p && p.remote) { this.W.makeBot(p); this.feed(`${this.name(id)} left: a bot takes over.`); } }
  // a player: a message from the host
  onNet(m) {
    if (this.dead || !m) return;
    const W = this.W;
    if (m.t === 'bws') W.applySnapshot(m.s, this.myId);
    else if (m.t === 'bwb' || m.t === 'bwfix') { const c = m.c || []; for (let i = 0; i + 3 < c.length; i += 4) W.set(c[i], c[i + 1], c[i + 2], c[i + 3]); }
    else if (m.t === 'bwe') for (const e of m.e || []) {
      if (e.k === 'kb' && e.id === this.myId) { const p = this.me; p.vx += e.ix; p.vz += e.iz; p.vy = Math.max(p.vy, e.iy); p.ground = false; continue; }
      if (e.k === 'win') { W.over = true; W.winner = e.team; }
      this.onEvent(e);
    }
  }

  name(id) { const q = this.W.P(id); return q ? `<b style="color:${this.W.teams[q.team].css}">${q.id === this.myId ? 'You' : q.name}</b>` : 'Someone'; }
  onEvent(e) {
    const p = this.me, W = this.W;
    switch (e.k) {
      case 'hit': sound.play('hit', e.x, e.z, { pitch: 1.4 }); if (e.id === this.myId) this.hurtT = 0.35; { const c = this.rigs.get(e.id); if (c) c.hurt = 0.3; } break;
      case 'crit': if (e.id !== this.myId) this.critT = 0.2; break;
      case 'break': sound.play('break', e.x, e.z); break;
      case 'place': break;
      case 'pickup': if (e.id === this.myId) sound.play('pickup'); break;
      case 'buy': if (e.id === this.myId) sound.play('click'); break;
      case 'eat': if (e.id === this.myId) sound.play('heal'); break;
      case 'death': {
        const fin = e.final ? ' <b style="color:#ff5a4a">FINAL KILL!</b>' : '';
        this.feed(e.by && e.by !== e.id ? `${this.name(e.id)} ${e.why === 'killed' ? 'was killed by ' + this.name(e.by) : e.why + ' by ' + this.name(e.by)}.${fin}` : `${this.name(e.id)} ${e.why}.${fin}`);
        if (e.id === this.myId) { sound.play('scream', p.x, p.z, { pitch: 1.2, len: 0.7 }); this.big(e.final ? 'ELIMINATED' : 'YOU DIED!', e.final ? 'Your bed is gone. Watch your team finish it.' : 'Respawning in 5 seconds…', 2.5); }
        break;
      }
      case 'respawn': if (e.id === this.myId) { this.big('RESPAWNED', '', 1.2); } break;
      case 'bed': {
        const T = W.teams[e.team];
        sound.play('roar', T.x, T.z, { pitch: 0.8 });
        this.feed(`<b>BED DESTRUCTION ›</b> <span style="color:${T.css}">${T.name} Bed</span> ${e.by ? 'was destroyed by ' + this.name(e.by) : 'is gone'}!`);
        if (e.team === p.team) this.big('BED DESTROYED!', 'You will no longer respawn!', 3);
        else if (e.by === this.myId) this.big('BED DESTROYED!', `${T.name} can't respawn anymore`, 2.4);
        break;
      }
      case 'sudden': this.feed('<b style="color:#ff5a4a">SUDDEN DEATH</b> › every bed is gone'); this.big('SUDDEN DEATH', 'All beds have been destroyed', 3); break;
      case 'win': this.end(e.team, e.time); break;
    }
  }
  feed(html) { this.feedRows.push({ html, t: this.t }); if (this.feedRows.length > 7) this.feedRows.shift(); this.$('.feed').innerHTML = this.feedRows.map(r => `<div>${r.html}</div>`).join(''); }
  big(t, sub, dur) { const el = this.$('.big'); el.innerHTML = `${t}${sub ? `<small>${sub}</small>` : ''}`; el.style.opacity = t ? 1 : 0; clearTimeout(this.bigT); if (dur) this.bigT = setTimeout(() => { el.style.opacity = 0; }, dur * 1000); }
  itemName() { const el = this.$('.iname'); if (!el) return; const k = this.me.held; el.textContent = k === 'hand' ? '' : itemName(this.me, k); el.style.opacity = 1; clearTimeout(this.inT); this.inT = setTimeout(() => { el.style.opacity = 0; }, 1500); }

  heldModel(key, p) {
    if (key === 'hand' || !ITEMS[key]) return null;
    return itemMesh(key, key === 'sword' ? p.sword : key === 'pick' ? Math.max(1, p.pick) : 0, p.team, this.prefs.low);
  }
  draw(dt) {
    const W = this.W, me = this.me, low = this.prefs.low, cam = this.cam.position;
    // players
    for (const p of W.players) {
      const c = this.rigs.get(p.id); if (!c) continue;
      const show = p.alive && (p !== me || this.third) && (!low || Math.hypot(p.x - cam.x, p.z - cam.z) < 70);
      c.g.visible = show; if (!show) continue;
      c.g.position.set(p.x, p.y, p.z); c.R.root.rotation.y = p.yaw;
      // what they hold
      const id = p.held + ':' + p.sword + ':' + p.pick;
      if (c.itemId !== id && c.R.j && c.R.j.handR) {
        if (c.item) c.R.j.handR.remove(c.item);
        c.item = this.heldModel(p.held, p); c.itemId = id;
        if (c.item) { c.item.scale.setScalar(p.held === 'wool' || p.held === 'plank' || p.held === 'end' ? 0.5 : 0.7); c.item.position.set(0, -0.08, 0.12); c.item.rotation.set(-Math.PI / 2 + 0.6, Math.PI / 2, 0); c.R.j.handR.add(c.item); }
      }
      const sp = Math.hypot(p.vx, p.vz), s = { anim: p.sneak ? (sp > 0.3 ? 'crouchwalk' : 'crouch') : sp > 5 ? 'run' : sp > 0.4 ? 'walk' : 'idle', speed: sp, t: this.t, atk: p.atkT < 0.3 ? 1 : 0, atkF: p.atkT / 0.3, crouch: p.sneak };
      if (!low || (this.t * 30 | 0) % 2 === 0) try { animate(c.R, s, low ? dt * 2 : dt); } catch (_) {}
      if (p.atkT < 0.3 && c.R.j && c.R.j.shR) c.R.j.shR.rotation.x -= Math.sin(p.atkT / 0.3 * Math.PI) * 1.6;
      c.hurt = Math.max(0, (c.hurt || 0) - dt);
      c.tag.material.color.setHex(c.hurt > 0 ? 0xff5050 : 0xffffff);
    }
    // the dropped resources: little 3D ingots and gems spinning over the generators
    for (const pile of W.piles) {
      let g = this.pileMeshes.get(pile); if (!g) { g = new THREE.Group(); this.scene.add(g); this.pileMeshes.set(pile, g); }
      const have = RES.filter(r => pile[r] > 0), key = have.map(r => r + (pile[r] > 1 ? 'n' + pile[r] : '')).join(',');
      if (key !== g.userData.key) {
        g.clear(); g.userData.key = key;
        have.forEach((r, i) => {
          const m = itemMesh(r, 0, 0, low); m.scale.setScalar(0.55); const a = have.length > 1 ? i / have.length * Math.PI * 2 : 0;
          const holder = new THREE.Group(); holder.position.set(Math.cos(a) * 0.32 * (have.length > 1), 0.45, Math.sin(a) * 0.32 * (have.length > 1)); holder.add(m); g.add(holder);
          if (pile[r] > 1) { const l = label('×' + pile[r], RESCOL[r], 128); l.scale.set(0.55, 0.24, 1); l.position.y = 0.42; holder.add(l); }
        });
      }
      g.position.set(pile.x, pile.y, pile.z);
      g.children.forEach((h, i) => { h.children[0].rotation.y = this.t * 1.8 + i; h.position.y = 0.45 + Math.sin(this.t * 2.2 + i) * 0.07; });
    }
    // generator timers
    for (const H of this.holo) {
      const nm = H.gn.kind === 'diamond' ? 'Diamond' : 'Emerald', txt = `${nm} in ${Math.max(0, Math.ceil(H.gn.t))}s`;
      if (txt !== H.last) { H.last = txt; H.l.userData.redraw(txt, H.gn.kind === 'diamond' ? '#5af0f0' : '#4ae870'); }
    }
    this.W.teams.forEach((_, ti) => { this.bedMeshes[ti].visible = W.beds[ti].alive; });
    // the camera
    const eye = new THREE.Vector3(me.x, me.y + (me.sneak ? EYE - 0.2 : EYE), me.z);
    if (!me.alive) {
      const T = W.teams[me.team], a = this.t * 0.15; this.cam.position.set(T.x + Math.cos(a) * 20, TOP + 18, T.z + Math.sin(a) * 20); this.cam.lookAt(T.x, TOP, T.z);
    } else {
      this.cam.rotation.set(me.pitch, me.yaw + Math.PI, 0, 'YXZ');
      const fovK = me.sprint && Math.hypot(me.vx, me.vz) > 4.8 ? 1.12 : 1; this.cam.fov += ((this.settings.fov || 75) * fovK - this.cam.fov) * Math.min(1, dt * 8); this.cam.updateProjectionMatrix();
      if (this.third) {
        const back = new THREE.Vector3(-Math.sin(me.yaw) * Math.cos(me.pitch), -Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
        const hit = W.ray(eye.x, eye.y, eye.z, back.x, back.y, back.z, 4.2), d = hit ? Math.max(0.6, hit.t - 0.2) : 4;
        this.cam.position.copy(eye).addScaledVector(back, d);
      } else this.cam.position.copy(eye);
    }
    this.sky.position.copy(this.cam.position);
    sound.listener(this.cam.position.x, this.cam.position.z, me.yaw);
    // first person: the arm and the held item, with Minecraft's swing, equip and eating motions
    this.fp.visible = me.alive && !this.third;
    if (this.fp.visible) {
      const id = me.held + ':' + me.sword + ':' + me.pick;
      if (id !== this.heldId) { if (this.heldMesh) this.handSlot.remove(this.heldMesh); this.heldMesh = this.heldModel(me.held, me); this.heldId = id; if (this.heldMesh) this.handSlot.add(this.heldMesh); }
      const blk = me.held === 'wool' || me.held === 'plank' || me.held === 'end';
      if (this.heldMesh) {
        if (blk) { this.heldMesh.scale.setScalar(0.34); this.heldMesh.position.set(-0.02, 0.06, -0.06); this.heldMesh.rotation.set(0.15, 0.75, 0); }
        else { this.heldMesh.scale.setScalar(0.27); this.heldMesh.position.set(-0.02, 0.07, -0.05); this.heldMesh.rotation.set(0.05, -0.85, 0.1); }
      }
      this.swingT += dt; this.equipT = Math.min(1, this.equipT + dt / 0.22);
      const s = Math.min(1, this.swingT / 0.3), sw = s < 1 ? Math.sin(Math.sqrt(s) * Math.PI) : 0, sw2 = s < 1 ? Math.sin(s * s * Math.PI) : 0;
      const charge = W.pvp === '1.9' ? W.charge(me) : 1, eating = this.mouse.r && me.held === 'apple' && !this.modal;
      const moving = Math.hypot(me.vx, me.vz) > 0.5 && me.ground; this.bob = (this.bob || 0) + (moving ? dt * Math.hypot(me.vx, me.vz) * 1.6 : 0);
      const bx = moving ? Math.sin(this.bob) * 0.012 : 0, by = moving ? -Math.abs(Math.cos(this.bob)) * 0.014 : 0;
      this.arm.position.set(0.3 - sw * 0.1 + bx + (eating ? -0.16 : 0), -0.27 + Math.sin(Math.sqrt(s) * Math.PI * 2) * 0.04 * (s < 1) + by - (1 - ease(this.equipT)) * 0.3 - (1 - charge) * 0.1 + (eating ? 0.07 + Math.abs(Math.sin(this.t * 14)) * 0.02 : 0), -0.5);
      this.arm.rotation.set(0.12 - sw2 * 0.9 + (eating ? 0.5 : 0), 0.12 - sw * 0.6 + (eating ? 0.6 : 0), sw * 0.3);
    }
    // the block you're looking at
    const h = me.alive && !this.modal ? W.target(me) : null;
    this.sel.visible = !!h; if (h) this.sel.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5);
    const mf = me.mine && !me.mine.no ? me.mine.f : 0;
    this.crack.visible = mf > 0;
    if (mf > 0) { this.crack.position.set(me.mine.x + 0.5, me.mine.y + 0.5, me.mine.z + 0.5); const st = Math.min(9, Math.floor(mf * 10)); if (this.crackSt !== st) { this.crackSt = st; this.crack.material.map = crackTex(st); this.crack.material.needsUpdate = true; } }
    if (this.mouse.l && mf > 0 && this.swingT > 0.28) this.swingT = 0; // keep swinging while breaking
  }
  updateHUD(dt) {
    const p = this.me, W = this.W, $ = this.$;
    this.hurtT = Math.max(0, (this.hurtT || 0) - dt); $('.hurt').style.opacity = this.hurtT > 0 ? 1 : 0;
    if (this.feedRows.length && this.t - this.feedRows[0].t > 14) { this.feedRows.shift(); $('.feed').innerHTML = this.feedRows.map(r => `<div>${r.html}</div>`).join(''); }
    // hearts and armour
    const hp = Math.max(0, Math.ceil(p.hp)), hk = 'h' + hp + ':' + p.armor;
    if (hk !== this.heartK) {
      this.heartK = hk;
      const heart = k => `<img src="${(ICON['heart' + k] ||= itemCanvas('heart', k).toDataURL())}">`;
      $('.hearts').innerHTML = Array.from({ length: 10 }, (_, i) => heart(hp >= (i + 1) * 2 ? 2 : hp === i * 2 + 1 ? 1 : 0)).join('');
      const ap = Math.round(ARMOR[p.armor].red * 16.6);
      $('.armor').innerHTML = p.armor ? Array.from({ length: 10 }, (_, i) => `<img src="${(ICON['arm' + p.armor] ||= itemCanvas('armor', p.armor).toDataURL())}" style="opacity:${i < ap ? 1 : 0.2}">`).join('') : '';
    }
    // the hotbar
    for (const key of KEYS) if (itemCount(p, key) > 0 && !this.layout.includes(key)) { const j = this.layout.indexOf(null); if (j >= 0) this.layout[j] = key; }
    const hot = Array.from({ length: 9 }, (_, i) => { const k = this.layout[i], n = k ? itemCount(p, k) : 0; return `<div class="slot ${p.slot === i ? 'on' : ''}">${k && n ? `<img src="${iconURL(k, p, p.team)}">` : ''}${n > 1 ? `<b>${n}</b>` : ''}</div>`; }).join('');
    if (hot !== this.hotK) { $('.hot').innerHTML = hot; this.hotK = hot; }
    const res = RES.map(r => `<span>${p.inv[r]} <img src="${iconURL(r, p, p.team)}"></span>`).join('');
    if (res !== this.resK) { $('.res').innerHTML = res; this.resK = res; }
    // 1.9: the attack indicator
    const ch = $('.charge');
    if (W.pvp === '1.9' && p.alive) { const c = W.charge(p); ch.style.display = c < 1 ? 'block' : 'none'; ch.firstElementChild.style.width = Math.round(c * 100) + '%'; } else ch.style.display = 'none';
    // the sidebar
    const left = Math.max(0, 600 - W.t), tm = W.sudden ? 'Sudden death' : `Beds break in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const side = `<h4>BED WARS</h4>${W.teams.map((T, ti) => { const alive = W.players.filter(q => q.team === ti && !q.out).length; return `<div class="${ti === p.team ? 'me' : ''}"><span style="color:${T.css}">${T.name[0]}</span> ${T.name}: ${W.beds[ti].alive ? '<span style="color:#55ff55">✔</span>' : alive ? `<span style="color:#ffd75a">${alive}</span>` : '<span style="color:#ff5555">✘</span>'}${ti === p.team ? ' <small>YOU</small>' : ''}</div>`; }).join('')}<div class="t">${tm}<br>Kills ${p.kills} · Finals ${p.finals} · Beds ${p.bedsBroken}</div>`;
    if (side !== this.sideK) { $('.side').innerHTML = side; this.sideK = side; }
    let hint = '';
    if (!p.alive) hint = p.out ? 'Eliminated · spectating' : `Respawning in ${Math.ceil(p.respawn)}…`;
    else if (W.atHome(p) && W.t < 30) hint = '<b>B</b> shop · <b>E</b> inventory · <b>RMB</b> place · <b>LMB</b> hit / break · <b>Shift</b> sneak · <b>Ctrl</b> sprint · <b>V</b> view';
    else if (W.atHome(p) && p.inv.wool + p.inv.plank + p.inv.end === 0 && p.inv.iron >= 4) hint = 'Press <b>B</b> to buy blocks';
    if (hint !== this.hintK) { $('.hint').innerHTML = hint; this.hintK = hint; }
    if (this.mode !== 'offline') { const n = this.mode === 'host' ? `Hosting · ${W.players.filter(q => q.remote).length + 1} players` : 'Online'; if (n !== this.netK) { $('.net').textContent = n; this.netK = n; } }
  }
  end(team, time) {
    if (this.ended) return;
    this.ended = true; this.modal = 'end'; document.exitPointerLock && document.exitPointerLock();
    const W = this.W, me = this.me, won = team === me.team;
    sound.play(won ? 'escaped' : 'end');
    const embers = (won ? 400 : 60) + me.kills * 20 + me.finals * 40 + me.bedsBroken * 120;
    this.result = { won, embers, kills: me.kills, finals: me.finals, beds: me.bedsBroken };
    const T = team >= 0 ? W.teams[team] : null;
    const rows = W.players.slice().sort((a, b) => (b.finals * 3 + b.kills + b.bedsBroken * 5) - (a.finals * 3 + a.kills + a.bedsBroken * 5)).map(q => `<tr><td style="color:${W.teams[q.team].css}">${q.id === this.myId ? 'You' : q.name}${q.bot ? ' <small>(bot)</small>' : ''}</td><td>${q.role === 'killer' ? KILLERS[q.char]?.name || q.char : SURVIVORS[q.char]?.name || q.char}</td><td>${q.kills}</td><td>${q.finals}</td><td>${q.bedsBroken}</td></tr>`).join('');
    const online = this.mode !== 'offline';
    this.$('.modalbox').innerHTML = `<div class="modal"><h2 style="font-size:26px;color:${T ? T.css : '#3f3f3f'};text-shadow:2px 2px 0 #3f3f3f">${won ? 'VICTORY!' : T ? T.name + ' team wins!' : 'Game over'}</h2><p>${time ? 'Time ran out: the team with the most players left wins. ' : ''}+${embers} Embers</p>
      <table><tr><th>Player</th><th>Character</th><th>Kills</th><th>Finals</th><th>Beds</th></tr>${rows}</table>
      <div class="row">${online ? (this.mode === 'host' ? '<button class="mc" data-k="lobby">Back to the lobby (everyone)</button>' : '<button class="mc" data-k="leave">Back to the lobby</button>') : '<button class="mc" data-k="again">Play again</button><button class="mc" data-k="leave">Back to menu</button>'}</div></div>`;
    const b = k => this.$(`[data-k=${k}]`);
    if (b('again')) b('again').onclick = () => this.exit({ again: true });
    if (b('leave')) b('leave').onclick = () => this.exit({});
    if (b('lobby')) b('lobby').onclick = () => this.exit({ lobby: true });
  }
  exit(how = {}) {
    if (this.dead) return;
    this.dead = true; cancelAnimationFrame(this.raf); clearInterval(this.bgTimer);
    const c = this.r.domElement;
    removeEventListener('keydown', this.on.kd); removeEventListener('keyup', this.on.ku); c.removeEventListener('mousedown', this.on.md); removeEventListener('mouseup', this.on.mu); removeEventListener('mousemove', this.on.mm);
    removeEventListener('wheel', this.on.wh); document.removeEventListener('pointerlockchange', this.on.pl); removeEventListener('resize', this.on.rs); c.removeEventListener('contextmenu', this.on.cm); removeEventListener('beforeunload', this.on.bu);
    document.exitPointerLock && document.exitPointerLock();
    try { navigator.keyboard && navigator.keyboard.unlock && navigator.keyboard.unlock(); } catch (_) {}
    this.hud.remove();
    for (const m of this.chunks.values()) m.geometry.dispose();
    this.r.setPixelRatio(this.prevPR);
    if (this.onExit) this.onExit(this.result || null, how);
  }
}
