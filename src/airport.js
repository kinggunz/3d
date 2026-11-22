/* ADEGAN BANDARA (±60 detik): karakter berjalan di kota -> masuk terminal -> beli tiket ->
   ke landasan -> naik tangga pesawat. Setelah itu adegan pesawat (intro.js) dimulai. */
import * as THREE from 'three';
import { buildChar, idlePose, resetPose } from './chars.js';
import { buildPlane } from './plane.js';
import { IntroSound } from './introsound.js';
import { Audio } from './audio.js';
import { mulberry32, clamp, lerp } from './util.js';

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
export const AIRPORT_LEN = 60;

/* titik jalan: [waktu, x, y, z] */
const PATH = [
  [0, -30, 0, 4.6], [14, 13, 0, 4.6], [17.5, 24, 0, 1.5], [24, 34.5, 0, -3.2], [36, 34.5, 0, -3.2],
  [42, 44, 0, 0], [48, 60, 0, -3], [51, 66.5, 0, -3], [54, 68.6, 1.7, -3], [56.5, 68.6, 1.7, -0.8],
];
const LINES = [
  [1.5, 'me', 'Akhirnya hari ini tiba. Petualangan ke Pulau Santay!', 4.2],
  [7.5, 'me', 'Itu bandaranya. Tinggal beli tiket.', 3.4],
  [25, 'Petugas', 'Selamat datang! Tujuan Pulau Santay, ya?', 3.2],
  [28.8, 'me', 'Betul, satu tiket tolong.', 2.4],
  [31.6, 'Petugas', 'Ini tiketmu, penerbangan SA dua satu tujuh, gerbang satu.', 4.2],
  [36.2, 'me', 'Terima kasih!', 1.6],
  [43, 'Pengumuman', 'Perhatian, penumpang penerbangan SA dua satu tujuh, silakan naik ke pesawat.', 5],
  [52.2, 'me', 'Semoga perjalanannya lancar...', 3],
];

function boxTex(w, h, col, win) {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = col; g.fillRect(0, 0, 64, 128);
  g.fillStyle = win;
  for (let y = 8; y < 120; y += 22) for (let x = 8; x < 60; x += 20) g.fillRect(x, y, 11, 13);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w, h);
  return t;
}

export class Airport {
  constructor(renderer, look, name, gender, onDone) {
    this.r = renderer; this.name = name || 'Santay'; this.gender = gender === 'P' ? 'P' : 'L'; this.onDone = onDone;
    this.t = 0; this.done = false; this.spoken = null; this.stepT = 0;
    const sc = this.scene = new THREE.Scene();
    sc.background = new THREE.Color(0x9ecbee);
    sc.fog = new THREE.Fog(0xb4d6ee, 40, 190);
    this.cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
    sc.add(new THREE.HemisphereLight(0xd6e8f8, 0x8a9a6a, 1.0));
    const sun = new THREE.DirectionalLight(0xfff2da, 1.5);
    sun.position.set(30, 50, 20); sc.add(sun);
    const rnd = mulberry32(4242);
    const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 1 }, o || {}));
    const box = (w, h, d, m, x, y, z, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); (parent || sc).add(o); return o; };

    /* tanah, jalan, trotoar */
    box(260, 0.2, 120, std(0x6f9a4c), 20, -0.1, 0);
    box(70, 0.22, 7, std(0x45474b), -2, -0.08, -1);
    for (let x = -34; x < 30; x += 6) box(2.6, 0.24, 0.25, std(0xf2eeda), x, -0.07, -1);
    box(80, 0.26, 3.2, std(0xb9b5ab), -2, -0.07, 4.6);
    /* kota: gedung kotak */
    for (let i = 0; i < 16; i++) {
      const x = -42 + i * 5.2 + rnd() * 1.2, h = 6 + rnd() * 22, w = 4 + rnd() * 1.6, d = 5 + rnd() * 3;
      const col = ['#c9c2b3', '#b8c4cf', '#d2b9a0', '#aab8a6'][(rnd() * 4) | 0];
      const m = new THREE.MeshStandardMaterial({ map: boxTex(w / 4, h / 8, col, '#4d6a86'), roughness: 0.9 });
      box(w, h, d, m, x, h / 2, 10 + d / 2 + rnd() * 2);
      if (i % 3 === 0) box(w, h * 0.8, d, m, x + 1, h * 0.4, -9 - d / 2 - rnd() * 2);
    }
    /* pohon kotak di tepi trotoar */
    for (let x = -30; x < 20; x += 8) { box(0.5, 2.2, 0.5, std(0x7a5530), x, 1.1, 7.2); box(2.2, 1.8, 2.2, std(0x3f8a34), x, 3.0, 7.2); }
    /* mobil lewat */
    this.cars = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const c = [0xd24a3a, 0x3a6fd2, 0xe8c63a, 0xf0f0f0, 0x3aa85a][i];
      box(3.2, 0.8, 1.6, std(c), 0, 0.6, 0, g); box(1.7, 0.7, 1.4, std(0x9fc4e0), -0.1, 1.3, 0, g);
      for (const [wx, wz] of [[-1, -.85], [1, -.85], [-1, .85], [1, .85]]) box(0.6, 0.6, 0.25, std(0x151515), wx, 0.3, wz, g);
      g.position.set(-35 + i * 16, 0, i % 2 ? -2.4 : 0.4);
      sc.add(g); this.cars.push({ g, v: (i % 2 ? -1 : 1) * (4 + i) });
    }

    /* terminal bandara: lantai x 23..46, kaca depan */
    const glass = new THREE.MeshStandardMaterial({ color: 0x9cc7e6, transparent: true, opacity: 0.35, roughness: 0.1 });
    box(24, 0.3, 26, std(0xd8d2c4), 35, 0.0, 0);
    box(26, 0.5, 28, std(0x8d8a85), 35, 7.4, 0);
    box(0.4, 7, 9, glass, 22.9, 3.5, 8.5); box(0.4, 7, 9, glass, 22.9, 3.5, -8.5); box(0.4, 1.2, 8, std(0x6a6f78), 22.9, 6.5, 0);
    box(24, 7, 0.4, glass, 35, 3.5, 13); box(24, 7, 0.4, std(0xc9c3b6), 35, 3.5, -13);
    box(0.4, 7, 9, std(0xc9c3b6), 46.9, 3.5, 8.5); box(0.4, 7, 9, std(0xc9c3b6), 46.9, 3.5, -8.5); box(0.4, 1.4, 8, std(0xc9c3b6), 46.9, 6.3, 0);
    /* papan BANDARA */
    { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d');
      g.fillStyle = '#103f8f'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#fff'; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.fillText('BANDARA SANTAY', 256, 68);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
      s.position.set(22.6, 8.6, 0); s.rotation.y = -Math.PI / 2; sc.add(s); }
    /* konter tiket */
    box(1.2, 1.1, 6, std(0x7a5a3a), 36.6, 0.65, -5.5); box(1.3, 0.12, 6.1, std(0xe8e0d0), 36.6, 1.25, -5.5);
    box(0.2, 1.6, 6, std(0x103f8f), 38.2, 1.6, -5.5);
    /* bangku */
    for (let z = 3; z <= 9; z += 3) box(1, 0.5, 2.4, std(0x3a4a66), 28, 0.4, z);
    /* landasan */
    box(90, 0.2, 60, std(0x55585c), 90, -0.1, 0);
    for (let x = 52; x < 130; x += 8) box(3.5, 0.22, 0.3, std(0xf2eeda), x, -0.05, 9);
    /* pesawat parkir: hidung ke +x */
    const P = this.plane = buildPlane();
    P.rotation.y = Math.PI / 2; P.position.set(78, 2.55, 0);
    P.userData.inGroup && (P.userData.inGroup.visible = false);
    sc.add(P);
    /* tangga */
    for (let i = 0; i < 6; i++) box(1.1, 0.28, 1.6, std(0xb0b4b9), 64.6 + i * 0.8 + 0.3, 0.14 + i * 0.28, -3);
    box(1.6, 0.3, 1.8, std(0xb0b4b9), 69.2, 1.5, -3);
    sc.add(this.mk = new THREE.Group());

    /* tokoh utama + petugas + penumpang */
    this.me = buildChar(look); this.me.scale.setScalar(1); sc.add(this.me);
    this.clerk = buildChar({ skin: '#c68642', hair: '#1b1b1b', hairStyle: 0, shirt: '#103f8f', shirt2: '#f4f4f4', shirtStyle: 1, pants: '#14233f', shoes: '#111' });
    this.clerk.position.set(37.8, 0.15, -4.2); this.clerk.rotation.y = -Math.PI / 2; sc.add(this.clerk);
    this.npc = [];
    const SK = ['#e8b48a', '#c68642', '#8d5524', '#f1c9a5'], SH = ['#c0562b', '#2a6fb0', '#556b2f', '#b3262e', '#e0c27a'];
    for (let i = 0; i < 7; i++) {
      const g = buildChar({ skin: SK[i % 4], shirt: SH[i % 5], pants: '#2b3a55', hair: ['#1b1b1b', '#3b2412', '#8a5a2b'][i % 3], hairStyle: i % 6 });
      const queue = i < 3;
      g.position.set(queue ? 35.2 : 26 + rnd() * 9, 0.15, queue ? -2.2 + i * 1.3 - 0.4 + (i > 0 ? 1 : 0) : -8 + rnd() * 16);
      g.rotation.y = queue ? -Math.PI / 2 : rnd() * 6;
      sc.add(g); this.npc.push({ g, s: i });
    }

    this.snd = new IntroSound();
    this.snd.chatter(true);
    this.ui();
  }

  ui() {
    const old = $('apUI'); if (old) old.remove();
    const ui = document.createElement('div');
    ui.id = 'apUI';
    ui.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100dvh;z-index:36;pointer-events:none;font-family:sans-serif;color:#fff;overflow:hidden';
    ui.innerHTML = `
      <div style="position:absolute;left:0;right:0;top:0;height:8vh;background:#000"></div>
      <div style="position:absolute;left:0;right:0;bottom:0;height:8vh;background:#000"></div>
      <div id="apCap" style="position:absolute;left:14px;top:calc(8vh + 10px);font-size:12px;letter-spacing:1px;text-shadow:0 1px 3px #000">SA-217 • MENUJU PULAU SANTAY</div>
      <div id="apTicket" style="position:absolute;left:50%;top:30%;transform:translate(-50%,-50%) scale(.6);opacity:0;transition:all .5s;background:#f6f1e3;color:#222;border-radius:12px;padding:12px 22px;border-left:10px solid #103f8f;box-shadow:0 6px 24px rgba(0,0,0,.5);text-align:left">
        <b style="font-size:12px;letter-spacing:2px;color:#103f8f">TIKET PESAWAT</b>
        <div id="apTkName" style="font-size:20px;font-weight:800;margin:4px 0"></div>
        <div style="font-size:13px">SA-217 • KOTA → PULAU SANTAY • GERBANG 1</div></div>
      <div id="apSub" style="position:absolute;left:5%;right:5%;bottom:calc(8vh + 14px);text-align:center;font-size:clamp(14px,3.6vw,20px);line-height:1.35;text-shadow:0 1px 4px #000,0 0 8px #000;opacity:0"><b id="apWho"></b><span id="apTxt"></span></div>
      <div id="apBlack" style="position:absolute;inset:0;background:#000;opacity:1;transition:opacity 1.2s"></div>
      <button id="apSkip" style="position:absolute;right:12px;top:calc(8vh + 8px);pointer-events:auto;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.5);border-radius:8px;padding:7px 12px;font-size:13px">Lewati ⏭</button>`;
    document.body.appendChild(ui);
    $('apTkName').textContent = this.name.toUpperCase();
    $('apSkip').onclick = () => this.finish();
    requestAnimationFrame(() => requestAnimationFrame(() => { const b = $('apBlack'); if (b) b.style.opacity = 0; }));
  }

  pose(t) {
    let i = 0;
    while (i < PATH.length - 2 && t > PATH[i + 1][0]) i++;
    const a = PATH[i], b = PATH[i + 1];
    const k = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
    return { x: lerp(a[1], b[1], k), y: lerp(a[2], b[2], k), z: lerp(a[3], b[3], k), moving: (a[1] !== b[1] || a[3] !== b[3] || a[2] !== b[2]) && t < PATH[PATH.length - 1][0], dx: b[1] - a[1], dz: b[3] - a[3] };
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const t = this.t;
    if (t >= AIRPORT_LEN) { this.finish(); return; }
    const m = this.me, p = this.pose(t);
    m.position.set(p.x, p.y + 0.15, p.z);
    let yaw = m.rotation.y;
    if (p.moving) yaw = Math.atan2(p.dx, p.dz);
    else if (t > 24 && t < 40) yaw = Math.PI / 2 + 0.2; /* menghadap konter (+x) */
    else if (t >= 56) yaw = Math.PI / 2;
    m.rotation.y += Math.atan2(Math.sin(yaw - m.rotation.y), Math.cos(yaw - m.rotation.y)) * Math.min(1, dt * 8);
    const u = m.userData;
    if (p.moving && u.rig) {
      resetPose(m);
      const w = t * 7.5;
      u.legL.rotation.x = Math.sin(w) * 0.7; u.legR.rotation.x = -Math.sin(w) * 0.7;
      u.armL.rotation.x = -Math.sin(w) * 0.6; u.armR.rotation.x = Math.sin(w) * 0.6;
      u.rig.position.y = Math.abs(Math.sin(w)) * 0.05;
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.34; Audio.footstep(false, false); }
    } else idlePose(m, t, 0);
    idlePose(this.clerk, t, t > 31 && t < 34 ? 1 : 0);
    for (const n of this.npc) idlePose(n.g, t + n.s, n.s);
    for (const c of this.cars) { c.g.position.x += c.v * dt; if (c.g.position.x > 45) c.g.position.x = -45; if (c.g.position.x < -45) c.g.position.x = 45; c.g.rotation.y = c.v < 0 ? Math.PI : 0; }
    /* tiket muncul saat dibeli */
    const tk = $('apTicket');
    if (tk) { const on = t > 33 && t < 38.5; tk.style.opacity = on ? 1 : 0; tk.style.transform = `translate(-50%,-50%) scale(${on ? 1 : 0.6})`; }
    /* kamera */
    const target = new V3(p.x, p.y + 1.25, p.z);
    let off;
    if (t < 14) off = new V3(Math.sin(t * 0.25) * 2 + 3.2, 1.5, 5.2);
    else if (t < 24) off = new V3(-3.5, 2.2, 4.5);
    else if (t < 40) { off = new V3(-3.2, 1.9, 3.4); target.x += 1.2; target.z -= 0.6; }
    else if (t < 52) off = new V3(-5, 2.3, 4.2);
    else off = new V3(-4.6, 2.6, 5.5);
    const want = target.clone().add(off);
    if (!this.camInit) { this.cam.position.copy(want); this.camInit = true; }
    this.cam.position.lerp(want, Math.min(1, dt * 2.5));
    this.cam.lookAt(target);
    if (t > 50) this.snd.engine(Math.min(0.5, (t - 50) * 0.06), false);
    /* subtitle + suara */
    const L = LINES.find((l) => l[0] <= t && t < l[0] + l[3]);
    const box = $('apSub');
    if (!L) { if (box) box.style.opacity = 0; this.spoken = null; }
    else {
      const who = L[1] === 'me' ? this.name : L[1];
      if (this.spoken !== L) {
        this.spoken = L;
        $('apWho').textContent = who + ': ';
        $('apWho').style.color = L[1] === 'me' ? '#9dff9d' : L[1] === 'Pengumuman' ? '#ffd27f' : '#7fd1ff';
        $('apTxt').textContent = L[2];
        const kind = L[1] === 'me' ? 1 : L[1] === 'Petugas' ? 2 : 3;
        this.snd.voice(L[2], L[3], kind, false, null, L[1] === 'me' ? this.gender : 'P');
      }
      box.style.opacity = 1;
    }
    if (t > AIRPORT_LEN - 2.2) { const b = $('apBlack'); if (b) b.style.opacity = 1; }
  }

  resize() { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); }
  render() { if (Math.abs(this.cam.aspect - innerWidth / innerHeight) > 0.01) this.resize(); this.r.render(this.scene, this.cam); }

  finish() {
    if (this.done) return;
    this.done = true;
    this.snd.chatter(false);
    this.snd.stop();
    const u = $('apUI'); if (u) u.remove();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    if (this.onDone) this.onDone();
  }
}
