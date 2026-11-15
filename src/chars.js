import * as THREE from 'three';

export const SKINS = [
  { id: 0, name: 'Santay', skin: '#e8b48a', shirt: '#2e8b57', pants: '#5b3a1e', hair: '#1b1b1b', hat: '#c9a227' },
  { id: 1, name: 'Penjelajah', skin: '#c68642', shirt: '#c0562b', pants: '#2b3a55', hair: '#3b2412', hat: null },
  { id: 2, name: 'Nelayan', skin: '#f1c9a5', shirt: '#2a6fb0', pants: '#d9c9a0', hair: '#8a5a2b', hat: '#f2d36b' },
  { id: 3, name: 'Ranger', skin: '#8d5524', shirt: '#556b2f', pants: '#3d3d3d', hair: '#111111', hat: '#3c4a22' },
  { id: 4, name: 'Pendaki', skin: '#ffdbac', shirt: '#b3262e', pants: '#222a44', hair: '#e0b050', hat: '#222222' },
  { id: 5, name: 'Nomaden', skin: '#a86b3c', shirt: '#e0c27a', pants: '#7a4f2a', hair: '#0f0f0f', hat: '#8a3b2a' },
];

const mc = new Map();
const M = (c) => {
  if (!mc.has(c)) mc.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  return mc.get(c);
};
const bx = (w, h, d, c, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

export function buildChar(d) {
  const g = new THREE.Group();
  g.add(bx(0.46, 0.46, 0.46, d.skin, 0, 1.63, 0));
  g.add(bx(0.5, 0.14, 0.5, d.hair, 0, 1.9, 0));
  g.add(bx(0.5, 0.3, 0.12, d.hair, 0, 1.74, -0.2));
  g.add(bx(0.07, 0.07, 0.03, '#1a1a1a', -0.11, 1.66, 0.235));
  g.add(bx(0.07, 0.07, 0.03, '#1a1a1a', 0.11, 1.66, 0.235));
  g.add(bx(0.12, 0.03, 0.03, '#a3563a', 0, 1.52, 0.235));
  if (d.hat) {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16), M(d.hat));
    brim.position.set(0, 1.96, 0);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.2, 16), M(d.hat));
    crown.position.set(0, 2.06, 0);
    g.add(brim, crown);
  }
  g.add(bx(0.54, 0.72, 0.3, d.shirt, 0, 1.04, 0));
  const mkArm = (s) => {
    const a = new THREE.Group();
    a.position.set(0.37 * s, 1.36, 0);
    a.add(bx(0.17, 0.3, 0.17, d.shirt, 0, -0.15, 0));
    a.add(bx(0.15, 0.36, 0.15, d.skin, 0, -0.48, 0));
    g.add(a);
    return a;
  };
  const mkLeg = (s) => {
    const l = new THREE.Group();
    l.position.set(0.14 * s, 0.68, 0);
    l.add(bx(0.22, 0.68, 0.22, d.pants, 0, -0.34, 0));
    g.add(l);
    return l;
  };
  g.userData = { armL: mkArm(-1), armR: mkArm(1), legL: mkLeg(-1), legR: mkLeg(1) };
  return g;
}

export function drawPreview(cv, d) {
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  const s = h / 100;
  const cx = w / 2;
  const r = (c, x, y, ww, hh) => {
    g.fillStyle = c;
    g.fillRect(cx + x * s, y * s, ww * s, hh * s);
  };
  r(d.pants, -14, 62, 12, 34);
  r(d.pants, 2, 62, 12, 34);
  r(d.shirt, -18, 30, 36, 36);
  r(d.shirt, -27, 32, 9, 20);
  r(d.shirt, 18, 32, 9, 20);
  r(d.skin, -27, 50, 9, 14);
  r(d.skin, 18, 50, 9, 14);
  r(d.skin, -12, 8, 24, 24);
  r(d.hair, -12, 5, 24, 8);
  if (d.hat) r(d.hat, -17, 3, 34, 5);
  r('#111', -7, 18, 4, 4);
  r('#111', 3, 18, 4, 4);
}
