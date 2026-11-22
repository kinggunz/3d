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

  /* gumaman penumpang mengobrol di kabin: noise berformant dengan irama suku kata */
  murmur(on) {
    if (!this.ok) return;
    if (!this.mur) {
      const c = this.c;
      this.mur = c.createGain(); this.mur.gain.value = 0; this.mur.connect(this.out);
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      for (const [f, q, g] of [[520, 6, 1.0], [1450, 8, 0.7], [2600, 8, 0.35]]) {
        const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
        const gg = c.createGain(); gg.gain.value = g; src.connect(b); b.connect(gg); gg.connect(this.mur);
      }
      const lfo = c.createOscillator(); lfo.frequency.value = 3.6; const lg = c.createGain(); lg.gain.value = 0.04;
      lfo.connect(lg); lg.connect(this.mur.gain); lfo.start(); src.start(); this.src.push(src, lfo);
    }
    this.ramp(this.mur.gain, on ? 0.06 : 0, 0.8);
  }


  /* ====== SUARA ORANG buatan sendiri (sintesis formant), tidak butuh TTS / file audio ======
     Teks Indonesia dipecah jadi suku kata (konsonan + vokal); tiap vokal punya formant F1/F2,
     konsonan jadi desis/letupan singkat. Pitch beda untuk tiap tokoh dan ada intonasi kalimat. */
  voice(text, dur, kind = 0, loud = false, bus = null, gender = 'L') {
    if (!this.ok) return;
    const c = this.c;
    const FORM = { a: [800, 1250], i: [300, 2300], u: [330, 850], e: [520, 1850], o: [520, 950] };
    const base = [112, gender === 'P' ? 215 : 135, 220, 175, 92][kind] || 130;
    const raw = String(text || '').toLowerCase();
    const excl = /!/.test(raw), ques = /\?/.test(raw);
    const txt = raw.replace(/[^a-z ]/g, ' ');
    const syl = [];
    let cons = '';
    for (const ch of txt) {
      if (ch === ' ') { if (syl.length && !syl[syl.length - 1].pause) syl.push({ pause: true }); cons = ''; }
      else if ('aiueo'.includes(ch)) { syl.push({ c: cons.slice(-2), v: ch }); cons = ''; }
      else cons += ch;
    }
    while (syl.length && syl[syl.length - 1].pause) syl.pop();
    const n = syl.length;
    if (!n) return;
    const pauses = syl.filter((x) => x.pause).length;
    const words = n - pauses;
    const per = Math.max(0.075, Math.min(0.24, (dur * 0.9) / (words + pauses * 0.6)));
    const t0 = c.currentTime + 0.03;
    const dest = bus || this.out;
    const out = c.createGain();
    out.gain.value = (loud ? 1.25 : 0.8) * (bus ? 1 : 0.55);
    out.connect(dest);
    /* sumber suara: gelombang gigi gergaji + getar halus */
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    const vib = c.createOscillator(); vib.frequency.value = 5.2;
    const vg = c.createGain(); vg.gain.value = 14; vib.connect(vg); vg.connect(osc.detune);
    const env = c.createGain(); env.gain.value = 0;
    osc.connect(env);
    const bands = [[700, 7, 1.0], [1200, 9, 0.8], [2600, 10, 0.28]].map(([f, q, g]) => {
      const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f; b.Q.value = q;
      const gg = c.createGain(); gg.gain.value = g;
      env.connect(b); b.connect(gg); gg.connect(out);
      return b;
    });
    /* desis & letupan konsonan */
    const ns = c.createBufferSource(); ns.buffer = this.noise; ns.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
    const ng = c.createGain(); ng.gain.value = 0;
    ns.connect(hp); hp.connect(ng); ng.connect(out);
    let t = t0;
    osc.frequency.setValueAtTime(base, t0);
    syl.forEach((sy, i) => {
      if (sy.pause) { env.gain.setTargetAtTime(0, t, 0.02); t += per * 0.6; return; }
      const prog = i / Math.max(1, n - 1);
      let f0 = base * (1 + 0.1 * Math.sin(i * 1.3 + kind)) * (1 - 0.14 * prog) * (excl ? 1.12 : 1);
      if (ques && prog > 0.8) f0 *= 1.0 + (prog - 0.8) * 1.2;
      const [F1, F2] = FORM[sy.v];
      const sc = kind === 2 ? 1.12 : kind === 4 ? 0.9 : 1;
      const cs = sy.c || '';
      const nasal = /[mn]$/.test(cs);
      const fric = /[sfhzjc]|sy|kh/.test(cs);
      const plos = /[ptkbdg]$/.test(cs);
      const cT = cs ? Math.min(0.05, per * 0.3) : 0;
      if (cs) {
        ng.gain.setTargetAtTime(fric ? 0.5 : plos ? 0.35 : 0, t, 0.004);
        ng.gain.setTargetAtTime(0, t + cT * 0.7, 0.01);
        env.gain.setTargetAtTime(nasal ? 0.22 : 0.02, t, 0.008);
      }
      const tv = t + cT;
      osc.frequency.setTargetAtTime(f0, tv, 0.03);
      bands[0].frequency.setTargetAtTime(F1 * sc * (nasal ? 0.7 : 1), tv, 0.02);
      bands[1].frequency.setTargetAtTime(F2 * sc, tv, 0.02);
      const amp = (loud ? 0.95 : 0.7) * (0.75 + 0.25 * Math.sin(i * 2.1 + 1));
      env.gain.setTargetAtTime(amp, tv, 0.012);
      env.gain.setTargetAtTime(0.05, tv + per * 0.62, 0.025);
      t += per;
    });
    env.gain.setTargetAtTime(0, t, 0.03);
    const end = t + 0.35;
    osc.start(t0); vib.start(t0); ns.start(t0);
    osc.stop(end); vib.stop(end); ns.stop(end);
    setTimeout(() => { try { out.disconnect(); } catch (e) { /* abaikan */ } }, (end - c.currentTime + 0.3) * 1000);
  }

  /* percakapan penumpang di kabin: kalimat pendek dari banyak suara, teredam seperti di kejauhan */
  chatter(on, gender) {
    if (!this.ok) return;
    if (!on) { if (this.chatT) { clearTimeout(this.chatT); this.chatT = null; } return; }
    if (this.chatT) return;
    const c = this.c;
    if (!this.chatBus) {
      this.chatBus = c.createGain(); this.chatBus.gain.value = 0.55;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.5;
      this.chatBus.connect(lp); lp.connect(this.out);
    }
    const PH = [
      'wah pemandangannya bagus sekali', 'kamu mau minum apa', 'sebentar lagi kita sampai ya', 'aku nggak sabar lihat pulaunya',
      'sabuk pengamannya sudah kamu pasang', 'cuacanya cerah banget hari ini', 'ibu lihat awan itu', 'kita nanti makan apa',
      'tadi di bandara ramai sekali', 'aku baru pertama kali naik pesawat', 'hei bisa geser sedikit', 'terima kasih ya',
      'berapa lama lagi sampainya', 'anak anak jangan berisik', 'ayo kita foto dulu', 'kopinya enak juga',
    ];
    const kinds = [0, 2, 3, 4, 2, 0, 3];
    const tick = () => {
      if (!this.ok || !this.chatT) return;
      const ph = PH[(Math.random() * PH.length) | 0];
      const k = kinds[(Math.random() * kinds.length) | 0];
      this.voice(ph, 0.9 + ph.length * 0.055, k, false, this.chatBus, k === 3 || k === 2 ? 'P' : 'L');
      /* kadang dua orang saling menyahut */
      if (Math.random() < 0.4) setTimeout(() => { if (this.ok && this.chatT) this.voice(PH[(Math.random() * PH.length) | 0], 1.3, kinds[(Math.random() * kinds.length) | 0], false, this.chatBus); }, 1100 + Math.random() * 700);
      this.chatT = setTimeout(tick, 1800 + Math.random() * 2600);
    };
    this.chatT = setTimeout(tick, 600);
  }

  /* jeritan penumpang: 'aaaah' dengan pitch tinggi dan bergetar */
  shout(i, gender) {
    const kinds = [3, 2, 0, 4];
    this.voice('aaaaaaah', 1.1, kinds[i % 4], true, null, gender);
  }

  stop() {
    if (!this.ok) return;
    this.alarm(false); this.heart(false);
    if (this.chatT) { clearTimeout(this.chatT); this.chatT = null; }
    const t = this.c.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, 0.25);
    setTimeout(() => { for (const s of this.src) { try { s.stop(); } catch (e) { /* abaikan */ } } try { this.out.disconnect(); } catch (e) { /* abaikan */ } }, 1500);
    this.ok = false;
  }
}
