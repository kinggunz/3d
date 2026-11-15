import * as THREE from 'three';
import { clamp, smooth, mulberry32, makeNoise } from './util.js';
import { T } from './textures.js';

export const SIZE = 320;
export const SEG = 160;
export const HALF = SIZE / 2;
export const N = SEG + 1;
export const STEP = SIZE / SEG;

/* ---------- Tinggi daratan ---------- */
export function genHeights(seed) {
  const n = makeNoise(seed);
  const n2 = makeNoise(seed + 77);
  const H = new Float32Array(N * N);
  const hf = (x, z) => {
    const d = Math.hypot(x, z) / HALF;
    const b = n(x * 0.011 + 50, z * 0.011 + 50, 5);
    const land = (b - 0.4) * 26;
    const mask = 1 - smooth(0.55, 0.95, d);
    let h = land * mask + -8 * (1 - mask);
    const m = n2(x * 0.02, z * 0.02, 3);
    if (m > 0.62) h += (m - 0.62) * 60 * mask;
    const r = Math.hypot(x, z);
    const w = 1 - smooth(8, 26, r);
    h = h * (1 - w) + 3.2 * w;
    return h;
  };
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      H[j * N + i] = hf(-HALF + i * STEP, -HALF + j * STEP);
    }
  }
  const sample = (x, z) => {
    let fx = (x + HALF) / STEP;
    let fz = (z + HALF) / STEP;
    fx = clamp(fx, 0, SEG - 0.001);
    fz = clamp(fz, 0, SEG - 0.001);
    const ix = fx | 0, iz = fz | 0;
    const tx = fx - ix, tz = fz - iz;
    const a = H[iz * N + ix], b = H[iz * N + ix + 1];
    const c = H[(iz + 1) * N + ix], d = H[(iz + 1) * N + ix + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };
  return { H, sample };
}

/* ---------- Mesh daratan ---------- */
export function makeTerrain(hf, seed) {
  const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const rn = makeNoise(seed + 9);
  const c = new THREE.Color();
  const sand = new THREE.Color(0.76, 0.68, 0.47);
  const grass = new THREE.Color(0.28, 0.5, 0.18);
  const rock = new THREE.Color(0.45, 0.45, 0.47);
  const H = hf.H;
  for (let k = 0; k < pos.count; k++) {
    const i = k % N, j = (k / N) | 0;
    const h = H[k];
    pos.setY(k, h);
    const x = pos.getX(k), z = pos.getZ(k);
    const sx = i < SEG ? H[k + 1] - h : h - H[k - 1];
    const sz = j < SEG ? H[k + N] - h : h - H[k - N];
    const slope = Math.max(Math.abs(sx), Math.abs(sz)) / STEP;
    const v = rn(x * 0.15, z * 0.15, 2) - 0.5;
    if (h < -0.6) c.setRGB(0.32, 0.42, 0.38);
    else if (h < 0.5) c.copy(sand);
    else if (h < 1.4) c.copy(sand).lerp(grass, smooth(0.5, 1.4, h));
    else {
      c.copy(grass);
      c.offsetHSL(0, 0, -clamp((h - 1.4) * 0.012, 0, 0.1));
      if (h > 7.5) c.lerp(rock, smooth(7.5, 9.5, h));
    }
    if (slope > 0.85) c.lerp(rock, Math.min(1, (slope - 0.85) * 2));
    c.offsetHSL(0, 0, v * 0.12);
    col[k * 3] = c.r;
    col[k * 3 + 1] = c.g;
    col[k * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}

/* ---------- Laut ---------- */
export function makeWater() {
  const g = new THREE.PlaneGeometry(2600, 2600);
  g.rotateX(-Math.PI / 2);
  T.water.repeat.set(260, 260);
  const m = new THREE.MeshStandardMaterial({
    map: T.water,
    color: 0x4aa3dc,
    transparent: true,
    opacity: 0.78,
    roughness: 0.15,
    metalness: 0.1,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 1;
  mesh.update = (dt, t) => {
    T.water.offset.x += dt * 0.004;
    T.water.offset.y += dt * 0.0025;
    mesh.position.y = Math.sin(t * 0.8) * 0.04;
  };
  return mesh;
}

/* ---------- Langit, matahari, bulan, bintang, awan ---------- */
export function makeSky(scene) {
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.2);
  sun.castShadow = false;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -45;
  sc.right = 45;
  sc.top = 45;
  sc.bottom = -45;
  sc.near = 1;
  sc.far = 320;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const moon = new THREE.DirectionalLight(0x6f86c8, 0);
  scene.add(moon);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 0.7);
  scene.add(hemi);

  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(18, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8, fog: false })
  );
  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(13, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false })
  );
  scene.add(sunMesh, moonMesh);

  const sg = new THREE.BufferGeometry();
  const sp = new Float32Array(900 * 3);
  const rr = mulberry32(12345);
  for (let i = 0; i < 900; i++) {
    const u = rr() * 2 - 1, a = rr() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    sp[i * 3] = Math.cos(a) * s * 600;
    sp[i * 3 + 1] = Math.abs(u) * 600;
    sp[i * 3 + 2] = Math.sin(a) * s * 600;
  }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const stars = new THREE.Points(
    sg,
    new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false })
  );
  stars.frustumCulled = false;
  scene.add(stars);

  const clouds = [];
  const cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, fog: false });
  const cg = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const parts = 4 + ((rr() * 3) | 0);
    for (let k = 0; k < parts; k++) {
      const m = new THREE.Mesh(cg, cm);
      m.position.set((k - parts / 2) * 14 + rr() * 6, rr() * 4, rr() * 10);
      m.scale.set(14 + rr() * 10, 6 + rr() * 3, 10 + rr() * 5);
      g.add(m);
    }
    g.position.set((rr() - 0.5) * 700, 90 + rr() * 40, (rr() - 0.5) * 700);
    scene.add(g);
    clouds.push(g);
  }

  const sky = new THREE.Color();
  const dayCol = new THREE.Color(0x8fc9f0);
  const duskCol = new THREE.Color(0xf08a4b);
  const nightCol = new THREE.Color(0x060a1c);
  const sunDir = new THREE.Vector3();
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 60, 240);

  const api = {
    sun,
    day: 1,
    fogNear: 60,
    fogFar: 240,
    setShadows(on) {
      sun.castShadow = on;
    },
    update(t, center, cam, dt) {
      const a = (t - 0.25) * Math.PI * 2;
      sunDir.set(Math.cos(a) * 0.9, Math.sin(a), 0.35).normalize();
      const elev = sunDir.y;
      const day = clamp(elev * 4 + 0.35, 0, 1);
      const night = 1 - day;
      api.day = day;
      sky.copy(nightCol).lerp(dayCol, day);
      const duskK = clamp(1 - Math.abs(elev) * 4, 0, 1);
      sky.lerp(duskCol, duskK * 0.65);
      scene.fog.color.copy(sky);
      scene.fog.near = api.fogNear * (0.5 + 0.5 * day);
      scene.fog.far = api.fogFar * (0.55 + 0.45 * day);
      sun.intensity = 1.25 * clamp(elev * 3, 0, 1);
      sun.color.setHSL(0.11, 0.7, 0.55 + 0.4 * clamp(elev * 2, 0, 1));
      moon.intensity = 0.38 * night;
      hemi.intensity = 0.14 + 0.72 * day;
      sun.position.copy(center).addScaledVector(sunDir, 120);
      sun.target.position.copy(center);
      moon.position.copy(center).addScaledVector(sunDir, -120);
      moon.target = sun.target;
      sunMesh.position.copy(cam).addScaledVector(sunDir, 480);
      moonMesh.position.copy(cam).addScaledVector(sunDir, -480);
      stars.position.copy(cam);
      stars.material.opacity = clamp(night * 1.3 - 0.2, 0, 1);
      const cc = 0.25 + 0.75 * day;
      cm.color.setRGB(cc, cc, cc * 1.02);
      for (const c of clouds) {
        c.position.x += dt * 2.2;
        if (c.position.x > 450) c.position.x = -450;
      }
    },
  };
  return api;
}

/* ---------- Pohon, batu, semak, rumput ---------- */
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function makeNature(hf, seed, scene) {
  const rnd = mulberry32(seed ^ 0x51ed270b);
  const nz = makeNoise(seed + 5);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  const MAXT = 1500, MAXR = 320, MAXB = 260;
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.2, 0.32, 1, 6).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }),
    MAXT
  );
  const crown = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    MAXT * 2
  );
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
    MAXR
  );
  const bushes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
    MAXB
  );
  const berries = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.12, 0),
    new THREE.MeshStandardMaterial({ color: 0xd8243a, roughness: 0.5 }),
    MAXB * 3
  );
  const meshes = [trunk, crown, rocks, bushes, berries];

  const setPart = (mesh, i, px, py, pz, sx, sy, sz, ry, color) => {
    dummy.position.set(px, py, pz);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, ry, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (color) mesh.setColorAt(i, color);
    return { mesh, i, m: dummy.matrix.clone() };
  };

  const nodes = [];
  let nt = 0, nr = 0, nb = 0, nbr = 0, tries = 0;
  const S = SIZE - 20;

  while (nt < MAXT && tries < 14000) {
    tries++;
    const x = (rnd() - 0.5) * S, z = (rnd() - 0.5) * S;
    const h = hf.sample(x, z);
    if (h < 1.5 || h > 9.5) continue;
    if (x * x + z * z < 64) continue;
    const f = nz(x * 0.035, z * 0.035, 3);
    if (f < 0.46 && rnd() > 0.07) continue;
    if (f < 0.5 && rnd() > 0.5) continue;
    const s = 0.8 + rnd() * 0.9;
    const th = 2.4 * s;
    const parts = [];
    parts.push(setPart(trunk, nt, x, h - 0.1, z, s, th, s, 0));
    col.setHSL(0.27 + rnd() * 0.07, 0.5 + rnd() * 0.2, 0.2 + rnd() * 0.1);
    parts.push(setPart(crown, nt * 2, x, h + 1.4 * s, z, 1.7 * s, 3.4 * s, 1.7 * s, rnd() * 6, col));
    parts.push(setPart(crown, nt * 2 + 1, x, h + 3.2 * s, z, 1.2 * s, 2.6 * s, 1.2 * s, rnd() * 6, col));
    nodes.push({ type: 'tree', x, y: h, z, r: 0.85, cr: 0.5 * s, cy: h + 1.6 * s, hp: 6, max: 6, alive: true, parts, idx: nodes.length });
    nt++;
  }

  tries = 0;
  while (nr < MAXR && tries < 8000) {
    tries++;
    const x = (rnd() - 0.5) * S, z = (rnd() - 0.5) * S;
    const h = hf.sample(x, z);
    if (h < 0.6 || h > 12) continue;
    if (x * x + z * z < 36) continue;
    if (rnd() > 0.5) continue;
    const s = 0.6 + rnd() * 1.1;
    col.setHSL(0.6, 0.05, 0.33 + rnd() * 0.2);
    const parts = [setPart(rocks, nr, x, h + 0.25 * s, z, s * 1.1, s * 0.8, s, rnd() * 6.28, col)];
    nodes.push({ type: 'rock', x, y: h, z, r: 0.9 * s + 0.3, cr: 0.8 * s, cy: h + 0.4, hp: 6, max: 6, alive: true, parts, idx: nodes.length });
    nr++;
  }

  tries = 0;
  while (nb < MAXB && tries < 8000) {
    tries++;
    const x = (rnd() - 0.5) * S, z = (rnd() - 0.5) * S;
    const h = hf.sample(x, z);
    if (h < 1.2 || h > 6.5) continue;
    if (x * x + z * z < 25) continue;
    if (rnd() > 0.35) continue;
    const s = 0.7 + rnd() * 0.5;
    col.setHSL(0.3 + rnd() * 0.05, 0.55, 0.17 + rnd() * 0.06);
    const parts = [setPart(bushes, nb, x, h + 0.35 * s, z, s, s * 0.7, s, rnd() * 6, col)];
    for (let k = 0; k < 3; k++) {
      const a = rnd() * 6.28;
      parts.push(setPart(berries, nbr, x + Math.cos(a) * 0.6 * s, h + 0.62 * s, z + Math.sin(a) * 0.6 * s, 1, 1, 1, 0));
      nbr++;
    }
    nodes.push({ type: 'bush', x, y: h, z, r: 0.7, cr: 0, cy: h + 0.4, hp: 1, max: 1, alive: true, parts, regrow: 0, idx: nodes.length });
    nb++;
  }

  trunk.count = nt;
  crown.count = nt * 2;
  rocks.count = nr;
  bushes.count = nb;
  berries.count = nbr;
  for (const m of meshes) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.frustumCulled = false;
    m.castShadow = true;
    scene.add(m);
  }

  /* grid spasial */
  const CELL = 12;
  const grid = new Map();
  for (const n of nodes) {
    const key = Math.floor(n.x / CELL) + ',' + Math.floor(n.z / CELL);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(n);
  }
  const near = (x, z, rad) => {
    const out = [];
    const x0 = Math.floor((x - rad) / CELL), x1 = Math.floor((x + rad) / CELL);
    const z0 = Math.floor((z - rad) / CELL), z1 = Math.floor((z + rad) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const a = grid.get(cx + ',' + cz);
        if (a) for (const n of a) out.push(n);
      }
    }
    return out;
  };

  const setVisible = (n, on) => {
    for (const p of n.parts) {
      p.mesh.setMatrixAt(p.i, on ? p.m : ZERO);
      p.mesh.instanceMatrix.needsUpdate = true;
    }
  };

  let grassMesh = null;
  const api = {
    nodes,
    near,
    kill(n) {
      n.alive = false;
      setVisible(n, false);
      if (n.type === 'bush') n.regrow = 100;
    },
    tick(dt) {
      for (const n of nodes) {
        if (n.type === 'bush' && !n.alive && n.regrow > 0) {
          n.regrow -= dt;
          if (n.regrow <= 0) {
            n.alive = true;
            n.hp = n.max;
            setVisible(n, true);
          }
        }
      }
    },
    deadList() {
      const out = [];
      for (const n of nodes) if (!n.alive && n.type !== 'bush') out.push(n.idx);
      return out;
    },
    killIdx(list) {
      for (const i of list) {
        const n = nodes[i];
        if (n && n.alive) api.kill(n);
      }
    },
    setGrass(on) {
      if (on && !grassMesh) {
        const MAXG = 14000;
        const gm = new THREE.InstancedMesh(
          new THREE.ConeGeometry(0.1, 0.7, 4).translate(0, 0.35, 0),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
          MAXG
        );
        let n = 0, t = 0;
        const gc = new THREE.Color();
        while (n < MAXG && t < 60000) {
          t++;
          const x = (rnd() - 0.5) * (SIZE - 30), z = (rnd() - 0.5) * (SIZE - 30);
          const h = hf.sample(x, z);
          if (h < 1.5 || h > 7.2) continue;
          const k = 0.8 + rnd() * 0.7;
          dummy.position.set(x, h - 0.02, z);
          dummy.scale.set(k, k * (0.8 + rnd() * 0.8), k);
          dummy.rotation.set(0, rnd() * 6, 0);
          dummy.updateMatrix();
          gm.setMatrixAt(n, dummy.matrix);
          gc.setHSL(0.24 + rnd() * 0.08, 0.55, 0.26 + rnd() * 0.12);
          gm.setColorAt(n, gc);
          n++;
        }
        gm.count = n;
        gm.instanceMatrix.needsUpdate = true;
        if (gm.instanceColor) gm.instanceColor.needsUpdate = true;
        gm.frustumCulled = false;
        grassMesh = gm;
        scene.add(gm);
      }
      if (grassMesh) grassMesh.visible = on;
    },
  };
  return api;
}
