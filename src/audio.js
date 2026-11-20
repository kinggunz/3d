/* Musik & efek suara 100% prosedural (WebAudio) - tanpa file audio */
const A = {
  ctx: null,
  master: null,
  musicG: null,
  sfxG: null,
  noiseBuf: null,
  vol: { music: 0.6, sfx: 0.8 },
  track: 'none',
  timer: null,
  step: 0,
  night: 0,
  ambTimer: null,
  ambMode: 'none',
  lastStep: 0,
};

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export const Audio = {
  init() {
    if (A.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    try {
      A.ctx = new C();
    } catch (e) {
      return;
    }
    const c = A.ctx;
    A.master = c.createGain();
    A.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    A.master.connect(comp);
    comp.connect(c.destination);
    A.musicG = c.createGain();
    A.sfxG = c.createGain();
    A.musicG.connect(A.master);
    A.sfxG.connect(A.master);
    Audio.setVolumes(A.vol.music, A.vol.sfx);
    const len = c.sampleRate * 1.5;
    A.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    if (A.track !== 'none') {
      const t = A.track;
      A.track = 'none';
      Audio.music(t);
    }
  },

  /* akses graf audio untuk suara mesin motor */
  graph() {
    Audio.init();
    if (!A.ctx) return null;
    return { ctx: A.ctx, dest: A.sfxG, noise: A.noiseBuf };
  },

  /* harus dipanggil dari gestur pengguna */
  unlock() {
    Audio.init();
    if (A.ctx && A.ctx.state !== 'running') A.ctx.resume().catch(() => {});
  },

  setVolumes(m, s) {
    A.vol.music = m;
    A.vol.sfx = s;
    if (A.musicG) A.musicG.gain.value = m * 0.55;
    if (A.sfxG) A.sfxG.gain.value = s;
  },

  /* ---------- nada dasar ---------- */
  tone(f, t0, dur, type, gain, dest, opt = {}) {
    const c = A.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.slide), t0 + dur);
    const a = opt.attack ?? 0.01;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let last = o;
    if (opt.lp) {
      const f2 = c.createBiquadFilter();
      f2.type = 'lowpass';
      f2.frequency.value = opt.lp;
      o.connect(f2);
      last = f2;
    }
    last.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  },

  noise(t0, dur, gain, filt, dest, opt = {}) {
    const c = A.ctx;
    const s = c.createBufferSource();
    s.buffer = A.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = opt.type || 'bandpass';
    f.frequency.setValueAtTime(filt, t0);
    if (opt.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.sweep), t0 + dur);
    f.Q.value = opt.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + (opt.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t0, Math.random());
    s.stop(t0 + dur + 0.05);
  },

  /* ---------- efek suara ---------- */
  sfx(name) {
    const c = A.ctx;
    if (!c || c.state !== 'running' || A.vol.sfx <= 0) return;
    const t = c.currentTime;
    const d = A.sfxG;
    switch (name) {
      case 'click':
        Audio.tone(660, t, 0.07, 'triangle', 0.25, d);
        Audio.tone(990, t + 0.03, 0.08, 'triangle', 0.18, d);
        break;
      case 'back':
        Audio.tone(520, t, 0.08, 'triangle', 0.22, d, { slide: 320 });
        break;
      case 'chop':
        Audio.noise(t, 0.09, 0.7, 700, d, { q: 0.8 });
        Audio.tone(140, t, 0.12, 'square', 0.3, d, { slide: 70, lp: 600 });
        break;
      case 'mine':
        Audio.noise(t, 0.05, 0.6, 3200, d, { q: 3 });
        Audio.tone(900, t, 0.1, 'square', 0.18, d, { slide: 500 });
        break;
      case 'swing':
        Audio.noise(t, 0.16, 0.22, 900, d, { sweep: 2600, q: 0.7, attack: 0.05 });
        break;
      case 'hit':
        Audio.noise(t, 0.1, 0.55, 380, d, { q: 0.6 });
        Audio.tone(110, t, 0.15, 'sawtooth', 0.28, d, { slide: 60, lp: 500 });
        break;
      case 'fall':
        Audio.noise(t, 0.5, 0.5, 500, d, { sweep: 90, q: 0.5 });
        Audio.tone(90, t, 0.5, 'sine', 0.4, d, { slide: 35 });
        break;
      case 'pickup':
        Audio.tone(880, t, 0.09, 'square', 0.16, d);
        Audio.tone(1320, t + 0.07, 0.12, 'square', 0.16, d);
        break;
      case 'place':
        Audio.noise(t, 0.07, 0.5, 500, d);
        Audio.tone(200, t, 0.12, 'square', 0.3, d, { slide: 120, lp: 700 });
        Audio.tone(300, t + 0.04, 0.08, 'triangle', 0.2, d);
        break;
      case 'break':
        Audio.noise(t, 0.2, 0.6, 1200, d, { sweep: 300, q: 0.6 });
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) Audio.noise(t + i * 0.11, 0.06, 0.5, 1500, d, { q: 2 });
        break;
      case 'drink':
        for (let i = 0; i < 4; i++) Audio.tone(300 + i * 40, t + i * 0.09, 0.08, 'sine', 0.25, d, { slide: 600 });
        break;
      case 'hurt':
        Audio.tone(220, t, 0.25, 'sawtooth', 0.35, d, { slide: 80, lp: 900 });
        Audio.noise(t, 0.12, 0.4, 600, d);
        break;
      case 'jump':
        Audio.tone(260, t, 0.14, 'sine', 0.18, d, { slide: 520 });
        break;
      case 'splash':
        Audio.noise(t, 0.35, 0.5, 1800, d, { sweep: 500, q: 0.6, attack: 0.02 });
        break;
      case 'craft':
        Audio.tone(523, t, 0.1, 'triangle', 0.25, d);
        Audio.tone(659, t + 0.1, 0.1, 'triangle', 0.25, d);
        Audio.tone(784, t + 0.2, 0.18, 'triangle', 0.25, d);
        break;
      case 'quest':
        [523, 659, 784, 1046].forEach((f, i) => Audio.tone(f, t + i * 0.09, 0.2, 'triangle', 0.26, d));
        break;
      case 'cook':
        Audio.noise(t, 0.5, 0.4, 3500, d, { type: 'highpass', q: 0.5, attack: 0.1 });
        break;
      case 'sleep':
        [392, 330, 262].forEach((f, i) => Audio.tone(f, t + i * 0.35, 0.6, 'sine', 0.25, d));
        break;
      case 'growl':
        Audio.tone(70, t, 0.5, 'sawtooth', 0.35, d, { slide: 50, lp: 260 });
        Audio.noise(t, 0.5, 0.25, 220, d, { q: 1 });
        break;
      case 'step': {
        const k = 500 + Math.random() * 300;
        Audio.noise(t, 0.06, 0.18, k, d, { q: 0.9 });
        break;
      }
      case 'stepSand':
        Audio.noise(t, 0.09, 0.16, 2200, d, { type: 'highpass', q: 0.4 });
        break;
      case 'join':
        Audio.tone(440, t, 0.1, 'triangle', 0.22, d);
        Audio.tone(660, t + 0.1, 0.16, 'triangle', 0.22, d);
        break;
      default:
        break;
    }
  },

  footstep(sand, running) {
    const now = performance.now();
    if (now - A.lastStep < (running ? 260 : 380)) return;
    A.lastStep = now;
    Audio.sfx(sand ? 'stepSand' : 'step');
  },

  /* ---------- musik generatif ---------- */
  music(track) {
    if (!A.ctx) {
      A.track = track;
      return;
    }
    if (A.track === track && A.timer) return;
    A.track = track;
    if (A.timer) clearInterval(A.timer);
    A.timer = null;
    A.step = 0;
    if (track === 'none') return;
    const tempo = track === 'menu' ? 84 : track === 'game' ? 72 : 78;
    const stepMs = (60 / tempo / 2) * 1000;
    const loop = () => {
      const c = A.ctx;
      if (!c || c.state !== 'running') return;
      Audio._musicStep(c.currentTime + 0.05, A.step++, A.track);
    };
    loop();
    A.timer = setInterval(loop, stepMs);
  },

  setNight(n) {
    A.night = n;
  },

  _musicStep(t, s, track) {
    const c = A.ctx;
    const d = A.musicG;
    const night = A.night > 0.55;
    /* progresi: Am - F - C - G (menu/malam: Am - F - Dm - E) */
    const roots = night || track === 'menu' ? [57, 53, 50, 52] : [60, 57, 53, 55];
    const minor = night || track === 'menu';
    const bar = Math.floor(s / 8) % 4;
    const r = roots[bar];
    const third = r + (minor && bar !== 3 ? 3 : bar === 3 && minor ? 4 : 4);
    const chord = [r, third, r + 7];
    const pos = s % 8;
    if (pos === 0) {
      /* pad panjang */
      chord.forEach((m, i) => {
        const f = hz(m + 12);
        Audio.tone(f, t, 3.2, 'sine', 0.14, d, { attack: 0.8, lp: 1200 });
        Audio.tone(f * 1.004, t, 3.2, 'triangle', 0.05, d, { attack: 1.0, lp: 900 });
        if (i === 0) Audio.tone(hz(m - 12), t, 3.2, 'sine', 0.2, d, { attack: 0.3 });
      });
    }
    const scale = minor ? [0, 3, 5, 7, 10, 12, 15, 17] : [0, 2, 4, 7, 9, 12, 14, 16];
    if (track === 'menu') {
      /* arpeggio lembut */
      const idx = [0, 2, 4, 2, 5, 4, 2, 1][pos];
      Audio.tone(hz(r + 12 + scale[idx]), t, 0.5, 'triangle', 0.13, d, { lp: 2400 });
      if (pos === 4) Audio.tone(hz(r + 24 + scale[(bar + 3) % 8]), t, 1.2, 'sine', 0.1, d, { attack: 0.05 });
    } else {
      /* in-game: melodi jarang, tenang */
      if ((pos === 2 || pos === 5) && Math.random() < (night ? 0.45 : 0.7)) {
        const n = scale[(Math.random() * 6) | 0];
        Audio.tone(hz(r + 12 + n), t, night ? 1.6 : 1.0, night ? 'sine' : 'triangle', night ? 0.1 : 0.12, d, { attack: 0.03, lp: 2200 });
      }
      if (pos === 0 && !night) Audio.tone(hz(r + 24), t + 0.25, 0.8, 'sine', 0.05, d);
    }
    if (track === 'game' && night && pos === 0 && Math.random() < 0.5) {
      Audio.tone(hz(r - 24), t, 4, 'sine', 0.2, d, { attack: 1.2 });
    }
  },

  /* ---------- suasana alam: angin, burung, jangkrik, api ---------- */
  ambient(on) {
    if (A.ambTimer) { clearInterval(A.ambTimer); A.ambTimer = null; }
    if (!on || !A.ctx) return;
    A.ambTimer = setInterval(() => {
      const c = A.ctx;
      if (!c || c.state !== 'running' || A.vol.sfx <= 0) return;
      const t = c.currentTime;
      const d = A.sfxG;
      Audio.noise(t, 2.4, 0.045, 400, d, { sweep: 700, q: 0.4, attack: 1.0 });
      if (A.night < 0.5) {
        if (Math.random() < 0.55) {
          const f = 2200 + Math.random() * 1400;
          const n = 2 + ((Math.random() * 3) | 0);
          for (let i = 0; i < n; i++) Audio.tone(f * (1 + (i % 2) * 0.12), t + i * 0.12, 0.09, 'sine', 0.05, d, { slide: f * 1.25 });
        }
      } else if (Math.random() < 0.8) {
        for (let i = 0; i < 4; i++) Audio.tone(4300, t + i * 0.07, 0.04, 'sine', 0.025, d);
      }
    }, 2600);
  },

  fire() {
    const c = A.ctx;
    if (!c || c.state !== 'running' || A.vol.sfx <= 0) return;
    Audio.noise(c.currentTime, 0.12, 0.12 + Math.random() * 0.12, 1800 + Math.random() * 2000, A.sfxG, { q: 2 });
  },
};
