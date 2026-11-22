import * as THREE from 'three';
import { T } from './textures.js';

/* ====== daftar bangunan (urutan = urutan di bar bangun) ====== */
export const BUILD = {
  lantai: { n: 'Lantai', ic: '🟫', cost: { kayu: 2 }, mode: 'cell' },
  dinding: { n: 'Dinding', ic: '🧱', cost: { kayu: 2 }, mode: 'edge' },
  batu: { n: 'Dinding Batu', ic: '🪨', cost: { batu: 3 }, mode: 'edge' },
  pintu: { n: 'Pintu', ic: '🚪', cost: { papan: 3 }, mode: 'edge' },
  atap: { n: 'Atap', ic: '🛖', cost: { kayu: 3 }, mode: 'cell' },
  tangga: { n: 'Tangga', ic: '🪜', cost: { kayu: 4 }, mode: 'cell', rot4: true },
  kasur: { n: 'Kasur', ic: '🛏️', cost: { kayu: 6, serat: 4 }, mode: 'cell', rot4: true },
  api: { n: 'Api Unggun', ic: '🔥', cost: { kayu: 3, batu: 2 }, mode: 'free' },
  obor: { n: 'Obor Pasang', ic: '🕯️', cost: { obor: 1 }, mode: 'free' },
  lampu: { n: 'Lampu', ic: '💡', cost: { papan: 2, besi: 1, batubara: 1 }, mode: 'free' },
  kompor: { n: 'Kompor', ic: '♨️', cost: { batu: 6, besi: 2, kayu: 3 }, mode: 'free', rot4: true },
  tungku: { n: 'Tungku', ic: '🏭', cost: { batu: 8, tanah: 3 }, mode: 'free', rot4: true },
  dermaga: { n: 'Dermaga', ic: '⚓', cost: { papan: 6, tali: 2 }, mode: 'cell', water: true },
  mesin: { n: 'Mesin Kapal', ic: '⚙️', cost: { besi: 8, batubara: 3, tali: 2 }, mode: 'free', rot4: true, floor: true },
  setir: { n: 'Setir Kapal', ic: '🎡', cost: { papan: 4, besi: 2, tali: 2 }, mode: 'free', rot4: true, floor: true },
  bongkar: { n: 'Bongkar', ic: '🔨', cost: {}, mode: 'del' },
};

export const EDGE_KINDS = ['dinding', 'batu', 'pintu'];

/* cahaya yang dipancarkan potongan: y = tinggi lokal, rng = jangkauan, i = kuat dasar */
export const PIECE_LIGHT = {
  api: { y: 1.0, c: 0xff9a3c, rng: 16, i: 1.6 },
  obor: { y: 1.5, c: 0xff9a3c, rng: 12, i: 1.1 },
  lampu: { y: 2.5, c: 0xffe0a0, rng: 20, i: 1.9 },
  tungku: { y: 0.6, c: 0xff6a20, rng: 7, i: 0.8 },
};

/* ====== material ====== */
const matCache = new Map();
export function pieceMat(tex, color) {
  const key = tex || color;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial(tex ? { map: T[tex], roughness: 0.95 } : { color, roughness: 0.9 }));
  }
  return matCache.get(key);
}
const metalCache = new Map();
const metal = (c) => {
  if (!metalCache.has(c)) metalCache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.5 }));
  return metalCache.get(c);
};
const glowCache = new Map();
const glow = (c, op) => {
  const key = c + '|' + (op || 1);
  if (!glowCache.has(key)) glowCache.set(key, new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op || 1 }));
  return glowCache.get(key);
};

/* ====== kotak-kotak (visual + tabrakan) untuk bangunan sederhana ====== */
export function pieceBoxes(k) {
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

/* kotak tabrakan pintu (tergantung terbuka/tertutup) */
export function doorCols(open) {
  const cols = [
    { c: [-0.925, 0.9, 0], s: [0.15, 3.0, 0.25] },
    { c: [0.925, 0.9, 0], s: [0.15, 3.0, 0.25] },
    { c: [0, 2.2, 0], s: [1.7, 0.4, 0.25] },
    { c: [0, -0.2, 0], s: [1.7, 0.6, 0.25] },
  ];
  if (!open) cols.push({ c: [0, 1.05, 0], s: [1.7, 1.9, 0.2] });
  return cols;
}

/* tabrakan bangunan khusus */
const CUSTOM_COLS = {
  dermaga: [{ c: [0, 0.05, 0], s: [2, 0.5, 2] }],
  lampu: [{ c: [0, 1.15, 0], s: [0.22, 2.4, 0.22] }],
  kompor: [{ c: [0, 0.4, 0], s: [1.0, 0.8, 0.8] }],
  tungku: [{ c: [0, 0.65, 0], s: [1.2, 1.3, 1.2] }],
  mesin: [{ c: [0, 0.5, 0], s: [0.9, 1.0, 1.1] }],
  setir: [{ c: [0, 0.55, 0], s: [0.5, 1.1, 0.4] }],
};

/* semua kotak tabrakan sebuah potongan: [{c,s}] dalam koordinat lokal */
export function pieceCols(k, open) {
  if (k === 'pintu') return doorCols(!!open);
  if (CUSTOM_COLS[k]) return CUSTOM_COLS[k];
  return pieceBoxes(k).filter((b) => !b.nc).map((b) => ({ c: b.c, s: b.s }));
}

/* ====== pembangun model ====== */
function put(g, mesh, x, y, z, solid) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const bb = mesh.geometry.boundingBox || (mesh.geometry.computeBoundingBox(), mesh.geometry.boundingBox);
  mesh.userData.ltop = y + bb.max.y * mesh.scale.y;
  if (solid === false) mesh.userData.nopick = true;
  g.add(mesh);
  return mesh;
}
const bxm = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const cym = (r1, r2, h, mat, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);

const CUSTOM = {
  pintu(g, ex) {
    const wood = pieceMat('wood');
    const dark = pieceMat(null, '#6b4a2b');
    put(g, bxm(0.15, 3.0, 0.25, wood), -0.925, 0.9, 0);
    put(g, bxm(0.15, 3.0, 0.25, wood), 0.925, 0.9, 0);
    put(g, bxm(1.7, 0.4, 0.25, wood), 0, 2.2, 0);
    put(g, bxm(1.7, 0.6, 0.25, wood), 0, -0.2, 0);
    const pivot = new THREE.Group();
    pivot.position.set(-0.85, 1.05, 0);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.9, 0.1), dark);
    leaf.position.set(0.85, 0, 0);
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    leaf.userData.ltop = 1.95;
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 0.13), wood);
    plank.position.set(0.85, 0, 0);
    plank.userData.ltop = 1.95;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), metal(0xd9b24a));
    knob.position.set(1.52, 0, 0.1);
    knob.userData.ltop = 1.1;
    pivot.add(leaf, plank, knob);
    g.add(pivot);
    ex.leaf = pivot;
  },

  obor(g, ex) {
    put(g, cym(0.05, 0.07, 1.1, pieceMat(null, '#6b4a2b'), 6), 0, 0.55, 0);
    put(g, bxm(0.13, 0.16, 0.13, pieceMat(null, '#2e2218')), 0, 1.14, 0, false);
    const flame = new THREE.Group();
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), glow(0xff7a1a, 0.92));
    f1.position.y = 0.17;
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), glow(0xffd36b));
    f2.position.y = 0.12;
    flame.add(f1, f2);
    flame.position.y = 1.2;
    g.add(flame);
    ex.flame = flame;
  },

  lampu(g, ex) {
    const steel = metal(0x4a4f55);
    put(g, cym(0.18, 0.22, 0.12, steel, 10), 0, 0.06, 0);
    put(g, cym(0.05, 0.065, 2.3, steel, 8), 0, 1.15, 0);
    put(g, bxm(0.42, 0.08, 0.42, steel), 0, 2.28, 0, false);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), glow(0xfff0b0));
    bulb.position.y = 2.5;
    bulb.userData.ltop = 2.7;
    g.add(bulb);
    put(g, cym(0.0, 0.3, 0.2, steel, 10), 0, 2.8, 0, false);
    ex.bulb = bulb;
  },

  kompor(g, ex) {
    put(g, bxm(1.0, 0.7, 0.8, metal(0x8a8f98)), 0, 0.35, 0);
    put(g, bxm(1.02, 0.06, 0.82, metal(0x2f3236)), 0, 0.73, 0);
    ex.flames = [];
    for (const sx of [-0.25, 0.25]) {
      put(g, cym(0.17, 0.17, 0.03, metal(0x15161a), 12), sx, 0.78, 0, false);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 6), glow(0x4aa8ff, 0.85));
      fl.position.set(sx, 0.88, 0);
      fl.visible = false;
      g.add(fl);
      ex.flames.push(fl);
    }
    for (const sx of [-0.25, 0.25]) put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8).rotateX(Math.PI / 2), metal(0xd0d0d0)), sx, 0.5, 0.42, false);
  },

  tungku(g, ex) {
    const st = pieceMat('stone');
    put(g, bxm(1.2, 1.3, 1.2, st), 0, 0.65, 0);
    put(g, bxm(0.35, 0.9, 0.35, st), 0.3, 1.7, -0.3, false);
    put(g, bxm(0.55, 0.5, 0.06, glow(0x110a06)), 0, 0.5, 0.61, false);
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.04), glow(0xff7a1a));
    fire.position.set(0, 0.45, 0.62);
    fire.userData.ltop = 0.6;
    g.add(fire);
    ex.fire = fire;
  },

  dermaga(g, ex) {
    const wood = pieceMat('wood');
    put(g, bxm(2.0, 0.2, 2.0, wood), 0, 0.2, 0);
    put(g, bxm(2.0, 0.14, 0.18, pieceMat(null, '#5a3a1c')), 0, 0.03, 0.8, false);
    put(g, bxm(2.0, 0.14, 0.18, pieceMat(null, '#5a3a1c')), 0, 0.03, -0.8, false);
    for (const sx of [-0.85, 0.85]) {
      for (const sz of [-0.85, 0.85]) put(g, cym(0.1, 0.12, 7.0, pieceMat(null, '#4a2f17'), 6), sx, -3.4, sz, false);
    }
  },

  mesin(g, ex) {
    put(g, bxm(0.9, 0.5, 1.1, metal(0x59606a)), 0, 0.35, 0);
    put(g, bxm(0.8, 0.28, 0.9, metal(0xc0392b)), 0, 0.74, 0);
    put(g, cym(0.07, 0.07, 0.7, metal(0x2a2c30), 8), -0.28, 1.0, -0.3, false);
    put(g, cym(0.07, 0.07, 0.5, metal(0x2a2c30), 8), 0.28, 0.95, 0.3, false);
    const fan = new THREE.Group();
    fan.position.set(0, 0.55, 0.57);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.02), metal(0xd8d8d8));
      b.rotation.z = (i * Math.PI) / 2;
      b.position.set(Math.sin((i * Math.PI) / 2) * -0.17, Math.cos((i * Math.PI) / 2) * 0.17, 0);
      fan.add(b);
    }
    g.add(fan);
    ex.prop = fan;
  },

  setir(g, ex) {
    const wood = pieceMat('wood');
    put(g, bxm(0.34, 0.9, 0.34, wood), 0, 0.45, 0);
    put(g, bxm(0.5, 0.2, 0.36, pieceMat(null, '#5a3a1c')), 0, 0.95, 0);
    const wheel = new THREE.Group();
    wheel.position.set(0, 1.12, 0.22);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.035, 6, 16), pieceMat(null, '#7a5230'));
    wheel.add(ring);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.56, 0.03), pieceMat(null, '#7a5230'));
      sp.rotation.z = (i * Math.PI) / 4;
      wheel.add(sp);
    }
    wheel.userData.ltop = 1.4;
    g.add(wheel);
    ex.wheel = wheel;
  },
};

/* buat grup model sebuah potongan. ex = bagian animasi (api, daun pintu, baling-baling, ...) */
export function createPiece(k) {
  const g = new THREE.Group();
  const ex = {};
  if (CUSTOM[k]) CUSTOM[k](g, ex);
  else {
    for (const b of pieceBoxes(k)) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.s[0], b.s[1], b.s[2]), pieceMat(b.tex, b.color));
      m.position.set(b.c[0], b.c[1], b.c[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.ltop = b.c[1] + b.s[1] / 2;
      g.add(m);
    }
  }
  return { group: g, ex };
}

/* api unggun (dipakai Game & pembuat ghost) */
export function makeFire() {
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

/* model transparan untuk pratinjau penempatan */
export function makeGhostModel(k, mat) {
  const g = new THREE.Group();
  if (k === 'api') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 8), mat);
    m.position.y = 0.4;
    g.add(m);
    return g;
  }
  const { group } = createPiece(k);
  group.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = false; o.receiveShadow = false; } });
  g.add(group);
  if (k === 'setir') {
    /* panah arah haluan kapal (ke depan = -z) */
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.7, 4), mat);
    a.rotation.x = -Math.PI / 2;
    a.position.set(0, 0.2, -1.2);
    g.add(a);
  }
  return g;
}
