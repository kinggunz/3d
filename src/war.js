/* PETUALANGAN WAR: map istana, penjual armor, uang, dan PvP di luar istana */
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

const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));

const FH = 4, T = 0.6;
const HS = [30, 30, 30, 22, 22, 22, 14, 14, 14, 14]; /* setengah lebar tiap lantai */
const ARENA = { x0: -15, x1: 15, z0: 45, z1: 75 };
const VILL = [
  { n: 'Pak Armor', x: -12, z: 22, shirt: '#8a3b2a', hat: '#c9a227', hatStyle: 1 },
  { n: 'Bu Zirah', x: 12, z: 22, shirt: '#2a6fb0', hair: '#3b2412', hairStyle: 2 },
  { n: 'Mbah Baja', x: -12, z: 10, shirt: '#556b2f', hair: '#d9d9d9', hairStyle: 1 },
  { n: 'Kang Tameng', x: 12, z: 10, shirt: '#e0c27a', hat: '#8a3b2a', hatStyle: 3 },
];
const COL = { wall: '#efe6d2', gold: '#f2c230', red: '#b3262e', wood: '#6b4423', glass: '#7ec8ff', stone: '#9a9a9a', sand: '#e6cf8a', leaf: '#2e8b3a', trunk: '#5b3a1e', path: '#cfc6b0', hedge: '#2f7d32', fr: '#e63946', fy: '#ffd23f', fp: '#ff6bd0', fw: '#ffffff', fv: '#9b5de5', st1: '#c9b27c', st2: '#8c3b3b', bn1: '#d62828', bn2: '#1d6fd6' };
const FLC = ['#d8c9a3', '#e4d5b0', '#cfe0d0', '#e0cfd8', '#cfd6e8', '#e8e0c0', '#d8c0a0', '#c8e0e0', '#e0d0e8', '#f0e0b0', '#e8e8e8'];

/* alur tangga dari lantai k ke k+1 (bolak-balik kiri/kanan) */
function flight(k) {
  const hhm = Math.min(HS[k], HS[Math.min(k + 1, 9)]) - 8;
  const even = k % 2 === 0, zc = even ? -4 : 4;
  const xs = even ? -hhm + 2.5 : hhm - 2.5;
  return { even, xs, x0: even ? xs : xs - 8, x1: even ? xs + 8 : xs, z0: zc - 2, z1: zc + 2 };
}

export const warMixin = {
  inArena(x, z) { return x > ARENA.x0 && x < ARENA.x1 && z > ARENA.z0 && z < ARENA.z1; },
  inSafe(x, z) { return !this.inArena(x, z); },

  makeWar() {
    const S = this.scene;
    this.money = 150;
    this.armor = 0;
    this.npcs = [];
    this.lastHitBy = null;
    this.lastHitT = 0;
    for (const n of this.nature.near(0, 0, 105)) if (n.alive && Math.hypot(n.x, n.z) < 98) this.nature.kill(n);
    const geo = {};
    const B = (k, x0, x1, y0, y1, z0, z1, solid) => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      (geo[k] = geo[k] || []).push(g);
      if (solid) this.boxes.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, bottom: y0, top: y1, p: { k: 'tetap', fixed: true } });
    };
    const Y = 3.2;
    /* ===== ISTANA: 10 lantai + atap ===== */
    for (let k = 0; k < 10; k++) {
      const h = HS[k], y = Y + FH * k, y0 = k ? y : y - 0.5, y1 = y + FH;
      const fk = 'f' + k;
      B('wall', -h, h, y0, y1, -h, -h + T, true);
      if (k === 0) { B('wall', -h, -6, y0, y1, h - T, h, true); B('wall', 6, h, y0, y1, h - T, h, true); B('wall', -6, 6, y + 3.4, y1, h - T, h, true); }
      else B('wall', -h, h, y0, y1, h - T, h, true);
      B('wall', h - T, h, y0, y1, -h + T, h - T, true);
      B('wall', -h, -h + T, y0, y1, -h + T, h - T, true);
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
        }
      };
      wing('N', -h, h);
      if (k > 0) wing('S', -h, h);
      wing('E', -h + 8, k > 0 ? h - 8 : h);
      wing('W', -h + 8, k > 0 ? h - 8 : h);
      B('lamp', -0.5, 0.5, y + 3.45, y + 3.55, -0.5, 0.5, false);
      /* tangga naik ke lantai berikutnya (lantai 10 = dek atap) */
      const f = flight(k);
      for (let i = 0; i < 8; i++) {
        const xa = f.even ? f.xs + i : f.xs - i - 1;
        B('stone', xa, xa + 1, y, y + 0.5 * (i + 1), f.z0, f.z1, true);
      }
    }
    /* lantai dasar (hanya visual) */
    B('f0', -30, 30, Y - 0.3, Y + 0.06, -30, 30, false);
    /* pelat lantai 1..10 dengan lubang tangga, pagar lubang dan pagar teras */
    for (let k = 1; k <= 10; k++) {
      const Sx = HS[k - 1], sy = Y + FH * k, f = flight(k - 1), fk = 'f' + k;
      B(fk, -Sx, f.x0, sy - 0.4, sy, -Sx, Sx, true);
      B(fk, f.x1, Sx, sy - 0.4, sy, -Sx, Sx, true);
      B(fk, f.x0, f.x1, sy - 0.4, sy, -Sx, f.z0, true);
      B(fk, f.x0, f.x1, sy - 0.4, sy, f.z1, Sx, true);
      B('gold', f.x0, f.x1, sy, sy + 1, f.z0 - 0.3, f.z0, true);
      B('gold', f.x0, f.x1, sy, sy + 1, f.z1, f.z1 + 0.3, true);
      if (f.even) B('gold', f.x0 - 0.3, f.x0, sy, sy + 1, f.z0, f.z1, true);
      else B('gold', f.x1, f.x1 + 0.3, sy, sy + 1, f.z0, f.z1, true);
      if (k === 10 || Sx > HS[k]) {
        B('stone', -Sx, Sx, sy, sy + 1.1, -Sx, -Sx + 0.4, true);
        B('stone', -Sx, Sx, sy, sy + 1.1, Sx - 0.4, Sx, true);
        B('stone', -Sx, -Sx + 0.4, sy, sy + 1.1, -Sx + 0.4, Sx - 0.4, true);
        B('stone', Sx - 0.4, Sx, sy, sy + 1.1, -Sx + 0.4, Sx - 0.4, true);
      }
    }
    /* aula singgasana lantai dasar */
    B('red', -2, 2, Y + 0.06, Y + 0.1, -21, 30, false);
    B('red', -4, 4, Y, Y + 0.5, -22, -17, true);
    B('gold', -1, 1, Y + 0.5, Y + 1.4, -21.4, -20, true);
    B('gold', -1, 1, Y + 1.4, Y + 3.6, -21.4, -21, false);
    for (const z of [24, 17, 10, 3, -4, -11]) for (const x of [-6, 6]) B('wall', x - 0.5, x + 0.5, Y, Y + 3.6, z - 0.5, z + 0.5, true);
    /* beranda depan gerbang */
    for (const x of [-14, -10, -6, 6, 10, 14]) B('wall', x - 0.6, x + 0.6, Y, Y + 8, 33, 34.2, true);
    B('gold', -15, 15, Y + 8, Y + 8.6, 30, 34.6, false);
    /* kubah emas di dek atap */
    B('gold', -1.6, 1.6, Y + 40, Y + 43, -1.6, 1.6, true);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), new THREE.MeshStandardMaterial({ color: COL.gold, metalness: 0.6, roughness: 0.3 }));
    dome.position.set(0, Y + 43.4, 0);
    S.add(dome);
    /* ===== TAMAN ===== */
    B('path', -7, 7, Y, Y + 0.08, 30, 45, false);
    B('stone', -2.6, 2.6, Y, Y + 0.8, 35.4, 40.6, true);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.82, 16), new THREE.MeshStandardMaterial({ color: '#3aa0e0', transparent: true, opacity: 0.85 }));
    water.position.set(0, Y + 0.42, 38);
    S.add(water);
    B('gold', -0.3, 0.3, Y + 0.8, Y + 3, 37.7, 38.3, false);
    for (const x of [-9, 9, -21, 21]) { B('hedge', x - 0.4, x + 0.4, Y, Y + 1.2, 31.5, 36.5, true); B('hedge', x - 0.4, x + 0.4, Y, Y + 1.2, 39.5, 42, true); }
    for (const x of [-26, -22, -15, 15, 22, 26]) for (const z of [34, 41]) { B('trunk', x - 0.3, x + 0.3, Y, Y + 3, z - 0.3, z + 0.3, true); B('leaf', x - 1.8, x + 1.8, Y + 3, Y + 6, z - 1.8, z + 1.8, false); }
    let sd = 7;
    const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const fcs = ['fr', 'fy', 'fp', 'fw', 'fv'];
    for (let i = 0; i < 110; i++) {
      const sx = rnd() < 0.5 ? -1 : 1, x = sx * (10 + rnd() * 17), z = 32 + rnd() * 11;
      if (Math.abs(Math.abs(x) - 9) < 1.2 || Math.abs(Math.abs(x) - 21) < 1.2) continue;
      B(fcs[i % 5], x, x + 0.45, Y, Y + 0.5, z, z + 0.45, false);
    }
    for (const x of [-12, 12, -24, 24]) B('wood', x - 1, x + 1, Y, Y + 0.5, 41.4, 42, true);
    for (const x of [-7.4, 7.4]) for (const z of [31.5, 43.5]) { B('gold', x - 0.12, x + 0.12, Y, Y + 3.5, z - 0.12, z + 0.12, false); B('lamp', x - 0.3, x + 0.3, Y + 3.5, Y + 3.9, z - 0.3, z + 0.3, false); }
    /* ===== ARENA PVP + TRIBUN PENONTON ===== */
    const A = ARENA;
    B('sand', A.x0, A.x1, Y - 0.3, Y + 0.06, A.z0, A.z1, false);
    B('red', A.x0, A.x1, Y + 0.06, Y + 0.09, 59.9, 60.1, false);
    B('red', -0.1, 0.1, Y + 0.06, Y + 0.09, A.z0, A.z1, false);
    B('gold', -2, 2, Y + 0.06, Y + 0.1, 58, 62, false);
    B('stone', A.x0 - 0.6, A.x0, Y, Y + 1.5, A.z0 - 0.6, A.z1 + 0.6, true);
    B('stone', A.x1, A.x1 + 0.6, Y, Y + 1.5, A.z0 - 0.6, A.z1 + 0.6, true);
    B('stone', A.x0, A.x1, Y, Y + 1.5, A.z1, A.z1 + 0.6, true);
    B('stone', A.x0, -4, Y, Y + 1.5, A.z0 - 0.6, A.z0, true);
    B('stone', 4, A.x1, Y, Y + 1.5, A.z0 - 0.6, A.z0, true);
    for (let t = 1; t <= 4; t++) {
      const c = t % 2 ? 'st1' : 'st2', o = 0.6 + 1.6 * (t - 1), e = 0.6 + 1.6 * t, top = Y + 0.5 * t;
      B(c, A.x0 - e, A.x0 - o, Y, top, A.z0 - 0.6, A.z1 + e, true);
      B(c, A.x1 + o, A.x1 + e, Y, top, A.z0 - 0.6, A.z1 + e, true);
      B(c, A.x0 - o, A.x1 + o, Y, top, A.z1 + o, A.z1 + e, true);
    }
    for (const x of [A.x0 - 0.9, A.x1 + 0.3]) for (const z of [A.z0 - 0.6, A.z1 + 0.3]) {
      B('wood', x, x + 0.4, Y, Y + 6, z, z + 0.4, false);
      B(x < 0 ? 'bn1' : 'bn2', x - 0.9, x + 1.3, Y + 3, Y + 5.6, z + 0.1, z + 0.2, false);
    }
    /* gabungkan semua kotak jadi beberapa mesh saja (ringan untuk HP) */
    for (const k in geo) {
      const m = new THREE.MeshStandardMaterial(k === 'lamp' ? { color: '#fff3b0', emissive: '#ffe9a0', emissiveIntensity: 0.9 } : k === 'glass' ? { color: COL.glass, emissive: '#2a5a8a', roughness: 0.2 } : { color: COL[k] || FLC[+k.slice(1)] || '#ccc', roughness: 0.8, metalness: k === 'gold' ? 0.5 : 0 });
      const mesh = new THREE.Mesh(mergeGeometries(geo[k]), m);
      mesh.frustumCulled = false;
      S.add(mesh);
    }
    const sign = this.makeLabel('ARENA PVP');
    sign.scale.set(6, 1.5, 1); sign.position.set(0, Y + 4.5, A.z0 - 0.5);
    S.add(sign);
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
      const aw = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 3), new THREE.MeshStandardMaterial({ color: i % 2 ? '#2a6fb0' : '#b3262e' }));
      aw.position.set(cx, Y + 2.6, v.z);
      S.add(st, aw);
      this.boxes.push({ minx: cx - 0.6, maxx: cx + 0.6, minz: v.z - 1.3, maxz: v.z + 1.3, bottom: Y - 0.2, top: Y + 1, p: { k: 'tetap', fixed: true } });
      this.boxes.push({ minx: v.x - 0.4, maxx: v.x + 0.4, minz: v.z - 0.4, maxz: v.z + 0.4, bottom: Y - 0.2, top: Y + 2, p: { k: 'tetap', fixed: true } });
      this.npcs.push({ x: v.x, z: v.z, g });
    });
    const p = this.p;
    p.spawn = { x: 0, z: 26 };
    p.x = 0; p.z = 26; p.y = Y + 0.02;
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
    this.timers.push(setTimeout(() => this.toast('Selamat datang! Arena PvP ada di selatan taman. Tribun aman untuk menonton.'), 1500));
  },

  warHud() {
    const h = $('warHud');
    if (!h) return;
    const safe = this.inSafe(this.p.x, this.p.z);
    h.innerHTML = `<b class="rainbow">PETUALANGAN WAR</b> · 👥 ${this.remotes.size + 1} · 💰 ${this.money} · 🛡 ${ARMOR[this.armor].n} · <span style="color:${safe ? '#7dff9a' : '#ff6b6b'}">${safe ? 'ZONA AMAN' : 'ARENA PVP'}</span>`;
    const m = $('mShop');
    if (m && m.classList.contains('show') && !this.nearNpc()) m.classList.remove('show');
  },

  nearNpc() { const p = this.p; return (this.npcs || []).find((n) => Math.hypot(n.x - p.x, n.z - p.z) < 3.8); },

  openShop() {
    let m = $('mShop');
    if (!m) {
      m = document.createElement('div');
      m.id = 'mShop';
      m.className = 'modal top';
      $('hud').appendChild(m);
    }
    const draw = () => {
      let sell = 0;
      const inv = this.p.inv;
      for (const k in SELL) sell += (inv[k] || 0) * SELL[k];
      m.innerHTML = '';
      const c = document.createElement('div');
      c.className = 'card';
      c.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><h3 style="margin:0">🛒 Toko Desa</h3><button id="shopX" class="btn" style="min-width:48px;min-height:44px;padding:6px 14px;font-size:20px">✕</button></div><div style="margin:6px 0">💰 Uang: <b>${this.money}</b> · 🛡 ${ARMOR[this.armor].n}</div>`;
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
      x.onclick = () => m.classList.remove('show');
      c.append(s, x);
      m.appendChild(c);
      const xb = c.querySelector('#shopX');
      xb.onclick = (e) => { e.stopPropagation(); m.classList.remove('show'); };
      xb.ontouchend = (e) => { e.preventDefault(); m.classList.remove('show'); };
      m.onclick = (e) => { if (e.target === m) m.classList.remove('show'); };
    };
    draw();
    m.classList.add('show');
  },

  pvpHit(tool) {
    if (!this.net || this.inSafe(this.p.x, this.p.z)) return false;
    const f = this.fwd(), e = this.eye;
    let best = null, bd = 3.4;
    for (const [id, r] of this.remotes) {
      const c = r.g.position;
      if (this.inSafe(c.x, c.z)) continue;
      const dx = c.x - e.x, dy = c.y + 1.1 - e.y, dz = c.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > bd || (dx * f.x + dy * f.y + dz * f.z) / d < 0.8) continue;
      best = id; bd = d;
    }
    if (!best) return false;
    const c = this.remotes.get(best).g.position;
    this.net.send({ t: 'hit', to: best, d: 8 + (tool.animal || 1) * 3 });
    Audio.sfx('hit');
    this.burst(c.x, c.y + 1.2, c.z, 0xc0392b, 6);
    return true;
  },

  takeHit(m) {
    if (this.dead || this.inSafe(this.p.x, this.p.z)) return;
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
