import * as THREE from 'three';
import { clamp, lerp } from './util.js';
import { Audio } from './audio.js';
import { ico, costIcons, setIcon } from './icons.js';
import { ITEMS, ICON, STACK, TOOLS, EQUIP, TOOL, CRAFT, CRAFT_CATS, CAP_BAG, CAP_CART, costText } from './items.js';
import { BUILD } from './pieces.js';
import { MINE_Y } from './mine.js';
import { Voice } from './voice.js';

const $ = (id) => document.getElementById(id);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o || {}));
const bx = (w, h, d, mat, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

function makeCartMesh() {
  const g = new THREE.Group();
  const wood = M(0x9a6b3a), dark = M(0x6b4a2b), steel = M(0x59606a, { metalness: 0.5 });
  const add = (m) => { m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(bx(1.3, 0.12, 1.8, wood, 0, 0.55, 0));
  add(bx(0.08, 0.42, 1.8, dark, -0.62, 0.8, 0));
  add(bx(0.08, 0.42, 1.8, dark, 0.62, 0.8, 0));
  add(bx(1.3, 0.42, 0.08, dark, 0, 0.8, -0.86));
  add(bx(1.3, 0.3, 0.08, dark, 0, 0.74, 0.86));
  const wheels = [];
  for (const sx of [-0.72, 0.72]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 14).rotateZ(Math.PI / 2), steel);
    w.position.set(sx, 0.34, 0.15);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  for (const sx of [-0.45, 0.45]) {
    const h = bx(0.06, 0.06, 1.0, dark, sx, 0.74, 1.3);
    h.rotation.x = -0.12;
    add(h);
  }
  g.userData.wheels = wheels;
  return g;
}

export const actionsMixin = {
  /* ================= TANGAN & ALAT ================= */
  makeHands() {
    const skin = new THREE.MeshStandardMaterial({ color: this.def.skin, roughness: 0.9 });
    const sleeve = new THREE.MeshStandardMaterial({ color: this.def.shirt, roughness: 0.9 });
    const mk = (side) => {
      const g = new THREE.Group();
      g.position.set(0.3 * side, -0.34, -0.5);
      g.rotation.set(0.12, -side * 0.18, 0);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.4), sleeve);
      a.position.z = 0.22;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.25), skin);
      b.position.z = -0.08;
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), skin);
      h.position.z = -0.24;
      g.add(a, b, h);
      this.cam.add(g);
      g.userData.base = g.position.clone();
      return g;
    };
    this.handL = mk(-1);
    this.handR = mk(1);
    this.held = new THREE.Group();
    this.held.position.set(0, 0.02, -0.3);
    this.handR.add(this.held);
  },

  updateHeld() {
    while (this.held.children.length) this.held.remove(this.held.children[0]);
    this.heldFlame = null;
    this.rodTip = null;
    const wood = M(0x7a5230, { roughness: 1 });
    const stone = M(0x9aa0a6, { roughness: 0.6, metalness: 0.4 });
    const iron = M(0xd2d8de, { roughness: 0.4, metalness: 0.7 });
    const h = this.held;
    switch (this.eq) {
      case 'tombak': {
        h.add(bx(0.04, 0.04, 1.0, wood, 0, 0, -0.25));
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 4), stone);
        tip.rotation.x = -Math.PI / 2;
        tip.position.z = -0.85;
        h.add(tip);
        break;
      }
      case 'kapak': case 'kapakbesi':
        h.add(bx(0.04, 0.04, 0.6, wood, 0, 0, 0));
        h.add(bx(0.04, 0.16, 0.2, this.eq === 'kapak' ? stone : iron, 0, 0.06, -0.28));
        break;
      case 'beliung': case 'beliungbesi': {
        const hd = this.eq === 'beliung' ? stone : iron;
        h.add(bx(0.04, 0.04, 0.65, wood, 0, 0, -0.02));
        h.add(bx(0.42, 0.05, 0.06, hd, 0, 0.0, -0.34));
        const l = bx(0.1, 0.05, 0.05, hd, -0.24, -0.04, -0.34); l.rotation.z = 0.5;
        const r = bx(0.1, 0.05, 0.05, hd, 0.24, -0.04, -0.34); r.rotation.z = -0.5;
        h.add(l, r);
        break;
      }
      case 'sekop':
        h.add(bx(0.04, 0.04, 0.75, wood, 0, 0, -0.1));
        h.add(bx(0.15, 0.03, 0.22, stone, 0, 0, -0.5));
        h.add(bx(0.1, 0.05, 0.04, wood, 0, 0, 0.27));
        break;
      case 'pedang': case 'pedangbesi':
        h.add(bx(0.04, 0.04, 0.16, wood, 0, 0, 0.05));
        h.add(bx(0.2, 0.03, 0.04, wood, 0, 0, -0.04));
        h.add(bx(0.012, 0.075, 0.62, this.eq === 'pedang' ? stone : iron, 0, 0, -0.38));
        break;
      case 'pancing': {
        const rod = new THREE.Group();
        rod.rotation.x = 0.45;
        rod.add(bx(0.022, 0.022, 1.2, wood, 0, 0, -0.45));
        rod.add(bx(0.07, 0.07, 0.05, M(0x444a52), 0, -0.04, 0.0));
        const tip = new THREE.Object3D();
        tip.position.set(0, 0, -1.05);
        rod.add(tip);
        h.add(rod);
        this.rodTip = tip;
        break;
      }
      case 'ember': {
        const wm = M(0x8a5a2b, { side: THREE.DoubleSide });
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.18, 12, 1, true), wm);
        b.position.set(0, -0.02, -0.28);
        h.add(b);
        h.add(bx(0.17, 0.01, 0.17, wm, 0, -0.11, -0.28));
        if (this.p.embFull) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.01, 12), new THREE.MeshBasicMaterial({ color: 0x4aa3dc }));
          w.position.set(0, 0.04, -0.28);
          h.add(w);
        }
        const hd = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 4, 10, Math.PI), M(0x444a52));
        hd.position.set(0, 0.06, -0.28);
        h.add(hd);
        break;
      }
      case 'obor': {
        h.add(bx(0.045, 0.045, 0.5, wood, 0, 0, -0.18));
        const fl = new THREE.Group();
        const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.92 }));
        f1.position.y = 0.12;
        const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
        f2.position.y = 0.09;
        fl.add(f1, f2);
        fl.position.set(0, 0.03, -0.46);
        h.add(fl);
        this.heldFlame = fl;
        break;
      }
      default: break;
    }
  },

  /* alat dipakai habis (mis. obor terpasang semua) -> kembali ke tangan kosong */
  checkEq() {
    if (this.eq !== 'tangan' && !(this.p.inv[this.eq] > 0)) this.setEq('tangan', true);
  },

  hotItems() {
    const out = ['tangan'];
    for (const k of EQUIP) if (this.p.inv[k] > 0) out.push(k);
    return out;
  },

  renderHotbar(force) {
    const el = $('hotbar');
    if (!el) return;
    const items = this.hotItems();
    const sig = items.join(',') + '|' + this.eq + '|' + this.p.inv.obor + '|' + this.p.embFull;
    if (!force && sig === this.hotSig) return;
    this.hotSig = sig;
    el.innerHTML = '';
    for (const id of items) {
      const b = document.createElement('button');
      b.className = 'hbItem' + (id === this.eq ? ' sel' : '');
      const ic = ico(id === 'tangan' ? 'fist' : id);
      let extra = '';
      if (id === 'obor') extra = `<i>${this.p.inv.obor}</i>`;
      else if (id === 'ember' && this.p.embFull) extra = '<i>' + ico('drop') + '</i>';
      b.innerHTML = `${ic}${extra}`;
      b.title = id === 'tangan' ? 'Tangan' : ITEMS[id];
      b.addEventListener('click', (e) => {
        if (this.hudEditing) return;
        e.stopPropagation();
        this.setEq(id);
      });
      el.appendChild(b);
    }
  },

  hotSelect(i) {
    const items = this.hotItems();
    if (items[i]) this.setEq(items[i]);
  },

  setEq(id, silent) {
    if (id !== 'tangan' && !(this.p.inv[id] > 0)) return;
    if (this.eq !== id) { if (this.eq === 'pancing') this.fishCancel(); }
    this.eq = id;
    this.updateHeld();
    this.renderHotbar(true);
    if (!silent && id !== 'tangan') {
  const tip = { pancing: 'Arahkan ke laut, tekan Serang untuk melempar', ember: 'Arahkan ke air, tekan Serang untuk mengisi', sekop: 'Arahkan ke tanah, tahan Serang untuk menggali', obor: 'Obor menyala ', beliung: 'Tahan  di bijih / batu bara' }[id];
      this.toast(ITEMS[id] + (tip ? ' — ' + tip : ' dipegang'));
    }
  },

  /* ================= TAS & CRAFTING ================= */
  renderBag() {
    this.renderHotbar();
    const panel = $('panelBag');
    if (!panel || !panel.classList.contains('show')) return;
    const p = this.p;
    $('bagTitle').innerHTML = ico('bag') + `<span class="lb">Tas  ${this.bagCount()}/${CAP_BAG}</span>`;
    const l = $('bagList');
    l.innerHTML = '';
    let any = false;
    for (const k of [...STACK, ...TOOLS]) {
      const n = p.inv[k] || 0;
      if (!n) continue;
      any = true;
      const d = document.createElement('div');
      d.className = 'bagItem';
      const isTool = TOOLS.includes(k);
      d.innerHTML = `${ico(k)}<b>${ITEMS[k]}</b><i>${isTool ? 'Punya' : n}</i>`;
      l.appendChild(d);
    }
    if (!any) l.innerHTML = '<div class="roomEmpty">Tas masih kosong. Tebang pohon & kumpulkan batu!</div>';

    const tabs = $('bagTabs');
    tabs.innerHTML = '';
    if (!this.bagTab) this.bagTab = 'Alat';
    for (const c of CRAFT_CATS) {
      const b = document.createElement('button');
      b.className = 'tabBtn' + (c === this.bagTab ? ' on' : '');
      b.textContent = c;
      b.addEventListener('click', () => { this.bagTab = c; this.renderBag(); });
      tabs.appendChild(b);
    }
    const c = $('bagCraft');
    c.innerHTML = '';
    if (this.bagTab === 'Bangun') {
      const info = document.createElement('div');
      info.className = 'hint';
      info.textContent = 'Tekan tombol Bangun (palu) di layar untuk membangun. Bahan yang dibutuhkan:';
      c.appendChild(info);
      for (const k of Object.keys(BUILD)) {
        if (k === 'bongkar') continue;
        const row = document.createElement('div');
        row.className = 'recipe';
        row.innerHTML = `<b>${ico('b_' + k)}${BUILD[k].n}</b><span>${this.costHtml(BUILD[k].cost)}</span>`;
        c.appendChild(row);
      }
    } else {
      for (const r of CRAFT) {
        if (r.cat !== this.bagTab) continue;
        const owned = r.cart ? !!this.cart : r.tool ? p.inv[r.id] > 0 : false;
        const row = document.createElement('div');
        row.className = 'recipe';
        const nm = document.createElement('b');
        nm.innerHTML = ico(r.cart ? 'gerobak' : r.tool ? r.id : (r.give ? Object.keys(r.give)[0] : r.id)) + r.n;
        const sp = document.createElement('span');
        sp.innerHTML = this.costHtml(r.cost);
        const bt = document.createElement('button');
        bt.className = 'btn small' + (owned ? ' dim' : '');
  bt.textContent = owned ? 'Punya' : 'Buat';
        bt.addEventListener('click', () => this.craft(r));
        row.append(nm, sp, bt);
        c.appendChild(row);
      }
      if (this.bagTab === 'Angkut') this.renderCartPanel(c);
    }
    const eb = document.createElement('button');
    eb.className = 'btn small';
    eb.innerHTML = ico('meat') + '<span class="lb">Makan</span>';
    eb.addEventListener('click', () => this.eat());
    c.appendChild(eb);
  },

  costHtml(cost) {
    return costIcons(cost, this.p.inv);
  },

  craft(r) {
    const p = this.p;
    if (r.cart ? this.cart : r.tool && p.inv[r.id] > 0) { this.toast('Sudah punya'); return; }
    if (!this.has(r.cost)) { this.toast('Bahan kurang'); return; }
    this.pay(r.cost);
    if (r.cart) {
      const f = this.fwd();
      this.spawnCart(p.x + f.x * 2.4, p.z + f.z * 2.4, p.yaw);
    } else if (r.tool) {
      p.inv[r.id] = 1;
      if (this.eq === 'tangan' && EQUIP.includes(r.id)) this.setEq(r.id, true);
    } else for (const k in r.give) this.give(k, r.give[k], true);
    this.toast(r.n + ' dibuat!');
    Audio.sfx('craft');
    this.updateQuest();
    this.renderBag();
    this.updateBuildAfford();
  },

  renderCartPanel(c) {
    const cart = this.cart;
    if (!cart) return;
    const head = document.createElement('div');
    head.className = 'recipe';
    head.innerHTML = `<b>Gerobak</b><span>${this.cartCount()}/${CAP_CART}</span>`;
    const call = document.createElement('button');
    call.className = 'btn small';
    call.textContent = 'Panggil ke sini';
    call.addEventListener('click', () => this.callCart());
    head.appendChild(call);
    c.appendChild(head);
    if (!this.cartReach()) {
      const h = document.createElement('div');
      h.className = 'hint';
      h.textContent = 'Dekati gerobak (≤7 m) untuk memindah barang.';
      c.appendChild(h);
      return;
    }
    const mk = (title, items, toCart) => {
      const box = document.createElement('div');
      box.className = 'xfer';
      const t = document.createElement('div');
      t.className = 'hint';
      t.textContent = title;
      box.appendChild(t);
      let any = false;
      for (const k of STACK) {
        const n = (toCart ? this.p.inv[k] : cart.inv[k]) || 0;
        if (!n) continue;
        any = true;
        const b = document.createElement('button');
        b.className = 'btn small';
        b.innerHTML = toCart ? `${ico(k, 'sm')} ${n} &rarr;` : `&larr; ${ico(k, 'sm')} ${n}`;
        b.addEventListener('click', () => this.moveItem(k, toCart));
        box.appendChild(b);
      }
      if (!any) { const e = document.createElement('div'); e.className = 'hint'; e.textContent = '(kosong)'; box.appendChild(e); }
      c.appendChild(box);
    };
  mk('Tas  Gerobak', null, true);
  mk('Gerobak  Tas', null, false);
  },

  moveItem(k, toCart) {
    const cart = this.cart;
    if (!cart) return;
    if (toCart) {
      const n = Math.min(this.p.inv[k] || 0, CAP_CART - this.cartCount());
      if (n <= 0) { this.toast('Gerobak penuh'); return; }
      this.p.inv[k] -= n;
      cart.inv[k] = (cart.inv[k] || 0) + n;
    } else {
      const n = Math.min(cart.inv[k] || 0, CAP_BAG - this.bagCount());
      if (n <= 0) { this.toast('Tas penuh'); return; }
      cart.inv[k] -= n;
      this.p.inv[k] = (this.p.inv[k] || 0) + n;
    }
    Audio.sfx('pickup');
    this.checkEq();
    this.renderBag();
    this.updateBuildAfford();
  },

  /* ================= GEROBAK ================= */
  spawnCart(x, z, yaw, inv) {
    if (this.cart) return;
    const g = makeCartMesh();
    this.scene.add(g);
    this.cart = { x, z, yaw, y: this.terr(x, z), inv: Object.assign({}, inv || {}), group: g, box: null, spin: 0 };
    g.visible = !this.inCave;
    this.parkCart();
    this.updateCart(0);
  },

  parkCart() {
    const c = this.cart;
    if (!c || c.box) return;
    const R = 0.85;
    c.box = { minx: c.x - R, maxx: c.x + R, minz: c.z - R, maxz: c.z + R, bottom: c.y, top: c.y + 0.9, p: null };
    this.boxes.push(c.box);
  },

  unparkCart() {
    const c = this.cart;
    if (!c || !c.box) return;
    const i = this.boxes.indexOf(c.box);
    if (i >= 0) this.boxes.splice(i, 1);
    c.box = null;
  },

  callCart() {
    const c = this.cart;
    if (!c) return;
    this.unparkCart();
    this.hitch = false;
    const p = this.p, f = this.fwd();
    c.x = p.x + f.x * 2.6;
    c.z = p.z + f.z * 2.6;
    c.yaw = p.yaw;
    this.parkCart();
    this.updateCart(0);
    this.toast('Gerobak dipanggil');
  },

  setHitch(on) {
    const c = this.cart;
    if (!c) return;
    if (on) {
      if (this.p.on || this.inCave) { this.toast('Tidak bisa dorong gerobak di sini'); return; }
      this.unparkCart();
      this.hitch = true;
      this.toast('Mendorong gerobak');
    } else {
      this.hitch = false;
      this.parkCart();
      this.toast('Gerobak dilepas');
    }
  },

  updateCart(dt) {
    const c = this.cart;
    if (!c) return;
    const p = this.p;
    const px = c.x, pz = c.z;
    if (this.hitch) {
      if (p.on || this.inCave || this.dead) { this.setHitch(false); }
      else {
        const tx = p.x - Math.sin(p.yaw) * 1.9, tz = p.z - Math.cos(p.yaw) * 1.9;
        const [nx, nz] = this.collide(tx, tz, p.y, 1.0, 0.7, true);
        if (this.hf.sample(nx, nz) > -0.3) {
          const k = dt > 0 ? Math.min(1, dt * 14) : 1;
          c.x = lerp(c.x, nx, k);
          c.z = lerp(c.z, nz, k);
        }
        c.yaw += angDiff(p.yaw, c.yaw) * (dt > 0 ? Math.min(1, dt * 10) : 1);
        if (Math.hypot(c.x - p.x, c.z - p.z) > 4.6) { this.setHitch(false); this.toast('Gerobak terlepas'); }
      }
    }
    c.y = this.groundAt(c.x, c.z, this.hitch ? p.y : c.y + 0.5);
    c.group.position.set(c.x, c.y, c.z);
    c.group.rotation.y = c.yaw;
    const moved = Math.hypot(c.x - px, c.z - pz);
    c.spin += moved / 0.34;
    for (const w of c.group.userData.wheels) w.rotation.x = c.spin;
  },

  remoteCart(r, ct) {
    if (!r.cartMesh) { r.cartMesh = makeCartMesh(); this.scene.add(r.cartMesh); }
    r.cartMesh.position.set(ct[0], this.hf.sample(ct[0], ct[1]), ct[1]);
    r.cartMesh.rotation.y = ct[2];
  },

  /* ================= TARGET & SERANG ================= */
  findTarget(reach) {
    const e = this.cam.position, d = this.fwd();
    let best = null, bt = 1e9;
    const test = (cx, cy, cz, rad) => {
      const vx = cx - e.x, vy = cy - e.y, vz = cz - e.z;
      const t = vx * d.x + vy * d.y + vz * d.z;
      if (t < 0.2 || t > reach + rad) return null;
      const perp2 = vx * vx + vy * vy + vz * vz - t * t;
      if (perp2 < rad * rad) return t;
      return null;
    };
    for (const n of this.world().near(e.x, e.z, reach + 3)) {
      if (!n.alive) continue;
      const t = test(n.x, n.cy, n.z, n.r);
      if (t !== null && t < bt) { bt = t; best = { kind: 'node', n }; }
    }
    if (!this.inCave) {
      for (const a of this.animals.list) {
        if (a.dead || !a.g.visible) continue;
        const t = test(a.x, this.animals.center(a), a.z, a.def.hit);
        if (t !== null && t < bt) { bt = t; best = { kind: 'animal', a }; }
      }
    }
    return best;
  },

  attack() {
    this.actCd = 0.42;
    this.swing = 0.01;
    Audio.sfx('swing');
    const tool = TOOL[this.eq] || TOOL.tangan;
    const tg = this.findTarget(3.6);
    if (!tg) { if (tool.dig) this.dig(); return; }
    if (tg.kind === 'node') {
      const n = tg.n;
      let dmg = 1;
      if (n.type === 'tree') dmg = tool.tree;
      else if (n.type === 'rock') dmg = tool.rock;
      else if (n.type === 'ore') dmg = tool.ore;
      if (n.type === 'ore' && dmg <= 0) {
  this.toastOnce('needpick', 'Butuh  Beliung! Buat di Tas (tab Alat) lalu pegang di hotbar');
        Audio.sfx('mine');
        return;
      }
      n.hp -= dmg;
      const isTree = n.type === 'tree';
      Audio.sfx(isTree ? 'chop' : 'mine');
      const col = isTree ? 0x8a5a2b : n.type === 'ore' ? (n.ore === 'coal' ? 0x2a2a30 : 0xc4713f) : n.type === 'rock' ? 0x9a9ea4 : 0x3f8f3a;
      this.burst(n.x, n.cy, n.z, col);
      if (n.hp <= 0) {
        this.world().kill(n);
        if (this.net && !this.inCave && n.type !== 'bush') this.net.send({ t: 'k', i: n.idx });
        if (isTree) {
          Audio.sfx('fall');
          this.stats.chop++;
          this.give('kayu', 3 + ((Math.random() * 3) | 0) + (tool.tree >= 3 ? 1 : 0));
          if (Math.random() < 0.75) this.give('serat', 1 + (Math.random() < 0.3 ? 1 : 0));
        } else if (n.type === 'ore') {
          this.stats.ore++;
          if (n.ore === 'coal') this.give('batubara', 2 + ((Math.random() * 3) | 0));
          else this.give('bijih', 1 + ((Math.random() * 3) | 0));
        } else if (n.type === 'rock') {
          this.stats.mine++;
          this.stats.ore += this.inCave ? 1 : 0;
          this.give('batu', 2 + ((Math.random() * 2) | 0));
        } else { this.give('buah', 2); this.give('serat', 2); }
        this.updateQuest();
      }
    } else {
      const a = tg.a;
      Audio.sfx('hit');
      this.burst(a.x, this.animals.center(a) + 0.2, a.z, 0xc0392b, 5);
      const drop = this.animals.hit(a, tool.animal);
      if (drop) {
        this.stats.hunt++;
        this.give(drop[0], drop[1]);
        this.updateQuest();
      }
    }
  },

  /* gali tanah dengan sekop */
  dig() {
    if (this.inCave) return;
    const e = this.cam.position, d = this.fwd();
    for (let s = 0.4; s <= 3.6; s += 0.2) {
      const x = e.x + d.x * s, y = e.y + d.y * s, z = e.z + d.z * s;
      const h = this.hf.sample(x, z);
      if (y <= h) {
        if (h < 0.35) { this.toastOnce('dig', 'Gali di tanah, bukan di air'); return; }
        this.stats.dig++;
        Audio.sfx('place');
        this.burst(x, h + 0.1, z, 0x6b4a2b, 6);
        this.give('tanah', 1 + ((Math.random() * 2) | 0));
        if (Math.random() < 0.4) this.give('cacing', 1);
        this.actCd = 0.55;
        return;
      }
    }
  },

  /* ================= AKSI ================= */
  pressAct() {
    if (this.paused || this.dead || this.sleeping || this.busy || this.hudEditing || this.driving) return;
    if (this.build) { this.place(); return; }
    if (this.actTool()) return;
    this.act = true;
  },

  actTool() {
    const d = this.aimDoor();
    if (d) { this.toggleDoor(d); return true; }
    if (this.eq === 'pancing') { this.fishPress(); return true; }
    if (this.eq === 'ember') { this.emberPress(); return true; }
    return false;
  },

  aimDoor() {
    this.ray.set(this.cam.position, this.fwd());
    this.ray.far = 3.6;
    const hs = this.ray.intersectObjects(this.pieceRoots(), true).filter((h) => !h.object.userData.nopick && h.object.userData.piece);
    if (hs.length && hs[0].object.userData.piece.k === 'pintu') return hs[0].object.userData.piece;
    return null;
  },

  /* ================= MEMANCING ================= */
  fishPress() {
    const f = this.fish;
    if (f.st === 'idle') this.fishCast();
    else if (f.st === 'bite') this.fishCatch();
    else { this.toast('Pancing ditarik'); this.fishCancel(); }
  },

  fishCast() {
    if (this.inCave) return;
    const e = this.cam.position, d = this.fwd();
    if (d.y > -0.03) { this.toast('Arahkan ke air (lihat agak ke bawah)'); return; }
    const t = -e.y / d.y;
    if (t < 2.5) { this.toast('Terlalu dekat, lempar lebih jauh'); return; }
    if (t > 17) { this.toast('Terlalu jauh'); return; }
    const x = e.x + d.x * t, z = e.z + d.z * t;
    if (this.hf.sample(x, z) > -0.5) { this.toast('Lempar ke air yang dalam '); return; }
    const f = this.fish;
    f.st = 'wait';
    f.x = x; f.z = z;
    f.bait = false;
    if (this.p.inv.cacing > 0) { this.p.inv.cacing--; f.bait = true; this.renderBag(); }
    f.t = (3 + Math.random() * 6) * (f.bait ? 0.5 : 1);
    f.bt = 0;
    if (!this.bobber) {
      this.bobber = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
      this.scene.add(this.bobber);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.fishLine = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf2f2f2 }));
      this.fishLine.frustumCulled = false;
      this.scene.add(this.fishLine);
    }
    this.bobber.visible = true;
    this.fishLine.visible = true;
    this.bobber.position.set(x, 0.02, z);
    this.swing = 0.01;
    Audio.sfx('splash');
    this.toast(f.bait ? 'Umpan cacing dipasang, tunggu...' : 'Tunggu ikan menggigit...');
  },

  fishCancel() {
    const f = this.fish;
    f.st = 'idle';
    if (this.bobber) { this.bobber.visible = false; this.fishLine.visible = false; }
  },

  fishCatch() {
    const f = this.fish;
    this.swing = 0.01;
    const big = Math.random() < 0.2;
    this.stats.fish++;
    this.fishCancel();
    Audio.sfx('splash');
    this.give('ikan', big ? 2 : 1);
    if (big) this.toast('Ikan besar!');
    this.updateQuest();
    void f;
  },

  updateFish(dt) {
    const f = this.fish;
    if (f.st === 'idle') return;
    const p = this.p;
    if (this.eq !== 'pancing' || this.inCave || Math.hypot(f.x - p.x, f.z - p.z) > 24 || this.build) { this.fishCancel(); return; }
    f.bt += dt;
    let by = 0.02 + Math.sin(f.bt * 3) * 0.03;
    if (f.st === 'wait') {
      f.t -= dt;
      if (f.t <= 0) {
        f.st = 'bite';
        f.t = 1.5;
        this.toast('Ikan menggigit! Tekan Serang SEKARANG');
        Audio.sfx('splash');
      }
    } else if (f.st === 'bite') {
      by = -0.1 + Math.sin(f.bt * 40) * 0.05;
      f.t -= dt;
      if (f.t <= 0) { this.toast('Ikan lolos...'); this.fishCancel(); return; }
    }
    this.bobber.position.set(f.x, by, f.z);
    const v = this._fv || (this._fv = new THREE.Vector3());
    if (this.rodTip) this.rodTip.getWorldPosition(v);
    else v.copy(this.cam.position);
    const a = this.fishLine.geometry.attributes.position;
    a.setXYZ(0, v.x, v.y, v.z);
    a.setXYZ(1, f.x, by, f.z);
    a.needsUpdate = true;
  },

  /* ================= EMBER ================= */
  waterAhead(maxD) {
    const e = this.cam.position, d = this.fwd();
    if (this.inWater) return true;
    if (d.y < -0.02) {
      const t = -e.y / d.y;
      if (t > 0.3 && t <= maxD && this.hf.sample(e.x + d.x * t, e.z + d.z * t) < -0.3) return true;
    }
    return false;
  },

  emberPress() {
    const p = this.p;
    if (!p.embFull) {
      if (this.waterAhead(6)) {
        p.embFull = true;
        this.toast('Ember terisi air');
        Audio.sfx('splash');
      } else this.toast('Arahkan ember ke laut/air (dekat)');
    } else {
      p.embFull = false;
      p.thirst = Math.min(100, p.thirst + 45);
      this.stats.ember++;
      this.toast('Glek glek...  +45 minum');
      Audio.sfx('drink');
      this.updateQuest();
    }
    this.swing = 0.01;
    this.updateHeld();
    this.renderHotbar(true);
  },

  /* ================= DEKAT BANGUNAN ================= */
  nearPiece(k, r, dy) {
    const p = this.p;
    for (const q of this.pieces) {
      if (q.k !== k) continue;
      const [x, y, z] = this.wpos(q);
      if (Math.hypot(x - p.x, z - p.z) < r && Math.abs(y - p.y) < (dy || 2.5)) return q;
    }
    return null;
  },

  nearFire() { return this.nearPiece('api', 3.4, 3); },
  nearBed() { return this.nearPiece('kasur', 3.4, 2.5); },
  nearStove() { return this.nearPiece('kompor', 3.2, 2.5); },
  nearFurnace() { return this.nearPiece('tungku', 3.2, 2.5); },

  canDrink() {
    if (this.inWater) return true;
    const p = this.p;
    if (this.inCave) return false;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    for (const d of [1.2, 2.2, 3.2]) {
      if (this.hf.sample(p.x - sin * d, p.z - cos * d) < 0.05) return true;
    }
    return false;
  },

  /* ================= TOMBOL KONTEKS ================= */
  updateCtx() {
    const inv = this.p.inv;
    const raw = inv.daging + inv.ikan;
    let c = null;
    const door = !this.build && !this.sleeping && !this.driving && !this.busy ? this.aimDoor() : null;
    if (this.sleeping) c = { id: 'wake', ic: 'wake', t: 'Bangun' };
    else if (this.driving) c = { id: 'undrive', ic: 'anchor', t: 'Turun' };
    else if (door) c = { id: 'door', ic: 'door', t: door.o ? 'Tutup' : 'Buka', door };
    else if (this.nearBed()) c = { id: 'sleep', ic: 'wake', t: 'Tidur' };
    else if (this.nearHelm()) c = { id: 'drive', ic: 'wheel', t: 'Kemudi' };
    else if (this.nearFurnace() && inv.bijih > 0) c = { id: 'smelt', ic: 'fire', t: 'Lebur' };
    else if (this.nearStove() && raw > 0) c = { id: 'stove', ic: 'sup', t: 'Masak Sup' };
    else if (this.nearFire() && raw > 0) c = { id: 'cook', ic: 'fire', t: 'Masak' };
    else if (this.cart && this.hitch) c = { id: 'unhitch', ic: 'cart', t: 'Lepas' };
    else if (this.cart && !this.inCave && Math.hypot(this.cart.x - this.p.x, this.cart.z - this.p.z) < 3.4) c = { id: 'hitch', ic: 'cart', t: 'Dorong' };
    else if (this.canDrink()) c = { id: 'drink', ic: 'drop', t: 'Minum' };
    this.ctx = c;
    const b = $('btnCtx');
    if (c) { setIcon(b, c.ic, c.t); b.classList.add('show'); } else b.classList.remove('show');
  },

  doCtx() {
    if (!this.ctx || this.dead || this.busy || this.hudEditing) return;
    const p = this.p;
    const id = this.ctx.id;
    if (id === 'wake') { this.wake(false); return; }
    if (this.sleeping) return;
    if (id === 'undrive') { this.stopDrive(); return; }
    if (id === 'door') { this.toggleDoor(this.ctx.door); return; }
    if (id === 'drive') { const V = this.nearHelm(); if (V) { this.startDrive(V); this.stats.sail++; this.updateQuest(); } return; }
    if (id === 'hitch') { this.setHitch(true); return; }
    if (id === 'unhitch') { this.setHitch(false); return; }
    if (id === 'drink') {
      if (this.drinkCd > 0) return;
      this.drinkCd = 0.6;
      p.thirst = Math.min(100, p.thirst + 30);
      this.toast('Glek glek... ');
      Audio.sfx('drink');
    } else if (id === 'cook') {
      const a = p.inv.daging, b = p.inv.ikan;
      p.inv.matang += a; p.inv.ikanmatang += b; p.inv.daging = 0; p.inv.ikan = 0;
      this.toast(`Dimasak: ${a + b} makanan`);
      Audio.sfx('cook');
      if (a + b > 0) this.stats.cook++;
      this.updateQuest();
      this.renderBag();
    } else if (id === 'stove') {
      this.cookStove();
    } else if (id === 'smelt') {
      this.smelt();
    } else if (id === 'sleep') {
      this.sleepDown(this.nearBed());
    }
  },

  cookStove() {
    const p = this.p;
    if (!(p.inv.panci > 0)) { this.toast('Butuh  Panci! (Tas, tab Alat, perlu Besi)'); return; }
    const raw = p.inv.daging + p.inv.ikan;
    const n = Math.min(raw, p.inv.kayu * 2);
    if (n <= 0) { this.toast('Butuh kayu bakar untuk kompor'); return; }
    p.inv.kayu -= Math.ceil(n / 2);
    let left = n;
    const d = Math.min(left, p.inv.daging); p.inv.daging -= d; left -= d;
    p.inv.ikan -= left;
    p.inv.sup += n;
    this.toast(`${n} Sup Lezat siap!`);
    Audio.sfx('cook');
    this.stats.cook++;
    const st = this.nearStove();
    if (st && st.ex.flames) {
      for (const f of st.ex.flames) f.visible = true;
      this.timers.push(setTimeout(() => { for (const f of st.ex.flames) f.visible = false; }, 3000));
    }
    this.updateQuest();
    this.renderBag();
  },

  smelt() {
    const p = this.p;
    const n = Math.min(p.inv.bijih, p.inv.batubara + Math.floor(p.inv.kayu / 2));
    if (n <= 0) { this.toast('Butuh Batu Bara  (atau 2 Kayu per bijih)'); return; }
    const coal = Math.min(n, p.inv.batubara);
    p.inv.batubara -= coal;
    p.inv.kayu -= (n - coal) * 2;
    p.inv.bijih -= n;
    this.give('besi', n, true);
    this.toast(`${n} Besi dilebur!`);
    Audio.sfx('cook');
    this.stats.smelt += n;
    this.updateQuest();
    this.renderBag();
  },

  /* ================= TIDUR ================= */
  isNight() { return this.t < 0.23 || this.t > 0.77; },

  sleepDown(bed) {
    if (!bed) return;
    const p = this.p;
    const [wx, wy, wz] = this.wpos(bed);
    p.spawn = { x: wx, z: wz };
    if (!this.isNight()) { this.toast('Belum malam. Titik spawn diset di kasur.'); return; }
    for (const r of this.remotes.values()) {
      if (r.sl && Math.hypot(r.x - wx, r.z - wz) < 1.4) { this.toast('Kasur sedang dipakai pemain lain'); return; }
    }
    this.hitch && this.setHitch(false);
    this.fishCancel();
    this.act = false;
    if (this.crouch) { this.crouch = false; $('btnCrouch').classList.remove('on'); }
    if (!this.mp()) {
      this.sleeping = true;
      Audio.sfx('sleep');
      const f = $('fade');
      f.classList.add('show');
      this.timers.push(setTimeout(() => {
        this.t = 0.27;
        this.day++;
        this.p.hp = 100;
        this.p.hunger = Math.max(10, this.p.hunger - 10);
        this.p.thirst = Math.max(10, this.p.thirst - 10);
        f.classList.remove('show');
        this.sleeping = false;
        this.toast('Selamat pagi! Kamu merasa segar ');
        this.stats.sleep++;
        this.updateQuest();
        this.save();
      }, 1800));
      return;
    }
    /* online: berbaring di kasur, malam dilewati kalau semua pemain tidur */
    this.sleeping = true;
    this.sleepBed = bed;
    if (bed.vessel) { p.on = bed.vessel; p.lx = bed.x; p.lz = bed.z; }
    else { p.on = null; p.x = wx; p.z = wz; }
    p.y = wy + 0.5;
    p.vy = 0;
    p.yaw = (bed.r * Math.PI) / 2 + (bed.vessel ? bed.vessel.yaw : 0);
    p.pitch = 1.15;
    this.inp.mx = 0; this.inp.my = 0;
    this.sleepers.add(this.net.myId);
    this.net.send({ t: 'sl', on: 1 });
    Audio.sfx('sleep');
    $('sleepMsg').classList.add('show');
    this.sleepMsgT = 0;
    this.checkAllAsleep();
  },

  wake(silent) {
    if (!this.sleeping && !this.sleepBed) return;
    this.sleeping = false;
    this.sleepBed = null;
    this.p.pitch = 0;
    $('sleepMsg').classList.remove('show');
    if (this.online && this.net) {
      this.sleepers.delete(this.net.myId);
      this.net.send({ t: 'sl', on: 0 });
    }
    if (!silent) this.toast('Kamu bangun');
  },

  checkAllAsleep() {
    if (!this.online || !this.sleeping || !this.sleepBed || !this.net) return;
    for (const id of this.remotes.keys()) if (!this.sleepers.has(id)) return;
    this.skipNight();
  },

  skipNight() {
    const p = this.p;
    this.t = 0.27;
    this.day++;
    p.hp = 100;
    p.hunger = Math.max(10, p.hunger - 10);
    p.thirst = Math.max(10, p.thirst - 10);
    this.stats.sleep++;
    this.wake(true);
    this.toast('Selamat pagi! Semua pemain tidur, malam dilewati ');
    this.updateQuest();
  },

  updateSleep(dt) {
    if (!this.sleeping || !this.sleepBed || !this.online) return;
    if (!this.isNight()) { this.wake(false); return; }
    this.sleepMsgT -= dt;
    if (this.sleepMsgT <= 0) {
      this.sleepMsgT = 0.5;
      const total = this.remotes.size + 1;
      const n = Math.min(total, this.sleepers.size);
      $('sleepMsgTxt').textContent = ` Tidur... ${n}/${total} pemain. Malam lewat kalau semua tidur.`;
    }
  },

  /* ================= GOA ================= */
  setCave(on, idx) {
    this.inCave = on;
    this.caveIdx = on ? idx : -1;
    this.terrain.visible = !on;
    this.water.visible = !on;
    this.nature.setVisible(!on);
    this.nature.setGrass(!on && !!(this.q && this.q.grass));
    this.animals.setHidden(on);
    this.pieceGroup.visible = !on;
    for (const V of this.vessels) V.group.visible = !on;
    for (const m of this.caveMeshes) m.visible = !on;
    this.mine.setVisible(on);
    const sk = this.sky;
    sk.sunMesh.visible = sk.moonMesh.visible = sk.stars.visible = !on;
    for (const c of sk.clouds) c.visible = !on;
    if (this.cart) this.cart.group.visible = !on;
    this.lightT = 0;
  },

  fadeTo(text, mid, done) {
    const f = $('fade');
    const sp = f.querySelector('span');
    const old = sp.textContent;
    sp.textContent = text;
    f.classList.add('show');
    this.busy = true;
    this.act = false;
    this.timers.push(setTimeout(() => {
      mid();
      f.classList.remove('show');
      this.timers.push(setTimeout(() => { sp.textContent = old; this.busy = false; if (done) done(); }, 1000));
    }, 1000));
  },

  enterCave(i) {
    if (this.busy || this.inCave) return;
    this.fishCancel();
    if (this.hitch) this.setHitch(false);
    this.fadeTo(' Masuk tambang...', () => {
      const p = this.p, m = this.mine;
      this.setCave(true, i);
      p.on = null;
      p.x = m.spawn.x; p.z = m.spawn.z; p.y = MINE_Y; p.vy = 0;
      p.yaw = m.spawn.yaw; p.pitch = 0;
  }, () => this.toast(this.eq === 'obor' ? 'Tambang gelap. Cari bijih !' : 'Gelap! Buat  Obor (Tas, tab Cahaya) & pegang di hotbar'));
  },

  exitCave() {
    if (this.busy || !this.inCave) return;
    const c = this.caves[this.caveIdx] || this.caves[0];
    this.fadeTo(' Keluar tambang...', () => {
      const p = this.p;
      this.setCave(false, -1);
      p.x = c.x + c.ox * 3.2; p.z = c.z + c.oz * 3.2;
      p.y = this.hf.sample(p.x, p.z); p.vy = 0;
      p.yaw = c.ang + Math.PI; p.pitch = 0;
    });
  },

  checkCave() {
    if (this.busy || this.dead || !this.caves.length) return;
    const p = this.p;
    if (!this.inCave) {
      if (p.on) return;
      for (let i = 0; i < this.caves.length; i++) {
        const c = this.caves[i];
        const tx = c.x + c.ox * 0.6, tz = c.z + c.oz * 0.6;
        if (Math.hypot(p.x - tx, p.z - tz) < 1.2 && Math.abs(p.y - c.y) < 3.5) { this.enterCave(i); return; }
      }
    } else {
      const e = this.mine.exit;
      if (Math.hypot(p.x - e.x, p.z - e.z) < e.r) this.exitCave();
    }
  },

  /* ================= CHAT & MIC ================= */
  initVoice() {
    this.voice = new Voice({
      myId: this.net.myId,
      send: (m) => { if (this.net) this.net.send(m); },
      nameOf: (id) => (this.remotes.get(id) && this.remotes.get(id).name) || 'Pemain',
  onSpeak: (names) => { $('voiceTag').textContent = names.length ? ' ' + names.join(', ') : ''; },
    });
  },

  async toggleMic() {
    if (this.paused && !this.online) return;
    if (!this.online || !this.voice) { this.toast('Mic hanya untuk Mabar online'); return; }
    if (this.micBusy) return;
    this.micBusy = true;
    try {
      const on = !this.voice.micOn;
      const res = await this.voice.setMic(on);
      $('btnMic').classList.toggle('on', !!res);
      this.toast(res ? 'Mic menyala — pemain lain bisa mendengarmu' : 'Mic mati');
    } catch (e) {
      $('btnMic').classList.remove('on');
      this.toast('Mic gagal: izinkan akses mikrofon untuk aplikasi ini');
    }
    this.micBusy = false;
  },

  openChat() {
    if (!this.online) { this.toast('Chat hanya untuk Mabar online'); return; }
    if (this.hudEditing) return;
    $('chatBar').classList.add('show');
    if (document.exitPointerLock) document.exitPointerLock();
    setTimeout(() => { try { $('chatIn').focus(); } catch (e) { /* abaikan */ } }, 40);
  },

  closeChat() {
    $('chatBar').classList.remove('show');
    try { $('chatIn').blur(); } catch (e) { /* abaikan */ }
  },

  sendChat() {
    const inp = $('chatIn');
    const text = inp.value.trim().slice(0, 120);
    if (!text) { this.closeChat(); return; }
    if (this.chatCd > 0) { this.toast('Pelan-pelan...'); return; }
    this.chatCd = 0.7;
    inp.value = '';
    this.addChat(this.o.name || 'Santay', text, true);
    if (this.net) this.net.send({ t: 'chat', n: String(this.o.name || 'Santay').slice(0, 14), m: text });
  },

  addChat(name, text, self) {
    const feed = $('chatFeed');
    if (!feed) return;
    const el = document.createElement('div');
    el.className = 'chatLine' + (self ? ' me' : '');
    const b = document.createElement('b');
    b.textContent = String(name).slice(0, 14) + ': ';
    const s = document.createElement('span');
    s.textContent = String(text).slice(0, 120);
    el.append(b, s);
    feed.appendChild(el);
    while (feed.children.length > 5) feed.removeChild(feed.firstChild);
    setTimeout(() => el.remove(), 12000);
    if (!self) Audio.sfx('join');
  },
};

void clamp;
void costText;
