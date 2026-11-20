/* DRIG BIGE 3D SANTAY — kota besar realistis untuk balap motor. Selalu siang. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clamp, lerp, mulberry32 } from './util.js';
import { N } from './world.js';
import { buildBike, normBike, packBike, ENGINES } from './bike.js';
import { MotoSound } from './motosound.js';
import { buildChar } from './chars.js';
import { Audio } from './audio.js';
import { Modif, loadBikeCfg } from './modif.js';

const $ = (id) => document.getElementById(id);
export const GY = 0.035; /* tinggi permukaan jalan */
const P = 100, RW = 12, R0 = -450, NR = 10, CITY = 500;
const road = (i) => R0 + P * i;
export const GARAGE = { x0: 96, x1: 104, z0: 267.2, z1: 277, sx: 100, sz: 273 };
const LOOP = 250; /* sirkuit: jalan x/z = ±250 */
const CPS = [[LOOP, LOOP], [LOOP, -LOOP], [-LOOP, -LOOP], [-LOOP, LOOP]];

export function flatHF() {
  const H = new Float32Array(N * N).fill(GY);
  return { H, sample: () => GY };
}

const cvTex = (w, h, draw, rep = true) => {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

function facadeTex(wall, glass, kind, seed) {
  const r = mulberry32(seed);
  return cvTex(128, 128, (g, W, H) => {
    g.fillStyle = wall; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.025)`; g.fillRect(r() * W, r() * H, 3, 3); }
    const win = (x, y, w, h) => {
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, glass); gr.addColorStop(1, '#0f1a24');
      g.fillStyle = '#2a2a2a'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * 0.6, y); g.lineTo(x + w, y); g.lineTo(x + w * 0.4, y + h); g.fill();
    };
    if (kind === 0) { win(12, 26, 40, 64); win(76, 26, 40, 64); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 118, W, 10); }
    else if (kind === 1) { g.fillStyle = glass; g.fillRect(0, 0, W, H); const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = wall; g.fillRect(0, 0, W, 8); g.fillRect(0, 0, 4, H); g.fillRect(62, 0, 4, H); }
    else { win(6, 30, 116, 52); g.fillStyle = wall; g.fillRect(40, 30, 4, 52); g.fillRect(82, 30, 4, 52); }
  });
}

const STYLES = [
  ['#bdb8ae', '#3d5a74', 0], ['#8d3f2e', '#2b3a46', 0], ['#d8d2c4', '#44627a', 2],
  ['#5c6670', '#86a6c0', 1], ['#e9e6df', '#3a4d5d', 0], ['#7a756c', '#2d3d4b', 2],
];

export const motoMixin = {
  /* ===== kota ===== */
  makeMoto() {
    const S = this.scene;
    this.terrain.visible = false;
    this.water.visible = false;
    for (const n of this.nature.nodes) { if (n.alive) this.nature.kill(n); n.regrow = 1e12; }
    this.nature.clearFlowers();
    this.animals.disable();
    this.edge = CITY;

    /* pantulan lingkungan lembut agar cat motor mengilap */
    try {
      const pm = new THREE.PMREMGenerator(this.r);
      this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      S.environment = this.envTex;
      pm.dispose();
    } catch (e) { /* tanpa pantulan */ }

    /* ---- grid tabrakan ---- */
    const CELL = 24;
    const grid = new Map();
    const solid = (x0, x1, z0, z1, top) => {
      const b = { minx: x0, maxx: x1, minz: z0, maxz: z1, bottom: 0, top: top || 3 };
      for (let cx = Math.floor((x0 - 1.5) / CELL); cx <= Math.floor((x1 + 1.5) / CELL); cx++) {
        for (let cz = Math.floor((z0 - 1.5) / CELL); cz <= Math.floor((z1 + 1.5) / CELL); cz++) {
          const k = cx * 4096 + cz;
          (grid.get(k) || grid.set(k, []).get(k)).push(b);
        }
      }
    };
    const EMPTY = [];
    this.motoNear = (x, z) => grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)) || EMPTY;

    /* ---- geometri bergabung per bahan ---- */
    const geo = {};
    const add = (k, g) => { (geo[k] = geo[k] || []).push(g); };
    const box = (k, x0, x1, y0, y1, z0, z1, uv, sc) => {
      const w = x1 - x0, h = y1 - y0, d = z1 - z0;
      const g = new THREE.BoxGeometry(w, h, d);
      if (uv) {
        const a = g.attributes.uv;
        const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        for (let f = 0; f < 6; f++) {
          for (let v = 0; v < 4; v++) {
            const i = f * 4 + v;
            let u = a.getX(i), t = a.getY(i);
            if (f === 2 && sc === 'swap') { const q = u; u = t; t = q; }
            const du = f === 2 && sc === 'swap' ? dims[f][1] : dims[f][0], dv = f === 2 && sc === 'swap' ? dims[f][0] : dims[f][1];
            a.setXY(i, u * du / uv[0], t * dv / uv[1]);
          }
        }
      }
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      add(k, g);
    };

    const mats = {};
    const L = (o) => new THREE.MeshLambertMaterial(o);
    mats.ground = L({ color: '#8b8982' });
    mats.asphalt = L({ color: '#35373b' });
    mats.walk = L({ color: '#b6b4ac' });
    mats.plot = L({ color: '#a5a29a' });
    mats.roof = L({ color: '#6c7076' });
    mats.metal = L({ color: '#7d838b' });
    mats.dark = L({ color: '#2b2d31' });
    mats.wall = L({ color: '#a8a49b' });
    mats.concrete = L({ color: '#c3c0b8' });
    mats.garage = L({ color: '#4d4f55' });
    mats.yellow = L({ color: '#d9a81c' });
    mats.white = L({ color: '#e8e8e4' });
    mats.tile = L({ color: '#9b4a33' });
    mats.glass = L({ color: '#6f94ad' });
    mats.wood = L({ color: '#6a4a30' });
    mats.red = L({ color: '#a8231f' });
    mats.tyre = L({ color: '#161617' });
    mats.lamp = new THREE.MeshBasicMaterial({ color: '#fff8dc' });
    ['#b32222', '#d8d8d8', '#1b1b1d', '#2b4c8c', '#8f8f93', '#e0b020', '#2d6b46', '#6d2b2b'].forEach((c, i) => { mats['car' + i] = L({ color: c }); });
    STYLES.forEach((s, i) => { mats['w' + i] = L({ map: facadeTex(s[0], s[1], s[2], 100 + i) }); });
    mats.house = L({ map: facadeTex('#e6dcc6', '#40586c', 0, 321) });
    mats.lane = new THREE.MeshBasicMaterial({
      transparent: true, alphaTest: 0.5,
      map: cvTex(8, 64, (g, W, H) => { g.clearRect(0, 0, W, H); g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, W, H * 0.5); }),
    });
    mats.zebra = new THREE.MeshBasicMaterial({
      map: cvTex(64, 64, (g, W, H) => { g.fillStyle = '#35373b'; g.fillRect(0, 0, W, H); g.fillStyle = '#efefea'; g.fillRect(8, 0, 24, H); }),
    });
    mats.check = new THREE.MeshBasicMaterial({
      map: cvTex(64, 64, (g) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * 32, j * 32, 32, 32); } }),
    });
    for (const k in mats) { const m = mats[k]; if (m.map) m.map.needsUpdate = true; }

    /* ---- tanah, jalan, trotoar ---- */
    box('ground', -760, 760, -0.6, 0, -760, 760);
    for (let i = 0; i < NR; i++) {
      const c = road(i);
      box('asphalt', c - RW / 2, c + RW / 2, 0, GY + 0.005, -CITY, CITY);
      box('asphalt', -CITY, CITY, 0, GY + 0.005, c - RW / 2, c + RW / 2);
    }
    for (let i = 0; i < NR - 1; i++) {
      for (let j = 0; j < NR - 1; j++) {
        const x0 = road(i) + RW / 2, x1 = road(i + 1) - RW / 2, z0 = road(j) + RW / 2, z1 = road(j + 1) - RW / 2;
        box('walk', x0, x1, 0, GY - 0.004, z0, z1);
        box('plot', x0 + 3, x1 - 3, 0, GY - 0.002, z0 + 3, z1 - 3);
      }
    }
    /* pinggiran luar kota */
    box('walk', -CITY, -CITY + 44, 0, GY - 0.004, -CITY, CITY);
    box('walk', CITY - 44, CITY, 0, GY - 0.004, -CITY, CITY);
    box('walk', -CITY + 44, CITY - 44, 0, GY - 0.004, -CITY, -CITY + 44);
    box('walk', -CITY + 44, CITY - 44, 0, GY - 0.004, CITY - 44, CITY);
    /* marka jalan */
    for (let i = 0; i < NR; i++) {
      const c = road(i);
      for (let j = 0; j < NR - 1; j++) {
        const a = road(j) + 12, b = road(j + 1) - 12;
        box('lane', c - 0.15, c + 0.15, GY + 0.006, GY + 0.0065, a, b, [0.3, 8]);
        box('lane', a, b, GY + 0.006, GY + 0.0065, c - 0.15, c + 0.15, [0.3, 8], 'swap');
      }
    }
    for (let i = 0; i < NR; i++) {
      for (let j = 0; j < NR; j++) {
        const cx = road(i), cz = road(j);
        for (const s of [-1, 1]) {
          box('zebra', cx - 5.6, cx + 5.6, GY + 0.006, GY + 0.0068, cz + s * 8.6 - 1.2, cz + s * 8.6 + 1.2, [4, 2.4], 'swap');
          box('zebra', cx + s * 8.6 - 1.2, cx + s * 8.6 + 1.2, GY + 0.006, GY + 0.0068, cz - 5.6, cz + 5.6, [2.4, 4]);
        }
      }
    }

    /* ---- gedung ---- */
    const rnd = mulberry32(5201);
    const building = (x0, x1, z0, z1, h, st) => {
      box('w' + st, x0, x1, 0, h, z0, z1, [6, 3.6]);
      box('roof', x0 - 0.25, x1 + 0.25, h, h + 0.5, z0 - 0.25, z1 + 0.25);
      if (h > 20) { /* mesin atap */
        const w = x1 - x0, d = z1 - z0;
        box('metal', x0 + w * 0.2, x0 + w * 0.2 + 4, h + 0.5, h + 2.4, z0 + d * 0.3, z0 + d * 0.3 + 3);
        box('metal', x1 - w * 0.25 - 3, x1 - w * 0.25, h + 0.5, h + 1.8, z1 - d * 0.3 - 3, z1 - d * 0.3);
      }
      solid(x0, x1, z0, z1, h);
    };
    const car = (x, z, ang, ci) => {
      const c = 'car' + ci, w = ang ? 1.8 : 4.3, d = ang ? 4.3 : 1.8;
      box(c, x - w / 2, x + w / 2, 0.3, 1.0, z - d / 2, z + d / 2);
      box('glass', x - (ang ? 0.8 : 1.1), x + (ang ? 0.8 : 1.1), 1.0, 1.65, z - (ang ? 1.1 : 0.8), z + (ang ? 1.1 : 0.8));
      box(c, x - (ang ? 0.78 : 0.9), x + (ang ? 0.78 : 0.9), 1.65, 1.72, z - (ang ? 0.9 : 0.78), z + (ang ? 0.9 : 0.78));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const wx = ang ? sx * 0.9 : sx * 1.4, wz = ang ? sz * 1.4 : sz * 0.9;
        box('tyre', x + wx - (ang ? 0.15 : 0.35), x + wx + (ang ? 0.15 : 0.35), 0, 0.62, z + wz - (ang ? 0.35 : 0.15), z + wz + (ang ? 0.35 : 0.15));
      }
      solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 1.7);
    };
    for (let bi = 0; bi < NR - 1; bi++) {
      for (let bj = 0; bj < NR - 1; bj++) {
        if (bi === 5 && bj === 7) continue; /* blok rumah garasi */
        const x0 = road(bi) + RW / 2 + 5, x1 = road(bi + 1) - RW / 2 - 5, z0 = road(bj) + RW / 2 + 5, z1 = road(bj + 1) - RW / 2 - 5;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const down = clamp(1.25 - Math.hypot(cx, cz) / 650, 0.35, 1.2);
        if (bi === 4 && bj === 4) { /* alun-alun tengah */
          box('concrete', -36, 36, GY - 0.001, GY + 0.04, -36, 36);
          box('white', -5, 5, 0, 1.2, -5, 5); box('white', -3, 3, 1.2, 2.4, -3, 3); box('metal', -0.9, 0.9, 2.4, 26, -0.9, 0.9);
          solid(-5, 5, -5, 5, 3); solid(-0.9, 0.9, -0.9, 0.9, 26);
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box('concrete', sx * 24 - 3, sx * 24 + 3, 0, 0.5, sz * 24 - 3, sz * 24 + 3); }
          continue;
        }
        const t = rnd();
        const st = () => (rnd() * STYLES.length) | 0;
        if (t < 0.34) {
          const w = 34 + rnd() * 26, d = 34 + rnd() * 26;
          building(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, (24 + rnd() * 70) * down, st());
        } else if (t < 0.64) {
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            const w = 28 + rnd() * 8, d = 28 + rnd() * 8, ox = cx + sx * 21, oz = cz + sz * 21;
            building(ox - w / 2, ox + w / 2, oz - d / 2, oz + d / 2, (12 + rnd() * 26) * down + 4, st());
          }
        } else if (t < 0.86) {
          /* ruko + lahan parkir */
          building(x0, x1, z0, z0 + 17, 7 + rnd() * 5, st());
          building(x0, x1, z1 - 17, z1, 7 + rnd() * 5, st());
          for (let k = 0; k < 6; k++) { const lx = x0 + 12 + k * 11; box('white', lx, lx + 0.2, GY, GY + 0.01, cz - 12, cz - 4); box('white', lx, lx + 0.2, GY, GY + 0.01, cz + 4, cz + 12); }
          for (let k = 0; k < 6; k++) { if (rnd() < 0.7) car(x0 + 17 + k * 11, cz - 8, 1, (rnd() * 8) | 0); if (rnd() < 0.7) car(x0 + 17 + k * 11, cz + 8, 1, (rnd() * 8) | 0); }
        } else {
          building(x0, x1, z0, z0 + 26, 14 + rnd() * 10, st());
          building(x0, x1, z1 - 26, z1, 14 + rnd() * 10, st());
        }
      }
    }

    /* ---- pohon HANYA di tepi jalan (instancing) ---- */
    const trees = [];
    const nearCross = (s) => { for (let k = 0; k < NR; k++) if (Math.abs(s - road(k)) < 15) return true; return false; };
    for (let i = 0; i < NR; i++) {
      const c = road(i);
      for (let s = -CITY + 20; s < CITY - 10; s += 30) {
        const ss = s + (rnd() - 0.5) * 6;
        if (nearCross(ss)) continue;
        for (const side of [-1, 1]) {
          trees.push([c + side * 7.6, ss]);
          trees.push([ss, c + side * 7.6]);
        }
      }
    }
    const MAXT = trees.length;
    const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 1, 7).translate(0, 0.5, 0), L({ color: '#5a4636' }), MAXT);
    const crownM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), L({ color: '#ffffff', flatShading: false }), MAXT * 2);
    const dm = new THREE.Object3D(), col = new THREE.Color();
    trees.forEach(([x, z], i) => {
      const s = 0.85 + rnd() * 0.5;
      dm.position.set(x, 0, z); dm.scale.set(s, 3.2 * s, s); dm.rotation.set(0, 0, 0); dm.updateMatrix(); trunkM.setMatrixAt(i, dm.matrix);
      col.setHSL(0.25 + rnd() * 0.06, 0.32 + rnd() * 0.12, 0.2 + rnd() * 0.08);
      dm.position.set(x, 3.9 * s, z); dm.scale.set(2.1 * s, 1.9 * s, 2.1 * s); dm.updateMatrix(); crownM.setMatrixAt(i * 2, dm.matrix); crownM.setColorAt(i * 2, col);
      dm.position.set(x + 0.3 * s, 5.2 * s, z - 0.2 * s); dm.scale.set(1.5 * s, 1.4 * s, 1.5 * s); dm.updateMatrix(); crownM.setMatrixAt(i * 2 + 1, dm.matrix); crownM.setColorAt(i * 2 + 1, col);
      solid(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 6);
    });
    trunkM.frustumCulled = crownM.frustumCulled = false;
    S.add(trunkM, crownM);

    /* ---- tiang lampu jalan ---- */
    for (let i = 0; i < NR; i++) {
      const c = road(i);
      for (let s = -CITY + 40; s < CITY - 30; s += 50) {
        if (nearCross(s)) continue;
        const side = ((i + Math.round(s / 50)) & 1) ? 1 : -1;
        const px = c + side * 7.9;
        box('metal', px - 0.09, px + 0.09, 0, 7.5, s - 0.09, s + 0.09);
        box('metal', px - side * 2.2, px, 7.4, 7.55, s - 0.06, s + 0.06);
        box('dark', px - side * 2.5, px - side * 1.6, 7.3, 7.42, s - 0.2, s + 0.2);
        solid(px - 0.2, px + 0.2, s - 0.2, s + 0.2, 7.5);
      }
    }

    /* ---- tembok pembatas kota ---- */
    box('wall', -CITY - 1, -CITY, 0, 4, -CITY - 1, CITY + 1); box('wall', CITY, CITY + 1, 0, 4, -CITY - 1, CITY + 1);
    box('wall', -CITY, CITY, 0, 4, -CITY - 1, -CITY); box('wall', -CITY, CITY, 0, 4, CITY, CITY + 1);

    /* ---- rumah + garasi pemain ---- */
    this.motoLights = [];
    {
      const H1 = 4.2, H2 = 7.2, T = 0.4;
      const g = GARAGE;
      /* halaman & jalan masuk */
      box('concrete', 96.5, 103.5, GY - 0.001, GY + 0.02, 258.9, 267);
      box('white', 80, 120, GY - 0.001, GY + 0.015, 259, 266);
      box('garage', g.x0 - 0.4, g.x1 + 0.4, GY - 0.001, GY + 0.03, 266.6, 277.4);
      box('yellow', g.x0, g.x1, GY + 0.03, GY + 0.036, 267, 267.25);
      box('yellow', g.x0, g.x0 + 0.2, GY + 0.03, GY + 0.036, 267, 277); box('yellow', g.x1 - 0.2, g.x1, GY + 0.03, GY + 0.036, 267, 277);
      /* dinding garasi */
      box('house', g.x0 - T, g.x0, 0, H1, 266.6, 277.4, [4, 3.2]); solid(g.x0 - T, g.x0, 266.6, 277.4, H1);
      box('house', g.x1, g.x1 + T, 0, H1, 266.6, 277.4, [4, 3.2]); solid(g.x1, g.x1 + T, 266.6, 277.4, H1);
      box('house', g.x0, g.x1, 0, H1, 277, 277.4, [4, 3.2]); solid(g.x0, g.x1, 277, 277.4, H1);
      box('house', g.x0 - T, 97, 0, H1, 266.6, 267, [4, 3.2]); solid(g.x0 - T, 97, 266.6, 267, H1);
      box('house', 103, g.x1 + T, 0, H1, 266.6, 267, [4, 3.2]); solid(103, g.x1 + T, 266.6, 267, H1);
      box('house', 97, 103, 3.4, H1, 266.6, 267, [4, 3.2]);
      box('metal', 97, 103, 3.2, 3.4, 267, 270.4); /* pintu gulung terbuka */
      box('dark', g.x0, g.x1, H1, H1 + 0.15, 266.6, 277.4);
      /* lampu & perabot garasi */
      for (const z of [270, 275]) { box('lamp', 99, 101, H1 - 0.15, H1, z - 0.3, z + 0.3); this.motoLights.push({ x: 100, y: H1 - 0.6, z, c: 0xfff1d6, rng: 16, i: 1.8 }); }
      box('metal', 96.1, 98.3, 0, 0.9, 276.2, 276.95); box('wood', 96, 98.4, 0.9, 1.0, 276, 277); /* meja kerja */
      box('red', 96.15, 97.3, 1.0, 1.35, 276.3, 276.8); solid(96, 98.4, 276, 277, 1.0);
      box('metal', 102.9, 103.9, 0, 2.2, 276.2, 276.9); box('dark', 103, 103.8, 0.4, 0.5, 276.3, 276.8); box('dark', 103, 103.8, 1.1, 1.2, 276.3, 276.8); box('red', 103.05, 103.45, 1.2, 1.7, 276.4, 276.7); solid(102.9, 103.9, 276.2, 276.9, 2.2);
      for (let k = 0; k < 4; k++) box('tyre', 96.2, 97.1, k * 0.25, k * 0.25 + 0.25, 268, 268.9);
      solid(96.2, 97.1, 268, 268.9, 1);
      box('red', 103.1, 103.8, 0, 1.0, 268.2, 268.9); solid(103.1, 103.8, 268.2, 268.9, 1.0); /* drum oli */
      box('yellow', 96, 103.9, 1.6, 2.2, 277.0, 277.02);
      /* badan rumah */
      box('house', 78, 95.6, 0, H2, 266, 296, [4, 3.2]); solid(78, 95.6, 266, 296, H2);
      box('house', 104.4, 122, 0, H2, 266, 296, [4, 3.2]); solid(104.4, 122, 266, 296, H2);
      box('house', 95.6, 104.4, 0, H2, 277.4, 296, [4, 3.2]); solid(95.6, 104.4, 277.4, 296, H2);
      box('house', 95.6, 104.4, H1 + 0.15, H2, 266, 277.4, [4, 3.2]);
      box('concrete', 77.7, 122.3, H2, H2 + 0.35, 265.7, 296.3);
      /* atap pelana */
      const roofSlab = (x0, x1, z0, zm, sgn) => {
        const run = Math.abs(zm - z0), rise = 2.2, len = Math.hypot(run, rise), a = Math.atan2(rise, run);
        const gg = new THREE.BoxGeometry(x1 - x0, 0.25, len);
        gg.rotateX(sgn * a);
        gg.translate((x0 + x1) / 2, H2 + 0.35 + rise / 2, (z0 + zm) / 2);
        add('tile', gg);
      };
      roofSlab(77, 123, 265.4, 281, -1); roofSlab(77, 123, 296.6, 281, 1);
      /* kanopi + papan nama */
      box('metal', 94, 106, 4.4, 4.55, 264.6, 266.6);
      for (const x of [94.2, 105.8]) box('metal', x - 0.1, x + 0.1, 0, 4.4, 264.7, 264.9);
      /* pagar halaman */
      for (const [a, b, c, d] of [[76, 77, 259, 297], [123, 124, 259, 297], [76, 124, 296.6, 297.6]]) { box('wall', a, b, 0, 1.6, c, d); solid(a, b, c, d, 1.6); }
      box('wall', 76, 94, 0, 1.2, 259.6, 260.1); box('wall', 106, 124, 0, 1.2, 259.6, 260.1);
      solid(76, 94, 259.6, 260.1, 1.2); solid(106, 124, 259.6, 260.1, 1.2);
      /* papan GARASI */
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.2), new THREE.MeshBasicMaterial({
        map: cvTex(512, 128, (c) => { c.fillStyle = '#16181c'; c.fillRect(0, 0, 512, 128); c.strokeStyle = '#d9a81c'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 116); c.fillStyle = '#f2f2ee'; c.font = '900 76px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GARASI SANTAY', 256, 68); }, false),
      }));
      sign.position.set(100, 5.7, 265.92); sign.rotation.y = Math.PI;
      S.add(sign);
    }

    /* ---- gerbang START / FINISH + penanda checkpoint ---- */
    {
      box('metal', -0.3, 0.3, 0, 7.5, 241.4, 242.2); box('metal', -0.3, 0.3, 0, 7.5, 257.8, 258.6);
      box('metal', -0.3, 0.3, 6.6, 7.6, 241.4, 258.6);
      solid(-0.3, 0.3, 241.4, 242.2, 7.5); solid(-0.3, 0.3, 257.8, 258.6, 7.5);
      box('check', -1.5, 1.5, GY + 0.007, GY + 0.0075, 244, 256, [3, 3]);
      const banner = new THREE.MeshBasicMaterial({
        map: cvTex(512, 128, (c) => { c.fillStyle = '#101216'; c.fillRect(0, 0, 512, 128); for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#fff' : '#111'; c.fillRect(i * 16, 0, 16, 10); c.fillRect(i * 16, 118, 16, 10); } c.fillStyle = '#fff'; c.font = '900 70px Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('START · FINISH', 256, 66); }, false),
      });
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.4), banner);
        m.position.set(0.32 * sx, 5.1, 250); m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        S.add(m);
      }
      this.cpMarks = CPS.map(([x, z]) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 26, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x4fb6ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
        m.position.set(x, 13, z); S.add(m); return m;
      });
    }

    for (const k in geo) {
      const mesh = new THREE.Mesh(mergeGeometries(geo[k]), mats[k] || mats.wall);
      mesh.frustumCulled = false;
      S.add(mesh);
    }
    this.cityMats = mats;

    /* ---- motor pemain ---- */
    this.bikeCfg = loadBikeCfg();
    this.bk = { x: GARAGE.sx, z: GARAGE.sz, yaw: 0, v: 0, st: 0, stIn: 0, lean: 0, pitch: 0, dist: 0, rpm: 1500, nos: 0, nosCd: 0, shake: 0, lastHit: 0, gear: 0, cam: 0 };
    this.mc = { gas: 0, brake: 0, left: 0, right: 0, hb: 0, nos: 0 };
    this.camOff = { yaw: 0, pitch: 0, t: 0 };
    this.race = { on: false, cp: 0, t: 0, best: +(localStorage.getItem('ps_drig_best') || 0) || 0, last: 0, laps: 0, flash: 0 };
    this.mkBike();
    this.motoHudBuild();
    this.motoBind();
    this.msound = new MotoSound(this.bikeCfg);
    $('hud').classList.add('moto');
    Audio.ambient(false);
    const p = this.p;
    p.spawn = { x: GARAGE.sx, z: GARAGE.sz };
    p.x = GARAGE.sx; p.z = GARAGE.sz; p.y = GY; p.yaw = 0;
    this.timers.push(setTimeout(() => this.toast('Selamat datang di DRIG BIGE! Tahan GAS untuk jalan. Masuk garasi → tombol MODIF.'), 1200));
  },

  mkBike() {
    if (this.myBike) { this.scene.remove(this.myBike.root); this.disposeBike(this.myBike); }
    const bk = buildBike(this.bikeCfg);
    bk.setRider(buildChar(this.myLook));
    this.scene.add(bk.root);
    this.myBike = bk;
    this.bikeStr = packBike(this.bikeCfg);
    this.bikeLv = null;
    if (this.bikeCfg.livery) {
      const im = new Image();
      im.onload = () => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 64;
        cv.getContext('2d').drawImage(im, 0, 0, 64, 64);
        this.bikeLv = cv.toDataURL('image/jpeg', 0.6);
      };
      im.src = this.bikeCfg.livery;
    }
    if (this.bk) bk.root.position.set(this.bk.x, GY, this.bk.z);
  },

  disposeBike(b) {
    b.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const m of b.mats) { if (m.map) m.map.dispose(); m.dispose(); }
  },

  applyBike(cfg) {
    this.bikeCfg = normBike(cfg);
    this.mkBike();
    if (this.msound) this.msound.setCfg(this.bikeCfg);
    this.pSeq = 0; /* kirim ulang tampilan ke pemain lain */
  },

  /* ===== kontrol ===== */
  motoHudBuild() {
    const old = $('motoHud'); if (old) old.remove();
    const h = document.createElement('div');
    h.id = 'motoHud';
    h.innerHTML = `
      <canvas id="mMap" width="150" height="150"></canvas>
      <div id="mSpeed"><b id="mSpd">0</b><span>km/h</span><div class="rpmBar"><i id="mRpm"></i></div><em id="mGear"></em></div>
      <div id="mLap"></div>
      <div class="mSide">
        <button id="mHorn" class="mSm">KLAKSON</button>
        <button id="mCam" class="mSm">KAMERA</button>
        <button id="mHome" class="mSm">GARASI</button>
      </div>
      <div class="mPad left"><button id="mL" class="mBig">&#9664;</button><button id="mR" class="mBig">&#9654;</button></div>
      <div class="mPad right"><button id="mBrk" class="mBtn">REM</button><button id="mNos" class="mBtn nos">NOS</button><button id="mGas" class="mBtn gas">GAS</button></div>`;
    $('hud').appendChild(h);
    this.mmCv = $('mMap');
    const sig = { signal: this.ac.signal };
    const hold = (id, key) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ } this.mc[key] = 1; el.classList.add('down'); }, sig);
      const up = () => { this.mc[key] = 0; el.classList.remove('down'); };
      el.addEventListener('pointerup', up, sig); el.addEventListener('pointercancel', up, sig); el.addEventListener('lostpointercapture', up, sig);
    };
    hold('mGas', 'gas'); hold('mBrk', 'brake'); hold('mL', 'left'); hold('mR', 'right'); hold('mNos', 'nos');
    const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }, sig);
    tap('mHorn', () => this.motoHorn());
    tap('mCam', () => this.motoCycleCam());
    tap('mHome', () => this.motoGoHome());
    this.timers.push(setInterval(() => this.motoDrawMap(), 110));
  },

  motoBind() {
    const sig = { signal: this.ac.signal };
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { this.mc.hb = 1; e.preventDefault(); }
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.mc.nos = 1;
      else if (e.code === 'KeyH') this.motoHorn();
      else if (e.code === 'KeyC') this.motoCycleCam();
      else if (e.code === 'KeyG') this.motoGoHome();
    }, sig);
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.mc.hb = 0;
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.mc.nos = 0;
    }, sig);
  },

  motoHorn() { if (this.msound) this.msound.horn(); },
  motoCycleCam() {
    this.bk.cam = (this.bk.cam + 1) % 3;
    this.toast(['Kamera belakang', 'Kamera jauh', 'Kamera pengendara'][this.bk.cam]);
  },
  motoGoHome() {
    if (this.modifOpen) return;
    const b = this.bk;
    b.x = GARAGE.sx; b.z = GARAGE.sz; b.yaw = 0; b.v = 0; b.st = b.stIn = 0; b.lean = 0;
    this.race.on = false;
    this.toast('Kembali ke garasi');
  },

  /* geser layar = putar kamera di sekitar motor */
  motoLook(dx, dy) {
    const s = 0.005;
    this.camOff.yaw = clamp(this.camOff.yaw - dx * s, -2.6, 2.6);
    this.camOff.pitch = clamp(this.camOff.pitch + dy * s, -0.3, 0.7);
    this.camOff.t = 1.6;
  },

  inGarage() {
    const b = this.bk, g = GARAGE;
    return b.x > g.x0 && b.x < g.x1 && b.z > g.z0 && b.z < g.z1;
  },

  motoCtx() {
    if (this.modifOpen) return null;
    if (this.inGarage() && Math.abs(this.bk.v) < 4) return { id: 'modif', ic: 'gear', t: 'MODIF' };
    return null;
  },

  openModif() {
    if (this.modifOpen) return;
    const b = this.bk, g = GARAGE;
    b.x = g.sx; b.z = g.sz; b.yaw = 0; b.v = 0; b.st = b.stIn = 0;
    this.modif = new Modif(this);
    this.modif.open();
  },

  /* ===== fisika + kamera, tiap frame ===== */
  motoUpdate(dt) {
    const b = this.bk, p = this.p, cfg = this.bikeCfg;
    this.t = 0.38; /* siang terus */
    p.hp = 100; p.hunger = 100; p.thirst = 100;
    const busy = this.modifOpen || this.paused;
    const K = this.keys, M = this.mc;
    const thr = busy ? 0 : clamp(M.gas + K.w, 0, 1);
    const brk = busy ? 0 : clamp(M.brake + K.s, 0, 1);
    const str = busy ? 0 : clamp(M.right - M.left + K.d - K.a, -1, 1);
    const hb = busy ? 0 : M.hb;
    const E = ENGINES[cfg.engine];
    b.nosCd = Math.max(0, b.nosCd - dt);
    const wantNos = !busy && M.nos && b.nosCd <= 0 && b.nos < 3.2;
    if (wantNos) b.nos += dt; else if (b.nos > 0) { if (b.nos >= 3.2 || !M.nos) { if (b.nos > 0.2) b.nosCd = 4; b.nos = 0; } }
    const boost = wantNos ? 1 : 0;
    const vmax = E.vmax * (1 + boost * 0.32);
    const acc = 7.4 * E.acc * (1 + boost * 0.8);
    let a = 0;
    if (b.v >= 0) {
      if (thr > 0) a += acc * thr * (1 - Math.pow(clamp(b.v / vmax, 0, 1.2), 2.2));
      if (brk > 0) { if (b.v > 0.4) a -= 17 * brk; else a -= 3.2 * brk; }
    } else {
      if (thr > 0) a += 15 * thr;
      if (brk > 0) a -= 3.2 * brk;
    }
    if (b.v > vmax) a -= (b.v - vmax) * 2.5;
    a -= Math.sign(b.v) * (0.5 + 0.0016 * b.v * b.v);
    if (hb && Math.abs(b.v) > 0.3) a -= Math.sign(b.v) * 9;
    const v0 = b.v;
    b.v += a * dt;
    if (!thr && !brk && Math.abs(b.v) < 0.25) b.v = 0;
    if (v0 > 0 && b.v < 0 && !brk) b.v = 0;
    b.v = clamp(b.v, -5, vmax * 1.1);
    /* kemudi */
    b.stIn = lerp(b.stIn, str, Math.min(1, dt * 7));
    const sp = Math.abs(b.v);
    const maxSt = lerp(0.62, 0.1, Math.pow(clamp(sp / 34, 0, 1), 0.55));
    b.st = b.stIn * maxSt;
    const yawRate = (b.v / 1.26) * Math.tan(b.st) * (hb ? 1.5 : 1);
    b.yaw -= yawRate * dt;
    const targetLean = clamp(-Math.atan((b.v * yawRate) / 9.8), -0.62, 0.62);
    b.lean = lerp(b.lean, targetLean, Math.min(1, dt * 6));
    b.pitch = lerp(b.pitch, clamp(a * 0.004, -0.07, 0.06), Math.min(1, dt * 5));
    /* gerak + tabrakan */
    const steps = Math.max(1, Math.ceil((sp * dt) / 0.4));
    const sdt = dt / steps;
    let hit = 0;
    for (let i = 0; i < steps; i++) {
      let nx = b.x - Math.sin(b.yaw) * b.v * sdt, nz = b.z - Math.cos(b.yaw) * b.v * sdt;
      const ox = nx, oz = nz;
      [nx, nz] = this.boxPush(this.motoNear(nx, nz), nx, nz, 0, 1.5, 0.5);
      const lim = CITY - 2;
      nx = clamp(nx, -lim, lim); nz = clamp(nz, -lim, lim);
      const pd = Math.hypot(nx - ox, nz - oz);
      if (pd > 0.0005) { hit = Math.max(hit, pd); b.v *= 0.93; }
      b.x = nx; b.z = nz;
    }
    const now = performance.now();
    if (hit > 0.003 && sp > 6 && now - b.lastHit > 500) {
      b.lastHit = now; b.shake = Math.min(1, sp / 25); b.v *= 0.55;
      Audio.sfx('hit');
      this.burst(b.x, 0.6, b.z, 0xb0b0b0, 8);
    }
    b.shake = Math.max(0, b.shake - dt * 2.5);
    b.dist += b.v * dt;
    p.x = b.x; p.z = b.z; p.y = GY; p.yaw = b.yaw; p.vy = 0;
    this.moving = sp > 0.3;

    /* model motor */
    const bk = this.myBike;
    bk.root.position.set(b.x, GY, b.z);
    bk.root.rotation.set(b.pitch, b.yaw, 0, 'YXZ');
    bk.update(b.dist, b.st * 0.9, b.lean, brk > 0 || hb);
    if (hb && sp > 6 && Math.random() < 0.5) this.burst(b.x + Math.sin(b.yaw) * 0.6, 0.15, b.z + Math.cos(b.yaw) * 0.6, 0xd8d8d8, 2);
    if (boost && Math.random() < 0.7) this.burst(b.x + Math.sin(b.yaw) * 1.1, 0.4, b.z + Math.cos(b.yaw) * 1.1, 0x5ab4ff, 2);

    /* suara mesin */
    const idle = 1500;
    const launch = thr * 3800 * (1 - clamp(sp / 10, 0, 1));
    const target = idle + launch + (sp / vmax) * 5600 + thr * 900 + boost * 700;
    b.rpm = lerp(b.rpm, target, Math.min(1, dt * (thr ? 5 : 2.5)));
    if (this.msound) this.msound.update(b.rpm, thr, this.modifOpen ? 0 : 1);

    this.motoCamera(dt, sp, vmax);
    this.motoRace(dt);
    this.motoHudUpdate(sp, vmax, boost);
  },

  motoCamera(dt, sp, vmax) {
    const b = this.bk, co = this.camOff;
    if (co.t > 0) co.t -= dt; else { co.yaw = lerp(co.yaw, 0, Math.min(1, dt * 3)); co.pitch = lerp(co.pitch, 0, Math.min(1, dt * 3)); }
    const cam = this.cam;
    const yaw = b.yaw + co.yaw;
    const k = clamp(sp / vmax, 0, 1);
    cam.fov = lerp(cam.fov, 70 + k * 22, Math.min(1, dt * 3));
    cam.updateProjectionMatrix();
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const mode = b.cam;
    let px, py, pz, tx, ty, tz;
    const hide = mode === 2;
    if (this.myBike.rider) this.myBike.rider.visible = !hide;
    if (mode === 2) {
      const bfx = -Math.sin(b.yaw), bfz = -Math.cos(b.yaw);
      px = b.x - bfx * 0.15; py = GY + 1.5; pz = b.z - bfz * 0.15;
      tx = px + fx * 10; ty = py - 0.2 - co.pitch * 8; tz = pz + fz * 10;
    } else {
      let dist = (mode === 0 ? 4.4 : 7.2) + k * 1.4;
      let h = (mode === 0 ? 1.9 : 3.1) + co.pitch * 4 + k * 0.2;
      if (this.inGarage()) { dist = Math.min(dist, 3.0); h = Math.min(h, 2.2); }
      px = b.x - fx * dist; py = GY + h; pz = b.z - fz * dist;
      tx = b.x + fx * 3; ty = GY + 1.0; tz = b.z + fz * 3;
    }
    const sh = b.shake * 0.12;
    if (sh > 0) { px += (Math.random() - 0.5) * sh; py += (Math.random() - 0.5) * sh; }
    cam.position.set(px, py, pz);
    cam.lookAt(tx, ty, tz);
    this.eye.set(px, py, pz);
  },

  /* ===== balapan ===== */
  motoRace(dt) {
    const r = this.race, b = this.bk;
    if (r.on) r.t += dt;
    r.flash = Math.max(0, r.flash - dt);
    /* garis start di (0, 250) */
    const onLine = b.z > 244 && b.z < 256;
    const px = this.prevX === undefined ? b.x : this.prevX;
    if (onLine && px < 0 && b.x >= 0) {
      if (r.on && r.cp >= 4) {
        r.last = r.t; r.laps++;
        if (!r.best || r.t < r.best) { r.best = r.t; try { localStorage.setItem('ps_drig_best', String(r.t)); } catch (e) { /* abaikan */ } this.toast('REKOR BARU! ' + r.t.toFixed(2) + ' dtk'); } else this.toast('Lap selesai: ' + r.t.toFixed(2) + ' dtk');
        Audio.sfx('quest');
        r.flash = 3;
      } else if (!r.on) this.toast('BALAPAN DIMULAI! Lewati 4 checkpoint biru searah jarum jam.');
      r.on = true; r.t = 0; r.cp = 0;
    } else if (onLine && px >= 0 && b.x < 0 && r.on) { r.on = false; this.toast('Salah arah! Balapan dibatalkan'); }
    this.prevX = b.x;
    if (r.on && r.cp < 4) {
      const [cx, cz] = CPS[r.cp];
      if (Math.hypot(b.x - cx, b.z - cz) < 16) { r.cp++; Audio.sfx('quest'); this.toast(r.cp < 4 ? `Checkpoint ${r.cp}/4` : 'Semua checkpoint! Menuju garis FINISH'); }
    }
    if (this.cpMarks) this.cpMarks.forEach((m, i) => { m.visible = r.on && i === r.cp; });
  },

  motoHudUpdate(sp, vmax, boost) {
    const kmh = Math.round(Math.abs(this.bk.v) * 3.6);
    if (kmh !== this._kmh) { this._kmh = kmh; $('mSpd').textContent = kmh; }
    $('mRpm').style.width = clamp(((this.bk.rpm - 1200) / 8300) * 100, 0, 100) + '%';
    $('mRpm').style.background = this.bk.rpm > 8000 ? '#e0453a' : '#d9d9dc';
    const r = this.race;
    const txt = r.on ? `LAP ${r.laps + 1} · ${r.t.toFixed(1)}s · CP ${r.cp}/4` : 'Lewati gerbang START untuk balapan';
    const full = txt + (r.best ? ` · Terbaik ${r.best.toFixed(2)}s` : '') + (boost ? ' · NOS!' : this.bk.nosCd > 0 ? ' · NOS isi ulang' : '');
    if (full !== this._lapTxt) { this._lapTxt = full; $('mLap').textContent = full; }
  },

  motoDrawMap() {
    const cv = this.mmCv;
    if (!cv || !this.bk) return;
    const g = cv.getContext('2d'), W = cv.width, k = W / 360, b = this.bk;
    const s = Math.sin(b.yaw), c = Math.cos(b.yaw);
    const T = (x, z) => { const dx = x - b.x, dz = z - b.z; return [W / 2 + (dx * c - dz * s) * k, W / 2 + (dx * s + dz * c) * k]; };
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 1, 0, 7); g.clip();
    g.fillStyle = 'rgba(30,34,40,.88)'; g.fillRect(0, 0, W, W);
    g.strokeStyle = '#6f757d'; g.lineWidth = RW * k;
    for (let i = 0; i < NR; i++) {
      const rc = road(i);
      let a = T(rc, -CITY), z = T(rc, CITY); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(z[0], z[1]); g.stroke();
      a = T(-CITY, rc); z = T(CITY, rc); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(z[0], z[1]); g.stroke();
    }
    g.strokeStyle = '#e0a030'; g.lineWidth = 3; g.beginPath();
    CPS.concat([CPS[0]]).forEach(([x, z], i) => { const q = T(x, z); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    g.stroke();
    const h = T(GARAGE.sx, GARAGE.sz); g.fillStyle = '#58b0ff'; g.fillRect(h[0] - 3, h[1] - 3, 6, 6);
    const st = T(0, 250); g.fillStyle = '#fff'; g.fillRect(st[0] - 3, st[1] - 3, 6, 6);
    if (this.race.on && this.race.cp < 4) { const q = T(CPS[this.race.cp][0], CPS[this.race.cp][1]); g.fillStyle = '#4fb6ff'; g.beginPath(); g.arc(q[0], q[1], 5, 0, 7); g.fill(); }
    for (const r of this.remotes.values()) { if (r.x === undefined) continue; const q = T(r.x, r.z); g.fillStyle = '#ff5a4f'; g.beginPath(); g.arc(q[0], q[1], 3.5, 0, 7); g.fill(); }
    g.restore();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(W / 2, W / 2 - 7); g.lineTo(W / 2 + 5, W / 2 + 6); g.lineTo(W / 2 - 5, W / 2 + 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 1, 0, 7); g.stroke();
  },

  /* ===== pemain lain (motor) ===== */
  motoRemoteNew(r, m, g) {
    const cfg = (m.mo && JSON.parse(m.mo)) || {};
    const bk = buildBike(cfg);
    bk.setRider(g);
    this.scene.add(bk.root);
    r.bike = bk; r.mo = m.mo || ''; r.dist = 0; r.sp = 0; r.stg = 0; r.ln = 0;
    r.bx = m.x; r.bz = m.z;
  },

  motoRemoteCfg(r, m) {
    if (!r.bike) return;
    let cfg = null;
    try { cfg = JSON.parse(m.mo || r.mo); } catch (e) { return; }
    if (m.lv) cfg.livery = m.lv; else if (r.lv) cfg.livery = r.lv;
    const rider = r.bike.rider;
    this.scene.remove(r.bike.root);
    r.bike.lean.remove(rider);
    this.disposeBike(r.bike);
    r.bike = buildBike(cfg);
    r.bike.setRider(rider);
    this.scene.add(r.bike.root);
    if (m.mo) r.mo = m.mo;
    if (m.lv) r.lv = m.lv;
  },

  motoRemoteUpdate(r, dt) {
    if (!r.bike || r.tx === undefined) return;
    const k = Math.min(1, dt * 9);
    r.x = lerp(r.x, r.tx, k); r.z = lerp(r.z, r.tz, k);
    let da = r.try - r.ry;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    r.ry += da * k;
    r.dist += (r.sp || 0) * dt;
    r.stg = lerp(r.stg, r.tst || 0, k); r.ln = lerp(r.ln, r.tln || 0, k);
    r.bike.root.position.set(r.x, GY, r.z);
    r.bike.root.rotation.set(0, r.ry, 0);
    r.bike.update(r.dist, r.stg * 0.9, r.ln, false);
  },
};
