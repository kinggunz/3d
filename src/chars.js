import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ===== karakter bawaan ===== */
export const SKINS = [
  { id: 0, name: 'Santay', skin: '#e8b48a', shirt: '#2e8b57', pants: '#5b3a1e', hair: '#1b1b1b', hat: '#c9a227' },
  { id: 1, name: 'Penjelajah', skin: '#c68642', shirt: '#c0562b', pants: '#2b3a55', hair: '#3b2412', hat: null },
  { id: 2, name: 'Nelayan', skin: '#f1c9a5', shirt: '#2a6fb0', pants: '#d9c9a0', hair: '#8a5a2b', hat: '#f2d36b' },
  { id: 3, name: 'Ranger', skin: '#8d5524', shirt: '#556b2f', pants: '#3d3d3d', hair: '#111111', hat: '#3c4a22' },
  { id: 4, name: 'Pendaki', skin: '#ffdbac', shirt: '#b3262e', pants: '#222a44', hair: '#e0b050', hat: '#222222' },
  { id: 5, name: 'Nomaden', skin: '#a86b3c', shirt: '#e0c27a', pants: '#7a4f2a', hair: '#0f0f0f', hat: '#8a3b2a' },
];

/* ===== data tampilan lengkap (bisa diedit di Editor Karakter) ===== */
export const LOOK_DEFAULT = {
  skin: '#e8b48a', hair: '#1b1b1b', hairStyle: 0,
  eye: '#111111', eyeStyle: 0, mouth: 0,
  shirt: '#2e8b57', shirt2: '#f4f1e6', shirtStyle: 0,
  pants: '#5b3a1e', pantsStyle: 0, shoes: '#2a2018',
  hat: null, hatStyle: 0,
  glasses: 0, glassCol: '#222222',
  scarf: null, pack: null, cape: null,
  h: 1, w: 1, head: 1, sk: null,
};

export const OPTS = {
  hairStyle: ['Pendek', 'Botak', 'Panjang', 'Mohawk', 'Jabrik', 'Kuncir'],
  eyeStyle: ['Titik', 'Besar', 'Ngantuk'],
  mouth: ['Datar', 'Senyum', 'Terbuka'],
  shirtStyle: ['Polos', 'Garis', 'Dua Warna'],
  pantsStyle: ['Panjang', 'Pendek'],
  hatStyle: ['Tanpa', 'Bulat', 'Kupluk', 'Koboi', 'Mahkota', 'Helm'],
  glasses: ['Tanpa', 'Bulat', 'Hitam'],
};

/* ubah karakter bawaan / data lama jadi format lengkap */
export function lookFromSkin(d) {
  const o = Object.assign({}, LOOK_DEFAULT);
  if (!d) return o;
  for (const k of Object.keys(LOOK_DEFAULT)) if (d[k] !== undefined) o[k] = d[k];
  if (d.hat && d.hatStyle === undefined) o.hatStyle = 1;
  if (!d.hat && d.hatStyle === undefined) o.hatStyle = 0;
  if (o.hatStyle && !o.hat) o.hat = '#c9a227';
  return o;
}

export function normLook(d) {
  const o = lookFromSkin(d);
  const num = (v, a, b, def) => (typeof v === 'number' && isFinite(v) ? Math.max(a, Math.min(b, v)) : def);
  o.hairStyle = num(o.hairStyle | 0, 0, 5, 0);
  o.eyeStyle = num(o.eyeStyle | 0, 0, 2, 0);
  o.mouth = num(o.mouth | 0, 0, 2, 0);
  o.shirtStyle = num(o.shirtStyle | 0, 0, 2, 0);
  o.pantsStyle = num(o.pantsStyle | 0, 0, 1, 0);
  o.hatStyle = num(o.hatStyle | 0, 0, 5, 0);
  o.glasses = num(o.glasses | 0, 0, 2, 0);
  o.sk = typeof o.sk === 'string' && o.sk.startsWith('data:image/png;base64,') && o.sk.length < 16000 ? o.sk : null;
  o.h = num(+o.h, 0.8, 1.2, 1);
  o.w = num(+o.w, 0.8, 1.25, 1);
  o.head = num(+o.head, 0.85, 1.3, 1);
  return o;
}

/* jaringan: bentuk ringkas (string) */
export function packLook(d) { return JSON.stringify(normLook(d)); }
export function unpackLook(s) {
  try { const o = JSON.parse(s); return o && typeof o === 'object' ? normLook(o) : null; } catch (e) { return null; }
}

/* ===== pembuat model ===== */
const mc = new Map();
const M = (c) => {
  if (!mc.has(c)) { const col = new THREE.Color(c), hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, hsl.s * 0.78, hsl.l * 0.94); mc.set(c, new THREE.MeshStandardMaterial({ color: col, roughness: 0.78 })); }
  return mc.get(c);
};
const geoCache = new Map();
const boxGeo = (w, h, d) => {
  const k = w + ',' + h + ',' + d;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
};
const bx = (w, h, d, c, x, y, z) => {
  const m = new THREE.Mesh(boxGeo(w, h, d), M(c));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};
const UP = 0.68; /* tinggi pinggul: badan atas berputar di sini */
const HEADY = 1.4; /* leher */


/* ===== bantuan bentuk halus ===== */
const gc = new Map();
const cached = (k, f) => { if (!gc.has(k)) gc.set(k, f()); return gc.get(k); };
const sphGeo = (r) => cached('s' + r, () => new THREE.SphereGeometry(r, 16, 12));
const capGeo = (r, len) => cached('c' + r + ',' + len, () => new THREE.CapsuleGeometry(r, len, 4, 10));
const rbxGeo = (w, h, dd, r) => cached('r' + [w, h, dd, r], () => new RoundedBoxGeometry(w, h, dd, 3, r));
const coneGeo = new THREE.ConeGeometry(0.05, 0.16, 6);
const sph = (rx, ry, rz, c, dome) => {
  const g = dome ? cached('dome', () => new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62)) : cached('unit', () => new THREE.SphereGeometry(1, 16, 12));
  const m = new THREE.Mesh(g, M(c)); m.scale.set(rx, ry, rz); return m;
};
const rbx = (w, h, dd, r, c) => new THREE.Mesh(rbxGeo(w, h, dd, r), M(c));
const cyl2 = (rt, rb, h, c) => new THREE.Mesh(cached('y' + [rt, rb, h], () => new THREE.CylinderGeometry(rt, rb, h, 12)), M(c));
const cap2 = (r, len, c) => new THREE.Mesh(capGeo(r, len), M(c));
const ubx = (m, x, y, z) => { m.position.set(x, y - UP, z); m.castShadow = true; return m; };

export function buildChar(src) {
  const d = normLook(src);
  const g = new THREE.Group(); /* dipakai pemanggil (posisi/rotasi/skala) */
  const rig = new THREE.Group(); /* skala tinggi/lebar + animasi seluruh badan */
  rig.scale.set(d.w, d.h, d.w);
  g.add(rig);
  const up = new THREE.Group(); /* badan atas */
  up.position.y = UP;
  rig.add(up);
  const ub = (w, h, dd, c, x, y, z) => bx(w, h, dd, c, x, y - UP, z);

  /* kepala (proporsi realistis) */
  const head = new THREE.Group();
  head.position.set(0, HEADY - UP, 0);
  head.scale.setScalar(d.head);
  up.add(head);
  const hp = (m, x, y, z) => { m.position.set(x, y - HEADY, z); m.castShadow = true; head.add(m); return m; };
  const hb = (w, h, dd, c, x, y, z) => bx(w, h, dd, c, x, y - HEADY, z);
  /* leher */
  hp(cyl2(0.075, 0.085, 0.16, d.skin), 0, 1.42, 0);
  /* tengkorak + rahang */
  hp(sph(0.225, 0.27, 0.245, d.skin), 0, 1.66, 0);
  hp(sph(0.19, 0.17, 0.2, d.skin), 0, 1.55, 0.02);
  hp(sph(0.03, 0.05, 0.035, d.skin), 0, 1.62, 0.235); /* hidung */
  for (const sx of [-1, 1]) hp(sph(0.03, 0.06, 0.045, d.skin), 0.225 * sx, 1.64, 0); /* telinga */
  /* rambut */
  const hs = d.hairStyle;
  if (hs !== 1) {
    const cap = hp(sph(0.24, 0.28, 0.265, d.hair, true), 0, 1.68, -0.01);
    cap.rotation.x = -0.12;
    hp(sph(0.238, 0.13, 0.1, d.hair), 0, 1.84, 0.17); /* poni */
    if (hs === 0 || hs === 5 || hs === 4) hp(sph(0.23, 0.2, 0.1, d.hair), 0, 1.7, -0.2);
    if (hs === 2) {
      hp(rbx(0.5, 0.62, 0.12, 0.05, d.hair), 0, 1.5, -0.2);
      for (const sx of [-1, 1]) hp(rbx(0.07, 0.4, 0.34, 0.03, d.hair), 0.235 * sx, 1.62, -0.02);
    }
    if (hs === 3) { for (let i = 0; i < 4; i++) hp(rbx(0.06, 0.12, 0.16, 0.02, d.hair), 0, 1.94 + (i % 2) * 0.01, -0.14 + i * 0.1); }
    if (hs === 4) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const s = hp(new THREE.Mesh(coneGeo, M(d.hair)), Math.cos(a) * 0.15, 1.96, Math.sin(a) * 0.15);
        s.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
    }
    if (hs === 5) {
      const t = hp(cap2(0.045, 0.3, d.hair), 0, 1.58, -0.3);
      t.rotation.x = 0.35;
      hp(sph(0.06, 0.06, 0.06, d.hair), 0, 1.78, -0.26);
    }
  }
  /* alis + mata */
  const es = d.eyeStyle;
  for (const sx of [-1, 1]) {
    hp(rbx(0.1, 0.02, 0.03, 0.01, d.hair), 0.095 * sx, 1.74, 0.215);
    if (es === 0) { hp(sph(0.027, 0.022, 0.015, '#ffffff'), 0.095 * sx, 1.675, 0.222); hp(sph(0.016, 0.016, 0.012, d.eye), 0.095 * sx, 1.675, 0.232); }
    else if (es === 1) { hp(sph(0.04, 0.034, 0.017, '#ffffff'), 0.095 * sx, 1.675, 0.222); hp(sph(0.022, 0.026, 0.014, d.eye), 0.095 * sx, 1.675, 0.234); }
    else { hp(sph(0.035, 0.016, 0.015, '#ffffff'), 0.095 * sx, 1.67, 0.222); hp(sph(0.02, 0.012, 0.012, d.eye), 0.095 * sx, 1.668, 0.232); hp(rbx(0.08, 0.012, 0.02, 0.005, d.skin), 0.095 * sx, 1.69, 0.232); }
  }
  /* mulut */
  if (d.mouth === 0) hp(rbx(0.09, 0.012, 0.02, 0.005, '#9a5a4a'), 0, 1.5, 0.215);
  else if (d.mouth === 1) {
    hp(rbx(0.09, 0.014, 0.02, 0.006, '#9a5a4a'), 0, 1.495, 0.213);
    for (const sx of [-1, 1]) hp(rbx(0.02, 0.016, 0.02, 0.006, '#9a5a4a'), 0.05 * sx, 1.503, 0.21);
  } else hp(sph(0.04, 0.025, 0.016, '#4a1a14'), 0, 1.495, 0.216);
  /* kacamata */
  if (d.glasses === 1) {
    for (const sx of [-1, 1]) {
      hp(rbx(0.14, 0.11, 0.015, 0.04, d.glassCol), 0.095 * sx, 1.675, 0.245);
      hp(rbx(0.11, 0.08, 0.018, 0.03, '#bfe3ff'), 0.095 * sx, 1.675, 0.248);
    }
    hp(rbx(0.05, 0.015, 0.015, 0.005, d.glassCol), 0, 1.68, 0.245);
  } else if (d.glasses === 2) hp(rbx(0.42, 0.08, 0.02, 0.025, d.glassCol), 0, 1.675, 0.248);
  /* topi */
  const ht = d.hatStyle, hc = d.hat || '#c9a227';
  const cyl = (rt, rb, h, c, y) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 16), M(c));
    m.position.set(0, y - HEADY, 0);
    m.castShadow = true;
    return m;
  };
  if (ht === 1) head.add(cyl(0.42, 0.42, 0.04, hc, 1.96), cyl(0.27, 0.3, 0.2, hc, 2.06));
  else if (ht === 2) {
    head.add(hb(0.54, 0.22, 0.54, hc, 0, 1.97, 0), hb(0.56, 0.07, 0.56, '#f4f1e6', 0, 1.88, 0));
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), M('#f4f1e6'));
    pom.position.set(0, 2.14 - HEADY, 0);
    head.add(pom);
  } else if (ht === 3) head.add(cyl(0.62, 0.62, 0.04, hc, 1.95), cyl(0.24, 0.3, 0.26, hc, 2.07), cyl(0.31, 0.31, 0.05, '#3a2a1a', 2.0));
  else if (ht === 4) {
    head.add(cyl(0.27, 0.27, 0.12, '#f2c230', 1.98));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 4), M('#f2c230'));
      sp.position.set(Math.cos(a) * 0.24, 2.14 - HEADY, Math.sin(a) * 0.24);
      head.add(sp);
    }
  } else if (ht === 5) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(hc));
    dome.position.set(0, 1.84 - HEADY, 0);
    dome.castShadow = true;
    head.add(dome, hb(0.5, 0.05, 0.12, hc, 0, 1.86, 0.3));
  }

  /* badan */
  up.add(ubx(rbx(0.5, 0.66, 0.27, 0.09, d.shirt), 0, 1.03, 0));
  up.add(ubx(rbx(0.46, 0.24, 0.25, 0.08, d.pants), 0, 0.72, 0));
  if (d.shirtStyle === 1) for (let i = 0; i < 3; i++) up.add(ubx(rbx(0.505, 0.07, 0.275, 0.03, d.shirt2), 0, 0.84 + i * 0.18, 0));
  if (d.shirtStyle === 2) up.add(ubx(rbx(0.505, 0.3, 0.275, 0.07, d.shirt2), 0, 0.9, 0));
  up.add(ubx(rbx(0.5, 0.04, 0.275, 0.015, '#2a2420'), 0, 0.78, 0)); /* ikat pinggang */
  up.add(ubx(sph(0.11, 0.05, 0.1, d.shirt), 0, 1.4, 0.01));
  if (d.scarf) {
    up.add(ubx(rbx(0.34, 0.1, 0.3, 0.05, d.scarf), 0, 1.4, 0));
    up.add(ubx(rbx(0.1, 0.34, 0.04, 0.02, d.scarf), 0.12, 1.2, 0.15));
  }
  if (d.pack) up.add(ubx(rbx(0.4, 0.5, 0.18, 0.06, d.pack), 0, 1.08, -0.22), ubx(rbx(0.28, 0.14, 0.05, 0.02, '#2a1c10'), 0, 1.2, -0.32));
  let cape = null;
  if (d.cape) {
    cape = new THREE.Group();
    cape.position.set(0, 1.36 - UP, -0.17);
    cape.add(bx(0.56, 0.95, 0.04, d.cape, 0, -0.47, -0.02));
    up.add(cape);
  }
  const mkArm = (s) => {
    const a = new THREE.Group();
    a.position.set(0.33 * s, 1.34 - UP, 0);
    const add = (m, y) => { m.position.y = y; m.castShadow = true; a.add(m); };
    add(new THREE.Mesh(sphGeo(0.085), M(d.shirt)), 0);
    add(new THREE.Mesh(capGeo(0.075, 0.2), M(d.shirt)), -0.16);
    add(new THREE.Mesh(capGeo(0.062, 0.24), M(d.skin)), -0.4);
    add(new THREE.Mesh(sphGeo(0.07), M(d.skin)), -0.58);
    up.add(a);
    return a;
  };
  const mkLeg = (s) => {
    const l = new THREE.Group();
    l.position.set(0.12 * s, UP, 0);
    const kn = new THREE.Group(); /* sendi lutut */
    kn.position.y = -0.34;
    l.add(kn);
    const addT = (m, y, z = 0) => { m.position.set(0, y, z); m.castShadow = true; l.add(m); };
    const addK = (m, y, z = 0) => { m.position.set(0, y, z); m.castShadow = true; kn.add(m); return m; };
    if (d.pantsStyle === 1) {
      addT(new THREE.Mesh(capGeo(0.105, 0.2), M(d.pants)), -0.16);
      addK(new THREE.Mesh(capGeo(0.075, 0.2), M(d.skin)), -0.15);
    } else {
      addT(new THREE.Mesh(capGeo(0.105, 0.2), M(d.pants)), -0.17);
      addK(new THREE.Mesh(capGeo(0.085, 0.2), M(d.pants)), -0.15);
    }
    const shoe = addK(new THREE.Mesh(rbxGeo(0.17, 0.1, 0.3, 0.04), M(d.shoes)), -0.29, 0.04);
    rig.add(l);
    l.userData.knee = kn;
    l.userData.shoe = shoe;
    return l;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  g.userData = { rig, up, head, cape, armL: mkArm(-1), armR: mkArm(1), legL, legR, kneeL: legL.userData.knee, kneeR: legR.userData.knee, shoeL: legL.userData.shoe, shoeR: legR.userData.shoe, top: 2.45 * d.h, skinned: false };
  if (d.sk) applySkin(g, d.sk);
  return g;
}


/* ===== skin PNG (format skin Minecraft 64x64 / 64x32) ===== */
const skinMats = new Map();
function skinMat(url) {
  if (!skinMats.has(url)) {
    const t = new THREE.TextureLoader().load(url);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    skinMats.set(url, new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, transparent: true, alphaTest: 0.5 }));
  }
  return skinMats.get(url);
}
function pngHeight(url) {
  try { const b = atob(url.slice(url.indexOf(',') + 1, url.indexOf(',') + 41)); return (b.charCodeAt(20) << 24) | (b.charCodeAt(21) << 16) | (b.charCodeAt(22) << 8) | b.charCodeAt(23); } catch (e) { return 64; }
}
function mcBox(W, H, D, u, v, TH, mat, k, cut) {
  /* cut = [barisMulai, tinggiBaris]: pakai sebagian tinggi kotak (paha / betis) */
  const g = new THREE.BoxGeometry(W * k, (cut ? cut[1] : H) * k, D * k);
  /* urutan sisi three: +x(kiri MC), -x(kanan MC), atas, bawah, depan(+z), belakang */
  const R = [[u + D + W, v + D, D, H], [u, v + D, D, H], [u + D, v, W, D], [u + D + W, v, W, D], [u + D, v + D, W, H], [u + 2 * D + W, v + D, W, H]];
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [rx, , rw] = R[f];
    let ry = R[f][1], rh = R[f][3];
    if (cut && f !== 2 && f !== 3) { ry += cut[0]; rh = cut[1]; }
    for (let i = 0; i < 4; i++) {
      const n = f * 4 + i;
      uv.setXY(n, (rx + rw * uv.getX(n)) / 64, 1 - (ry + rh * (1 - uv.getY(n))) / TH);
    }
  }
  return new THREE.Mesh(g, mat);
}
function applySkin(g, url) {
  g.userData.skinned = true;
  const TH = pngHeight(url) >= 64 ? 64 : 32;
  const mat = skinMat(url);
  const ud = g.userData;
  const keep = new Set();
  if (ud.cape) ud.cape.traverse((o) => keep.add(o));
  g.traverse((o) => { if (o.isMesh && !keep.has(o)) o.visible = false; });
  const k = 0.058;
  const head = mcBox(8, 8, 8, 0, 0, TH, mat, k); head.position.set(0, 0.23, 0); ud.head.add(head);
  const body = mcBox(8, 12, 4, 16, 16, TH, mat, k); body.position.set(0, 0.35, 0); ud.up.add(body);
  const arm = (grp, u, v) => { const m = mcBox(4, 12, 4, u, v, TH, mat, k); m.position.set(0, -0.35, 0); grp.add(m); };
  arm(ud.armL, 40, 16); arm(ud.armR, TH === 64 ? 32 : 40, TH === 64 ? 48 : 16);
  /* kaki dibelah dua (paha + betis) supaya lutut bisa menekuk saat jongkok */
  const leg = (grp, knee, u, v) => {
    const a = mcBox(4, 12, 4, u, v, TH, mat, k, [0, 6]); a.position.set(0, -0.17, 0); grp.add(a);
    const b = mcBox(4, 12, 4, u, v, TH, mat, k, [6, 6]); b.position.set(0, -0.17, 0); knee.add(b);
  };
  leg(ud.legL, ud.kneeL, 0, 16); leg(ud.legR, ud.kneeR, TH === 64 ? 16 : 0, TH === 64 ? 48 : 16);
  if (TH === 64) {
    const o = k * 1.13;
    const ov = (grp, W, H, D, u, v, y) => { const m = mcBox(W, H, D, u, v, TH, mat, o); m.position.set(0, y, 0); grp.add(m); };
    ov(ud.head, 8, 8, 8, 32, 0, 0.23); ov(ud.up, 8, 12, 4, 16, 32, 0.35);
    ov(ud.armL, 4, 12, 4, 40, 32, -0.35); ov(ud.armR, 4, 12, 4, 48, 48, -0.35);
    const ovl = (grp, knee, u, v) => {
      const a = mcBox(4, 12, 4, u, v, TH, mat, o, [0, 6]); a.position.set(0, -0.17, 0); grp.add(a);
      const b = mcBox(4, 12, 4, u, v, TH, mat, o, [6, 6]); b.position.set(0, -0.17, 0); knee.add(b);
    };
    ovl(ud.legL, ud.kneeL, 0, 32); ovl(ud.legR, ud.kneeR, 0, 48);
  }
}

/* ===== pose / emote ===== */
const E = [
  /* halaman 1: gerakan */
  ['wave', 'Lambai', 'e_wave', 3.2, 0],
  ['dance', 'Joget', 'e_dance', 6, 0],
  ['clap', 'Tepuk', 'e_clap', 3.2, 0],
  ['bow', 'Hormat', 'e_bow', 2.4, 0],
  ['cheer', 'Hore', 'e_cheer', 3, 0],
  ['point', 'Tunjuk', 'e_point', 3, 0],
  ['sit', 'Duduk', 'e_sit', 0, 1],
  ['spin', 'Putar', 'e_spin', 2.2, 0],
  ['sleep', 'Tidur', 'e_sleep', 0, 1],
  ['kick', 'Tendang', 'e_kick', 3, 0],
  /* halaman 2: ekspresi */
  ['heart', 'Cinta', 'heart', 3.2, 0],
  ['laugh', 'Ngakak', 'e_laugh', 3, 0],
  ['angry', 'Marah', 'e_angry', 3, 0],
  ['cry', 'Nangis', 'e_cry', 3.4, 0],
  ['think', 'Bingung', 'e_q', 3.2, 0],
  ['shock', 'Kaget', 'e_ex', 2.2, 0],
  ['cool', 'Keren', 'e_star', 3.2, 0],
  ['thumb', 'Jempol', 'e_thumb', 3, 0],
  ['tired', 'Capek', 'e_sweat', 3.6, 0],
  ['music', 'Nyanyi', 'e_music', 4, 0],
];
export const EMOTES = E.map(([id, name, icon, dur, hold], i) => ({ id, name, icon, dur, hold: !!hold, i, page: i < 10 ? 0 : 1 }));
export const EMOTE_BY_ID = Object.fromEntries(EMOTES.map((e) => [e.id, e]));

export function resetPose(g) {
  const u = g.userData;
  if (!u || !u.rig) return;
  u.rig.position.set(0, 0, 0);
  u.rig.rotation.set(0, 0, 0);
  u.up.rotation.set(0, 0, 0);
  u.head.rotation.set(0, 0, 0);
  for (const k of ['armL', 'armR', 'legL', 'legR', 'kneeL', 'kneeR', 'shoeL', 'shoeR']) if (u[k]) u[k].rotation.set(0, 0, 0);
}

const S = Math.sin, A = Math.abs;
/* t = detik sejak emote dimulai. Mengembalikan false bila sudah selesai. */
export function applyEmote(g, id, t) {
  const u = g.userData;
  if (!u || !u.rig) return true;
  const def = EMOTE_BY_ID[id];
  if (!def) return false;
  if (!def.hold && t > def.dur) return false;
  resetPose(g);
  const { rig, up, head, armL, armR, legL, legR } = u;
  const fin = Math.min(1, t * 5); /* masuk halus */
  switch (id) {
    case 'wave': armR.rotation.z = (2.7 + S(t * 9) * 0.35) * fin; armL.rotation.z = -0.1; head.rotation.z = 0.08 * S(t * 3); break;
    case 'dance':
      rig.position.y = A(S(t * 6)) * 0.12; up.rotation.y = S(t * 3) * 0.5; up.rotation.z = S(t * 6) * 0.08;
      armL.rotation.z = -(1.6 + S(t * 6) * 0.9); armR.rotation.z = 1.6 + S(t * 6 + Math.PI) * 0.9;
      legL.rotation.x = S(t * 6) * 0.5; legR.rotation.x = -S(t * 6) * 0.5; break;
    case 'clap': {
      const c = 0.5 + 0.5 * S(t * 14);
      armL.rotation.x = armR.rotation.x = -1.3; armL.rotation.z = 0.45 * c; armR.rotation.z = -0.45 * c; break;
    }
    case 'bow': up.rotation.x = 1.05 * S(Math.PI * Math.min(1, t / def.dur)); head.rotation.x = 0.2 * S(Math.PI * Math.min(1, t / def.dur)); break;
    case 'cheer':
      rig.position.y = A(S(t * 7)) * 0.28; armL.rotation.z = -2.8; armR.rotation.z = 2.8; legL.rotation.z = -0.12; legR.rotation.z = 0.12; break;
    case 'point': armR.rotation.x = -1.55 * fin; armR.rotation.z = 0.1; up.rotation.y = -0.2 * fin; head.rotation.y = -0.2 * fin; break;
    case 'sit':
      rig.position.y = -0.36 * fin; legL.rotation.x = legR.rotation.x = -1.5 * fin; armL.rotation.x = armR.rotation.x = -0.35 * fin; break;
    case 'spin':
      rig.rotation.y = t * 7.5; armL.rotation.z = -1.45; armR.rotation.z = 1.45; rig.position.y = A(S(t * 5)) * 0.1; break;
    case 'sleep':
      rig.rotation.x = -Math.PI / 2 * fin; rig.position.y = 0.22 * fin; armL.rotation.z = -0.1; armR.rotation.z = 0.1; break;
    case 'kick': {
      const k = Math.max(0, S(t * 6));
      legR.rotation.x = -1.25 * k; armL.rotation.x = -0.6 * k; armR.rotation.x = 0.6 * k; up.rotation.x = -0.12 * k; break;
    }
    case 'heart':
      armL.rotation.x = armR.rotation.x = -0.95; armL.rotation.z = 0.5; armR.rotation.z = -0.5; rig.position.y = 0.03 + 0.03 * S(t * 6); head.rotation.z = 0.15 * S(t * 3); break;
    case 'laugh':
      up.rotation.x = -0.18 + S(t * 22) * 0.07; rig.position.y = A(S(t * 11)) * 0.06; armL.rotation.x = armR.rotation.x = -0.5; armL.rotation.z = 0.3; armR.rotation.z = -0.3; head.rotation.x = -0.25; break;
    case 'angry':
      rig.position.y = A(S(t * 8)) * 0.06; armL.rotation.x = armR.rotation.x = -0.6 + S(t * 16) * 0.15; armL.rotation.z = 0.2; armR.rotation.z = -0.2; head.rotation.x = 0.2; legL.rotation.x = S(t * 8) * 0.4; legR.rotation.x = -S(t * 8) * 0.4; break;
    case 'cry':
      head.rotation.x = 0.45; up.rotation.x = 0.15; armL.rotation.x = armR.rotation.x = -2.35; armL.rotation.z = 0.35; armR.rotation.z = -0.35; up.rotation.z = S(t * 14) * 0.03; break;
    case 'think':
      armR.rotation.x = -2.1; armR.rotation.z = -0.35; head.rotation.z = 0.3 * fin; head.rotation.y = 0.2 * S(t * 2); break;
    case 'shock': {
      const j = Math.max(0, 1 - t * 2.2);
      rig.position.y = 0.3 * j * j; armL.rotation.z = -1.9; armR.rotation.z = 1.9; up.rotation.x = -0.15; break;
    }
    case 'cool':
      armL.rotation.z = -0.65; armL.rotation.x = -0.3; armR.rotation.z = 2.5 + S(t * 3) * 0.1; head.rotation.z = -0.1; up.rotation.z = 0.06; break;
    case 'thumb': armR.rotation.x = -1.35 * fin; armR.rotation.z = -0.1; armL.rotation.z = -0.1; rig.position.y = A(S(t * 5)) * 0.04; break;
    case 'tired':
      up.rotation.x = 0.55 + S(t * 3) * 0.05; head.rotation.x = 0.2; armL.rotation.x = armR.rotation.x = 0.15; armL.rotation.z = -0.1; armR.rotation.z = 0.1; legL.rotation.x = legR.rotation.x = -0.1; break;
    case 'music':
      up.rotation.z = S(t * 3.2) * 0.12; head.rotation.z = -S(t * 3.2) * 0.12; armR.rotation.x = -1.4; armR.rotation.z = -0.3; armL.rotation.z = -0.2; rig.position.y = A(S(t * 3.2)) * 0.05; break;
    default: break;
  }
  return true;
}


/* ===================================================================
   ANIMASI KARAKTER: diam, jalan, lari, jongkok (badan benar-benar turun
   dan lutut menekuk, tidak mengecil), lompat, mendarat, renang, serang
   (beda tiap alat), mati, duduk, panik.
   =================================================================== */
const c01 = (x) => Math.max(0, Math.min(1, x));
const mix = (a, b, k) => a + (b - a) * k;
const smooth01 = (x) => { x = c01(x); return x * x * (3 - 2 * x); };

/* jenis gerakan serang menurut alat yang dipegang */
export function attackKind(eq) {
  switch (eq) {
    case 'kapak': case 'kapakbesi': case 'beliung': case 'beliungbesi': return 'chop';
    case 'pedang': case 'pedangbesi': return 'slash';
    case 'tombak': return 'thrust';
    case 'sekop': return 'dig';
    case 'pancing': return 'cast';
    case 'ember': return 'scoop';
    default: return 'punch';
  }
}

/* S = { t (fase jalan), time (detik), mv 0..1, run, crouch 0..1, land 0..1, inAir, vy, swim,
         atk:{k,p}, dead (detik sejak mati, -1 = hidup), sit, panic 0..1, brace }  */
export function poseChar(g, S, dt) {
  const u = g.userData;
  if (!u || !u.rig) return;
  const cur = u.pc || (u.pc = {});
  const T = {
    rigY: 0, rigZ: 0, rigRX: 0, rigRZ: 0, upRX: 0, upRY: 0, upRZ: 0, headRX: 0, headRY: 0, headRZ: 0,
    aLX: 0, aLZ: -0.06, aRX: 0, aRZ: 0.06, lLX: 0, lLK: 0, lRX: 0, lRK: 0, sL: 0, sR: 0,
  };
  const t = S.t || 0, time = S.time || 0;
  const mv = c01(S.mv || 0), run = S.run ? 1 : 0;
  const crouch = c01(Math.max(S.crouch || 0, (S.land || 0) * 0.8));
  const s = Math.sin(t), co = Math.cos(t);
  let rate = 16;

  /* --- napas saat diam --- */
  const br = Math.sin(time * 1.8);
  T.upRX = 0.012 + br * 0.012; T.aLX = br * 0.03; T.aRX = -br * 0.03;

  /* --- jalan / lari --- */
  if (mv > 0.02 && !S.swim) {
    const amp = (run ? 1.0 : 0.62) * mv * (1 - 0.62 * crouch);
    const K = (run ? 1.25 : 0.6) * mv * (1 - 0.5 * crouch);
    T.lLX += s * amp; T.lRX -= s * amp;
    T.lLK += Math.max(0, -co) * K; T.lRK += Math.max(0, co) * K;
    T.aLX += -s * amp * 0.9; T.aRX += s * amp * 0.9;
    T.rigY += Math.abs(s) * (run ? 0.075 : 0.035) * mv * (1 - crouch);
    T.upRY += s * (run ? 0.2 : 0.12) * mv;
    T.upRX += (run ? 0.17 : 0.03) * mv;
    if (run) { T.aLZ -= 0.12; T.aRZ += 0.12; }
  }

  /* --- jongkok: pinggul turun, paha maju, lutut menekuk, badan condong --- */
  if (crouch > 0.001) {
    T.rigY += -0.155 * crouch; T.rigZ += -0.2 * crouch;
    T.upRX += 0.42 * crouch; T.headRX += -0.34 * crouch;
    T.lLX += -1.0 * crouch; T.lRX += -1.0 * crouch;
    T.lLK += 1.45 * crouch; T.lRK += 1.45 * crouch;
    T.aLX += -0.55 * crouch; T.aRX += -0.55 * crouch;
    T.aLZ += -0.1 * crouch; T.aRZ += 0.1 * crouch;
  }

  /* --- di udara (lompat / jatuh) --- */
  if (S.inAir && !S.swim) {
    const q = c01(((S.vy || 0) / 7.6 + 1) / 2); /* 1 = naik cepat, 0 = jatuh cepat */
    T.lLX = mix(-0.3, -0.95, q); T.lLK = mix(0.4, 1.2, q);
    T.lRX = mix(0.15, 0.3, q); T.lRK = mix(0.25, 0.55, q);
    T.aLX = mix(-0.2, -0.5, q); T.aRX = mix(-0.2, -0.5, q);
    T.aLZ = mix(-0.9, -1.25, q); T.aRZ = mix(0.9, 1.25, q);
    T.upRX = mix(0.08, -0.06, q); T.rigY = 0; T.rigZ = 0; T.headRX = 0;
  }

  /* --- renang --- */
  if (S.swim) {
    const sw = mv > 0.05 ? s : Math.sin(time * 2) * 0.5;
    T.rigRX = 1.3; T.rigY = 0.85; T.rigZ = 0;
    T.aLX = -2.9 + sw * 1.1; T.aRX = -2.9 - sw * 1.1; T.aLZ = -0.12; T.aRZ = 0.12;
    T.lLX = sw * 0.35; T.lRX = -sw * 0.35; T.lLK = 0.25; T.lRK = 0.25;
    T.headRX = -0.7; T.upRX = 0;
  }

  /* --- duduk (kursi pesawat) --- */
  if (S.sit) {
    T.rigY = -0.33; T.rigZ = 0;
    T.lLX = -1.5; T.lRX = -1.5; T.lLK = 1.5; T.lRK = 1.5;
    T.aLX = -0.55 + br * 0.02; T.aRX = -0.55 - br * 0.02; T.aLZ = 0.12; T.aRZ = -0.12;
    T.upRX = 0.03 + br * 0.01;
  }

  /* --- panik: tangan naik gemetar, kepala geleng --- */
  if (S.panic > 0) {
    const pk = c01(S.panic);
    T.aLX = mix(T.aLX, -2.55 + Math.sin(time * 17) * 0.4, pk);
    T.aRX = mix(T.aRX, -2.55 + Math.sin(time * 17 + 2) * 0.4, pk);
    T.aLZ = mix(T.aLZ, -0.55, pk); T.aRZ = mix(T.aRZ, 0.55, pk);
    T.headRZ = Math.sin(time * 13) * 0.28 * pk; T.headRX = mix(T.headRX, Math.sin(time * 11) * 0.22, pk);
    T.upRZ = Math.sin(time * 9) * 0.1 * pk; T.upRY += Math.sin(time * 7) * 0.12 * pk;
    if (!S.sit) { T.rigY += Math.abs(Math.sin(time * 14)) * 0.05 * pk; T.lLX += Math.sin(time * 14) * 0.35 * pk; T.lRX -= Math.sin(time * 14) * 0.35 * pk; }
    rate = 28;
  }

  /* --- posisi benturan: kepala menunduk, tangan melindungi kepala --- */
  if (S.brace) {
    T.upRX = 0.95; T.headRX = 0.55; T.aLX = -2.45; T.aRX = -2.45; T.aLZ = 0.5; T.aRZ = -0.5;
    T.upRZ = Math.sin(time * 20) * 0.04; T.rigZ = Math.sin(time * 30) * 0.015;
  }

  /* --- serang: tiap alat punya gerakan sendiri --- */
  const A = S.atk;
  const isDead = S.dead !== undefined && S.dead >= 0;
  if (A && A.p > 0 && A.p < 1.0 && !isDead) {
    const p = A.p;
    const wind = smooth01(p / 0.35), hit = smooth01((p - 0.35) / 0.22), rec = smooth01((p - 0.62) / 0.38);
    const out = (v) => mix(v, 0, rec); /* kembali ke posisi awal */
    rate = 34;
    switch (A.k) {
      case 'chop': {
        const a = mix(mix(0, -2.9, wind), -0.4, hit);
        T.aRX = out(a); T.aLX = out(a * 0.85); T.aLZ = out(-0.28); T.aRZ = out(0.22);
        T.upRX = out(mix(-0.2 * wind, 0.62, hit)); T.rigY = out(-0.05 * hit);
        T.lLX = out(-0.5 * hit); T.lLK = out(0.35 * hit); T.headRX = out(-0.12 * hit);
        break;
      }
      case 'slash': {
        T.aRX = out(-1.3); T.aRZ = out(mix(mix(0.2, 1.95, wind), -0.55, hit));
        T.upRY = out(mix(mix(0, -0.85, wind), 0.85, hit)); T.aLZ = out(-0.5 * wind);
        T.lLX = out(-0.4 * hit); T.upRX = out(0.1 * hit);
        break;
      }
      case 'thrust': {
        T.aRX = out(mix(mix(0, 0.15, wind), -1.55, hit)); T.aLX = out(-0.95 * (0.4 + 0.6 * hit));
        T.upRX = out(0.34 * hit); T.lLX = out(-0.7 * hit); T.lLK = out(0.3 * hit); T.lRX = out(0.35 * hit);
        T.upRY = out(mix(0.3 * wind, -0.15, hit)); T.rigY = out(-0.04 * hit);
        break;
      }
      case 'dig': {
        T.aRX = out(mix(mix(0, -1.45, wind), -0.55, hit)); T.aLX = out(mix(mix(0, -1.3, wind), -0.45, hit));
        T.aLZ = out(-0.2); T.aRZ = out(0.2);
        T.upRX = out(mix(-0.08 * wind, 0.78, hit)); T.rigY = out(-0.1 * hit); T.rigZ = out(-0.06 * hit);
        T.lLX = out(-0.45 * hit); T.lLK = out(0.6 * hit); T.lRK = out(0.5 * hit); T.lRX = out(0.1 * hit);
        T.headRX = out(-0.3 * hit);
        break;
      }
      case 'cast': {
        T.aRX = out(mix(mix(0, -3.05, wind), -1.05, hit)); T.aRZ = out(0.12);
        T.upRX = out(mix(-0.16 * wind, 0.22, hit)); T.upRY = out(-0.2 * hit);
        break;
      }
      case 'scoop': {
        const k = Math.sin(Math.PI * p);
        T.upRX = 0.58 * k; T.aRX = -1.05 * k; T.aLX = -0.7 * k; T.rigY = -0.08 * k; T.lLK = 0.5 * k; T.lRK = 0.5 * k; T.lLX = -0.4 * k; T.lRX = -0.4 * k;
        break;
      }
      default: { /* tinju */
        const a = mix(mix(0, 0.55, wind), -1.65, hit);
        T.aRX = out(a); T.aRZ = out(0.1); T.upRY = out(mix(mix(0, -0.55, wind), 0.5, hit));
        T.upRX = out(0.14 * hit); T.lLX = out(-0.45 * hit); T.lRX = out(0.25 * hit); T.aLX = out(0.25 * wind);
      }
    }
  }

  /* --- mati: terhuyung lalu jatuh telentang --- */
  if (isDead) {
    const d = S.dead;
    const f = c01(d / 0.9);
    const fall = f * f;
    T.rigRX = -1.5708 * fall + (d > 0.9 ? Math.sin(c01((d - 0.9) / 0.35) * Math.PI) * 0.1 : 0);
    T.rigY = 0.2 * fall; T.rigZ = 0;
    T.upRX = 0; T.upRY = 0; T.upRZ = Math.sin(time * 12) * 0.15 * (1 - f);
    T.aLX = 0; T.aRX = 0;
    T.aLZ = -(1.9 * (1 - f) + 0.5 * f) + Math.sin(time * 14) * 0.35 * (1 - f);
    T.aRZ = 1.9 * (1 - f) + 0.5 * f - Math.sin(time * 14 + 1) * 0.35 * (1 - f);
    T.lLX = -0.25 * f; T.lRX = 0.2 * f; T.lLK = 0.5 * f; T.lRK = 0.2 * f;
    T.headRX = -0.3 * f; T.headRZ = 0.2 * f;
    rate = 40;
  }

  /* kaki menapak datar saat jongkok / duduk; saat jalan ikut ayunan */
  const flat = c01(crouch + (S.sit ? 1 : 0));
  T.sL = -(T.lLX + T.lLK) * (0.35 + 0.65 * flat);
  T.sR = -(T.lRX + T.lRK) * (0.35 + 0.65 * flat);

  const k = 1 - Math.exp(-rate * Math.min(dt || 0.016, 0.1));
  for (const key in T) cur[key] = cur[key] === undefined ? T[key] : mix(cur[key], T[key], k);
  u.rig.position.y = cur.rigY; u.rig.position.z = cur.rigZ;
  u.rig.rotation.x = cur.rigRX; u.rig.rotation.z = cur.rigRZ;
  u.up.rotation.set(cur.upRX, cur.upRY, cur.upRZ);
  u.head.rotation.set(cur.headRX, cur.headRY, cur.headRZ);
  u.armL.rotation.set(cur.aLX, 0, cur.aLZ);
  u.armR.rotation.set(cur.aRX, 0, cur.aRZ);
  u.legL.rotation.x = cur.lLX; u.legR.rotation.x = cur.lRX;
  if (u.kneeL) { u.kneeL.rotation.x = cur.lLK; u.kneeR.rotation.x = cur.lRK; }
  if (u.shoeL) { u.shoeL.rotation.x = cur.sL; u.shoeR.rotation.x = cur.sR; }
  if (u.cape) u.cape.rotation.x = Math.min(0.9, 0.08 + mv * (run ? 0.5 : 0.22) + Math.abs(Math.sin(time * 3)) * 0.04);
}

/* lupakan transisi pose (dipakai setelah emote) */
export function clearPose(g) { if (g && g.userData) g.userData.pc = null; }

/* pasang model alat di tangan kanan karakter (tampak orang ketiga / pemain lain) */
export function setHeldTP(g, model) {
  const u = g.userData;
  if (!u || !u.armR) return;
  if (u.heldTP) { u.armR.remove(u.heldTP); u.heldTP = null; }
  if (!model) return;
  const w = new THREE.Group();
  w.position.set(0, -0.58, 0.02);
  w.rotation.set(-1.05, Math.PI, 0);
  w.scale.setScalar(1.15);
  w.add(model);
  u.armR.add(w);
  u.heldTP = w;
}

/* gaya berdiri bebas (layar room / lobi) */
export function idlePose(g, t, style) {
  resetPose(g);
  const u = g.userData;
  const s = style % 5;
  u.rig.position.y = S(t * 2 + style) * 0.012;
  if (s === 0) { u.armL.rotation.x = S(t * 2) * 0.08; u.armR.rotation.x = -S(t * 2) * 0.08; }
  else if (s === 1) { u.armR.rotation.z = 2.5 + S(t * 8) * 0.3; u.armL.rotation.z = -0.08; }
  else if (s === 2) { u.armL.rotation.x = u.armR.rotation.x = -1.1; u.armL.rotation.z = 0.7; u.armR.rotation.z = -0.7; u.head.rotation.y = S(t * 0.8) * 0.4; }
  else if (s === 3) { u.armL.rotation.z = -0.55; u.armR.rotation.z = 0.55; u.armL.rotation.x = u.armR.rotation.x = 0.1; u.up.rotation.z = S(t * 1.5) * 0.05; u.head.rotation.y = S(t * 0.7) * 0.3; }
  else { applyEmote(g, 'dance', t); }
}

/* ===== pratinjau 2D (Vault) ===== */
export function drawPreview(cv, src) {
  const d = normLook(src);
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  const s = h / 100;
  const cx = w / 2;
  const r = (c, x, y, ww, hh) => {
    g.fillStyle = c;
    g.fillRect(cx + x * s, y * s, ww * s, hh * s);
  };
  r(d.pants, -14, 62, 12, d.pantsStyle ? 18 : 30);
  r(d.pants, 2, 62, 12, d.pantsStyle ? 18 : 30);
  if (d.pantsStyle) { r(d.skin, -13, 80, 10, 12); r(d.skin, 3, 80, 10, 12); }
  r(d.shoes, -15, 92, 14, 5);
  r(d.shoes, 1, 92, 14, 5);
  r(d.shirt, -18, 30, 36, 36);
  if (d.shirtStyle === 1) for (let i = 0; i < 3; i++) r(d.shirt2, -18, 36 + i * 10, 36, 4);
  if (d.shirtStyle === 2) r(d.shirt2, -18, 50, 36, 16);
  r(d.shirt, -27, 32, 9, 20);
  r(d.shirt, 18, 32, 9, 20);
  r(d.skin, -27, 50, 9, 14);
  r(d.skin, 18, 50, 9, 14);
  if (d.scarf) r(d.scarf, -19, 28, 38, 6);
  r(d.skin, -12, 8, 24, 24);
  if (d.hairStyle !== 1) r(d.hair, -12, 5, 24, 8);
  if (d.hairStyle === 2) { r(d.hair, -13, 8, 4, 26); r(d.hair, 9, 8, 4, 26); }
  if (d.hairStyle === 3) r(d.hair, -3, 0, 6, 8);
  if (d.hairStyle === 4) { r(d.hair, -10, 1, 4, 5); r(d.hair, -2, -1, 4, 7); r(d.hair, 6, 1, 4, 5); }
  if (d.hatStyle) r(d.hat || '#c9a227', d.hatStyle === 3 ? -22 : -17, 3, d.hatStyle === 3 ? 44 : 34, 5);
  r(d.eye, -7, 18, 4, 4);
  r(d.eye, 3, 18, 4, 4);
  if (d.glasses) r(d.glassCol, -9, 17, 18, 6);
  r('#7a3a28', -4, 26, 8, 2);
}
