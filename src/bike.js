/* Model motor skuter (gaya Honda Vario) yang detail + semua opsi modifikasi. Arah depan = -z, roda menyentuh y=0. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const KITS = ['Standar', 'Sport', 'Racing', 'Retro', 'Touring'];
export const EXHAUSTS = ['Standar', 'Racing Kerucut', 'Brong Besar', 'Titanium Bakar', 'Knalpot Naik', 'Dual Pipa'];
export const WHEELS = ['5 Jari', '10 Jari', 'Cakram Penuh', 'Tiga Cabang'];
export const TIRES = ['Standar', 'Lebar', 'Super Lebar'];
export const PATTERNS = ['Polos', 'Garis Tengah', 'Garis Ganda', 'Kotak-kotak', 'Gradasi'];
export const SUSP = ['Rendah', 'Standar', 'Tinggi'];
export const ENGINES = [
  { n: 'Standar 125cc', vmax: 29, acc: 1.0 },
  { n: 'Bore Up 150cc', vmax: 34, acc: 1.2 },
  { n: 'Racing 200cc', vmax: 40, acc: 1.45 },
  { n: 'Turbo Drag', vmax: 48, acc: 1.8 },
];
export const SOUNDS = ['Vario Standar', 'Racing Halus', 'Bass Berat', 'Brong 2-Tak', 'Sport Tinggi'];
export const PAINTS = ['#c4161c', '#d9d9dc', '#111214', '#1f4fa8', '#e8a317', '#2e7d4f', '#6b2d8f', '#e56b1f', '#7d868f', '#f2efe6'];

export const BIKE_DEFAULT = {
  body: '#c4161c', side: '#1a1b1e', seat: '#17181a', rim: '#c9ccd1', exh: '#9aa0a6', lamp: '#fff7e0', helmet: '#e8e8ea',
  kit: 0, wheel: 0, exhaust: 0, tire: 0, pattern: 0, susp: 1, engine: 0,
  snd: 0, bass: 0.5, treble: 0.5, rasp: 0.3, livery: null,
};

const clampI = (v, n) => Math.max(0, Math.min(n - 1, v | 0));
export function normBike(c) {
  const d = Object.assign({}, BIKE_DEFAULT, c || {});
  const col = (v, f) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : f);
  for (const k of ['body', 'side', 'seat', 'rim', 'exh', 'lamp', 'helmet']) d[k] = col(d[k], BIKE_DEFAULT[k]);
  d.kit = clampI(d.kit, KITS.length); d.wheel = clampI(d.wheel, WHEELS.length); d.exhaust = clampI(d.exhaust, EXHAUSTS.length);
  d.tire = clampI(d.tire, TIRES.length); d.pattern = clampI(d.pattern, PATTERNS.length); d.susp = clampI(d.susp, SUSP.length);
  d.engine = clampI(d.engine, ENGINES.length); d.snd = clampI(d.snd, SOUNDS.length);
  for (const k of ['bass', 'treble', 'rasp']) d[k] = Math.max(0, Math.min(1, +d[k] || 0));
  if (typeof d.livery !== 'string' || !d.livery.startsWith('data:image/')) d.livery = null;
  return d;
}
/* untuk dikirim ke pemain lain (tanpa gambar, ukuran kecil) */
export function packBike(c) {
  const d = normBike(c);
  const o = Object.assign({}, d);
  delete o.livery;
  return JSON.stringify(o);
}
export function unpackBike(s) {
  try { return normBike(JSON.parse(s)); } catch (e) { return null; }
}

/* ===== tekstur cat / stiker ===== */
const imgCache = new Map();
function loadImg(url, cb) {
  let e = imgCache.get(url);
  if (e) { if (e.ok) cb(e.img); else e.cbs.push(cb); return; }
  const img = new Image();
  e = { img, ok: false, cbs: [cb] };
  imgCache.set(url, e);
  img.onload = () => { e.ok = true; e.cbs.forEach((f) => f(img)); e.cbs = []; };
  img.src = url;
}

function paint(cv, base, accent, cfg, img, isSide) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  g.fillStyle = accent;
  if (cfg.pattern === 1) g.fillRect(0, H * 0.44, W, H * 0.12);
  else if (cfg.pattern === 2) { g.fillRect(0, H * 0.34, W, H * 0.08); g.fillRect(0, H * 0.5, W, H * 0.08); }
  else if (cfg.pattern === 3) { const s = W / 8; for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) g.fillRect(i * s, H * 0.42 + j * s, s, s); }
  else if (cfg.pattern === 4) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, base); gr.addColorStop(1, accent); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  if (img) {
    const k = Math.max(W / img.width, H / img.height);
    g.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k);
  } else if (isSide) {
    g.fillStyle = 'rgba(255,255,255,.92)'; g.font = `italic 900 ${H * 0.2}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('VARIO', W / 2, H * 0.5);
    g.font = `700 ${H * 0.08}px Arial, sans-serif`; g.fillText('SANTAY 160', W / 2, H * 0.72);
  }
}

function plateTex() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f4ef'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 120);
  g.fillStyle = '#111'; g.font = '900 54px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('B 3 SANTAY', 128, 56);
  g.font = '700 22px Arial, sans-serif'; g.fillText('11 · 28', 128, 104);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function burntTex() {
  const cv = document.createElement('canvas'); cv.width = 8; cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, '#b8b8c0'); gr.addColorStop(0.3, '#d8a63a'); gr.addColorStop(0.6, '#5a4fc2'); gr.addColorStop(1, '#2b2f66');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildBike(src) {
  const cfg = normBike(src);
  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);
  const frame = new THREE.Group(); /* bodi (bisa naik/turun menurut suspensi) */
  lean.add(frame);
  const mats = [];

  const paintMat = (col, map) => {
    const m = new THREE.MeshPhysicalMaterial({ color: map ? 0xffffff : col, map: map || null, metalness: 0.3, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    mats.push(m); return m;
  };
  const mk = (o) => { const m = new THREE.MeshStandardMaterial(o); mats.push(m); return m; };

  /* cat bodi & panel samping dengan tekstur kanvas */
  const bodyCv = document.createElement('canvas'); bodyCv.width = bodyCv.height = 256;
  const sideCv = document.createElement('canvas'); sideCv.width = sideCv.height = 256;
  const bodyTex = new THREE.CanvasTexture(bodyCv), sideTex = new THREE.CanvasTexture(sideCv);
  bodyTex.colorSpace = sideTex.colorSpace = THREE.SRGBColorSpace;
  const redraw = (img) => {
    paint(bodyCv, cfg.body, cfg.side, cfg, img, false);
    paint(sideCv, cfg.side, cfg.body, cfg, img, true);
    bodyTex.needsUpdate = sideTex.needsUpdate = true;
  };
  let curImg = null, curLv = cfg.livery;
  redraw(null);
  if (cfg.livery) loadImg(cfg.livery, (img) => { curImg = img; redraw(img); });
  const bodyM = paintMat(cfg.body, bodyTex);
  const sideM = paintMat(cfg.side, sideTex);
  const blackM = mk({ color: 0x15161a, roughness: 0.65, metalness: 0.1 });
  const darkM = mk({ color: 0x2a2c31, roughness: 0.5, metalness: 0.5 });
  const seatM = mk({ color: cfg.seat, roughness: 0.85, metalness: 0 });
  const rubberM = mk({ color: 0x101011, roughness: 0.95, metalness: 0 });
  const chromeM = mk({ color: 0xe6e8ec, roughness: 0.12, metalness: 1 });
  const rimM = mk({ color: cfg.rim, roughness: 0.28, metalness: 0.95 });
  const exhM = cfg.exhaust === 3 ? mk({ color: 0xffffff, map: burntTex(), roughness: 0.25, metalness: 0.9 }) : mk({ color: cfg.exh, roughness: cfg.exh === '#111111' ? 0.5 : 0.2, metalness: 1 });
  const lampM = mk({ color: 0xffffff, emissive: cfg.lamp, emissiveIntensity: 1.6, roughness: 0.2 });
  const glassM = mk({ color: 0x9fb7c9, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 });
  const tailM = mk({ color: 0x8a0f12, emissive: 0xff1010, emissiveIntensity: 0.9, roughness: 0.3 });
  const plateM = mk({ map: plateTex(), roughness: 0.6 });
  const goldM = mk({ color: 0xc89a2a, roughness: 0.3, metalness: 0.9 });
  const helmM = new THREE.MeshPhysicalMaterial({ color: cfg.helmet, roughness: 0.25, metalness: 0.2, clearcoat: 1 });
  mats.push(helmM);

  const rb = (w, h, d, r, m, x, y, z, rx = 0, ry = 0, rz = 0, par = frame) => {
    const me = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), m);
    me.position.set(x, y, z); me.rotation.set(rx, ry, rz); par.add(me); return me;
  };
  const cy = (rt, rb2, h, m, x, y, z, rx = 0, ry = 0, rz = 0, par = frame, seg = 14) => {
    const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb2, h, seg), m);
    me.position.set(x, y, z); me.rotation.set(rx, ry, rz); par.add(me); return me;
  };
  const sph = (r, m, x, y, z, sx = 1, sy = 1, sz = 1, par = frame) => {
    const me = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
    me.position.set(x, y, z); me.scale.set(sx, sy, sz); par.add(me); return me;
  };

  /* ---------- roda ---------- */
  const wide = [1, 1.3, 1.6][cfg.tire];
  const makeWheel = () => {
    const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    const tube = 0.075;
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.2, tube, 16, 40), rubberM);
    tire.rotation.y = Math.PI / 2; tire.scale.z = wide; spin.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06 * wide, 32, 1, true), rimM);
    rim.rotation.z = Math.PI / 2; rim.material.side = THREE.DoubleSide; spin.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14), chromeM);
    hub.rotation.z = Math.PI / 2; spin.add(hub);
    const spoke = (n, len, w, th, off = 0) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + off;
        const s = new THREE.Mesh(new THREE.BoxGeometry(th, len, w), rimM);
        s.position.set(0, Math.cos(a) * (len / 2 + 0.03), Math.sin(a) * (len / 2 + 0.03));
        s.rotation.x = -a; spin.add(s);
      }
    };
    if (cfg.wheel === 0) { spoke(5, 0.17, 0.035, 0.03); spoke(5, 0.17, 0.035, 0.03, 0.2); }
    else if (cfg.wheel === 1) spoke(10, 0.17, 0.016, 0.02);
    else if (cfg.wheel === 2) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 32), rimM); d.rotation.z = Math.PI / 2; spin.add(d);
      const d2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.036, 24), blackM); d2.rotation.z = Math.PI / 2; spin.add(d2);
    } else { spoke(3, 0.18, 0.07, 0.03); }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.008, 28), darkM);
    disc.rotation.z = Math.PI / 2; disc.position.x = -0.045; spin.add(disc);
    return { g, spin };
  };

  /* roda belakang */
  const RW = makeWheel();
  RW.g.position.set(0, 0.275, 0.64); frame.parent.add(RW.g);
  /* ---------- kemudi + garpu + roda depan ---------- */
  const steer = new THREE.Group();
  const headY = 0.93, headZ = -0.54;
  steer.position.set(0, headY, headZ);
  lean.add(steer);
  const FW = makeWheel();
  FW.g.position.set(0, 0.275 - headY, -0.64 - headZ); steer.add(FW.g);
  for (const s of [-1, 1]) {
    cy(0.017, 0.017, 0.62, blackM, 0.095 * s, -0.33, -0.065, 0.1, 0, 0, steer, 10);
    cy(0.024, 0.024, 0.2, chromeM, 0.095 * s, -0.55, -0.1, 0.1, 0, 0, steer, 10);
    cy(0.012, 0.012, 0.12, darkM, 0.07 * s, -0.66, -0.11, 0, 0, Math.PI / 2, steer, 8);
  }
  cy(0.014, 0.014, 0.19, darkM, 0, -0.07, -0.01, 0, 0, Math.PI / 2, steer, 8);
  /* kaliper rem */
  rb(0.04, 0.09, 0.06, 0.012, goldM, -0.075, -0.63, -0.04, 0, 0, 0, steer);
  /* fender depan */
  const ff = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.13 * wide, 28, 1, true, 0.28 * Math.PI, 0.62 * Math.PI), bodyM);
  ff.material.side = THREE.DoubleSide; ff.rotation.z = Math.PI / 2; ff.position.copy(FW.g.position); steer.add(ff);
  /* setang */
  const bar = cy(0.013, 0.013, 0.7, chromeM, 0, 0.1, 0.0, 0, 0, Math.PI / 2, steer, 10);
  for (const s of [-1, 1]) {
    cy(0.017, 0.017, 0.12, rubberM, 0.3 * s, 0.1, 0.0, 0, 0, Math.PI / 2, steer, 10);
    rb(0.012, 0.012, 0.11, 0.004, chromeM, 0.26 * s, 0.1, -0.07, 0, 0.1 * s, 0, steer);
    /* spion */
    cy(0.006, 0.006, 0.2, blackM, 0.31 * s, 0.2, 0.0, 0, 0, 0.18 * s, steer, 6);
    rb(0.11, 0.065, 0.02, 0.012, blackM, 0.33 * s, 0.31, 0.01, 0, 0, 0.15 * s, steer);
    rb(0.095, 0.05, 0.004, 0.01, glassM, 0.33 * s, 0.31, -0.002, 0, 0, 0.15 * s, steer);
  }
  void bar;
  /* penutup setang + panel meter */
  rb(0.5, 0.15, 0.22, 0.05, bodyM, 0, 0.16, -0.02, 0.1, 0, 0, steer);
  rb(0.26, 0.05, 0.16, 0.02, blackM, 0, 0.245, 0.0, 0.1, 0, 0, steer);
  rb(0.2, 0.008, 0.11, 0.003, mk({ color: 0x0a1a24, emissive: 0x3ac6ff, emissiveIntensity: 0.5, roughness: 0.2 }), 0, 0.275, 0.0, 0.1, 0, 0, steer);

  /* ---------- badan tetap ---------- */
  /* legshield / cowl depan */
  rb(0.44, 0.58, 0.12, 0.05, bodyM, 0, 0.62, -0.44, -0.2, 0, 0);
  rb(0.5, 0.22, 0.2, 0.07, bodyM, 0, 0.95, -0.52, -0.1, 0, 0);
  rb(0.32, 0.16, 0.1, 0.04, bodyM, 0, 0.4, -0.55, -0.35, 0, 0); /* apron bawah */
  /* lampu depan LED */
  rb(0.26, 0.055, 0.03, 0.015, lampM, 0, 0.99, -0.625, -0.1, 0, 0);
  rb(0.08, 0.04, 0.03, 0.012, lampM, -0.16, 0.95, -0.62, -0.1, 0, 0.0);
  rb(0.08, 0.04, 0.03, 0.012, lampM, 0.16, 0.95, -0.62, -0.1, 0, 0.0);
  rb(0.3, 0.012, 0.03, 0.005, mk({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 }), 0, 0.915, -0.625, -0.1, 0, 0);
  /* lampu sein */
  for (const s of [-1, 1]) rb(0.05, 0.03, 0.03, 0.01, mk({ color: 0xffa000, emissive: 0xff7a00, emissiveIntensity: 0.5 }), 0.26 * s, 0.93, -0.5);
  /* lantai pijakan */
  rb(0.42, 0.045, 0.66, 0.015, blackM, 0, 0.28, -0.1);
  for (let i = 0; i < 5; i++) rb(0.36, 0.01, 0.025, 0.004, darkM, 0, 0.308, -0.33 + i * 0.12);
  for (const s of [-1, 1]) rb(0.05, 0.17, 0.64, 0.02, bodyM, 0.235 * s, 0.31, -0.08);
  /* tunnel tengah */
  rb(0.24, 0.34, 0.3, 0.06, bodyM, 0, 0.46, 0.12);
  /* bodi bawah jok */
  rb(0.35, 0.3, 0.74, 0.09, bodyM, 0, 0.53, 0.5);
  /* panel samping */
  for (const s of [-1, 1]) rb(0.04, 0.24, 0.62, 0.02, sideM, 0.185 * s, 0.52, 0.5);
  /* ekor */
  rb(0.3, 0.17, 0.32, 0.07, bodyM, 0, 0.66, 0.9, -0.3, 0, 0);
  /* jok */
  rb(0.31, 0.095, 0.5, 0.04, seatM, 0, 0.745, 0.32);
  rb(0.29, 0.1, 0.32, 0.045, seatM, 0, 0.77, 0.66, -0.05, 0, 0);
  rb(0.22, 0.012, 0.42, 0.005, mk({ color: 0x3b3d42, roughness: 0.9 }), 0, 0.797, 0.32);
  /* pegangan belakang */
  const grab = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.15, 0.78, 0.55), new THREE.Vector3(-0.15, 0.84, 0.82), new THREE.Vector3(-0.07, 0.86, 1.0),
    new THREE.Vector3(0.07, 0.86, 1.0), new THREE.Vector3(0.15, 0.84, 0.82), new THREE.Vector3(0.15, 0.78, 0.55)], false, 'catmullrom', 0.3), 40, 0.014, 8), darkM);
  frame.add(grab);
  /* lampu belakang + plat */
  rb(0.24, 0.05, 0.04, 0.02, tailM, 0, 0.7, 1.05, -0.3, 0, 0);
  const tailLamp = tailM;
  rb(0.2, 0.11, 0.012, 0.004, plateM, 0, 0.58, 1.07, 0.18, 0, 0);
  for (const s of [-1, 1]) rb(0.05, 0.03, 0.03, 0.01, mk({ color: 0xffa000, emissive: 0xff7a00, emissiveIntensity: 0.4 }), 0.14 * s, 0.62, 1.04);
  /* fender belakang */
  const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.13 * wide, 28, 1, true, 0.02 * Math.PI, 0.5 * Math.PI), blackM);
  rf.material.side = THREE.DoubleSide; rf.rotation.z = Math.PI / 2; rf.position.set(0, 0.275, 0.64); frame.add(rf);
  /* mesin / CVT, swingarm, shock */
  rb(0.16, 0.24, 0.5, 0.05, darkM, -0.08, 0.3, 0.46);
  for (let i = 0; i < 4; i++) rb(0.01, 0.015, 0.2, 0.004, blackM, -0.168, 0.26 + i * 0.04, 0.46);
  rb(0.12, 0.16, 0.34, 0.04, darkM, 0.06, 0.26, 0.2);
  for (const s of [-1, 1]) {
    cy(0.012, 0.012, 0.3, chromeM, 0.14 * s, 0.5, 0.84, 0.0, 0, 0.0, frame, 8).rotation.x = 0.55;
    cy(0.02, 0.02, 0.16, goldM, 0.14 * s, 0.43, 0.76, 0, 0, 0, frame, 10).rotation.x = 0.55;
    cy(0.012, 0.012, 0.04, chromeM, 0.1 * s, 0.38, 0.5, 0, 0, Math.PI / 2, frame, 8);
  }
  /* standar samping */
  cy(0.012, 0.012, 0.24, darkM, -0.13, 0.12, 0.3, 0, 0, 0.05, frame, 8).rotation.x = 1.2;
  /* pijakan penumpang */
  for (const s of [-1, 1]) rb(0.1, 0.02, 0.04, 0.008, chromeM, 0.2 * s, 0.4, 0.68);

  /* ---------- knalpot ---------- */
  const ex = new THREE.Group(); frame.add(ex);
  const pipe = (rt, rb2, len, y, z, tilt, x = 0.16, m = exhM) => {
    const p = cy(rt, rb2, len, m, x, y, z, Math.PI / 2 + tilt, 0, 0, ex, 20);
    cy(rt * 0.72, rt * 0.72, 0.02, blackM, x, y + Math.sin(tilt) * len * 0.5, z + len * 0.5 - 0.005, Math.PI / 2 + tilt, 0, 0, ex, 14);
    return p;
  };
  /* pipa dari mesin */
  cy(0.018, 0.018, 0.4, exhM, 0.1, 0.2, 0.3, Math.PI / 2, 0, 0, ex, 10);
  if (cfg.exhaust === 0) { pipe(0.05, 0.05, 0.46, 0.27, 0.66, 0); rb(0.02, 0.07, 0.3, 0.008, darkM, 0.2, 0.32, 0.66); }
  else if (cfg.exhaust === 1) pipe(0.075, 0.032, 0.62, 0.3, 0.74, 0.08);
  else if (cfg.exhaust === 2) { pipe(0.08, 0.08, 0.42, 0.28, 0.7, 0, 0.17, mk({ color: 0x1a1a1c, roughness: 0.4, metalness: 0.6 })); cy(0.083, 0.083, 0.04, chromeM, 0.17, 0.28, 0.54, Math.PI / 2, 0, 0, ex, 20); }
  else if (cfg.exhaust === 3) pipe(0.06, 0.045, 0.56, 0.29, 0.72, 0.05);
  else if (cfg.exhaust === 4) pipe(0.055, 0.045, 0.4, 0.33, 0.7, 0.45);
  else { pipe(0.036, 0.036, 0.5, 0.26, 0.7, 0, 0.15); pipe(0.036, 0.036, 0.5, 0.33, 0.7, 0.05, 0.19); }

  /* ---------- paket bodi ---------- */
  if (cfg.kit === 1) { /* sport */
    for (const s of [-1, 1]) {
      rb(0.07, 0.03, 0.22, 0.012, bodyM, 0.27 * s, 0.82, -0.52, 0, 0.0, 0.25 * s);
      rb(0.04, 0.12, 0.34, 0.015, bodyM, 0.2 * s, 0.38, -0.2, 0, 0, 0.2 * s);
    }
    rb(0.46, 0.035, 0.2, 0.012, bodyM, 0, 0.8, 1.04, -0.2, 0, 0);
  } else if (cfg.kit === 2) { /* racing */
    rb(0.32, 0.34, 0.012, 0.005, glassM, 0, 1.18, -0.5, -0.5, 0, 0);
    rb(0.4, 0.07, 0.62, 0.025, bodyM, 0, 0.26, -0.15);
    rb(0.34, 0.03, 0.2, 0.01, blackM, 0, 0.84, 1.02, -0.35, 0, 0);
    rb(0.26, 0.18, 0.012, 0.005, mk({ color: 0xffffff, roughness: 0.5 }), 0, 0.97, -0.64, -0.1, 0, 0);
  } else if (cfg.kit === 3) { /* retro */
    cy(0.13, 0.13, 0.06, chromeM, 0, 0.82, -0.6, Math.PI / 2 - 0.1, 0, 0, frame, 24);
    cy(0.105, 0.105, 0.065, lampM, 0, 0.82, -0.605, Math.PI / 2 - 0.1, 0, 0, frame, 24);
    ff.material = chromeM;
    rb(0.31, 0.11, 0.5, 0.04, mk({ color: 0x6b4a2b, roughness: 0.8 }), 0, 0.752, 0.32);
  } else if (cfg.kit === 4) { /* touring */
    rb(0.4, 0.46, 0.012, 0.005, glassM, 0, 1.26, -0.5, -0.35, 0, 0);
    for (const s of [-1, 1]) cy(0.008, 0.008, 0.3, chromeM, 0.2 * s, 1.1, -0.48, -0.35, 0, 0, frame, 8);
    rb(0.36, 0.26, 0.4, 0.07, bodyM, 0, 0.98, 1.06);
    rb(0.3, 0.012, 0.3, 0.005, chromeM, 0, 0.855, 1.0);
  }

  /* ---------- suspensi (tinggi bodi) ---------- */
  const dy = [-0.04, 0, 0.045][cfg.susp];
  frame.position.y = dy;
  steer.position.y = headY + dy;
  FW.g.position.y = 0.275 - headY - dy;

  /* ---------- pengendara ---------- */
  const api = {
    cfg, root, lean, steer, mats, wheels: [FW, RW],
    rider: null,
    setRider(ch) {
      if (api.rider) lean.remove(api.rider);
      api.rider = ch;
      if (!ch) return;
      ch.rotation.set(0, Math.PI, 0); ch.scale.setScalar(0.8);
      ch.position.set(0, 0.8 - 0.68 + dy, 0.22);
      lean.add(ch);
      const u = ch.userData;
      if (u) {
        u.legL.rotation.x = u.legR.rotation.x = -0.95;
        u.legL.rotation.z = 0.12; u.legR.rotation.z = -0.12;
        u.up.rotation.x = 0.32;
        u.armL.rotation.x = u.armR.rotation.x = -1.15;
        u.armL.rotation.z = -0.2; u.armR.rotation.z = 0.2;
        /* helm */
        if (u.head && !u.head.userData.helm) {
          const hm = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), helmM);
          hm.position.set(0, 1.74 - 1.4, -0.02);
          hm.scale.set(1.02, 0.95, 1.1);
          const vis = new THREE.Mesh(new THREE.SphereGeometry(0.345, 16, 10, -0.9, 1.8, 0.95, 0.9), new THREE.MeshPhysicalMaterial({ color: 0x1b2430, roughness: 0.05, metalness: 0.6 }));
          vis.position.copy(hm.position); vis.scale.copy(hm.scale); vis.rotation.y = 0;
          u.head.add(hm, vis);
          u.head.userData.helm = hm;
        }
      }
    },
    /* ubah warna/pola/stiker langsung tanpa membangun ulang model */
    recolor(c) {
      Object.assign(cfg, normBike(c));
      if (cfg.livery !== curLv) {
        curLv = cfg.livery; curImg = null;
        if (curLv) loadImg(curLv, (img) => { if (curLv === cfg.livery) { curImg = img; redraw(img); } });
      }
      redraw(curImg);
      seatM.color.set(cfg.seat); rimM.color.set(cfg.rim); lampM.emissive.set(cfg.lamp); helmM.color.set(cfg.helmet);
      if (cfg.exhaust !== 3) exhM.color.set(cfg.exh);
    },
    /* v = kecepatan (m/s), dist = jarak tempuh, st = sudut kemudi, ln = miring badan, brake = rem */
    update(dist, st, ln, brake) {
      for (const w of api.wheels) w.spin.rotation.x = -dist / 0.275;
      steer.rotation.y = st;
      lean.rotation.z = ln;
      tailLamp.emissiveIntensity = brake ? 2.6 : 0.7;
    },
  };
  return api;
}
