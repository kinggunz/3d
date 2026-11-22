import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { T } from './textures.js';

export const MINE_Y = -80;
const GN = 15; /* grid 15x15 blok */
const CELL = 4;
const WALL_H = 3.6;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/* ================= pintu goa di dunia luar ================= */
export function findCaves(hf, seed) {
  const rnd = mulberry32(seed ^ 0xca5e);
  const gather = (hMin, hMax, sMin) => {
    const out = [];
    for (let x = -130; x <= 130; x += 5) {
      for (let z = -130; z <= 130; z += 5) {
        const h = hf.sample(x, z);
        if (h < hMin || h > hMax) continue;
        const d0 = Math.hypot(x - 3, z - 3);
        if (d0 < 35) continue;
        const gx = (hf.sample(x + 2, z) - hf.sample(x - 2, z)) / 4;
        const gz = (hf.sample(x, z + 2) - hf.sample(x, z - 2)) / 4;
        const sl = Math.hypot(gx, gz);
        if (sl < sMin || sl > 1.2) continue;
        out.push({ x, z, y: hf.sample(x, z), ang: Math.atan2(-gx / sl, -gz / sl), d0 });
      }
    }
    return out;
  };
  let cand = gather(4.5, 16, 0.25);
  if (cand.length < 3) cand = gather(3, 22, 0.12);
  const picked = [];
  /* satu goa yang cukup dekat dari titik spawn */
  const near = cand.filter((c) => c.d0 > 35 && c.d0 < 110).sort(() => rnd() - 0.5)[0];
  if (near) picked.push(near);
  /* goa kedua juga cukup dekat, sisanya tersebar di seluruh pulau */
  const near2 = cand.filter((c) => c.d0 > 40 && c.d0 < 120 && (!near || Math.hypot(c.x - near.x, c.z - near.z) > 40)).sort(() => rnd() - 0.5)[0];
  if (near2) picked.push(near2);
  const rest = cand.slice().sort(() => rnd() - 0.5);
  for (const c of rest) {
    if (picked.length >= 10) break;
    if (picked.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 38)) picked.push(c);
  }
  if (!picked.length) {
    /* cadangan: pasang di daratan mana pun yang cukup tinggi */
    for (let x = 20; x < 140; x += 6) {
      const z = 20;
      const h = hf.sample(x, z);
      if (h > 1.8) { picked.push({ x, z, y: h, ang: 0, d0: Math.hypot(x - 3, z - 3) }); break; }
    }
  }
  return picked;
}

/* ================= LUBANG GOA NYATA di lereng bukit =================
   Tidak ada portal: pintu goa berupa lubang batu, terowongan menurun masuk ke bukit,
   lalu tersambung mulus ke tambang bawah tanah. Koordinat lokal:
   u = jarak masuk ke dalam bukit (dari titik c), v = kanan(+)/kiri(-).            */
export const CAVE = { U0: 2.0, US: 16.0, HW: 2.0, H: 3.6, HWP: 3.6, TOP: 0.4 };

/* hitung ukuran & ketinggian lubang goa berdasarkan bentuk tanah */
export function setupCave(c, hf) {
  c.ox = Math.sin(c.ang);
  c.oz = Math.cos(c.ang);
  const at = (u, v) => hf.sample(c.x - c.ox * u + c.oz * v, c.z - c.oz * u - c.ox * v);
  c.fm = at(CAVE.U0, 0) - 0.05; /* lantai terowongan */
  c.roofTop = c.fm + CAVE.H + CAVE.TOP;
  let uEnd = CAVE.US - 2;
  for (let u = CAVE.U0 + 2; u <= CAVE.US - 2; u += 0.5) {
    if (at(u, 0) >= c.roofTop + 0.5 && at(u, CAVE.HWP) >= c.roofTop + 0.2 && at(u, -CAVE.HWP) >= c.roofTop + 0.2) { uEnd = u + 1; break; }
  }
  c.uEnd = Math.min(uEnd, CAVE.US - 1);
  c.tl = [];
}

/* koordinat lokal sebuah titik dunia terhadap lubang goa */
export function caveLocal(c, x, z) {
  const dx = x - c.x, dz = z - c.z;
  return { u: -(dx * c.ox + dz * c.oz), v: dx * c.oz - dz * c.ox };
}
export function caveWorld(c, u, v) {
  return [c.x - c.ox * u + c.oz * v, c.z - c.oz * u - c.ox * v];
}

/* persegi tanah yang harus dilubangi (dipakai untuk memotong segitiga mesh daratan) */
export function caveHole(c) {
  return { c, u0: CAVE.U0 - 0.2, u1: c.uEnd + 0.2, hw: CAVE.HW + 0.6 };
}

function boxUV(geo, w, h, d, k) {
  /* skala UV tiap sisi supaya tekstur batu tidak melar di balok panjang */
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const n = f * 4 + i;
    uv.setXY(n, uv.getX(n) * dims[f][0] * k, uv.getY(n) * dims[f][1] * k);
  }
  return geo;
}

export function makeCave(c, hf) {
  const { U0, US, HW, H, HWP, TOP } = CAVE;
  const rnd = mulberry32(((c.x * 73856093) ^ (c.z * 19349663)) >>> 0);
  const g = new THREE.Group();
  const rock = new THREE.MeshStandardMaterial({ map: T.rock, roughness: 1 });
  const stone = new THREE.MeshStandardMaterial({ map: T.stone, roughness: 1 });
  const floorM = new THREE.MeshStandardMaterial({ map: T.floor, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ map: T.wood, roughness: 0.95 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x020203 });
  const loc = new THREE.Group();
  loc.position.set(c.x, 0, c.z);
  loc.rotation.y = c.ang;
  g.add(loc);
  /* balok di koordinat lokal: v (kanan), y (tinggi dunia), u (masuk) -> z = -u */
  const rbox = (mat, w, h, d, v, y, u, uvk = 0.3) => {
    const m = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, uvk), mat);
    m.position.set(v, y, -u);
    m.castShadow = true;
    m.receiveShadow = true;
    loc.add(m);
    return m;
  };
  const fm = c.fm, top = c.roofTop, baseY = fm - 3;
  const uMid = (U0 + c.uEnd) / 2, lenB = c.uEnd - U0;
  /* lantai terowongan (menjorok sedikit ke luar) */
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, US + 1.5 - U0 + 1.2), floorM);
  fl.rotation.x = -Math.PI / 2;
  fl.position.set(0, fm + 0.02, -((U0 - 1.2 + US + 1.5) / 2));
  fl.receiveShadow = true;
  const fuv = fl.geometry.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 2, fuv.getY(i) * ((US + 2.7 - U0) / 2));
  loc.add(fl);
  /* bagian depan: tiang batu kiri/kanan + balok di atas lubang (menjadi blok batu di atas tanah) */
  for (const sg of [-1, 1]) rbox(rock, HWP - HW, top + 0.06 - baseY, lenB, sg * (HW + HWP) / 2, (top + 0.06 + baseY) / 2, uMid);
  rbox(rock, HW * 2, top + 0.06 - (fm + H), lenB, 0, (top + 0.06 + fm + H) / 2, uMid);
  /* bagian dalam bukit: dinding + atap saja */
  const u2 = c.uEnd, u3 = US + 1.5, len2 = u3 - u2, mid2 = (u2 + u3) / 2;
  for (const sg of [-1, 1]) rbox(rock, 1.2, H + TOP + 3, len2, sg * (HW + 0.6), (fm + H + TOP + baseY) / 2, mid2);
  rbox(rock, HW * 2 + 2.4, TOP, len2, 0, fm + H + TOP / 2, mid2);
  /* tutup ujung (gelap) */
  const cap = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 + 2.4, H + TOP + 1, 0.4), dark);
  cap.position.set(0, fm + (H + TOP) / 2, -(u3 + 0.2));
  loc.add(cap);
  /* bingkai kayu di mulut goa */
  const frame = (w, h, d, v, y, u) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(v, y, -u); m.castShadow = true; loc.add(m); return m; };
  for (const sg of [-1, 1]) frame(0.3, H, 0.3, sg * (HW - 0.15), fm + H / 2, U0 - 0.2);
  frame(HW * 2, 0.3, 0.34, 0, fm + H - 0.12, U0 - 0.2);
  /* papan nama */
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#5a3a1c'; cx.fillRect(0, 0, 256, 64);
  cx.strokeStyle = '#2a1a0c'; cx.lineWidth = 4; cx.strokeRect(2, 2, 252, 60);
  cx.fillStyle = '#f4efe3'; cx.font = 'bold 34px sans-serif'; cx.textAlign = 'center';
  cx.fillText('TAMBANG', 128, 44);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.42), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  sign.position.set(0, fm + H + 0.2, -(U0 - 0.04));
  sign.rotation.y = Math.PI;
  loc.add(sign);
  /* bongkahan batu menutupi tepi blok supaya terlihat alami */
  const dod = new THREE.DodecahedronGeometry(1, 0);
  const nB = 9;
  for (let i = 0; i < nB; i++) {
    const side = i % 2 ? 1 : -1;
    const sc = 0.9 + rnd() * 1.3;
    const m = new THREE.Mesh(dod, i % 3 === 0 ? stone : rock);
    const uu = U0 - 0.3 + rnd() * (lenB + 0.6);
    const vv = side * (HWP - 0.2 + rnd() * 0.5);
    m.position.set(vv, Math.max(hf.sample(...caveWorld(c, uu, vv)), fm) + sc * 0.35, -uu);
    m.scale.set(sc * 1.15, sc * 0.8, sc);
    m.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
    m.castShadow = true; m.receiveShadow = true;
    loc.add(m);
  }
  for (let i = 0; i < 4; i++) {
    const sc = 1.0 + rnd() * 0.9;
    const m = new THREE.Mesh(dod, rock);
    const uu = U0 + 0.8 + rnd() * Math.max(1, lenB - 1.6), vv = (rnd() - 0.5) * (HW * 2);
    m.position.set(vv, top + sc * 0.12, -uu);
    m.scale.set(sc * 1.1, sc * 0.55, sc);
    m.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
    m.castShadow = true;
    loc.add(m);
  }
  /* tanah berbatu di sekitar lubang: menutup bagian mesh daratan yang dipotong */
  const E = { u0: U0 - 0.2 - 3.4, u1: c.uEnd + 0.2 + 3.4, hw: HW + 0.6 + 3.4 };
  const cell = 1;
  const nu = Math.ceil((E.u1 - E.u0) / cell), nv = Math.ceil((E.hw * 2) / cell);
  const pos = [], col = [], uvs = [], idx = [];
  const rc = new THREE.Color(), gc = new THREE.Color(0.3, 0.4, 0.22);
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const uu = E.u0 + i * cell, vv = -E.hw + j * cell;
    const [wx, wz] = caveWorld(c, uu, vv);
    pos.push(wx, hf.sample(wx, wz) + 0.12, wz);
    const edge = Math.min(1, Math.min(i, nu - i, j, nv - j) / 2.5);
    const n = 0.8 + rnd() * 0.3;
    rc.setRGB(0.46 * n, 0.43 * n, 0.4 * n).lerp(gc, 1 - edge);
    col.push(rc.r, rc.g, rc.b);
    uvs.push(wx * 0.4, wz * 0.4);
  }
  const inside = (uu, vv) => uu >= U0 - 0.01 && uu <= c.uEnd + 0.01 && Math.abs(vv) <= HWP + 0.01;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const uc = E.u0 + (i + 0.5) * cell, vc = -E.hw + (j + 0.5) * cell;
    if (inside(uc, vc)) continue;
    const a = j * (nu + 1) + i, b = a + 1, d2 = a + nu + 1, e = d2 + 1;
    idx.push(a, d2, b, b, d2, e);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  pg.setIndex(idx);
  pg.computeVertexNormals();
  const patch = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: T.rock, vertexColors: true, roughness: 1 }));
  patch.receiveShadow = true;
  g.add(patch);
  /* obor di dalam terowongan (sumber cahaya) */
  const flames = [], lights = [];
  const torchAt = (uu, vv) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2b }));
    pole.position.set(vv, fm + 0.7, -uu);
    const fl2 = new THREE.Group();
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.92 }));
    f1.position.y = 0.19;
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    f2.position.y = 0.14;
    fl2.add(f1, f2);
    fl2.position.set(vv, fm + 1.4, -uu);
    loc.add(pole, fl2);
    flames.push(fl2);
    const [wx, wz] = caveWorld(c, uu, vv);
    lights.push({ x: wx, y: fm + 1.7, z: wz, c: 0xff9a3c, rng: 13, i: 1.2 });
  };
  torchAt(U0 + 2.2, -(HW - 0.3));
  torchAt(U0 + 7.5, HW - 0.3);
  torchAt(U0 + 12, -(HW - 0.3));
  g.userData.flames = flames;
  g.userData.lights = lights;
  c.tl = lights;
  return g;
}

/* ================= tambang bawah tanah ================= */
export class Mine {
  constructor(seed, scene) {
    this.scene = scene;
    this.rnd = mulberry32(seed ^ 0x6d1e);
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.boxes = [];
    this.nodes = [];
    this.lights = [];
    this.flames = [];
    this.open = [];
    this.gen();
    this.build();
    this.populate();
  }

  cx(i) { return (i - 7) * CELL; }

  gen() {
    const rnd = this.rnd;
    const open = [];
    for (let j = 0; j < GN; j++) open.push(new Array(GN).fill(false));
    /* labirin DFS pada sel ganjil */
    const stack = [[1, 1]];
    open[1][1] = true;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => rnd() - 0.5);
      let moved = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 1 || ny < 1 || nx > GN - 2 || ny > GN - 2 || open[ny][nx]) continue;
        open[y + dy / 2][x + dx / 2] = true;
        open[ny][nx] = true;
        stack.push([nx, ny]);
        moved = true;
        break;
      }
      if (!moved) stack.pop();
    }
    /* beberapa jalan pintas */
    for (let k = 0; k < 14; k++) {
      const x = 1 + ((rnd() * 13) | 0), y = 1 + ((rnd() * 13) | 0);
      if ((x + y) % 2 === 1 && !open[y][x]) open[y][x] = true;
    }
    /* rongga besar 3x3 */
    for (let k = 0; k < 3; k++) {
      const cx = 3 + ((rnd() * 4) | 0) * 2 + 1, cy = 3 + ((rnd() * 4) | 0) * 2 + 1;
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (x >= 1 && y >= 1 && x <= GN - 2 && y <= GN - 2) open[y][x] = true;
    }
    /* area awal selalu terbuka + lorong pendek ke arah terowongan permukaan */
    open[1][1] = true;
    open[1][0] = true;
    this.open = open;
    this.start = { x: this.cx(1), z: this.cx(1) };
  }

  isOpen(i, j) {
    return i >= 0 && j >= 0 && i < GN && j < GN && this.open[j][i];
  }

  build() {
    const g = this.group;
    /* dinding: hanya blok tertutup yang bersebelahan dengan ruang terbuka */
    const walls = [];
    for (let j = 0; j < GN; j++) {
      for (let i = 0; i < GN; i++) {
        if (this.open[j][i]) continue;
        let adj = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (this.isOpen(i + dx, j + dy)) adj = true;
        if (adj) walls.push([i, j]);
      }
    }
    const wm = new THREE.InstancedMesh(
      new THREE.BoxGeometry(CELL, WALL_H, CELL),
      new THREE.MeshStandardMaterial({ map: T.rock, roughness: 1 }),
      Math.max(1, walls.length)
    );
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    walls.forEach(([i, j], k) => {
      const x = this.cx(i), z = this.cx(j);
      dummy.position.set(x, MINE_Y + WALL_H / 2, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wm.setMatrixAt(k, dummy.matrix);
      const v = 0.75 + this.rnd() * 0.4;
      col.setRGB(v, v, v * 1.04);
      wm.setColorAt(k, col);
      this.boxes.push({ minx: x - CELL / 2, maxx: x + CELL / 2, minz: z - CELL / 2, maxz: z + CELL / 2, bottom: MINE_Y - 2, top: MINE_Y + WALL_H, p: null });
    });
    wm.instanceMatrix.needsUpdate = true;
    if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
    wm.frustumCulled = false;
    g.add(wm);

    const size = GN * CELL;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: T.floor, roughness: 1 }));
    T.floor.repeat.set(16, 16);
    fl.rotation.x = -Math.PI / 2;
    fl.position.y = MINE_Y;
    fl.receiveShadow = false;
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: T.floor, roughness: 1, side: THREE.DoubleSide }));
    ce.rotation.x = Math.PI / 2;
    ce.position.y = MINE_Y + WALL_H;
    g.add(fl, ce);

    /* ujung lorong (tersambung mulus ke terowongan permukaan, tanpa pintu/portal) */
    const sx = this.start.x, sz = this.start.z;
    const capX = this.cx(0) - CELL / 2;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2, WALL_H + 1, CELL), new THREE.MeshBasicMaterial({ color: 0x020203 }));
    cap.position.set(capX - 1, MINE_Y + WALL_H / 2, sz);
    g.add(cap);
    this.boxes.push({ minx: capX - 2, maxx: capX, minz: sz - CELL / 2, maxz: sz + CELL / 2, bottom: MINE_Y - 2, top: MINE_Y + WALL_H, p: null });
    this.seamX = this.cx(0) + 0.6;
    this.exit = { x: this.seamX, z: sz, r: 0 };
    this.spawn = { x: this.seamX + 0.8, z: sz, yaw: -Math.PI / 2 };
    this.torch(sx + 0.2, MINE_Y, sz - 1.7, true);
    this.torch(sx + 0.2, MINE_Y, sz + 1.7, true);
  }

  /* obor dinding; dihitung sebagai sumber cahaya */
  torch(x, y, z, bright) {
    const g = this.group;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2b }));
    pole.position.set(x, y + 0.7, z);
    const flame = new THREE.Group();
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.92 }));
    f1.position.y = 0.19;
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    f2.position.y = 0.14;
    flame.add(f1, f2);
    flame.position.set(x, y + 1.4, z);
    g.add(pole, flame);
    this.flames.push(flame);
    this.lights.push({ x, y: y + 1.6, z, c: 0xff9a3c, rng: bright ? 16 : 13, i: bright ? 1.5 : 1.15 });
  }

  populate() {
    const rnd = this.rnd;
    const cells = [];
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) if (this.open[j][i] && Math.hypot(i - 1, j - 1) > 2.2) cells.push([i, j]);
    cells.sort(() => rnd() - 0.5);
    /* obor di jalur: tiap ~7 sel terbuka */
    let t = 0;
    for (const [i, j] of cells) {
      if (t++ % 7 !== 0) continue;
      const x = this.cx(i), z = this.cx(j);
      /* tempel di sisi dinding terdekat */
      let ox = 0, oz = 0;
      if (!this.isOpen(i - 1, j)) ox = -1.6;
      else if (!this.isOpen(i + 1, j)) ox = 1.6;
      else if (!this.isOpen(i, j - 1)) oz = -1.6;
      else if (!this.isOpen(i, j + 1)) oz = 1.6;
      else continue;
      this.torch(x + ox, MINE_Y, z + oz, false);
    }

    const counts = { coal: 0, iron: 0, stone: 0 };
    const total = 56;
    const types = [];
    for (let k = 0; k < total; k++) { const r = rnd(); types.push(r < 0.4 ? 'coal' : r < 0.7 ? 'iron' : 'stone'); }
    const cfg = {
      coal: { color: 0x202024, n: 0, hp: 4 },
      iron: { color: 0xb5693a, n: 0, hp: 6 },
      stone: { color: 0x8c8f94, n: 0, hp: 5 },
    };
    for (const k of types) cfg[k].n++;
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const meshes = {};
    for (const k of Object.keys(cfg)) {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: k === 'coal' ? 0.45 : 0.9, flatShading: true }), Math.max(1, cfg[k].n));
      m.frustumCulled = false;
      this.group.add(m);
      meshes[k] = m;
    }
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const idx = { coal: 0, iron: 0, stone: 0 };
    const used = [];
    let ci = 0;
    for (const k of types) {
      let cell = null;
      for (let tries = 0; tries < cells.length && !cell; tries++) {
        const c = cells[(ci++) % cells.length];
        const x = this.cx(c[0]) + (rnd() - 0.5) * 2.2, z = this.cx(c[1]) + (rnd() - 0.5) * 2.2;
        if (used.every((u) => Math.hypot(u[0] - x, u[1] - z) > 2.4)) { cell = [x, z]; used.push(cell); }
      }
      if (!cell) continue;
      const s = 0.75 + rnd() * 0.45;
      const i = idx[k]++;
      dummy.position.set(cell[0], MINE_Y + 0.45 * s, cell[1]);
      dummy.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
      dummy.scale.set(s, s * 0.85, s);
      dummy.updateMatrix();
      meshes[k].setMatrixAt(i, dummy.matrix);
      const v = 0.85 + rnd() * 0.3;
      col.setHex(cfg[k].color).multiplyScalar(v);
      meshes[k].setColorAt(i, col);
      this.nodes.push({
        type: k === 'stone' ? 'rock' : 'ore', ore: k, x: cell[0], y: MINE_Y, z: cell[1], r: 0.95 * s + 0.3, cr: 0.7 * s, cy: MINE_Y + 0.5,
        hp: cfg[k].hp, max: cfg[k].hp, alive: true, regrow: 0, idx: this.nodes.length,
        parts: [{ mesh: meshes[k], i, m: dummy.matrix.clone() }],
      });
    }
    for (const k of Object.keys(meshes)) {
      meshes[k].count = Math.max(1, idx[k]);
      meshes[k].instanceMatrix.needsUpdate = true;
      if (meshes[k].instanceColor) meshes[k].instanceColor.needsUpdate = true;
    }
    void counts;
  }

  setVis(n, on) {
    for (const p of n.parts) {
      p.mesh.setMatrixAt(p.i, on ? p.m : ZERO);
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  near(x, z, rad) {
    const out = [];
    for (const n of this.nodes) if (Math.abs(n.x - x) < rad && Math.abs(n.z - z) < rad) out.push(n);
    return out;
  }

  kill(n) {
    n.alive = false;
    n.regrow = 240;
    this.setVis(n, false);
  }

  tick(dt) {
    for (const n of this.nodes) {
      if (!n.alive && n.regrow > 0) {
        n.regrow -= dt;
        if (n.regrow <= 0) { n.alive = true; n.hp = n.max; this.setVis(n, true); }
      }
    }
    for (const f of this.flames) {
      const s = 0.85 + Math.random() * 0.35;
      f.scale.set(s, s * (0.9 + Math.random() * 0.3), s);
    }
  }

  setVisible(on) { this.group.visible = on; }
}
