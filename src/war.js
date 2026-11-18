/* PETUALANGAN WAR: map istana, penjual armor, uang, dan PvP di luar istana */
import * as THREE from 'three';
import { buildChar, normLook } from './chars.js';
import { pieceMat } from './pieces.js';
import { Audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const Y = 3.2;
const SAFE = 17; /* zona aman = di dalam tembok istana */
export const ARMOR = [
  { n: 'Tanpa Armor', p: 0, r: 0 },
  { n: 'Baju Kain', p: 150, r: 0.15 },
  { n: 'Baju Besi', p: 400, r: 0.35 },
  { n: 'Armor Emas Raja', p: 900, r: 0.55 },
];
const SELL = { kayu: 3, batu: 3, serat: 2, buah: 4, daging: 10, ikan: 8, matang: 18, ikanmatang: 15, sup: 25, bijih: 12, besi: 30, batubara: 8 };
const VILL = [
  { n: 'Pak Armor', x: -7, z: 9, shirt: '#8a3b2a', hat: '#c9a227', hatStyle: 1 },
  { n: 'Bu Zirah', x: 7, z: 9, shirt: '#2a6fb0', hair: '#3b2412', hairStyle: 2 },
  { n: 'Mbah Baja', x: -12, z: 2, shirt: '#556b2f', hair: '#d9d9d9', hairStyle: 1 },
  { n: 'Kang Tameng', x: 12, z: 2, shirt: '#e0c27a', hat: '#8a3b2a', hatStyle: 3 },
];

const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));

export const warMixin = {
  inSafe(x, z) { return Math.abs(x) < SAFE && Math.abs(z) < SAFE; },

  warBox(x, z, hx, hz, top) {
    this.boxes.push({ minx: x - hx, maxx: x + hx, minz: z - hz, maxz: z + hz, bottom: Y - 1, top: Y + top, p: { k: 'tetap', fixed: true } });
  },

  makeWar() {
    const S = this.scene;
    this.money = 150;
    this.armor = 0;
    this.npcs = [];
    this.lastHitBy = null;
    this.lastHitT = 0;
    for (const n of this.nature.near(0, 0, 90)) if (n.alive) this.nature.kill(n);
    const add = (k, x, z, r, y) => { const p = this.addPiece(k, x, y, z, r, false, null); if (p) p.fixed = true; };
    const ring = (half, levels, gate) => {
      for (let l = 0; l < levels; l++) {
        for (let i = -half + 1; i < half; i += 2) {
          if (!(gate && l < 2 && (i === -1 || i === 1))) add('batu', i, half, 0, Y + l * 3);
          add('batu', i, -half, 0, Y + l * 3);
          add('batu', half, i, 1, Y + l * 3);
          add('batu', -half, i, 1, Y + l * 3);
        }
      }
    };
    ring(16, 2, true); /* tembok luar istana */
    const keep = (x0, z0, half, lv) => { /* bangunan utama bertingkat */
      for (let l = 0; l < lv; l++) {
        for (let i = -half + 1; i < half; i += 2) {
          if (!(l < 1 && (i === -1 || i === 1))) add('batu', i + x0, z0 + half, 0, Y + l * 3);
          add('batu', i + x0, z0 - half, 0, Y + l * 3);
          add('batu', x0 + half, z0 + i, 1, Y + l * 3);
          add('batu', x0 - half, z0 + i, 1, Y + l * 3);
        }
      }
      for (let i = -half + 1; i < half; i += 2) for (let j = -half + 1; j < half; j += 2) add('atap', x0 + i, z0 + j, 0, Y + lv * 3 - 0.6);
    };
    keep(0, -6, 6, 3);
    /* menara sudut + atap kerucut */
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * 16, cz = sz * 16;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 14, 14), pieceMat('stone'));
      t.position.set(cx, Y + 6, cz);
      const c = new THREE.Mesh(new THREE.ConeGeometry(3.6, 4.5, 14), mat('#a8321f'));
      c.position.set(cx, Y + 16.2, cz);
      S.add(t, c);
      this.warBox(cx, cz, 2.6, 2.6, 14);
    }
    /* kubah emas di atas bangunan utama */
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f2c230', { metalness: 0.6, roughness: 0.3 }));
    dome.position.set(0, Y + 8.4, -6);
    S.add(dome);
    /* karpet merah, singgasana, tiang, air mancur */
    const carpet = new THREE.Mesh(new THREE.BoxGeometry(4, 0.08, 26), mat('#b3262e'));
    carpet.position.set(0, Y + 0.05, -2);
    S.add(carpet);
    const throne = new THREE.Group();
    const gold = mat('#f2c230', { metalness: 0.6, roughness: 0.3 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.6), gold); seat.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2, 3.4, 0.35), gold); back.position.set(0, 1.7, -0.7);
    throne.add(seat, back); throne.position.set(0, Y, -10.8);
    S.add(throne);
    this.warBox(0, -10.8, 1, 0.8, 1);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 7, 10), pieceMat('stone'));
      pl.position.set(sx * 3.5, Y + 3.5, -2 - k * 3.2);
      S.add(pl);
      this.warBox(sx * 3.5, -2 - k * 3.2, 0.55, 0.55, 7);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.8, 18), pieceMat('stone')); base.position.set(0, Y + 0.4, 6);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.82, 18), mat('#3aa0e0', { transparent: true, opacity: 0.8 })); water.position.set(0, Y + 0.42, 6);
    S.add(base, water);
    this.warBox(0, 6, 2.3, 2.3, 0.8);
    for (const x of [-3, 3, -10, 10]) { const p = this.addPiece('obor', x, Y + 0.1, 12.5, 0, false, null); if (p) p.fixed = true; }
    /* papan zona war di luar gerbang */
    const sign = this.makeLabel('ZONA WAR - PvP AKTIF');
    sign.scale.set(5, 1.25, 1); sign.position.set(0, Y + 5, 22);
    S.add(sign);
    /* penduduk desa penjual armor */
    VILL.forEach((v, i) => {
      const g = buildChar(normLook({ shirt: v.shirt, hat: v.hat || null, hatStyle: v.hatStyle || 0, hair: v.hair || '#1b1b1b', hairStyle: v.hairStyle || 0, skin: ['#e8b48a', '#c68642', '#f1c9a5', '#a86b3c'][i], pants: '#5b3a1e' }));
      g.position.set(v.x, Y, v.z);
      g.rotation.y = Math.atan2(-v.x, 6 - v.z);
      g.add(this.makeLabel(v.n));
      S.add(g);
      const stall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 1), pieceMat('wood'));
      stall.position.set(v.x, Y + 0.5, v.z + (v.z > 5 ? 1.4 : 0)); stall.position.x += v.z > 5 ? 0 : (v.x < 0 ? 1.4 : -1.4);
      S.add(stall);
      this.warBox(stall.position.x, stall.position.z, 1.2, 0.5, 1);
      this.warBox(v.x, v.z, 0.4, 0.4, 2);
      this.npcs.push({ x: v.x, z: v.z, g });
    });
    const p = this.p;
    p.spawn = { x: 0, z: 10 };
    p.x = 0; p.z = 10; p.y = this.groundAt(0, 10, 200);
    /* HUD khusus War */
    const old = $('warHud'); if (old) old.remove();
    const h = document.createElement('div');
    h.id = 'warHud';
    $('hud').appendChild(h);
    const bn = document.createElement('div');
    bn.id = 'warBanner';
    bn.innerHTML = '<span class="rainbow">PETUALANGAN WAR</span><small>Istana Raja</small>';
    $('hud').appendChild(bn);
    this.timers.push(setTimeout(() => bn.remove(), 4500));
    this.warHud();
    this.timers.push(setInterval(() => this.warHud(), 1000));
    this.timers.push(setTimeout(() => this.toast('Selamat datang di PETUALANGAN WAR! Istana = zona aman. Di luar = PvP'), 1500));
  },

  warHud() {
    const h = $('warHud');
    if (!h) return;
    const safe = this.inSafe(this.p.x, this.p.z);
    h.innerHTML = `<b class="rainbow">PETUALANGAN WAR</b> · 👥 ${this.remotes.size + 1} · 💰 ${this.money} · 🛡 ${ARMOR[this.armor].n} · <span style="color:${safe ? '#7dff9a' : '#ff6b6b'}">${safe ? 'ZONA AMAN' : 'ZONA WAR'}</span>`;
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
      c.innerHTML = `<h3>🛒 Toko Desa</h3><div>💰 Uang: <b>${this.money}</b> · 🛡 ${ARMOR[this.armor].n}</div>`;
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
