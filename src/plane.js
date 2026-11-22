/* Pesawat penumpang detail (prosedural): badan lathe bertekstur livery, sayap, mesin turbofan
   dengan kipas berputar, ekor, kokpit, kabin dengan kursi + jendela yang bisa dilihat tembus. */
import * as THREE from 'three';

const PROFILE = [[0.0, -18], [0.22, -17.6], [0.55, -16], [0.95, -13.5], [1.4, -10], [1.75, -7], [1.9, -4], [1.9, 7], [1.84, 9.5], [1.66, 11.5], [1.35, 13.6], [0.95, 15.5], [0.5, 17.1], [0.12, 17.85], [0, 18]];
export const PLANE_LEN = 36;
export const ROW0 = -5.4, ROWS = 12, ROW_PITCH = 1.0;
export const FLOOR_Y = -0.62;
export const SEAT_X = [1.2, 0.63, -0.63, -1.2];
const rAt = (z) => {
  for (let i = 1; i < PROFILE.length; i++) {
    if (z <= PROFILE[i][1]) { const a = PROFILE[i - 1], b = PROFILE[i], k = (z - a[1]) / (b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; }
  }
  return 0;
};

function profileGeo(off, segs) {
  const pts = new THREE.SplineCurve(PROFILE.map(([r, z]) => new THREE.Vector2(Math.max(0.0001, r - off), z))).getPoints(90);
  pts[0].x = 0.0001; pts[pts.length - 1].x = 0.0001;
  const g = new THREE.LatheGeometry(pts, segs);
  g.rotateX(Math.PI / 2);
  return g;
}

/* posisi jendela (z) di sepanjang kabin */
const WINDOW_Z = [];
for (let i = 0; i < ROWS; i++) WINDOW_Z.push(ROW0 + i * ROW_PITCH);

function skinTexture() {
  const W = 2048, H = 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, W, H);
  /* perut abu-abu */
  const bel = g.createLinearGradient(0, 0, W, 0);
  bel.addColorStop(0, '#aeb7c2'); bel.addColorStop(0.1, '#d5dbe2'); bel.addColorStop(0.9, '#d5dbe2'); bel.addColorStop(1, '#aeb7c2');
  g.fillStyle = bel; g.fillRect(0, 0, W * 0.12, H); g.fillRect(W * 0.88, 0, W * 0.12, H);
  const y = (z) => (1 - (z + 18) / 36) * H;
  for (const [u, sgn] of [[0.25, 1], [0.75, -1]]) {
    /* garis cheatline biru */
    g.fillStyle = '#103f8f'; g.fillRect((u - 0.044) * W, y(16.3), 0.012 * W, y(-14) - y(16.3));
    g.fillStyle = '#e8a317'; g.fillRect((u - 0.03) * W, y(16.3), 0.006 * W, y(-14) - y(16.3));
    /* jendela */
    const wu = u + sgn * 0.0; void wu;
  }
  /* jendela kabin (lonjong gelap) */
  for (const uc of [0.287, 0.713]) for (const z of WINDOW_Z) {
    const cx = uc * W, cy = y(z);
    g.fillStyle = '#3b4552'; g.beginPath(); g.ellipse(cx, cy, 13, 24, 0, 0, 7); g.fill();
    g.fillStyle = '#0d1a2b'; g.beginPath(); g.ellipse(cx, cy, 9.5, 19, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(160,200,255,.35)'; g.beginPath(); g.ellipse(cx - 2, cy - 5, 3, 8, 0, 0, 7); g.fill();
  }
  /* kaca kokpit */
  g.fillStyle = '#0b1522';
  g.fillRect(0.455 * W, y(13.4), 0.09 * W, y(11.8) - y(13.4));
  /* pintu */
  for (const uc of [0.287, 0.713]) { g.strokeStyle = '#9aa3ad'; g.lineWidth = 3; g.strokeRect((uc - 0.016) * W, y(8.4), 0.032 * W, y(5.9) - y(8.4)); }
  /* garis panel & paku keling */
  g.strokeStyle = 'rgba(90,100,115,.35)'; g.lineWidth = 1.5;
  for (let z = -16; z <= 16; z += 2.2) { g.beginPath(); g.moveTo(0, y(z)); g.lineTo(W, y(z)); g.stroke(); }
  g.fillStyle = 'rgba(90,100,115,.35)';
  for (let z = -16; z <= 16; z += 2.2) for (let i = 0; i < 160; i++) g.fillRect(i * (W / 160), y(z) + 3, 2, 2);
  /* nama maskapai */
  g.font = 'bold 74px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#103f8f';
  for (const [u, rot] of [[0.325, Math.PI / 2], [0.675, -Math.PI / 2]]) {
    g.save(); g.translate(u * W, y(-1)); g.rotate(-rot); g.fillText('SANTAY AIR', 0, 26); g.restore();
  }
  /* ekor biru */
  g.fillStyle = '#103f8f'; g.fillRect(0, y(-13), W, H - y(-13));
  g.fillStyle = '#e8a317'; g.fillRect(0, y(-13) - 6, W, 6);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* dinding kabin dengan lubang jendela (alpha) */
function cabinTexture() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#e9e4d8'; g.fillRect(0, 0, W, H);
  const y = (z) => (1 - (z + 18) / 36) * H;
  g.fillStyle = '#cfc8b8'; g.fillRect(0.2 * W, 0, 0.012 * W, H); g.fillRect(0.788 * W, 0, 0.012 * W, H);
  g.globalCompositeOperation = 'destination-out';
  for (const uc of [0.287, 0.713]) for (const z of WINDOW_Z) { g.beginPath(); g.ellipse(uc * W, y(z), 11, 19, 0, 0, 7); g.fill(); }
  g.beginPath(); g.rect(0.43 * W, y(13.4), 0.14 * W, y(11.6) - y(13.4)); g.fill();
  g.globalCompositeOperation = 'source-over';
  /* bingkai jendela */
  g.strokeStyle = '#8b8678'; g.lineWidth = 4;
  for (const uc of [0.287, 0.713]) for (const z of WINDOW_Z) { g.beginPath(); g.ellipse(uc * W, y(z), 13, 21, 0, 0, 7); g.stroke(); }
  const t = new THREE.CanvasTexture(cv);
  if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function wingGeo(span, rootC, tipC, sweep, thick) {
  const sh = new THREE.Shape();
  /* x = bentang, y = -z (arah rantai) */
  sh.moveTo(0, -rootC * 0.55); sh.lineTo(span, -(rootC * 0.55 - sweep)); sh.lineTo(span, -(rootC * 0.55 - sweep) + tipC); sh.lineTo(0, -rootC * 0.55 + rootC);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: thick * 0.35, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thick * 0.5, 0);
  return g;
}

export function buildPlane() {
  const P = new THREE.Group();
  const skinGroup = new THREE.Group(); /* bagian luar (disembunyikan saat kamera di dalam) */
  const inGroup = new THREE.Group(); /* interior */
  P.add(skinGroup, inGroup);
  const nose = new THREE.Group(), tail = new THREE.Group(), wingLg = new THREE.Group(), wingRg = new THREE.Group();
  skinGroup.add(nose, tail, wingLg, wingRg);

  const skinMat = new THREE.MeshPhysicalMaterial({ map: skinTexture(), metalness: 0.28, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.1 });
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf1f3f6, metalness: 0.3, roughness: 0.32, clearcoat: 0.7, envMapIntensity: 1.1 });
  const blue = new THREE.MeshPhysicalMaterial({ color: 0x103f8f, metalness: 0.3, roughness: 0.35, clearcoat: 0.7, envMapIntensity: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f26, metalness: 0.6, roughness: 0.45 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8c95a1, metalness: 0.9, roughness: 0.3, envMapIntensity: 1.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0a1624, metalness: 0.1, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6 });

  /* badan: satu mesh, dipotong saat jatuh dengan memisahkan ekor (klon + clipping) */
  const fus = new THREE.Mesh(profileGeo(0, 56), skinMat);
  fus.castShadow = true;
  nose.add(fus);
  P.userData.fuselage = fus;
  /* kaca depan */
  const ws = new THREE.Mesh(new THREE.CylinderGeometry(rAt(13.4) + 0.012, rAt(11.8) + 0.012, 1.6, 20, 1, true, Math.PI - 0.7, 1.4), glass);
  ws.rotation.x = Math.PI / 2; ws.position.set(0, 0, 12.6);
  ws.rotation.set(Math.PI / 2, 0, 0);
  nose.add(ws);
  /* radome + pitot */
  const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), metal);
  pitot.rotation.x = Math.PI / 2; pitot.position.set(0.7, 0.1, 15.3); nose.add(pitot);

  /* ----- sayap ----- */
  const wg = wingGeo(15, 5.2, 1.3, 6.2, 0.26);
  for (const [grp, s] of [[wingLg, 1], [wingRg, -1]]) {
    grp.position.set(0, -0.75, -0.2);
    const w = new THREE.Mesh(wg, paint); w.castShadow = true; w.scale.x = s;
    if (s < 0) w.material = paint;
    grp.add(w);
    grp.rotation.z = 0.06 * s;
    /* flap & aileron */
    for (const [a, b, c2, d2] of [[3.0, 8.0, -2.55, 0.9], [9.5, 14, -1.7, 0.5]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.05, d2), dark);
      f.position.set(s * (a + b) / 2, 0.12, c2 - 0.05 + (a > 5 ? 0.2 : 0)); f.rotation.y = s * -0.03; grp.add(f);
    }
    /* winglet */
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.9), blue);
    wl.position.set(s * 15.1, 0.55, -2.9); wl.rotation.z = -0.2 * s; wl.castShadow = true; grp.add(wl);
    /* lampu navigasi */
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: s > 0 ? 0xff2222 : 0x22ff55 }));
    nav.position.set(s * 15.2, 1.05, -3.1); grp.add(nav);
    (P.userData.nav || (P.userData.nav = [])).push(nav);
    /* mesin */
    const eng = buildEngine(paint, dark, metal);
    eng.position.set(s * 5.3, -1.35, 1.2);
    grp.add(eng);
    eng.position.y = -1.35 - (-0.75) + (-0.0); /* relatif grup sayap */
    eng.position.y = -0.62;
    eng.rotation.z = -0.06 * s;
    P.userData[s > 0 ? 'engL' : 'engR'] = eng;
    const pyl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 2.4), paint);
    pyl.position.set(s * 5.3, -0.18, 0.5); grp.add(pyl);
  }
  P.userData.wingL = wingLg; P.userData.wingR = wingRg;

  /* ----- ekor ----- */
  const vs = new THREE.Shape();
  vs.moveTo(0, 0); vs.lineTo(3.6, 0.0); vs.lineTo(2.4, 5.6); vs.lineTo(1.2, 5.6); vs.closePath();
  const vg = new THREE.ExtrudeGeometry(vs, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 });
  vg.rotateY(-Math.PI / 2); vg.translate(0.11, 0, 0);
  const vstab = new THREE.Mesh(vg, blue);
  vstab.position.set(0, 0.95, -17.4 + 0.0); vstab.castShadow = true;
  tail.add(vstab);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ color: 0xe8a317 }));
  logo.position.set(0.125, 3.3, -15.4); logo.rotation.y = Math.PI / 2; tail.add(logo);
  const logo2 = logo.clone(); logo2.position.x = -0.125; logo2.rotation.y = -Math.PI / 2; tail.add(logo2);
  const hg = wingGeo(5.4, 2.6, 1.0, 2.2, 0.16);
  for (const s of [1, -1]) {
    const h = new THREE.Mesh(hg, paint); h.scale.x = s; h.position.set(0, 0.55, -15.9); h.rotation.z = 0.05 * s; h.castShadow = true; tail.add(h);
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  beacon.position.set(0, 6.1, -17.2); tail.add(beacon);
  P.userData.strobe = [beacon];
  const apu = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9, 12), dark);
  apu.rotation.x = -Math.PI / 2; apu.position.set(0, 0.55, -18.2); tail.add(apu);
  P.userData.tail = tail;

  /* ----- interior ----- */
  const shellMat = new THREE.MeshStandardMaterial({ map: cabinTexture(), side: THREE.BackSide, alphaTest: 0.5, roughness: 0.9 });
  const shell = new THREE.Mesh(profileGeo(0.1, 40), shellMat);
  inGroup.add(shell);
  const carpet = new THREE.MeshStandardMaterial({ color: 0x2a3d5f, roughness: 1 });
  const floorM = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 15.5), new THREE.MeshStandardMaterial({ color: 0x59606b, roughness: 0.9 }));
  floorM.position.set(0, FLOOR_Y - 0.04, 2.2); inGroup.add(floorM);
  const aisle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 12.6), carpet);
  aisle.position.set(0, FLOOR_Y + 0.01, ROW0 + 5.4); inGroup.add(aisle);
  /* kursi (instanced) */
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1c4d9c, roughness: 0.85 });
  const seatDark = new THREE.MeshStandardMaterial({ color: 0x16356b, roughness: 0.85 });
  const N = ROWS * 4;
  const cush = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.14, 0.52), seatMat, N);
  const back = new THREE.InstancedMesh(new THREE.BoxGeometry(0.52, 0.78, 0.12), seatMat, N);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.2, 0.1), seatDark, N);
  const leg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.32, 0.4), dark, N);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let r = 0; r < ROWS; r++) for (const x of SEAT_X) {
    const z = ROW0 + r * ROW_PITCH;
    m4.makeTranslation(x, FLOOR_Y + 0.36, z); cush.setMatrixAt(n, m4);
    m4.makeTranslation(x, FLOOR_Y + 0.78, z - 0.27); back.setMatrixAt(n, m4);
    m4.makeTranslation(x, FLOOR_Y + 1.3, z - 0.27); head.setMatrixAt(n, m4);
    m4.makeTranslation(x, FLOOR_Y + 0.16, z - 0.02); leg.setMatrixAt(n, m4);
    n++;
  }
  inGroup.add(cush, back, head, leg);
  /* bagasi kabin + lampu langit-langit */
  const binM = new THREE.MeshStandardMaterial({ color: 0xded9cc, roughness: 0.8 });
  const lightM = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
  P.userData.lightM = lightM;
  for (const s of [1, -1]) {
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.38, 12.4), binM);
    bin.position.set(s * 1.1, 0.88, ROW0 + 5.4); bin.rotation.z = s * 0.12; inGroup.add(bin);
  }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 12.4), lightM);
  strip.position.set(0, 1.74, ROW0 + 5.4); inGroup.add(strip);
  /* masker oksigen (turun saat darurat) */
  const masks = [];
  const maskM = new THREE.MeshStandardMaterial({ color: 0xf4d23a, roughness: 0.6 });
  for (let r = 0; r < ROWS; r++) for (const x of SEAT_X) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.1), maskM);
    m.position.set(x * 0.85, 1.05, ROW0 + r * ROW_PITCH + 0.1); m.visible = false; inGroup.add(m); masks.push(m);
  }
  P.userData.masks = masks;
  /* kokpit */
  const cp = new THREE.Group();
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x20252d, roughness: 0.6 }));
  dash.position.set(0, FLOOR_Y + 1.0, 12.2); dash.rotation.x = -0.35; cp.add(dash);
  const scr = new THREE.MeshBasicMaterial({ color: 0x3be2a0 });
  P.userData.screenM = scr;
  for (const x of [-0.7, -0.25, 0.25, 0.7]) { const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), scr); s2.position.set(x, FLOOR_Y + 1.17, 11.93); s2.rotation.x = -0.35 + 0; s2.rotation.y = Math.PI; cp.add(s2); }
  const cseat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.9 });
  for (const x of [-0.55, 0.55]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.55), cseat); a.position.set(x, FLOOR_Y + 0.4, 9.3); cp.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.12), cseat); b.position.set(x, FLOOR_Y + 0.85, 9.0); cp.add(b);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.05), new THREE.MeshStandardMaterial({ color: 0x4a5060 }));
  door.position.set(-1.15, FLOOR_Y + 1.0, 7.4); door.rotation.y = 1.3; cp.add(door);
  inGroup.add(cp);

  /* penyimpanan bagian untuk adegan jatuh */
  P.userData.skinGroup = skinGroup; P.userData.inGroup = inGroup; P.userData.nose = nose;
  P.userData.fans = [];
  P.traverse((o) => { if (o.userData && o.userData.fan) P.userData.fans.push(o); });
  return P;
}

function buildEngine(paint, dark, metal) {
  const g = new THREE.Group();
  const pts = [[0.74, 1.55], [0.92, 1.3], [0.95, 0.6], [0.88, -0.6], [0.7, -1.4], [0.48, -1.8]].map(([r, z]) => new THREE.Vector2(r, z));
  const nac = new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(24), 32);
  nac.rotateX(Math.PI / 2);
  const nm = new THREE.Mesh(nac, paint); nm.castShadow = true; g.add(nm);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.9, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x15181d, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.5 }));
  inner.rotation.x = Math.PI / 2; inner.position.z = 1.05; g.add(inner);
  const fan = new THREE.Group(); fan.userData.fan = true; fan.position.z = 1.15;
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 14), metal); hub.rotation.x = Math.PI / 2; hub.position.z = 0.12; fan.add(hub);
  for (let i = 0; i < 16; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.02), dark);
    const a = (i / 16) * Math.PI * 2;
    b.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0); b.rotation.z = a - Math.PI / 2; b.rotation.y = 0.35; fan.add(b);
  }
  g.add(fan);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 16), metal); cone.rotation.x = -Math.PI / 2; cone.position.z = -1.9; g.add(cone);
  g.userData.fanObj = fan;
  return g;
}
