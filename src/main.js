import './style.css';
import * as THREE from 'three';
import { Lobby } from './lobby.js';
import { Game } from './game.js';
import { Net } from './net.js';
import { SKINS, drawPreview } from './chars.js';
import { initTextures } from './textures.js';
import { sleep } from './util.js';

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* abaikan */ }
  },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const settings = Object.assign({ gfx: 'standar', fps: 60, sens: 1 }, store.get('ps_settings', {}));
let account = store.get('ps_account', null);
let skinId = store.get('ps_skin', 0);
if (!SKINS[skinId]) skinId = 0;

const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);

let lobby = null;
let game = null;
let net = null;
let inRoom = false;
let mode = 'none';

const SCREENS = ['sLoad', 'sIntro', 'sLobby', 'sOnline', 'sCreate', 'sFind', 'sRoom', 'hud'];
function show(...ids) {
  for (const s of SCREENS) $(s).classList.toggle('show', ids.includes(s));
}
function flash(msg) {
  const d = document.createElement('div');
  d.textContent = msg;
  d.style.cssText = 'position:absolute;left:50%;top:70px;transform:translateX(-50%);padding:8px 18px;border-radius:16px;background:rgba(10,16,36,.92);font-weight:700;z-index:20;pointer-events:none;border:2px solid rgba(255,255,255,.3)';
  $('app').appendChild(d);
  setTimeout(() => d.remove(), 2800);
}

/* ================= SENI LAYAR ================= */
function runCanvas(cv, draw) {
  let on = true;
  const g = cv.getContext('2d');
  const size = () => {
    cv.width = Math.max(320, Math.floor(innerWidth * 0.55));
    cv.height = Math.max(180, Math.floor(innerHeight * 0.55));
  };
  size();
  const onResize = () => size();
  window.addEventListener('resize', onResize);
  const loop = (ts) => {
    if (!on) return;
    draw(g, cv.width, cv.height, ts / 1000);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => { on = false; window.removeEventListener('resize', onResize); };
}

function drawSurvival(g, w, h, t) {
  const s = h / 360;
  const sky = g.createLinearGradient(0, 0, 0, h * 0.8);
  sky.addColorStop(0, '#0a1230');
  sky.addColorStop(0.5, '#4b2d5a');
  sky.addColorStop(1, '#e8884a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  for (let i = 0; i < 70; i++) {
    const x = (((i * 97) % 100) / 100) * w, y = (((i * 53) % 100) / 100) * h * 0.45;
    g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5 + i));
    g.fillRect(x, y, 2, 2);
  }
  g.globalAlpha = 1;
  g.fillStyle = '#f4f1d0';
  g.beginPath();
  g.arc(w * 0.82, h * 0.2, h * 0.07, 0, 7);
  g.fill();
  const ridge = (base, amp, f, col, off) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) g.lineTo(x, base + Math.sin(x * f + off) * amp + Math.sin(x * f * 2.3 + off * 2) * amp * 0.4);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  };
  ridge(h * 0.62, h * 0.06, 0.006, '#3a2a55', 1);
  ridge(h * 0.7, h * 0.05, 0.009, '#241c3d', 3);
  const pines = (base, col, count, sz) => {
    g.fillStyle = col;
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) / count) * w + Math.sin(i * 12.9) * w * 0.015;
      const k = sz * (0.8 + 0.5 * Math.abs(Math.sin(i * 7.3)));
      g.beginPath(); g.moveTo(x - k * 0.4, base); g.lineTo(x, base - k); g.lineTo(x + k * 0.4, base); g.fill();
      g.beginPath(); g.moveTo(x - k * 0.3, base - k * 0.45); g.lineTo(x, base - k * 1.25); g.lineTo(x + k * 0.3, base - k * 0.45); g.fill();
    }
  };
  pines(h * 0.8, '#150f2a', 22, h * 0.17);
  g.fillStyle = '#0d0a1c';
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(0, h * 0.8);
  g.quadraticCurveTo(w * 0.5, h * 0.74, w, h * 0.8);
  g.lineTo(w, h);
  g.fill();
  const fx = w * 0.52, fy = h * 0.86;
  /* tenda */
  g.fillStyle = '#1b1530';
  g.beginPath(); g.moveTo(w * 0.2, fy + 6 * s); g.lineTo(w * 0.29, fy - 64 * s); g.lineTo(w * 0.38, fy + 6 * s); g.fill();
  g.fillStyle = '#0a0716';
  g.beginPath(); g.moveTo(w * 0.275, fy + 6 * s); g.lineTo(w * 0.29, fy - 30 * s); g.lineTo(w * 0.305, fy + 6 * s); g.fill();
  /* cahaya api */
  const glow = g.createRadialGradient(fx, fy - 10 * s, 4, fx, fy - 10 * s, 190 * s);
  const fl = 0.8 + 0.2 * Math.sin(t * 12) + 0.1 * Math.sin(t * 7.3);
  glow.addColorStop(0, `rgba(255,170,60,${0.55 * fl})`);
  glow.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  /* orang bertahan hidup */
  g.fillStyle = '#080612';
  const person = (x, y, sit, flip) => {
    g.beginPath(); g.arc(x, y - (sit ? 38 : 62) * s, 9 * s, 0, 7); g.fill();
    g.beginPath(); g.ellipse(x, y - (sit ? 20 : 36) * s, 11 * s, (sit ? 16 : 26) * s, 0, 0, 7); g.fill();
    if (sit) { g.fillRect(x - 14 * s, y - 6 * s, 28 * s, 8 * s); g.fillRect(x + flip * 14 * s, y - 12 * s, flip * 14 * s, 5 * s); }
    else { g.fillRect(x - 8 * s, y - 14 * s, 6 * s, 16 * s); g.fillRect(x + 2 * s, y - 14 * s, 6 * s, 16 * s); g.fillRect(x + flip * 10 * s, y - 78 * s, 3 * s, 80 * s); }
  };
  person(fx - 70 * s, fy + 4 * s, true, 1);
  person(fx + 78 * s, fy + 4 * s, false, 1);
  person(fx + 32 * s, fy + 8 * s, true, -1);
  /* kayu & api */
  g.fillStyle = '#2a1608';
  g.fillRect(fx - 20 * s, fy - 4 * s, 40 * s, 7 * s);
  for (let k = 0; k < 4; k++) {
    g.fillStyle = k % 2 ? '#ff7a1a' : '#ffb340';
    g.beginPath();
    g.ellipse(fx + (k - 1.5) * 8 * s, fy - 14 * s, 7 * s, (20 + Math.sin(t * 9 + k * 2) * 7) * s, 0, 0, 7);
    g.fill();
  }
  g.fillStyle = '#fff0b0';
  g.beginPath(); g.ellipse(fx, fy - 10 * s, 5 * s, (12 + Math.sin(t * 11) * 4) * s, 0, 0, 7); g.fill();
  /* percikan */
  for (let i = 0; i < 18; i++) {
    const life = (t * 0.6 + i * 0.37) % 1;
    g.globalAlpha = 1 - life;
    g.fillStyle = '#ffcf6a';
    g.fillRect(fx + Math.sin(i * 5 + t * 2) * 40 * life * s, fy - 20 * s - life * h * 0.35, 2, 2);
  }
  g.globalAlpha = 1;
}

function drawIntro(g, w, h, t) {
  g.save();
  const zoom = 1.06 + 0.05 * Math.sin(t * 0.2);
  g.translate(w / 2, h * 0.58);
  g.scale(zoom, zoom);
  g.translate(-w / 2, -h * 0.58);
  const sky = g.createLinearGradient(0, 0, 0, h * 0.66);
  sky.addColorStop(0, '#02040f');
  sky.addColorStop(0.6, '#0b1e4a');
  sky.addColorStop(1, '#2a4a86');
  g.fillStyle = sky;
  g.fillRect(-60, -60, w + 120, h + 120);
  g.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 3; b++) {
    g.beginPath();
    for (let x = -20; x <= w + 20; x += 10) {
      const y = h * (0.2 + b * 0.08) + Math.sin(x * 0.012 + t * 0.6 + b * 2) * h * 0.05;
      if (x === -20) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.lineWidth = h * 0.1;
    g.strokeStyle = `rgba(${60 + b * 50},255,${170 - b * 40},0.07)`;
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#fff';
  for (let i = 0; i < 90; i++) {
    const x = (((i * 89) % 100) / 100) * w, y = (((i * 47) % 100) / 100) * h * 0.55;
    g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.3 + i));
    g.fillRect(x, y, 2, 2);
  }
  g.globalAlpha = 1;
  const ph = (t % 5) / 5;
  if (ph < 0.14) {
    const p = ph / 0.14;
    const x0 = w * 0.78 - p * w * 0.35, y0 = h * 0.08 + p * h * 0.22;
    const gr = g.createLinearGradient(x0, y0, x0 + 70, y0 - 28);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = gr;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 70, y0 - 28); g.stroke();
  }
  const mx = w * 0.8, my = h * 0.2;
  const mg = g.createRadialGradient(mx, my, 4, mx, my, h * 0.2);
  mg.addColorStop(0, 'rgba(255,255,230,0.5)');
  mg.addColorStop(1, 'rgba(255,255,230,0)');
  g.fillStyle = mg;
  g.fillRect(mx - h * 0.2, my - h * 0.2, h * 0.4, h * 0.4);
  g.fillStyle = '#f6f3dc';
  g.beginPath(); g.arc(mx, my, h * 0.05, 0, 7); g.fill();
  /* laut */
  const sea = g.createLinearGradient(0, h * 0.62, 0, h);
  sea.addColorStop(0, '#0e3568');
  sea.addColorStop(1, '#030b1d');
  g.fillStyle = sea;
  g.fillRect(-60, h * 0.62, w + 120, h * 0.5);
  g.lineWidth = 1.5;
  for (let r = 0; r < 9; r++) {
    g.strokeStyle = `rgba(150,200,255,${0.12 + r * 0.01})`;
    g.beginPath();
    const y0 = h * (0.65 + r * 0.04);
    for (let x = -10; x <= w + 10; x += 8) {
      const y = y0 + Math.sin(x * 0.03 + t * (1 + r * 0.15) + r) * (1 + r * 0.5);
      if (x === -10) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(255,255,230,${0.1 + 0.12 * Math.abs(Math.sin(t * 2 + i))})`;
    g.fillRect(mx - 30 + Math.sin(t + i) * 12, h * 0.64 + i * h * 0.022, 60 - i * 3, 2);
  }
  /* pulau */
  g.fillStyle = '#07130f';
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.68, w * 0.3, h * 0.06, 0, 0, 7);
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.3, h * 0.68);
  g.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.7, h * 0.68);
  g.fill();
  const palm = (x, y, s, lean) => {
    g.strokeStyle = '#050a07';
    g.lineWidth = s * 0.06;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * s * 0.3, y - s * 0.5, x + lean * s * 0.55, y - s); g.stroke();
    const tx = x + lean * s * 0.55, ty = y - s;
    g.lineWidth = s * 0.035;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + Math.sin(t * 0.8 + k) * 0.05;
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a) * s * 0.35, ty + Math.sin(a) * s * 0.15 - s * 0.2, tx + Math.cos(a) * s * 0.6, ty + Math.sin(a) * s * 0.35);
      g.stroke();
    }
  };
  palm(w * 0.36, h * 0.67, h * 0.34, -0.5);
  palm(w * 0.62, h * 0.67, h * 0.3, 0.6);
  palm(w * 0.45, h * 0.62, h * 0.22, 0.2);
  /* api unggun */
  const fx = w * 0.52, fy = h * 0.64;
  const fl = 0.8 + 0.2 * Math.sin(t * 12);
  const fg = g.createRadialGradient(fx, fy, 2, fx, fy, h * 0.12);
  fg.addColorStop(0, `rgba(255,170,60,${0.6 * fl})`);
  fg.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = fg;
  g.fillRect(fx - h * 0.12, fy - h * 0.12, h * 0.24, h * 0.24);
  g.fillStyle = '#ffb340';
  g.beginPath(); g.ellipse(fx, fy - 4, 5, 9 + Math.sin(t * 10) * 3, 0, 0, 7); g.fill();
  g.restore();
}

/* ================= LOADING ================= */
const TIPS = [
  'Tip: tebang pohon dan pecahkan batu untuk bahan bangunan.',
  'Tip: malam hari serigala lebih ganas. Bangun api unggun!',
  'Tip: bangun kasur untuk tidur dan melewati malam.',
  'Tip: masak daging di api unggun agar lebih mengenyangkan.',
  'Tip: minum dari laut atau danau agar tidak dehidrasi.',
  'Tip: buat kapak dan tombak dari tas untuk berburu lebih cepat.',
];

async function runLoading(job) {
  show('sLoad');
  let tipI = (Math.random() * TIPS.length) | 0;
  $('loadTip').textContent = TIPS[tipI];
  $('loadLabel').textContent = 'Memuat...';
  const stop = runCanvas($('loadBg'), drawSurvival);
  let target = 0, shown = 0, run = true;
  const tipTimer = setInterval(() => { tipI = (tipI + 1) % TIPS.length; $('loadTip').textContent = TIPS[tipI]; }, 2400);
  const upd = () => {
    if (!run) return;
    shown += (target - shown) * 0.1;
    if (target - shown < 0.4) shown = target;
    const v = Math.max(1, Math.min(100, Math.round(shown)));
    $('loadFill').style.width = v + '%';
    $('loadPct').textContent = v + '%';
    requestAnimationFrame(upd);
  };
  requestAnimationFrame(upd);
  try {
    await job((p, l) => {
      target = p;
      if (l) $('loadLabel').textContent = l;
    });
    target = 100;
    for (let i = 0; i < 300 && shown < 99.6; i++) await sleep(30);
    await sleep(350);
  } finally {
    run = false;
    stop();
    clearInterval(tipTimer);
  }
}

/* ================= INTRO ================= */
async function intro() {
  show('sIntro');
  const stop = runCanvas($('introBg'), drawIntro);
  $('introForm').classList.add('hidden');
  $('introTap').classList.add('hidden');
  await sleep(2200);
  return new Promise((resolve) => {
    let ready = false;
    const root = $('sIntro');
    const tap = (e) => {
      if (!ready) return;
      if (e.target.closest && e.target.closest('#introForm')) return;
      root.removeEventListener('pointerdown', tap);
      stop();
      resolve();
    };
    const showTap = () => {
      $('introForm').classList.add('hidden');
      $('helloName').textContent = 'Halo, ' + account.name + '!';
      $('introTap').classList.remove('hidden');
      setTimeout(() => { ready = true; }, 450);
    };
    if (account) showTap();
    else {
      $('introForm').classList.remove('hidden');
      const make = () => {
        const n = $('inName').value.trim();
        if (n.length < 2) {
          $('inName').style.borderColor = '#ff6a5a';
          $('inName').placeholder = 'Nama minimal 2 huruf';
          $('inName').focus();
          return;
        }
        account = { name: n };
        store.set('ps_account', account);
        showTap();
      };
      $('btnMakeAcc').onclick = make;
      $('inName').onkeydown = (e) => { if (e.key === 'Enter') make(); };
    }
    root.addEventListener('pointerdown', tap);
  });
}

/* ================= PENGATURAN ================= */
function refreshSettingsUI() {
  $('gfxStd').classList.toggle('on', settings.gfx === 'standar');
  $('gfxUlt').classList.toggle('on', settings.gfx === 'ultra');
  for (const f of [30, 60, 120]) $('fps' + f).classList.toggle('on', settings.fps === f);
  $('sensRange').value = settings.sens;
}
function saveSettings() {
  store.set('ps_settings', settings);
  refreshSettingsUI();
  if (game) game.applySettings();
}
function openSettings() {
  refreshSettingsUI();
  $('mSet').classList.add('show');
}
$('gfxStd').onclick = () => { settings.gfx = 'standar'; saveSettings(); };
$('gfxUlt').onclick = () => { settings.gfx = 'ultra'; saveSettings(); };
for (const f of [30, 60, 120]) $('fps' + f).onclick = () => { settings.fps = f; saveSettings(); };
$('sensRange').oninput = (e) => { settings.sens = parseFloat(e.target.value); store.set('ps_settings', settings); };
$('setClose').onclick = () => $('mSet').classList.remove('show');

/* ================= LOBI ================= */
function toLobby() {
  mode = 'lobby';
  show('sLobby');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  $('lbName').textContent = account.name;
  $('lbChar').textContent = SKINS[skinId].name;
  lobby.setSkin(SKINS[skinId]);
  lobby.resize();
}

function renderVault() {
  const g = $('vaultGrid');
  g.innerHTML = '';
  for (const d of SKINS) {
    const el = document.createElement('div');
    el.className = 'vItem' + (d.id === skinId ? ' sel' : '');
    const cv = document.createElement('canvas');
    cv.width = 140; cv.height = 140;
    drawPreview(cv, d);
    el.appendChild(cv);
    const b = document.createElement('b');
    b.textContent = d.name;
    el.appendChild(b);
    el.onclick = () => {
      skinId = d.id;
      store.set('ps_skin', skinId);
      lobby.setSkin(d);
      $('lbChar').textContent = d.name;
      $('roomMe').textContent = account.name;
      renderVault();
    };
    g.appendChild(el);
  }
}

$('lbSet').onclick = openSettings;
$('lbVault').onclick = () => { renderVault(); $('mVault').classList.add('show'); };
$('vaultClose').onclick = () => $('mVault').classList.remove('show');
$('btnOffline').onclick = () => startGame({ online: false });
$('btnOnline').onclick = () => show('sOnline');

/* ================= ONLINE ================= */
$('onBack').onclick = () => show('sLobby');
$('onCreate').onclick = () => { $('crMsg').textContent = ''; show('sCreate'); };
$('onFind').onclick = () => { $('fnMsg').textContent = ''; show('sFind'); };
$('crBack').onclick = () => show('sOnline');
$('fnBack').onclick = () => show('sOnline');

function renderSlots(pl) {
  const w = $('slots');
  w.innerHTML = '';
  const mk = (i) => {
    const p = pl[i];
    const d = document.createElement('div');
    d.className = 'slot' + (p ? ' full' : '');
    if (p) {
      const col = (SKINS[p.skin] && SKINS[p.skin].shirt) || '#fff';
      d.innerHTML = `<span class="dot" style="background:${col}"></span>${esc(p.name)}${p.id === 'h' ? ' 👑' : ''}`;
    } else d.innerHTML = `Slot ${i + 1}<br>Menunggu pemain...`;
    return d;
  };
  const L = document.createElement('div');
  const R = document.createElement('div');
  L.className = R.className = 'slotGroup';
  L.append(mk(0), mk(1));
  R.append(mk(2), mk(3));
  w.append(L, R);
}

function setupRoom(room, isHost) {
  $('roomTitle').textContent = 'Room: ' + room;
  $('roomMe').textContent = account.name;
  $('roomGo').classList.toggle('hidden', !isHost);
  $('roomWait').classList.toggle('hidden', isHost);
  net.onLobby = renderSlots;
  net.onStart = (m) => beginOnline(m.seed, m.players);
  net.onClosed = () => { if (inRoom) leaveRoom('Host menutup room'); };
  renderSlots(net.players);
  inRoom = true;
  show('sRoom');
}

function leaveRoom(msg) {
  inRoom = false;
  if (net) { net.close(); net = null; }
  show('sOnline');
  if (msg) flash(msg);
}

async function createRoom() {
  const room = $('crRoom').value.trim(), pw = $('crPw').value;
  const msg = $('crMsg');
  if (room.length < 2) { msg.textContent = 'Nama room minimal 2 karakter.'; return; }
  if (pw.length < 1) { msg.textContent = 'Isi password room.'; return; }
  msg.textContent = 'Membuat room...';
  const n = new Net();
  try {
    await n.host(room, pw, { name: account.name, skin: skinId });
  } catch (e) {
    msg.textContent = e.message;
    n.close();
    return;
  }
  net = n;
  msg.textContent = '';
  setupRoom(room, true);
}

async function joinRoom() {
  const room = $('fnRoom').value.trim(), pw = $('fnPw').value;
  const msg = $('fnMsg');
  if (room.length < 2) { msg.textContent = 'Isi nama room.'; return; }
  if (pw.length < 1) { msg.textContent = 'Isi password room.'; return; }
  msg.textContent = 'Mencari room...';
  const n = new Net();
  try {
    await n.join(room, pw, { name: account.name, skin: skinId });
  } catch (e) {
    msg.textContent = e.message;
    n.close();
    return;
  }
  net = n;
  msg.textContent = '';
  setupRoom(room, false);
}

$('crGo').onclick = createRoom;
$('fnGo').onclick = joinRoom;
$('roomLeave').onclick = () => leaveRoom();
$('roomGo').onclick = () => {
  if (!net) return;
  const seed = (Math.random() * 1e9) | 0;
  net.start(seed);
  beginOnline(seed, net.players);
};

function beginOnline(seed, players) {
  inRoom = false;
  startGame({ online: true, seed, players });
}

/* ================= GAME ================= */
async function startGame(o) {
  mode = 'none';
  const g = new Game(renderer, settings, {
    online: !!o.online,
    net: o.online ? net : null,
    seed: o.seed,
    players: o.players,
    name: account.name,
    skinId,
    openSettings,
    onExit: exitGame,
  });
  try {
    await runLoading((p, l) => g.load(p, l));
  } catch (e) {
    console.error(e);
    flash('Gagal memuat dunia: ' + (e && e.message ? e.message : e));
    if (net) { net.close(); net = null; }
    toLobby();
    return;
  }
  game = g;
  show('hud');
  g.begin();
  if (net) net.onMsg = (m) => g.onNet(m);
  mode = 'game';
}

function exitGame() {
  if (game) { game.dispose(); game = null; }
  if (net) { net.close(); net = null; }
  $('mSet').classList.remove('show');
  toLobby();
}

/* ================= LOOP ================= */
let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const minDt = 1000 / settings.fps;
  if (ts - last < minDt - 2) return;
  const dt = Math.min((ts - last) / 1000, 0.1);
  last = ts;
  if (mode === 'lobby' && lobby) {
    lobby.update(dt);
    lobby.render(renderer);
  } else if (mode === 'game' && game) {
    game.update(dt);
    game.render();
  }
}

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  if (lobby) lobby.resize();
  if (game) game.resize();
});
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && !game.online) game.save();
});

/* ================= BOOT ================= */
async function boot() {
  requestAnimationFrame(frame);
  await runLoading(async (p) => {
    p(8, 'Memuat tekstur...');
    initTextures();
    await sleep(700);
    p(35, 'Menyiapkan lobi...');
    lobby = new Lobby();
    lobby.setSkin(SKINS[skinId]);
    await sleep(700);
    p(65, 'Membangun dunia survival...');
    await sleep(800);
    p(90, 'Hampir siap...');
    await sleep(700);
  });
  await intro();
  toLobby();
}

boot().catch((e) => {
  console.error(e);
  flash('Terjadi kesalahan: ' + (e && e.message ? e.message : e));
});
