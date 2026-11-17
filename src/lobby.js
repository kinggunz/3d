import * as THREE from 'three';
import { buildChar, SKINS, idlePose, resetPose, lookFromSkin, normLook, unpackLook } from './chars.js';
import { mulberry32 } from './util.js';

export class Lobby {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2447);
    this.scene.fog = new THREE.Fog(0x2a2f55, 10, 45);
    this.cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 120);
    this.cam.position.set(0, 1.35, 5.4);
    this.cam.lookAt(0, 1.05, 0);

    this.scene.add(new THREE.HemisphereLight(0x9bb0ff, 0x3a4a2a, 0.9));
    const key = new THREE.DirectionalLight(0xffd9a8, 1.1);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7a9bff, 0.6);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);

    const plat = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.4, 0.3, 32),
      new THREE.MeshStandardMaterial({ color: 0x4d6b35, roughness: 1 })
    );
    plat.position.y = -0.15;
    this.scene.add(plat);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.07, 8, 48),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6, metalness: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(60, 40),
      new THREE.MeshStandardMaterial({ color: 0x1d3a2a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.31;
    this.scene.add(ground);

    /* pepohonan latar */
    const rr = mulberry32(777);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 1 });
    for (let i = 0; i < 46; i++) {
      const a = rr() * Math.PI * 2;
      const rad = 8 + rr() * 22;
      const x = Math.cos(a) * rad, z = -Math.abs(Math.sin(a)) * rad - 2;
      const s = 1 + rr() * 1.4;
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 2.4 * s, 6), trunkM);
      tr.position.set(x, 1.1 * s - 0.3, z);
      const cr = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 * s, 4 * s, 7),
        new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.3 + rr() * 0.05, 0.45, 0.15 + rr() * 0.07), roughness: 1 })
      );
      cr.position.set(x, 3.2 * s, z);
      this.scene.add(tr, cr);
    }

    /* api unggun */
    const fire = new THREE.Group();
    const logM = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 1 });
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6), logM);
      l.rotation.z = Math.PI / 2;
      l.rotation.y = (i * Math.PI) / 3;
      l.position.y = 0.1;
      fire.add(l);
    }
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
    this.flame.position.y = 0.55;
    fire.add(this.flame);
    fire.position.set(-3.1, 0, 0.6);
    this.scene.add(fire);
    this.fireLight = new THREE.PointLight(0xff9a3c, 2.6, 14, 2);
    this.fireLight.position.set(-3.1, 1.1, 0.8);
    this.scene.add(this.fireLight);

    /* tenda */
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: 0xb4622d, roughness: 1, flatShading: true })
    );
    tent.position.set(3.4, 0.9, -1);
    tent.rotation.y = Math.PI / 4;
    this.scene.add(tent);

    /* bintang & kunang-kunang */
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const a = rr() * Math.PI * 2, u = rr();
      sp[i * 3] = Math.cos(a) * 90 * (1 - u * 0.2);
      sp[i * 3 + 1] = 12 + u * 60;
      sp[i * 3 + 2] = -Math.abs(Math.sin(a)) * 90 - 8;
    }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false }));
    moon.position.set(22, 26, -70);
    this.scene.add(moon);

    this.flies = [];
    const fg = new THREE.BufferGeometry();
    this.fp = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      this.fp[i * 3] = (rr() - 0.5) * 14;
      this.fp[i * 3 + 1] = rr() * 3;
      this.fp[i * 3 + 2] = (rr() - 0.5) * 8 - 1;
      this.flies.push(rr() * 10);
    }
    fg.setAttribute('position', new THREE.BufferAttribute(this.fp, 3));
    this.flyPts = new THREE.Points(fg, new THREE.PointsMaterial({ color: 0xd8ff7a, size: 5, sizeAttenuation: false }));
    this.scene.add(this.flyPts);

    this.char = null;
    this.crowd = [];
    this.mode = 'idle'; /* idle | edit | crowd */
    this.editYaw = 0;
    this.drag = false;
    this.t = 0;
    this.setLook(lookFromSkin(SKINS[0]));
  }

  setLook(d) {
    if (this.char) this.scene.remove(this.char);
    this.char = buildChar(d);
    this.char.scale.setScalar(this.mode === 'edit' ? 1.3 : 1.1);
    this.char.visible = this.mode !== 'crowd';
    this.char.position.set(this.mode === 'edit' ? -2.0 : 0, 0, 0);
    this.scene.add(this.char);
  }
  setSkin(d) { this.setLook(lookFromSkin(d)); }

  /* mode: 'idle' (lobi), 'edit' (editor karakter di sisi kiri), 'crowd' (semua pemain room di tengah) */
  setMode(m) {
    this.mode = m;
    if (this.char) {
      this.char.visible = m !== 'crowd';
      this.char.scale.setScalar(m === 'edit' ? 1.3 : 1.1);
      this.char.position.set(m === 'edit' ? -2.0 : 0, 0, 0);
    }
    if (m !== 'crowd') this.clearCrowd();
    this.cam.position.set(0, m === 'crowd' ? 1.6 : 1.35, m === 'crowd' ? 7.2 : 5.4);
    this.cam.lookAt(0, m === 'crowd' ? 1.1 : 1.05, 0);
  }

  clearCrowd() {
    for (const c of this.crowd) this.scene.remove(c.g);
    this.crowd = [];
  }

  nameSprite(text) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.font = 'bold 34px sans-serif';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,.55)';
    c.fillRect(0, 8, 256, 48);
    c.fillStyle = '#fff';
    c.fillText(String(text).slice(0, 14), 128, 44);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.scale.set(1.7, 0.42, 1);
    sp.position.y = 2.55;
    sp.renderOrder = 5;
    return sp;
  }

  /* pemain di room: berdiri berjajar di tengah dengan pose bebas */
  setCrowd(players, myId, myLook) {
    this.setMode('crowd');
    const key = (players || []).map((p) => p.id + ':' + (p.cd || p.skin) + ':' + p.name).join('|') + '#' + (myLook || '').length;
    if (this._crowdKey === key) return;
    this._crowdKey = key;
    this.clearCrowd();
    const list = players || [];
    const n = list.length;
    list.forEach((p, i) => {
      const look = (p.id === myId && myLook) ? myLook : (p.cd && unpackLook(p.cd)) || lookFromSkin(SKINS[p.skin] || SKINS[0]);
      const g = buildChar(look);
      g.scale.setScalar(1.05);
      const off = i - (n - 1) / 2;
      g.position.set(off * 1.7, 0, Math.abs(off) * -0.35);
      g.rotation.y = -off * 0.16;
      g.add(this.nameSprite(p.name || 'Pemain'));
      this.scene.add(g);
      this.crowd.push({ g, style: (i * 2 + 1 + (p.name || '').length) % 5, base: -off * 0.16 });
    });
  }

  leaveCrowd() {
    this._crowdKey = null;
    this.setMode('idle');
  }

  resize() {
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const c = this.char;
    if (this.mode === 'edit') {
      if (!this.drag) this.editYaw += dt * 0.35;
      c.rotation.y = this.editYaw;
      c.position.y = 0;
      idlePose(c, this.t, 0);
    } else if (this.mode === 'crowd') {
      for (const k of this.crowd) {
        k.g.rotation.y = k.base + Math.sin(this.t * 0.5 + k.style) * 0.18;
        idlePose(k.g, this.t + k.style, k.style);
      }
    } else {
      c.rotation.y = Math.sin(this.t * 0.6) * 0.45;
      c.position.y = Math.sin(this.t * 2) * 0.015;
      idlePose(c, this.t, 0);
    }
    const f = 0.85 + Math.random() * 0.3;
    this.flame.scale.set(f, f * (0.9 + Math.random() * 0.3), f);
    this.fireLight.intensity = 2.2 + Math.random() * 0.8;
    for (let i = 0; i < 60; i++) {
      this.fp[i * 3 + 1] += Math.sin(this.t * 0.8 + this.flies[i]) * dt * 0.3;
      this.fp[i * 3] += Math.cos(this.t * 0.5 + this.flies[i]) * dt * 0.3;
    }
    this.flyPts.geometry.attributes.position.needsUpdate = true;
  }

  render(r) {
    r.render(this.scene, this.cam);
  }
}
