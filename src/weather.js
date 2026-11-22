/* CUACA: cerah -> mendung -> hujan -> hujan petir -> redup -> cerah kembali (siklus acak).
   Hujan berupa garis jatuh di sekitar kamera, langit/kabut/cahaya meredup, petir berkilat
   dengan suara guntur. Semua suara dibuat prosedural (tanpa file audio). */
import * as THREE from 'three';
import { Audio } from './audio.js';
import { clamp, lerp } from './util.js';

const V3 = THREE.Vector3;
const GREY = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);

class WeatherSound {
  constructor() {
    this.ok = false;
    const gph = Audio.graph();
    if (!gph) return;
    const c = this.c = gph.ctx;
    this.noise = gph.noise;
    this.out = c.createGain();
    this.out.gain.value = 1;
    this.out.connect(gph.dest);
    this.rainG = c.createGain(); this.rainG.gain.value = 0;
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 3600; f1.Q.value = 0.45;
    const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 7000;
    const s1 = c.createBufferSource(); s1.buffer = this.noise; s1.loop = true;
    s1.connect(f1); f1.connect(f2); f2.connect(this.rainG); this.rainG.connect(this.out);
    s1.start();
    /* gemuruh hujan rendah */
    this.lowG = c.createGain(); this.lowG.gain.value = 0;
    const f3 = c.createBiquadFilter(); f3.type = 'lowpass'; f3.frequency.value = 500;
    const s2 = c.createBufferSource(); s2.buffer = this.noise; s2.loop = true; s2.playbackRate.value = 0.6;
    s2.connect(f3); f3.connect(this.lowG); this.lowG.connect(this.out);
    s2.start();
    this.src = [s1, s2];
    this.ok = true;
  }
  level(w, muffled) {
    if (!this.ok) return;
    const t = this.c.currentTime;
    this.rainG.gain.setTargetAtTime(w * (muffled ? 0.03 : 0.22), t, 0.6);
    this.lowG.gain.setTargetAtTime(w * (muffled ? 0.05 : 0.26), t, 0.6);
  }
  burst(dur, gain, f0, f1, type = 'lowpass', q = 0.7, delay = 0) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }
  tone(f0, f1, dur, gain, delay = 0) {
    if (!this.ok) return;
    const c = this.c, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out); o.start(t); o.stop(t + dur + 0.05);
  }
  /* guntur: retakan tajam lalu gemuruh panjang; dist 0..1 (dekat..jauh) */
  thunder(dist, delay) {
    const near = 1 - dist;
    this.burst(0.14, 0.5 * (0.4 + near), 7000, 1500, 'bandpass', 1.4, delay);
    this.burst(2.6 + near * 1.6, 0.55 + near * 0.9, 1100 - dist * 500, 45, 'lowpass', 0.7, delay + 0.05);
    this.tone(75, 28, 2.4 + near, 0.35 + near * 0.5, delay + 0.08);
    this.burst(1.4, 0.3, 500, 60, 'lowpass', 0.6, delay + 0.9 + dist * 0.5);
  }
  stop() {
    if (!this.ok) return;
    const t = this.c.currentTime;
    this.out.gain.setTargetAtTime(0, t, 0.2);
    setTimeout(() => { for (const s of this.src) { try { s.stop(); } catch (e) { /* abaikan */ } } try { this.out.disconnect(); } catch (e) { /* abaikan */ } }, 1200);
    this.ok = false;
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);

export const weatherMixin = {
  initWeather() {
    const N = this.q && this.q.low ? 420 : 900;
    const pos = new Float32Array(N * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xcfdbe8, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const lines = new THREE.LineSegments(g, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 4;
    lines.visible = false;
    this.scene.add(lines);
    const drops = [];
    for (let i = 0; i < N; i++) drops.push({ x: rnd(-22, 22), y: rnd(0, 26), z: rnd(-22, 22), v: rnd(24, 34) });
    this.wx = {
      lines, pos, drops, N, kind: 'clear', k: 0, target: 0, storm: 0, stormTarget: 0,
      timer: rnd(70, 150), phaseT: 0, bolts: [], flash: 0, nextBolt: 6, snd: null, announced: '',
    };
  },

  /* ganti cuaca secara manual (dipakai juga oleh jadwal acak) */
  setWeather(kind, announce = true) {
    const w = this.wx;
    if (!w) return;
    w.kind = kind;
    if (kind === 'clear') { w.target = 0; w.stormTarget = 0; w.timer = rnd(110, 260); if (announce) this.toast('Hujan mulai reda... langit kembali cerah'); }
    else if (kind === 'rain') { w.target = rnd(0.55, 0.85); w.stormTarget = 0; w.timer = rnd(60, 140); if (announce) this.toast('Langit mendung, hujan mulai turun'); }
    else if (kind === 'storm') { w.target = 1; w.stormTarget = 1; w.timer = rnd(55, 120); w.nextBolt = rnd(2, 6); if (announce) this.toast('Hujan petir! Hati-hati...'); }
  },

  weatherSchedule(dt) {
    const w = this.wx;
    w.timer -= dt;
    if (w.timer > 0) return;
    if (w.kind === 'clear') this.setWeather(Math.random() < 0.55 ? 'rain' : 'storm');
    else if (w.kind === 'rain') this.setWeather(Math.random() < 0.3 ? 'storm' : 'clear');
    else this.setWeather(Math.random() < 0.35 ? 'rain' : 'clear');
  },

  weatherUpdate(dt) {
    const w = this.wx;
    if (!w) return;
    const sk = this.sky;
    const off = this.intro || this.war || this.moto || this.dead;
    if (!this.paused && !off) this.weatherSchedule(dt);
    const tgt = off ? 0 : w.target;
    w.k += (tgt - w.k) * Math.min(1, dt / 5);
    if (Math.abs(w.k - tgt) < 0.002) w.k = tgt;
    w.storm += ((off ? 0 : w.stormTarget) - w.storm) * Math.min(1, dt / 4);
    const k = w.k;
    const inside = this.inCave;

    /* suara hujan */
    if (k > 0.02 && !w.snd) w.snd = new WeatherSound();
    if (w.snd) {
      w.snd.level(inside ? 0 : k, false);
      if (k <= 0.005 && w.kind === 'clear' && w.snd.ok) { w.snd.stop(); w.snd = null; }
    }

    /* tampilan langit meredup */
    if (k > 0.003 && !inside) {
      const day = sk.day;
      const base = 0.3 + 0.7 * day;
      GREY.setRGB(0.5 * base, 0.54 * base, 0.58 * base);
      const sc = this.scene;
      if (sc.background && sc.background.isColor) sc.background.lerp(GREY, k * 0.85);
      if (sc.fog) {
        sc.fog.color.lerp(GREY, k * 0.9);
        sc.fog.near *= 1 - 0.5 * k;
        sc.fog.far *= 1 - 0.55 * k;
      }
      sk.sun.intensity *= 1 - 0.78 * k;
      sk.moon.intensity *= 1 - 0.5 * k;
      sk.hemi.intensity *= 1 - 0.25 * k;
      sk.stars.material.opacity *= 1 - k;
      sk.sunMesh.visible = k < 0.4;
      sk.moonMesh.visible = k < 0.4;
      sk.cloudMat.color.multiplyScalar(1 - 0.5 * k);
      sk.cloudMat.color.lerp(GREY, k * 0.4);
    } else if (!inside && sk.sunMesh) {
      sk.sunMesh.visible = true; sk.moonMesh.visible = true;
    }

    /* hujan */
    const L = w.lines;
    const show = k > 0.03 && !inside;
    L.visible = show;
    if (show) {
      const cam = this.cam.position;
      const n = Math.max(40, Math.floor(w.N * clamp(k, 0.1, 1)));
      const wind = 3 + w.storm * 6;
      const pos = w.pos;
      for (let i = 0; i < n; i++) {
        const d = w.drops[i];
        d.y -= d.v * dt;
        d.x += wind * dt * 0.5;
        if (d.y < -2) { d.y = rnd(20, 28); d.x = rnd(-22, 22); d.z = rnd(-22, 22); }
        if (d.x > 22) d.x -= 44;
        const x = cam.x + d.x, y = cam.y + d.y - 6, z = cam.z + d.z;
        const j = i * 6, len = 0.55 + k * 0.5;
        pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
        pos[j + 3] = x - wind * 0.012 * len * 8; pos[j + 4] = y + len; pos[j + 5] = z;
      }
      L.geometry.setDrawRange(0, n * 2);
      L.geometry.attributes.position.needsUpdate = true;
      L.material.opacity = 0.18 + 0.32 * k;
    }

    /* petir */
    if (w.storm > 0.5 && !inside && !off && !this.paused) {
      w.nextBolt -= dt;
      if (w.nextBolt <= 0) { w.nextBolt = rnd(5, 15); this.weatherStrike(); }
    }
    for (let i = w.bolts.length - 1; i >= 0; i--) {
      const b = w.bolts[i];
      b.t -= dt;
      b.line.material.opacity = b.t > 0 ? clamp(b.t / 0.35, 0, 1) * (Math.sin(b.t * 70) > -0.3 ? 1 : 0.35) : 0;
      if (b.t <= 0) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); w.bolts.splice(i, 1); }
    }
    if (w.flash > 0.01) {
      w.flash *= Math.exp(-dt * 7);
      const f = w.flash;
      if (!inside) {
        if (this.scene.background && this.scene.background.isColor) this.scene.background.lerp(WHITE, f * 0.55);
        if (this.scene.fog) this.scene.fog.color.lerp(WHITE, f * 0.5);
        sk.hemi.intensity += f * 1.4;
      }
    }
  },

  weatherStrike() {
    const w = this.wx;
    const ang = Math.random() * Math.PI * 2;
    const dist = rnd(50, 170);
    const cam = this.cam.position;
    const x = cam.x + Math.cos(ang) * dist, z = cam.z + Math.sin(ang) * dist;
    const gy = this.hf ? this.hf.sample(x, z) : 0;
    const pts = [];
    let px = x + rnd(-12, 12), pz = z + rnd(-12, 12), py = gy + 140;
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      pts.push(new V3(px, py, pz));
      const t = (i + 1) / steps;
      px = lerp(px, x, 0.35) + rnd(-4, 4) * (1 - t);
      pz = lerp(pz, z, 0.35) + rnd(-4, 4) * (1 - t);
      py = lerp(gy + 140, gy, t) + rnd(-2, 2);
    }
    pts[pts.length - 1].set(x, gy, z);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xeaf0ff, transparent: true, opacity: 1, fog: false, blending: THREE.AdditiveBlending, depthWrite: false });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    w.bolts.push({ line, t: 0.4 });
    w.flash = 1;
    const d01 = clamp((dist - 50) / 120, 0, 1);
    if (w.snd) w.snd.thunder(d01, 0.25 + d01 * 1.8);
  },

  disposeWeather() {
    const w = this.wx;
    if (!w) return;
    if (w.snd) { w.snd.stop(); w.snd = null; }
    this.scene.remove(w.lines);
    w.lines.geometry.dispose();
    w.lines.material.dispose();
    for (const b of w.bolts) { this.scene.remove(b.line); b.line.geometry.dispose(); b.line.material.dispose(); }
    this.wx = null;
  },
};
