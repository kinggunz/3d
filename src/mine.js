import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { T } from './textures.js';

export const MINE_Y = -80;
const GN = 15; /* grid 15x15 blok */
const CELL = 4;
const WALL_H = 6;
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
  const rest = cand.slice().sort(() => rnd() - 0.5);
  for (const c of rest) {
    if (picked.length >= 4) break;
    if (picked.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 70)) picked.push(c);
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

export function makeEntrance(c) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ map: T.stone, roughness: 1 });
  const rock = new THREE.MeshStandardMaterial({ map: T.rock, roughness: 1 });
  const wood = new THREE.MeshStandardMaterial({ map: T.wood, roughness: 0.95 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050507 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  /* gundukan batu di belakang */
  add(new THREE.DodecahedronGeometry(3.4, 0), rock, 0, 1.2, -2.6).scale.set(1.5, 0.9, 1.1);
  add(new THREE.BoxGeometry(3.4, 3.4, 1.2), dark, 0, 1.2, -0.5);
  add(new THREE.BoxGeometry(0.8, 3.8, 1.0), stone, -1.8, 1.4, 0.1);
  add(new THREE.BoxGeometry(0.8, 3.8, 1.0), stone, 1.8, 1.4, 0.1);
  add(new THREE.BoxGeometry(4.4, 0.8, 1.1), stone, 0, 3.4, 0.1);
  add(new THREE.BoxGeometry(0.22, 3.0, 0.22), wood, -1.25, 1.0, 0.7);
  add(new THREE.BoxGeometry(0.22, 3.0, 0.22), wood, 1.25, 1.0, 0.7);
  add(new THREE.BoxGeometry(2.8, 0.25, 0.22), wood, 0, 2.6, 0.7);
  /* papan nama */
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#5a3a1c'; cx.fillRect(0, 0, 256, 64);
  cx.fillStyle = '#f4efe3'; cx.font = 'bold 34px sans-serif'; cx.textAlign = 'center';
  cx.fillText('⛏ TAMBANG', 128, 44);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  sign.position.set(0, 3.0, 0.72);
  g.add(sign);
  g.position.set(c.x, c.y - 0.2, c.z);
  g.rotation.y = c.ang;
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
    /* area awal selalu terbuka (2x1) */
    open[1][1] = true;
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

    /* pintu keluar di sel awal */
    const sx = this.start.x, sz = this.start.z;
    const wood = new THREE.MeshStandardMaterial({ map: T.wood, roughness: 0.95 });
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new THREE.BoxGeometry(0.3, 3.2, 0.3), wood, sx - 1.6, MINE_Y + 1.6, sz - 1.2);
    add(new THREE.BoxGeometry(0.3, 3.2, 0.3), wood, sx - 1.6, MINE_Y + 1.6, sz + 1.2);
    add(new THREE.BoxGeometry(0.3, 0.3, 2.7), wood, sx - 1.6, MINE_Y + 3.2, sz);
    add(new THREE.BoxGeometry(0.1, 3.0, 2.3), new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.55 }), sx - 1.75, MINE_Y + 1.5, sz);
    this.exit = { x: sx - 1.0, z: sz, r: 1.25 };
    this.spawn = { x: sx + 1.0, z: sz, yaw: -Math.PI / 2 };
    this.torch(sx - 1.4, MINE_Y, sz - 1.7, true);
    this.torch(sx - 1.4, MINE_Y, sz + 1.7, true);
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
