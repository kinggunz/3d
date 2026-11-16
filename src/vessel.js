import * as THREE from 'three';
import { clamp } from './util.js';

/* Kapal = kumpulan potongan bangunan (lantai, dinding, ...) yang melayang di air.
   Koordinat potongan di dalam kapal bersifat LOKAL; kapal punya pivot (pusat putar). */
export class Vessel {
  constructor(id, scene) {
    this.id = id;
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    scene.add(this.group);
    this.px = 0; this.pz = 0;
    this.x = 0; this.z = 0; this.yaw = 0; this.y = 0;
    this.hOff = 0;
    this.boxes = [];
    this.pieces = [];
    this.pts = [];
    this.rad = 3;
    this.speed = 0;
    this.engines = 0;
    this.helm = null;
    this.driver = null; /* null | 'me' | id pemain lain */
    this.remote = false;
    this.tx = 0; this.tz = 0; this.tyaw = 0;
    this.bob = Math.random() * 6;
    this.sendT = 0;
  }

  setPivot(px, pz) {
    this.px = px; this.pz = pz;
    this.inner.position.set(-px, 0, -pz);
  }

  sync() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.yaw;
  }

  l2w(lx, lz) {
    const dx = lx - this.px, dz = lz - this.pz, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [this.x + dx * c + dz * s, this.z - dx * s + dz * c];
  }

  w2l(wx, wz) {
    const dx = wx - this.x, dz = wz - this.z, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return [this.px + dx * c - dz * s, this.pz + dx * s + dz * c];
  }

  /* hitung ulang titik tepi (untuk tabrakan dengan daratan) & jumlah mesin */
  refresh() {
    const pts = [];
    let rad = 2;
    this.engines = 0;
    this.helm = null;
    for (const p of this.pieces) {
      if (p.k === 'mesin') this.engines++;
      if (p.k === 'setir') this.helm = p;
      if (p.k !== 'lantai') continue;
      for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const x = p.x + ox * 0.95, z = p.z + oz * 0.95;
        pts.push([x, z]);
        rad = Math.max(rad, Math.hypot(x - this.px, z - this.pz));
      }
    }
    this.pts = pts;
    this.rad = rad + 1;
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/* ======= mixin untuk Game ======= */
export const vesselMixin = {
  /* tinggi lantai lokal kapal di titik (lx,lz) atau null kalau tidak ada lantai */
  vFloor(V, lx, lz, ly) {
    let g = null;
    for (const b of V.boxes) {
      if (lx >= b.minx - 0.15 && lx <= b.maxx + 0.15 && lz >= b.minz - 0.15 && lz <= b.maxz + 0.15 && ly >= b.top - 0.65) {
        if (g === null || b.top > g) g = b.top;
      }
    }
    return g;
  },

  vesselById(id) {
    return this.vessels.find((v) => v.id === id) || null;
  },

  /* bentuk kapal dari potongan-potongan yang menyambung dengan setir */
  formVessel(helm) {
    if (helm.vessel) return helm.vessel;
    const cand = this.pieces.filter((q) => !q.vessel && q.k !== 'dermaga');
    const set = new Set([helm]);
    const queue = [helm];
    while (queue.length) {
      const a = queue.pop();
      for (const b of cand) {
        if (set.has(b)) continue;
        if (Math.abs(a.x - b.x) <= 2.4 && Math.abs(a.z - b.z) <= 2.4 && Math.abs(a.y - b.y) < 3.6) { set.add(b); queue.push(b); }
      }
    }
    const floors = [...set].filter((q) => q.k === 'lantai');
    if (!floors.length) return null;
    let sx = 0, sz = 0;
    for (const f of floors) { sx += f.x; sz += f.z; }
    const px = sx / floors.length, pz = sz / floors.length;
    const V = new Vessel('v' + helm.key, this.scene);
    V.setPivot(px, pz);
    V.x = px; V.z = pz;
    V.hOff = (helm.r * Math.PI) / 2;
    V.sync();
    this.vessels.push(V);
    for (const p of set) this.attachToVessel(p, V);
    V.refresh();
    return V;
  },

  /* pindahkan potongan statis menjadi bagian kapal (koordinat lokal = koordinat dunia saat dibentuk) */
  attachToVessel(p, V) {
    this.pieceGroup.remove(p.group);
    V.inner.add(p.group);
    this.pkeys.delete(p.key);
    p.vessel = V;
    p.key = this.pieceKey(p.k, p.x, p.y, p.z, p.r, V.id);
    this.pkeys.add(p.key);
    const keep = [];
    for (const b of this.boxes) { if (b.p === p) V.boxes.push(b); else keep.push(b); }
    this.boxes = keep;
    V.pieces.push(p);
    const fi = this.fires.indexOf(p);
    if (fi >= 0) { /* api tetap terdaftar; posisinya dihitung via wpos */ }
  },

  /* posisi dunia sebuah potongan */
  wpos(p) {
    if (!p.vessel) return [p.x, p.y, p.z];
    const [wx, wz] = p.vessel.l2w(p.x, p.z);
    return [wx, p.y + p.vessel.y, wz];
  },

  /* apakah kapal boleh berada di pose ini? (air cukup dalam, tidak menabrak dermaga/bangunan darat) */
  boatBlocked(V, nx, nz, nyaw) {
    const c = Math.cos(nyaw), s = Math.sin(nyaw);
    for (const [lx, lz] of V.pts) {
      const dx = lx - V.px, dz = lz - V.pz;
      const wx = nx + dx * c + dz * s, wz = nz - dx * s + dz * c;
      if (Math.abs(wx) > this.edge - 8 || Math.abs(wz) > this.edge - 8) return true;
      if (this.hf.sample(wx, wz) > -0.45) return true;
      for (const b of this.boxes) {
        if (wx > b.minx - 0.2 && wx < b.maxx + 0.2 && wz > b.minz - 0.2 && wz < b.maxz + 0.2 && b.top > -0.6 && b.bottom < 2.2) return true;
      }
    }
    return false;
  },

  /* geser kapal ke pose baru, penumpang ikut terbawa */
  poseVessel(V, nx, nz, nyaw) {
    const p = this.p;
    const dyaw = angDiff(nyaw, V.yaw);
    V.x = nx; V.z = nz; V.yaw = nyaw;
    if (p.on === V) {
      const [wx, wz] = V.l2w(p.lx, p.lz);
      p.x = wx; p.z = wz;
      p.yaw += dyaw;
    }
  },

  updateVessels(dt) {
    const t = performance.now() / 1000;
    for (let i = this.vessels.length - 1; i >= 0; i--) {
      const V = this.vessels[i];
      const prevY = V.y;
      V.y = Math.sin(t * 0.9 + V.bob) * 0.03;
      const p = this.p;
      if (V.driver === 'me') {
        const L = this.paused || this.dead ? 0 : 1;
        const thr = clamp((this.inp.my + this.keys.w - this.keys.s) * L, -1, 1);
        const steer = clamp((this.inp.mx + this.keys.d - this.keys.a) * L, -1, 1);
        const maxSp = 2.6 + 2.2 * Math.min(V.engines, 3);
        const target = thr >= 0 ? thr * maxSp : thr * maxSp * 0.45;
        V.speed += (target - V.speed) * Math.min(1, dt * (thr === 0 ? 1.1 : 0.8));
        let nyaw = V.yaw;
        const turn = steer * 0.55 * clamp(Math.abs(V.speed) / 2.2, 0.28, 1) * (V.speed < -0.2 ? -1 : 1);
        if (Math.abs(turn) > 0.001) {
          const cand = V.yaw - turn * dt;
          if (!this.boatBlocked(V, V.x, V.z, cand)) nyaw = cand;
        }
        const a = nyaw + V.hOff;
        const nx = V.x + -Math.sin(a) * V.speed * dt, nz = V.z + -Math.cos(a) * V.speed * dt;
        if (Math.abs(V.speed) > 0.05) {
          if (this.boatBlocked(V, nx, nz, nyaw)) {
            V.speed = -V.speed * 0.25;
            this.poseVessel(V, V.x, V.z, nyaw);
            if (Math.abs(V.speed) > 0.6) { this.toast('Kapal menabrak!'); }
          } else this.poseVessel(V, nx, nz, nyaw);
        } else this.poseVessel(V, V.x, V.z, nyaw);
        if (V.helm && V.helm.ex.wheel) V.helm.ex.wheel.rotation.z += (-steer * 1.2 - V.helm.ex.wheel.rotation.z) * Math.min(1, dt * 6);
        V.sendT -= dt;
        if (this.net && V.sendT <= 0) {
          V.sendT = 0.1;
          this.net.send({ t: 'vs', id: V.id, x: +V.x.toFixed(2), z: +V.z.toFixed(2), a: +V.yaw.toFixed(3), s: +V.speed.toFixed(2) });
        }
      } else if (V.remote) {
        const k = Math.min(1, dt * 8);
        const nx = V.x + (V.tx - V.x) * k, nz = V.z + (V.tz - V.z) * k;
        const nyaw = V.yaw + angDiff(V.tyaw, V.yaw) * k;
        this.poseVessel(V, nx, nz, nyaw);
      } else {
        /* tanpa pengemudi: meluncur pelan lalu berhenti */
        if (Math.abs(V.speed) > 0.05) {
          V.speed *= Math.max(0, 1 - dt * 1.6);
          const a = V.yaw + V.hOff;
          const nx = V.x + -Math.sin(a) * V.speed * dt, nz = V.z + -Math.cos(a) * V.speed * dt;
          if (this.boatBlocked(V, nx, nz, V.yaw)) V.speed = 0;
          else this.poseVessel(V, nx, nz, V.yaw);
        } else V.speed = 0;
      }
      if (p.on === V) p.y += V.y - prevY;
      V.sync();
      /* baling-baling mesin */
      for (const q of V.pieces) {
        if (q.ex && q.ex.prop) q.ex.prop.rotation.z += Math.abs(V.speed) * dt * 3 + (V.driver ? dt * 4 : 0);
      }
    }
  },

  /* kapal terdekat yang setirnya bisa dipakai */
  nearHelm() {
    const p = this.p;
    if (this.inCave) return null;
    for (const V of this.vessels) {
      if (!V.helm) continue;
      const [wx, , wz] = this.wpos(V.helm);
      if (Math.hypot(wx - p.x, wz - p.z) < 2.8 && Math.abs(p.y - (V.helm.y + V.y)) < 2.5) return V;
    }
    return null;
  },

  startDrive(V) {
    if (V.driver && V.driver !== 'me') { this.toast('Setir sedang dipakai pemain lain'); return; }
    if (V.engines < 1) { this.toast('Pasang ⚙️ Mesin Kapal dulu'); return; }
    if (!V.helm) return;
    /* berdiri di belakang setir */
    if (this.p.on !== V) {
      const [lx, lz] = V.w2l(this.p.x, this.p.z);
      this.p.on = V; this.p.lx = lx; this.p.lz = lz;
    }
    const hp = V.helm;
    const c = Math.cos((hp.r * Math.PI) / 2), s = Math.sin((hp.r * Math.PI) / 2);
    /* belakang setir = arah +z lokal potongan */
    this.p.lx = hp.x + 0.7 * s;
    this.p.lz = hp.z + 0.7 * c;
    this.p.y = V.y + hp.y;
    this.crouch = false;
    V.driver = 'me';
    this.driving = V;
    this.stats.sail = (this.stats.sail || 0) + 0;
    if (this.net) this.net.send({ t: 'vd', id: V.id, on: 1 });
    this.toast('Joystick: ↑ maju, ↓ mundur, ← → belok');
  },

  stopDrive() {
    const V = this.driving;
    if (!V) return;
    V.driver = null;
    this.driving = null;
    if (this.net) this.net.send({ t: 'vd', id: V.id, on: 0 });
  },

  /* pesan jaringan kapal */
  onVesselNet(m) {
    const V = this.vesselById(m.id);
    if (!V) return;
    if (m.t === 'vs') {
      if (V.driver === 'me') return;
      V.remote = true;
      V.driver = m.f;
      V.tx = m.x; V.tz = m.z; V.tyaw = m.a;
      V.speed = m.s || 0;
    } else if (m.t === 'vd') {
      if (m.on) { V.driver = m.f; V.remote = true; V.tx = V.x; V.tz = V.z; V.tyaw = V.yaw; }
      else if (V.driver === m.f) { V.driver = null; V.remote = false; }
    }
  },

  removeVessel(V) {
    if (this.driving === V) this.stopDrive();
    if (this.p.on === V) this.p.on = null;
    V.dispose(this.scene);
    this.vessels = this.vessels.filter((v) => v !== V);
  },
};
