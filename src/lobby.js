import * as THREE from 'three';
import { buildChar, SKINS, idlePose, resetPose, lookFromSkin, normLook, unpackLook, applyEmote } from './chars.js';
import { mulberry32 } from './util.js';

export class Lobby {
  constructor() {
    this.scene = new THREE.Scene();
    /* langit siang hari yang natural */
    {
      const cv = document.createElement('canvas');
      cv.width = 8; cv.height = 256;
      const g2 = cv.getContext('2d');
      const gr = g2.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#4f9fe0'); gr.addColorStop(0.55, '#8fc6ee'); gr.addColorStop(0.85, '#cfe6f2'); gr.addColorStop(1, '#e6efe0');
      g2.fillStyle = gr; g2.fillRect(0, 0, 8, 256);
      this.scene.background = new THREE.CanvasTexture(cv);
    }
    this.scene.fog = new THREE.Fog(0xb9d9ee, 22, 85);
    this.cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 160);
    this.cam.position.set(0, 1.35, 5.4);
    this.cam.lookAt(0, 1.05, 0);

    /* cahaya matahari alami: hemisfer langit-tanah + sinar matahari hangat */
    this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6f8a4a, 1.05));
    const sun = new THREE.DirectionalLight(0xfff4de, 1.7);
    sun.position.set(4, 7, 5);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35);
    fill.position.set(-5, 3, -2);
    this.scene.add(fill);

    const plat = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.3, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x6fa24a, roughness: 1 })
    );
    plat.position.y = -0.15;
    this.scene.add(plat);
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.14, 4.8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 })
    );
    edge.position.y = -0.37;
    this.scene.add(edge);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(80, 40),
      new THREE.MeshStandardMaterial({ color: 0x5f9440, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.31;
    this.scene.add(ground);

    /* pohon kotak (balok) di latar */
    const rr = mulberry32(777);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 1 });
    const leafMs = [0x3f8a34, 0x4a9a3c, 0x377a2e].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    for (let i = 0; i < 40; i++) {
      const a = rr() * Math.PI * 2;
      const rad = 8 + rr() * 24;
      const x = Math.cos(a) * rad, z = -Math.abs(Math.sin(a)) * rad - 2;
      const s = 0.9 + rr() * 0.9;
      const tr = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 2.6 * s, 0.55 * s), trunkM);
      tr.position.set(x, 1.3 * s - 0.3, z);
      const lm = leafMs[(rr() * 3) | 0];
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(2.8 * s, 1.5 * s, 2.8 * s), lm);
      c1.position.set(x, 3.1 * s - 0.3, z);
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(1.8 * s, 1.2 * s, 1.8 * s), lm);
      c2.position.set(x, 4.3 * s - 0.3, z);
      this.scene.add(tr, c1, c2);
    }

    /* awan kotak */
    this.clouds = [];
    const cmat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, fog: false });
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const n = 3 + ((rr() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(5 + rr() * 4, 1.6 + rr(), 3 + rr() * 2), cmat);
        m.position.set(k * 4 - n * 2 + rr() * 2, rr() * 1.2, rr() * 2);
        g.add(m);
      }
      g.position.set((rr() - 0.5) * 120, 22 + rr() * 8, -40 - rr() * 40);
      this.scene.add(g);
      this.clouds.push(g);
    }
    const sunMesh = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 1), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
    sunMesh.position.set(26, 30, -75);
    this.scene.add(sunMesh);

    /* tenda sederhana (balok) */
    const tent = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.5, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xc9a56a, roughness: 1 })
    );
    tent.position.set(3.6, 0.75, -1.4);
    tent.rotation.y = 0.5;
    this.scene.add(tent);
    const tentTop = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xb08850, roughness: 1 })
    );
    tentTop.position.set(3.6, 1.8, -1.4);
    tentTop.rotation.y = 0.5;
    this.scene.add(tentTop);

    this.char = null;
    this.crowd = [];
    this.mode = 'idle'; /* idle | edit | crowd */
    this.editYaw = 0;
    this.drag = false;
    this.t = 0;
    /* interaksi lobi: geser memutar karakter, ketuk = pilih emote */
    this.yaw = 0.35;
    this.enabled = false;
    this.emote = null;
    this.onTapChar = null;
    this._ptr = null;
    this.setLook(lookFromSkin(SKINS[0]));
  }

  /* pasang kendali sentuh pada kanvas WebGL (dipanggil sekali) */
  bindInput(el) {
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.mode !== 'idle') return;
      this._ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
      this.drag = true;
      try { el.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
    });
    el.addEventListener('pointermove', (e) => {
      const p = this._ptr;
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x;
      p.x = e.clientX; p.y = e.clientY;
      p.moved += Math.abs(dx) + Math.abs(e.movementY || 0);
      this.yaw += dx * 0.012;
    });
    const end = (e) => {
      const p = this._ptr;
      if (!p || p.id !== e.pointerId) return;
      this._ptr = null;
      this.drag = false;
      const dist = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
      if (dist < 10 && performance.now() - p.t < 450 && this.hitChar(e.clientX, e.clientY) && this.onTapChar) this.onTapChar();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /* apakah titik layar mengenai karakter di tengah */
  hitChar(cx, cy) {
    if (!this.char) return false;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1), this.cam);
    const box = new THREE.Box3().setFromObject(this.char);
    box.expandByScalar(0.25);
    return rc.ray.intersectsBox(box);
  }

  playEmote(id) { this.emote = { id, t: 0 }; }
  stopEmote() { this.emote = null; if (this.char) resetPose(this.char); }

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
    for (const cl of this.clouds) { cl.position.x += dt * 0.8; if (cl.position.x > 70) cl.position.x = -70; }
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
      c.rotation.y = this.yaw;
      c.position.y = Math.sin(this.t * 2) * 0.01;
      if (this.emote) {
        this.emote.t += dt;
        if (!applyEmote(c, this.emote.id, this.emote.t)) { this.emote = null; resetPose(c); }
      } else idlePose(c, this.t, 0);
    }
  }

  render(r) {
    r.render(this.scene, this.cam);
  }
}
