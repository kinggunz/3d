/* Voice chat Mabar: WebRTC peer-to-peer, sinyal lewat MQTT (net.send).
   Koneksi hanya dibuat kalau ada pemain yang menyalakan mic (hemat baterai & data). */

const ICE = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:global.stun.twilio.com:3478'] },
    {
      urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};
const MAX_PEERS = 6;

export const voiceSupported = () => typeof RTCPeerConnection !== 'undefined' && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

export class Voice {
  /* opts: { myId, send(m), nameOf(id), onSpeak(names[]), onInfo(text) } */
  constructor(opts) {
    this.o = opts;
    this.myId = opts.myId;
    this.peers = new Map();
    this.known = new Set();
    this.peerMic = new Map();
    this.track = null;
    this.stream = null;
    this.micOn = false;
    this.ctx = null;
    this.myAn = null;
    this.myBuf = null;
    this.speakT = 0;
    this.disposed = false;
    this.lastSpeak = '';
  }

  get anyMic() {
    if (this.micOn) return true;
    for (const v of this.peerMic.values()) if (v) return true;
    return false;
  }

  /* ---------- mic ---------- */
  async setMic(on) {
    if (this.disposed) return false;
    if (on) {
      if (this.track) { this.micOn = true; return true; }
      if (!voiceSupported()) throw new Error('Mic/voice tidak didukung perangkat ini.');
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (this.disposed) { s.getTracks().forEach((t) => t.stop()); return false; }
      this.stream = s;
      this.track = s.getAudioTracks()[0];
      this.micOn = true;
      this._meter(s);
      for (const P of this.peers.values()) this._giveTrack(P);
      this.o.send({ t: 'vc', on: 1 });
      for (const id of this.known) this.ensure(id);
      return true;
    }
    this.micOn = false;
    if (this.track) {
      try { this.track.stop(); } catch (e) { /* abaikan */ }
      this.track = null;
    }
    this.stream = null;
    this.myAn = null;
    for (const P of this.peers.values()) {
      if (P.sender) { try { P.sender.replaceTrack(null); } catch (e) { /* abaikan */ } }
    }
    this.o.send({ t: 'vc', on: 0 });
    return false;
  }

  _meter(stream) {
    try {
      const ctx = this._ctx();
      if (!ctx) return;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      this.myAn = an;
      this.myBuf = new Uint8Array(an.frequencyBinCount);
    } catch (e) { /* abaikan */ }
  }

  _ctx() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { this.ctx = new C(); } catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  _giveTrack(P) {
    if (P.sender && this.track) {
      try { P.sender.replaceTrack(this.track).catch(() => {}); } catch (e) { /* abaikan */ }
    }
  }

  /* ---------- pemain muncul / pergi ---------- */
  peerSeen(id) {
    this.known.add(id);
    if (this.anyMic) this.ensure(id);
  }

  peerLeft(id) {
    this.known.delete(id);
    this.peerMic.delete(id);
    this.drop(id);
  }

  /* ---------- koneksi ---------- */
  ensure(id) {
    let P = this.peers.get(id);
    if (P) return P;
    if (this.disposed || typeof RTCPeerConnection === 'undefined') return null;
    if (this.peers.size >= MAX_PEERS) return null;
    let pc;
    try { pc = new RTCPeerConnection(ICE); } catch (e) { return null; }
    P = { id, pc, audio: null, an: null, buf: null, ice: [], remoteSet: false, sender: null, initiator: this.myId < id, timer: null, tries: 0, level: 0, born: performance.now() };
    this.peers.set(id, P);
    pc.onicecandidate = (e) => {
      if (e.candidate) this.o.send({ t: 'rtc', to: id, k: 'ice', d: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
    };
    pc.ontrack = (e) => this._attach(P, e);
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') { clearTimeout(P.timer); P.tries = 0; }
      else if (st === 'failed') this._retry(P);
      else if (st === 'disconnected') {
        clearTimeout(P.timer);
        P.timer = setTimeout(() => { if (pc.connectionState !== 'connected') this._retry(P); }, 6000);
      }
    };
    if (P.initiator) {
      try {
        const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
        P.sender = tr.sender;
        this._giveTrack(P);
      } catch (e) { this.drop(id); return null; }
      pc.onnegotiationneeded = () => this._offer(P);
      /* kalau tidak tersambung dalam 12 dtk, coba ulang */
      P.timer = setTimeout(() => { if (pc.connectionState !== 'connected') this._retry(P); }, 12000);
    }
    return P;
  }

  _retry(P) {
    if (this.disposed || this.peers.get(P.id) !== P) return;
    const id = P.id;
    const tries = P.tries + 1;
    this.drop(id);
    if (tries > 3 || !this.known.has(id)) return;
    if (!this.anyMic) return;
    /* hanya pihak initiator yang memulai ulang; pihak lain menunggu offer baru */
    if (this.myId < id) {
      const N = this.ensure(id);
      if (N) N.tries = tries;
    }
  }

  async _offer(P) {
    const pc = P.pc;
    try {
      const o = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(o);
      this.o.send({ t: 'rtc', to: P.id, k: 'offer', d: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    } catch (e) { /* abaikan; ada retry */ }
  }

  async onMsg(m) {
    if (this.disposed) return;
    if (m.t === 'vc') {
      this.peerMic.set(m.f, !!m.on);
      this.known.add(m.f);
      if (m.on) this.ensure(m.f);
      return;
    }
    if (m.t !== 'rtc' || m.to !== this.myId) return;
    const id = m.f;
    this.known.add(id);
    try {
      if (m.k === 'offer') {
        let P = this.peers.get(id);
        if (P && (P.remoteSet || P.initiator)) { this.drop(id); P = null; }
        P = P || this.ensure(id);
        if (!P) return;
        const pc = P.pc;
        await pc.setRemoteDescription(m.d);
        P.remoteSet = true;
        for (const tr of pc.getTransceivers()) {
          try { tr.direction = 'sendrecv'; } catch (e) { /* abaikan */ }
          if (!P.sender && tr.receiver && tr.receiver.track && tr.receiver.track.kind === 'audio') P.sender = tr.sender;
        }
        this._giveTrack(P);
        const a = await pc.createAnswer();
        await pc.setLocalDescription(a);
        this.o.send({ t: 'rtc', to: id, k: 'answer', d: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
        await this._flush(P);
      } else if (m.k === 'answer') {
        const P = this.peers.get(id);
        if (!P || P.remoteSet || P.pc.signalingState !== 'have-local-offer') return;
        await P.pc.setRemoteDescription(m.d);
        P.remoteSet = true;
        await this._flush(P);
      } else if (m.k === 'ice') {
        const P = this.peers.get(id);
        if (!P) return;
        if (!P.remoteSet) P.ice.push(m.d);
        else await P.pc.addIceCandidate(m.d).catch(() => {});
      }
    } catch (e) { /* sinyal rusak/telat: abaikan, ada retry */ }
  }

  async _flush(P) {
    const q = P.ice;
    P.ice = [];
    for (const c of q) { try { await P.pc.addIceCandidate(c); } catch (e) { /* abaikan */ } }
  }

  _attach(P, e) {
    const stream = (e.streams && e.streams[0]) || new MediaStream([e.track]);
    if (!P.audio) {
      const a = document.createElement('audio');
      a.autoplay = true;
      a.playsInline = true;
      a.style.display = 'none';
      document.body.appendChild(a);
      P.audio = a;
    }
    P.audio.srcObject = stream;
    const pl = P.audio.play();
    if (pl && pl.catch) pl.catch(() => {});
    try {
      const ctx = this._ctx();
      if (ctx) {
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        P.an = an;
        P.buf = new Uint8Array(an.frequencyBinCount);
      }
    } catch (err) { /* abaikan */ }
  }

  drop(id) {
    const P = this.peers.get(id);
    if (!P) return;
    this.peers.delete(id);
    clearTimeout(P.timer);
    try { P.pc.onicecandidate = null; P.pc.ontrack = null; P.pc.onconnectionstatechange = null; P.pc.onnegotiationneeded = null; P.pc.close(); } catch (e) { /* abaikan */ }
    if (P.audio) { try { P.audio.pause(); P.audio.srcObject = null; P.audio.remove(); } catch (e) { /* abaikan */ } }
  }

  /* panggil dari gestur pengguna: lanjutkan audio yang diblok autoplay */
  resume() {
    for (const P of this.peers.values()) {
      if (P.audio && P.audio.paused && P.audio.srcObject) { const pl = P.audio.play(); if (pl && pl.catch) pl.catch(() => {}); }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /* indikator siapa yang sedang bicara (dipanggil tiap frame, diatur ~5x/dtk) */
  update(dt) {
    this.speakT -= dt;
    if (this.speakT > 0) return;
    this.speakT = 0.2;
    const lvl = (an, buf) => {
      an.getByteFrequencyData(buf);
      let s = 0;
      const n = Math.min(buf.length, 40);
      for (let i = 1; i < n; i++) s += buf[i];
      return s / (n - 1);
    };
    const names = [];
    if (this.micOn && this.myAn) { if (lvl(this.myAn, this.myBuf) > 22) names.push('Kamu'); }
    for (const P of this.peers.values()) {
      if (P.an && lvl(P.an, P.buf) > 22) names.push(this.o.nameOf(P.id));
    }
    const key = names.join(',');
    if (key !== this.lastSpeak) { this.lastSpeak = key; this.o.onSpeak(names); }
  }

  /* jumlah koneksi yang sudah tersambung */
  connected() {
    let n = 0;
    for (const P of this.peers.values()) if (P.pc.connectionState === 'connected') n++;
    return n;
  }

  dispose() {
    this.disposed = true;
    for (const id of [...this.peers.keys()]) this.drop(id);
    if (this.track) { try { this.track.stop(); } catch (e) { /* abaikan */ } }
    this.track = null;
    this.stream = null;
    if (this.ctx) { try { this.ctx.close(); } catch (e) { /* abaikan */ } this.ctx = null; }
  }
}
