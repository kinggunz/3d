/* Suara mesin motor sintetis (WebAudio) — bisa di-custom: jenis, bass, treble, serak */
import { Audio } from './audio.js';

/* [pitch, subGain, midGain, hiGain, lowpassBase, noise, whine, crackle] */
const PRESET = [
  [1.0, 0.5, 0.7, 0.25, 1500, 0.10, 0.10, 0],
  [1.5, 0.25, 0.6, 0.45, 2600, 0.14, 0.05, 0],
  [0.62, 1.0, 0.55, 0.12, 900, 0.08, 0.02, 0],
  [1.25, 0.25, 0.8, 0.5, 2200, 0.35, 0.0, 1],
  [1.8, 0.1, 0.5, 0.6, 3600, 0.12, 0.35, 0],
];

export class MotoSound {
  constructor(cfg) {
    this.ok = false;
    const gph = Audio.graph();
    if (!gph) return;
    const c = this.c = gph.ctx;
    this.cfg = cfg;
    this.out = c.createGain();
    this.out.gain.value = 0;
    this.out.connect(gph.dest);
    this.shelfLo = c.createBiquadFilter(); this.shelfLo.type = 'lowshelf'; this.shelfLo.frequency.value = 180;
    this.shelfHi = c.createBiquadFilter(); this.shelfHi.type = 'highshelf'; this.shelfHi.frequency.value = 2400;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.9;
    this.shaper = c.createWaveShaper();
    this.amp = c.createGain(); this.amp.gain.value = 0.7;
    this.mix = c.createGain();
    this.mix.connect(this.shaper); this.shaper.connect(this.lp); this.lp.connect(this.shelfLo);
    this.shelfLo.connect(this.shelfHi); this.shelfHi.connect(this.amp); this.amp.connect(this.out);
    const mkO = (type, g) => { const o = c.createOscillator(); o.type = type; const gn = c.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(this.mix); o.start(); return { o, gn }; };
    this.sub = mkO('square', 0.3); this.mid = mkO('sawtooth', 0.3); this.hi = mkO('sawtooth', 0.2); this.wh = mkO('sine', 0.05);
    /* derau knalpot */
    this.nz = c.createBufferSource(); this.nz.buffer = gph.noise; this.nz.loop = true;
    this.nbp = c.createBiquadFilter(); this.nbp.type = 'bandpass'; this.nbp.Q.value = 0.7;
    this.ng = c.createGain(); this.ng.gain.value = 0;
    this.nz.connect(this.nbp); this.nbp.connect(this.ng); this.ng.connect(this.lp);
    this.nz.start();
    /* denyut pembakaran */
    this.lfo = c.createOscillator(); this.lfo.type = 'sine';
    this.lfoG = c.createGain(); this.lfoG.gain.value = 0.3;
    this.lfo.connect(this.lfoG); this.lfoG.connect(this.amp.gain); this.lfo.start();
    this.ok = true;
    this.setCfg(cfg);
    this.rpm = 1500;
  }

  setCfg(cfg) {
    if (!this.ok) return;
    this.cfg = cfg;
    const drive = 2 + cfg.rasp * 24;
    const n = 512, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * drive * 0.35) / Math.tanh(drive * 0.35); }
    this.shaper.curve = curve;
    this.shelfLo.gain.value = (cfg.bass - 0.5) * 24;
    this.shelfHi.gain.value = (cfg.treble - 0.5) * 24;
  }

  /* rpm 1200..9500, thr 0..1, vol 0..1 */
  update(rpm, thr, vol) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime, P = PRESET[this.cfg.snd] || PRESET[0];
    const fire = rpm / 120; /* Hz pembakaran (4-tak) */
    const f = fire * 2 * P[0];
    const k = 0.05;
    this.sub.o.frequency.setTargetAtTime(f * 0.5, t, k);
    this.mid.o.frequency.setTargetAtTime(f, t, k);
    this.hi.o.frequency.setTargetAtTime(f * 2.01, t, k);
    this.wh.o.frequency.setTargetAtTime(380 + rpm * 0.12 * P[0], t, 0.1);
    this.sub.gn.gain.setTargetAtTime(0.5 * P[1], t, 0.1);
    this.mid.gn.gain.setTargetAtTime(0.5 * P[2], t, 0.1);
    this.hi.gn.gain.setTargetAtTime(0.4 * P[3] * (0.4 + thr * 0.6), t, 0.1);
    this.wh.gn.gain.setTargetAtTime(P[6] * (0.2 + (rpm / 9500)), t, 0.1);
    const lpf = P[4] * (0.5 + thr * 0.9) + rpm * 0.3;
    this.lp.frequency.setTargetAtTime(lpf, t, 0.06);
    this.nbp.frequency.setTargetAtTime(600 + rpm * 0.4, t, 0.1);
    this.ng.gain.setTargetAtTime((P[5] + this.cfg.rasp * 0.3) * (0.15 + thr * 0.85) * 0.35, t, 0.08);
    this.lfo.frequency.setTargetAtTime(fire * (P[7] ? 1.5 : 1), t, 0.05);
    this.lfoG.gain.setTargetAtTime((P[7] ? 0.5 : 0.3) * Math.max(0.15, 1 - rpm / 8500), t, 0.1);
    this.out.gain.setTargetAtTime(0.5 * vol * (0.55 + thr * 0.45), t, 0.08);
  }

  stop() {
    if (!this.ok) return;
    const t = this.c.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.05);
    const list = [this.sub.o, this.mid.o, this.hi.o, this.wh.o, this.lfo, this.nz];
    setTimeout(() => { for (const o of list) { try { o.stop(); } catch (e) { /* abaikan */ } } try { this.out.disconnect(); } catch (e) { /* abaikan */ } }, 300);
    this.ok = false;
  }

  /* uji suara: gas pelan ke tinggi lalu turun */
  static test(cfg) {
    const s = new MotoSound(cfg);
    if (!s.ok) return;
    let t0 = performance.now();
    const id = setInterval(() => {
      const t = (performance.now() - t0) / 1000;
      const k = t < 1.4 ? t / 1.4 : t < 1.9 ? 1 : Math.max(0, 1 - (t - 1.9) / 0.9);
      s.update(1500 + k * 7500, k, 1);
      if (t > 2.9) { clearInterval(id); s.stop(); }
    }, 40);
    return s;
  }

  horn() {
    const g = Audio.graph();
    if (!g) return;
    const c = g.ctx, t = c.currentTime;
    for (const f of [420, 520]) {
      const o = c.createOscillator(), gn = c.createGain();
      o.type = 'square'; o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.12, t + 0.02); gn.gain.setTargetAtTime(0.0001, t + 0.3, 0.05);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      o.connect(lp); lp.connect(gn); gn.connect(g.dest); o.start(t); o.stop(t + 0.6);
    }
  }
}
