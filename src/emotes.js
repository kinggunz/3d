/* Emote: roda pilihan (10 + 10), animasi karakter, gelembung ikon di atas kepala. Terlihat pemain lain. */
import * as THREE from 'three';
import { EMOTES, EMOTE_BY_ID, buildChar, applyEmote, resetPose, poseChar, clearPose, attackKind } from './chars.js';
import { iconURL, ico } from './icons.js';

const $ = (id) => document.getElementById(id);

/* tekstur gelembung (dicache per ikon) */
const texCache = new Map();
function bubbleTex(icon) {
  if (texCache.has(icon)) return texCache.get(icon);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const draw = (img) => {
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.strokeStyle = '#1b1410';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(64, 58, 46, 0, Math.PI * 2);
    g.fill(); g.stroke();
    g.beginPath(); g.moveTo(52, 98); g.lineTo(64, 120); g.lineTo(76, 98); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.94)'; g.fillRect(54, 94, 20, 6);
    if (img) g.drawImage(img, 26, 20, 76, 76);
  };
  draw(null);
  const tex = new THREE.CanvasTexture(cv);
  const img = new Image();
  img.onload = () => { draw(img); tex.needsUpdate = true; };
  img.src = iconURL(icon);
  texCache.set(icon, tex);
  return tex;
}

export const emoteMixin = {
  initEmote(look) {
    this.emPage = 0;
    this.em = null;
    this.bubbles = [];
    this.walkT = 0;
    this.selfChar = buildChar(look);
    this.selfChar.visible = false;
    this.scene.add(this.selfChar);
  },

  /* ---------- roda emote ---------- */
  openEmote() {
    if (this.dead || this.sleeping || this.hudEditing) return;
    $('emoteWheel').classList.add('show');
    this.renderEmote();
  },
  closeEmote() { $('emoteWheel').classList.remove('show'); },
  emoteOpen() { return $('emoteWheel').classList.contains('show'); },

  renderEmote() {
    const ring = $('emoteRing');
    const size = Math.floor(Math.min(innerHeight, innerWidth) * 0.94);
    ring.style.width = ring.style.height = size + 'px';
    ring.innerHTML = '';
    const list = EMOTES.filter((e) => e.page === this.emPage);
    const R = size * 0.37;
    list.forEach((e, i) => {
      const a = -Math.PI / 2 + (i / list.length) * Math.PI * 2;
      const b = document.createElement('button');
      b.className = 'emSlot';
      b.style.left = size / 2 + Math.cos(a) * R + 'px';
      b.style.top = size / 2 + Math.sin(a) * R + 'px';
      b.innerHTML = ico(e.icon) + '<span>' + e.name + '</span>';
      b.onclick = () => { this.playEmote(e.id); this.closeEmote(); };
      ring.appendChild(b);
    });
    const c = document.createElement('button');
    c.className = 'emCenter';
    c.innerHTML = ico('page') + '<span>Halaman ' + (this.emPage + 1) + '/2</span>';
    c.onclick = () => { this.emPage = 1 - this.emPage; this.renderEmote(); };
    ring.appendChild(c);
  },

  /* ---------- memainkan emote ---------- */
  playEmote(id, fromNet) {
    const def = EMOTE_BY_ID[id];
    if (!def) return;
    this.em = { id, t: 0 };
    this.addBubble(this.selfChar, def.icon);
    if (!fromNet && this.net) this.net.send({ t: 'em', i: id });
  },

  stopEmote() {
    if (!this.em) return;
    this.em = null;
    resetPose(this.selfChar);
    if (this.net) this.net.send({ t: 'em', i: '' });
  },

  addBubble(g, icon) {
    this.clearBubble(g);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(icon), depthTest: false, transparent: true }));
    sp.scale.set(0.95, 0.95, 1);
    sp.position.y = ((g.userData && g.userData.top) || 2.4) + 0.55;
    sp.renderOrder = 7;
    g.add(sp);
    this.bubbles.push({ g, sp, t: 0 });
  },
  clearBubble(g) {
    this.bubbles = this.bubbles.filter((b) => {
      if (b.g !== g) return true;
      g.remove(b.sp);
      b.sp.material.dispose();
      return false;
    });
  },

  /* ---------- tiap frame: model sendiri + gelembung ---------- */
  updateSelfModel(dt) {
    const sc = this.selfChar, p = this.p;
    if (!sc) return;
    sc.visible = !!this.tp && !this.sleeping && !this.intro;
    if (this.em && (this.moving || this.dead || this.driving || this.inWater)) this.stopEmote();
    if (!sc.visible) return;
    sc.position.set(p.x, p.y, p.z);
    sc.rotation.y = p.yaw + Math.PI;
    sc.scale.y = 1; /* jongkok = badan menekuk, bukan mengecil */
    let playing = false;
    if (this.em) {
      this.em.t += dt;
      playing = applyEmote(sc, this.em.id, this.em.t);
      if (!playing) this.stopEmote();
    }
    if (playing) { clearPose(sc); return; }
    const mv = this.moving && !this.dead ? 1 : 0;
    this.walkT += dt * (mv ? (this.inWater ? 6 : this.sprinting ? 12 : this.crouch ? 6 : 9) : 0);
    poseChar(sc, {
      t: this.walkT, time: performance.now() / 1000, mv, run: this.sprinting, crouch: this.crouchT,
      land: this.landT || 0, inAir: !this.onGround && !this.inWater && !p.on, vy: p.vy, swim: this.inWater,
      atk: this.swing > 0 ? { k: attackKind(this.eq), p: this.swing } : null,
      dead: this.dead ? this.deadT : undefined,
    }, dt);
  },

  updateBubbles(dt) {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.t += dt;
      const k = b.t < 0.25 ? b.t / 0.25 : 1;
      const base = ((b.g.userData && b.g.userData.top) || 2.4) + 0.55;
      b.sp.position.y = base + Math.sin(b.t * 4) * 0.05;
      b.sp.scale.setScalar(0.95 * (0.5 + 0.5 * k));
      b.sp.material.opacity = b.t > 2.6 ? Math.max(0, 1 - (b.t - 2.6) / 0.5) : 1;
      if (b.t > 3.1) {
        b.g.remove(b.sp);
        b.sp.material.dispose();
        this.bubbles.splice(i, 1);
      }
    }
  },
};
