import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { SIZE, HALF } from './world.js';

const MC = new Map();
const M = (c) => {
  if (!MC.has(c)) MC.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  return MC.get(c);
};
const bx = (w, h, d, c, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
};

function mkRabbit() {
  const g = new THREE.Group();
  g.add(bx(0.3, 0.28, 0.5, '#d9d2c3', 0, 0.22, 0));
  g.add(bx(0.2, 0.2, 0.22, '#e6e0d2', 0, 0.34, 0.3));
  g.add(bx(0.05, 0.22, 0.05, '#e6e0d2', -0.06, 0.55, 0.28));
  g.add(bx(0.05, 0.22, 0.05, '#e6e0d2', 0.06, 0.55, 0.28));
  g.add(bx(0.1, 0.1, 0.1, '#ffffff', 0, 0.26, -0.28));
  g.add(bx(0.04, 0.04, 0.03, '#111', -0.06, 0.37, 0.41));
  g.add(bx(0.04, 0.04, 0.03, '#111', 0.06, 0.37, 0.41));
  return g;
}

function mkDeer() {
  const g = new THREE.Group();
  g.add(bx(0.5, 0.55, 1.1, '#9a6b3f', 0, 1.0, 0));
  for (const sx of [-0.18, 0.18]) {
    for (const sz of [-0.4, 0.4]) g.add(bx(0.12, 0.8, 0.12, '#7d5430', sx, 0.4, sz));
  }
  g.add(bx(0.2, 0.55, 0.2, '#9a6b3f', 0, 1.4, 0.55));
  g.add(bx(0.22, 0.22, 0.42, '#8a5c34', 0, 1.7, 0.78));
  g.add(bx(0.04, 0.4, 0.04, '#e8dcc0', -0.1, 1.95, 0.7));
  g.add(bx(0.04, 0.4, 0.04, '#e8dcc0', 0.1, 1.95, 0.7));
  g.add(bx(0.08, 0.1, 0.08, '#ffffff', 0, 1.0, -0.58));
  return g;
}

function mkWolf() {
  const g = new THREE.Group();
  g.add(bx(0.4, 0.45, 0.9, '#6b6f76', 0, 0.75, 0));
  for (const sx of [-0.14, 0.14]) {
    for (const sz of [-0.32, 0.32]) g.add(bx(0.1, 0.5, 0.1, '#555a60', sx, 0.25, sz));
  }
  g.add(bx(0.28, 0.26, 0.34, '#6b6f76', 0, 0.95, 0.6));
  g.add(bx(0.14, 0.12, 0.2, '#4a4e54', 0, 0.9, 0.84));
  g.add(bx(0.07, 0.12, 0.05, '#555a60', -0.09, 1.14, 0.55));
  g.add(bx(0.07, 0.12, 0.05, '#555a60', 0.09, 1.14, 0.55));
  g.add(bx(0.1, 0.1, 0.5, '#777b82', 0, 0.82, -0.68));
  g.add(bx(0.04, 0.04, 0.03, '#ffcc00', -0.08, 1.0, 0.77));
  g.add(bx(0.04, 0.04, 0.03, '#ffcc00', 0.08, 1.0, 0.77));
  return g;
}

function mkFish() {
  const g = new THREE.Group();
  g.add(bx(0.12, 0.16, 0.46, '#f08a3c', 0, 0, 0));
  g.add(bx(0.02, 0.2, 0.16, '#d86a1c', 0, 0, -0.3));
  g.add(bx(0.02, 0.1, 0.14, '#d86a1c', 0, 0.12, 0));
  return g;
}

function mkBird() {
  const g = new THREE.Group();
  g.add(bx(0.15, 0.12, 0.35, '#2b2b33', 0, 0, 0));
  const wl = bx(0.55, 0.02, 0.2, '#3a3a44', -0.35, 0.02, 0);
  const wr = bx(0.55, 0.02, 0.2, '#3a3a44', 0.35, 0.02, 0);
  g.add(wl, wr);
  g.userData = { wl, wr };
  return g;
}

export const DEF = {
  rabbit: { hp: 2, speed: 2.6, hit: 0.55, cy: 0.3, drop: ['daging', 1] },
  deer: { hp: 6, speed: 3.6, hit: 1.0, cy: 1.0, drop: ['daging', 3] },
  wolf: { hp: 10, speed: 5.2, hit: 0.9, cy: 0.8, drop: ['daging', 2] },
  fish: { hp: 1, speed: 1.6, hit: 0.6, cy: 0, drop: ['ikan', 1] },
};

export class Animals {
  constructor(hf, seed, scene, ultra) {
    this.hf = hf;
    this.scene = scene;
    this.rnd = mulberry32(seed ^ 0xabcdef);
    this.list = [];
    this.birds = [];
    this.time = 0;
    this.cull = 120;
    this.hidden = false;
    this.birdsOn = true;
    const cnt = {
      rabbit: ultra ? 18 : 14,
      deer: ultra ? 12 : 9,
      wolf: ultra ? 6 : 5,
      fish: ultra ? 36 : 26,
    };
    for (const k of Object.keys(cnt)) {
      for (let i = 0; i < cnt[k]; i++) this.add(k);
    }
    for (let i = 0; i < 12; i++) {
      const g = mkBird();
      const b = {
        g,
        cx: (this.rnd() - 0.5) * 200,
        cz: (this.rnd() - 0.5) * 200,
        rad: 20 + this.rnd() * 40,
        ang: this.rnd() * 6.28,
        spd: 0.15 + this.rnd() * 0.12,
        h: 28 + this.rnd() * 18,
      };
      scene.add(g);
      this.birds.push(b);
    }
  }

  setCull(r) { this.cull = r; }

  setBirds(on) {
    this.birdsOn = on;
    for (const b of this.birds) b.g.visible = on;
  }

  /* sembunyikan semua hewan (saat di dalam goa) */
  setHidden(on) {
    this.hidden = on;
    for (const a of this.list) if (!a.dead) a.g.visible = !on;
    for (const b of this.birds) b.g.visible = !on && this.birdsOn;
  }

  pt(minH, maxH) {
    for (let t = 0; t < 300; t++) {
      const x = (this.rnd() - 0.5) * (SIZE - 40), z = (this.rnd() - 0.5) * (SIZE - 40);
      const h = this.hf.sample(x, z);
      if (h > minH && h < maxH && x * x + z * z > 200) return [x, z, h];
    }
    return null;
  }

  add(type) {
    const p = type === 'fish' ? this.pt(-9, -1.6) : this.pt(1.4, 8);
    if (!p) return;
    const g = { rabbit: mkRabbit, deer: mkDeer, wolf: mkWolf, fish: mkFish }[type]();
    const a = {
      type, g, x: p[0], z: p[1], y: p[2], hp: DEF[type].hp, def: DEF[type],
      tx: p[0], tz: p[1], timer: 0, dead: false, cd: 0, t: Math.random() * 10, rt: 0,
    };
    g.position.set(a.x, a.y, a.z);
    this.scene.add(g);
    this.list.push(a);
  }

  center(a) {
    return a.type === 'fish' ? a.y : a.y + a.def.cy;
  }

  hit(a, dmg) {
    a.hp -= dmg;
    if (a.hp <= 0) {
      a.dead = true;
      a.rt = 100;
      this.scene.remove(a.g);
      return a.def.drop;
    }
    a.timer = 0;
    a.panic = 3;
    return null;
  }

  update(dt, px, pz, py, night, hurt) {
    this.time += dt;
    if (this.hidden) return;
    const sample = this.hf.sample;
    for (const a of this.list) {
      if (a.dead) {
        a.rt -= dt;
        if (a.rt <= 0) {
          const p = a.type === 'fish' ? this.pt(-9, -1.6) : this.pt(1.4, 8);
          if (p) {
            a.x = p[0];
            a.z = p[1];
            a.y = p[2];
            a.hp = a.def.hp;
            a.dead = false;
            a.panic = 0;
            this.scene.add(a.g);
          } else a.rt = 10;
        }
        continue;
      }
      a.t += dt;
      const dx = px - a.x, dz = pz - a.z;
      const d = Math.hypot(dx, dz) || 0.001;
      let sp = 0, dirx = 0, dirz = 0;
      /* jauh dari pemain: sembunyikan & lewati AI (hemat draw call) */
      if (d > this.cull) { if (a.g.visible) a.g.visible = false; continue; }
      if (!a.g.visible) a.g.visible = true;

      if (a.type === 'fish') {
        a.timer -= dt;
        if (a.timer <= 0) {
          a.timer = 2 + Math.random() * 3;
          const ang = Math.random() * 6.283, r = 4 + Math.random() * 8;
          const tx = a.x + Math.cos(ang) * r, tz = a.z + Math.sin(ang) * r;
          if (sample(tx, tz) < -1.3) {
            a.tx = tx;
            a.tz = tz;
          }
        }
        const ddx = a.tx - a.x, ddz = a.tz - a.z, dd = Math.hypot(ddx, ddz);
        if (dd > 0.5) {
          dirx = ddx / dd;
          dirz = ddz / dd;
          sp = a.def.speed;
        }
        if (sp > 0) {
          const nx = a.x + dirx * sp * dt, nz = a.z + dirz * sp * dt;
          if (sample(nx, nz) < -1.2) {
            a.x = nx;
            a.z = nz;
          } else a.timer = 0;
        }
        a.y = -0.75 + Math.sin(a.t * 2) * 0.1;
      } else {
        const def = a.def;
        const fleeR = a.type === 'rabbit' ? 9 : a.type === 'deer' ? 13 : 0;
        const chaseR = a.type === 'wolf' ? (night ? 20 : 7) : 0;
        if (a.panic > 0) a.panic -= dt;
        if (chaseR && d < chaseR && Math.abs(py - a.y) < 4) {
          dirx = dx / d;
          dirz = dz / d;
          sp = def.speed * (night ? 1.15 : 1);
          if (d < 1.7) {
            a.cd -= dt;
            if (a.cd <= 0) {
              a.cd = 1.3;
              hurt(7);
            }
          }
          if (d < 1.4) sp = 0;
        } else if ((fleeR && d < fleeR) || a.panic > 0) {
          dirx = -dx / d;
          dirz = -dz / d;
          sp = def.speed * 1.8;
        } else {
          a.timer -= dt;
          if (a.timer <= 0) {
            a.timer = 3 + Math.random() * 5;
            const ang = Math.random() * 6.283, r = 4 + Math.random() * 10;
            a.tx = a.x + Math.cos(ang) * r;
            a.tz = a.z + Math.sin(ang) * r;
            if (Math.random() < 0.4) {
              a.tx = a.x;
              a.tz = a.z;
            }
          }
          const ddx = a.tx - a.x, ddz = a.tz - a.z, dd = Math.hypot(ddx, ddz);
          if (dd > 0.6) {
            dirx = ddx / dd;
            dirz = ddz / dd;
            sp = def.speed * 0.45;
          }
        }
        if (sp > 0) {
          const nx = a.x + dirx * sp * dt, nz = a.z + dirz * sp * dt;
          const h = sample(nx, nz);
          if (h > 0.5 && h < 9 && Math.abs(nx) < HALF - 8 && Math.abs(nz) < HALF - 8) {
            a.x = nx;
            a.z = nz;
          } else {
            a.timer = 0;
            a.panic = 0;
          }
        }
        a.y = sample(a.x, a.z);
      }

      const g = a.g;
      g.position.x = a.x;
      g.position.z = a.z;
      g.position.y = a.y;
      if (a.type === 'rabbit' && sp > 0) g.position.y += Math.abs(Math.sin(a.t * 12)) * 0.18;
      if (a.type !== 'rabbit' && a.type !== 'fish' && sp > 0) g.position.y += Math.abs(Math.sin(a.t * 9)) * 0.04;
      if (sp > 0) {
        const ay = Math.atan2(dirx, dirz);
        let da = ay - g.rotation.y;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        g.rotation.y += da * Math.min(1, dt * 8);
      }
    }

    if (!this.birdsOn) return;
    for (const b of this.birds) {
      b.ang += b.spd * dt;
      const x = b.cx + Math.cos(b.ang) * b.rad;
      const z = b.cz + Math.sin(b.ang) * b.rad;
      b.g.position.set(x, b.h + Math.sin(b.ang * 3) * 2, z);
      b.g.rotation.y = -b.ang;
      const f = Math.sin(this.time * 9 + b.ang * 10) * 0.6;
      b.g.userData.wl.rotation.z = f;
      b.g.userData.wr.rotation.z = -f;
    }
  }
}
