import * as THREE from 'three';
import { clamp, lerp, sleep } from './util.js';
import { genHeights, makeTerrain, makeWater, makeSky, makeNature, HALF } from './world.js';
import { Animals } from './animals.js';
import { buildChar, SKINS, normLook, lookFromSkin, packLook, unpackLook, resetPose, applyEmote, EMOTE_BY_ID } from './chars.js';
import { emoteMixin } from './emotes.js';
import { Audio } from './audio.js';
import { ITEMS, ICON, STACK, CAP_BAG, CAP_CART, CRAFT, costText } from './items.js';
import { BUILD, EDGE_KINDS, PIECE_LIGHT, pieceCols, createPiece, makeFire, makeGhostModel } from './pieces.js';
import { Vessel, vesselMixin } from './vessel.js';
import { Mine, MINE_Y, findCaves, makeEntrance } from './mine.js';
import { HudEditor } from './hudedit.js';
import { actionsMixin } from './actions.js';
import { warMixin, ARMOR } from './war.js';
import { WAR_SEED } from './net.js';
import { loadSave, writeSave } from './worlds.js';
import { ico, costIcons, setIcon, setIconText, iconURL } from './icons.js';

const $ = (id) => document.getElementById(id);
export { BUILD };
const DAYLEN = 360;

/* preset grafik */
const VIEW = { dekat: 0.5, sedang: 1, jauh: 1.8, sangat: 3 };
const GFX = {
  smooth: { pr: 0.85, prMin: 0.5, adapt: true, shadows: false, grass: false, fogN: 40, fogF: 150, cull: 55, birds: false, low: true, lights: 2 },
  standar: { pr: 1, shadows: false, grass: false, fogN: 60, fogF: 240, cull: 110, birds: true, low: false, lights: 3 },
  ultra: { pr: 'dpr', shadows: true, grass: true, fogN: 90, fogF: 420, cull: 200, birds: true, low: false, lights: 3 },
};

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export class Game {
  constructor(renderer, settings, opts) {
    this.r = renderer;
    this.set = settings;
    this.o = opts;
    this.online = !!opts.online;
    this.net = opts.net || null;
    this.wdata = opts.world || null; /* dunia buatan sendiri (disimpan) */
    this.persist = !!opts.world;
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 1300);
    this.cam.rotation.order = 'YXZ';
    this.scene.add(this.cam);
    this.ray = new THREE.Raycaster();
    this.ac = new AbortController();
    this.def = SKINS[opts.skinId || 0] || SKINS[0];
    this.myLook = normLook(opts.look || lookFromSkin(this.def));
    this.lookStr = packLook(this.myLook);
    this.pSeq = 0;
    this.eye = new THREE.Vector3();
    this.tp = false;
    this._f = new THREE.Vector3();

    this.p = {
      x: 0, y: 3.2, z: 0, vy: 0, yaw: 0, pitch: 0,
      hp: 100, hunger: 90, thirst: 90,
      inv: {},
      spawn: { x: 0, z: 0 },
      on: null, lx: 0, lz: 0, embFull: false,
    };
    for (const k of Object.keys(ITEMS)) this.p.inv[k] = 0;
    this.t = 0.3;
    this.day = 1;
    this.inp = { mx: 0, my: 0 };
    this.keys = { w: 0, a: 0, s: 0, d: 0, shift: 0 };
    this.jumpBuf = 0;
    this.coyote = 0;
    this.crouch = false;
    this.crouchT = 0;
    this.act = false;
    this.actCd = 0;
    this.swing = 0;
    this.onGround = false;
    this.inWater = false;
    this.bobT = 0;
    this.paused = false;
    this.dead = false;
    this.sleeping = false;
    this.sleepBed = null;
    this.busy = false;
    this.hudEditing = false;
    this.build = false;
    this.sel = 'lantai';
    this.rot = 0;
    this.pieces = [];
    this.boxes = [];
    this.fires = [];
    this.pkeys = new Set();
    this.vessels = [];
    this.driving = null;
    this.remotes = new Map();
    this.initEmote(this.myLook);
    this.sleepers = new Set();
    this.netT = 0;
    this.hudT = 0;
    this.saveT = 0;
    this.ctxT = 0;
    this.lightT = 0;
    this.drinkCd = 0;
    this.ctx = null;
    this.lastLowMsg = 0;
    this.ghost = null;
    this.ghostKey = '';
    this.ghostT = 0;
    this.timers = [];
    this.running = false;
    this.sprinting = false;
    this.seed = opts.seed || 1;
    this.war = !!opts.war || opts.seed === WAR_SEED;
    this.money = 0; this.armor = 0; this.npcs = [];
    this.stats = { chop: 0, mine: 0, built: 0, api: 0, hunt: 0, cook: 0, bed: 0, sleep: 0, ore: 0, smelt: 0, ember: 0, fish: 0, dock: 0, boat: 0, sail: 0, dig: 0 };
    this.quest = 0;
    this.chips = [];
    this.tgtT = 0;
    this.lastPick = 0;
    this.wasWater = false;
    this.fireT = 0;
    this.stateTimer = null;
    this.eq = 'tangan';
    this.inCave = false;
    this.caveIdx = -1;
    this.caves = [];
    this.cart = null;
    this.hitch = false;
    this.anim = new Set();
    this.lightCand = [];
    this.adAcc = 0;
    this.adN = 0;
    this.msgT = {};
    this.chatLines = [];
    this.chatCd = 0;
    this.hotSig = '';
    this.voice = null;
    this.micBusy = false;
    this.fish = { st: 'idle', t: 0, x: 0, z: 0 };
    this.refreshMs = 16.7;
    this.edge = HALF;
  }

  /* ================= LOAD ================= */
  async load(progress) {
    let saved = null;
    if (this.persist) saved = loadSave(this.wdata.id);
    this.seed = this.persist ? this.wdata.seed : this.o.seed || (Math.random() * 1e9) | 0;
    this.saved = saved;
    const ultra = this.set.gfx === 'ultra';
    const steps = [
      ['Membentuk daratan...', () => { this.hf = genHeights(this.seed, this.war); }],
      ['Menumbuhkan rumput...', () => { this.terrain = makeTerrain(this.hf, this.seed); this.scene.add(this.terrain); }],
      ['Mengisi lautan...', () => { this.water = makeWater(); this.scene.add(this.water); }],
      ['Menerbitkan matahari...', () => { this.sky = makeSky(this.scene); this.pieceGroup = new THREE.Group(); this.scene.add(this.pieceGroup); }],
      ['Menanam hutan...', () => { this.nature = makeNature(this.hf, this.seed, this.scene); }],
      ['Memanggil hewan...', () => { this.animals = new Animals(this.hf, this.seed, this.scene, ultra); }],
      ['Menggali tambang...', () => { this.makeCaves(); }],
      ['Menyiapkan tangan...', () => { this.makeHands(); this.makeLights(); this.makeChips(); }],
      ['Memuat dunia...', () => { this.restore(); }],
      ['Membangun istana...', () => { if (this.war) this.makeWar(); }],
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

  makeCaves() {
    this.caves = findCaves(this.hf, this.seed);
    this.caveMeshes = [];
    for (const c of this.caves) {
      const m = makeEntrance(c);
      this.scene.add(m);
      this.caveMeshes.push(m);
      c.ox = Math.sin(c.ang);
      c.oz = Math.cos(c.ang);
      /* bersihkan pohon/batu di depan pintu goa */
      for (const n of this.nature.near(c.x, c.z, 7)) if (n.alive && Math.hypot(n.x - c.x - c.ox * 2, n.z - c.z - c.oz * 2) < 5.5) this.nature.kill(n);
    }
    this.mine = new Mine(this.seed, this.scene);
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
      p.embFull = !!s.p.embFull;
      if (s.stats) Object.assign(this.stats, s.stats);
      this.quest = s.quest || 0;
      this.eq = s.eq || (p.inv.tombak > 0 ? 'tombak' : p.inv.kapak > 0 ? 'kapak' : 'tangan');
      for (const v of s.vessels || []) {
        const V = new Vessel(v.id, this.scene);
        V.setPivot(v.px, v.pz);
        V.x = v.x; V.z = v.z; V.yaw = v.yaw; V.hOff = v.h || 0;
        V.sync();
        this.vessels.push(V);
      }
      for (const q of s.pieces || []) this.addPiece(q[0], q[1], q[2], q[3], q[4], !!q[5], q[6] ? this.vesselById(q[6]) : null);
      for (const V of this.vessels) V.refresh();
      this.nature.killIdx(s.dead || []);
      if (s.cart) this.spawnCart(s.cart.x, s.cart.z, s.cart.yaw, s.cart.inv);
      if (typeof s.cv === 'number' && s.cv >= 0 && this.caves[s.cv]) this.setCave(true, s.cv);
    } else {
      p.x = 3; p.z = 3;
      p.y = this.hf.sample(p.x, p.z);
      p.spawn = { x: 3, z: 3 };
      p.yaw = Math.PI * 0.75;
    }
    if (this.eq !== 'tangan' && !(this.p.inv[this.eq] > 0)) this.eq = 'tangan';
    this.updateHeld();
  }

  /* kolam 3 lampu titik yang dibagikan ke sumber cahaya terdekat */
  makeLights() {
    this.lightPool = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xff9a3c, 0, 16, 2);
      this.scene.add(l);
      this.lightPool.push(l);
    }
  }

  applySettings() {
    const q = GFX[this.set.gfx] || GFX.standar;
    this.q = q;
    const dpr = window.devicePixelRatio || 1;
    this.baseRatio = q.pr === 'dpr' ? Math.min(dpr, 2) : q.pr;
    this.ratio = q.adapt ? Math.min(this.baseRatio, 0.75) : this.baseRatio;
    this.r.setPixelRatio(this.ratio);
    this.r.setSize(innerWidth, innerHeight);
    this.r.shadowMap.enabled = q.shadows;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sky.setShadows(q.shadows);
    const vm = VIEW[this.set.view] || 1;
    this.sky.fogNear = q.fogN * vm;
    this.sky.fogFar = q.fogF * vm;
    this.nature.setLow(q.low);
    this.nature.setGrass(q.grass && !this.inCave && !this.war);
    this.animals.setCull(q.cull * vm);
    this.animals.setBirds(q.birds && !this.inCave);
    this.scene.traverse((o) => {
      if (o.isMesh && o.material && !Array.isArray(o.material)) o.material.needsUpdate = true;
    });
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }

  /* resolusi dinamis untuk grafik Smooth: turunkan kalau berat, naikkan kalau ringan */
  frameStat(ms, targetMs) {
    if (!this.q || !this.q.adapt) return;
    this.adAcc += ms;
    this.adN++;
    if (this.adAcc < 1800) return;
    const avg = this.adAcc / this.adN;
    this.adAcc = 0;
    this.adN = 0;
    let nr = this.ratio;
    if (avg > targetMs * 1.3) nr -= 0.07;
    else if (avg < targetMs * 1.08) nr += 0.04;
    nr = clamp(nr, this.q.prMin, this.baseRatio);
    if (Math.abs(nr - this.ratio) >= 0.03) {
      this.ratio = nr;
      this.r.setPixelRatio(nr);
      this.r.setSize(innerWidth, innerHeight);
    }
  }

  resize() {
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
    HudEditor.scaleVar();
  }

  /* ================= INPUT ================= */
  begin() {
    this.running = true;
    window.__ps = { CRAFT, BUILD };
    this.hud = new HudEditor();
    this.hud.apply();
    $('hud').classList.toggle('online', this.online);
    this.bindInput();
    this.renderBuildBar();
    this.renderBag();
    this.renderHotbar(true);
    $('btnBuild').classList.remove('on');
    $('buildBar').classList.remove('show');
    setIcon($('btnAct'), 'fist');
    $('hintArrow').src = iconURL('arrow');
    $('btnCrouch').classList.remove('on');
    $('btnMic').classList.remove('on');
    $('chatFeed').innerHTML = '';
    $('chatBar').classList.remove('show');
    $('voiceTag').textContent = '';
    $('pauseSave').style.display = this.persist ? '' : 'none';
    $('pauseExit').innerHTML = this.persist ? 'Simpan &amp; Keluar' : 'Keluar';
    this.toast('Selamat datang, ' + (this.o.name || 'Santay') + '!');
    this.updateQuest(true);
    Audio.music('game');
    Audio.ambient(true);
    if (this.net) {
      this.net.send({ t: 'req' });
      this.initVoice();
    }
    if (this.persist) this.save();
  }

  /* dunia sendiri: jaringan baru tersambung di belakang layar (pemain lain bisa masuk) */
  attachNet(net) {
    if (this.net || !this.running) return;
    this.net = net;
    this.online = true;
    $('hud').classList.add('online');
    this.initVoice();
    this.toast('Dunia terbuka — pemain lain bisa masuk');
  }

  /* bekukan dunia saat jeda hanya bila tidak ada pemain lain */
  mp() { return this.online && (!this.persist || this.remotes.size > 0); }

  /* ================= MISI ================= */
  questList() {
    const st = this.stats, inv = this.p.inv;
    return [
      { t: 'Tebang 3 pohon: dekati pohon lalu TAHAN tombol Serang (kepalan)', ok: () => st.chop >= 3 },
      { t: 'Kumpulkan Batu: pukul batu abu-abu besar sampai pecah (2 batu)', ok: () => st.mine >= 2 },
      { t: 'Buka Tas, tab Alat, buat Kapak (5 Kayu + 3 Batu)', ok: () => inv.kapak > 0 || inv.kapakbesi > 0 },
      { t: 'Tekan tombol Bangun (palu) dan pasang 4 bagian rumah', ok: () => st.built >= 4 },
      { t: 'Bangun Api Unggun (3 Kayu + 2 Batu)', ok: () => st.api >= 1 },
      { t: 'Berburu 1 hewan (kelinci/rusa) untuk dapat Daging', ok: () => st.hunt >= 1 },
      { t: 'Masak daging mentah: berdiri dekat api, tekan tombol Masak', ok: () => st.cook >= 1 },
      { t: 'Bangun Kasur (6 Kayu + 4 Serat). Serat dari menebang pohon / semak buah', ok: () => st.bed >= 1 },
      { t: 'Tidur di kasur saat malam (tekan tombol Tidur di dekat kasur)', ok: () => st.sleep >= 1 },
      { t: 'Buat Beliung: Tas > Bahan > Tali (3 Serat), lalu Tas > Alat > Beliung. Pegang di hotbar', ok: () => inv.beliung > 0 || inv.beliungbesi > 0 },
      { t: 'Ikuti panah Goa di bawah. Masuk, bawa Obor, tambang 3 bijih/batu bara', ok: () => st.ore >= 3 },
      { t: 'Gali Tanah dengan Sekop, bangun Tungku, lalu Lebur Bijih jadi Besi', ok: () => st.smelt >= 1 },
      { t: 'Buat Ember, isi air di laut/danau, lalu minum', ok: () => st.ember >= 1 },
      { t: 'Buat Pancing dan tangkap 1 ikan di laut', ok: () => st.fish >= 1 },
      { t: 'Bangun Dermaga di pantai', ok: () => st.dock >= 1 },
      { t: 'Rakit kapal: lantai di air + Mesin + Setir', ok: () => st.boat >= 1 },
      { t: 'Berlayar! Dekati Setir, tekan tombol Kemudi', ok: () => st.sail >= 1 },
    ];
  }

  updateQuest(force) {
    { const e = $('questTxt'); const bx = e && e.parentElement; if (bx) bx.style.display = this.war ? 'none' : ''; }
    if (this.war) return;
    const q = this.questList();
    let changed = false;
    while (this.quest < q.length && q[this.quest].ok()) {
      this.quest++;
      changed = true;
      this.toast('Misi selesai!');
      Audio.sfx('quest');
      this.p.hunger = Math.min(100, this.p.hunger + 8);
    }
    if (!changed && !force) return;
    const el = $('questTxt');
    if (this.quest >= q.length) el.textContent = ' Semua misi selesai! Jelajahi & bangun bebas.';
  else el.textContent = ` Misi ${this.quest + 1}/${q.length}: ${q[this.quest].t}`;
  }

  /* ================= PARTIKEL ================= */
  makeChips() {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      m.visible = false;
      this.scene.add(m);
      this.chips.push({ m, vx: 0, vy: 0, vz: 0, life: 0 });
    }
  }

  burst(x, y, z, color, n = 7) {
    let k = 0;
    for (const c of this.chips) {
      if (c.life > 0) continue;
      c.life = 0.55 + Math.random() * 0.3;
      c.m.visible = true;
      c.m.position.set(x, y, z);
      c.m.material.color.setHex(color);
      c.vx = (Math.random() - 0.5) * 3.2;
      c.vy = 1.5 + Math.random() * 2.5;
      c.vz = (Math.random() - 0.5) * 3.2;
      if (++k >= n) break;
    }
  }

  updateChips(dt) {
    for (const c of this.chips) {
      if (c.life <= 0) continue;
      c.life -= dt;
      c.vy -= 12 * dt;
      c.m.position.x += c.vx * dt;
      c.m.position.y += c.vy * dt;
      c.m.position.z += c.vz * dt;
      if (c.life <= 0) c.m.visible = false;
    }
  }

  /* dunia aktif: pepohonan di luar, batu/bijih di dalam goa */
  world() { return this.inCave ? this.mine : this.nature; }
  terr(x, z) { return this.inCave ? MINE_Y : this.hf.sample(x, z); }
  activeBoxes() { return this.inCave ? this.mine.boxes : this.boxes; }

  /* ================= TARGET (label di tengah layar) ================= */
  updateTarget() {
    const box = $('target');
    if (this.build || this.paused || this.dead || this.sleeping || this.driving) { box.classList.remove('show'); return; }
    const tg = this.findTarget(3.6);
    if (!tg) { box.classList.remove('show'); this.tgt = null; return; }
    this.tgt = tg;
    let name, hp, max;
    if (tg.kind === 'node') {
      const n = tg.n;
      if (n.type === 'ore') name = n.ore === 'coal' ? 'Batu Bara' : 'Bijih Besi';
      else name = n.type === 'tree' ? (n.kind === 'palm' ? 'Pohon Kelapa' : 'Pohon') : n.type === 'rock' ? 'Batu' : 'Semak Buah';
      hp = n.hp; max = n.max;
    } else {
      const a = tg.a;
      name = { rabbit: 'Kelinci', deer: 'Rusa', wolf: 'Serigala', fish: 'Ikan' }[a.type];
      hp = a.hp; max = a.def.hp;
    }
    $('targetName').textContent = name + '  ·  tahan Serang';
    $('targetFill').style.width = clamp((hp / max) * 100, 0, 100) + '%';
    box.classList.add('show');
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
      const sc = rc.width / (joy.offsetWidth || rc.width);
      let dx = e.clientX - (rc.left + R), dy = e.clientY - (rc.top + R);
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx / sc}px,${dy / sc}px)`;
      this.inp.mx = dx / R;
      this.inp.my = -dy / R;
    };
    joy.addEventListener('pointerdown', (e) => {
      if (this.hudEditing) return;
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
      if (this.paused || this.dead || this.hudEditing) return;
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

    /* tombol: respons langsung saat disentuh + umpan balik visual */
    const buzz = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) { /* abaikan */ } };
    const btn = (id, down, up) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => {
        if (this.hudEditing) return;
        e.preventDefault();
        e.stopPropagation();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* abaikan */ }
        el.classList.add('down');
        buzz();
        down();
      }, sig);
      const rel = (e) => { el.classList.remove('down'); if (up) up(e); };
      el.addEventListener('pointerup', rel, sig);
      el.addEventListener('pointercancel', rel, sig);
      el.addEventListener('lostpointercapture', () => el.classList.remove('down'), sig);
    };
    btn('btnAct', () => this.pressAct(), () => { this.act = false; });
    btn('btnJump', () => this.pressJump());
    btn('btnCrouch', () => this.toggleCrouch());
    btn('btnBuild', () => this.toggleBuild());
    btn('btnRot', () => { this.rot = (this.rot + 1) % 4; });
    btn('btnEat', () => this.eat());
    btn('btnCtx', () => this.doCtx());
    btn('btnBag', () => this.openBag());
    btn('btnPause', () => this.openPause());
    btn('btnMic', () => this.toggleMic());
    btn('btnChat', () => this.openChat());
    btn('btnEmote', () => this.openEmote());
    $('emoteClose').addEventListener('click', () => this.closeEmote(), sig);
    $('emoteWheel').addEventListener('pointerdown', (e) => { if (e.target === $('emoteWheel')) this.closeEmote(); }, sig);
    $('bagClose').addEventListener('click', () => this.closeBag(), sig);
    $('pauseResume').addEventListener('click', () => this.closePause(), sig);
    $('pauseSettings').addEventListener('click', () => this.o.openSettings && this.o.openSettings(), sig);
    $('pauseHud').addEventListener('click', () => this.startHudEdit(), sig);
    $('pauseGuide').addEventListener('click', () => this.o.openGuide && this.o.openGuide(), sig);
    $('pauseSave').addEventListener('click', () => { this.save(); this.toast('Dunia tersimpan'); }, sig);
    $('pauseExit').addEventListener('click', () => this.exit(), sig);
    $('chatSend').addEventListener('click', () => this.sendChat(), sig);
    $('chatClose').addEventListener('click', () => this.closeChat(), sig);
    $('chatIn').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.sendChat(); }
      else if (e.key === 'Escape') this.closeChat();
    }, sig);
    window.addEventListener('resize', () => { this.resize(); if (this.hud && !this.hud.editing) this.hud.apply(); }, sig);
    window.addEventListener('orientationchange', () => setTimeout(() => { this.resize(); this.hud && this.hud.apply(); }, 250), sig);

    /* keyboard */
    const kmap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd', ShiftLeft: 'shift' };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (kmap[e.code]) this.keys[kmap[e.code]] = 1;
      else if (e.code === 'Space') this.pressJump();
      else if (e.code === 'KeyC' || e.code === 'ControlLeft') this.toggleCrouch();
      else if (e.code === 'KeyE') this.doCtx();
      else if (e.code === 'KeyF') this.eat();
      else if (e.code === 'KeyB') this.toggleBuild();
      else if (e.code === 'KeyR') this.rot = (this.rot + 1) % 4;
      else if (e.code === 'KeyV') this.toggleMic();
      else if (e.code === 'Enter' || e.code === 'KeyT') { e.preventDefault(); this.openChat(); }
      else if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); if ($('panelBag').classList.contains('show')) this.closeBag(); else this.openBag(); }
      else if (e.code === 'Escape') {
        if ($('panelBag').classList.contains('show')) this.closeBag();
        else if ($('panelPause').classList.contains('show')) this.closePause();
        else this.openPause();
      }
      else if (e.code.startsWith('Digit')) {
        const i = parseInt(e.code.slice(5), 10) - 1;
        if (this.build) {
          const keys = Object.keys(BUILD);
          if (keys[i]) this.select(keys[i]);
        } else this.hotSelect(i);
      }
    }, sig);
    window.addEventListener('keyup', (e) => { if (kmap[e.code]) this.keys[kmap[e.code]] = 0; }, sig);
  }

  look(dx, dy) {
    if (this.sleeping || this.busy) return;
    const s = 0.0042 * (this.set.sens || 1);
    this.p.yaw -= dx * s;
    this.p.pitch = clamp(this.p.pitch - dy * s, -1.45, 1.45);
  }

  pressJump() {
    if (this.paused || this.dead || this.hudEditing) return;
    if (this.driving) { this.stopDrive(); return; }
    if (this.sleeping) return;
    this.jumpBuf = 0.18;
  }

  toggleCrouch() {
    if (this.paused || this.dead || this.sleeping || this.driving || this.hudEditing) return;
    if (this.inWater) { this.toast('Tidak bisa jongkok di air'); return; }
    if (this.crouch) {
      if (!this.canStand()) { this.toast('Tidak muat berdiri di sini'); return; }
      this.crouch = false;
    } else this.crouch = true;
    $('btnCrouch').classList.toggle('on', this.crouch);
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

  /* toast yang tidak spam */
  toastOnce(key, msg, gap = 1800) {
    const now = performance.now();
    if (now - (this.msgT[key] || 0) < gap) return;
    this.msgT[key] = now;
    this.toast(msg);
  }

  bagCount() {
    let n = 0;
    for (const k of STACK) n += this.p.inv[k] || 0;
    return n;
  }

  cartReach() {
    if (!this.cart) return false;
    if (this.hitch) return true;
    return Math.hypot(this.cart.x - this.p.x, this.cart.z - this.p.z) < 7;
  }

  cartCount() {
    if (!this.cart) return 0;
    let n = 0;
    for (const k of STACK) n += this.cart.inv[k] || 0;
    return n;
  }

  /* terima item: tas dulu, kalau penuh masuk gerobak (kalau ada di dekat) */
  give(item, n, silent) {
    let left = n;
    if (STACK.includes(item)) {
      const room = Math.max(0, CAP_BAG - this.bagCount());
      const take = Math.min(room, left);
      this.p.inv[item] = (this.p.inv[item] || 0) + take;
      left -= take;
      if (left > 0 && this.cartReach()) {
        const cr = Math.max(0, CAP_CART - this.cartCount());
        const c = Math.min(cr, left);
        if (c > 0) {
          this.cart.inv[item] = (this.cart.inv[item] || 0) + c;
          left -= c;
          this.toastOnce('tocart', 'Tas penuh, masuk gerobak');
        }
      }
      if (left > 0) this.toastOnce('full', 'Tas penuh! Buang/pakai barang');
      if (n - left <= 0) return;
    } else this.p.inv[item] = (this.p.inv[item] || 0) + n;
    if (!silent) this.toast(`+${n - left} ${ITEMS[item]}`);
    const now = performance.now();
    if (now - this.lastPick > 120) { Audio.sfx('pickup'); this.lastPick = now; }
    this.renderBag();
    this.updateBuildAfford();
  }

  has(cost) {
    for (const k in cost) if ((this.p.inv[k] || 0) < cost[k]) return false;
    return true;
  }

  pay(cost) {
    for (const k in cost) this.p.inv[k] -= cost[k];
    this.checkEq();
    this.renderBag();
    this.updateBuildAfford();
  }

  costText(cost) { return costText(cost); }

  openBag() {
    if (this.dead || this.hudEditing) return;
    if (this.build) this.toggleBuild();
    this.fishCancel();
    this.act = false;
    $('panelBag').classList.add('show');
    this.renderBag(); /* panel harus sudah tampil, kalau tidak render dilewati */
    this.paused = !this.mp();
    if (document.exitPointerLock) document.exitPointerLock();
  }

  closeBag() { $('panelBag').classList.remove('show'); this.paused = false; }

  openPause() {
    $('panelPause').classList.add('show');
    this.paused = !this.mp();
    if (document.exitPointerLock) document.exitPointerLock();
  }

  closePause() { $('panelPause').classList.remove('show'); this.paused = false; }

  startHudEdit() {
    $('panelPause').classList.remove('show');
    this.hudEditing = true;
    this.paused = !this.mp();
    this.inp.mx = 0; this.inp.my = 0;
    this.hud.start(() => {
      this.hudEditing = false;
      this.paused = false;
    });
  }

  renderBuildBar() {
    const w = $('buildItems');
    w.innerHTML = '';
    this.buildBtns = {};
    for (const k of Object.keys(BUILD)) {
      const b = document.createElement('button');
      b.className = 'bItem';
      b.innerHTML = `${ico('b_' + k)}<b>${BUILD[k].n}</b><i>${costIcons(BUILD[k].cost)}</i>`;
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
    if (this.war) { this.toast('Map War: dilarang membangun / menghancurkan'); return; }
    if (this.paused || this.dead || this.sleeping || this.driving || this.hudEditing) return;
    this.build = !this.build;
    if (this.build) this.fishCancel();
    $('btnBuild').classList.toggle('on', this.build);
    $('buildBar').classList.toggle('show', this.build);
    $('hotbar').classList.toggle('gone', this.build);
    setIcon($('btnAct'), this.build ? 'hammer' : 'fist');
    if (!this.build && this.ghost) this.ghost.visible = false;
  }

  /* ================= PIECES ================= */
  pieceKey(k, x, y, z, r, vid) {
    return `${k}|${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}|${k === 'api' ? 0 : r}|${vid || ''}`;
  }

  /* bangun ulang kotak tabrakan sebuah potongan (dipanggil saat dibuat & saat pintu dibuka/tutup) */
  buildBoxes(p) {
    const list = p.vessel ? p.vessel.boxes : this.boxes;
    for (const b of p.boxes) { const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); }
    p.boxes = [];
    const cs = [1, 0, -1, 0][p.r], sn = [0, 1, 0, -1][p.r];
    for (const b of pieceCols(p.k, p.o)) {
      const wx = p.x + b.c[0] * cs + b.c[2] * sn;
      const wz = p.z - b.c[0] * sn + b.c[2] * cs;
      const hx = (p.r % 2 ? b.s[2] : b.s[0]) / 2;
      const hz = (p.r % 2 ? b.s[0] : b.s[2]) / 2;
      const box = { minx: wx - hx, maxx: wx + hx, minz: wz - hz, maxz: wz + hz, bottom: p.y + b.c[1] - b.s[1] / 2, top: p.y + b.c[1] + b.s[1] / 2, p };
      p.boxes.push(box);
      list.push(box);
    }
  }

  addPiece(k, x, y, z, r, open, V) {
    if (!BUILD[k]) return null;
    const key = this.pieceKey(k, x, y, z, r, V ? V.id : '');
    if (this.pkeys.has(key)) return null;
    let grp, ex;
    if (k === 'api') { const f = makeFire(); grp = f.group; ex = { flame: f.flame }; }
    else { const c = createPiece(k); grp = c.group; ex = c.ex; }
    const p = { k, x, y, z, r, o: !!open, group: grp, ex, key, boxes: [], vessel: V || null, leafA: 0 };
    this.buildBoxes(p);
    grp.position.set(x, y, z);
    grp.rotation.y = (r * Math.PI) / 2;
    (V ? V.inner : this.pieceGroup).add(grp);
    grp.traverse((o) => {
      if (o.isMesh) {
        if (o.userData.ltop === undefined) o.userData.ltop = 0.3;
        o.userData.piece = p;
      }
    });
    if (k === 'pintu') { p.leafA = p.o ? -Math.PI / 2 : 0; ex.leaf.rotation.y = p.leafA; }
    this.pieces.push(p);
    this.pkeys.add(key);
    if (V) { V.pieces.push(p); V.refresh(); }
    if (k === 'api') this.fires.push(p);
    this.lightT = 0;
    return p;
  }

  removePiece(p) {
    if (p.group.parent) p.group.parent.remove(p.group);
    const list = p.vessel ? p.vessel.boxes : this.boxes;
    for (const b of p.boxes) { const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); }
    p.boxes = [];
    this.pieces = this.pieces.filter((q) => q !== p);
    this.fires = this.fires.filter((q) => q !== p);
    this.pkeys.delete(p.key);
    this.anim.delete(p);
    if (this.sleepBed === p) this.wake(true);
    const V = p.vessel;
    if (V) {
      V.pieces = V.pieces.filter((q) => q !== p);
      V.refresh();
      if (this.driving === V && (!V.helm || !V.engines)) { this.stopDrive(); this.toast('Kapal tidak bisa dikemudikan lagi'); }
      if (!V.pieces.length) this.removeVessel(V);
    }
    this.lightT = 0;
  }

  /* tombol pintu: buka/tutup */
  toggleDoor(p, remote) {
    p.o = !p.o;
    this.buildBoxes(p);
    this.anim.add(p);
    if (!remote) {
      Audio.sfx('place');
      if (this.net) this.net.send({ t: 'door', k: p.k, x: p.x, y: p.y, z: p.z, r: p.r, o: p.o ? 1 : 0, v: p.vessel ? p.vessel.id : 0 });
    }
  }

  updateAnim(dt) {
    for (const p of this.anim) {
      const target = p.o ? -Math.PI / 2 : 0;
      p.leafA += (target - p.leafA) * Math.min(1, dt * 9);
      if (Math.abs(target - p.leafA) < 0.01) { p.leafA = target; this.anim.delete(p); }
      if (p.ex.leaf) p.ex.leaf.rotation.y = p.leafA;
    }
  }

  fwd() {
    return this._f.set(0, 0, -1).applyQuaternion(this.cam.quaternion);
  }

  pieceRoots() {
    const r = [this.pieceGroup];
    for (const V of this.vessels) r.push(V.group);
    return r;
  }

  aim() {
    const e = this.eye;
    const d = this.fwd();
    let hit = null;
    for (let s = 0.6; s <= 7; s += 0.25) {
      const px = e.x + d.x * s, py = e.y + d.y * s, pz = e.z + d.z * s;
      const hh = this.terr(px, pz);
      if (py <= hh) { hit = { x: px, z: pz, base: hh, dist: s, onPiece: false, piece: null }; break; }
    }
    this.ray.set(e, d);
    this.ray.far = 7;
    const hs = this.ray.intersectObjects(this.pieceRoots(), true).filter((h) => !h.object.userData.nopick && h.object.userData.piece);
    if (hs.length && (!hit || hs[0].distance < hit.dist)) {
      const h = hs[0];
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      const pc = h.object.userData.piece;
      if (n.y > 0.5) hit = { x: h.point.x, z: h.point.z, base: pc.y + h.object.userData.ltop, dist: h.distance, onPiece: true, piece: pc };
      else hit = { x: h.point.x + n.x * 0.5, z: h.point.z + n.z * 0.5, base: pc.y, dist: h.distance, onPiece: true, piece: pc };
    }
    return hit;
  }

  /* hitung posisi penempatan (dalam koordinat lokal kapal bila menempel di kapal) */
  computePlace(k, hit) {
    const spec = BUILD[k];
    const V = hit.piece && hit.piece.vessel ? hit.piece.vessel : null;
    const sm = this.hf.sample;
    let x = hit.x, z = hit.z;
    if (V) [x, z] = V.w2l(x, z);
    let y;
    const r = k === 'dinding' || k === 'batu' || k === 'pintu' ? this.rot % 2 : spec.rot4 ? this.rot % 4 : 0;
    let water = false;
    if (spec.mode === 'cell') {
      x = Math.floor(x / 2) * 2 + 1;
      z = Math.floor(z / 2) * 2 + 1;
      if (hit.onPiece) y = hit.base;
      else {
        const hm = Math.max(sm(x, z), sm(x + 1, z + 1), sm(x - 1, z - 1), sm(x + 1, z - 1), sm(x - 1, z + 1));
        if ((k === 'lantai' || spec.water) && sm(x, z) <= 0.3) { y = hm > 0.3 ? hm : 0; water = true; }
        else y = hm;
      }
    } else if (spec.mode === 'edge') {
      let ex = x, ez = z;
      if (r === 0) { ex = Math.floor(x / 2) * 2 + 1; ez = Math.round(z / 2) * 2; }
      else { ex = Math.round(x / 2) * 2; ez = Math.floor(z / 2) * 2 + 1; }
      x = ex; z = ez;
      const dx = r === 0 ? 1 : 0, dz = r === 0 ? 0 : 1;
      y = hit.onPiece ? hit.base : Math.max(sm(x, z), sm(x + dx, z + dz), sm(x - dx, z - dz));
    } else {
      y = hit.onPiece ? hit.base : sm(x, z);
    }
    let ground;
    if (V) ground = true;
    else {
      const wx = x, wz = z;
      ground = hit.onPiece || sm(wx, wz) > 0.3 || (water && (k === 'lantai' || (spec.water && sm(wx, wz) > -7)));
    }
    if (spec.floor && !hit.onPiece) ground = false;
    if (k === 'setir' && !V && !(this.hf.sample(x, z) < -0.3)) ground = false;
    return { x, y, z, r, ok: ground, V };
  }

  /* apakah posisi sudah terisi? (satu sisi hanya boleh satu dinding/pintu) */
  slotTaken(k, pl) {
    const vid = pl.V ? pl.V.id : '';
    if (EDGE_KINDS.includes(k)) {
      for (const e of EDGE_KINDS) if (this.pkeys.has(this.pieceKey(e, pl.x, pl.y, pl.z, pl.r, vid))) return true;
      return false;
    }
    return this.pkeys.has(this.pieceKey(k, pl.x, pl.y, pl.z, pl.r, vid));
  }

  makeGhost(k) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x40ff70, transparent: true, opacity: 0.45, depthWrite: false });
    const g = makeGhostModel(k, mat);
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
      if (this.ghost && this.ghost.parent) this.ghost.parent.remove(this.ghost);
      this.ghost = this.makeGhost(this.sel);
      this.scene.add(this.ghost);
      this.ghostKey = this.sel;
    }
    const hit = this.aim();
    if (!hit) { this.ghost.visible = false; this.placeInfo = null; return; }
    const pl = this.computePlace(this.sel, hit);
    const free = !this.slotTaken(this.sel, pl);
    const ok = pl.ok && free && this.has(BUILD[this.sel].cost);
    const parent = pl.V ? pl.V.inner : this.scene;
    if (this.ghost.parent !== parent) parent.add(this.ghost);
    this.ghost.visible = true;
    this.ghost.position.set(pl.x, pl.y, pl.z);
    this.ghost.rotation.y = (pl.r * Math.PI) / 2;
    this.ghost.userData.mat.color.setHex(ok ? 0x40ff70 : 0xff4040);
    this.placeInfo = { pl, ok };
  }

  place() {
    if (this.sel === 'bongkar') {
      this.ray.set(this.eye, this.fwd());
      this.ray.far = 6;
      const hs = this.ray.intersectObjects(this.pieceRoots(), true).filter((h) => h.object.userData.piece);
      if (!hs.length) return;
      const p = hs[0].object.userData.piece;
      const V = p.vessel;
      this.removePiece(p);
      const c = BUILD[p.k].cost;
      for (const k in c) { const n = Math.floor(c[k] / 2); if (n > 0) this.give(k, n, true); }
      this.renderBag();
      this.updateBuildAfford();
      this.toast(BUILD[p.k].n + ' dibongkar');
      Audio.sfx('break');
      if (this.net) this.net.send({ t: 'd', k: p.k, x: p.x, y: p.y, z: p.z, r: p.r, v: V ? V.id : 0 });
      this.swing = 0.01;
      return;
    }
    const info = this.placeInfo;
    if (!info) return;
    if (!this.has(BUILD[this.sel].cost)) { this.toast('Bahan kurang: ' + this.costText(BUILD[this.sel].cost)); return; }
    if (!info.ok) {
      if (BUILD[this.sel].floor) this.toastOnce('needfloor', 'Taruh di atas lantai' + (this.sel === 'setir' ? ' yang berada di air' : ''));
      return;
    }
    const { pl } = info;
    if (this.slotTaken(this.sel, pl)) return;
    const p = this.addPiece(this.sel, pl.x, pl.y, pl.z, pl.r, false, pl.V);
    if (!p) return;
    this.pay(BUILD[this.sel].cost);
    this.swing = 0.01;
    Audio.sfx('place');
    this.stats.built++;
    if (this.sel === 'api') this.stats.api++;
    if (this.sel === 'kasur') this.stats.bed++;
    if (this.sel === 'dermaga') this.stats.dock++;
    this.afterPlace(p);
    this.updateQuest();
    if (this.net) this.net.send({ t: 'b', k: this.sel, x: pl.x, y: pl.y, z: pl.z, r: pl.r, v: pl.V ? pl.V.id : 0 });
  }

  /* setelah sebuah potongan dipasang: setir = bentuk kapal */
  afterPlace(p, remote) {
    if (p.k === 'setir' && !p.vessel) {
      const V = this.formVessel(p);
      if (V && !remote) { this.stats.boat++; this.toast('Kapal terbentuk! Pasang Mesin lalu pakai Setir'); }
    }
  }

  /* ================= FISIKA ================= */
  boxPush(list, px, pz, py, hgt, R) {
    for (const b of list) {
      if (px < b.minx - 1 || px > b.maxx + 1 || pz < b.minz - 1 || pz > b.maxz + 1) continue;
      if (py + hgt <= b.bottom || py >= b.top - 0.65) continue;
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

  collide(px, pz, py, hgt = 1.7, R = 0.32, noPlayers = false) {
    const nodeR = R + 0.03;
    for (const n of this.world().near(px, pz, 4)) {
      if (!n.alive || !n.cr) continue;
      const dx = px - n.x, dz = pz - n.z;
      const rr = n.cr + nodeR;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001;
        px = n.x + (dx / d) * rr;
        pz = n.z + (dz / d) * rr;
      }
    }
    [px, pz] = this.boxPush(this.activeBoxes(), px, pz, py, hgt, R);
    if (!this.inCave) {
      for (const V of this.vessels) {
        if (V === this.p.on) continue;
        if (Math.hypot(V.x - px, V.z - pz) > V.rad + 1.5) continue;
        const [lx, lz] = V.w2l(px, pz);
        const [nx, nz] = this.boxPush(V.boxes, lx, lz, py - V.y, hgt, R);
        if (nx !== lx || nz !== lz) [px, pz] = V.l2w(nx, nz);
      }
    }
    if (!noPlayers) {
      for (const r of this.remotes.values()) {
        if (r.sl || r.tx === undefined) continue;
        if (Math.abs(r.y - py) > 1.6) continue;
        const dx = px - r.x, dz = pz - r.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.49) {
          const d = Math.sqrt(d2) || 0.001;
          px = r.x + (dx / d) * 0.7;
          pz = r.z + (dz / d) * 0.7;
        }
      }
    }
    return [px, pz];
  }

  groundAt(px, pz, py) {
    let g = this.terr(px, pz);
    for (const b of this.activeBoxes()) {
      if (px >= b.minx - 0.2 && px <= b.maxx + 0.2 && pz >= b.minz - 0.2 && pz <= b.maxz + 0.2 && py >= b.top - 0.65 && b.top > g) g = b.top;
    }
    return g;
  }

  /* batas bawah langit-langit terendah yang akan terbentur kepala saat naik dari y0 ke y1 */
  ceilBelow(y0, y1, hgt) {
    const p = this.p;
    let list, px = p.x, pz = p.z, off = 0;
    if (p.on) { list = p.on.boxes; px = p.lx; pz = p.lz; off = p.on.y; }
    else list = this.activeBoxes();
    const R = 0.3;
    let best = null;
    for (const b of list) {
      if (px < b.minx - R || px > b.maxx + R || pz < b.minz - R || pz > b.maxz + R) continue;
      const bt = b.bottom + off;
      if (bt >= y0 + hgt - 0.02 && bt < y1 + hgt) { if (best === null || bt < best) best = bt; }
    }
    return best;
  }

  canStand() {
    const p = this.p;
    return this.ceilBelow(p.y, p.y + 0.001, 1.7) === null && this.ceilBelow(p.y, p.y, 1.7) === null;
  }

  movePlayer(dt) {
    const p = this.p;
    const locked = this.paused || this.dead || this.sleeping || this.busy;
    const drv = !!this.driving;
    let mx = locked || drv ? 0 : this.inp.mx + this.keys.d - this.keys.a;
    let my = locked || drv ? 0 : this.inp.my + this.keys.w - this.keys.s;
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const wx = -sin * my + cos * mx;
    const wz = -cos * my - sin * mx;
    this.crouchT = lerp(this.crouchT, this.crouch ? 1 : 0, Math.min(1, dt * 10));
    const hgt = this.crouch ? 1.15 : 1.7;

    let V = p.on;
    const gT = this.terr(p.x, p.z);
    const g0 = V ? p.y : this.groundAt(p.x, p.z, p.y);
    const swim = !V && !this.inCave && gT < -0.55 && g0 <= gT + 0.01;
    const run = (this.keys.shift || len > 0.92) && !this.crouch;
    let sp = swim ? 2.4 : this.crouch ? 2.0 : run ? 5.6 : 4.0;
    if (this.hitch && this.cart) sp *= 0.85;
    this.moving = len > 0.1;
    this.sprinting = run && len > 0.1 && !swim;

    let g2 = p.y, swim2 = false, gT2 = gT;
    if (V) {
      if (this.moving) {
        const c = Math.cos(V.yaw), s = Math.sin(V.yaw);
        const lwx = wx * c - wz * s, lwz = wx * s + wz * c;
        let nx = p.lx + lwx * sp * dt, nz = p.lz + lwz * sp * dt;
        [nx, nz] = this.boxPush(V.boxes, nx, nz, p.y - V.y, hgt, 0.32);
        p.lx = nx; p.lz = nz;
      }
      const [px, pz] = V.l2w(p.lx, p.lz);
      p.x = px; p.z = pz;
      const f = this.vFloor(V, p.lx, p.lz, p.y - V.y);
      if (f === null) {
        p.on = null;
        V = null;
        if (this.driving) this.stopDrive();
        if (this.sleeping) this.wake(true);
      } else g2 = V.y + f;
    }
    if (!V) {
      if (this.moving) {
        let nx = p.x + wx * sp * dt, nz = p.z + wz * sp * dt;
        [nx, nz] = this.collide(nx, nz, p.y, hgt);
        p.x = clamp(nx, -HALF + 4, HALF - 4);
        p.z = clamp(nz, -HALF + 4, HALF - 4);
      }
      gT2 = this.terr(p.x, p.z);
      g2 = this.groundAt(p.x, p.z, p.y);
      swim2 = !this.inCave && gT2 < -0.55 && g2 <= gT2 + 0.01;
      /* naik ke kapal (juga saat melompat dari dermaga / terjun ke atas dek) */
      if (!this.inCave && this.vessels.length) {
        for (const W of this.vessels) {
          if (Math.hypot(W.x - p.x, W.z - p.z) > W.rad + 1.5) continue;
          const [lx, lz] = W.w2l(p.x, p.z);
          const f = this.vFloor(W, lx, lz, p.y - W.y);
          if (f !== null && p.y <= W.y + f + 0.08 && p.y >= W.y + f - 0.65 && p.vy <= 0) {
            p.on = W; p.lx = lx; p.lz = lz; g2 = W.y + f; V = W; swim2 = false;
            break;
          }
        }
      }
    }
    if (swim2 && !this.wasWater) Audio.sfx('splash');
    this.wasWater = swim2;
    this.inWater = swim2;
    if (swim2) {
      p.vy = 0;
      p.y = lerp(p.y, -1.15, Math.min(1, dt * 5));
      this.onGround = false;
      this.jumpBuf = 0;
      if (this.crouch) { this.crouch = false; $('btnCrouch').classList.remove('on'); }
    } else {
      if (this.onGround) this.coyote = 0.12; else this.coyote -= dt;
      this.jumpBuf -= dt;
      if (this.jumpBuf > 0 && this.coyote > 0 && !locked && !drv) {
        let can = true;
        if (this.crouch) {
          if (this.canStand()) { this.crouch = false; $('btnCrouch').classList.remove('on'); } else can = false;
        }
        if (can) { p.vy = 7.6; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; Audio.sfx('jump'); }
      }
      p.vy -= 22 * dt;
      let ny = p.y + p.vy * dt;
      if (p.vy > 0) {
        const cb = this.ceilBelow(p.y, ny, this.crouch ? 1.15 : 1.7);
        if (cb !== null) { ny = cb - (this.crouch ? 1.15 : 1.7); p.vy = 0; }
      }
      p.y = ny;
      if (p.y <= g2) { p.y = g2; p.vy = 0; this.onGround = true; }
      else this.onGround = p.y - g2 < 0.06 && p.vy <= 0;
    }
    if (this.moving && (this.onGround || swim2)) {
      this.bobT += dt * sp * 1.8;
      if (!swim2 && !this.crouch) Audio.footstep(gT2 < 1.3, this.sprinting);
    }
    const bob = this.moving ? Math.sin(this.bobT) * (swim2 ? 0.05 : 0.035) : 0;
    const eye = this.sleeping ? 0.75 : lerp(1.62, 1.12, this.crouchT);
    const ey = p.y + eye + bob;
    this.eye.set(p.x, ey, p.z);
    this.cam.rotation.set(p.pitch, p.yaw, 0);
    /* kamera: kepala (orang pertama) atau belakang-atas (orang ketiga); saat emote otomatis ke belakang */
    this.tp = (this.set.cam === 'tp' || !!this.em) && !this.sleeping;
    if (this.tp) {
      const dist = this.inCave ? 1.9 : 3.3;
      const cp = Math.cos(p.pitch);
      const fx = -Math.sin(p.yaw) * cp, fy = Math.sin(p.pitch), fz = -Math.cos(p.yaw) * cp;
      let cx = p.x - fx * dist, cy = ey + 0.45 - fy * dist, cz = p.z - fz * dist;
      if (!this.inCave) { const gh = this.terr(cx, cz) + 0.35; if (cy < gh) cy = gh; }
      this.cam.position.set(cx, cy, cz);
    } else this.cam.position.copy(this.eye);
  }

  /* ================= SURVIVAL ================= */
  hurt(n, silent) {
    if (this.dead) return;
    this.p.hp -= n;
    if (this.sleeping && this.online) this.wake(false);
    if (!silent) {
      Audio.sfx('hurt');
      const h = $('hurt');
      h.classList.add('show');
      setTimeout(() => h.classList.remove('show'), 180);
    }
  }

  survival(dt) {
    const p = this.p;
    if (this.dead) return;
    const slow = this.sleeping ? 0.5 : 1;
    p.hunger = Math.max(0, p.hunger - (this.sprinting ? 0.11 : 0.075) * dt * slow);
    p.thirst = Math.max(0, p.thirst - (this.sprinting ? 0.16 : 0.11) * dt * slow);
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
    if (this.war && this.net && this.lastHitBy && performance.now() - this.lastHitT < 10000) this.net.send({ t: 'kill', to: this.lastHitBy });
    this.lastHitBy = null;
    this.dead = true;
    this.fishCancel();
    if (this.driving) this.stopDrive();
    if (this.hitch) this.hitch = false;
    this.wake(true);
    $('panelDead').classList.add('show');
    this.timers.push(setTimeout(() => {
      const p = this.p;
      if (this.inCave) this.setCave(false, -1);
      p.on = null;
      p.x = p.spawn.x; p.z = p.spawn.z;
      p.y = this.war ? 3.25 : this.groundAt(p.x, p.z, 200);
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
      ['sup', 65, 10, 20], ['matang', 45, 5, 0], ['ikanmatang', 35, 4, 0], ['buah', 12, 0, 6], ['daging', 20, -3, 0], ['ikan', 14, -2, 0],
    ];
    for (const [k, h, hp, th] of order) {
      if (p.inv[k] > 0) {
        p.inv[k]--;
        p.hunger = Math.min(100, p.hunger + h);
        p.thirst = Math.min(100, p.thirst + th);
        if (hp > 0) p.hp = Math.min(100, p.hp + hp);
        else if (hp < 0) this.hurt(-hp);
        this.toast('Makan ' + ITEMS[k]);
        Audio.sfx('eat');
        this.renderBag();
        return;
      }
    }
    this.toast('Tidak ada makanan');
  }

  /* ================= SAVE ================= */
  save() {
    if (!this.persist) return;
    const p = this.p;
    const s = {
      seed: this.seed, t: this.t, day: this.day,
      p: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, hp: p.hp, hunger: p.hunger, thirst: p.thirst, inv: p.inv, spawn: p.spawn, embFull: p.embFull },
      eq: this.eq,
      pieces: this.pieces.map((q) => [q.k, q.x, q.y, q.z, q.r, q.o ? 1 : 0, q.vessel ? q.vessel.id : 0]),
      vessels: this.vessels.map((v) => ({ id: v.id, px: v.px, pz: v.pz, x: v.x, z: v.z, yaw: v.yaw, h: v.hOff })),
      cart: this.cart ? { x: this.cart.x, z: this.cart.z, yaw: this.cart.yaw, inv: this.cart.inv } : null,
      cv: this.inCave ? this.caveIdx : -1,
      dead: this.nature.deadList(),
      stats: this.stats,
      quest: this.quest,
    };
    writeSave(this.wdata.id, s, this.day);
  }

  exit() {
    this.save();
    this.o.onExit && this.o.onExit();
  }

  /* ================= LOOP ================= */
  update(dt) {
    if (!this.running) return;
    const frozen = this.paused && !this.mp();
    if (!frozen) {
      this.t += dt / DAYLEN;
      if (this.t >= 1) { this.t -= 1; this.day++; }
    }
    const p = this.p;
    if (!frozen) {
      this.updateVessels(dt);
      this.movePlayer(dt);
      this.updateCart(dt);
      this.survival(dt);
      this.world().tick(dt);
      if (!this.inCave && !this.war) this.animals.update(dt, p.x, p.z, p.y, this.t < 0.23 || this.t > 0.77, (n) => this.hurt(n));
      if (this.drinkCd > 0) this.drinkCd -= dt;
      if (this.actCd > 0) this.actCd -= dt;
      if (this.act && this.actCd <= 0 && !this.build && !this.busy) this.attack();
      this.updateFish(dt);
      this.updateSleep(dt);
      this.checkCave();
      if (this.war) this.warUpdate(dt);
    }
    this.updateAnim(dt);
    this.sky.update(this.t, this.cam.position, this.cam.position, dt);
    this.water.update(dt, performance.now() / 1000);
    if (this.war) {
      /* istana: selalu terang, siang maupun malam */
      const sk = this.sky;
      sk.hemi.intensity = Math.max(sk.hemi.intensity, 0.85);
      sk.sun.intensity *= 0.8;
    }
    if (this.inCave) {
      /* di dalam goa: gelap, tanpa matahari/langit */
      const sk = this.sky;
      sk.sun.intensity = 0;
      sk.moon.intensity = 0;
      sk.hemi.intensity = 0.1;
      sk.day = 0;
      this.scene.background.setRGB(0.008, 0.008, 0.012);
      this.scene.fog.color.setRGB(0.008, 0.008, 0.012);
      this.scene.fog.near = 1.5;
      this.scene.fog.far = this.q && this.q.adapt ? 22 : 30;
    }

    /* tangan */
    if (this.swing > 0) {
      this.swing += dt / 0.3;
      if (this.swing >= 1) this.swing = 0;
    }
    const sw = this.swing > 0 ? Math.sin(this.swing * Math.PI) : 0;
    this.handR.rotation.x = 0.12 - sw * 1.0;
    this.handR.position.y = this.handR.userData.base.y + sw * 0.06 + (this.moving ? Math.sin(this.bobT * 1) * 0.01 : 0);
    this.handL.position.y = this.handL.userData.base.y + (this.moving ? Math.sin(this.bobT + 1.5) * 0.012 : 0);
    this.handR.visible = this.handL.visible = !this.sleeping && !this.driving && !this.tp;
    this.updateSelfModel(dt);
    this.updateBubbles(dt);
    if (this.heldFlame) {
      const s = 0.85 + Math.random() * 0.35;
      this.heldFlame.scale.set(s, s * (0.9 + Math.random() * 0.3), s);
    }

    this.updateLights(dt);
    if (this.build) {
      this.ghostT -= dt;
      if (this.ghostT <= 0) { this.ghostT = 0.04; this.updateGhost(); }
    } else this.updateGhost();
    this.updateRemotes(dt);
    this.updateChips(dt);
    this.tgtT -= dt;
    if (this.tgtT <= 0) { this.tgtT = 0.1; this.updateTarget(); }
    const night = this.inCave ? 1 : 1 - this.sky.day;
    Audio.setNight(night);

    this.ctxT -= dt;
    if (this.ctxT <= 0) { this.ctxT = 0.2; this.updateCtx(); this.updateBuildAfford(); }

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.updateHud(); }

    if (this.voice) this.voice.update(dt);
    if (this.chatCd > 0) this.chatCd -= dt;

    if (this.net) {
      this.netT -= dt;
      if (this.netT <= 0) {
        this.netT = 0.1;
        const m = { t: 'p', n: this.o.name, s: this.def.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), r: +p.yaw.toFixed(2), m: this.moving ? 1 : 0 };
        if (this.pSeq++ % 25 === 0) m.cd = this.lookStr;
        if (this.crouch) m.c = 1;
        if (this.sleeping && this.sleepBed) { m.sl = this.sleepBed.r + 1; m.sy = +(this.sleepBed.vessel ? this.sleepBed.vessel.yaw : 0).toFixed(2); }
        if (this.cart) m.ct = [+this.cart.x.toFixed(1), +this.cart.z.toFixed(1), +this.cart.yaw.toFixed(2)];
        this.net.send(m);
      }
    }
    if (this.persist) {
      this.saveT += dt;
      if (this.saveT > 20) { this.saveT = 0; this.save(); }
    }
  }

  /* ---- cahaya: kolam 3 lampu dibagi ke sumber terdekat ---- */
  collectLights() {
    const out = [];
    if (this.inCave) for (const l of this.mine.lights) out.push(l);
    else if (this.war && this.warLights) for (const l of this.warLights) out.push(l);
    else {
      for (const p of this.pieces) {
        const L = PIECE_LIGHT[p.k];
        if (!L) continue;
        const [x, y, z] = this.wpos(p);
        out.push({ x, y: y + L.y, z, c: L.c, rng: L.rng, i: L.i });
      }
    }
    this.lightCand = out;
  }

  updateLights(dt) {
    this.lightT -= dt;
    if (this.lightT <= 0) { this.lightT = 0.3; this.collectLights(); }
    const p = this.p, cam = this.eye;
    const night = this.inCave ? 1 : 1 - this.sky.day;
    const list = [];
    if (this.eq === 'obor' && this.p.inv.obor > 0 && !this.sleeping) {
      const f = this.fwd();
      list.push({ x: cam.x + f.x * 0.6, y: cam.y - 0.15, z: cam.z + f.z * 0.6, c: 0xffa84a, rng: 15, i: 1.5, held: true, d: -1 });
    }
    for (const l of this.lightCand) {
      const d = Math.hypot(l.x - p.x, l.z - p.z);
      if (d < l.rng * 3.5) list.push({ ...l, d });
    }
    list.sort((a, b) => a.d - b.d);
    const n = this.q ? this.q.lights : 3;
    for (let i = 0; i < this.lightPool.length; i++) {
      const L = this.lightPool[i], s = i < n ? list[i] : null;
      if (!s) { L.intensity = 0; continue; }
      L.position.set(s.x, s.y, s.z);
      L.color.setHex(s.c);
      L.distance = s.rng;
      L.intensity = s.i * (0.7 + night * 1.5) * (0.88 + Math.random() * 0.24);
    }
    for (const f of this.fires) {
      const s = 0.85 + Math.random() * 0.35;
      f.ex.flame.scale.set(s, s * (0.9 + Math.random() * 0.3), s);
    }
    for (const q of this.pieces) {
      if (q.k === 'obor' && q.ex.flame) { const s = 0.85 + Math.random() * 0.35; q.ex.flame.scale.set(s, s * (0.9 + Math.random() * 0.3), s); }
    }
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = 0.35 + Math.random() * 0.3;
      let best = 1e9;
      for (const f of this.fires) { const [x, , z] = this.wpos(f); best = Math.min(best, Math.hypot(x - p.x, z - p.z)); }
      if (best < 9 && !this.inCave) Audio.fire();
    }
  }

  /* ================= REMOTE ================= */
  makeLabel(text) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.font = 'bold 34px sans-serif';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.fillRect(0, 8, 256, 48);
    c.fillStyle = '#fff';
    c.fillText(String(text).slice(0, 14), 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.scale.set(1.8, 0.45, 1);
    sp.position.y = 2.5;
    sp.renderOrder = 5;
    return sp;
  }

  onNet(m) {
    const id = m.f;
    if (m.t === 'p') {
      let r = this.remotes.get(id);
      if (!r) {
        const g = buildChar((m.cd && unpackLook(m.cd)) || SKINS[m.s] || SKINS[0]);
        g.rotation.order = 'YXZ';
        g.add(this.makeLabel(m.n || 'Pemain'));
        this.scene.add(g);
        r = { g, x: m.x, y: m.y, z: m.z, ry: m.r, mv: 0, t: 0, seen: 0, name: m.n || 'Pemain', sl: 0, sy: 0, lie: 0, crouch: 0, cd: m.cd || '' };
        this.remotes.set(id, r);
        this.toast((m.n || 'Pemain') + ' bergabung');
        Audio.sfx('join');
        if (this.voice) this.voice.peerSeen(id);
      }
      if (m.cd && m.cd !== r.cd) {
        /* tampilan karakter berubah / baru diterima: bangun ulang model */
        const lk = unpackLook(m.cd);
        if (lk) {
          this.scene.remove(r.g);
          this.clearBubble(r.g);
          const g2 = buildChar(lk);
          g2.rotation.order = 'YXZ';
          g2.add(this.makeLabel(r.name));
          this.scene.add(g2);
          r.g = g2; r.cd = m.cd;
        }
      }
      r.tx = m.x; r.ty = m.y; r.tz = m.z; r.try = m.r; r.mv = m.m;
      r.sl = m.sl || 0; r.sy = m.sy || 0; r.cr = m.c ? 1 : 0;
      if (m.ct) this.remoteCart(r, m.ct);
      else if (r.cartMesh) { this.scene.remove(r.cartMesh); r.cartMesh = null; }
      r.seen = performance.now();
    } else if (m.t === 'em') {
      const r = this.remotes.get(id);
      if (!r) return;
      if (m.i && EMOTE_BY_ID[m.i]) { r.em = { id: m.i, t: 0 }; this.addBubble(r.g, EMOTE_BY_ID[m.i].icon); }
      else { r.em = null; resetPose(r.g); }
    } else if (m.t === 'b') {
      const V = m.v ? this.vesselById(m.v) : null;
      if (m.v && !V) return;
      const p = this.addPiece(m.k, m.x, m.y, m.z, m.r, false, V);
      if (p) this.afterPlace(p, true);
      Audio.sfx('place');
    } else if (m.t === 'd') {
      const V = m.v ? this.vesselById(m.v) : null;
      const key = this.pieceKey(m.k, m.x, m.y, m.z, m.r, V ? V.id : '');
      const p = this.pieces.find((q) => q.key === key);
      if (p) this.removePiece(p);
    } else if (m.t === 'door') {
      const V = m.v ? this.vesselById(m.v) : null;
      const key = this.pieceKey(m.k, m.x, m.y, m.z, m.r, V ? V.id : '');
      const p = this.pieces.find((q) => q.key === key);
      if (p && p.o !== !!m.o) this.toggleDoor(p, true);
    } else if (m.t === 'k') {
      const n = this.nature.nodes[m.i];
      if (n && n.alive) this.nature.kill(n);
    } else if (m.t === 'hit') {
      if (this.war && this.net && m.to === this.net.myId) this.takeHit(m);
    } else if (m.t === 'kill') {
      if (this.war && this.net && m.to === this.net.myId) this.warKill(m);
    } else if (m.t === 'left') {
      this.dropRemote(id, true);
    } else if (m.t === 'chat') {
      this.addChat(m.n || 'Pemain', m.m, false);
    } else if (m.t === 'rtc' || m.t === 'vc') {
      if (this.voice) this.voice.onMsg(m);
    } else if (m.t === 'sl') {
      if (m.on) this.sleepers.add(id); else this.sleepers.delete(id);
      this.checkAllAsleep();
    } else if (m.t === 'vs' || m.t === 'vd') {
      this.onVesselNet(m);
    } else if (m.t === 'req') {
      /* pemain baru minta status dunia; satu pemain acak yang membalas */
      if (this.stateTimer) clearTimeout(this.stateTimer);
      this.stateTimer = setTimeout(() => {
        this.stateTimer = null;
        if (!this.net) return;
        this.net.send({
          t: 'state', to: id, tm: this.t,
          pieces: this.pieces.map((q) => [q.k, q.x, q.y, q.z, q.r, q.o ? 1 : 0, q.vessel ? q.vessel.id : 0]),
          vessels: this.vessels.map((v) => ({ id: v.id, px: v.px, pz: v.pz, x: v.x, z: v.z, yaw: v.yaw, h: v.hOff })),
          dead: this.nature.deadList(),
        });
      }, 250 + Math.random() * 900);
    } else if (m.t === 'state') {
      if (m.to === (this.net && this.net.myId)) {
        if (this.gotState) return;
        this.gotState = true;
        if (typeof m.tm === 'number') this.t = m.tm;
        for (const v of m.vessels || []) {
          if (this.vesselById(v.id)) continue;
          const V = new Vessel(v.id, this.scene);
          V.setPivot(v.px, v.pz);
          V.x = v.x; V.z = v.z; V.yaw = v.yaw; V.hOff = v.h || 0;
          V.sync();
          this.vessels.push(V);
        }
        for (const q of m.pieces || []) this.addPiece(q[0], q[1], q[2], q[3], q[4], !!q[5], q[6] ? this.vesselById(q[6]) : null);
        for (const V of this.vessels) V.refresh();
        this.nature.killIdx(m.dead || []);
      } else if (this.stateTimer) {
        clearTimeout(this.stateTimer);
        this.stateTimer = null;
      }
    }
  }

  dropRemote(id, announce) {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.g);
    if (r.cartMesh) this.scene.remove(r.cartMesh);
    this.remotes.delete(id);
    this.sleepers.delete(id);
    if (this.voice) this.voice.peerLeft(id);
    for (const V of this.vessels) if (V.driver === id) { V.driver = null; V.remote = false; }
    if (announce) this.toast('Pemain keluar');
    this.checkAllAsleep();
  }

  updateRemotes(dt) {
    const now = performance.now();
    for (const [id, r] of this.remotes) {
      if (now - r.seen > 8000) { this.dropRemote(id, true); continue; }
      if (r.tx === undefined) continue;
      const k = Math.min(1, dt * 10);
      r.x = lerp(r.x, r.tx, k); r.y = lerp(r.y, r.ty, k); r.z = lerp(r.z, r.tz, k);
      r.crouch = lerp(r.crouch, r.cr ? 1 : 0, k);
      r.lie = lerp(r.lie, r.sl ? 1 : 0, Math.min(1, dt * 6));
      if (r.sl) {
        /* tidur di kasur: badan telentang, kepala di bantal */
        r.g.position.set(r.x, r.y + 0.62, r.z);
        r.g.rotation.set(-Math.PI / 2 * r.lie, ((r.sl - 1) * Math.PI) / 2 + r.sy, 0);
      } else {
        let da = r.try + Math.PI - r.ry;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        r.ry += da * k;
        r.g.position.set(r.x, r.y, r.z);
        r.g.rotation.set(-Math.PI / 2 * r.lie, r.ry, 0);
      }
      r.g.scale.y = 1 - 0.28 * r.crouch;
      r.t += dt * (r.mv && !r.sl ? 9 : 0);
      const sw = r.mv && !r.sl ? Math.sin(r.t) * 0.7 : 0;
      const u = r.g.userData;
      if (r.em && !r.sl) {
        r.em.t += dt;
        if (r.mv || !applyEmote(r.g, r.em.id, r.em.t)) { r.em = null; resetPose(r.g); }
      }
      if (!r.em) { u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw; u.armR.rotation.x = sw; }
    }
  }

  updateHud() {
    const p = this.p;
    $('barHpF').style.width = clamp(p.hp, 0, 100) + '%';
    $('barFoodF').style.width = clamp(p.hunger, 0, 100) + '%';
    $('barWaterF').style.width = clamp(p.thirst, 0, 100) + '%';
    const hh = Math.floor(this.t * 24), mm = Math.floor((this.t * 24 - hh) * 60);
    const icon = this.inCave ? 'cave' : this.sky.day > 0.5 ? 'sun' : this.t > 0.2 && this.t < 0.3 || this.t > 0.7 && this.t < 0.8 ? 'dusk' : 'moon';
    setIconText($('clockTxt'), icon, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Hari ${this.day}` + (this.net ? ` · ${this.remotes.size + 1} pemain` : ''));
    this.updateCaveHint();
  }

  /* panah menuju goa terdekat: selalu tampil di luar goa supaya mudah menemukannya */
  updateCaveHint() {
    const el = $('questHint');
    if (this.inCave || !this.caves.length) { el.classList.add('off'); return; }
    el.classList.remove('off');
    const p = this.p;
    let best = null, bd = 1e9;
    for (const c of this.caves) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; best = c; } }
    const ty = Math.atan2(-(best.x - p.x), -(best.z - p.z));
    const rel = angDiff(ty, p.yaw);
    $('hintArrow').style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
    $('hintTxt').textContent = bd < 8 ? 'Pintu goa di depanmu!' : `Goa terdekat ${Math.round(bd)} m`;
  }

  render() {
    this.r.render(this.scene, this.cam);
  }

  dispose() {
    this.running = false;
    for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
    for (const id of ['warHud', 'mShop']) { const e = document.getElementById(id); if (e) e.remove(); }
    for (const t of this.timers) { clearTimeout(t); clearInterval(t); }
    for (const id of ['warHud', 'mShop']) { const e = document.getElementById(id); if (e) e.remove(); }
    Audio.ambient(false);
    if (this.stateTimer) clearTimeout(this.stateTimer);
    if (this.voice) { this.voice.dispose(); this.voice = null; }
    if (this.hud && this.hud.editing) this.hud.stop();
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
    $('emoteWheel').classList.remove('show');
    $('panelDead').classList.remove('show');
    $('fade').classList.remove('show');
    $('chatBar').classList.remove('show');
    $('hotbar').classList.remove('gone');
    $('toasts').innerHTML = '';
    $('chatFeed').innerHTML = '';
    $('voiceTag').textContent = '';
  }
}

Object.assign(Game.prototype, vesselMixin, actionsMixin, emoteMixin, warMixin);
