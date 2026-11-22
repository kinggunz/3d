/* Halaman MODIF motor: motor di sisi kiri (3D, bisa diputar), panel pilihan di kanan. */
import * as THREE from 'three';
import { buildBike, normBike, BIKE_DEFAULT, KITS, EXHAUSTS, WHEELS, TIRES, PATTERNS, SUSP, ENGINES, SOUNDS, PAINTS } from './bike.js';
import { MotoSound } from './motosound.js';

const KEY = 'ps_bike_v1';
export function loadBikeCfg() {
  try { const s = localStorage.getItem(KEY); return normBike(s ? JSON.parse(s) : null); } catch (e) { return normBike(null); }
}
export function saveBikeCfg(c) {
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* abaikan (mis. penyimpanan penuh) */ }
}

const METALS = ['#e6e8ec', '#8f9aa6', '#111111', '#d4af37', '#b87333', '#4a4d52'];
const LAMPS = ['#fff7e0', '#ffffff', '#ffd75a', '#8fd0ff', '#ff6a5a'];
const TABS = ['Warna', 'Bodi', 'Knalpot', 'Velg & Ban', 'Lampu', 'Stiker', 'Suara', 'Mesin'];

export class Modif {
  constructor(game) {
    this.g = game;
    this.cfg = normBike(game.bikeCfg);
    this.tab = 0;
    this.yaw = 0.7;
    this.dist = 3.3;
    this.drag = false;
  }

  open() {
    const g = this.g;
    g.modifOpen = true; document.body.classList.add("modifOn");
    /* ---- adegan pratinjau ---- */
    const sc = this.scene = new THREE.Scene();
    sc.background = (() => {
      const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
      const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#59616b'); gr.addColorStop(1, '#2b2f35');
      c.fillStyle = gr; c.fillRect(0, 0, 4, 256);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    if (g.envTex) sc.environment = g.envTex;
    sc.add(new THREE.HemisphereLight(0xdfe6ee, 0x30343a, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 4); sc.add(key);
    const rim = new THREE.DirectionalLight(0x9db6d0, 0.8); rim.position.set(-4, 3, -3); sc.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.5, 48), new THREE.MeshStandardMaterial({ color: 0x3d4046, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; sc.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 1.76, 64), new THREE.MeshBasicMaterial({ color: 0xd9a81c, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.003; sc.add(ring);
    this.cam = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 60);
    this.rebuild();

    /* ---- antarmuka ---- */
    const el = this.el = document.createElement('div');
    el.id = 'sModif';
    el.innerHTML = `
      <div class="mdStage" id="mdStage"><span class="mdHint">Geser untuk memutar motor</span></div>
      <div class="mdPanel">
        <div class="mdHead"><b>MODIF MOTOR</b><span id="mdName">Vario</span></div>
        <div class="mdTabs" id="mdTabs"></div>
        <div class="mdBody" id="mdBody"></div>
        <div class="mdFoot"><button id="mdCancel" class="mdBtn dim">Batal</button><button id="mdReset" class="mdBtn dim">Reset</button><button id="mdOk" class="mdBtn ok">Konfirmasi &amp; Ke Garasi</button></div>
      </div>`;
    document.getElementById('app').appendChild(el);
    const stage = el.querySelector('#mdStage');
    let last = 0, pid = null;
    stage.addEventListener('pointerdown', (e) => { pid = e.pointerId; last = e.clientX; this.drag = true; try { stage.setPointerCapture(pid); } catch (er) { /* abaikan */ } });
    stage.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; this.yaw -= (e.clientX - last) * 0.01; last = e.clientX; });
    const end = (e) => { if (e.pointerId === pid) { pid = null; this.drag = false; } };
    stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
    stage.addEventListener('wheel', (e) => { this.dist = Math.max(2.2, Math.min(5.5, this.dist + e.deltaY * 0.003)); e.preventDefault(); }, { passive: false });
    el.querySelector('#mdOk').onclick = () => this.confirm();
    el.querySelector('#mdCancel').onclick = () => this.close();
    el.querySelector('#mdReset').onclick = () => { this.cfg = normBike(BIKE_DEFAULT); this.rebuild(); this.draw(); };
    const tabs = el.querySelector('#mdTabs');
    TABS.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'mdTab'; b.textContent = t; b.dataset.i = i;
      b.onclick = () => { this.tab = i; this.draw(); };
      tabs.appendChild(b);
    });
    this.draw();
    window.addEventListener('resize', this._rs = () => this.layout());
  }

  rebuild() {
    if (this.bike) { this.scene.remove(this.bike.root); this.g.disposeBike(this.bike); }
    this.bike = buildBike(this.cfg);
    this.scene.add(this.bike.root);
  }

  layout() {
    const w = innerWidth, h = innerHeight;
    this.cam.aspect = w / h;
    this.cam.setViewOffset(w, h, w * (w < 760 ? 0.2 : 0.16), 0, w, h);
    this.cam.updateProjectionMatrix();
  }

  render(r) {
    if (!this.scene) return;
    if (!this.drag) this.yaw += 0.004;
    this.layout();
    const d = this.dist, a = this.yaw;
    this.cam.position.set(Math.sin(a) * d, 0.95 + d * 0.12, Math.cos(a) * d);
    this.cam.lookAt(0, 0.5, 0);
    r.render(this.scene, this.cam);
  }

  /* ---------- UI helpers ---------- */
  row(title) {
    const d = document.createElement('div');
    d.className = 'mdRow';
    if (title) { const t = document.createElement('div'); t.className = 'mdLabel'; t.textContent = title; d.appendChild(t); }
    return d;
  }

  colors(body, title, key, presets) {
    const r = this.row(title), sw = document.createElement('div');
    sw.className = 'mdSw';
    const apply = (v) => { this.cfg[key] = v; this.bike.recolor(this.cfg); mark(); };
    const marks = [];
    const mark = () => marks.forEach(([b, c]) => b.classList.toggle('on', c.toLowerCase() === String(this.cfg[key]).toLowerCase()));
    presets.forEach((c) => {
      const b = document.createElement('button');
      b.className = 'mdDot'; b.style.background = c; b.onclick = () => { apply(c); inp.value = c; };
      sw.appendChild(b); marks.push([b, c]);
    });
    const inp = document.createElement('input');
    inp.type = 'color'; inp.value = this.cfg[key]; inp.className = 'mdColor';
    inp.oninput = () => apply(inp.value);
    sw.appendChild(inp);
    r.appendChild(sw); body.appendChild(r); mark();
  }

  options(body, title, key, list, structural = true) {
    const r = this.row(title), w = document.createElement('div');
    w.className = 'mdOpts';
    list.forEach((n, i) => {
      const b = document.createElement('button');
      b.className = 'mdOpt' + (this.cfg[key] === i ? ' on' : ''); b.textContent = typeof n === 'string' ? n : n.n;
      b.onclick = () => {
        this.cfg[key] = i;
        if (structural) this.rebuild(); else this.bike.recolor(this.cfg);
        w.querySelectorAll('.mdOpt').forEach((x, j) => x.classList.toggle('on', j === i));
      };
      w.appendChild(b);
    });
    r.appendChild(w); body.appendChild(r);
  }

  slider(body, title, key) {
    const r = this.row(title), s = document.createElement('input');
    s.type = 'range'; s.min = 0; s.max = 1; s.step = 0.02; s.value = this.cfg[key]; s.className = 'mdRange';
    s.oninput = () => { this.cfg[key] = +s.value; };
    r.appendChild(s); body.appendChild(r);
  }

  draw() {
    const body = this.el.querySelector('#mdBody');
    body.innerHTML = '';
    this.el.querySelectorAll('.mdTab').forEach((b) => b.classList.toggle('on', +b.dataset.i === this.tab));
    const T = this.tab;
    if (T === 0) {
      this.colors(body, 'Warna bodi', 'body', PAINTS);
      this.colors(body, 'Panel samping', 'side', PAINTS);
      this.colors(body, 'Jok', 'seat', ['#17181a', '#3b2a1c', '#5a1d1d', '#e8e6df', '#1f3a66', '#c9a24a']);
      this.colors(body, 'Helm', 'helmet', PAINTS);
    } else if (T === 1) {
      this.options(body, 'Paket bodi', 'kit', KITS);
      this.options(body, 'Pola cat', 'pattern', PATTERNS, false);
      this.options(body, 'Suspensi', 'susp', SUSP);
    } else if (T === 2) {
      this.options(body, 'Jenis knalpot', 'exhaust', EXHAUSTS);
      this.colors(body, 'Warna knalpot', 'exh', METALS);
      const r = this.row('Dengar suara knalpot'), b = document.createElement('button');
      b.className = 'mdBtn'; b.textContent = 'Tes Suara';
      b.onclick = () => MotoSound.test(this.cfg);
      r.appendChild(b); body.appendChild(r);
    } else if (T === 3) {
      this.options(body, 'Model velg', 'wheel', WHEELS);
      this.colors(body, 'Warna velg', 'rim', ['#c9ccd1', '#111214', '#d4af37', '#c4161c', '#1f4fa8', '#e8e6df']);
      this.options(body, 'Ukuran ban', 'tire', TIRES);
    } else if (T === 4) {
      this.colors(body, 'Warna lampu depan', 'lamp', LAMPS);
    } else if (T === 5) {
      this.options(body, 'Pola cat', 'pattern', PATTERNS, false);
      const r = this.row('Pakai gambarmu di bodi motor'), f = document.createElement('input');
      f.type = 'file'; f.accept = 'image/*'; f.className = 'mdFile';
      f.onchange = () => {
        const file = f.files && f.files[0];
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => {
          const img = new Image();
          img.onload = () => {
            const cv = document.createElement('canvas'); cv.width = cv.height = 256;
            const c = cv.getContext('2d'), k = Math.max(256 / img.width, 256 / img.height);
            c.drawImage(img, (256 - img.width * k) / 2, (256 - img.height * k) / 2, img.width * k, img.height * k);
            this.cfg.livery = cv.toDataURL('image/jpeg', 0.85);
            this.bike.recolor(this.cfg);
            this.draw();
          };
          img.src = fr.result;
        };
        fr.readAsDataURL(file);
      };
      r.appendChild(f);
      const hint = document.createElement('div'); hint.className = 'mdHint2';
      hint.textContent = this.cfg.livery ? 'Gambar terpasang di bodi & panel samping.' : 'Pilih foto/gambar dari perangkatmu. Gambar menutupi cat bodi.';
      r.appendChild(hint);
      if (this.cfg.livery) {
        const del = document.createElement('button'); del.className = 'mdBtn dim'; del.textContent = 'Hapus gambar';
        del.onclick = () => { this.cfg.livery = null; this.bike.recolor(this.cfg); this.draw(); };
        r.appendChild(del);
      }
      body.appendChild(r);
    } else if (T === 6) {
      this.options(body, 'Suara mesin', 'snd', SOUNDS, false);
      this.slider(body, 'Bass (berat)', 'bass');
      this.slider(body, 'Treble (nyaring)', 'treble');
      this.slider(body, 'Serak / garang', 'rasp');
      const r = this.row('Dengar hasilnya'), b = document.createElement('button');
      b.className = 'mdBtn'; b.textContent = 'Tes Suara';
      b.onclick = () => MotoSound.test(this.cfg);
      r.appendChild(b); body.appendChild(r);
    } else {
      const r = this.row('Mesin');
      ENGINES.forEach((e, i) => {
        const b = document.createElement('button');
        b.className = 'mdOpt wide' + (this.cfg.engine === i ? ' on' : '');
        b.innerHTML = `${e.n}<small>Top speed ± ${Math.round(e.vmax * 3.6)} km/jam</small>`;
        b.onclick = () => { this.cfg.engine = i; this.draw(); };
        r.appendChild(b);
      });
      body.appendChild(r);
    }
  }

  confirm() {
    saveBikeCfg(this.cfg);
    this.g.applyBike(this.cfg);
    this.g.toast('Modifikasi disimpan — siap Mabar!');
    this.close();
  }

  close() {
    if (this._rs) window.removeEventListener('resize', this._rs);
    if (this.el) this.el.remove();
    if (this.bike) this.g.disposeBike(this.bike);
    this.scene = null; this.el = null; this.bike = null;
    this.g.modifOpen = false; document.body.classList.remove("modifOn");
    this.g.modif = null;
  }
}
