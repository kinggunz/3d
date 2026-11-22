/* ADEGAN PEMBUKA: pesawat terbang -> badai -> petir menyambar mesin -> jatuh ke pulau -> gelap ->
   terbangun di rumput, bangkai pesawat masih terbakar lalu meredup. Dimainkan di semua dunia
   (solo & Mabar) kecuali dua map Room Global (War & Drig). */
import * as THREE from 'three';
import { Audio } from './audio.js';
import { buildChar, SKINS, unpackLook, poseChar, clearPose } from './chars.js';
import { buildPlane, ROW0, ROWS, ROW_PITCH, FLOOR_Y, SEAT_X } from './plane.js';
import { IntroSound } from './introsound.js';
import { clamp, lerp, mulberry32 } from './util.js';
import { HALF } from './world.js';

const $ = (id) => document.getElementById(id);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const V3 = THREE.Vector3;

/* ---- waktu adegan (detik) ---- */
const T_CALM = 8, T_STORM = 30, T_EXT = 38, T_STRIKE = 41.5, T_PANIC = 44, T_DESC = 44, T_FALL = 52, T_HIT = 59, T_BLACK = 60.4, T_WAKE = 63.5, T_END = 76;
const CRUISE_V = 30, DESC_LEN = 15, ALT = 95, DESC_DIST = 480;
const ROW_ME = 5;

const puffTex = (() => {
  let tex = {};
  return (kind) => {
    if (tex[kind]) return tex[kind];
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    if (kind === 'fire') { r.addColorStop(0, 'rgba(255,245,200,1)'); r.addColorStop(0.35, 'rgba(255,150,40,.85)'); r.addColorStop(1, 'rgba(255,60,0,0)'); }
    else { r.addColorStop(0, 'rgba(70,70,74,.9)'); r.addColorStop(0.6, 'rgba(45,45,50,.55)'); r.addColorStop(1, 'rgba(30,30,34,0)'); }
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return (tex[kind] = new THREE.CanvasTexture(cv));
  };
})();

/* ---------- partikel api / asap ---------- */
class Particles {
  constructor(scene) {
    this.scene = scene; this.list = []; this.free = [];
  }
  spawn(kind, pos, vel, size, life, grow) {
    let p = this.free.pop();
    if (!p) {
      const mat = new THREE.SpriteMaterial({ map: puffTex(kind), transparent: true, depthWrite: false });
      p = { sp: new THREE.Sprite(mat), kind };
      this.scene.add(p.sp);
    }
    if (p.kind !== kind) { p.kind = kind; p.sp.material.map = puffTex(kind); p.sp.material.needsUpdate = true; }
    p.sp.material.blending = kind === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.sp.visible = true; p.sp.position.copy(pos); p.v = vel; p.size = size; p.life = life; p.max = life; p.grow = grow;
    p.sp.renderOrder = 6;
    this.list.push(p);
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { p.sp.visible = false; this.list.splice(i, 1); this.free.push(p); continue; }
      const k = 1 - p.life / p.max;
      p.sp.position.addScaledVector(p.v, dt);
      if (p.kind === 'smoke') p.v.y += 1.2 * dt;
      p.sp.scale.setScalar(p.size * (1 + p.grow * k));
      p.sp.material.opacity = p.kind === 'fire' ? (1 - k) * 0.95 : Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - k) * 0.7;
    }
  }
  dispose() {
    for (const p of [...this.list, ...this.free]) { this.scene.remove(p.sp); p.sp.material.dispose(); }
    this.list = []; this.free = [];
  }
}

function makeEnvMap(renderer) {
  try {
    const sc = new THREE.Scene();
    const geo = new THREE.SphereGeometry(50, 24, 16);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    const top = new THREE.Color(0.3, 0.5, 0.95), hor = new THREE.Color(0.92, 0.94, 0.98), bot = new THREE.Color(0.22, 0.3, 0.26), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 50;
      if (y > 0) c.copy(hor).lerp(top, Math.pow(y, 0.6)); else c.copy(hor).lerp(bot, Math.min(1, -y * 2.2));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sc.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 7.5, 6) }));
    sun.position.set(30, 30, 20); sc.add(sun);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(sc, 0.02);
    pm.dispose();
    geo.dispose();
    return rt.texture;
  } catch (e) { return null; }
}

/* pilih lokasi jatuh: daratan landai dekat titik acuan, sama untuk semua pemain (berdasar seed) */
function pickSite(hf, seed, ref, caves) {
  const rnd = mulberry32((seed ^ 0xc4a5) + ((ref[0] * 7 + ref[1] * 13) | 0));
  let best = null;
  for (let k = 0; k < 90; k++) {
    const a = rnd() * Math.PI * 2, d = 24 + rnd() * 18 + (k > 50 ? 12 : 0);
    const x = ref[0] + Math.cos(a) * d, z = ref[1] + Math.sin(a) * d;
    if (Math.abs(x) > HALF - 30 || Math.abs(z) > HALF - 30) continue;
    const h = hf.sample(x, z);
    if (h < 1.4 || h > 9) continue;
    let flat = 0;
    for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [10, 0], [-10, 0]]) flat = Math.max(flat, Math.abs(hf.sample(x + dx, z + dz) - h));
    if (flat > 1.6) continue;
    if (caves.some((c) => Math.hypot(c.x - x, c.z - z) < 24)) continue;
    best = { x, z, y: h, ang: rnd() * Math.PI * 2 };
    break;
  }
  if (!best) { const x = ref[0] + 26, z = ref[1] + 4; best = { x, z, y: Math.max(0.5, hf.sample(x, z)), ang: 0.7 }; }
  return best;
}

export const introMixin = {
  introEligible() {
    return !this.war && !this.moto && !this.inCave && this.set.intro !== false;
  },
  introCam() { return false; },

  /* ================= MULAI ================= */
  startIntro() {
    if (!this.introEligible()) return;
    const p = this.p;
    const near = Math.hypot(p.x - 3, p.z - 3) < 60;
    const site = pickSite(this.hf, this.seed, near ? [3, 3] : [p.x, p.z], this.caves);
    const I = this.intro = {
      t: 0, site, plane: null, hold: [], parts: null, strike: false, boom: false, hit: false, ended: false,
      savedT: this.t, savedYaw: p.yaw, savedPitch: p.pitch, seated: [], lastSpeak: -1, typeI: 0, line: null, lines: [],
      shake: 0, flash: 0, storm: 0, rainOn: false, fireRate: 0, camSite: 0, snd: new IntroSound(), alarm: false, nextBolt: 34, bolt: null,
      fanSpd: 40, planeV: new V3(), engSmoke: 0, lightOn: true,
    };
    this.busy = true; this.act = false;
    this.t = 0.42; /* siang hari */
    Audio.music('none'); Audio.ambient(false);
    $('hud').style.visibility = 'hidden';
    this.introUI(true);
    const hd = site;
    /* arah terbang: menuju lokasi jatuh */
    const rnd = mulberry32(this.seed ^ 0x77aa);
    const hAng = rnd() * Math.PI * 2;
    I.D = new V3(Math.sin(hAng), 0, Math.cos(hAng));
    I.W = new V3(hd.x, hd.y, hd.z);
    I.Pd = I.W.clone().addScaledVector(I.D, -DESC_DIST); I.Pd.y = hd.y + ALT;
    I.heading = Math.atan2(I.D.x, I.D.z);
    /* pesawat */
    const P = I.plane = buildPlane();
    P.rotation.order = 'YXZ';
    const env = makeEnvMap(this.r);
    I.env = env;
    P.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial && env) { o.material.envMap = env; o.material.needsUpdate = true; } });
    this.scene.add(P);
    I.cabinLight = new THREE.PointLight(0xfff0d8, 1.0, 16, 1.4); P.add(I.cabinLight);
    I.fireLight = new THREE.PointLight(0xff7a22, 0, 30, 1.6); this.scene.add(I.fireLight);
    I.cam = new THREE.Camera(); P.add(I.cam);
    I.parts = new Particles(this.scene);
    this.introPeople();
    this.introRain();
    this.introScript();
    this.introPlanePose(0);
    I.snd.engine(1, false);
    this.r.domElement.style.filter = '';
    I.camSkin = true;
    for (const [, r] of this.remotes) r.g.visible = false;
    this.selfChar.visible = false;
  },

  /* ---------- penumpang & awak ---------- */
  introPeople() {
    const I = this.intro, P = I.plane;
    const mk = (look, name, label) => {
      const g = buildChar(look); g.rotation.order = 'YXZ';
      if (label) { const s = this.makeLabel(name); s.visible = false; g.add(s); g.userData.label = s; }
      P.add(g); return g;
    };
    const crew = { skin: '#e8b48a', hair: '#1b1b1b', hairStyle: 0, shirt: '#f4f4f4', shirt2: '#103f8f', shirtStyle: 1, pants: '#14233f', shoes: '#111111', glasses: 0 };
    I.copilot = mk(Object.assign({}, crew, { skin: '#c68642', hairStyle: 0 }), 'Kopilot Raka', false);
    I.copilot.position.set(0.15, FLOOR_Y, 6.0); I.copilot.rotation.y = Math.PI;
    I.pilot = mk(Object.assign({}, crew, { hair: '#555555', glasses: 2, glassCol: '#111111' }), 'Kapten', false);
    I.pilot.position.set(-0.55, FLOOR_Y, 9.25); I.pilot.userData.sitCrew = true;
    /* urutan kursi */
    I.seatOrder = [];
    for (const r of [5, 4, 6, 3, 7, 2, 8, 1, 9]) for (const s of [1, 2, 0, 3]) I.seatOrder.push([r, s]);
    this.introSeatMe();
    this.introSyncSeats();
    /* penumpang pengisi bila pemain sedikit */
    let k = I.seated.length;
    const rnd = mulberry32(this.seed ^ 0x91);
    const SK = ['#e8b48a', '#c68642', '#8d5524', '#f1c9a5'], SH = ['#c0562b', '#2a6fb0', '#556b2f', '#b3262e', '#e0c27a'];
    while (k < 4) {
      const look = { skin: SK[(rnd() * SK.length) | 0], shirt: SH[(rnd() * SH.length) | 0], pants: '#2b3a55', hair: ['#1b1b1b', '#3b2412', '#8a5a2b'][(rnd() * 3) | 0], hairStyle: (rnd() * 6) | 0 };
      this.introSeat(look, 'Penumpang', null, true);
      k++;
    }
  },
  introSeatMe() {
    this.introSeat(this.myLook, this.o.name || 'Santay', null, false, true);
  },
  introSeat(look, name, id, filler, me) {
    const I = this.intro, P = I.plane;
    const [r, s] = I.seatOrder[I.nextSeat || 0];
    I.nextSeat = (I.nextSeat || 0) + 1;
    const g = buildChar(look); g.rotation.order = 'YXZ';
    const lb = this.makeLabel(name); lb.visible = false; lb.position.y = 2.1; g.add(lb);
    g.position.set(SEAT_X[s], FLOOR_Y, ROW0 + r * ROW_PITCH - 0.02);
    P.add(g);
    I.seated.push({ g, id, name, filler: !!filler, me: !!me, label: lb, delay: Math.random() * 0.5, v: Math.random() * 6 });
    if (me) I.me = I.seated[I.seated.length - 1];
  },
  introSyncSeats() {
    const I = this.intro;
    for (const [id, r] of this.remotes) {
      if (I.seated.some((s) => s.id === id)) continue;
      if (I.nextSeat >= I.seatOrder.length - 2) break;
      /* ganti penumpang pengisi dengan pemain sungguhan */
      const fi = I.seated.findIndex((s) => s.filler);
      if (fi >= 0) { I.plane.remove(I.seated[fi].g); I.nextSeat = Math.max(I.nextSeat, 1); const old = I.seated.splice(fi, 1)[0]; I.freed = I.freed || []; I.freed.push(old.g.position.clone()); }
      const look = (r.cd && unpackLook(r.cd)) || SKINS[0];
      if (I.freed && I.freed.length) {
        const pos = I.freed.pop();
        const g = buildChar(look); g.rotation.order = 'YXZ';
        const lb = this.makeLabel(r.name); lb.visible = false; lb.position.y = 2.1; g.add(lb);
        g.position.copy(pos); I.plane.add(g);
        I.seated.push({ g, id, name: r.name, filler: false, label: lb, delay: Math.random() * 0.5, v: Math.random() * 6 });
      } else this.introSeat(look, r.name, id, false);
    }
  },

  /* ---------- hujan ---------- */
  introRain() {
    const I = this.intro, N = 900;
    const pos = new Float32Array(N * 6), seed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    I.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbcd2ea, transparent: true, opacity: 0.0 }));
    I.rain.frustumCulled = false; I.rainSeed = seed; I.rainN = N;
    this.scene.add(I.rain);
  },

  /* ---------- naskah dialog ---------- */
  introScript() {
    const I = this.intro;
    const me = this.o.name || 'Santay';
    const others = [...this.remotes.values()].map((r) => r.name).filter(Boolean);
    const o1 = others[0];
    I.lines = [
      [8.6, 'Kopilot Raka', 'Selamat siang para penumpang, ini Kopilot Raka dari ruang kemudi.', 4.2, 0],
      [13.2, 'Kopilot Raka', 'Kita terbang di ketinggian 35.000 kaki menuju Pulau Santay. Cuaca cerah, sekitar 20 menit lagi.', 5.2, 0],
      [19.2, me, 'Wah, pemandangannya indah banget dari atas sini!', 3.2, 1],
      [22.8, o1 || 'Kopilot Raka', o1 ? 'Semoga pulaunya seru. Aku sudah siap berpetualang!' : 'Silakan nikmati penerbangan. Pramugari akan menyajikan minuman sebentar lagi.', 3.6, o1 ? 2 : 0],
      [26.8, 'Kopilot Raka', 'Hmm... radar menunjukkan awan gelap di depan. Tolong kencangkan sabuk pengaman.', 3.6, 0],
      [31.0, me, 'Kok tiba-tiba hujan deras? Langitnya gelap banget...', 3.2, 1],
      [34.4, 'Kopilot Raka', 'Turbulensi! Semua tetap di kursi! Kapten, kita masuk badai!', 3.2, 0],
      [44.4, 'Kopilot Raka', 'MAYDAY! MAYDAY! Petir menyambar mesin kiri, mesin terbakar!!', 3.0, 0, 1],
      [47.4, me, 'AAAAAH! Kita jatuh!!', 1.8, 1, 1],
      [48.9, o1 || 'Penumpang', 'Tolong!! Pesawatnya jatuh!!', 1.8, 2, 1],
      [50.4, 'Kopilot Raka', 'Pegangan! Posisi darurat! BRACE! BRACE!', 2.6, 0, 1],
      [55.5, 'Kapten', 'Kita menuju pulau... tidak ada tempat mendarat...', 2.8, 4, 1],
      [64.4, '', 'Kamu terbangun di antara rerumputan. Bangkai pesawat masih terbakar tak jauh darimu...', 6, 3],
    ];
  },

  /* ================= UI ================= */
  introUI(on) {
    let ui = $('introUI');
    if (!on) { if (ui) ui.remove(); return; }
    if (ui) ui.remove();
    ui = document.createElement('div');
    ui.id = 'introUI';
    ui.style.cssText = 'position:fixed;inset:0;z-index:36;pointer-events:none;font-family:sans-serif;color:#fff;overflow:hidden';
    ui.innerHTML = `
      <div id="inBarT" style="position:absolute;left:0;right:0;top:0;height:8vh;background:#000"></div>
      <div id="inBarB" style="position:absolute;left:0;right:0;bottom:0;height:8vh;background:#000"></div>
      <div id="inCap" style="position:absolute;left:14px;top:calc(8vh + 10px);font-size:12px;letter-spacing:1px;opacity:.85;text-shadow:0 1px 3px #000">SA-217 • JAKARTA → PULAU SANTAY</div>
      <div id="inBam" style="position:absolute;left:0;right:0;top:34%;text-align:center;font-size:min(22vw,150px);font-weight:900;color:#ffdf5a;text-shadow:0 0 30px #ff5a00,0 6px 0 #a02000;opacity:0;transform:scale(.3);letter-spacing:4px"></div>
      <div id="inSub" style="position:absolute;left:5%;right:5%;bottom:calc(8vh + 14px);text-align:center;font-size:clamp(14px,3.6vw,20px);line-height:1.35;text-shadow:0 1px 4px #000,0 0 8px #000;opacity:0"><b id="inWho"></b><span id="inTxt"></span></div>
      <div id="inFlash" style="position:absolute;inset:0;background:#fff;opacity:0"></div>
      <div id="inRed" style="position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(255,0,0,0) 30%,rgba(255,0,0,.45) 100%);opacity:0"></div>
      <div id="inBlack" style="position:absolute;inset:0;background:#000;opacity:0"></div>
      <button id="inSkip" style="position:absolute;right:12px;top:calc(8vh + 8px);pointer-events:auto;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:8px;padding:7px 12px;font-size:13px">Lewati ⏭</button>`;
    document.body.appendChild(ui);
    $('inSkip').onclick = () => this.introEnd(true);
  },

  /* ================= GERAK PESAWAT ================= */
  introPlanePose(t) {
    const I = this.intro, P = I.plane;
    let pos, pitch = 0, roll = 0, yaw = I.heading;
    const stormAmp = sm(28, 36, t);
    if (t < T_DESC) {
      pos = I.Pd.clone().addScaledVector(I.D, -CRUISE_V * (T_DESC - t));
      pos.y += Math.sin(t * 0.6) * 0.6;
      roll = Math.sin(t * 0.7) * 0.04 + stormAmp * (Math.sin(t * 2.3) * 0.12 + Math.sin(t * 5.1) * 0.05);
      pitch = Math.sin(t * 0.5) * 0.015 + stormAmp * Math.sin(t * 3.1) * 0.04;
      if (t > T_STRIKE) { const k = sm(T_STRIKE, T_STRIKE + 1.5, t); roll += -0.18 * k + Math.sin(t * 6) * 0.05 * k; pitch += 0.06 * k; }
    } else {
      const s = clamp((t - T_DESC) / DESC_LEN, 0, 1);
      pos = I.Pd.clone().addScaledVector(I.D, DESC_DIST * s);
      pos.y = I.W.y + 1.1 + (ALT - 1.1) * (1 - Math.pow(s, 2.2));
      const dy = -(ALT - 1.1) * 2.2 * Math.pow(s, 1.2) / DESC_LEN;
      pitch = Math.atan2(-dy, CRUISE_V * (1 - 0.15 * s)) + 0.04;
      roll = -0.22 - 0.5 * s + Math.sin(t * 4) * 0.1 * (1 - s * 0.5);
      yaw += Math.sin(t * 1.7) * 0.06 * (1 - s);
    }
    if (t >= T_HIT) { pos = I.W.clone(); pos.y += 1.0; pitch = 0.1; roll = -0.16; }
    const prev = I.planeV;
    if (I.lastPos) prev.copy(pos).sub(I.lastPos);
    I.lastPos = pos.clone();
    P.position.copy(pos);
    P.rotation.set(pitch, yaw, roll);
    P.updateMatrixWorld(true);
  },

  /* ================= UPDATE (sebelum gerak pemain) ================= */
  introPre(dt) {
    const I = this.intro;
    if (!I || I.ended) return;
    this.busy = true; this.act = false;
    if (!this.paused) I.t += dt;
    const t = I.t;
    for (const [, r] of this.remotes) r.g.visible = false;
    this.selfChar.visible = false;
    if (Math.floor(t * 2) !== I.syncT) { I.syncT = Math.floor(t * 2); if (t < T_STRIKE) this.introSyncSeats(); }
    if (t >= T_HIT) { if (!I.hit) this.introImpact(); }
    else this.introPlanePose(t);
    if (t >= T_END) this.introEnd(false);
  },

  /* ================= UPDATE (setelah langit & sebelum render) ================= */
  introPost(dt) {
    const I = this.intro;
    if (!I || I.ended) return;
    const t = I.t, P = I.plane, cam = this.cam;
    const inside = (t >= T_CALM && t < T_EXT) || (t >= T_PANIC && t < T_FALL);
    const inPlane = t < T_HIT;
    const time = performance.now() / 1000;

    /* --- kamera (+ langit) --- */
    this.introCamera(t, dt, inside, time);
    if (t >= T_BLACK) this.introWake(dt);
    else if (t < T_HIT) this.sky.update(this.t, cam.position, cam.position, 0);

    /* --- badai & kilat --- */
    const storm = sm(27, 36, t) * (t < T_BLACK ? 1 : 0);
    I.storm = storm;
    if (!I.rainOn && t > T_STORM - 1) { I.rainOn = true; I.snd.rain(1, inside); }
    if (t > T_STORM - 1 && t < T_STRIKE && t > I.nextBolt) { I.nextBolt = t + 2 + Math.random() * 2.2; I.flash = 1; I.snd.thunder(false); }
    if (!I.strike && t >= T_STRIKE) this.introStrike();
    I.flash = Math.max(0, I.flash - dt * 3.2);
    const flashV = I.flash * (0.6 + 0.4 * Math.random());
    const sk = this.sky;
    sk.sun.intensity *= 1 - 0.85 * storm;
    sk.hemi.intensity = sk.hemi.intensity * (1 - 0.45 * storm) + flashV * 2.2;
    const grey = new THREE.Color(0.17, 0.19, 0.23).lerp(new THREE.Color(0.9, 0.93, 1), flashV);
    this.scene.background.lerp(grey, storm * 0.92);
    this.scene.fog.color.lerp(grey, storm * 0.92);
    this.scene.fog.far = lerp(this.scene.fog.far, Math.min(this.scene.fog.far, 150), storm);
    this.scene.fog.near = lerp(this.scene.fog.near, 12, storm);

    /* --- tampilan interior / eksterior --- */
    P.userData.nose.visible = P.userData.tail.visible = !inside;
    for (const s of I.seated) { s.g.visible = inPlane; s.label.visible = false; }
    I.copilot.visible = I.pilot.visible = inPlane;
    P.userData.inGroup.visible = true;
    I.cabinLight.visible = inside;

    /* --- sinkron animasi awak, penumpang, mesin --- */
    this.introActors(t, dt, time, inside);

    /* --- hujan --- */
    this.introRainUpdate(dt, storm, inside);

    /* --- api & asap --- */
    this.introFire(t, dt);
    I.parts.update(dt);

    /* --- suara --- */
    const camD = cam.position.distanceTo(P.position);
    I.snd.engine(t < T_HIT ? (inside ? 1 : clamp(1.2 - camD / 90, 0.3, 1)) : 0, inside);
    if (I.lastInside !== inside) { I.lastInside = inside; I.snd.rain(storm, inside); }
    if (I.rainOn) I.snd.rain(storm, inside);

    /* --- subtitle --- */
    this.introSubtitle(t, dt);

    /* --- overlay --- */
    let black = 0;
    if (t >= T_HIT + 0.35 && t < T_WAKE) black = 1;
    else if (t >= T_WAKE) black = 1 - sm(T_WAKE, T_WAKE + 1.3, t);
    if (t >= T_WAKE && t < T_WAKE + 5) black = Math.max(black, Math.abs(Math.sin((t - T_WAKE) * 1.6)) > 0.8 && t < T_WAKE + 3.2 ? 0.55 : black);
    if (t < 1.5) black = 1 - sm(0, 1.5, t);
    $('inBlack').style.opacity = black.toFixed(3);
    $('inFlash').style.opacity = Math.max(I.flash * 0.35, I.whiteout || 0).toFixed(3);
    if (I.whiteout) I.whiteout = Math.max(0, I.whiteout - dt * 2.2);
    $('inRed').style.opacity = (t >= T_STRIKE && t < T_FALL ? 0.5 + 0.4 * Math.sin(time * 7) : 0).toFixed(3);
    const bars = t >= T_WAKE + 6 ? 1 - sm(T_WAKE + 6, T_END, t) : 1;
    $('inBarT').style.height = $('inBarB').style.height = (8 * bars).toFixed(2) + 'vh';
    $('inCap').style.opacity = t < 8 ? 0.85 : 0;
    if (t >= T_WAKE) this.r.domElement.style.filter = `blur(${(7 * (1 - sm(T_WAKE + 1, T_WAKE + 7, t))).toFixed(2)}px)`;
    if (t >= T_WAKE + 8 || t < T_WAKE) $('inSkip').style.opacity = t >= T_WAKE + 6 ? 0 : 1;
  },

  introCamera(t, dt, inside, time) {
    const I = this.intro, P = I.plane, h = I.cam, cam = this.cam;
    const sh = I.shake * 0.5 + (t > T_STORM ? 0.02 + (t > T_PANIC && t < T_FALL ? 0.09 : 0.03) * sm(T_STORM, T_STORM + 3, t) : 0.0);
    const sx = (Math.sin(time * 31) + Math.sin(time * 17.3)) * sh, sy = (Math.sin(time * 27.7) + Math.cos(time * 13.1)) * sh;
    I.shake = Math.max(0, I.shake - dt * 1.4);
    let pos, look;
    if (t < T_CALM) {
      const a = lerp(2.2, 0.4, sm(0, T_CALM, t));
      pos = [24 * Math.sin(a), 3 + 2 * Math.cos(a * 2), 22 * Math.cos(a) + 3]; look = [0, 0.3, 2];
    } else if (t < T_STORM) {
      const k = (t - T_CALM) / (T_STORM - T_CALM);
      pos = [0, 0.78, lerp(-6.9, 0.2, k)]; look = [Math.sin(t * 0.4) * 0.7, 0.45, pos[2] + 8];
    } else if (t < 34.2) {
      pos = [0.63, 0.66, -0.3]; look = [lerp(1.4, 3.4, sm(T_STORM, 34, t)), 0.55, 0.45];
    } else if (t < T_EXT) {
      pos = [0, 0.55, -3.2]; look = [0, 0.5, 6.5];
    } else if (t < T_PANIC) {
      /* luar: sambaran petir ke mesin kiri */
      const k = (t - T_EXT) / (T_PANIC - T_EXT);
      pos = [lerp(13, 17, k), lerp(2.8, 4.5, k), lerp(6, 2, k)]; look = [5.3, -1.0, 1.0];
    } else if (t < 49.3) {
      pos = [0.2, 0.55, 3.3]; look = [0, 0.4, -3];
    } else if (t < T_FALL) {
      pos = [0.63, 0.66, -0.3]; look = [0.63 + Math.sin(time * 9) * 0.1, 0.0, 1.3];
    } else if (t < T_HIT) {
      const k = (t - T_FALL) / (T_HIT - T_FALL);
      const a = lerp(-2.6, -1.2, k);
      pos = [Math.sin(a) * lerp(26, 19, k), lerp(8, 3, k), Math.cos(a) * lerp(30, 20, k)]; look = [0, 0, 0];
    } else {
      pos = null;
    }
    if (pos) {
      h.position.set(pos[0] + sx, pos[1] + sy, pos[2]);
      P.updateMatrixWorld(true);
      h.updateMatrixWorld(true);
      h.lookAt(P.localToWorld(new V3(look[0], look[1], look[2])));
      h.updateMatrixWorld(true);
      h.getWorldPosition(cam.position);
      h.getWorldQuaternion(cam.quaternion);
      /* kamera interior: kemiringan guncangan */
      cam.rotateZ(sx * 0.6);
    }
    cam.updateMatrixWorld(true);
    /* lampu kabin mengikuti kamera */
    I.cabinLight.position.set(0, 1.0, clamp((pos ? pos[2] : 0) + 2, -6, 8));
    const emerg = t >= T_STRIKE;
    I.cabinLight.color.setHex(emerg ? 0xff3322 : 0xfff0d8);
    I.cabinLight.intensity = emerg ? 0.8 + 0.8 * Math.max(0, Math.sin(time * 7)) : (t > T_STORM ? 0.9 + (Math.random() < 0.04 ? -0.7 : 0) : 1.0);
    P.userData.lightM.color.setHex(emerg ? (Math.sin(time * 7) > 0 ? 0xff4433 : 0x331111) : 0xfff6dd);
  },

  introActors(t, dt, time) {
    const I = this.intro, P = I.plane;
    const strike = t >= T_STRIKE;
    for (const s of I.seated) {
      const brace = t >= 49.3 && t < T_HIT;
      let panic = strike ? sm(T_STRIKE + s.delay, T_STRIKE + s.delay + 0.4, t) : (t > T_STORM + 3 ? 0.0 : 0);
      if (brace) panic = 0;
      poseChar(s.g, { sit: true, time: time + s.v, panic, brace, mv: 0 }, dt);
      if (!s.g.userData.scream && strike && panic > 0.9 && t < T_FALL + 1) { s.g.userData.scream = true; I.snd.scream(s.v | 0); }
      /* kepala menoleh ke jendela saat badai */
      if (!panic && !brace && t > T_STORM && t < T_STRIKE) s.g.userData.head.rotation.y = Math.sin(time * 0.8 + s.v) * 0.5;
      /* sembunyikan penumpangmu sendiri kalau kamera tepat di kepalanya */
      if (s.me) s.g.visible = this.cam.position.distanceTo(s.g.getWorldPosition(new V3())) > 1.1 && t < T_HIT;
    }
    /* awak kokpit */
    const sp = I.lines.find((l) => l[0] <= t && t < l[0] + l[3]);
    const copilotTalk = !!(sp && sp[4] === 0);
    poseChar(I.copilot, { time, mv: 0, panic: strike ? 0.5 : 0, brace: t >= 49.3 }, dt);
    if (!strike || t < 49.3) I.copilot.userData.armR.rotation.x = copilotTalk ? -0.9 + Math.sin(time * 4) * 0.35 : I.copilot.userData.armR.rotation.x;
    if (copilotTalk) I.copilot.userData.head.rotation.y = Math.sin(time * 1.5) * 0.3;
    poseChar(I.pilot, { sit: true, time, panic: strike ? 0.35 : 0 }, dt);
    I.pilot.userData.armL.rotation.x = -1.35; I.pilot.userData.armR.rotation.x = -1.35;
    I.pilot.userData.upRX = 0;
    /* masker oksigen turun saat darurat */
    if (strike) {
      const ms = P.userData.masks, k = sm(T_PANIC, T_PANIC + 1.2, t);
      for (const m of ms) { m.visible = k > 0.05; m.position.y = lerp(1.1, 0.5, k) + Math.sin(time * 6 + m.position.x * 3) * 0.02 * k; }
    }
    /* kipas mesin */
    const fans = P.userData.fans;
    const dead = t >= T_STRIKE;
    I.fanSpd = dead ? Math.max(4, I.fanSpd - dt * 16) : 40;
    for (let i = 0; i < fans.length; i++) fans[i].rotation.z += dt * (i === 0 && dead ? I.fanSpd : 40) * (i % 2 ? 1 : -1);
    /* lampu navigasi / strobo */
    const blink = Math.sin(time * 6) > 0.6;
    for (const b of P.userData.strobe) b.visible = blink;
    for (const n of P.userData.nav) n.visible = Math.sin(time * 2) > -0.8;
    P.userData.screenM.color.setHex(strike ? (Math.sin(time * 8) > 0 ? 0xff3322 : 0x551111) : 0x3be2a0);
    if (strike && !I.alarm && t < T_FALL + 4) { I.alarm = true; I.snd.alarm(true); I.snd.damage(1); }
    if (t >= T_FALL + 4 && I.alarm) { I.alarm = false; I.snd.alarm(false); }
  },

  introRainUpdate(dt, storm, inside) {
    const I = this.intro, cam = this.cam, pos = I.rain.geometry.attributes.position;
    const op = storm * 0.55;
    I.rain.material.opacity = op;
    I.rain.visible = op > 0.02;
    if (!I.rain.visible) return;
    const rel = new V3(0, -16, 0).addScaledVector(I.planeV, -1 / Math.max(dt, 0.008));
    if (rel.length() > 60) rel.setLength(60);
    I.rv = I.rv || new V3();
    I.rv.lerp(rel, 0.2);
    const BX = 24, BY = 14, BZ = 24, tail = I.rv.clone().multiplyScalar(-0.035);
    I.rainP = I.rainP || new Float32Array(I.rainN * 3);
    for (let i = 0; i < I.rainN; i++) {
      if (!I.rainInit) { I.rainP[i * 3] = (I.rainSeed[i * 3] - 0.5) * BX * 2; I.rainP[i * 3 + 1] = (I.rainSeed[i * 3 + 1] - 0.5) * BY * 2; I.rainP[i * 3 + 2] = (I.rainSeed[i * 3 + 2] - 0.5) * BZ * 2; }
      let x = I.rainP[i * 3] + I.rv.x * dt, y = I.rainP[i * 3 + 1] + I.rv.y * dt, z = I.rainP[i * 3 + 2] + I.rv.z * dt;
      if (x < -BX) x += BX * 2; else if (x > BX) x -= BX * 2;
      if (y < -BY) y += BY * 2; else if (y > BY) y -= BY * 2;
      if (z < -BZ) z += BZ * 2; else if (z > BZ) z -= BZ * 2;
      I.rainP[i * 3] = x; I.rainP[i * 3 + 1] = y; I.rainP[i * 3 + 2] = z;
      const wx = cam.position.x + x, wy = cam.position.y + y, wz = cam.position.z + z;
      pos.setXYZ(i * 2, wx, wy, wz);
      pos.setXYZ(i * 2 + 1, wx + tail.x, wy + tail.y, wz + tail.z);
    }
    I.rainInit = true;
    pos.needsUpdate = true;
  },

  /* ---------- petir menyambar mesin ---------- */
  introStrike() {
    const I = this.intro;
    I.strike = true; I.flash = 1.6; I.shake = 1.2; I.whiteout = 0.9;
    I.boltT = 0.45;
    I.snd.bam();
    const bam = $('inBam');
    bam.textContent = 'BAM!!!';
    bam.style.transition = 'none'; bam.style.opacity = '1'; bam.style.transform = 'scale(1.25)';
    requestAnimationFrame(() => requestAnimationFrame(() => { bam.style.transition = 'opacity 1.6s ease-in .5s, transform 2s'; bam.style.opacity = '0'; bam.style.transform = 'scale(1.7)'; }));
    I.boltOff = [];
    for (let i = 0; i < 14; i++) I.boltOff.push([(Math.random() - 0.5) * 7 * (1 - i / 14), 220 * (1 - i / 14) - 0, (Math.random() - 0.5) * 7 * (1 - i / 14)]);
    const mat = new THREE.LineBasicMaterial({ color: 0xe8f2ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    I.bolts = [];
    for (let k = 0; k < 3; k++) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15 * 3), 3)); const l = new THREE.Line(g, mat); l.frustumCulled = false; this.scene.add(l); I.bolts.push(l); }
    I.boltMat = mat;
  },

  introFire(t, dt) {
    const I = this.intro, P = I.plane;
    /* sambaran */
    if (I.bolts && I.boltT > 0) {
      I.boltT -= dt;
      const eng = P.userData.engL.getWorldPosition(new V3());
      I.bolts.forEach((l, k) => {
        const a = l.geometry.attributes.position;
        for (let i = 0; i < 15; i++) {
          const o = I.boltOff[Math.min(i, 13)];
          const j = i === 14 ? [0, 0, 0] : o;
          a.setXYZ(i, eng.x + j[0] * (1 + k * 0.15) + (k - 1) * 0.15 + (Math.random() - 0.5) * 0.5 * (i < 14 ? 1 : 0), eng.y + j[1], eng.z + j[2] * (1 + k * 0.15));
        }
        a.needsUpdate = true;
      });
      I.boltMat.opacity = clamp(I.boltT / 0.45, 0, 1) * (0.7 + Math.random() * 0.3);
      if (I.boltT <= 0) for (const l of I.bolts) l.visible = false;
    }
    /* api mesin kiri */
    if (t >= T_STRIKE && t < T_HIT) {
      const eng = P.userData.engL.getWorldPosition(new V3());
      const back = new V3(0, 0, -1).applyQuaternion(P.quaternion);
      I.engAcc = (I.engAcc || 0) + dt;
      while (I.engAcc > 0.025) {
        I.engAcc -= 0.025;
        const jit = () => (Math.random() - 0.5);
        I.parts.spawn('fire', eng.clone().add(new V3(jit() * 0.6, jit() * 0.6, jit() * 0.6)), back.clone().multiplyScalar(6 + Math.random() * 4).add(new V3(jit() * 2, jit() * 2 + 1, jit() * 2)), 2.4 + Math.random() * 1.2, 0.7 + Math.random() * 0.4, 0.9);
        if (Math.random() < 0.7) I.parts.spawn('smoke', eng.clone(), back.clone().multiplyScalar(4).add(new V3(jit() * 3, jit() * 3 + 1.5, jit() * 3)), 3 + Math.random() * 2, 3.6 + Math.random(), 3.2);
      }
      I.fireLight.position.copy(eng);
      I.fireLight.intensity = 3.5 + Math.random() * 2;
    } else if (t < T_STRIKE) I.fireLight.intensity = 0;
  },

  /* ---------- subtitle ---------- */
  introSubtitle(t, dt) {
    const I = this.intro;
    const L = I.lines.find((l) => l[0] <= t && t < l[0] + l[3]);
    const box = $('inSub');
    if (!L) { box.style.opacity = 0; I.line = null; return; }
    if (I.line !== L) { I.line = L; I.typeI = 0; I.typeAcc = 0; $('inWho').textContent = L[1] ? L[1] + ': ' : ''; $('inWho').style.color = L[1] === 'Kopilot Raka' ? '#7fd1ff' : L[1] === 'Kapten' ? '#ffd27f' : '#9dff9d'; $('inTxt').textContent = ''; }
    box.style.opacity = 1;
    I.typeAcc += dt * 34;
    const n = Math.min(L[2].length, Math.floor(I.typeAcc));
    if (n !== I.typeI) { if (n % 3 === 0 && L[1]) I.snd.blip(L[4] || 0); I.typeI = n; $('inTxt').textContent = L[2].slice(0, n); }
    const red = L[5] ? '#ff6a5a' : '#fff';
    $('inTxt').style.color = red;
  },

  /* ================= BENTURAN ================= */
  introImpact() {
    const I = this.intro, P = I.plane;
    I.hit = true;
    this.introPlanePose(T_HIT - 0.01);
    I.snd.crash(); I.snd.alarm(false);
    I.whiteout = 1.2; I.shake = 2;
    P.position.copy(I.W); P.position.y += 1.0;
    this.introWreckify(true);
    const c = I.W;
    for (let i = 0; i < 40; i++) I.parts.spawn('fire', new V3(c.x + (Math.random() - 0.5) * 12, c.y + 1 + Math.random() * 3, c.z + (Math.random() - 0.5) * 12), new V3((Math.random() - 0.5) * 14, 5 + Math.random() * 12, (Math.random() - 0.5) * 14), 5 + Math.random() * 4, 1.2 + Math.random(), 1.2);
    for (let i = 0; i < 40; i++) I.parts.spawn('smoke', new V3(c.x + (Math.random() - 0.5) * 12, c.y + 2, c.z + (Math.random() - 0.5) * 12), new V3((Math.random() - 0.5) * 8, 4 + Math.random() * 7, (Math.random() - 0.5) * 8), 6 + Math.random() * 5, 4 + Math.random() * 3, 2.5);
    this.nature.near(c.x, c.z, 22).forEach((n) => { if (n.alive && Math.hypot(n.x - c.x, n.z - c.z) < 19) this.nature.kill(n); });
    I.snd.ring(true);
    setTimeout(() => { if (this.intro && !this.intro.ended) I.snd.heart(true); }, 1800);
    $('inSub').style.opacity = 0;
  },

  /* pecah pesawat menjadi bangkai: ekor lepas, sayap patah, hangus */
  introWreckify() {
    const I = this.intro, P = I.plane, ud = P.userData;
    P.position.copy(I.W); P.position.y = I.W.y + 0.85;
    P.rotation.set(0.1, I.heading, -0.17);
    ud.skinGroup.visible = true; ud.nose.visible = true; ud.tail.visible = true;
    /* ekor terlempar */
    const tail = ud.tail;
    tail.position.set(0.4, -0.4, -7); tail.rotation.set(0.12, 0.35, 0.5);
    ud.wingL.rotation.z = -0.5; ud.wingL.position.y = -1.6; ud.wingL.rotation.y = 0.35;
    ud.wingR.rotation.z = 0.35; ud.wingR.position.y = -1.0;
    ud.engL.position.set(7.5, -1.8, 2.8); ud.engL.rotation.set(0.2, 1.1, 0.9);
    ud.nose.rotation.x = 0.0;
    /* hangus */
    P.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.color || o.material.isMeshBasicMaterial) return;
      o.material = o.material.clone();
      o.material.color.multiplyScalar(0.32);
      if (o.material.map) { o.material.color.multiplyScalar(1.2); }
      o.material.envMapIntensity = 0.25;
    });
    I.planeLights = null;
    P.updateMatrixWorld(true);
    I.cabinLight.visible = false;
    this.wreck = { P, W: I.W.clone(), t: I.wreckT0 || 0, parts: I.parts, light: I.fireLight, snd: I.snd, acc: 0, env: I.env, rain: I.rain, fireAcc: 0 };
    I.wreckPlaced = true;
  },

  /* ================= BANGUN DI RUMPUT ================= */
  introWake(dt) {
    const I = this.intro, p = this.p, t = I.t;
    if (!I.woke) {
      I.woke = true; I.wokeCam = true;
      I.snd.ring(false);
      if (I.rain) I.rain.visible = false;
      this.scene.remove(I.rain);
      this.t = I.savedT; I.savedT = null;
      p.vy = 0; p.y = this.groundAt(p.x, p.z, p.y + 3);
      I.toWreck = Math.atan2(-(I.W.x - p.x), -(I.W.z - p.z));
      I.startYaw = I.toWreck + 0.9;
      this.introHideInterior();
    }
    const k = sm(T_WAKE + 2, T_END - 2, t);
    const k2 = sm(T_WAKE + 8, T_END - 0.5, t);
    const cam = this.cam;
    const lieH = 0.2, eyeH = 1.62;
    const yaw = lerp(I.startYaw, I.toWreck, k);
    const pitch = lerp(1.1, -0.05, k) + Math.sin(t * 1.3) * 0.04 * (1 - k);
    cam.position.set(p.x, p.y + lerp(lieH, eyeH, k2) + Math.sin(t * 1.7) * 0.012, p.z);
    cam.rotation.set(pitch, yaw, lerp(0.5, 0, k2) * (1 - k2 * 0.2));
    cam.rotation.order = 'YXZ';
    this.sky.update(this.t, cam.position, cam.position, 0);
    if (t > T_WAKE + 4) I.snd.heart(t < T_WAKE + 9);
    if (this.wreck) { this.wreck.t += 0; }
  },
  introHideInterior() {
    const I = this.intro;
    for (const s of I.seated) I.plane.remove(s.g);
    I.plane.remove(I.copilot); I.plane.remove(I.pilot);
    I.plane.userData.inGroup.visible = false;
    I.plane.userData.nose.visible = I.plane.userData.tail.visible = true;
    I.plane.remove(I.cabinLight);
    I.plane.remove(I.cam);
  },

  /* ================= SELESAI ================= */
  introEnd(skipped) {
    const I = this.intro;
    if (!I || I.ended) return;
    if (skipped && !I.wreckPlaced) {
      /* lompat langsung ke bangkai pesawat */
      this.introPlanePose(T_HIT - 0.01);
      I.hit = true;
      this.introWreckify();
      this.nature.near(I.W.x, I.W.z, 22).forEach((n) => { if (n.alive && Math.hypot(n.x - I.W.x, n.z - I.W.z) < 19) this.nature.kill(n); });
      if (I.rain) { this.scene.remove(I.rain); }
      I.toWreck = Math.atan2(-(I.W.x - this.p.x), -(I.W.z - this.p.z));
      this.t = I.savedT ?? this.t;
      this.introHideInterior();
    }
    I.ended = true;
    I.snd.stop();
    const p = this.p;
    p.yaw = I.woke ? I.toWreck : (I.toWreck ?? p.yaw);
    p.pitch = -0.05;
    this.cam.rotation.set(p.pitch, p.yaw, 0);
    this.cam.rotation.order = 'YXZ';
    this.r.domElement.style.filter = '';
    this.introUI(false);
    $('hud').style.visibility = '';
    for (const [, r] of this.remotes) r.g.visible = true;
    this.busy = false;
    if (I.rain) { this.scene.remove(I.rain); I.rain.geometry.dispose(); I.rain.material.dispose(); }
    for (const b of I.bolts || []) { this.scene.remove(b); b.geometry.dispose(); }
    if (this.wreck) this.wreck.light = I.fireLight;
    else if (I.fireLight.parent) I.fireLight.parent.remove(I.fireLight);
    if (I.savedT != null) { this.t = I.savedT; I.savedT = null; }
    Audio.music('game'); Audio.ambient(true);
    this.intro = null;
    this.toast('Bertahan hidup di Pulau Santay!');
    if (this.persist) this.save();
  },

  /* ================= BANGKAI TERBAKAR (setelah adegan) ================= */
  wreckUpdate(dt) {
    const w = this.wreck;
    if (!w) return;
    w.t += dt;
    const f = Math.max(0, 1 - w.t / 120);
    const fp = Math.pow(f, 1.4);
    const near = Math.hypot(this.p.x - w.W.x, this.p.z - w.W.z) < 140;
    if (near && this.running) {
      w.acc += dt;
      const rate = 0.04 + (1 - fp) * 0.16; /* makin jarang saat redup */
      const c = w.W, P = w.P;
      while (w.acc > rate) {
        w.acc -= rate;
        const ox = (Math.random() - 0.5) * 14, oz = (Math.random() - 0.5) * 8;
        const pos = new V3(c.x + Math.cos(P.rotation.y) * oz + Math.sin(P.rotation.y) * ox, c.y + 1.2 + Math.random() * 1.2, c.z - Math.sin(P.rotation.y) * oz + Math.cos(P.rotation.y) * ox);
        if (Math.random() < fp) w.parts.spawn('fire', pos, new V3((Math.random() - 0.5) * 1.2, 2.4 + Math.random() * 2.6, (Math.random() - 0.5) * 1.2), (1.8 + Math.random() * 1.8) * (0.4 + 0.6 * fp), 0.8 + Math.random() * 0.5, 0.6);
        if (Math.random() < 0.55) w.parts.spawn('smoke', pos, new V3((Math.random() - 0.3) * 1.8, 2 + Math.random() * 2.2, (Math.random() - 0.5) * 1.5), 2.6 + Math.random() * 2, 4 + Math.random() * 2.5, 3);
      }
    }
    w.parts.update(dt);
    if (w.light) {
      w.light.position.set(w.W.x, w.W.y + 4, w.W.z);
      w.light.distance = 12 + 26 * fp;
      w.light.intensity = near ? fp * (3.4 + Math.random() * 1.6) : 0;
    }
    if (near && w.snd && this.running) { w.fireT = (w.fireT || 0) - dt; if (w.fireT <= 0) { w.fireT = 0.25 + Math.random() * 0.3; const d = Math.hypot(this.p.x - w.W.x, this.p.z - w.W.z); Audio.fire && d < 30 && fp > 0.05 && this.wreckCrackle(fp * (1 - d / 30)); } }
    if (w.t > 170) {
      /* api padam total: tinggal bangkai hangus */
      if (w.light && w.light.parent) w.light.parent.remove(w.light);
      w.parts.dispose();
      this.wreck = null;
      this.wreckDone = true;
    }
  },
  wreckCrackle(v) { if (v > 0) { Audio.fire(); } },
};
