/* PETUALANGAN WAR: istana megah (tertutup), arena PvP besar di dalam, toko armor, dan mini-game di tiap lantai */
import * as THREE from 'three';
import { buildChar, normLook } from './chars.js';
import { pieceMat } from './pieces.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const Y = 3.2;
export const ARMOR = [
  { n: 'Tanpa Armor', p: 0, r: 0 },
  { n: 'Baju Kain', p: 150, r: 0.15 },
  { n: 'Baju Besi', p: 400, r: 0.35 },
  { n: 'Armor Emas Raja', p: 900, r: 0.55 },
];
const SELL = { kayu: 3, batu: 3, serat: 2, buah: 4, daging: 10, ikan: 8, matang: 18, ikanmatang: 15, sup: 25, bijih: 12, besi: 30, batubara: 8 };

const FH = 4, T = 0.6;
const HS = [30, 30, 30, 22, 22, 22, 14, 14, 14, 14]; /* setengah lebar tiap lantai */
/* arena besar di aula lantai dasar (bagian selatan) */
const ARENA = { x0: -20, x1: 20, z0: 1, z1: 27 };
const VILL = [
  { n: 'Pak Armor', x: -16, z: -12, shirt: '#8a3b2a', hat: '#c9a227', hatStyle: 1 },
  { n: 'Bu Zirah', x: -10, z: -12, shirt: '#2a6fb0', hair: '#3b2412', hairStyle: 2 },
  { n: 'Mbah Baja', x: 10, z: -12, shirt: '#556b2f', hair: '#d9d9d9', hairStyle: 1 },
  { n: 'Kang Tameng', x: 16, z: -12, shirt: '#e0c27a', hat: '#8a3b2a', hatStyle: 3 },
];
const COL = {
  wall: '#efe6d2', gold: '#f2c230', red: '#b3262e', wood: '#6b4423', glass: '#7ec8ff', stone: '#a9a39a', sand: '#e6cf8a',
  path: '#cfc6b0', plaza: '#d9d0b8', ta: '#f4eedd', tb: '#cdb98a', navy: '#1b2f6b', marble: '#f7f3ea', purple: '#5a2a8a',
  p1: '#e63946', p2: '#2a9d8f', p3: '#f4a261', p4: '#457b9d', maze: '#7b5ea7', mzb: '#5d4380', pil: '#d9c7a0', track: '#3b3f48',
  lane: '#ffffff', st1: '#c9b27c', st2: '#8c3b3b', bn1: '#d62828', bn2: '#1d6fd6', door: '#5a2e12', disc: '#222633',
};
const FLC = ['#d8c9a3', '#e4d5b0', '#cfe0d0', '#e0cfd8', '#cfd6e8', '#e8e0c0', '#d8c0a0', '#c8e0e0', '#e0d0e8', '#f0e0b0', '#e8e8e8'];
const FLOOR_NAMES = [
  'Lantai 1 · Aula Raja & Arena PvP',
  'Lantai 2 · Parkour Harta',
  'Lantai 3 · Labirin Harta',
  'Lantai 4 · Hutan Pilar (petak umpet)',
  'Lantai 5 · Lantai Disko',
  'Lantai 6 · Balap Rintangan',
  'Lantai 7 · Galeri Raja (ambil koin!)',
  'Lantai 8 · Galeri Raja (ambil koin!)',
  'Lantai 9 · Galeri Raja (ambil koin!)',
  'Lantai 10 · Galeri Raja (ambil koin!)',
  'Atap Istana · Taman Langit',
];

/* alur tangga dari lantai k ke k+1 (bolak-balik kiri/kanan) */
function flight(k) {
  const hhm = Math.min(HS[k], HS[Math.min(k + 1, 9)]) - 8;
  const even = k % 2 === 0, zc = even ? -4 : 4;
  const xs = even ? -hhm + 2.5 : hhm - 2.5;
  return { even, xs, x0: even ? xs : xs - 8, x1: even ? xs + 8 : xs, z0: zc - 2, z1: zc + 2 };
}

export const warMixin = {
  /* y (opsional) = tinggi kaki; arena hanya di lantai dasar */
  inArena(x, z, y) { return (y === undefined || y < Y + 2.5) && x > ARENA.x0 && x < ARENA.x1 && z > ARENA.z0 && z < ARENA.z1; },
  inSafe(x, z, y) { return !this.inArena(x, z, y); },

  makeWar() {
    const S = this.scene;
    this.money = 150;
    this.armor = 0;
    this.npcs = [];
    this.coins = [];
    this.warLights = [];
    this.warTiles = [];
    this.lastHitBy = null;
    this.lastHitT = 0;
    this.race = null;
    this.raceCd = 0;
    this.wasArena = false;
    this.arenaSword = false;

    /* hilangkan SEMUA semak, bunga, pohon & batu di sekitar istana; hewan dinonaktifkan */
    for (const n of this.nature.nodes) {
      if (!n.alive) continue;
      if (n.type === 'bush' || Math.hypot(n.x, n.z) < 100) { this.nature.kill(n); n.regrow = 1e12; }
    }
    this.nature.clearFlowers();
    this.animals.disable();

    const geo = {};
    const B = (k, x0, x1, y0, y1, z0, z1, solid) => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      (geo[k] = geo[k] || []).push(g);
      if (solid) this.boxes.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, bottom: y0, top: y1, p: { k: 'tetap', fixed: true } });
    };
    /* kotak tabrakan saja (tak terlihat), mis. pagar tinggi agar pemain tak bisa melompat keluar */
    const C = (x0, x1, y0, y1, z0, z1) => this.boxes.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, bottom: y0, top: y1, p: { k: 'tetap', fixed: true } });

    let sd = 7;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const lightAt = (x, y, z, rng, i) => this.warLights.push({ x, y, z, c: 0xffe6b0, rng: rng || 26, i: i || 2.4 });

    /* papan nama (dua sisi) */
    const sign = (text, x, y, z, w, ry, bg, fg) => {
      const lines = String(text).split('\n');
      const cv = document.createElement('canvas');
      cv.width = 1024; cv.height = 256;
      const c = cv.getContext('2d');
      c.fillStyle = bg || '#6d0f1c';
      c.fillRect(0, 0, 1024, 256);
      c.strokeStyle = '#f2c230'; c.lineWidth = 14; c.strokeRect(10, 10, 1004, 236);
      c.fillStyle = fg || '#ffe27a';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      let fs = lines.length > 1 ? 82 : 120;
      c.font = `bold ${fs}px sans-serif`;
      while (fs > 30 && Math.max(...lines.map((ln) => c.measureText(ln).width)) > 930) { fs -= 4; c.font = `bold ${fs}px sans-serif`; }
      lines.forEach((ln, i) => c.fillText(ln, 512, 128 + (i - (lines.length - 1) / 2) * (fs + 8)));
      const tex = new THREE.CanvasTexture(cv);
      const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      const g = new THREE.Group();
      const a = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), m);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), m);
      b.rotation.y = Math.PI; b.position.z = -0.02; a.position.z = 0.02;
      g.add(a, b);
      g.position.set(x, y, z);
      g.rotation.y = ry || 0;
      S.add(g);
    };

    /* lampu gantung (lampu hias + sumber cahaya nyata) */
    const chand = (x, yF, z, rng, inten) => {
      B('gold', x - 1, x + 1, yF + 3.02, yF + 3.12, z - 0.07, z + 0.07, false);
      B('gold', x - 0.07, x + 0.07, yF + 3.02, yF + 3.12, z - 1, z + 1, false);
      B('lamp', x - 0.35, x + 0.35, yF + 2.72, yF + 3.04, z - 0.35, z + 0.35, false);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) B('lamp', x + dx - 0.16, x + dx + 0.16, yF + 2.84, yF + 3.1, z + dz - 0.16, z + dz + 0.16, false);
      lightAt(x, yF + 2.6, z, rng, inten);
    };

    /* pelat lantai dengan lubang (tangga) */
    const slab = (fk, Sx, sy, holes) => {
      const xs = new Set([-Sx, Sx]), zs = new Set([-Sx, Sx]);
      for (const h of holes) { xs.add(h.x0); xs.add(h.x1); zs.add(h.z0); zs.add(h.z1); }
      const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
      for (let i = 0; i < X.length - 1; i++) {
        for (let j = 0; j < Z.length - 1; j++) {
          const cx = (X[i] + X[i + 1]) / 2, cz = (Z[j] + Z[j + 1]) / 2;
          if (holes.some((h) => cx > h.x0 && cx < h.x1 && cz > h.z0 && cz < h.z1)) continue;
          B(fk, X[i], X[i + 1], sy - 0.4, sy, Z[j], Z[j + 1], true);
        }
      }
    };

    /* ===== ISTANA: 10 lantai + atap ===== */
    for (let k = 0; k < 10; k++) {
      const h = HS[k], y = Y + FH * k, y0 = k ? y : y - 0.5, y1 = y + FH;
      /* dinding luar: SEMUA sisi tertutup, termasuk gerbang depan */
      B('wall', -h, h, y0, y1, -h, -h + T, true);
      B('wall', -h, h, y0, y1, h - T, h, true);
      B('wall', h - T, h, y0, y1, -h + T, h - T, true);
      B('wall', -h, -h + T, y0, y1, -h + T, h - T, true);
      /* hiasan emas di puncak tiap lantai */
      B('gold', -h - 0.3, h + 0.3, y1 - 0.45, y1, -h - 0.3, -h, false);
      B('gold', -h - 0.3, h + 0.3, y1 - 0.45, y1, h, h + 0.3, false);
      B('gold', -h - 0.3, -h, y1 - 0.45, y1, -h, h, false);
      B('gold', h, h + 0.3, y1 - 0.45, y1, -h, h, false);
      /* titik (u,d): d = kedalaman dari tembok luar */
      const bd = (key, side, u0, u1, d0, d1, ya, yb, solid) => {
        let x0, x1, z0, z1;
        if (side === 'N') { x0 = u0; x1 = u1; z0 = -h + d0; z1 = -h + d1; }
        else if (side === 'S') { x0 = u0; x1 = u1; z0 = h - d1; z1 = h - d0; }
        else if (side === 'E') { z0 = u0; z1 = u1; x0 = h - d1; x1 = h - d0; }
        else { z0 = u0; z1 = u1; x0 = -h + d0; x1 = -h + d1; }
        B(key, Math.min(x0, x1), Math.max(x0, x1), ya, yb, Math.min(z0, z1), Math.max(z0, z1), solid);
      };
      const wing = (side, uA, uB) => {
        const n = Math.max(1, Math.round((uB - uA) / 8)), w = (uB - uA) / n;
        for (let j = 0; j < n; j++) {
          const u0 = uA + j * w, u1 = u0 + w, uc = (u0 + u1) / 2;
          bd('wall', side, u0, uc - 1.2, 7.8, 8.2, y, y1, true);
          bd('wall', side, uc + 1.2, u1, 7.8, 8.2, y, y1, true);
          if (j > 0) bd('wall', side, u0 - 0.2, u0 + 0.2, T, 8, y, y1, true);
          bd('wood', side, uc - 1, uc + 1, T + 0.1, T + 3, y, y + 0.5, false); /* tempat tidur */
          bd('red', side, uc - 1, uc + 1, T + 1.2, T + 3, y + 0.5, y + 0.7, false);
          bd('glass', side, uc - 1.1, uc + 1.1, -0.06, 0.02, y + 1.3, y + 3, false); /* jendela */
          bd('lamp', side, uc - 0.4, uc + 0.4, 3.6, 4.4, y + 3.45, y + 3.55, false);
          lightAt(side === 'N' ? uc : side === 'S' ? uc : side === 'E' ? h - 4 : -h + 4, y + 3.2, side === 'E' || side === 'W' ? uc : side === 'N' ? -h + 4 : h - 4, 9, 1.1);
        }
      };
      wing('N', -h, h);
      if (k > 0) wing('S', -h, h);
      wing('E', -h + 8, k > 0 ? h - 8 : h);
      wing('W', -h + 8, k > 0 ? h - 8 : h);
      /* tangga naik ke lantai berikutnya (lantai 10 = dek atap) */
      const f = flight(k);
      for (let i = 0; i < 8; i++) {
        const xa = f.even ? f.xs + i : f.xs - i - 1;
        B('stone', xa, xa + 1, y, y + 0.5 * (i + 1), f.z0, f.z1, true);
      }
    }
    /* lampu gantung: banyak, supaya terang di mana-mana */
    for (const x of [-14, 0, 14]) for (const z of [-16, -8, -1]) chand(x, Y, z, 26, 2.4);
    for (const x of [-14, 0, 14]) for (const z of [8, 14, 21]) chand(x, Y, z, 30, 2.8);
    for (let k = 1; k <= 2; k++) for (const x of [-14, 0, 14]) for (const z of [-14, 0, 14]) chand(x, Y + FH * k, z, 26, 2.4);
    for (let k = 3; k <= 5; k++) for (const x of [-8, 0, 8]) for (const z of [-8, 0, 8]) chand(x, Y + FH * k, z, 22, 2.4);
    for (let k = 6; k <= 9; k++) chand(0, Y + FH * k, 0, 18, 2.4);

    /* lantai dasar (hanya visual) */
    B('f0', -30, 30, Y - 0.3, Y + 0.06, -30, 30, false);
    /* lantai marmer kotak-kotak di aula raja */
    for (let i = 0; i < 22; i++) for (let j = 0; j < 11; j++) B((i + j) % 2 ? 'ta' : 'tb', -22 + i * 2, -20 + i * 2, Y + 0.06, Y + 0.085, -22 + j * 2, -20 + j * 2, false);
    /* pelat lantai 1..10 dengan lubang tangga, pagar lubang dan pagar teras */
    for (let k = 1; k <= 10; k++) {
      const Sx = HS[k - 1], sy = Y + FH * k, f = flight(k - 1), fk = 'f' + k;
      slab(fk, Sx, sy, [{ x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1 }]);
      B('gold', f.x0, f.x1, sy, sy + 1, f.z0 - 0.3, f.z0, true);
      B('gold', f.x0, f.x1, sy, sy + 1, f.z1, f.z1 + 0.3, true);
      if (f.even) B('gold', f.x0 - 0.3, f.x0, sy, sy + 1, f.z0, f.z1, true);
      else B('gold', f.x1, f.x1 + 0.3, sy, sy + 1, f.z0, f.z1, true);
      if (k === 10 || Sx > HS[k]) {
        /* pagar teras/atap + tembok bergerigi; kotak tak terlihat setinggi 4 m agar tak bisa melompat keluar */
        B('stone', -Sx, Sx, sy, sy + 1.1, -Sx, -Sx + 0.4, true);
        B('stone', -Sx, Sx, sy, sy + 1.1, Sx - 0.4, Sx, true);
        B('stone', -Sx, -Sx + 0.4, sy, sy + 1.1, -Sx + 0.4, Sx - 0.4, true);
        B('stone', Sx - 0.4, Sx, sy, sy + 1.1, -Sx + 0.4, Sx - 0.4, true);
        C(-Sx - 0.2, Sx + 0.2, sy, sy + 4, -Sx - 0.2, -Sx + 0.4);
        C(-Sx - 0.2, Sx + 0.2, sy, sy + 4, Sx - 0.4, Sx + 0.2);
        C(-Sx - 0.2, -Sx + 0.4, sy, sy + 4, -Sx, Sx);
        C(Sx - 0.4, Sx + 0.2, sy, sy + 4, -Sx, Sx);
        for (let u = -Sx + 1; u < Sx; u += 2.5) {
          B('stone', u - 0.5, u + 0.5, sy + 1.1, sy + 1.8, -Sx, -Sx + 0.4, false);
          B('stone', u - 0.5, u + 0.5, sy + 1.1, sy + 1.8, Sx - 0.4, Sx, false);
          B('stone', -Sx, -Sx + 0.4, sy + 1.1, sy + 1.8, u - 0.5, u + 0.5, false);
          B('stone', Sx - 0.4, Sx, sy + 1.1, sy + 1.8, u - 0.5, u + 0.5, false);
        }
      }
    }

    /* ===== TAMPAK LUAR YANG MEGAH ===== */
    /* halaman batu di sekeliling istana */
    B('plaza', -52, 52, Y - 0.3, Y + 0.04, -52, 52, false);
    B('gold', -40, 40, Y + 0.04, Y + 0.07, 40, 40.5, false);
    B('gold', -40, 40, Y + 0.04, Y + 0.07, -40.5, -40, false);
    B('gold', 40, 40.5, Y + 0.04, Y + 0.07, -40, 40, false);
    B('gold', -40.5, -40, Y + 0.04, Y + 0.07, -40, 40, false);
    /* tiang pilar putih di sepanjang dinding lantai 1-3 */
    for (let j = 1; j <= 7; j++) {
      const u = -30 + j * 7.5;
      const pil = (x, z, sx, sz) => {
        B('marble', x - sx, x + sx, Y - 0.3, Y + 12, z - sz, z + sz, false);
        B('gold', x - sx - 0.15, x + sx + 0.15, Y + 11.5, Y + 12.1, z - sz - 0.15, z + sz + 0.15, false);
        B('gold', x - sx - 0.15, x + sx + 0.15, Y - 0.3, Y + 0.5, z - sz - 0.15, z + sz + 0.15, false);
      };
      if (Math.abs(u) > 18) pil(u, 30.25, 0.5, 0.35);
      pil(u, -30.25, 0.5, 0.35);
      pil(30.25, u, 0.35, 0.5);
      pil(-30.25, u, 0.35, 0.5);
    }
    /* gerbang besar TERTUTUP di depan (pintu emas, tidak bisa dibuka) */
    B('gold', -6.6, 6.6, Y, Y + 0.5, 30, 30.6, false);
    B('gold', -6.6, -6, Y, Y + 4.7, 30, 30.6, false);
    B('gold', 6, 6.6, Y, Y + 4.7, 30, 30.6, false);
    B('gold', -6.6, 6.6, Y + 4.1, Y + 4.7, 30, 30.6, false);
    B('door', -6, -0.12, Y + 0.5, Y + 4.1, 30, 30.35, false);
    B('door', 0.12, 6, Y + 0.5, Y + 4.1, 30, 30.35, false);
    B('gold', -0.12, 0.12, Y + 0.5, Y + 4.1, 30, 30.5, false);
    for (const x of [-4.5, -3, -1.5, 1.5, 3, 4.5]) B('gold', x - 0.25, x + 0.25, Y + 2, Y + 2.5, 30.3, 30.6, false);
    /* beranda depan bertiang */
    for (const x of [-16, -10, 10, 16]) {
      B('marble', x - 0.7, x + 0.7, Y, Y + 8.6, 34.3, 35.7, true);
      B('gold', x - 1, x + 1, Y + 8.1, Y + 8.7, 34, 36, false);
      B('gold', x - 1, x + 1, Y, Y + 0.6, 34, 36, false);
    }
    B('gold', -18, 18, Y + 8.7, Y + 9.5, 33.4, 36.6, false);
    B('navy', -18.5, 18.5, Y + 9.5, Y + 9.9, 30, 37, false);
    for (let i = 0; i < 6; i++) B(i % 2 ? 'gold' : 'marble', -17 + i * 1.4, 17 - i * 1.4, Y + 9.9 + i * 0.7, Y + 10.6 + i * 0.7, 30.6, 36.4, false);
    B('red', -9, -7, Y + 1, Y + 8, 30.6, 30.8, false);
    B('red', 7, 9, Y + 1, Y + 8, 30.6, 30.8, false);
    B('gold', -9.2, -6.8, Y + 7.6, Y + 8, 30.55, 30.85, false);
    B('gold', 6.8, 9.2, Y + 7.6, Y + 8, 30.55, 30.85, false);
    for (const x of [-12.5, 12.5, -20, 20]) { B('gold', x - 0.14, x + 0.14, Y, Y + 3.8, 32.2, 32.5, false); B('lamp', x - 0.4, x + 0.4, Y + 3.8, Y + 4.4, 31.95, 32.75, false); lightAt(x, Y + 4, 32.3, 16, 1.6); }
    /* menara sudut + atap kerucut merah + bendera */
    const roofMat = new THREE.MeshStandardMaterial({ color: '#b3262e', emissive: '#b3262e', emissiveIntensity: 0.2, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: COL.gold, emissive: '#c99a10', emissiveIntensity: 0.55, metalness: 0.25, roughness: 0.35 });
    const tower = (cx, cz, half, yb, yt, coneH) => {
      B('wall', cx - half, cx + half, yb, yt, cz - half, cz + half, true);
      B('gold', cx - half - 0.2, cx + half + 0.2, yt - 0.5, yt, cz - half - 0.2, cz + half + 0.2, false);
      B('gold', cx - half - 0.2, cx + half + 0.2, yb, yb + 0.6, cz - half - 0.2, cz + half + 0.2, false);
      B('glass', cx - 0.5, cx + 0.5, yb + (yt - yb) * 0.5, yb + (yt - yb) * 0.5 + 1.6, cz - half - 0.05, cz - half + 0.05, false);
      B('glass', cx - 0.5, cx + 0.5, yb + (yt - yb) * 0.5, yb + (yt - yb) * 0.5 + 1.6, cz + half - 0.05, cz + half + 0.05, false);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(half * 1.55, coneH, 8), roofMat);
      cone.position.set(cx, yt + coneH / 2, cz);
      cone.rotation.y = Math.PI / 8;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), goldMat);
      ball.position.set(cx, yt + coneH + 0.3, cz);
      S.add(cone, ball);
      B('gold', cx - 0.06, cx + 0.06, yt + coneH + 0.5, yt + coneH + 3.2, cz - 0.06, cz + 0.06, false);
      B(cx < 0 ? 'bn1' : 'bn2', cx + 0.06, cx + 1.9, yt + coneH + 1.9, yt + coneH + 3.1, cz - 0.03, cz + 0.03, false);
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      tower(sx * 30.8, sz * 30.8, 2.5, Y - 0.3, Y + 15, 9);
      tower(sx * 22.9, sz * 22.9, 1.8, Y + 12, Y + 25.5, 6);
      tower(sx * 14.9, sz * 14.9, 1.5, Y + 24, Y + 41.5, 5);
    }
    /* kubah emas di dek atap */
    B('gold', -1.6, 1.6, Y + 40, Y + 43, -1.6, 1.6, true);
    B('gold', -2.2, 2.2, Y + 40, Y + 40.6, -2.2, 2.2, false);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), goldMat);
    dome.position.set(0, Y + 43.4, 0);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 6), goldMat);
    spire.position.set(0, Y + 47.4, 0);
    S.add(dome, spire);
    for (const [x, z] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { B('gold', x - 0.15, x + 0.15, Y + 40, Y + 43.5, z - 0.15, z + 0.15, false); B('lamp', x - 0.4, x + 0.4, Y + 43.5, Y + 44.2, z - 0.4, z + 0.4, false); lightAt(x, Y + 44, z, 22, 2); }

    /* ===== LANTAI 1: AULA RAJA ===== */
    B('red', -1.6, 1.6, Y + 0.085, Y + 0.12, -21, 0.4, false); /* karpet */
    B('gold', -1.8, -1.6, Y + 0.085, Y + 0.125, -21, 0.4, false);
    B('gold', 1.6, 1.8, Y + 0.085, Y + 0.125, -21, 0.4, false);
    B('red', -2.6, 2.6, Y, Y + 0.5, -21.6, -17, true); /* podium singgasana */
    B('gold', -1.1, 1.1, Y + 0.5, Y + 1.5, -21.4, -19.8, true);
    B('gold', -1.1, 1.1, Y + 1.5, Y + 3.5, -21.4, -21, false);
    B('gold', -1.5, -1.1, Y + 0.5, Y + 2.2, -21.4, -19.6, false);
    B('gold', 1.1, 1.5, Y + 0.5, Y + 2.2, -21.4, -19.6, false);
    B('red', -2.4, 2.4, Y + 3.5, Y + 3.9, -21.5, -18.5, false); /* kanopi */
    for (const z of [-18, -12, -6]) for (const x of [-6, 6]) {
      B('marble', x - 0.5, x + 0.5, Y, Y + 3.6, z - 0.5, z + 0.5, true);
      B('gold', x - 0.7, x + 0.7, Y, Y + 0.4, z - 0.7, z + 0.7, false);
      B('gold', x - 0.7, x + 0.7, Y + 3.2, Y + 3.6, z - 0.7, z + 0.7, false);
    }
    /* obor dinding menyala di sepanjang aula */
    for (const z of [-18, -10, -3]) for (const x of [-21.6, 21.6]) { B('gold', x - 0.12, x + 0.12, Y + 1.8, Y + 2.3, z - 0.12, z + 0.12, false); B('lamp', x - 0.28, x + 0.28, Y + 2.3, Y + 2.9, z - 0.28, z + 0.28, false); }
    /* spanduk di dinding utara */
    for (const x of [-12, 12]) { B('red', x - 1, x + 1, Y + 1.2, Y + 3.4, -21.7, -21.6, false); B('gold', x - 1.1, x + 1.1, Y + 3.3, Y + 3.5, -21.75, -21.55, false); }

    /* ===== ARENA PVP BESAR (di dalam istana) ===== */
    const A = ARENA, ACZ = (A.z0 + A.z1) / 2;
    B('sand', A.x0, A.x1, Y - 0.3, Y + 0.07, A.z0, A.z1, false);
    B('gold', A.x0, A.x1, Y + 0.07, Y + 0.1, A.z0, A.z0 + 0.35, false);
    B('gold', A.x0, A.x1, Y + 0.07, Y + 0.1, A.z1 - 0.35, A.z1, false);
    B('gold', A.x0, A.x0 + 0.35, Y + 0.07, Y + 0.1, A.z0, A.z1, false);
    B('gold', A.x1 - 0.35, A.x1, Y + 0.07, Y + 0.1, A.z0, A.z1, false);
    B('red', A.x0, A.x1, Y + 0.07, Y + 0.1, ACZ - 0.12, ACZ + 0.12, false);
    B('red', -0.12, 0.12, Y + 0.07, Y + 0.1, A.z0, A.z1, false);
    for (const [a, b] of [[-7, -6.7], [6.7, 7]]) B('gold', a, b, Y + 0.07, Y + 0.11, ACZ - 7, ACZ + 7, false);
    for (const [a, b] of [[-7, -6.7], [6.7, 7]]) B('gold', -7, 7, Y + 0.07, Y + 0.11, ACZ + a, ACZ + b, false);
    B('gold', -2, 2, Y + 0.07, Y + 0.12, ACZ - 2, ACZ + 2, false);
    /* tembok rendah arena (celah masuk di utara: x -11..-5 dan 5..11) */
    const AW = 1.1;
    B('stone', A.x0 - 0.6, A.x0, Y, Y + AW, A.z0 - 0.6, A.z1 + 0.6, true);
    B('stone', A.x1, A.x1 + 0.6, Y, Y + AW, A.z0 - 0.6, A.z1 + 0.6, true);
    B('stone', A.x0, A.x1, Y, Y + AW, A.z1, A.z1 + 0.6, true);
    B('stone', A.x0, -11, Y, Y + AW, A.z0 - 0.6, A.z0, true);
    B('stone', -5, 5, Y, Y + AW, A.z0 - 0.6, A.z0, true);
    B('stone', 11, A.x1, Y, Y + AW, A.z0 - 0.6, A.z0, true);
    for (const gx of [-11, -5, 5, 11]) {
      B('gold', gx - 0.35, gx + 0.35, Y, Y + 3.2, A.z0 - 0.7, A.z0 + 0.1, true);
      B('lamp', gx - 0.3, gx + 0.3, Y + 3.2, Y + 3.7, A.z0 - 0.6, A.z0, false);
    }
    B('gold', -11, -5, Y + 3.0, Y + 3.45, A.z0 - 0.7, A.z0 + 0.1, false);
    B('gold', 5, 11, Y + 3.0, Y + 3.45, A.z0 - 0.7, A.z0 + 0.1, false);
    sign('MASUK ARENA\nPEDANG OTOMATIS', -8, Y + 3.2 + 0.9, A.z0 - 0.3, 5.6, 0, '#5a0a14');
    sign('MASUK ARENA\nPEDANG OTOMATIS', 8, Y + 3.2 + 0.9, A.z0 - 0.3, 5.6, 0, '#5a0a14');
    sign('ARENA PvP', 0, Y + 3.0, A.z0 - 0.3, 6, 0, '#102a5a');
    /* pilar sudut + tiang obor di sekeliling arena */
    for (const x of [A.x0 - 0.9, A.x1 + 0.3]) for (const z of [A.z0 - 0.9, A.z1 + 0.3]) {
      B('marble', x, x + 0.6, Y, Y + 3.2, z, z + 0.6, true);
      B('gold', x - 0.15, x + 0.75, Y + 2.9, Y + 3.2, z - 0.15, z + 0.75, false);
    }
    for (const z of [8, 14, 20]) for (const x of [A.x0 - 0.3, A.x1 - 0.3]) { B('gold', x - 0.1, x + 0.1, Y + AW, Y + 2.1, z - 0.1, z + 0.1, false); B('lamp', x - 0.25, x + 0.25, Y + 2.1, Y + 2.6, z - 0.25, z + 0.25, false); }
    for (const x of [-14, -7, 7, 14]) { B('gold', x - 0.1, x + 0.1, Y + AW, Y + 2.1, A.z1 + 0.25, A.z1 + 0.45, false); B('lamp', x - 0.25, x + 0.25, Y + 2.1, Y + 2.6, A.z1 + 0.15, A.z1 + 0.55, false); }
    /* tulisan di dinding selatan arena */
    sign('KALAHKAN LAWAN  ·  +150 UANG', 0, Y + 2.6, A.z1 + 0.8, 9, Math.PI, '#5a0a14');

    /* ===== LANTAI 2: PARKOUR HARTA ===== */
    {
      const yF = Y + FH * 1, hts = [0.5, 0.9, 0.6, 1.1, 1.5, 1.0, 1.4, 1.6], cz = 14;
      B('p3', -19.6, -17.4, yF, yF + 0.08, cz - 1.5, cz + 1.5, false);
      hts.forEach((t, i) => {
        const x0 = -15 + i * 3.8;
        B('p' + (1 + (i % 4)), x0, x0 + 2.4, yF, yF + t, cz - 1.5, cz + 1.5, true);
        B('gold', x0, x0 + 2.4, yF + t, yF + t + 0.06, cz - 1.5, cz + 1.5, false);
      });
      B('gold', 15.4, 19.4, yF, yF + 1.6, cz - 2, cz + 2, true);
      B('lamp', 15.6, 19.2, yF + 1.6, yF + 1.68, cz - 1.8, cz + 1.8, false);
      this.addCoin(17.4, yF + 1.6, cz, 200);
      for (let i = 1; i < hts.length; i += 2) this.addCoin(-15 + i * 3.8 + 1.2, yF + hts[i], cz, 15);
      sign('PARKOUR HARTA\nLompat sampai podium!', -18.5, yF + 2.7, cz, 4.4, Math.PI / 2, '#0d4a3a');
    }

    /* ===== LANTAI 3: LABIRIN HARTA ===== */
    {
      const yF = Y + FH * 2, cols = 10, rows = 7, cs = 2, ox = -10, oz = 7, MH = 2.6, TH = 0.2;
      const v = [], hh = [];
      for (let r = 0; r < rows; r++) { v.push(new Array(cols).fill(false)); hh.push(new Array(cols).fill(false)); }
      const seen = new Set(['0,0']), st = [[0, 0]];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (st.length) {
        const [c, r] = st[st.length - 1];
        const opts = dirs.filter(([dc, dr]) => { const nc = c + dc, nr = r + dr; return nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen.has(nc + ',' + nr); });
        if (!opts.length) { st.pop(); continue; }
        const [dc, dr] = opts[(rnd() * opts.length) | 0];
        const nc = c + dc, nr = r + dr;
        if (dc === 1) v[r][c] = true; else if (dc === -1) v[r][nc] = true;
        if (dr === 1) hh[r][c] = true; else if (dr === -1) hh[nr][c] = true;
        seen.add(nc + ',' + nr);
        st.push([nc, nr]);
      }
      const nb = (c, r) => {
        const o = [];
        if (c < cols - 1 && v[r][c]) o.push([c + 1, r]);
        if (c > 0 && v[r][c - 1]) o.push([c - 1, r]);
        if (r < rows - 1 && hh[r][c]) o.push([c, r + 1]);
        if (r > 0 && hh[r - 1][c]) o.push([c, r - 1]);
        return o;
      };
      /* sel terjauh dari pintu masuk = hadiah besar */
      const dist = new Map([['0,0', 0]]), q = [[0, 0]];
      let far = [0, 0];
      for (let qi = 0; qi < q.length; qi++) {
        const [c, r] = q[qi];
        for (const [a, b] of nb(c, r)) if (!dist.has(a + ',' + b)) { dist.set(a + ',' + b, dist.get(c + ',' + r) + 1); q.push([a, b]); if (dist.get(a + ',' + b) > dist.get(far[0] + ',' + far[1])) far = [a, b]; }
      }
      const W = (x0, x1, z0, z1) => B('maze', x0, x1, yF, yF + MH, z0, z1, true);
      const X = (c) => ox + c * cs, Zr = (r) => oz + r * cs;
      for (let c = 1; c < cols; c++) W(X(c) - TH, X(c + 1) + TH, oz - TH, oz + TH);
      for (let c = 0; c < cols; c++) W(X(c) - TH, X(c + 1) + TH, Zr(rows) - TH, Zr(rows) + TH);
      for (let r = 0; r < rows; r++) { W(ox - TH, ox + TH, Zr(r) - TH, Zr(r + 1) + TH); W(X(cols) - TH, X(cols) + TH, Zr(r) - TH, Zr(r + 1) + TH); }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) if (!v[r][c]) W(X(c + 1) - TH, X(c + 1) + TH, Zr(r) - TH, Zr(r + 1) + TH);
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) if (!hh[r][c]) W(X(c) - TH, X(c + 1) + TH, Zr(r + 1) - TH, Zr(r + 1) + TH);
      /* kolom emas hadiah + koin di ujung-ujung jalan buntu */
      const px = X(far[0]) + cs / 2, pz = Zr(far[1]) + cs / 2;
      B('gold', px - 0.45, px + 0.45, yF, yF + 0.8, pz - 0.45, pz + 0.45, false);
      this.addCoin(px, yF + 0.8, pz, 250);
      let dead = 0;
      for (let r = 0; r < rows && dead < 7; r++) for (let c = 0; c < cols && dead < 7; c++) {
        if ((c === 0 && r === 0) || (c === far[0] && r === far[1])) continue;
        if (nb(c, r).length === 1) { this.addCoin(X(c) + cs / 2, yF, Zr(r) + cs / 2, 20); dead++; }
      }
      sign('LABIRIN HARTA\nCari koin emas besar!', -9, yF + 2.7, oz - 0.5, 4.6, 0, '#3a2060');
    }

    /* ===== LANTAI 4: HUTAN PILAR (PETAK UMPET) ===== */
    {
      const yF = Y + FH * 3, hide = [];
      for (let xi = -3; xi <= 3; xi++) for (let zi = -3; zi <= 3; zi++) {
        const x = xi * 4, z = zi * 4;
        if (x >= -13 && x <= -2 && z >= -7.5 && z <= -0.5) continue;
        if (x >= 2 && x <= 13 && z >= 0.5 && z <= 7.5) continue;
        if (x === 0 && z === 4) continue;
        B(rnd() < 0.5 ? 'pil' : 'navy', x - 0.7, x + 0.7, yF, yF + 2.6, z - 0.7, z + 0.7, true);
        B('gold', x - 0.85, x + 0.85, yF + 2.4, yF + 2.6, z - 0.85, z + 0.85, false);
        hide.push([x, z]);
      }
      for (let i = 0; i < 10 && hide.length; i++) { const [x, z] = hide.splice((rnd() * hide.length) | 0, 1)[0]; this.addCoin(x + 1.1, yF, z + 1.1, 20); }
      B('gold', -0.6, 0.6, yF, yF + 0.9, 3.4, 4.6, true);
      this.addCoin(0, yF + 0.9, 4, 120);
      sign('HUTAN PILAR\nPetak umpet & cari koin', 0, yF + 2.3, -13.2, 4.6, 0, '#14385a');
    }

    /* ===== LANTAI 5: LANTAI DISKO ===== */
    {
      const yF = Y + FH * 4;
      const pal = ['#ff2d95', '#2de2ff', '#ffe600', '#7dff3a', '#a45cff', '#ff7a1a'];
      const dm = pal.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.95, roughness: 0.4 }));
      const tg = new THREE.BoxGeometry(1.92, 0.08, 1.92);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) {
        const m = new THREE.Mesh(tg, dm[(i + j) % 6]);
        m.position.set(-9 + i * 2, yF + 0.04, 8 + j * 2);
        S.add(m);
        this.warTiles.push({ m, i: i + j });
      }
      this.warDisco = dm;
      B('disc', -10.2, 10.2, yF, yF + 0.04, 6.9, 13.1, false);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#bfd8ff', emissiveIntensity: 0.9, metalness: 0.3 }));
      ball.position.set(0, yF + 3.0, 10);
      S.add(ball);
      this.discoBall = ball;
      for (const x of [-11.6, 11.6]) { B('disc', x - 0.7, x + 0.7, yF, yF + 1.8, 8.2, 9.8, true); B('lamp', x - 0.4, x + 0.4, yF + 1.8, yF + 1.9, 8.4, 9.6, false); }
      for (const [x, z] of [[-11, 15], [-6, 15], [0, 15], [6, 15], [11, 15], [-11, 5], [11, 5]]) this.addCoin(x, yF, z, 25);
      sign('LANTAI DISKO\nTekan tombol Emote!', 0, yF + 2.4, 5.6, 4.6, 0, '#4a1470', '#ffe6ff');
    }

    /* ===== LANTAI 6: BALAP RINTANGAN ===== */
    {
      const yF = Y + FH * 5, x0 = 7, x1 = 12;
      B('track', x0, x1, yF, yF + 0.05, -12.6, 12.6, false);
      for (const lx of [x0, x1 - 0.12]) B('lane', lx, lx + 0.12, yF + 0.05, yF + 0.07, -12.6, 12.6, false);
      B('lane', x0, x1, yF + 0.05, yF + 0.08, -12.1, -11.5, false);
      B('lane', x0, x1, yF + 0.05, yF + 0.08, 11.5, 12.1, false);
      for (const z of [-7, -3, 1, 5, 9]) B('p1', x0, x1, yF, yF + 0.9, z - 0.2, z + 0.2, true);
      for (const [z, t, col] of [[-12.2, 'START', '#0d4a3a'], [12.2, 'FINISH', '#5a0a14']]) {
        B('gold', x0 - 0.3, x0, yF, yF + 3, z - 0.15, z + 0.15, false);
        B('gold', x1, x1 + 0.3, yF, yF + 3, z - 0.15, z + 0.15, false);
        sign(t, (x0 + x1) / 2, yF + 3.1 - 0.0, z, 4.4, 0, col);
      }
      for (const z of [-4, 0, 4]) this.addCoin(9.5, yF + 1.0, z + 2, 15);
      sign('BALAP RINTANGAN\nLari & lompati palang!', 0, yF + 2.4, -13.2, 4.6, 0, '#5a3a0a');
    }

    /* ===== LANTAI 7-10: GALERI RAJA + ATAP ===== */
    for (let k = 6; k <= 9; k++) {
      const yF = Y + FH * k;
      this.addCoin(5, yF, 0, 30);
      this.addCoin(-5, yF, 0, 30);
    }
    for (const [x, z] of [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5]]) this.addCoin(x, Y + FH * 10, z, 60);

    /* gabungkan semua kotak jadi beberapa mesh saja (ringan untuk HP); semua bahan ikut bercahaya lembut */
    for (const k in geo) {
      const col = COL[k] || FLC[+k.slice(1)] || '#cccccc';
      const gold = k === 'gold';
      const m = new THREE.MeshStandardMaterial(
        k === 'lamp' ? { color: '#fff3b0', emissive: '#ffe9a0', emissiveIntensity: 1 }
          : k === 'glass' ? { color: COL.glass, emissive: '#2a5a8a', emissiveIntensity: 0.7, roughness: 0.2 }
            : { color: col, emissive: col, emissiveIntensity: gold ? 0.5 : 0.24, roughness: 0.8, metalness: gold ? 0.25 : 0 }
      );
      const mesh = new THREE.Mesh(mergeGeometries(geo[k]), m);
      mesh.frustumCulled = false;
      S.add(mesh);
    }
    /* cahaya sekitar tambahan: tidak ada sudut gelap */
    S.add(new THREE.AmbientLight(0xfff1dd, 0.32));

    /* penduduk desa penjual armor di aula istana */
    VILL.forEach((v, i) => {
      const g = buildChar(normLook({ shirt: v.shirt, hat: v.hat || null, hatStyle: v.hatStyle || 0, hair: v.hair || '#1b1b1b', hairStyle: v.hairStyle || 0, skin: ['#e8b48a', '#c68642', '#f1c9a5', '#a86b3c'][i], pants: '#5b3a1e' }));
      g.position.set(v.x, Y, v.z);
      g.rotation.y = Math.atan2(-v.x, 0.001);
      g.add(this.makeLabel(v.n));
      S.add(g);
      const cx = v.x + (v.x < 0 ? 2.2 : -2.2);
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 2.6), pieceMat('wood'));
      st.position.set(cx, Y + 0.5, v.z);
      const aw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 3), new THREE.MeshStandardMaterial({ color: i % 2 ? '#2a6fb0' : '#b3262e', emissive: i % 2 ? '#2a6fb0' : '#b3262e', emissiveIntensity: 0.25 }));
      aw.position.set(cx, Y + 2.6, v.z);
      S.add(st, aw);
      this.boxes.push({ minx: cx - 0.6, maxx: cx + 0.6, minz: v.z - 1.3, maxz: v.z + 1.3, bottom: Y - 0.2, top: Y + 1, p: { k: 'tetap', fixed: true } });
      this.boxes.push({ minx: v.x - 0.4, maxx: v.x + 0.4, minz: v.z - 0.4, maxz: v.z + 0.4, bottom: Y - 0.2, top: Y + 2, p: { k: 'tetap', fixed: true } });
      this.npcs.push({ x: v.x, z: v.z, g });
    });
    sign('TOKO DESA · ARMOR', 0, Y + 3.05, -14.2, 5.2, 0, '#5a3a0a');
    B('gold', -2.7, 2.7, Y + 2.2, Y + 2.3, -14.1, -14.0, false);

    /* pemain muncul di aula raja (menghadap singgasana) */
    const p = this.p;
    p.spawn = { x: 0, z: -8 };
    p.x = 0; p.z = -8; p.y = Y + 0.02; p.yaw = 0; p.pitch = 0;
    this.warFloor = 0;
    this.warFloorReady = false;
    const old = $('warHud'); if (old) old.remove();
    const h = document.createElement('div');
    h.id = 'warHud';
    $('hud').appendChild(h);
    const bn = document.createElement('div');
    bn.id = 'warBanner';
    bn.innerHTML = '<span class="rainbow">PETUALANGAN WAR</span><small>Istana Raja · Arena PvP</small>';
    $('hud').appendChild(bn);
    this.timers.push(setTimeout(() => bn.remove(), 4500));
    this.warHud();
    this.timers.push(setInterval(() => this.warHud(), 1000));
    /* lantai disko: warna ubin berganti-ganti */
    let phase = 0;
    this.timers.push(setInterval(() => {
      if (!this.warTiles.length || this.warFloor !== 4) return;
      phase++;
      for (const t of this.warTiles) t.m.material = this.warDisco[(t.i + phase) % 6];
    }, 450));
    this.makeBots();
    this.timers.push(setTimeout(() => this.toast('Selamat datang di Istana! Pintu depan tertutup. Masuk ARENA (selatan aula) = langsung dapat pedang. Naik tangga untuk mini-game & koin.'), 1500));
  },

  /* koin harta: dikumpulkan jadi uang, muncul lagi setelah beberapa saat */
  addCoin(x, y, z, v) {
    if (!this.coinGeo) {
      this.coinGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.07, 14).rotateX(Math.PI / 2);
      this.coinMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.35 });
      this.coinBig = new THREE.MeshStandardMaterial({ color: '#fff2a0', emissive: '#ffd000', emissiveIntensity: 1, metalness: 0.3, roughness: 0.3 });
    }
    const m = new THREE.Mesh(this.coinGeo, v >= 100 ? this.coinBig : this.coinMat);
    const s = v >= 100 ? 2 : 1;
    m.scale.set(s, s, s);
    m.position.set(x, y + 0.85 * s, z);
    m.frustumCulled = true;
    this.scene.add(m);
    this.coins.push({ m, x, y, z, v, y0: y + 0.85 * s, t: 0, ph: Math.random() * 6 });
  },

  /* dipanggil tiap frame di map War */
  warUpdate(dt) {
    const p = this.p;
    this.botUpdate(dt);
    const now = (this.warClock = (this.warClock || 0) + dt);
    if (p.y < Y - 4) { p.x = p.spawn.x; p.z = p.spawn.z; p.y = Y + 0.02; p.vy = 0; }
    /* nama lantai saat naik/turun */
    const fl = Math.max(0, Math.min(10, Math.floor((p.y - Y + 0.6) / FH)));
    if (fl !== this.warFloor) {
      this.warFloor = fl;
      if (this.warFloorReady) this.toast(FLOOR_NAMES[fl]);
    }
    this.warFloorReady = true;
    /* masuk arena => pedang otomatis; keluar => pedang arena diambil lagi */
    const inA = this.inArena(p.x, p.z, p.y) && !this.dead;
    if (inA && !this.wasArena) {
      this.wasArena = true;
      if (!(p.inv.pedang > 0)) { p.inv.pedang = 1; this.arenaSword = true; } else this.arenaSword = false;
      this.setEq('pedang', true);
      this.toast('Kamu masuk ARENA! Pedang otomatis dipegang. Serang lawan!');
      Audio.sfx('quest');
      this.renderBag();
    } else if (!inA && this.wasArena) {
      this.wasArena = false;
      if (this.arenaSword) { p.inv.pedang = 0; this.arenaSword = false; }
      if (this.eq === 'pedang' && !(p.inv.pedang > 0)) this.setEq('tangan', true);
      this.toast('Keluar arena: pedang dikembalikan.');
      this.renderBag();
    }
    /* koin */
    for (const c of this.coins) {
      if (c.t > 0) { c.t -= dt; if (c.t <= 0) c.m.visible = true; else continue; }
      const near = Math.abs(c.y - p.y) < 12;
      c.m.visible = near;
      if (!near) continue;
      c.m.rotation.y += dt * 2.6;
      c.m.position.y = c.y0 + Math.sin(now * 2.2 + c.ph) * 0.07;
      if (Math.abs(c.y - p.y) < 2 && Math.hypot(c.x - p.x, c.z - p.z) < 1.15 && !this.dead) {
        this.money += c.v;
        c.t = c.v >= 100 ? 90 : 30;
        c.m.visible = false;
        this.toast(`+${c.v} uang${c.v >= 100 ? ' · HARTA BESAR!' : ''}`);
        Audio.sfx('quest');
        this.warHud();
      }
    }
    /* putar bola disko */
    if (this.discoBall && this.warFloor === 4) this.discoBall.rotation.y += dt * 1.5;
    /* balap rintangan di lantai 6 */
    if (this.raceCd > 0) this.raceCd -= dt;
    const onTrack = this.warFloor === 5 && p.x > 6.7 && p.x < 12.3 && p.z > -12.8 && p.z < 12.8;
    if (this.race) {
      if (!onTrack) { this.race = null; this.toast('Balapan dibatalkan'); }
      else {
        this.race.t += dt;
        if (p.z > 11.6) {
          const tm = this.race.t, rw = Math.max(20, Math.round(170 - tm * 4));
          this.money += rw;
          this.race = null;
          this.raceCd = 6;
          this.toast(`FINISH! ${tm.toFixed(1)} detik · +${rw} uang`);
          Audio.sfx('quest');
          this.warHud();
        }
      }
    } else if (onTrack && this.raceCd <= 0 && p.z > -12.4 && p.z < -11.1) {
      this.race = { t: 0 };
      this.toast('MULAI! Lari ke garis FINISH, lompati palang!');
    }
  },

  warHud() {
    const h = $('warHud');
    if (!h) return;
    const safe = this.inSafe(this.p.x, this.p.z, this.p.y);
    const lt = this.warFloor >= 10 ? 'Atap' : 'Lt.' + ((this.warFloor || 0) + 1);
    h.innerHTML = `<b class="rainbow">PETUALANGAN WAR</b> · 👥 ${this.remotes.size + 1 + (this.bots ? this.bots.length : 0)} · 💰 ${this.money} · 🛡 ${ARMOR[this.armor].n} · ${lt} · <span style="color:${safe ? '#7dff9a' : '#ff6b6b'}">${safe ? 'ZONA AMAN' : 'ARENA PVP'}</span>`;
    const m = $('mShop');
    if (m && m.classList.contains('show') && !this.nearNpc()) m.classList.remove('show');
  },

  nearNpc() { const p = this.p; if (Math.abs(p.y - Y) > 2.5) return undefined; return (this.npcs || []).find((n) => Math.hypot(n.x - p.x, n.z - p.z) < 3.8); },

  openShop() {
    let m = $('mShop');
    if (!m) {
      m = document.createElement('div');
      m.id = 'mShop';
      /* class "pe" wajib: tanpa itu #hud mematikan semua sentuhan, sehingga tombol Tutup tidak bisa ditekan */
      m.className = 'modal top pe';
      $('hud').appendChild(m);
    }
    const close = () => m.classList.remove('show');
    const draw = () => {
      let sell = 0;
      const inv = this.p.inv;
      for (const k in SELL) sell += (inv[k] || 0) * SELL[k];
      m.innerHTML = '';
      const c = document.createElement('div');
      c.className = 'card';
      c.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%"><h3 style="margin:0">🛒 Toko Desa</h3><button id="shopX" class="btn" style="min-width:48px;min-height:44px;padding:6px 14px;font-size:20px">✕</button></div><div style="margin:6px 0">💰 Uang: <b>${this.money}</b> · 🛡 ${ARMOR[this.armor].n}</div>`;
      ARMOR.forEach((a, i) => {
        if (!i) return;
        const b = document.createElement('button');
        b.className = 'btn' + (this.armor >= i ? ' dim' : '');
        b.textContent = this.armor >= i ? `${a.n} (dimiliki)` : `${a.n} · Rp ${a.p} · kurangi damage ${Math.round(a.r * 100)}%`;
        b.onclick = () => {
          if (this.armor >= i) return;
          if (this.money < a.p) { this.toast('Uang kurang!'); return; }
          this.money -= a.p; this.armor = i; this.toast(a.n + ' dibeli!'); Audio.sfx('quest'); draw();
        };
        c.appendChild(b);
      });
      const s = document.createElement('button');
      s.className = 'btn';
      s.textContent = `Jual semua hasil tas (+${sell})`;
      s.onclick = () => {
        if (sell <= 0) { this.toast('Tidak ada yang bisa dijual'); return; }
        for (const k in SELL) inv[k] = 0;
        this.money += sell; this.toast(`Terjual! +${sell} uang`); Audio.sfx('cook'); this.renderBag(); draw();
      };
      const x = document.createElement('button');
      x.className = 'btn dim';
      x.textContent = 'Tutup';
      const hit = (el) => {
        el.onclick = (e) => { e.stopPropagation(); close(); };
        el.onpointerdown = (e) => e.stopPropagation();
      };
      hit(x);
      c.append(s, x);
      m.appendChild(c);
      const xb = c.querySelector('#shopX');
      hit(xb);
      c.onpointerdown = (e) => e.stopPropagation();
      m.onclick = (e) => { if (e.target === m) close(); };
    };
    draw();
    m.classList.add('show');
  },

  pvpHit(tool) {
    if (this.inSafe(this.p.x, this.p.z, this.p.y)) return false;
    const f = this.fwd(), e = this.eye;
    let best = null, bd = 3.4;
    for (const [id, r] of (this.net ? this.remotes : [])) {
      const c = r.g.position;
      if (this.inSafe(c.x, c.z, c.y)) continue;
      const dx = c.x - e.x, dy = c.y + 1.1 - e.y, dz = c.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > bd || (dx * f.x + dy * f.y + dz * f.z) / d < 0.8) continue;
      best = id; bd = d;
    }
    const bot = this.botAim(tool);
    if (bot && (!best || Math.hypot(bot.x - e.x, 4.3 - e.y, bot.z - e.z) < bd)) {
      this.botHurt(bot, 8 + (tool.animal || 1) * 3, true);
      Audio.sfx('hit');
      return true;
    }
    if (!best) return false;
    const c = this.remotes.get(best).g.position;
    this.net.send({ t: 'hit', to: best, d: 8 + (tool.animal || 1) * 3 });
    Audio.sfx('hit');
    this.burst(c.x, c.y + 1.2, c.z, 0xc0392b, 6);
    return true;
  },

  takeHit(m) {
    if (this.dead || this.inSafe(this.p.x, this.p.z, this.p.y)) return;
    this.lastHitBy = m.f;
    this.lastHitT = performance.now();
    this.hurt(m.d * (1 - ARMOR[this.armor].r));
  },

  warKill(m) {
    this.money += 150;
    this.toast('Kamu mengalahkan lawan! +150 uang');
    Audio.sfx('quest');
  },
};
