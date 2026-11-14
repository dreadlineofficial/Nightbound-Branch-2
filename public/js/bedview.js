// Nightcraft Bedwars: the screen. Draws the block world, the players (Nightbound's own characters),
// the HUD and the shop, and turns the keyboard and mouse into moves. The rules live in bedwars.js.
import * as THREE from 'three';
import { BedWorld, B, TEAMS, TOP, HP, SWORDS, ARMOR, PICKS, SHOP, RES, HOTBAR, blockOfSlot } from './bedwars.js';
import { makeSurvivor, makeKiller, animate } from './models.js';
import { KILLERS, SURVIVORS, skinOf } from './config.js';
import { sound } from './audio.js';

const COL = { [B.STONE]: 0x7a7a7e, [B.GRASS]: 0x4a8a34, [B.DIRT]: 0x7a5434, [B.LOG]: 0x5a3e22, [B.PLANKMAP]: 0xa8844e, [B.GLOW]: 0xf0d890, [B.OBSID]: 0x24183a, [B.PLANK]: 0xb08a50, [B.END]: 0xe8e2a8 };
const colOf = t => (t >= B.WOOL && t < B.WOOL + 4 ? new THREE.Color(TEAMS[t - B.WOOL].color).lerp(new THREE.Color(0xffffff), 0.12) : new THREE.Color(COL[t] ?? 0xff00ff));
const RESCOL = { iron: 0xe0e0e8, gold: 0xffc830, diamond: 0x40e8f0, emerald: 0x30e060 };
const CSS = `
#bw{position:fixed;inset:0;z-index:30;pointer-events:none;font-family:'Barlow','Segoe UI',sans-serif;color:#fff;user-select:none}
#bw .cross{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px}
#bw .cross:before,#bw .cross:after{content:'';position:absolute;background:#fff;mix-blend-mode:difference}
#bw .cross:before{left:8px;top:0;width:2px;height:18px}#bw .cross:after{top:8px;left:0;height:2px;width:18px}
#bw .hot{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:4px}
#bw .slot{width:54px;height:54px;background:rgba(20,20,24,.72);border:2px solid #555;position:relative;display:flex;align-items:center;justify-content:center;font-size:11px;text-align:center;line-height:1.05}
#bw .slot.on{border-color:#fff;box-shadow:0 0 0 2px #000 inset}
#bw .slot b{position:absolute;right:4px;bottom:2px;font-size:14px;text-shadow:1px 1px 0 #000}
#bw .slot i{position:absolute;left:4px;top:2px;font-style:normal;opacity:.55;font-size:10px}
#bw .slot .sw{width:26px;height:26px;border:1px solid rgba(0,0,0,.6)}
#bw .hearts{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);display:flex;gap:2px;font-size:19px;letter-spacing:-1px;text-shadow:1px 1px 0 #000}
#bw .hearts .e{opacity:.25}
#bw .res{position:absolute;left:16px;bottom:16px;display:flex;flex-direction:column;gap:4px;font-size:15px;font-weight:700}
#bw .res span{display:flex;align-items:center;gap:7px;text-shadow:1px 1px 0 #000}#bw .res em{width:13px;height:13px;display:inline-block;border:1px solid #000}
#bw .gear{position:absolute;left:16px;bottom:118px;font-size:12px;opacity:.85;line-height:1.5;text-shadow:1px 1px 0 #000}
#bw .teams{position:absolute;right:14px;top:14px;background:rgba(0,0,0,.45);padding:10px 14px;font-size:14px;line-height:1.6;min-width:170px}
#bw .teams h4{margin:0 0 4px;font-size:13px;letter-spacing:.14em;color:#ffd75a}
#bw .teams .me{text-decoration:underline}
#bw .timer{font-size:12px;opacity:.75;margin-top:4px}
#bw .feed{position:absolute;left:14px;top:14px;font-size:14px;line-height:1.5;text-shadow:1px 1px 0 #000;max-width:46vw}
#bw .big{position:absolute;left:0;right:0;top:26%;text-align:center;font-size:44px;font-weight:800;letter-spacing:.04em;text-shadow:0 3px 14px #000;transition:opacity .4s;opacity:0}
#bw .big small{display:block;font-size:18px;font-weight:600;opacity:.85;margin-top:6px}
#bw .mine{position:absolute;left:50%;top:calc(50% + 22px);width:80px;height:5px;margin-left:-40px;background:rgba(0,0,0,.5);display:none}
#bw .mine i{display:block;height:100%;background:#fff}
#bw .hint{position:absolute;left:50%;bottom:146px;transform:translateX(-50%);font-size:14px;opacity:.9;text-shadow:1px 1px 0 #000;white-space:nowrap}
#bw .hurt{position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(200,0,0,.75);opacity:0;transition:opacity .25s}
#bw .modal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(18,16,20,.95);border:2px solid #666;padding:18px 20px;pointer-events:auto;min-width:min(620px,92vw);max-height:86vh;overflow:auto}
#bw .modal h2{margin:0 0 4px;font-size:24px}#bw .modal p{margin:0 0 12px;opacity:.75;font-size:14px}
#bw .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
#bw .grid button{background:#2a2830;border:1px solid #555;color:#fff;padding:10px;text-align:left;font:inherit;cursor:pointer}
#bw .grid button:hover:not(:disabled){border-color:#ffd75a;background:#38343e}#bw .grid button:disabled{opacity:.35;cursor:default}
#bw .grid button b{display:block;font-size:15px}#bw .grid button span{font-size:12px;opacity:.8}
#bw .row{display:flex;gap:10px;justify-content:center;margin-top:14px}
#bw .row button{background:#a5221a;border:0;color:#fff;font:inherit;font-weight:700;padding:10px 22px;cursor:pointer}#bw .row button.alt{background:#3a3640}
#bw table{width:100%;border-collapse:collapse;font-size:14px;margin-top:8px}#bw td,#bw th{padding:4px 8px;text-align:left}#bw th{opacity:.6;font-weight:600}
@media (max-width:700px){#bw .slot{width:44px;height:44px}#bw .teams{font-size:12px;min-width:0}}
`;

// a 16x16 pixel texture: speckled grey with a darker rim, tinted per block by the instance colour
function blockTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let v = 200 + ((x * 73 + y * 151 + ((x * y) % 7) * 37) % 56);
    if (x === 0 || y === 0 || x === 15 || y === 15) v -= 60;
    g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function label(text, css) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 56; const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 8, 256, 40); g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillStyle = css; g.fillText(text.slice(0, 16), 128, 39);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: true, transparent: true })); s.scale.set(1.6, 0.35, 1); return s;
}
function swordMesh(tier) {
  const g = new THREE.Group(), blade = [0x9a7a4a, 0x8a8a8a, 0xdadada, 0x5ae8f0][tier];
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.02), new THREE.MeshStandardMaterial({ color: blade, metalness: tier ? 0.6 : 0, roughness: 0.4 })); b.position.y = 0.38; g.add(b);
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); h.position.y = 0.06; g.add(h);
  const gr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), new THREE.MeshStandardMaterial({ color: 0x5a3a20 })); gr.position.y = -0.03; g.add(gr);
  return g;
}

export class BedwarsGame {
  constructor({ renderer, settings, me, difficulty = 'normal', teamSize = 2, onExit }) {
    this.r = renderer; this.settings = settings; this.onExit = onExit; this.myId = 'me';
    // the roster: you and your teammates on Red, three bot teams
    const killers = Object.keys(KILLERS), survivors = Object.keys(SURVIVORS).filter(c => !SURVIVORS[c].fan || c === 'steve');
    const pick = () => Math.random() < 0.4 ? { role: 'killer', char: killers[Math.floor(Math.random() * killers.length)] } : { role: 'survivor', char: survivors[Math.floor(Math.random() * survivors.length)] };
    const names = ['Ash', 'Rook', 'Wren', 'Sable', 'Kit', 'Moss', 'Vale', 'Quill', 'Hollis', 'Briar', 'Fen', 'Lark', 'Pike', 'Rue', 'Thorn'];
    const roster = [{ id: 'me', name: me.name, team: 0, char: me.char, role: me.role, skin: me.skin, bot: false }];
    let n = 0;
    for (let t = 0; t < 4; t++) for (let k = t === 0 ? 1 : 0; k < teamSize; k++) roster.push({ id: 'b' + n, name: names[n++ % names.length], team: t, bot: true, ...pick(), skin: 'default' });
    this.W = new BedWorld(roster, { difficulty });
    this.me = this.W.P('me');
    this.keys = new Set(); this.mouse = { l: false, r: false }; this.rT = 0; this.third = false; this.feedRows = []; this.t = 0;
    this.build();
  }
  build() {
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x0b1024); sc.fog = new THREE.Fog(0x0b1024, 45, 110);
    this.cam = new THREE.PerspectiveCamera(this.settings.fov || 75, innerWidth / innerHeight, 0.05, 400);
    sc.add(new THREE.HemisphereLight(0x8a9ad8, 0x2a2018, 1.35));
    const moon = new THREE.DirectionalLight(0xc8d4ff, 1.6); moon.position.set(-30, 60, 20); sc.add(moon);
    sc.add(new THREE.AmbientLight(0x404858, 0.6));
    // the night sky: stars and a big square moon
    const sg = new THREE.BufferGeometry(), sp = [];
    for (let i = 0; i < 900; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.2 + 0.05, R = 180; sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R); }
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    sc.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.1, sizeAttenuation: false, fog: false })));
    const mm = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshBasicMaterial({ color: 0xf4f0d8, fog: false })); mm.position.set(-90, 110, 60); mm.lookAt(0, 0, 0); sc.add(mm);
    // the blocks
    this.tex = blockTexture();
    this.blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: this.tex }), 16000);
    this.blocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sc.add(this.blocks);
    this.glow = []; // the glowstone and generators give off light
    for (const gn of this.W.gens) { const L = new THREE.PointLight(gn.kind === 'forge' ? 0xffb060 : gn.kind === 'diamond' ? 0x60e8ff : 0x60ff80, 6, 10); L.position.set(gn.x, gn.y + 1.2, gn.z); sc.add(L); }
    // beds, drawn on their own
    this.bedMeshes = TEAMS.map((T, ti) => {
      const g = new THREE.Group(), [a, b] = this.W.beds[ti].cells;
      const cx = (a[0] + b[0]) / 2 + 0.5, cz = (a[2] + b[2]) / 2 + 0.5, along = a[0] !== b[0];
      const frame = new THREE.Mesh(new THREE.BoxGeometry(along ? 2 : 1, 0.56, along ? 1 : 2), new THREE.MeshLambertMaterial({ color: T.color, map: this.tex }));
      frame.position.set(cx, TOP + 0.28, cz); g.add(frame);
      const pil = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.5 : 0.9, 0.62, along ? 0.9 : 0.5), new THREE.MeshLambertMaterial({ color: 0xf0f0f0, map: this.tex }));
      pil.position.set(b[0] + 0.5, TOP + 0.31, b[2] + 0.5); g.add(pil);
      sc.add(g); return g;
    });
    // the shopkeepers: one of the survivors, behind a counter
    for (const T of TEAMS) {
      const R = makeSurvivor(SURVIVORS.june, {}); R.root.position.set(T.shop.x, TOP, T.shop.z); R.root.rotation.y = Math.atan2(T.x - T.shop.x + 0.01, T.z - T.shop.z); sc.add(R.root);
      animate(R, { anim: 'idle', speed: 0, t: 0 }, 0.1);
      const l = label('SHOP', '#ffd75a'); l.position.set(T.shop.x, TOP + 2.35, T.shop.z); sc.add(l);
    }
    // ground piles at the generators
    this.pileMeshes = new Map();
    // the block you're looking at
    this.sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: 0x000000 })); sc.add(this.sel);
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.01, 1.01, 1.01), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); sc.add(this.crack);
    // first person: what's in your hand
    this.held = new THREE.Group(); this.cam.add(this.held); sc.add(this.cam);
    this.heldBlock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ map: this.tex }));
    this.heldBlock.position.set(0.32, -0.3, -0.5); this.heldBlock.rotation.set(0.3, 0.7, 0);
    this.heldSword = swordMesh(0); this.heldSword.position.set(0.34, -0.42, -0.62); this.heldSword.rotation.set(-0.3, 0.2, -0.35); this.heldSword.scale.setScalar(0.8);
    this.held.add(this.heldBlock, this.heldSword);
    // players
    this.rigs = new Map();
    for (const p of this.W.players) {
      let R = null;
      try { R = p.role === 'killer' ? makeKiller(p.char, skinOf(p.char, p.skin)) : makeSurvivor(SURVIVORS[p.char] || SURVIVORS.mara, skinOf(p.char, p.skin)); } catch (e) { R = makeSurvivor(SURVIVORS.mara, {}); }
      // killers are a head taller than the blocks are used to: bring them down to size
      const h = new THREE.Box3().setFromObject(R.root).getSize(new THREE.Vector3()).y; if (h > 2.05) R.root.scale.multiplyScalar(1.9 / h);
      const g = new THREE.Group(); g.add(R.root); sc.add(g);
      const tag = label(p.name, TEAMS[p.team].css); tag.position.y = 2.25; tag.visible = p.id !== 'me'; g.add(tag);
      let sw = null; if (R.j && R.j.handR) { sw = swordMesh(0); sw.rotation.x = Math.PI / 2; sw.scale.setScalar(0.85); R.j.handR.add(sw); }
      this.rigs.set(p.id, { g, R, tag, sw, tier: 0, t: 0 });
    }
    // the HUD
    if (!document.getElementById('bw-css')) { const st = document.createElement('style'); st.id = 'bw-css'; st.textContent = CSS; document.head.appendChild(st); }
    const H = this.hud = document.createElement('div'); H.id = 'bw';
    H.innerHTML = `<div class="hurt"></div><div class="cross"></div><div class="mine"><i></i></div><div class="feed"></div><div class="teams"></div><div class="big"></div><div class="hint"></div><div class="gear"></div><div class="res"></div><div class="hearts"></div><div class="hot"></div><div class="modalbox"></div>`;
    document.body.appendChild(H);
    this.$ = s => H.querySelector(s);
    this.rebuild();
  }
  rebuild() {
    const W = this.W, cells = W.cells(), m = new THREE.Matrix4(); let n = 0;
    for (let i = 0; i < cells.length; i += 4) {
      const x = cells[i], y = cells[i + 1], z = cells[i + 2], t = cells[i + 3];
      if (t >= B.BED && t < B.BED + 4) continue;
      // hidden inside: skip
      if (W.solid(x + 1, y, z) && W.solid(x - 1, y, z) && W.solid(x, y + 1, z) && W.solid(x, y - 1, z) && W.solid(x, y, z + 1) && W.solid(x, y, z - 1)) continue;
      if (n >= 16000) break;
      m.makeTranslation(x + 0.5, y + 0.5, z + 0.5); this.blocks.setMatrixAt(n, m); this.blocks.setColorAt(n, colOf(t)); n++;
    }
    this.blocks.count = n; this.blocks.instanceMatrix.needsUpdate = true; if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
    W.dirty = false;
  }

  // ---------------- input ----------------
  start() {
    const c = this.r.domElement;
    this.on = {
      kd: e => {
        if (e.repeat && e.code !== 'Space') return;
        this.keys.add(e.code); sound.init();
        if (this.shopOpen && (e.code === 'KeyB' || e.code === 'KeyE' || e.code === 'Escape')) { this.closeShop(); return; }
        if (e.code === 'Escape') return;
        if (/^Digit[1-5]$/.test(e.code)) this.me.slot = +e.code.slice(5) - 1;
        if (e.code === 'KeyV' || e.code === 'F5') { this.third = !this.third; e.preventDefault(); }
        if (e.code === 'KeyB' || e.code === 'KeyE') this.openShop();
        if (e.code === 'Tab') e.preventDefault();
      },
      ku: e => this.keys.delete(e.code),
      md: e => {
        if (this.ended || this.shopOpen) return;
        if (document.pointerLockElement !== c) { c.requestPointerLock && c.requestPointerLock(); return; }
        if (e.button === 0) { this.mouse.l = true; if (this.W.attack(this.me)) this.swing(); else this.me.atkT = 0; }
        if (e.button === 2) { this.mouse.r = true; this.rT = 0; this.use(); }
      },
      mu: e => { if (e.button === 0) this.mouse.l = false; if (e.button === 2) this.mouse.r = false; },
      mm: e => {
        if (document.pointerLockElement !== c || this.shopOpen) return;
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
        const s = (this.settings.sens || 1) * 0.0022, inv = this.settings.invert ? -1 : 1;
        this.me.yaw -= e.movementX * s; this.me.pitch = Math.max(-1.55, Math.min(1.55, this.me.pitch - e.movementY * s * inv));
      },
      wh: e => { if (this.shopOpen) return; this.me.slot = (this.me.slot + (e.deltaY > 0 ? 1 : 4)) % 5; },
      pl: () => { if (document.pointerLockElement !== c && !this.shopOpen && !this.ended) this.pause(true); else this.pause(false); },
      rs: () => { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); this.r.setSize(innerWidth, innerHeight); },
      cm: e => e.preventDefault(),
    };
    addEventListener('keydown', this.on.kd); addEventListener('keyup', this.on.ku);
    c.addEventListener('mousedown', this.on.md); addEventListener('mouseup', this.on.mu); addEventListener('mousemove', this.on.mm);
    addEventListener('wheel', this.on.wh, { passive: true }); document.addEventListener('pointerlockchange', this.on.pl); addEventListener('resize', this.on.rs); c.addEventListener('contextmenu', this.on.cm);
    this.on.rs();
    this.big(`${TEAMS[0].name} team`, 'Protect your bed. Break theirs. Last team standing wins.', 3.5);
    this.feed('Collect iron and gold at your forge, buy blocks at the shop (B), and bridge across.');
    this.last = performance.now();
    const loop = () => { if (this.dead) return; this.raf = requestAnimationFrame(loop); const now = performance.now(), dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.frame(dt); };
    loop();
    try { c.requestPointerLock(); } catch (_) {}
  }
  use() {
    const p = this.me; if (!p.alive) return;
    if (p.slot === 4) { if (this.W.eat(p)) sound.play('heal'); return; }
    if (blockOfSlot(p.slot) && this.W.placeAtLook(p)) sound.play('thud', p.x, p.z);
  }
  swing() { sound.play('swing', this.me.x, this.me.z); this.swingT = 0; }
  pause(on) {
    const box = this.$('.modalbox');
    if (!on) { if (!this.shopOpen && !this.ended) box.innerHTML = ''; return; }
    box.innerHTML = `<div class="modal"><h2>Paused</h2><p>Nightcraft Bedwars keeps running while you're away.</p><div class="row"><button data-k="resume">Resume</button><button class="alt" data-k="leave">Leave match</button></div></div>`;
    box.querySelector('[data-k=resume]').onclick = () => { box.innerHTML = ''; this.r.domElement.requestPointerLock(); };
    box.querySelector('[data-k=leave]').onclick = () => this.exit();
  }
  openShop() {
    const p = this.me; if (!p.alive || this.ended) return;
    if (!this.W.atHome(p)) { this.feed('The shop is on your island.'); return; }
    this.shopOpen = true; document.exitPointerLock && document.exitPointerLock(); this.renderShop();
  }
  renderShop() {
    const p = this.me, box = this.$('.modalbox');
    const cost = c => Object.entries(c).map(([k, v]) => `${v} ${k}`).join(' + ');
    box.innerHTML = `<div class="modal"><h2>Shop</h2><p>You have ${RES.map(r => `${p.inv[r]} ${r}`).join(' · ')}</p><div class="grid">${SHOP.map(it => {
      const owned = it.ok && !it.ok(p), can = !owned && Object.entries(it.cost).every(([k, v]) => p.inv[k] >= v);
      return `<button data-b="${it.id}" ${can ? '' : 'disabled'}><b>${it.name}</b><span>${owned ? 'Owned' : cost(it.cost)}</span></button>`; }).join('')}</div><div class="row"><button class="alt" data-k="close">Close (B)</button></div></div>`;
    box.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { if (this.W.buy(p, b.dataset.b)) sound.play('click'); this.renderShop(); });
    box.querySelector('[data-k=close]').onclick = () => this.closeShop();
  }
  closeShop() { this.shopOpen = false; this.$('.modalbox').innerHTML = ''; try { this.r.domElement.requestPointerLock(); } catch (_) {} }

  // ---------------- every frame ----------------
  frame(dt) {
    const W = this.W, p = this.me; this.t += dt;
    // your moves
    const k = this.keys, typing = this.shopOpen;
    p.move.f = typing ? 0 : (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    p.move.s = typing ? 0 : (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    p.move.jump = !typing && k.has('Space');
    p.sneak = !typing && (k.has('ShiftLeft') || k.has('ShiftRight'));
    p.sprint = p.move.f > 0 && !p.sneak;
    if (p.alive && this.mouse.l && !this.shopOpen) { if (W.meleeTarget(p)) { if (p.atkCd <= 0 && W.attack(p)) this.swing(); p.mine = null; } else W.mineTick(p, dt, true); } else if (!p.mine || !p.mine.bot) p.mine = null;
    if (this.mouse.r && !this.shopOpen) { this.rT += dt; if (this.rT > 0.22) { this.rT = 0.04; this.use(); } }
    W.update(dt);
    for (const e of W.takeEvents()) this.onEvent(e);
    if (W.dirty) this.rebuild();
    this.draw(dt);
    this.updateHUD(dt);
    this.r.render(this.scene, this.cam);
  }
  name(id) { const q = this.W.P(id); return q ? `<b style="color:${TEAMS[q.team].css}">${q.id === 'me' ? 'You' : q.name}</b>` : 'Someone'; }
  onEvent(e) {
    const p = this.me, near = (x, z) => [x, z];
    switch (e.k) {
      case 'hit': sound.play('hit', ...near(e.x, e.z), { pitch: 1.4 }); if (e.id === 'me') this.hurtT = 0.35; break;
      case 'break': sound.play('break', e.x, e.z); break;
      case 'pickup': if (e.id === 'me') sound.play('pickup'); break;
      case 'death': {
        const how = e.why === 'killed' ? 'was killed by' : e.why;
        this.feed(e.by && e.by !== e.id ? `${this.name(e.id)} ${e.why === 'killed' ? how + ' ' + this.name(e.by) : e.why + ' (' + this.name(e.by) + ')'}${e.final ? ' <b style="color:#ff5a4a">FINAL KILL</b>' : ''}` : `${this.name(e.id)} ${e.why}${e.final ? ' <b style="color:#ff5a4a">FINAL KILL</b>' : ''}`);
        if (e.id === 'me') { sound.play('scream', p.x, p.z, { pitch: 1.2, len: 0.7 }); this.big(e.final ? 'ELIMINATED' : 'YOU DIED', e.final ? 'Your bed is gone. Watch your team finish it.' : 'Respawning in 5 seconds…', 2.5); }
        break;
      }
      case 'respawn': if (e.id === 'me') this.big('', '', 0); break;
      case 'bed': {
        sound.play('roar', TEAMS[e.team].x, TEAMS[e.team].z, { pitch: 0.8 });
        this.feed(`<b style="color:${TEAMS[e.team].css}">BED DESTRUCTION</b> › ${TEAMS[e.team].name} bed ${e.by ? 'was broken by ' + this.name(e.by) : 'is gone'}`);
        if (e.team === p.team) this.big('BED DESTROYED', 'You will no longer respawn!', 3);
        else if (e.by === 'me') this.big('BED DESTROYED', `${TEAMS[e.team].name} can't respawn anymore`, 2.4);
        break;
      }
      case 'sudden': this.feed('<b style="color:#ff5a4a">SUDDEN DEATH</b> › every bed is gone'); this.big('SUDDEN DEATH', 'All beds have been destroyed', 3); break;
      case 'win': this.end(e.team, e.time); break;
    }
  }
  feed(html) { this.feedRows.push({ html, t: this.t }); if (this.feedRows.length > 6) this.feedRows.shift(); this.$('.feed').innerHTML = this.feedRows.map(r => `<div>${r.html}</div>`).join(''); }
  big(t, sub, dur) { const el = this.$('.big'); el.innerHTML = `${t}${sub ? `<small>${sub}</small>` : ''}`; el.style.opacity = t ? 1 : 0; clearTimeout(this.bigT); if (dur) this.bigT = setTimeout(() => { el.style.opacity = 0; }, dur * 1000); }
  draw(dt) {
    const W = this.W, me = this.me;
    // players
    for (const p of W.players) {
      const c = this.rigs.get(p.id); if (!c) continue;
      const show = p.alive && (p !== me || this.third);
      c.g.visible = show; if (!show) continue;
      c.g.position.set(p.x, p.y, p.z); c.R.root.rotation.y = p.yaw;
      if (c.sw && c.tier !== p.sword) { c.R.j.handR.remove(c.sw); c.sw = swordMesh(p.sword); c.sw.rotation.x = Math.PI / 2; c.sw.scale.setScalar(0.85); c.R.j.handR.add(c.sw); c.tier = p.sword; }
      if (c.sw) c.sw.visible = p.slot === 0 || p.bot;
      const sp = Math.hypot(p.vx, p.vz), s = { anim: p.sneak ? (sp > 0.3 ? 'crouchwalk' : 'crouch') : sp > 5 ? 'run' : sp > 0.4 ? 'walk' : 'idle', speed: sp, t: this.t, atk: p.atkT < 0.3 ? 1 : 0, atkF: p.atkT / 0.3, crouch: p.sneak };
      try { animate(c.R, s, dt); } catch (_) {}
      // the swing (procedural rigs): the right arm comes down
      if (p.atkT < 0.3 && c.R.j && c.R.j.shR) c.R.j.shR.rotation.x -= Math.sin(p.atkT / 0.3 * Math.PI) * 1.6;
      // hurt: a red flash
      c.tag.material.color.setHex(p.hurtT < 0.25 ? 0xff6060 : 0xffffff);
    }
    // piles at the generators
    for (const pile of W.piles) {
      let g = this.pileMeshes.get(pile); if (!g) { g = new THREE.Group(); this.scene.add(g); this.pileMeshes.set(pile, g); g.userData.n = -1; }
      const list = []; for (const r of RES) for (let i = 0; i < Math.min(pile[r], r === 'iron' ? 6 : 3); i++) list.push(r);
      const key = list.join(',');
      if (key !== g.userData.key) {
        g.clear(); g.userData.key = key;
        list.forEach((r, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshStandardMaterial({ color: RESCOL[r], emissive: RESCOL[r], emissiveIntensity: 0.35, metalness: 0.5, roughness: 0.3 })); const a = i * 2.4; m.position.set(Math.cos(a) * 0.25, 0.25 + (i % 3) * 0.08, Math.sin(a) * 0.25); g.add(m); });
      }
      g.position.set(pile.x, pile.y, pile.z); g.rotation.y += dt * 1.4;
    }
    for (let ti = 0; ti < 4; ti++) this.bedMeshes[ti].visible = W.beds[ti].alive;
    // the camera
    const eye = new THREE.Vector3(me.x, me.y + (me.sneak ? 1.42 : 1.62), me.z);
    if (!me.alive) {
      // dead: look down at your island from above
      const T = TEAMS[me.team], a = this.t * 0.15; this.cam.position.set(T.x + Math.cos(a) * 18, TOP + 16, T.z + Math.sin(a) * 18); this.cam.lookAt(T.x, TOP, T.z);
    } else {
      this.cam.rotation.set(me.pitch, me.yaw + Math.PI, 0, 'YXZ');
      if (this.third) {
        const back = new THREE.Vector3(-Math.sin(me.yaw) * Math.cos(me.pitch), -Math.sin(me.pitch), -Math.cos(me.yaw) * Math.cos(me.pitch));
        const hit = this.W.ray(eye.x, eye.y, eye.z, back.x, back.y, back.z, 4.2), d = hit ? Math.max(0.6, hit.t - 0.2) : 4;
        this.cam.position.copy(eye).addScaledVector(back, d);
      } else this.cam.position.copy(eye);
    }
    sound.listener(this.cam.position.x, this.cam.position.z, me.yaw);
    // first-person hand
    this.held.visible = me.alive && !this.third;
    this.heldSword.visible = me.slot === 0; this.heldBlock.visible = me.slot >= 1 && me.slot <= 3 && me.inv[HOTBAR[me.slot]] > 0;
    if (this.heldSword.visible && this.heldSword.userData.tier !== me.sword) { const n = swordMesh(me.sword); n.position.copy(this.heldSword.position); n.rotation.copy(this.heldSword.rotation); n.scale.copy(this.heldSword.scale); this.held.remove(this.heldSword); this.held.add(n); this.heldSword = n; n.userData.tier = me.sword; }
    if (this.heldBlock.visible) this.heldBlock.material.color.copy(colOf(me.slot === 1 ? B.WOOL + me.team : blockOfSlot(me.slot)));
    const sw = me.atkT < 0.25 ? Math.sin(me.atkT / 0.25 * Math.PI) : 0, bob = Math.hypot(me.vx, me.vz) > 0.5 && me.ground ? Math.sin(this.t * 10) * 0.012 : 0;
    this.held.rotation.set(-sw * 0.9, 0, 0); this.held.position.set(0, bob, -sw * 0.05);
    // the block you're looking at
    const h = me.alive ? W.target(me) : null;
    this.sel.visible = !!h; if (h) this.sel.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5);
    const mf = me.mine && !me.mine.no ? me.mine.f : 0;
    this.crack.visible = mf > 0; if (mf > 0) { this.crack.position.set(me.mine.x + 0.5, me.mine.y + 0.5, me.mine.z + 0.5); this.crack.material.opacity = mf * 0.55; }
  }
  updateHUD(dt) {
    const p = this.me, W = this.W, $ = this.$;
    if (this.feedRows.length && this.t - this.feedRows[0].t > 12) { this.feedRows.shift(); this.$('.feed').innerHTML = this.feedRows.map(r => `<div>${r.html}</div>`).join(''); }
    this.hurtT = Math.max(0, (this.hurtT || 0) - dt); $('.hurt').style.opacity = this.hurtT > 0 ? 1 : 0;
    const full = Math.floor(p.hp / 2), half = p.hp % 2 >= 1;
    $('.hearts').innerHTML = Array.from({ length: 10 }, (_, i) => i < full ? '<span style="color:#e8282a">♥</span>' : i === full && half ? '<span style="color:#f08080">♥</span>' : '<span class="e">♥</span>').join('');
    const slots = [['Sword', SWORDS[p.sword].name.split(' ')[0], '', 0x9a9a9a], ['Wool', '', p.inv.wool, TEAMS[p.team].color], ['Planks', '', p.inv.plank, COL[B.PLANK]], ['End Stone', '', p.inv.end, COL[B.END]], ['Apple', '', p.inv.apple, 0xffc830]];
    const hot = slots.map((s, i) => `<div class="slot ${p.slot === i ? 'on' : ''}"><i>${i + 1}</i>${i === 0 ? `${s[1]}<br>sword` : `<div class="sw" style="background:#${new THREE.Color(s[3]).getHexString()}"></div>`}${s[2] !== '' ? `<b>${s[2]}</b>` : ''}</div>`).join('');
    if (hot !== this.hotK) { $('.hot').innerHTML = hot; this.hotK = hot; }
    const res = RES.map(r => `<span><em style="background:#${new THREE.Color(RESCOL[r]).getHexString()}"></em>${p.inv[r]} ${r}</span>`).join('');
    if (res !== this.resK) { $('.res').innerHTML = res; this.resK = res; }
    const gear = `${ARMOR[p.armor].name} · ${PICKS[p.pick].name}`; if (gear !== this.gearK) { $('.gear').textContent = gear; this.gearK = gear; }
    const left = Math.max(0, 600 - W.t), tm = W.sudden ? 'Sudden death' : `Beds break in ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    const teams = `<h4>NIGHTCRAFT BEDWARS</h4>${TEAMS.map((T, ti) => { const alive = W.players.filter(q => q.team === ti && !q.out).length; return `<div class="${ti === p.team ? 'me' : ''}" style="color:${T.css}">${W.beds[ti].alive ? '✔' : alive ? alive : '✘'} ${T.name}${ti === p.team ? ' (you)' : ''}</div>`; }).join('')}<div class="timer">${tm}</div>`;
    if (teams !== this.teamK) { $('.teams').innerHTML = teams; this.teamK = teams; }
    const mb = $('.mine'); if (p.mine && !p.mine.no && p.mine.f > 0) { mb.style.display = 'block'; mb.firstElementChild.style.width = Math.round(p.mine.f * 100) + '%'; } else mb.style.display = 'none';
    let hint = '';
    if (!p.alive) hint = p.out ? 'Eliminated · spectating' : `Respawning in ${Math.ceil(p.respawn)}…`;
    else if (W.atHome(p) && W.t < 40) hint = '<b>B</b> shop · <b>RMB</b> place · <b>LMB</b> hit / break · <b>Shift</b> sneak (bridge safely) · <b>V</b> third person';
    else if (W.atHome(p) && p.inv.wool + p.inv.plank + p.inv.end === 0 && p.inv.iron >= 4) hint = 'Press <b>B</b> to buy blocks';
    else if (p.slot >= 1 && p.slot <= 3 && p.inv[HOTBAR[p.slot]] === 0) hint = 'Out of blocks: get more at your shop';
    if (hint !== this.hintK) { $('.hint').innerHTML = hint; this.hintK = hint; }
  }
  end(team, time) {
    this.ended = true; document.exitPointerLock && document.exitPointerLock();
    const W = this.W, me = this.me, won = team === me.team;
    sound.play(won ? 'escaped' : 'end');
    const embers = (won ? 400 : 60) + me.kills * 20 + me.finals * 40 + me.bedsBroken * 120;
    this.result = { won, embers, kills: me.kills, finals: me.finals, beds: me.bedsBroken };
    const rows = W.players.slice().sort((a, b) => (b.finals * 3 + b.kills + b.bedsBroken * 5) - (a.finals * 3 + a.kills + a.bedsBroken * 5)).map(q => `<tr><td style="color:${TEAMS[q.team].css}">${q.id === 'me' ? 'You' : q.name}</td><td>${q.role === 'killer' ? KILLERS[q.char]?.name || q.char : SURVIVORS[q.char]?.name || q.char}</td><td>${q.kills}</td><td>${q.finals}</td><td>${q.bedsBroken}</td></tr>`).join('');
    this.$('.modalbox').innerHTML = `<div class="modal"><h2 style="color:${team >= 0 ? TEAMS[team].css : '#fff'}">${won ? 'VICTORY!' : team >= 0 ? TEAMS[team].name + ' team wins' : 'Game over'}</h2><p>${time ? 'Time ran out: the team with the most players left wins. ' : ''}+${embers} Embers</p>
      <table><tr><th>Player</th><th>Character</th><th>Kills</th><th>Finals</th><th>Beds</th></tr>${rows}</table>
      <div class="row"><button data-k="again">Play again</button><button class="alt" data-k="leave">Back to menu</button></div></div>`;
    this.$('[data-k=again]').onclick = () => this.exit(true);
    this.$('[data-k=leave]').onclick = () => this.exit(false);
  }
  exit(again = false) {
    if (this.dead) return;
    this.dead = true; cancelAnimationFrame(this.raf);
    const c = this.r.domElement;
    removeEventListener('keydown', this.on.kd); removeEventListener('keyup', this.on.ku); c.removeEventListener('mousedown', this.on.md); removeEventListener('mouseup', this.on.mu); removeEventListener('mousemove', this.on.mm);
    removeEventListener('wheel', this.on.wh); document.removeEventListener('pointerlockchange', this.on.pl); removeEventListener('resize', this.on.rs); c.removeEventListener('contextmenu', this.on.cm);
    document.exitPointerLock && document.exitPointerLock();
    this.hud.remove();
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (this.onExit) this.onExit(this.result || null, again);
  }
}
