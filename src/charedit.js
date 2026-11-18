/* Editor karakter layar penuh: model 3D di kiri (geser untuk memutar), pilihan di kanan. */
import { LOOK_DEFAULT, OPTS, normLook, SKINS, lookFromSkin } from './chars.js';

const $ = (id) => document.getElementById(id);

const PAL = {
  skin: ['#ffdbac', '#f1c9a5', '#e8b48a', '#c68642', '#a86b3c', '#8d5524', '#5c3a1e', '#3b2412'],
  hair: ['#111111', '#3b2412', '#6b4423', '#8a5a2b', '#e0b050', '#d9d9d9', '#b3262e', '#2a6fb0', '#2e8b57', '#8a3fb0', '#ff7ab0'],
  eye: ['#111111', '#3b2412', '#2a6fb0', '#2e8b57', '#8a3fb0', '#b3262e'],
  cloth: ['#2e8b57', '#c0562b', '#2a6fb0', '#556b2f', '#b3262e', '#e0c27a', '#f4f1e6', '#222a44', '#8a3fb0', '#ff7ab0', '#111111', '#e8d35a'],
  pants: ['#5b3a1e', '#2b3a55', '#d9c9a0', '#3d3d3d', '#222a44', '#7a4f2a', '#556b2f', '#b3262e', '#111111', '#f4f1e6'],
  shoes: ['#2a2018', '#111111', '#f4f1e6', '#b3262e', '#2a6fb0', '#6b4423'],
  acc: ['#c9a227', '#3c4a22', '#8a3b2a', '#222222', '#b3262e', '#2a6fb0', '#f4f1e6', '#8a3fb0', '#ff7ab0', '#2e8b57'],
};

/* tiap tab: daftar kontrol */
const TABS = [
  ['Skin PNG', [['skin', 'sk', 'Skin 3D Minecraft (PNG 64x64)']]],
  ['Badan', [['col', 'skin', 'Warna Kulit', 'skin'], ['range', 'h', 'Tinggi', 0.8, 1.2], ['range', 'w', 'Lebar Badan', 0.8, 1.25], ['range', 'head', 'Ukuran Kepala', 0.85, 1.3]]],
  ['Rambut', [['opt', 'hairStyle', 'Gaya Rambut'], ['col', 'hair', 'Warna Rambut', 'hair']]],
  ['Wajah', [['opt', 'eyeStyle', 'Mata'], ['col', 'eye', 'Warna Mata', 'eye'], ['opt', 'mouth', 'Mulut'], ['opt', 'glasses', 'Kacamata'], ['col', 'glassCol', 'Warna Kacamata', 'acc']]],
  ['Baju', [['opt', 'shirtStyle', 'Model Baju'], ['col', 'shirt', 'Warna Utama', 'cloth'], ['col', 'shirt2', 'Warna Kedua', 'cloth']]],
  ['Celana', [['opt', 'pantsStyle', 'Celana'], ['col', 'pants', 'Warna Celana', 'pants'], ['col', 'shoes', 'Warna Sepatu', 'shoes']]],
  ['Topi', [['opt', 'hatStyle', 'Model Topi'], ['col', 'hat', 'Warna Topi', 'acc']]],
  ['Aksesori', [['colN', 'scarf', 'Syal', 'acc'], ['colN', 'pack', 'Ransel', 'acc'], ['colN', 'cape', 'Jubah', 'acc']]],
];

const rnd = (a) => a[(Math.random() * a.length) | 0];

export function openCharEditor({ lobby, look, onSave, onCancel }) {
  let d = normLook(look);
  let tab = 0;
  const start = normLook(look);

  const apply = () => { d = normLook(d); lobby.setLook(d); };

  function render() {
    const tabs = $('chEdTabs');
    tabs.innerHTML = '';
    TABS.forEach(([n], i) => {
      const b = document.createElement('button');
      b.textContent = n;
      b.className = i === tab ? 'on' : '';
      b.onclick = () => { tab = i; render(); };
      tabs.appendChild(b);
    });
    const body = $('chEdBody');
    const sc = body.scrollTop;
    body.innerHTML = '';
    for (const c of TABS[tab][1]) {
      const [kind, key, label] = c;
      const box = document.createElement('div');
      const h = document.createElement('h5');
      h.textContent = label;
      box.appendChild(h);
      if (kind === 'opt') {
        const w = document.createElement('div');
        w.className = 'opts';
        OPTS[key].forEach((n, i) => {
          const b = document.createElement('button');
          b.textContent = n;
          if (d[key] === i) b.className = 'on';
          b.onclick = () => {
            d[key] = i;
            if (key === 'hatStyle' && i && !d.hat) d.hat = '#c9a227';
            apply(); render();
          };
          w.appendChild(b);
        });
        box.appendChild(w);
      } else if (kind === 'col' || kind === 'colN') {
        const w = document.createElement('div');
        w.className = 'sw';
        if (kind === 'colN') {
          const n = document.createElement('button');
          n.className = 'none' + (!d[key] ? ' on' : '');
          n.onclick = () => { d[key] = null; apply(); render(); };
          w.appendChild(n);
        }
        for (const col of PAL[c[3]]) {
          const b = document.createElement('button');
          b.style.background = col;
          if (d[key] === col) b.className = 'on';
          b.onclick = () => { d[key] = col; apply(); render(); };
          w.appendChild(b);
        }
        const inp = document.createElement('input');
        inp.type = 'color';
        inp.value = /^#[0-9a-f]{6}$/i.test(d[key] || '') ? d[key] : '#888888';
        inp.oninput = () => { d[key] = inp.value; apply(); };
        w.appendChild(inp);
        box.appendChild(w);
      } else if (kind === 'range') {
        const r = document.createElement('input');
        r.type = 'range';
        r.min = c[3]; r.max = c[4]; r.step = 0.01;
        r.value = d[key];
        r.oninput = () => { d[key] = parseFloat(r.value); apply(); };
        box.appendChild(r);
      } else if (kind === 'skin') {
        const info = document.createElement('div');
        info.style.cssText = 'font-size:12px;opacity:.85;margin-bottom:6px';
        info.textContent = d.sk ? 'Skin aktif. Warna lain diabaikan.' : 'Pilih file PNG skin Minecraft dari galeri.';
        const f = document.createElement('input');
        f.type = 'file'; f.accept = 'image/png';
        f.onchange = () => {
          const file = f.files && f.files[0];
          if (!file) return;
          const img = new Image();
          img.onload = () => {
            const cv = document.createElement('canvas');
            cv.width = 64; cv.height = img.height * 2 <= img.width ? 32 : 64;
            const g2 = cv.getContext('2d');
            g2.imageSmoothingEnabled = false;
            g2.drawImage(img, 0, 0, 64, cv.height);
            const url = cv.toDataURL('image/png');
            if (url.length >= 16000) { info.textContent = 'File terlalu rumit, pakai skin 64x64 yang lebih sederhana.'; return; }
            d.sk = url; apply(); render();
          };
          img.onerror = () => { info.textContent = 'Gagal membaca gambar PNG.'; };
          img.src = URL.createObjectURL(file);
        };
        const rm = document.createElement('button');
        rm.className = 'btn dim'; rm.textContent = 'Hapus Skin';
        rm.onclick = () => { d.sk = null; apply(); render(); };
        box.append(info, f, rm);
      }
      body.appendChild(box);
    }
    body.scrollTop = sc;
  }

  function randomize() {
    d.skin = rnd(PAL.skin); d.hair = rnd(PAL.hair); d.hairStyle = (Math.random() * OPTS.hairStyle.length) | 0;
    d.eye = rnd(PAL.eye); d.eyeStyle = (Math.random() * 3) | 0; d.mouth = (Math.random() * 3) | 0;
    d.shirt = rnd(PAL.cloth); d.shirt2 = rnd(PAL.cloth); d.shirtStyle = (Math.random() * 3) | 0;
    d.pants = rnd(PAL.pants); d.pantsStyle = (Math.random() * 2) | 0; d.shoes = rnd(PAL.shoes);
    d.hatStyle = (Math.random() * OPTS.hatStyle.length) | 0; d.hat = d.hatStyle ? rnd(PAL.acc) : null;
    d.glasses = Math.random() < 0.3 ? 1 + ((Math.random() * 2) | 0) : 0;
    d.scarf = Math.random() < 0.3 ? rnd(PAL.acc) : null;
    d.pack = Math.random() < 0.3 ? rnd(PAL.acc) : null;
    d.cape = Math.random() < 0.2 ? rnd(PAL.acc) : null;
    d.h = 0.9 + Math.random() * 0.25; d.w = 0.9 + Math.random() * 0.3; d.head = 0.95 + Math.random() * 0.25;
    apply(); render();
  }

  /* putar model dengan geser */
  const view = $('chEdView');
  let px = null;
  const down = (e) => { px = e.clientX; lobby.drag = true; try { view.setPointerCapture(e.pointerId); } catch (x) { /* abaikan */ } };
  const move = (e) => { if (px == null) return; lobby.editYaw += (e.clientX - px) * 0.012; px = e.clientX; };
  const up = () => { px = null; lobby.drag = false; };
  view.addEventListener('pointerdown', down);
  view.addEventListener('pointermove', move);
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);

  const close = () => {
    view.removeEventListener('pointerdown', down);
    view.removeEventListener('pointermove', move);
    view.removeEventListener('pointerup', up);
    view.removeEventListener('pointercancel', up);
    lobby.drag = false;
  };
  $('chEdRand').onclick = randomize;
  $('chEdReset').onclick = () => { d = normLook(lookFromSkin(SKINS[0])); apply(); render(); };
  $('chEdCancel').onclick = () => { close(); onCancel(start); };
  $('chEdSave').onclick = () => { close(); onSave(normLook(d)); };

  lobby.setMode('edit');
  lobby.setLook(d);
  lobby.char.position.set(-2.0, 0, 0);
  render();
}
