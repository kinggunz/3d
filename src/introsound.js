/* Suara prosedural untuk adegan pesawat: mesin, angin, hujan, petir, ledakan, alarm, jeritan, detak jantung */
import { Audio } from './audio.js';

export class IntroSound {
  constructor() {
    this.ok = false;
    const gph = Audio.graph();
    if (!gph) return;
    const c = this.c = gph.ctx;
    this.noise = gph.noise;
    this.out = c.createGain();
    this.out.gain.value = 1;
    this.out.connect(gph.dest);
    this.src = [];
    this.timers = [];
    const osc = (type, f, g, dest) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const gn = c.createGain(); gn.gain.value = g; o.connect(gn); gn.connect(dest); o.start(); this.src.push(o); return o; };
    const loopNoise = (dest) => { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.connect(dest); s.start(); this.src.push(s); return s; };
    /* mesin */
    this.engG = c.createGain(); this.engG.gain.value = 0;
    this.engLp = c.createBiquadFilter(); this.engLp.type = 'lowpass'; this.engLp.frequency.value = 900; this.engLp.Q.value = 0.8;
    this.engMix = c.createGain();
    this.engMix.connect(this.engLp); this.engLp.connect(this.engG); this.engG.connect(this.out);
    this.o1 = osc('sawtooth', 76, 0.22, this.engMix);
    this.o2 = osc('sawtooth', 114, 0.14, this.engMix);
    this.o3 = osc('triangle', 52, 0.3, this.engMix);
    this.whine = osc('sine', 1650, 0.012, this.engMix);
    const nb = c.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 520; nb.Q.value = 0.6;
    const ng = c.createGain(); ng.gain.value = 0.55;
    loopNoise(nb); nb.connect(ng); ng.connect(this.engMix);
    this.lfo = c.createOscillator(); this.lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 0.02;
    this.lfo.connect(lg); lg.connect(this.engG.gain); this.lfo.start(); this.src.push(this.lfo); this.lfoG = lg;
    /* angin */
    this.windG = c.createGain(); this.windG.gain.value = 0;
    const wf = c.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 900;
    const ns = loopNoise(wf); void ns; wf.connect(this.windG); this.windG.connect(this.out);
    /* hujan */
    this.rainG = c.createGain(); this.rainG.gain.value = 0;
    this.rainF = c.createBiquadFilter(); this.rainF.type = 'bandpass'; this.rainF.frequency.value = 4200; this.rainF.Q.value = 0.5;
    loopNoise(this.rainF); this.rainF.connect(this.rainG); this.rainG.connect(this.out);
    this.ok = true;
  }

  ramp(param, v, t = 0.4) { if (!this.ok) return; param.cancelScheduledValues(this.c.currentTime); param.setTargetAtTime(v, this.c.currentTime, t / 3); }

  /* inside: true = di dalam kabin (teredam); vol 0..1 */
  engine(vol, inside) { if (!this.ok) return; this.ramp(this.engG.gain, vol * 0.55, 0.3); this.ramp(this.engLp.frequency, inside ? 520 : 2600, 0.4); this.ramp(this.windG.gain, inside ? 0.012 : 0.05 * vol, 0.4); }
  rain(v, inside) { if (!this.ok) return; this.ramp(this.rainG.gain, v * (inside ? 0.12 : 0.3), 0.8); this.ramp(this.rainF.frequency, inside ? 2200 : 4200, 0.5); }
  damage(d) { if (!this.ok) return; const t = this.c.currentTime; this.o1.frequency.setTargetAtTime(76 - d * 30, t, 0.5); this.o2.frequency.setTargetAtTime(114 + d * 25, t, 0.5); this.whine.frequency.setTargetAtTime(1650 - d * 900, t, 0.6); this.lfoG.gain.setTargetAtTime(0.02 + d * 0.16, t, 0.3); this.lfo.frequency.setTargetAtTime(9 - d * 3, t, 0.3); }

  burst(dur, gain, f0, f1, type = 'lowpass', q = 1) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }
  tone(f0, f1, dur, type, gain, delay = 0) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  thunder(big) {
    this.burst(big ? 3.2 : 2.2, big ? 1.1 : 0.7, 900, 50, 'lowpass', 0.7);
    if (big) this.tone(70, 28, 2.2, 'sine', 0.8);
    else this.tone(60, 30, 1.6, 'sine', 0.35);
  }
  crackle() { this.burst(0.12, 0.9, 6000, 1500, 'bandpass', 1.5); }
  bam() { this.crackle(); this.burst(2.4, 1.6, 2500, 60, 'lowpass', 0.6); this.tone(90, 25, 1.8, 'sine', 1.0); this.tone(240, 40, 0.9, 'sawtooth', 0.3); }
  crash() { this.burst(3.8, 1.8, 3000, 40, 'lowpass', 0.5); this.burst(1.2, 0.9, 900, 120, 'bandpass', 0.8); this.tone(60, 20, 3, 'sine', 1.2); }
  scream(i) { const f = 520 + (i % 5) * 90; for (let k = 0; k < 3; k++) { this.tone(f * (1 + k * 0.01), f * 1.6, 0.9, 'sawtooth', 0.045, k * 0.08); } this.burst(0.8, 0.05, 2500, 1800, 'bandpass', 3); }
  blip(i) { this.tone(240 + (i % 4) * 55 + Math.random() * 40, 0, 0.045, 'triangle', 0.07); }
  ding() { this.tone(1046, 0, 0.9, 'sine', 0.22); this.tone(1318, 0, 0.9, 'sine', 0.18, 0.18); }

  alarm(on) {
    if (this.alarmT) { clearInterval(this.alarmT); this.alarmT = null; }
    if (!on || !this.ok) return;
    const beep = () => { this.tone(880, 0, 0.18, 'square', 0.09); this.tone(660, 0, 0.18, 'square', 0.09, 0.22); };
    beep();
    this.alarmT = setInterval(beep, 650);
    this.timers.push(this.alarmT);
  }
  heart(on) {
    if (this.heartT) { clearInterval(this.heartT); this.heartT = null; }
    if (!on || !this.ok) return;
    const b = () => { this.tone(58, 38, 0.22, 'sine', 0.7); this.tone(52, 34, 0.2, 'sine', 0.5, 0.2); };
    b();
    this.heartT = setInterval(b, 1000);
    this.timers.push(this.heartT);
  }
  ring(on) { if (!this.ok) return; if (on) { this.tone(4200, 3800, 4.5, 'sine', 0.06); } }
  fire(v) { if (!this.ok || v <= 0.02) return; this.burst(0.1, 0.35 * v, 3200 + Math.random() * 2000, 1500, 'bandpass', 2); }

  stop() {
    if (!this.ok) return;
    this.alarm(false); this.heart(false);
    const t = this.c.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => { for (const s of this.src) { try { s.stop(); } catch (e) { /* abaikan */ } } try { this.out.disconnect(); } catch (e) { /* abaikan */ } }, 1500);
    this.ok = false;
  }
}
