/* NPC pemain di PETUALANGAN WAR: nama acak, jalan acak, ngobrol acak, ikut main PvP di arena */
import * as THREE from 'three';
import { buildChar, normLook } from './chars.js';
import { Audio } from './audio.js';
import { ARMOR } from './war.js';

const Y = 3.2;
const ARENA = { x0: -20, x1: 20, z0: 1, z1: 27 };
const FIRST = ['Rizky', 'Dimas', 'Aldi', 'Kevin', 'Putra', 'Nanda', 'Bagas', 'Raka', 'Fajar', 'Galang', 'Dika', 'Bayu', 'Yoga', 'Ilham', 'Rafi', 'Satria', 'Wahyu', 'Farel', 'Naufal', 'Zidan', 'Aira', 'Sinta', 'Nadia', 'Dewi', 'Salsa', 'Intan'];
const TAIL = ['', '', '_ID', '77', '_gaming', 'XD', '99', '_pro', 'YT', '07', 'ofc', '_santay', '123'];
const SAY = [
  'haiii', 'halo semuanya', 'ayo duel di arena', 'siapa mau sparing?', 'wkwk', 'gg', 'mantap', 'oke',
  'lawan aku dong', 'ada yang tau tangga ke lantai 5?', 'kocak', 'haii kak', 'semangat ya', 'nice', 'yuk push arena',
  'mabar yuk', 'koin di lantai 3 susah banget', 'siapa yang di arena?', 'lagi cari koin nih', 'armor emas mahal ya',
];
const HI = ['haiii juga', 'halo kak!', 'haii', 'oiii halo', 'hai hai'];
const OK = ['oke', 'siap', 'wkwk iya', 'mantap', 'hahaha', 'gas lah', 'boleh tuh', 'sip', 'iya kak'];
const SKIN = ['#e8b48a', '#c68642', '#f1c9a5', '#a86b3c', '#8d5524'];
const SHIRT = ['#c0392b', '#2a6fb0', '#2f7d4f', '#6b3fa0', '#d9a21b', '#2b2b2f', '#e0e0e0', '#e56b1f'];
const HAIR = ['#1b1b1b', '#3b2412', '#6b4423', '#d9c27a', '#222a44'];

const pick = (a) => a[(Math.random() * a.length) | 0];
const inArena = (x, z) => x > ARENA.x0 && x < ARENA.x1 && z > ARENA.z0 && z < ARENA.z1;

export const botMixin = {
  makeBots() {
    this.bots = [];
    this.botChatT = 12 + Math.random() * 10;
    const used = new Set();
    const n = 8;
    for (let i = 0; i < n; i++) {
      this.timers.push(setTimeout(() => { if (this.running) this.spawnBot(used); }, 1800 + i * (1500 + Math.random() * 2500)));
    }
  },

  randName(used) {
    for (let k = 0; k < 20; k++) {
      const nm = (pick(FIRST) + pick(TAIL)).slice(0, 14);
      if (!used.has(nm)) { used.add(nm); return nm; }
    }
    return 'Pemain' + ((Math.random() * 900 + 100) | 0);
  },

  spawnBot(used) {
    const name = this.randName(used);
    const look = normLook({
      skin: pick(SKIN), shirt: pick(SHIRT), pants: pick(['#2b3a55', '#3a3a3f', '#5b3a1e', '#1f2f4a']), hair: pick(HAIR),
      hairStyle: (Math.random() * 6) | 0, hat: Math.random() < 0.2 ? pick(SHIRT) : null, hatStyle: Math.random() < 0.2 ? 1 : 0,
    });
    const g = buildChar(look);
    g.rotation.order = 'YXZ';
    g.add(this.makeLabel(name));
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: 0.6, roughness: 0.35 }));
    sword.position.set(0, -0.75, 0.1);
    sword.visible = false;
    g.userData.armR.add(sword);
    const b = { name, g, sword, x: 0, z: 0, hp: 50, st: 'walk', yaw: 0, vis: [], wait: 0, cd: 0, swing: 0, dead: 0, lie: 0, stuck: 0, lx: 0, lz: 0, ph: Math.random() * 6, mv: 0, spd: 2.6 + Math.random() * 1.8 };
    this.botPlace(b);
    this.scene.add(g);
    this.bots.push(b);
    this.toast(name + ' bergabung');
    Audio.sfx('join');
    this.warHud();
  },

  /* tempat muncul: aula (bukan arena) */
  botPlace(b) {
    for (let k = 0; k < 30; k++) {
      const x = (Math.random() - 0.5) * 50, z = -22 + Math.random() * 20;
      if (!this.botBlocked(x, z)) { b.x = x; b.z = z; break; }
    }
    b.hp = 50; b.dead = 0; b.lie = 0; b.st = 'walk'; b.vis = []; b.wait = 0;
    this.botPick(b);
  },

  botBlocked(x, z) {
    const [nx, nz] = this.boxPush(this.boxes, x, z, Y, 1.7, 0.45);
    return nx !== x || nz !== z;
  },

  /* tujuan acak; kalau harus lewat gerbang arena, tambahkan titik antara */
  botPick(b) {
    const toArena = Math.random() < 0.5;
    let tx, tz;
    for (let k = 0; k < 20; k++) {
      if (toArena) { tx = -18 + Math.random() * 36; tz = 3 + Math.random() * 22; } else { tx = (Math.random() - 0.5) * 52; tz = -25 + Math.random() * 22; }
      if (!this.botBlocked(tx, tz)) break;
    }
    b.vis = [];
    const here = inArena(b.x, b.z), there = inArena(tx, tz);
    if (here !== there) {
      const gx = (Math.abs(b.x) < 1 ? (Math.random() < 0.5 ? -8 : 8) : b.x < 0 ? -8 : 8);
      if (there) b.vis.push([gx, -2.5], [gx, 4.5]); else b.vis.push([gx, 4.5], [gx, -2.5]);
    }
    b.vis.push([tx, tz]);
  },

  botHurt(b, dmg, byPlayer) {
    if (b.st === 'dead') return;
    b.hp -= dmg;
    this.burst(b.x, Y + 1.2, b.z, 0xc0392b, 6);
    if (b.hp <= 0) {
      b.st = 'dead'; b.dead = 2.6; b.vis = [];
      if (byPlayer) {
        this.money += 150;
        this.toast(`Kamu mengalahkan ${b.name}! +150 uang`);
        Audio.sfx('quest');
        this.warHud();
        this.timers.push(setTimeout(() => this.addChat(b.name, pick(['yah kalah', 'gg kak', 'wkwk mantap', 'sakit woi', 'rematch!']), false), 900 + Math.random() * 1200));
      }
    }
  },

  /* balasan NPC saat pemain mengetik chat */
  botReply(text) {
    if (!this.bots || !this.bots.length || Math.random() < 0.15) return;
    const bot = pick(this.bots);
    const hi = /\b(h+a+i+|h+a+l+o+|hey|hi+)\b/i.test(text);
    this.timers.push(setTimeout(() => { if (this.running) this.addChat(bot.name, pick(hi ? HI : OK), false); }, 1000 + Math.random() * 2200));
  },

  botUpdate(dt) {
    const bots = this.bots;
    if (!bots || !bots.length) return;
    const p = this.p;
    const pArena = this.inArena(p.x, p.z, p.y) && !this.dead;
    this.botChatT -= dt;
    if (this.botChatT <= 0) {
      this.botChatT = 18 + Math.random() * 30;
      const b = pick(bots);
      if (b.st !== 'dead') this.addChat(b.name, pick(SAY), false);
    }
    for (const b of bots) {
      const u = b.g.userData;
      b.cd -= dt; b.swing = Math.max(0, b.swing - dt * 3);
      if (b.st === 'dead') {
        b.dead -= dt; b.lie = Math.min(1, b.lie + dt * 4);
        if (b.dead <= 0) { this.botPlace(b); b.g.rotation.x = 0; }
        else { b.g.rotation.x = -Math.PI / 2 * b.lie; b.g.position.set(b.x, Y + 0.25 * b.lie, b.z); continue; }
      }
      const inA = inArena(b.x, b.z);
      /* cari lawan: pemain (di arena) atau bot lain di arena */
      let tgt = null, td = 12;
      if (inA) {
        if (pArena) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < td) { td = d; tgt = { player: true, x: p.x, z: p.z }; } }
        for (const o of bots) {
          if (o === b || o.st === 'dead' || !inArena(o.x, o.z)) continue;
          const d = Math.hypot(o.x - b.x, o.z - b.z);
          if (d < td * 0.8) { td = d; tgt = { bot: o, x: o.x, z: o.z }; }
        }
      }
      b.sword.visible = inA;
      let mx = 0, mz = 0, spd = b.spd;
      if (tgt) {
        b.st = 'fight';
        const dx = tgt.x - b.x, dz = tgt.z - b.z, d = Math.hypot(dx, dz) || 1;
        b.yaw = Math.atan2(-dx, -dz);
        if (d > 1.7) { mx = dx / d; mz = dz / d; spd = b.spd * 1.15; }
        else if (b.cd <= 0) {
          b.cd = 0.9 + Math.random() * 0.5; b.swing = 1;
          Audio.sfx('swing');
          if (tgt.player) { if (Math.random() < 0.8) this.hurt(6 * (1 - ARMOR[this.armor].r)); }
          else if (Math.random() < 0.7) this.botHurt(tgt.bot, 10, false);
        }
      } else {
        if (b.st === 'fight') { b.st = 'walk'; b.vis = []; }
        if (b.wait > 0) { b.wait -= dt; }
        else {
          const t = b.vis[0];
          if (!t) { b.wait = 0.5 + Math.random() * 3.5; this.botPick(b); }
          else {
            const dx = t[0] - b.x, dz = t[1] - b.z, d = Math.hypot(dx, dz);
            if (d < 0.8) b.vis.shift();
            else { mx = dx / d; mz = dz / d; b.yaw = Math.atan2(-dx, -dz); }
          }
        }
      }
      const moving = mx !== 0 || mz !== 0;
      if (moving) {
        let nx = b.x + mx * spd * dt, nz = b.z + mz * spd * dt;
        [nx, nz] = this.boxPush(this.boxes, nx, nz, Y, 1.7, 0.42);
        nx = Math.max(-27, Math.min(27, nx)); nz = Math.max(-27, Math.min(27, nz));
        b.x = nx; b.z = nz;
        /* macet? pilih tujuan baru */
        b.stuck += dt;
        if (b.stuck > 1.2) { if (Math.hypot(b.x - b.lx, b.z - b.lz) < 0.6) { b.vis = []; this.botPick(b); } b.stuck = 0; b.lx = b.x; b.lz = b.z; }
      }
      /* tidak menembus pemain */
      const pdx = b.x - p.x, pdz = b.z - p.z, pd = Math.hypot(pdx, pdz);
      if (pd < 0.8 && Math.abs(p.y - Y) < 1.5 && pd > 0.001) { b.x = p.x + (pdx / pd) * 0.8; b.z = p.z + (pdz / pd) * 0.8; }
      /* tampilan */
      b.mv = lerpV(b.mv, moving ? 1 : 0, dt * 8);
      b.ph += dt * 9 * (moving ? 1 : 0);
      const sw = Math.sin(b.ph) * 0.7 * b.mv;
      b.g.position.set(b.x, Y, b.z);
      let da = b.yaw + Math.PI - b.g.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      b.g.rotation.y += da * Math.min(1, dt * 10);
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw; u.armR.rotation.x = sw;
      if (b.swing > 0) u.armR.rotation.x = -Math.sin((1 - b.swing) * Math.PI) * 1.9;
      else if (b.sword.visible) u.armR.rotation.x = -0.5 + sw * 0.4;
    }
  },

  armorR() {
    return [0, 0.15, 0.35, 0.55][this.armor] || 0;
  },

  /* serangan pemain ke NPC (arah pandang), dipanggil dari pvpHit */
  botAim(tool) {
    if (!this.bots || !this.bots.length) return null;
    const f = this.fwd(), e = this.eye;
    let best = null, bd = 3.4;
    for (const b of this.bots) {
      if (b.st === 'dead' || !inArena(b.x, b.z)) continue;
      const dx = b.x - e.x, dy = Y + 1.1 - e.y, dz = b.z - e.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > bd || (dx * f.x + dy * f.y + dz * f.z) / d < 0.78) continue;
      best = b; bd = d;
    }
    return best;
  },
};

function lerpV(a, b, k) { return a + (b - a) * Math.min(1, k); }
