import * as THREE from 'three';

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
  h: 1, w: 1, head: 1,
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
  if (!mc.has(c)) mc.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
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

  /* kepala */
  const head = new THREE.Group();
  head.position.set(0, HEADY - UP, 0);
  head.scale.setScalar(d.head);
  up.add(head);
  const hb = (w, h, dd, c, x, y, z) => bx(w, h, dd, c, x, y - HEADY, z);
  head.add(hb(0.46, 0.46, 0.46, d.skin, 0, 1.63, 0));
  /* rambut */
  const hs = d.hairStyle;
  if (hs !== 1) {
    head.add(hb(0.5, 0.14, 0.5, d.hair, 0, 1.9, 0));
    if (hs === 0 || hs === 5) head.add(hb(0.5, 0.3, 0.12, d.hair, 0, 1.74, -0.2));
    if (hs === 2) {
      head.add(hb(0.5, 0.62, 0.12, d.hair, 0, 1.58, -0.2));
      head.add(hb(0.06, 0.34, 0.4, d.hair, -0.25, 1.7, -0.02));
      head.add(hb(0.06, 0.34, 0.4, d.hair, 0.25, 1.7, -0.02));
    }
    if (hs === 3) { head.add(hb(0.12, 0.22, 0.52, d.hair, 0, 2.05, 0)); }
    if (hs === 4) {
      for (let i = 0; i < 5; i++) {
        const s = hb(0.1, 0.2 + (i % 2) * 0.08, 0.1, d.hair, -0.18 + i * 0.09, 2.03 + (i % 2) * 0.03, (i - 2) * 0.05);
        s.rotation.z = (i - 2) * 0.18;
        head.add(s);
      }
    }
    if (hs === 5) {
      const t = hb(0.12, 0.4, 0.12, d.hair, 0, 1.58, -0.32);
      t.rotation.x = 0.25;
      head.add(t, hb(0.14, 0.1, 0.14, d.hair, 0, 1.82, -0.26));
    }
  }
  /* mata */
  const es = d.eyeStyle;
  for (const sx of [-1, 1]) {
    if (es === 0) head.add(hb(0.07, 0.07, 0.03, d.eye, 0.11 * sx, 1.66, 0.235));
    else if (es === 1) {
      head.add(hb(0.13, 0.15, 0.025, '#ffffff', 0.11 * sx, 1.66, 0.235));
      head.add(hb(0.07, 0.1, 0.03, d.eye, 0.11 * sx, 1.65, 0.245));
    } else head.add(hb(0.11, 0.028, 0.03, d.eye, 0.11 * sx, 1.66, 0.235));
  }
  /* mulut */
  if (d.mouth === 0) head.add(hb(0.12, 0.03, 0.03, '#a3563a', 0, 1.52, 0.235));
  else if (d.mouth === 1) {
    head.add(hb(0.1, 0.03, 0.03, '#a3563a', 0, 1.5, 0.235));
    head.add(hb(0.03, 0.03, 0.03, '#a3563a', -0.07, 1.525, 0.235));
    head.add(hb(0.03, 0.03, 0.03, '#a3563a', 0.07, 1.525, 0.235));
  } else head.add(hb(0.1, 0.08, 0.03, '#4a1a14', 0, 1.51, 0.235));
  /* kacamata */
  if (d.glasses === 1) {
    for (const sx of [-1, 1]) {
      head.add(hb(0.17, 0.14, 0.02, d.glassCol, 0.11 * sx, 1.66, 0.25));
      head.add(hb(0.12, 0.09, 0.025, '#bfe3ff', 0.11 * sx, 1.66, 0.252));
    }
    head.add(hb(0.06, 0.025, 0.02, d.glassCol, 0, 1.67, 0.25));
  } else if (d.glasses === 2) head.add(hb(0.44, 0.09, 0.03, d.glassCol, 0, 1.66, 0.25));
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
  const sh2 = d.shirtStyle === 2 ? d.shirt2 : d.shirt;
  up.add(ub(0.54, 0.72, 0.3, d.shirt, 0, 1.04, 0));
  if (d.shirtStyle === 1) for (let i = 0; i < 3; i++) up.add(ub(0.545, 0.09, 0.305, d.shirt2, 0, 0.82 + i * 0.2, 0));
  if (d.shirtStyle === 2) up.add(ub(0.545, 0.34, 0.305, d.shirt2, 0, 0.87, 0));
  void sh2;
  if (d.scarf) {
    up.add(ub(0.6, 0.12, 0.36, d.scarf, 0, 1.38, 0));
    up.add(ub(0.14, 0.34, 0.05, d.scarf, 0.14, 1.2, 0.2));
  }
  if (d.pack) up.add(ub(0.42, 0.5, 0.2, d.pack, 0, 1.08, -0.25), ub(0.3, 0.14, 0.05, '#2a1c10', 0, 1.2, -0.36));
  let cape = null;
  if (d.cape) {
    cape = new THREE.Group();
    cape.position.set(0, 1.36 - UP, -0.17);
    const cm = bx(0.56, 0.95, 0.04, d.cape, 0, -0.47, -0.02);
    cape.add(cm);
    up.add(cape);
  }
  const mkArm = (s) => {
    const a = new THREE.Group();
    a.position.set(0.37 * s, 1.36 - UP, 0);
    a.add(bx(0.17, 0.3, 0.17, d.shirt, 0, -0.15, 0));
    a.add(bx(0.15, 0.36, 0.15, d.skin, 0, -0.48, 0));
    up.add(a);
    return a;
  };
  const mkLeg = (s) => {
    const l = new THREE.Group();
    l.position.set(0.14 * s, UP, 0);
    if (d.pantsStyle === 1) {
      l.add(bx(0.22, 0.34, 0.22, d.pants, 0, -0.17, 0));
      l.add(bx(0.19, 0.3, 0.19, d.skin, 0, -0.49, 0));
    } else l.add(bx(0.22, 0.58, 0.22, d.pants, 0, -0.29, 0));
    l.add(bx(0.24, 0.1, 0.3, d.shoes, 0, -0.63, 0.03));
    rig.add(l);
    return l;
  };
  g.userData = { rig, up, head, cape, armL: mkArm(-1), armR: mkArm(1), legL: mkLeg(-1), legR: mkLeg(1), top: 2.45 * d.h };
  return g;
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
  for (const k of ['armL', 'armR', 'legL', 'legR']) u[k].rotation.set(0, 0, 0);
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
