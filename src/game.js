import * as THREE from 'three';
import { clamp, lerp, sleep } from './util.js';
import { genHeights, makeTerrain, makeWater, makeSky, makeNature, HALF } from './world.js';
import { Animals } from './animals.js';
import { buildChar, SKINS } from './chars.js';
import { T } from './textures.js';

const $ = (id) => document.getElementById(id);
export const SAVE_KEY = 'ps_save_v1';
export const hasSave = () => {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
};
const DAYLEN = 360;

const ITEMS = {
  kayu: 'Kayu', batu: 'Batu', serat: 'Serat', buah: 'Buah Beri',
  daging: 'Daging Mentah', matang: 'Daging Matang', ikan: 'Ikan Mentah', ikanmatang: 'Ikan Bakar',
  kapak: 'Kapak', tombak: 'Tombak',
};
const ICON = {
  kayu: '🪵', batu: '🪨', serat: '🌿', buah: '🫐', daging: '🥩', matang: '🍖', ikan: '🐟', ikanmatang: '🍤', kapak: '🪓', tombak: '🔱',
};

export const BUILD = {
  lantai: { n: 'Lantai', ic: '🟫', cost: { kayu: 2 }, mode: 'cell' },
  dinding: { n: 'Dinding', ic: '🧱', cost: { kayu: 2 }, mode: 'edge' },
  batu: { n: 'Dinding Batu', ic: '🪨', cost: { batu: 3 }, mode: 'edge' },
  atap: { n: 'Atap', ic: '🛖', cost: { kayu: 3 }, mode: 'cell' },
  tangga: { n: 'Tangga', ic: '🪜', cost: { kayu: 4 }, mode: 'cell', rot4: true },
  kasur: { n: 'Kasur', ic: '🛏️', cost: { kayu: 6, serat: 4 }, mode: 'cell', rot4: true },
  api: { n: 'Api Unggun', ic: '🔥', cost: { kayu: 3, batu: 2 }, mode: 'free' },
  bongkar: { n: 'Bongkar', ic: '🔨', cost: {}, mode: 'del' },
};

const CRAFT = {
  kapak: { n: 'Kapak', cost: { kayu: 5, batu: 3 } },
  tombak: { n: 'Tombak', cost: { kayu: 4, batu: 2, serat: 2 } },
};

function pieceBoxes(k) {
  switch (k) {
    case 'lantai': return [{ c: [0, -0.2, 0], s: [2, 1.0, 2], tex: 'wood' }];
    case 'dinding': return [{ c: [0, 0.9, 0], s: [2, 3.0, 0.25], tex: 'wood' }];
    case 'batu': return [{ c: [0, 0.9, 0], s: [2, 3.0, 0.35], tex: 'stone' }];
    case 'atap': return [{ c: [0, 0.125, 0], s: [2.2, 0.25, 2.2], tex: 'roof' }];
    case 'tangga': {
      const out = [];
      for (let i = 0; i < 4; i++) {
        const top = 0.6 * (i + 1);
        out.push({ c: [-0.75 + i * 0.5, (top - 0.6) / 2, 0], s: [0.5, top + 0.6, 2], tex: 'wood' });
      }
      return out;
    }
    case 'kasur': return [
      { c: [0, 0.15, 0], s: [1.0, 0.3, 2.0], tex: 'wood', nc: true },
      { c: [0, 0.25, 0], s: [0.94, 0.5, 1.94], color: '#c0392b' },
      { c: [0, 0.56, -0.7], s: [0.6, 0.12, 0.35], color: '#f5f0e6', nc: true },
    ];
    default: return [];
  }
}

const matCache = new Map();
function pieceMat(tex, color) {
  const key = tex || color;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial(tex ? { map: T[tex], roughness: 0.95 } : { color, roughness: 0.9 }));
  }
  return matCache.get(key);
}

function makeFire() {
  const g = new THREE.Group();
  const logM = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), logM);
    l.rotation.z = Math.PI / 2;
    l.rotation.y = (i * Math.PI) / 3;
    l.position.y = 0.1;
    g.add(l);
  }
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 1, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), stoneM);
    s.position.set(Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5);
    g.add(s);
  }
  const flame = new THREE.Group();
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9 }));
  f1.position.y = 0.5;
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
  f2.position.y = 0.4;
  flame.add(f1, f2);
  g.add(flame);
  return { group: g, flame };
}

export class Game {
  constructor(renderer, settings, opts) {
    this.r = renderer;
    this.set = settings;
    this.o = opts;
    this.online = !!opts.online;
    this.net = opts.net || null;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1300);
    this.cam.rotation.order = 'YXZ';
    this.scene.add(this.cam);
    this.ray = new THREE.Raycaster();
    this.ac = new AbortController();
    this.def = SKINS[opts.skinId || 0] || SKINS[0];

    this.p = {
      x: 0, y: 3.2, z: 0, vy: 0, yaw: 0, pitch: 0,
      hp: 100, hunger: 90, thirst: 90,
      inv: { kayu: 0, batu: 0, serat: 0, buah: 0, daging: 0, matang: 0, ikan: 0, ikanmatang: 0, kapak: 0, tombak: 0 },
      spawn: { x: 0, z: 0 },
    };
    this.t = 0.3;
    this.day = 1;
    this.inp = { mx: 0, my: 0 };
    this.keys = { w: 0, a: 0, s: 0, d: 0, shift: 0 };
    this.jumpReq = false;
    this.act = false;
    this.actCd = 0;
    this.swing = 0;
    this.onGround = false;
    this.inWater = false;
    this.bobT = 0;
    this.paused = false;
    this.dead = false;
    this.sleeping = false;
    this.build = false;
    this.sel = 'lantai';
    this.rot = 0;
    this.pieces = [];
    this.boxes = [];
    this.fires = [];
    this.pkeys = new Set();
    this.remotes = new Map();
    this.netT = 0;
    this.hudT = 0;
    this.saveT = 0;
    this.ctxT = 0;
    this.drinkCd = 0;
    this.ctx = null;
    this.lastLowMsg = 0;
    this.toastMap = new Map();
    this.ghost = null;
    this.ghostKey = '';
    this.timers = [];
    this.running = false;
    this.sprinting = false;
    this.seed = opts.seed || 1;
  }

  /* ================= LOAD ================= */
  async load(progress) {
    let saved = null;
    if (!this.online) {
      try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { saved = null; }
    }
    this.seed = this.online ? this.o.seed : saved ? saved.seed : (Math.random() * 1e9) | 0;
    this.saved = saved;
    const ultra = this.set.gfx === 'ultra';
    const steps = [
      ['Membentuk daratan...', () => { this.hf = genHeights(this.seed); }],
      ['Menumbuhkan rumput...', () => { this.terrain = makeTerrain(this.hf, this.seed); this.scene.add(this.terrain); }],
      ['Mengisi lautan...', () => { this.water = makeWater(); this.scene.add(this.water); }],
      ['Menerbitkan matahari...', () => { this.sky = makeSky(this.scene); this.pieceGroup = new THREE.Group(); this.scene.add(this.pieceGroup); }],
      ['Menanam hutan...', () => { this.nature = makeNature(this.hf, this.seed, this.scene); }],
      ['Memanggil hewan...', () => { this.animals = new Animals(this.hf, this.seed, this.scene, ultra); }],
      ['Menyiapkan tangan...', () => { this.makeHands(); this.makeLights(); }],
      ['Memuat dunia...', () => { this.restore(); }],
      ['Menyusun grafik...', () => { this.applySettings(); this.r.compile(this.scene, this.cam); }],
    ];
    for (let i = 0; i < steps.length; i++) {
      progress((i / steps.length) * 100, steps[i][0]);
      await sleep(30);
      steps[i][1]();
      await sleep(30);
    }
    progress(100, 'Siap!');
  }

  restore() {
    const s = this.saved;
    const p = this.p;
    if (s) {
      this.t = s.t ?? this.t;
      this.day = s.day ?? 1;
      Object.assign(p.inv, s.p.inv || {});
      p.hp = s.p.hp; p.hunger = s.p.hunger; p.thirst = s.p.thirst;
      p.x = s.p.x; p.z = s.p.z; p.y = s.p.y; p.yaw = s.p.yaw || 0; p.pitch = s.p.pitch || 0;
      p.spawn = s.p.spawn || p.spawn;
      for (const q of s.pieces || []) this.addPiece(q[0], q[1], q[2], q[3], q[4]);
      this.nature.killIdx(s.dead || []);
    } else {
      p.x = 3; p.z = 3;
      p.y = this.hf.sample(p.x, p.z);
      p.spawn = { x: 3, z: 3 };
      p.yaw = Math.PI * 0.75;
    }
    this.updateHeld();
  }

  makeLights() {
    this.fireLights = [];
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xff9a3c, 0, 16, 2);
      this.scene.add(l);
      this.fireLights.push(l);
    }
  }

  makeHands() {
    const skin = new THREE.MeshStandardMaterial({ color: this.def.skin, roughness: 0.9 });
    const sleeve = new THREE.MeshStandardMaterial({ color: this.def.shirt, roughness: 0.9 });
    const mk = (side) => {
      const g = new THREE.Group();
      g.position.set(0.3 * side, -0.34, -0.5);
      g.rotation.set(0.12, -side * 0.18, 0);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.4), sleeve);
      a.position.z = 0.22;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.25), skin);
      b.position.z = -0.08;
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skin);
      h.position.z = -0.24;
      g.add(a, b, h);
      this.cam.add(g);
      g.userData.base = g.position.clone();
      return g;
    };
    this.handL = mk(-1);
    this.handR = mk(1);
    this.held = new THREE.Group();
    this.held.position.set(0, 0.02, -0.3);
    this.handR.add(this.held);
  }

  updateHeld() {
    while (this.held.children.length) this.held.remove(this.held.children[0]);
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6, metalness: 0.4 });
    if (this.p.inv.tombak > 0) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0), wood);
      s.position.z = -0.25;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), metal);
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = -0.85;
      this.held.add(s, tip);
    } else if (this.p.inv.kapak > 0) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), wood);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.2), metal);
      head.position.set(0, 0.06, -0.28);
      this.held.add(h, head);
    }
  }

  applySettings() {
    const ultra = this.set.gfx === 'ultra';
    this.r.setPixelRatio(ultra ? Math.min(window.devicePixelRatio || 1, 2) : 1);
    this.r.setSize(innerWidth, innerHeight);
    this.r.shadowMap.enabled = ultra;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sky.setShadows(ultra);
    this.sky.fogNear = ultra ? 90 : 60;
    this.sky.fogFar = ultra ? 420 : 240;
    this.nature.setGrass(ultra);
    this.scene.traverse((o) => {
      if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true;
    });
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }

  resize() {
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }

  /* ================= INPUT ================= */
  begin() {
    this.running = true;
    this.bindInput();
    this.renderBuildBar();
    this.renderBag();
    $('btnBuild').classList.remove('on');
    $('buildBar').classList.remove('show');
    $('btnAct').textContent = '✊';
    if (this.online) $('pauseSave').style.display = 'none';
    else $('pauseSave').style.display = '';
    this.toast('Selamat datang, ' + (this.o.name || 'Santay') + '!');
  }

  bindInput() {
    const sig = { signal: this.ac.signal };
    const cv = this.r.domElement;

    /* joystick */
    const joy = $('joy'), knob = $('joyKnob');
    let joyId = null;
    const joyMove = (e) => {
      const rc = joy.getBoundingClientRect();
      const R = rc.width / 2;
      let dx = e.clientX - (rc.left + R), dy = e.clientY - (rc.top + R);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.inp.mx = dx / R;
      this.inp.my = -dy / R;
    };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      joyId = e.pointerId;
      joy.setPointerCapture(joyId);
      joyMove(e);
    }, sig);
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); }, sig);
    const joyEnd = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null;
      knob.style.transform = 'translate(0,0)';
      this.inp.mx = 0;
      this.inp.my = 0;
    };
    joy.addEventListener('pointerup', joyEnd, sig);
    joy.addEventListener('pointercancel', joyEnd, sig);

    /* look */
    let lookId = null, lx = 0, ly = 0;
    cv.addEventListener('pointerdown', (e) => {
      if (this.paused || this.dead) return;
      if (e.pointerType === 'mouse') {
        if (document.pointerLockElement !== cv) { cv.requestPointerLock && cv.requestPointerLock(); return; }
        this.pressAct();
        return;
      }
      if (lookId !== null) return;
      lookId = e.pointerId;
      lx = e.clientX; ly = e.clientY;
    }, sig);
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerId !== lookId) return;
      this.look(e.clientX - lx, e.clientY - ly);
      lx = e.clientX; ly = e.clientY;
    }, sig);
    const lookEnd = (e) => { if (e.pointerId === lookId) lookId = null; if (e.pointerType === 'mouse') this.act = false; };
    cv.addEventListener('pointerup', lookEnd, sig);
    cv.addEventListener('pointercancel', lookEnd, sig);
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === cv && !this.paused) this.look(e.movementX, e.movementY);
    }, sig);

    /* buttons */
    const btn = (id, down, up) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); down(); }, sig);
      if (up) {
        el.addEventListener('pointerup', up, sig);
        el.addEventListener('pointercancel', up, sig);
      }
    };
    btn('btnAct', () => this.pressAct(), () => { this.act = false; });
    btn('btnJump', () => { this.jumpReq = true; });
    btn('btnBuild', () => this.toggleBuild());
    btn('btnRot', () => { this.rot = (this.rot + 1) % 4; });
    btn('btnEat', () => this.eat());
    btn('btnCtx', () => this.doCtx());
    btn('btnBag', () => this.openBag());
    btn('btnPause', () => this.openPause());
    $('bagClose').addEventListener('click', () => this.closeBag(), sig);
    $('pauseResume').addEventListener('click', () => this.closePause(), sig);
    $('pauseSettings').addEventListener('click', () => this.o.openSettings && this.o.openSettings(), sig);
    $('pauseSave').addEventListener('click', () => { this.save(); this.toast('Dunia tersimpan'); }, sig);
    $('pauseExit').addEventListener('click', () => this.exit(), sig);

    /* keyboard */
    const kmap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd', ShiftLeft: 'shift' };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (kmap[e.code]) this.keys[kmap[e.code]] = 1;
      else if (e.code === 'Space') this.jumpReq = true;
      else if (e.code === 'KeyE') this.doCtx();
      else if (e.code === 'KeyF') this.eat();
      else if (e.code === 'KeyB') this.toggleBuild();
      else if (e.code === 'KeyR') this.rot = (this.rot + 1) % 4;
      else if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); this.openBag(); }
      else if (e.code === 'Escape') this.paused ? this.closePause() : this.openPause();
      else if (e.code.startsWith('Digit')) {
        const keys = Object.keys(BUILD);
        const i = parseInt(e.code.slice(5), 10) - 1;
        if (keys[i]) this.select(keys[i]);
      }
    }, sig);
    window.addEventListener('keyup', (e) => { if (kmap[e.code]) this.keys[kmap[e.code]] = 0; }, sig);
    window.addEventListener('resize', () => this.resize(), sig);
  }

  look(dx, dy) {
    const s = 0.0042 * (this.set.sens || 1);
    this.p.yaw -= dx * s;
    this.p.pitch = clamp(this.p.pitch - dy * s, -1.45, 1.45);
  }

  /* ================= UI ================= */
  toast(msg) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => el.remove(), 2400);
  }

  give(item, n) {
    this.p.inv[item] = (this.p.inv[item] || 0) + n;
    this.toast(`+${n} ${ITEMS[item]}`);
    this.renderBag();
    this.updateBuildAfford();
  }

  has(cost) {
    for (const k in cost) if ((this.p.inv[k] || 0) < cost[k]) return false;
    return true;
  }

  pay(cost) {
    for (const k in cost) this.p.inv[k] -= cost[k];
    this.renderBag();
    this.updateBuildAfford();
  }

  costText(cost) {
    const s = Object.keys(cost).map((k) => `${cost[k]}${ICON[k]}`).join(' ');
    return s || 'Gratis';
  }

  renderBag() {
    const l = $('bagList');
    if (!l) return;
    l.innerHTML = '';
    for (const k of Object.keys(ITEMS)) {
      const n = this.p.inv[k] || 0;
      const d = document.createElement('div');
      d.className = 'bagItem' + (n ? '' : ' zero');
      d.innerHTML = `<span>${ICON[k]}</span><b>${ITEMS[k]}</b><i>${n}</i>`;
      l.appendChild(d);
    }
    const c = $('bagCraft');
    c.innerHTML = '';
    for (const k of Object.keys(CRAFT)) {
      const b = document.createElement('button');
      const owned = this.p.inv[k] > 0;
      b.className = 'btn small' + (owned ? ' dim' : '');
      b.textContent = owned ? `${CRAFT[k].n} ✓` : `Buat ${CRAFT[k].n} (${this.costText(CRAFT[k].cost)})`;
      b.addEventListener('click', () => {
        if (owned) return;
        if (!this.has(CRAFT[k].cost)) { this.toast('Bahan kurang'); return; }
        this.pay(CRAFT[k].cost);
        this.p.inv[k] = 1;
        this.toast(CRAFT[k].n + ' dibuat!');
        this.updateHeld();
        this.renderBag();
      });
      c.appendChild(b);
    }
    const eb = document.createElement('button');
    eb.className = 'btn small';
    eb.textContent = 'Makan 🍖';
    eb.addEventListener('click', () => this.eat());
    c.appendChild(eb);
  }

  openBag() { this.renderBag(); $('panelBag').classList.add('show'); this.paused = !this.online; }
  closeBag() { $('panelBag').classList.remove('show'); this.paused = false; }
  openPause() { $('panelPause').classList.add('show'); this.paused = !this.online; if (document.exitPointerLock) document.exitPointerLock(); }
  closePause() { $('panelPause').classList.remove('show'); this.paused = false; }

  renderBuildBar() {
    const w = $('buildItems');
    w.innerHTML = '';
    this.buildBtns = {};
    for (const k of Object.keys(BUILD)) {
      const b = document.createElement('button');
      b.className = 'bItem';
      b.innerHTML = `<span>${BUILD[k].ic}</span><b>${BUILD[k].n}</b><i>${this.costText(BUILD[k].cost)}</i>`;
      b.addEventListener('click', () => this.select(k), { signal: this.ac.signal });
      w.appendChild(b);
      this.buildBtns[k] = b;
    }
    this.select(this.sel);
  }

  select(k) {
    this.sel = k;
    for (const key in this.buildBtns) this.buildBtns[key].classList.toggle('sel', key === k);
    this.ghostKey = '';
    this.updateBuildAfford();
  }

  updateBuildAfford() {
    if (!this.buildBtns) return;
    for (const k in this.buildBtns) this.buildBtns[k].classList.toggle('no', !this.has(BUILD[k].cost));
  }

  toggleBuild() {
    if (this.paused || this.dead) return;
    this.build = !this.build;
    $('btnBuild').classList.toggle('on', this.build);
    $('buildBar').classList.toggle('show', this.build);
    $('btnAct').textContent = this.build ? '🔨' : '✊';
    if (!this.build && this.ghost) this.ghost.visible = false;
  }

  /* ================= PIECES ================= */
  pieceKey(k, x, y, z, r) {
    return `${k}|${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}|${k === 'api' ? 0 : r}`;
  }

  addPiece(k, x, y, z, r) {
    const key = this.pieceKey(k, x, y, z, r);
    if (this.pkeys.has(key)) return null;
    const grp = new THREE.Group();
    const p = { k, x, y, z, r, group: grp, key, boxes: [] };
    if (k === 'api') {
      const f = makeFire();
      grp.add(f.group);
      p.flame = f.flame;
      this.fires.push(p);
    } else {
      const cs = [1, 0, -1, 0][r], sn = [0, 1, 0, -1][r];
      for (const b of pieceBoxes(k)) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]), pieceMat(b.tex, b.color));
        m.position.set(b.c[0], b.c[1], b.c[2]);
        m.castShadow = true;
        m.receiveShadow = true;
        m.userData.ltop = b.c[1] + b.s[1] / 2;
        grp.add(m);
        if (!b.nc) {
          const wx = x + b.c[0] * cs + b.c[2] * sn;
          const wz = z - b.c[0] * sn + b.c[2] * cs;
          const hx = (r % 2 ? b.s[2] : b.s[0]) / 2;
          const hz = (r % 2 ? b.s[0] : b.s[2]) / 2;
          const box = { minx: wx - hx, maxx: wx + hx, minz: wz - hz, maxz: wz + hz, bottom: y + b.c[1] - b.s[1] / 2, top: y + b.c[1] + b.s[1] / 2, p };
          p.boxes.push(box);
          this.boxes.push(box);
        }
      }
    }
    grp.position.set(x, y, z);
    grp.rotation.y = (r * Math.PI) / 2;
    this.pieceGroup.add(grp);
    grp.updateMatrixWorld(true);
    grp.traverse((o) => {
      if (o.isMesh) {
        if (o.userData.ltop === undefined) o.userData.ltop = 0.3;
        o.userData.piece = p;
      }
    });
    this.pieces.push(p);
    this.pkeys.add(key);
    return p;
  }

  removePiece(p) {
    this.pieceGroup.remove(p.group);
    this.pieces = this.pieces.filter((q) => q !== p);
    this.boxes = this.boxes.filter((b) => b.p !== p);
    this.fires = this.fires.filter((q) => q !== p);
    this.pkeys.delete(p.key);
  }

  fwd() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.cam.quaternion);
  }

  aim() {
    const e = this.cam.position;
    const d = this.fwd();
    let hit = null;
    for (let s = 0.6; s <= 7; s += 0.25) {
      const px = e.x + d.x * s, py = e.y + d.y * s, pz = e.z + d.z * s;
      const hh = this.hf.sample(px, pz);
      if (py <= hh) { hit = { x: px, z: pz, base: hh, dist: s, onPiece: false, piece: null }; break; }
    }
    this.ray.set(e, d);
    this.ray.far = 7;
    const hs = this.ray.intersectObjects(this.pieceGroup.children, true);
    if (hs.length && (!hit || hs[0].distance < hit.dist)) {
      const h = hs[0];
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      const pc = h.object.userData.piece;
      if (n.y > 0.5) hit = { x: h.point.x, z: h.point.z, base: pc.y + h.object.userData.ltop, dist: h.distance, onPiece: true, piece: pc };
      else hit = { x: h.point.x + n.x * 0.5, z: h.point.z + n.z * 0.5, base: pc.y, dist: h.distance, onPiece: true, piece: pc };
    }
    return hit;
  }

  computePlace(k, hit) {
    const spec = BUILD[k];
    const sm = this.hf.sample;
    let x = hit.x, z = hit.z, y, r = k === 'dinding' || k === 'batu' ? this.rot % 2 : spec.rot4 ? this.rot % 4 : 0;
    if (spec.mode === 'cell') {
      x = Math.floor(x / 2) * 2 + 1;
      z = Math.floor(z / 2) * 2 + 1;
      y = hit.onPiece ? hit.base : Math.max(sm(x, z), sm(x + 1, z + 1), sm(x - 1, z - 1), sm(x + 1, z - 1), sm(x - 1, z + 1));
    } else if (spec.mode === 'edge') {
      if (r === 0) { x = Math.floor(x / 2) * 2 + 1; z = Math.round(z / 2) * 2; }
      else { x = Math.round(x / 2) * 2; z = Math.floor(z / 2) * 2 + 1; }
      const dx = r === 0 ? 1 : 0, dz = r === 0 ? 0 : 1;
      y = hit.onPiece ? hit.base : Math.max(sm(x, z), sm(x + dx, z + dz), sm(x - dx, z - dz));
    } else {
      y = hit.onPiece ? hit.base : sm(x, z);
    }
    const ground = hit.onPiece || sm(x, z) > 0.3;
    return { x, y, z, r, ok: ground };
  }

  makeGhost(k) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x40ff70, transparent: true, opacity: 0.45, depthWrite: false });
    if (k === 'api') {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 8), mat);
      m.position.y = 0.4;
      g.add(m);
    } else {
      for (const b of pieceBoxes(k)) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]), mat);
        m.position.set(b.c[0], b.c[1], b.c[2]);
        g.add(m);
      }
    }
    g.userData.mat = mat;
    return g;
  }

  updateGhost() {
    if (!this.build || this.sel === 'bongkar') {
      if (this.ghost) this.ghost.visible = false;
      this.placeInfo = null;
      return;
    }
    if (this.ghostKey !== this.sel) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = this.makeGhost(this.sel);
      this.scene.add(this.ghost);
      this.ghostKey = this.sel;
    }
    const hit = this.aim();
    if (!hit) { this.ghost.visible = false; this.placeInfo = null; return; }
    const pl = this.computePlace(this.sel, hit);
    const free = !this.pkeys.has(this.pieceKey(this.sel, pl.x, pl.y, pl.z, pl.r));
    const ok = pl.ok && free && this.has(BUILD[this.sel].cost);
    this.ghost.visible = true;
    this.ghost.position.set(pl.x, pl.y, pl.z);
    this.ghost.rotation.y = (pl.r * Math.PI) / 2;
    this.ghost.userData.mat.color.setHex(ok ? 0x40ff70 : 0xff4040);
    this.placeInfo = { pl, ok };
  }

  place() {
    if (this.sel === 'bongkar') {
      this.ray.set(this.cam.position, this.fwd());
      this.ray.far = 6;
      const hs = this.ray.intersectObjects(this.pieceGroup.children, true);
      if (!hs.length) return;
      const p = hs[0].object.userData.piece;
      this.removePiece(p);
      const c = BUILD[p.k].cost;
      for (const k in c) { const n = Math.floor(c[k] / 2); if (n > 0) this.p.inv[k] += n; }
      this.renderBag();
      this.updateBuildAfford();
      this.toast(BUILD[p.k].n + ' dibongkar');
      if (this.net) this.net.send({ t: 'd', k: p.k, x: p.x, y: p.y, z: p.z, r: p.r });
      this.swing = 0.01;
      return;
    }
    const info = this.placeInfo;
    if (!info) return;
    if (!this.has(BUILD[this.sel].cost)) { this.toast('Bahan kurang: ' + this.costText(BUILD[this.sel].cost)); return; }
    if (!info.ok) return;
    const { pl } = info;
    const p = this.addPiece(this.sel, pl.x, pl.y, pl.z, pl.r);
    if (!p) return;
    this.pay(BUILD[this.sel].cost);
    this.swing = 0.01;
    if (this.net) this.net.send({ t: 'b', k: this.sel, x: pl.x, y: pl.y, z: pl.z, r: pl.r });
  }

  /* ================= FISIKA ================= */
  collide(px, pz, py) {
    for (const n of this.nature.near(px, pz, 4)) {
      if (!n.alive || !n.cr) continue;
      const dx = px - n.x, dz = pz - n.z;
      const rr = n.cr + 0.35;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        px = n.x + (dx / d) * rr;
        pz = n.z + (dz / d) * rr;
      }
    }
    const R = 0.32;
    for (const b of this.boxes) {
      if (px < b.minx - 1 || px > b.maxx + 1 || pz < b.minz - 1 || pz > b.maxz + 1) continue;
      if (py + 1.7 <= b.bottom || py >= b.top - 0.65) continue;
      const cx = clamp(px, b.minx, b.maxx), cz = clamp(pz, b.minz, b.maxz);
      const dx = px - cx, dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          px = cx + (dx / d) * R;
          pz = cz + (dz / d) * R;
        } else {
          const l = px - b.minx, rr = b.maxx - px, f = pz - b.minz, bk = b.maxz - pz;
          const m = Math.min(l, rr, f, bk);
          if (m === l) px = b.minx - R;
          else if (m === rr) px = b.maxx + R;
          else if (m === f) pz = b.minz - R;
          else pz = b.maxz + R;
        }
      }
    }
    return [px, pz];
  }

  groundAt(px, pz, py) {
    let g = this.hf.sample(px, pz);
    for (const b of this.boxes) {
      if (px >= b.minx - 0.2 && px <= b.maxx + 0.2 && pz >= b.minz - 0.2 && pz <= b.maxz + 0.2 && py >= b.top - 0.65 && b.top > g) g = b.top;
    }
    return g;
  }

  movePlayer(dt) {
    const p = this.p;
    const locked = this.paused || this.dead || this.sleeping;
    let mx = locked ? 0 : this.inp.mx + this.keys.d - this.keys.a;
    let my = locked ? 0 : this.inp.my + this.keys.w - this.keys.s;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const wx = -sin * my + cos * mx;
    const wz = -cos * my - sin * mx;

    const gT = this.hf.sample(p.x, p.z);
    const g0 = this.groundAt(p.x, p.z, p.y);
    const swim = gT < -0.55 && g0 <= gT + 0.01;
    const run = this.keys.shift || len > 0.92;
    const sp = swim ? 2.4 : run ? 5.6 : 4.0;
    this.moving = len > 0.1;
    this.sprinting = run && len > 0.1 && !swim;
    if (this.moving) {
      let nx = p.x + wx * sp * dt, nz = p.z + wz * sp * dt;
      [nx, nz] = this.collide(nx, nz, p.y);
      p.x = clamp(nx, -HALF + 4, HALF - 4);
      p.z = clamp(nz, -HALF + 4, HALF - 4);
    }
    const gT2 = this.hf.sample(p.x, p.z);
    const g2 = this.groundAt(p.x, p.z, p.y);
    const swim2 = gT2 < -0.55 && g2 <= gT2 + 0.01;
    this.inWater = swim2;
    if (swim2) {
      p.vy = 0;
      p.y = lerp(p.y, -1.15, Math.min(1, dt * 5));
      this.onGround = false;
      this.jumpReq = false;
    } else {
      if (this.jumpReq && this.onGround && !locked) { p.vy = 7.6; this.onGround = false; }
      this.jumpReq = false;
      p.vy -= 22 * dt;
      p.y += p.vy * dt;
      if (p.y <= g2) { p.y = g2; p.vy = 0; this.onGround = true; }
      else this.onGround = p.y - g2 < 0.06 && p.vy <= 0;
    }
    if (this.moving && (this.onGround || swim2)) this.bobT += dt * sp * 1.8;
    const bob = this.moving ? Math.sin(this.bobT) * (swim2 ? 0.05 : 0.035) : 0;
    this.cam.position.set(p.x, p.y + 1.62 + bob, p.z);
    this.cam.rotation.set(p.pitch, p.yaw, 0);
  }

  /* ================= SURVIVAL ================= */
  hurt(n, silent) {
    if (this.dead) return;
    this.p.hp -= n;
    if (!silent) {
      const h = $('hurt');
      h.classList.add('show');
      setTimeout(() => h.classList.remove('show'), 180);
    }
  }

  survival(dt) {
    const p = this.p;
    if (this.dead) return;
    p.hunger = Math.max(0, p.hunger - (this.sprinting ? 0.11 : 0.075) * dt);
    p.thirst = Math.max(0, p.thirst - (this.sprinting ? 0.16 : 0.11) * dt);
    if (p.hunger <= 0 || p.thirst <= 0) this.hurt(1.2 * dt, true);
    else if (p.hunger > 40 && p.thirst > 40) p.hp = Math.min(100, p.hp + 0.8 * dt);
    const now = performance.now();
    if (now - this.lastLowMsg > 25000) {
      if (p.thirst < 20) { this.toast('Kamu haus! Cari air.'); this.lastLowMsg = now; }
      else if (p.hunger < 20) { this.toast('Kamu lapar! Cari makanan.'); this.lastLowMsg = now; }
    }
    if (p.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    $('panelDead').classList.add('show');
    this.timers.push(setTimeout(() => {
      const p = this.p;
      p.x = p.spawn.x; p.z = p.spawn.z;
      p.y = this.groundAt(p.x, p.z, 200);
      p.vy = 0;
      p.hp = 70; p.hunger = 60; p.thirst = 60;
      this.dead = false;
      $('panelDead').classList.remove('show');
    }, 3000));
  }

  eat() {
    const p = this.p;
    if (this.dead) return;
    const order = [
      ['matang', 45, 5, 0], ['ikanmatang', 35, 4, 0], ['buah', 12, 0, 6], ['daging', 20, -3, 0], ['ikan', 14, -2, 0],
    ];
    for (const [k, h, hp, th] of order) {
      if (p.inv[k] > 0) {
        p.inv[k]--;
        p.hunger = Math.min(100, p.hunger + h);
        p.thirst = Math.min(100, p.thirst + th);
        if (hp > 0) p.hp = Math.min(100, p.hp + hp);
        else if (hp < 0) this.hurt(-hp);
        this.toast('Makan ' + ITEMS[k]);
        this.renderBag();
        return;
      }
    }
    this.toast('Tidak ada makanan');
  }

  nearFire() {
    for (const f of this.fires) if (Math.hypot(f.x - this.p.x, f.z - this.p.z) < 3.4) return f;
    return null;
  }

  nearBed() {
    for (const b of this.pieces) {
      if (b.k === 'kasur' && Math.hypot(b.x - this.p.x, b.z - this.p.z) < 3.4 && Math.abs(b.y - this.p.y) < 2.5) return b;
    }
    return null;
  }

  canDrink() {
    if (this.inWater) return true;
    const p = this.p;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    for (const d of [1.2, 2.2, 3.2]) {
      if (this.hf.sample(p.x - sin * d, p.z - cos * d) < 0.05) return true;
    }
    return false;
  }

  updateCtx() {
    const raw = this.p.inv.daging + this.p.inv.ikan;
    let c = null;
    if (this.nearBed()) c = { id: 'sleep', t: '😴 Tidur' };
    else if (this.nearFire() && raw > 0) c = { id: 'cook', t: '🔥 Masak' };
    else if (this.canDrink()) c = { id: 'drink', t: '💧 Minum' };
    this.ctx = c;
    const b = $('btnCtx');
    if (c) { b.textContent = c.t; b.classList.add('show'); } else b.classList.remove('show');
  }

  doCtx() {
    if (!this.ctx || this.dead || this.sleeping) return;
    const p = this.p;
    if (this.ctx.id === 'drink') {
      if (this.drinkCd > 0) return;
      this.drinkCd = 0.6;
      p.thirst = Math.min(100, p.thirst + 30);
      this.toast('Glek glek... 💧');
    } else if (this.ctx.id === 'cook') {
      const a = p.inv.daging, b = p.inv.ikan;
      p.inv.matang += a; p.inv.ikanmatang += b; p.inv.daging = 0; p.inv.ikan = 0;
      this.toast(`Dimasak: ${a + b} makanan`);
      this.renderBag();
    } else if (this.ctx.id === 'sleep') {
      this.sleep(this.nearBed());
    }
  }

  sleep(bed) {
    const night = this.t < 0.23 || this.t > 0.77;
    this.p.spawn = { x: bed.x, z: bed.z };
    if (!night) { this.toast('Belum malam. Titik spawn diset di kasur.'); return; }
    if (this.online) { this.toast('Online: malam tidak bisa dilewati. Spawn diset di kasur.'); return; }
    this.sleeping = true;
    const f = $('fade');
    f.classList.add('show');
    this.timers.push(setTimeout(() => {
      this.t = 0.27;
      this.day++;
      this.p.hp = 100;
      this.p.hunger = Math.max(10, this.p.hunger - 10);
      this.p.thirst = Math.max(10, this.p.thirst - 10);
      f.classList.remove('show');
      this.sleeping = false;
      this.toast('Selamat pagi! Kamu merasa segar ☀️');
      this.save();
    }, 1800));
  }

  /* ================= AKSI ================= */
  pressAct() {
    if (this.paused || this.dead || this.sleeping) return;
    if (this.build) { this.place(); return; }
    this.act = true;
  }

  findTarget(reach) {
    const e = this.cam.position, d = this.fwd();
    let best = null, bt = 1e9;
    const test = (cx, cy, cz, rad) => {
      const vx = cx - e.x, vy = cy - e.y, vz = cz - e.z;
      const t = vx * d.x + vy * d.y + vz * d.z;
      if (t < 0.2 || t > reach + rad) return null;
      const perp2 = vx * vx + vy * vy + vz * vz - t * t;
      if (perp2 < rad * rad) return t;
      return null;
    };
    for (const n of this.nature.near(e.x, e.z, reach + 3)) {
      if (!n.alive) continue;
      const t = test(n.x, n.cy, n.z, n.r);
      if (t !== null && t < bt) { bt = t; best = { kind: 'node', n }; }
    }
    for (const a of this.animals.list) {
      if (a.dead) continue;
      const t = test(a.x, this.animals.center(a), a.z, a.def.hit);
      if (t !== null && t < bt) { bt = t; best = { kind: 'animal', a }; }
    }
    return best;
  }

  attack() {
    this.actCd = 0.48;
    this.swing = 0.01;
    const tg = this.findTarget(3.4);
    if (!tg) return;
    const inv = this.p.inv;
    if (tg.kind === 'node') {
      const n = tg.n;
      let dmg = 1;
      if (n.type === 'tree') dmg = inv.kapak ? 3 : 1;
      else if (n.type === 'rock') dmg = inv.kapak ? 2 : 1;
      n.hp -= dmg;
      if (n.hp <= 0) {
        this.nature.kill(n);
        if (n.type === 'tree') {
          this.give('kayu', 3 + ((Math.random() * 3) | 0) + (inv.kapak ? 1 : 0));
          if (Math.random() < 0.3) this.give('serat', 1);
        } else if (n.type === 'rock') this.give('batu', 2 + ((Math.random() * 2) | 0));
        else { this.give('buah', 2); this.give('serat', 1); }
      }
    } else {
      const a = tg.a;
      const dmg = inv.tombak ? 4 : inv.kapak ? 2 : 1;
      const drop = this.animals.hit(a, dmg);
      if (drop) this.give(drop[0], drop[1]);
    }
  }

  /* ================= REMOTE ================= */
  onNet(m) {
    if (m.t === 'p') {
      let r = this.remotes.get(m.id);
      if (!r) {
        const info = (this.o.players || []).find((q) => q.id === m.id) || { name: 'Pemain', skin: 0 };
        const g = buildChar(SKINS[info.skin] || SKINS[0]);
        const cv = document.createElement('canvas');
        cv.width = 256; cv.height = 64;
        const c = cv.getContext('2d');
        c.font = 'bold 34px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = 'rgba(0,0,0,.55)';
        c.fillRect(0, 8, 256, 48);
        c.fillStyle = '#fff';
        c.fillText(info.name, 128, 44);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
        sp.scale.set(1.8, 0.45, 1);
        sp.position.y = 2.5;
        g.add(sp);
        this.scene.add(g);
        r = { g, x: m.x, y: m.y, z: m.z, ry: m.r, mv: 0, t: 0 };
        this.remotes.set(m.id, r);
        this.toast(info.name + ' bergabung');
      }
      r.tx = m.x; r.ty = m.y; r.tz = m.z; r.try = m.r; r.mv = m.m;
    } else if (m.t === 'b') {
      this.addPiece(m.k, m.x, m.y, m.z, m.r);
    } else if (m.t === 'd') {
      const key = this.pieceKey(m.k, m.x, m.y, m.z, m.r);
      const p = this.pieces.find((q) => q.key === key);
      if (p) this.removePiece(p);
    } else if (m.t === 'left') {
      const r = this.remotes.get(m.id);
      if (r) { this.scene.remove(r.g); this.remotes.delete(m.id); this.toast('Pemain keluar'); }
    }
  }

  updateRemotes(dt) {
    for (const r of this.remotes.values()) {
      if (r.tx === undefined) continue;
      const k = Math.min(1, dt * 10);
      r.x = lerp(r.x, r.tx, k); r.y = lerp(r.y, r.ty, k); r.z = lerp(r.z, r.tz, k);
      let da = r.try + Math.PI - r.ry;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      r.ry += da * k;
      r.g.position.set(r.x, r.y, r.z);
      r.g.rotation.y = r.ry;
      r.t += dt * (r.mv ? 9 : 0);
      const s = r.mv ? Math.sin(r.t) * 0.7 : 0;
      const u = r.g.userData;
      u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s; u.armR.rotation.x = s;
    }
  }

  /* ================= SAVE ================= */
  save() {
    if (this.online) return;
    const p = this.p;
    const s = {
      seed: this.seed, t: this.t, day: this.day,
      p: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, hunger: p.hunger, thirst: p.thirst, inv: p.inv, spawn: p.spawn },
      pieces: this.pieces.map((q) => [q.k, q.x, q.y, q.z, q.r]),
      dead: this.nature.deadList(),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* penuh */ }
  }

  exit() {
    this.save();
    this.o.onExit && this.o.onExit();
  }

  /* ================= LOOP ================= */
  update(dt) {
    if (!this.running) return;
    const frozen = this.paused && !this.online;
    if (!frozen) {
      this.t += dt / DAYLEN;
      if (this.t >= 1) { this.t -= 1; this.day++; }
    }
    const p = this.p;
    if (!frozen) {
      this.movePlayer(dt);
      this.survival(dt);
      this.nature.tick(dt);
      this.animals.update(dt, p.x, p.z, p.y, this.t < 0.23 || this.t > 0.77, (n) => this.hurt(n));
      if (this.drinkCd > 0) this.drinkCd -= dt;
      if (this.actCd > 0) this.actCd -= dt;
      if (this.act && this.actCd <= 0 && !this.build) this.attack();
    }
    this.sky.update(this.t, this.cam.position, this.cam.position, dt);
    this.water.update(dt, performance.now() / 1000);

    /* tangan */
    if (this.swing > 0) {
      this.swing += dt / 0.3;
      if (this.swing >= 1) this.swing = 0;
    }
    const sw = this.swing > 0 ? Math.sin(this.swing * Math.PI) : 0;
    this.handR.rotation.x = 0.12 - sw * 1.0;
    this.handR.position.y = this.handR.userData.base.y + sw * 0.06 + (this.moving ? Math.sin(this.bobT * 1) * 0.01 : 0);
    this.handL.position.y = this.handL.userData.base.y + (this.moving ? Math.sin(this.bobT + 1.5) * 0.012 : 0);

    /* api unggun */
    const night = 1 - this.sky.day;
    const sorted = this.fires.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    for (let i = 0; i < this.fireLights.length; i++) {
      const f = sorted[i];
      const l = this.fireLights[i];
      if (f && Math.hypot(f.x - p.x, f.z - p.z) < 60) {
        l.position.set(f.x, f.y + 1.0, f.z);
        l.intensity = (1.6 + night * 2.2) * (0.85 + Math.random() * 0.3);
      } else l.intensity = 0;
    }
    for (const f of this.fires) {
      const s = 0.85 + Math.random() * 0.35;
      f.flame.scale.set(s, s * (0.9 + Math.random() * 0.3), s);
    }

    this.updateGhost();
    this.updateRemotes(dt);

    this.ctxT -= dt;
    if (this.ctxT <= 0) { this.ctxT = 0.2; this.updateCtx(); this.updateBuildAfford(); }

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.updateHud(); }

    if (this.net) {
      this.netT -= dt;
      if (this.netT <= 0) {
        this.netT = 0.1;
        this.net.send({ t: 'p', id: this.net.myId, x: p.x, y: p.y, z: p.z, r: p.yaw, m: this.moving ? 1 : 0 });
      }
    }
    if (!this.online) {
      this.saveT += dt;
      if (this.saveT > 20) { this.saveT = 0; this.save(); }
    }
  }

  updateHud() {
    const p = this.p;
    $('barHpF').style.width = clamp(p.hp, 0, 100) + '%';
    $('barFoodF').style.width = clamp(p.hunger, 0, 100) + '%';
    $('barWaterF').style.width = clamp(p.thirst, 0, 100) + '%';
    const hh = Math.floor(this.t * 24), mm = Math.floor((this.t * 24 - hh) * 60);
    const icon = this.sky.day > 0.5 ? '☀️' : this.t > 0.2 && this.t < 0.3 || this.t > 0.7 && this.t < 0.8 ? '🌅' : '🌙';
    $('clockTxt').textContent = `${icon} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Hari ${this.day}`;
  }

  render() {
    this.r.render(this.scene, this.cam);
  }

  dispose() {
    this.running = false;
    this.ac.abort();
    for (const t of this.timers) clearTimeout(t);
    if (document.exitPointerLock) document.exitPointerLock();
    this.scene.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry) o.geometry.dispose();
    });
    this.r.shadowMap.enabled = false;
    $('panelBag').classList.remove('show');
    $('panelPause').classList.remove('show');
    $('panelDead').classList.remove('show');
    $('fade').classList.remove('show');
    $('toasts').innerHTML = '';
  }
}
