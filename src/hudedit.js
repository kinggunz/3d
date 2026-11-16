/* Costume HUD: semua tombol bisa digeser & diubah ukurannya. Tersimpan di perangkat. */
const KEY = 'ps_hud_v1';
const $ = (id) => document.getElementById(id);

export const HUD_ITEMS = [
  ['joy', 'Joystick'], ['btnAct', 'Aksi ✊'], ['btnJump', 'Lompat'], ['btnCrouch', 'Jongkok'],
  ['btnBuild', 'Bangun'], ['btnEat', 'Makan'], ['btnCtx', 'Tombol Konteks'], ['btnMic', 'Mic'],
  ['btnChat', 'Chat'], ['btnBag', 'Tas'], ['btnPause', 'Jeda'], ['hotbar', 'Hotbar Alat'],
  ['stats', 'Status'], ['clockTxt', 'Jam'], ['quest', 'Misi'], ['buildBar', 'Bar Bangun'], ['chatFeed', 'Pesan Chat'],
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && typeof d === 'object') return { l: d.l || {}, op: typeof d.op === 'number' ? d.op : 1 };
  } catch (e) { /* abaikan */ }
  return { l: {}, op: 1 };
}

export class HudEditor {
  constructor() {
    this.data = load();
    this.editing = false;
    this.sel = null;
    this.ac = null;
    this.onDone = null;
    this.saveT = null;
  }

  save() {
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* abaikan */ }
    }, 200);
  }

  /* skala dasar menurut ukuran layar (tombol ikut responsif) */
  static scaleVar() {
    const h = Math.min(innerHeight, innerWidth * 0.62);
    const hs = clamp(h / 400, 0.72, 1.4);
    document.documentElement.style.setProperty('--hs', hs.toFixed(3));
  }

  place(id) {
    const el = $(id);
    const c = this.data.l[id];
    if (!el || !c) return;
    el.style.left = c.cx * innerWidth + 'px';
    el.style.top = c.cy * innerHeight + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    el.style.margin = '0';
    el.style.transform = `translate(-50%,-50%) scale(${c.s})`;
    el.style.transformOrigin = 'center center';
  }

  clear(id) {
    const el = $(id);
    if (!el) return;
    for (const p of ['left', 'top', 'right', 'bottom', 'margin', 'transform', 'transformOrigin']) el.style[p] = '';
  }

  apply() {
    HudEditor.scaleVar();
    document.documentElement.style.setProperty('--hudop', String(this.data.op));
    for (const [id] of HUD_ITEMS) {
      if (this.data.l[id]) this.place(id);
      else this.clear(id);
    }
  }

  /* pastikan elemen punya posisi absolut tersimpan (dibaca dari posisi layar sekarang) */
  ensure(id) {
    if (this.data.l[id]) return this.data.l[id];
    const el = $(id);
    const r = el.getBoundingClientRect();
    const c = { cx: clamp((r.left + r.width / 2) / innerWidth, 0.02, 0.98), cy: clamp((r.top + r.height / 2) / innerHeight, 0.03, 0.97), s: 1 };
    this.data.l[id] = c;
    this.place(id);
    return c;
  }

  select(id) {
    this.sel = id;
    for (const [i] of HUD_ITEMS) $(i).classList.toggle('hudSel', i === id);
    const name = (HUD_ITEMS.find((x) => x[0] === id) || [0, '-'])[1];
    $('hudEditName').textContent = id ? name : 'Pilih tombol';
    const c = id ? this.data.l[id] : null;
    $('hudEditSize').value = c ? c.s : 1;
    $('hudEditSize').disabled = !id;
  }

  start(onDone) {
    if (this.editing) return;
    this.editing = true;
    this.onDone = onDone;
    this.ac = new AbortController();
    const sig = { signal: this.ac.signal };
    const hud = $('hud');
    hud.classList.add('hudEditing');
    $('hudEdit').classList.add('show');
    $('hudEditOp').value = this.data.op;
    this.select(null);

    for (const [id] of HUD_ITEMS) {
      const el = $(id);
      el.classList.add('hudEd');
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const c = this.ensure(id);
        this.select(id);
        const sx = e.clientX, sy = e.clientY, cx0 = c.cx, cy0 = c.cy;
        const pid = e.pointerId;
        const mv = (ev) => {
          if (ev.pointerId !== pid) return;
          c.cx = clamp(cx0 + (ev.clientX - sx) / innerWidth, 0.02, 0.98);
          c.cy = clamp(cy0 + (ev.clientY - sy) / innerHeight, 0.03, 0.97);
          this.place(id);
        };
        const up = (ev) => {
          if (ev.pointerId !== pid) return;
          window.removeEventListener('pointermove', mv);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          this.save();
        };
        window.addEventListener('pointermove', mv);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      }, { capture: true, signal: this.ac.signal });
      /* blokir klik/sentuh bawaan tombol selama edit */
      for (const t of ['click', 'pointerup']) {
        el.addEventListener(t, (e) => { if (t === 'click') { e.stopImmediatePropagation(); e.preventDefault(); } }, { capture: true, signal: this.ac.signal });
      }
    }

    $('hudEditSize').addEventListener('input', (e) => {
      if (!this.sel) return;
      const c = this.ensure(this.sel);
      c.s = clamp(parseFloat(e.target.value) || 1, 0.5, 2.2);
      this.place(this.sel);
      this.save();
    }, sig);
    $('hudEditOp').addEventListener('input', (e) => {
      this.data.op = clamp(parseFloat(e.target.value) || 1, 0.25, 1);
      document.documentElement.style.setProperty('--hudop', String(this.data.op));
      this.save();
    }, sig);
    $('hudEditResetOne').addEventListener('click', () => {
      if (!this.sel) return;
      delete this.data.l[this.sel];
      this.clear(this.sel);
      this.select(this.sel);
      this.save();
    }, sig);
    $('hudEditResetAll').addEventListener('click', () => {
      this.data.l = {};
      this.data.op = 1;
      $('hudEditOp').value = 1;
      this.apply();
      this.select(null);
      this.save();
    }, sig);
    $('hudEditDone').addEventListener('click', () => this.stop(), sig);
    window.addEventListener('resize', () => this.apply(), sig);
  }

  stop() {
    if (!this.editing) return;
    this.editing = false;
    clearTimeout(this.saveT);
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* abaikan */ }
    if (this.ac) this.ac.abort();
    this.ac = null;
    $('hud').classList.remove('hudEditing');
    $('hudEdit').classList.remove('show');
    for (const [id] of HUD_ITEMS) { $(id).classList.remove('hudEd'); $(id).classList.remove('hudSel'); }
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb();
  }
}
